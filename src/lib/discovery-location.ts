import { autoflex, type Profile } from './api';

export type DiscoveryLocation =
  | { mode: 'CITY'; city: string; label: string }
  | { mode: 'PIN'; postalCode: string; city: string; state: string; locality: string; label: string }
  | {
      mode: 'COORDINATES';
      lat: number;
      lng: number;
      radiusMeters: number;
      label: string;
      postalCode?: string;
    };
export type LocationSource = 'MANUAL' | 'GPS' | 'LAST_USED' | 'DEFAULT';
export type DiscoveryConfig = {
  defaultLocation: Extract<DiscoveryLocation, { mode: 'CITY' }> | null;
  radiusMeters: number;
};

export function validDiscoveryLocation(
  value: unknown,
): value is DiscoveryLocation {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  if (typeof v.label !== 'string' || !v.label.trim() || v.label.length > 255)
    return false;
  if (v.mode === 'CITY')
    return (
      typeof v.city === 'string' &&
      v.city.trim().length >= 2 &&
      v.city.length <= 100
    );
  if (v.mode === 'PIN')
    return typeof v.postalCode === 'string' && /^[1-9]\d{5}$/.test(v.postalCode) &&
      ['city', 'state', 'locality'].every(key => typeof v[key] === 'string' && (v[key] as string).trim().length > 0 && (v[key] as string).length <= 100);
  return (
    v.mode === 'COORDINATES' &&
    typeof v.lat === 'number' &&
    Number.isFinite(v.lat) &&
    Math.abs(v.lat) <= 90 &&
    typeof v.lng === 'number' &&
    Number.isFinite(v.lng) &&
    Math.abs(v.lng) <= 180 &&
    typeof v.radiusMeters === 'number' &&
    Number.isFinite(v.radiusMeters) &&
    v.radiusMeters >= 100 &&
    v.radiusMeters <= 100000
    && (v.postalCode === undefined || (typeof v.postalCode === 'string' && /^[1-9]\d{5}$/.test(v.postalCode)))
  );
}

export function lastUsedLocation(
  profile: Profile | null,
  radiusMeters = 15000,
): DiscoveryLocation | null {
  if (!profile) return null;
  const { lastLat: lat, lastLng: lng } = profile;
  if (lat != null || lng != null) {
    const location = {
      mode: 'COORDINATES' as const,
      lat,
      lng,
      radiusMeters,
      label: profile.selectedPlaceLabel?.trim() || 'Selected location',
      ...(profile.postalCode ? { postalCode: profile.postalCode } : {}),
    };
    return validDiscoveryLocation(location) ? location : null;
  }
  if (profile.postalCode && profile.city && profile.state) {
    const location = { mode: 'PIN' as const, postalCode: profile.postalCode, city: profile.city, state: profile.state, locality: profile.city, label: profile.selectedPlaceLabel?.trim() || `${profile.city} · ${profile.postalCode}` };
    return validDiscoveryLocation(location) ? location : null;
  }
  if (!profile.city?.trim()) return null;
  const location = {
    mode: 'CITY' as const,
    city: profile.city.trim(),
    label: profile.selectedPlaceLabel?.trim() || profile.city.trim(),
  };
  return validDiscoveryLocation(location) ? location : null;
}

/** Replace area parameters together; never intersect stale URL geography with the active area. */
export function applyDiscoveryLocation(
  params: URLSearchParams,
  location: DiscoveryLocation,
) {
  const next = new URLSearchParams(params);
  ['city', 'postalCode', 'lat', 'lng', 'radiusMeters'].forEach((key) => next.delete(key));
  if (location.mode === 'CITY') {
    next.set('city', location.city);
    if (['nearest', 'farthest'].includes(next.get('sort') ?? '')) next.delete('sort');
  } else if (location.mode === 'PIN') {
    next.set('postalCode', location.postalCode);
    if (['nearest', 'farthest'].includes(next.get('sort') ?? '')) next.delete('sort');
  } else {
    next.set('lat', String(location.lat));
    next.set('lng', String(location.lng));
    next.set('radiusMeters', String(location.radiusMeters));
    if (location.postalCode) next.set('postalCode', location.postalCode);
  }
  return next;
}

export const locationDescription = (location: DiscoveryLocation) =>
  location.mode !== 'COORDINATES'
    ? location.label
    : `${location.label} · within ${location.radiusMeters / 1000} km`;

export const locationApi = {
  postal: (postalCode: string) => autoflex<PostalLookup>(`/v1/marketplace/postal-locations/${encodeURIComponent(postalCode)}`),
  profile: () => autoflex<Profile>('/v1/me/profile', {}, true),
  config: () => autoflex<DiscoveryConfig>('/v1/marketplace/discovery-config'),
  save: (location: DiscoveryLocation) =>
    autoflex<Profile>(
      '/v1/me/profile',
      {
        method: 'PUT',
        body: JSON.stringify(
          location.mode === 'CITY'
            ? {
                city: location.city,
                selectedPlaceLabel: location.label,
                lastLat: null,
                lastLng: null,
                postalCode: null,
                state: null,
              }
            : location.mode === 'PIN'
              ? { city: location.city, state: location.state, postalCode: location.postalCode, selectedPlaceLabel: location.label, lastLat: null, lastLng: null }
            : {
                city: null,
                selectedPlaceLabel: location.label,
                lastLat: location.lat,
                lastLng: location.lng,
                postalCode: location.postalCode ?? null,
                state: null,
              },
        ),
      },
      true,
    ),
};

export type PostalLookup = {
  postalCode: string;
  areas: { locality: string; district: string; state: string }[];
  source: string;
};
