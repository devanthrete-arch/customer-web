# customer-web

Customer-facing Autoflex web app. The authenticated product routes currently run as an end-to-end **frontend mock product** so product flows can be evaluated before backend contracts are finalized.

Brand tokens follow OS `prefers-color-scheme`; desktop uses a sidebar and mobile uses a bottom navigation bar.

## Run

```bash
cp .env.example .env
npm install
npm run dev
```

App: http://localhost:5173

## Mock demo mode

`/` redirects to `/home` while `AUTH_BYPASS` is enabled. Product data is deterministic on first load and persists under localStorage key `autoflex-customer-mock-v1`.

Use **Profile → Reset demo data** to restore the seed state and clear an in-progress booking draft.

Key demo flows:

- Dashboard: multiple vehicles, attention items, active-service progress, and quick access.
- Vehicles: list → simulated registration lookup/manual entry → confirm/complete → detail/edit/archive.
- Booking: vehicle → type → issue and mock attachment metadata → self drop-off or simulated pickup → center → date/slot → review → local confirmation.
- Services: active/completed list, booking detail, progress timeline, and additional-work approve/decline.
- History: completed services and structured service reports.
- Documents: metadata-only add/list/detail/archive with vehicle, category, and expiry. No cloud upload or download.
- Maintenance: rule-based upcoming/overdue items, detail, local snooze/complete, and booking link.
- Payments: invoice list/detail and explicitly simulated payment success. No payment gateway is called.
- Notifications, profile, addresses, preferences, and support complete the demo.

The existing IAM and HTTP modules remain for later integration, but product demo routes read and write through `src/mock/domain.tsx`.

### Repository seam

`CustomerDomainRepository` defines `load`, `save`, and `reset`. `LocalMockCustomerRepository` is the current adapter, and `MockDomainProvider` exposes typed domain actions to UI screens. A future HTTP repository can implement the same boundary while preserving screen state and validation behavior.

### Backend contracts discovered

Core entities:

- CustomerProfile, Address, Vehicle, VehicleTimelineEvent
- ServiceBooking, ServiceCenter, AppointmentSlot, AttachmentReference
- ServiceRecommendation/WorkItem, CustomerDecision, ServiceStatusEvent, ServiceReport
- VehicleDocument, MaintenanceItem/Reminder
- Invoice, Payment/Transaction
- Notification, SupportRequest

Suggested API groups:

- `/customers/me`, `/customers/me/addresses`, `/customers/me/preferences`
- `/vehicles`, `/vehicles/:id/timeline`
- `/service-centers`, `/service-centers/:id/slots`, `/service-bookings`
- `/service-bookings/:id/events`, `/service-bookings/:id/recommendations/:recommendationId/decision`
- `/service-reports`, `/vehicle-documents`, `/maintenance-items`
- `/invoices`, `/payments`, `/notifications`, `/support-requests`

Async/event flows that need backend ownership:

- booking confirmation and center acceptance
- pickup dispatch and status updates
- inspection evidence and additional-work recommendation
- idempotent, auditable approve/reject decisions
- service progress and final report generation
- finalized invoice creation followed by payment webhook reconciliation
- document storage scan/processing and expiry-reminder generation
- notification delivery and read-state synchronization

### Env

| Variable | Purpose |
|----------|---------|
| `VITE_AUTOFLEX_API_URL` | Autoflex API, e.g. `http://localhost:3001` |
| `VITE_IAM_URL` | Frevels IAM, e.g. `http://localhost:3000` |
| `VITE_IAM_API_KEY` | CustApp DomainApplication public API key (`X-API-Key`) |
| `VITE_IAM_CUSTOMER_DOMAIN_APPLICATION_ID` | CustApp `domainApplicationId` (must match Autoflex `IAM_CUSTOMER_DOMAIN_APPLICATION_ID`) |

## Existing auth integration

India `+91` OTP. Forgot password is not part of this app.

1. `POST {IAM}/api/v1/otp/generate`
2. `POST {IAM}/api/v1/auth/login/otp`
3. If name, phone, or city is missing, `/profile/setup` calls `PUT {AUTOFLEX}/v1/me/profile`

### Paste a test JWT (IAM down)

On **Sign In**, expand **Paste test JWT** and paste an RS256 access token Autoflex will verify. A token with no phone claim still has to enter a mobile number on profile setup.

1. In `autoflex-backend`, mint a customer token and matching JWKS:

```bash
npm run mint:customer-jwt
```

2. Put `LOCAL_JWKS_JSON` and `IAM_CUSTOMER_DOMAIN_APPLICATION_ID` from that output into `autoflex-backend/.env`. Staff tokens keep a **different** `domainApplicationId` (helper default `app-123`).

3. Seed a Bengaluru center: `npm run seed:dev` (Postgres + migrations must already be applied).

4. Paste the printed JWT into customer-web.

`LOCAL_JWKS_JSON` is for tests and offline use. When `IAM_JWKS_URL` is set, Autoflex verifies live IAM keys.

When auth bypass is disabled, the existing landing, OTP, IAM token, and profile-setup modules remain available for later API integration.

## Scripts

```bash
npm run typecheck
npm run build
```
