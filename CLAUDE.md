# Chess Puzzle App

A PWA that generates personalized chess puzzles from your own Chess.com games. It analyzes your games with Stockfish, finds positions where you blundered or missed strong moves (big eval drops), and drills you on those positions using spaced repetition.

## Stack
- **React 19 + Vite 5** — frontend
- **GitHub Pages** — hosting
- **Google Sheets API v4** — backend (no server; all reads/writes from the browser)
- **Google Identity Services (GIS)** — OAuth2 token flow for auth
- **Stockfish WASM** — in-browser chess engine for position analysis
- **chess.js** — chess logic, move validation, PGN parsing
- **react-chessboard** — interactive board UI
- **Chess.com public API** — fetch user games

## How It Works

1. **Sign in with Google** — authenticates via GIS, grants access to Google Sheets for storing puzzle data
2. **Enter Chess.com username** — fetches recent games from Chess.com public API
3. **Analyze games** — Stockfish WASM evaluates each position, identifies eval drops > ~1.5 pawns
4. **Generate puzzles** — each significant eval drop becomes a puzzle (the position before the blunder, with the best move as the solution)
5. **Solve puzzles** — interactive board where user plays the correct move(s)
6. **Spaced repetition** — SM-2 algorithm schedules reviews: puzzles you miss come back sooner, ones you nail get spaced out

## Environment Variables
Required in `.env.local` (never committed):
```
VITE_GOOGLE_CLIENT_ID=   # OAuth 2.0 client ID from Google Cloud Console
VITE_SHEET_ID=           # The ID from the Google Sheet URL
```

## Chess.com API

- Games endpoint: `https://api.chess.com/pub/player/{username}/games/{YYYY}/{MM}`
- Returns PGN + metadata for all games in that month
- No authentication required for public profiles
- Must set a `User-Agent` header per Chess.com API guidelines

## Google Sheets Backend

### Sheet structure
| Tab | Columns | Purpose |
|---|---|---|
| Puzzles | id, gameUrl, fen, playerColor, bestMove, bestLine, evalBefore, evalAfter, theme, createdAt | All generated puzzles |
| Reviews | id, puzzleId, user, result (solved/failed), reviewedAt | History of puzzle attempts |
| SRS | id, puzzleId, user, easeFactor, interval, repetitions, nextReview | SM-2 spaced repetition state |
| Settings | key, value | User preferences (Chess.com username, analysis depth, eval threshold) |

Row 1 of each tab is a header row.

### Data Models

#### Puzzle object (JS)
```js
{
  id: string,           // UUID
  gameUrl: string,      // Chess.com game URL
  fen: string,          // position FEN (the position before the blunder)
  playerColor: string,  // 'white' or 'black'
  bestMove: string,     // best move in UCI notation (e.g. 'e2e4')
  bestLine: string,     // full best line from Stockfish (UCI, space-separated)
  evalBefore: number,   // centipawn eval before the blunder
  evalAfter: number,    // centipawn eval after the blunder
  theme: string,        // detected theme: 'blunder', 'missed_tactic', 'missed_mate'
  createdAt: string,    // ISO timestamp
}
```

#### SRS object (JS) — SM-2 algorithm state
```js
{
  id: string,
  puzzleId: string,
  user: string,
  easeFactor: number,   // starts at 2.5, min 1.3
  interval: number,     // days until next review
  repetitions: number,  // consecutive correct answers
  nextReview: string,   // ISO date 'YYYY-MM-DD'
}
```

## Puzzle Detection Algorithm

For each game:
1. Parse PGN into move list
2. Replay moves, evaluating each position with Stockfish (depth ~18)
3. Compare eval before and after each move
4. If eval drops by threshold (default 150 centipawns / 1.5 pawns):
   - Record the position FEN (before the bad move)
   - Record Stockfish's best move and best line
   - Classify: missed mate > missed tactic > blunder
5. Store as a puzzle in the Puzzles sheet

## SM-2 Spaced Repetition

After each puzzle attempt:
- **Correct on first try** → quality 5 (easy recall)
- **Correct after thought** → quality 4
- **Correct with difficulty** → quality 3
- **Incorrect but recognized** → quality 2
- **Incorrect, no idea** → quality 0-1

SM-2 updates: `easeFactor`, `interval`, `repetitions`, `nextReview` based on quality score. Puzzles due for review (`nextReview <= today`) appear first in the queue.

## Architecture

```
src/
├── App.jsx                    # Root: auth, tab nav, global state
├── views/
│   ├── GamesView.jsx          # Enter Chess.com username, fetch & list games
│   ├── AnalysisView.jsx       # Run Stockfish analysis, show progress, detect puzzles
│   ├── PuzzleView.jsx         # Interactive puzzle: play the best move on the board
│   ├── ReviewView.jsx         # Spaced repetition queue: due puzzles for today
│   ├── HistoryView.jsx        # All puzzles with solve stats
│   └── SettingsView.jsx       # Chess.com username, analysis depth, eval threshold
├── components/
│   ├── ChessBoard.jsx         # react-chessboard wrapper with move validation
│   ├── EvalBar.jsx            # Visual eval bar (like Chess.com/Lichess)
│   ├── GameCard.jsx           # Game summary card (opponent, result, date)
│   ├── PuzzleCard.jsx         # Puzzle preview (position thumbnail, theme, SRS status)
│   └── ConfirmDialog.jsx      # Confirmation modal
└── data/
    ├── sheetsApi.js           # Google Sheets CRUD
    ├── auth.js                # GIS OAuth2 token flow
    ├── chesscomApi.js         # Chess.com API: fetch games, parse PGN
    ├── stockfish.js           # Stockfish WASM wrapper: init, evaluate, getBestMove
    ├── puzzleDetector.js      # Analyze game → find puzzle-worthy positions
    ├── srs.js                 # SM-2 algorithm: computeNext(srsState, quality)
    └── utils.js               # Shared helpers
```

## Auth Flow (same pattern as YAWT)

1. GIS script loaded in `index.html`
2. `initAuth()` → `google.accounts.oauth2.initTokenClient()`
3. `signIn()` → consent screen → token stored in localStorage
4. Token auto-restored on app load via `tryRestoreSession()`
5. Token attached as `Authorization: Bearer` to all Sheets API requests

## Reference: GuillaumeSD/Chesskit (https://github.com/GuillaumeSD/Chesskit)

**This is our primary reference.** An open-source (AGPL-3) web chess platform built with React + Next.js + TypeScript that already does most of what we need. We can borrow heavily from their architecture.

### What they have that we can reuse:
- **Chess.com game loading** (`src/lib/chessCom.ts`) — fetches current + previous month, sorts by date, returns up to 50 games. Parses PGN, player names, ratings, time control.
- **Stockfish WASM integration** (`src/lib/engine/uciEngine.ts`) — full UCI engine wrapper with Web Worker pool, multi-PV support, worker queue for parallel analysis. Supports Stockfish 11/16/16.1/17.
- **Move classification** (`src/lib/engine/helpers/moveClassification.ts`) — classifies every move as Blunder/Mistake/Inaccuracy/Okay/Excellent/Best/Perfect/Splendid/Forced/Opening based on win percentage drops.
- **Win percentage calculation** (`src/lib/engine/helpers/winPercentage.ts`) — converts centipawn eval to win% using Lichess's formula: `50 + 50 * (2 / (1 + exp(-0.00368208 * cp)) - 1)`. This is better than raw centipawn thresholds for puzzle detection.
- **Engine worker management** (`src/lib/engine/worker.ts`) — Web Worker creation, UCI command/response protocol, recommended worker count based on device capabilities.
- **Lichess eval cache** — checks Lichess cloud eval API before running local Stockfish, saving compute time.

### Their move classification thresholds (win% based):
| Win% Drop | Classification |
|-----------|---------------|
| > 20%     | Blunder       |
| > 10%     | Mistake       |
| > 5%      | Inaccuracy    |
| > 2%      | Okay          |
| <= 2%     | Excellent     |

Plus special cases: Best (matches engine's top move), Perfect (only good move or changed game outcome), Splendid (piece sacrifice that maintains advantage), Forced (only one legal response), Opening (matches known opening book).

### Key architectural patterns to borrow:
- Web Worker pool for Stockfish (not blocking main thread)
- UCI protocol: `position fen X` → `go depth N` → listen for `bestmove`
- Multi-PV (default 3 lines) for richer analysis
- Win percentage over raw centipawns for more intuitive thresholds
- Lichess cloud eval as a fast cache before local engine analysis

### What they DON'T have (our additions):
- Puzzle generation from detected blunders
- Spaced repetition system
- Google Sheets backend for persistence
- PWA with offline puzzle solving

## Reference: chesskit-app (https://github.com/chesskit-app)

iOS/Swift chess app — less directly useful since we're JS, but clean architecture patterns:
- Separation of chess logic from engine communication
- MoveTree structure for tracking variations/lines

## PWA Setup
- `vite-plugin-pwa` with Workbox for service worker
- `manifest.json` with standalone display mode
- Apple meta tags for iOS home screen support
- Installable on iOS and Android

## Git Commits
Never include `Co-Authored-By` lines or any other mention of Claude/AI in commit messages.
