# Safe Deployment Guide for FFmpeg Service Updates

## ⚠️ Security Notice
**NEVER share root credentials in chat or store them in files!**
After this deployment, immediately:
1. Change the root password: `passwd`
2. Set up SSH key authentication
3. Disable password authentication
4. Create a non-root user with sudo privileges

## Pre-Deployment Checklist

- [ ] Test new features locally
- [ ] Review all code changes
- [ ] Ensure backup strategy is in place
- [ ] Have rollback plan ready

## Deployment Steps

### 1. Local Preparation

```bash
# Run the deployment script to create package
./deploy-to-server.sh
```

### 2. Server Backup

```bash
# Copy backup script to server
scp backup-server.sh root@37.27.38.205:/tmp/

# SSH into server
ssh root@37.27.38.205

# Run backup script
bash /tmp/backup-server.sh
```

### 3. Deploy Updates

#### Option A: Using rsync (Recommended)
```bash
# From local machine
rsync -avz --exclude 'node_modules' --exclude 'uploads' \
  app.js app/ README.md CLAUDE.md test-compilation.sh \
  root@37.27.38.205:/path/to/ffmpeg-service/
```

#### Option B: Manual copy
```bash
# Copy files to server
scp app.js root@37.27.38.205:/path/to/ffmpeg-service/
scp -r app/ root@37.27.38.205:/path/to/ffmpeg-service/
scp README.md CLAUDE.md test-*.sh root@37.27.38.205:/path/to/ffmpeg-service/
```

### 4. Restart Service

```bash
# On the server

# If using Docker
docker restart ffmpeg-service

# If using systemd
systemctl restart ffmpeg-service

# If running directly
pkill -f "node app.js"
nohup node app.js > ffmpeg.log 2>&1 &
```

### 5. Verify Deployment

```bash
# Check service is running
curl http://localhost:3000/

# Test new compilation endpoint
curl -X POST -H "Content-Type: application/json" \
  -d '{"videos": ["url1", "url2"]}' \
  http://localhost:3000/compilation/url

# Check logs
tail -f ffmpeg.log
```

## New Features Deployed

1. **Compilation Endpoint** (`/compilation`)
   - Creates videos with blur effect for vertical content
   - Outputs 16:9 aspect ratio

2. **Compilation Simple Endpoint** (`/compilation-simple`)
   - Maintains first video's dimensions
   - No blur effects, just concatenation

Both endpoints support:
- File uploads (multipart/form-data)
- URL inputs (JSON)
- Multiple video processing

## Rollback Procedure

If issues occur:

```bash
# Stop the service
pkill -f "node app.js"  # or appropriate stop command

# Run the restore script from backup
/path/to/backups/ffmpeg-service-backup-[timestamp]/restore.sh

# Restart service
node app.js
```

## Post-Deployment

1. **Security Hardening**
   ```bash
   # Change root password immediately
   passwd
   
   # Create new user
   adduser ffmpeg-admin
   usermod -aG sudo ffmpeg-admin
   
   # Set up SSH keys
   ssh-copy-id -i ~/.ssh/id_rsa.pub ffmpeg-admin@37.27.38.205
   ```

2. **Monitor Performance**
   ```bash
   # Watch logs
   tail -f /var/log/ffmpeg-service.log
   
   # Check resource usage
   htop
   ```

3. **Set Up Monitoring**
   - Configure log rotation
   - Set up health checks
   - Enable alerts for failures

## Troubleshooting

### Service Won't Start
- Check port 3000 is not in use: `lsof -i :3000`
- Verify Node.js version: `node --version`
- Check FFmpeg installation: `ffmpeg -version`

### Out of Memory
- Check available memory: `free -h`
- Limit concurrent processing in constants.js
- Implement queue system for large files

### Permission Issues
- Ensure uploads directory is writable
- Check file ownership: `ls -la`

## Important Paths

Update these based on your actual server setup:
- Service location: `/path/to/ffmpeg-service`
- Uploads directory: `/path/to/ffmpeg-service/uploads`
- Logs location: `/var/log/ffmpeg-service.log`
- Backup location: `/path/to/backups`