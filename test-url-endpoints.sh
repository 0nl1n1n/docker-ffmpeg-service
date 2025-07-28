#!/bin/bash

# Test script for URL input endpoints
# This script tests the new URL input functionality

SERVER_URL="http://localhost:3000"

echo "Testing URL Input Endpoints"
echo "=========================="

# Test 1: Basic MP3 conversion from URL
echo -e "\n1. Testing MP3 conversion from URL..."
curl -X POST \
  -H "Content-Type: application/json" \
  -d '{"url": "https://www.soundjay.com/misc/sounds/bell-ringing-05.wav"}' \
  "$SERVER_URL/mp3/url" \
  -o test_mp3_from_url.mp3

if [ $? -eq 0 ]; then
    echo "✅ MP3 conversion from URL successful"
    ls -la test_mp3_from_url.mp3
else
    echo "❌ MP3 conversion from URL failed"
fi

# Test 2: Audio duration from URL
echo -e "\n2. Testing audio duration from URL..."
DURATION=$(curl -s -X POST \
  -H "Content-Type: application/json" \
  -d '{"url": "https://www.soundjay.com/misc/sounds/bell-ringing-05.wav"}' \
  "$SERVER_URL/audio-duration/url")

if [ $? -eq 0 ]; then
    echo "✅ Audio duration from URL successful: $DURATION seconds"
else
    echo "❌ Audio duration from URL failed"
fi

# Test 3: Audio-image mixing from URLs
echo -e "\n3. Testing audio-image mixing from URLs..."
curl -X POST \
  -H "Content-Type: application/json" \
  -d '{
    "audio": "https://www.soundjay.com/misc/sounds/bell-ringing-05.wav",
    "image": "https://httpbin.org/image/jpeg"
  }' \
  "$SERVER_URL/audio-image-mp4/url" \
  -o test_video_from_urls.mp4

if [ $? -eq 0 ]; then
    echo "✅ Audio-image mixing from URLs successful"
    ls -la test_video_from_urls.mp4
else
    echo "❌ Audio-image mixing from URLs failed"
fi

# Test 4: Audio mixing from URLs
echo -e "\n4. Testing audio mixing from URLs..."
curl -X POST \
  -H "Content-Type: application/json" \
  -d '{
    "background": "https://www.soundjay.com/misc/sounds/bell-ringing-05.wav",
    "vocals": "https://www.soundjay.com/misc/sounds/bell-ringing-05.wav"
  }' \
  "$SERVER_URL/audio-mix/url" \
  -o test_mixed_from_urls.mp3

if [ $? -eq 0 ]; then
    echo "✅ Audio mixing from URLs successful"
    ls -la test_mixed_from_urls.mp3
else
    echo "❌ Audio mixing from URLs failed"
fi

# Test 5: Error handling - invalid URL
echo -e "\n5. Testing error handling with invalid URL..."
ERROR_RESPONSE=$(curl -s -X POST \
  -H "Content-Type: application/json" \
  -d '{"url": "https://invalid-url-that-does-not-exist.com/file.mp3"}' \
  "$SERVER_URL/mp3/url")

if [[ $ERROR_RESPONSE == *"error"* ]]; then
    echo "✅ Error handling working correctly"
    echo "Error response: $ERROR_RESPONSE"
else
    echo "❌ Error handling failed"
fi

# Test 6: Error handling - missing URL parameter
echo -e "\n6. Testing error handling with missing URL..."
ERROR_RESPONSE=$(curl -s -X POST \
  -H "Content-Type: application/json" \
  -d '{}' \
  "$SERVER_URL/mp3/url")

if [[ $ERROR_RESPONSE == *"error"* ]]; then
    echo "✅ Missing URL parameter handling working correctly"
    echo "Error response: $ERROR_RESPONSE"
else
    echo "❌ Missing URL parameter handling failed"
fi

echo -e "\nURL Input Testing Complete!"
echo "=============================" 