// In-memory mock backend for dev mode (?dev URL param)

let store = {
  puzzles: [],
  srsStates: [],
  reviews: [],
  settings: {
    chesscomUsername: 'hikaru',
  },
};

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
  return [...store.puzzles];
}

export async function addPuzzle(puzzle) {
  await delay();
  const id = `puzzle-${Date.now()}`;
  const newPuzzle = { ...puzzle, id };
  store.puzzles.push(newPuzzle);
  return newPuzzle;
}

export async function getSrsStates() {
  await delay();
  return [...store.srsStates];
}

export async function addSrsState(srs) {
  await delay();
  const id = `srs-${Date.now()}`;
  const newSrs = { ...srs, id };
  store.srsStates.push(newSrs);
  return newSrs;
}

export async function updateSrsState(srsId, updates) {
  await delay();
  const idx = store.srsStates.findIndex(s => s.id === srsId);
  if (idx !== -1) store.srsStates[idx] = { ...store.srsStates[idx], ...updates };
}

export async function addReview(review) {
  await delay();
  const id = `review-${Date.now()}`;
  const newReview = { ...review, id };
  store.reviews.push(newReview);
  return newReview;
}

export async function getSettings() {
  await delay();
  return { ...store.settings };
}

export async function setSetting(key, value) {
  await delay();
  store.settings[key] = value;
}

export function rowToPuzzle(row) { return row; }
export function puzzleToRow(p) { return p; }
export function rowToSrs(row) { return row; }
export function srsToRow(s) { return s; }
