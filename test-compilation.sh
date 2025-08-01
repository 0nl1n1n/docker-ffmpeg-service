#!/bin/bash

# Test script for compilation endpoint
# This script demonstrates how to use the compilation endpoint to combine multiple videos

echo "Testing compilation endpoint..."

# Check if the service is running
if ! curl -s http://127.0.0.1:3000/ > /dev/null; then
    echo "Error: Service is not running on http://127.0.0.1:3000/"
    echo "Please start the service first with: node app.js"
    exit 1
fi

# Create a test directory
mkdir -p test-files

# Create sample vertical videos if they don't exist (using ffmpeg to generate test videos)
if [ ! -f "test-files/vertical1.mp4" ]; then
    echo "Creating sample vertical video 1 (9:16)..."
    ffmpeg -f lavfi -i "color=c=red:s=1080x1920:d=5" -f lavfi -i "sine=frequency=440:duration=5" \
           -c:v libx264 -c:a aac test-files/vertical1.mp4 -y
fi

if [ ! -f "test-files/vertical2.mp4" ]; then
    echo "Creating sample vertical video 2 (9:16)..."
    ffmpeg -f lavfi -i "color=c=blue:s=1080x1920:d=5" -f lavfi -i "sine=frequency=880:duration=5" \
           -c:v libx264 -c:a aac test-files/vertical2.mp4 -y
fi

if [ ! -f "test-files/vertical3.mp4" ]; then
    echo "Creating sample vertical video 3 (9:16)..."
    ffmpeg -f lavfi -i "color=c=green:s=1080x1920:d=5" -f lavfi -i "sine=frequency=660:duration=5" \
           -c:v libx264 -c:a aac test-files/vertical3.mp4 -y
fi

echo "Testing file upload compilation..."
echo "Videos: vertical1.mp4, vertical2.mp4, vertical3.mp4"

# Test the compilation endpoint with file uploads
echo "Sending request to /compilation..."
curl -X POST \
     -F "video1=@test-files/vertical1.mp4" \
     -F "video2=@test-files/vertical2.mp4" \
     -F "video3=@test-files/vertical3.mp4" \
     http://127.0.0.1:3000/compilation \
     -o test-files/compilation-output.mp4

if [ $? -eq 0 ]; then
    echo "Success! Compilation saved as test-files/compilation-output.mp4"
    echo "Video details:"
    ffprobe -v quiet -print_format json -show_format -show_streams test-files/compilation-output.mp4 | jq '.format.duration, .streams[0].width, .streams[0].height'
else
    echo "Error: Failed to create compilation"
fi

echo ""
echo "Testing URL-based compilation..."

# For URL testing, we need actual video URLs. Here's an example structure:
echo "Example URL request:"
cat << 'EOF'
curl -X POST \
     -H "Content-Type: application/json" \
     -d '{
       "videos": [
         "https://example.com/video1.mp4",
         "https://example.com/video2.mp4",
         "https://example.com/video3.mp4"
       ]
     }' \
     http://127.0.0.1:3000/compilation/url
EOF

echo ""
echo "Testing simple compilation (no blur, maintain first video dimensions)..."
echo "Sending request to /compilation-simple..."
curl -X POST \
     -F "video1=@test-files/vertical1.mp4" \
     -F "video2=@test-files/vertical2.mp4" \
     -F "video3=@test-files/vertical3.mp4" \
     http://127.0.0.1:3000/compilation-simple \
     -o test-files/compilation-simple-output.mp4

if [ $? -eq 0 ]; then
    echo "Success! Simple compilation saved as test-files/compilation-simple-output.mp4"
    echo "Video details:"
    ffprobe -v quiet -print_format json -show_format -show_streams test-files/compilation-simple-output.mp4 | jq '.format.duration, .streams[0].width, .streams[0].height'
else
    echo "Error: Failed to create simple compilation"
fi

echo ""
echo "Testing URL-based simple compilation..."
echo "Example URL request for compilation-simple:"
cat << 'EOF'
curl -X POST \
     -H "Content-Type: application/json" \
     -d '{
       "videos": [
         "https://example.com/video1.mp4",
         "https://example.com/video2.mp4",
         "https://example.com/video3.mp4"
       ]
     }' \
     http://127.0.0.1:3000/compilation-simple/url
EOF

echo ""
echo "Test completed!"
echo ""
echo "Note: The compilation endpoint will:"
echo "- Combine all videos sequentially"
echo "- Add blur effect to fill 16:9 aspect ratio for vertical videos"
echo "- Center the original video content"
echo "- Maintain audio from all videos"
echo ""
echo "Note: The compilation-simple endpoint will:"
echo "- Combine all videos sequentially"
echo "- Maintain the dimensions of the FIRST video"
echo "- Scale other videos to fit (with black padding if needed)"
echo "- Maintain audio from all videos"