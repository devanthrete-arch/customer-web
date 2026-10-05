/** Response shapes from autoflex-backend `/v1` (see api-contracts-v1.md). */

export type ApiProfile = {
  id: string;
  displayName: string | null;
  phone: string | null;
  email: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  selectedPlaceLabel: string | null;
  lastLat: number | null;
  lastLng: number | null;
  preferredChannel: 'WHATSAPP' | 'SMS' | 'EMAIL';
  whatsappConsent: boolean;
  emailConsent: boolean;
  serviceUpdates: boolean;
  maintenanceReminders: boolean;
  documentReminders: boolean;
};

export type ApiAddress = {
  id: string;
  label: string;
  line1: string;
  line2: string | null;
  landmark: string | null;
  city: string;
  state: string | null;
  postalCode: string;
  contactPhone: string | null;
  isDefault: boolean;
};

export type ApiGarageVehicle = {
  id: string;
  vehicleType: 'TWO_WHEELER' | 'FOUR_WHEELER';
  make: string;
  model: string;
  variant: string | null;
  year: number | null;
  registrationNumber: string;
  color: string | null;
  fuel: string | null;
  transmission: string | null;
  currentOdometerKm: number | null;
  purchaseDate: string | null;
  status: 'ACTIVE' | 'ARCHIVED';
  createdAt: string;
};

export type ApiBooking = {
  id: string;
  bookingNumber: string | null;
  status: 'PENDING_CENTER' | 'CONFIRMED' | 'AWAITING_ARRIVAL' | 'CHECKED_IN' | 'NO_SHOW' | 'CANCELLED';
  mode: string;
  estimateInr: string;
  slotStart: string;
  slotEnd: string;
  issueDescription: string | null;
  vehicleId: string;
  serviceCenterId: string;
  vehicleLabel: string;
  registrationNumber: string;
  centerName: string;
  items: { id: string; name: string; priceInr: string; priceIsStarting: boolean }[];
  serviceJobId: string | null;
  confirmedAt: string | null;
  cancelledAt: string | null;
  cancelledBy: 'CUSTOMER' | 'CENTER' | null;
  cancellationReason: string | null;
  createdAt: string;
};

export type ApiJobStatus =
  | 'CHECKED_IN'
  | 'INSPECTION'
  | 'AWAITING_APPROVAL'
  | 'IN_PROGRESS'
  | 'ON_HOLD'
  | 'QUALITY_CHECK'
  | 'READY_FOR_PICKUP'
  | 'COMPLETED'
  | 'CANCELLED';

export type ApiLine = {
  id: string;
  kind: 'LABOUR' | 'PART' | 'FEE';
  description: string;
  partType: 'OEM' | 'OES' | 'LOCAL' | null;
  quantity: number;
  unitPriceInr: string;
  amountInr: string;
  status: 'INCLUDED' | 'PENDING' | 'APPROVED' | 'DECLINED';
  approvalId: string | null;
  partReturnedAt: string | null;
};

export type ApiApproval = {
  id: string;
  version: number;
  status: 'PENDING' | 'APPROVED' | 'PARTIALLY_APPROVED' | 'DECLINED' | 'WITHDRAWN';
  note: string | null;
  totalInr: string;
  requestedAt: string;
  decidedAt: string | null;
  decidedBy: 'CUSTOMER' | 'STAFF' | null;
  decisionChannel: string | null;
  items: ApiLine[];
};

export type ApiTimelineEntry = {
  id: string;
  type: string;
  fromStatus: ApiJobStatus | null;
  toStatus: ApiJobStatus | null;
  payload: Record<string, unknown> | null;
  createdAt: string;
};

export type ApiInvoiceSummary = {
  id: string;
  invoiceNumber: string;
  status: 'DUE' | 'PAID' | 'VOID';
  totalInr: string;
  paidInr: string;
  balanceInr: string;
};

export type ApiCustomerJob = {
  id: string;
  jobNumber: string | null;
  status: ApiJobStatus;
  serviceType: string;
  estimatedReadyAt: string | null;
  expectedResumeAt: string | null;
  center: { id: string; name: string; phone: string | null } | null;
  vehicle: { registrationNumber: string; makeModel: string | null; garageVehicleId: string | null } | null;
  bookingId: string | null;
  customerRequest: string | null;
  odometerKm: number | null;
  holdReason: string | null;
  totals: { includedInr: string; approvedInr: string; pendingInr: string; currentInr: string };
  lineItems: ApiLine[];
  approvals: ApiApproval[];
  pendingApprovalId: string | null;
  timeline: ApiTimelineEntry[];
  finalAmountInr: string | null;
  finalNotes: string | null;
  invoice: ApiInvoiceSummary | null;
  upiVpa: string | null;
  createdAt: string;
  closedAt: string | null;
};

export type ApiCustomerJobSummary = { id: string };

export type ApiInvoice = {
  id: string;
  invoiceNumber: string;
  jobId: string;
  status: 'DUE' | 'PAID' | 'VOID';
  subtotalInr: string;
  adjustmentInr: string;
  taxInr: string;
  totalInr: string;
  paidInr: string;
  balanceInr: string;
  seller: { name: string; gstin: string | null; phone: string | null; address: string | null };
  buyer: { name: string | null; phone: string | null; vehicleRegistration: string | null; vehicleLabel: string | null };
  notes: string | null;
  upiVpa: string | null;
  issuedAt: string;
  paidAt: string | null;
  lineItems: { kind: string; description: string; quantity: number; unitPriceInr: string; amountInr: string }[];
  payments: { id: string; method: string; amountInr: string; reference: string | null; receivedAt: string }[];
};

export type ApiVaultCategory =
  | 'RC'
  | 'INSURANCE'
  | 'PUC'
  | 'DRIVING_LICENCE'
  | 'INVOICE'
  | 'WARRANTY'
  | 'SERVICE_RECORD'
  | 'OTHER';

export type ApiVaultDocument = {
  id: string;
  category: ApiVaultCategory;
  title: string;
  documentNumber: string | null;
  issuer: string | null;
  issueDate: string | null;
  expiryDate: string | null;
  expiryState: 'NONE' | 'VALID' | 'EXPIRING_SOON' | 'EXPIRED';
  daysToExpiry: number | null;
  vehicle: { id: string; registrationNumber: string; label: string } | null;
  file: { fileName: string | null; sizeBytes: number | null; uploadStatus: string } | null;
  verificationStatus: string;
  status: 'ACTIVE' | 'ARCHIVED';
  notes: string | null;
  createdAt: string;
};

export type ApiMaintenanceItem = {
  id: string;
  vehicle: { id: string; registrationNumber: string; label: string; currentOdometerKm: number | null };
  title: string;
  notes: string | null;
  dueDate: string | null;
  dueOdometerKm: number | null;
  intervalMonths: number | null;
  intervalKm: number | null;
  lastCompletedOn: string | null;
  lastCompletedOdometerKm: number | null;
  status: 'UPCOMING' | 'SNOOZED' | 'COMPLETED';
  state: 'OVERDUE' | 'DUE_SOON' | 'UPCOMING' | 'SNOOZED' | 'COMPLETED';
  daysToDue: number | null;
  kmToDue: number | null;
  snoozedUntil: string | null;
};

export type ApiNotification = {
  id: string;
  category: 'SERVICE' | 'APPROVAL' | 'PAYMENT' | 'MAINTENANCE' | 'DOCUMENTS' | 'SUPPORT';
  title: string;
  body: string;
  href: string | null;
  jobId: string | null;
  bookingId: string | null;
  read: boolean;
  createdAt: string;
};

export type ApiSupportCategory = 'BOOKING' | 'SERVICE' | 'PAYMENT' | 'ACCOUNT' | 'APP' | 'OTHER';

export type ApiSupportRequest = {
  id: string;
  referenceNumber: string;
  category: ApiSupportCategory;
  subject: string;
  message: string;
  jobId: string | null;
  bookingId: string | null;
  status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';
  createdAt: string;
};

export type ApiCenterListItem = {
  id: string;
  displayName: string;
  distanceMeters: number;
  formattedAddress: string | null;
  ratingAvg: number | null;
  ratingCount: number;
};

export type ApiCenterDetail = Omit<ApiCenterListItem, 'distanceMeters'> & {
  supportedVehicleTypes: ApiGarageVehicle['vehicleType'][];
  publicPhone: string | null;
  bookingEnabled: boolean;
  about: string;
  categories: { id: string; name: string }[];
};

export type ApiBookingOptions = {
  modes: { id: string; label: string; estimateInr: string }[];
  autoAccept: boolean;
  slotCapacity: number;
};

export type ApiSlotDay = { date: string; closed: boolean; slots: ApiSlot[] };

export type ApiOffering = {
  id: string;
  name: string;
  description: string | null;
  priceInr: string;
  priceIsStarting: boolean;
  durationMinutes: number;
  vehicleType: string | null;
  categoryName: string | null;
};

export type ApiSlot = { start: string; end: string; available: boolean; remaining?: number };
