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
  const provider = process.env.OPENAI_PROVIDER || 'openai';

  // Determine provider status
  let providerInfo = {
    type: provider,
    configured: openaiHealth,
    name: provider === 'azure' ? 'Azure OpenAI' : 'OpenAI'
  };

  if (provider === 'azure') {
    providerInfo.details = {
      endpoint: process.env.AZURE_OPENAI_ENDPOINT ? '✓ Set' : '✗ Missing',
      dalleDeployment: process.env.AZURE_OPENAI_DEPLOYMENT_DALLE || 'dall-e-3',
      gptDeployment: process.env.AZURE_OPENAI_DEPLOYMENT_GPT || 'gpt-4o',
      apiVersion: process.env.AZURE_OPENAI_API_VERSION || '2024-02-01'
    };
  }

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
    },
    provider: providerInfo
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

// Image proxy endpoint to serve OpenAI images through our domain
app.get('/api/proxy-image', async (req, res) => {
  try {
    const { url } = req.query;

    if (!url) {
      return res.status(400).json({ error: 'Missing url parameter' });
    }

    // Validate it's an OpenAI URL for security
    if (!url.startsWith('https://oaidalleapiprodscus.blob.core.windows.net/')) {
      return res.status(400).json({ error: 'Invalid image URL' });
    }

    console.log('🖼️ Proxying image:', url);

    // Download the image
    const response = await fetch(url);

    if (!response.ok) {
      return res.status(response.status).json({ error: 'Failed to fetch image' });
    }

    // Set appropriate headers
    res.set({
      'Content-Type': response.headers.get('content-type') || 'image/jpeg',
      'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
      'Access-Control-Allow-Origin': '*'
    });

    // Stream the image directly to the client
    const imageBuffer = await response.arrayBuffer();
    res.send(Buffer.from(imageBuffer));

  } catch (error) {
    console.error('Error proxying image:', error);
    res.status(500).json({ error: 'Failed to proxy image' });
  }
});

// Dynamic OpenAI client initialization
function createOpenAIClient() {
  const provider = process.env.OPENAI_PROVIDER || 'openai';

  if (provider === 'azure') {
    if (!process.env.AZURE_OPENAI_API_KEY || !process.env.AZURE_OPENAI_ENDPOINT) {
      console.log('⚠️  Azure OpenAI configuration incomplete. Required: AZURE_OPENAI_API_KEY, AZURE_OPENAI_ENDPOINT');
      return null;
    }

    console.log('🔄 Initializing Azure OpenAI client');
    return new OpenAI({
      apiKey: process.env.AZURE_OPENAI_API_KEY,
      baseURL: `${process.env.AZURE_OPENAI_ENDPOINT.replace(/\/$/, '')}/openai/deployments`,
      defaultQuery: { 'api-version': process.env.AZURE_OPENAI_API_VERSION || '2024-02-01' },
      defaultHeaders: {
        'api-key': process.env.AZURE_OPENAI_API_KEY
      }
    });
  } else {
    console.log('🔄 Initializing OpenAI client');
    return new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
  }
}

// Initialize OpenAI client
const openai = createOpenAIClient();

// Game state management
let gameState = {
  phase: 'waiting', // waiting, ready, battling, judging, finished
  players: {},
  prompts: {},
  generatedImages: {},
  target: null,
  timer: 0,
  winner: null,
  competitionActive: false,
  roundNumber: 0,
  roundsPlayed: 0,
  scores: {},
  roundHistory: [],
  competitionMode: 'series',
  bracket: null,
  currentMatch: null,
  eliminatedPlayers: [],
  competitionConfig: {
    roundLimit: null,
    pointLimit: null
  }
};

let battleTimerInterval = null;

function ensureScoreEntry(playerId) {
  if (!playerId) return;
  if (!gameState.scores[playerId]) {
    gameState.scores[playerId] = 0;
  }
}

function normalizeBracket(bracketData = {}) {
  const rounds = Array.isArray(bracketData.rounds) ? bracketData.rounds : [];
  return {
    rounds: rounds.map((round, roundIndex) => ({
      name: round?.name || `Round ${roundIndex + 1}`,
      matches: (Array.isArray(round?.matches) ? round.matches : []).map((match, matchIndex) => {
        let players = Array.isArray(match?.players) ? match.players.slice(0, 2) : [];
        if (players.length < 2) {
          players = [players[0] ?? null, players[1] ?? null];
        }

        return {
          id: match?.id || `${roundIndex}-${matchIndex}`,
          players,
          winner: match?.winner || null,
          status: match?.status || 'pending'
        };
      })
    }))
  };
}

function findNextPendingMatch(bracket) {
  if (!bracket?.rounds) {
    return null;
  }

  for (let roundIndex = 0; roundIndex < bracket.rounds.length; roundIndex += 1) {
    const round = bracket.rounds[roundIndex];
    if (!round?.matches) continue;

    for (let matchIndex = 0; matchIndex < round.matches.length; matchIndex += 1) {
      const match = round.matches[matchIndex];
      if (match && match.status !== 'completed' && match.players?.filter(Boolean).length === 2) {
        return { roundIndex, matchIndex };
      }
    }
  }

  return null;
}

function getMatch(bracket, locator) {
  if (!bracket || !locator) return null;
  const { roundIndex, matchIndex } = locator;
  return bracket.rounds?.[roundIndex]?.matches?.[matchIndex] || null;
}

function emitBracketState() {
  io.emit('bracket-updated', {
    bracket: gameState.bracket,
    currentMatch: gameState.currentMatch,
    eliminatedPlayers: gameState.eliminatedPlayers
  });
  io.emit('game-state', gameState);
}

function setCurrentMatch(locator) {
  gameState.currentMatch = locator;
  if (!locator) {
    return;
  }

  const match = getMatch(gameState.bracket, locator);
  if (match) {
    io.emit('match-ready', {
      roundIndex: locator.roundIndex,
      matchIndex: locator.matchIndex,
      match
    });
  }
}

function resetBracketState() {
  gameState.bracket = null;
  gameState.currentMatch = null;
  gameState.eliminatedPlayers = [];
  gameState.competitionMode = 'series';
  gameState.competitionActive = false;
  gameState.winner = null;
  gameState.roundNumber = 0;
  gameState.roundsPlayed = 0;
  gameState.roundHistory = [];
  gameState.scores = {};
  gameState.competitionConfig = {
    roundLimit: null,
    pointLimit: null
  };
}

function resetBracketProgress(bracket) {
  if (!bracket?.rounds) return;
  bracket.rounds.forEach(round => {
    if (!Array.isArray(round?.matches)) return;
    round.matches.forEach(match => {
      if (!match) return;
      match.winner = null;
      match.status = 'pending';
    });
  });
}

function advanceToNextMatch() {
  const nextMatch = findNextPendingMatch(gameState.bracket);
  setCurrentMatch(nextMatch);
  if (!nextMatch) {
    io.emit('bracket-finished', {
      bracket: gameState.bracket,
      champion: gameState.winner
    });
  }
  emitBracketState();
}

function handleBracketProgression(winnerId) {
  if (!gameState.bracket || !gameState.currentMatch) {
    return;
  }

  const { roundIndex, matchIndex } = gameState.currentMatch;
  const match = getMatch(gameState.bracket, gameState.currentMatch);
  if (!match) {
    return;
  }

  if (!winnerId) {
    advanceToNextMatch();
    return;
  }

  match.winner = winnerId;
  match.status = 'completed';

  const [playerA, playerB] = match.players;
  const loser = [playerA, playerB].find(player => player && player !== winnerId);
  if (loser && !gameState.eliminatedPlayers.includes(loser)) {
    gameState.eliminatedPlayers.push(loser);
  }

  const targetSnapshot = gameState.target;
  gameState.roundsPlayed += 1;
  gameState.roundHistory.push({
    round: `R${roundIndex + 1}-M${matchIndex + 1}`,
    winner: winnerId,
    target: targetSnapshot,
    mode: 'knockout'
  });

  const nextRound = gameState.bracket.rounds[roundIndex + 1];
  if (nextRound && nextRound.matches) {
    const targetMatchIndex = Math.floor(matchIndex / 2);
    const targetMatch = nextRound.matches[targetMatchIndex];
    if (targetMatch) {
      const slot = matchIndex % 2;
      if (!Array.isArray(targetMatch.players)) {
        targetMatch.players = [];
      }
      targetMatch.players[slot] = winnerId;
      if (targetMatch.players.length < 2) {
        targetMatch.players = [targetMatch.players[0] || null, targetMatch.players[1] || null];
      }
    }
    resetRoundState({ clearTarget: true, resetWinner: true });
    gameState.phase = 'waiting';
    gameState.roundNumber = gameState.roundsPlayed + 1;
  } else {
    gameState.winner = winnerId;
    gameState.competitionActive = false;
    gameState.phase = 'finished';
  }

  advanceToNextMatch();
}

function resetRoundState({ clearTarget = false, resetWinner = false } = {}) {
  Object.keys(gameState.players).forEach(playerId => {
    if (gameState.players[playerId]) {
      gameState.players[playerId].ready = false;
    }
  });

  gameState.prompts = {};
  gameState.generatedImages = {};
  gameState.timer = 0;

  if (clearTarget) {
    gameState.target = null;
  }

  if (resetWinner) {
    gameState.winner = null;
  }
}

function prepareNextRound({ auto = false } = {}) {
  resetRoundState({ clearTarget: true });
  gameState.phase = 'waiting';

  io.emit('competition-round-advanced', {
    roundNumber: gameState.roundNumber,
    roundsPlayed: gameState.roundsPlayed,
    scores: gameState.scores,
    auto
  });

  io.emit('game-state', gameState);
}

function getLeaders() {
  const scoreEntries = Object.entries(gameState.scores || {});
  if (scoreEntries.length === 0) {
    return { leaders: [], highestScore: 0 };
  }

  const highestScore = Math.max(...scoreEntries.map(([_, value]) => value));
  const leaders = scoreEntries
    .filter(([_, value]) => value === highestScore)
    .map(([playerId]) => playerId);

  return { leaders, highestScore };
}

function endCompetition({ reason } = {}) {
  gameState.competitionActive = false;
  gameState.roundNumber = gameState.roundsPlayed;
  const { leaders, highestScore } = getLeaders();

  io.emit('competition-finished', {
    scores: gameState.scores,
    roundsPlayed: gameState.roundsPlayed,
    roundHistory: gameState.roundHistory,
    reason: reason || 'limit-reached',
    leaders,
    highestScore
  });

  io.emit('game-state', gameState);
}

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
    if (gameState.competitionActive) {
      ensureScoreEntry(playerId);
    }
    socket.join(`player-${playerId}`);
    socket.emit('game-state', gameState);
    socket.broadcast.emit('game-state', gameState);
  });

  // Central display connects
  socket.on('join-display', () => {
    console.log('Central display connected');
    socket.join('display');
    socket.emit('game-state', gameState);
    if (gameState.bracket) {
      socket.emit('bracket-updated', {
        bracket: gameState.bracket,
        currentMatch: gameState.currentMatch,
        eliminatedPlayers: gameState.eliminatedPlayers
      });
      if (gameState.currentMatch) {
        socket.emit('match-ready', {
          roundIndex: gameState.currentMatch.roundIndex,
          matchIndex: gameState.currentMatch.matchIndex,
          match: getMatch(gameState.bracket, gameState.currentMatch)
        });
      }
    }
  });

  // Admin panel connects
  socket.on('join-admin', () => {
    console.log('Admin panel connected');
    socket.join('admin');
    socket.emit('game-state', gameState);
    if (gameState.bracket) {
      socket.emit('bracket-updated', {
        bracket: gameState.bracket,
        currentMatch: gameState.currentMatch,
        eliminatedPlayers: gameState.eliminatedPlayers
      });
      if (gameState.currentMatch) {
        socket.emit('match-ready', {
          roundIndex: gameState.currentMatch.roundIndex,
          matchIndex: gameState.currentMatch.matchIndex,
          match: getMatch(gameState.bracket, gameState.currentMatch)
        });
      }
    }
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
  socket.on('start-competition', (config = {}) => {
    const roundLimit = config.roundLimit !== undefined && config.roundLimit !== ''
      ? Number(config.roundLimit)
      : null;
    const pointLimit = config.pointLimit !== undefined && config.pointLimit !== ''
      ? Number(config.pointLimit)
      : null;
    const mode = config.competitionMode === 'knockout' ? 'knockout' : 'series';

    if (mode === 'series') {
      resetBracketState();
    }

    gameState.competitionMode = mode;
    gameState.competitionActive = true;
    gameState.roundNumber = 1;
    gameState.roundsPlayed = 0;
    gameState.roundHistory = [];
    gameState.scores = {};
    Object.keys(gameState.players).forEach(playerId => {
      gameState.scores[playerId] = 0;
    });
    gameState.competitionConfig = {
      roundLimit: Number.isFinite(roundLimit) && roundLimit > 0 ? roundLimit : null,
      pointLimit: Number.isFinite(pointLimit) && pointLimit > 0 ? pointLimit : null
    };

    resetRoundState({ clearTarget: true, resetWinner: true });
    gameState.phase = 'waiting';

    if (mode === 'knockout' && gameState.bracket) {
      resetBracketProgress(gameState.bracket);
      gameState.eliminatedPlayers = [];
      setCurrentMatch(findNextPendingMatch(gameState.bracket));
    }

    io.emit('competition-started', {
      roundNumber: gameState.roundNumber,
      config: gameState.competitionConfig,
      scores: gameState.scores,
      competitionMode: gameState.competitionMode
    });
    if (mode === 'knockout') {
      emitBracketState();
    } else {
      io.emit('game-state', gameState);
    }
  });

  socket.on('create-bracket', (bracketData = {}) => {
    const normalized = normalizeBracket(bracketData);
    resetBracketProgress(normalized);
    gameState.bracket = normalized;
    gameState.competitionMode = 'knockout';
    gameState.competitionActive = true;
    gameState.roundNumber = 1;
    gameState.roundsPlayed = 0;
    gameState.roundHistory = [];
    gameState.scores = {};
    gameState.eliminatedPlayers = [];
    gameState.competitionConfig = {
      roundLimit: null,
      pointLimit: null
    };
    resetRoundState({ clearTarget: true, resetWinner: true });
    gameState.phase = 'waiting';

    const firstMatch = findNextPendingMatch(gameState.bracket);
    setCurrentMatch(firstMatch);
    emitBracketState();
  });

  socket.on('advance-match', ({ winnerId } = {}) => {
    if (gameState.competitionMode !== 'knockout' || !gameState.bracket) {
      return;
    }

    if (winnerId) {
      handleBracketProgression(winnerId);
    } else {
      advanceToNextMatch();
    }
  });

  socket.on('reset-bracket', () => {
    resetBracketState();
    emitBracketState();
  });

  socket.on('next-round', () => {
    if (!gameState.competitionActive) {
      return;
    }

    gameState.roundNumber = gameState.roundsPlayed + 1;
    prepareNextRound({ auto: false });
  });

  socket.on('end-competition', () => {
    if (!gameState.competitionActive) {
      return;
    }

    endCompetition({ reason: 'manual' });
    resetRoundState({ clearTarget: true, resetWinner: true });
    gameState.roundNumber = 0;
    gameState.roundsPlayed = 0;
    gameState.roundHistory = [];
    io.emit('game-state', gameState);
  });

  socket.on('set-target', (target) => {
    // Handle both old string format and new object format
    if (typeof target === 'string') {
      gameState.target = { type: 'text', content: target };
    } else {
      gameState.target = target;
    }

    // Clear out previous round data so the new round starts fresh
    resetRoundState({ resetWinner: true });

    gameState.phase = 'ready';
    io.emit('game-state', gameState);
  });

  socket.on('start-battle', (duration) => {
    if (battleTimerInterval) {
      clearInterval(battleTimerInterval);
      battleTimerInterval = null;
    }

    gameState.phase = 'battling';
    gameState.timer = duration;
    gameState.prompts = {};
    gameState.generatedImages = {};
    gameState.winner = null; // Clear previous winner

    if (gameState.competitionMode === 'knockout' && gameState.currentMatch) {
      const match = getMatch(gameState.bracket, gameState.currentMatch);
      if (match) {
        match.status = 'in-progress';
        io.emit('bracket-updated', {
          bracket: gameState.bracket,
          currentMatch: gameState.currentMatch,
          eliminatedPlayers: gameState.eliminatedPlayers
        });
      }
    }

    io.emit('battle-started', { duration });
    io.emit('game-state', gameState);

    // Timer countdown
    battleTimerInterval = setInterval(() => {
      gameState.timer -= 1;
      io.emit('timer-update', gameState.timer);

      if (gameState.timer <= 0) {
        clearBattleTimer();
        endBattle();
      }
    }, 1000);
  });

  socket.on('select-winner', (winnerId) => {
    clearBattleTimer();
    gameState.phase = 'finished';

    const isKnockout = gameState.competitionMode === 'knockout';
    let handledByBracket = false;

    if (!isKnockout) {
      gameState.winner = winnerId;
    }

    if (gameState.competitionActive) {
      if (isKnockout) {
        handledByBracket = true;
        handleBracketProgression(winnerId);
      } else {
        ensureScoreEntry(winnerId);
        if (winnerId) {
          gameState.scores[winnerId] += 1;
        }
        gameState.roundsPlayed += 1;
        gameState.roundHistory.push({
          round: gameState.roundNumber || gameState.roundsPlayed,
          winner: winnerId,
          target: gameState.target,
          mode: 'series'
        });
      }
    }

    if (!handledByBracket) {
      io.emit('game-state', gameState);
    }
    io.emit('winner-selected', winnerId);

    if (!gameState.competitionActive || isKnockout) {
      return;
    }

    const { roundLimit, pointLimit } = gameState.competitionConfig || {};
    const roundLimitValue = roundLimit ? Number(roundLimit) : null;
    const pointLimitValue = pointLimit ? Number(pointLimit) : null;

    const maxScore = Object.values(gameState.scores).reduce((max, score) => Math.max(max, score), 0);
    const roundLimitReached = Number.isFinite(roundLimitValue) && roundLimitValue > 0
      ? gameState.roundsPlayed >= roundLimitValue
      : false;
    const pointLimitReached = Number.isFinite(pointLimitValue) && pointLimitValue > 0
      ? maxScore >= pointLimitValue
      : false;

    if (roundLimitReached || pointLimitReached) {
      endCompetition({ reason: roundLimitReached ? 'round-limit' : 'point-limit' });
      return;
    }

    gameState.roundNumber = gameState.roundsPlayed + 1;
    prepareNextRound({ auto: true });
  });

  socket.on('reset-game', () => {
    clearBattleTimer();
    // Keep connected players but reset their ready status
    Object.keys(gameState.players).forEach(playerId => {
      if (gameState.players[playerId]) {
        gameState.players[playerId].ready = false;
      }
    });

    resetBracketState();
    gameState.phase = 'waiting';
    gameState.prompts = {};
    gameState.generatedImages = {};
    gameState.target = null;
    gameState.timer = 0;
    gameState.winner = null;
    gameState.competitionConfig = {
      roundLimit: null,
      pointLimit: null
    };

    emitBracketState();
    io.emit('game-reset'); // New event to signal complete reset
  });

  // GPT-based image scoring
  socket.on('request-gpt-scoring', async () => {
    console.log('🤖 GPT scoring requested - Debug info:');
    console.log('  Phase:', gameState.phase);
    console.log('  Target:', gameState.target ? 'exists' : 'missing');
    console.log('  Generated images count:', Object.keys(gameState.generatedImages).length);
    console.log('  Generated images:', Object.keys(gameState.generatedImages));

    if (gameState.phase !== 'judging' || !gameState.target || Object.keys(gameState.generatedImages).length < 2) {
      socket.emit('gpt-scoring-error', 'Cannot score images at this time');
      return;
    }

    try {
      console.log('🤖 Starting GPT-based image analysis...');
      const scoringResult = await analyzeImagesWithGPT(gameState.target, gameState.generatedImages);
      io.emit('gpt-scoring-result', scoringResult);
    } catch (error) {
      console.error('GPT scoring failed:', error);
      socket.emit('gpt-scoring-error', error.message);
    }
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    console.log(`Client disconnected: ${socket.id}`);

    // Find and remove player
    for (const playerId in gameState.players) {
      if (gameState.players[playerId].socketId === socket.id) {
        // During judging phase, preserve generated images to prevent disrupting results
        if (gameState.phase === 'judging') {
          console.log(`⚖️ Player ${playerId} disconnected during judging - preserving their image`);
          console.log(`  Before cleanup - images:`, Object.keys(gameState.generatedImages));
          // Remove player but keep their generated image and prompt for judging
          delete gameState.players[playerId];
          console.log(`  After cleanup - images:`, Object.keys(gameState.generatedImages));
        } else {
          // In other phases, clean up completely
          delete gameState.players[playerId];
          delete gameState.prompts[playerId];
          delete gameState.generatedImages[playerId];
        }
        break;
      }
    }

    io.emit('game-state', gameState);
  });
});

function clearBattleTimer() {
  if (battleTimerInterval) {
    clearInterval(battleTimerInterval);
    battleTimerInterval = null;
  }
}

async function endBattle() {
  clearBattleTimer();
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
  const provider = process.env.OPENAI_PROVIDER || 'openai';

  if (provider === 'azure') {
    if (!process.env.AZURE_OPENAI_API_KEY) {
      console.log('⚠️  No Azure OpenAI API key found. Set AZURE_OPENAI_API_KEY in environment.');
      openaiHealthy = false;
      return false;
    }
    if (!process.env.AZURE_OPENAI_ENDPOINT) {
      console.log('⚠️  No Azure OpenAI endpoint found. Set AZURE_OPENAI_ENDPOINT in environment.');
      openaiHealthy = false;
      return false;
    }
    if (!process.env.AZURE_OPENAI_DEPLOYMENT_DALLE) {
      console.log('⚠️  No Azure DALL-E deployment name found. Set AZURE_OPENAI_DEPLOYMENT_DALLE in environment.');
      openaiHealthy = false;
      return false;
    }
  } else {
    if (!process.env.OPENAI_API_KEY) {
      console.log('⚠️  No OpenAI API key found. Set OPENAI_API_KEY in environment.');
      openaiHealthy = false;
      return false;
    }
  }

  if (!openai) {
    console.log('⚠️  OpenAI client initialization failed.');
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

    const provider = process.env.OPENAI_PROVIDER || 'openai';
    const requestParams = {
      prompt: prompt,
      n: 1,
      size: "1024x1024",
      quality: "standard",
      style: "vivid"
    };

    let response;

    // For Azure, we need to use the deployment name instead of model
    if (provider === 'azure') {
      // Azure uses deployment-specific endpoints, model is implicit
      const deploymentName = process.env.AZURE_OPENAI_DEPLOYMENT_DALLE || 'dall-e-3';
      console.log(`🔄 Using Azure deployment: ${deploymentName}`);

      // Override the baseURL for this specific call to include deployment
      response = await openai.images.generate(requestParams, {
        baseURL: `${process.env.AZURE_OPENAI_ENDPOINT.replace(/\/$/, '')}/openai/deployments/${deploymentName}`
      });
    } else {
      requestParams.model = "dall-e-3";
      response = await openai.images.generate(requestParams);
    }
    
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

// GPT-based image analysis function
async function analyzeImagesWithGPT(target, generatedImages) {
  const isHealthy = await checkOpenAIHealth();

  if (!isHealthy) {
    throw new Error('OpenAI API is not available. Please check your API key.');
  }

  const playerIds = Object.keys(generatedImages);
  if (playerIds.length !== 2) {
    throw new Error('Need exactly 2 images to compare');
  }

  const [player1Id, player2Id] = playerIds;
  const image1 = generatedImages[player1Id];
  const image2 = generatedImages[player2Id];

  // Check if images are fallback images (can't analyze those)
  if (image1.fallback || image2.fallback) {
    throw new Error('Cannot analyze fallback placeholder images');
  }

  try {
    // Determine target content based on type
    const targetContent = typeof target === 'object' ? target.content : target;

    const analysisPrompt = `Serve up a confident, playful critique of these two AI-generated images for the prompt: "${targetContent}". Keep the tone witty, a little dramatic, and full of good-natured sass.

Judge them based on:
1. How well each image matches the specific prompt
2. Creative interpretation and execution
3. Visual quality and composition
4. Overall effectiveness in conveying the intended concept

Deliver your feedback in this exact format (feel free to add flair to the wording while keeping the structure):
WINNER: Player [1 or 2]
ANALYSIS: [Detailed explanation of why this image wins, about 2-3 sentences]
PLAYER 1: [Brief feedback on Player 1's image strengths/weaknesses]
PLAYER 2: [Brief feedback on Player 2's image strengths/weaknesses]

Make it crystal clear why the winner snatched the crown and celebrate their standout moments with bold, entertaining commentary.`;

    console.log('🔍 Sending images to GPT-4 Vision for analysis...');

    const provider = process.env.OPENAI_PROVIDER || 'openai';
    const requestParams = {
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: analysisPrompt },
            { type: "text", text: "\n\nPlayer 1's image:" },
            {
              type: "image_url",
              image_url: {
                url: image1.url,
                detail: "high"
              }
            },
            { type: "text", text: "\n\nPlayer 2's image:" },
            {
              type: "image_url",
              image_url: {
                url: image2.url,
                detail: "high"
              }
            }
          ]
        }
      ],
      max_tokens: 500
    };

    let response;

    if (provider === 'azure') {
      const deploymentName = process.env.AZURE_OPENAI_DEPLOYMENT_GPT || 'gpt-4o';
      console.log(`🔄 Using Azure GPT deployment: ${deploymentName}`);

      response = await openai.chat.completions.create(requestParams, {
        baseURL: `${process.env.AZURE_OPENAI_ENDPOINT.replace(/\/$/, '')}/openai/deployments/${deploymentName}`
      });
    } else {
      requestParams.model = "gpt-4o";
      response = await openai.chat.completions.create(requestParams);
    }

    const analysisText = response.choices[0].message.content;
    console.log('✅ GPT analysis completed');

    // Parse the response
    const lines = analysisText.split('\n');
    const winnerLine = lines.find(line => line.startsWith('WINNER:'));
    const analysisLine = lines.find(line => line.startsWith('ANALYSIS:'));
    const player1Line = lines.find(line => line.startsWith('PLAYER 1:'));
    const player2Line = lines.find(line => line.startsWith('PLAYER 2:'));

    const winnerId = winnerLine ? winnerLine.split('Player ')[1]?.split(/[^\d]/)[0] : null;

    return {
      winner: winnerId || null,
      analysis: analysisLine ? analysisLine.replace('ANALYSIS:', '').trim() : 'Analysis not available',
      player1Feedback: player1Line ? player1Line.replace('PLAYER 1:', '').trim() : 'Feedback not available',
      player2Feedback: player2Line ? player2Line.replace('PLAYER 2:', '').trim() : 'Feedback not available',
      fullResponse: analysisText,
      target: targetContent
    };

  } catch (error) {
    console.error('Error in GPT analysis:', error);
    throw new Error(`GPT analysis failed: ${error.message}`);
  }
}

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