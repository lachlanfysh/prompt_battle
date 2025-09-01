import React, { useState, useEffect, useCallback } from 'react';
import io from 'socket.io-client';

// Dynamic socket URL that works for both local and network access
const getSocketURL = () => {
  const protocol = window.location.protocol;
  const hostname = window.location.hostname;
  const port = process.env.NODE_ENV === 'production' ? window.location.port : '3001';
  return `${protocol}//${hostname}:${port}`;
};

export default function PlayerInterface({ playerId }) {
  const [socket, setSocket] = useState(null);
  const [prompt, setPrompt] = useState('');
  const [gameState, setGameState] = useState(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState(null);
  const [timer, setTimer] = useState(0);

  useEffect(() => {
    const socketURL = getSocketURL();
    console.log(`Player ${playerId} connecting to:`, socketURL);
    
    const newSocket = io(socketURL, {
      transports: ['websocket', 'polling']
    });
    
    newSocket.on('connect', () => {
      console.log(`Player ${playerId} connected`);
      setConnected(true);
      setError(null);
      newSocket.emit('join-player', playerId);
    });

    newSocket.on('disconnect', () => {
      console.log(`Player ${playerId} disconnected`);
      setConnected(false);
    });

    newSocket.on('game-state', (state) => {
      console.log('Game state updated:', state);
      setGameState(state);
    });

    newSocket.on('battle-started', ({ duration }) => {
      setTimer(duration);
    });

    newSocket.on('timer-update', (timeLeft) => {
      setTimer(timeLeft);
    });

    newSocket.on('connect_error', (err) => {
      console.error('Connection error:', err);
      setError('Failed to connect to server');
      setConnected(false);
    });

    setSocket(newSocket);

    return () => {
      newSocket.close();
    };
  }, [playerId]);

  const handlePromptChange = useCallback((e) => {
    const value = e.target.value;
    setPrompt(value);
    
    if (socket && gameState?.phase === 'battling') {
      socket.emit('prompt-update', { playerId, prompt: value });
    }
  }, [socket, gameState?.phase, playerId]);

  const handleReady = () => {
    if (socket) {
      socket.emit('player-ready', playerId);
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getPhaseDisplay = () => {
    switch (gameState?.phase) {
      case 'waiting':
        return 'Waiting for game to start...';
      case 'ready':
        return 'Get ready! Game starting soon...';
      case 'battling':
        return 'WRITE YOUR PROMPT NOW!';
      case 'generating':
        return 'Generating images... Please wait!';
      case 'judging':
        return 'Images ready! Awaiting judgment...';
      case 'finished':
        return gameState.winner === playerId ? 'YOU WON!' : 'Better luck next time!';
      default:
        return 'Connecting...';
    }
  };

  if (error) {
    return (
      <div className="min-h-screen bg-white text-black flex items-center justify-center" style={{
        fontFamily: 'Chicago, "SF Pro Display", system-ui, sans-serif',
        fontSize: '12px'
      }}>
        <div className="text-center border-2 border-black bg-white p-8" style={{
          boxShadow: '4px 4px 0px black'
        }}>
          <h1 className="text-xl font-bold mb-4">Connection Error</h1>
          <p className="mb-4">{error}</p>
          <button 
            onClick={() => window.location.reload()} 
            className="border border-black px-4 py-1 hover:bg-black hover:text-white"
            style={{ fontFamily: 'Chicago, "SF Pro Display", system-ui, sans-serif' }}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white text-black" style={{
      fontFamily: 'Chicago, "SF Pro Display", system-ui, sans-serif',
      fontSize: '9px',
      backgroundImage: `url("data:image/svg+xml,%3Csvg width='4' height='4' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M0,0 L2,2 M2,0 L4,2 M0,2 L2,4 M2,2 L4,4' stroke='%23ddd' stroke-width='0.5' fill='none'/%3E%3C/svg%3E")`,
      backgroundSize: '4px 4px'
    }}>
      {/* Menu Bar */}
      <div className="bg-white border-b border-black h-5 flex items-center px-2 text-xs font-bold">
        <span className="mr-4" style={{
          fontFamily: 'Brush Script MT, cursive',
          fontSize: '14px',
          fontWeight: 'bold'
        }}>Kym</span>
        <span className="mr-4">File</span>
        <span className="mr-4">Edit</span>
        <span className="mr-4">View</span>
        <span className="mr-4">Special</span>
      </div>

      {/* Desktop Area */}
      <div className="p-4" style={{ minHeight: 'calc(100vh - 20px)' }}>
        {/* Main Application Window */}
        <div className="bg-white border-2 border-black" style={{
          boxShadow: '4px 4px 0px black'
        }}>
          {/* Window Title Bar */}
          <div className="bg-white border-b border-black p-2 flex items-center justify-between">
            <div className="flex items-center">
              <div className="w-4 h-4 border border-black mr-2 flex items-center justify-center text-xs">×</div>
              <span className="font-bold text-sm">Player {playerId} - Prompt Battle</span>
            </div>
            <div className="flex items-center text-xs">
              <span className={connected ? 'text-black' : 'text-red-600'}>
                {connected ? '● Connected' : '○ Disconnected'}
              </span>
            </div>
          </div>

          {/* Main Content Area */}
          <div className="p-4" style={{ minHeight: '500px' }}>
            {/* Game Status */}
            <div className="mb-6 text-center">
              <div className="text-lg font-bold mb-2" style={{ fontSize: '16px' }}>
                {getPhaseDisplay()}
              </div>
              
              {gameState?.phase === 'battling' && (
                <div className="text-4xl font-bold mb-4" style={{ 
                  fontSize: '48px',
                  fontFamily: 'Chicago, monospace'
                }}>
                  {formatTime(timer)}
                </div>
              )}
              
              {gameState?.target && (
                <div className="border border-black p-3 mb-4 bg-gray-100" style={{
                  boxShadow: 'inset 2px 2px 0px #999'
                }}>
                  <h3 className="font-bold mb-2" style={{ fontSize: '12px' }}>TARGET:</h3>
                  <p style={{ fontSize: '11px' }}>{gameState.target}</p>
                </div>
              )}
            </div>

            {/* Prompt Input */}
            {(gameState?.phase === 'battling' || gameState?.phase === 'ready') && (
              <div className="mb-6">
                <label className="block font-bold mb-2" style={{ fontSize: '12px' }}>
                  Your Prompt:
                </label>
                <textarea
                  value={prompt}
                  onChange={handlePromptChange}
                  placeholder="Write your image generation prompt here..."
                  disabled={gameState?.phase !== 'battling'}
                  className="w-full h-32 p-2 border-2 border-black resize-none"
                  style={{
                    fontFamily: 'Chicago, "SF Pro Display", system-ui, sans-serif',
                    fontSize: '11px',
                    backgroundColor: gameState?.phase === 'battling' ? 'white' : '#f0f0f0',
                    boxShadow: 'inset 2px 2px 0px #999'
                  }}
                  maxLength={500}
                />
                <div className="text-right text-xs mt-1" style={{ fontSize: '10px' }}>
                  {prompt.length}/500 characters
                </div>
              </div>
            )}

            {/* Ready Button */}
            {gameState?.phase === 'ready' && !gameState?.players?.[playerId]?.ready && (
              <div className="text-center">
                <button
                  onClick={handleReady}
                  className="border-2 border-black px-6 py-2 font-bold hover:bg-black hover:text-white"
                  style={{
                    fontFamily: 'Chicago, "SF Pro Display", system-ui, sans-serif',
                    fontSize: '12px',
                    boxShadow: '2px 2px 0px #999'
                  }}
                >
                  I'm Ready!
                </button>
              </div>
            )}

            {/* Waiting States */}
            {gameState?.phase === 'generating' && (
              <div className="text-center">
                <div className="text-2xl mb-4">⏳</div>
                <p style={{ fontSize: '12px' }}>Generating your image...</p>
              </div>
            )}

            {gameState?.phase === 'judging' && (
              <div className="text-center">
                <div className="text-4xl mb-4">⚖️</div>
                <p style={{ fontSize: '12px' }}>The judges are deciding...</p>
              </div>
            )}

            {gameState?.phase === 'finished' && (
              <div className="text-center">
                {gameState.winner === playerId ? (
                  <div className="text-6xl mb-4">🏆</div>
                ) : (
                  <div className="text-6xl mb-4">🤝</div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Footer Info */}
        <div className="mt-4 text-xs" style={{ fontSize: '10px' }}>
          Server: {getSocketURL()}
        </div>
      </div>
    </div>
  );
}