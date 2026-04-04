import { useState, useEffect, useRef } from 'react';
import './App.css';

import {
  initAuth, signOut, tryRestoreSession, hasStoredSession,
  trySilentSignIn, signIn, getUserSub, isSignedIn,
} from './data/auth';
import { DEV_MODE, setSheetId, setApiErrorHandler, getSettings, setSetting } from './data/api';
import { setLoadingListener } from './data/loadingTracker';

import LoadingOverlay from './components/LoadingOverlay';
import ErrorDialog from './components/ErrorDialog';
import SetupView from './views/SetupView';
import GamesView from './views/GamesView';
import SettingsView from './views/SettingsView';

// Nav tab icons (inline SVG for zero dependencies)
function IconGames() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="3" width="20" height="14" rx="2"/>
      <path d="M8 21h8M12 17v4"/>
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
  const [setupPhase, setSetupPhase] = useState(null); // null | 'sheet' | 'username'
  const [username, setUsername] = useState('');
  const [sheetId, setLocalSheetId] = useState('');
  const [activeTab, setActiveTab] = useState('games');
  const [games, setGames] = useState(null);
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState(null);
  const [darkMode, setDarkMode] = useState(
    () => localStorage.getItem('chess_puzzles_darkMode') === 'true'
  );

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
    if (!storedSheetId) {
      setSetupPhase('sheet');
      return;
    }

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

  // Main app
  return (
    <>
      <LoadingOverlay visible={loading} />
      <div className="app">
        <header className="app-header">
          <h1>
            {activeTab === 'games' && '♟ Games'}
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
