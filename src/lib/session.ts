const TOKEN_KEY = 'af_access_token';
const PENDING_KEY = 'af_pending_auth';
const NAME_KEY = 'af_pending_display_name';

/** Fired when the API rejects the stored token, so the app can return to sign-in. */
export const SIGNED_OUT_EVENT = 'af:signed-out';

export function getAccessToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setAccessToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearAccessToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

export function signOut(): void {
  clearAccessToken();
  sessionStorage.clear();
  window.dispatchEvent(new Event(SIGNED_OUT_EVENT));
}

export type PendingAuth = {
  mobile: string;
  /** `dev` when signing in through the local backend instead of IAM. */
  otpId: string;
};

export function setPendingAuth(pending: PendingAuth): void {
  sessionStorage.setItem(PENDING_KEY, JSON.stringify(pending));
}

export function getPendingAuth(): PendingAuth | null {
  const raw = sessionStorage.getItem(PENDING_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as PendingAuth;
  } catch {
    return null;
  }
}

export function setPendingDisplayName(name: string): void {
  sessionStorage.setItem(NAME_KEY, name);
}

export function peekPendingDisplayName(): string {
  return sessionStorage.getItem(NAME_KEY) ?? '';
}

export function clearPendingDisplayName(): void {
  sessionStorage.removeItem(NAME_KEY);
}
