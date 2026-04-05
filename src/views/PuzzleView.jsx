import { useState } from 'react';
import { Chess } from 'chess.js';
import { Chessboard } from 'react-chessboard';

const RATING_BUTTONS = [
  { label: 'Too easy', quality: 5, color: '#34c759' },
  { label: 'Got it', quality: 4, color: '#30d158' },
  { label: 'Barely', quality: 3, color: '#ff9500' },
  { label: 'I see it now', quality: 1, color: '#ff3b30' },
];

function uciToSquares(uci) {
  if (!uci || uci.length < 4) return { from: null, to: null };
  return { from: uci.slice(0, 2), to: uci.slice(2, 4) };
}

function uciLineToSan(fen, bestLine) {
  if (!fen || !bestLine) return [];
  const chess = new Chess();
  try { chess.load(fen); } catch { return []; }
  const ucis = bestLine.trim().split(/\s+/).filter(Boolean);
  const sans = [];
  for (const uci of ucis) {
    try {
      const m = chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });
      if (!m) break;
      sans.push(m.san);
    } catch { break; }
  }
  return sans;
}

function formatLine(sans, fen) {
  if (!sans.length) return '';
  const parts = fen.split(' ');
  const color = parts[1];
  let moveNum = parseInt(parts[5] ?? '1', 10);
  const tokens = [];
  sans.forEach((san, i) => {
    const isWhite = color === 'w' ? i % 2 === 0 : i % 2 === 1;
    if (isWhite) tokens.push(`${moveNum}.`);
    else if (i === 0) tokens.push(`${moveNum}...`);
    tokens.push(san);
    if (!isWhite) moveNum++;
  });
  return tokens.join(' ');
}

export default function PuzzleView({ puzzle, srsState, onRate, onBack, drillProgress, onOpenAnalysis }) {
  const [input, setInput] = useState('');
  const [phase, setPhase] = useState('input'); // 'input' | 'correct' | 'incorrect' | 'gave_up'
  const [errorMsg, setErrorMsg] = useState('');

  const boardSize = Math.min(360, window.innerWidth - 32, window.innerHeight * 0.42);

  // Highlight best move squares after reveal
  let squareStyles = {};
  if (phase !== 'input') {
    const { from, to } = uciToSquares(puzzle.bestMove);
    if (from) squareStyles[from] = { background: 'rgba(52,199,89,0.5)' };
    if (to) squareStyles[to] = { background: 'rgba(52,199,89,0.6)' };
  }

  const bestLineSan = uciLineToSan(puzzle.fen, puzzle.bestLine);
  const bestLineFormatted = formatLine(bestLineSan, puzzle.fen);

  function handleSubmit(e) {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed) return;

    const chess = new Chess();
    try {
      chess.load(puzzle.fen);
    } catch {
      setErrorMsg('Invalid puzzle position');
      return;
    }

    let moveObj = null;
    try {
      moveObj = chess.move(trimmed);
    } catch {
      setErrorMsg('Invalid move — try again');
      return;
    }

    if (!moveObj) {
      setErrorMsg('Illegal move — try again');
      return;
    }

    const playedUci = moveObj.from + moveObj.to + (moveObj.promotion ?? '');
    if (playedUci === puzzle.bestMove) {
      setPhase('correct');
      setErrorMsg('');
    } else {
      setPhase('incorrect');
      setErrorMsg('');
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'var(--bg)',
      zIndex: 100, display: 'flex', flexDirection: 'column',
      overflow: 'hidden',
      paddingTop: 'env(safe-area-inset-top)',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '16px 16px 8px', borderBottom: '1px solid var(--border)',
        flexShrink: 0, background: 'var(--surface)',
      }}>
        <button
          onClick={onBack}
          style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: 4, fontSize: '1.2rem' }}
        >
          ←
        </button>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: '1rem' }}>Find the best move</div>
          {srsState && (
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
              Ease {srsState.easeFactor?.toFixed(1)} · Rep {srsState.repetitions}
            </div>
          )}
        </div>
        {drillProgress && (
          <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 600, flexShrink: 0 }}>
            {drillProgress.completed + 1} / {drillProgress.total}
          </div>
        )}
      </div>

      {/* Scrollable content */}
      <div style={{ flex: 1, overflowY: 'auto' }}>

      {/* Board */}
      <div style={{ display: 'flex', justifyContent: 'center', padding: '16px 16px 8px' }}>
        <Chessboard options={{
          position: puzzle.fen,
          boardOrientation: puzzle.playerColor,
          allowDragging: false,
          boardStyle: { width: boardSize, maxWidth: '100%' },
          squareStyles: squareStyles,
        }} />
      </div>

      {/* Move indicator */}
      <div style={{ textAlign: 'center', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: 8 }}>
        {puzzle.playerColor === 'white' ? 'White' : 'Black'} to move
      </div>

      {/* Best line — shown after answer is revealed */}
      {phase !== 'input' && bestLineFormatted && (
        <div style={{
          padding: '0 16px 12px', fontSize: '0.8rem', color: 'var(--text-secondary)',
          fontFamily: 'monospace', lineHeight: 1.7,
        }}>
          <span style={{ fontWeight: 700, color: 'var(--text)', fontFamily: 'inherit' }}>Best line: </span>
          {bestLineFormatted}
        </div>
      )}

      <div style={{ padding: '0 16px 16px' }}>
        {phase === 'input' && (
          <form onSubmit={handleSubmit}>
            <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
              <input
                type="text"
                value={input}
                onChange={e => { setInput(e.target.value); setErrorMsg(''); }}
                placeholder="Type your move (e.g. Nf3, exd5)"
                autoCapitalize="none"
                autoCorrect="off"
                autoComplete="off"
                spellCheck={false}
                style={{
                  flex: 1, padding: '12px 14px', fontSize: '1rem',
                  borderRadius: 10, border: `1.5px solid ${errorMsg ? 'var(--danger)' : 'var(--border)'}`,
                  background: 'var(--surface)', color: 'var(--text)',
                  outline: 'none',
                }}
              />
              <button
                type="submit"
                className="btn-accent"
                style={{ width: 'auto', padding: '12px 20px', fontSize: '0.95rem' }}
              >
                Check
              </button>
            </div>
            {errorMsg && (
              <div style={{ color: 'var(--danger)', fontSize: '0.85rem', marginBottom: 4 }}>{errorMsg}</div>
            )}
            <div style={{ textAlign: 'center' }}>
              <button
                type="button"
                onClick={() => setPhase('gave_up')}
                style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: '0.85rem', cursor: 'pointer', padding: '8px' }}
              >
                Give up
              </button>
            </div>
          </form>
        )}

        {phase === 'correct' && (
          <div>
            <div style={{
              background: 'rgba(52,199,89,0.12)', border: '1px solid rgba(52,199,89,0.3)',
              borderRadius: 10, padding: '12px 16px', marginBottom: 16,
              color: '#34c759', fontWeight: 700, fontSize: '1rem', textAlign: 'center',
            }}>
              Correct!
            </div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: 12, textAlign: 'center' }}>
              How hard was that?
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {RATING_BUTTONS.map(({ label, quality, color }) => (
                <button
                  key={quality}
                  onClick={() => onRate(puzzle, srsState, quality)}
                  style={{
                    padding: '12px', borderRadius: 10, border: 'none',
                    background: color + '22', color: color,
                    fontWeight: 700, fontSize: '0.95rem', cursor: 'pointer',
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}

        {phase === 'incorrect' && (
          <div>
            <div style={{
              background: 'rgba(255,59,48,0.1)', border: '1px solid rgba(255,59,48,0.3)',
              borderRadius: 10, padding: '12px 16px', marginBottom: 12,
              color: '#ff3b30', fontWeight: 700, fontSize: '0.95rem',
            }}>
              Not quite — best move highlighted in green
            </div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 16, fontSize: '0.85rem' }}>
              <div style={{ flex: 1, background: 'rgba(255,59,48,0.08)', borderRadius: 8, padding: '8px 10px' }}>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginBottom: 2 }}>You typed</div>
                <div style={{ fontWeight: 700, color: '#ff3b30' }}>{input}</div>
              </div>
              <div style={{ flex: 1, background: 'rgba(52,199,89,0.08)', borderRadius: 8, padding: '8px 10px' }}>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginBottom: 2 }}>Best move</div>
                <div style={{ fontWeight: 700, color: '#34c759' }}>{bestLineSan[0] ?? puzzle.bestMove}</div>
              </div>
            </div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: 12, textAlign: 'center' }}>
              How hard was it once you saw it?
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {RATING_BUTTONS.filter(r => r.quality <= 3).map(({ label, quality, color }) => (
                <button
                  key={quality}
                  onClick={() => onRate(puzzle, srsState, quality)}
                  style={{
                    padding: '12px', borderRadius: 10, border: 'none',
                    background: color + '22', color: color,
                    fontWeight: 700, fontSize: '0.95rem', cursor: 'pointer',
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}

        {phase === 'gave_up' && (
          <div>
            <div style={{
              background: 'rgba(255,149,0,0.1)', border: '1px solid rgba(255,149,0,0.3)',
              borderRadius: 10, padding: '12px 16px', marginBottom: 12,
              color: '#ff9500', fontWeight: 700, fontSize: '0.95rem',
            }}>
              Best move highlighted in green
            </div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: 12, textAlign: 'center' }}>
              How hard was it once you saw it?
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {RATING_BUTTONS.filter(r => r.quality <= 3).map(({ label, quality, color }) => (
                <button
                  key={quality}
                  onClick={() => onRate(puzzle, srsState, quality)}
                  style={{
                    padding: '12px', borderRadius: 10, border: 'none',
                    background: color + '22', color: color,
                    fontWeight: 700, fontSize: '0.95rem', cursor: 'pointer',
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Analyze button — available after answer is revealed */}
      {phase !== 'input' && onOpenAnalysis && (
        <div style={{ padding: '0 16px 24px', textAlign: 'center' }}>
          <button
            onClick={() => onOpenAnalysis({ fen: puzzle.fen, playerColor: puzzle.playerColor, bestLine: puzzle.bestLine })}
            style={{
              background: 'none', border: '1px solid var(--border)', borderRadius: 8,
              color: 'var(--text-secondary)', cursor: 'pointer', padding: '10px 20px',
              fontSize: '0.85rem', width: '100%',
            }}
          >
            Analyze position
          </button>
        </div>
      )}

      </div>{/* end scrollable content */}
    </div>
  );
}
