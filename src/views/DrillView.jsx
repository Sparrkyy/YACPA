import { Chessboard } from 'react-chessboard';

function dueLabel(nextReview, today) {
  if (!nextReview || nextReview <= today) return 'Due now';
  const days = Math.round((new Date(nextReview) - new Date(today)) / 86_400_000);
  if (days === 1) return 'Due tomorrow';
  return `Due in ${days} days`;
}

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

function PuzzleCard({ puzzle, srsState, onSolve, today }) {
  const boardSize = Math.min(100, (window.innerWidth - 80) / 2);

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
            <div>{dueLabel(srsState.nextReview, today)}</div>
            <div>Rep {srsState.repetitions}</div>
          </div>
        ) : (
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Ready to drill</div>
        )}
      </div>
    </div>
  );
}

export default function DrillView({ puzzles, srsStates, onSolvePuzzle, onStartDrill }) {
  const srsMap = Object.fromEntries((srsStates ?? []).map(s => [s.puzzleId, s]));
  const today = new Date().toISOString().slice(0, 10);

  const dueCount = (puzzles ?? []).filter(p => {
    const srs = srsMap[p.id];
    return !srs || srs.nextReview <= today;
  }).length;

  const newPuzzles = (puzzles ?? []).filter(p => !srsMap[p.id] || srsMap[p.id].repetitions === 0);
  const oldPuzzles = (puzzles ?? []).filter(p => srsMap[p.id]?.repetitions > 0)
    .sort((a, b) => (srsMap[a.id]?.nextReview ?? '') > (srsMap[b.id]?.nextReview ?? '') ? 1 : -1);

  const totalPuzzles = (puzzles ?? []).length;
  const drilledCount = (srsStates ?? []).filter(s => s.repetitions > 0).length;

  if (totalPuzzles === 0) {
    return (
      <div className="empty-state">
        <div style={{ fontSize: '2rem' }}>♟</div>
        <p>No puzzles yet. Review candidates to save puzzles here.</p>
      </div>
    );
  }

  return (
    <div>
      {/* Stats row */}
      <div style={{
        display: 'flex', justifyContent: 'space-around', textAlign: 'center',
        marginBottom: 16, padding: '12px 0',
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 12,
      }}>
        {[
          { value: totalPuzzles, label: 'Saved' },
          { value: drilledCount, label: 'Drilled' },
          { value: dueCount, label: 'Due', highlight: dueCount > 0 },
        ].map(({ value, label, highlight }) => (
          <div key={label}>
            <div style={{ fontSize: '1.2rem', fontWeight: 700, color: highlight ? 'var(--accent)' : 'var(--text)' }}>
              {value}
            </div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', marginTop: 1 }}>
              {label}
            </div>
          </div>
        ))}
      </div>

      {/* Drill banner */}
      <div style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 12,
        padding: '16px',
        marginBottom: 20,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
      }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: '1rem', marginBottom: 2 }}>Drill session</div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            {dueCount > 0
              ? `${dueCount} puzzle${dueCount !== 1 ? 's' : ''} due`
              : 'Nothing due — come back later'}
          </div>
        </div>
        <button
          className="btn-accent"
          disabled={dueCount === 0}
          onClick={onStartDrill}
          style={{ width: 'auto', padding: '10px 20px', fontSize: '0.9rem', flexShrink: 0 }}
        >
          Start
        </button>
      </div>

      {newPuzzles.length > 0 && (
        <section style={{ marginBottom: 24 }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-secondary)', marginBottom: 12 }}>
            New — {newPuzzles.length} puzzle{newPuzzles.length !== 1 ? 's' : ''}
          </div>
          {newPuzzles.map(p => (
            <PuzzleCard key={p.id} puzzle={p} srsState={srsMap[p.id]} onSolve={() => onSolvePuzzle?.(p)} today={today} />
          ))}
        </section>
      )}

      {oldPuzzles.length > 0 && (
        <section>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-secondary)', marginBottom: 12 }}>
            Reviewed — {oldPuzzles.length} puzzle{oldPuzzles.length !== 1 ? 's' : ''}
          </div>
          {oldPuzzles.map(p => (
            <PuzzleCard key={p.id} puzzle={p} srsState={srsMap[p.id]} onSolve={() => onSolvePuzzle?.(p)} today={today} />
          ))}
        </section>
      )}
    </div>
  );
}
