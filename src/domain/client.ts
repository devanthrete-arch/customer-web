import { reserveBooking } from '../lib/booking-attempt';
import { autoflex } from '../lib/api';
import type {
  ApiAddress,
  ApiBooking,
  ApiBookingOptions,
  ApiCenterDetail,
  ApiCenterListItem,
  ApiCustomerJob,
  ApiCustomerJobSummary,
  ApiGarageVehicle,
  ApiVehicleCatalog,
  ApiInvoice,
  ApiMaintenanceItem,
  ApiNotification,
  ApiOffering,
  ApiProfile,
  ApiSlotDay,
  ApiSupportCategory,
  ApiSupportRequest,
  ApiSupportHistory,
  ApiVaultCategory,
  ApiVaultDocument,
} from './api-types';

const get = <T>(path: string) => autoflex<T>(path, {}, true);

const send = <T>(method: 'POST' | 'PUT' | 'PATCH' | 'DELETE', path: string, body?: unknown) =>
  autoflex<T>(
    path,
    { method, body: body === undefined ? undefined : JSON.stringify(body) },
    true,
  );

export type ProfilePatch = Partial<Omit<ApiProfile, 'id' | 'ageYears' | 'bookingEligibility'>>;

export type AddressInput = {
  label: string;
  line1: string;
  line2?: string;
  landmark?: string;
  city: string;
  state?: string;
  postalCode: string;
  contactPhone?: string;
  isDefault?: boolean;
};

export type VehicleInput = {
  vehicleType: ApiGarageVehicle['vehicleType'];
  catalogConfigurationId?: string;
  make?: string;
  model?: string;
  variant?: string;
  year?: number;
  registrationNumber: string;
  color?: string;
  fuel?: string;
  transmission?: string;
  currentOdometerKm?: number;
  purchaseDate?: string;
};

export type BookingInput = {
  serviceCenterId: string;
  vehicleId: string;
  slotStart: string;
  slotEnd: string;
  offeringIds?: string[];
  selections?: { kind: 'SERVICE' | 'PACKAGE'; id: string; version: number }[];
  issueDescription?: string;
};

export type ApprovalDecision = {
  approved?: boolean;
  decisions?: { lineItemId: string; approved: boolean }[];
  acknowledgeNonOemParts?: boolean;
  note?: string;
};

export type DocumentInput = {
  category: ApiVaultCategory;
  vehicleId?: string;
  title: string;
  documentNumber?: string;
  issuer?: string;
  issueDate?: string;
  expiryDate?: string;
  notes?: string;
};

export type MaintenanceInput = {
  vehicleId: string;
  title: string;
  notes?: string;
  dueDate?: string;
  dueOdometerKm?: number;
  intervalMonths?: number;
  intervalKm?: number;
};

export type SupportInput = {
  category: ApiSupportCategory;
  subject: string;
  message: string;
  jobId?: string;
  bookingId?: string;
  preferredChannel?: 'CALL' | 'WHATSAPP' | 'EMAIL';
};

export const customerApi = {
  profile: () => get<ApiProfile>('/v1/me/profile'),
  updateProfile: (patch: ProfilePatch) => send<ApiProfile>('PUT', '/v1/me/profile', patch),

  addresses: () => get<ApiAddress[]>('/v1/me/addresses'),
  addAddress: (input: AddressInput) => send<ApiAddress>('POST', '/v1/me/addresses', input),
  updateAddress: (id: string, patch: Partial<AddressInput>) =>
    send<ApiAddress>('PATCH', `/v1/me/addresses/${id}`, patch),
  removeAddress: (id: string) => send<void>('DELETE', `/v1/me/addresses/${id}`),

  vehicleCatalog: () => get<ApiVehicleCatalog>('/v1/vehicle-catalog'),
  vehicles: () => get<ApiGarageVehicle[]>('/v1/me/vehicles?status=all'),
  addVehicle: (input: VehicleInput) => send<ApiGarageVehicle>('POST', '/v1/me/vehicles', input),
  updateVehicle: (id: string, patch: Partial<VehicleInput>) =>
    send<ApiGarageVehicle>('PATCH', `/v1/me/vehicles/${id}`, patch),
  archiveVehicle: (id: string) => send<ApiGarageVehicle>('POST', `/v1/me/vehicles/${id}/archive`),
  restoreVehicle: (id: string) => send<ApiGarageVehicle>('POST', `/v1/me/vehicles/${id}/restore`),

  bookings: async () => (await get<{ items: ApiBooking[] }>('/v1/bookings')).items,
  createBooking: (input: BookingInput) => reserveBooking(input),
  cancelBooking: (id: string, reason?: string) =>
    send<ApiBooking>('POST', `/v1/bookings/${id}/cancel`, { reason }),

  jobs: () => get<ApiCustomerJobSummary[]>('/v1/me/jobs'),
  job: (id: string) => get<ApiCustomerJob>(`/v1/me/jobs/${id}`),
  decideApproval: (jobId: string, approvalId: string, decision: ApprovalDecision) =>
    send<ApiCustomerJob>('POST', `/v1/me/jobs/${jobId}/approvals/${approvalId}/decision`, decision),

  invoices: () => get<ApiInvoice[]>('/v1/me/invoices'),

  documents: () => get<ApiVaultDocument[]>('/v1/me/documents'),
  archivedDocuments: () => get<ApiVaultDocument[]>('/v1/me/documents?status=ARCHIVED'),
  addDocument: async (input: DocumentInput) =>
    (await send<{ document: ApiVaultDocument }>('POST', '/v1/me/documents', input)).document,
  updateDocument: async (id: string, patch: Partial<DocumentInput>) =>
    (await send<{ document: ApiVaultDocument }>('PATCH', `/v1/me/documents/${id}`, patch)).document,
  archiveDocument: (id: string) => send<ApiVaultDocument>('POST', `/v1/me/documents/${id}/archive`),
  restoreDocument: (id: string) => send<ApiVaultDocument>('POST', `/v1/me/documents/${id}/restore`),

  maintenance: () => get<ApiMaintenanceItem[]>('/v1/me/maintenance?includeCompleted=true'),
  addMaintenance: (input: MaintenanceInput) =>
    send<ApiMaintenanceItem>('POST', '/v1/me/maintenance', input),
  completeMaintenance: (id: string, body: { completedOn?: string; odometerKm?: number }) =>
    send<ApiMaintenanceItem>('POST', `/v1/me/maintenance/${id}/complete`, body),
  snoozeMaintenance: (id: string, until: string) =>
    send<ApiMaintenanceItem>('POST', `/v1/me/maintenance/${id}/snooze`, { until }),
  removeMaintenance: (id: string) => send<void>('DELETE', `/v1/me/maintenance/${id}`),

  notifications: () =>
    get<{ items: ApiNotification[]; unreadCount: number }>('/v1/me/notifications'),
  readNotification: (id: string) => send<ApiNotification>('POST', `/v1/me/notifications/${id}/read`),
  readAllNotifications: () => send<{ updated: number }>('POST', '/v1/me/notifications/read-all'),

  supportRequests: () => get<ApiSupportRequest[]>('/v1/me/support-requests'),
  supportRequest: (id: string) => get<ApiSupportRequest>(`/v1/me/support-requests/${id}`),
  supportHistory: (id: string, beforeVersion?: number) => get<ApiSupportHistory>(`/v1/me/support-requests/${id}/events${beforeVersion ? `?beforeVersion=${beforeVersion}` : ''}`),
  replySupport: (id: string, message: string, version: number, key: string) => autoflex<{requestId: string; version: number; status: ApiSupportRequest['status']; eventId: string}>(`/v1/me/support-requests/${id}/replies`, { method: 'POST', body: JSON.stringify({message}), headers: { 'If-Match': String(version), 'Idempotency-Key': key } }, true),
  createSupportRequest: (input: SupportInput, key?: string) =>
    autoflex<ApiSupportRequest>('/v1/me/support-requests', { method: 'POST', body: JSON.stringify(input), headers: key ? { 'Idempotency-Key': key } : {} }, true),
};

export const marketplaceApi = {
  centers: async (lat: number, lng: number) =>
    (
      await autoflex<{ items: ApiCenterListItem[] }>(
        `/v1/marketplace/centers?lat=${lat}&lng=${lng}&sort=nearest`,
      )
    ).items,
  center: (id: string) => autoflex<ApiCenterDetail>(`/v1/marketplace/centers/${id}`),
  offerings: (centerId: string, vehicleType: string) =>
    autoflex<ApiOffering[]>(
      `/v1/marketplace/centers/${centerId}/offerings?vehicleType=${vehicleType}`,
    ),
  bookingOptions: (centerId: string) =>
    autoflex<ApiBookingOptions>(`/v1/centers/${centerId}/booking-options`),
  validateSelection: (centerId: string, selections: { kind: 'SERVICE' | 'PACKAGE'; id: string; version: number }[], vehicleType?: ApiGarageVehicle['vehicleType']) =>
    autoflex<{ vehicleTypes: ApiGarageVehicle['vehicleType'][] }>(
      `/v1/centers/${centerId}/booking-selection`,
      { method: 'POST', body: JSON.stringify({ selections, ...(vehicleType ? { vehicleType } : {}) }) },
    ),
  slots: (centerId: string, date: string) =>
    autoflex<ApiSlotDay>(`/v1/centers/${centerId}/slots?date=${date}`, { signal: AbortSignal.timeout(15000) }),
};
