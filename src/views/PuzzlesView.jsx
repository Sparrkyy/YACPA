import { Chessboard } from 'react-chessboard';

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

function uciToSan(uci) {
  if (!uci) return '?';
  // Show UCI move nicely: e2e4 → e4, e7e8q → e8=Q
  const promo = uci[4] ? `=${uci[4].toUpperCase()}` : '';
  return uci.slice(2, 4) + promo;
}

function CandidateCard({ candidate, onApprove, onDismiss }) {
  const boardSize = Math.min(280, window.innerWidth - 48);

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
            <div style={{ fontWeight: 700, color: '#34c759' }}>{uciToSan(candidate.bestMove)}</div>
          </div>
        </div>
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

function PuzzleCard({ puzzle, srsState, onSolve }) {
  const boardSize = Math.min(120, (window.innerWidth - 80) / 2);

  return (
    <div
      onClick={onSolve}
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 10,
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
        marginBottom: 10,
        gap: 12,
        padding: '10px',
        cursor: 'pointer',
      }}
    >
      <div style={{ flexShrink: 0 }}>
        <Chessboard options={{
          position: puzzle.fen,
          boardOrientation: puzzle.playerColor,
          allowDragging: false,
          boardStyle: { width: boardSize, maxWidth: '100%' },
        }} />
      </div>
      <div>
        <div style={{
          fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px',
          color: THEME_COLORS[puzzle.theme], marginBottom: 4,
        }}>
          {THEME_LABELS[puzzle.theme] ?? puzzle.theme}
        </div>
        {srsState ? (
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
            <div>Next review: {srsState.nextReview}</div>
            <div>Ease: {srsState.easeFactor?.toFixed(1)}</div>
          </div>
        ) : (
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Ready to drill</div>
        )}
      </div>
    </div>
  );
}

export default function PuzzlesView({ candidates, puzzles, srsStates, onApprove, onDismiss, onSolvePuzzle }) {
  const srsMap = Object.fromEntries((srsStates ?? []).map(s => [s.puzzleId, s]));
  const newPuzzles = (puzzles ?? []).filter(p => !srsMap[p.id] || srsMap[p.id].repetitions === 0);
  const oldPuzzles = (puzzles ?? []).filter(p => srsMap[p.id]?.repetitions > 0)
    .sort((a, b) => (srsMap[a.id]?.nextReview ?? '') > (srsMap[b.id]?.nextReview ?? '') ? 1 : -1);

  const hasCandidates = candidates.length > 0;
  const hasNew = newPuzzles.length > 0;
  const hasOld = oldPuzzles.length > 0;

  if (!hasCandidates && !hasNew && !hasOld) {
    return (
      <div className="empty-state">
        <div style={{ fontSize: '2rem' }}>♟</div>
        <p>No puzzles yet. Load games and run analysis to generate candidates.</p>
      </div>
    );
  }

  return (
    <div>
      {hasCandidates && (
        <section style={{ marginBottom: 24 }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-secondary)', marginBottom: 12 }}>
            New — {candidates.length} candidate{candidates.length !== 1 ? 's' : ''} to review
          </div>
          {candidates.map((c, i) => (
            <CandidateCard
              key={`${c.fen}-${c.playerMove}-${i}`}
              candidate={c}
              onApprove={onApprove}
              onDismiss={onDismiss}
            />
          ))}
        </section>
      )}

      {hasNew && (
        <section style={{ marginBottom: 24 }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-secondary)', marginBottom: 12 }}>
            New — {newPuzzles.length} saved puzzle{newPuzzles.length !== 1 ? 's' : ''}
          </div>
          {newPuzzles.map(p => (
            <PuzzleCard key={p.id} puzzle={p} srsState={srsMap[p.id]} onSolve={() => onSolvePuzzle?.(p)} />
          ))}
        </section>
      )}

      {hasOld && (
        <section>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-secondary)', marginBottom: 12 }}>
            Old — {oldPuzzles.length} drilled puzzle{oldPuzzles.length !== 1 ? 's' : ''}
          </div>
          {oldPuzzles.map(p => (
            <PuzzleCard key={p.id} puzzle={p} srsState={srsMap[p.id]} onSolve={() => onSolvePuzzle?.(p)} />
          ))}
        </section>
      )}
    </div>
  );
}
