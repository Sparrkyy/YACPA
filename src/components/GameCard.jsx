export default function GameCard({ game, onClick }) {
  const opponent = game.playerIsWhite ? game.black : game.white;
  const resultLabel = game.playerResult === 'win' ? 'W' : game.playerResult === 'loss' ? 'L' : 'D';

  return (
    <button className="game-card" onClick={onClick}>
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
      </div>
      <div style={{ color: 'var(--text-secondary)', fontSize: '1.1rem' }}>›</div>
    </button>
  );
}
