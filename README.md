# customer-web

Customer-facing Autoflex web app. Authenticated routes load profile, vehicles, bookings, jobs, vault, maintenance, invoices, and notifications from `autoflex-backend`.

Brand tokens follow OS `prefers-color-scheme`; desktop uses a sidebar and mobile uses a bottom navigation bar.

## Run

Start the durable workshop (`cd ../autoflex-backend && npm run start:workshop` after Postgres and migrations; see that repo's README), then:

```bash
cp .env.example .env
npm install
npm run dev
```

App: http://localhost:5173

Sign in with any OTP while IAM is unset — that hits `POST /v1/dev/session`. Workshop customers: Priya Sharma `9876543210`, Nikhil Menon `9845123450`, Aisha Khan `9900887766`. `npm run start:memory` in the backend is the throwaway in-memory API on the same port.

## Product surfaces

The app reads live Autoflex data. Bookings and jobs appear as one service list. Approvals, vault, maintenance, support, and pay-at-center UPI come from the API.

`src/domain/DomainProvider.tsx` loads `/v1/me/*`, `/v1/bookings`, and marketplace booking options. Vault file bytes and WhatsApp sends stay local stand-ins.

### Env

| Variable | Purpose |
|----------|---------|
| `VITE_AUTOFLEX_API_URL` | Autoflex API, e.g. `http://localhost:3001` |
| `VITE_IAM_URL` | Frevels IAM, e.g. `http://localhost:3000` |
| `VITE_IAM_API_KEY` | CustApp DomainApplication public API key (`X-API-Key`) |
| `VITE_IAM_CUSTOMER_DOMAIN_APPLICATION_ID` | CustApp `domainApplicationId` (must match Autoflex `IAM_CUSTOMER_DOMAIN_APPLICATION_ID`) |

## Public job timeline (AF-001)

Open `/t/<publicToken>` using a job token from an authorized staff response. The route is anonymous and outside account/profile/booking-age guards. It shows limited recorded status history, masked registration, ETA and safe public center contact. Approval and payment details remain in the authenticated account. Unknown/replaced links clear the snapshot; temporary errors keep it with a stale notice. No migration is required.

[Setup, behavior, verification and production launch gates](../development-documents/architecture/public-job-timeline-runbook.md). The host must support deep-link fallback and tracking-specific headers; shared rate limiting and token-redacted logging are production follow-ups.

## Existing auth integration

India `+91` OTP. Forgot password is not part of this app.

1. `POST {IAM}/api/v1/otp/generate`
2. `POST {IAM}/api/v1/auth/login/otp`
3. If name, phone, or date of birth is missing, `/profile/setup` calls `PUT {AUTOFLEX}/v1/me/profile`.
4. Each fresh sign-in resolves a service location before entering the customer screens. Reload retains that session's choice. The shared top-right selector changes the area everywhere.

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

With IAM env vars empty, OTP falls through to the local backend session.

## Scripts

```bash
npm run typecheck
npm run build
```

## AF-029 catalog and marketplace

The signed-in **Explore** routes support service-first discovery and center details; **My visits** contains existing bookings/jobs. Saved-vehicle entry shares the same marketplace and booking flow. New menu selections require backend migration 0009 and the services import. Browser regression instructions are in `tests/README.md`.

Services can be selected together using independent photo tiles or **Add a service**. Centers offering **any** selected service appear once, with a distinct matched-service count. Applied filters have removable chips; center details disclose requested services that are not listed for the chosen type. Discovery filters do not select paid menu choices. Vehicle type labels use **Two-wheeler** and **Four-wheeler**. This requires the API's repeated `serviceIds` extension; legacy `serviceId` links remain compatible.

Service tiles and center results use the same active city, exact PIN or coordinate radius. **Clear filters** keeps location and saved vehicle. The shared picker offers two ways to choose an area: **Look up PIN** through the API and confirm its postal area, or **Use my exact location** with browser permission. There is no manual city input. Skip uses valid history, then the approved Bengaluru default. Optional backend `DISCOVERY_DEFAULT_CITY`/`DISCOVERY_DEFAULT_LABEL` override it. The app never silently searches all areas.

Nearest/farthest sorting requires GPS coordinates and labels distances as straight-line. **Use my exact location** requests a fresh, high-accuracy browser position and searches within 15 km, clearing any previous PIN restriction. Permission failure leaves PIN lookup and Skip available; there is no continuous tracking. Center cards show multiple photos and detail provides accessible thumbnail/previous/next navigation. Center-owned photos take priority; stock fallbacks are labeled. Maps links open the center’s saved link or coordinate search. Location remains search context, separate from pickup addresses and historical visits. [Delivery and rationale](../development-documents/architecture/af-029-pin-distance-gallery-delivery.md).

[Location behavior and verification](../development-documents/architecture/af-029-location-first-discovery-plan.md). Anonymous tracking remains outside the location/account gates.

[Implemented flow and setup](../development-documents/architecture/service-marketplace-runbook.md).

### Marketplace imagery

Explore includes photo-based service filters, center cover photos, and illustrated service/package choices in both center details and booking review. Photos are presentation only; availability, compatibility, prices and saved booking scope still come from the API.

Center `heroImageUrl` is preferred. Missing or broken center photos fall back to a locally hosted workshop illustration with a visible label. If the fallback also fails, a fixed-size **Photo unavailable** state keeps the choice readable. Service images follow activity names/categories; packages show up to two distinct illustrations of their actual component services. Unknown/custom services use a generic car or bike care image. No new image upload workflow is included.

The ten stock JPEGs are served locally, lazy loaded outside the center detail cover, and reserve their layout space. [Photo sources and license provenance](public/images/marketplace/CREDITS.md).
