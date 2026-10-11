# Booking eligibility regression checks

Run `npm run dev` and open `/tests/booking-eligibility.html` on that Vite server. The page reports five passing scenarios or the failed assertion. It mounts the real route guard, controls profile response timing, and checks DOM identity plus unsaved child state across navigation, refresh failures, retries, stale responses, and ineligibility.

The fixture calls no backend and uses no session/customer data. It is a separate development entry point; the production build still starts from the root `index.html`.

`npm run typecheck` includes this test entry point. Running the assertions requires opening the page in the browser; a production build alone does not run them.


## AF-010 customer conversation

With Vite running, open `/tests/support-conversation.html`. The real support detail component is mounted with controlled API responses, without a backend or customer session. Three scenarios verify stale-version draft preservation/fresh attempts, response-loss replay without duplicates, and committed reply plus failed refresh. The matching operator harness is `support-app/tests/commands.html`. Responsive verification of actual app pages is available from the support app at `/tests/responsive.html?requestId=<local-test-UUID>`.

## AF-001 public timeline

Open `/tests/public-tracking.html` with Vite running. Fifteen real-App/StrictMode scenarios cover anonymous transport and account-event isolation, escaping, stale snapshots/recovery, unavailable-link clearing, token races, polling/visibility, timeout/abort, terminal revalidation, rate limits (including browser restoration and oversized Retry-After), all statuses/malformed data, invalid paths and cleanup. It mocks fetch and timers, saves/restores the development origin's session, and calls no real API. Use a dedicated development origin without concurrent account work. Typecheck covers the entry point; assertions run only when opened in the browser.

`/tests/public-tracking-responsive.html?token=<disposable-local-token>` embeds the real public route at 360/700/1280px for layout/keyboard checks. Keep fixture tokens local. These HTML fixtures are separate development entries, excluded from the production bundle.

## AF-029 marketplace

Open `/tests/marketplace.html` on Vite for fourteen real-component/StrictMode scenarios: the original nine journey/filter recoveries plus PIN context, API-driven local choices, coordinate-only near/far sorts, stale sort URL cleanup and PIN+radius continuity. All API reads are mocked and the booking draft is restored. The PostgreSQL suite covers the real any-service, PIN and distance query and full-area activity availability.

Open `/tests/location.html` for the shared provider/picker checks: fresh-login gate, reload continuity, saved/default Skip, PIN/exact-GPS persistence, denied and late GPS callbacks, account isolation, profile refresh and narrow-toolbar labels. The picker offers PIN lookup and one exact GPS action; manual city input and the extra across-PIN action are absent. City remains supported internally for configured defaults and saved history. It saves/restores origin storage and mocks all network calls. Use a separate development origin (for example `localhost` while the live demo uses `127.0.0.1`) because cross-tab storage events intentionally reset customer state when an account changes. Both fixtures are excluded from the production entry and included in typecheck.

The location fixture has 23 scenarios, including saved PIN resolution, API localities/selection, invalid/unavailable/mismatched/stale PIN handling, PIN-vs-PIN and PIN-vs-GPS races, and exact GPS clearing an earlier PIN from session and profile. GPS requests a fresh high-accuracy position. `/tests/center-gallery.html` adds seven scenarios for cover/dedup/navigation, broken-image recovery, gallery replacement, decorative thumbnail accessibility, safe preview-link nesting and narrow-width layout. Its images use existing licensed local assets; it does not publish them as photos of real centers.
