// localStorage-backed mock backend for dev mode (?dev URL param)
// Stores data as 2D arrays (same row format as the real Google Sheets API)

const KEYS = {
  puzzles: 'mock_puzzles',
  srs: 'mock_srs',
  reviews: 'mock_reviews',
  settings: 'mock_settings',
  candidates: 'mock_candidates',
};

const HEADERS = {
  puzzles: ['id', 'gameUrl', 'fen', 'playerColor', 'bestMove', 'bestLine', 'evalBefore', 'evalAfter', 'theme', 'createdAt', 'notes', 'prevFen', 'opponentMove'],
  srs: ['id', 'puzzleId', 'easeFactor', 'interval', 'repetitions', 'nextReview'],
  reviews: ['id', 'puzzleId', 'result', 'reviewedAt'],
  settings: ['key', 'value'],
  candidates: ['id', 'gameUrl', 'fen', 'playerColor', 'playerMove', 'playerMoveSan', 'bestMove', 'bestLine', 'evalBefore', 'evalAfter', 'winPctDrop', 'theme', 'decision', 'decidedAt', 'createdAt'],
};

function load(key) {
  const table = key.replace('mock_', '');
  try {
    return JSON.parse(localStorage.getItem(key)) || [HEADERS[table]];
  } catch {
    return [HEADERS[table]];
  }
}

function save(key, rows) {
  localStorage.setItem(key, JSON.stringify(rows));
}

const delay = (ms = 50) => new Promise(r => setTimeout(r, ms));

export function setSheetId() {}
export function setApiErrorHandler() {}

export async function createNewSheet() {
  await delay();
  return 'mock-sheet-id';
}

export async function validateSheet() {
  await delay();
  return true;
}

export async function getPuzzles() {
  await delay();
  const rows = load(KEYS.puzzles);
  return rows.slice(1).map(rowToPuzzle);
}

export async function addPuzzle(puzzle) {
  await delay();
  const id = `puzzle-${Date.now()}`;
  const newPuzzle = { ...puzzle, id };
  const rows = load(KEYS.puzzles);
  rows.push(puzzleToRow(newPuzzle));
  save(KEYS.puzzles, rows);
  return newPuzzle;
}

export async function getSrsStates() {
  await delay();
  const rows = load(KEYS.srs);
  return rows.slice(1).map(rowToSrs);
}

export async function addSrsState(srs) {
  await delay();
  const id = `srs-${Date.now()}`;
  const newSrs = { ...srs, id };
  const rows = load(KEYS.srs);
  rows.push(srsToRow(newSrs));
  save(KEYS.srs, rows);
  return newSrs;
}

export async function updateSrsState(srsId, updates) {
  await delay();
  const rows = load(KEYS.srs);
  const idx = rows.findIndex((r, i) => i > 0 && r[0] === srsId);
  if (idx !== -1) {
    const current = rowToSrs(rows[idx]);
    rows[idx] = srsToRow({ ...current, ...updates });
    save(KEYS.srs, rows);
  }
}

export async function addReview(review) {
  await delay();
  const id = `review-${Date.now()}`;
  const newReview = { ...review, id };
  const rows = load(KEYS.reviews);
  rows.push([newReview.id, newReview.puzzleId, newReview.result, newReview.reviewedAt]);
  save(KEYS.reviews, rows);
  return newReview;
}

export async function getSettings() {
  await delay();
  const rows = load(KEYS.settings);
  return rows.slice(1).reduce((acc, [key, value]) => {
    acc[key] = value;
    return acc;
  }, {});
}

export async function setSetting(key, value) {
  await delay();
  const rows = load(KEYS.settings);
  const idx = rows.findIndex((r, i) => i > 0 && r[0] === key);
  if (idx !== -1) {
    rows[idx] = [key, value];
  } else {
    rows.push([key, value]);
  }
  save(KEYS.settings, rows);
}

export function rowToPuzzle(row) {
  return {
    id: row[0],
    gameUrl: row[1],
    fen: row[2],
    playerColor: row[3],
    bestMove: row[4],
    bestLine: row[5],
    evalBefore: Number(row[6]),
    evalAfter: Number(row[7]),
    theme: row[8],
    createdAt: row[9],
    notes: row[10] ?? '',
    prevFen: row[11] ?? '',
    opponentMove: row[12] ?? '',
  };
}

export function puzzleToRow(p) {
  return [p.id, p.gameUrl, p.fen, p.playerColor, p.bestMove, p.bestLine,
          p.evalBefore, p.evalAfter, p.theme, p.createdAt, p.notes ?? '',
          p.prevFen ?? '', p.opponentMove ?? ''];
}

export async function updatePuzzle(puzzleId, updates) {
  await delay();
  const rows = load(KEYS.puzzles);
  const idx = rows.findIndex((r, i) => i > 0 && r[0] === puzzleId);
  if (idx !== -1) {
    rows[idx] = puzzleToRow({ ...rowToPuzzle(rows[idx]), ...updates });
    save(KEYS.puzzles, rows);
  }
}

export function rowToSrs(row) {
  return {
    id: row[0],
    puzzleId: row[1],
    easeFactor: Number(row[2]),
    interval: Number(row[3]),
    repetitions: Number(row[4]),
    nextReview: row[5],
  };
}

export function srsToRow(s) {
  return [s.id, s.puzzleId, s.easeFactor, s.interval, s.repetitions, s.nextReview];
}

// --- Candidates ---

export async function addCandidates(candidates) {
  await delay();
  if (!candidates.length) return [];
  const createdAt = new Date().toISOString();
  const withIds = candidates.map(c => ({
    ...c,
    id: `candidate-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    decision: '',
    decidedAt: '',
    createdAt,
  }));
  const rows = load(KEYS.candidates);
  for (const c of withIds) {
    rows.push([c.id, c.gameUrl, c.fen, c.playerColor, c.playerMove, c.playerMoveSan,
               c.bestMove, c.bestLine, c.evalBefore, c.evalAfter, c.winPctDrop,
               c.theme, c.decision, c.decidedAt, c.createdAt]);
  }
  save(KEYS.candidates, rows);
  return withIds;
}

export async function updateCandidateDecision(candidateId, decision) {
  await delay();
  const rows = load(KEYS.candidates);
  const idx = rows.findIndex((r, i) => i > 0 && r[0] === candidateId);
  if (idx !== -1) {
    rows[idx][12] = decision;
    rows[idx][13] = new Date().toISOString();
    save(KEYS.candidates, rows);
  }
}

export async function ensureCandidatesSheet() {
  // No-op in mock mode — localStorage tables are lazily created by load()
}

export async function ensureAnalyzedGamesSheet() {}
export async function getAnalyzedGameIds() { return new Set(); }
export async function markGameAnalyzed() {}
