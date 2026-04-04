import { useState, useEffect, useRef } from 'react';
import './App.css';

import {
  initAuth, signOut, tryRestoreSession, hasStoredSession,
  trySilentSignIn, signIn, getUserSub, isSignedIn,
} from './data/auth';
import { DEV_MODE, setSheetId, setApiErrorHandler, getSettings, setSetting, getPuzzles, addPuzzle, getSrsStates, addSrsState, updateSrsState, addReview } from './data/api';
import { computeNextSrs } from './data/srs';
import { setLoadingListener } from './data/loadingTracker';
import { StockfishEngine } from './data/stockfish';
import { analyzeGame } from './data/puzzleDetector';

import LoadingOverlay from './components/LoadingOverlay';
import ErrorDialog from './components/ErrorDialog';
import SetupView from './views/SetupView';
import GamesView from './views/GamesView';
import SettingsView from './views/SettingsView';
import PuzzlesView from './views/PuzzlesView';
import PuzzleView from './views/PuzzleView';

function IconGames() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="3" width="20" height="14" rx="2"/>
      <path d="M8 21h8M12 17v4"/>
    </svg>
  );
}

function IconPuzzles() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 3H5a2 2 0 0 0-2 2v4m6-6h10a2 2 0 0 1 2 2v4M9 3v18m0 0h10a2 2 0 0 0 2-2v-4M9 21H5a2 2 0 0 1-2-2v-4m0 0h18"/>
    </svg>
  );
}

function IconSettings() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3"/>
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
    </svg>
  );
}

function storageKey(suffix) {
  return `chess_puzzles_${suffix}_${getUserSub() ?? 'default'}`;
}

export default function App() {
  const [authReady, setAuthReady] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [setupPhase, setSetupPhase] = useState(null);
  const [username, setUsername] = useState('');
  const [sheetId, setLocalSheetId] = useState('');
  const [activeTab, setActiveTab] = useState('games');
  const [games, setGames] = useState(null);
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState(null);
  const [darkMode, setDarkMode] = useState(
    () => localStorage.getItem('chess_puzzles_darkMode') === 'true'
  );

  // Analysis state: { [gameId]: { status, progress, candidates, errorMsg } }
  const [analysisState, setAnalysisState] = useState({});
  // Saved puzzles and SRS from persistent store
  const [puzzles, setPuzzles] = useState([]);
  const [srsStates, setSrsStatesData] = useState([]);
  // Currently solving puzzle (full-screen overlay)
  const [solvingPuzzle, setSolvingPuzzle] = useState(null);

  const pendingSheetIdRef = useRef(null);

  // Sync dark mode
  useEffect(() => {
    document.documentElement.dataset.theme = darkMode ? 'dark' : 'light';
    localStorage.setItem('chess_puzzles_darkMode', String(darkMode));
  }, [darkMode]);

  // Loading bar listener
  useEffect(() => {
    setLoadingListener(setLoading);
    return () => setLoadingListener(null);
  }, []);

  // Auth init
  useEffect(() => {
    if (DEV_MODE) {
      setAuthReady(true);
      setSignedIn(true);
      loadApp('mock-sheet-id', 'sparrkyy1');
      return;
    }

    function tryInit() {
      if (typeof google !== 'undefined' && google.accounts?.oauth2) {
        initAuth(onSignIn);
        setAuthReady(true);
        if (tryRestoreSession()) {
          onSignIn();
        } else if (hasStoredSession()) {
          trySilentSignIn();
        }
      } else {
        setTimeout(tryInit, 100);
      }
    }
    tryInit();
  }, []);

  // API error handler
  useEffect(() => {
    setApiErrorHandler((err) => setApiError(err));
  }, []);

  async function onSignIn() {
    setSignedIn(true);
    const storedSheetId = localStorage.getItem(storageKey('sheet'));
    if (!storedSheetId) { setSetupPhase('sheet'); return; }
    const storedUsername = localStorage.getItem(storageKey('username'));
    if (!storedUsername) {
      pendingSheetIdRef.current = storedSheetId;
      setSheetId(storedSheetId);
      setSetupPhase('username');
      return;
    }
    await loadApp(storedSheetId, storedUsername);
  }

  async function loadApp(id, uname) {
    setSetupPhase(null);
    setSheetId(id);
    setLocalSheetId(id);
    setUsername(uname);
    // Load persisted puzzles and SRS data
    try {
      const [p, s] = await Promise.all([getPuzzles(), getSrsStates()]);
      setPuzzles(p);
      setSrsStatesData(s);
    } catch {
      // Non-fatal: puzzles just start empty
    }
  }

  function handleSheetReady(id) {
    pendingSheetIdRef.current = id;
    localStorage.setItem(storageKey('sheet'), id);
    setSheetId(id);
    setSetupPhase('username');
  }

  function handleUsernameReady(uname) {
    const id = pendingSheetIdRef.current ?? localStorage.getItem(storageKey('sheet'));
    localStorage.setItem(storageKey('username'), uname);
    loadApp(id, uname);
  }

  function handleUsernameChange(uname) {
    localStorage.setItem(storageKey('username'), uname);
    setUsername(uname);
  }

  function handleSignOut() {
    setSignedIn(false);
    setSetupPhase(null);
    setUsername('');
    setLocalSheetId('');
    setActiveTab('games');
    setGames(null);
    setAnalysisState({});
    setPuzzles([]);
    setSrsStatesData([]);
  }

  // Start analysis queue for selected game IDs
  async function handleAnalyzeGames(gameIds) {
    if (!games) return;

    // Mark all as queued
    setAnalysisState(prev => {
      const next = { ...prev };
      for (const id of gameIds) next[id] = { status: 'queued', progress: null, candidates: [], errorMsg: null };
      return next;
    });

    const engine = new StockfishEngine();
    try {
      await engine.init();
    } catch (e) {
      // If engine fails to init, mark all as error
      setAnalysisState(prev => {
        const next = { ...prev };
        for (const id of gameIds) next[id] = { status: 'error', progress: null, candidates: [], errorMsg: 'Failed to start Stockfish' };
        return next;
      });
      return;
    }

    for (const gameId of gameIds) {
      const game = games.find(g => g.id === gameId);
      if (!game) continue;

      setAnalysisState(prev => ({
        ...prev,
        [gameId]: { ...prev[gameId], status: 'analyzing' },
      }));

      try {
        const candidates = await analyzeGame(game, engine, (progress) => {
          setAnalysisState(prev => ({
            ...prev,
            [gameId]: { ...prev[gameId], progress },
          }));
        });

        setAnalysisState(prev => ({
          ...prev,
          [gameId]: { status: 'done', candidates, progress: null, errorMsg: null },
        }));
      } catch (e) {
        setAnalysisState(prev => ({
          ...prev,
          [gameId]: { status: 'error', candidates: [], progress: null, errorMsg: e.message ?? 'Analysis failed' },
        }));
      }
    }

    engine.destroy();
  }

  // Approve a candidate → save as puzzle
  async function handleApproveCandidate(candidate) {
    try {
      const newPuzzle = await addPuzzle({
        gameUrl: candidate.gameUrl,
        fen: candidate.fen,
        playerColor: candidate.playerColor,
        bestMove: candidate.bestMove,
        bestLine: candidate.bestLine,
        evalBefore: candidate.evalBefore,
        evalAfter: candidate.evalAfter,
        theme: candidate.theme,
        createdAt: new Date().toISOString(),
      });
      setPuzzles(prev => [...prev, newPuzzle]);
    } catch (e) {
      console.error('Failed to save puzzle:', e);
    }
    // Remove candidate from analysis state
    _removeCandidate(candidate);
  }

  // Dismiss a candidate
  function handleDismissCandidate(candidate) {
    _removeCandidate(candidate);
  }

  // Rate a puzzle after solving — computes next SRS interval and persists
  async function handleRatePuzzle(puzzle, srsState, quality) {
    const next = computeNextSrs(srsState, quality);
    try {
      if (srsState?.id) {
        await updateSrsState(srsState.id, next);
        setSrsStatesData(prev => prev.map(s => s.id === srsState.id ? { ...s, ...next } : s));
      } else {
        const created = await addSrsState({
          puzzleId: puzzle.id,
          easeFactor: next.easeFactor,
          interval: next.interval,
          repetitions: next.repetitions,
          nextReview: next.nextReview,
        });
        setSrsStatesData(prev => [...prev, created]);
      }
      await addReview({
        puzzleId: puzzle.id,
        result: quality >= 3 ? 'solved' : 'failed',
        reviewedAt: new Date().toISOString(),
      });
    } catch (e) {
      console.error('Failed to save SRS:', e);
    }
    setSolvingPuzzle(null);
  }

  function _removeCandidate(candidate) {
    setAnalysisState(prev => {
      const next = { ...prev };
      for (const gameId of Object.keys(next)) {
        if (next[gameId].candidates) {
          next[gameId] = {
            ...next[gameId],
            candidates: next[gameId].candidates.filter(
              c => !(c.fen === candidate.fen && c.playerMove === candidate.playerMove)
            ),
          };
        }
      }
      return next;
    });
  }

  // Not signed in
  if (!signedIn || !authReady) {
    return (
      <>
        <LoadingOverlay visible={loading} />
        <div className="sign-in-screen">
          <div style={{ fontSize: '3rem' }}>♟</div>
          <h1>Chess Puzzles</h1>
          <p>Turn your Chess.com mistakes into personalized puzzles. Practice what you get wrong until you get it right.</p>
          {authReady ? (
            <button className="btn-accent" onClick={signIn} style={{ maxWidth: 280 }}>
              Sign in with Google
            </button>
          ) : (
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Loading…</p>
          )}
        </div>
      </>
    );
  }

  // Setup flow
  if (setupPhase) {
    return (
      <>
        <LoadingOverlay visible={loading} />
        <SetupView
          setupPhase={setupPhase}
          onSheetReady={handleSheetReady}
          onUsernameReady={handleUsernameReady}
        />
        <ErrorDialog error={apiError} onDismiss={() => setApiError(null)} onReauth={signIn} />
      </>
    );
  }

  const allCandidates = Object.values(analysisState)
    .filter(s => s.status === 'done')
    .flatMap(s => s.candidates ?? []);
  const pendingCandidateCount = allCandidates.length;
  const srsMap = Object.fromEntries(srsStates.map(s => [s.puzzleId, s]));

  // Main app
  return (
    <>
      <LoadingOverlay visible={loading} />
      {solvingPuzzle && (
        <PuzzleView
          puzzle={solvingPuzzle}
          srsState={srsMap[solvingPuzzle.id]}
          onRate={handleRatePuzzle}
          onBack={() => setSolvingPuzzle(null)}
        />
      )}
      <div className="app">
        <header className="app-header">
          <h1>
            {activeTab === 'games' && '♟ Games'}
            {activeTab === 'puzzles' && 'Puzzles'}
            {activeTab === 'settings' && 'Settings'}
          </h1>
        </header>

        <main className="app-content">
          {activeTab === 'games' && (
            <GamesView
              username={username}
              onUsernameChange={handleUsernameChange}
              games={games}
              onGamesChange={setGames}
              analysisState={analysisState}
              onAnalyzeGames={handleAnalyzeGames}
            />
          )}
          {activeTab === 'puzzles' && (
            <PuzzlesView
              candidates={allCandidates}
              puzzles={puzzles}
              srsStates={srsStates}
              onApprove={handleApproveCandidate}
              onDismiss={handleDismissCandidate}
              onSolvePuzzle={setSolvingPuzzle}
            />
          )}
          {activeTab === 'settings' && (
            <SettingsView
              username={username}
              sheetId={sheetId}
              darkMode={darkMode}
              onDarkModeChange={setDarkMode}
              onUsernameChange={handleUsernameChange}
              onSignOut={handleSignOut}
            />
          )}
        </main>

        <nav className="app-nav">
          <button
            className={`nav-btn ${activeTab === 'games' ? 'active' : ''}`}
            onClick={() => setActiveTab('games')}
          >
            <IconGames />
            Games
          </button>
          <button
            className={`nav-btn ${activeTab === 'puzzles' ? 'active' : ''}`}
            onClick={() => setActiveTab('puzzles')}
            style={{ position: 'relative' }}
          >
            <IconPuzzles />
            Puzzles
            {pendingCandidateCount > 0 && (
              <span style={{
                position: 'absolute', top: 6, right: '50%', transform: 'translateX(10px)',
                background: 'var(--accent)', color: '#fff',
                borderRadius: '50%', width: 16, height: 16,
                fontSize: '0.6rem', fontWeight: 700,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {pendingCandidateCount > 9 ? '9+' : pendingCandidateCount}
              </span>
            )}
          </button>
          <button
            className={`nav-btn ${activeTab === 'settings' ? 'active' : ''}`}
            onClick={() => setActiveTab('settings')}
          >
            <IconSettings />
            Settings
          </button>
        </nav>
      </div>

      <ErrorDialog
        error={apiError}
        onDismiss={() => setApiError(null)}
        onReauth={signIn}
      />
    </>
  );
}
