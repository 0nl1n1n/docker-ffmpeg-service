#!/bin/bash

# Quick deployment script - just run this!
# ./quick-deploy.sh

echo "🚀 Quick deploy to 37.27.38.205..."

# Deploy in one command
sshpass -p "riEAaiATgUimmJgeK4tL2" ssh -o StrictHostKeyChecking=no root@37.27.38.205 'cd /root/docker-ffmpeg-service && git pull || echo "No git repo"'

# Copy files
sshpass -p "riEAaiATgUimmJgeK4tL2" scp -o StrictHostKeyChecking=no app.js app/endpoints.js README.md CLAUDE.md root@37.27.38.205:/root/docker-ffmpeg-service/

# Restart service
sshpass -p "riEAaiATgUimmJgeK4tL2" ssh -o StrictHostKeyChecking=no root@37.27.38.205 'cd /root/docker-ffmpeg-service && (pm2 restart app || pkill -f "node app.js" && nohup node app.js > app.log 2>&1 &)'

echo "✅ Done! Test it:"
echo "curl -X POST -H 'Content-Type: application/json' -d '{\"videos\":[{\"url\":\"http://example.com/video.mp4\",\"title\":\"Test\"}]}' http://37.27.38.205:3000/compilation-timestamps/url"