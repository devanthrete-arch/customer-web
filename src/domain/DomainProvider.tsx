import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { errorMessage } from '../lib/api';
import type { ApiBooking, ApiCustomerJob } from './api-types';
import {
  customerApi,
  type AddressInput,
  type ApprovalDecision,
  type BookingInput,
  type DocumentInput,
  type MaintenanceInput,
  type ProfilePatch,
  type SupportInput,
  type VehicleInput,
} from './client';
import {
  mergeServices,
  toAddress,
  toInvoice,
  toNotification,
  toVehicle,
  type Address,
  type Invoice,
  type MaintenanceItem,
  type Notification,
  type Profile,
  type ServiceRecord,
  type SupportRequest,
  type VaultDocument,
  type Vehicle,
} from './model';

export type DomainState = {
  profile: Profile;
  addresses: Address[];
  vehicles: Vehicle[];
  services: ServiceRecord[];
  invoices: Invoice[];
  documents: VaultDocument[];
  archivedDocuments: VaultDocument[];
  maintenance: MaintenanceItem[];
  notifications: Notification[];
  unreadCount: number;
  supportRequests: SupportRequest[];
};

type Raw = { bookings: ApiBooking[]; jobs: ApiCustomerJob[] };

type DomainContextValue = {
  state: DomainState;
  refresh(): Promise<void>;
  findService(id: string | undefined): ServiceRecord | undefined;
  updateProfile(patch: ProfilePatch): Promise<void>;
  addAddress(input: AddressInput): Promise<void>;
  setDefaultAddress(id: string): Promise<void>;
  removeAddress(id: string): Promise<void>;
  addVehicle(input: VehicleInput): Promise<Vehicle>;
  updateVehicle(id: string, patch: Partial<VehicleInput>): Promise<void>;
  archiveVehicle(id: string): Promise<void>;
  restoreVehicle(id: string): Promise<void>;
  createBooking(input: BookingInput): Promise<string>;
  cancelBooking(id: string, reason?: string): Promise<void>;
  decideApproval(jobId: string, approvalId: string, decision: ApprovalDecision): Promise<void>;
  addDocument(input: DocumentInput): Promise<VaultDocument>;
  updateDocument(id: string, patch: Partial<DocumentInput>): Promise<void>;
  archiveDocument(id: string): Promise<void>;
  restoreDocument(id: string): Promise<void>;
  addMaintenance(input: MaintenanceInput): Promise<MaintenanceItem>;
  completeMaintenance(id: string, odometerKm?: number): Promise<void>;
  snoozeMaintenance(id: string, until: string): Promise<void>;
  removeMaintenance(id: string): Promise<void>;
  markNotificationRead(id: string): Promise<void>;
  markAllNotificationsRead(): Promise<void>;
  createSupportRequest(input: SupportInput): Promise<SupportRequest>;
};

const DomainContext = createContext<DomainContextValue | null>(null);

const LIVE_REFRESH_MS = 30_000;

async function loadServices(vehicles: Vehicle[]): Promise<Raw & { services: ServiceRecord[] }> {
  const [bookings, summaries] = await Promise.all([customerApi.bookings(), customerApi.jobs()]);
  const jobs = await Promise.all(summaries.map((job) => customerApi.job(job.id)));
  return { bookings, jobs, services: mergeServices(bookings, jobs, vehicles) };
}

async function loadAll(): Promise<DomainState> {
  const [profile, addresses, vehicleRows, invoices, documents, archivedDocuments, maintenance, inbox, supportRequests] =
    await Promise.all([
      customerApi.profile(),
      customerApi.addresses(),
      customerApi.vehicles(),
      customerApi.invoices(),
      customerApi.documents(),
      customerApi.archivedDocuments(),
      customerApi.maintenance(),
      customerApi.notifications(),
      customerApi.supportRequests(),
    ]);
  const vehicles = vehicleRows.map(toVehicle);
  const { services } = await loadServices(vehicles);
  return {
    profile,
    addresses: addresses.map(toAddress),
    vehicles,
    services,
    invoices: invoices.map(toInvoice),
    documents,
    archivedDocuments,
    maintenance,
    notifications: inbox.items.map(toNotification),
    unreadCount: inbox.unreadCount,
    supportRequests,
  };
}

export function DomainProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<DomainState | null>(null);
  const [error, setError] = useState('');
  const stateRef = useRef<DomainState | null>(null);
  stateRef.current = state;

  const refresh = useCallback(async () => {
    try {
      setState(await loadAll());
      setError('');
    } catch (err) {
      setError(errorMessage(err, 'Could not load your garage'));
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const hasLiveService = Boolean(state?.services.some((item) => item.isActive));
  useEffect(() => {
    if (!hasLiveService) return;
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void refresh();
    }, LIVE_REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [hasLiveService, refresh]);

  const patch = useCallback((recipe: (current: DomainState) => Partial<DomainState>) => {
    setState((current) => (current ? { ...current, ...recipe(current) } : current));
  }, []);

  const reloadServices = useCallback(async () => {
    const vehicles = stateRef.current?.vehicles ?? [];
    const [{ services }, invoices, inbox] = await Promise.all([
      loadServices(vehicles),
      customerApi.invoices(),
      customerApi.notifications(),
    ]);
    patch(() => ({
      services,
      invoices: invoices.map(toInvoice),
      notifications: inbox.items.map(toNotification),
      unreadCount: inbox.unreadCount,
    }));
  }, [patch]);

  const reloadVehicles = useCallback(async () => {
    const vehicles = (await customerApi.vehicles()).map(toVehicle);
    const { services } = await loadServices(vehicles);
    patch(() => ({ vehicles, services }));
    return vehicles;
  }, [patch]);

  const reloadDocuments = useCallback(async () => {
    const [documents, archivedDocuments] = await Promise.all([
      customerApi.documents(),
      customerApi.archivedDocuments(),
    ]);
    patch(() => ({ documents, archivedDocuments }));
  }, [patch]);

  const reloadMaintenance = useCallback(async () => {
    const maintenance = await customerApi.maintenance();
    patch(() => ({ maintenance }));
  }, [patch]);

  const reloadAddresses = useCallback(async () => {
    const addresses = (await customerApi.addresses()).map(toAddress);
    patch(() => ({ addresses }));
  }, [patch]);

  const value = useMemo<DomainContextValue | null>(() => {
    if (!state) return null;
    return {
      state,
      refresh,
      findService: (id) =>
        id ? state.services.find((item) => item.id === id || item.bookingId === id) : undefined,
      async updateProfile(changes) {
        const profile = await customerApi.updateProfile(changes);
        patch(() => ({ profile }));
      },
      async addAddress(input) {
        await customerApi.addAddress(input);
        await reloadAddresses();
      },
      async setDefaultAddress(id) {
        await customerApi.updateAddress(id, { isDefault: true });
        await reloadAddresses();
      },
      async removeAddress(id) {
        await customerApi.removeAddress(id);
        await reloadAddresses();
      },
      async addVehicle(input) {
        const created = await customerApi.addVehicle(input);
        await reloadVehicles();
        return toVehicle(created);
      },
      async updateVehicle(id, changes) {
        await customerApi.updateVehicle(id, changes);
        await Promise.all([reloadVehicles(), reloadMaintenance()]);
      },
      async archiveVehicle(id) {
        await customerApi.archiveVehicle(id);
        await reloadVehicles();
      },
      async restoreVehicle(id) {
        await customerApi.restoreVehicle(id);
        await reloadVehicles();
      },
      async createBooking(input) {
        const booking = await customerApi.createBooking(input);
        await reloadServices();
        return booking.id;
      },
      async cancelBooking(id, reason) {
        await customerApi.cancelBooking(id, reason);
        await reloadServices();
      },
      async decideApproval(jobId, approvalId, decision) {
        await customerApi.decideApproval(jobId, approvalId, decision);
        await reloadServices();
      },
      async addDocument(input) {
        const document = await customerApi.addDocument(input);
        await reloadDocuments();
        return document;
      },
      async updateDocument(id, changes) {
        await customerApi.updateDocument(id, changes);
        await reloadDocuments();
      },
      async archiveDocument(id) {
        await customerApi.archiveDocument(id);
        await reloadDocuments();
      },
      async restoreDocument(id) {
        await customerApi.restoreDocument(id);
        await reloadDocuments();
      },
      async addMaintenance(input) {
        const item = await customerApi.addMaintenance(input);
        await reloadMaintenance();
        return item;
      },
      async completeMaintenance(id, odometerKm) {
        await customerApi.completeMaintenance(id, odometerKm ? { odometerKm } : {});
        await Promise.all([reloadMaintenance(), reloadVehicles()]);
      },
      async snoozeMaintenance(id, until) {
        await customerApi.snoozeMaintenance(id, until);
        await reloadMaintenance();
      },
      async removeMaintenance(id) {
        await customerApi.removeMaintenance(id);
        await reloadMaintenance();
      },
      async markNotificationRead(id) {
        const target = state.notifications.find((item) => item.id === id);
        if (!target || target.read) return;
        await customerApi.readNotification(id);
        patch((current) => ({
          notifications: current.notifications.map((item) =>
            item.id === id ? { ...item, read: true } : item,
          ),
          unreadCount: Math.max(0, current.unreadCount - 1),
        }));
      },
      async markAllNotificationsRead() {
        await customerApi.readAllNotifications();
        patch((current) => ({
          notifications: current.notifications.map((item) => ({ ...item, read: true })),
          unreadCount: 0,
        }));
      },
      async createSupportRequest(input) {
        const created = await customerApi.createSupportRequest(input);
        const [supportRequests, inbox] = await Promise.all([
          customerApi.supportRequests(),
          customerApi.notifications(),
        ]);
        patch(() => ({
          supportRequests,
          notifications: inbox.items.map(toNotification),
          unreadCount: inbox.unreadCount,
        }));
        return created;
      },
    };
  }, [
    state,
    refresh,
    patch,
    reloadAddresses,
    reloadDocuments,
    reloadMaintenance,
    reloadServices,
    reloadVehicles,
  ]);

  if (!value) {
    return (
      <section className="af-screen af-center-state">
        {error ? (
          <div className="af-empty">
            <h2>We couldn’t load your garage</h2>
            <p className="af-error">{error}</p>
            <button className="af-btn" type="button" onClick={() => void refresh()}>
              Try again
            </button>
          </div>
        ) : (
          <p className="af-hint">Loading your garage…</p>
        )}
      </section>
    );
  }

  return <DomainContext.Provider value={value}>{children}</DomainContext.Provider>;
}

export function useDomain(): DomainContextValue {
  const value = useContext(DomainContext);
  if (!value) throw new Error('useDomain must be used inside DomainProvider');
  return value;
}
