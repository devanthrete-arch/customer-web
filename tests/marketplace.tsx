import { act, StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import { DomainProvider } from '../src/domain/DomainProvider';
import { customerApi, marketplaceApi } from '../src/domain/client';
import type {
  ApiProfile,
  ApiGarageVehicle,
  ApiCenterDetail,
  ApiBookingOptions,
} from '../src/domain/api-types';
import { exploreApi, type Choice } from '../src/lib/marketplace';
import { getDraft, patchDraft, clearDraft } from '../src/lib/booking';
import { ExploreCenterScreen, ExploreScreen } from '../src/screens/ExploreScreens';
import {
  BookVehicleScreen,
  BookServicesScreen,
  BookIssueScreen,
} from '../src/screens/BookingScreens';
import { VehicleAddScreen } from '../src/screens/GarageScreens';
import '../src/index.css';
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
const fixture = document.getElementById('fixture')!;
const results = document.getElementById('results')!;
const status = document.getElementById('status')!;
let root = createRoot(fixture);
const stored = sessionStorage.getItem('af_booking_draft');
const originals = {
  customer: { ...customerApi },
  marketplace: { ...marketplaceApi },
  explore: { ...exploreApi },
};
const oldFetch = window.fetch;
const oldLocation = navigator.geolocation.getCurrentPosition;
window.fetch = async () => {
  throw new Error('Unexpected real network access in fixture');
};
const centerId = '10000000-0000-4000-8000-000000000001';
let vehicles: ApiGarageVehicle[] = [];
let choice: Choice = {
  id: '20000000-0000-4000-8000-000000000001',
  version: 1,
  serviceDefinitionId: null,
  kind: 'PACKAGE',
  name: 'Bike checks',
  description: 'Inspection, parts excluded',
  vehicleType: 'TWO_WHEELER',
  priceInr: '450.50',
  priceIsStarting: false,
  durationMinutes: 60,
  categoryName: null,
  scope: [
    {
      offeringId: 'brakes',
      serviceDefinitionId: 'brakes',
      name: 'Brake inspection',
      description: 'Inspect only',
      quantity: 1,
    },
    {
      offeringId: 'battery',
      serviceDefinitionId: 'battery',
      name: 'Battery test',
      description: 'Test only',
      quantity: 1,
    },
  ],
};
let available = true;
customerApi.profile = async () =>
  ({
    id: 'fixture',
    displayName: 'Test customer',
    dateOfBirth: '1990-01-01',
    bookingEligibility: { eligible: true, minimumAge: 18, code: null, message: null },
  }) as ApiProfile;
customerApi.addresses = async () => [];
customerApi.vehicles = async () => [...vehicles];
customerApi.invoices = async () => [];
customerApi.documents = async () => [];
customerApi.archivedDocuments = async () => [];
customerApi.maintenance = async () => [];
customerApi.notifications = async () => ({ items: [], unreadCount: 0 });
customerApi.supportRequests = async () => [];
customerApi.bookings = async () => [];
customerApi.jobs = async () => [];
customerApi.vehicleCatalog = async () => ({ makes: [] });
customerApi.addVehicle = async (input) => {
  const vehicle = {
    ...input,
    id: '30000000-0000-4000-8000-000000000001',
    status: 'ACTIVE',
    variant: null,
    year: null,
    catalogConfigurationId: null,
    currentOdometerKm: null,
    createdAt: new Date().toISOString(),
  } as ApiGarageVehicle;
  vehicles.push(vehicle);
  return vehicle;
};
marketplaceApi.center = async () =>
  ({
    id: centerId,
    displayName: 'Test center',
    bookingEnabled: true,
    supportedVehicleTypes: ['TWO_WHEELER', 'FOUR_WHEELER'],
    about: 'Test workshop',
  }) as ApiCenterDetail;
marketplaceApi.bookingOptions = async () =>
  ({ autoAccept: true, modes: [{ estimateInr: '999.00' }] }) as ApiBookingOptions;
exploreApi.menu = async (_id, type) =>
  available && (!type || type === choice.vehicleType) ? [{ ...choice }] : [];
exploreApi.services = async () => ({ items: [] });
let lastQuery = '';
exploreApi.centers = async (params) => {
  lastQuery = params.toString();
  return { items: [], nextOffset: null };
};
let location = '';
function Probe() {
  location = useLocation().pathname + useLocation().search;
  return null;
}
function check(value: unknown, message: string) {
  if (!value) throw new Error(message);
}
function pass(message: string) {
  const li = document.createElement('li');
  li.textContent = `PASS: ${message}`;
  results.append(li);
}
async function mount(path: string) {
  await act(async () => root.unmount());
  root = createRoot(fixture);
  await act(async () =>
    root.render(
      <StrictMode>
        <MemoryRouter initialEntries={[path]}>
          <DomainProvider>
            <Probe />
            <Routes>
              <Route path="/explore" element={<ExploreScreen />} />
              <Route path="/explore/centers/:id" element={<ExploreCenterScreen />} />
              <Route path="/services/book/vehicle" element={<BookVehicleScreen />} />
              <Route path="/services/book/center" element={<ExploreScreen booking />} />
              <Route path="/services/book/services" element={<BookServicesScreen />} />
              <Route path="/services/book/issue" element={<BookIssueScreen />} />
              <Route path="/vehicles/new" element={<VehicleAddScreen />} />
            </Routes>
          </DomainProvider>
        </MemoryRouter>
      </StrictMode>,
    ),
  );
}
function button(name: string) {
  const item = [...fixture.querySelectorAll('button')].find((b) => b.textContent === name);
  if (!item) throw new Error(`Missing ${name}`);
  return item;
}
async function click(name: string) {
  await act(async () => button(name).click());
}
async function link(name: string) {
  const item = [...fixture.querySelectorAll('a')].find((a) => a.textContent === name);
  check(item, `Missing link ${name}`);
  await act(async () => item!.click());
}
async function fill(label: string, value: string) {
  const element = [...fixture.querySelectorAll('label')]
    .find((l) => l.firstChild?.textContent?.trim() === label)
    ?.querySelector('input,select') as HTMLInputElement | HTMLSelectElement;
  check(element, `Missing field ${label}`);
  await act(async () => {
    Object.getOwnPropertyDescriptor(
      element instanceof HTMLSelectElement
        ? HTMLSelectElement.prototype
        : HTMLInputElement.prototype,
      'value',
    )!.set!.call(element, value);
    element.dispatchEvent(
      new Event(element instanceof HTMLSelectElement ? 'change' : 'input', { bubbles: true }),
    );
  });
}
try {
  clearDraft();
  await mount(`/explore/centers/${centerId}`);
  await act(async () => fixture.querySelector<HTMLInputElement>('input[type=checkbox]')!.click());
  await click('Book at this center');
  check(location === '/services/book/vehicle', 'Vehicle must be requested at booking');
  await link('Add vehicle');
  check(location === '/vehicles/new?return=booking', 'Add flow lost return context');
  await fill('Vehicle type', 'TWO_WHEELER');
  await fill('Registration number', 'KA01XX1234');
  await fill('Make', 'Honda');
  await fill('Model', 'Activa');
  await click('Save vehicle');
  check(location.includes('resume=1'), 'Vehicle save must return to booking');
  check(
    getDraft().centerId === centerId && getDraft().offerings?.[0].id === choice.id,
    'Adding a vehicle lost center/package',
  );
  await click('Continue');
  check(location === '/services/book/services', 'Expected current menu review');
  check(
    fixture.querySelector<HTMLInputElement>('input[type=checkbox]')?.checked,
    'Package selection was not retained',
  );
  pass(
    'No-vehicle discovery, add-vehicle return and package selection survive the complete detour.',
  );

  choice = { ...choice, version: 2, priceInr: '500.25', description: 'Changed scope' };
  await mount('/services/book/services');
  check(
    fixture.textContent?.includes('Price or scope changed'),
    'Changed version needs an explicit review',
  );
  await click('Confirm these selections');
  check(
    getDraft().offerings?.[0].version === 2 && getDraft().offerings?.[0].priceInr === 500.25,
    'Review did not adopt the current offer',
  );
  pass('Changed price/scope is reviewed before the current version enters the booking draft.');

  available = false;
  await mount('/services/book/services');
  check(
    button('Describe the issue').disabled && fixture.textContent?.includes('no longer available'),
    'Removed work must block progression',
  );
  await click('Remove this selection');
  await click('Describe the issue');
  check(
    getDraft().offerings?.length === 0 && location === '/services/book/issue',
    'Explicit removal should recover into the issue path',
  );
  pass('Paused or unavailable work is not silently removed and cannot be submitted.');

  available = true;
  vehicles.push({
    ...vehicles[0],
    id: 'car',
    vehicleType: 'FOUR_WHEELER',
    make: 'Hyundai',
    model: 'i20',
  });
  patchDraft({
    entry: 'MARKETPLACE',
    centerId,
    offerings: [{ ...choice, priceInr: 500.25 }],
    slotStart: '2027-06-15T03:30:00Z',
  });
  await mount('/services/book/vehicle?vehicleId=car');
  await click('Continue');
  check(
    location === '/services/book/center' &&
      !getDraft().centerId &&
      !getDraft().offerings?.length &&
      !getDraft().slotStart,
    'A fresh saved-car journey must discard an unrelated old selection',
  );
  check(
    lastQuery.includes('vehicleType=FOUR_WHEELER'),
    'Vehicle-first listing must filter the saved vehicle type',
  );
  pass('Fresh vehicle-first entry resets unrelated work and filters centers by the saved vehicle.');

  navigator.geolocation.getCurrentPosition = (_success, error) =>
    error?.({
      code: 1,
      message: 'Denied in test',
      PERMISSION_DENIED: 1,
      POSITION_UNAVAILABLE: 2,
      TIMEOUT: 3,
    });
  await mount('/explore');
  await click('Use my location');
  check(
    fixture.textContent?.includes('Search by city instead') && !lastQuery.includes('lat='),
    'Location denial must preserve manual search without inventing coordinates',
  );
  await fill('City', 'Pune');
  await click('Search');
  check(
    lastQuery.includes('city=Pune') && !lastQuery.includes('lat='),
    'Manual city search must recover from denied location',
  );
  pass('Location denial recovers with manual city search and no fabricated coordinates.');
  status.textContent = 'All 5 marketplace scenarios passed.';
} catch (e) {
  status.textContent = `FAILED: ${e instanceof Error ? e.message : e}`;
  console.error(e);
} finally {
  await act(async () => root.unmount());
  Object.assign(customerApi, originals.customer);
  Object.assign(marketplaceApi, originals.marketplace);
  Object.assign(exploreApi, originals.explore);
  window.fetch = oldFetch;
  navigator.geolocation.getCurrentPosition = oldLocation;
  if (stored === null) clearDraft();
  else sessionStorage.setItem('af_booking_draft', stored);
}
