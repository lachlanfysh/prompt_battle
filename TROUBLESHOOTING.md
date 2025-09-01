# 🛠️ Troubleshooting Guide

## Quick Fixes

### 1. Can't Access from Phone/Other Devices
```bash
# Check your Mac's IP address
ipconfig getifaddr en0

# Make sure firewall allows port 3001
sudo pfctl -f /etc/pf.conf
```

### 2. Stable Diffusion Not Working
```bash
# Check if SD is running
curl http://localhost:7860/internal/ping

# View SD logs
tail -f ~/stable-diffusion-webui/sd_output.log

# Restart SD manually
cd ~/stable-diffusion-webui
./launch_api.sh
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
chmod +x install-stable-diffusion.sh
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
Edit `~/stable-diffusion-webui/launch_api.sh` and add:
```bash
python launch.py --api --listen --port 7860 --lowvram --precision full
```

## Health Checks

### Check All Services
Visit: `http://localhost:3001/api/health`

### Manual Service Checks
```bash
# Game Server
curl http://localhost:3001/api/health

# Stable Diffusion
curl http://localhost:7860/internal/ping

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
1. Reduce steps in `server.js` (line ~247):
   ```javascript
   steps: 10,  // Instead of 20
   ```

2. Use smaller images:
   ```javascript
   width: 512,   // Instead of 1024
   height: 512,  // Instead of 1024
   ```

3. Enable low VRAM mode:
   ```bash
   cd ~/stable-diffusion-webui
   ./launch_api.sh --lowvram
   ```

### Browser Connection Issues
- Clear browser cache
- Try incognito/private mode
- Check browser console for errors
- Try different browser

## Getting Help

### Log Locations
- Game Server: Terminal output
- Stable Diffusion: `~/stable-diffusion-webui/sd_output.log`
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
pkill python

# Remove installations (nuclear option)
rm -rf ~/stable-diffusion-webui
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