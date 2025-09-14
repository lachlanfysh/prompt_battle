import React, { useState, useEffect } from 'react';
import { Settings, Play, RotateCcw, Timer, Users, Monitor } from 'lucide-react';
import io from 'socket.io-client';

const getSocketURL = () => {
  const protocol = window.location.protocol;
  const hostname = window.location.hostname;
  const port = process.env.NODE_ENV === 'production' ? window.location.port : '3001';
  return `${protocol}//${hostname}:${port}`;
};

export default function AdminPanel() {
  const [socket, setSocket] = useState(null);
  const [gameState, setGameState] = useState(null);
  const [target, setTarget] = useState('');
  const [duration, setDuration] = useState(60);
  const [connected, setConnected] = useState(false);
  const [challengeImages, setChallengeImages] = useState([]);
  const [targetType, setTargetType] = useState('text'); // 'text' or 'image'
  const [selectedImage, setSelectedImage] = useState(null);
  const [randomTopicEnabled, setRandomTopicEnabled] = useState(false);

  const presetTargets = [
    // Corporate & Business Humor (accessible)
    'How many consultants does it take to change a lightbulb? Show the meeting where they discuss it',
    'A consultant presenting a slide that just says "SYNERGY" with jazz hands',
    'The facial expression of a consultant when asked to actually do the work themselves',
    'A person trying to look busy when their boss walks by',
    'Someone pretending to take notes but actually drawing doodles of their coworkers',
    'The look when someone says "let\'s circle back on this" for the 10th time',

    // Tech & Modern Life (relatable)
    'The moment when someone realizes they\'ve been on mute during an important meeting',
    'A person trying to explain why their computer works fine at home but breaks at work',
    'Someone trying to explain cryptocurrency to their pet goldfish',
    'The expression when your smart TV starts playing ads louder than your show',
    'A robot trying to understand why humans need coffee to function',
    'The moment when you accidentally delete something important and panic',

    // Everyday Life Humor
    'The face you make when someone says "we need to talk" via text message',
    'The expression when you wave back at someone who was waving at the person behind you',
    'The look when you realize you\'ve been singing the wrong lyrics to a song for years',
    'A person trying to act casual after walking into a glass door',
    'The face when you\'re telling a story and forget the point halfway through',
    'Someone trying to open a door that says "push" while pulling with all their might',

    // Fantastical & Whimsical Scenes
    'A dragon attending a job interview for a position as a professional campfire starter',
    'A unicorn trying to use a smartphone with its horn getting in the way',
    'A wizard attempting to order coffee but accidentally turning the barista into a frog',
    'A superhero whose only power is finding lost TV remotes',
    'A time traveler from the past confused by automatic sliding doors',
    'A genie granting wishes but only for really mundane things like perfectly ripe avocados',
    'A ghost trying to use a computer but their hands keep going through the keyboard',
    'A vampire confused by modern fashion trends',

    // Animal Scenarios
    'A cat explaining to dogs why knocking things off tables is actually very important',
    'A group of penguins holding a serious business meeting about fish market prices',
    'A sloth giving a motivational speech about the importance of speed',
    'A hamster running on a wheel while explaining their fitness routine',
    'Two squirrels having a heated debate about the best places to hide nuts',
    'A goldfish with a PhD trying to teach underwater basket weaving',
    'A chicken crossing the road but stopping to ask for directions',
    'A cow giving a presentation on why the grass really is greener on the other side'
  ];

  // Fetch available challenge images
  useEffect(() => {
    fetch('/api/challenge-images')
      .then(res => res.json())
      .then(data => setChallengeImages(data.images || []))
      .catch(err => console.error('Failed to fetch challenge images:', err));
  }, []);

  useEffect(() => {
    const socketURL = getSocketURL();
    console.log('Admin Panel connecting to:', socketURL);
    
    const newSocket = io(socketURL, {
      transports: ['websocket', 'polling']
    });
    
    newSocket.on('connect', () => {
      console.log('Admin Panel connected');
      setConnected(true);
      newSocket.emit('join-admin');
    });

    newSocket.on('disconnect', () => {
      setConnected(false);
    });

    newSocket.on('game-state', (state) => {
      console.log('Game state updated:', state);
      setGameState(state);
    });

    setSocket(newSocket);

    return () => {
      newSocket.close();
    };
  }, []);

  const setTargetPrompt = () => {
    if (socket) {
      if (targetType === 'text') {
        let finalTarget;
        if (randomTopicEnabled) {
          finalTarget = presetTargets[Math.floor(Math.random() * presetTargets.length)];
        } else {
          finalTarget = target.trim();
        }

        if (finalTarget) {
          setTarget(finalTarget); // Update the display
          socket.emit('set-target', { type: 'text', content: finalTarget });
        }
      } else if (targetType === 'image' && selectedImage) {
        socket.emit('set-target', {
          type: 'image',
          content: `Recreate this image: ${selectedImage.displayName}`,
          imageUrl: selectedImage.url,
          imageFilename: selectedImage.filename
        });
      }
    }
  };

  const startBattle = () => {
    if (socket) {
      socket.emit('start-battle', duration);
    }
  };

  const resetGame = () => {
    if (socket) {
      socket.emit('reset-game');
      setTarget('');
    }
  };

  const getConnectionStatus = () => {
    if (!connected) return { color: 'text-red-500', text: 'Disconnected' };
    return { color: 'text-green-500', text: 'Connected' };
  };

  const getPlayerCount = () => {
    if (!gameState?.players) return 0;
    return Object.keys(gameState.players).filter(id => gameState.players[id].connected).length;
  };

  const canStartBattle = () => {
    return connected && 
           gameState?.phase === 'ready' && 
           gameState?.target && 
           getPlayerCount() >= 2;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 text-white">
      {/* Header */}
      <div className="p-6 border-b border-gray-600">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold flex items-center space-x-3">
            <Settings className="h-8 w-8" />
            <span>Prompt Battle Admin</span>
          </h1>
          
          <div className="flex items-center space-x-4">
            <div className={`flex items-center space-x-2 ${getConnectionStatus().color}`}>
              <div className="w-3 h-3 rounded-full bg-current animate-pulse"></div>
              <span>{getConnectionStatus().text}</span>
            </div>
            <div className="text-gray-300">
              <Users className="inline h-5 w-5 mr-2" />
              {getPlayerCount()}/2 Players
            </div>
          </div>
        </div>
      </div>

      <div className="p-6 max-w-6xl mx-auto">
        {/* Quick Access URLs */}
        <div className="bg-gray-800 rounded-lg p-6 mb-8">
          <h2 className="text-xl font-bold mb-4 flex items-center">
            <Monitor className="h-6 w-6 mr-2" />
            Quick Access URLs
          </h2>
          
          <div className="grid md:grid-cols-3 gap-4">
            <div className="bg-gray-700 p-4 rounded-lg">
              <h3 className="font-semibold text-blue-400 mb-2">Central Display</h3>
              <a 
                href="/display" 
                target="_blank"
                className="text-sm text-blue-300 hover:underline font-mono break-all"
              >
                {window.location.origin}/display
              </a>
            </div>
            
            <div className="bg-gray-700 p-4 rounded-lg">
              <h3 className="font-semibold text-green-400 mb-2">Player 1</h3>
              <a 
                href="/player/1" 
                target="_blank"
                className="text-sm text-green-300 hover:underline font-mono break-all"
              >
                {window.location.origin}/player/1
              </a>
            </div>
            
            <div className="bg-gray-700 p-4 rounded-lg">
              <h3 className="font-semibold text-purple-400 mb-2">Player 2</h3>
              <a 
                href="/player/2" 
                target="_blank"
                className="text-sm text-purple-300 hover:underline font-mono break-all"
              >
                {window.location.origin}/player/2
              </a>
            </div>
          </div>
        </div>

        {/* Game Status */}
        <div className="bg-gray-800 rounded-lg p-6 mb-8">
          <h2 className="text-xl font-bold mb-4">Game Status</h2>
          
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <h3 className="font-semibold mb-2">Current Phase:</h3>
              <div className="text-2xl font-bold text-blue-400 capitalize">
                {gameState?.phase || 'Disconnected'}
              </div>
            </div>
            
            <div>
              <h3 className="font-semibold mb-2">Connected Players:</h3>
              <div className="space-y-2">
                {['1', '2'].map(playerId => (
                  <div key={playerId} className="flex items-center space-x-2">
                    <div className={`w-3 h-3 rounded-full ${
                      gameState?.players?.[playerId]?.connected ? 'bg-green-500' : 'bg-gray-500'
                    }`}></div>
                    <span>Player {playerId}</span>
                    {gameState?.players?.[playerId]?.ready && (
                      <span className="text-green-400 text-sm">✓ Ready</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
          
          {gameState?.target && (
            <div className="mt-4 p-4 bg-gray-700 rounded-lg">
              <h3 className="font-semibold mb-2">Current Target:</h3>
              {gameState.target.type === 'image' ? (
                <div className="flex items-center space-x-4">
                  <img 
                    src={gameState.target.imageUrl} 
                    alt="Challenge"
                    className="w-24 h-24 object-cover rounded"
                  />
                  <div>
                    <p className="text-lg font-medium">{gameState.target.content}</p>
                    <p className="text-sm text-gray-400">Image Recreation Challenge</p>
                  </div>
                </div>
              ) : (
                <p className="text-lg">{gameState.target.content || gameState.target}</p>
              )}
            </div>
          )}
        </div>

        {/* Target Setting */}
        <div className="bg-gray-800 rounded-lg p-6 mb-8">
          <h2 className="text-xl font-bold mb-4">Set Battle Target</h2>
          
          {/* Challenge Type Selector */}
          <div className="mb-6">
            <label className="block font-semibold mb-3">Challenge Type:</label>
            <div className="flex space-x-4">
              <button
                onClick={() => setTargetType('text')}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  targetType === 'text' 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                Text Prompt
              </button>
              <button
                onClick={() => setTargetType('image')}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  targetType === 'image' 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                Image Recreation
              </button>
            </div>
          </div>

          {targetType === 'text' ? (
            <>
              {/* Random Topic Toggle */}
              <div className="mb-4">
                <label className="flex items-center space-x-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={randomTopicEnabled}
                    onChange={(e) => setRandomTopicEnabled(e.target.checked)}
                    className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500 focus:ring-2"
                  />
                  <span className="font-semibold text-blue-400">🎲 Random Topic Selection</span>
                  <span className="text-sm text-gray-400">(Overrides manual input)</span>
                </label>
              </div>

              <div className="mb-4">
                <label className="block font-semibold mb-2">Target Prompt:</label>
                <textarea
                  value={target}
                  onChange={(e) => setTarget(e.target.value)}
                  placeholder={randomTopicEnabled ? "Random topic will be selected automatically..." : "Enter the target for players to create images of..."}
                  disabled={randomTopicEnabled}
                  className={`w-full h-24 p-3 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:border-blue-500 focus:outline-none ${
                    randomTopicEnabled ? 'bg-gray-800 cursor-not-allowed opacity-50' : 'bg-gray-700'
                  }`}
                  maxLength={200}
                />
                <div className="text-right text-sm text-gray-400 mt-1">
                  {target.length}/200 characters
                </div>
              </div>
              
              <div className="mb-6">
                <h3 className="font-semibold mb-3">Quick Presets:</h3>
                <div className="grid md:grid-cols-2 gap-2">
                  {presetTargets.map((preset, index) => (
                    <button
                      key={index}
                      onClick={() => setTarget(preset)}
                      className="text-left p-3 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm transition-colors"
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="mb-6">
                <label className="block font-semibold mb-3">Choose Challenge Image:</label>
                {challengeImages.length === 0 ? (
                  <p className="text-gray-400">No challenge images found. Add images to the /images folder.</p>
                ) : (
                  <div className="grid md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {challengeImages.map((image, index) => (
                      <div key={index} className="relative">
                        <button
                          onClick={() => setSelectedImage(image)}
                          className={`w-full p-2 rounded-lg border-2 transition-colors ${
                            selectedImage?.filename === image.filename
                              ? 'border-blue-500 bg-blue-900/20'
                              : 'border-gray-600 hover:border-gray-500 bg-gray-700'
                          }`}
                        >
                          <img 
                            src={image.url} 
                            alt={image.displayName}
                            className="w-full h-24 object-cover rounded mb-2"
                          />
                          <p className="text-xs text-gray-300 truncate">
                            {image.displayName}
                          </p>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              
              {selectedImage && (
                <div className="mb-4 p-4 bg-gray-700 rounded-lg">
                  <h3 className="font-semibold mb-2">Selected Image:</h3>
                  <div className="flex items-center space-x-4">
                    <img 
                      src={selectedImage.url} 
                      alt={selectedImage.displayName}
                      className="w-24 h-24 object-cover rounded"
                    />
                    <div>
                      <p className="font-medium">{selectedImage.displayName}</p>
                      <p className="text-sm text-gray-400">Players will try to recreate this image</p>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
          
          <button
            onClick={setTargetPrompt}
            disabled={
              !connected ||
              (targetType === 'text' && !randomTopicEnabled && !target.trim()) ||
              (targetType === 'image' && !selectedImage)
            }
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white font-bold py-2 px-6 rounded-lg transition-colors"
          >
            {targetType === 'text' && randomTopicEnabled ? '🎲 Set Random Target' : 'Set Target'}
          </button>
        </div>

        {/* Battle Controls */}
        <div className="bg-gray-800 rounded-lg p-6">
          <h2 className="text-xl font-bold mb-4">Battle Controls</h2>
          
          <div className="mb-6">
            <label className="block font-semibold mb-2 flex items-center">
              <Timer className="h-5 w-5 mr-2" />
              Battle Duration (seconds):
            </label>
            <select
              value={duration}
              onChange={(e) => setDuration(parseInt(e.target.value))}
              className="p-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:border-blue-500 focus:outline-none"
            >
              <option value={30}>30 seconds</option>
              <option value={60}>1 minute</option>
              <option value={90}>1.5 minutes</option>
              <option value={120}>2 minutes</option>
              <option value={180}>3 minutes</option>
            </select>
          </div>
          
          <div className="flex space-x-4">
            <button
              onClick={startBattle}
              disabled={!canStartBattle()}
              className="bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white font-bold py-3 px-6 rounded-lg transition-colors flex items-center space-x-2"
            >
              <Play className="h-5 w-5" />
              <span>Start Battle</span>
            </button>
            
            <button
              onClick={resetGame}
              disabled={!connected}
              className="bg-red-600 hover:bg-red-700 disabled:bg-gray-600 text-white font-bold py-3 px-6 rounded-lg transition-colors flex items-center space-x-2"
            >
              <RotateCcw className="h-5 w-5" />
              <span>Reset Game</span>
            </button>
          </div>
          
          {!canStartBattle() && connected && (
            <div className="mt-4 text-yellow-400">
              ⚠️ {!gameState?.target ? 'Set a target first' : 
                   getPlayerCount() < 2 ? 'Need 2 players connected' :
                   'Game not ready'}
            </div>
          )}
        </div>

        {/* Stable Diffusion Status */}
        <div className="bg-gray-800 rounded-lg p-6 mt-8">
          <h2 className="text-xl font-bold mb-4">Stable Diffusion Status</h2>
          <div className="text-gray-300">
            <p className="mb-2">🔗 Expected endpoint: http://localhost:7860</p>
            <p className="text-sm">
              Make sure Automatic1111 WebUI is running with <code className="bg-gray-700 px-2 py-1 rounded">--api --listen</code> flags
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}