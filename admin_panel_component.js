// src/components/AdminPanel.js
import React, { useState, useEffect } from 'react';
import { Play, RotateCcw, Settings, Monitor, User, ExternalLink, Clock, Target } from 'lucide-react';
import io from 'socket.io-client';

const SOCKET_URL = process.env.NODE_ENV === 'production' 
  ? window.location.origin 
  : 'http://localhost:3000';

const SAMPLE_TARGETS = [
  "Create a majestic dragon soaring through a storm-filled sky",
  "A cozy coffee shop on a rainy evening with warm golden light",
  "A futuristic city floating among the clouds at sunset",
  "A magical forest with glowing mushrooms and fairy lights",
  "An astronaut discovering an ancient alien temple on Mars",
  "A steampunk airship flying over a Victorian London skyline",
  "A serene Japanese garden with cherry blossoms and a koi pond",
  "A cyberpunk street scene with neon signs and flying cars",
  "A pirate ship sailing through a nebula in space",
  "A medieval knight facing a massive mechanical dragon"
];

export default function AdminPanel() {
  const [socket, setSocket] = useState(null);
  const [gameState, setGameState] = useState(null);
  const [target, setTarget] = useState(SAMPLE_TARGETS[0]);
  const [duration, setDuration] = useState(60);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const newSocket = io(SOCKET_URL);
    
    newSocket.on('connect', () => {
      setConnected(true);
      newSocket.emit('get-state');
    });

    newSocket.on('disconnect', () => {
      setConnected(false);
    });

    newSocket.on('game-state', (state) => {
      setGameState(state);
    });

    setSocket(newSocket);

    return () => {
      newSocket.close();
    };
  }, []);

  const startBattle = () => {
    if (socket && gameState?.state === 'waiting') {
      socket.emit('start-battle', { target, duration });
    }
  };

  const resetBattle = async () => {
    try {
      await fetch('/api/admin/reset', { method: 'POST' });
    } catch (error) {
      console.error('Failed to reset:', error);
    }
  };

  const openPlayerWindow = (playerId) => {
    const url = `/player/${playerId}`;
    window.open(url, `player-${playerId}`, 'width=800,height=600');
  };

  const openCentralDisplay = () => {
    const url = '/display';
    window.open(url, 'central-display', 'width=1200,height=800,fullscreen=yes');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 text-white p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 mb-8">
          <h1 className="text-4xl font-bold mb-4 flex items-center gap-3">
            <Settings className="text-blue-400" />
            Prompt Battle Admin
          </h1>
          <div className="flex items-center gap-6">
            <div className={`flex items-center gap-2 ${connected ? 'text-green-400' : 'text-red-400'}`}>
              <div className={`w-3 h-3 rounded-full ${connected ? 'bg-green-400' : 'bg-red-400'} animate-pulse`}></div>
              <span>{connected ? 'Connected' : 'Disconnected'}</span>
            </div>
            <div className="text-gray-300">
              Players: {gameState?.players?.length || 0}
            </div>
            <div className="text-gray-300">
              State: <span className="capitalize font-semibold">{gameState?.state || 'Unknown'}</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Quick Launch Panel */}
          <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-6">
            <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
              <Monitor />
              Quick Launch
            </h2>
            
            <div className="space-y-4">
              <button
                onClick={openCentralDisplay}
                className="w-full bg-purple-600 hover:bg-purple-500 text-white font-bold py-4 px-6 rounded-lg flex items-center justify-center gap-3 transition-colors"
              >
                <Monitor size={24} />
                Open Central Display
                <ExternalLink size={20} />
              </button>
              
              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={() => openPlayerWindow('Player 1')}
                  className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 px-4 rounded-lg flex items-center justify-center gap-2 transition-colors"
                >
                  <User size={20} />
                  Player 1
                  <ExternalLink size={16} />
                </button>
                
                <button
                  onClick={() => openPlayerWindow('Player 2')}
                  className="bg-red-600 hover:bg-red-500 text-white font-bold py-3 px-4 rounded-lg flex items-center justify-center gap-2 transition-colors"
                >
                  <User size={20} />
                  Player 2
                  <ExternalLink size={16} />
                </button>
              </div>
            </div>
          </div>

          {/* Battle Configuration */}
          <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-6">
            <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
              <Target />
              Battle Configuration
            </h2>
            
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium mb-2 text-gray-300">Challenge Target:</label>
                <textarea
                  value={target}
                  onChange={(e) => setTarget(e.target.value)}
                  className="w-full h-24 bg-black/30 border border-white/20 rounded-lg p-3 text-white resize-none focus:outline-none focus:border-blue-400"
                  placeholder="Enter the challenge for contestants..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2 text-gray-300">Quick Targets:</label>
                <div className="grid grid-cols-1 gap-2 max-h-32 overflow-y-auto">
                  {SAMPLE_TARGETS.slice(0, 4).map((sampleTarget, index) => (
                    <button
                      key={index}
                      onClick={() => setTarget(sampleTarget)}
                      className="text-left text-sm bg-gray-700 hover:bg-gray-600 p-2 rounded transition-colors"
                    >
                      {sampleTarget.length > 50 ? `${sampleTarget.substring(0, 50)}...` : sampleTarget}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2 text-gray-300 flex items-center gap-2">
                  <Clock size={16} />
                  Timer Duration:
                </label>
                <select
                  value={duration}
                  onChange={(e) => setDuration(Number(e.target.value))}
                  className="w-full bg-black/30 border border-white/20 rounded-lg p-3 text-white focus:outline-none focus:border-blue-400"
                >
                  <option value={30}>30 seconds</option>
                  <option value={60}>1 minute</option>
                  <option value={90}>1.5 minutes</option>
                  <option value={120}>2 minutes</option>
                  <option value={180}>3 minutes</option>
                </select>
              </div>
            </div>
          </div>

          {/* Battle Control */}
          <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-6">
            <h2 className="text-2xl font-bold mb-6">Battle Control</h2>
            
            <div className="space-y-4">
              <button
                onClick={startBattle}
                disabled={!connected || gameState?.state !== 'waiting'}
                className="w-full bg-green-600 hover:bg-green-500 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-bold py-4 px-6 rounded-lg flex items-center justify-center gap-3 transition-colors"
              >
                <Play size={24} />
                {gameState?.state === 'waiting' ? 'START BATTLE' : `Battle ${gameState?.state || 'Loading'}`}
              </button>
              
              <button
                onClick={resetBattle}
                disabled={!connected}
                className="w-full bg-yellow-600 hover:bg-yellow-500 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-bold py-3 px-6 rounded-lg flex items-center justify-center gap-2 transition-colors"
              >
                <RotateCcw size={20} />
                RESET BATTLE
              </button>
            </div>

            {gameState?.state === 'writing' && (
              <div className="mt-6 p-4 bg-blue-500/20 rounded-lg">
                <div className="text-center">
                  <div className="text-3xl font-mono font-bold text-blue-300">
                    {Math.floor(gameState.timeLeft / 60)}:{(gameState.timeLeft % 60).toString().padStart(2, '0')}
                  </div>
                  <div className="text-sm text-gray-300">Time Remaining</div>
                </div>
              </div>
            )}
          </div>

          {/* Player Status */}
          <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-6">
            <h2 className="text-2xl font-bold mb-6">Player Status</h2>
            
            <div className="space-y-4">
              {gameState?.players && gameState.players.length > 0 ? (
                gameState.players.map((player, index) => (
                  <div key={player.socketId} className="bg-black/20 rounded-lg p-4">
                    <div className="flex justify-between items-center mb-2">
                      <h3 className="font-semibold">{player.id}</h3>
                      <div className={`w-3 h-3 rounded-full ${index === 0 ? 'bg-blue-400' : 'bg-red-400'}`}></div>
                    </div>
                    <div className="text-sm text-gray-300">
                      Socket: {player.socketId.substring(0, 8)}...
                    </div>
                    {gameState.state === 'writing' && player.prompt && (
                      <div className="mt-2 text-sm bg-gray-800 p-2 rounded">
                        {player.prompt.length > 100 ? `${player.prompt.substring(0, 100)}...` : player.prompt}
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <div className="text-center text-gray-400 py-8">
                  <User size={48} className="mx-auto mb-4 opacity-50" />
                  <p>No players connected</p>
                  <p className="text-sm mt-2">Open player windows to connect contestants</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Instructions */}
        <div className="mt-8 bg-white/5 backdrop-blur-sm rounded-2xl p-6">
          <h2 className="text-2xl font-bold mb-4">Setup Instructions</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm text-gray-300">
            <div>
              <h3 className="font-semibold text-white mb-2">1. Open Windows:</h3>
              <ul className="space-y-1 list-disc list-inside">
                <li>Click "Open Central Display" for the main screen/projector</li>
                <li>Open "Player 1" and "Player 2" windows for contestants</li>
                <li>Position windows on appropriate screens/devices</li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold text-white mb-2">2. Configure Battle:</h3>
              <ul className="space-y-1 list-disc list-inside">
                <li>Set the challenge target text</li>
                <li>Choose timer duration (30s - 3min)</li>
                <li>Ensure both players are connected</li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold text-white mb-2">3. Run Battle:</h3>
              <ul className="space-y-1 list-disc list-inside">
                <li>Click "START BATTLE" when ready</li>
                <li>Players will see 3-2-1 countdown</li>
                <li>Watch live typing on central display</li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold text-white mb-2">4. Judge Results:</h3>
              <ul className="space-y-1 list-disc list-inside">
                <li>Images generate simultaneously after timer</li>
                <li>Click "CROWN THE WINNER" on central display</li>
                <li>Celebration plays, then reset for next round</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Environment Info */}
        <div className="mt-6 text-center text-gray-400 text-sm">
          <p>Prompt Battle v1.0 | Environment: {process.env.NODE_ENV || 'development'}</p>
          {process.env.REACT_APP_VERSION && <p>Build: {process.env.REACT_APP_VERSION}</p>}
        </div>
      </div>
    </div>
  );
}