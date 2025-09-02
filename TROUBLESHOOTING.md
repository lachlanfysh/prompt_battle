# 🛠️ Troubleshooting Guide

## Quick Fixes

### 1. Can't Access from Phone/Other Devices
```bash
# Check your Mac's IP address
ipconfig getifaddr en0

# Make sure firewall allows port 3001
sudo pfctl -f /etc/pf.conf
```

### 2. OpenAI API Not Working
```bash
# Test API connection
curl -H "Authorization: Bearer $OPENAI_API_KEY" \
  https://api.openai.com/v1/models

# Check API health via app
curl http://localhost:3001/api/health

# Verify environment variables
cat .env | grep OPENAI_API_KEY
```

### 3. Server Won't Start
```bash
# Check if port is busy
lsof -i :3001

# Kill conflicting processes
pkill node
pkill python

# Restart everything
./start.sh
```

## Common Issues

### "Permission Denied" Errors
```bash
chmod +x start.sh
```

### Homebrew Not Found (Apple Silicon)
```bash
eval "$(/opt/homebrew/bin/brew shellenv)"
```

### Python Version Issues
```bash
# Check Python version
python3 --version

# Should be 3.10+, if not:
brew install python@3.10
```

### Out of Memory Errors
For Node.js memory issues:
```bash
export NODE_OPTIONS="--max-old-space-size=4096"
npm start
```

## Health Checks

### Check All Services
Visit: `http://localhost:3001/api/health`

### Manual Service Checks
```bash
# Game Server
curl http://localhost:3001/api/health

# OpenAI API
curl -H "Authorization: Bearer $OPENAI_API_KEY" \
  https://api.openai.com/v1/models

# Web Interface
curl -I http://localhost:3001
```

## Network Troubleshooting

### Find Your IP
```bash
# Primary interface
ipconfig getifaddr en0

# All interfaces
ifconfig | grep "inet "
```

### Test Hotspot Connection
1. Turn on phone hotspot
2. Connect Mac to hotspot
3. Check new IP: `ipconfig getifaddr en0`
4. Test from phone browser: `http://[new-ip]:3001`

### Firewall Issues
```bash
# Disable macOS firewall temporarily
sudo pfctl -d

# Or add rule for port 3001
# System Preferences > Security & Privacy > Firewall > Options
```

## Performance Issues

### Slow Image Generation
1. Use standard quality instead of HD in `server.js`:
   ```javascript
   quality: "standard",  // Instead of "hd"
   ```

2. Use DALL-E 2 for faster generation:
   ```javascript
   model: "dall-e-2",     // Instead of "dall-e-3"
   size: "512x512",       // Smaller, faster
   ```

3. Monitor API rate limits:
   - DALL-E 3: 5 images/minute
   - DALL-E 2: 50 images/minute

### Browser Connection Issues
- Clear browser cache
- Try incognito/private mode
- Check browser console for errors
- Try different browser

## Getting Help

### Log Locations
- Game Server: Terminal output
- OpenAI API: Check API usage at https://platform.openai.com/usage
- Browser: Developer Tools > Console

### Useful Commands
```bash
# See what's running on ports
netstat -an | grep LISTEN

# Monitor system resources
top

# Check disk space
df -h
```

### Reset Everything
```bash
# Kill all processes
pkill node

# Remove node modules (nuclear option)
rm -rf node_modules
rm -rf client/node_modules

# Start fresh
./start.sh
```

## Need More Help?

1. Check the logs first
2. Try the health endpoint: `/api/health`
3. Test each service individually
4. Google the specific error message
5. Check GitHub issues for similar problems

Most issues are network/firewall related when using hotspot connectivity!