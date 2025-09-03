const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const path = require('path');
const os = require('os');
const fs = require('fs');
const OpenAI = require('openai');
const https = require('https');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'client/build')));
// Serve challenge images
app.use('/api/images', express.static(path.join(__dirname, 'images')));

// Get available challenge images
app.get('/api/challenge-images', (req, res) => {
  const imagesDir = path.join(__dirname, 'images');
  const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
  
  try {
    if (!fs.existsSync(imagesDir)) {
      return res.json({ images: [] });
    }
    
    const files = fs.readdirSync(imagesDir)
      .filter(file => {
        const ext = path.extname(file).toLowerCase();
        return imageExtensions.includes(ext);
      })
      .map(filename => ({
        filename,
        url: `/api/images/${filename}`,
        displayName: filename.replace(/\.[^/.]+$/, "").replace(/[-_]/g, ' ')
      }));
    
    res.json({ images: files });
  } catch (error) {
    console.error('Error reading images directory:', error);
    res.json({ images: [] });
  }
});

// Health check endpoint
app.get('/api/health', async (req, res) => {
  const openaiHealth = await checkOpenAIHealth();
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    services: {
      'prompt-battle-server': 'healthy',
      'openai-dalle': openaiHealth ? 'healthy' : 'unavailable'
    },
    gameState: {
      phase: gameState.phase,
      connectedPlayers: Object.keys(gameState.players).length,
      hasTarget: !!gameState.target
    }
  });
});

// Get local IP address for hotspot connectivity
function getLocalIP() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const interface of interfaces[name]) {
      if (interface.family === 'IPv4' && !interface.internal) {
        return interface.address;
      }
    }
  }
  return 'localhost';
}

const PORT = process.env.PORT || 3001;
const LOCAL_IP = getLocalIP();

// Ensure output directory exists
const OUTPUT_DIR = path.join(__dirname, 'generated_images');
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  console.log('Created output directory:', OUTPUT_DIR);
}

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Game state management
let gameState = {
  phase: 'waiting', // waiting, ready, battling, judging, finished
  players: {},
  prompts: {},
  generatedImages: {},
  target: null,
  timer: 0,
  winner: null
};

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log(`Client connected: ${socket.id}`);

  // Player joins
  socket.on('join-player', (playerId) => {
    console.log(`Player ${playerId} joined`);
    gameState.players[playerId] = {
      id: playerId,
      socketId: socket.id,
      connected: true,
      ready: false
    };
    socket.join(`player-${playerId}`);
    socket.emit('game-state', gameState);
    socket.broadcast.emit('game-state', gameState);
  });

  // Central display connects
  socket.on('join-display', () => {
    console.log('Central display connected');
    socket.join('display');
    socket.emit('game-state', gameState);
  });

  // Admin panel connects
  socket.on('join-admin', () => {
    console.log('Admin panel connected');
    socket.join('admin');
    socket.emit('game-state', gameState);
  });

  // Real-time prompt updates
  socket.on('prompt-update', (data) => {
    const { playerId, prompt } = data;
    gameState.prompts[playerId] = prompt;
    
    // Send live prompt updates to display
    io.to('display').emit('prompt-update', { playerId, prompt });
    io.to('admin').emit('prompt-update', { playerId, prompt });
  });

  // Player ready status
  socket.on('player-ready', (playerId) => {
    if (gameState.players[playerId]) {
      gameState.players[playerId].ready = true;
      io.emit('game-state', gameState);
    }
  });

  // Admin controls
  socket.on('set-target', (target) => {
    // Handle both old string format and new object format
    if (typeof target === 'string') {
      gameState.target = { type: 'text', content: target };
    } else {
      gameState.target = target;
    }
    gameState.phase = 'ready';
    io.emit('game-state', gameState);
  });

  socket.on('start-battle', (duration) => {
    gameState.phase = 'battling';
    gameState.timer = duration;
    gameState.prompts = {};
    gameState.generatedImages = {};
    gameState.winner = null; // Clear previous winner
    
    io.emit('battle-started', { duration });
    io.emit('game-state', gameState);

    // Timer countdown
    const interval = setInterval(() => {
      gameState.timer -= 1;
      io.emit('timer-update', gameState.timer);
      
      if (gameState.timer <= 0) {
        clearInterval(interval);
        endBattle();
      }
    }, 1000);
  });

  socket.on('select-winner', (winnerId) => {
    gameState.winner = winnerId;
    gameState.phase = 'finished';
    io.emit('game-state', gameState);
    io.emit('winner-selected', winnerId);
  });

  socket.on('reset-game', () => {
    // Keep connected players but reset their ready status
    Object.keys(gameState.players).forEach(playerId => {
      if (gameState.players[playerId]) {
        gameState.players[playerId].ready = false;
      }
    });
    
    gameState = {
      ...gameState,
      phase: 'waiting',
      prompts: {},
      generatedImages: {},
      target: null,
      timer: 0,
      winner: null
    };
    
    io.emit('game-state', gameState);
    io.emit('game-reset'); // New event to signal complete reset
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    console.log(`Client disconnected: ${socket.id}`);
    
    // Find and remove player
    for (const playerId in gameState.players) {
      if (gameState.players[playerId].socketId === socket.id) {
        delete gameState.players[playerId];
        delete gameState.prompts[playerId];
        delete gameState.generatedImages[playerId];
        break;
      }
    }
    
    io.emit('game-state', gameState);
  });
});

async function endBattle() {
  gameState.phase = 'generating';
  io.emit('game-state', gameState);

  const playerIds = Object.keys(gameState.prompts);
  
  try {
    // Generate images for all prompts
    const imagePromises = playerIds.map(async (playerId) => {
      const prompt = gameState.prompts[playerId];
      if (!prompt) return null;

      const imageData = await generateImage(prompt);
      gameState.generatedImages[playerId] = imageData;
      
      // Save image to file if it's not a fallback
      if (imageData && imageData.url && !imageData.fallback) {
        try {
          const savedPath = await saveImageToFile(imageData.url, prompt, playerId);
          if (savedPath) {
            imageData.savedPath = savedPath;
          }
        } catch (saveError) {
          console.error(`Failed to save image for player ${playerId}:`, saveError);
        }
      }
      
      return { playerId, imageData };
    });

    await Promise.all(imagePromises);
    
    gameState.phase = 'judging';
    io.emit('game-state', gameState);
    io.emit('images-ready', gameState.generatedImages);
    
  } catch (error) {
    console.error('Image generation failed:', error);
    gameState.phase = 'error';
    io.emit('game-state', gameState);
  }
}

// Health check for OpenAI API
let openaiHealthy = true;

async function checkOpenAIHealth() {
  if (!process.env.OPENAI_API_KEY) {
    console.log('⚠️  No OpenAI API key found. Set OPENAI_API_KEY in environment.');
    openaiHealthy = false;
    return false;
  }
  
  openaiHealthy = true;
  return true;
}

// OpenAI DALL-E image generation
async function generateImage(prompt) {
  // Check if OpenAI API key is available
  const isHealthy = await checkOpenAIHealth();
  
  if (!isHealthy) {
    console.log(`🔄 OpenAI unavailable, using fallback for: "${prompt.substring(0, 50)}..."`);
    return createFallbackImage(prompt);
  }
  
  try {
    console.log(`🎨 Generating image with DALL-E for prompt: "${prompt}"`);
    
    const response = await openai.images.generate({
      model: "dall-e-3",
      prompt: prompt,
      n: 1,
      size: "1024x1024",
      quality: "standard",
      style: "vivid"
    });
    
    if (response.data && response.data[0] && response.data[0].url) {
      const imageUrl = response.data[0].url;
      console.log(`✅ DALL-E image generated successfully for: "${prompt.substring(0, 50)}..."`);
      
      return {
        url: imageUrl,
        prompt: prompt,
        timestamp: Date.now(),
        generatedBy: 'dall-e-3'
      };
    } else {
      throw new Error('No image data received from OpenAI API');
    }
    
  } catch (error) {
    console.error(`❌ DALL-E generation failed: ${error.message}`);
    
    // Check if it's an API key issue
    if (error.message.includes('API key') || error.message.includes('authentication')) {
      console.log('⚠️  Please check your OpenAI API key in the .env file');
      openaiHealthy = false;
    }
    
    return createFallbackImage(prompt);
  }
}

// Function to save image from URL to local file
async function saveImageToFile(imageUrl, prompt, playerId) {
  try {
    // Create safe filename from prompt (remove special chars, limit length)
    const safePrompt = prompt
      .replace(/[^a-zA-Z0-9\s-]/g, '') // Remove special chars
      .replace(/\s+/g, '_') // Replace spaces with underscores
      .substring(0, 50); // Limit length
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
    const filename = `player${playerId}_${timestamp}_${safePrompt}.jpg`;
    const filepath = path.join(OUTPUT_DIR, filename);
    
    // Download and save the image
    const file = fs.createWriteStream(filepath);
    
    return new Promise((resolve, reject) => {
      https.get(imageUrl, (response) => {
        if (response.statusCode !== 200) {
          reject(new Error(`Failed to download image: ${response.statusCode}`));
          return;
        }
        
        response.pipe(file);
        
        file.on('finish', () => {
          file.close();
          console.log(`💾 Image saved: ${filename}`);
          resolve(filepath);
        });
        
        file.on('error', (err) => {
          fs.unlink(filepath, () => {}); // Delete file on error
          reject(err);
        });
      }).on('error', reject);
    });
  } catch (error) {
    console.error('Error saving image:', error);
    return null;
  }
}

function createFallbackImage(prompt) {
  console.log(`📷 Using fallback image for: "${prompt.substring(0, 50)}..."`);
  
  // Create a more descriptive placeholder
  const shortPrompt = encodeURIComponent(prompt.substring(0, 40));
  const colors = ['FF6B6B', '4ECDC4', '45B7D1', '96CEB4', 'FFEAA7', 'DDA0DD'];
  const color = colors[Math.floor(Math.random() * colors.length)];
  
  return {
    url: `https://via.placeholder.com/1024x1024/${color}/ffffff.png?text=${shortPrompt}`,
    prompt: prompt,
    timestamp: Date.now(),
    fallback: true,
    generatedBy: 'fallback'
  };
}

// Serve React app for any non-API routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'client/build', 'index.html'));
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🚀 Prompt Battle Server Running!`);
  console.log(`📱 Local access: http://localhost:${PORT}`);
  console.log(`🌐 Network access: http://${LOCAL_IP}:${PORT}`);
  console.log(`\n📋 Access URLs:`);
  console.log(`   Admin Panel: http://${LOCAL_IP}:${PORT}/admin`);
  console.log(`   Player 1: http://${LOCAL_IP}:${PORT}/player/1`);
  console.log(`   Player 2: http://${LOCAL_IP}:${PORT}/player/2`);
  console.log(`   Central Display: http://${LOCAL_IP}:${PORT}/display`);
  console.log(`\n📶 Share the network IP (${LOCAL_IP}) with players on your hotspot!`);
});