# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Recent Updates

### Added Cover Creation Endpoint (2025-08-24)
- **New Endpoint**: `/cover` and `/cover/url` creates image collages from 3 vertical images
- **Features**:
  - Takes 3 image URLs: left, middle, right
  - Creates horizontal collage by scaling all images to same height (1080px)
  - Uses FFmpeg's hstack filter for seamless side-by-side arrangement
  - Outputs high-quality JPEG (95% quality, yuvj420p pixel format)
  - Supports both file uploads and URL inputs
- **Usage**: `POST /cover/url` with JSON: `{"left": "url1", "middle": "url2", "right": "url3"}`

### Merged Compilation and Timestamps Endpoints (2025-08-21)
- **Merged**: `/compilation-simple/url` now returns both video and timestamps
- **Features**:
  - Accepts videos with optional titles: `{url: "...", title: "..."}`
  - Calculates accurate timestamps after fps conversion
  - Returns JSON response with video download URL and timestamp data
  - Video is temporarily stored and downloadable via `/download/:id` endpoint
- **Note**: The separate `/compilation-timestamps/url` endpoint is now deprecated

### Added Video Order Preservation (2025-08-20)
- **Problem**: Videos in compilation endpoints were being processed out of order due to asynchronous downloads
- **Solution**: Pre-allocate downloadedFiles array and store files at their original index positions to maintain order

### Fixed Timestamp Duration Calculation (2025-08-21)
- **Problem**: Timestamp durations were longer than actual compiled video (e.g., 1:33 vs 1:28)
- **Cause**: Raw durations didn't account for timestamp adjustments from audio sync filters
- **Solution**: Calculate adjusted duration by subtracting negative start_time values, matching the effect of `-avoid_negative_ts make_zero`

### Added Compilation Timestamps Endpoint (2025-08-20)
- **New Endpoint**: `/compilation-timestamps/url` calculates start timestamps for videos in a compilation
- **Features**: 
  - Accepts array of video URLs with optional titles
  - Returns JSON with timestamps, durations, and total runtime
  - Uses ffprobe to extract accurate video durations
  - Maintains video order from input array

### Fixed Audio Sync Issue in Video Compilation (2025-08-01)
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
   - Special endpoints: audio-image-mp4 (multi-file), audio-mix (complex filtering), audio-duration (ffprobe), compilation (video concatenation with blur effect), cover (image collage creation)

3. **Constants (`app/constants.js`)**:
   - fileSizeLimit: 524MB
   - port: 3000
   - timeout: 1 hour

### Processing Flow

1. **File Upload**: Files are uploaded via multipart/form-data, saved temporarily, processed with FFmpeg, then deleted
2. **URL Input**: Files are downloaded from URLs, processed identically to uploads
3. **Multi-file Operations**: Some endpoints (audio-image-mp4, audio-mix, compilation, cover) require multiple input files with specific field names
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
./test-cover.sh
```

## Development Notes

- No test framework is configured; use the shell scripts for endpoint testing
- No linting or type checking tools are configured in package.json
- Logging is handled via Winston with JSON format
- All uploaded/downloaded files are cleaned up after processing
- The service uses Ubuntu 20.04 base image with FFmpeg 4.4 compiled from source