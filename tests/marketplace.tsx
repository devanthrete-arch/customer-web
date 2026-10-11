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
import {
  exploreApi,
  type CenterResult,
  type Choice,
  type ServiceDefinition,
} from '../src/lib/marketplace';
import { getDraft, patchDraft, clearDraft } from '../src/lib/booking';
import { ExploreCenterScreen, ExploreScreen } from '../src/screens/ExploreScreens';
import { DiscoveryLocationProvider } from '../src/location/DiscoveryLocation';
import type { DiscoveryLocation } from '../src/lib/discovery-location';
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
window.fetch = async () => {
  throw new Error('Unexpected real network access in fixture');
};
const centerId = '10000000-0000-4000-8000-000000000001';
const oilId = '4000000a-0000-4000-8000-000000000001';
const brakeId = '40000000-0000-4000-8000-000000000002';
const carOnlyId = '40000000-0000-4000-8000-000000000003';
const unknownServiceId = '40000000-0000-4000-8000-000000000099';
const definitions: ServiceDefinition[] = [
  {
    id: oilId,
    name: 'Engine oil change',
    description: 'Replace engine oil',
    category: 'Engine',
    aliases: ['Oil change'],
    vehicleTypes: ['TWO_WHEELER', 'FOUR_WHEELER'],
  },
  {
    id: brakeId,
    name: 'Brake inspection',
    description: 'Inspect brakes',
    category: 'Safety',
    aliases: ['Brake checks'],
    vehicleTypes: ['TWO_WHEELER', 'FOUR_WHEELER'],
  },
  {
    id: carOnlyId,
    name: 'Wheel alignment',
    description: 'Align four-wheeler wheels',
    category: 'Wheels',
    aliases: ['Alignment'],
    vehicleTypes: ['FOUR_WHEELER'],
  },
];
let centerResults: CenterResult[] = [];
let serviceMenus: Map<string, Choice[]> | null = null;
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
marketplaceApi.center = async (id) =>
  centerResults.find((center) => center.id === id) ??
  ({
    id: centerId,
    displayName: 'Test center',
    bookingEnabled: true,
    supportedVehicleTypes: ['TWO_WHEELER', 'FOUR_WHEELER'],
    about: 'Test workshop',
  } as ApiCenterDetail);
marketplaceApi.bookingOptions = async () =>
  ({ autoAccept: true, modes: [{ estimateInr: '999.00' }] }) as ApiBookingOptions;
exploreApi.menu = async (id, type) => {
  if (serviceMenus)
    return (serviceMenus.get(id) ?? []).filter(
      (item) => !type || !item.vehicleType || type === item.vehicleType,
    );
  return available && (!type || type === choice.vehicleType) ? [{ ...choice }] : [];
};
exploreApi.services = async () => ({ items: definitions });
let lastAvailableQuery = '';
exploreApi.availableServices = async (params) => {
  lastAvailableQuery = params.toString();
  return {
    items: definitions.filter(
      (definition) =>
        !params.get('vehicleType') || definition.vehicleTypes.includes(params.get('vehicleType')!),
    ),
  };
};
let lastQuery = '';
exploreApi.centers = async (params) => {
  lastQuery = params.toString();
  return { items: centerResults, nextOffset: null };
};
let location = '';
function Probe() {
  location = useLocation().pathname + useLocation().search;
  return null;
}
function check(value: unknown, message: string) {
  if (!value) throw new Error(message);
}
let count = 0;
function pass(message: string) {
  const li = document.createElement('li');
  li.textContent = `PASS: ${message}`;
  results.append(li);
  count++;
}
async function mount(path: string, initialLocation: DiscoveryLocation = {
  mode: 'CITY', city: 'Bengaluru', label: 'Bengaluru',
}) {
  await act(async () => root.unmount());
  root = createRoot(fixture);
  await act(async () =>
    root.render(
      <StrictMode>
        <MemoryRouter initialEntries={[path]}>
          <DomainProvider>
            <DiscoveryLocationProvider
              initialLocation={initialLocation}
              resolvedSession
            >
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
            </DiscoveryLocationProvider>
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
function namedButton(name: string) {
  const item = [...fixture.querySelectorAll('button')].find(
    (b) => b.getAttribute('aria-label') === name,
  );
  if (!item) throw new Error(`Missing button named ${name}`);
  return item;
}
async function clickNamed(name: string) {
  await act(async () => namedButton(name).click());
}
function queryParams() {
  return new URLSearchParams(location.split('?')[1] ?? '');
}
function discoveryDiagnostics() {
  const searchInput = [...fixture.querySelectorAll('label')]
    .find(label => label.firstChild?.textContent?.trim() === 'Search')
    ?.querySelector('input');
  return JSON.stringify({
    route: location,
    centerQuery: lastQuery,
    availableServicesQuery: lastAvailableQuery,
    searchInput: searchInput?.value,
    appliedChips: [...fixture.querySelectorAll('.af-filter-chip')]
      .map(item => item.getAttribute('aria-label')),
  });
}
function selectedIds() {
  const params = queryParams();
  return [...params.getAll('serviceIds'), ...params.getAll('serviceId')];
}
function service(id: string, name: string): Choice {
  return {
    id: `offering-${id}`,
    version: 1,
    serviceDefinitionId: id,
    kind: 'SERVICE',
    name,
    description: 'Parts excluded',
    vehicleType: null,
    priceInr: '499.00',
    priceIsStarting: false,
    durationMinutes: 30,
    categoryName: null,
    scope: [
      {
        offeringId: `offering-${id}`,
        serviceDefinitionId: id,
        name,
        description: 'Parts excluded',
        quantity: 1,
      },
    ],
  };
}
function center(id: string, name: string, services: Choice[]): CenterResult {
  return {
    id,
    displayName: name,
    bookingEnabled: true,
    supportedVehicleTypes: ['TWO_WHEELER', 'FOUR_WHEELER'],
    formattedAddress: 'Bengaluru',
    about: 'Fixture workshop',
    publicPhone: null,
    categories: [],
    ratingCount: 0,
    ratingAvg: null,
    distanceMeters: null,
    matchingServices: services,
  };
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
    location.startsWith('/services/book/center?') && queryParams().get('city') === 'Bengaluru' &&
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

  await mount('/explore');
  check(
    new URLSearchParams(lastQuery).get('city') === 'Bengaluru' &&
      new URLSearchParams(lastAvailableQuery).get('city') === 'Bengaluru',
    'Center results and available service tiles must use the same global location',
  );
  await fill('Search', 'oil');
  check(
    ![...fixture.querySelectorAll('button')].some(
      (item) => item.getAttribute('aria-label') === 'Remove Search: oil filter',
    ),
    'Unsubmitted search text must not appear as an applied filter',
  );
  await click('Search');
  const hasAppliedSearchChip = [...fixture.querySelectorAll('button')].some(
    item => item.getAttribute('aria-label') === 'Remove Search: oil filter',
  );
  check(
    new URLSearchParams(lastQuery).get('city') === 'Bengaluru' &&
      new URLSearchParams(lastQuery).get('q') === 'oil' &&
      queryParams().get('q') === 'oil' &&
      hasAppliedSearchChip,
    `Submitting a search must retain the baseline location and expose its applied chip. ${discoveryDiagnostics()}`,
  );
  await click('Clear filters');
  check(
    !queryParams().has('q') &&
      new URLSearchParams(lastQuery).get('city') === 'Bengaluru' &&
      ![...fixture.querySelectorAll('button')].some(
        (item) => item.getAttribute('aria-label') === 'Remove City: Bengaluru filter',
      ),
    'Clear filters must retain a global location that cannot be removed as a local chip',
  );
  pass(
    'Service discovery shares the global location, exposes only applied search chips, and retains the baseline when filters are cleared.',
  );

  const oil = service(oilId, 'Engine oil change');
  const brakes = service(brakeId, 'Brake inspection');
  const oilCenterId = '10000000-0000-4000-8000-000000000002';
  const brakeCenterId = '10000000-0000-4000-8000-000000000003';
  const bothCenterId = '10000000-0000-4000-8000-000000000004';
  centerResults = [
    center(oilCenterId, 'Oil center', [
      oil,
      { ...oil, id: 'premium-oil', name: 'Premium engine oil change' },
    ]),
    center(brakeCenterId, 'Brake center', [brakes]),
    center(bothCenterId, 'Both services center', [oil, brakes]),
  ];
  serviceMenus = new Map([
    [oilCenterId, [oil]],
    [brakeCenterId, [brakes]],
    [bothCenterId, [oil, brakes]],
  ]);
  await mount('/explore?city=Bengaluru&vehicleType=TWO_WHEELER&offset=40&limit=20');
  await clickNamed('Engine oil change · Engine');
  await clickNamed('Brake inspection · Safety');
  check(
    namedButton('Engine oil change · Engine').getAttribute('aria-pressed') === 'true' &&
      namedButton('Brake inspection · Safety').getAttribute('aria-pressed') === 'true',
    'Selecting a second photo tile must retain the first selection',
  );
  check(
    selectedIds().length === 2 &&
      selectedIds().includes(oilId) &&
      selectedIds().includes(brakeId) &&
      new URLSearchParams(lastQuery).getAll('serviceIds').length === 2,
    'Both service filters must reach the center request',
  );
  check(
    queryParams().get('city') === 'Bengaluru' &&
      queryParams().get('vehicleType') === 'TWO_WHEELER' &&
      !queryParams().has('offset'),
    'Selecting services must retain city/type and restart pagination',
  );
  check(
    namedButton('Remove Engine oil change filter') && namedButton('Remove Brake inspection filter'),
    'Each selected service needs its own removable chip',
  );
  const coverage = [...fixture.querySelectorAll('.af-service-coverage')].map((p) => p.textContent);
  check(
    fixture.querySelectorAll('.af-center-card').length === 3 &&
      coverage.filter((text) => text === 'Offers 1 of 2 selected services').length === 2 &&
      coverage.filter((text) => text === 'Offers 2 of 2 selected services').length === 1,
    'Coverage must count distinct requested services, including centers with one or both services',
  );
  pass(
    'Multiple photo filters remain selected, show individual chips, and identify partial and complete center coverage.',
  );

  const oilCenterLink = [...fixture.querySelectorAll('a')].find(
    (item) => item.querySelector('h3')?.textContent === 'Oil center',
  );
  check(oilCenterLink, 'Missing partial-match center');
  await act(async () => oilCenterLink!.click());
  check(
    selectedIds().includes(oilId) && selectedIds().includes(brakeId),
    'Opening a center must retain both requested services',
  );
  const requested = fixture.querySelector('[aria-label="Your requested services"]');
  check(
    requested?.textContent?.includes('Engine oil changeListed at this center') &&
      requested.textContent?.includes('Brake inspectionNot listed for this vehicle type'),
    'A partial match must explain the listed and missing requested services',
  );
  check(
    [...fixture.querySelectorAll<HTMLInputElement>('input[type=checkbox]')].every(
      (input) => !input.checked,
    ) && button('Book at this center').disabled,
    'Discovery filters must not automatically select booking work',
  );
  const back = fixture.querySelector<HTMLAnchorElement>('a[aria-label="Back"]');
  check(back, 'Missing center back link');
  await act(async () => back!.click());
  check(
    location.startsWith('/explore?') &&
      selectedIds().length === 2 &&
      queryParams().get('city') === 'Bengaluru' &&
      queryParams().get('vehicleType') === 'TWO_WHEELER',
    'Back from a center must restore the complete discovery context',
  );
  pass(
    'Center details preserve both requests, disclose a partial match, require explicit booking selections, and restore filters on return.',
  );

  const savedVehicleId = vehicles[0].id;
  patchDraft({ vehicleId: savedVehicleId, vehicleType: 'TWO_WHEELER' });
  await mount(
    `/explore?serviceId=${oilId.toUpperCase()}&serviceIds=${brakeId}&vehicleId=${savedVehicleId}&city=Bengaluru&offset=40&limit=7&sort=top_rated`,
  );
  check(
    namedButton('Engine oil change · Engine').getAttribute('aria-pressed') === 'true' &&
      ![...fixture.querySelectorAll('label')].some(
        (label) => label.firstChild?.textContent?.trim() === 'Vehicle type',
      ),
    'Legacy service links must resolve while a saved vehicle determines compatibility',
  );
  namedButton('Remove Engine oil change filter').focus();
  await clickNamed('Remove Engine oil change filter');
  check(
    selectedIds().length === 1 &&
      selectedIds()[0] === brakeId &&
      !queryParams().has('serviceId') &&
      queryParams().get('vehicleId') === savedVehicleId &&
      queryParams().get('city') === 'Bengaluru' &&
      queryParams().get('limit') === '7' &&
      queryParams().get('sort') === 'top_rated' &&
      !queryParams().has('offset'),
    'Removing one chip must retain the other service, saved vehicle, city, page size and sort',
  );
  check(
    document.activeElement?.getAttribute('aria-label') === 'Applied filters',
    'Removing a focused control must leave keyboard focus in the filter summary',
  );
  await click('Clear filters');
  check(
    queryParams().get('vehicleId') === savedVehicleId && queryParams().get('city') === 'Bengaluru' &&
      !queryParams().has('serviceIds') && !queryParams().has('sort') &&
      getDraft().vehicleId === savedVehicleId,
    'Clearing discovery filters must retain the saved vehicle and booking draft',
  );
  pass(
    'Removing a chip resets pagination without losing another service or saved-vehicle context; clear-all preserves the vehicle.',
  );

  await mount(
    `/explore?serviceIds=${carOnlyId}&serviceIds=${unknownServiceId}&vehicleType=TWO_WHEELER`,
  );
  check(
    ![...fixture.querySelectorAll('button')].some(
      (item) => item.getAttribute('aria-label') === 'Wheel alignment · Wheels',
    ) &&
      namedButton('Remove Wheel alignment filter') &&
      namedButton('Remove Selected service filter'),
    'Incompatible and unknown selections must stay visible and removable when no photo tile exists',
  );
  check(
    !fixture.textContent?.includes(unknownServiceId),
    'Unknown services must not expose their database identifier as a customer label',
  );
  await clickNamed('Remove Selected service filter');
  check(
    selectedIds().length === 1 &&
      selectedIds()[0] === carOnlyId &&
      queryParams().get('vehicleType') === 'TWO_WHEELER',
    'Removing an unknown service must retain the incompatible service and chosen vehicle type',
  );
  const typeSelect = [...fixture.querySelectorAll('label')]
    .find((label) => label.firstChild?.textContent?.trim() === 'Vehicle type')
    ?.querySelector('select');
  check(
    [...(typeSelect?.options ?? [])].map((option) => option.textContent).join('|') ===
      'All vehicle types|Four-wheeler|Two-wheeler',
    'Vehicle type labels must consistently describe two-wheelers and four-wheelers',
  );
  pass(
    'Unknown and incompatible service filters remain removable, and vehicle labels use two-wheeler and four-wheeler terminology.',
  );

  const pinLocation: DiscoveryLocation = {
    mode: 'PIN', postalCode: '560034', city: 'Bengaluru',
    locality: 'Koramangala', state: 'Karnataka',
    label: 'Koramangala, Bengaluru · 560034',
  };
  await mount(`/explore?city=Pune&lat=18.52&lng=73.85&radiusMeters=5000&sort=top_rated&q=oil&serviceIds=${oilId}&offset=40`, pinLocation);
  check(queryParams().get('postalCode') === '560034' &&
    !queryParams().has('city') && !queryParams().has('lat') &&
    !queryParams().has('lng') && !queryParams().has('radiusMeters') &&
    !queryParams().has('offset') &&
    new URLSearchParams(lastQuery).get('postalCode') === '560034' &&
    new URLSearchParams(lastAvailableQuery).get('postalCode') === '560034' &&
    selectedIds().includes(oilId),
    'PIN selection must replace obsolete URL geography for both center and local service requests while retaining requested work');
  await click('Clear filters');
  check(queryParams().get('postalCode') === '560034' &&
    new URLSearchParams(lastQuery).get('postalCode') === '560034' &&
    !queryParams().has('q') && !queryParams().has('serviceIds') &&
    !queryParams().has('sort'),
    'Clear filters must retain the selected PIN as the discovery baseline');
  pass('PIN discovery synchronizes centers and API service tiles; clearing refinements retains the selected PIN.');

  for (const manualLocation of [pinLocation, {
    mode: 'CITY' as const, city: 'Bengaluru', label: 'Bengaluru',
  }]) {
    const areaQuery = manualLocation.mode === 'PIN' ? 'postalCode=560034' : 'city=Bengaluru';
    await mount(`/explore?${areaQuery}&sort=farthest`, manualLocation);
    const sortSelect = [...fixture.querySelectorAll('label')]
      .find(label => label.firstChild?.textContent?.trim() === 'Sort centers')
      ?.querySelector('select');
    check(sortSelect &&
      [...sortSelect.options].filter(option => ['nearest', 'farthest'].includes(option.value))
        .every(option => option.disabled) &&
      !queryParams().has('sort') &&
      !new URLSearchParams(lastQuery).has('sort') &&
      button('Use my location for distance'),
      'A city or PIN without a geographic origin must disable distance sorts and remove stale distance URL parameters');
  }
  pass('City and PIN discovery never claim distance without coordinates, even when an old URL requests it.');

  const coordinates: DiscoveryLocation = {
    mode: 'COORDINATES', lat: 12.9716, lng: 77.5946,
    radiusMeters: 15000, label: 'Selected location',
  };
  await mount(`/explore?serviceIds=${oilId}&offset=40`, coordinates);
  await fill('Sort centers', 'nearest');
  check(queryParams().get('sort') === 'nearest' &&
    new URLSearchParams(lastQuery).get('sort') === 'nearest' &&
    new URLSearchParams(lastQuery).get('lat') === '12.9716' &&
    new URLSearchParams(lastQuery).get('lng') === '77.5946' &&
    new URLSearchParams(lastQuery).get('radiusMeters') === '15000' &&
    !queryParams().has('offset') &&
    namedButton('Remove Nearest first filter'),
    'Nearest sort must use the actual active geographic origin, retain service choices and reset pagination');
  await fill('Sort centers', 'farthest');
  check(new URLSearchParams(lastQuery).get('sort') === 'farthest' &&
    namedButton('Remove Farthest first filter') &&
    selectedIds().includes(oilId) &&
    !new URLSearchParams(lastAvailableQuery).has('sort'),
    'Farthest sort must reach the center API without altering service availability requests');
  await clickNamed('Remove Farthest first filter');
  check(!queryParams().has('sort') &&
    queryParams().get('lat') === '12.9716' &&
    selectedIds().includes(oilId),
    'Removing distance sort must preserve geographic origin and requested services');
  pass('Nearest and farthest sorts send the real coordinates and remain removable refinements.');

  await mount(`/explore?serviceIds=${brakeId}&sort=farthest`, {
    ...coordinates, postalCode: '560034', label: pinLocation.label,
  });
  check(new URLSearchParams(lastQuery).get('postalCode') === '560034' &&
    new URLSearchParams(lastQuery).get('lat') === '12.9716' &&
    new URLSearchParams(lastQuery).get('sort') === 'farthest' &&
    new URLSearchParams(lastAvailableQuery).get('postalCode') === '560034' &&
    new URLSearchParams(lastAvailableQuery).get('lat') === '12.9716',
    'GPS within a selected PIN must send both constraints to centers and available services');
  await click('Clear filters');
  check(queryParams().get('postalCode') === '560034' &&
    queryParams().get('lat') === '12.9716' &&
    queryParams().get('lng') === '77.5946' &&
    queryParams().get('radiusMeters') === '15000' &&
    !queryParams().has('sort') && !queryParams().has('serviceIds'),
    'Clearing refinements from GPS within a PIN must preserve both geographic constraints');
  pass('Distance search within a PIN applies both constraints and preserves them when refinements are cleared.');

  const previousAvailableServices = exploreApi.availableServices;
  const localApiDefinition: ServiceDefinition = {
    id: '40000000-0000-4000-8000-000000000088',
    name: 'Clutch cable replacement', description: 'Fixture API-only service',
    category: 'Transmission', aliases: [], vehicleTypes: ['TWO_WHEELER'],
  };
  exploreApi.availableServices = async params => {
    lastAvailableQuery = params.toString();
    return { items: [localApiDefinition] };
  };
  await mount('/explore?vehicleType=TWO_WHEELER', pinLocation);
  check(namedButton('Clutch cable replacement · Transmission') &&
    ![...fixture.querySelectorAll('button')].some(item =>
      item.getAttribute('aria-label') === 'Engine oil change · Engine') &&
    new URLSearchParams(lastAvailableQuery).get('postalCode') === '560034',
    'The photo choices must reflect the localized API response rather than a hardcoded global service list');
  await clickNamed('Clutch cable replacement · Transmission');
  check(new URLSearchParams(lastQuery).getAll('serviceIds').includes(localApiDefinition.id) &&
    new URLSearchParams(lastQuery).get('postalCode') === '560034',
    'An API-only local service must be usable as a normal PIN-aware discovery filter');
  exploreApi.availableServices = previousAvailableServices;
  pass('Service photo choices are API-driven, including a new service absent from the global fixture vocabulary.');

  status.textContent = `All ${count} marketplace scenarios passed.`;
} catch (e) {
  status.textContent = `FAILED: ${e instanceof Error ? e.message : e}`;
  console.error(e);
} finally {
  await act(async () => root.unmount());
  Object.assign(customerApi, originals.customer);
  Object.assign(marketplaceApi, originals.marketplace);
  Object.assign(exploreApi, originals.explore);
  window.fetch = oldFetch;
  if (stored === null) clearDraft();
  else sessionStorage.setItem('af_booking_draft', stored);
}
