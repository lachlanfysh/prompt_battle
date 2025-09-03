import React, { useState, useEffect } from 'react';
import io from 'socket.io-client';
import QRCode from 'qrcode';

const getSocketURL = () => {
  const protocol = window.location.protocol;
  const hostname = window.location.hostname;
  const port = process.env.NODE_ENV === 'production' ? window.location.port : '3001';
  return `${protocol}//${hostname}:${port}`;
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
              <h1 className="text-2xl font-bold mb-2" style={{ fontSize: '24px' }}>
                {getPhaseTitle()}
              </h1>
              
              {gameState?.target && gameState?.phase !== 'waiting' && (
                <div className="border border-black p-4 mb-4 bg-gray-100" style={{
                  boxShadow: 'inset 2px 2px 0px #999'
                }}>
                  <h2 className="font-bold mb-2" style={{ fontSize: '14px' }}>TARGET:</h2>
                  {gameState.target.type === 'image' ? (
                    <div className="flex flex-col items-center space-y-3">
                      <img 
                        src={gameState.target.imageUrl} 
                        alt="Challenge"
                        className="max-w-full max-h-72 object-contain border-2 border-gray-400"
                      />
                      <p style={{ fontSize: '12px' }} className="text-center font-medium">
                        {gameState.target.content}
                      </p>
                    </div>
                  ) : (
                    <p style={{ fontSize: '12px' }}>{gameState.target.content || gameState.target}</p>
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
                      <h3 className="font-bold mb-2 text-center" style={{ fontSize: '14px' }}>
                        Player {playerId}
                      </h3>
                      <div className="border border-black p-2 min-h-24 bg-gray-50 break-words whitespace-pre-wrap" style={{
                        boxShadow: 'inset 1px 1px 0px #999',
                        fontFamily: 'Chicago, monospace',
                        fontSize: '10px',
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
                      fontSize: '48px',
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
                <p style={{ fontSize: '16px' }}>Creating images...</p>
                <p style={{ fontSize: '12px' }} className="mt-2">This may take a moment</p>
              </div>
            )}

            {/* Image Display and Judging */}
            {gameState?.phase === 'judging' && (
              <div className="grid grid-cols-2 gap-6">
                {Object.entries(images).map(([playerId, imageData]) => (
                  <div key={playerId} className="border-2 border-black p-4 bg-white" style={{
                    boxShadow: '4px 4px 0px black'
                  }}>
                    <h3 className="font-bold mb-4 text-center" style={{ fontSize: '16px' }}>
                      Player {playerId}
                    </h3>
                    
                    {imageData?.url && (
                      <div className="mb-4">
                        <img 
                          src={imageData.url} 
                          alt={`Player ${playerId}'s creation`}
                          className="w-full border-2 border-black"
                          style={{
                            aspectRatio: '1/1',
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
                      <h4 className="font-bold mb-1" style={{ fontSize: '10px' }}>Prompt:</h4>
                      <p style={{ 
                        fontSize: '9px', 
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
                        fontSize: '12px',
                        boxShadow: '2px 2px 0px #999'
                      }}
                    >
                      Choose Winner!
                    </button>
                  </div>
                ))}
              </div>
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
                        src={images[gameState.winner].url}
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
              <div className="text-center">
                <div className="text-6xl mb-8">⏳</div>
                <p style={{ fontSize: '18px' }} className="mb-8">Scan QR codes to join the battle!</p>
                
                <div className="grid grid-cols-2 gap-8 max-w-2xl mx-auto">
                  {[1, 2].map(playerId => (
                    <div key={playerId} className="border-2 border-black p-6 bg-white" style={{
                      boxShadow: '4px 4px 0px #999'
                    }}>
                      <h3 className="font-bold mb-4" style={{ fontSize: '18px' }}>
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
                        <p style={{ fontSize: '14px' }} className="font-bold">
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