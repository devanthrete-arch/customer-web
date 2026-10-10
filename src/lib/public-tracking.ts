import { ApiError, autoflex } from './api';

export const TRACKING_STATUSES = {
  CHECKED_IN: 'Vehicle received',
  INSPECTION: 'Inspection in progress',
  AWAITING_APPROVAL: 'Awaiting approval',
  IN_PROGRESS: 'Service in progress',
  QUALITY_CHECK: 'Quality check in progress',
  READY_FOR_PICKUP: 'Ready for pickup',
  COMPLETED: 'Service completed',
  ON_HOLD: 'Work paused',
  CANCELLED: 'Service cancelled',
} as const;
export type TrackingStatus = keyof typeof TRACKING_STATUSES;
export type PublicTracking = {
  jobNumber: string | null;
  status: string;
  serviceType: string;
  estimatedReadyAt: string | null;
  centerName: string | null;
  centerPhone: string | null;
  vehicleRegistration: string | null;
  awaitingApproval: boolean;
  progress: { status: TrackingStatus; at: string | null }[];
  updatedAt: string | null;
};
export const validTrackingToken = (token: string) => /^[A-Za-z0-9_-]{1,128}$/.test(token);
export const isTrackingPath = (path: string) => /^\/t(?:\/|$)/i.test(path);
export const terminalTracking = (status?: string) =>
  status === 'COMPLETED' || status === 'CANCELLED';
export function trackingLabel(status: string): string {
  return Object.hasOwn(TRACKING_STATUSES, status)
    ? TRACKING_STATUSES[status as TrackingStatus]
    : 'Service update';
}
const text = (value: unknown) => (typeof value === 'string' && value.trim() ? value : null);
const date = (value: unknown) =>
  typeof value === 'string' &&
  /^\d{4}-\d{2}-\d{2}T/.test(value) &&
  Number.isFinite(Date.parse(value))
    ? value
    : null;
const record = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);

export const publicTrackingApi = {
  async load(token: string, signal: AbortSignal): Promise<PublicTracking> {
    if (!validTrackingToken(token)) throw new ApiError(404, 'Tracking link unavailable');
    const raw = await autoflex<unknown>(`/v1/track/${encodeURIComponent(token)}`, {
      signal,
      credentials: 'omit',
      cache: 'no-store',
      referrerPolicy: 'no-referrer',
    });
    if (!record(raw) || !text(raw.status)) throw new ApiError(502, 'Progress could not be loaded');
    // Explicitly map the public DTO. Never hydrate an owner ServiceRecord here.
    return {
      jobNumber: text(raw.jobNumber),
      status: raw.status as string,
      serviceType: text(raw.serviceType) ?? 'Vehicle service',
      estimatedReadyAt: date(raw.estimatedReadyAt),
      centerName: text(raw.centerName),
      centerPhone:
        typeof raw.centerPhone === 'string' && /^\+[1-9]\d{7,14}$/.test(raw.centerPhone)
          ? raw.centerPhone
          : null,
      vehicleRegistration: text(raw.vehicleRegistration),
      awaitingApproval: raw.awaitingApproval === true,
      updatedAt: date(raw.updatedAt),
      progress: Array.isArray(raw.progress)
        ? raw.progress.flatMap((item) =>
            record(item) &&
            typeof item.status === 'string' &&
            Object.hasOwn(TRACKING_STATUSES, item.status)
              ? [{ status: item.status as TrackingStatus, at: date(item.at) }]
              : [],
          )
        : [],
    };
  },
};
