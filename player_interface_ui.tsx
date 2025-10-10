import React, { useState, useEffect, useMemo } from 'react';

const GAME_STATE_META = {
  waiting: {
    title: 'Waiting for battle lobby',
    description: 'Hang tight while the host assembles the next creative showdown.',
    accent: '#a855f7',
    icon: '⌛'
  },
  ready: {
    title: 'Get ready to create',
    description: 'Preview the challenge so you can hit the ground running when the timer starts.',
    accent: '#22d3ee',
    icon: '🚀'
  },
  writing: {
    title: 'Craft your winning prompt',
    description: 'Use precise visual language, strong verbs, and intentional stylistic cues to guide the model.',
    accent: '#38bdf8',
    icon: '🎨'
  },
  submitted: {
    title: 'Generating your masterpiece',
    description: 'Sit back for a moment while the art engine interprets your instructions.',
    accent: '#f97316',
    icon: '✨'
  },
  results: {
    title: 'Battle complete!',
    description: 'Head to the main display to see how your prompt performed against the competition.',
    accent: '#34d399',
    icon: '🏁'
  }
} as const;

export default function PlayerInterface() {
  const [prompt, setPrompt] = useState('');
  const [timeLeft, setTimeLeft] = useState(60);
  const [gameState, setGameState] = useState<'waiting' | 'ready' | 'writing' | 'submitted' | 'results'>('waiting');
  const [connected] = useState(true);
  const [playerId] = useState('Player 1');

  const target = 'Create a majestic dragon soaring through a storm-filled sky';

  useEffect(() => {
    if (gameState === 'writing' && timeLeft > 0) {
      const timer = setTimeout(() => setTimeLeft((current) => current - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [timeLeft, gameState]);

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainder = (seconds % 60).toString().padStart(2, '0');
    return `${minutes}:${remainder}`;
  };

  const progress = useMemo(() => {
    if (gameState !== 'writing') return 0;
    return 1 - Math.max(0, timeLeft) / 60;
  }, [gameState, timeLeft]);

  const meta = GAME_STATE_META[gameState];

  const renderStateContent = () => {
    switch (gameState) {
      case 'waiting':
        return (
          <div className="text-center space-y-6">
            <div className="flex justify-center">
              <div className="status-orb waiting">
                <span className="orb-glow" />
                <span className="orb-glow delay" />
                <span className="orb-inner">{meta.icon}</span>
              </div>
            </div>
            <div className="space-y-2">
              <h2 className="state-title">Waiting for Battle to Begin</h2>
              <p className="state-description">
                Get ready to unleash your creativity—your prompt-writing duel is moments away.
              </p>
            </div>
            <div className="pill-row">
              {['Warm up your imagination', 'Review your techniques', 'Hydrate 💧'].map((hint) => (
                <span key={hint} className="pill">
                  {hint}
                </span>
              ))}
            </div>
          </div>
        );
      case 'ready':
        return (
          <div className="space-y-6">
            <div className="glass-card">
              <span className="card-label">Your challenge</span>
              <p className="challenge-text">{target}</p>
            </div>
            <div className="callout info">
              <strong>Pro tip:</strong> Picture the final artwork vividly and describe it like you&apos;re briefing a world-class illustrator.
            </div>
          </div>
        );
      case 'writing':
        return (
          <div className="space-y-6">
            <div className="glass-card">
              <span className="card-label">Your challenge</span>
              <p className="challenge-text">{target}</p>
            </div>
            <div className="textarea-wrapper">
              <div className="textarea-header">
                <span>Your prompt</span>
                <span>{prompt.length} characters</span>
              </div>
              <textarea
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                placeholder="Sketch the scene, mood, lighting, medium, and finishing touches…"
              />
              <div className="textarea-footer">
                Include at least one detail about the environment, the art style, and the lighting for a stronger image.
              </div>
            </div>
          </div>
        );
      case 'submitted':
        return (
          <div className="text-center space-y-6">
            <div className="spinner" />
            <div className="space-y-2">
              <h2 className="state-title">Generating images…</h2>
              <p className="state-description">Your creative vision is on its way back from the render engines.</p>
            </div>
          </div>
        );
      case 'results':
        return (
          <div className="text-center space-y-6">
            <div className="success-icon">{meta.icon}</div>
            <div className="space-y-2">
              <h2 className="state-title">Battle Complete!</h2>
              <p className="state-description">Check the main stage to see who impressed the judges the most.</p>
            </div>
            <button className="primary-button">Great! Take me there</button>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div
      className="interface"
      style={{
        fontFamily: '\"Inter\", \"Segoe UI\", system-ui, sans-serif'
      }}
    >
      <div className="backdrop" />
      <div className="layout">
        <header className="header">
          <div>
            <p className="eyebrow">Prompt Battle</p>
            <h1 className="headline">{playerId}</h1>
          </div>
          <div className="connection">
            <span className={`status-dot ${connected ? 'online' : 'offline'}`} />
            <span>{connected ? 'Connected' : 'Offline'}</span>
          </div>
        </header>

        <div className="overview">
          <div className="state-indicator" style={{ borderColor: meta.accent }}>
            <span className="state-icon" style={{ color: meta.accent }}>
              {meta.icon}
            </span>
            <div>
              <p className="state-label">Current stage</p>
              <p className="state-name">{meta.title}</p>
            </div>
          </div>
          <p className="state-summary">{meta.description}</p>
        </div>

        {gameState === 'writing' && (
          <div className="timer">
            <div className="timer-headline">
              <div>
                <p className="timer-label">Time remaining</p>
                <p className={`timer-value ${timeLeft <= 10 ? 'pulse' : ''}`}>{formatTime(timeLeft)}</p>
              </div>
              <span className="timer-badge">Focus mode</span>
            </div>
            <div className="timer-bar">
              <div className="timer-progress" style={{ width: `${progress * 100}%` }} />
            </div>
          </div>
        )}

        <main className="content">{renderStateContent()}</main>

        <aside className="debug-panel">
          <p className="debug-title">Preview states</p>
          <div className="debug-grid">
            {(['waiting', 'ready', 'writing', 'submitted', 'results'] as const).map((state) => (
              <button
                key={state}
                className={`debug-button ${gameState === state ? 'active' : ''}`}
                onClick={() => setGameState(state)}
              >
                {state}
              </button>
            ))}
          </div>
        </aside>
      </div>

      <style jsx>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');

        .interface {
          position: relative;
          min-height: 100vh;
          color: #e2e8f0;
          background: radial-gradient(120% 120% at 50% 0%, rgba(56, 189, 248, 0.12) 0%, rgba(15, 23, 42, 1) 45%, rgba(15, 23, 42, 1) 100%);
          overflow: hidden;
        }

        .backdrop {
          position: absolute;
          inset: 0;
          background: linear-gradient(120deg, rgba(59, 130, 246, 0.2), rgba(236, 72, 153, 0.08));
          filter: blur(140px);
          opacity: 0.7;
          pointer-events: none;
        }

        .layout {
          position: relative;
          max-width: 900px;
          margin: 0 auto;
          padding: 4rem 1.5rem 5rem;
          display: grid;
          gap: 2rem;
        }

        .header {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .eyebrow {
          letter-spacing: 0.2em;
          text-transform: uppercase;
          font-size: 0.75rem;
          color: rgba(226, 232, 240, 0.7);
          margin-bottom: 0.5rem;
        }

        .headline {
          font-size: clamp(2rem, 3vw, 2.75rem);
          font-weight: 700;
          margin: 0;
        }

        .connection {
          display: inline-flex;
          align-items: center;
          gap: 0.6rem;
          padding: 0.6rem 1rem;
          border-radius: 999px;
          background: rgba(15, 23, 42, 0.6);
          border: 1px solid rgba(148, 163, 184, 0.25);
          backdrop-filter: blur(16px);
          font-weight: 500;
        }

        .status-dot {
          display: inline-block;
          width: 0.6rem;
          height: 0.6rem;
          border-radius: 999px;
          box-shadow: 0 0 0 4px rgba(52, 211, 153, 0.15);
        }

        .status-dot.online {
          background: #34d399;
        }

        .status-dot.offline {
          background: #f87171;
          box-shadow: 0 0 0 4px rgba(248, 113, 113, 0.15);
        }

        .overview {
          display: grid;
          gap: 1.25rem;
        }

        .state-indicator {
          display: flex;
          align-items: center;
          gap: 1rem;
          padding: 1rem 1.25rem;
          border: 1px solid rgba(148, 163, 184, 0.2);
          border-left-width: 4px;
          border-radius: 1.25rem;
          background: rgba(15, 23, 42, 0.75);
          backdrop-filter: blur(18px);
        }

        .state-icon {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          font-size: 1.6rem;
        }

        .state-label {
          font-size: 0.75rem;
          text-transform: uppercase;
          letter-spacing: 0.12em;
          color: rgba(148, 163, 184, 0.75);
          margin: 0 0 0.2rem;
        }

        .state-name {
          font-size: 1.05rem;
          font-weight: 600;
          margin: 0;
        }

        .state-summary {
          line-height: 1.6;
          font-size: 0.95rem;
          color: rgba(203, 213, 225, 0.8);
        }

        .timer {
          padding: 1.5rem;
          border-radius: 1.75rem;
          border: 1px solid rgba(56, 189, 248, 0.2);
          background: linear-gradient(135deg, rgba(37, 99, 235, 0.16), rgba(14, 165, 233, 0.08));
          box-shadow: 0 20px 40px rgba(15, 23, 42, 0.35);
        }

        .timer-headline {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .timer-label {
          font-size: 0.8rem;
          text-transform: uppercase;
          letter-spacing: 0.15em;
          color: rgba(226, 232, 240, 0.6);
          margin-bottom: 0.35rem;
        }

        .timer-value {
          font-size: clamp(2.2rem, 4vw, 2.8rem);
          font-weight: 600;
          margin: 0;
          transition: color 0.3s ease;
        }

        .timer-value.pulse {
          color: #fbbf24;
          animation: pulse 1s infinite;
        }

        .timer-badge {
          padding: 0.45rem 1rem;
          border-radius: 999px;
          background: rgba(15, 23, 42, 0.75);
          border: 1px solid rgba(148, 163, 184, 0.3);
          font-size: 0.75rem;
          letter-spacing: 0.12em;
          text-transform: uppercase;
        }

        .timer-bar {
          margin-top: 1.2rem;
          height: 0.5rem;
          border-radius: 999px;
          background: rgba(148, 163, 184, 0.25);
          overflow: hidden;
        }

        .timer-progress {
          height: 100%;
          background: linear-gradient(90deg, #0ea5e9, #6366f1);
          transition: width 0.6s ease;
        }

        .content {
          border-radius: 2rem;
          padding: 2.5rem;
          background: rgba(15, 23, 42, 0.85);
          border: 1px solid rgba(148, 163, 184, 0.18);
          box-shadow: 0 40px 80px rgba(8, 47, 73, 0.35);
        }

        .state-title {
          font-size: clamp(1.35rem, 2.4vw, 1.8rem);
          margin: 0;
          font-weight: 600;
        }

        .state-description {
          color: rgba(203, 213, 225, 0.85);
          font-size: 0.95rem;
          line-height: 1.65;
          margin: 0 auto;
          max-width: 28rem;
        }

        .pill-row {
          display: flex;
          flex-wrap: wrap;
          justify-content: center;
          gap: 0.6rem;
        }

        .pill {
          padding: 0.5rem 1.1rem;
          border-radius: 999px;
          background: rgba(148, 163, 184, 0.15);
          border: 1px solid rgba(148, 163, 184, 0.25);
          font-size: 0.85rem;
          color: rgba(203, 213, 225, 0.85);
        }

        .glass-card {
          padding: 1.75rem;
          border-radius: 1.5rem;
          background: linear-gradient(140deg, rgba(148, 163, 184, 0.12), rgba(148, 163, 184, 0.05));
          border: 1px solid rgba(148, 163, 184, 0.25);
          box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.04);
        }

        .card-label {
          display: inline-block;
          padding: 0.35rem 0.8rem;
          border-radius: 999px;
          background: rgba(56, 189, 248, 0.15);
          color: #38bdf8;
          font-size: 0.75rem;
          text-transform: uppercase;
          letter-spacing: 0.14em;
          margin-bottom: 1rem;
        }

        .challenge-text {
          margin: 0;
          font-size: 1.05rem;
          line-height: 1.7;
          color: rgba(226, 232, 240, 0.95);
        }

        .callout {
          padding: 1.25rem 1.5rem;
          border-radius: 1.25rem;
          font-size: 0.95rem;
          line-height: 1.6;
        }

        .callout.info {
          background: rgba(59, 130, 246, 0.15);
          border: 1px solid rgba(59, 130, 246, 0.35);
        }

        .textarea-wrapper {
          display: grid;
          gap: 0.75rem;
          padding: 1.5rem;
          border-radius: 1.5rem;
          background: rgba(15, 23, 42, 0.72);
          border: 1px solid rgba(148, 163, 184, 0.25);
        }

        .textarea-header,
        .textarea-footer {
          display: flex;
          justify-content: space-between;
          font-size: 0.85rem;
          color: rgba(148, 163, 184, 0.85);
          letter-spacing: 0.02em;
        }

        .textarea-header {
          text-transform: uppercase;
          letter-spacing: 0.18em;
          font-weight: 600;
          font-size: 0.75rem;
          color: rgba(226, 232, 240, 0.75);
        }

        textarea {
          width: 100%;
          min-height: 12rem;
          border-radius: 1rem;
          border: 1px solid rgba(148, 163, 184, 0.25);
          background: rgba(15, 23, 42, 0.6);
          color: #f8fafc;
          padding: 1.25rem;
          font-size: 0.95rem;
          line-height: 1.7;
          resize: none;
          outline: none;
          transition: border-color 0.2s ease, box-shadow 0.2s ease;
        }

        textarea:focus {
          border-color: rgba(56, 189, 248, 0.75);
          box-shadow: 0 0 0 4px rgba(56, 189, 248, 0.18);
        }

        .spinner {
          width: 4rem;
          height: 4rem;
          border-radius: 999px;
          margin: 0 auto;
          border: 4px solid rgba(148, 163, 184, 0.2);
          border-top-color: rgba(56, 189, 248, 0.85);
          animation: spin 1s linear infinite;
        }

        .success-icon {
          width: 4.5rem;
          height: 4.5rem;
          border-radius: 1.35rem;
          background: rgba(52, 211, 153, 0.16);
          border: 1px solid rgba(52, 211, 153, 0.5);
          display: inline-flex;
          align-items: center;
          justify-content: center;
          font-size: 2rem;
          box-shadow: 0 15px 30px rgba(16, 185, 129, 0.25);
        }

        .primary-button {
          border: none;
          padding: 0.85rem 1.9rem;
          border-radius: 999px;
          background: linear-gradient(135deg, #38bdf8, #6366f1);
          color: #0f172a;
          font-weight: 600;
          font-size: 0.95rem;
          cursor: pointer;
          transition: transform 0.2s ease, box-shadow 0.2s ease;
          box-shadow: 0 20px 35px rgba(59, 130, 246, 0.35);
        }

        .primary-button:hover {
          transform: translateY(-2px);
          box-shadow: 0 30px 45px rgba(99, 102, 241, 0.35);
        }

        .debug-panel {
          position: fixed;
          right: 2rem;
          bottom: 2rem;
          width: 220px;
          padding: 1.25rem;
          border-radius: 1.25rem;
          background: rgba(15, 23, 42, 0.8);
          border: 1px solid rgba(148, 163, 184, 0.25);
          box-shadow: 0 35px 60px rgba(15, 23, 42, 0.45);
          backdrop-filter: blur(18px);
        }

        .debug-title {
          margin: 0 0 0.75rem;
          font-size: 0.85rem;
          text-transform: uppercase;
          letter-spacing: 0.16em;
          color: rgba(148, 163, 184, 0.85);
        }

        .debug-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 0.5rem;
        }

        .debug-button {
          background: rgba(148, 163, 184, 0.16);
          border: 1px solid transparent;
          color: rgba(226, 232, 240, 0.85);
          padding: 0.5rem 0.75rem;
          border-radius: 0.75rem;
          text-transform: capitalize;
          font-size: 0.85rem;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .debug-button:hover {
          border-color: rgba(56, 189, 248, 0.45);
          color: #f8fafc;
        }

        .debug-button.active {
          background: rgba(56, 189, 248, 0.22);
          border-color: rgba(56, 189, 248, 0.75);
          color: #0ea5e9;
          font-weight: 600;
        }

        .status-orb {
          position: relative;
          width: 4rem;
          height: 4rem;
          display: grid;
          place-items: center;
        }

        .orb-inner {
          z-index: 2;
          display: inline-flex;
          width: 3rem;
          height: 3rem;
          border-radius: 999px;
          align-items: center;
          justify-content: center;
          font-size: 1.6rem;
          background: rgba(168, 85, 247, 0.18);
          border: 1px solid rgba(168, 85, 247, 0.45);
          box-shadow: 0 15px 30px rgba(168, 85, 247, 0.25);
        }

        .orb-glow {
          position: absolute;
          inset: 0;
          border-radius: 999px;
          background: rgba(168, 85, 247, 0.25);
          filter: blur(30px);
          animation: breathe 4s ease-in-out infinite;
        }

        .orb-glow.delay {
          animation-delay: 1.5s;
        }

        @keyframes pulse {
          0%, 100% {
            transform: scale(1);
          }
          50% {
            transform: scale(1.04);
          }
        }

        @keyframes spin {
          0% {
            transform: rotate(0deg);
          }
          100% {
            transform: rotate(360deg);
          }
        }

        @keyframes breathe {
          0%, 100% {
            opacity: 0.35;
            transform: scale(0.9);
          }
          50% {
            opacity: 0.75;
            transform: scale(1.1);
          }
        }

        @media (max-width: 768px) {
          .layout {
            padding-top: 3rem;
            gap: 1.5rem;
          }

          .content {
            padding: 1.75rem;
            border-radius: 1.5rem;
          }

          .debug-panel {
            position: static;
            width: 100%;
          }
        }
      `}</style>
    </div>
  );
}