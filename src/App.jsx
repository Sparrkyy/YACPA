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
import ReviewView from './views/ReviewView';
import DrillView from './views/DrillView';
import PuzzleView from './views/PuzzleView';
import AnalysisBoardView from './views/AnalysisBoardView';

function IconGames() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="3" width="20" height="14" rx="2"/>
      <path d="M8 21h8M12 17v4"/>
    </svg>
  );
}

function IconReview() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 11l3 3L22 4"/>
      <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
    </svg>
  );
}

function IconDrill() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="5 3 19 12 5 21 5 3"/>
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

function DrillSummary({ stats, onDone }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'var(--bg)', zIndex: 100,
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', padding: 32, textAlign: 'center', gap: 24,
    }}>
      <div style={{ fontSize: '3rem' }}>✓</div>
      <div>
        <div style={{ fontSize: '1.4rem', fontWeight: 800, marginBottom: 8 }}>Session complete</div>
        <div style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
          You drilled {stats?.total ?? 0} puzzle{stats?.total !== 1 ? 's' : ''}
        </div>
      </div>
      <button className="btn-accent" style={{ maxWidth: 280 }} onClick={onDone}>
        Back to puzzles
      </button>
    </div>
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
  const [games, setGamesRaw] = useState(null);
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
  // Analysis board overlay (lifted here so it escapes app-content overflow context)
  const [analysisBoard, setAnalysisBoard] = useState(null); // { fen, playerColor, bestLine }
  // Drill session queue: null=inactive, []=done, [id,...]=active
  const [drillQueue, setDrillQueue] = useState(null);
  const [drillSessionStats, setDrillSessionStats] = useState(null);

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
    // Restore persisted analyzed games and their analysis state
    try {
      const savedGames = localStorage.getItem(storageKey('analyzed_games'));
      const savedState = localStorage.getItem(storageKey('analysis_state'));
      if (savedGames) setGamesRaw(JSON.parse(savedGames));
      if (savedState) setAnalysisState(JSON.parse(savedState));
    } catch {}
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
    localStorage.removeItem(storageKey('analyzed_games'));
    localStorage.removeItem(storageKey('analysis_state'));
    localStorage.removeItem(storageKey('games')); // clean up old key
    setSignedIn(false);
    setSetupPhase(null);
    setUsername('');
    setLocalSheetId('');
    setActiveTab('games');
    setGamesRaw(null);
    setAnalysisState({});
    setPuzzles([]);
    setSrsStatesData([]);
  }

  // Merge new games with persisted analyzed ones, deduplicating by ID
  function handleGamesChange(newGames) {
    if (!newGames) { setGamesRaw(null); return; }
    const analyzedIds = new Set(
      Object.entries(analysisState)
        .filter(([, v]) => v.status === 'done')
        .map(([id]) => id)
    );
    const analyzedGames = (games ?? []).filter(g => analyzedIds.has(g.id));
    const freshGames = newGames.filter(g => !analyzedIds.has(g.id));
    setGamesRaw([...analyzedGames, ...freshGames]);
  }

  // Persist only analyzed games and their analysis state to localStorage
  function persistAnalyzed(nextAnalysisState) {
    try {
      const doneIds = new Set(
        Object.entries(nextAnalysisState)
          .filter(([, v]) => v.status === 'done')
          .map(([id]) => id)
      );
      const doneGames = (games ?? []).filter(g => doneIds.has(g.id));
      const doneState = Object.fromEntries([...doneIds].map(id => [id, nextAnalysisState[id]]));
      localStorage.setItem(storageKey('analyzed_games'), JSON.stringify(doneGames));
      localStorage.setItem(storageKey('analysis_state'), JSON.stringify(doneState));
    } catch {}
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

        setAnalysisState(prev => {
          const next = { ...prev, [gameId]: { status: 'done', candidates, progress: null, errorMsg: null } };
          persistAnalyzed(next);
          return next;
        });
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

  // Start a drill session with all due puzzles
  function handleStartDrill() {
    const today = new Date().toISOString().slice(0, 10);
    const due = puzzles.filter(p => {
      const srs = srsMap[p.id];
      return !srs || srs.nextReview <= today;
    });
    if (due.length === 0) return;
    setDrillQueue(due.map(p => p.id));
    setDrillSessionStats({ total: due.length, completed: 0 });
  }

  function handleEndDrillSession() {
    setDrillQueue(null);
    setDrillSessionStats(null);
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
    if (drillQueue !== null) {
      setDrillSessionStats(prev => ({ ...prev, completed: prev.completed + 1 }));
      setDrillQueue(prev => prev.slice(1));
    } else {
      setSolvingPuzzle(null);
    }
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

      {/* Drill session overlay */}
      {drillQueue !== null && (
        drillQueue.length === 0
          ? <DrillSummary stats={drillSessionStats} onDone={handleEndDrillSession} />
          : (() => {
              const cur = puzzles.find(p => p.id === drillQueue[0]);
              return cur ? (
                <PuzzleView
                  key={drillQueue[0]}
                  puzzle={cur}
                  srsState={srsMap[cur.id]}
                  onRate={handleRatePuzzle}
                  onBack={handleEndDrillSession}
                  drillProgress={drillSessionStats}
                  onOpenAnalysis={setAnalysisBoard}
                />
              ) : null;
            })()
      )}

      {/* Ad-hoc single puzzle */}
      {drillQueue === null && solvingPuzzle && (
        <PuzzleView
          puzzle={solvingPuzzle}
          srsState={srsMap[solvingPuzzle.id]}
          onRate={handleRatePuzzle}
          onBack={() => setSolvingPuzzle(null)}
          onOpenAnalysis={setAnalysisBoard}
        />
      )}

      {/* Analysis board — rendered here (outside app-content) so position:fixed works on iOS */}
      {analysisBoard && (
        <AnalysisBoardView
          fen={analysisBoard.fen}
          playerColor={analysisBoard.playerColor}
          bestLine={analysisBoard.bestLine}
          onClose={() => setAnalysisBoard(null)}
        />
      )}

      <div className="app">
        <header className="app-header">
          <h1>
            {activeTab === 'games' && '♟ Games'}
            {activeTab === 'review' && 'Review'}
            {activeTab === 'drill' && 'Drill'}
            {activeTab === 'settings' && 'Settings'}
          </h1>
        </header>

        <main className="app-content">
          {activeTab === 'games' && (
            <GamesView
              username={username}
              onUsernameChange={handleUsernameChange}
              games={games}
              onGamesChange={handleGamesChange}
              analysisState={analysisState}
              onAnalyzeGames={handleAnalyzeGames}
            />
          )}
          {activeTab === 'review' && (
            <ReviewView
              candidates={allCandidates}
              onApprove={handleApproveCandidate}
              onDismiss={handleDismissCandidate}
              onOpenAnalysis={setAnalysisBoard}
            />
          )}
          {activeTab === 'drill' && (
            <DrillView
              puzzles={puzzles}
              srsStates={srsStates}
              onSolvePuzzle={setSolvingPuzzle}
              onStartDrill={handleStartDrill}
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
            className={`nav-btn ${activeTab === 'review' ? 'active' : ''}`}
            onClick={() => setActiveTab('review')}
            style={{ position: 'relative' }}
          >
            <IconReview />
            Review
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
            className={`nav-btn ${activeTab === 'drill' ? 'active' : ''}`}
            onClick={() => setActiveTab('drill')}
          >
            <IconDrill />
            Drill
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
