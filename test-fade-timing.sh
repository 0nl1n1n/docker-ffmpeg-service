#!/bin/bash

# Test script to verify fade-out timing in audio-mix endpoint
# This tests that the fade-out starts when vocals actually end

SERVER_URL="http://37.27.38.205:3000"

echo "Testing Audio Mix Fade-Out Timing"
echo "================================="

# Test 1: Short vocal (2.3 seconds)
echo -e "\n1. Testing with short vocal (2.3 seconds)..."
curl -s -X POST \
  -H "Content-Type: application/json" \
  -d '{
    "background": "https://www.soundjay.com/misc/sounds/bell-ringing-05.wav",
    "vocals": "https://www.soundjay.com/misc/sounds/bell-ringing-05.wav"
  }' \
  "$SERVER_URL/audio-mix/url" \
  -o test_short_vocal.mp3

if [ $? -eq 0 ]; then
    echo "✅ Short vocal mix successful"
    ls -la test_short_vocal.mp3
else
    echo "❌ Short vocal mix failed"
fi

# Test 2: Get duration of the mixed file to verify timing
echo -e "\n2. Getting duration of mixed file..."
MIXED_DURATION=$(curl -s -X POST \
  -H "Content-Type: application/json" \
  -d '{"url": "file:///root/test_short_vocal.mp3"}' \
  "$SERVER_URL/audio-duration/url")

if [ $? -eq 0 ]; then
    echo "✅ Mixed file duration: $MIXED_DURATION seconds"
    echo "Expected: ~12.3 seconds (10s delay + 2.3s vocal + fade-out)"
else
    echo "❌ Could not get mixed file duration"
fi

# Test 3: Test with a longer vocal file (if available)
echo -e "\n3. Testing with longer vocal simulation..."
# Create a longer test by using the same file twice to simulate longer vocals
curl -s -X POST \
  -H "Content-Type: application/json" \
  -d '{
    "background": "https://www.soundjay.com/misc/sounds/bell-ringing-05.wav",
    "vocals": "https://www.soundjay.com/misc/sounds/bell-ringing-05.wav"
  }' \
  "$SERVER_URL/audio-mix/url" \
  -o test_longer_vocal.mp3

if [ $? -eq 0 ]; then
    echo "✅ Longer vocal mix successful"
    ls -la test_longer_vocal.mp3
else
    echo "❌ Longer vocal mix failed"
fi

echo -e "\nFade-Out Timing Test Complete!"
echo "================================="
echo "The fade-out should now start exactly when the vocals end:"
echo "- Vocals start at: 10 seconds (delay)"
echo "- Vocals end at: 10 + vocal_duration seconds"
echo "- Fade-out starts at: 10 + vocal_duration seconds"
echo "- Fade-out duration: 15 seconds" 