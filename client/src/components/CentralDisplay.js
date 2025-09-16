import React, { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';
import QRCode from 'qrcode';

const getSocketURL = () => {
  const protocol = window.location.protocol;
  const hostname = window.location.hostname;
  const port = process.env.NODE_ENV === 'production' ? window.location.port : '3001';
  return `${protocol}//${hostname}:${port}`;
};

// Convert OpenAI image URLs to use our proxy endpoint
const getProxiedImageUrl = (originalUrl) => {
  if (!originalUrl) return originalUrl;

  // Only proxy OpenAI URLs, leave other URLs as-is
  if (originalUrl.startsWith('https://oaidalleapiprodscus.blob.core.windows.net/')) {
    const baseUrl = process.env.NODE_ENV === 'production'
      ? window.location.origin
      : `${window.location.protocol}//${window.location.hostname}:3001`;
    return `${baseUrl}/api/proxy-image?url=${encodeURIComponent(originalUrl)}`;
  }

  return originalUrl;
};

// Flocking Birds Component
const FlockingBirds = ({ playerBoxes }) => {
  const canvasRef = useRef(null);
  const animationRef = useRef(null);
  const birdsRef = useRef([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const birds = birdsRef.current;

    // Initialize birds in multiple flocks
    if (birds.length === 0) {
      const numFlocks = 4;
      const birdsPerFlock = 8;

      for (let flock = 0; flock < numFlocks; flock++) {
        // Create flock center
        const flockCenterX = (Math.random() * 0.6 + 0.2) * canvas.width;
        const flockCenterY = (Math.random() * 0.6 + 0.2) * canvas.height;

        for (let i = 0; i < birdsPerFlock; i++) {
          birds.push({
            x: flockCenterX + (Math.random() - 0.5) * 100,
            y: flockCenterY + (Math.random() - 0.5) * 100,
            vx: (Math.random() - 0.5) * 0.8, // Slower initial speed
            vy: (Math.random() - 0.5) * 0.8,
            size: Math.random() * 4 + 6, // 2x bigger: 6-10 instead of 3-5
            flock: flock
          });
        }
      }
    }

    const resizeCanvas = () => {
      const parent = canvas.parentElement;
      if (parent) {
        canvas.width = parent.offsetWidth;
        canvas.height = parent.offsetHeight;
      }
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Update each bird
      birds.forEach(bird => {
        // Flocking behavior
        let avgX = 0, avgY = 0, avgVx = 0, avgVy = 0;
        let neighbors = 0;
        let repelX = 0, repelY = 0;

        // Check other birds
        birds.forEach(other => {
          if (other === bird) return;
          const dx = other.x - bird.x;
          const dy = other.y - bird.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          // Separation applies to all birds (avoid crowding)
          if (dist < 25) { // Too close, repel from any bird
            repelX -= dx / dist;
            repelY -= dy / dist;
          }

          // Cohesion and alignment only within same flock
          if (other.flock === bird.flock && dist < 80) { // Same flock neighbor distance
            avgX += other.x;
            avgY += other.y;
            avgVx += other.vx;
            avgVy += other.vy;
            neighbors++;
          }
        });

        // Avoid player boxes (obstacles)
        playerBoxes.forEach(box => {
          const dx = bird.x - (box.x + box.width / 2);
          const dy = bird.y - (box.y + box.height / 2);
          const dist = Math.sqrt(dx * dx + dy * dy);
          const avoidDistance = 80;

          if (dist < avoidDistance) {
            const strength = (avoidDistance - dist) / avoidDistance;
            repelX += (dx / dist) * strength * 3;
            repelY += (dy / dist) * strength * 3;
          }
        });

        // Apply flocking rules with reduced strength
        if (neighbors > 0) {
          // Alignment - slower
          bird.vx += (avgVx / neighbors - bird.vx) * 0.02;
          bird.vy += (avgVy / neighbors - bird.vy) * 0.02;

          // Cohesion - slower
          bird.vx += ((avgX / neighbors) - bird.x) * 0.003;
          bird.vy += ((avgY / neighbors) - bird.y) * 0.003;
        }

        // Add slight bias to keep flocks spread out
        const flockBias = 0.001;
        switch(bird.flock) {
          case 0: // Top-left bias
            bird.vx -= flockBias;
            bird.vy -= flockBias;
            break;
          case 1: // Top-right bias
            bird.vx += flockBias;
            bird.vy -= flockBias;
            break;
          case 2: // Bottom-left bias
            bird.vx -= flockBias;
            bird.vy += flockBias;
            break;
          case 3: // Bottom-right bias
            bird.vx += flockBias;
            bird.vy += flockBias;
            break;
        }

        // Separation - reduced
        bird.vx += repelX * 0.05;
        bird.vy += repelY * 0.05;

        // Strong boundary conditions - hard walls
        const margin = 30;
        const pushStrength = 0.3;

        if (bird.x < margin) bird.vx += pushStrength;
        if (bird.x > canvas.width - margin) bird.vx -= pushStrength;
        if (bird.y < margin) bird.vy += pushStrength;
        if (bird.y > canvas.height - margin) bird.vy -= pushStrength;

        // Limit speed to slower maximum
        const speed = Math.sqrt(bird.vx * bird.vx + bird.vy * bird.vy);
        const maxSpeed = 1.0; // Much slower
        if (speed > maxSpeed) {
          bird.vx = (bird.vx / speed) * maxSpeed;
          bird.vy = (bird.vy / speed) * maxSpeed;
        }

        // Update position
        bird.x += bird.vx;
        bird.y += bird.vy;

        // Hard boundary enforcement (keep birds strictly inside)
        const buffer = 10;
        bird.x = Math.max(buffer, Math.min(canvas.width - buffer, bird.x));
        bird.y = Math.max(buffer, Math.min(canvas.height - buffer, bird.y));

        // Draw bird
        ctx.save();
        ctx.translate(bird.x, bird.y);
        ctx.rotate(Math.atan2(bird.vy, bird.vx));
        ctx.fillStyle = '#333';
        ctx.beginPath();
        ctx.moveTo(bird.size, 0);
        ctx.lineTo(-bird.size, -bird.size/2);
        ctx.lineTo(-bird.size/2, 0);
        ctx.lineTo(-bird.size, bird.size/2);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      });

      animationRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [playerBoxes]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 pointer-events-none w-full h-full"
      style={{ zIndex: 1 }}
    />
  );
};

export default function CentralDisplay() {
  const [socket, setSocket] = useState(null);
  const [gameState, setGameState] = useState(null);
  const [prompts, setPrompts] = useState({});
  const [timer, setTimer] = useState(0);
  const [images, setImages] = useState({});
  const [qrCodes, setQrCodes] = useState({});
  const [nextPlayerNumber, setNextPlayerNumber] = useState(3);
  const [hasGeneratedNextPlayer, setHasGeneratedNextPlayer] = useState(false);
  const [gptScoring, setGptScoring] = useState(null);
  const [scoringLoading, setScoringLoading] = useState(false);
  const waitingContainerRef = useRef(null);
  const [playerBoxes, setPlayerBoxes] = useState([]);
  
  // Update player box positions for flocking birds
  useEffect(() => {
    const updatePlayerBoxes = () => {
      if (waitingContainerRef.current) {
        const containerRect = waitingContainerRef.current.getBoundingClientRect();
        setPlayerBoxes([
          { x: containerRect.width * 0.2, y: containerRect.height * 0.4, width: 250, height: 300 },
          { x: containerRect.width * 0.8 - 250, y: containerRect.height * 0.4, width: 250, height: 300 }
        ]);
      }
    };

    updatePlayerBoxes();
    window.addEventListener('resize', updatePlayerBoxes);
    return () => window.removeEventListener('resize', updatePlayerBoxes);
  }, [gameState?.phase]);

  // Generate initial QR codes
  useEffect(() => {
    const generateInitialQRCodes = async () => {
      const baseUrl = window.location.origin;
      const codes = {};
      
      for (let i = 1; i <= 2; i++) {
        try {
          const playerUrl = `${baseUrl}/player/${i}`;
          const qrDataURL = await QRCode.toDataURL(playerUrl, {
            width: 200,
            margin: 2,
            color: { dark: '#000000', light: '#FFFFFF' }
          });
          codes[i] = qrDataURL;
        } catch (error) {
          console.error(`Error generating QR code for player ${i}:`, error);
        }
      }
      setQrCodes(codes);
    };
    
    generateInitialQRCodes();
  }, []);
  
  // Socket connection with all events
  useEffect(() => {
    const socketURL = getSocketURL();
    const newSocket = io(socketURL, {
      transports: ['websocket', 'polling']
    });
    
    newSocket.on('connect', () => {
      console.log('Central Display connected');
      newSocket.emit('join-display');
    });

    newSocket.on('game-state', (state) => {
      console.log('Game state updated:', state);
      setGameState(state);
      if (state.generatedImages) {
        setImages(state.generatedImages);
      }
    });

    newSocket.on('prompt-update', ({ playerId, prompt }) => {
      setPrompts(prev => ({ ...prev, [playerId]: prompt }));
    });

    newSocket.on('battle-started', ({ duration }) => {
      setTimer(duration);
      setPrompts({});
      setImages({});
    });

    newSocket.on('timer-update', (timeLeft) => {
      setTimer(timeLeft);
    });

    newSocket.on('images-ready', (generatedImages) => {
      setImages(generatedImages);
    });

    newSocket.on('winner-selected', (winnerId) => {
      console.log('Winner selected:', winnerId);
    });

    newSocket.on('game-reset', () => {
      console.log('Game reset received, clearing display state');
      setPrompts({});
      setImages({});
      setTimer(0);
      setHasGeneratedNextPlayer(false); // Reset QR generation flag
      setGptScoring(null);
      setScoringLoading(false);
    });

    newSocket.on('gpt-scoring-result', (result) => {
      console.log('GPT scoring result received:', result);
      setGptScoring(result);
      setScoringLoading(false);
    });

    newSocket.on('gpt-scoring-error', (error) => {
      console.error('GPT scoring error:', error);
      setScoringLoading(false);
      alert(`GPT Scoring Error: ${error}`);
    });

    setSocket(newSocket);

    return () => {
      newSocket.close();
    };
  }, []);
  
  // Generate QR code for next player when someone wins (but only once per game)
  useEffect(() => {
    if (gameState?.phase === 'finished' && gameState.winner && !hasGeneratedNextPlayer) {
      const generateNextPlayerQR = async () => {
        try {
          const baseUrl = window.location.origin;
          const playerUrl = `${baseUrl}/player/${nextPlayerNumber}`;
          const qrDataURL = await QRCode.toDataURL(playerUrl, {
            width: 200,
            margin: 2,
            color: { dark: '#000000', light: '#FFFFFF' }
          });
          setQrCodes(prev => ({ ...prev, [nextPlayerNumber]: qrDataURL }));
          setHasGeneratedNextPlayer(true);
        } catch (error) {
          console.error(`Error generating QR code for player ${nextPlayerNumber}:`, error);
        }
      };
      
      generateNextPlayerQR();
    }
    
    // Reset for next round when game resets
    if (gameState?.phase === 'waiting') {
      setHasGeneratedNextPlayer(false);
      if (hasGeneratedNextPlayer) {
        setNextPlayerNumber(prev => prev + 1);
      }
    }
  }, [gameState?.phase, gameState?.winner, nextPlayerNumber, hasGeneratedNextPlayer]);

  const selectWinner = (playerId) => {
    if (socket && gameState?.phase === 'judging') {
      socket.emit('select-winner', playerId);
    }
  };

  const requestGptScoring = () => {
    if (socket && gameState?.phase === 'judging') {
      setScoringLoading(true);
      setGptScoring(null);
      socket.emit('request-gpt-scoring');
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getPhaseTitle = () => {
    switch (gameState?.phase) {
      case 'waiting':
        return 'Waiting for Players';
      case 'ready':
        return 'Get Ready!';
      case 'battling':
        return 'PROMPT BATTLE IN PROGRESS!';
      case 'generating':
        return 'Generating Images...';
      case 'judging':
        return 'Choose the Winner!';
      case 'finished':
        return `Player ${gameState?.winner} Wins!`;
      default:
        return 'Prompt Battle';
    }
  };
  
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
        <div className="ml-auto flex items-center">
          <span className="mr-2 text-xs">Central Display</span>
          <div className="w-1.5 h-1.5 bg-black"></div>
        </div>
      </div>

      {/* Desktop */}
      <div className="px-8 pt-2 pb-16" style={{ minHeight: 'calc(100vh - 20px)', position: 'relative' }}>
        {/* Main Window */}
        <div className="bg-white border-2 border-black" style={{
          boxShadow: '4px 4px 0px black',
          minHeight: 'calc(100vh - 140px)',
          marginLeft: '40px',
          marginRight: '40px'
        }}>
          {/* Window Title Bar */}
          <div className="h-4 bg-white border-b border-black flex items-center justify-between px-2 relative">
            <div className="absolute inset-0 flex flex-col justify-center">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="h-px bg-black opacity-30" style={{marginTop: '1px'}}></div>
              ))}
            </div>
            <div className="flex items-center relative z-10 bg-white px-1">
              <div className="w-2 h-2 border border-black bg-white mr-1"></div>
              <span className="text-xs font-bold">Prompt Battle - Central Display</span>
            </div>
            <div className="flex items-center gap-3 relative z-10 bg-white px-1">
              {gameState?.phase === 'battling' && (
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 border border-black bg-white relative">
                    <div className="absolute top-0 left-0.5 w-0.5 h-1 bg-black"></div>
                    <div className="absolute top-0.5 left-0 w-1 h-0.5 bg-black"></div>
                  </div>
                  <span className={`text-xs font-bold font-mono ${timer <= 10 ? 'animate-pulse' : ''}`}>
                    {formatTime(timer)}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Main Content */}
          <div className="p-4">
            {/* Game Status Header */}
            <div className="text-center mb-6">
              <h1 className="text-2xl font-bold mb-2" style={{ fontSize: '36px' }}>
                {getPhaseTitle()}
              </h1>
              
              {gameState?.target && gameState?.phase !== 'waiting' && (
                <div className="border border-black p-4 mb-4 bg-gray-100" style={{
                  boxShadow: 'inset 2px 2px 0px #999'
                }}>
                  <h2 className="font-bold mb-2" style={{ fontSize: '20px' }}>TARGET:</h2>
                  {gameState.target.type === 'image' ? (
                    <div className="flex flex-col items-center space-y-3">
                      <img 
                        src={getProxiedImageUrl(gameState.target.imageUrl)} 
                        alt="Challenge"
                        className="max-w-full max-h-72 object-contain border-2 border-gray-400"
                      />
                      <p style={{ fontSize: '18px' }} className="text-center font-medium">
                        {gameState.target.content}
                      </p>
                    </div>
                  ) : (
                    <p style={{ fontSize: '18px' }}>{gameState.target.content || gameState.target}</p>
                  )}
                </div>
              )}
            </div>

            {/* Live Prompts Display */}
            {gameState?.phase === 'battling' && (
              <div className="mb-6">
                <div className="grid grid-cols-2 gap-4 mb-6">
                  {['1', '2'].map(playerId => (
                    <div key={playerId} className="border-2 border-black p-3 bg-white" style={{
                      boxShadow: '2px 2px 0px #999'
                    }}>
                      <h3 className="font-bold mb-2 text-center" style={{ fontSize: '20px' }}>
                        Player {playerId}
                      </h3>
                      <div className="border border-black p-2 min-h-24 bg-gray-50 break-words whitespace-pre-wrap" style={{
                        boxShadow: 'inset 1px 1px 0px #999',
                        fontFamily: 'Chicago, monospace',
                        fontSize: '14px',
                        wordWrap: 'break-word',
                        overflowWrap: 'break-word'
                      }}>
                        {prompts[playerId] || 'Thinking...'}
                        {prompts[playerId] && <span className="animate-pulse">|</span>}
                      </div>
                    </div>
                  ))}
                </div>
                
                {/* Big Countdown Timer */}
                <div className="text-center mb-4">
                  <div className="border-2 border-black bg-white inline-block px-8 py-4" style={{
                    boxShadow: '4px 4px 0px black'
                  }}>
                    <div className={`font-bold font-mono ${timer <= 10 ? 'animate-pulse text-red-600' : 'text-black'}`} style={{
                      fontSize: '72px',
                      fontFamily: 'Chicago, "SF Pro Display", system-ui, monospace'
                    }}>
                      {formatTime(timer)}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Image Generation Loading */}
            {gameState?.phase === 'generating' && (
              <div className="text-center">
                <div className="text-6xl mb-4">⏳</div>
                <p style={{ fontSize: '24px' }}>Creating images...</p>
                <p style={{ fontSize: '18px' }} className="mt-2">This may take a moment</p>
              </div>
            )}

            {/* Image Display and Judging */}
            {gameState?.phase === 'judging' && (
              <>
                {/* GPT Scoring Button */}
                <div className="text-center mb-6">
                  <button
                    onClick={requestGptScoring}
                    disabled={scoringLoading}
                    className="border-2 border-black py-3 px-6 font-bold hover:bg-black hover:text-white disabled:bg-gray-300 disabled:cursor-not-allowed"
                    style={{
                      fontFamily: 'Chicago, "SF Pro Display", system-ui, sans-serif',
                      fontSize: '18px',
                      boxShadow: '4px 4px 0px #999'
                    }}
                  >
                    {scoringLoading ? '🤖 AI is Analyzing...' : '🤖 Get AI Analysis'}
                  </button>
                </div>

                {/* GPT Analysis Results */}
                {gptScoring && (
                  <div className="border-2 border-black p-4 mb-6 bg-yellow-50" style={{
                    boxShadow: '4px 4px 0px black'
                  }}>
                    <h3 className="font-bold mb-4 text-center" style={{ fontSize: '24px' }}>
                      🤖 AI Analysis Results
                    </h3>

                    {gptScoring.winner && (
                      <div className="text-center mb-4 p-3 border border-black bg-yellow-100" style={{
                        boxShadow: 'inset 2px 2px 0px #999'
                      }}>
                        <p className="font-bold" style={{ fontSize: '20px' }}>
                          AI Recommends: Player {gptScoring.winner}
                        </p>
                      </div>
                    )}

                    <div className="mb-4 p-3 border border-black bg-gray-50" style={{
                      boxShadow: 'inset 1px 1px 0px #999'
                    }}>
                      <h4 className="font-bold mb-2" style={{ fontSize: '16px' }}>Analysis:</h4>
                      <p style={{
                        fontSize: '14px',
                        fontFamily: 'Chicago, "SF Pro Display", system-ui, sans-serif',
                        wordWrap: 'break-word'
                      }}>
                        {gptScoring.analysis}
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-2 border border-black bg-gray-50" style={{
                        boxShadow: 'inset 1px 1px 0px #999'
                      }}>
                        <h4 className="font-bold mb-1" style={{ fontSize: '14px' }}>Player 1 Feedback:</h4>
                        <p style={{
                          fontSize: '12px',
                          fontFamily: 'Chicago, "SF Pro Display", system-ui, sans-serif'
                        }}>
                          {gptScoring.player1Feedback}
                        </p>
                      </div>

                      <div className="p-2 border border-black bg-gray-50" style={{
                        boxShadow: 'inset 1px 1px 0px #999'
                      }}>
                        <h4 className="font-bold mb-1" style={{ fontSize: '14px' }}>Player 2 Feedback:</h4>
                        <p style={{
                          fontSize: '12px',
                          fontFamily: 'Chicago, "SF Pro Display", system-ui, sans-serif'
                        }}>
                          {gptScoring.player2Feedback}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-6">
                  {Object.entries(images).map(([playerId, imageData]) => (
                    <div key={playerId} className="border-2 border-black p-4 bg-white" style={{
                      boxShadow: '4px 4px 0px black'
                    }}>
                      <h3 className="font-bold mb-4 text-center" style={{ fontSize: '20px' }}>
                        Player {playerId}
                        {gptScoring?.winner === playerId && (
                          <span className="ml-2 text-yellow-600">👑 AI Pick</span>
                        )}
                      </h3>

                      {imageData?.url && (
                        <div className="mb-4">
                          <img
                            src={getProxiedImageUrl(imageData.url)}
                            alt={`Player ${playerId}'s creation`}
                            className="w-full border-2 border-black"
                            style={{
                              aspectRatio: '1/1', // Fixed aspect ratio to show full square image
                              objectFit: 'contain',
                              boxShadow: '2px 2px 0px #999'
                            }}
                            onError={(e) => {
                              e.target.src = `https://via.placeholder.com/400x400/f0f0f0/999999.png?text=Image+Error`;
                            }}
                          />
                          {imageData.fallback && (
                            <p style={{ fontSize: '10px' }} className="mt-2 text-center">
                              ⚠️ Fallback image (OpenAI unavailable)
                            </p>
                          )}
                        </div>
                      )}

                      <div className="border border-black p-2 mb-4 bg-gray-100 break-words" style={{
                        boxShadow: 'inset 1px 1px 0px #999'
                      }}>
                        <h4 className="font-bold mb-1" style={{ fontSize: '14px' }}>Prompt:</h4>
                        <p style={{
                          fontSize: '12px',
                          fontFamily: 'Chicago, monospace',
                          wordWrap: 'break-word',
                          overflowWrap: 'break-word',
                          whiteSpace: 'pre-wrap'
                        }}>
                          {imageData?.prompt}
                        </p>
                      </div>

                      <button
                        onClick={() => selectWinner(playerId)}
                        className="w-full border-2 border-black py-2 px-4 font-bold hover:bg-black hover:text-white"
                        style={{
                          fontFamily: 'Chicago, "SF Pro Display", system-ui, sans-serif',
                          fontSize: '16px',
                          boxShadow: '2px 2px 0px #999'
                        }}
                      >
                        Choose Winner!
                      </button>
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* Winner Celebration */}
            {gameState?.phase === 'finished' && gameState.winner && (
              <div className="text-center">
                <div className="text-8xl mb-4">🏆</div>
                <h2 className="font-bold mb-6" style={{ fontSize: '32px' }}>
                  PLAYER {gameState.winner} WINS!
                </h2>
                
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 max-w-4xl mx-auto">
                  {/* Winning Creation */}
                  {images[gameState.winner] && (
                    <div>
                      <h3 className="font-bold mb-4" style={{ fontSize: '18px' }}>Winning Creation:</h3>
                      <img 
                        src={getProxiedImageUrl(images[gameState.winner].url)}
                        alt="Winning creation"
                        className="w-full border-4 border-black mb-4"
                        style={{
                          aspectRatio: '1/1',
                          objectFit: 'contain',
                          boxShadow: '4px 4px 0px black'
                        }}
                      />
                      <div className="border border-black p-3 bg-gray-100 break-words" style={{
                        boxShadow: 'inset 2px 2px 0px #999'
                      }}>
                        <p style={{ 
                          fontSize: '11px', 
                          fontFamily: 'Chicago, monospace',
                          wordWrap: 'break-word',
                          overflowWrap: 'break-word',
                          whiteSpace: 'pre-wrap'
                        }}>
                          {images[gameState.winner].prompt}
                        </p>
                      </div>
                    </div>
                  )}
                  
                  {/* Next Player QR Code */}
                  <div className="border-2 border-black p-6 bg-white" style={{
                    boxShadow: '4px 4px 0px #999'
                  }}>
                    <h3 className="font-bold mb-4" style={{ fontSize: '18px' }}>
                      Next Challenger
                    </h3>
                    <h4 className="font-bold mb-4" style={{ fontSize: '24px' }}>
                      Player {nextPlayerNumber - 1}
                    </h4>
                    
                    <div className="mb-4">
                      {qrCodes[nextPlayerNumber - 1] ? (
                        <img 
                          src={qrCodes[nextPlayerNumber - 1]} 
                          alt={`QR Code for Player ${nextPlayerNumber - 1}`}
                          className="mx-auto border-2 border-black bg-white"
                          style={{
                            width: '180px',
                            height: '180px',
                            boxShadow: '2px 2px 0px #999'
                          }}
                        />
                      ) : (
                        <div 
                          className="mx-auto border-2 border-black bg-gray-100 flex items-center justify-center"
                          style={{
                            width: '180px',
                            height: '180px',
                            boxShadow: '2px 2px 0px #999'
                          }}
                        >
                          <span style={{ fontSize: '14px' }}>Loading QR...</span>
                        </div>
                      )}
                    </div>
                    
                    <p style={{ fontSize: '14px' }} className="mb-3">
                      Scan to challenge the winner!
                    </p>
                    
                    <div className="border border-black p-2 bg-gray-100" style={{
                      boxShadow: 'inset 1px 1px 0px #999'
                    }}>
                      <p style={{ fontSize: '10px', fontFamily: 'Chicago, monospace' }}>
                        {window.location.origin}/player/{nextPlayerNumber - 1}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Waiting for Players - QR codes */}
            {(!gameState || gameState.phase === 'waiting') && (
              <div ref={waitingContainerRef} className="text-center relative min-h-screen">
                {/* Flocking Birds Animation */}
                <FlockingBirds playerBoxes={playerBoxes} />

                <div className="text-6xl mb-8 relative z-10 pt-20">⏳</div>
                <p style={{ fontSize: '24px' }} className="mb-8 relative z-10">Scan QR codes to join the battle!</p>

                <div className="grid grid-cols-2 gap-8 max-w-2xl mx-auto relative z-10">
                  {[1, 2].map(playerId => (
                    <div key={playerId} className="border-2 border-black p-6 bg-white" style={{
                      boxShadow: '4px 4px 0px #999'
                    }}>
                      <h3 className="font-bold mb-4" style={{ fontSize: '24px' }}>
                        Player {playerId}
                      </h3>
                      
                      <div className="mb-4">
                        {qrCodes[playerId] ? (
                          <img 
                            src={qrCodes[playerId]} 
                            alt={`QR Code for Player ${playerId}`}
                            className="mx-auto border-2 border-black"
                            style={{
                              width: '150px',
                              height: '150px',
                              boxShadow: '2px 2px 0px #999'
                            }}
                          />
                        ) : (
                          <div 
                            className="mx-auto border-2 border-black bg-gray-100 flex items-center justify-center"
                            style={{
                              width: '150px',
                              height: '150px',
                              boxShadow: '2px 2px 0px #999'
                            }}
                          >
                            <span style={{ fontSize: '12px' }}>Loading QR...</span>
                          </div>
                        )}
                      </div>
                      
                      <div className="mb-3">
                        <p style={{ fontSize: '18px' }} className="font-bold">
                          Status: {gameState?.players?.[playerId]?.connected ? '✓ Connected' : '○ Waiting...'}
                        </p>
                      </div>
                      
                      <div className="border border-black p-2 bg-gray-100" style={{
                        boxShadow: 'inset 1px 1px 0px #999'
                      }}>
                        <p style={{ fontSize: '10px', fontFamily: 'Chicago, monospace' }}>
                          {window.location.origin}/player/{playerId}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* System 6 Style Desktop Icons - Bottom Right */}
        <div className="absolute bottom-4 right-8 flex gap-8">
          {/* KymChat Icon */}
          <div className="flex flex-col items-center cursor-pointer">
            <div className="w-12 h-12 flex items-center justify-center relative">
              <div className="relative">
                <div className="w-10 h-6 bg-white border-2 border-black rounded-lg relative">
                  <div className="absolute top-1 left-1 w-1 h-1 bg-black rounded-full"></div>
                  <div className="absolute top-1 left-3 w-1 h-1 bg-black rounded-full"></div>
                  <div className="absolute top-1 left-5 w-1 h-1 bg-black rounded-full"></div>
                </div>
                <div className="absolute top-4 left-3 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-black"></div>
                <div className="absolute top-3 left-3 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-white"></div>
              </div>
            </div>
            <div className="bg-white px-2 py-0.5 mt-1 text-black font-bold" style={{
              fontFamily: 'Chicago, "SF Pro Display", system-ui, sans-serif',
              fontSize: '12px'
            }}>
              KymChat
            </div>
          </div>

          {/* Sentinel Icon */}
          <div className="flex flex-col items-center cursor-pointer">
            <div className="w-12 h-12 flex items-center justify-center relative">
              <div className="relative">
                <div className="w-8 h-9 bg-white border-2 border-black relative" style={{
                  borderRadius: '0 0 50% 50%'
                }}>
                  <div className="absolute top-2 left-1.5 w-5 h-2 bg-black rounded-full"></div>
                  <div className="absolute top-2.5 left-2.5 w-3 h-1 bg-white rounded-full"></div>
                  <div className="absolute top-2.5 left-3.5 w-1 h-1 bg-black rounded-full"></div>
                </div>
              </div>
            </div>
            <div className="bg-white px-2 py-0.5 mt-1 text-black font-bold" style={{
              fontFamily: 'Chicago, "SF Pro Display", system-ui, sans-serif',
              fontSize: '12px'
            }}>
              Sentinel
            </div>
          </div>

          {/* CRM Icon */}
          <div className="flex flex-col items-center cursor-pointer">
            <div className="w-12 h-12 flex items-center justify-center relative">
              <div className="relative">
                <div className="w-9 h-7 bg-white border-2 border-black relative">
                  <div className="absolute top-1 left-1 right-2 h-px bg-black"></div>
                  <div className="absolute top-2.5 left-1 right-2 h-px bg-black"></div>
                  <div className="absolute top-4 left-1 right-2 h-px bg-black"></div>
                  <div className="absolute top-1 left-2 w-px bottom-1 bg-black"></div>
                  <div className="absolute top-1 left-4 w-px bottom-1 bg-black"></div>
                  <div className="absolute top-0.5 right-2.5 w-1 h-1 bg-black rounded-full"></div>
                  <div className="absolute top-1.5 right-2 w-2 h-1.5 bg-black" style={{
                    borderRadius: '50% 50% 0 0'
                  }}></div>
                </div>
              </div>
            </div>
            <div className="bg-white px-2 py-0.5 mt-1 text-black font-bold" style={{
              fontFamily: 'Chicago, "SF Pro Display", system-ui, sans-serif',
              fontSize: '12px'
            }}>
              CRM
            </div>
          </div>

          {/* Retain Icon */}
          <div className="flex flex-col items-center cursor-pointer">
            <div className="w-12 h-12 flex items-center justify-center relative">
              <div className="relative">
                <div className="w-8 h-8 border-2 border-black rounded-full bg-white relative">
                  <div className="absolute top-1.5 left-2 w-2 h-px bg-black"></div>
                  <div className="absolute top-2.5 left-1.5 w-px h-2 bg-black"></div>
                  <div className="absolute bottom-2.5 right-1.5 w-px h-2 bg-black"></div>
                  <div className="absolute bottom-1.5 left-2 w-2 h-px bg-black"></div>
                  <div className="absolute top-1 left-1.5 w-1 h-1 bg-black transform rotate-45"></div>
                  <div className="absolute bottom-1 right-1.5 w-1 h-1 bg-black transform rotate-45"></div>
                </div>
              </div>
            </div>
            <div className="bg-white px-2 py-0.5 mt-1 text-black font-bold" style={{
              fontFamily: 'Chicago, "SF Pro Display", system-ui, sans-serif',
              fontSize: '12px'
            }}>
              Retain
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}