import { useState } from 'react';
import { Chess } from 'chess.js';
import { Chessboard } from 'react-chessboard';
import AnalysisBoardView from './AnalysisBoardView';

const THEME_LABELS = {
  missed_mate: 'Missed mate',
  missed_tactic: 'Missed tactic',
  blunder: 'Blunder',
};

const THEME_COLORS = {
  missed_mate: '#ff3b30',
  missed_tactic: '#ff9500',
  blunder: '#ffcc00',
};

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

function uciToSan(uci, fen) {
  if (!uci || !fen) return '?';
  try {
    const chess = new Chess();
    chess.load(fen);
    const move = chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });
    return move?.san ?? '?';
  } catch {
    return '?';
  }
}

function CandidateCard({ candidate, onApprove, onDismiss }) {
  const boardSize = Math.min(280, window.innerWidth - 48);
  const [showAnalysis, setShowAnalysis] = useState(false);

  return (
    <div style={{
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: 12,
      marginBottom: 16,
      overflow: 'hidden',
    }}>
      <div style={{ padding: '12px 12px 0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <span style={{
            fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px',
            color: THEME_COLORS[candidate.theme], background: THEME_COLORS[candidate.theme] + '22',
            padding: '3px 8px', borderRadius: 4,
          }}>
            {THEME_LABELS[candidate.theme]}
          </span>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
            -{candidate.winPctDrop}% win chance
          </span>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'center', padding: '0 12px' }}>
        <Chessboard options={{
          position: candidate.fen,
          boardOrientation: candidate.playerColor,
          allowDragging: false,
          boardStyle: { width: boardSize, maxWidth: '100%' },
        }} />
      </div>

      <div style={{ padding: '12px' }}>
        <div style={{ display: 'flex', gap: 12, marginBottom: 12, fontSize: '0.85rem' }}>
          <div style={{ flex: 1, background: 'rgba(255,59,48,0.1)', borderRadius: 8, padding: '8px 10px' }}>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginBottom: 2 }}>You played</div>
            <div style={{ fontWeight: 700, color: '#ff3b30' }}>{candidate.playerMoveSan}</div>
          </div>
          <div style={{ flex: 1, background: 'rgba(52,199,89,0.1)', borderRadius: 8, padding: '8px 10px' }}>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginBottom: 2 }}>Best move</div>
            <div style={{ fontWeight: 700, color: '#34c759' }}>{uciToSan(candidate.bestMove, candidate.fen)}</div>
          </div>
        </div>
        {candidate.bestLine && (
          <div style={{
            fontSize: '0.78rem', color: 'var(--text-secondary)', fontFamily: 'monospace',
            marginBottom: 10, padding: '8px 10px', background: 'var(--bg)',
            borderRadius: 8, lineHeight: 1.7,
          }}>
            <span style={{ fontWeight: 700, color: 'var(--text)', fontFamily: 'inherit' }}>Best line: </span>
            {formatLine(uciLineToSan(candidate.fen, candidate.bestLine), candidate.fen)}
          </div>
        )}
        <button
          onClick={() => setShowAnalysis(true)}
          style={{
            width: '100%', padding: '8px', fontSize: '0.85rem',
            border: '1px solid var(--border)', borderRadius: 8,
            background: 'transparent', color: 'var(--text)', cursor: 'pointer', marginBottom: 8,
          }}
        >
          Analyze position
        </button>

        {showAnalysis && (
          <AnalysisBoardView
            fen={candidate.fen}
            playerColor={candidate.playerColor}
            bestLine={candidate.bestLine}
            onClose={() => setShowAnalysis(false)}
          />
        )}

        <div style={{ display: 'flex', gap: 8 }}>
          <button
            className="btn-accent"
            onClick={() => onApprove(candidate)}
            style={{ flex: 1, padding: '10px', fontSize: '0.9rem' }}
          >
            Save puzzle
          </button>
          <button
            onClick={() => onDismiss(candidate)}
            style={{
              flex: 1, padding: '10px', fontSize: '0.9rem', border: '1px solid var(--border)',
              borderRadius: 8, background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer',
            }}
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ReviewView({ candidates, onApprove, onDismiss }) {
  if (!candidates || candidates.length === 0) {
    return (
      <div className="empty-state">
        <div style={{ fontSize: '2rem' }}>♟</div>
        <p>No candidates yet. Load games and run analysis to find puzzles.</p>
      </div>
    );
  }

  return (
    <div>
      <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-secondary)', marginBottom: 12 }}>
        {candidates.length} candidate{candidates.length !== 1 ? 's' : ''} to review
      </div>
      {candidates.map((c, i) => (
        <CandidateCard
          key={`${c.fen}-${c.playerMove}-${i}`}
          candidate={c}
          onApprove={onApprove}
          onDismiss={onDismiss}
        />
      ))}
    </div>
  );
}
