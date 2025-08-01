const fs = require('fs');
const express = require('express');
const app = express();
const Busboy = require('busboy');
const compression = require('compression');
const ffmpeg = require('fluent-ffmpeg');
const uniqueFilename = require('unique-filename');
const consts = require(__dirname + '/app/constants.js');
const endpoints = require(__dirname + '/app/endpoints.js');
const winston = require('winston');
const https = require('https');
const http = require('http');
const url = require('url');

app.use(compression());
app.use(express.json({ limit: '50mb' }));
winston.remove(winston.transports.Console);
winston.add(winston.transports.Console, {'timestamp': true});

// Helper function to download file from URL
function downloadFile(fileUrl, callback) {
    const parsedUrl = url.parse(fileUrl);
    const protocol = parsedUrl.protocol === 'https:' ? https : http;
    
    const request = protocol.get(fileUrl, (response) => {
        if (response.statusCode !== 200) {
            callback(new Error(`Failed to download file: ${response.statusCode}`));
            return;
        }
        
        const tempFile = uniqueFilename(__dirname + '/uploads/');
        const fileStream = fs.createWriteStream(tempFile);
        
        response.pipe(fileStream);
        
        fileStream.on('finish', () => {
            fileStream.close();
            callback(null, tempFile, response.headers['content-type']);
        });
        
        fileStream.on('error', (err) => {
            fs.unlink(tempFile, () => {}); // Delete temp file
            callback(err);
        });
    });
    
    request.on('error', (err) => {
        callback(err);
    });
    
    request.setTimeout(30000, () => {
        request.destroy();
        callback(new Error('Download timeout'));
    });
}

// Helper function to process files (either uploaded or downloaded from URLs)
function processFiles(files, ffmpegParams, res, winston) {
    let uploadedFiles = files;
    let outputFile = uniqueFilename(__dirname + '/uploads/') + '.' + ffmpegParams.extension;
    
    winston.info(JSON.stringify({
        action: 'processing files',
        count: uploadedFiles.length,
        to: outputFile,
    }));
    
    // Handle simple compilation processing (no blur, maintain first video dimensions)
    if (ffmpegParams.isCompilationSimple) {
        winston.info(JSON.stringify({
            action: 'begin simple compilation',
            videos: uploadedFiles.length,
            to: outputFile,
        }));
        
        if (uploadedFiles.length < 2) {
            let err = JSON.stringify({
                type: 'input_error',
                message: 'Compilation requires at least 2 videos',
                received: uploadedFiles.length
            });
            winston.error(err);
            // Clean up uploaded files
            uploadedFiles.forEach(file => {
                if (fs.existsSync(file.savedFile)) {
                    fs.unlinkSync(file.savedFile);
                }
            });
            res.writeHead(400, {'Connection': 'close'});
            res.end(err);
            return;
        }
        
        // Get dimensions from first video
        ffmpeg.ffprobe(uploadedFiles[0].savedFile, function(err, metadata) {
            if (err) {
                winston.error(JSON.stringify({
                    type: 'ffprobe_error',
                    message: err,
                }));
                // Clean up uploaded files
                uploadedFiles.forEach(file => {
                    if (fs.existsSync(file.savedFile)) {
                        fs.unlinkSync(file.savedFile);
                    }
                });
                res.writeHead(500, {'Connection': 'close'});
                res.end(JSON.stringify({error: 'Failed to get video dimensions'}));
                return;
            }
            
            let videoStream = metadata.streams.find(s => s.codec_type === 'video');
            let targetWidth = videoStream.width;
            let targetHeight = videoStream.height;
            let targetFps = eval(videoStream.r_frame_rate) || 30;
            
            winston.info(JSON.stringify({
                action: 'detected first video dimensions',
                width: targetWidth,
                height: targetHeight,
                fps: targetFps,
            }));
            
            // Create a temporary file list for concat
            let fileListPath = uniqueFilename(__dirname + '/uploads/') + '.txt';
            let fileListContent = '';
            
            // Process each video to match first video's dimensions
            let processedCount = 0;
            let processingError = false;
            let tempFiles = [];
            
            uploadedFiles.forEach((file, index) => {
                let tempProcessed = uniqueFilename(__dirname + '/uploads/') + '_processed.mp4';
                tempFiles.push(tempProcessed);
                fileListContent += `file '${tempProcessed}'\n`;
                
                ffmpeg(file.savedFile)
                    .renice(15)
                    .outputOptions([
                        '-vf', `scale=${targetWidth}:${targetHeight}:force_original_aspect_ratio=decrease,pad=${targetWidth}:${targetHeight}:(ow-iw)/2:(oh-ih)/2:black,setpts=PTS-STARTPTS`,
                        '-c:v', 'libx264',
                        '-preset', 'ultrafast',
                        '-crf', '23',
                        '-c:a', 'aac',
                        '-b:a', '128k',
                        '-r', targetFps.toString(),
                        '-g', '60',
                        '-af', 'aresample=async=1:first_pts=0,asetpts=PTS-STARTPTS',
                        '-vsync', 'cfr'
                    ])
                    .on('error', function(err) {
                        processingError = true;
                        winston.error(JSON.stringify({
                            type: 'ffmpeg_processing',
                            message: err.message || err,
                            file: file.filename
                        }));
                    })
                    .on('end', function() {
                        processedCount++;
                        
                        // When all videos are processed, concatenate them
                        if (processedCount === uploadedFiles.length && !processingError) {
                            // Write file list
                            fs.writeFileSync(fileListPath, fileListContent);
                            
                            ffmpeg()
                                .input(fileListPath)
                                .inputOptions(['-f', 'concat', '-safe', '0'])
                                .renice(15)
                                .outputOptions([
                                    ...ffmpegParams.outputOptions,
                                    '-avoid_negative_ts', 'make_zero',
                                    '-fflags', '+genpts'
                                ])
                                .on('error', function(err) {
                                    winston.error(JSON.stringify({
                                        type: 'ffmpeg_concat',
                                        message: err.message || err
                                    }));
                                    // Clean up all files
                                    uploadedFiles.forEach(file => {
                                        if (fs.existsSync(file.savedFile)) {
                                            fs.unlinkSync(file.savedFile);
                                        }
                                    });
                                    if (fs.existsSync(fileListPath)) {
                                        fs.unlinkSync(fileListPath);
                                    }
                                    tempFiles.forEach(tempFile => {
                                        if (fs.existsSync(tempFile)) {
                                            fs.unlinkSync(tempFile);
                                        }
                                    });
                                    res.writeHead(500, {'Connection': 'close'});
                                    res.end(JSON.stringify({error: 'Concatenation failed'}));
                                })
                                .on('end', function() {
                                    // Clean up all temporary files
                                    uploadedFiles.forEach(file => {
                                        if (fs.existsSync(file.savedFile)) {
                                            fs.unlinkSync(file.savedFile);
                                        }
                                    });
                                    if (fs.existsSync(fileListPath)) {
                                        fs.unlinkSync(fileListPath);
                                    }
                                    tempFiles.forEach(tempFile => {
                                        if (fs.existsSync(tempFile)) {
                                            fs.unlinkSync(tempFile);
                                        }
                                    });
                                    
                                    winston.info(JSON.stringify({
                                        action: 'starting download to client',
                                        file: outputFile,
                                    }));

                                    res.download(outputFile, null, function(err) {
                                        if (err) {
                                            winston.error(JSON.stringify({
                                                type: 'download',
                                                message: err,
                                            }));
                                        }
                                        winston.info(JSON.stringify({
                                            action: 'deleting',
                                            file: outputFile,
                                        }));
                                        if (fs.existsSync(outputFile)) {
                                            fs.unlinkSync(outputFile);
                                            winston.info(JSON.stringify({
                                                action: 'deleted',
                                                file: outputFile,
                                            }));
                                        }
                                    });
                                })
                                .save(outputFile);
                        }
                    })
                    .save(tempProcessed);
            });
        });
        return;
    }
    
    // Handle compilation processing
    if (ffmpegParams.isCompilation) {
        winston.info(JSON.stringify({
            action: 'begin compilation',
            videos: uploadedFiles.length,
            to: outputFile,
        }));
        
        if (uploadedFiles.length < 2) {
            let err = JSON.stringify({
                type: 'input_error',
                message: 'Compilation requires at least 2 videos',
                received: uploadedFiles.length
            });
            winston.error(err);
            // Clean up uploaded files
            uploadedFiles.forEach(file => {
                if (fs.existsSync(file.savedFile)) {
                    fs.unlinkSync(file.savedFile);
                }
            });
            res.writeHead(400, {'Connection': 'close'});
            res.end(err);
            return;
        }
        
        // Create a temporary file list for concat
        let fileListPath = uniqueFilename(__dirname + '/uploads/') + '.txt';
        let fileListContent = '';
        let complexFilter = [];
        let filterInputs = [];
        
        // Process each video to create the blur effect for vertical videos
        uploadedFiles.forEach((file, index) => {
            let tempProcessed = uniqueFilename(__dirname + '/uploads/') + '_processed.mp4';
            fileListContent += `file '${tempProcessed}'\n`;
            
            // Create filter for each video with blur background
            complexFilter.push(
                // Split the input into two streams
                `[${index}:v]split=2[blur${index}][vid${index}]`,
                // Create blurred background
                `[blur${index}]scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080,boxblur=20:20[blurred${index}]`,
                // Scale video to fit height, maintaining aspect ratio
                `[vid${index}]scale=w=1920:h=1080:force_original_aspect_ratio=decrease[scaled${index}]`,
                // Overlay scaled video on blurred background
                `[blurred${index}][scaled${index}]overlay=(W-w)/2:(H-h)/2[v${index}]`
            );
            filterInputs.push(`[v${index}]`);
        });
        
        // Write file list
        fs.writeFileSync(fileListPath, fileListContent);
        
        // First pass: process each video with blur effect
        let processedCount = 0;
        let processingError = false;
        
        uploadedFiles.forEach((file, index) => {
            let tempProcessed = uniqueFilename(__dirname + '/uploads/') + '_processed.mp4';
            
            ffmpeg(file.savedFile)
                .renice(15)
                .complexFilter([
                    // Split the input into two streams
                    '[0:v]split=2[blur][vid]',
                    // Create blurred background
                    '[blur]scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080,boxblur=20:20[blurred]',
                    // Scale video to fit, maintaining aspect ratio
                    '[vid]scale=w=1920:h=1080:force_original_aspect_ratio=decrease,setpts=PTS-STARTPTS[scaled]',
                    // Overlay scaled video on blurred background
                    '[blurred][scaled]overlay=(W-w)/2:(H-h)/2[out]'
                ])
                .outputOptions([
                    '-map', '[out]',
                    '-map', '0:a?',
                    '-c:v', 'libx264',
                    '-preset', 'ultrafast',
                    '-crf', '23',
                    '-c:a', 'aac',
                    '-b:a', '128k',
                    '-r', '30',
                    '-g', '60',
                    '-af', 'aresample=async=1:first_pts=0,asetpts=PTS-STARTPTS',
                    '-vsync', 'cfr'
                ])
                .on('error', function(err) {
                    processingError = true;
                    winston.error(JSON.stringify({
                        type: 'ffmpeg_processing',
                        message: err.message || err,
                        file: file.filename
                    }));
                })
                .on('end', function() {
                    processedCount++;
                    
                    // When all videos are processed, concatenate them
                    if (processedCount === uploadedFiles.length && !processingError) {
                        ffmpeg()
                            .input(fileListPath)
                            .inputOptions(['-f', 'concat', '-safe', '0'])
                            .renice(15)
                            .outputOptions([
                                ...ffmpegParams.outputOptions,
                                '-avoid_negative_ts', 'make_zero',
                                '-fflags', '+genpts'
                            ])
                            .on('error', function(err) {
                                winston.error(JSON.stringify({
                                    type: 'ffmpeg_concat',
                                    message: err.message || err
                                }));
                                // Clean up all files
                                uploadedFiles.forEach(file => {
                                    if (fs.existsSync(file.savedFile)) {
                                        fs.unlinkSync(file.savedFile);
                                    }
                                });
                                if (fs.existsSync(fileListPath)) {
                                    fs.unlinkSync(fileListPath);
                                }
                                // Clean up processed files
                                let processedFiles = fileListContent.match(/file '([^']+)'/g);
                                if (processedFiles) {
                                    processedFiles.forEach(match => {
                                        let filePath = match.match(/file '([^']+)'/)[1];
                                        if (fs.existsSync(filePath)) {
                                            fs.unlinkSync(filePath);
                                        }
                                    });
                                }
                                res.writeHead(500, {'Connection': 'close'});
                                res.end(JSON.stringify({error: 'Concatenation failed'}));
                            })
                            .on('end', function() {
                                // Clean up all temporary files
                                uploadedFiles.forEach(file => {
                                    if (fs.existsSync(file.savedFile)) {
                                        fs.unlinkSync(file.savedFile);
                                    }
                                });
                                if (fs.existsSync(fileListPath)) {
                                    fs.unlinkSync(fileListPath);
                                }
                                // Clean up processed files
                                let processedFiles = fileListContent.match(/file '([^']+)'/g);
                                if (processedFiles) {
                                    processedFiles.forEach(match => {
                                        let filePath = match.match(/file '([^']+)'/)[1];
                                        if (fs.existsSync(filePath)) {
                                            fs.unlinkSync(filePath);
                                        }
                                    });
                                }
                                
                                winston.info(JSON.stringify({
                                    action: 'starting download to client',
                                    file: outputFile,
                                }));

                                res.download(outputFile, null, function(err) {
                                    if (err) {
                                        winston.error(JSON.stringify({
                                            type: 'download',
                                            message: err,
                                        }));
                                    }
                                    winston.info(JSON.stringify({
                                        action: 'deleting',
                                        file: outputFile,
                                    }));
                                    if (fs.existsSync(outputFile)) {
                                        fs.unlinkSync(outputFile);
                                        winston.info(JSON.stringify({
                                            action: 'deleted',
                                            file: outputFile,
                                        }));
                                    }
                                });
                            })
                            .save(outputFile);
                    }
                })
                .save(tempProcessed);
        });
        return;
    }
    
    // Handle multi-file processing (audio-image-mp4, audio-mix)
    if (ffmpegParams.multiFile && uploadedFiles.length >= 2) {
        let audioFile = null;
        let imageFile = null;
        let backgroundFile = null;
        let vocalsFile = null;
        
        // Find audio and image files
        uploadedFiles.forEach(file => {
            if (file.mimetype && (file.mimetype.startsWith('audio/') || 
                file.filename.match(/\.(mp3|wav|m4a|aac|ogg|flac|wma)$/i))) {
                if (file.fieldname === 'background') {
                    backgroundFile = file.savedFile;
                } else if (file.fieldname === 'vocals') {
                    vocalsFile = file.savedFile;
                } else {
                    audioFile = file.savedFile;
                }
            } else if (file.mimetype && (file.mimetype.startsWith('image/') || 
                       file.filename.match(/\.(jpg|jpeg|png|gif|bmp|tiff|webp)$/i))) {
                imageFile = file.savedFile;
            }
        });
        
        // Handle audio-image-mp4
        if (audioFile && imageFile) {
            winston.info(JSON.stringify({
                action: 'begin audio-image conversion',
                audio: audioFile,
                image: imageFile,
                to: outputFile,
            }));
            
            let ffmpegConvertCommand = ffmpeg()
                .input(imageFile)
                .inputOptions(['-loop', '1'])
                .input(audioFile)
                .renice(15)
                .outputOptions(ffmpegParams.outputOptions)
                .outputOptions(['-shortest'])
                .on('error', function(err, stdout, stderr) {
                    let log = JSON.stringify({
                        type: 'ffmpeg',
                        message: err.message || err,
                        stdout: stdout,
                        stderr: stderr,
                        command: ffmpegConvertCommand._getArguments ? ffmpegConvertCommand._getArguments().join(' ') : 'unknown'
                    });
                    winston.error(log);
                    // Clean up uploaded files
                    uploadedFiles.forEach(file => {
                        if (fs.existsSync(file.savedFile)) {
                            fs.unlinkSync(file.savedFile);
                        }
                    });
                    res.writeHead(500, {'Connection': 'close'});
                    res.end(log);
                })
                .on('end', function() {
                    // Clean up uploaded files
                    uploadedFiles.forEach(file => {
                        if (fs.existsSync(file.savedFile)) {
                            fs.unlinkSync(file.savedFile);
                        }
                    });
                    
                    winston.info(JSON.stringify({
                        action: 'starting download to client',
                        file: outputFile,
                    }));

                    res.download(outputFile, null, function(err) {
                        if (err) {
                            winston.error(JSON.stringify({
                                type: 'download',
                                message: err,
                            }));
                        }
                        winston.info(JSON.stringify({
                            action: 'deleting',
                            file: outputFile,
                        }));
                        if (fs.existsSync(outputFile)) {
                            fs.unlinkSync(outputFile);
                            winston.info(JSON.stringify({
                                action: 'deleted',
                                file: outputFile,
                            }));
                        }
                    });
                })
                .save(outputFile);
        }
        // Handle audio-mix (background + vocals)
        else if (backgroundFile && vocalsFile) {
            winston.info(JSON.stringify({
                action: 'begin audio mixing',
                background: backgroundFile,
                vocals: vocalsFile,
                to: outputFile,
            }));
            
            // First get vocals duration
            let vocalsDuration = 0;
            ffmpeg.ffprobe(vocalsFile, function(err, metadata) {
                if (err) {
                    winston.error(JSON.stringify({
                        type: 'ffprobe_error',
                        message: err,
                    }));
                    res.writeHead(500, {'Connection': 'close'});
                    res.end(JSON.stringify({error: 'Failed to get vocals duration'}));
                    return;
                }
                
                vocalsDuration = parseFloat(metadata.format.duration);
                let fadeOutStart = 10 + vocalsDuration; // 10 seconds delay + vocal duration
                let totalDuration = fadeOutStart + 15; // Fade-out start + 15 seconds fade-out duration
                
                winston.info(JSON.stringify({
                    action: 'vocals duration detected',
                    duration: vocalsDuration,
                    fadeOutStart: fadeOutStart,
                    totalDuration: totalDuration,
                }));
                
                let ffmpegConvertCommand = ffmpeg()
                    .input(backgroundFile)
                    .input(vocalsFile)
                    .renice(15)
                    .complexFilter([
                        `[0:a]apad=pad_dur=${totalDuration},volume=0.1,afade=t=in:st=0:d=5[bg_fadein]`, // Pad and fade in background
                        '[1:a]adelay=10000|10000[vocal_delayed]',
                        '[bg_fadein][vocal_delayed]amix=inputs=2:duration=longest:dropout_transition=3[amixed]',
                        `[amixed]afade=t=out:st=${fadeOutStart}:d=15,atrim=duration=${totalDuration}[out]`
                    ])
                    .outputOptions(['-map', '[out]'])
                    .outputOptions(ffmpegParams.outputOptions)
                    .on('error', function(err, stdout, stderr) {
                        let log = JSON.stringify({
                            type: 'ffmpeg',
                            message: err.message || err,
                            stdout: stdout,
                            stderr: stderr,
                            command: ffmpegConvertCommand._getArguments ? ffmpegConvertCommand._getArguments().join(' ') : 'unknown'
                        });
                        winston.error(log);
                        // Clean up uploaded files
                        uploadedFiles.forEach(file => {
                            if (fs.existsSync(file.savedFile)) {
                                fs.unlinkSync(file.savedFile);
                            }
                        });
                        res.writeHead(500, {'Connection': 'close'});
                        res.end(log);
                    })
                    .on('end', function() {
                        // Clean up uploaded files
                        uploadedFiles.forEach(file => {
                            if (fs.existsSync(file.savedFile)) {
                                fs.unlinkSync(file.savedFile);
                            }
                        });
                        
                        winston.info(JSON.stringify({
                            action: 'starting download to client',
                            file: outputFile,
                        }));

                        res.download(outputFile, null, function(err) {
                            if (err) {
                                winston.error(JSON.stringify({
                                    type: 'download',
                                    message: err,
                                }));
                            }
                            winston.info(JSON.stringify({
                                action: 'deleting',
                                file: outputFile,
                            }));
                            if (fs.existsSync(outputFile)) {
                                fs.unlinkSync(outputFile);
                                winston.info(JSON.stringify({
                                    action: 'deleted',
                                    file: outputFile,
                                }));
                            }
                        });
                    })
                    .save(outputFile);
            });
        } else {
            let err = JSON.stringify({
                type: 'input_error',
                message: 'Required files not found',
                received: uploadedFiles.map(f => ({name: f.filename, type: f.mimetype, fieldname: f.fieldname}))
            });
            winston.error(err);
            // Clean up uploaded files
            uploadedFiles.forEach(file => {
                if (fs.existsSync(file.savedFile)) {
                    fs.unlinkSync(file.savedFile);
                }
            });
            res.writeHead(400, {'Connection': 'close'});
            res.end(err);
        }
    } else if (ffmpegParams.ffprobe) {
        // Handle ffprobe operations (audio-duration)
        let inputFile = uploadedFiles[0].savedFile;
        winston.info(JSON.stringify({
            action: 'begin ffprobe operation',
            from: inputFile,
            to: outputFile,
        }));
        
        ffmpeg.ffprobe(inputFile, function(err, metadata) {
            if (err) {
                let log = JSON.stringify({
                    type: 'ffprobe_error',
                    message: err,
                });
                winston.error(log);
                // Clean up uploaded files
                uploadedFiles.forEach(file => {
                    if (fs.existsSync(file.savedFile)) {
                        fs.unlinkSync(file.savedFile);
                    }
                });
                res.writeHead(500, {'Connection': 'close'});
                res.end(log);
                return;
            }
            
            let duration = metadata.format.duration;
            winston.info(JSON.stringify({
                action: 'ffprobe completed',
                duration: duration,
            }));
            
            // Clean up uploaded files
            uploadedFiles.forEach(file => {
                if (fs.existsSync(file.savedFile)) {
                    fs.unlinkSync(file.savedFile);
                }
            });
            
            // Send duration as plain text
            res.setHeader('Content-Type', 'text/plain');
            res.setHeader('Content-Disposition', 'attachment; filename="duration.txt"');
            res.send(duration.toString());
        });
    } else {
        // Handle single file processing (existing logic)
        let inputFile = uploadedFiles[0].savedFile;
        winston.info(JSON.stringify({
            action: 'begin conversion',
            from: inputFile,
            to: outputFile,
        }));
        let ffmpegConvertCommand = ffmpeg(inputFile);
        ffmpegConvertCommand
                .renice(15)
                .outputOptions(ffmpegParams.outputOptions)
                .on('error', function(err) {
                    let log = JSON.stringify({
                        type: 'ffmpeg',
                        message: err,
                    });
                    winston.error(log);
                    // Clean up uploaded files
                    uploadedFiles.forEach(file => {
                        if (fs.existsSync(file.savedFile)) {
                            fs.unlinkSync(file.savedFile);
                        }
                    });
                    res.writeHead(500, {'Connection': 'close'});
                    res.end(log);
                })
                .on('end', function() {
                    // Clean up uploaded files
                    uploadedFiles.forEach(file => {
                        if (fs.existsSync(file.savedFile)) {
                            fs.unlinkSync(file.savedFile);
                        }
                    });
                    winston.info(JSON.stringify({
                        action: 'starting download to client',
                        file: outputFile,
                    }));

                    res.download(outputFile, null, function(err) {
                        if (err) {
                            winston.error(JSON.stringify({
                                type: 'download',
                                message: err,
                            }));
                        }
                        winston.info(JSON.stringify({
                            action: 'deleting',
                            file: outputFile,
                        }));
                        if (fs.existsSync(outputFile)) {
                            fs.unlinkSync(outputFile);
                            winston.info(JSON.stringify({
                                action: 'deleted',
                                file: outputFile,
                            }));
                        }
                    });
                })
                .save(outputFile);
    }
}

for (let prop in endpoints.types) {
    if (endpoints.types.hasOwnProperty(prop)) {
        let ffmpegParams = endpoints.types[prop];
        let bytes = 0;
        
        // File upload endpoint
        app.post('/' + prop, function(req, res) {
            let hitLimit = false;
            let fileName = '';
            let savedFile = uniqueFilename(__dirname + '/uploads/');
            let uploadedFiles = [];
            let fileCount = 0;
            let expectedFiles = 1;
            
            // Check if this endpoint requires multiple files
            if (ffmpegParams.multiFile && ffmpegParams.requires) {
                expectedFiles = ffmpegParams.requires.length;
            } else if (ffmpegParams.isCompilation || ffmpegParams.isCompilationSimple) {
                expectedFiles = 100; // Allow up to 100 videos for compilation
            }
            
            let busboy = new Busboy({
                headers: req.headers,
                limits: {
                    files: expectedFiles,
                    fileSize: consts.fileSizeLimit,
            }});
            busboy.on('filesLimit', function() {
                winston.error(JSON.stringify({
                    type: 'filesLimit',
                    message: 'Upload file size limit hit',
                }));
            });

            busboy.on('file', function(
                fieldname,
                file,
                filename,
                encoding,
                mimetype
            ) {
                file.on('limit', function(file) {
                    hitLimit = true;
                    let err = {file: filename, error: 'exceeds max size limit'};
                    err = JSON.stringify(err);
                    winston.error(err);
                    res.writeHead(500, {'Connection': 'close'});
                    res.end(err);
                });
                let log = {
                    file: filename,
                    encoding: encoding,
                    mimetype: mimetype,
                };
                winston.info(JSON.stringify(log));
                file.on('data', function(data) {
                    bytes += data.length;
                });
                file.on('end', function(data) {
                    log.bytes = bytes;
                    winston.info(JSON.stringify(log));
                });

                fileName = filename;
                winston.info(JSON.stringify({
                    action: 'Uploading',
                    name: fileName,
                }));
                
                let currentSavedFile = uniqueFilename(__dirname + '/uploads/');
                uploadedFiles.push({
                    fieldname: fieldname,
                    filename: filename,
                    savedFile: currentSavedFile,
                    mimetype: mimetype
                });
                
                let written = file.pipe(fs.createWriteStream(currentSavedFile));

                if (written) {
                    winston.info(JSON.stringify({
                        action: 'saved',
                        path: currentSavedFile,
                    }));
                }
            });
            busboy.on('finish', function() {
                if (hitLimit) {
                    // Clean up any uploaded files
                    uploadedFiles.forEach(file => {
                        if (fs.existsSync(file.savedFile)) {
                            fs.unlinkSync(file.savedFile);
                        }
                    });
                    return;
                }
                
                winston.info(JSON.stringify({
                    action: 'upload complete',
                    files: uploadedFiles.map(f => f.filename),
                }));
                
                processFiles(uploadedFiles, ffmpegParams, res, winston);
            });
            return req.pipe(busboy);
        });
        
        // URL input endpoint (if supported)
        if (ffmpegParams.urlSupport) {
            app.post('/' + prop + '/url', function(req, res) {
                let inputUrls = [];
                
                // Handle different URL input formats
                if (ffmpegParams.isCompilation || ffmpegParams.isCompilationSimple) {
                    // Compilation endpoints - expect array of video URLs
                    if (req.body.videos && Array.isArray(req.body.videos)) {
                        req.body.videos.forEach((videoUrl, index) => {
                            inputUrls.push({
                                fieldname: 'video' + index,
                                url: videoUrl,
                                filename: 'video' + index + '.mp4'
                            });
                        });
                        
                        if (inputUrls.length < 2) {
                            res.status(400).json({
                                error: 'Compilation requires at least 2 video URLs',
                                example: { videos: ['https://example.com/video1.mp4', 'https://example.com/video2.mp4'] }
                            });
                            return;
                        }
                    } else {
                        res.status(400).json({
                            error: 'Missing videos array parameter',
                            example: { videos: ['https://example.com/video1.mp4', 'https://example.com/video2.mp4'] }
                        });
                        return;
                    }
                } else if (ffmpegParams.multiFile && ffmpegParams.requires) {
                    // Multi-file endpoints
                    ffmpegParams.requires.forEach(requiredField => {
                        if (req.body[requiredField]) {
                            inputUrls.push({
                                fieldname: requiredField,
                                url: req.body[requiredField],
                                filename: requiredField + '.tmp'
                            });
                        }
                    });
                    
                    if (inputUrls.length !== ffmpegParams.requires.length) {
                        res.status(400).json({
                            error: 'Missing required URLs',
                            required: ffmpegParams.requires,
                            received: inputUrls.map(u => u.fieldname)
                        });
                        return;
                    }
                } else {
                    // Single file endpoints
                    if (req.body.url) {
                        inputUrls.push({
                            fieldname: 'file',
                            url: req.body.url,
                            filename: 'input.tmp'
                        });
                    } else {
                        res.status(400).json({
                            error: 'Missing URL parameter',
                            example: { url: 'https://example.com/file.mp3' }
                        });
                        return;
                    }
                }
                
                winston.info(JSON.stringify({
                    action: 'URL processing started',
                    urls: inputUrls.map(u => u.url),
                }));
                
                // Download all files
                let downloadedFiles = [];
                let downloadCount = 0;
                let hasError = false;
                
                inputUrls.forEach((inputUrl, index) => {
                    downloadFile(inputUrl.url, (err, tempFile, contentType) => {
                        downloadCount++;
                        
                        if (err) {
                            winston.error(JSON.stringify({
                                type: 'download_error',
                                url: inputUrl.url,
                                message: err.message,
                            }));
                            
                            if (!hasError) {
                                hasError = true;
                                res.status(500).json({
                                    error: 'Failed to download file',
                                    url: inputUrl.url,
                                    message: err.message
                                });
                            }
                            return;
                        }
                        
                        downloadedFiles.push({
                            fieldname: inputUrl.fieldname,
                            filename: inputUrl.filename,
                            savedFile: tempFile,
                            mimetype: contentType || 'application/octet-stream'
                        });
                        
                        winston.info(JSON.stringify({
                            action: 'file downloaded',
                            url: inputUrl.url,
                            saved: tempFile,
                        }));
                        
                        // Process when all downloads are complete
                        if (downloadCount === inputUrls.length && !hasError) {
                            winston.info(JSON.stringify({
                                action: 'all downloads complete',
                                files: downloadedFiles.map(f => f.filename),
                            }));
                            
                            processFiles(downloadedFiles, ffmpegParams, res, winston);
                        }
                    });
                });
            });
        }
    }
}

require('express-readme')(app, {
    filename: 'README.md',
    routes: ['/', '/readme'],
});

const server = app.listen(consts.port, function() {
    let host = server.address().address;
    let port = server.address().port;
    winston.info(JSON.stringify({
        action: 'listening',
        url: 'http://'+host+':'+port,
    }));
});

server.on('connection', function(socket) {
    winston.info(JSON.stringify({
        action: 'new connection',
        timeout: consts.timeout,
    }));
    socket.setTimeout(consts.timeout);
    socket.server.timeout = consts.timeout;
    server.keepAliveTimeout = consts.timeout;
});

app.use(function(req, res, next) {
  res.status(404).send(JSON.stringify({error: 'route not available'})+'\n');
});
