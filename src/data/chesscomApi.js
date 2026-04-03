// Chess.com public API — adapted from GuillaumeSD/Chesskit

function getPaddedNumber(n) {
  return String(n).padStart(2, '0');
}

export async function getRecentGames(username, signal) {
  const trimmed = username.trim().toLowerCase();
  const date = new Date();
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth() + 1;
  const paddedMonth = getPaddedNumber(month);

  const headers = { 'User-Agent': 'ChessPuzzleTrainer/1.0' };

  const res = await fetch(
    `https://api.chess.com/pub/player/${trimmed}/games/${year}/${paddedMonth}`,
    { method: 'GET', signal, headers }
  );

  if (!res.ok) {
    if (res.status === 404) throw new Error(`User "${trimmed}" not found on Chess.com`);
    throw new Error(`Failed to fetch games (HTTP ${res.status})`);
  }

  const data = await res.json();
  const games = data?.games ?? [];

  // If fewer than 50 games this month, also fetch last month
  if (games.length < 50) {
    const prevMonth = month === 1 ? 12 : month - 1;
    const prevYear = prevMonth === 12 ? year - 1 : year;
    const prevPaddedMonth = getPaddedNumber(prevMonth);

    try {
      const resPrev = await fetch(
        `https://api.chess.com/pub/player/${trimmed}/games/${prevYear}/${prevPaddedMonth}`,
        { headers }
      );
      if (resPrev.ok) {
        const dataPrev = await resPrev.json();
        games.push(...(dataPrev?.games ?? []));
      }
    } catch {
      // Previous month fetch is best-effort; don't fail the whole request
    }
  }

  return games
    .filter(g => g.pgn && g.end_time)
    .sort((a, b) => b.end_time - a.end_time)
    .slice(0, 50)
    .map(g => formatGame(g, trimmed));
}

function formatGame(data, viewerUsername) {
  const result = data.pgn.match(/\[Result "(.*?)"\]/)?.[1] ?? '*';
  const movesNb = data.pgn.match(/\d+\. /g)?.length ?? 0;
  const playerIsWhite = data.white?.username?.toLowerCase() === viewerUsername;
  const playerResult = getPlayerResult(result, playerIsWhite);

  return {
    id: data.uuid || data.url?.split('/').pop() || String(data.end_time),
    pgn: data.pgn,
    white: {
      name: data.white?.username ?? 'White',
      rating: data.white?.rating ?? 0,
    },
    black: {
      name: data.black?.username ?? 'Black',
      rating: data.black?.rating ?? 0,
    },
    result,
    playerResult,   // 'win' | 'loss' | 'draw'
    playerIsWhite,
    timeControl: formatTimeControl(data.time_control),
    date: data.end_time
      ? new Date(data.end_time * 1000).toLocaleDateString()
      : '',
    movesNb: movesNb * 2,
    url: data.url ?? '',
  };
}

function getPlayerResult(result, playerIsWhite) {
  if (result === '1/2-1/2') return 'draw';
  if (result === '1-0') return playerIsWhite ? 'win' : 'loss';
  if (result === '0-1') return playerIsWhite ? 'loss' : 'win';
  return 'draw';
}

function formatTimeControl(raw) {
  if (!raw) return '';
  const [first, inc] = raw.split('+');
  if (!first) return '';
  const seconds = Number(first);
  const increment = inc ? `+${inc}` : '';
  if (seconds < 60) return `${seconds}s${increment}`;
  if (seconds < 3600) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return s ? `${m}m${getPaddedNumber(s)}s${increment}` : `${m}m${increment}`;
  }
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return m ? `${h}h${getPaddedNumber(m)}m${increment}` : `${h}h${increment}`;
}

export async function getPlayerAvatar(username) {
  try {
    const res = await fetch(
      `https://api.chess.com/pub/player/${encodeURIComponent(username.trim().toLowerCase())}`,
      { headers: { 'User-Agent': 'ChessPuzzleTrainer/1.0' } }
    );
    const data = await res.json();
    return typeof data.avatar === 'string' ? data.avatar : null;
  } catch {
    return null;
  }
}
