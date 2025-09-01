import React, { useState, useEffect } from 'react';

export default function CentralDisplay() {
  const [gameState, setGameState] = useState('writing');
  const [timeLeft, setTimeLeft] = useState(45);
  const [player1Prompt, setPlayer1Prompt] = useState('');
  const [player2Prompt, setPlayer2Prompt] = useState('');
  const [winner, setWinner] = useState(null);

  const target = "Create a majestic dragon soaring through a storm-filled sky";
  const player1Image = "https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=512&h=512&fit=crop";
  const player2Image = "https://images.unsplash.com/photo-1518709268805-4e9042af2176?w=512&h=512&fit=crop";

  // Mock typing simulation
  useEffect(() => {
    if (gameState === 'writing') {
      const mockPrompts = {
        player1: "A magnificent dragon with scales that shimmer like emeralds, wings spread wide against a dramatic stormy sky filled with purple lightning, flying majestically through swirling dark clouds, digital art, epic fantasy style",
        player2: "Epic fantasy dragon soaring through a tempestuous sky, wings outstretched, lightning crackling around it, storm clouds swirling, majestic and powerful, cinematic lighting, detailed scales"
      };
      
      const interval = setInterval(() => {
        if (player1Prompt.length < mockPrompts.player1.length) {
          setPlayer1Prompt(mockPrompts.player1.substring(0, player1Prompt.length + 1));
        }
        if (player2Prompt.length < mockPrompts.player2.length) {
          setPlayer2Prompt(mockPrompts.player2.substring(0, player2Prompt.length + 1));
        }
      }, 50);
      return () => clearInterval(interval);
    }
  }, [gameState, player1Prompt, player2Prompt]);

  // Timer countdown
  useEffect(() => {
    if (gameState === 'writing' && timeLeft > 0) {
      const timer = setTimeout(() => setTimeLeft(timeLeft - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [timeLeft, gameState]);

  const formatTime = (seconds) => {
    return `${Math.floor(seconds / 60)}:${(seconds % 60).toString().padStart(2, '0')}`;
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
      <div className="p-2" style={{ minHeight: 'calc(100vh - 20px)' }}>
        {/* Main Window */}
        <div className="bg-white border-2 border-black w-full" style={{
          boxShadow: '4px 4px 0px black',
          minHeight: 'calc(100vh - 28px)'
        }}>
          {/* Window Title Bar */}
          <div className="h-4 bg-white border-b border-black flex items-center justify-between px-2 relative">
            {/* Horizontal lines pattern */}
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
              {gameState === 'writing' && (
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 border border-black bg-white relative">
                    <div className="absolute top-0 left-0.5 w-0.5 h-1 bg-black"></div>
                    <div className="absolute top-0.5 left-0 w-1 h-0.5 bg-black"></div>
                  </div>
                  <span className={`text-xs font-bold font-mono ${timeLeft <= 10 ? 'animate-pulse' : ''}`}>
                    {formatTime(timeLeft)}
                  </span>
                </div>
              )}
              <div className="text-xs flex items-center">
                <div className="w-1.5 h-1.5 bg-black mr-1"></div>
                LIVE
              </div>
            </div>
          </div>

          {/* Challenge Banner */}
          {target && (
            <div className="bg-black text-white border-b border-black p-2">
              <div className="text-xs font-bold mb-0.5">Target Challenge:</div>
              <div className="text-sm">{target}</div>
            </div>
          )}

          {/* Content Area */}
          <div className="bg-white p-3" style={{ minHeight: '500px' }}>
            {gameState === 'waiting' && (
              <div className="text-center py-16">
                <div className="w-8 h-8 border border-black bg-white rounded-full mx-auto mb-4 relative flex items-center justify-center">
                  <div className="w-1.5 h-4 bg-black transform rotate-12 absolute"></div>
                  <div className="w-2.5 h-0.5 bg-black absolute top-2 left-2"></div>
                  <div className="w-2.5 h-0.5 bg-black absolute bottom-1.5 left-1.5"></div>
                </div>
                <div className="text-lg font-bold mb-2">Waiting for Contestants...</div>
                <div className="text-sm mb-4">The battle is about to begin!</div>
                <div className="flex justify-center">
                  {[...Array(8)].map((_, i) => (
                    <div key={i} className={`w-1.5 h-1.5 border border-black mx-0.5 ${i % 2 === 0 ? 'bg-black' : 'bg-white'} animate-pulse`} style={{animationDelay: `${i * 200}ms`}}></div>
                  ))}
                </div>
              </div>
            )}

            {gameState === 'ready' && (
              <div className="text-center py-16">
                <div className="text-4xl mb-4 font-bold">* * *</div>
                <div className="text-3xl font-bold mb-4 animate-pulse">Get Ready!</div>
                <div className="text-sm">Battle starts in moments...</div>
              </div>
            )}

            {gameState === 'writing' && (
              <div className="grid grid-cols-2 gap-3 mt-2">
                {/* Player 1 */}
                <div className="border border-black bg-white" style={{boxShadow: '2px 2px 0px black'}}>
                  <div className="h-3 bg-white border-b border-black flex items-center px-1 relative">
                    <div className="absolute inset-0 flex flex-col justify-center">
                      {[...Array(4)].map((_, i) => (
                        <div key={i} className="h-px bg-black opacity-30" style={{marginTop: '0.5px'}}></div>
                      ))}
                    </div>
                    <div className="w-1.5 h-1.5 bg-black mr-1 animate-pulse relative z-10 bg-white px-0.5"></div>
                    <span className="text-xs font-bold relative z-10 bg-white px-0.5">Player 1</span>
                    <span className="text-xs ml-auto relative z-10 bg-white px-0.5">typing...</span>
                  </div>
                  <div className="bg-gray-50 p-2 h-40 overflow-y-auto text-xs leading-tight" style={{
                    fontFamily: 'Monaco, "Courier New", monospace',
                    background: 'repeating-linear-gradient(45deg, transparent, transparent 1px, rgba(0,0,0,0.05) 1px, rgba(0,0,0,0.05) 2px)'
                  }}>
                    {player1Prompt}<span className="animate-blink">|</span>
                  </div>
                </div>

                {/* Player 2 */}
                <div className="border border-black bg-white" style={{boxShadow: '2px 2px 0px black'}}>
                  <div className="h-3 bg-white border-b border-black flex items-center px-1 relative">
                    <div className="absolute inset-0 flex flex-col justify-center">
                      {[...Array(4)].map((_, i) => (
                        <div key={i} className="h-px bg-black opacity-30" style={{marginTop: '0.5px'}}></div>
                      ))}
                    </div>
                    <div className="w-1.5 h-1.5 bg-black mr-1 animate-pulse relative z-10 bg-white px-0.5"></div>
                    <span className="text-xs font-bold relative z-10 bg-white px-0.5">Player 2</span>
                    <span className="text-xs ml-auto relative z-10 bg-white px-0.5">typing...</span>
                  </div>
                  <div className="bg-gray-50 p-2 h-40 overflow-y-auto text-xs leading-tight" style={{
                    fontFamily: 'Monaco, "Courier New", monospace',
                    background: 'repeating-linear-gradient(45deg, transparent, transparent 1px, rgba(0,0,0,0.05) 1px, rgba(0,0,0,0.05) 2px)'
                  }}>
                    {player2Prompt}<span className="animate-blink">|</span>
                  </div>
                </div>
              </div>
            )}

            {gameState === 'generating' && (
              <div className="text-center py-16">
                <div className="flex justify-center gap-6 mb-6">
                  <div className="w-8 h-8 border-2 border-black relative bg-white rounded-full">
                    <div className="absolute top-1 left-1 w-0.5 h-2 bg-black animate-spin origin-bottom"></div>
                  </div>
                  <div className="w-8 h-8 border-2 border-black relative bg-white rounded-full">
                    <div className="absolute top-1 left-1 w-0.5 h-2 bg-black animate-spin origin-bottom" style={{animationDelay: '0.5s'}}></div>
                  </div>
                </div>
                <div className="text-lg font-bold mb-2">Generating Masterpieces...</div>
                <div className="text-sm">AI is bringing visions to life!</div>
              </div>
            )}

            {gameState === 'results' && (
              <div>
                <div className="grid grid-cols-2 gap-4 mb-6">
                  {/* Player 1 Result */}
                  <div className={`border-2 ${winner === 1 ? 'border-black bg-gray-50' : 'border-gray-400 bg-white'} transition-all duration-500 ${winner === 1 ? 'scale-105' : ''}`} style={{
                    boxShadow: winner === 1 ? '4px 4px 0px black' : '2px 2px 0px gray'
                  }}>
                    <div className="h-3 bg-white border-b border-black flex items-center px-1 relative">
                      <div className="absolute inset-0 flex flex-col justify-center">
                        {[...Array(4)].map((_, i) => (
                          <div key={i} className="h-px bg-black opacity-30" style={{marginTop: '0.5px'}}></div>
                        ))}
                      </div>
                      <span className="text-xs font-bold relative z-10 bg-white px-0.5">Player 1</span>
                      {winner === 1 && (
                        <div className="ml-auto w-3 h-2 border border-black bg-white relative z-10">
                          <div className="absolute top-0 left-0.5 w-0.5 h-0.5 bg-black"></div>
                          <div className="absolute top-0 left-1 w-0.5 h-1.5 bg-black"></div>
                          <div className="absolute top-0 left-1.5 w-0.5 h-0.5 bg-black"></div>
                        </div>
                      )}
                    </div>
                    <div className="p-2">
                      <div className="border border-black bg-gray-100 p-1 mb-2">
                        <img src={player1Image} alt="Player 1" className="w-full aspect-square object-cover" />
                      </div>
                      <div className="bg-gray-50 border border-gray-400 p-1 mb-2 text-xs h-12 overflow-y-auto" style={{
                        fontFamily: 'Monaco, "Courier New", monospace',
                        background: 'repeating-linear-gradient(45deg, transparent, transparent 1px, rgba(0,0,0,0.05) 1px, rgba(0,0,0,0.05) 2px)'
                      }}>
                        {player1Prompt}
                      </div>
                      {!winner && (
                        <button onClick={() => setWinner(1)} className="w-full border-2 border-black bg-white hover:bg-gray-100 font-bold py-1 px-2 text-xs" style={{boxShadow: '1px 1px 0px black'}}>
                          Crown the Winner!
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Player 2 Result */}
                  <div className={`border-2 ${winner === 2 ? 'border-black bg-gray-50' : 'border-gray-400 bg-white'} transition-all duration-500 ${winner === 2 ? 'scale-105' : ''}`} style={{
                    boxShadow: winner === 2 ? '4px 4px 0px black' : '2px 2px 0px gray'
                  }}>
                    <div className="h-3 bg-white border-b border-black flex items-center px-1 relative">
                      <div className="absolute inset-0 flex flex-col justify-center">
                        {[...Array(4)].map((_, i) => (
                          <div key={i} className="h-px bg-black opacity-30" style={{marginTop: '0.5px'}}></div>
                        ))}
                      </div>
                      <span className="text-xs font-bold relative z-10 bg-white px-0.5">Player 2</span>
                      {winner === 2 && (
                        <div className="ml-auto w-3 h-2 border border-black bg-white relative z-10">
                          <div className="absolute top-0 left-0.5 w-0.5 h-0.5 bg-black"></div>
                          <div className="absolute top-0 left-1 w-0.5 h-1.5 bg-black"></div>
                          <div className="absolute top-0 left-1.5 w-0.5 h-0.5 bg-black"></div>
                        </div>
                      )}
                    </div>
                    <div className="p-2">
                      <div className="border border-black bg-gray-100 p-1 mb-2">
                        <img src={player2Image} alt="Player 2" className="w-full aspect-square object-cover" />
                      </div>
                      <div className="bg-gray-50 border border-gray-400 p-1 mb-2 text-xs h-12 overflow-y-auto" style={{
                        fontFamily: 'Monaco, "Courier New", monospace',
                        background: 'repeating-linear-gradient(45deg, transparent, transparent 1px, rgba(0,0,0,0.05) 1px, rgba(0,0,0,0.05) 2px)'
                      }}>
                        {player2Prompt}
                      </div>
                      {!winner && (
                        <button onClick={() => setWinner(2)} className="w-full border-2 border-black bg-white hover:bg-gray-100 font-bold py-1 px-2 text-xs" style={{boxShadow: '1px 1px 0px black'}}>
                          Crown the Winner!
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Winner Celebration */}
                {winner && (
                  <div className="text-center py-6 border-2 border-black bg-gray-50" style={{
                    background: 'repeating-linear-gradient(45deg, transparent, transparent 2px, rgba(0,0,0,0.1) 2px, rgba(0,0,0,0.1) 4px)'
                  }}>
                    <div className="text-4xl mb-3 font-bold">* * *</div>
                    <div className="text-2xl font-bold mb-3">Player {winner} Wins!</div>
                    <div className="text-sm mb-4">Incredible creativity and skill!</div>
                    <button onClick={() => {setWinner(null); setGameState('waiting'); setPlayer1Prompt(''); setPlayer2Prompt(''); setTimeLeft(60);}} className="border-2 border-black bg-white hover:bg-gray-100 font-bold py-2 px-6 text-sm" style={{boxShadow: '2px 2px 0px black'}}>
                      New Battle
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Status Bar */}
          <div className="bg-gray-50 border-t border-black px-2 py-1 text-xs flex justify-between" style={{
            background: 'repeating-linear-gradient(45deg, transparent, transparent 1px, rgba(0,0,0,0.05) 1px, rgba(0,0,0,0.05) 2px)'
          }}>
            <span>Prompt Battle Central Display v1.0</span>
            <div className="flex items-center gap-3">
              <span>State: {gameState.toUpperCase()}</span>
              <span>Memory: 1024K</span>
            </div>
          </div>
        </div>
      </div>

      {/* Debug Controls */}
      <div className="fixed top-7 right-4 space-y-2">
        {['waiting', 'writing', 'generating', 'results'].map(state => (
          <button key={state} onClick={() => setGameState(state)} className="block border border-black bg-white hover:bg-gray-100 px-2 py-1 text-xs font-bold w-20" style={{boxShadow: '1px 1px 0px black'}}>
            {state.charAt(0).toUpperCase() + state.slice(1)}
          </button>
        ))}
      </div>

      <style jsx>{`
        @import url('https://fonts.googleapis.com/css2?family=Chicago:wght@400;700&display=swap');
        @keyframes blink {
          0%, 50% { opacity: 1; }
          51%, 100% { opacity: 0; }
        }
        .animate-blink {
          animation: blink 1s infinite;
        }
      `}</style>
    </div>
  );
}