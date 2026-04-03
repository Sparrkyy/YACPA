const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
const SCOPE = 'https://www.googleapis.com/auth/spreadsheets';
const AUTH_KEY = 'chess_puzzles_auth';

let accessToken = null;
let tokenExpiry = null;
let tokenClient = null;
let userSub = null;

export function initAuth(onSignIn) {
  tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: CLIENT_ID,
    scope: SCOPE,
    callback: async (resp) => {
      if (resp.error) return;
      accessToken = resp.access_token;
      tokenExpiry = Date.now() + resp.expires_in * 1000;
      try {
        const res = await fetch(
          `https://oauth2.googleapis.com/tokeninfo?access_token=${encodeURIComponent(resp.access_token)}`
        );
        const info = await res.json();
        userSub = info.sub ?? null;
      } catch {
        userSub = null;
      }
      try {
        localStorage.setItem(AUTH_KEY, JSON.stringify({
          access_token: accessToken,
          expires_at: tokenExpiry,
          user_sub: userSub,
        }));
      } catch {}
      onSignIn();
    },
  });
}

export function signIn() { tokenClient.requestAccessToken(); }

export function signOut() {
  google.accounts.oauth2.revoke(accessToken);
  accessToken = null;
  tokenExpiry = null;
  userSub = null;
  try { localStorage.removeItem(AUTH_KEY); } catch {}
}

export function getToken() { return accessToken; }
export function isSignedIn() { return !!accessToken; }
export function getUserSub() { return userSub; }

export function tryRestoreSession() {
  try {
    const stored = JSON.parse(localStorage.getItem(AUTH_KEY));
    if (!stored || stored.expires_at < Date.now() + 60_000) return false;
    accessToken = stored.access_token;
    tokenExpiry = stored.expires_at;
    userSub = stored.user_sub ?? null;
    return true;
  } catch { return false; }
}

export function hasStoredSession() {
  return !!localStorage.getItem(AUTH_KEY);
}

export function trySilentSignIn() {
  tokenClient.requestAccessToken({ prompt: 'none' });
}
