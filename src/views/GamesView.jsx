import { useState } from 'react';
import { getRecentGames } from '../data/chesscomApi';
import GameCard from '../components/GameCard';

function timeAgo(ts) {
  const mins = Math.floor((Date.now() - ts) / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function GamesView({ username, onUsernameChange, games, gamesFetchedAt, onGamesChange, analysisState, onAnalyzeGames, onClearAnalysis }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(new Set());

  async function handleLoad() {
    if (!username) return;
    setLoading(true);
    setError('');
    onGamesChange(null);
    setSelected(new Set());
    try {
      const result = await getRecentGames(username);
      onGamesChange(result);
    } catch (e) {
      setError(e.message ?? 'Failed to load games');
    } finally {
      setLoading(false);
    }
  }

  function toggleSelect(gameId) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(gameId)) next.delete(gameId);
      else next.add(gameId);
      return next;
    });
  }

  function toggleSelectAll() {
    if (!games) return;
    const analyzableIds = games
      .filter(g => !analysisState[g.id] || analysisState[g.id].status === 'error')
      .map(g => g.id);
    if (selected.size === analyzableIds.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(analyzableIds));
    }
  }

  function handleAnalyze() {
    if (selected.size === 0) return;
    onAnalyzeGames([...selected]);
    setSelected(new Set());
  }

  const isAnalyzing = Object.values(analysisState).some(
    s => s.status === 'queued' || s.status === 'analyzing'
  );

  function getStatusBadge(game) {
    const state = analysisState[game.id];
    if (!state) return null;
    if (state.status === 'queued') return { badge: 'Queued…', type: 'idle' };
    if (state.status === 'analyzing') {
      const { current, total } = state.progress ?? {};
      return { badge: current != null ? `Analyzing ${current}/${total}…` : 'Analyzing…', type: 'idle' };
    }
    if (state.status === 'done') {
      const n = state.candidates?.length ?? 0;
      return { badge: n > 0 ? `${n} candidate${n !== 1 ? 's' : ''} found` : 'No candidates', type: 'done' };
    }
    if (state.status === 'error') return { badge: `Error: ${state.errorMsg}`, type: 'error' };
    return null;
  }

  const analyzableGames = games?.filter(g => !analysisState[g.id] || analysisState[g.id].status === 'error') ?? [];

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
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              {games.length} recent game{games.length !== 1 ? 's' : ''}
              {gamesFetchedAt && (
                <span style={{ marginLeft: 6, color: 'var(--text-secondary)', opacity: 0.7 }}>
                  · fetched {timeAgo(gamesFetchedAt)}
                </span>
              )}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              {analyzableGames.length > 0 && (
                <button
                  onClick={toggleSelectAll}
                  style={{ background: 'none', border: 'none', color: 'var(--accent)', fontSize: '0.8rem', cursor: 'pointer', padding: '4px 8px' }}
                >
                  {selected.size === analyzableGames.length ? 'Deselect all' : 'Select all'}
                </button>
              )}
              {selected.size > 0 && (
                <button
                  className="btn-accent"
                  onClick={handleAnalyze}
                  disabled={isAnalyzing}
                  style={{ width: 'auto', padding: '6px 14px', fontSize: '0.8rem' }}
                >
                  Analyze {selected.size} game{selected.size !== 1 ? 's' : ''}
                </button>
              )}
            </div>
          </div>

          {games.map(game => {
            const statusInfo = getStatusBadge(game);
            const isAnalyzed = analysisState[game.id]?.status === 'done' || analysisState[game.id]?.status === 'analyzing' || analysisState[game.id]?.status === 'queued';
            return (
              <GameCard
                key={game.id}
                game={game}
                selectable={!isAnalyzed}
                selected={selected.has(game.id)}
                onSelect={(val) => {
                  if (val) setSelected(prev => new Set([...prev, game.id]));
                  else toggleSelect(game.id);
                }}
                statusBadge={statusInfo?.badge}
                statusType={statusInfo?.type}
                onReanalyze={analysisState[game.id]?.status === 'done' ? () => onClearAnalysis(game.id) : undefined}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
