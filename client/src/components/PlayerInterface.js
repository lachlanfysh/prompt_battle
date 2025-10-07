import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import io from 'socket.io-client';
import { getSocketURL, getProxiedImageUrl } from '../utils/network';

export default function PlayerInterface({ playerId }) {
  const [socket, setSocket] = useState(null);
  const [prompt, setPrompt] = useState('');
  const [gameState, setGameState] = useState(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState(null);
  const [timer, setTimer] = useState(0);
  const [bracketState, setBracketState] = useState({
    bracket: null,
    currentMatch: null,
    eliminatedPlayers: [],
    champion: null
  });
  const previousPhaseRef = useRef();
  const playerKey = String(playerId);

  const standings = useMemo(() => {
    if (!gameState?.scores) return [];
    return Object.entries(gameState.scores)
      .map(([id, score]) => ({
        playerId: id,
        score,
        connected: !!gameState.players?.[id]?.connected
      }))
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return Number(a.playerId) - Number(b.playerId);
      });
  }, [gameState?.scores, gameState?.players]);

  const playerScore = gameState?.scores?.[playerKey] || 0;
  const playerRank = standings.findIndex(entry => entry.playerId === playerKey) + 1;
  const roundGoal = gameState?.competitionConfig?.roundLimit || null;
  const pointGoal = gameState?.competitionConfig?.pointLimit || null;
  const roundsPlayed = gameState?.roundsPlayed || 0;
  const currentRoundNumber = gameState?.competitionActive
    ? (gameState.roundNumber || roundsPlayed + 1)
    : roundsPlayed;
  const leaderScore = standings[0]?.score || 0;
  const roundProgress = roundGoal ? Math.min(roundsPlayed / roundGoal, 1) : 0;
  const pointProgress = pointGoal ? Math.min(leaderScore / pointGoal, 1) : 0;
  const showCompetitionStats = standings.length > 0 || gameState?.competitionActive || !!roundGoal || !!pointGoal;

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

    const handleBracketUpdated = ({ bracket, currentMatch, eliminatedPlayers }) => {
      setBracketState(prev => ({
        bracket: typeof bracket !== 'undefined' ? bracket : prev.bracket,
        currentMatch: typeof currentMatch !== 'undefined' ? currentMatch : prev.currentMatch,
        eliminatedPlayers: Array.isArray(eliminatedPlayers)
          ? eliminatedPlayers.map(id => String(id))
          : prev.eliminatedPlayers,
        champion: prev.champion
      }));
    };

    const handleBracketFinished = ({ bracket, champion }) => {
      setBracketState({
        bracket: bracket ?? null,
        currentMatch: null,
        eliminatedPlayers: Array.isArray(bracket?.eliminatedPlayers)
          ? bracket.eliminatedPlayers.map(id => String(id))
          : [],
        champion: champion != null ? String(champion) : null
      });
    };

    newSocket.on('bracket-updated', handleBracketUpdated);
    newSocket.on('bracket-finished', handleBracketFinished);

    newSocket.on('battle-started', ({ duration }) => {
      setTimer(duration);
      setPrompt('');
    });

    newSocket.on('timer-update', (timeLeft) => {
      setTimer(timeLeft);
    });

    newSocket.on('game-reset', () => {
      console.log('Game reset received, clearing local state');
      setPrompt(''); // Clear the prompt input
      setTimer(0);
    });

    newSocket.on('connect_error', (err) => {
      console.error('Connection error:', err);
      setError('Failed to connect to server');
      setConnected(false);
    });

    setSocket(newSocket);

    return () => {
      newSocket.off('bracket-updated', handleBracketUpdated);
      newSocket.off('bracket-finished', handleBracketFinished);
      newSocket.close();
    };
  }, [playerId]);

  useEffect(() => {
    const previousPhase = previousPhaseRef.current;
    const currentPhase = gameState?.phase;

    if (currentPhase && currentPhase !== previousPhase) {
      if (currentPhase === 'ready' || currentPhase === 'waiting') {
        setPrompt('');
      }
    }

    previousPhaseRef.current = currentPhase;
  }, [gameState?.phase]);

  useEffect(() => {
    if (!gameState) return;

    setBracketState(prev => {
      const hasBracket = Object.prototype.hasOwnProperty.call(gameState, 'bracket');
      const hasCurrentMatch = Object.prototype.hasOwnProperty.call(gameState, 'currentMatch');
      const hasEliminated = Object.prototype.hasOwnProperty.call(gameState, 'eliminatedPlayers');

      const nextBracket = hasBracket ? gameState.bracket : prev.bracket;
      const nextEliminated = Array.isArray(gameState.eliminatedPlayers)
        ? gameState.eliminatedPlayers.map(id => String(id))
        : (hasEliminated ? [] : prev.eliminatedPlayers);
      const nextChampion = gameState.winner != null
        ? String(gameState.winner)
        : (hasBracket && !gameState.bracket ? null : prev.champion);

      return {
        bracket: nextBracket,
        currentMatch: hasCurrentMatch ? gameState.currentMatch : prev.currentMatch,
        eliminatedPlayers: nextEliminated,
        champion: nextChampion
      };
    });
  }, [gameState]);

  const DEFAULT_ROUND_LABELS = useMemo(() => ([
    { players: 2, label: 'Final' },
    { players: 4, label: 'Semifinals' },
    { players: 8, label: 'Quarterfinals' },
    { players: 16, label: 'Round of 16' },
    { players: 32, label: 'Round of 32' },
    { players: 64, label: 'Round of 64' }
  ]), []);

  const getRoundLabel = useCallback((round, roundIndex, totalRounds) => {
    if (round?.name) {
      return round.name;
    }

    const matchCount = Array.isArray(round?.matches) ? round.matches.length : 0;
    const playerCount = matchCount * 2;
    const mappedLabel = DEFAULT_ROUND_LABELS.find(entry => entry.players === playerCount);
    if (mappedLabel) {
      return mappedLabel.label;
    }

    if (totalRounds - roundIndex === 1) {
      return 'Final';
    }
    if (totalRounds - roundIndex === 2) {
      return 'Semifinals';
    }

    return `Round ${roundIndex + 1}`;
  }, [DEFAULT_ROUND_LABELS]);

  const bracketRounds = useMemo(() => (
    Array.isArray(bracketState.bracket?.rounds) ? bracketState.bracket.rounds : []
  ), [bracketState.bracket]);

  const isKnockoutMode = (gameState?.competitionMode === 'knockout') || bracketRounds.length > 0;

  const eliminatedSet = useMemo(() => new Set(
    Array.isArray(bracketState.eliminatedPlayers)
      ? bracketState.eliminatedPlayers.map(id => String(id))
      : []
  ), [bracketState.eliminatedPlayers]);

  const isPlayerEliminated = eliminatedSet.has(playerKey);

  const playerBracketMatches = useMemo(() => {
    if (!bracketRounds.length) return { nextMatch: null, lastCompleted: null };

    let nextMatch = null;
    let lastCompleted = null;

    bracketRounds.forEach((round, roundIndex) => {
      const matches = Array.isArray(round?.matches) ? round.matches : [];
      matches.forEach((match, matchIndex) => {
        if (!Array.isArray(match?.players)) return;
        const containsPlayer = match.players.some(p => String(p) === playerKey);
        if (!containsPlayer) return;

        const descriptor = { round, roundIndex, match, matchIndex };

        if (match.status === 'completed') {
          if (!lastCompleted || roundIndex >= lastCompleted.roundIndex) {
            lastCompleted = descriptor;
          }
        } else if (!nextMatch) {
          nextMatch = descriptor;
        }
      });
    });

    return { nextMatch, lastCompleted };
  }, [bracketRounds, playerKey]);

  const normalizeRoundLabel = useCallback((label) => {
    if (!label) return '';
    if (/Finals$/i.test(label)) {
      return label.replace(/Finals$/i, 'Final');
    }
    return label;
  }, []);

  const playerBracketPath = useMemo(() => {
    if (!isKnockoutMode || (!playerBracketMatches.nextMatch && !playerBracketMatches.lastCompleted)) {
      return null;
    }

    const totalRounds = bracketRounds.length;
    const makeOpponentLabel = (match) => {
      if (!Array.isArray(match?.players)) return 'TBD';
      const opponent = match.players
        .map(p => (p != null ? String(p) : null))
        .find(id => id && id !== playerKey);
      return opponent ? `Player ${opponent}` : 'TBD';
    };

    if (isPlayerEliminated) {
      const lastMatch = playerBracketMatches.lastCompleted;
      if (!lastMatch) {
        return {
          status: 'Eliminated',
          advancement: null
        };
      }

      const roundLabel = getRoundLabel(lastMatch.round, lastMatch.roundIndex, totalRounds);
      const opponentLabel = makeOpponentLabel(lastMatch.match);
      const winnerId = lastMatch.match?.winner != null ? String(lastMatch.match.winner) : null;
      const eliminatedBy = winnerId && winnerId !== playerKey ? ` by Player ${winnerId}` : '';

      return {
        status: `Eliminated in ${roundLabel}${eliminatedBy}`,
        advancement: opponentLabel ? `Last opponent: ${opponentLabel}` : null
      };
    }

    if (playerBracketMatches.nextMatch) {
      const { round, roundIndex, match } = playerBracketMatches.nextMatch;
      const roundLabel = normalizeRoundLabel(getRoundLabel(round, roundIndex, totalRounds));
      const opponentLabel = makeOpponentLabel(match);
      const nextRound = bracketRounds[roundIndex + 1];
      const nextRoundLabel = nextRound
        ? normalizeRoundLabel(getRoundLabel(nextRound, roundIndex + 1, totalRounds))
        : null;

      return {
        status: `${roundLabel} vs ${opponentLabel}`,
        advancement: nextRoundLabel ? `Winner advances to ${nextRoundLabel}` : 'Winner becomes Champion'
      };
    }

    const lastMatch = playerBracketMatches.lastCompleted;
    if (lastMatch && bracketState.champion === playerKey) {
      return {
        status: 'Champion crowned!',
        advancement: 'Congratulations on winning the bracket!'
      };
    }

    if (lastMatch) {
      const nextRound = bracketRounds[lastMatch.roundIndex + 1];
      if (nextRound) {
        const waitingLabel = normalizeRoundLabel(getRoundLabel(nextRound, lastMatch.roundIndex + 1, totalRounds));
        return {
          status: `Waiting for ${waitingLabel} matchup`,
          advancement: 'Awaiting opponent advancement'
        };
      }
    }

    return null;
  }, [
    bracketRounds,
    getRoundLabel,
    isKnockoutMode,
    isPlayerEliminated,
    normalizeRoundLabel,
    playerBracketMatches,
    playerKey,
    bracketState.champion
  ]);

  const handlePromptChange = useCallback((e) => {
    const value = e.target.value;
    setPrompt(value);

    if (socket && gameState?.phase === 'battling' && !isPlayerEliminated) {
      socket.emit('prompt-update', { playerId, prompt: value });
    }
  }, [socket, gameState?.phase, playerId, isPlayerEliminated]);

  const handleReady = () => {
    if (socket && !isPlayerEliminated) {
      socket.emit('player-ready', playerId);
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getPhaseDisplay = () => {
    if (isPlayerEliminated) {
      return 'You have been eliminated from the bracket.';
    }

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
                  {gameState.target.type === 'image' ? (
                    <div className="flex flex-col items-center space-y-2">
                      <img 
                        src={getProxiedImageUrl(gameState.target.imageUrl)} 
                        alt="Challenge"
                        className="max-w-full h-48 object-contain border border-gray-300"
                      />
                      <p style={{ fontSize: '11px' }} className="text-center font-medium">
                        {gameState.target.content}
                      </p>
                    </div>
                  ) : (
                    <p style={{ fontSize: '11px' }}>{gameState.target.content || gameState.target}</p>
                  )}
                </div>
              )}
            </div>

            {showCompetitionStats && (
              <div className="border border-black p-3 mb-6 bg-white" style={{
                boxShadow: 'inset 2px 2px 0px #999'
              }}>
                <h3 className="font-bold mb-3" style={{ fontSize: '12px' }}>Competition Tracker</h3>
                <div className="grid md:grid-cols-2 gap-3" style={{ fontSize: '10px', textAlign: 'left' }}>
                  <div>
                    <div className="flex justify-between mb-1">
                      <span>Your Wins</span>
                      <span className="font-bold">{playerScore}</span>
                    </div>
                    <div className="flex justify-between mb-1">
                      <span>Your Rank</span>
                      <span className="font-bold">{playerRank > 0 ? `#${playerRank}` : '—'}</span>
                    </div>
                    {pointGoal && !isKnockoutMode && (
                      <div className="flex justify-between mb-1">
                        <span>Point Goal</span>
                        <span className="font-bold">{pointGoal}</span>
                      </div>
                    )}
                  </div>
                  <div>
                    <div className="flex justify-between mb-1">
                      <span>Rounds Played</span>
                      <span className="font-bold">{roundsPlayed}</span>
                    </div>
                    <div className="flex justify-between mb-1">
                      <span>Current Round</span>
                      <span className="font-bold">
                        {gameState?.competitionActive ? Math.max(1, currentRoundNumber || 1) : roundsPlayed}
                      </span>
                    </div>
                    {roundGoal && !isKnockoutMode && (
                      <div className="flex justify-between mb-1">
                        <span>Round Goal</span>
                        <span className="font-bold">{roundGoal}</span>
                      </div>
                    )}
                  </div>
                </div>

                {isKnockoutMode ? (
                  <div className="mt-3 border border-dashed border-black p-2 bg-gray-100" style={{ fontSize: '10px' }}>
                    <div className="font-bold mb-1">Bracket Path</div>
                    {playerBracketPath ? (
                      <>
                        <div>{playerBracketPath.status}</div>
                        {playerBracketPath.advancement && (
                          <div className="mt-1 text-gray-700">{playerBracketPath.advancement}</div>
                        )}
                      </>
                    ) : (
                      <div>Bracket in setup. Await further match assignments.</div>
                    )}
                  </div>
                ) : (
                  <>
                    {roundGoal && (
                      <div className="mt-3">
                        <div className="flex justify-between" style={{ fontSize: '9px' }}>
                          <span>Round Progress</span>
                          <span>{Math.min(roundsPlayed, roundGoal)}/{roundGoal}</span>
                        </div>
                        <div className="h-2 border border-black bg-gray-200">
                          <div
                            className="h-full bg-blue-500"
                            style={{ width: `${Math.min(100, Math.round(roundProgress * 100))}%` }}
                          ></div>
                        </div>
                      </div>
                    )}

                    {pointGoal && (
                      <div className="mt-3">
                        <div className="flex justify-between" style={{ fontSize: '9px' }}>
                          <span>Point Progress</span>
                          <span>{leaderScore}/{pointGoal} pts</span>
                        </div>
                        <div className="h-2 border border-black bg-gray-200">
                          <div
                            className="h-full bg-green-500"
                            style={{ width: `${Math.min(100, Math.round(pointProgress * 100))}%` }}
                          ></div>
                        </div>
                      </div>
                    )}
                  </>
                )}

                {standings.length > 0 && (
                  <div className="mt-3 border border-black bg-gray-100" style={{
                    boxShadow: 'inset 1px 1px 0px #999'
                  }}>
                    {standings.map(entry => (
                      <div
                        key={entry.playerId}
                        className={`flex items-center justify-between px-2 py-1 border-b border-gray-300 last:border-b-0 ${
                          entry.playerId === playerKey ? 'bg-yellow-200 font-bold' : ''
                        }`}
                        style={{ fontSize: '10px' }}
                      >
                        <span>Player {entry.playerId}</span>
                        <span>{entry.score}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

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
                  disabled={gameState?.phase !== 'battling' || isPlayerEliminated}
                  className="w-full h-32 p-2 border-2 border-black resize-none"
                  style={{
                    fontFamily: 'Chicago, "SF Pro Display", system-ui, sans-serif',
                    fontSize: '11px',
                    backgroundColor: gameState?.phase === 'battling' && !isPlayerEliminated ? 'white' : '#f0f0f0',
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
                  disabled={isPlayerEliminated}
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