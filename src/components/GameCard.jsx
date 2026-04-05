export default function GameCard({ game, onClick, selectable, selected, onSelect, statusBadge, statusType, onReanalyze }) {
  const opponent = game.playerIsWhite ? game.black : game.white;
  const resultLabel = game.playerResult === 'win' ? 'W' : game.playerResult === 'loss' ? 'L' : 'D';

  function handleCheckbox(e) {
    e.stopPropagation();
    onSelect?.(!selected);
  }

  return (
    <div
      className={`game-card${selected ? ' selected' : ''}`}
      style={{ cursor: selectable ? 'pointer' : 'default' }}
      onClick={selectable ? handleCheckbox : undefined}
    >
      {selectable && (
        <div
          style={{
            width: 20, height: 20, borderRadius: 4, flexShrink: 0,
            border: '2px solid var(--border)',
            background: selected ? 'var(--accent)' : 'transparent',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', fontSize: '0.75rem',
          }}
        >
          {selected && '✓'}
        </div>
      )}
      <div className={`game-result ${game.playerResult}`}>
        {resultLabel}
      </div>
      <div className="game-info">
        <div className="game-opponent">
          {opponent.name}
          {opponent.rating ? ` (${opponent.rating})` : ''}
        </div>
        <div className="game-meta">
          {game.timeControl && <span>{game.timeControl}</span>}
          {game.timeControl && game.date && <span> · </span>}
          {game.date && <span>{game.date}</span>}
          {game.movesNb > 0 && <span> · {game.movesNb} moves</span>}
        </div>
        {statusBadge && (
          <div style={{
            marginTop: 4,
            fontSize: '0.75rem',
            color: statusType === 'done' ? 'var(--accent)' :
                   statusType === 'error' ? 'var(--danger)' : 'var(--text-secondary)',
          }}>
            {statusBadge}
          </div>
        )}
      </div>
      {onReanalyze && (
        <button
          onClick={e => { e.stopPropagation(); onReanalyze(); }}
          title="Re-analyze"
          style={{
            background: 'none', border: '1px solid var(--border)', borderRadius: 6,
            color: 'var(--text-secondary)', cursor: 'pointer',
            padding: '4px 8px', fontSize: '0.9rem', flexShrink: 0,
            lineHeight: 1,
          }}
        >
          ↺
        </button>
      )}
      {!selectable && !onReanalyze && <div style={{ color: 'var(--text-secondary)', fontSize: '1.1rem' }}>›</div>}
    </div>
  );
}
