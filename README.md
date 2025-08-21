# Docker FFmpeg Service

A Node.js/Express web service that provides FFmpeg conversion capabilities through HTTP endpoints. The service can process both uploaded files and files from URLs.

## Features

- **File Upload Support**: Upload files directly to the service
- **URL Input Support**: Process files directly from URLs (new!)
- **Multiple Output Formats**: Convert to MP3, MP4, M4A, JPG
- **Audio-Image Mixing**: Combine audio files with images to create MP4 videos
- **Audio Duration Detection**: Get audio file duration using ffprobe
- **Complex Audio Mixing**: Mix background music with vocals using advanced audio filters
- **Docker Support**: Easy deployment with Docker

## Endpoints

### File Upload Endpoints

All endpoints support file uploads via multipart/form-data:

#### Basic Conversions
- `POST /mp3` - Convert to MP3
- `POST /mp4` - Convert to MP4  
- `POST /m4a` - Convert to M4A
- `POST /jpg` - Convert to JPG

#### Advanced Features
- `POST /audio-image-mp4` - Mix audio + image → MP4 video
- `POST /audio-duration` - Get audio file duration
- `POST /audio-mix` - Mix background music + vocals with effects
- `POST /compilation` - Combine multiple videos into one compilation with blur effect for vertical videos
- `POST /compilation-simple` - Combine multiple videos maintaining first video's dimensions

### URL Input Endpoints

All endpoints also support URL inputs via JSON POST requests:

#### Single File Endpoints
- `POST /mp3/url` - Convert URL to MP3
- `POST /mp4/url` - Convert URL to MP4
- `POST /m4a/url` - Convert URL to M4A
- `POST /jpg/url` - Convert URL to JPG
- `POST /audio-duration/url` - Get duration of audio from URL

#### Multi-File Endpoints
- `POST /audio-image-mp4/url` - Mix audio URL + image URL → MP4
- `POST /audio-mix/url` - Mix background URL + vocals URL with effects
- `POST /compilation/url` - Combine multiple video URLs into compilation with blur
- `POST /compilation-simple/url` - Combine multiple video URLs maintaining dimensions
- `POST /compilation-timestamps/url` - Calculate timestamps for videos in a compilation

## Usage Examples

### File Upload Examples

#### Basic Conversion
```bash
# Convert video to MP3
curl -X POST -F "file=@video.mp4" http://localhost:3000/mp3

# Convert video to MP4
curl -X POST -F "file=@video.avi" http://localhost:3000/mp4
```

#### Audio-Image Mixing
```bash
# Create MP4 from audio + image
curl -X POST \
  -F "audio=@music.mp3" \
  -F "image=@cover.jpg" \
  http://localhost:3000/audio-image-mp4
```

#### Audio Duration
```bash
# Get audio duration
curl -X POST -F "file=@song.mp3" http://localhost:3000/audio-duration
```

#### Audio Mixing
```bash
# Mix background music with vocals
curl -X POST \
  -F "background=@background.mp3" \
  -F "vocals=@vocals.mp3" \
  http://localhost:3000/audio-mix
```

#### Video Compilation
```bash
# Create compilation with blur effect (16:9 output)
curl -X POST \
  -F "video1=@video1.mp4" \
  -F "video2=@video2.mp4" \
  -F "video3=@video3.mp4" \
  http://localhost:3000/compilation

# Create simple compilation (maintains first video dimensions)
curl -X POST \
  -F "video1=@video1.mp4" \
  -F "video2=@video2.mp4" \
  -F "video3=@video3.mp4" \
  http://localhost:3000/compilation-simple
```

### URL Input Examples

#### Basic Conversion
```bash
# Convert video URL to MP3
curl -X POST \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com/video.mp4"}' \
  http://localhost:3000/mp3/url

# Convert video URL to MP4
curl -X POST \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com/video.avi"}' \
  http://localhost:3000/mp4/url
```

#### Audio-Image Mixing from URLs
```bash
# Create MP4 from audio URL + image URL
curl -X POST \
  -H "Content-Type: application/json" \
  -d '{
    "audio": "https://example.com/music.mp3",
    "image": "https://example.com/cover.jpg"
  }' \
  http://localhost:3000/audio-image-mp4/url
```

#### Audio Duration from URL
```bash
# Get audio duration from URL
curl -X POST \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com/song.mp3"}' \
  http://localhost:3000/audio-duration/url
```

#### Audio Mixing from URLs
```bash
# Mix background music with vocals from URLs
curl -X POST \
  -H "Content-Type: application/json" \
  -d '{
    "background": "https://example.com/background.mp3",
    "vocals": "https://example.com/vocals.mp3"
  }' \
  http://localhost:3000/audio-mix/url
```

#### Video Compilation from URLs
```bash
# Create compilation with blur effect
curl -X POST \
  -H "Content-Type: application/json" \
  -d '{
    "videos": [
      "https://example.com/video1.mp4",
      "https://example.com/video2.mp4",
      "https://example.com/video3.mp4"
    ]
  }' \
  http://localhost:3000/compilation/url

# Create simple compilation (maintains first video dimensions)
curl -X POST \
  -H "Content-Type: application/json" \
  -d '{
    "videos": [
      "https://example.com/video1.mp4",
      "https://example.com/video2.mp4",
      "https://example.com/video3.mp4"
    ]
  }' \
  http://localhost:3000/compilation-simple/url

# Get timestamps for video compilation
curl -X POST \
  -H "Content-Type: application/json" \
  -d '{
    "videos": [
      {"url": "https://example.com/video1.mp4", "title": "Introduction"},
      {"url": "https://example.com/video2.mp4", "title": "Main Content"},
      {"url": "https://example.com/video3.mp4", "title": "Conclusion"}
    ]
  }' \
  http://localhost:3000/compilation-timestamps/url
```

## Audio Mixing Features

The audio-mix endpoint provides advanced audio processing:

- **Background Music**: Reduced volume (10%) with fade-in effect
- **Vocals**: Delayed by 10 seconds to allow background to establish
- **Mixing**: Both tracks mixed together with dropout transition
- **Fade Out**: 15-second fade-out starting exactly when vocals end (10s delay + vocal duration)

## Video Compilation Features

### Compilation (with blur effect)
The compilation endpoint creates professional-looking video compilations:

- **Multiple Videos**: Combine 2 or more videos into a single compilation
- **Vertical Video Support**: Automatically handles vertical videos with blur effect
- **Aspect Ratio**: Outputs 16:9 format with vertical videos centered
- **Blur Background**: Creates aesthetic blur effect from the video content for borders
- **Sequential Playback**: Videos play one after another in the order provided
- **Audio Preservation**: Maintains audio from all source videos

### Compilation Simple (no blur)
The compilation-simple endpoint creates basic compilations:

- **Multiple Videos**: Combine 2 or more videos into a single compilation
- **First Video Dimensions**: Output maintains the exact dimensions of the first video
- **Scaling**: Other videos are scaled to fit with black padding if needed
- **No Blur Effect**: Clean, simple concatenation without effects
- **Sequential Playback**: Videos play one after another in the order provided
- **Audio Preservation**: Maintains audio from all source videos

### Compilation Timestamps
The compilation-timestamps endpoint calculates video timestamps:

- **Timestamp Calculation**: Returns the start time of each video in a compilation
- **Title Support**: Accepts optional titles for each video
- **Duration Info**: Includes individual video durations
- **Total Duration**: Provides the total compilation runtime
- **JSON Output**: Returns data in structured JSON format
- **Example Output**:
```json
{
  "timestamps": [
    {"title": "Introduction", "timestamp": "00:00", "duration": "01:30"},
    {"title": "Main Content", "timestamp": "01:30", "duration": "05:15"},
    {"title": "Conclusion", "timestamp": "06:45", "duration": "02:00"}
  ],
  "total_duration": "08:45"
}
```

## Deployment

### Docker Deployment

1. Build the Docker image:
```bash
docker build -t ffmpeg-service .
```

2. Run the container:
```bash
docker run -p 3000:3000 ffmpeg-service
```

3. The service will be available at `http://localhost:3000`

### Server Deployment

The service is currently deployed on a server and accessible at:
- **URL**: `http://your-server-ip:3000`
- **Status**: Live and ready for production use

## Technical Details

- **Base Image**: Ubuntu 20.04
- **FFmpeg**: Latest version with full codec support
- **Node.js**: Latest LTS version
- **Architecture**: ARM64 compatible
- **File Size Limit**: 100MB per file
- **Timeout**: 30 seconds for URL downloads

## Error Handling

The service provides detailed error messages for:
- Invalid file formats
- Missing required files
- Download failures from URLs
- FFmpeg processing errors
- File size limit exceeded

## Logging

All operations are logged with timestamps including:
- File uploads and downloads
- Processing steps
- Error conditions
- Download progress from URLs
