import React, { useState, useEffect, useRef, useMemo } from 'react';
import io from 'socket.io-client';
import QRCode from 'qrcode';
import { getSocketURL, getProxiedImageUrl } from '../utils/network';

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

    // Initialize birds in multiple flocks with variable sizes
    if (birds.length === 0) {
      const numFlocks = 4;
      // Random flock sizes: 16-24 birds each (2-3x bigger)
      const flockSizes = [
        Math.floor(Math.random() * 9) + 16, // 16-24
        Math.floor(Math.random() * 9) + 16, // 16-24
        Math.floor(Math.random() * 9) + 16, // 16-24
        Math.floor(Math.random() * 9) + 16  // 16-24
      ];

      for (let flock = 0; flock < numFlocks; flock++) {
        // Create flock center
        const flockCenterX = (Math.random() * 0.6 + 0.2) * canvas.width;
        const flockCenterY = (Math.random() * 0.6 + 0.2) * canvas.height;

        for (let i = 0; i < flockSizes[flock]; i++) {
          // Variable spacing within flock for more natural look
          const spacing = Math.random() * 150 + 50; // 50-200px spacing
          const angle = Math.random() * Math.PI * 2;

          birds.push({
            x: flockCenterX + Math.cos(angle) * spacing * Math.random(),
            y: flockCenterY + Math.sin(angle) * spacing * Math.random(),
            vx: (Math.random() - 0.5) * 0.8,
            vy: (Math.random() - 0.5) * 0.8,
            size: Math.random() * 4 + 6,
            flock: flock,
            reflockCooldown: 0, // Prevents rapid flock switching
            leadership: Math.random(), // 0-1, higher values = more likely to lead
            energy: 1.0 // Aerodynamic efficiency, affected by wake positions
          });
        }
      }
    }

    const resizeCanvas = () => {
      const parent = canvas.parentElement;
      if (parent) {
        // Constrain to viewport to prevent window expansion
        canvas.width = Math.min(parent.offsetWidth, window.innerWidth);
        canvas.height = Math.min(parent.offsetHeight, window.innerHeight);
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
        let vFormationX = 0, vFormationY = 0;
        let aerodynamicBoost = 0;
        let boundaryPressure = { x: 0, y: 0 };

        // Check other birds
        birds.forEach(other => {
          if (other === bird) return;
          const dx = other.x - bird.x;
          const dy = other.y - bird.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          // Improved separation with minimum distance enforcement
          const minDistance = bird.size + other.size + 8; // Minimum gap based on bird sizes
          const separationDistance = Math.max(minDistance, 30); // At least 30px separation

          if (dist < separationDistance) {
            const force = (separationDistance - dist) / separationDistance;
            repelX -= (dx / dist) * force * 2;
            repelY -= (dy / dist) * force * 2;
          }

          // Reflocking behavior - birds can switch flocks when they collide
          if (other.flock !== bird.flock && dist < 20 && bird.reflockCooldown <= 0) {
            // Count birds in each flock first
            const birdFlockSize = birds.filter(b => b.flock === bird.flock).length;
            const otherFlockSize = birds.filter(b => b.flock === other.flock).length;

            // Higher chance to join smaller flocks, lower chance to join large ones
            let joinChance = 0.02; // Base 2%
            if (otherFlockSize < birdFlockSize) joinChance = 0.04; // 4% to join smaller flock
            if (otherFlockSize > 25) joinChance = 0.005; // 0.5% to join large flocks

            if (Math.random() < joinChance) {
              bird.flock = other.flock;
              bird.reflockCooldown = 300; // 5 second cooldown
            }
          }

          // Flock splitting - birds break away from large flocks
          if (bird.reflockCooldown <= 0) {
            const currentFlockSize = birds.filter(b => b.flock === bird.flock).length;
            if (currentFlockSize > 30) {
              // Higher chance to break away from very large flocks
              if (Math.random() < 0.008) { // 0.8% chance per frame
                // Find an unused flock number or create new one
                const usedFlocks = new Set(birds.map(b => b.flock));
                let newFlock = bird.flock;
                for (let i = 0; i < 10; i++) {
                  if (!usedFlocks.has(i)) {
                    newFlock = i;
                    break;
                  }
                }
                bird.flock = newFlock;
                bird.reflockCooldown = 600; // Longer cooldown for splitting
              }
            }
          }

          // Cohesion and alignment only within same flock
          // Variable neighbor distance based on bird size for more natural spacing
          const neighborDistance = 70 + bird.size * 4; // Increased spacing: 94-110px range
          if (other.flock === bird.flock && dist < neighborDistance) {
            avgX += other.x;
            avgY += other.y;
            avgVx += other.vx;
            avgVy += other.vy;
            neighbors++;

            // Boundary pressure wave - birds near boundaries warn flockmates
            const margin = 60; // Detection zone around boundaries
            const pressureStrength = 0.15;

            // If other bird is near a boundary, it pushes this bird away from that boundary
            if (other.x < margin) { // Other bird near left wall
              boundaryPressure.x += pressureStrength * (margin - other.x) / margin;
            }
            if (other.x > canvas.width - margin) { // Other bird near right wall
              boundaryPressure.x -= pressureStrength * (margin - (canvas.width - other.x)) / margin;
            }
            if (other.y < margin) { // Other bird near top wall
              boundaryPressure.y += pressureStrength * (margin - other.y) / margin;
            }
            if (other.y > canvas.height - margin) { // Other bird near bottom wall
              boundaryPressure.y -= pressureStrength * (margin - (canvas.height - other.y)) / margin;
            }

            // Adaptive formation behavior based on flock size
            if (other.leadership > bird.leadership && dist < 80) {
              const flockMates = birds.filter(b => b.flock === bird.flock);
              const flockSize = flockMates.length;

              // Calculate relative position to the leader
              const leaderAngle = Math.atan2(other.vy, other.vx);
              const relativeAngle = Math.atan2(dy, dx) - leaderAngle;

              let formationStrength = 0.006; // Tripled formation force (3x from 0.002)

              if (flockSize <= 8) {
                // Small flocks: strongly prefer echelon/line formation
                const echelonAngle = Math.PI * 0.5; // 90 degrees (side)
                const echelonAngle2 = Math.PI * 1.5; // 270 degrees (other side)

                // Also add slight behind preference for lines
                const lineAngle1 = Math.PI * 0.7; // 126 degrees (behind-side)
                const lineAngle2 = Math.PI * 1.3; // 234 degrees (behind-other-side)

                let angleDiff1 = Math.abs(relativeAngle - echelonAngle);
                let angleDiff2 = Math.abs(relativeAngle - echelonAngle2);
                let angleDiff3 = Math.abs(relativeAngle - lineAngle1);
                let angleDiff4 = Math.abs(relativeAngle - lineAngle2);

                if (angleDiff1 > Math.PI) angleDiff1 = 2 * Math.PI - angleDiff1;
                if (angleDiff2 > Math.PI) angleDiff2 = 2 * Math.PI - angleDiff2;
                if (angleDiff3 > Math.PI) angleDiff3 = 2 * Math.PI - angleDiff3;
                if (angleDiff4 > Math.PI) angleDiff4 = 2 * Math.PI - angleDiff4;

                const minAngleDiff = Math.min(angleDiff1, angleDiff2, angleDiff3, angleDiff4);
                if (minAngleDiff < Math.PI / 2) { // Linear formation
                  aerodynamicBoost += (1 - minAngleDiff / (Math.PI / 2)) * 0.025;

                  let targetAngle = echelonAngle;
                  if (angleDiff2 === minAngleDiff) targetAngle = echelonAngle2;
                  else if (angleDiff3 === minAngleDiff) targetAngle = lineAngle1;
                  else if (angleDiff4 === minAngleDiff) targetAngle = lineAngle2;

                  const adjustAngle = leaderAngle + targetAngle;
                  vFormationX += Math.cos(adjustAngle) * formationStrength;
                  vFormationY += Math.sin(adjustAngle) * formationStrength;
                }
              } else {
                // Larger flocks: V-formation but less rigid
                const idealAngle1 = Math.PI * 0.75; // 135 degrees
                const idealAngle2 = Math.PI * 1.25; // 225 degrees

                let angleDiff1 = Math.abs(relativeAngle - idealAngle1);
                let angleDiff2 = Math.abs(relativeAngle - idealAngle2);
                if (angleDiff1 > Math.PI) angleDiff1 = 2 * Math.PI - angleDiff1;
                if (angleDiff2 > Math.PI) angleDiff2 = 2 * Math.PI - angleDiff2;

                const minAngleDiff = Math.min(angleDiff1, angleDiff2);
                if (minAngleDiff < Math.PI / 3) { // V-formation
                  aerodynamicBoost += (1 - minAngleDiff / (Math.PI / 3)) * 0.02;
                  const targetAngle = angleDiff1 < angleDiff2 ? idealAngle1 : idealAngle2;
                  const adjustAngle = leaderAngle + targetAngle;
                  vFormationX += Math.cos(adjustAngle) * formationStrength * 0.5; // Weaker for large flocks
                  vFormationY += Math.sin(adjustAngle) * formationStrength * 0.5;
                }
              }
            }
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

        // Apply flocking rules with massively enhanced linear bias
        if (neighbors > 0) {
          // Alignment - tripled again for extreme directional following
          const alignmentStrength = 0.12 + aerodynamicBoost; // 3x from 0.04 (6x original)
          bird.vx += (avgVx / neighbors - bird.vx) * alignmentStrength;
          bird.vy += (avgVy / neighbors - bird.vy) * alignmentStrength;

          // Cohesion - even weaker to prevent any circular clustering
          const cohesionStrength = 0.0002 + (bird.leadership * 0.0002); // 3x weaker
          bird.vx += ((avgX / neighbors) - bird.x) * cohesionStrength;
          bird.vy += ((avgY / neighbors) - bird.y) * cohesionStrength;
        }

        // Apply V-formation attraction (tripled again)
        bird.vx += vFormationX * 9; // 9x stronger (3x from 3x)
        bird.vy += vFormationY * 9;

        // Apply boundary pressure wave from flockmates
        bird.vx += boundaryPressure.x;
        bird.vy += boundaryPressure.y;

        // Add very strong directional momentum bias
        const currentSpeed = Math.sqrt(bird.vx * bird.vx + bird.vy * bird.vy);
        if (currentSpeed > 0) {
          // Much stronger bias toward current direction
          const momentumBias = 0.03; // 3x from 0.01
          bird.vx += (bird.vx / currentSpeed) * momentumBias;
          bird.vy += (bird.vy / currentSpeed) * momentumBias;
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

        // Separation - stronger to maintain minimum distances, with asymmetric spacing
        const separationStrength = 0.12 + (Math.sin(bird.x * 0.01) * 0.03); // Asymmetric variation
        bird.vx += repelX * separationStrength;
        bird.vy += repelY * (separationStrength + Math.cos(bird.y * 0.01) * 0.03);

        // Add stronger turbulence to break circular patterns
        const turbulence = 0.006; // 3x from 0.002
        bird.vx += (Math.sin(bird.x * 0.02 + Date.now() * 0.0001) * turbulence);
        bird.vy += (Math.cos(bird.y * 0.015 + Date.now() * 0.0001) * turbulence);

        // Forceful boundary bounce - decisive reflection away from edges
        const margin = 40;
        const speedAtBoundary = Math.sqrt(bird.vx * bird.vx + bird.vy * bird.vy);
        const bounceForce = 1.5; // Very strong bounce

        if (bird.x < margin) {
          // Complete velocity reversal + strong push away
          bird.vx = Math.abs(bird.vx) * 1.5 + bounceForce; // Reverse and amplify
          // Keep parallel component but reduce to prevent sliding
          bird.vy *= 0.3;
        }
        if (bird.x > canvas.width - margin) {
          bird.vx = -Math.abs(bird.vx) * 1.5 - bounceForce;
          bird.vy *= 0.3;
        }
        if (bird.y < margin) {
          bird.vy = Math.abs(bird.vy) * 1.5 + bounceForce;
          bird.vx *= 0.3;
        }
        if (bird.y > canvas.height - margin) {
          bird.vy = -Math.abs(bird.vy) * 1.5 - bounceForce;
          bird.vx *= 0.3;
        }

        // Limit speed and maintain stronger minimum momentum
        const speed = Math.sqrt(bird.vx * bird.vx + bird.vy * bird.vy);
        const maxSpeed = 1.5; // Faster to overcome stronger forces
        const minSpeed = 0.5; // Higher minimum to prevent getting stuck

        if (speed > maxSpeed) {
          bird.vx = (bird.vx / speed) * maxSpeed;
          bird.vy = (bird.vy / speed) * maxSpeed;
        } else if (speed < minSpeed && speed > 0) {
          // Boost slow birds to maintain momentum
          bird.vx = (bird.vx / speed) * minSpeed;
          bird.vy = (bird.vy / speed) * minSpeed;
        } else if (speed === 0) {
          // Give stuck birds a stronger random kick
          bird.vx = (Math.random() - 0.5) * minSpeed * 2;
          bird.vy = (Math.random() - 0.5) * minSpeed * 2;
        }

        // Update position
        bird.x += bird.vx;
        bird.y += bird.vy;

        // Update cooldown
        if (bird.reflockCooldown > 0) {
          bird.reflockCooldown--;
        }

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
      style={{
        zIndex: 1,
        maxHeight: '100vh',
        maxWidth: '100vw'
      }}
    />
  );
};

const DEFAULT_ROUND_LABELS = [
  { players: 2, label: 'Final' },
  { players: 4, label: 'Semifinals' },
  { players: 8, label: 'Quarterfinals' },
  { players: 16, label: 'Round of 16' },
  { players: 32, label: 'Round of 32' },
  { players: 64, label: 'Round of 64' }
];

const toPlayerId = (value) => {
  if (value === undefined || value === null) return null;
  return String(value);
};

const getRoundLabel = (round, roundIndex, totalRounds) => {
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
};

const getPlayerAvatarUrl = (player) => {
  if (!player) return null;
  return player.avatar || player.avatarUrl || player.imageUrl || player.image || null;
};

export default function CentralDisplay() {
  const [socket, setSocket] = useState(null);
  const [gameState, setGameState] = useState(null);
  const [prompts, setPrompts] = useState({});
  const [timer, setTimer] = useState(0);
  const [images, setImages] = useState({});
  const [qrCodes, setQrCodes] = useState({});
  const [gptScoring, setGptScoring] = useState(null);
  const [scoringLoading, setScoringLoading] = useState(false);
  const [bracket, setBracket] = useState(null);
  const [currentMatchLocator, setCurrentMatchLocator] = useState(null);
  const [matchReadyInfo, setMatchReadyInfo] = useState(null);
  const [eliminatedPlayers, setEliminatedPlayers] = useState([]);
  const [bracketChampion, setBracketChampion] = useState(null);
  const waitingContainerRef = useRef(null);
  const [playerBoxes, setPlayerBoxes] = useState([]);
  const previousPhaseRef = useRef();
  const qrCodesRef = useRef({});

  useEffect(() => {
    qrCodesRef.current = qrCodes;
  }, [qrCodes]);

  const playerSlotCount = useMemo(() => {
    const reserved = Number(gameState?.playerSlots) || 0;
    const highestConnected = Object.keys(gameState?.players || {}).reduce((max, id) => {
      const numericId = Number(id);
      if (!Number.isFinite(numericId)) return max;
      return Math.max(max, numericId);
    }, 0);
    return Math.max(reserved, highestConnected, 2);
  }, [gameState?.playerSlots, gameState?.players]);

  const slotIds = useMemo(
    () => Array.from({ length: playerSlotCount }, (_, idx) => idx + 1),
    [playerSlotCount]
  );
  
  // Update player box positions for flocking birds
  useEffect(() => {
    const updatePlayerBoxes = () => {
      if (!waitingContainerRef.current) return;
      const containerRect = waitingContainerRef.current.getBoundingClientRect();
      const columns = playerSlotCount >= 5 ? 3 : Math.max(Math.min(playerSlotCount, 2), 1);
      const rows = Math.max(Math.ceil(playerSlotCount / columns), 1);
      const cardWidth = columns > 0 ? (containerRect.width / columns) * 0.6 : containerRect.width * 0.8;
      const cardHeight = Math.min(300, (containerRect.height / rows) * 0.7);

      const boxes = [];
      for (let index = 0; index < playerSlotCount; index++) {
        const col = index % columns;
        const row = Math.floor(index / columns);
        const centerX = containerRect.width * (col + 0.5) / columns;
        const x = centerX - cardWidth / 2;
        const y = containerRect.height * 0.2 + row * (cardHeight + 40);
        boxes.push({ x, y, width: cardWidth, height: cardHeight });
      }

      setPlayerBoxes(boxes);
    };

    updatePlayerBoxes();
    window.addEventListener('resize', updatePlayerBoxes);
    return () => window.removeEventListener('resize', updatePlayerBoxes);
  }, [gameState?.phase, playerSlotCount]);

  // Generate QR codes for all reserved player slots
  useEffect(() => {
    const generateQRCodes = async () => {
      const baseUrl = window.location.origin;
      const updates = {};

      for (let i = 1; i <= playerSlotCount; i++) {
        const key = String(i);
        if (qrCodesRef.current[key]) continue;

        try {
          const playerUrl = `${baseUrl}/player/${key}`;
          const qrDataURL = await QRCode.toDataURL(playerUrl, {
            width: 200,
            margin: 2,
            color: { dark: '#000000', light: '#FFFFFF' }
          });
          updates[key] = qrDataURL;
        } catch (error) {
          console.error(`Error generating QR code for player ${key}:`, error);
        }
      }

      if (Object.keys(updates).length > 0) {
        qrCodesRef.current = { ...qrCodesRef.current, ...updates };
        setQrCodes(prev => ({ ...prev, ...updates }));
      }
    };

    generateQRCodes();
  }, [playerSlotCount]);
  
  // Socket connection with all events
  useEffect(() => {
    const socketURL = getSocketURL();
    const newSocket = io(socketURL, {
      transports: ['websocket', 'polling']
    });

    const handleConnect = () => {
      console.log('Central Display connected');
      newSocket.emit('join-display');
    };

    const handleGameState = (state) => {
      console.log('Game state updated:', state);
      setGameState(state);
      if (state.generatedImages) {
        setImages(state.generatedImages);
      }

      if ('bracket' in state) {
        setBracket(state.bracket || null);
      }
      if ('currentMatch' in state) {
        setCurrentMatchLocator(state.currentMatch || null);
      }
      if ('eliminatedPlayers' in state) {
        setEliminatedPlayers(Array.isArray(state.eliminatedPlayers) ? state.eliminatedPlayers : []);
      }

      if (state?.competitionMode === 'knockout') {
        if (state.competitionActive) {
          setBracketChampion(null);
        } else if (state.winner) {
          setBracketChampion(state.winner);
        }
      } else {
        setBracket(null);
        setCurrentMatchLocator(null);
        setMatchReadyInfo(null);
        setEliminatedPlayers([]);
        setBracketChampion(null);
      }
    };

    const handlePromptUpdate = ({ playerId, prompt }) => {
      setPrompts(prev => ({ ...prev, [playerId]: prompt }));
    };

    const handleBattleStarted = ({ duration }) => {
      setTimer(duration);
      setPrompts({});
      setImages({});
      setGptScoring(null);
      setScoringLoading(false);
      setMatchReadyInfo(null);
    };

    const handleTimerUpdate = (timeLeft) => {
      setTimer(timeLeft);
    };

    const handleImagesReady = (generatedImages) => {
      setImages(generatedImages);
    };

    const handleWinnerSelected = (winnerId) => {
      console.log('Winner selected:', winnerId);
    };

    const handleGameReset = () => {
      console.log('Game reset received, clearing display state');
      setPrompts({});
      setImages({});
      setTimer(0);
      setHasGeneratedNextPlayer(false);
      setGptScoring(null);
      setScoringLoading(false);
      setBracket(null);
      setCurrentMatchLocator(null);
      setMatchReadyInfo(null);
      setEliminatedPlayers([]);
      setBracketChampion(null);
    };

    const handleGptScoringResult = (result) => {
      console.log('GPT scoring result received:', result);
      setGptScoring(result);
      setScoringLoading(false);
    };

    const handleGptScoringError = (error) => {
      console.error('GPT scoring error:', error);
      setScoringLoading(false);
      alert(`GPT Scoring Error: ${error}`);
    };

    const handleBracketUpdated = ({ bracket, currentMatch, eliminatedPlayers }) => {
      setBracket(bracket || null);
      setCurrentMatchLocator(currentMatch || null);
      setEliminatedPlayers(Array.isArray(eliminatedPlayers) ? eliminatedPlayers : []);
      if (currentMatch) {
        setBracketChampion(null);
      }
      if (!currentMatch) {
        setMatchReadyInfo(null);
      }
    };

    const handleMatchReady = (payload = null) => {
      setMatchReadyInfo(payload);
      if (payload?.roundIndex !== undefined && payload?.matchIndex !== undefined) {
        setCurrentMatchLocator({ roundIndex: payload.roundIndex, matchIndex: payload.matchIndex });
      }
    };

    const handleBracketFinished = ({ bracket, champion }) => {
      if (bracket) {
        setBracket(bracket);
      }
      if (champion) {
        setBracketChampion(champion);
      }
      setCurrentMatchLocator(null);
      setMatchReadyInfo(null);
    };

    newSocket.on('connect', handleConnect);
    newSocket.on('game-state', handleGameState);
    newSocket.on('prompt-update', handlePromptUpdate);
    newSocket.on('battle-started', handleBattleStarted);
    newSocket.on('timer-update', handleTimerUpdate);
    newSocket.on('images-ready', handleImagesReady);
    newSocket.on('winner-selected', handleWinnerSelected);
    newSocket.on('game-reset', handleGameReset);
    newSocket.on('gpt-scoring-result', handleGptScoringResult);
    newSocket.on('gpt-scoring-error', handleGptScoringError);
    newSocket.on('bracket-updated', handleBracketUpdated);
    newSocket.on('match-ready', handleMatchReady);
    newSocket.on('bracket-finished', handleBracketFinished);

    setSocket(newSocket);

    return () => {
      newSocket.off('connect', handleConnect);
      newSocket.off('game-state', handleGameState);
      newSocket.off('prompt-update', handlePromptUpdate);
      newSocket.off('battle-started', handleBattleStarted);
      newSocket.off('timer-update', handleTimerUpdate);
      newSocket.off('images-ready', handleImagesReady);
      newSocket.off('winner-selected', handleWinnerSelected);
      newSocket.off('game-reset', handleGameReset);
      newSocket.off('gpt-scoring-result', handleGptScoringResult);
      newSocket.off('gpt-scoring-error', handleGptScoringError);
      newSocket.off('bracket-updated', handleBracketUpdated);
      newSocket.off('match-ready', handleMatchReady);
      newSocket.off('bracket-finished', handleBracketFinished);
      newSocket.close();
    };
  }, []);

  useEffect(() => {
    const previousPhase = previousPhaseRef.current;
    const currentPhase = gameState?.phase;

    if (currentPhase && currentPhase !== previousPhase) {
      if (currentPhase === 'ready' || currentPhase === 'waiting') {
        setPrompts({});
        setImages({});
        setGptScoring(null);
        setScoringLoading(false);
      }
    }

    previousPhaseRef.current = currentPhase;
  }, [gameState?.phase]);
  
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

  const playersById = gameState?.players || {};
  const isKnockoutMode = gameState?.competitionMode === 'knockout'
    || (Array.isArray(bracket?.rounds) && bracket.rounds.length > 0);
  const bracketRounds = useMemo(
    () => (Array.isArray(bracket?.rounds) ? bracket.rounds : []),
    [bracket]
  );
  const eliminatedSet = useMemo(() => {
    const entries = Array.isArray(eliminatedPlayers) ? eliminatedPlayers : [];
    return new Set(entries.map(id => toPlayerId(id)).filter(Boolean));
  }, [eliminatedPlayers]);
  const activeMatch = useMemo(() => {
    if (matchReadyInfo?.match?.players) {
      return { ...matchReadyInfo.match };
    }
    if (!bracket || !currentMatchLocator) return null;
    return bracket.rounds?.[currentMatchLocator.roundIndex]?.matches?.[currentMatchLocator.matchIndex] || null;
  }, [bracket, currentMatchLocator, matchReadyInfo]);
  const defaultSeriesPlayers = useMemo(
    () => Object.keys(playersById).sort((a, b) => Number(a) - Number(b)),
    [playersById]
  );
  const promptPlayers = useMemo(() => {
    if (isKnockoutMode) {
      const rawPlayers = Array.isArray(activeMatch?.players) ? activeMatch.players.slice(0, 2) : [];
      const normalized = rawPlayers.map(toPlayerId);
      while (normalized.length < 2) {
        normalized.push(null);
      }
      return normalized;
    }
    if (defaultSeriesPlayers.length >= 2) {
      return defaultSeriesPlayers.slice(0, 2);
    }
    return ['1', '2'];
  }, [isKnockoutMode, activeMatch, defaultSeriesPlayers]);
  const promptHighlightSet = useMemo(
    () => new Set(promptPlayers.filter(Boolean)),
    [promptPlayers]
  );
  const activeMatchDescriptor = useMemo(() => {
    if (!isKnockoutMode) return null;
    if (!bracketRounds.length) return null;
    if (!currentMatchLocator) {
      return 'Awaiting next matchup';
    }
    const { roundIndex, matchIndex } = currentMatchLocator;
    const round = bracketRounds[roundIndex];
    const roundLabel = getRoundLabel(round, roundIndex, bracketRounds.length);
    return `${roundLabel} • Match ${matchIndex + 1}`;
  }, [isKnockoutMode, bracketRounds, currentMatchLocator]);
  const championId = isKnockoutMode
    ? toPlayerId(bracketChampion ?? (!gameState?.competitionActive ? gameState?.winner : null))
    : null;
  const championPlayer = championId ? playersById[championId] : null;
  const championAvatar = championPlayer ? getPlayerAvatarUrl(championPlayer) : null;
  const championAvatarSrc = championAvatar ? getProxiedImageUrl(championAvatar) : null;
  const timerHighlight = isKnockoutMode && !!(Array.isArray(activeMatch?.players)
    && activeMatch.players.filter(Boolean).length === 2);

  const roundGoal = gameState?.competitionConfig?.roundLimit || null;
  const pointGoal = gameState?.competitionConfig?.pointLimit || null;
  const roundsPlayed = gameState?.roundsPlayed || 0;
  const leaderScore = standings[0]?.score || 0;
  const roundProgress = roundGoal ? Math.min(roundsPlayed / roundGoal, 1) : 0;
  const pointProgress = pointGoal ? Math.min(leaderScore / pointGoal, 1) : 0;
  const activeRoundNumber = gameState?.competitionActive
    ? (gameState.roundNumber || roundsPlayed + 1)
    : roundsPlayed;
  const showCompetitionSummary = !isKnockoutMode
    && ((standings.length > 0) || gameState?.competitionActive || !!roundGoal || !!pointGoal);

  const resolvePlayerName = (playerId) => {
    if (!playerId) return 'TBD';
    const player = playersById[playerId];
    return player?.displayName || `Player ${playerId}`;
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
        if (isKnockoutMode && championId) {
          return `${resolvePlayerName(championId)} is Champion!`;
        }
        return gameState?.winner ? `${resolvePlayerName(gameState.winner)} Wins!` : 'Prompt Battle';
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
            <div className="flex items-center gap-2 relative z-10 bg-white px-1">
              {isKnockoutMode && activeMatchDescriptor && (
                <div
                  className="text-[10px] font-bold uppercase tracking-wide border border-black px-2 py-0.5 bg-yellow-200"
                  style={{ boxShadow: '2px 2px 0px #999' }}
                >
                  {activeMatchDescriptor}
                </div>
              )}
              {gameState?.phase === 'battling' && (
                <div
                  className={`flex items-center gap-1 ${timerHighlight ? 'border border-blue-600 bg-blue-100 px-1 py-0.5 rounded-sm' : ''}`}
                  style={timerHighlight ? { boxShadow: '2px 2px 0px #2563eb' } : undefined}
                >
                  <div className="w-2 h-2 border border-black bg-white relative">
                    <div className="absolute top-0 left-0.5 w-0.5 h-1 bg-black"></div>
                    <div className="absolute top-0.5 left-0 w-1 h-0.5 bg-black"></div>
                  </div>
                  <span className={`text-xs font-bold font-mono ${timer <= 10 ? 'animate-pulse text-red-600' : timerHighlight ? 'text-blue-700' : 'text-black'}`}>
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

            {isKnockoutMode && championId && (
              <div
                className="border-4 border-black bg-yellow-200 p-6 mb-6 text-center"
                style={{ boxShadow: '6px 6px 0px black' }}
              >
                <div className="flex flex-col items-center space-y-3">
                  <div className="text-3xl font-extrabold tracking-widest">🏆 Champion Crowned 🏆</div>
                  {championAvatarSrc && (
                    <img
                      src={championAvatarSrc}
                      alt={`${resolvePlayerName(championId)} avatar`}
                      className="w-24 h-24 object-cover border-2 border-black bg-white"
                    />
                  )}
                  <div className="text-2xl font-bold">{resolvePlayerName(championId)}</div>
                  <div className="text-sm font-medium uppercase tracking-wide">Knockout Bracket Winner</div>
                </div>
              </div>
            )}

            {isKnockoutMode && bracketRounds.length > 0 && (
              <div
                className="border-2 border-black bg-white p-4 mb-6 overflow-x-auto"
                style={{ boxShadow: '3px 3px 0px black' }}
              >
                <div className="flex items-start gap-4" style={{ minWidth: `${Math.max(1, bracketRounds.length) * 220}px` }}>
                  {bracketRounds.map((round, roundIndex) => {
                    const roundLabel = getRoundLabel(round, roundIndex, bracketRounds.length);
                    return (
                      <div key={`round-${roundIndex}`} className="min-w-[200px]">
                        <div
                          className="border border-black bg-gray-200 text-center font-bold uppercase text-xs py-1"
                          style={{ boxShadow: '2px 2px 0px #777' }}
                        >
                          {roundLabel}
                        </div>
                        <div className="flex flex-col gap-3 mt-3">
                          {(round.matches || []).map((match, matchIndex) => {
                            const playersForMatch = Array.isArray(match?.players) ? match.players.slice(0, 2) : [];
                            while (playersForMatch.length < 2) {
                              playersForMatch.push(null);
                            }
                            const normalizedPlayers = playersForMatch.map(toPlayerId);
                            const isActiveMatch = !!(currentMatchLocator
                              && roundIndex === currentMatchLocator.roundIndex
                              && matchIndex === currentMatchLocator.matchIndex);
                            const isCurrentBattle = isActiveMatch && gameState?.phase === 'battling';
                            const winnerId = toPlayerId(match?.winner);
                            const status = match?.status === 'completed' || winnerId
                              ? 'completed'
                              : match?.status === 'in-progress' || isCurrentBattle
                                ? 'in-progress'
                                : 'pending';
                            const statusLabel = status === 'completed'
                              ? 'Completed'
                              : status === 'in-progress'
                                ? 'In Progress'
                                : 'Pending';
                            const matchBackground = status === 'completed'
                              ? '#ECFCCB'
                              : status === 'in-progress'
                                ? '#FEF3C7'
                                : '#F3F4F6';
                            const matchBoxShadow = isActiveMatch ? '4px 4px 0px #2563eb' : '3px 3px 0px #555';

                            return (
                              <div
                                key={match?.id || `${roundIndex}-${matchIndex}`}
                                className={`border-2 ${isActiveMatch ? 'border-blue-600' : 'border-black'} bg-white p-3`}
                                style={{ backgroundColor: matchBackground, boxShadow: matchBoxShadow }}
                              >
                                <div className="flex items-center justify-between text-[10px] font-bold uppercase mb-2">
                                  <span>Match {matchIndex + 1}</span>
                                  <span>{statusLabel}</span>
                                </div>
                                <div className="space-y-2">
                                  {normalizedPlayers.map((playerId, slotIdx) => {
                                    const player = playerId ? playersById[playerId] : null;
                                    const avatarUrl = getPlayerAvatarUrl(player);
                                    const avatarSrc = avatarUrl ? getProxiedImageUrl(avatarUrl) : null;
                                    const displayName = playerId ? resolvePlayerName(playerId) : 'Awaiting Challenger';
                                    const playerRowActive = isActiveMatch && !!playerId;
                                    const isWinner = !!winnerId && playerId === winnerId;
                                    const isLoser = status === 'completed' && winnerId && playerId && winnerId !== playerId;
                                    const isEliminated = !!playerId && !isWinner && (isLoser || eliminatedSet.has(playerId));
                                    let statusText;
                                    if (!playerId) {
                                      statusText = 'Awaiting player';
                                    } else if (isWinner) {
                                      statusText = 'Winner';
                                    } else if (isEliminated) {
                                      statusText = 'Eliminated';
                                    } else {
                                      statusText = player?.connected ? 'Connected' : 'Offline';
                                    }
                                    const statusClass = isWinner
                                      ? 'text-green-700 font-bold'
                                      : isEliminated
                                        ? 'text-gray-500'
                                        : 'text-gray-700';

                                    return (
                                      <div
                                        key={`${match?.id || `${roundIndex}-${matchIndex}`}-${slotIdx}`}
                                        className={`flex items-center gap-2 px-2 py-2 border ${playerRowActive ? 'border-blue-500 bg-blue-50' : 'border-black bg-white'}`}
                                        style={{ boxShadow: '1px 1px 0px #777' }}
                                      >
                                        {avatarSrc ? (
                                          <img
                                            src={avatarSrc}
                                            alt={`${displayName} avatar`}
                                            className="w-8 h-8 object-cover border border-black bg-white"
                                          />
                                        ) : (
                                          <div className="w-8 h-8 border border-black bg-white flex items-center justify-center text-xs font-bold">
                                            {playerId ? `P${playerId}` : '?'}
                                          </div>
                                        )}
                                        <div>
                                          <div className={`text-sm font-bold ${isWinner ? 'text-green-700' : 'text-black'}`}>{displayName}</div>
                                          <div className={`text-[10px] ${statusClass}`}>{statusText}</div>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                                {winnerId && (
                                  <div className="mt-3 text-[11px] font-bold flex items-center gap-1 text-green-700">
                                    <span role="img" aria-label="Trophy">🏆</span>
                                    <span>{resolvePlayerName(winnerId)}</span>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {showCompetitionSummary && (
              <div
                className="border-2 border-black bg-white p-4 mb-6"
                style={{ boxShadow: '3px 3px 0px black' }}
              >
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-4">
                  <div>
                    <h3 className="font-bold" style={{ fontSize: '24px' }}>Competition Standings</h3>
                    <p style={{ fontSize: '12px' }}>
                      {gameState?.competitionActive
                        ? `Round ${Math.max(1, activeRoundNumber || 1)} in progress`
                        : roundsPlayed > 0
                          ? `Completed ${roundsPlayed} ${roundsPlayed === 1 ? 'round' : 'rounds'}`
                          : 'Awaiting competition start'}
                    </p>
                  </div>
                  <div className="text-right" style={{ fontSize: '12px' }}>
                    {roundGoal && <div>Round goal: {roundGoal}</div>}
                    {pointGoal && <div>Point goal: {pointGoal}</div>}
                  </div>
                </div>

                {roundGoal && (
                  <div className="mb-4">
                    <div className="flex justify-between" style={{ fontSize: '10px' }}>
                      <span>Round Progress</span>
                      <span>{Math.min(roundsPlayed, roundGoal)}/{roundGoal} completed</span>
                    </div>
                    <div className="h-3 border border-black bg-gray-200 relative">
                      <div
                        className="bg-blue-500 h-full"
                        style={{ width: `${Math.min(100, Math.round(roundProgress * 100))}%` }}
                      ></div>
                    </div>
                  </div>
                )}

                {pointGoal && (
                  <div className="mb-4">
                    <div className="flex justify-between" style={{ fontSize: '10px' }}>
                      <span>Point Progress</span>
                      <span>{leaderScore}/{pointGoal} pts</span>
                    </div>
                    <div className="h-3 border border-black bg-gray-200 relative">
                      <div
                        className="bg-green-500 h-full"
                        style={{ width: `${Math.min(100, Math.round(pointProgress * 100))}%` }}
                      ></div>
                    </div>
                  </div>
                )}

                {standings.length > 0 ? (
                  <div className="grid md:grid-cols-2 gap-3">
                    {standings.map((entry, index) => (
                      <div
                        key={entry.playerId}
                        className={`border border-black px-3 py-3 flex items-center justify-between ${
                          index === 0 ? 'bg-yellow-200' : 'bg-gray-100'
                        }`}
                        style={{ boxShadow: '2px 2px 0px #555' }}
                      >
                        <div className="flex items-center space-x-3">
                          <div
                            className="w-8 h-8 border border-black bg-white flex items-center justify-center font-bold"
                            style={{ fontSize: '14px' }}
                          >
                            #{index + 1}
                          </div>
                          <div>
                          <div className="font-bold" style={{ fontSize: '16px' }}>{resolvePlayerName(entry.playerId)}</div>
                            <div style={{ fontSize: '10px' }}>
                              {entry.connected ? 'Connected' : 'Offline'}
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-bold" style={{ fontSize: '20px' }}>{entry.score}</div>
                          {pointGoal && pointGoal > 0 && (
                            <div style={{ fontSize: '10px' }}>
                              {Math.round((entry.score / pointGoal) * 100)}%
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center" style={{ fontSize: '12px' }}>
                    Competition stats will appear once the series begins.
                  </div>
                )}
              </div>
            )}

            {/* Live Prompts Display */}
            {gameState?.phase === 'battling' && (
              <div className="mb-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                  {promptPlayers.map((playerId, index) => {
                    const normalizedId = playerId ? toPlayerId(playerId) : null;
                    const key = normalizedId || `slot-${index}`;
                    const player = normalizedId ? playersById[normalizedId] : null;
                    const avatarUrl = getPlayerAvatarUrl(player);
                    const avatarSrc = avatarUrl ? getProxiedImageUrl(avatarUrl) : null;
                    const displayName = normalizedId
                      ? resolvePlayerName(normalizedId)
                      : `Awaiting ${index === 0 ? 'Challenger' : 'Opponent'}`;
                    const statusText = normalizedId
                      ? (player?.connected ? 'Connected' : 'Offline')
                      : 'Awaiting player';
                    const promptText = normalizedId
                      ? (prompts[normalizedId] || 'Thinking...')
                      : 'Waiting for competitor';
                    const isActiveSlot = isKnockoutMode ? !!(normalizedId && promptHighlightSet.has(normalizedId)) : true;
                    const cardBorderClass = isKnockoutMode && isActiveSlot ? 'border-blue-600 bg-blue-50' : 'border-black bg-white';
                    const cardShadow = isKnockoutMode && isActiveSlot ? '4px 4px 0px #2563eb' : '2px 2px 0px #999';
                    const promptBorderClass = isKnockoutMode && isActiveSlot ? 'border-blue-400 bg-blue-50' : 'border-black bg-gray-50';
                    const promptBoxShadow = isKnockoutMode && isActiveSlot ? 'inset 2px 2px 0px #2563eb' : 'inset 1px 1px 0px #999';
                    const showCursor = normalizedId && prompts[normalizedId];
                    return (
                      <div
                        key={key}
                        className={`border-2 ${cardBorderClass} p-3`}
                        style={{ boxShadow: cardShadow }}
                      >
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-3">
                            {avatarSrc ? (
                              <img
                                src={avatarSrc}
                                alt={`${displayName} avatar`}
                                className="w-12 h-12 object-cover border border-black bg-white"
                              />
                            ) : (
                              <div className="w-12 h-12 border border-black bg-white flex items-center justify-center text-sm font-bold">
                                {normalizedId ? `P${normalizedId}` : '?'}
                              </div>
                            )}
                            <div className="text-left">
                              <h3 className="font-bold" style={{ fontSize: '18px' }}>{displayName}</h3>
                              <div style={{ fontSize: '10px' }}>{statusText}</div>
                            </div>
                          </div>
                          {isKnockoutMode && isActiveSlot && (
                            <span className="text-[10px] font-bold uppercase text-blue-700">Active Match</span>
                          )}
                        </div>
                        <div
                          className={`border ${promptBorderClass} p-2 min-h-24 break-words whitespace-pre-wrap`}
                          style={{
                            boxShadow: promptBoxShadow,
                            fontFamily: 'Chicago, monospace',
                            fontSize: '14px',
                            wordWrap: 'break-word',
                            overflowWrap: 'break-word'
                          }}
                        >
                          {promptText}
                          {showCursor && <span className="animate-pulse">|</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Big Countdown Timer */}
                <div className="text-center mb-4">
                  <div
                    className={`border-2 inline-block px-8 py-4 ${timerHighlight ? 'border-blue-600 bg-blue-50' : 'border-black bg-white'}`}
                    style={{ boxShadow: timerHighlight ? '6px 6px 0px #2563eb' : '4px 4px 0px black' }}
                  >
                    <div
                      className={`font-bold font-mono ${timer <= 10 ? 'animate-pulse text-red-600' : timerHighlight ? 'text-blue-700' : 'text-black'}`}
                      style={{ fontSize: '72px', fontFamily: 'Chicago, "SF Pro Display", system-ui, monospace' }}
                    >
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

                    {nextChallengerId ? (
                      <>
                        <h4 className="font-bold mb-4" style={{ fontSize: '24px' }}>
                          Player {nextChallengerId}
                        </h4>

                        <div className="mb-4">
                          {qrCodes[String(nextChallengerId)] ? (
                            <img
                              src={qrCodes[String(nextChallengerId)]}
                              alt={`QR Code for Player ${nextChallengerId}`}
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
                            {window.location.origin}/player/{nextChallengerId}
                          </p>
                        </div>
                      </>
                    ) : (
                      <div className="space-y-3" style={{ fontSize: '14px' }}>
                        <p>All player slots are currently full.</p>
                        <p>Ask an admin to add another slot to keep the battles rolling!</p>
                      </div>
                    )}
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

                <div className={waitingGridClass}>
                  {slotIds.map((playerId) => {
                    const slotKey = String(playerId);
                    const player = gameState?.players?.[slotKey];

                    return (
                      <div key={playerId} className="border-2 border-black p-6 bg-white" style={{
                        boxShadow: '4px 4px 0px #999'
                      }}>
                        <h3 className="font-bold mb-4" style={{ fontSize: '24px' }}>
                          Player {playerId}
                        </h3>

                        <div className="mb-4">
                          {qrCodes[slotKey] ? (
                            <img
                              src={qrCodes[slotKey]}
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
                            Status: {player?.connected ? '✓ Connected' : '○ Waiting...'}
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
                    );
                  })}
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