#!/bin/bash

# Test the merged compilation-simple endpoint that returns both video and timestamps

echo "Testing /compilation-simple/url with titles..."

# Test with titled videos
response=$(curl -s -X POST \
  -H "Content-Type: application/json" \
  -d '{
    "videos": [
      {"url": "https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4", "title": "Big Buck Bunny Intro"},
      {"url": "https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4", "title": "Escape Scene"},
      {"url": "https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4", "title": "Fun Finale"}
    ]
  }' \
  http://localhost:3000/compilation-simple/url)

echo "Response:"
echo "$response" | jq '.'

# Extract video URL
video_url=$(echo "$response" | jq -r '.video_url')

if [ "$video_url" != "null" ]; then
    echo ""
    echo "Downloading compiled video..."
    curl -s "http://localhost:3000$video_url" -o test-compilation-with-timestamps.mp4
    
    if [ -f test-compilation-with-timestamps.mp4 ]; then
        echo "Video downloaded successfully!"
        echo "Video info:"
        ffprobe -v quiet -print_format json -show_format test-compilation-with-timestamps.mp4 | jq '.format.duration'
    fi
fi

echo ""
echo "Testing with simple URL strings (no titles)..."

response2=$(curl -s -X POST \
  -H "Content-Type: application/json" \
  -d '{
    "videos": [
      "https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
      "https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4"
    ]
  }' \
  http://localhost:3000/compilation-simple/url)

echo "Response:"
echo "$response2" | jq '.'