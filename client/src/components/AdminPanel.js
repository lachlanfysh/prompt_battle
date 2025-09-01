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

  const presetTargets = [
    'A majestic dragon flying over a medieval castle',
    'A cozy coffee shop in a cyberpunk city',
    'A peaceful forest scene with magical creatures',
    'An astronaut exploring an alien planet',
    'A steampunk airship floating through clouds',
    'A sunset over a mountain lake',
    'A bustling medieval marketplace',
    'A futuristic city with flying cars'
  ];

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
    if (socket && target.trim()) {
      socket.emit('set-target', target.trim());
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
              <p className="text-lg">{gameState.target}</p>
            </div>
          )}
        </div>

        {/* Target Setting */}
        <div className="bg-gray-800 rounded-lg p-6 mb-8">
          <h2 className="text-xl font-bold mb-4">Set Battle Target</h2>
          
          <div className="mb-4">
            <label className="block font-semibold mb-2">Target Prompt:</label>
            <textarea
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              placeholder="Enter the target for players to create images of..."
              className="w-full h-24 p-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:border-blue-500 focus:outline-none"
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
          
          <button
            onClick={setTargetPrompt}
            disabled={!target.trim() || !connected}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white font-bold py-2 px-6 rounded-lg transition-colors"
          >
            Set Target
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