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

app.use(compression());
winston.remove(winston.transports.Console);
winston.add(winston.transports.Console, {'timestamp': true});

for (let prop in endpoints.types) {
    if (endpoints.types.hasOwnProperty(prop)) {
        let ffmpegParams = endpoints.types[prop];
        let bytes = 0;
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
                
                let outputFile = uniqueFilename(__dirname + '/uploads/') + '.' + ffmpegParams.extension;
                
                // Handle multi-file processing (audio-image-mp4)
                if (ffmpegParams.multiFile && uploadedFiles.length >= 2) {
                    let audioFile = null;
                    let imageFile = null;
                    
                    // Find audio and image files
                    uploadedFiles.forEach(file => {
                        if (file.mimetype.startsWith('audio/')) {
                            audioFile = file.savedFile;
                        } else if (file.mimetype.startsWith('image/')) {
                            imageFile = file.savedFile;
                        }
                    });
                    
                    if (audioFile && imageFile) {
                        winston.info(JSON.stringify({
                            action: 'begin audio-image conversion',
                            audio: audioFile,
                            image: imageFile,
                            to: outputFile,
                        }));
                        
                        let ffmpegConvertCommand = ffmpeg()
                            .input(imageFile)
                            .input(audioFile)
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
                    } else {
                        let err = JSON.stringify({
                            type: 'input_error',
                            message: 'Both audio and image files are required',
                            received: uploadedFiles.map(f => ({name: f.filename, type: f.mimetype}))
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
            });
            return req.pipe(busboy);
        });
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
