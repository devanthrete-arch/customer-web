const TOKEN_KEY = 'af_access_token';
const PENDING_KEY = 'af_pending_auth';
const NAME_KEY = 'af_pending_display_name';
const SESSION_KEY = 'af_customer_session';
const RETURN_KEY = 'af_auth_return_to';
export const DISCOVERY_SESSION_KEY = 'af_discovery_session';

/** Fired when the API rejects the stored token, so the app can return to sign-in. */
export const SIGNED_OUT_EVENT = 'af:signed-out';
export const SIGNED_IN_EVENT = 'af:signed-in';

export function customerSessionId(): string {
  try {
    const stored = sessionStorage.getItem(SESSION_KEY);
    if (stored) return stored;
    const id = crypto.randomUUID();
    sessionStorage.setItem(SESSION_KEY, id);
    return id;
  } catch {
    return 'memory-session';
  }
}

/** Only successful explicit sign-ins begin a new session; token refreshes do not. */
export function beginAuthenticatedSession(token: string): void {
  setAccessToken(token);
  try {
    sessionStorage.setItem(SESSION_KEY, crypto.randomUUID());
    sessionStorage.removeItem(DISCOVERY_SESSION_KEY);
  } catch {
    /* Provider memory still resets through the event. */
  }
  window.dispatchEvent(new Event(SIGNED_IN_EVENT));
}

export function safeCustomerReturnTo(value: string): boolean {
  return (
    /^\/(home|explore|vehicles|services|documents|history|maintenance|payments|notifications|support|profile|reception)([/?#]|$)/.test(
      value,
    ) &&
    !value.startsWith('/profile/setup') &&
    !value.includes('\\')
  );
}

export function rememberAuthReturnTo(value: string): void {
  if (safeCustomerReturnTo(value)) {
    try {
      sessionStorage.setItem(RETURN_KEY, value);
    } catch {
      /* Optional navigation recovery. */
    }
  }
}

export function takeAuthReturnTo(): string {
  try {
    const value = sessionStorage.getItem(RETURN_KEY);
    sessionStorage.removeItem(RETURN_KEY);
    return value && safeCustomerReturnTo(value) ? value : '/home';
  } catch {
    return '/home';
  }
}

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
