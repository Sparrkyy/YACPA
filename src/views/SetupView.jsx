import { useState } from 'react';
import { createNewSheet, validateSheet } from '../data/api';

export default function SetupView({ setupPhase, onSheetReady, onUsernameReady }) {
  // Sheet phase state
  const [existingId, setExistingId] = useState('');
  const [sheetLoading, setSheetLoading] = useState(false);
  const [sheetError, setSheetError] = useState('');

  // Username phase state
  const [username, setUsername] = useState('');

  async function handleCreateNew() {
    setSheetLoading(true);
    setSheetError('');
    try {
      const id = await createNewSheet();
      onSheetReady(id);
    } catch (e) {
      setSheetError(e.message ?? 'Failed to create sheet');
    } finally {
      setSheetLoading(false);
    }
  }

  async function handleLinkExisting(e) {
    e.preventDefault();
    const id = existingId.trim();
    if (!id) return;
    setSheetLoading(true);
    setSheetError('');
    try {
      const valid = await validateSheet(id);
      if (!valid) {
        setSheetError('Sheet not found or no access. Make sure the ID is correct.');
        return;
      }
      onSheetReady(id);
    } catch (e) {
      setSheetError(e.message ?? 'Failed to validate sheet');
    } finally {
      setSheetLoading(false);
    }
  }

  function handleUsernameSubmit(e) {
    e.preventDefault();
    const trimmed = username.trim();
    if (!trimmed) return;
    onUsernameReady(trimmed);
  }

  if (setupPhase === 'username') {
    return (
      <div className="setup-screen">
        <div style={{ fontSize: '2.5rem' }}>♟️</div>
        <h2>Your Chess.com username</h2>
        <p>We'll fetch your recent games and turn your mistakes into puzzles.</p>
        <form onSubmit={handleUsernameSubmit} style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
          <div className="field" style={{ width: '100%', maxWidth: 320 }}>
            <input
              type="text"
              placeholder="e.g. hikaru"
              value={username}
              onChange={e => setUsername(e.target.value)}
              autoCapitalize="none"
              autoCorrect="off"
              autoFocus
            />
          </div>
          <button
            type="submit"
            className="btn-accent"
            disabled={!username.trim()}
            style={{ maxWidth: 320 }}
          >
            Let's go
          </button>
        </form>
      </div>
    );
  }

  // setupPhase === 'sheet'
  return (
    <div className="setup-screen">
      <div style={{ fontSize: '2.5rem' }}>♟️</div>
      <h2>Set up your puzzle sheet</h2>
      <p>Your puzzles and progress will be saved in a Google Sheet in your Drive.</p>

      <button
        className="btn-accent"
        onClick={handleCreateNew}
        disabled={sheetLoading}
        style={{ maxWidth: 320 }}
      >
        {sheetLoading ? 'Creating…' : 'Create a new sheet'}
      </button>

      <div className="divider">or</div>

      <form onSubmit={handleLinkExisting} style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
        <div className="field" style={{ width: '100%', maxWidth: 320 }}>
          <input
            type="text"
            placeholder="Paste existing Sheet ID"
            value={existingId}
            onChange={e => setExistingId(e.target.value)}
          />
        </div>
        <button
          type="submit"
          className="btn-secondary"
          disabled={!existingId.trim() || sheetLoading}
          style={{ maxWidth: 320 }}
        >
          Link existing sheet
        </button>
      </form>

      {sheetError && (
        <p style={{ color: 'var(--danger)', fontSize: '0.85rem', maxWidth: 320, textAlign: 'center' }}>
          {sheetError}
        </p>
      )}
    </div>
  );
}
