import type {
  ApiAddress,
  ApiApproval,
  ApiBooking,
  ApiCustomerJob,
  ApiGarageVehicle,
  ApiInvoice,
  ApiJobStatus,
  ApiLine,
  ApiMaintenanceItem,
  ApiNotification,
  ApiProfile,
  ApiSupportRequest,
  ApiTimelineEntry,
  ApiVaultCategory,
  ApiVaultDocument,
} from './api-types';

export type Vehicle = ApiGarageVehicle & { label: string; mileage: number | null };
export type Address = ApiAddress & { summary: string };
export type Profile = ApiProfile;
export type VaultDocument = ApiVaultDocument;
export type MaintenanceItem = ApiMaintenanceItem;
export type Notification = ApiNotification & { target: string };
export type SupportRequest = ApiSupportRequest;

export type Invoice = Omit<ApiInvoice, 'totalInr' | 'paidInr' | 'balanceInr' | 'subtotalInr' | 'adjustmentInr'> & {
  totalInr: number;
  paidInr: number;
  balanceInr: number;
  subtotalInr: number;
  adjustmentInr: number;
};

/** Stages a service moves through, from request to handover. */
export const SERVICE_STAGES = [
  'REQUESTED',
  'CONFIRMED',
  'VEHICLE_RECEIVED',
  'INSPECTION',
  'AWAITING_APPROVAL',
  'IN_PROGRESS',
  'QUALITY_CHECK',
  'READY_FOR_PICKUP',
  'COMPLETED',
] as const;

export type ServiceStage = (typeof SERVICE_STAGES)[number];
export type ServiceStatus = ServiceStage | 'ON_HOLD' | 'CANCELLED' | 'NO_SHOW';

export type ServiceLine = {
  id: string;
  kind: ApiLine['kind'];
  description: string;
  partType: ApiLine['partType'];
  quantity: number;
  amountInr: number;
  status: ApiLine['status'];
  returnedToCustomer: boolean;
};

export type Approval = {
  id: string;
  status: ApiApproval['status'];
  note: string | null;
  totalInr: number;
  requestedAt: string;
  decidedAt: string | null;
  decidedBy: ApiApproval['decidedBy'];
  items: ServiceLine[];
};

export type TimelineEvent = { id: string; at: string; title: string; detail: string };

/**
 * One customer-facing service: a booking until the vehicle is checked in,
 * then the job card the center opened for it.
 */
export type ServiceRecord = {
  id: string;
  kind: 'booking' | 'job';
  bookingId: string | null;
  jobId: string | null;
  reference: string;
  title: string;
  vehicleId: string | null;
  vehicleLabel: string;
  registrationNumber: string;
  centerId: string | null;
  centerName: string;
  centerPhone: string | null;
  appointmentAt: string;
  status: ServiceStatus;
  /** Where the progress tracker sits; a held job keeps the stage it paused at. */
  stage: ServiceStage | null;
  isActive: boolean;
  request: string | null;
  bookedItems: { name: string; priceInr: number; priceIsStarting: boolean }[];
  estimateInr: number;
  currentInr: number | null;
  pendingInr: number;
  finalInr: number | null;
  lines: ServiceLine[];
  approvals: Approval[];
  pendingApproval: Approval | null;
  timeline: TimelineEvent[];
  invoiceId: string | null;
  balanceInr: number;
  upiVpa: string | null;
  odometerKm: number | null;
  holdReason: string | null;
  estimatedReadyAt: string | null;
  expectedResumeAt: string | null;
  closedAt: string | null;
  finalNotes: string | null;
  cancellationReason: string | null;
  cancelledBy: ApiBooking['cancelledBy'];
  canCancel: boolean;
};

const amount = (value: string | number | null | undefined): number => Number(value ?? 0);

export const vehicleLabel = (vehicle: { make: string; model: string }): string =>
  `${vehicle.make} ${vehicle.model}`;

export function toVehicle(row: ApiGarageVehicle): Vehicle {
  return { ...row, label: vehicleLabel(row), mileage: row.currentOdometerKm };
}

export function toAddress(row: ApiAddress): Address {
  const first = [row.line1, row.line2, row.landmark].filter(Boolean).join(', ');
  const second = [row.city, row.state].filter(Boolean).join(', ');
  return { ...row, summary: `${first}, ${second} ${row.postalCode}` };
}

export function toInvoice(row: ApiInvoice): Invoice {
  return {
    ...row,
    totalInr: amount(row.totalInr),
    paidInr: amount(row.paidInr),
    balanceInr: amount(row.balanceInr),
    subtotalInr: amount(row.subtotalInr),
    adjustmentInr: amount(row.adjustmentInr),
  };
}

/** Old in-app links point at bookings and support threads that live elsewhere here. */
export function notificationTarget(row: ApiNotification): string {
  if (row.jobId) return `/services/${row.jobId}`;
  if (row.bookingId) return `/services/${row.bookingId}`;
  const href = row.href ?? '';
  if (href.startsWith('/support')) return '/support';
  if (href.startsWith('/bookings/')) return href.replace('/bookings/', '/services/');
  return href || '/notifications';
}

export function toNotification(row: ApiNotification): Notification {
  return { ...row, target: notificationTarget(row) };
}

const JOB_STATUS: Record<ApiJobStatus, ServiceStatus> = {
  CHECKED_IN: 'VEHICLE_RECEIVED',
  INSPECTION: 'INSPECTION',
  AWAITING_APPROVAL: 'AWAITING_APPROVAL',
  IN_PROGRESS: 'IN_PROGRESS',
  ON_HOLD: 'ON_HOLD',
  QUALITY_CHECK: 'QUALITY_CHECK',
  READY_FOR_PICKUP: 'READY_FOR_PICKUP',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
};

const BOOKING_STATUS: Record<ApiBooking['status'], ServiceStatus> = {
  PENDING_CENTER: 'REQUESTED',
  CONFIRMED: 'CONFIRMED',
  AWAITING_ARRIVAL: 'CONFIRMED',
  CHECKED_IN: 'VEHICLE_RECEIVED',
  NO_SHOW: 'NO_SHOW',
  CANCELLED: 'CANCELLED',
};

const isStage = (status: ServiceStatus | null): status is ServiceStage =>
  status !== null && (SERVICE_STAGES as readonly string[]).includes(status);

export const isActiveStatus = (status: ServiceStatus): boolean =>
  !['COMPLETED', 'CANCELLED', 'NO_SHOW'].includes(status);

/** Step names for the progress tracker. */
export function stageLabel(stage: ServiceStage): string {
  return {
    REQUESTED: 'Booking requested',
    CONFIRMED: 'Booking confirmed',
    VEHICLE_RECEIVED: 'Vehicle received',
    INSPECTION: 'Inspection',
    AWAITING_APPROVAL: 'Your approval',
    IN_PROGRESS: 'Service in progress',
    QUALITY_CHECK: 'Quality check',
    READY_FOR_PICKUP: 'Ready for pickup',
    COMPLETED: 'Handed over',
  }[stage];
}

export function serviceStatusLabel(status: ServiceStatus): string {
  return {
    REQUESTED: 'Waiting for the center',
    CONFIRMED: 'Booking confirmed',
    VEHICLE_RECEIVED: 'Vehicle received',
    INSPECTION: 'Inspection',
    AWAITING_APPROVAL: 'Waiting for your approval',
    IN_PROGRESS: 'Service in progress',
    ON_HOLD: 'On hold',
    QUALITY_CHECK: 'Quality check',
    READY_FOR_PICKUP: 'Ready for pickup',
    COMPLETED: 'Completed',
    CANCELLED: 'Cancelled',
    NO_SHOW: 'Missed appointment',
  }[status];
}

function toLine(row: ApiLine): ServiceLine {
  return {
    id: row.id,
    kind: row.kind,
    description: row.description,
    partType: row.partType,
    quantity: row.quantity,
    amountInr: amount(row.amountInr),
    status: row.status,
    returnedToCustomer: Boolean(row.partReturnedAt),
  };
}

function toApproval(row: ApiApproval): Approval {
  return {
    id: row.id,
    status: row.status,
    note: row.note,
    totalInr: amount(row.totalInr),
    requestedAt: row.requestedAt,
    decidedAt: row.decidedAt,
    decidedBy: row.decidedBy,
    items: row.items.map(toLine),
  };
}

const text = (payload: Record<string, unknown> | null, key: string): string =>
  typeof payload?.[key] === 'string' ? (payload[key] as string) : '';

function describeEvent(entry: ApiTimelineEntry): TimelineEvent | null {
  const { payload } = entry;
  const base = { id: entry.id, at: entry.createdAt };
  switch (entry.type) {
    case 'STATUS_CHANGE': {
      if (!entry.toStatus) return null;
      const to = JOB_STATUS[entry.toStatus];
      const detail = text(payload, 'reason') || text(payload, 'note');
      return { ...base, title: serviceStatusLabel(to), detail };
    }
    case 'NOTE': {
      const message = text(payload, 'message');
      return message === 'Job created'
        ? { ...base, title: 'Job card opened', detail: text(payload, 'jobNumber') }
        : { ...base, title: 'Update from the center', detail: message };
    }
    case 'APPROVAL_REQUESTED':
      return {
        ...base,
        title: 'Additional work proposed',
        detail: `₹${amount(text(payload, 'totalInr')).toLocaleString('en-IN')} awaiting your decision`,
      };
    case 'APPROVAL_RESOLVED': {
      const status = text(payload, 'status');
      const title =
        status === 'APPROVED'
          ? 'Additional work approved'
          : status === 'PARTIALLY_APPROVED'
            ? 'Additional work partly approved'
            : status === 'WITHDRAWN'
              ? 'Proposal withdrawn by the center'
              : 'Additional work declined';
      return { ...base, title, detail: '' };
    }
    case 'MEDIA_ADDED':
      return { ...base, title: 'Photo added', detail: text(payload, 'caption') };
    case 'INSPECTION_RECORDED':
      return { ...base, title: 'Inspection notes recorded', detail: '' };
    case 'INVOICE_ISSUED':
      return { ...base, title: 'Bill ready', detail: text(payload, 'invoiceNumber') };
    case 'PAYMENT_RECORDED':
      return {
        ...base,
        title: 'Payment received',
        detail: `${text(payload, 'invoiceNumber')} · ${text(payload, 'method')}`.trim(),
      };
    default:
      return null;
  }
}

function heldAt(job: ApiCustomerJob): ServiceStage {
  const entry = [...job.timeline]
    .reverse()
    .find((item) => item.type === 'STATUS_CHANGE' && item.toStatus === 'ON_HOLD');
  const from = entry?.fromStatus ? JOB_STATUS[entry.fromStatus] : null;
  return isStage(from) ? from : 'IN_PROGRESS';
}

export function jobToService(
  job: ApiCustomerJob,
  booking: ApiBooking | undefined,
  vehicles: Vehicle[],
): ServiceRecord {
  const status = JOB_STATUS[job.status];
  const vehicle = vehicles.find((item) => item.id === job.vehicle?.garageVehicleId);
  const approvals = job.approvals.map(toApproval);
  const lines = job.lineItems.map(toLine);
  return {
    id: job.id,
    kind: 'job',
    bookingId: job.bookingId,
    jobId: job.id,
    reference: job.jobNumber ?? booking?.bookingNumber ?? job.id.slice(0, 8),
    title: job.serviceType,
    vehicleId: vehicle?.id ?? null,
    vehicleLabel: vehicle?.label ?? job.vehicle?.makeModel ?? 'Vehicle',
    registrationNumber: job.vehicle?.registrationNumber ?? '',
    centerId: job.center?.id ?? null,
    centerName: job.center?.name ?? booking?.centerName ?? 'Service center',
    centerPhone: job.center?.phone ?? null,
    appointmentAt: booking?.slotStart ?? job.createdAt,
    status,
    stage: status === 'ON_HOLD' ? heldAt(job) : isStage(status) ? status : null,
    isActive: isActiveStatus(status),
    request: job.customerRequest ?? booking?.issueDescription ?? null,
    bookedItems: (booking?.items ?? []).map((item) => ({
      name: item.name,
      priceInr: amount(item.priceInr),
      priceIsStarting: item.priceIsStarting,
    })),
    estimateInr: booking ? amount(booking.estimateInr) : amount(job.totals.includedInr),
    currentInr: amount(job.totals.currentInr),
    pendingInr: amount(job.totals.pendingInr),
    finalInr: job.finalAmountInr === null ? null : amount(job.finalAmountInr),
    lines,
    approvals,
    pendingApproval: approvals.find((item) => item.id === job.pendingApprovalId) ?? null,
    timeline: job.timeline
      .map(describeEvent)
      .filter((item): item is TimelineEvent => item !== null),
    invoiceId: job.invoice?.id ?? null,
    balanceInr: job.invoice ? amount(job.invoice.balanceInr) : 0,
    upiVpa: job.upiVpa,
    odometerKm: job.odometerKm,
    holdReason: job.holdReason,
    estimatedReadyAt: job.estimatedReadyAt,
    expectedResumeAt: job.expectedResumeAt,
    closedAt: job.closedAt,
    finalNotes: job.finalNotes,
    cancellationReason: null,
    cancelledBy: null,
    canCancel: false,
  };
}

const CANCELLABLE: ApiBooking['status'][] = ['PENDING_CENTER', 'CONFIRMED', 'AWAITING_ARRIVAL'];

export function bookingToService(booking: ApiBooking): ServiceRecord {
  const status = BOOKING_STATUS[booking.status];
  const items = booking.items.map((item) => ({
    name: item.name,
    priceInr: amount(item.priceInr),
    priceIsStarting: item.priceIsStarting,
  }));
  const timeline: TimelineEvent[] = [
    { id: `${booking.id}-created`, at: booking.createdAt, title: 'Booking requested', detail: '' },
  ];
  if (booking.confirmedAt) {
    timeline.push({
      id: `${booking.id}-confirmed`,
      at: booking.confirmedAt,
      title: 'Booking confirmed',
      detail: booking.centerName,
    });
  }
  if (booking.cancelledAt) {
    timeline.push({
      id: `${booking.id}-cancelled`,
      at: booking.cancelledAt,
      title: booking.cancelledBy === 'CENTER' ? 'Declined by the center' : 'You cancelled',
      detail: booking.cancellationReason ?? '',
    });
  }
  return {
    id: booking.id,
    kind: 'booking',
    bookingId: booking.id,
    jobId: booking.serviceJobId,
    reference: booking.bookingNumber ?? booking.id.slice(0, 8),
    title: items.length ? items.map((item) => item.name).join(', ') : 'General service',
    vehicleId: booking.vehicleId,
    vehicleLabel: booking.vehicleLabel,
    registrationNumber: booking.registrationNumber,
    centerId: booking.serviceCenterId,
    centerName: booking.centerName,
    centerPhone: null,
    appointmentAt: booking.slotStart,
    status,
    stage: isStage(status) ? status : null,
    isActive: isActiveStatus(status),
    request: booking.issueDescription,
    bookedItems: items,
    estimateInr: amount(booking.estimateInr),
    currentInr: null,
    pendingInr: 0,
    finalInr: null,
    lines: [],
    approvals: [],
    pendingApproval: null,
    timeline,
    invoiceId: null,
    balanceInr: 0,
    upiVpa: null,
    odometerKm: null,
    holdReason: null,
    estimatedReadyAt: null,
    expectedResumeAt: null,
    closedAt: null,
    finalNotes: null,
    cancellationReason: booking.cancellationReason,
    cancelledBy: booking.cancelledBy,
    canCancel: CANCELLABLE.includes(booking.status) && new Date(booking.slotStart).getTime() > Date.now(),
  };
}

const rank = (service: ServiceRecord): number => {
  if (!service.isActive) return 3;
  if (service.pendingApproval || service.status === 'READY_FOR_PICKUP') return 0;
  return service.kind === 'job' ? 1 : 2;
};

/**
 * Jobs replace the booking they came from. Order: needs you, in the workshop,
 * upcoming (soonest first), then past (newest first).
 */
export function mergeServices(
  bookings: ApiBooking[],
  jobs: ApiCustomerJob[],
  vehicles: Vehicle[],
): ServiceRecord[] {
  const byId = new Map(bookings.map((booking) => [booking.id, booking]));
  const fromJobs = jobs.map((job) =>
    jobToService(job, job.bookingId ? byId.get(job.bookingId) : undefined, vehicles),
  );
  const claimed = new Set(jobs.map((job) => job.bookingId).filter(Boolean));
  const fromBookings = bookings
    .filter((booking) => !claimed.has(booking.id) && !booking.serviceJobId)
    .map(bookingToService);
  return [...fromJobs, ...fromBookings].sort((a, b) => {
    const byRank = rank(a) - rank(b);
    if (byRank !== 0) return byRank;
    return rank(a) === 2
      ? a.appointmentAt.localeCompare(b.appointmentAt)
      : b.appointmentAt.localeCompare(a.appointmentAt);
  });
}

export const VAULT_CATEGORIES: { id: ApiVaultCategory; label: string; perVehicle: boolean | null }[] = [
  { id: 'RC', label: 'Registration (RC)', perVehicle: true },
  { id: 'INSURANCE', label: 'Insurance', perVehicle: true },
  { id: 'PUC', label: 'Pollution (PUC)', perVehicle: true },
  { id: 'DRIVING_LICENCE', label: 'Driving licence', perVehicle: false },
  { id: 'INVOICE', label: 'Invoice', perVehicle: null },
  { id: 'WARRANTY', label: 'Warranty', perVehicle: null },
  { id: 'SERVICE_RECORD', label: 'Service record', perVehicle: null },
  { id: 'OTHER', label: 'Other', perVehicle: null },
];

export const vaultCategoryLabel = (category: ApiVaultCategory): string =>
  VAULT_CATEGORIES.find((item) => item.id === category)?.label ?? category;

export const maintenanceStateLabel = (state: MaintenanceItem['state']): string =>
  ({
    OVERDUE: 'Overdue',
    DUE_SOON: 'Due soon',
    UPCOMING: 'Upcoming',
    SNOOZED: 'Snoozed',
    COMPLETED: 'Completed',
  })[state];

export const expiryLabel = (document: VaultDocument): string => {
  if (!document.expiryDate) return 'No expiry date';
  const days = document.daysToExpiry ?? 0;
  if (document.expiryState === 'EXPIRED') {
    return days === 0 ? 'Expired today' : `Expired ${Math.abs(days)} day${Math.abs(days) === 1 ? '' : 's'} ago`;
  }
  if (document.expiryState === 'EXPIRING_SOON') {
    return days === 0 ? 'Expires today' : `Expires in ${days} day${days === 1 ? '' : 's'}`;
  }
  return `Valid until ${formatDate(document.expiryDate)}`;
};

export function formatDate(value: string): string {
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T00:00:00+05:30`) : new Date(value);
  return date.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Kolkata',
  });
}
