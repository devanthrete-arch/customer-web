import type { Scope } from './marketplace';
const KEY = 'af_booking_draft';

export type BookingDraft = {
  entry?: 'MARKETPLACE' | 'VEHICLE';
  vehicleId?: string;
  vehicleLabel?: string;
  vehicleType?: 'TWO_WHEELER' | 'FOUR_WHEELER';
  centerId?: string;
  centerName?: string;
  centerAutoAccept?: boolean;
  offerings?: {
    id: string;
    name: string;
    priceInr: number;
    priceIsStarting: boolean;
    kind?: 'SERVICE' | 'PACKAGE';
    version?: number;
    scope?: Scope[];
  }[];
  /** Used when no menu item is picked. */
  baseEstimateInr?: number;
  issueDescription?: string;
  slotStart?: string;
  slotEnd?: string;
};

export function getDraft(): BookingDraft {
  const raw = sessionStorage.getItem(KEY);
  if (!raw) return {};
  try {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
    const draft = value as BookingDraft;
    if (
      draft.offerings &&
      (!Array.isArray(draft.offerings) ||
        draft.offerings.length > 10 ||
        draft.offerings.some(
          (item) =>
            !item ||
            typeof item.id !== 'string' ||
            typeof item.name !== 'string' ||
            typeof item.priceInr !== 'number' ||
            !Number.isFinite(item.priceInr),
        ))
    )
      return {};
    return draft;
  } catch {
    return {};
  }
}

export function patchDraft(patch: Partial<BookingDraft>): BookingDraft {
  const next = { ...getDraft(), ...patch };
  sessionStorage.setItem(KEY, JSON.stringify(next));
  return next;
}

export function clearDraft(): void {
  sessionStorage.removeItem(KEY);
}

export function draftEstimate(draft: BookingDraft): number {
  const picked = draft.offerings ?? [];
  return picked.length
    ? picked.reduce((sum, item) => sum + item.priceInr, 0)
    : (draft.baseEstimateInr ?? 0);
}
