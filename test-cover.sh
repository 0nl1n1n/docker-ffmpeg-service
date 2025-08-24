#!/bin/bash

# Test cover creation endpoint with URLs

echo "Testing cover creation endpoint..."

# Using sample image URLs (you can replace with your own)
curl -X POST http://localhost:3000/cover/url \
  -H "Content-Type: application/json" \
  -d '{
    "left": "https://via.placeholder.com/500x800/FF0000/FFFFFF?text=Left",
    "middle": "https://via.placeholder.com/500x800/00FF00/FFFFFF?text=Middle",
    "right": "https://via.placeholder.com/500x800/0000FF/FFFFFF?text=Right"
  }' \
  --output cover_test.jpg

echo "Cover saved as cover_test.jpg"

# Test with file upload
echo ""
echo "For file upload test, prepare 3 image files and run:"
echo "curl -X POST http://localhost:3000/cover \\"
echo "  -F 'left=@image1.jpg' \\"
echo "  -F 'middle=@image2.jpg' \\"
echo "  -F 'right=@image3.jpg' \\"
echo "  --output cover_upload.jpg"