import * as realApi from './sheetsApi';
import * as mockApi from './mockData';

export const DEV_MODE =
  new URLSearchParams(window.location.search).has('dev') ||
  import.meta.env.VITE_DEV_MODE === 'true';

const api = DEV_MODE ? mockApi : realApi;

export const {
  setSheetId,
  setApiErrorHandler,
  createNewSheet,
  validateSheet,
  getPuzzles,
  addPuzzle,
  updatePuzzle,
  getSrsStates,
  addSrsState,
  updateSrsState,
  addReview,
  getSettings,
  setSetting,
  rowToPuzzle,
  puzzleToRow,
  rowToSrs,
  srsToRow,
  addCandidates,
  updateCandidateDecision,
  ensureCandidatesSheet,
} = api;
