# Manual Deployment Steps

To update the code on your server (37.27.38.205), follow these steps:

## Option 1: Using the deployment script

```bash
./deploy.sh
```

## Option 2: Manual steps

1. **Connect to your server:**
```bash
ssh root@37.27.38.205
```

2. **Navigate to project directory:**
```bash
cd /root/docker-ffmpeg-service
# or wherever your project is located
```

3. **Backup current code (optional but recommended):**
```bash
cp app.js app.js.backup
cp app/endpoints.js app/endpoints.js.backup
```

4. **Update the files:**

Create/update the following files with the new code:

### Update app.js
The main changes in app.js:
- Added formatTime() and parseTimeToSeconds() helper functions (lines 20-46)
- Added timestamps processing logic (lines 68-149)
- Fixed video order preservation in URL downloads (line 1006: pre-allocated array)
- Added title preservation for downloaded files (line 1012)
- Added isTimestamps condition in URL endpoint handler (lines 891-936)

### Update app/endpoints.js
Add the new endpoint configuration:
```javascript
'compilation-timestamps': {
    extension: 'json',
    multiFile: true,
    isTimestamps: true,
    urlSupport: true,
},
```

5. **Restart the service:**

If using PM2:
```bash
pm2 restart app
pm2 logs app  # to check logs
```

If using Docker:
```bash
docker restart ffmpeg-service
docker logs ffmpeg-service  # to check logs
```

If running directly with Node:
```bash
# Find and kill the current process
ps aux | grep "node app.js"
kill <PID>

# Start the service again
nohup node app.js > app.log 2>&1 &
tail -f app.log  # to check logs
```

6. **Test the new endpoint:**
```bash
curl -X POST \
  -H "Content-Type: application/json" \
  -d '{
    "videos": [
      {"url": "https://example.com/video1.mp4", "title": "Test 1"},
      {"url": "https://example.com/video2.mp4", "title": "Test 2"}
    ]
  }' \
  http://37.27.38.205:3000/compilation-timestamps/url
```

## Important Changes Made:

1. **Fixed video order issue**: Videos now maintain their original array order during asynchronous downloads
2. **New endpoint**: `/compilation-timestamps/url` for calculating video timestamps
3. **Helper functions**: Added formatTime() and parseTimeToSeconds() for time formatting
4. **Documentation**: Updated README.md and CLAUDE.md with new features

## Troubleshooting:

If the service doesn't start:
1. Check the logs for errors
2. Ensure all dependencies are installed: `npm install`
3. Verify FFmpeg is installed: `ffmpeg -version`
4. Check port 3000 is not in use: `lsof -i :3000`