import { autoflex } from './api';
import type { ApiCenterDetail, ApiGarageVehicle, ApiOffering } from '../domain/api-types';
export type VehicleType = ApiGarageVehicle['vehicleType'];
export const VEHICLE_TYPES: VehicleType[] = ['TWO_WHEELER', 'FOUR_WHEELER'];
export function compatibleVehicleTypes(
  choices: Pick<Choice, 'vehicleType' | 'vehicleTypes'>[],
  supported: readonly string[] = VEHICLE_TYPES,
): VehicleType[] {
  return VEHICLE_TYPES.filter(
    (type) =>
      supported.includes(type) &&
      choices.every((item) =>
        item.vehicleTypes
          ? item.vehicleTypes.includes(type)
          : !item.vehicleType || item.vehicleType === type,
      ),
  );
}
export function menuSelections(
  choices: { id: string; kind?: 'SERVICE' | 'PACKAGE'; version?: number }[],
) {
  return choices.map((item) => {
    if (!Number.isInteger(item.version) || item.version! < 1)
      throw new Error('Review the current services and prices before continuing.');
    return { id: item.id, kind: item.kind ?? 'SERVICE', version: item.version! };
  });
}
export type ServiceDefinition = {
  id: string;
  name: string;
  description: string;
  category: string;
  aliases: string[];
  vehicleTypes: string[];
};
export type Scope = {
  offeringId: string;
  serviceDefinitionId: string | null;
  name: string;
  description: string | null;
  quantity: number;
};
export type Package = ApiOffering & { available: boolean; components: Scope[] };
export type Choice = ApiOffering & {
  kind: 'SERVICE' | 'PACKAGE';
  scope: Scope[];
};
export type CenterResult = ApiCenterDetail & {
  distanceMeters: number | null;
  matchingServices: ApiOffering[];
};
export function selectedServiceIds(params: URLSearchParams) {
  return [
    ...new Set(
      [
        ...params.getAll('serviceIds'),
        ...(params.has('serviceId') ? [params.get('serviceId')!] : []),
      ].map((id) => id.toLowerCase()),
    ),
  ];
}
export const vehicleTypeLabel = (type: string) =>
  type === 'FOUR_WHEELER' ? 'Four-wheeler' : type === 'TWO_WHEELER' ? 'Two-wheeler' : type;
export const exploreApi = {
  availableServices: async (params: URLSearchParams) => {
    const items: ServiceDefinition[] = [];
    let offset: number | null = 0;
    while (offset !== null) {
      const query = new URLSearchParams(params);
      query.set('offset', String(offset));
      query.set('limit', '200');
      const page: { items: ServiceDefinition[]; nextOffset: number | null } = await autoflex(
        `/v1/marketplace/available-services?${query}`,
      );
      items.push(...page.items);
      offset = page.nextOffset;
    }
    return { items };
  },
  services: async () => {
    const items: ServiceDefinition[] = [];
    let offset: number | null = 0;
    while (offset !== null) {
      const page: { items: ServiceDefinition[]; nextOffset: number | null } = await autoflex(
        `/v1/marketplace/services?offset=${offset}&limit=200`,
      );
      items.push(...page.items);
      offset = page.nextOffset;
    }
    return { items };
  },
  centers: (params: URLSearchParams) =>
    autoflex<{ items: CenterResult[]; nextOffset: number | null }>(
      `/v1/marketplace/centers?${params}`,
    ),
  async menu(centerId: string, vehicleType?: string): Promise<Choice[]> {
    const suffix = vehicleType ? `?vehicleType=${encodeURIComponent(vehicleType)}` : '';
    const [services, packages] = await Promise.all([
      autoflex<ApiOffering[]>(`/v1/marketplace/centers/${centerId}/offerings${suffix}`),
      autoflex<Package[]>(`/v1/marketplace/centers/${centerId}/packages${suffix}`),
    ]);
    return [
      ...services.map((s) => ({
        ...s,
        kind: 'SERVICE' as const,
        scope: [
          {
            offeringId: s.id,
            serviceDefinitionId: s.serviceDefinitionId,
            name: s.name,
            description: s.description,
            quantity: 1,
          },
        ],
      })),
      ...packages.map((p) => ({
        ...p,
        kind: 'PACKAGE' as const,
        scope: p.components,
      })),
    ];
  },
};
export const choiceKey = (choice: { kind?: string; id: string }) =>
  `${choice.kind ?? 'SERVICE'}:${choice.id}`;
export function overlappingChoices(choices: Choice[]) {
  const seen = new Set<string>();
  for (const choice of choices)
    for (const part of choice.scope) {
      const id = part.serviceDefinitionId ?? part.offeringId;
      if (seen.has(id)) return true;
      seen.add(id);
    }
  return false;
}
