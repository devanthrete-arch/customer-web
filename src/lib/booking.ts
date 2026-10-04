const KEY = 'af_booking_draft';

export type BookingDraft = {
  vehicleId?: string;
  vehicleLabel?: string;
  vehicleType?: string;
  categoryId?: string;
  categoryName?: string;
  issueDescription?: string;
  attachments?: { id: string; name: string; type: string; sizeLabel: string }[];
  mode?: 'SELF_DROP' | 'PICKUP';
  pickupAddress?: string;
  centerId?: string;
  centerName?: string;
  estimateInr?: number;
  slotStart?: string;
  slotEnd?: string;
  slotLabel?: string;
};

export function getDraft(): BookingDraft | null {
  const raw = sessionStorage.getItem(KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as BookingDraft;
  } catch {
    return null;
  }
}

export function setDraft(draft: BookingDraft): void {
  sessionStorage.setItem(KEY, JSON.stringify(draft));
}

export function patchDraft(patch: Partial<BookingDraft>): BookingDraft {
  const next = { ...(getDraft() ?? {}), ...patch };
  setDraft(next);
  return next;
}

export function clearDraft(): void {
  sessionStorage.removeItem(KEY);
}
