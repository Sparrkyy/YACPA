import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Chess } from 'chess.js';
import { Chessboard } from 'react-chessboard';
import { StockfishEngine } from '../data/stockfish';

// --- Chess helpers ---

function uciToSan(uci, fen) {
  if (!uci || !fen) return '?';
  try {
    const c = new Chess(); c.load(fen);
    const m = c.move({ from: uci.slice(0,2), to: uci.slice(2,4), promotion: uci[4] });
    return m?.san ?? '?';
  } catch { return '?'; }
}

function uciLineToSan(fen, bestLine) {
  if (!fen || !bestLine) return [];
  const c = new Chess();
  try { c.load(fen); } catch { return []; }
  const sans = [];
  for (const uci of bestLine.trim().split(/\s+/).filter(Boolean)) {
    try {
      const m = c.move({ from: uci.slice(0,2), to: uci.slice(2,4), promotion: uci[4] });
      if (!m) break;
      sans.push(m.san);
    } catch { break; }
  }
  return sans;
}

function formatLine(sans, fen) {
  if (!sans.length) return '';
  const parts = fen.split(' ');
  const color = parts[1];
  let moveNum = parseInt(parts[5] ?? '1', 10);
  const tokens = [];
  sans.forEach((san, i) => {
    const isWhite = color === 'w' ? i % 2 === 0 : i % 2 === 1;
    if (isWhite) tokens.push(`${moveNum}.`);
    else if (i === 0) tokens.push(`${moveNum}...`);
    tokens.push(san);
    if (!isWhite) moveNum++;
  });
  return tokens.join(' ');
}

function winPct(cp) {
  return 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * cp)) - 1);
}

function evalLabel(whiteEval, isMate) {
  if (isMate) return whiteEval > 0 ? '+M' : '-M';
  const pawn = whiteEval / 100;
  return pawn >= 0 ? `+${pawn.toFixed(1)}` : pawn.toFixed(1);
}

// --- Component ---

export default function AnalysisBoardView({ fen, playerColor, bestLine: initialBestLine, onClose }) {
  const boardSize = Math.min(460, window.innerWidth - 32);

  // Chess instance — mutated in place
  const [chess] = useState(() => { const c = new Chess(); c.load(fen); return c; });

  // Navigation state — keep refs alongside state to avoid stale closures
  const [currentFen, setCurrentFen] = useState(fen);
  const [history, setHistoryState] = useState([fen]);
  const [histIdx, setHistIdxState] = useState(0);
  const historyRef = useRef([fen]);
  const histIdxRef = useRef(0);

  function setHistory(val) { historyRef.current = val; setHistoryState(val); }
  function setHistIdx(val) { histIdxRef.current = val; setHistIdxState(val); }

  // Click-to-move
  const [selectedSq, setSelectedSq] = useState(null);
  const [legalDests, setLegalDests] = useState([]);

  // Engine
  const engineRef = useRef(null);
  const seqRef = useRef(0);
  const debounceRef = useRef(null);
  const [engineResult, setEngineResult] = useState(() => {
    if (!initialBestLine) return null;
    const firstMove = initialBestLine.trim().split(/\s+/)[0] ?? null;
    return { bestMove: firstMove, bestLine: initialBestLine, eval: 0, isMate: false };
  });
  const [analyzing, setAnalyzing] = useState(false);
  const [engineReady, setEngineReady] = useState(false);

  useEffect(() => {
    const engine = new StockfishEngine();
    engineRef.current = engine;
    engine.init().then(() => {
      setEngineReady(true);
      triggerAnalysis(fen);
    }).catch(() => {});
    return () => {
      clearTimeout(debounceRef.current);
      engine.destroy();
    };
  }, []);

  function triggerAnalysis(fenToAnalyze) {
    if (!engineRef.current?.ready) return;
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      const seq = ++seqRef.current;
      setAnalyzing(true);
      try {
        // Cancel any in-flight search
        engineRef.current.worker?.postMessage('stop');
        await new Promise(r => setTimeout(r, 50));
        if (seq !== seqRef.current) return;
        const result = await engineRef.current.analyzePosition(fenToAnalyze, 12);
        if (seq === seqRef.current) {
          setEngineResult(result);
          setAnalyzing(false);
        }
      } catch {
        if (seq === seqRef.current) setAnalyzing(false);
      }
    }, 400);
  }

  // --- Move application ---

  function applyMove(from, to, promotion) {
    const moveObj = chess.move({ from, to, promotion });
    if (!moveObj) return false;
    const newFen = chess.fen();
    const newHistory = historyRef.current.slice(0, histIdxRef.current + 1).concat(newFen);
    setHistory(newHistory);
    setHistIdx(newHistory.length - 1);
    setCurrentFen(newFen);
    setSelectedSq(null);
    setLegalDests([]);
    triggerAnalysis(newFen);
    return true;
  }

  function handlePieceDrop({ sourceSquare: src, targetSquare: tgt }) {
    if (!tgt) return false;
    const isPromo = chess.get(src)?.type === 'p' && (tgt[1] === '8' || tgt[1] === '1');
    return applyMove(src, tgt, isPromo ? 'q' : undefined) !== false;
  }

  function handleSquareClick({ square, piece }) {
    const turn = chess.turn(); // 'w' or 'b'
    const pieceColor = piece ? piece[0].toLowerCase() : null; // 'w' or 'b'

    if (selectedSq) {
      if (legalDests.includes(square)) {
        const isPromo = chess.get(selectedSq)?.type === 'p' && (square[1] === '8' || square[1] === '1');
        applyMove(selectedSq, square, isPromo ? 'q' : undefined);
      } else if (pieceColor === turn) {
        // Re-select a different own piece
        selectSquare(square);
      } else {
        setSelectedSq(null);
        setLegalDests([]);
      }
    } else if (pieceColor === turn) {
      selectSquare(square);
    }
  }

  function selectSquare(square) {
    const moves = chess.moves({ square, verbose: true });
    setSelectedSq(square);
    setLegalDests(moves.map(m => m.to));
  }

  // --- History navigation ---

  function navigate(idx) {
    chess.load(historyRef.current[idx]);
    setHistIdx(idx);
    setCurrentFen(historyRef.current[idx]);
    setSelectedSq(null);
    setLegalDests([]);
    triggerAnalysis(historyRef.current[idx]);
  }

  function reset() {
    chess.load(fen);
    setHistory([fen]);
    setHistIdx(0);
    setCurrentFen(fen);
    setSelectedSq(null);
    setLegalDests([]);
    triggerAnalysis(fen);
  }

  // --- Square styles ---

  const squareStyles = {};
  if (selectedSq) {
    squareStyles[selectedSq] = { background: 'rgba(255,200,0,0.45)' };
  }
  legalDests.forEach(sq => {
    const hasPiece = chess.get(sq);
    squareStyles[sq] = hasPiece
      ? { background: 'radial-gradient(circle, rgba(255,200,0,0.3) 60%, transparent 60%)' }
      : { background: 'radial-gradient(circle, rgba(0,0,0,0.18) 28%, transparent 28%)' };
  });

  // --- Eval bar ---

  const rawEval = engineResult?.eval ?? 0;
  const isMate = engineResult?.isMate ?? false;
  const turn = currentFen.split(' ')[1];
  const whiteEval = turn === 'w' ? rawEval : -rawEval;
  const whitePct = isMate ? (whiteEval > 0 ? 100 : 0) : winPct(whiteEval);
  const label = engineResult ? evalLabel(whiteEval, isMate) : '…';

  const bestLineSans = engineResult?.bestLine
    ? uciLineToSan(currentFen, engineResult.bestLine)
    : [];

  return createPortal((
    <div style={{
      position: 'fixed', inset: 0, background: 'var(--bg)',
      zIndex: 9999, display: 'flex', flexDirection: 'column',
      overflow: 'hidden',
      paddingTop: 'env(safe-area-inset-top)',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '12px 16px', borderBottom: '1px solid var(--border)', flexShrink: 0,
        background: 'var(--surface)',
      }}>
        <button
          onClick={onClose}
          style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: 4, fontSize: '1.2rem' }}
        >
          ←
        </button>
        <span style={{ flex: 1, fontWeight: 700, fontSize: '1rem' }}>Analysis</span>
        <button
          onClick={() => histIdxRef.current > 0 && navigate(histIdxRef.current - 1)}
          disabled={histIdx === 0}
          style={{ background: 'none', border: 'none', cursor: histIdx === 0 ? 'default' : 'pointer',
                   color: histIdx === 0 ? 'var(--border)' : 'var(--text)', fontSize: '1.4rem', padding: '0 6px' }}
        >‹</button>
        <button
          onClick={() => histIdxRef.current < historyRef.current.length - 1 && navigate(histIdxRef.current + 1)}
          disabled={histIdx === history.length - 1}
          style={{ background: 'none', border: 'none', cursor: histIdx === history.length - 1 ? 'default' : 'pointer',
                   color: histIdx === history.length - 1 ? 'var(--border)' : 'var(--text)', fontSize: '1.4rem', padding: '0 6px' }}
        >›</button>
        <button
          onClick={reset}
          style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 6,
                   color: 'var(--text-secondary)', cursor: 'pointer', padding: '4px 10px', fontSize: '0.8rem' }}
        >
          Reset
        </button>
      </div>

      {/* Eval bar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '8px 16px', flexShrink: 0,
      }}>
        <span style={{
          fontSize: '0.75rem', fontFamily: 'monospace', fontWeight: 700,
          width: 40, color: whiteEval >= 0 ? 'var(--text)' : 'var(--text-secondary)',
        }}>
          {label}
        </span>
        <div style={{ flex: 1, height: 8, borderRadius: 4, overflow: 'hidden', background: '#2a2a3e', position: 'relative' }}>
          {analyzing ? (
            <div style={{ width: '100%', height: '100%', background: 'var(--border)', opacity: 0.5 }} />
          ) : (
            <div style={{
              width: `${whitePct}%`, height: '100%',
              background: '#e8e8d0', transition: 'width 0.4s ease',
            }} />
          )}
        </div>
        {analyzing && (
          <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', flexShrink: 0 }}>…</span>
        )}
      </div>

      {/* Board */}
      <div style={{ display: 'flex', justifyContent: 'center', padding: '0 16px 8px', flexShrink: 0 }}>
        <Chessboard options={{
          position: currentFen,
          boardOrientation: playerColor ?? 'white',
          allowDragging: true,
          onPieceDrop: handlePieceDrop,
          onSquareClick: handleSquareClick,
          allowDrawingArrows: true,
          boardStyle: { width: boardSize, maxWidth: '100%' },
          squareStyles: squareStyles,
        }} />
      </div>

      {/* Engine output */}
      <div style={{ padding: '4px 16px 16px', overflowY: 'auto', flex: 1 }}>
        {!engineReady && (
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Starting engine…</div>
        )}
        {engineResult?.bestMove && (
          <div style={{ fontSize: '0.85rem', marginBottom: 6 }}>
            <span style={{ color: 'var(--text-secondary)', marginRight: 4 }}>Best:</span>
            <strong>{uciToSan(engineResult.bestMove, currentFen)}</strong>
          </div>
        )}
        {bestLineSans.length > 0 && (
          <div style={{
            fontSize: '0.78rem', fontFamily: 'monospace',
            color: 'var(--text-secondary)', lineHeight: 1.8,
          }}>
            {formatLine(bestLineSans, currentFen)}
          </div>
        )}
      </div>
    </div>
  ), document.body);
}
