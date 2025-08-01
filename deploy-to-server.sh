#!/bin/bash

# Safe deployment script for FFmpeg service updates
# Run this on your local machine to deploy to the server

SERVER_IP="37.27.38.205"
SERVER_USER="root"  # Consider using a non-root user with sudo
SERVICE_PATH="/path/to/ffmpeg-service"  # Update this with actual path on server

echo "=== FFmpeg Service Deployment Script ==="
echo "This script will help you deploy the updated service to your server"
echo ""

# Ensure we have the necessary files
if [ ! -f "app.js" ] || [ ! -f "app/endpoints.js" ]; then
    echo "Error: Required files not found. Please run this from the project directory."
    exit 1
fi

echo "WARNING: Please ensure you have:"
echo "1. Backed up the current service on the server"
echo "2. Tested the new features locally"
echo "3. Set up SSH key authentication (recommended over password)"
echo ""
read -p "Continue with deployment? (y/n): " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Deployment cancelled."
    exit 1
fi

# Create a deployment package
echo "Creating deployment package..."
DEPLOY_DIR="deploy_$(date +%Y%m%d_%H%M%S)"
mkdir -p $DEPLOY_DIR

# Copy only the updated files
cp app.js $DEPLOY_DIR/
cp -r app/ $DEPLOY_DIR/
cp README.md $DEPLOY_DIR/
cp CLAUDE.md $DEPLOY_DIR/
cp test-compilation.sh $DEPLOY_DIR/

# Create deployment instructions
cat > $DEPLOY_DIR/deploy-instructions.txt << 'EOF'
Deployment Instructions:

1. SSH into the server:
   ssh root@37.27.38.205

2. Navigate to the FFmpeg service directory:
   cd /path/to/ffmpeg-service

3. Create a backup:
   cp -r . ../ffmpeg-service-backup-$(date +%Y%m%d_%H%M%S)

4. Stop the current service:
   # If using systemd:
   systemctl stop ffmpeg-service
   # If using Docker:
   docker stop ffmpeg-service
   # If running directly:
   pkill -f "node app.js"

5. Update the files:
   # Copy the new files from this deployment package

6. Restart the service:
   # If using systemd:
   systemctl start ffmpeg-service
   # If using Docker:
   docker start ffmpeg-service
   # If running directly:
   nohup node app.js > ffmpeg.log 2>&1 &

7. Test the new endpoints:
   curl http://localhost:3000/
   # Test compilation endpoint
   # Test compilation-simple endpoint

8. Monitor logs for any errors:
   tail -f ffmpeg.log
EOF

echo "Deployment package created in: $DEPLOY_DIR"
echo ""
echo "You can now:"
echo "1. Use SCP to copy files: scp -r $DEPLOY_DIR root@$SERVER_IP:/tmp/"
echo "2. Or use rsync: rsync -avz $DEPLOY_DIR/ root@$SERVER_IP:$SERVICE_PATH/"
echo ""
echo "IMPORTANT: Please change the root password immediately after deployment!"
echo "Run on server: passwd"