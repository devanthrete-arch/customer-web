import { getAccessToken } from './session';

const API_URL = import.meta.env.VITE_AUTOFLEX_API_URL || 'http://localhost:3001';

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function parseError(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { message?: string | string[] };
    if (Array.isArray(body.message)) return body.message.join(', ');
    if (body.message) return body.message;
  } catch {
    /* ignore */
  }
  return res.statusText || 'Request failed';
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
  const res = await fetch(`${API_URL}${path}`, { ...init, headers });
  if (!res.ok) {
    throw new ApiError(res.status, await parseError(res));
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export type Profile = {
  id: string;
  iamUserId: string;
  displayName: string | null;
  phone: string | null;
  selectedPlaceLabel: string | null;
};

export function profileComplete(profile: Profile | null | undefined): boolean {
  return Boolean(
    profile?.displayName?.trim() &&
      profile.phone?.trim() &&
      profile.selectedPlaceLabel?.trim(),
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

export type Category = {
  id: string;
  name: string;
  slug: string;
};

export type Offer = {
  id: string;
  kicker: string | null;
  title: string;
  percentOff: number | null;
  ctaLabel: string | null;
};

export type CenterListItem = {
  id: string;
  displayName: string;
  distanceMeters: number;
  formattedAddress: string | null;
  ratingAvg: number | null;
  ratingCount: number;
};

export type CenterDetail = {
  id: string;
  displayName: string;
  formattedAddress: string | null;
  ratingAvg: number | null;
  ratingCount: number;
  hoursStart: string;
  hoursEnd: string;
  bookingEnabled: boolean;
  about: string;
  categories: { id: string; name: string }[];
};

export type GarageVehicle = {
  id: string;
  make: string;
  model: string;
  year: number | null;
  registrationNumber: string;
  vehicleType: string;
  fuel: string | null;
  transmission: string | null;
};

export type Slot = { start: string; end: string; available: boolean };

export type Booking = {
  id: string;
  status: string;
  mode: string;
  estimateInr: string;
  slotStart: string;
  slotEnd: string;
  paymentMode: string;
  issueDescription: string | null;
  vehicleId: string;
  serviceCenterId: string;
  vehicleLabel: string;
  registrationNumber: string;
  centerName: string;
};
