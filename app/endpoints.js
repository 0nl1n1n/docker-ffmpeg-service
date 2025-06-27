exports.types = {
    jpg: {
        extension: 'jpg',
        outputOptions: [
            '-pix_fmt yuv422p',
        ],
    },
    m4a: {
        extension: 'm4a',
        outputOptions: [
            '-codec:a libfdk_aac',
        ],
    },
    mp3: {
        extension: 'mp3',
        outputOptions: [
            '-codec:a libmp3lame',
        ],
    },
    mp4: {
        extension: 'mp4',
        outputOptions: [
            '-codec:v libx264',
            '-profile:v high',
            '-r 15',
            '-crf 23',
            '-preset ultrafast',
            '-b:v 500k',
            '-maxrate 500k',
            '-bufsize 1000k',
            '-vf scale=-2:640',
            '-threads 8',
            '-codec:a libfdk_aac',
            '-b:a 128k',
        ],
    },
    'audio-image-mp4': {
        extension: 'mp4',
        outputOptions: [
            '-codec:v libx264',
            '-profile:v high',
            '-r 30',
            '-crf 23',
            '-preset ultrafast',
            '-b:v 1000k',
            '-maxrate 1000k',
            '-bufsize 2000k',
            '-vf scale=-2:720',
            '-threads 8',
            '-codec:a libfdk_aac',
            '-b:a 128k',
            '-shortest',
        ],
        multiFile: true,
        requires: ['audio', 'image'],
    },
};
