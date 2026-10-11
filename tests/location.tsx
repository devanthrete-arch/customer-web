import { act, StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import {
  DiscoveryLocationProvider,
  LocationToolbar,
  RequireDiscoveryLocation,
  useDiscoveryLocation,
} from '../src/location/DiscoveryLocation';
import {
  locationApi,
  type DiscoveryLocation,
  type PostalLookup,
} from '../src/lib/discovery-location';
import { type Profile } from '../src/lib/api';
import {
  beginAuthenticatedSession,
  setAccessToken,
  signOut,
} from '../src/lib/session';
import '../src/index.css';

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
const fixture = document.getElementById('fixture')!;
const results = document.getElementById('results')!;
const status = document.getElementById('status')!;
let root = createRoot(fixture);
const originalApi = { ...locationApi };
const originalFetch = window.fetch;
const originalGeolocation = navigator.geolocation.getCurrentPosition;
const storedLocal = Object.entries(localStorage);
const storedSession = Object.entries(sessionStorage);
window.fetch = async () => {
  throw new Error('Unexpected real network access in location fixture');
};

function profileFor(id: string, city: string | null = null): Profile {
  return {
    id,
    displayName: 'Location fixture customer',
    phone: '9876543210',
    dateOfBirth: '1990-01-01',
    selectedPlaceLabel: city,
    city,
    lastLat: null,
    lastLng: null,
  } as Profile;
}
let profile = profileFor('location-fixture-a');
let configuredDefault: DiscoveryLocation | null = null;
let radiusMeters = 25000;
let profileReads = 0;
const savedLocations: DiscoveryLocation[] = [];
const postalRequests: string[] = [];
const fixturePostalAreas: Record<string, PostalLookup['areas']> = {
  '411001': [{ locality: 'Pune fixture area', district: 'Pune', state: 'Maharashtra' }],
  '560001': [{ locality: 'Bengaluru GPO', district: 'Bengaluru', state: 'Karnataka' }],
  '400001': [{ locality: 'Mumbai fixture area', district: 'Mumbai', state: 'Maharashtra' }],
  '600001': [{ locality: 'Chennai fixture area', district: 'Chennai', state: 'Tamil Nadu' }],
  '500001': [{ locality: 'Hyderabad fixture area', district: 'Hyderabad', state: 'Telangana' }],
};
function postalResponse(postalCode: string): PostalLookup {
  return {
    postalCode,
    areas: fixturePostalAreas[postalCode] ?? [
      { locality: 'Koramangala', district: 'Bengaluru', state: 'Karnataka' },
      { locality: 'St Johns', district: 'Bengaluru', state: 'Karnataka' },
    ],
    source: 'fixture-postal-api',
  };
}
const lookupPostal = async (postalCode: string) => {
  postalRequests.push(postalCode);
  return postalResponse(postalCode);
};
locationApi.postal = lookupPostal;
locationApi.profile = async () => {
  profileReads++;
  return { ...profile };
};
locationApi.config = async () => ({
  defaultLocation:
    configuredDefault?.mode === 'CITY' ? configuredDefault : null,
  radiusMeters,
});
locationApi.save = async (location) => {
  savedLocations.push({ ...location });
  profile = {
    ...profile,
    selectedPlaceLabel: location.label,
    city: location.mode !== 'COORDINATES' ? location.city : null,
    state: location.mode === 'PIN' ? location.state : null,
    postalCode: location.mode !== 'CITY' ? location.postalCode ?? null : null,
    lastLat: location.mode === 'COORDINATES' ? location.lat : null,
    lastLng: location.mode === 'COORDINATES' ? location.lng : null,
  } as Profile;
  return { ...profile };
};
const pendingGps: {
  success: PositionCallback;
  error?: PositionErrorCallback | null;
  options?: PositionOptions;
}[] = [];
navigator.geolocation.getCurrentPosition = (success, error, options) => {
  pendingGps.push({ success, error, options });
};
const gpsPosition = {
  coords: {
    latitude: 12.9716,
    longitude: 77.5946,
    accuracy: 20,
    altitude: null,
    altitudeAccuracy: null,
    heading: null,
    speed: null,
  },
  timestamp: Date.now(),
} as GeolocationPosition;
const gpsError: GeolocationPositionError = {
  code: 1,
  message: 'Location denied in fixture',
  PERMISSION_DENIED: 1,
  POSITION_UNAVAILABLE: 2,
  TIMEOUT: 3,
};
const locationState: { current: DiscoveryLocation | null } = { current: null };
let currentResolved = false;
let currentReady = false;
let refreshProfile: () => Promise<unknown> | void;
function Probe() {
  const context = useDiscoveryLocation();
  locationState.current = context.location;
  currentResolved = context.resolved;
  currentReady = context.ready;
  refreshProfile = context.refreshProfile;
  return null;
}
let count = 0;
function check(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}
function pass(message: string) {
  const item = document.createElement('li');
  item.textContent = `PASS: ${message}`;
  results.append(item);
  count++;
}
function body() {
  return fixture.textContent ?? '';
}
function dialog() {
  return fixture.querySelector('[role="dialog"]');
}
function protectedContent() {
  return fixture.querySelector('[data-protected-content]');
}
function button(label: string) {
  const item = [...fixture.querySelectorAll<HTMLButtonElement>('button')].find(
    (element) =>
      element.getAttribute('aria-label') === label ||
      element.textContent?.trim() === label,
  );
  if (!item) throw new Error(`Missing button ${label}: ${body()}`);
  return item;
}
async function click(label: string) {
  await act(async () => button(label).click());
}
async function fill(labelText: string, value: string) {
  const input = [...fixture.querySelectorAll('label')]
    .find((label) => label.firstChild?.textContent?.trim() === labelText)
    ?.querySelector('input,select') as HTMLInputElement | HTMLSelectElement | undefined;
  check(input, `Missing ${labelText} field`);
  await act(async () => {
    Object.getOwnPropertyDescriptor(
      input instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype,
      'value',
    )!.set!.call(input, value);
    input!.dispatchEvent(new Event(input instanceof HTMLSelectElement ? 'change' : 'input', { bubbles: true }));
  });
}
function postalLabel(postalCode: string, areaIndex = 0) {
  const area = postalResponse(postalCode).areas[areaIndex];
  return `${area.locality}, ${area.district} · ${postalCode}`;
}
async function selectPin(postalCode: string, areaIndex = 0) {
  await fill('PIN code', postalCode);
  await click('Look up PIN');
  await fill('Postal area', String(areaIndex));
  await click('Use this postal area');
}
function checkPickerChoices() {
  const fieldLabels = [...fixture.querySelectorAll('label')]
    .map(label => label.firstChild?.textContent?.trim());
  check(fieldLabels.includes('PIN code') && !fieldLabels.includes('City') &&
    button('Use my exact location') &&
    ![...fixture.querySelectorAll('button')].some(item =>
      item.textContent?.trim() === 'Use this city' ||
      item.textContent?.trim() === 'Search nearby across PIN codes'),
    'The picker must offer API PIN selection and one exact GPS action without manual city or an extra GPS path');
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((fulfill) => { resolve = fulfill; });
  return { promise, resolve };
}
async function mount(
  initialLocation?: DiscoveryLocation,
  resolvedSession = false,
) {
  await act(async () => root.unmount());
  root = createRoot(fixture);
  locationState.current = null;
  currentResolved = false;
  currentReady = false;
  await act(async () =>
    root.render(
      <StrictMode>
        <DiscoveryLocationProvider
          initialLocation={initialLocation}
          resolvedSession={resolvedSession}
        >
          <Probe />
          <LocationToolbar />
          <RequireDiscoveryLocation>
            <section data-protected-content>Protected customer content</section>
          </RequireDiscoveryLocation>
        </DiscoveryLocationProvider>
      </StrictMode>,
    ),
  );
}
function takeGps() {
  const request = pendingGps.shift();
  if (!request) throw new Error('Expected an outstanding GPS request');
  return request;
}

try {
  localStorage.clear();
  sessionStorage.clear();
  beginAuthenticatedSession('location-fixture-token-a');
  await mount();
  check(
    currentReady &&
      !currentResolved &&
      dialog() &&
      !protectedContent() &&
      body().includes('Where do you need vehicle service?'),
    `A new authenticated session must request location before showing protected customer content (ready=${currentReady}, resolved=${currentResolved}, dialog=${Boolean(dialog())}, protected=${Boolean(protectedContent())}, text=${body()})`,
  );
  check(
    button('Skip for now').disabled,
    'Skip must not invent a location when there is no history or default',
  );
  checkPickerChoices();
  await selectPin('411001');
  check(
    locationState.current?.mode === 'PIN' &&
      locationState.current.postalCode === '411001' &&
      locationState.current.city === 'Pune' &&
      currentResolved &&
      protectedContent() &&
      !dialog() &&
      savedLocations.length === 1 &&
      savedLocations[0].mode === 'PIN' &&
      savedLocations[0].postalCode === '411001',
    'An API postal area must be persisted once and resolve the entry gate',
  );
  pass(
    'The initial session offers only PIN or exact GPS; selecting an API postal area opens customer content.',
  );

  const readsBeforeRefresh = profileReads;
  await mount();
  check(
    profileReads > readsBeforeRefresh &&
      !dialog() &&
      currentResolved &&
      protectedContent(),
    'A page refresh must retain the resolved location for the same authenticated session',
  );
  await click(`Change location, ${postalLabel('411001')}`);
  check(
    !button('Skip for now').disabled,
    'A saved PIN should make skip available in the picker',
  );
  const savesBeforeSkip = savedLocations.length;
  await click('Skip for now');
  check(
    locationState.current?.mode === 'PIN' &&
      locationState.current.postalCode === '411001' &&
      currentResolved &&
      protectedContent() &&
      savedLocations.length === savesBeforeSkip,
    'Skip should reuse the same customer’s saved location without overwriting the profile',
  );
  pass(
    'Refresh retains the session; reopening the picker can reuse saved location without another profile write.',
  );

  await act(async () =>
    beginAuthenticatedSession('location-fixture-token-a-next-login'),
  );
  check(
    dialog() && !currentResolved,
    'A fresh sign-in must reopen the gate while the provider stays mounted',
  );
  await click('Skip for now');
  await act(async () => setAccessToken('location-fixture-token-a-refreshed'));
  check(
    currentResolved && !dialog(),
    'Routine access-token replacement must not impersonate a fresh login',
  );
  pass(
    'A new login requests location again, while routine token replacement preserves the active choice.',
  );

  await click(`Change location, ${postalLabel('411001')}`);
  await click('Use my exact location');
  const denied = takeGps();
  await act(async () => denied.error?.(gpsError));
  check(
    dialog() &&
      locationState.current?.mode === 'PIN' &&
      locationState.current.postalCode === '411001' &&
      savedLocations.length === savesBeforeSkip,
    'GPS denial must preserve the existing location and keep PIN entry available',
  );
  await selectPin('560001');
  check(
    locationState.current?.mode === 'PIN' &&
      locationState.current.postalCode === '560001' &&
      !dialog(),
    'API PIN selection must recover from GPS denial',
  );
  pass(
    'GPS denial preserves the current choice and recovers through API PIN selection.',
  );

  await click(`Change location, ${postalLabel('560001')}`);
  await click('Use my exact location');
  const latePin = takeGps();
  await selectPin('400001');
  const savedAfterPin = savedLocations.length;
  await act(async () => latePin.success(gpsPosition));
  check(
    locationState.current?.mode === 'PIN' &&
      locationState.current.postalCode === '400001' &&
      savedLocations.length === savedAfterPin &&
      !dialog(),
    'A delayed GPS callback must not replace a later PIN selection',
  );
  pass('A later PIN selection wins over an outstanding GPS lookup.');

  await click(`Change location, ${postalLabel('400001')}`);
  await click('Use my exact location');
  const closedRequest = takeGps();
  await click('Close location picker');
  await act(async () => closedRequest.success(gpsPosition));
  check(
    locationState.current?.mode === 'PIN' &&
      locationState.current.postalCode === '400001' &&
      savedLocations.length === savedAfterPin &&
      !dialog(),
    'Closing a nonblocking picker must invalidate its pending GPS success',
  );
  await click(`Change location, ${postalLabel('400001')}`);
  await click('Use my exact location');
  const closedFailure = takeGps();
  await click('Close location picker');
  await act(async () => closedFailure.error?.(gpsError));
  check(
    !dialog() && !body().includes('Location denied in fixture'),
    'A closed picker must ignore late GPS failure',
  );
  pass(
    'Closing the picker cancels outstanding GPS success and failure callbacks.',
  );

  await click(`Change location, ${postalLabel('400001')}`);
  await click('Use my exact location');
  const exactGps = takeGps();
  check(exactGps.options?.enableHighAccuracy === true &&
    exactGps.options.timeout === 10000 && exactGps.options.maximumAge === 0,
    'Exact GPS must request a fresh high-accuracy browser position');
  await act(async () => exactGps.success(gpsPosition));
  check(
    locationState.current?.mode === 'COORDINATES' &&
      locationState.current.lat === 12.9716 &&
      locationState.current.lng === 77.5946 &&
      locationState.current.radiusMeters === radiusMeters &&
      !locationState.current.postalCode &&
      currentResolved &&
      !dialog(),
    'Accepted GPS must persist exact coordinates and radius without retaining the previously selected PIN',
  );
  const coordinateSaves = savedLocations.length;
  await mount();
  check(
    !dialog() && currentResolved,
    'Reload must retain a resolved coordinate location',
  );
  check(
    locationState.current?.mode === 'COORDINATES' &&
      locationState.current.lat === 12.9716 &&
      locationState.current.radiusMeters === radiusMeters &&
      savedLocations.length === coordinateSaves,
    'Saved coordinates should remain reusable after refresh without another write',
  );
  pass(
    'GPS clears the previous PIN, stores exact coordinates and radius, and refresh reuses them without another write.',
  );

  await act(async () => signOut());
  profile = profileFor('location-fixture-b');
  configuredDefault = null;
  await act(async () => beginAuthenticatedSession('location-fixture-token-b'));
  check(
    dialog() &&
      !currentResolved &&
      !locationState.current &&
      button('Skip for now').disabled,
    'A different customer must not inherit the prior customer’s PIN or coordinates',
  );
  pass(
    'Sign-out and account changes isolate discovery history between customers.',
  );

  configuredDefault = { mode: 'CITY', city: 'Delhi', label: 'Delhi' };
  await mount();
  check(
    !button('Skip for now').disabled && dialog(),
    'A configured platform city should enable an explicit skip',
  );
  checkPickerChoices();
  const savesBeforeDefault = savedLocations.length;
  await click('Skip for now');
  check(
    locationState.current?.mode === 'CITY' &&
      locationState.current.city === 'Delhi' &&
      savedLocations.length === savesBeforeDefault &&
      currentResolved,
    'A configured default should be a session fallback without being written as customer preference',
  );
  pass(
    'Explicit skip may use the configured platform default without changing the customer profile.',
  );

  profile = profileFor('location-fixture-b', 'Jaipur');
  await act(async () => refreshProfile());
  check(
    currentResolved && !dialog(),
    'A profile refresh during active use must not reopen the initial session gate',
  );
  pass(
    'Background profile refresh leaves an already resolved customer session usable.',
  );

  configuredDefault = null;
  profile = {
    ...profileFor('location-fixture-b'),
    selectedPlaceLabel: 'Area text without a structured city',
  };
  await act(async () =>
    beginAuthenticatedSession('location-fixture-label-only'),
  );
  check(
    dialog() && button('Skip for now').disabled,
    'A free-text profile label cannot be treated as a known city',
  );
  pass('A historical place label alone cannot bypass location selection.');

  profile = {
    ...profileFor('location-fixture-b', 'Pune'),
    lastLat: 91,
    lastLng: 77,
  };
  await act(async () =>
    beginAuthenticatedSession('location-fixture-invalid-coordinates'),
  );
  check(
    dialog() && button('Skip for now').disabled,
    'Invalid stored coordinates must not resolve the gate',
  );
  pass(
    'Invalid stored coordinates require a new explicit location instead of fabricated geography.',
  );

  const saveProfile = locationApi.save;
  locationApi.save = async () => {
    throw new Error('Injected persistence failure');
  };
  await selectPin('600001');
  check(
    currentResolved &&
      protectedContent() &&
      locationState.current?.mode === 'PIN' &&
      locationState.current.postalCode === '600001' &&
      body().includes('could not be saved for your next sign-in'),
    'A persistence failure must retain the usable location and explain what was not remembered',
  );
  await mount();
  check(
    currentResolved && !dialog(),
    'The current session remains resolved after an unsuccessful profile save',
  );
  locationApi.save = saveProfile;
  pass(
    'A failed profile write preserves usable session discovery and gives honest persistence feedback.',
  );

  profile = {
    ...profileFor('location-fixture-b', 'Bengaluru'),
    postalCode: '560001',
    state: 'Karnataka',
    selectedPlaceLabel: 'Bengaluru GPO, Bengaluru · 560001',
  };
  await act(async () => beginAuthenticatedSession('location-fixture-stored-pin'));
  check(dialog() && !button('Skip for now').disabled,
    'A stored structured PIN must be offered as history on the next explicit sign-in');
  const savesBeforeStoredPin = savedLocations.length;
  await click('Skip for now');
  check(locationState.current?.mode === 'PIN' &&
    locationState.current.postalCode === '560001' &&
    locationState.current.city === 'Bengaluru' &&
    locationState.current.state === 'Karnataka' &&
    savedLocations.length === savesBeforeStoredPin,
    'Reusing saved PIN history must preserve the postal area without another profile write');
  pass('A saved PIN, district and state can resolve a fresh session through last-used location.');

  await click('Change location, Bengaluru GPO, Bengaluru · 560001');
  await fill('PIN code', '560034');
  await click('Look up PIN');
  check(postalRequests.at(-1) === '560034' &&
    body().includes('Koramangala, Bengaluru, Karnataka') &&
    body().includes('St Johns, Bengaluru, Karnataka') &&
    locationState.current?.mode === 'PIN' && locationState.current.postalCode === '560001',
    'Postal choices must come from the lookup API without replacing the active area before selection');
  await fill('Postal area', '1');
  await click('Use this postal area');
  check(locationState.current?.mode === 'PIN' &&
    locationState.current.postalCode === '560034' &&
    locationState.current.locality === 'St Johns' &&
    locationState.current.city === 'Bengaluru' &&
    locationState.current.state === 'Karnataka' &&
    savedLocations.at(-1)?.mode === 'PIN' &&
    !dialog(),
    'The selected API postal area must persist its district/state/PIN and resolve the picker');
  pass('PIN lookup lists API postal areas and persists the area the customer actually selects.');

  const pinLabel = 'St Johns, Bengaluru · 560034';
  await click(`Change location, ${pinLabel}`);
  await fill('PIN code', '056001');
  const postalReadsBeforeInvalid = postalRequests.length;
  await click('Look up PIN');
  const invalidPin = fixture.querySelector<HTMLInputElement>('input[autocomplete="postal-code"]');
  check(invalidPin && !invalidPin.validity.valid &&
    postalRequests.length === postalReadsBeforeInvalid &&
    locationState.current?.mode === 'PIN' && locationState.current.postalCode === '560034',
    'An invalid six-digit Indian PIN must not call the API or replace the active area');
  pass('Invalid PIN input is blocked before lookup and preserves the customer’s active location.');

  locationApi.postal = async () => { throw new Error('Postal lookup is unavailable in fixture'); };
  await fill('PIN code', '560002');
  await click('Look up PIN');
  check(dialog() && body().includes('Postal lookup is unavailable in fixture') &&
    locationState.current?.mode === 'PIN' && locationState.current.postalCode === '560034' &&
    !body().includes('Use this postal area'),
    'A failed postal lookup must explain the error and preserve the active PIN');
  locationApi.postal = lookupPostal;
  await fill('PIN code', '560034');
  await click('Look up PIN');
  await fill('Postal area', '1');
  await click('Use this postal area');
  check(!dialog() && locationState.current?.mode === 'PIN',
    'The same picker must recover through another successful API lookup');
  pass('Postal API failure preserves the current area and recovers without leaving the picker.');

  await click(`Change location, ${pinLabel}`);
  const staleLookup = deferred<PostalLookup>();
  locationApi.postal = async () => staleLookup.promise;
  await fill('PIN code', '560100');
  await click('Look up PIN');
  check(body().includes('Finding postal areas…'), 'An outstanding PIN lookup must expose its busy state');
  await fill('PIN code', '560101');
  await act(async () => staleLookup.resolve(postalResponse('560100')));
  check(dialog() && !body().includes('Use this postal area') &&
    !body().includes('Finding postal areas…') &&
    locationState.current?.mode === 'PIN' && locationState.current.postalCode === '560034',
    'A response for an edited PIN must be ignored and cannot become a selectable postal area');
  locationApi.postal = lookupPostal;
  await click('Close location picker');
  pass('Editing a PIN invalidates its outstanding API response without changing the active area.');

  await click(`Change location, ${pinLabel}`);
  locationApi.postal = async () => postalResponse('560002');
  await fill('PIN code', '560100');
  await click('Look up PIN');
  check(dialog() && body().includes('No postal areas were returned') &&
    !body().includes('Use this postal area') &&
    locationState.current?.mode === 'PIN' && locationState.current.postalCode === '560034',
    'The client must not expose a provider response for a different PIN as a valid choice');
  locationApi.postal = lookupPostal;
  await click('Close location picker');
  pass('A mismatched postal API response is rejected instead of selecting another PIN.');

  await click(`Change location, ${pinLabel}`);
  const latePostalPin = deferred<PostalLookup>();
  locationApi.postal = async postalCode => postalCode === '560100'
    ? latePostalPin.promise : lookupPostal(postalCode);
  await fill('PIN code', '560100');
  await click('Look up PIN');
  await selectPin('500001');
  const savesAfterPostalPin = savedLocations.length;
  await act(async () => latePostalPin.resolve(postalResponse('560100')));
  check(!dialog() && locationState.current?.mode === 'PIN' &&
    locationState.current.postalCode === '500001' &&
    savedLocations.length === savesAfterPostalPin,
    'A delayed postal lookup must not override a newer API PIN selection');
  locationApi.postal = lookupPostal;
  pass('Choosing another PIN while lookup is pending cancels the older postal result.');

  await click(`Change location, ${postalLabel('500001')}`);
  const closedPostal = deferred<PostalLookup>();
  locationApi.postal = async () => closedPostal.promise;
  await fill('PIN code', '560100');
  await click('Look up PIN');
  await click('Close location picker');
  await act(async () => closedPostal.resolve(postalResponse('560100')));
  check(!dialog() && locationState.current?.mode === 'PIN' &&
    locationState.current.postalCode === '500001' &&
    savedLocations.length === savesAfterPostalPin,
    'A postal response arriving after picker dismissal must not replace the active location');
  locationApi.postal = lookupPostal;
  pass('Dismissing the picker invalidates pending postal responses.');

  await click(`Change location, ${postalLabel('500001')}`);
  await fill('PIN code', '560034');
  await click('Look up PIN');
  await fill('Postal area', '1');
  await click('Use this postal area');
  await click(`Change location, ${pinLabel}`);
  checkPickerChoices();
  const postalBeforeGps = deferred<PostalLookup>();
  locationApi.postal = async () => postalBeforeGps.promise;
  await fill('PIN code', '560100');
  await click('Look up PIN');
  await click('Use my exact location');
  await act(async () => takeGps().success(gpsPosition));
  const pinCoordinateSave = savedLocations.at(-1);
  check(locationState.current?.mode === 'COORDINATES' &&
    !locationState.current.postalCode &&
    locationState.current.label === 'Selected location' &&
    locationState.current.lat === 12.9716 &&
    pinCoordinateSave?.mode === 'COORDINATES' &&
    !pinCoordinateSave.postalCode &&
    profile.postalCode === null && profile.lastLat === 12.9716,
    'Exact GPS must clear the previous PIN in session and profile, preserving the real coordinate origin');
  const savesAfterExactGps = savedLocations.length;
  await act(async () => postalBeforeGps.resolve(postalResponse('560100')));
  check(!dialog() && locationState.current?.mode === 'COORDINATES' &&
    !locationState.current.postalCode && savedLocations.length === savesAfterExactGps,
    'A late postal lookup cannot replace the subsequently selected exact GPS location');
  locationApi.postal = lookupPostal;
  await click(`Change location, Selected location · within ${radiusMeters / 1000} km`);
  checkPickerChoices();
  check(fixture.querySelector<HTMLInputElement>('[autocomplete="postal-code"]')?.value === '',
    'The exact-GPS picker must not prefill a stale PIN');
  await click('Close location picker');
  pass('The single exact GPS action clears the previous PIN; reopening cannot revive its restriction.');

  const longLocation = {
    mode: 'CITY' as const,
    city: 'Greater Bengaluru Metropolitan Region',
    label: 'Greater Bengaluru Metropolitan Region, Karnataka, India',
  };
  await mount(longLocation, true);
  const toolbar = button(`Change location, ${longLocation.label}`);
  for (const width of [360, 390]) {
    fixture.style.width = `${width}px`;
    fixture.style.maxWidth = '100%';
    check(
      fixture.scrollWidth <= fixture.clientWidth + 1 &&
        toolbar.getBoundingClientRect().width <= fixture.clientWidth + 1,
      `The global location toolbar must fit a ${width}px container without horizontal overflow`,
    );
  }
  check(
    toolbar.getAttribute('aria-label')?.includes(longLocation.label),
    'Truncated location text must retain its full accessible name',
  );
  pass(
    'The location toolbar fits narrow containers and keeps long location labels accessible.',
  );
  status.textContent = `All ${count} discovery location scenarios passed.`;
} catch (error) {
  status.textContent = `FAILED: ${error instanceof Error ? error.message : error}`;
  console.error(error);
} finally {
  await act(async () => root.unmount());
  Object.assign(locationApi, originalApi);
  window.fetch = originalFetch;
  navigator.geolocation.getCurrentPosition = originalGeolocation;
  localStorage.clear();
  sessionStorage.clear();
  storedLocal.forEach(([key, value]) => localStorage.setItem(key, value));
  storedSession.forEach(([key, value]) => sessionStorage.setItem(key, value));
}
