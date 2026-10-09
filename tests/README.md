# Booking eligibility regression checks

Run `npm run dev` and open `/tests/booking-eligibility.html` on that Vite server. The page reports five passing scenarios or the failed assertion. It mounts the real route guard, controls profile response timing, and checks DOM identity plus unsaved child state across navigation, refresh failures, retries, stale responses, and ineligibility.

The fixture calls no backend and uses no session/customer data. It is a separate development entry point; the production build still starts from the root `index.html`.

`npm run typecheck` includes this test entry point. Running the assertions requires opening the page in the browser; a production build alone does not run them.


## AF-010 customer conversation

With Vite running, open `/tests/support-conversation.html`. The real support detail component is mounted with controlled API responses, without a backend or customer session. Three scenarios verify stale-version draft preservation/fresh attempts, response-loss replay without duplicates, and committed reply plus failed refresh. The matching operator harness is `support-app/tests/commands.html`. Responsive verification of actual app pages is available from the support app at `/tests/responsive.html?requestId=<local-test-UUID>`.
