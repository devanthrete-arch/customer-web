import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

export type TimelineEvent = {
  id: string;
  at: string;
  title: string;
  detail: string;
  kind: 'system' | 'customer' | 'center';
};

export type Vehicle = {
  id: string;
  make: string;
  model: string;
  variant: string;
  year: number;
  registrationNumber: string;
  fuel: string;
  transmission: string;
  mileage: number;
  purchaseDate: string;
  status: 'ACTIVE' | 'ARCHIVED';
};

export type AttachmentMeta = {
  id: string;
  name: string;
  type: string;
  sizeLabel: string;
};

export type Recommendation = {
  id: string;
  title: string;
  explanation: string;
  impactIfDeferred: string;
  priority: 'Recommended' | 'Urgent' | 'Optional';
  estimatedCost: number;
  timeImpact: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  decidedAt?: string;
};

export type ServiceStatus =
  | 'CONFIRMED'
  | 'PICKUP_SCHEDULED'
  | 'VEHICLE_RECEIVED'
  | 'INSPECTION'
  | 'AWAITING_APPROVAL'
  | 'SERVICE_IN_PROGRESS'
  | 'QUALITY_CHECK'
  | 'PAYMENT_PENDING'
  | 'READY_FOR_DELIVERY'
  | 'COMPLETED';

export type ServiceBooking = {
  id: string;
  vehicleId: string;
  serviceType: string;
  issueDescription: string;
  attachments: AttachmentMeta[];
  mode: 'SELF_DROP' | 'PICKUP';
  pickupAddress?: string;
  centerId: string;
  centerName: string;
  appointmentAt: string;
  status: ServiceStatus;
  estimate: number;
  finalAmount?: number;
  recommendations: Recommendation[];
  timeline: TimelineEvent[];
  workPerformed: string[];
  partsReplaced: string[];
  laborCharge?: number;
  taxes?: number;
  odometer?: number;
};

export type VaultDocument = {
  id: string;
  vehicleId?: string;
  title: string;
  category: 'RC' | 'Insurance' | 'PUC' | 'Invoice' | 'Warranty' | 'Driving licence' | 'Other';
  fileName: string;
  fileSize: string;
  expiryDate?: string;
  addedAt: string;
  status: 'ACTIVE' | 'ARCHIVED';
};

export type MaintenanceItem = {
  id: string;
  vehicleId: string;
  title: string;
  dueDate?: string;
  dueMileage?: number;
  interval: string;
  lastCompleted: string;
  status: 'UPCOMING' | 'OVERDUE' | 'COMPLETED' | 'SNOOZED';
  notes: string;
};

export type Invoice = {
  id: string;
  serviceId: string;
  number: string;
  amount: number;
  status: 'DUE' | 'PAID';
  issuedAt: string;
  paidAt?: string;
  transactionReference?: string;
};

export type Notification = {
  id: string;
  category: 'Service' | 'Approval' | 'Payment' | 'Maintenance' | 'Documents' | 'Support';
  title: string;
  body: string;
  href: string;
  createdAt: string;
  read: boolean;
};

export type Address = {
  id: string;
  label: string;
  line: string;
  city: string;
  phone: string;
  isDefault: boolean;
};

export type CustomerProfile = {
  name: string;
  email: string;
  phone: string;
  city: string;
  communication: 'WhatsApp' | 'SMS' | 'Email';
  serviceUpdates: boolean;
  maintenanceReminders: boolean;
  documentReminders: boolean;
};

export type MockDomainState = {
  profile: CustomerProfile;
  addresses: Address[];
  vehicles: Vehicle[];
  services: ServiceBooking[];
  documents: VaultDocument[];
  maintenance: MaintenanceItem[];
  invoices: Invoice[];
  notifications: Notification[];
};

const iso = (value: string) => new Date(value).toISOString();

export const DEMO_SEED: MockDomainState = {
  profile: {
    name: 'Priya Sharma',
    email: 'priya.sharma@example.com',
    phone: '+91 98765 43210',
    city: 'Bengaluru',
    communication: 'WhatsApp',
    serviceUpdates: true,
    maintenanceReminders: true,
    documentReminders: true,
  },
  addresses: [
    {
      id: 'addr-home',
      label: 'Home',
      line: '42, 12th Main, Indiranagar',
      city: 'Bengaluru, Karnataka 560038',
      phone: '+91 98765 43210',
      isDefault: true,
    },
    {
      id: 'addr-work',
      label: 'Work',
      line: 'Embassy Tech Village, Outer Ring Road',
      city: 'Bengaluru, Karnataka 560103',
      phone: '+91 98765 43210',
      isDefault: false,
    },
  ],
  vehicles: [
    {
      id: 'veh-creta',
      make: 'Hyundai',
      model: 'Creta',
      variant: 'SX (O)',
      year: 2024,
      registrationNumber: 'KA 03 MN 4821',
      fuel: 'Petrol',
      transmission: 'Automatic',
      mileage: 18420,
      purchaseDate: '2024-02-18',
      status: 'ACTIVE',
    },
    {
      id: 'veh-city',
      make: 'Honda',
      model: 'City',
      variant: 'VX',
      year: 2021,
      registrationNumber: 'KA 01 JK 9087',
      fuel: 'Petrol',
      transmission: 'Manual',
      mileage: 36780,
      purchaseDate: '2021-06-11',
      status: 'ACTIVE',
    },
  ],
  services: [
    {
      id: 'AF-20261001-001',
      vehicleId: 'veh-creta',
      serviceType: 'Periodic Service',
      issueDescription: 'Routine service and a squeaking sound while braking at low speed.',
      attachments: [{ id: 'att-1', name: 'brake-note.jpg', type: 'image/jpeg', sizeLabel: '1.2 MB' }],
      mode: 'PICKUP',
      pickupAddress: '42, 12th Main, Indiranagar, Bengaluru',
      centerId: 'center-indiranagar',
      centerName: 'AutoFlex Care · Indiranagar',
      appointmentAt: iso('2026-10-04T10:00:00+05:30'),
      status: 'AWAITING_APPROVAL',
      estimate: 6850,
      recommendations: [
        {
          id: 'rec-brakes',
          title: 'Front brake pad replacement',
          explanation: 'The front pads are below the recommended thickness and are causing the squeak.',
          impactIfDeferred: 'Braking distance may increase and the brake disc may wear prematurely.',
          priority: 'Recommended',
          estimatedCost: 3200,
          timeImpact: 'Adds about 60 minutes',
          status: 'PENDING',
        },
      ],
      timeline: [
        { id: 't1', at: iso('2026-10-01T11:00:00+05:30'), title: 'Booking confirmed', detail: 'Pickup and appointment reserved.', kind: 'system' },
        { id: 't2', at: iso('2026-10-04T09:15:00+05:30'), title: 'Vehicle picked up', detail: 'Driver verified the vehicle condition.', kind: 'center' },
        { id: 't3', at: iso('2026-10-04T10:05:00+05:30'), title: 'Inspection complete', detail: 'One additional item needs your decision.', kind: 'center' },
      ],
      workPerformed: ['Multi-point inspection', 'Engine oil and filter change'],
      partsReplaced: ['Engine oil filter'],
      laborCharge: 1800,
      taxes: 1045,
      odometer: 18420,
    },
    {
      id: 'AF-20260812-014',
      vehicleId: 'veh-creta',
      serviceType: 'Periodic Service',
      issueDescription: 'Scheduled maintenance.',
      attachments: [],
      mode: 'SELF_DROP',
      centerId: 'center-koramangala',
      centerName: 'AutoFlex Care · Koramangala',
      appointmentAt: iso('2026-08-12T10:00:00+05:30'),
      status: 'COMPLETED',
      estimate: 6200,
      finalAmount: 6850,
      recommendations: [],
      timeline: [
        { id: 'h1', at: iso('2026-08-12T10:00:00+05:30'), title: 'Vehicle received', detail: 'Check-in completed.', kind: 'center' },
        { id: 'h2', at: iso('2026-08-12T17:20:00+05:30'), title: 'Service completed', detail: 'Vehicle returned to customer.', kind: 'center' },
      ],
      workPerformed: ['Periodic service', 'Wheel alignment', 'Exterior wash'],
      partsReplaced: ['Engine oil', 'Oil filter', 'Cabin air filter'],
      laborCharge: 1900,
      taxes: 1045,
      odometer: 15320,
    },
    {
      id: 'AF-20260418-006',
      vehicleId: 'veh-city',
      serviceType: 'Brake Service',
      issueDescription: 'Brake pedal felt soft.',
      attachments: [],
      mode: 'SELF_DROP',
      centerId: 'center-indiranagar',
      centerName: 'AutoFlex Care · Indiranagar',
      appointmentAt: iso('2026-04-18T11:30:00+05:30'),
      status: 'COMPLETED',
      estimate: 4300,
      finalAmount: 4500,
      recommendations: [],
      timeline: [
        { id: 'h3', at: iso('2026-04-18T11:30:00+05:30'), title: 'Vehicle received', detail: 'Brake inspection started.', kind: 'center' },
        { id: 'h4', at: iso('2026-04-18T16:10:00+05:30'), title: 'Service completed', detail: 'Road test passed.', kind: 'center' },
      ],
      workPerformed: ['Brake inspection', 'Brake fluid replacement', 'Road test'],
      partsReplaced: ['Brake fluid'],
      laborCharge: 1550,
      taxes: 686,
      odometer: 33210,
    },
  ],
  documents: [
    {
      id: 'doc-insurance',
      vehicleId: 'veh-creta',
      title: 'Comprehensive insurance',
      category: 'Insurance',
      fileName: 'creta-insurance-2026.pdf',
      fileSize: '842 KB',
      expiryDate: '2026-11-02',
      addedAt: '2026-02-18',
      status: 'ACTIVE',
    },
    {
      id: 'doc-rc',
      vehicleId: 'veh-creta',
      title: 'Registration certificate',
      category: 'RC',
      fileName: 'creta-rc.pdf',
      fileSize: '1.1 MB',
      addedAt: '2024-02-19',
      status: 'ACTIVE',
    },
    {
      id: 'doc-puc',
      vehicleId: 'veh-city',
      title: 'Pollution certificate',
      category: 'PUC',
      fileName: 'city-puc.pdf',
      fileSize: '410 KB',
      expiryDate: '2026-10-20',
      addedAt: '2026-04-20',
      status: 'ACTIVE',
    },
  ],
  maintenance: [
    {
      id: 'mnt-oil-city',
      vehicleId: 'veh-city',
      title: 'Engine oil service',
      dueDate: '2026-09-15',
      dueMileage: 36500,
      interval: 'Every 10,000 km or 12 months',
      lastCompleted: '14 Sep 2025',
      status: 'OVERDUE',
      notes: 'Book a periodic service soon to avoid accelerated engine wear.',
    },
    {
      id: 'mnt-tyres-creta',
      vehicleId: 'veh-creta',
      title: 'Tyre rotation and inspection',
      dueMileage: 20000,
      interval: 'Every 10,000 km',
      lastCompleted: '12 Aug 2026 at 15,320 km',
      status: 'UPCOMING',
      notes: 'Inspect tread depth and rotate tyres at the next visit.',
    },
    {
      id: 'mnt-battery-city',
      vehicleId: 'veh-city',
      title: 'Battery inspection',
      dueDate: '2026-12-01',
      interval: 'Every 12 months',
      lastCompleted: '02 Dec 2025',
      status: 'UPCOMING',
      notes: 'A visual inspection and voltage test are recommended.',
    },
  ],
  invoices: [
    {
      id: 'inv-active',
      serviceId: 'AF-20261001-001',
      number: 'INV-DEMO-1001',
      amount: 10050,
      status: 'DUE',
      issuedAt: '2026-10-04',
    },
    {
      id: 'inv-aug',
      serviceId: 'AF-20260812-014',
      number: 'INV-2026-0812',
      amount: 6850,
      status: 'PAID',
      issuedAt: '2026-08-12',
      paidAt: iso('2026-08-12T17:05:00+05:30'),
      transactionReference: 'AFDEMO820126',
    },
  ],
  notifications: [
    {
      id: 'not-approval',
      category: 'Approval',
      title: 'Additional work needs your decision',
      body: 'Review the front brake pad recommendation for your Hyundai Creta.',
      href: '/services/AF-20261001-001/recommendations/rec-brakes',
      createdAt: iso('2026-10-04T10:08:00+05:30'),
      read: false,
    },
    {
      id: 'not-puc',
      category: 'Documents',
      title: 'PUC expires soon',
      body: 'The Honda City pollution certificate expires on 20 Oct.',
      href: '/documents/doc-puc',
      createdAt: iso('2026-10-03T09:00:00+05:30'),
      read: false,
    },
    {
      id: 'not-maint',
      category: 'Maintenance',
      title: 'Engine oil service overdue',
      body: 'Honda City has passed its maintenance date and mileage.',
      href: '/maintenance/mnt-oil-city',
      createdAt: iso('2026-10-01T09:00:00+05:30'),
      read: true,
    },
  ],
};

const cloneSeed = (): MockDomainState => JSON.parse(JSON.stringify(DEMO_SEED)) as MockDomainState;
const STORAGE_KEY = 'autoflex-customer-mock-v1';

export interface CustomerDomainRepository {
  load(): MockDomainState;
  save(state: MockDomainState): void;
  reset(): MockDomainState;
}

export class LocalMockCustomerRepository implements CustomerDomainRepository {
  load(): MockDomainState {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? (JSON.parse(raw) as MockDomainState) : cloneSeed();
    } catch {
      return cloneSeed();
    }
  }

  save(state: MockDomainState): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // The demo remains usable in memory when storage is unavailable.
    }
  }

  reset(): MockDomainState {
    const state = cloneSeed();
    this.save(state);
    return state;
  }
}

type NewVehicle = Omit<Vehicle, 'id' | 'status'>;
type NewDocument = Omit<VaultDocument, 'id' | 'addedAt' | 'status'>;
type NewBooking = Omit<ServiceBooking, 'id' | 'status' | 'timeline' | 'recommendations' | 'workPerformed' | 'partsReplaced'>;

type DomainContextValue = {
  state: MockDomainState;
  addVehicle(input: NewVehicle): Vehicle;
  updateVehicle(id: string, patch: Partial<Vehicle>): void;
  archiveVehicle(id: string): void;
  createBooking(input: NewBooking): ServiceBooking;
  decideRecommendation(serviceId: string, recommendationId: string, decision: 'APPROVED' | 'REJECTED'): void;
  addDocument(input: NewDocument): VaultDocument;
  archiveDocument(id: string): void;
  snoozeMaintenance(id: string): void;
  completeMaintenance(id: string): void;
  payInvoice(id: string): void;
  markNotificationRead(id: string): void;
  updateProfile(patch: Partial<CustomerProfile>): void;
  addAddress(input: Omit<Address, 'id'>): void;
  removeAddress(id: string): void;
  resetDemo(): void;
};

const DomainContext = createContext<DomainContextValue | null>(null);

export function MockDomainProvider({
  children,
  repository = new LocalMockCustomerRepository(),
}: {
  children: ReactNode;
  repository?: CustomerDomainRepository;
}) {
  const [state, setState] = useState<MockDomainState>(() => repository.load());

  const mutate = useCallback(
    (recipe: (draft: MockDomainState) => void) => {
      setState((previous) => {
        const next = JSON.parse(JSON.stringify(previous)) as MockDomainState;
        recipe(next);
        repository.save(next);
        return next;
      });
    },
    [repository],
  );

  const value = useMemo<DomainContextValue>(
    () => ({
      state,
      addVehicle(input) {
        const vehicle: Vehicle = { ...input, id: `veh-${Date.now()}`, status: 'ACTIVE' };
        mutate((draft) => draft.vehicles.push(vehicle));
        return vehicle;
      },
      updateVehicle(id, patch) {
        mutate((draft) => {
          const vehicle = draft.vehicles.find((item) => item.id === id);
          if (vehicle) Object.assign(vehicle, patch);
        });
      },
      archiveVehicle(id) {
        mutate((draft) => {
          const vehicle = draft.vehicles.find((item) => item.id === id);
          if (vehicle) vehicle.status = 'ARCHIVED';
        });
      },
      createBooking(input) {
        const sequence = state.services.length + 1;
        const booking: ServiceBooking = {
          ...input,
          id: `AF-DEMO-${String(sequence).padStart(3, '0')}`,
          status: input.mode === 'PICKUP' ? 'PICKUP_SCHEDULED' : 'CONFIRMED',
          recommendations: [],
          workPerformed: [],
          partsReplaced: [],
          timeline: [
            {
              id: `event-${Date.now()}`,
              at: new Date().toISOString(),
              title: 'Booking confirmed',
              detail: 'Demo booking stored on this device.',
              kind: 'system',
            },
          ],
        };
        mutate((draft) => {
          draft.services.unshift(booking);
          draft.notifications.unshift({
            id: `not-${Date.now()}`,
            category: 'Service',
            title: 'Demo booking confirmed',
            body: `${booking.serviceType} was added to your mock service list.`,
            href: `/services/${booking.id}`,
            createdAt: new Date().toISOString(),
            read: false,
          });
        });
        return booking;
      },
      decideRecommendation(serviceId, recommendationId, decision) {
        mutate((draft) => {
          const service = draft.services.find((item) => item.id === serviceId);
          const recommendation = service?.recommendations.find((item) => item.id === recommendationId);
          if (!service || !recommendation || recommendation.status !== 'PENDING') return;
          recommendation.status = decision;
          recommendation.decidedAt = new Date().toISOString();
          service.status = 'SERVICE_IN_PROGRESS';
          if (decision === 'APPROVED') {
            service.finalAmount = service.estimate + recommendation.estimatedCost;
            const invoice = draft.invoices.find((item) => item.serviceId === service.id);
            if (invoice) invoice.amount = service.finalAmount;
          }
          service.timeline.push({
            id: `event-${Date.now()}`,
            at: new Date().toISOString(),
            title: decision === 'APPROVED' ? 'Additional work approved' : 'Additional work declined',
            detail: `${recommendation.title} · customer decision recorded in this demo.`,
            kind: 'customer',
          });
          draft.notifications = draft.notifications.filter(
            (item) => item.href !== `/services/${serviceId}/recommendations/${recommendationId}`,
          );
        });
      },
      addDocument(input) {
        const document: VaultDocument = {
          ...input,
          id: `doc-${Date.now()}`,
          addedAt: new Date().toISOString().slice(0, 10),
          status: 'ACTIVE',
        };
        mutate((draft) => draft.documents.unshift(document));
        return document;
      },
      archiveDocument(id) {
        mutate((draft) => {
          const document = draft.documents.find((item) => item.id === id);
          if (document) document.status = 'ARCHIVED';
        });
      },
      snoozeMaintenance(id) {
        mutate((draft) => {
          const item = draft.maintenance.find((entry) => entry.id === id);
          if (item) item.status = 'SNOOZED';
        });
      },
      completeMaintenance(id) {
        mutate((draft) => {
          const item = draft.maintenance.find((entry) => entry.id === id);
          if (item) {
            item.status = 'COMPLETED';
            item.lastCompleted = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
          }
        });
      },
      payInvoice(id) {
        mutate((draft) => {
          const invoice = draft.invoices.find((item) => item.id === id);
          if (!invoice || invoice.status === 'PAID') return;
          invoice.status = 'PAID';
          invoice.paidAt = new Date().toISOString();
          invoice.transactionReference = `MOCK-${Date.now().toString().slice(-8)}`;
          const service = draft.services.find((item) => item.id === invoice.serviceId);
          if (service) {
            service.status = 'READY_FOR_DELIVERY';
            service.timeline.push({
              id: `event-${Date.now()}`,
              at: new Date().toISOString(),
              title: 'Demo payment recorded',
              detail: 'No real money was transferred.',
              kind: 'customer',
            });
          }
        });
      },
      markNotificationRead(id) {
        mutate((draft) => {
          const notification = draft.notifications.find((item) => item.id === id);
          if (notification) notification.read = true;
        });
      },
      updateProfile(patch) {
        mutate((draft) => Object.assign(draft.profile, patch));
      },
      addAddress(input) {
        mutate((draft) => {
          if (input.isDefault) draft.addresses.forEach((address) => (address.isDefault = false));
          draft.addresses.push({ ...input, id: `addr-${Date.now()}` });
        });
      },
      removeAddress(id) {
        mutate((draft) => {
          draft.addresses = draft.addresses.filter((item) => item.id !== id);
        });
      },
      resetDemo() {
        setState(repository.reset());
        sessionStorage.removeItem('af_booking_draft');
      },
    }),
    [mutate, repository, state],
  );

  return <DomainContext.Provider value={value}>{children}</DomainContext.Provider>;
}

export function useMockDomain(): DomainContextValue {
  const value = useContext(DomainContext);
  if (!value) throw new Error('useMockDomain must be used inside MockDomainProvider');
  return value;
}

export const serviceStatusLabel = (status: ServiceStatus): string =>
  ({
    CONFIRMED: 'Booking confirmed',
    PICKUP_SCHEDULED: 'Pickup scheduled',
    VEHICLE_RECEIVED: 'Vehicle received',
    INSPECTION: 'Inspection',
    AWAITING_APPROVAL: 'Waiting for your approval',
    SERVICE_IN_PROGRESS: 'Service in progress',
    QUALITY_CHECK: 'Quality check',
    PAYMENT_PENDING: 'Payment pending',
    READY_FOR_DELIVERY: 'Ready for delivery',
    COMPLETED: 'Completed',
  })[status];

export const ACTIVE_SERVICE_STAGES: ServiceStatus[] = [
  'CONFIRMED',
  'PICKUP_SCHEDULED',
  'VEHICLE_RECEIVED',
  'INSPECTION',
  'AWAITING_APPROVAL',
  'SERVICE_IN_PROGRESS',
  'QUALITY_CHECK',
  'PAYMENT_PENDING',
  'READY_FOR_DELIVERY',
  'COMPLETED',
];
