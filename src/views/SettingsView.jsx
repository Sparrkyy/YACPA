import { useState } from 'react';
import { signOut } from '../data/auth';

export default function SettingsView({ username, sheetId, darkMode, onDarkModeChange, onUsernameChange, onSignOut }) {
  const [editingUsername, setEditingUsername] = useState(false);
  const [newUsername, setNewUsername] = useState(username);

  function handleUsernameSubmit(e) {
    e.preventDefault();
    const trimmed = newUsername.trim();
    if (!trimmed || trimmed === username) {
      setEditingUsername(false);
      return;
    }
    onUsernameChange(trimmed);
    setEditingUsername(false);
  }

  function handleSignOut() {
    signOut();
    onSignOut();
  }

  return (
    <div>
      <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius)', border: '1px solid var(--border)', padding: '0 16px', marginBottom: 16 }}>
        <div className="settings-row">
          <span className="settings-label">Chess.com username</span>
          {editingUsername ? (
            <form onSubmit={handleUsernameSubmit} style={{ display: 'flex', gap: 8 }}>
              <input
                type="text"
                value={newUsername}
                onChange={e => setNewUsername(e.target.value)}
                autoFocus
                autoCapitalize="none"
                autoCorrect="off"
                style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 6, padding: '4px 8px', color: 'var(--text)', fontSize: '0.9rem', width: 120 }}
              />
              <button type="submit" style={{ color: 'var(--accent)', fontWeight: 600, fontSize: '0.9rem' }}>Save</button>
            </form>
          ) : (
            <button
              onClick={() => { setNewUsername(username); setEditingUsername(true); }}
              style={{ color: 'var(--accent)', fontSize: '0.9rem' }}
            >
              {username}
            </button>
          )}
        </div>

        <div className="settings-row">
          <span className="settings-label">Dark mode</span>
          <label className="toggle-switch">
            <input
              type="checkbox"
              checked={darkMode}
              onChange={e => onDarkModeChange(e.target.checked)}
            />
            <div className="toggle-track" />
            <div className="toggle-knob" />
          </label>
        </div>

        <div className="settings-row">
          <span className="settings-label">Linked sheet</span>
          <span className="settings-value" style={{ fontSize: '0.75rem', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {sheetId ? `${sheetId.slice(0, 16)}…` : 'None'}
          </span>
        </div>
      </div>

      <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius)', border: '1px solid var(--border)', padding: '0 16px', marginBottom: 16 }}>
        <div className="settings-row" style={{ borderBottom: 'none' }}>
          <button onClick={handleSignOut} style={{ color: 'var(--danger)', fontWeight: 600 }}>
            Sign out
          </button>
        </div>
      </div>

      <div style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', textAlign: 'center' }}>
        Chess Puzzle Trainer
      </div>
    </div>
  );
}
