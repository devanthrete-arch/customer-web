const KEY = 'af_booking_draft';

export type BookingDraft = {
  vehicleId?: string;
  vehicleLabel?: string;
  vehicleType?: 'TWO_WHEELER' | 'FOUR_WHEELER';
  centerId?: string;
  centerName?: string;
  centerAutoAccept?: boolean;
  offerings?: { id: string; name: string; priceInr: number; priceIsStarting: boolean }[];
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
    return JSON.parse(raw) as BookingDraft;
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
