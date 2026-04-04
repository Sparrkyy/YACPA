// Stockfish WASM engine wrapper — single-threaded build
// Loads stockfish-nnue-16-single.js as a Web Worker via UCI protocol

function parseInfoLine(line) {
  if (!line) return { eval: 0, isMate: false, bestLine: '' };

  let cp = 0;
  let isMate = false;

  const mateMatch = line.match(/score mate (-?\d+)/);
  const cpMatch = line.match(/score cp (-?\d+)/);

  if (mateMatch) {
    isMate = true;
    const mateIn = parseInt(mateMatch[1]);
    // Convert mate to large centipawn value preserving sign
    cp = mateIn > 0 ? 30000 : -30000;
  } else if (cpMatch) {
    cp = parseInt(cpMatch[1]);
  }

  const pvMatch = line.match(/ pv (.+)/);
  const bestLine = pvMatch ? pvMatch[1].trim() : '';

  return { eval: cp, isMate, bestLine };
}

export class StockfishEngine {
  constructor() {
    this.worker = null;
    this.pending = null;
    this.ready = false;
  }

  async init() {
    const base = import.meta.env.BASE_URL;
    const wasmUrl = encodeURIComponent(`${base}stockfish-nnue-16-single.wasm`);
    const workerUrl = `${base}stockfish-nnue-16-single.js#${wasmUrl},worker`;

    this.worker = new Worker(workerUrl);
    this.worker.onmessage = (e) => this._onMessage(e.data);

    await this._cmd('uci', line => line === 'uciok');
    // Disable NNUE to avoid fetching the 39MB weights file;
    // classical eval is sufficient for blunder detection
    this.worker.postMessage('setoption name Use NNUE value false');
    await this._cmd('isready', line => line === 'readyok');
    this.ready = true;
  }

  // Returns { bestMove, bestLine, eval, isMate }
  // eval is from the side-to-move's perspective (positive = good for them)
  analyzePosition(fen, depth = 14) {
    return new Promise((resolve, reject) => {
      if (!this.worker) return reject(new Error('Engine not initialized'));

      let lastInfo = null;

      this.pending = {
        resolve,
        reject,
        onLine: (line) => {
          if (line.startsWith('info') && line.includes('score') && !line.includes('lowerbound') && !line.includes('upperbound')) {
            lastInfo = line;
          }
          if (line.startsWith('bestmove')) {
            const parts = line.split(' ');
            const bestMove = parts[1];
            if (!bestMove || bestMove === '(none)') {
              resolve({ bestMove: null, bestLine: '', eval: 0, isMate: false });
            } else {
              const parsed = parseInfoLine(lastInfo);
              resolve({ bestMove, ...parsed });
            }
            this.pending = null;
          }
        },
      };

      this.worker.postMessage(`position fen ${fen}`);
      this.worker.postMessage(`go depth ${depth}`);
    });
  }

  destroy() {
    if (this.worker) {
      this.worker.postMessage('quit');
      this.worker.terminate();
      this.worker = null;
    }
    this.ready = false;
    this.pending = null;
  }

  _cmd(cmd, doneWhen) {
    return new Promise((resolve) => {
      const prev = this.pending;
      this.pending = {
        resolve,
        reject: () => {},
        onLine: (line) => {
          if (doneWhen(line)) {
            this.pending = prev ?? null;
            resolve();
          }
        },
      };
      this.worker.postMessage(cmd);
    });
  }

  _onMessage(data) {
    const line = typeof data === 'string' ? data : String(data);
    this.pending?.onLine(line);
  }
}
