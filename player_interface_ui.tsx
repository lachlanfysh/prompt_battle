import React, { useState, useEffect } from 'react';

export default function PlayerInterface() {
  const [prompt, setPrompt] = useState('');
  const [timeLeft, setTimeLeft] = useState(60);
  const [gameState, setGameState] = useState('waiting'); // waiting, ready, writing, submitted, results
  const [connected, setConnected] = useState(true);
  const [playerId] = useState('Player 1');

  // Mock target challenge
  const target = "Create a majestic dragon soaring through a storm-filled sky";

  // Mock timer countdown
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
      </div>

      {/* Desktop Area */}
      <div className="p-4" style={{ minHeight: 'calc(100vh - 20px)' }}>
        {/* Main Application Window */}
        <div className="bg-white border-2 border-black" style={{
          boxShadow: '4px 4px 0px black'
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
              <span className="text-xs font-bold">Prompt Battle - {playerId}</span>
            </div>
            <div className="flex items-center relative z-10 bg-white px-1">
              <div className="w-3 h-2 border border-black bg-white mr-1 flex items-center justify-center">
                <div className={`w-0.5 h-0.5 ${connected ? 'bg-black' : 'bg-white'}`}></div>
              </div>
              <span className="text-xs">Online</span>
            </div>
          </div>

          {/* Timer Bar (when writing) */}
          {gameState === 'writing' && (
            <div className="bg-white border-b border-black p-2 text-center">
              <div className="flex justify-center items-center gap-2">
                <div className="w-3 h-3 border border-black bg-white relative">
                  <div className="absolute top-0.5 left-1 w-0.5 h-1 bg-black"></div>
                  <div className="absolute top-1 left-0.5 w-1 h-0.5 bg-black"></div>
                </div>
                <span className={`text-sm font-bold font-mono ${timeLeft <= 10 ? 'animate-pulse' : ''}`}>
                  {formatTime(timeLeft)}
                </span>
              </div>
            </div>
          )}

          {/* Main Content */}
          <div className="bg-white p-4" style={{ minHeight: '400px' }}>
            {gameState === 'waiting' && (
              <div className="text-center py-12">
                <div className="w-6 h-6 border border-black bg-white rounded-full mx-auto mb-4 relative flex items-center justify-center">
                  <div className="w-1 h-3 bg-black transform rotate-12 absolute"></div>
                  <div className="w-2 h-0.5 bg-black absolute top-1.5 left-2"></div>
                  <div className="w-2 h-0.5 bg-black absolute bottom-1 left-1"></div>
                </div>
                <div className="space-y-2">
                  <div className="text-sm font-bold">Waiting for Battle to Begin...</div>
                  <div className="text-xs">Get ready to unleash your creativity!</div>
                  <div className="mt-4 flex justify-center">
                    {[...Array(6)].map((_, i) => (
                      <div 
                        key={i} 
                        className={`w-1.5 h-1.5 border border-black mx-0.5 ${i % 2 === 0 ? 'bg-black' : 'bg-white'} animate-pulse`}
                        style={{animationDelay: `${i * 200}ms`}}
                      ></div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {gameState === 'ready' && (
              <div className="space-y-4">
                <div className="border border-black bg-gray-50 p-3" style={{
                  background: 'repeating-linear-gradient(45deg, transparent, transparent 1px, rgba(0,0,0,0.1) 1px, rgba(0,0,0,0.1) 2px)'
                }}>
                  <div className="text-xs font-bold mb-2 bg-black text-white px-1 inline-block">Your Challenge:</div>
                  <div className="text-sm leading-tight">{target}</div>
                </div>
                <div className="text-center py-6">
                  <div className="text-xl font-bold animate-pulse">Get Ready!</div>
                  <div className="text-xs mt-2">The battle will begin shortly...</div>
                </div>
              </div>
            )}

            {gameState === 'writing' && (
              <div className="space-y-3">
                {/* Challenge Display */}
                <div className="border border-black bg-gray-50 p-2" style={{
                  background: 'repeating-linear-gradient(45deg, transparent, transparent 1px, rgba(0,0,0,0.1) 1px, rgba(0,0,0,0.1) 2px)'
                }}>
                  <div className="text-xs font-bold mb-1 bg-black text-white px-1 inline-block">Your Challenge</div>
                  <div className="text-xs">{target}</div>
                </div>

                {/* Prompt Input */}
                <div className="border border-black bg-white">
                  <div className="bg-black text-white px-2 py-0.5 text-xs font-bold flex justify-between">
                    <span>Your Prompt</span>
                    <span>{prompt.length} chars</span>
                  </div>
                  <div className="border-b border-black bg-white p-1">
                    <textarea
                      value={prompt}
                      onChange={(e) => setPrompt(e.target.value)}
                      placeholder="Write your image generation prompt here...&#10;&#10;Be creative, be specific, be amazing!"
                      className="w-full h-40 p-2 border-0 resize-none focus:outline-none text-xs leading-tight bg-white"
                      style={{
                        fontFamily: 'Monaco, "Courier New", monospace'
                      }}
                    />
                  </div>
                  
                  {/* Footer */}
                  <div className="bg-gray-50 px-2 py-1 text-xs border-t border-black" style={{
                    background: 'repeating-linear-gradient(45deg, transparent, transparent 1px, rgba(0,0,0,0.1) 1px, rgba(0,0,0,0.1) 2px)'
                  }}>
                    <span className="font-bold">Tip:</span> Include style, lighting, composition details!
                  </div>
                </div>
              </div>
            )}

            {gameState === 'submitted' && (
              <div className="text-center py-16">
                <div className="mb-6">
                  {/* Classic Mac spinning cursor */}
                  <div className="w-6 h-6 border-2 border-black mx-auto relative bg-white rounded-full">
                    <div className="absolute top-0.5 left-0.5 w-0.5 h-2 bg-black animate-spin origin-bottom"></div>
                  </div>
                </div>
                <div className="text-sm font-bold mb-1">Generating Images...</div>
                <div className="text-xs">Your creative vision is coming to life!</div>
              </div>
            )}

            {gameState === 'results' && (
              <div className="text-center py-12">
                <div className="text-lg font-bold mb-2">Battle Complete!</div>
                <div className="text-xs mb-6">Check the main screen for results!</div>
                
                {/* Classic Mac OK button */}
                <div className="inline-block border-2 border-black bg-white px-6 py-1 font-bold text-xs hover:bg-gray-100 cursor-pointer" style={{
                  boxShadow: '2px 2px 0px black'
                }}>
                  OK
                </div>
              </div>
            )}
          </div>

          {/* Status Bar */}
          <div className="bg-gray-50 border-t border-black px-2 py-1 text-xs flex justify-between" style={{
            background: 'repeating-linear-gradient(45deg, transparent, transparent 1px, rgba(0,0,0,0.1) 1px, rgba(0,0,0,0.1) 2px)'
          }}>
            <span>Prompt Battle v1.0</span>
            <span>Memory: 512K</span>
          </div>
        </div>

        {/* Trash Can Icon */}
        <div className="absolute bottom-4 right-4">
          <div className="w-6 h-8 border border-black bg-white relative">
            <div className="absolute top-1 left-1 right-1 h-0.5 bg-black"></div>
            <div className="absolute top-1.5 left-1 right-1 bottom-1 border border-black bg-white"></div>
          </div>
        </div>
      </div>

      {/* Debug Controls */}
      <div className="fixed top-7 right-4 space-y-1">
        {['waiting', 'ready', 'writing', 'submitted', 'results'].map(state => (
          <button 
            key={state}
            onClick={() => setGameState(state)} 
            className="block border border-black bg-white px-2 py-0.5 text-xs font-bold hover:bg-gray-100 w-16"
            style={{boxShadow: '1px 1px 0px black'}}
          >
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