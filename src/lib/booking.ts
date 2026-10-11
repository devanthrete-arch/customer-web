import { type Choice, type Scope, type VehicleType, VEHICLE_TYPES } from './marketplace';
const KEY = 'af_booking_draft';

export type BookingDraft = {
  entry?: 'MARKETPLACE' | 'VEHICLE';
  vehicleId?: string;
  vehicleLabel?: string;
  vehicleType?: 'TWO_WHEELER' | 'FOUR_WHEELER';
  /** Vehicle type required by work chosen before a vehicle is selected. */
  requiredVehicleType?: 'TWO_WHEELER' | 'FOUR_WHEELER';
  compatibleVehicleTypes?: VehicleType[];
  centerId?: string;
  centerName?: string;
  /** Exact center menu route to resume when changing the vehicle. */
  marketplaceCenterPath?: string;
  centerAutoAccept?: boolean;
  offerings?: {
    id: string;
    name: string;
    priceInr: number;
    priceIsStarting: boolean;
    kind?: 'SERVICE' | 'PACKAGE';
    version?: number;
    scope?: Scope[];
    vehicleTypes?: VehicleType[];
  }[];
  /** Used when no menu item is picked. */
  baseEstimateInr?: number;
  issueDescription?: string;
  slotStart?: string;
  slotEnd?: string;
};

export function getDraft(): BookingDraft {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return {};
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
    const draft = value as BookingDraft;
    if (draft.entry !== undefined && draft.entry !== 'MARKETPLACE' && draft.entry !== 'VEHICLE')
      return {};
    if (
      draft.baseEstimateInr !== undefined &&
      (typeof draft.baseEstimateInr !== 'number' ||
        !Number.isFinite(draft.baseEstimateInr) ||
        draft.baseEstimateInr < 0)
    )
      return {};
    if (
      [
        'vehicleId',
        'vehicleLabel',
        'centerId',
        'centerName',
        'marketplaceCenterPath',
        'issueDescription',
        'slotStart',
        'slotEnd',
      ].some((key) => key in draft && typeof (draft as Record<string, unknown>)[key] !== 'string')
    )
      return {};
    if (
      (draft.requiredVehicleType !== undefined && !VEHICLE_TYPES.includes(draft.requiredVehicleType)) ||
      (draft.vehicleType !== undefined && !VEHICLE_TYPES.includes(draft.vehicleType)) ||
      (draft.compatibleVehicleTypes !== undefined &&
        (!Array.isArray(draft.compatibleVehicleTypes) ||
          draft.compatibleVehicleTypes.some((type) => !VEHICLE_TYPES.includes(type))))
    )
      return {};
    if (
      draft.offerings !== undefined &&
      (!Array.isArray(draft.offerings) ||
        draft.offerings.length > 10 ||
        draft.offerings.some(
          (item) =>
            !item ||
            typeof item.id !== 'string' ||
            typeof item.name !== 'string' ||
            typeof item.priceInr !== 'number' ||
            !Number.isFinite(item.priceInr) ||
            item.priceInr < 0 ||
            (item.kind !== undefined && item.kind !== 'SERVICE' && item.kind !== 'PACKAGE') ||
            (item.version !== undefined && (!Number.isInteger(item.version) || item.version < 1)) ||
            (item.scope !== undefined &&
              (!Array.isArray(item.scope) ||
                item.scope.some(
                  (part) =>
                    !part ||
                    typeof part.offeringId !== 'string' ||
                    typeof part.name !== 'string' ||
                    !Number.isInteger(part.quantity) ||
                    part.quantity < 1,
                ))) ||
            (item.vehicleTypes !== undefined &&
              (!Array.isArray(item.vehicleTypes) ||
                item.vehicleTypes.some((type) => !VEHICLE_TYPES.includes(type)))),
        ))
    )
      return {};
    return draft;
  } catch {
    return {};
  }
}

export function selectionDraft(
  choices: Choice[],
  vehicleTypes: VehicleType[],
): Partial<BookingDraft> {
  return {
    compatibleVehicleTypes: vehicleTypes,
    requiredVehicleType: choices.length && vehicleTypes.length === 1 ? vehicleTypes[0] : undefined,
    offerings: choices.map((item) => ({
      id: item.id,
      kind: item.kind,
      version: item.version,
      scope: item.scope,
      name: item.name,
      priceInr: Number(item.priceInr),
      priceIsStarting: item.priceIsStarting,
      vehicleTypes:
        item.vehicleTypes ??
        (item.vehicleType ? VEHICLE_TYPES.filter((type) => type === item.vehicleType) : undefined),
    })),
    slotStart: undefined,
    slotEnd: undefined,
  };
}

export function marketplaceBack(draft: BookingDraft): string {
  if (draft.entry !== 'MARKETPLACE' || !draft.centerId) return '/services';
  const path = `/explore/centers/${encodeURIComponent(draft.centerId)}`;
  const saved = draft.marketplaceCenterPath;
  const params = new URLSearchParams(
    saved?.startsWith(`${path}?`) ? saved.slice(path.length + 1) : '',
  );
  params.set('booking', '1');
  if (params.has('vehicleId')) {
    if (draft.vehicleId) params.set('vehicleId', draft.vehicleId);
    else params.delete('vehicleId');
  }
  if (params.has('vehicleType') && draft.vehicleType) params.set('vehicleType', draft.vehicleType);
  return `${path}?${params}`;
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
