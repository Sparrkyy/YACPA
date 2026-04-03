import { useState } from 'react';
import { getRecentGames } from '../data/chesscomApi';
import GameCard from '../components/GameCard';

export default function GamesView({ username, onUsernameChange }) {
  const [games, setGames] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleLoad() {
    if (!username) return;
    setLoading(true);
    setError('');
    setGames(null);
    try {
      const result = await getRecentGames(username);
      setGames(result);
    } catch (e) {
      setError(e.message ?? 'Failed to load games');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>
            Chess.com username
          </div>
          <div style={{ fontWeight: 600 }}>{username}</div>
        </div>
        <button
          className="btn-accent"
          onClick={handleLoad}
          disabled={loading}
          style={{ width: 'auto', padding: '10px 20px', fontSize: '0.9rem' }}
        >
          {loading ? 'Loading…' : games ? 'Refresh' : 'Load games'}
        </button>
      </div>

      {error && (
        <div style={{ color: 'var(--danger)', fontSize: '0.9rem', marginBottom: 16, padding: '12px', background: 'rgba(255,59,48,0.1)', borderRadius: 8 }}>
          {error}
        </div>
      )}

      {games === null && !loading && !error && (
        <div className="empty-state">
          <div style={{ fontSize: '2rem' }}>♟</div>
          <p>Tap "Load games" to fetch your recent Chess.com games.</p>
        </div>
      )}

      {games !== null && games.length === 0 && (
        <div className="empty-state">
          <p>No games found for <strong>{username}</strong> this month.</p>
        </div>
      )}

      {games !== null && games.length > 0 && (
        <div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: 10 }}>
            {games.length} recent game{games.length !== 1 ? 's' : ''}
          </div>
          {games.map(game => (
            <GameCard
              key={game.id}
              game={game}
              onClick={() => {/* analysis coming soon */}}
            />
          ))}
        </div>
      )}
    </div>
  );
}
