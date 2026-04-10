import { getToken } from './auth';
import { startLoading, stopLoading } from './loadingTracker';

let sheetId = null;
export function setSheetId(id) { sheetId = id; }

let errorCallback = null;
export function setApiErrorHandler(handler) { errorCallback = handler; }

function getBase() { return `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}`; }

function authHeaders() {
  return { Authorization: `Bearer ${getToken()}` };
}

async function sheetsGet(path, operation) {
  startLoading();
  try {
    const res = await fetch(`${getBase()}${path}`, { headers: authHeaders() });
    if (!res.ok) {
      const err = Object.assign(new Error('Sheets GET failed'), { status: res.status });
      errorCallback?.({ message: err.message, status: res.status, operation });
      throw err;
    }
    return res.json();
  } finally {
    stopLoading();
  }
}

async function sheetsPost(path, body, operation) {
  startLoading();
  try {
    const res = await fetch(`${getBase()}${path}`, {
      method: 'POST',
      headers: { ...authHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const err = Object.assign(new Error('Sheets POST failed'), { status: res.status });
      errorCallback?.({ message: err.message, status: res.status, operation });
      throw err;
    }
    return res.json();
  } finally {
    stopLoading();
  }
}

async function sheetsPut(path, body, operation) {
  startLoading();
  try {
    const res = await fetch(`${getBase()}${path}`, {
      method: 'PUT',
      headers: { ...authHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const err = Object.assign(new Error('Sheets PUT failed'), { status: res.status });
      errorCallback?.({ message: err.message, status: res.status, operation });
      throw err;
    }
    return res.json();
  } finally {
    stopLoading();
  }
}

// --- Sheet creation ---

export async function createNewSheet() {
  startLoading();
  try { return await _createNewSheet(); } finally { stopLoading(); }
}

async function _createNewSheet() {
  const BASE_SHEETS = 'https://sheets.googleapis.com/v4/spreadsheets';

  const createRes = await fetch(BASE_SHEETS, {
    method: 'POST',
    headers: { ...authHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ properties: { title: 'Chess Puzzle Trainer' } }),
  });
  if (!createRes.ok) {
    const err = Object.assign(new Error('Failed to create sheet'), { status: createRes.status });
    errorCallback?.({ message: err.message, status: createRes.status, operation: 'creating sheet' });
    throw err;
  }
  const created = await createRes.json();
  const id = created.spreadsheetId;
  const defaultSheetId = created.sheets[0].properties.sheetId;

  // Rename Sheet1 → Puzzles, add Reviews, SRS, Settings, Candidates tabs
  await fetch(`${BASE_SHEETS}/${id}:batchUpdate`, {
    method: 'POST',
    headers: { ...authHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      requests: [
        { updateSheetProperties: { properties: { sheetId: defaultSheetId, title: 'Puzzles' }, fields: 'title' } },
        { addSheet: { properties: { title: 'Reviews' } } },
        { addSheet: { properties: { title: 'SRS' } } },
        { addSheet: { properties: { title: 'Settings' } } },
        { addSheet: { properties: { title: 'Candidates' } } },
      ],
    }),
  });

  // Write headers for each tab
  await Promise.all([
    fetch(`${BASE_SHEETS}/${id}/values/Puzzles!A1:M1?valueInputOption=RAW`, {
      method: 'PUT',
      headers: { ...authHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ values: [['id', 'gameUrl', 'fen', 'playerColor', 'bestMove', 'bestLine', 'evalBefore', 'evalAfter', 'theme', 'createdAt', 'notes', 'prevFen', 'opponentMove']] }),
    }),
    fetch(`${BASE_SHEETS}/${id}/values/Reviews!A1:D1?valueInputOption=RAW`, {
      method: 'PUT',
      headers: { ...authHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ values: [['id', 'puzzleId', 'result', 'reviewedAt']] }),
    }),
    fetch(`${BASE_SHEETS}/${id}/values/SRS!A1:F1?valueInputOption=RAW`, {
      method: 'PUT',
      headers: { ...authHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ values: [['id', 'puzzleId', 'easeFactor', 'interval', 'repetitions', 'nextReview']] }),
    }),
    fetch(`${BASE_SHEETS}/${id}/values/Settings!A1:B1?valueInputOption=RAW`, {
      method: 'PUT',
      headers: { ...authHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ values: [['key', 'value']] }),
    }),
    fetch(`${BASE_SHEETS}/${id}/values/Candidates!A1:O1?valueInputOption=RAW`, {
      method: 'PUT',
      headers: { ...authHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ values: [['id', 'gameUrl', 'fen', 'playerColor', 'playerMove', 'playerMoveSan', 'bestMove', 'bestLine', 'evalBefore', 'evalAfter', 'winPctDrop', 'theme', 'decision', 'decidedAt', 'createdAt']] }),
    }),
  ]);

  return id;
}

export async function validateSheet(id) {
  try {
    const res = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${id}/values/Puzzles!A1`,
      { headers: authHeaders() }
    );
    return res.ok;
  } catch {
    return false;
  }
}

// --- Puzzles CRUD ---

export function rowToPuzzle(row) {
  return {
    id: row[0] ?? '',
    gameUrl: row[1] ?? '',
    fen: row[2] ?? '',
    playerColor: row[3] ?? '',
    bestMove: row[4] ?? '',
    bestLine: row[5] ?? '',
    evalBefore: Number(row[6] ?? 0),
    evalAfter: Number(row[7] ?? 0),
    theme: row[8] ?? '',
    createdAt: row[9] ?? '',
    notes: row[10] ?? '',
    prevFen: row[11] ?? '',
    opponentMove: row[12] ?? '',
  };
}

export function puzzleToRow(p) {
  return [p.id, p.gameUrl, p.fen, p.playerColor, p.bestMove, p.bestLine, p.evalBefore, p.evalAfter, p.theme, p.createdAt, p.notes ?? '', p.prevFen ?? '', p.opponentMove ?? ''];
}

export async function getPuzzles() {
  const data = await sheetsGet('/values/Puzzles!A:M', 'loading puzzles');
  const rows = data.values ?? [];
  return rows.slice(1).map(rowToPuzzle).filter(p => p.id);
}

export async function addPuzzle(puzzle) {
  const id = crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const newPuzzle = { ...puzzle, id };
  await sheetsPost(
    '/values/Puzzles!A:M:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS',
    { values: [puzzleToRow(newPuzzle)] },
    'saving puzzle'
  );
  return newPuzzle;
}

export async function updatePuzzle(puzzleId, updates) {
  const data = await sheetsGet('/values/Puzzles!A:M', 'updating puzzle');
  const rows = data.values ?? [];
  const rowIndex = rows.findIndex((r, i) => i > 0 && r[0] === puzzleId);
  if (rowIndex === -1) return;
  const merged = { ...rowToPuzzle(rows[rowIndex]), ...updates };
  const sheetRow = rowIndex + 1;
  await sheetsPut(
    `/values/Puzzles!A${sheetRow}:M${sheetRow}?valueInputOption=RAW`,
    { values: [puzzleToRow(merged)] },
    'updating puzzle'
  );
}

// --- SRS CRUD ---

export function rowToSrs(row) {
  return {
    id: row[0] ?? '',
    puzzleId: row[1] ?? '',
    easeFactor: Number(row[2] ?? 2.5),
    interval: Number(row[3] ?? 0),
    repetitions: Number(row[4] ?? 0),
    nextReview: row[5] ?? '',
  };
}

export function srsToRow(s) {
  return [s.id, s.puzzleId, s.easeFactor, s.interval, s.repetitions, s.nextReview];
}

export async function getSrsStates() {
  const data = await sheetsGet('/values/SRS!A:F', 'loading SRS');
  const rows = data.values ?? [];
  return rows.slice(1).map(rowToSrs).filter(s => s.id);
}

export async function addSrsState(srs) {
  const id = crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const newSrs = { ...srs, id };
  await sheetsPost(
    '/values/SRS!A:F:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS',
    { values: [srsToRow(newSrs)] },
    'saving SRS state'
  );
  return newSrs;
}

export async function updateSrsState(srsId, updates) {
  const data = await sheetsGet('/values/SRS!A:F', 'updating SRS');
  const rows = data.values ?? [];
  const rowIndex = rows.findIndex((r, i) => i > 0 && r[0] === srsId);
  if (rowIndex === -1) return;

  const merged = { ...rowToSrs(rows[rowIndex]), ...updates };
  const sheetRow = rowIndex + 1;
  await sheetsPut(
    `/values/SRS!A${sheetRow}:F${sheetRow}?valueInputOption=RAW`,
    { values: [srsToRow(merged)] },
    'updating SRS state'
  );
}

// --- Reviews CRUD ---

export async function addReview(review) {
  const id = crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const newReview = { ...review, id };
  await sheetsPost(
    '/values/Reviews!A:D:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS',
    { values: [[newReview.id, newReview.puzzleId, newReview.result, newReview.reviewedAt]] },
    'saving review'
  );
  return newReview;
}

// --- Settings CRUD ---

export async function getSettings() {
  const data = await sheetsGet('/values/Settings!A:B', 'loading settings');
  const rows = data.values ?? [];
  const settings = {};
  for (const row of rows.slice(1)) {
    if (row[0]) settings[row[0]] = row[1] ?? '';
  }
  return settings;
}

export async function setSetting(key, value) {
  const data = await sheetsGet('/values/Settings!A:B', 'updating setting');
  const rows = data.values ?? [];
  const rowIndex = rows.findIndex((r, i) => i > 0 && r[0] === key);

  if (rowIndex === -1) {
    await sheetsPost(
      '/values/Settings!A:B:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS',
      { values: [[key, value]] },
      'saving setting'
    );
  } else {
    const sheetRow = rowIndex + 1;
    await sheetsPut(
      `/values/Settings!A${sheetRow}:B${sheetRow}?valueInputOption=RAW`,
      { values: [[key, value]] },
      'updating setting'
    );
  }
}

// --- Candidates CRUD ---

const CANDIDATE_HEADERS = ['id', 'gameUrl', 'fen', 'playerColor', 'playerMove', 'playerMoveSan', 'bestMove', 'bestLine', 'evalBefore', 'evalAfter', 'winPctDrop', 'theme', 'decision', 'decidedAt', 'createdAt'];

function candidateToRow(c) {
  return [
    c.id ?? '', c.gameUrl ?? '', c.fen ?? '', c.playerColor ?? '',
    c.playerMove ?? '', c.playerMoveSan ?? '', c.bestMove ?? '', c.bestLine ?? '',
    c.evalBefore ?? 0, c.evalAfter ?? 0, c.winPctDrop ?? 0, c.theme ?? '',
    c.decision ?? '', c.decidedAt ?? '', c.createdAt ?? '',
  ];
}

export async function addCandidates(candidates) {
  if (!candidates.length) return [];
  const createdAt = new Date().toISOString();
  const withIds = candidates.map(c => ({
    ...c,
    id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    decision: '',
    decidedAt: '',
    createdAt,
  }));
  await sheetsPost(
    '/values/Candidates!A:O:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS',
    { values: withIds.map(candidateToRow) },
    'saving candidates'
  );
  return withIds;
}

export async function updateCandidateDecision(candidateId, decision) {
  const data = await sheetsGet('/values/Candidates!A:O', 'updating candidate');
  const rows = data.values ?? [];
  const rowIndex = rows.findIndex((r, i) => i > 0 && r[0] === candidateId);
  if (rowIndex === -1) return;
  const sheetRow = rowIndex + 1;
  // Only update columns M (decision) and N (decidedAt) — indices 12 and 13
  const updated = [...rows[rowIndex]];
  while (updated.length < 15) updated.push('');
  updated[12] = decision;
  updated[13] = new Date().toISOString();
  await sheetsPut(
    `/values/Candidates!A${sheetRow}:O${sheetRow}?valueInputOption=RAW`,
    { values: [updated] },
    'updating candidate decision'
  );
}

// --- AnalyzedGames (cross-device sync) ---

// Ensure the AnalyzedGames tab exists; if not, create it with headers.
export async function ensureAnalyzedGamesSheet() {
  try {
    const res = await fetch(
      `${getBase()}/values/AnalyzedGames!A1`,
      { headers: authHeaders() }
    );
    if (res.ok) return;
    if (res.status !== 400 && res.status !== 404) return;
  } catch {
    return;
  }
  try {
    await fetch(`${getBase()}:batchUpdate`, {
      method: 'POST',
      headers: { ...authHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ requests: [{ addSheet: { properties: { title: 'AnalyzedGames' } } }] }),
    });
    await sheetsPut(
      '/values/AnalyzedGames!A1:B1?valueInputOption=RAW',
      { values: [['gameId', 'analyzedAt']] },
      'creating AnalyzedGames tab'
    );
  } catch { /* non-fatal */ }
}

// Returns a Set of game IDs that have been analyzed (across all devices).
export async function getAnalyzedGameIds() {
  try {
    const data = await sheetsGet('/values/AnalyzedGames!A:A', 'loading analyzed games');
    const rows = data.values ?? [];
    return new Set(rows.slice(1).map(r => r[0]).filter(Boolean));
  } catch {
    return new Set();
  }
}

// Records a game ID as analyzed in the sheet.
export async function markGameAnalyzed(gameId) {
  await sheetsPost(
    '/values/AnalyzedGames!A:B:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS',
    { values: [[gameId, new Date().toISOString()]] },
    'marking game analyzed'
  );
}

// Ensure the Candidates tab exists; if not, create it with headers.
// Safe to call on every app load — no-op if tab already present.
export async function ensureCandidatesSheet() {
  try {
    const res = await fetch(
      `${getBase()}/values/Candidates!A1`,
      { headers: authHeaders() }
    );
    if (res.ok) return; // tab already exists
    if (res.status !== 400 && res.status !== 404) return; // unexpected error — skip silently
  } catch {
    return;
  }
  // Tab missing — add it
  try {
    await fetch(`${getBase()}:batchUpdate`, {
      method: 'POST',
      headers: { ...authHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ requests: [{ addSheet: { properties: { title: 'Candidates' } } }] }),
    });
    await sheetsPut(
      '/values/Candidates!A1:O1?valueInputOption=RAW',
      { values: [CANDIDATE_HEADERS] },
      'creating candidates tab'
    );
  } catch { /* non-fatal */ }
}
