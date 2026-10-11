import { createContext, useContext } from 'react';
import type {
  DiscoveryLocation,
  LocationSource,
} from '../lib/discovery-location';

export type DiscoveryLocationContext = {
  location: DiscoveryLocation | null;
  source: LocationSource | null;
  ready: boolean;
  resolved: boolean;
  notice: string;
  error: string;
  openPicker: () => void;
  refreshProfile: () => Promise<void>;
  retry: () => void;
};
export const LocationContext = createContext<DiscoveryLocationContext | null>(
  null,
);

export function useDiscoveryLocation() {
  const context = useContext(LocationContext);
  if (!context) throw new Error('DiscoveryLocationProvider is required');
  return context;
}
