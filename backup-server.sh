#!/bin/bash

# Backup script to run on the server before deployment
# This creates a complete backup of the current FFmpeg service

echo "=== FFmpeg Service Backup Script ==="
echo "Run this on your server before deploying updates"
echo ""

# Configuration
SERVICE_DIR="/path/to/ffmpeg-service"  # Update this path
BACKUP_DIR="/path/to/backups"          # Update this path
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_NAME="ffmpeg-service-backup-$TIMESTAMP"

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

# Function to check if service is running
check_service() {
    if pgrep -f "node app.js" > /dev/null; then
        echo "Service is running (node process found)"
        return 0
    elif docker ps | grep -q ffmpeg-service; then
        echo "Service is running (Docker container found)"
        return 0
    elif systemctl is-active --quiet ffmpeg-service; then
        echo "Service is running (systemd service found)"
        return 0
    else
        echo "Service status: Not detected as running"
        return 1
    fi
}

echo "Checking service status..."
check_service

echo ""
echo "Creating backup at: $BACKUP_DIR/$BACKUP_NAME"

# Create the backup
if [ -d "$SERVICE_DIR" ]; then
    cp -r "$SERVICE_DIR" "$BACKUP_DIR/$BACKUP_NAME"
    
    # Also save current process information
    echo "=== Backup Information ===" > "$BACKUP_DIR/$BACKUP_NAME/backup-info.txt"
    echo "Backup created: $(date)" >> "$BACKUP_DIR/$BACKUP_NAME/backup-info.txt"
    echo "Original path: $SERVICE_DIR" >> "$BACKUP_DIR/$BACKUP_NAME/backup-info.txt"
    echo "" >> "$BACKUP_DIR/$BACKUP_NAME/backup-info.txt"
    
    # Save running processes
    echo "=== Running Processes ===" >> "$BACKUP_DIR/$BACKUP_NAME/backup-info.txt"
    ps aux | grep -E "(node|ffmpeg)" | grep -v grep >> "$BACKUP_DIR/$BACKUP_NAME/backup-info.txt"
    
    # Save Docker info if using Docker
    if command -v docker &> /dev/null; then
        echo "" >> "$BACKUP_DIR/$BACKUP_NAME/backup-info.txt"
        echo "=== Docker Containers ===" >> "$BACKUP_DIR/$BACKUP_NAME/backup-info.txt"
        docker ps -a | grep ffmpeg >> "$BACKUP_DIR/$BACKUP_NAME/backup-info.txt" || true
    fi
    
    # Create a restore script
    cat > "$BACKUP_DIR/$BACKUP_NAME/restore.sh" << EOF
#!/bin/bash
# Restore script for FFmpeg service backup

echo "This will restore the FFmpeg service from backup: $BACKUP_NAME"
read -p "Are you sure? (y/n): " -n 1 -r
echo ""

if [[ \$REPLY =~ ^[Yy]$ ]]; then
    # Stop current service
    echo "Stopping current service..."
    pkill -f "node app.js" || true
    docker stop ffmpeg-service 2>/dev/null || true
    systemctl stop ffmpeg-service 2>/dev/null || true
    
    # Restore files
    echo "Restoring files..."
    rm -rf "$SERVICE_DIR"
    cp -r "$BACKUP_DIR/$BACKUP_NAME" "$SERVICE_DIR"
    
    # Remove backup-specific files
    rm -f "$SERVICE_DIR/backup-info.txt"
    rm -f "$SERVICE_DIR/restore.sh"
    
    echo "Restore complete!"
    echo "Please restart the service manually."
else
    echo "Restore cancelled."
fi
EOF
    
    chmod +x "$BACKUP_DIR/$BACKUP_NAME/restore.sh"
    
    # Create compressed archive
    echo "Creating compressed archive..."
    cd "$BACKUP_DIR"
    tar -czf "$BACKUP_NAME.tar.gz" "$BACKUP_NAME"
    
    echo ""
    echo "Backup completed successfully!"
    echo "Location: $BACKUP_DIR/$BACKUP_NAME"
    echo "Archive: $BACKUP_DIR/$BACKUP_NAME.tar.gz"
    echo ""
    echo "To restore from this backup, run:"
    echo "  $BACKUP_DIR/$BACKUP_NAME/restore.sh"
    
else
    echo "Error: Service directory not found at $SERVICE_DIR"
    echo "Please update the SERVICE_DIR variable in this script."
    exit 1
fi