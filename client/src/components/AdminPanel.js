import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Settings, Play, RotateCcw, Timer, Users, Monitor, Trophy, Flag, Target, GitBranch, Shuffle, MoveVertical, Crown } from 'lucide-react';
import io from 'socket.io-client';
import { getSocketURL, getProxiedImageUrl } from '../utils/network';

const SLOT_ACCENTS = [
  { title: 'text-blue-300', link: 'text-blue-200' },
  { title: 'text-emerald-300', link: 'text-emerald-200' },
  { title: 'text-purple-300', link: 'text-purple-200' },
  { title: 'text-amber-300', link: 'text-amber-200' },
  { title: 'text-rose-300', link: 'text-rose-200' },
  { title: 'text-sky-300', link: 'text-sky-200' },
  { title: 'text-fuchsia-300', link: 'text-fuchsia-200' },
  { title: 'text-lime-300', link: 'text-lime-200' }
];

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
  const [healthStatus, setHealthStatus] = useState(null);
  const [roundLimit, setRoundLimit] = useState('');
  const [pointLimit, setPointLimit] = useState('');
  const [competitionModeSelection, setCompetitionModeSelection] = useState('series');
  const [seedOrder, setSeedOrder] = useState([]);
  const [draggedSeedIndex, setDraggedSeedIndex] = useState(null);
  const [bracketState, setBracketState] = useState({ bracket: null, currentMatch: null, eliminatedPlayers: [] });
  const [matchReadyInfo, setMatchReadyInfo] = useState(null);
  const [bracketChampion, setBracketChampion] = useState(null);
  const [slotWarning, setSlotWarning] = useState('');

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

  const getRoundName = useCallback((roundIndex, totalRounds) => {
    const roundsRemaining = totalRounds - roundIndex;
    if (roundsRemaining === 1) return 'Final';
    if (roundsRemaining === 2) return 'Semifinals';
    if (roundsRemaining === 3) return 'Quarterfinals';
    return `Round ${roundIndex + 1}`;
  }, []);

  const buildBracketFromSeeds = useCallback((seeds) => {
    const uniqueSeeds = Array.from(new Set(seeds.map(seed => (seed != null ? String(seed) : null)).filter(Boolean)));
    if (uniqueSeeds.length < 2) {
      return null;
    }

    const bracketSize = Math.pow(2, Math.ceil(Math.log2(uniqueSeeds.length)));
    const paddedSeeds = [...uniqueSeeds];
    while (paddedSeeds.length < bracketSize) {
      paddedSeeds.push(null);
    }

    const totalRounds = Math.log2(bracketSize);
    const rounds = [];

    const buildRound = (playersForRound, roundIndex) => {
      const matches = [];
      for (let i = 0; i < playersForRound.length; i += 2) {
        matches.push({
          id: `${roundIndex}-${Math.floor(i / 2)}`,
          players: [playersForRound[i] ?? null, playersForRound[i + 1] ?? null],
          status: 'pending',
          winner: null
        });
      }

      rounds.push({
        name: getRoundName(roundIndex, totalRounds),
        matches
      });

      if (roundIndex + 1 < totalRounds) {
        const nextRoundPlayers = matches.map(match => {
          const entrants = (match.players || []).filter(Boolean);
          if (entrants.length === 1) {
            return entrants[0];
          }
          return null;
        });
        buildRound(nextRoundPlayers, roundIndex + 1);
      }
    };

    buildRound(paddedSeeds, 0);

    return { rounds };
  }, [getRoundName]);

  const getPlayerDisplayName = useCallback((playerId) => {
    if (!playerId) {
      return '';
    }

    const record = gameState?.players?.[playerId];
    const displayName = record?.displayName;

    if (typeof displayName === 'string') {
      const trimmed = displayName.trim();
      if (trimmed) {
        return trimmed;
      }
    }

    return '';
  }, [gameState?.players]);

  const getPlayerLabel = useCallback((playerId) => {
    if (!playerId) return 'TBD';
    const displayName = getPlayerDisplayName(playerId);
    if (displayName) {
      return `${displayName} (P${playerId})`;
    }
    return `Player ${playerId}`;
  }, [getPlayerDisplayName]);

  const playerEntries = useMemo(() => {
    const entries = Object.entries(gameState?.players || {});
    return entries.sort((a, b) => {
      const aNum = Number(a[0]);
      const bNum = Number(b[0]);
      if (!Number.isNaN(aNum) && !Number.isNaN(bNum)) {
        return aNum - bNum;
      }
      return a[0].localeCompare(b[0]);
    });
  }, [gameState?.players]);

  useEffect(() => {
    setSeedOrder(prev => {
      const availableIds = playerEntries.map(([playerId]) => String(playerId));
      const seen = new Set();
      const filtered = [];

      prev.forEach(id => {
        if (availableIds.includes(id) && !seen.has(id)) {
          filtered.push(id);
          seen.add(id);
        }
      });

      availableIds.forEach(id => {
        if (!seen.has(id)) {
          filtered.push(id);
          seen.add(id);
        }
      });

      if (filtered.length === prev.length && filtered.every((id, index) => id === prev[index])) {
        return prev;
      }

      return filtered;
    });
  }, [playerEntries]);

  // Fetch available challenge images
  useEffect(() => {
    fetch('/api/challenge-images')
      .then(res => res.json())
      .then(data => setChallengeImages(data.images || []))
      .catch(err => console.error('Failed to fetch challenge images:', err));
  }, []);

  // Fetch health status
  const fetchHealthStatus = async () => {
    try {
      const response = await fetch('/api/health');
      const data = await response.json();
      setHealthStatus(data);
    } catch (error) {
      console.error('Failed to fetch health status:', error);
      setHealthStatus(null);
    }
  };

  // Fetch health status on component mount and periodically
  useEffect(() => {
    fetchHealthStatus();
    const interval = setInterval(fetchHealthStatus, 30000); // Update every 30 seconds
    return () => clearInterval(interval);
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
      setSlotWarning('');
    });

    newSocket.on('player-slot-removal-blocked', (payload) => {
      const minimum = Number(payload?.minimumSlots);
      if (!Number.isFinite(minimum)) {
        setSlotWarning('Cannot remove player slots right now.');
        return;
      }
      if (minimum <= 2) {
        setSlotWarning('Need to keep at least two player slots available.');
      } else {
        setSlotWarning(`Player slot ${minimum} is still in use—remove that player before closing the slot.`);
      }
    });

    setSocket(newSocket);

    return () => {
      newSocket.close();
    };
  }, []);

  useEffect(() => {
    if (!socket) return;

    const handleBracketUpdated = (payload = {}) => {
      setBracketState({
        bracket: payload.bracket || null,
        currentMatch: payload.currentMatch || null,
        eliminatedPlayers: payload.eliminatedPlayers || []
      });

      if (payload.bracket) {
        setCompetitionModeSelection('knockout');
      } else {
        setMatchReadyInfo(null);
      }
    };

    const handleMatchReadyEvent = (payload) => {
      setMatchReadyInfo(payload);
    };

    const handleBracketFinished = (payload = {}) => {
      setBracketChampion(payload.champion || null);
      setMatchReadyInfo(null);
    };

    socket.on('bracket-updated', handleBracketUpdated);
    socket.on('match-ready', handleMatchReadyEvent);
    socket.on('bracket-finished', handleBracketFinished);

    return () => {
      socket.off('bracket-updated', handleBracketUpdated);
      socket.off('match-ready', handleMatchReadyEvent);
      socket.off('bracket-finished', handleBracketFinished);
    };
  }, [socket]);

  useEffect(() => {
    if (!gameState?.competitionActive) return;
    const { roundLimit: rl, pointLimit: pl } = gameState.competitionConfig || {};
    setRoundLimit(rl ?? '');
    setPointLimit(pl ?? '');
  }, [gameState?.competitionActive, gameState?.competitionConfig?.roundLimit, gameState?.competitionConfig?.pointLimit]);

  useEffect(() => {
    if (gameState?.bracket) {
      setBracketState(prev => {
        if (
          prev.bracket === gameState.bracket &&
          prev.currentMatch === gameState.currentMatch &&
          prev.eliminatedPlayers === gameState.eliminatedPlayers
        ) {
          return prev;
        }

        return {
          bracket: gameState.bracket,
          currentMatch: gameState.currentMatch || null,
          eliminatedPlayers: gameState.eliminatedPlayers || []
        };
      });
    } else {
      setBracketState(prev => (prev.bracket ? { bracket: null, currentMatch: null, eliminatedPlayers: [] } : prev));
    }
  }, [gameState?.bracket, gameState?.currentMatch, gameState?.eliminatedPlayers]);

  useEffect(() => {
    const mode = gameState?.competitionMode || 'series';
    if (gameState?.competitionActive || mode === 'knockout' || gameState?.bracket) {
      setCompetitionModeSelection(mode);
    }

    if (!gameState?.competitionActive && !gameState?.bracket) {
      setBracketChampion(null);
    }
  }, [gameState?.competitionMode, gameState?.competitionActive, gameState?.bracket]);

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
      setRoundLimit('');
      setPointLimit('');
    }
  };

  const startCompetition = () => {
    if (!socket) return;

    if (competitionModeSelection === 'knockout') {
      if (bracketState.bracket) {
        socket.emit('start-competition', { competitionMode: 'knockout' });
        return;
      }

      const bracket = buildBracketFromSeeds(seedOrder);
      if (bracket) {
        socket.emit('create-bracket', bracket);
        setBracketChampion(null);
      }
      return;
    }

    socket.emit('start-competition', {
      roundLimit: roundLimit || null,
      pointLimit: pointLimit || null,
      competitionMode: 'series'
    });
  };

  const handleNextRound = () => {
    if (!socket || gameState?.competitionMode === 'knockout') return;
    socket.emit('next-round');
  };

  const endCompetition = () => {
    if (!socket) return;
    socket.emit('end-competition');
  };

  const handleAdvanceBracket = useCallback(() => {
    if (!socket) return;
    socket.emit('advance-match');
  }, [socket]);

  const handleReportWinner = useCallback((winnerId) => {
    if (!socket || !winnerId) return;
    socket.emit('select-winner', winnerId);
  }, [socket]);

  const handleResetBracket = useCallback(() => {
    if (!socket) return;
    socket.emit('reset-bracket');
    setBracketChampion(null);
  }, [socket]);

  const handleRestartBracket = useCallback(() => {
    if (!socket) return;
    socket.emit('start-competition', { competitionMode: 'knockout' });
    setBracketChampion(null);
  }, [socket]);

  const handleAutoSeed = useCallback(() => {
    const orderedPlayers = playerEntries.map(([playerId]) => String(playerId));
    setSeedOrder(orderedPlayers);
  }, [playerEntries]);

  const handleDragStart = (index) => {
    setDraggedSeedIndex(index);
  };

  const handleDragEnd = () => {
    setDraggedSeedIndex(null);
  };

  const handleDragOver = (event) => {
    event.preventDefault();
  };

  const handleDrop = (event, index) => {
    event.preventDefault();
    if (draggedSeedIndex === null || draggedSeedIndex === index) {
      return;
    }

    setSeedOrder(prev => {
      const updated = [...prev];
      const [moved] = updated.splice(draggedSeedIndex, 1);
      updated.splice(index, 0, moved);
      return updated;
    });
    setDraggedSeedIndex(null);
  };

  const standings = useMemo(() => {
    if (!gameState?.scores) return [];
    return Object.entries(gameState.scores)
      .map(([playerId, score]) => ({
        playerId,
        score,
        connected: !!gameState.players?.[playerId]?.connected
      }))
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return Number(a.playerId) - Number(b.playerId);
      });
  }, [gameState?.scores, gameState?.players]);

  const isKnockoutSelected = competitionModeSelection === 'knockout';
  const bracketRounds = bracketState.bracket?.rounds || [];
  const bracketIsLive = bracketRounds.length > 0;
  const knockoutActive = gameState?.competitionMode === 'knockout' && gameState?.competitionActive;
  const isKnockoutModeActive = knockoutActive || bracketIsLive;
  const hasSeeds = seedOrder.filter(Boolean).length >= 2;

  const connectedPlayerCount = useMemo(
    () => playerEntries.filter(([, player]) => player?.connected).length,
    [playerEntries]
  );

  const totalPlayerSlots = useMemo(() => {
    const slotsFromState = Number(gameState?.playerSlots);
    if (Number.isFinite(slotsFromState) && slotsFromState > 0) {
      return slotsFromState;
    }
    return Math.max(playerEntries.length, 2);
  }, [gameState?.playerSlots, playerEntries.length]);

  const quickAccessSlots = useMemo(() => {
    const playersById = gameState?.players || {};
    return Array.from({ length: totalPlayerSlots }, (_, index) => {
      const slotNumber = index + 1;
      const slotKey = String(slotNumber);
      return {
        slotNumber,
        slotKey,
        player: playersById[slotKey] || null
      };
    });
  }, [gameState?.players, totalPlayerSlots]);

  const getPlayerAccent = useCallback((slotKey) => {
    const numericIndex = Number(slotKey);
    if (Number.isFinite(numericIndex) && numericIndex > 0) {
      return SLOT_ACCENTS[(numericIndex - 1) % SLOT_ACCENTS.length];
    }

    const seed = String(slotKey || '')
      .split('')
      .reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return SLOT_ACCENTS[seed % SLOT_ACCENTS.length];
  }, []);

  const highestActiveSlot = useMemo(() => {
    return playerEntries.reduce((max, [playerId]) => {
      const numericId = Number(playerId);
      if (!Number.isFinite(numericId)) {
        return max;
      }
      return Math.max(max, numericId);
    }, 0);
  }, [playerEntries]);

  const minimumSlots = Math.max(2, highestActiveSlot);
  const canRemovePlayerSlot = totalPlayerSlots > minimumSlots;
  const expectedPlayers = totalPlayerSlots;

  const handleAddPlayerSlot = useCallback(() => {
    if (!socket) return;
    setSlotWarning('');
    socket.emit('add-player-slot');
  }, [socket]);

  const handleRemovePlayerSlot = useCallback(() => {
    if (!socket) return;
    setSlotWarning('');
    socket.emit('remove-player-slot');
  }, [socket]);

  const totalMatches = useMemo(() => {
    if (!bracketState.bracket?.rounds) return 0;
    return bracketState.bracket.rounds.reduce((sum, round) => {
      return sum + (Array.isArray(round?.matches) ? round.matches.length : 0);
    }, 0);
  }, [bracketState.bracket]);

  const completedMatches = useMemo(() => {
    if (!bracketState.bracket?.rounds) return 0;
    return bracketState.bracket.rounds.reduce((sum, round) => {
      if (!Array.isArray(round?.matches)) return sum;
      return sum + round.matches.filter(match => match?.status === 'completed' || match?.winner).length;
    }, 0);
  }, [bracketState.bracket]);

  const currentMatch = useMemo(() => {
    if (!bracketState.bracket || !bracketState.currentMatch) return null;
    const { roundIndex, matchIndex } = bracketState.currentMatch;
    return bracketState.bracket.rounds?.[roundIndex]?.matches?.[matchIndex] || null;
  }, [bracketState.bracket, bracketState.currentMatch]);

  const currentMatchPlayers = currentMatch?.players || [];
  const activeMatchPlayers = matchReadyInfo?.match?.players || currentMatchPlayers;
  const eliminatedSet = useMemo(() => new Set(bracketState.eliminatedPlayers || []), [bracketState.eliminatedPlayers]);
  const currentMatchDescriptor = useMemo(() => {
    if (!bracketState.currentMatch || !bracketRounds.length) {
      return 'Awaiting seeding';
    }
    const { roundIndex, matchIndex } = bracketState.currentMatch;
    const round = bracketRounds[roundIndex];
    const roundName = round?.name || `Round ${roundIndex + 1}`;
    return `${roundName} • Match ${matchIndex + 1}`;
  }, [bracketRounds, bracketState.currentMatch]);

  const canStartSeriesCompetition = connected &&
    !gameState?.competitionActive &&
    !bracketIsLive &&
    connectedPlayerCount >= 2;

  const canCreateBracket = connected &&
    !gameState?.competitionActive &&
    !bracketIsLive &&
    hasSeeds;

  const canRestartKnockout = isKnockoutSelected && bracketIsLive && !gameState?.competitionActive;
  const canStartCompetition = isKnockoutSelected ? canCreateBracket : canStartSeriesCompetition;
  const canAdvanceBracketManually = bracketIsLive && (!!bracketState.currentMatch || !!matchReadyInfo);
  const startButtonLabel = isKnockoutSelected ? 'Create Knockout Bracket' : 'Start Competition';

  const roundsPlayed = gameState?.roundsPlayed || 0;
  const roundGoal = gameState?.competitionConfig?.roundLimit || null;
  const pointGoal = gameState?.competitionConfig?.pointLimit || null;
  const roundProgress = roundGoal ? Math.min(roundsPlayed / roundGoal, 1) : 0;
  const leaderScore = standings[0]?.score || 0;
  const pointProgress = pointGoal ? Math.min(leaderScore / pointGoal, 1) : 0;
  const currentRoundNumber = gameState?.competitionActive
    ? (gameState.roundNumber || roundsPlayed + 1)
    : roundsPlayed;
  const modeLabel = ((gameState?.competitionMode || (bracketIsLive ? 'knockout' : competitionModeSelection)) === 'knockout')
    ? 'Knockout'
    : 'Series';
  let competitionStatus = 'Not Started';
  if (gameState?.competitionActive) {
    competitionStatus = `Active (${modeLabel})`;
  } else if (roundsPlayed > 0) {
    competitionStatus = `Completed (${modeLabel})`;
  } else if (bracketIsLive) {
    competitionStatus = `Bracket Ready (${modeLabel})`;
  }

  const competitionStatusColor = gameState?.competitionActive
    ? 'text-green-400'
    : roundsPlayed > 0
      ? 'text-blue-300'
      : bracketIsLive
        ? 'text-purple-300'
        : 'text-gray-400';

  const canAdvanceRound = !!gameState?.competitionActive && gameState?.competitionMode !== 'knockout';
  const canEndCompetition = !!gameState?.competitionActive;
  const displayCurrentRound = gameState?.competitionActive
    ? Math.max(1, currentRoundNumber || 1)
    : Math.max(roundsPlayed, 0);

  const getConnectionStatus = () => {
    if (!connected) return { color: 'text-red-500', text: 'Disconnected' };
    return { color: 'text-green-500', text: 'Connected' };
  };

  const matchParticipants = activeMatchPlayers.filter(Boolean);
  const currentMatchReadyPlayers = matchParticipants.length;
  const canStartBattle = connected &&
    gameState?.phase === 'ready' &&
    gameState?.target &&
    connectedPlayerCount >= 2 &&
    (!isKnockoutModeActive || currentMatchReadyPlayers === 2);
  const canSubmitWinner = currentMatchReadyPlayers === 2;

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
              {connectedPlayerCount}/{expectedPlayers} Players
            </div>
          </div>
        </div>
      </div>

      <div className="p-6 max-w-6xl mx-auto">
        {/* Quick Access URLs */}
        <div className="bg-gray-800 rounded-lg p-6 mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold flex items-center">
              <Monitor className="h-6 w-6 mr-2" />
              Quick Access URLs
            </h2>
            <div className="flex items-center space-x-3">
              <button
                onClick={handleRemovePlayerSlot}
                disabled={!socket || !canRemovePlayerSlot}
                className={`px-3 py-1.5 rounded-md text-sm font-semibold transition-colors ${
                  socket && canRemovePlayerSlot
                    ? 'bg-gray-700 hover:bg-gray-600'
                    : 'bg-gray-600 cursor-not-allowed'
                }`}
              >
                − Remove Slot
              </button>
              <button
                onClick={handleAddPlayerSlot}
                disabled={!socket}
                className={`px-3 py-1.5 rounded-md text-sm font-semibold transition-colors ${
                  socket ? 'bg-blue-600 hover:bg-blue-500' : 'bg-gray-600 cursor-not-allowed'
                }`}
              >
                + Add Player Slot
              </button>
            </div>
          </div>

          {slotWarning && (
            <div className="mb-4 text-sm text-yellow-300">
              {slotWarning}
            </div>
          )}

          <div className="grid md:grid-cols-3 lg:grid-cols-4 gap-4">
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

            {quickAccessSlots.map(({ slotNumber, slotKey, player }) => {
              const accent = getPlayerAccent(slotKey);
              const playerUrl = `/player/${slotNumber}`;
              const playerOriginUrl = `${window.location.origin}${playerUrl}`;
              const isConnected = !!player?.connected;
              const isReserved = !!player && !player.connected;
              const indicatorClass = isConnected
                ? 'bg-green-400'
                : isReserved
                  ? 'bg-yellow-400'
                  : 'bg-gray-500';
              const statusClass = isConnected
                ? 'text-green-300'
                : isReserved
                  ? 'text-yellow-300'
                  : 'text-gray-400';
              const statusLabel = isConnected
                ? 'Connected'
                : isReserved
                  ? 'Reserved'
                  : 'Available';

              const displayName = getPlayerDisplayName(slotKey);
              const headerLabel = displayName
                ? `${displayName} (P${slotNumber})`
                : `Player ${slotNumber}`;

              return (
                <div key={slotNumber} className="bg-gray-700 p-4 rounded-lg space-y-2">
                  <div className="flex items-center justify-between">
                    <h3 className={`font-semibold ${accent.title}`}>{headerLabel}</h3>
                    <div className="flex items-center space-x-2 text-xs">
                      <span className={`w-2 h-2 rounded-full ${indicatorClass}`}></span>
                      <span className={statusClass}>{statusLabel}</span>
                    </div>
                  </div>

                  <a
                    href={playerUrl}
                    target="_blank"
                    className={`text-sm ${accent.link} hover:underline font-mono break-all`}
                  >
                    {playerOriginUrl}
                  </a>
                </div>
              );
            })}
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
                {playerEntries.length > 0 ? (
                  playerEntries.map(([playerId, player]) => (
                    <div key={playerId} className="flex items-center space-x-2">
                      <div className={`w-3 h-3 rounded-full ${
                        player?.connected ? 'bg-green-500' : 'bg-gray-500'
                      }`}></div>
                      <span>{getPlayerLabel(playerId)}</span>
                      {player?.ready && (
                        <span className="text-green-400 text-sm">✓ Ready</span>
                      )}
                    </div>
                  ))
                ) : (
                  <div className="text-sm text-gray-400">No players connected yet.</div>
                )}
              </div>
            </div>
          </div>
          
          {gameState?.target && (
            <div className="mt-4 p-4 bg-gray-700 rounded-lg">
              <h3 className="font-semibold mb-2">Current Target:</h3>
              {gameState.target.type === 'image' ? (
                <div className="flex items-center space-x-4">
                  <img 
                    src={getProxiedImageUrl(gameState.target.imageUrl)} 
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

        {/* Competition Controls */}
        <div className="bg-gray-800 rounded-lg p-6 mb-8">
          <h2 className="text-xl font-bold mb-4 flex items-center">
            <Trophy className="h-6 w-6 mr-2 text-yellow-400" />
            <span>Competition Mode</span>
          </h2>

          <div className="grid lg:grid-cols-2 gap-6">
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-400 uppercase tracking-wide">Status</p>
                  <p className={`text-2xl font-bold ${competitionStatusColor}`}>{competitionStatus}</p>
                </div>
                <div className="text-right text-sm text-gray-300">
                  {isKnockoutModeActive ? (
                    <>
                      <div>
                        Matches Completed:{' '}
                        <span className="font-semibold text-white">{completedMatches}/{totalMatches}</span>
                      </div>
                      <div>
                        Current Match:{' '}
                        <span className="font-semibold text-white">{currentMatchDescriptor}</span>
                      </div>
                    </>
                  ) : (
                    <>
                      <div>
                        Rounds Played:{' '}
                        <span className="font-semibold text-white">{roundsPlayed}</span>
                      </div>
                      <div>
                        Current Round:{' '}
                        <span className="font-semibold text-white">{displayCurrentRound || 0}</span>
                      </div>
                    </>
                  )}
                </div>
              </div>

              <div>
                <p className="text-sm text-gray-400 uppercase tracking-wide">Mode Selection</p>
                <div className="mt-2 inline-flex rounded-lg border border-gray-600 overflow-hidden">
                  <button
                    onClick={() => setCompetitionModeSelection('series')}
                    disabled={gameState?.competitionActive || bracketIsLive}
                    className={`px-4 py-2 text-sm font-medium transition-colors ${
                      competitionModeSelection === 'series'
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-900 text-gray-300 hover:bg-gray-700'
                    } ${gameState?.competitionActive || bracketIsLive ? 'cursor-not-allowed opacity-60' : ''}`}
                  >
                    Series
                  </button>
                  <button
                    onClick={() => setCompetitionModeSelection('knockout')}
                    disabled={gameState?.competitionActive || bracketIsLive}
                    className={`px-4 py-2 text-sm font-medium transition-colors border-l border-gray-600 ${
                      competitionModeSelection === 'knockout'
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-900 text-gray-300 hover:bg-gray-700'
                    } ${gameState?.competitionActive || bracketIsLive ? 'cursor-not-allowed opacity-60' : ''}`}
                  >
                    Knockout
                  </button>
                </div>
                <p className="text-xs text-gray-400 mt-2">
                  {gameState?.competitionActive || bracketIsLive
                    ? 'Mode selection is locked while a competition or bracket is active.'
                    : 'Choose the format before starting the competition.'}
                </p>
              </div>

              {competitionModeSelection === 'series' ? (
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold mb-2 flex items-center">
                      <Flag className="h-4 w-4 mr-2 text-yellow-400" />
                      Round Goal
                    </label>
                    <input
                      type="number"
                      min="1"
                      placeholder="No limit"
                      value={roundLimit}
                      onChange={(e) => setRoundLimit(e.target.value)}
                      disabled={gameState?.competitionActive || isKnockoutModeActive}
                      className={`w-full p-2 rounded border text-white focus:outline-none focus:border-blue-500 ${
                        gameState?.competitionActive || isKnockoutModeActive
                          ? 'bg-gray-700 border-gray-600 cursor-not-allowed text-gray-400'
                          : 'bg-gray-700 border-gray-600 hover:border-gray-500'
                      }`}
                    />
                    <p className="text-xs text-gray-400 mt-1">Automatically ends after this many rounds.</p>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold mb-2 flex items-center">
                      <Target className="h-4 w-4 mr-2 text-red-400" />
                      Point Goal
                    </label>
                    <input
                      type="number"
                      min="1"
                      placeholder="No limit"
                      value={pointLimit}
                      onChange={(e) => setPointLimit(e.target.value)}
                      disabled={gameState?.competitionActive || isKnockoutModeActive}
                      className={`w-full p-2 rounded border text-white focus:outline-none focus:border-blue-500 ${
                        gameState?.competitionActive || isKnockoutModeActive
                          ? 'bg-gray-700 border-gray-600 cursor-not-allowed text-gray-400'
                          : 'bg-gray-700 border-gray-600 hover:border-gray-500'
                      }`}
                    />
                    <p className="text-xs text-gray-400 mt-1">First player to reach this total wins the series.</p>
                  </div>
                </div>
              ) : (
                <div className="p-4 bg-gray-900/40 border border-gray-700 rounded-lg flex items-start space-x-3">
                  <GitBranch className="h-6 w-6 text-blue-300 mt-1" />
                  <div>
                    <p className="text-sm font-semibold text-gray-200">Knockout ladder</p>
                    <p className="text-xs text-gray-400 mt-1">
                      Round and point goals are handled automatically. Seed players below to build the bracket, then advance each matchup when ready.
                    </p>
                  </div>
                </div>
              )}

              <div className="flex flex-wrap gap-3">
                <button
                  onClick={startCompetition}
                  disabled={!canStartCompetition}
                  className={`flex items-center px-4 py-2 rounded-lg font-semibold transition-colors border ${
                    canStartCompetition
                      ? 'bg-blue-600 hover:bg-blue-500 border-blue-500 text-white'
                      : 'bg-gray-700 text-gray-400 border-gray-600 cursor-not-allowed'
                  }`}
                >
                  <Trophy className="h-5 w-5 mr-2" />
                  {startButtonLabel}
                </button>

                <button
                  onClick={handleNextRound}
                  disabled={!canAdvanceRound}
                  className={`flex items-center px-4 py-2 rounded-lg font-semibold transition-colors border ${
                    canAdvanceRound
                      ? 'bg-purple-600 hover:bg-purple-500 border-purple-500 text-white'
                      : 'bg-gray-700 text-gray-400 border-gray-600 cursor-not-allowed'
                  }`}
                >
                  <Play className="h-5 w-5 mr-2" />
                  Next Round
                </button>

                <button
                  onClick={endCompetition}
                  disabled={!canEndCompetition}
                  className={`flex items-center px-4 py-2 rounded-lg font-semibold transition-colors border ${
                    canEndCompetition
                      ? 'bg-red-600 hover:bg-red-500 border-red-500 text-white'
                      : 'bg-gray-700 text-gray-400 border-gray-600 cursor-not-allowed'
                  }`}
                >
                  <RotateCcw className="h-5 w-5 mr-2" />
                  End Competition
                </button>

                {isKnockoutModeActive && (
                  <>
                    <button
                      onClick={handleAdvanceBracket}
                      disabled={!canAdvanceBracketManually}
                      className={`flex items-center px-4 py-2 rounded-lg font-semibold transition-colors border ${
                        canAdvanceBracketManually
                          ? 'bg-indigo-600 hover:bg-indigo-500 border-indigo-500 text-white'
                          : 'bg-gray-700 text-gray-400 border-gray-600 cursor-not-allowed'
                      }`}
                    >
                      <Play className="h-5 w-5 mr-2 rotate-90" />
                      Advance Bracket
                    </button>
                    <button
                      onClick={handleResetBracket}
                      className="flex items-center px-4 py-2 rounded-lg font-semibold transition-colors border bg-gray-700 hover:bg-gray-600 border-gray-500 text-gray-100"
                    >
                      <RotateCcw className="h-5 w-5 mr-2" />
                      Reset Ladder
                    </button>
                  </>
                )}

                {canRestartKnockout && (
                  <button
                    onClick={handleRestartBracket}
                    className="flex items-center px-4 py-2 rounded-lg font-semibold transition-colors border bg-amber-600 hover:bg-amber-500 border-amber-500 text-white"
                  >
                    <RotateCcw className="h-5 w-5 mr-2" />
                    Restart Ladder
                  </button>
                )}
              </div>

              {competitionModeSelection === 'series' && !isKnockoutModeActive ? (
                <div className="mt-4 space-y-4">
                  <div>
                    <div className="flex items-center justify-between text-xs text-gray-300 mb-1">
                      <span>Round Progress</span>
                      {roundGoal ? (
                        <span>{Math.min(roundsPlayed, roundGoal)}/{roundGoal} rounds</span>
                      ) : (
                        <span>No round limit</span>
                      )}
                    </div>
                    <div className="h-2 bg-gray-700 rounded">
                      <div
                        className="h-2 bg-blue-500 rounded"
                        style={{ width: `${roundGoal ? Math.min(100, Math.round(roundProgress * 100)) : 0}%` }}
                      ></div>
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between text-xs text-gray-300 mb-1">
                      <span>Point Progress</span>
                      {pointGoal ? (
                        <span>{leaderScore}/{pointGoal} pts</span>
                      ) : (
                        <span>No point limit</span>
                      )}
                    </div>
                    <div className="h-2 bg-gray-700 rounded">
                      <div
                        className="h-2 bg-green-500 rounded"
                        style={{ width: `${pointGoal ? Math.min(100, Math.round(pointProgress * 100)) : 0}%` }}
                      ></div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="mt-4 p-4 bg-gray-900/40 border border-gray-700 rounded-lg text-sm text-gray-300 space-y-2">
                  <div className="flex items-center justify-between">
                    <span>Total Matches</span>
                    <span className="font-semibold text-white">{totalMatches}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Completed</span>
                    <span className="font-semibold text-white">{completedMatches}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Eliminated Players</span>
                    <span className="font-semibold text-white">{bracketState.eliminatedPlayers?.length || 0}</span>
                  </div>
                  {bracketChampion && (
                    <div className="flex items-center text-yellow-200 space-x-2 pt-2 border-t border-gray-700 mt-2">
                      <Crown className="h-4 w-4" />
                      <span>Champion: {getPlayerLabel(bracketChampion)}</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="space-y-4">
              <h3 className="text-lg font-semibold mb-3 flex items-center text-yellow-300">
                <Trophy className="h-5 w-5 mr-2" />
                Live Standings
              </h3>
              {standings.length > 0 ? (
                <div className="space-y-2">
                  {standings.map((entry, index) => {
                    const eliminated = eliminatedSet.has(entry.playerId);
                    return (
                      <div
                        key={entry.playerId}
                        className={`flex items-center justify-between bg-gray-700 rounded-lg px-4 py-2 border ${
                          index === 0 && !eliminated ? 'border-yellow-400' : 'border-gray-600'
                        }`}
                      >
                        <div>
                          <div className="font-semibold">{getPlayerLabel(entry.playerId)}</div>
                          <div className={`text-xs ${eliminated ? 'text-red-300' : 'text-gray-400'}`}>
                            {eliminated ? 'Eliminated' : entry.connected ? 'Connected' : 'Offline'}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-xl font-bold text-white">{entry.score}</div>
                          {pointGoal && competitionModeSelection === 'series' && (
                            <div className="text-xs text-gray-300">
                              {Math.round(pointGoal ? (entry.score / pointGoal) * 100 : 0)}%
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-gray-400">
                  Standings will appear once the competition begins.
                </p>
              )}
            </div>

            {isKnockoutSelected && !bracketIsLive && (
              <div className="lg:col-span-2 border border-dashed border-gray-600 rounded-lg p-5 bg-gray-900/20">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold flex items-center text-blue-300">
                    <Shuffle className="h-5 w-5 mr-2" />
                    Seed Players
                  </h3>
                  <button
                    onClick={handleAutoSeed}
                    disabled={playerEntries.length === 0}
                    className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                      playerEntries.length === 0
                        ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
                        : 'bg-blue-600 hover:bg-blue-500 text-white'
                    }`}
                  >
                    Auto Seed
                  </button>
                </div>
                <p className="text-sm text-gray-400 mb-4">
                  Drag players to set the bracket order. Seeds are paired from top to bottom.
                </p>
                {seedOrder.length > 0 ? (
                  <div className="grid md:grid-cols-2 gap-3">
                    {seedOrder.map((playerId, index) => {
                      const player = gameState?.players?.[playerId];
                      const isDragging = draggedSeedIndex === index;
                      return (
                        <div
                          key={playerId || `seed-${index}`}
                          draggable={seedOrder.length > 1}
                          onDragStart={() => handleDragStart(index)}
                          onDragOver={handleDragOver}
                          onDrop={(event) => handleDrop(event, index)}
                          onDragEnd={handleDragEnd}
                          className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${
                            isDragging ? 'border-blue-400 bg-blue-900/30' : 'border-gray-600 bg-gray-900/40'
                          }`}
                        >
                          <div>
                            <div className="text-sm font-semibold text-white">
                              Seed {index + 1}: {getPlayerLabel(playerId)}
                            </div>
                            <div className="text-xs text-gray-400">
                              {player?.connected ? 'Connected' : 'Offline'}
                            </div>
                          </div>
                          <MoveVertical className="h-4 w-4 text-gray-400" />
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-sm text-gray-400 bg-gray-900/30 border border-gray-700 rounded-lg p-4">
                    Add players to the lobby or use Auto Seed to populate the bracket.
                  </div>
                )}
                {!hasSeeds && (
                  <p className="text-xs text-red-300 mt-4">
                    At least two players are required to create a knockout bracket.
                  </p>
                )}
              </div>
            )}

            {isKnockoutModeActive && (
              <div className="lg:col-span-2 space-y-6 mt-2">
                <div className="bg-gray-900/40 border border-gray-700 rounded-lg p-5">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-yellow-200 flex items-center">
                      <Play className="h-5 w-5 mr-2" />
                      Current Match
                    </h3>
                    <span className="text-xs text-gray-400">{currentMatchDescriptor}</span>
                  </div>

                  <div className="mt-4 grid md:grid-cols-2 gap-3">
                    {matchParticipants.length > 0 ? (
                      matchParticipants.map((playerId, idx) => {
                        const player = gameState?.players?.[playerId];
                        const isWinner = currentMatch?.winner === playerId;
                        return (
                          <div
                            key={`${playerId}-${idx}`}
                            className={`p-3 rounded-lg border ${
                              isWinner
                                ? 'border-green-400 bg-green-900/20'
                                : 'border-gray-600 bg-gray-900/40'
                            }`}
                          >
                            <div className="text-sm font-semibold text-white">
                              {getPlayerLabel(playerId)}
                            </div>
                            <div className="text-xs text-gray-400">
                              {player?.connected ? 'Connected' : 'Offline'}
                            </div>
                            {isWinner && (
                              <div className="text-xs text-green-300 mt-1">Reported winner</div>
                            )}
                          </div>
                        );
                      })
                    ) : (
                      <p className="text-sm text-gray-400 md:col-span-2">
                        Waiting for a playable matchup. Seed players or advance the bracket to continue.
                      </p>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-3 mt-4">
                    <button
                      onClick={startBattle}
                      disabled={!canStartBattle}
                      className={`flex items-center px-4 py-2 rounded-lg font-semibold transition-colors border ${
                        canStartBattle
                          ? 'bg-green-600 hover:bg-green-500 border-green-500 text-white'
                          : 'bg-gray-700 text-gray-400 border-gray-600 cursor-not-allowed'
                      }`}
                    >
                      <Play className="h-5 w-5 mr-2" />
                      Start Match
                    </button>

                    {matchParticipants.map((playerId) => (
                      <button
                        key={`report-${playerId}`}
                        onClick={() => handleReportWinner(playerId)}
                        disabled={!canSubmitWinner}
                        className={`flex items-center px-4 py-2 rounded-lg font-semibold transition-colors border ${
                          canSubmitWinner
                            ? 'bg-emerald-600 hover:bg-emerald-500 border-emerald-500 text-white'
                            : 'bg-gray-700 text-gray-400 border-gray-600 cursor-not-allowed'
                        }`}
                      >
                        <Trophy className="h-5 w-5 mr-2" />
                        Report {getPlayerLabel(playerId)}
                      </button>
                    ))}

                    <button
                      onClick={handleAdvanceBracket}
                      disabled={!canAdvanceBracketManually}
                      className={`flex items-center px-4 py-2 rounded-lg font-semibold transition-colors border ${
                        canAdvanceBracketManually
                          ? 'bg-indigo-600 hover:bg-indigo-500 border-indigo-500 text-white'
                          : 'bg-gray-700 text-gray-400 border-gray-600 cursor-not-allowed'
                      }`}
                    >
                      <RotateCcw className="h-5 w-5 mr-2" />
                      Advance Without Winner
                    </button>
                  </div>

                  {isKnockoutModeActive && !canStartBattle && currentMatchReadyPlayers !== 2 && (
                    <p className="text-xs text-yellow-300 mt-3">
                      Assign two players to the current match and set a battle target to enable the start button.
                    </p>
                  )}
                </div>

                <div>
                  <h3 className="text-lg font-semibold mb-3 flex items-center text-blue-300">
                    <GitBranch className="h-5 w-5 mr-2" />
                    Knockout Ladder
                  </h3>
                  <div className="overflow-x-auto pb-2">
                    <div className="flex gap-6 min-w-full">
                      {bracketRounds.map((round, roundIndex) => (
                        <div key={roundIndex} className="min-w-[220px] space-y-3">
                          <div className="text-sm font-semibold text-gray-200 border-b border-gray-600 pb-1">
                            {round?.name || `Round ${roundIndex + 1}`}
                          </div>
                          {(round?.matches || []).map((match, matchIndex) => {
                            const matchKey = match?.id || `${roundIndex}-${matchIndex}`;
                            const isCurrent = bracketState.currentMatch?.roundIndex === roundIndex &&
                              bracketState.currentMatch?.matchIndex === matchIndex;
                            const matchParticipantsList = (match?.players || []).filter(Boolean);
                            const matchStatus = match?.status || (matchParticipantsList.length < 2 ? 'awaiting' : 'pending');
                            return (
                              <div
                                key={matchKey}
                                className={`p-3 rounded-lg border text-sm space-y-2 ${
                                  isCurrent
                                    ? 'border-blue-400 bg-blue-900/30'
                                    : match?.status === 'completed'
                                      ? 'border-green-400 bg-green-900/20'
                                      : match?.status === 'in-progress'
                                        ? 'border-purple-400 bg-purple-900/20'
                                        : 'border-gray-600 bg-gray-900/40'
                                }`}
                              >
                                <div className="flex items-center justify-between text-xs text-gray-400 uppercase">
                                  <span>Match {matchIndex + 1}</span>
                                  <span className="capitalize">{matchStatus.replace('-', ' ')}</span>
                                </div>
                                <div className="space-y-2">
                                  {(match?.players || []).map((playerId, idx) => {
                                    if (!playerId) {
                                      return (
                                        <div key={`${matchKey}-slot-${idx}`} className="text-xs text-gray-500 italic">
                                          TBD
                                        </div>
                                      );
                                    }
                                    const player = gameState?.players?.[playerId];
                                    const eliminated = eliminatedSet.has(playerId);
                                    const isWinner = match?.winner === playerId;
                                    return (
                                      <div key={`${matchKey}-${playerId}`} className="flex items-center justify-between text-sm text-white">
                                        <span>{getPlayerLabel(playerId)}</span>
                                        <span className="text-xs text-gray-400">
                                          {isWinner
                                            ? 'Winner'
                                            : eliminated && match?.status === 'completed'
                                              ? 'Eliminated'
                                              : player?.connected
                                                ? 'Connected'
                                                : 'Offline'}
                                        </span>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
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
                            src={getProxiedImageUrl(image.url)} 
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
              disabled={!canStartBattle}
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
          
          {!canStartBattle && connected && (
            <div className="mt-4 text-yellow-400">
              ⚠️ {!gameState?.target ? 'Set a target first' :
                   connectedPlayerCount < 2 ? 'Need at least two players connected' :
                   'Game not ready'}
            </div>
          )}
        </div>

        {/* API Connectivity Status */}
        <div className="bg-gray-800 rounded-lg p-6 mt-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold">API Connectivity Status</h2>
            <button
              onClick={fetchHealthStatus}
              className="text-blue-400 hover:text-blue-300 text-sm underline"
            >
              Refresh Status
            </button>
          </div>

          {healthStatus ? (
            <div className="space-y-4">
              {/* Overall Status */}
              <div className="flex items-center space-x-3">
                <div className={`w-4 h-4 rounded-full ${
                  healthStatus.status === 'healthy' ? 'bg-green-500' : 'bg-red-500'
                } animate-pulse`}></div>
                <span className="text-lg font-semibold">
                  System Status: {healthStatus.status === 'healthy' ? 'Healthy' : 'Issues Detected'}
                </span>
                <span className="text-sm text-gray-400">
                  Last updated: {new Date(healthStatus.timestamp).toLocaleTimeString()}
                </span>
              </div>

              {/* Service Status */}
              <div>
                <h3 className="font-semibold mb-3 text-gray-300">Service Status:</h3>
                <div className="grid md:grid-cols-2 gap-4">
                  {Object.entries(healthStatus.services || {}).map(([service, status]) => (
                    <div key={service} className="flex items-center justify-between p-3 bg-gray-700 rounded-lg">
                      <div className="flex items-center space-x-3">
                        <div className={`w-3 h-3 rounded-full ${
                          status === 'healthy' ? 'bg-green-500' :
                          status === 'unavailable' ? 'bg-yellow-500' : 'bg-red-500'
                        }`}></div>
                        <span className="font-medium">
                          {service === 'prompt-battle-server' ? 'Server' :
                           service === 'openai-dalle' ? 'Image Generation' : service}
                        </span>
                      </div>
                      <span className={`text-sm font-medium capitalize ${
                        status === 'healthy' ? 'text-green-400' :
                        status === 'unavailable' ? 'text-yellow-400' : 'text-red-400'
                      }`}>
                        {status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Game State Info */}
              <div>
                <h3 className="font-semibold mb-3 text-gray-300">Current State:</h3>
                <div className="grid md:grid-cols-3 gap-4">
                  <div className="p-3 bg-gray-700 rounded-lg">
                    <div className="text-sm text-gray-400">Phase</div>
                    <div className="font-semibold capitalize">{healthStatus.gameState?.phase || 'Unknown'}</div>
                  </div>
                  <div className="p-3 bg-gray-700 rounded-lg">
                    <div className="text-sm text-gray-400">Connected Players</div>
                    <div className="font-semibold">{healthStatus.gameState?.connectedPlayers || 0}/2</div>
                  </div>
                  <div className="p-3 bg-gray-700 rounded-lg">
                    <div className="text-sm text-gray-400">Target Set</div>
                    <div className="font-semibold">
                      {healthStatus.gameState?.hasTarget ?
                        <span className="text-green-400">✓ Yes</span> :
                        <span className="text-gray-400">✗ No</span>
                      }
                    </div>
                  </div>
                </div>
              </div>

              {/* Provider Information */}
              <div>
                <h3 className="font-semibold mb-3 text-gray-300">AI Provider Configuration:</h3>
                <div className="p-4 bg-gray-700 rounded-lg space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-400">Provider:</span>
                    <div className="flex items-center space-x-2">
                      <div className={`w-3 h-3 rounded-full ${
                        healthStatus.provider?.configured ? 'bg-green-500' : 'bg-red-500'
                      }`}></div>
                      <span className="font-mono font-medium">
                        {healthStatus.provider?.name || 'Unknown'}
                      </span>
                    </div>
                  </div>

                  {healthStatus.provider?.details && (
                    <div className="space-y-2">
                      <div className="text-xs text-gray-500 border-t border-gray-600 pt-2">
                        Azure Configuration Details:
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-400">Endpoint:</span>
                          <span className="font-mono">{healthStatus.provider.details.endpoint}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">API Version:</span>
                          <span className="font-mono">{healthStatus.provider.details.apiVersion}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">DALL-E Model:</span>
                          <span className="font-mono">{healthStatus.provider.details.dalleDeployment}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">GPT Model:</span>
                          <span className="font-mono">{healthStatus.provider.details.gptDeployment}</span>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="text-sm">
                    {healthStatus.services?.['openai-dalle'] === 'unavailable' && (
                      <div className="mt-3 p-3 bg-yellow-900/20 border border-yellow-500/20 rounded text-yellow-200">
                        <div className="font-medium mb-1">⚠️ AI Services Not Available</div>
                        <div className="text-xs">
                          Configure {healthStatus.provider?.type === 'azure' ? 'Azure OpenAI' : 'OpenAI API'} credentials in your .env file.
                          <br />See openai-setup.md for detailed setup instructions.
                        </div>
                      </div>
                    )}
                    {healthStatus.services?.['openai-dalle'] === 'healthy' && (
                      <div className="mt-3 p-3 bg-green-900/20 border border-green-500/20 rounded text-green-200">
                        <div className="font-medium mb-1">✅ AI Services Ready</div>
                        <div className="text-xs">
                          {healthStatus.provider?.name} is configured and ready for image generation and analysis.
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center space-x-3 text-gray-400">
              <div className="w-4 h-4 rounded-full bg-gray-500 animate-pulse"></div>
              <span>Loading system status...</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
