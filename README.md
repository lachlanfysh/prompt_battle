# 🎨 Prompt Battle - Local Multiplayer Image Generation Game

A real-time multiplayer prompt battle application where players compete to write the best image generation prompts. Designed for local hosting with hotspot connectivity and OpenAI DALL-E integration.

## 🚀 Quick Start

1. **Run the setup script:**
   ```bash
   ./start.sh
   ```

2. **Set up OpenAI API Key**:
   - Get your API key from https://platform.openai.com/api-keys
   - Add it to your `.env` file: `OPENAI_API_KEY=your_api_key_here`

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
OPENAI_API_KEY=your_openai_api_key_here
NODE_ENV=production

# Optional: DALL-E model settings
DALLE_MODEL=dall-e-3
DALLE_SIZE=1024x1024
DALLE_QUALITY=standard
```

## 🖼️ Image Generation

The app uses OpenAI's DALL-E 3 for high-quality image generation:

### OpenAI DALL-E 3 (Primary)
- **High Quality**: Professional-grade image generation
- **Fast Generation**: Typically 10-20 seconds per image
- **Creative Flexibility**: Excellent prompt interpretation
- **API Integration**: Reliable cloud-based service

### Fallback Options
- If OpenAI API is unavailable, shows placeholder images with prompt text
- Easy to extend with other APIs (Midjourney, Stable Diffusion, etc.)

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
├── .env                  # Environment variables (API keys)
└── README.md
```

## 🎯 Game Features

- **Real-time prompt display**: See players typing live
- **Synchronized image reveal**: Dramatic simultaneous display
- **Flexible timing**: 30s to 3-minute rounds
- **Multiple target types**: Text prompts, image recreation, creative challenges
- **Audience participation**: Large display for crowd viewing
- **Admin controls**: Start, stop, reset, winner selection

## 🔌 Socket Events

The server communicates game progress to clients through Socket.IO events. Key contracts are outlined below:

### `game-state`

Broadcast whenever core game data changes. In addition to existing fields, the payload now includes:

- `competitionMode`: `'series'` (default) or `'knockout'` for bracket play.
- `bracket`: The current ladder structure `{ rounds: [ { name, matches: [{ id, players, winner, status }] } ] }` or `null` when not in use. Match `status` values are `pending`, `in-progress`, or `completed`.
- `currentMatch`: `{ roundIndex, matchIndex }` for the active ladder pairing, or `null` when awaiting seeding.
- `eliminatedPlayers`: Array of player IDs knocked out of a knockout bracket.

### Admin controls

- `start-competition` – unchanged, but accepts an optional `competitionMode` property (`'series'` or `'knockout'`).
- `create-bracket` – seeds a knockout ladder. Expects `{ rounds: [{ name?, matches: [{ id?, players: [playerA, playerB] }] }] }`.
- `advance-match` – manually steps a bracket forward. Pass `{ winnerId }` to record a victor or call with no payload to jump to the next playable match.
- `reset-bracket` – clears the bracket and returns the server to standard series play.

### Bracket notifications

- `bracket-updated` – emitted with `{ bracket, currentMatch, eliminatedPlayers }` whenever the ladder changes.
- `match-ready` – announces the next ready pairing with `{ roundIndex, matchIndex, match }` (includes players and status).
- `bracket-finished` – fired when a champion is crowned with `{ bracket, champion }`.

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
const response = await openai.images.generate({
  model: "dall-e-3",     // or "dall-e-2"
  prompt: prompt,
  n: 1,                  // Number of images
  size: "1024x1024",     // or "1792x1024", "1024x1792"
  quality: "standard",   // or "hd"
  style: "vivid"        // or "natural"
});
```

## 🐛 Troubleshooting

### Connection Issues
- Check firewall settings
- Verify IP address with `ipconfig getifaddr en0`
- Try restarting the router/hotspot

### OpenAI API Issues
- Verify your API key is correct in the `.env` file
- Check your OpenAI account has sufficient credits
- Ensure API key has appropriate permissions
- Monitor usage at https://platform.openai.com/usage

### Performance Issues
- Use "standard" quality instead of "hd" for faster generation
- Use smaller image dimensions (512x512 for DALL-E 2)
- Ensure stable internet connection for API calls
- Monitor OpenAI API rate limits

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