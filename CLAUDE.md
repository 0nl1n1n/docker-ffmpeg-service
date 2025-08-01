# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Recent Updates (2025-08-01)

### Fixed Audio Sync Issue in Video Compilation
- **Problem**: Audio drift in `/compilation-simple/url` endpoint when concatenating multiple videos
- **Cause**: Timestamp misalignment during video preprocessing and concatenation
- **Solution**: Added timestamp synchronization using:
  - `setpts=PTS-STARTPTS` filter for video streams
  - `asetpts=PTS-STARTPTS` and `aresample=async=1:first_pts=0` for audio streams
  - `-vsync cfr` for constant frame rate
  - `-avoid_negative_ts make_zero` and `-fflags +genpts` for concat operation

## High-Level Architecture

This is a Node.js/Express web service that provides FFmpeg conversion capabilities through HTTP endpoints. The service processes media files using FFmpeg and fluent-ffmpeg libraries, supporting both file uploads and URL inputs.

### Core Components

1. **Main Application (`app.js`)**:
   - Express server handling HTTP endpoints
   - File upload processing via Busboy
   - URL download functionality for remote file processing
   - Delegates FFmpeg operations to processFiles function

2. **Endpoint Configuration (`app/endpoints.js`)**:
   - Defines conversion types and their FFmpeg parameters
   - Each endpoint type specifies output format, FFmpeg options, and whether it supports URL input
   - Special endpoints: audio-image-mp4 (multi-file), audio-mix (complex filtering), audio-duration (ffprobe), compilation (video concatenation with blur effect)

3. **Constants (`app/constants.js`)**:
   - fileSizeLimit: 524MB
   - port: 3000
   - timeout: 1 hour

### Processing Flow

1. **File Upload**: Files are uploaded via multipart/form-data, saved temporarily, processed with FFmpeg, then deleted
2. **URL Input**: Files are downloaded from URLs, processed identically to uploads
3. **Multi-file Operations**: Some endpoints (audio-image-mp4, audio-mix, compilation) require multiple input files with specific field names
4. **Compilation Processing**: Videos are processed individually with blur effect, then concatenated using FFmpeg's concat demuxer

## Common Commands

```bash
# Run the service locally
node app.js

# Build Docker image
docker build -t ffmpeg-service .

# Run Docker container
docker run -p 3000:3000 ffmpeg-service

# Test endpoints (examples)
./test-audio-image.sh
./test-url-endpoints.sh
./test-fade-timing.sh
./test-compilation.sh
```

## Development Notes

- No test framework is configured; use the shell scripts for endpoint testing
- No linting or type checking tools are configured in package.json
- Logging is handled via Winston with JSON format
- All uploaded/downloaded files are cleaned up after processing
- The service uses Ubuntu 20.04 base image with FFmpeg 4.4 compiled from source