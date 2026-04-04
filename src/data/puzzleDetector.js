// Analyzes a Chess.com game with Stockfish to find puzzle candidates
// Uses Lichess win% formula to detect significant eval drops (blunders)

import { Chess } from 'chess.js';

// Lichess win% formula — converts centipawns to win probability (0–100)
function winPct(cp) {
  return 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * cp)) - 1);
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

  const moves = chess.history({ verbose: true });

  // Count total player moves upfront for accurate progress
  const totalPlayerMoves = moves.filter((_, i) => {
    const isWhiteMove = i % 2 === 0; // move 0 = white's first move
    return isWhiteMove === game.playerIsWhite;
  }).length;

  chess.reset();
  const candidates = [];
  let analyzed = 0;

  for (let i = 0; i < moves.length; i++) {
    const fenBefore = chess.fen();
    const sideToMove = fenBefore.split(' ')[1]; // 'w' or 'b'
    const isPlayerMove = (sideToMove === 'w') === game.playerIsWhite;

    if (isPlayerMove) {
      const before = await engine.analyzePosition(fenBefore, 14);

      const playerMoveUci = moves[i].from + moves[i].to + (moves[i].promotion ?? '');
      chess.move(moves[i].san);

      const afterRaw = await engine.analyzePosition(chess.fen(), 14);
      const evalAfter = -afterRaw.eval; // negate — it's now opponent's turn

      const drop = winPct(before.eval) - winPct(evalAfter);

      // Only flag if: big enough drop AND player didn't play the best move
      if (drop > 10 && before.bestMove && before.bestMove !== playerMoveUci) {
        candidates.push({
          fen: fenBefore,
          playerMove: playerMoveUci,
          playerMoveSan: moves[i].san,
          bestMove: before.bestMove,
          bestLine: before.bestLine,
          evalBefore: before.eval,
          evalAfter,
          winPctDrop: Math.round(drop),
          playerColor: game.playerIsWhite ? 'white' : 'black',
          theme: classifyTheme(drop, before.isMate),
          gameUrl: game.url,
        });
      }

      analyzed++;
      onProgress({ current: analyzed, total: totalPlayerMoves || 1 });
    } else {
      chess.move(moves[i].san);
    }
  }

  return candidates;
}
