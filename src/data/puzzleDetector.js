// Analyzes a Chess.com game with Stockfish to find puzzle candidates
// Uses Lichess win% formula to detect significant eval drops (blunders)
//
// TODO: Improve puzzle candidate detection algorithm:
//   - Use multi-PV (multipv 3) to check if player's move was among top lines, not just #1
//   - Filter out trivial recaptures and forced moves (only 1-2 legal responses)
//   - Skip opening book moves (first ~10 moves or use an opening DB)
//   - Consider checking Lichess cloud eval API first to skip redundant local analysis
//   - Weight candidates by: how much the win% drop was, how tricky the best move is
//   - De-duplicate near-identical positions across games (same FEN = same puzzle)
//   - Add missed_win theme: player had a forced win but played something that let it slip

import { Chess } from 'chess.js';

// Lichess win% formula — converts centipawns to win probability (0–100)
function winPct(cp) {
  const clamped = Math.max(-10000, Math.min(10000, cp));
  return 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * clamped)) - 1);
}

function classifyTheme(drop, isMate) {
  if (isMate) return 'missed_mate';
  if (drop > 20) return 'missed_tactic';
  return 'blunder';
}

// Analyzes a single game and returns an array of puzzle candidates.
// onProgress({ current, total }) fires after each analyzed position.
export async function analyzeGame(game, engine, onProgress) {
  const chess = new Chess();
  try {
    chess.loadPgn(game.pgn);
  } catch {
    throw new Error('Failed to parse PGN');
  }

  // chess.js v1.x verbose history includes `before` and `after` FEN fields
  // for each move — no need to manually replay the game
  const moves = chess.history({ verbose: true });

  const totalPlayerMoves = moves.filter(m => {
    const side = m.before.split(' ')[1];
    return (side === 'w') === game.playerIsWhite;
  }).length;

  const candidates = [];
  let analyzed = 0;
  let prevOpponentMove = null; // tracks the last opponent move before each player move

  for (const move of moves) {
    const side = move.before.split(' ')[1]; // 'w' or 'b' from the FEN
    const isPlayerMove = (side === 'w') === game.playerIsWhite;

    if (!isPlayerMove) {
      prevOpponentMove = move;
      continue;
    }

    const fenBefore = move.before;
    const fenAfter = move.after;

    const before = await engine.analyzePosition(fenBefore, 14);
    const afterRaw = await engine.analyzePosition(fenAfter, 14);
    const evalAfter = -afterRaw.eval; // negate — it's now opponent's turn

    const drop = winPct(before.eval) - winPct(evalAfter);
    const playerMoveUci = move.from + move.to + (move.promotion ?? '');

    if (drop > 10 && before.bestMove && before.bestMove !== playerMoveUci) {
      const prevFen = prevOpponentMove?.before ?? null;
      const opponentMove = prevOpponentMove
        ? prevOpponentMove.from + prevOpponentMove.to + (prevOpponentMove.promotion ?? '')
        : null;
      candidates.push({
        fen: fenBefore,
        playerMove: playerMoveUci,
        playerMoveSan: move.san,
        bestMove: before.bestMove,
        bestLine: before.bestLine,
        evalBefore: before.eval,
        evalAfter,
        winPctDrop: Math.round(drop),
        playerColor: game.playerIsWhite ? 'white' : 'black',
        theme: classifyTheme(drop, before.isMate),
        gameUrl: game.url,
        prevFen,
        opponentMove,
      });
    }

    analyzed++;
    onProgress({ current: analyzed, total: totalPlayerMoves || 1 });
  }

  return candidates;
}
