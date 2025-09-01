// src/App.js
import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useParams, Navigate } from 'react-router-dom';
import io from 'socket.io-client';
import PlayerInterface from './components/PlayerInterface';
import CentralDisplay from './components/CentralDisplay';
import AdminPanel from './components/AdminPanel';

const SOCKET_URL = process.env.NODE_ENV === 'production' 
  ? window.location.origin 
  : 'http://localhost:3000';

function App() {
  return (
    <Router>
      <div className="App">
        <Routes>
          <Route path="/" element={<Navigate to="/admin" replace />} />
          <Route path="/admin" element={<AdminPanel />} />
          <Route path="/player/:playerId" element={<PlayerWrapper />} />
          <Route path="/display" element={<CentralDisplay />} />
        </Routes>
      </div>
    </Router>
  );
}

function PlayerWrapper() {
  const { playerId } = useParams();
  return <PlayerInterface playerId={playerId} />;
}

export default App;

// src/components/PlayerInterface.js
import React, { useState, useEffect, useCallback } from 'react';
import { Timer, Wifi, WifiOff, Zap, AlertCircle } from 'lucide-react';
import io from 'socket.io-client';

const SOCKET_URL = process.env.NODE_ENV === 'production' 
  ? window.location.origin 
  : 'http://localhost:3000';

export default function PlayerInterface({ playerId }) {
  const [socket, setSocket] = useState(null);
  const [prompt, setPrompt] = useState('');
  const [gameState, setGameState] = useState(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const newSocket = io(SOCKET_URL);
    
    newSocket.on('connect', () => {
      setConnected(true);
      setError(null);
      newSocket.emit('join', playerId);
    });

    newSocket.on('disconnect', () => {
      setConnected(false);
    });

    newSocket.on('game-state', (state) => {
      setGameState(state);
    });

    newSocket.on('connect_error', (err) => {
      setError('Failed to connect to server');
      setConnected(false);
    });

    setSocket(newSocket);

    return () => {
      newSocket.close();
    };
  }, [playerId]);

  const handlePromptChange = useCallback((value) => {
    setPrompt(value);
    if (socket && gameState?.state === 'writing') {
      socket.emit('update-prompt', value);
    }
  }, [socket, gameState?.state]);

  const formatTime = (seconds) => {
    return `${Math.floor(seconds / 60)}:${(seconds % 60).toString().padStart(2, '0')}`;
  };

  const getTimerColor = () => {
    if (!gameState) return 'text-green-500';
    if (gameState.timeLeft <= 10) return 'text-red-500';
    if (gameState.timeLeft <= 30) return 'text-orange-500';
    return 'text-green-500';
  };

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-900 to-red-800 text-white flex items-center justify-center">
        <div className="text-center">
          <AlertCircle size={64} className="mx-auto mb-4" />
          <h1 className="text-3xl font-bold mb-4">Connection Error</h1>
          <p className="text-xl mb-4">{error}</p>
          <button 
            onClick={() => window.location.reload()} 
            className="bg-blue-500 hover:bg-blue-400 px-6 py-3 rounded-lg"
          >
            Retry Connection
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 text-white p-8">
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <div className="flex items-center gap-4">
          <div className="bg-white/20 backdrop-blur-sm rounded-full px-6 py-3">
            <h1 className="text-2xl font-bold">{playerId}</h1>
          </div>
          <div className={`flex items-center gap-2 ${connected ? 'text-green-400' : 'text-red-400'}`}>
            {connected ? <Wifi size={20} /> : <WifiOff size={20} />}
            <span className="text-sm">{connected ? 'Connected' : 'Disconnected'}</span>
          </div>
        </div>

        {gameState?.state === 'writing' && (
          <div className={`flex items-center gap-3 bg-black/30 rounded-lg px-6 py-3 ${getTimerColor()}`}>
            <Timer size={32} />
            <div className="text-4xl font-mono font-bold">
              {formatTime(gameState.timeLeft)}
            </div>
          </div>
        )}
      </div>

      {/* Game State Content */}
      {!gameState && (
        <div className="text-center py-20">
          <div className="animate-spin w-16 h-16 border-4 border-blue-400 border-t-transparent rounded-full mx-auto mb-6"></div>
          <h2 className="text-3xl font-bold mb-4">Connecting...</h2>
        </div>
      )}

      {gameState?.state === 'waiting' && (
        <div className="text-center py-20">
          <div className="animate-pulse mb-8">
            <Zap size={64} className="mx-auto text-yellow-400 mb-4" />
            <h2 className="text-3xl font-bold mb-4">Waiting for Battle to Begin...</h2>
            <p className="text-xl text-gray-300">Get ready to unleash your creativity!</p>
          </div>
        </div>
      )}

      {gameState?.state === 'ready' && (
        <div className="text-center py-12">
          <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-8 max-w-4xl mx-auto">
            <h2 className="text-2xl font-bold mb-6 text-yellow-400">Your Challenge:</h2>
            <p className="text-3xl mb-8 leading-relaxed">{gameState.target}</p>
            <div className="text-6xl font-bold text-green-400 animate-pulse">
              Get Ready!
            </div>
          </div>
        </div>
      )}

      {gameState?.state === 'writing' && (
        <div className="max-w-4xl mx-auto">
          {/* Challenge Display */}
          <div className="bg-white/10 backdrop-blur-sm rounded-lg p-6 mb-6">
            <h2 className="text-xl font-bold mb-3 text-yellow-400">Your Challenge:</h2>
            <p className="text-2xl">{gameState.target}</p>
          </div>

          {/* Prompt Input */}
          <div className="bg-white/10 backdrop-blur-sm rounded-lg p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold">Your Prompt:</h3>
              <span className="text-sm text-gray-300">{prompt.length} characters</span>
            </div>
            <textarea
              value={prompt}
              onChange={(e) => handlePromptChange(e.target.value)}
              placeholder="Write your image generation prompt here... Be creative, be specific, be amazing!"
              className="w-full h-64 bg-black/30 border border-white/20 rounded-lg p-4 text-white text-lg placeholder-gray-400 resize-none focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-400/50"
              disabled={gameState?.state !== 'writing'}
            />
            
            {/* Prompt Tips */}
            <div className="mt-4 text-sm text-gray-300">
              <p><strong>💡 Pro tip:</strong> Include style, lighting, composition, and specific details for best results!</p>
            </div>
          </div>
        </div>
      )}

      {gameState?.state === 'generating' && (
        <div className="text-center py-20">
          <div className="animate-spin w-16 h-16 border-4 border-blue-400 border-t-transparent rounded-full mx-auto mb-6"></div>
          <h2 className="text-3xl font-bold mb-4">Generating Images...</h2>
          <p className="text-xl text-gray-300">Your creative vision is coming to life!</p>
        </div>
      )}

      {gameState?.state === 'results' && (
        <div className="text-center py-20">
          <h2 className="text-3xl font-bold mb-4">Battle Complete!</h2>
          <p className="text-xl text-gray-300">Check the main screen for results!</p>
          {gameState.winner && (
            <div className="mt-8">
              <div className="text-6xl mb-4">🎉</div>
              <p className="text-2xl">
                {gameState.players.find(p => p.socketId === gameState.winner)?.id === playerId 
                  ? "YOU WON!" 
                  : "Better luck next time!"}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}