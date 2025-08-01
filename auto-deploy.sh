#!/bin/bash

# Automated deployment script for FFmpeg service
# This script will handle the entire deployment process

set -e  # Exit on any error

# Configuration
SERVER_IP="37.27.38.205"
SERVER_USER="root"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

echo "=== FFmpeg Service Automated Deployment ==="
echo "Starting deployment process at $(date)"
echo ""

# Check if we're in the right directory
if [ ! -f "app.js" ] || [ ! -f "app/endpoints.js" ]; then
    echo "Error: Not in the FFmpeg service directory"
    exit 1
fi

echo "⚠️  WARNING: This will deploy to production server!"
echo "Make sure you have tested everything locally first."
read -p "Continue? (y/n): " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Deployment cancelled."
    exit 1
fi

# Create deployment package
echo "📦 Creating deployment package..."
DEPLOY_DIR="deploy_${TIMESTAMP}"
mkdir -p $DEPLOY_DIR
cp -r app.js app/ README.md CLAUDE.md test-*.sh $DEPLOY_DIR/
echo "Package created: $DEPLOY_DIR"

# Create remote deployment script
cat > $DEPLOY_DIR/remote-deploy.sh << 'REMOTE_SCRIPT'
#!/bin/bash
set -e

echo "🔧 Starting remote deployment..."

# Try to find the service directory
if [ -d "/opt/ffmpeg-service" ]; then
    SERVICE_DIR="/opt/ffmpeg-service"
elif [ -d "/var/www/ffmpeg-service" ]; then
    SERVICE_DIR="/var/www/ffmpeg-service"
elif [ -d "/home/ffmpeg-service" ]; then
    SERVICE_DIR="/home/ffmpeg-service"
elif [ -d "/root/ffmpeg-service" ]; then
    SERVICE_DIR="/root/ffmpeg-service"
else
    echo "❌ Could not find service directory. Checking running processes..."
    # Try to find from running process
    SERVICE_PID=$(pgrep -f "node.*app.js" | head -1)
    if [ ! -z "$SERVICE_PID" ]; then
        SERVICE_DIR=$(pwdx $SERVICE_PID 2>/dev/null | cut -d' ' -f2)
        if [ -z "$SERVICE_DIR" ]; then
            SERVICE_DIR=$(lsof -p $SERVICE_PID 2>/dev/null | grep app.js | awk '{print $NF}' | xargs dirname | head -1)
        fi
    fi
    
    if [ -z "$SERVICE_DIR" ] || [ ! -d "$SERVICE_DIR" ]; then
        echo "Please enter the FFmpeg service directory path:"
        read SERVICE_DIR
    fi
fi

echo "📁 Service directory: $SERVICE_DIR"

# Create backup
BACKUP_DIR="/tmp/ffmpeg-backup-$(date +%Y%m%d_%H%M%S)"
echo "💾 Creating backup at $BACKUP_DIR..."
cp -r "$SERVICE_DIR" "$BACKUP_DIR"

# Check how service is running
echo "🔍 Detecting service type..."
if docker ps | grep -q ffmpeg; then
    SERVICE_TYPE="docker"
    CONTAINER_NAME=$(docker ps | grep ffmpeg | awk '{print $NF}')
    echo "Found Docker container: $CONTAINER_NAME"
elif systemctl list-units | grep -q ffmpeg; then
    SERVICE_TYPE="systemd"
    SERVICE_NAME=$(systemctl list-units | grep ffmpeg | awk '{print $1}')
    echo "Found systemd service: $SERVICE_NAME"
elif pgrep -f "node.*app.js" > /dev/null; then
    SERVICE_TYPE="node"
    echo "Found Node.js process"
else
    SERVICE_TYPE="unknown"
    echo "⚠️  Could not detect service type"
fi

# Stop service
echo "🛑 Stopping service..."
case $SERVICE_TYPE in
    docker)
        docker stop $CONTAINER_NAME || true
        ;;
    systemd)
        systemctl stop $SERVICE_NAME || true
        ;;
    node)
        pkill -f "node.*app.js" || true
        ;;
    *)
        echo "Attempting generic stop..."
        pkill -f "node.*app.js" || true
        docker stop $(docker ps | grep ffmpeg | awk '{print $1}') 2>/dev/null || true
        ;;
esac

sleep 2

# Update files
echo "📝 Updating files..."
cp -f /tmp/deploy_files/app.js "$SERVICE_DIR/"
cp -rf /tmp/deploy_files/app/* "$SERVICE_DIR/app/"
cp -f /tmp/deploy_files/README.md "$SERVICE_DIR/"
cp -f /tmp/deploy_files/CLAUDE.md "$SERVICE_DIR/"
cp -f /tmp/deploy_files/test-*.sh "$SERVICE_DIR/"
chmod +x "$SERVICE_DIR"/test-*.sh

# Ensure uploads directory exists
mkdir -p "$SERVICE_DIR/uploads"

# Start service
echo "🚀 Starting service..."
cd "$SERVICE_DIR"

case $SERVICE_TYPE in
    docker)
        docker start $CONTAINER_NAME
        ;;
    systemd)
        systemctl start $SERVICE_NAME
        ;;
    node)
        nohup node app.js > ffmpeg.log 2>&1 &
        echo "Started with PID: $!"
        ;;
    *)
        echo "Starting with node..."
        nohup node app.js > ffmpeg.log 2>&1 &
        echo "Started with PID: $!"
        ;;
esac

sleep 3

# Verify service is running
echo "✅ Verifying service..."
if curl -s http://localhost:3000/ > /dev/null; then
    echo "✅ Service is running!"
    
    # Test new endpoints
    echo "🧪 Testing new compilation endpoints..."
    
    # Test compilation endpoint exists
    if curl -s -X POST http://localhost:3000/compilation 2>&1 | grep -q "error"; then
        echo "✅ Compilation endpoint responding"
    fi
    
    if curl -s -X POST http://localhost:3000/compilation-simple 2>&1 | grep -q "error"; then
        echo "✅ Compilation-simple endpoint responding"
    fi
    
    echo ""
    echo "🎉 Deployment successful!"
    echo "Backup saved at: $BACKUP_DIR"
    
    # Create restore script
    cat > "$BACKUP_DIR/restore.sh" << 'RESTORE'
#!/bin/bash
echo "Restoring from backup..."
SERVICE_DIR="$SERVICE_DIR"
cp -r "$BACKUP_DIR"/* "$SERVICE_DIR"/
echo "Restore complete. Please restart the service manually."
RESTORE
    chmod +x "$BACKUP_DIR/restore.sh"
    
else
    echo "❌ Service failed to start!"
    echo "Restoring from backup..."
    cp -r "$BACKUP_DIR"/* "$SERVICE_DIR"/
    echo "Please check logs and start service manually"
    exit 1
fi

# Cleanup
rm -rf /tmp/deploy_files

echo ""
echo "📋 Deployment Summary:"
echo "- Service directory: $SERVICE_DIR"
echo "- Service type: $SERVICE_TYPE"
echo "- Backup location: $BACKUP_DIR"
echo "- New features: compilation and compilation-simple endpoints"
echo ""
echo "⚠️  IMPORTANT: Change the root password now with: passwd"
REMOTE_SCRIPT

chmod +x $DEPLOY_DIR/remote-deploy.sh

# Copy files to server
echo "📤 Copying files to server..."
scp -r $DEPLOY_DIR root@$SERVER_IP:/tmp/deploy_files

# Execute remote deployment
echo "🚀 Executing remote deployment..."
ssh root@$SERVER_IP 'bash /tmp/deploy_files/remote-deploy.sh'

echo ""
echo "✅ Deployment complete!"
echo ""
echo "🔒 SECURITY REMINDER:"
echo "1. SSH into the server: ssh root@$SERVER_IP"
echo "2. Change root password immediately: passwd"
echo "3. Set up SSH keys for future access"
echo "4. Test the new endpoints:"
echo "   - http://$SERVER_IP:3000/compilation"
echo "   - http://$SERVER_IP:3000/compilation-simple"

# Cleanup local deployment directory
rm -rf $DEPLOY_DIR