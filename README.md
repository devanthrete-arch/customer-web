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

With IAM env vars empty, OTP falls through to the local backend session.

## Scripts

```bash
npm run typecheck
npm run build
```
