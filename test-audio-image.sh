#!/bin/bash

# Test script for audio-image-mp4 endpoint
# This script demonstrates how to use the new endpoint to mix audio and image files

echo "Testing audio-image-mp4 endpoint..."

# Check if the service is running
if ! curl -s http://127.0.0.1:3000/ > /dev/null; then
    echo "Error: Service is not running on http://127.0.0.1:3000/"
    echo "Please start the service first with: node app.js"
    exit 1
fi

# Create a test directory
mkdir -p test-files

# Download a sample image if it doesn't exist
if [ ! -f "test-files/sample.jpg" ]; then
    echo "Downloading sample image..."
    curl -o test-files/sample.jpg "https://picsum.photos/800/600"
fi

# Create a test audio file if it doesn't exist (using ffmpeg to generate a simple tone)
if [ ! -f "test-files/sample.mp3" ]; then
    echo "Creating sample audio file..."
    ffmpeg -f lavfi -i "sine=frequency=440:duration=5" -acodec libmp3lame test-files/sample.mp3 -y
fi

echo "Testing with sample files..."
echo "Audio: test-files/sample.mp3"
echo "Image: test-files/sample.jpg"

# Test the audio-image-mp4 endpoint
echo "Sending request to /audio-image-mp4..."
curl -F "audio=@test-files/sample.mp3" -F "image=@test-files/sample.jpg" \
     http://127.0.0.1:3000/audio-image-mp4 \
     -o test-files/output.mp4

if [ $? -eq 0 ]; then
    echo "Success! Output video saved as test-files/output.mp4"
    echo "Video details:"
    ffprobe -v quiet -print_format json -show_format -show_streams test-files/output.mp4 | jq '.format.duration, .streams[0].codec_name, .streams[1].codec_name'
else
    echo "Error: Failed to create video"
fi

echo "Test completed!" 