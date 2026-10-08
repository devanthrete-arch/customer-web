import { getAccessToken, signOut } from './session';

const API_URL = import.meta.env.VITE_AUTOFLEX_API_URL || 'http://localhost:3001';

export class ApiError extends Error {
  status: number;
  code?: string;
  constructor(status: number, message: string, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

async function parseError(res: Response): Promise<ApiError> {
  try {
    const body = (await res.json()) as { message?: string | string[]; code?: string };
    const message = Array.isArray(body.message) ? body.message.join(', ') : body.message;
    if (message) return new ApiError(res.status, message, body.code);
  } catch {
    /* ignore */
  }
  return new ApiError(res.status, res.statusText || 'Request failed');
}

export async function autoflex<T>(
  path: string,
  init: RequestInit = {},
  auth = false,
): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  if (auth) {
    const token = getAccessToken();
    if (token) headers.set('Authorization', `Bearer ${token}`);
  }
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, { ...init, headers });
  } catch {
    throw new ApiError(0, 'Autoflex is unreachable. Check your connection and try again.');
  }
  if (!res.ok) {
    if (auth && res.status === 401) signOut();
    throw await parseError(res);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export function errorMessage(err: unknown, fallback = 'Something went wrong'): string {
  return err instanceof Error && err.message ? err.message : fallback;
}

export type Profile = {
  id: string;
  displayName: string | null;
  phone: string | null;
  selectedPlaceLabel: string | null;
  dateOfBirth: string | null;
};

export function profileComplete(profile: Profile | null | undefined): boolean {
  return Boolean(
    profile?.displayName?.trim() &&
      profile.phone?.trim() &&
      profile.selectedPlaceLabel?.trim() &&
      profile.dateOfBirth,
  );
}

export async function destinationAfterAuth(): Promise<string> {
  try {
    const profile = await autoflex<Profile>('/v1/me/profile', {}, true);
    return profileComplete(profile) ? '/home' : '/profile/setup';
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return '/profile/setup';
    throw err;
  }
}

/** Local backend sign-in (`npm run start:workshop`); stands in for IAM OTP. */
export async function devSignIn(mobile: string): Promise<string> {
  const session = await autoflex<{ accessToken: string }>('/v1/dev/session', {
    method: 'POST',
    body: JSON.stringify({ phone: mobile }),
  });
  return session.accessToken;
}
