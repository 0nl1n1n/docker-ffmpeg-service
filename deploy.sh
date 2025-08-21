#!/bin/bash

# Deployment script for updating FFmpeg service on server
# Usage: ./deploy.sh

SERVER_IP="37.27.38.205"
SERVER_USER="root"
PROJECT_PATH="/root/docker-ffmpeg-service"

echo "📦 Deploying FFmpeg service updates to $SERVER_IP..."

# Copy updated files to server
echo "📤 Copying files to server..."
scp app.js $SERVER_USER@$SERVER_IP:$PROJECT_PATH/
scp app/endpoints.js $SERVER_USER@$SERVER_IP:$PROJECT_PATH/app/
scp README.md $SERVER_USER@$SERVER_IP:$PROJECT_PATH/
scp CLAUDE.md $SERVER_USER@$SERVER_IP:$PROJECT_PATH/

# Connect to server and restart service
echo "🔄 Restarting service..."
ssh $SERVER_USER@$SERVER_IP << 'EOF'
cd /root/docker-ffmpeg-service
# If using PM2
if command -v pm2 &> /dev/null; then
    pm2 restart app
# If using Docker
elif [ -f /.dockerenv ]; then
    docker restart ffmpeg-service
# If running directly with Node
else
    pkill -f "node app.js"
    nohup node app.js > app.log 2>&1 &
fi
echo "✅ Service restarted"
EOF

echo "✅ Deployment complete!"