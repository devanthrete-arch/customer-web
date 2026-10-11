import { autoflex } from "./api";
import type { ApiCenterDetail, ApiOffering } from "../domain/api-types";
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
  kind: "SERVICE" | "PACKAGE";
  scope: Scope[];
};
export type CenterResult = ApiCenterDetail & {
  distanceMeters: number | null;
  matchingServices: ApiOffering[];
};
export const exploreApi = {
  services: async () => {
    const items: ServiceDefinition[] = [];
    let offset: number | null = 0;
    while (offset !== null) {
      const page: { items: ServiceDefinition[]; nextOffset: number | null } =
        await autoflex(`/v1/marketplace/services?offset=${offset}&limit=200`);
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
    const suffix = vehicleType
      ? `?vehicleType=${encodeURIComponent(vehicleType)}`
      : "";
    const [services, packages] = await Promise.all([
      autoflex<ApiOffering[]>(
        `/v1/marketplace/centers/${centerId}/offerings${suffix}`,
      ),
      autoflex<Package[]>(
        `/v1/marketplace/centers/${centerId}/packages${suffix}`,
      ),
    ]);
    return [
      ...services.map((s) => ({
        ...s,
        kind: "SERVICE" as const,
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
        kind: "PACKAGE" as const,
        scope: p.components,
      })),
    ];
  },
};
export const choiceKey = (choice: { kind?: string; id: string }) =>
  `${choice.kind ?? "SERVICE"}:${choice.id}`;
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
