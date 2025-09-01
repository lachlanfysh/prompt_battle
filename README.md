# 🎨 Prompt Battle - Local Multiplayer Image Generation Game

A real-time multiplayer prompt battle application where players compete to write the best image generation prompts. Designed for local hosting with hotspot connectivity and local Stable Diffusion integration.

## 🚀 Quick Start

1. **Run the setup script:**
   ```bash
   ./start.sh
   ```

2. **Set up Stable Diffusion** (optional but recommended):
   - See `stable-diffusion-setup.md` for detailed instructions
   - Quick version: Install Automatic1111 WebUI and run with `--api --listen` flags

3. **Access the game:**
   - **Admin Panel**: `http://your-ip:3001/admin`
   - **Player 1**: `http://your-ip:3001/player/1`
   - **Player 2**: `http://your-ip:3001/player/2`
   - **Central Display**: `http://your-ip:3001/display`

## 📱 Hotspot Setup

### For iPhone Hotspot:
1. Go to Settings > Personal Hotspot
2. Turn on "Allow Others to Join"
3. Connect your Mac to the hotspot
4. Share the network IP with players
5. Players connect to the same hotspot and use the game URLs

### For Android Hotspot:
1. Go to Settings > Network & Internet > Hotspot & tethering
2. Turn on "Wi-Fi hotspot"
3. Connect your Mac to the hotspot
4. Share the network IP with players

## 🎮 How to Play

1. **Setup**: Admin opens the admin panel and sets a target prompt
2. **Players Join**: Each player visits their unique URL
3. **Battle**: Admin starts the battle with a countdown timer
4. **Writing**: Players write prompts to match the target
5. **Generation**: Images are generated simultaneously
6. **Judging**: Central display shows both images for audience voting
7. **Winner**: Admin selects the winner and starts a new round

## 🔧 Technical Setup

### Prerequisites
- Node.js 16+
- npm or yarn
- macOS (tested) or Linux

### Manual Installation
```bash
# Install server dependencies
npm install

# Install client dependencies
cd client && npm install

# Build client
npm run build
cd ..

# Start server
npm start
```

### Environment Variables
Create a `.env` file:
```env
PORT=3001
SD_API_URL=http://localhost:7860
NODE_ENV=production
```

## 🖼️ Image Generation

The app supports multiple image generation backends:

### Local Stable Diffusion (Recommended)
- **Automatic1111 WebUI**: Full control, best quality
- **Draw Things**: Mac App Store, easier setup
- **DiffusionBee**: Free Mac app

### Fallback Options
- If Stable Diffusion is unavailable, shows placeholder images
- Easy to extend with other APIs (OpenAI DALL-E, Midjourney, etc.)

## 🌐 Network Configuration

The server automatically:
- Detects your local IP address
- Binds to all interfaces (`0.0.0.0`)
- Shows connection URLs on startup
- Supports both local and network access

### Firewall Settings
Make sure port 3001 is open:
```bash
# macOS
sudo pfctl -f /etc/pf.conf

# Or allow in System Preferences > Security & Privacy > Firewall
```

## 📁 Project Structure

```
prompt_battle/
├── server.js              # Node.js/Express/Socket.IO server
├── package.json           # Server dependencies
├── client/                # React frontend
│   ├── src/
│   │   ├── App.js         # Main app component
│   │   ├── components/
│   │   │   ├── PlayerInterface.js    # Player screens
│   │   │   ├── CentralDisplay.js     # Audience display
│   │   │   └── AdminPanel.js         # Game control
│   │   └── ...
├── start.sh              # Quick setup script
├── stable-diffusion-setup.md  # SD installation guide
└── README.md
```

## 🎯 Game Features

- **Real-time prompt display**: See players typing live
- **Synchronized image reveal**: Dramatic simultaneous display
- **Flexible timing**: 30s to 3-minute rounds
- **Multiple target types**: Text prompts, image recreation, creative challenges
- **Audience participation**: Large display for crowd viewing
- **Admin controls**: Start, stop, reset, winner selection

## 🔧 Customization

### Adding New Target Types
Edit `AdminPanel.js` to add more preset targets:
```javascript
const presetTargets = [
  'Your custom prompt here',
  // ... more prompts
];
```

### Changing Image Generation Settings
Modify the `generateImage` function in `server.js`:
```javascript
const response = await axios.post(`${STABLE_DIFFUSION_URL}/sdapi/v1/txt2img`, {
  prompt: prompt,
  steps: 20,        // Adjust quality vs speed
  width: 1024,      // Image dimensions
  height: 1024,
  cfg_scale: 7,     // Prompt adherence
  // ... other settings
});
```

## 🐛 Troubleshooting

### Connection Issues
- Check firewall settings
- Verify IP address with `ipconfig getifaddr en0`
- Try restarting the router/hotspot

### Stable Diffusion Issues
- Ensure WebUI is running on port 7860
- Check the `--api --listen` flags are used
- Download a model file to `models/Stable-diffusion/`

### Performance Issues
- Reduce image generation steps (lower quality, faster)
- Use smaller image dimensions
- Ensure stable internet connection

## 📝 License

MIT License - feel free to modify and distribute!

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

---

Enjoy your prompt battles! 🎨⚔️