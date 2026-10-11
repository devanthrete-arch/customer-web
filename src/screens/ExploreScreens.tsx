import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type FormEvent,
} from 'react';
import {
  Link,
  useNavigate,
  useParams,
  useSearchParams,
} from 'react-router-dom';
import { useDomain } from '../domain/DomainProvider';
import type { ApiCenterDetail } from '../domain/api-types';
import { marketplaceApi } from '../domain/client';
import { MenuChoices } from '../components/MenuChoices';
import { MarketplaceImage } from '../components/MarketplaceImage';
import { CenterGallery } from '../components/CenterGallery';
import { servicePhoto } from '../lib/marketplace-imagery';
import { errorMessage } from '../lib/api';
import { getDraft, patchDraft } from '../lib/booking';
import {
  choiceKey,
  exploreApi,
  overlappingChoices,
  selectedServiceIds,
  vehicleTypeLabel,
  type CenterResult,
  type Choice,
  type ServiceDefinition,
} from '../lib/marketplace';
import { formatInr, formatKm } from '../lib/format';
import { PageHeader } from './ui';
import { useDiscoveryLocation } from '../location/DiscoveryLocation';
import {
  applyDiscoveryLocation,
  locationDescription,
} from '../lib/discovery-location';

const firstServices = [
  'Engine oil change',
  'Tyre fitting',
  'Brake inspection',
  'Vehicle wash',
];

export function ExploreScreen({ booking = false }: { booking?: boolean }) {
  const { state } = useDomain();
  const { location, openPicker } = useDiscoveryLocation();
  const [params, setParams] = useSearchParams();
  const vehicleId = booking ? getDraft().vehicleId : params.get('vehicleId');
  const vehicle = state.vehicles.find(
    (v) => v.id === vehicleId && v.status === 'ACTIVE',
  );
  const [definitions, setDefinitions] = useState<ServiceDefinition[]>([]);
  const [availableData, setAvailableData] = useState<{
    key: string;
    items: ServiceDefinition[];
  } | null>(null);
  const [resultData, setResultData] = useState<{
    key: string;
    items: CenterResult[];
  } | null>(null);
  const [next, setNext] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [query, setQuery] = useState(params.get('q') ?? '');
  const [revision, setRevision] = useState(0);
  const [showAllServices, setShowAllServices] = useState(false);
  const [filterNotice, setFilterNotice] = useState('');
  const filterSummaryRef = useRef<HTMLDivElement>(null);
  const paramsRef = useRef(params);
  const serviceIds = selectedServiceIds(params);
  const browseTypes = vehicle?.vehicleType ?? params.get('vehicleType');
  const key = params.toString();
  const areaKey = JSON.stringify(location);
  const availabilityKey = `${areaKey}:${browseTypes ?? ''}`;
  const resultKey = `${key}:${areaKey}:${vehicle?.vehicleType ?? ''}`;
  const availableDefinitions =
    availableData?.key === availabilityKey ? availableData.items : null;
  const results = resultData?.key === resultKey ? resultData.items : null;
  const browseServices = (availableDefinitions ?? [])
    .filter((d) => !browseTypes || d.vehicleTypes.includes(browseTypes))
    .sort((a, b) => {
      const rank = (name: string) => {
        const index = firstServices.indexOf(name);
        return index === -1 ? firstServices.length : index;
      };
      return rank(a.name) - rank(b.name);
    });
  useLayoutEffect(() => {
    paramsRef.current = params;
    if (!location) return;
    const nextParams = applyDiscoveryLocation(params, location);
    const areaChanged = ['city', 'postalCode', 'lat', 'lng', 'radiusMeters'].some(
      (field) => params.get(field) !== nextParams.get(field),
    );
    if (areaChanged || params.get('sort') !== nextParams.get('sort')) {
      nextParams.delete('offset');
      setParams(nextParams, { replace: true });
    }
  }, [key, areaKey]);
  useEffect(() => {
    setQuery(params.get('q') ?? '');
    setFilterNotice('');
  }, [key]);
  useEffect(() => {
    let live = true;
    exploreApi
      .services()
      .then((res) => live && setDefinitions(res.items))
      .catch((e) => live && setError(errorMessage(e)));
    return () => {
      live = false;
    };
  }, [revision]);
  useEffect(() => {
    if (!location) return;
    let live = true;
    setAvailableData(null);
    const queryParams = applyDiscoveryLocation(new URLSearchParams(), location);
    if (browseTypes) queryParams.set('vehicleType', browseTypes);
    exploreApi
      .availableServices(queryParams)
      .then((res) => {
        if (live) setAvailableData({ key: availabilityKey, items: res.items });
      })
      .catch((e) => {
        if (live) setError(errorMessage(e));
      });
    return () => {
      live = false;
    };
  }, [areaKey, browseTypes, revision]);
  useEffect(() => {
    if (!location) return;
    let live = true;
    setResultData(null);
    setError('');
    const queryParams = applyDiscoveryLocation(params, location);
    if (
      ['city', 'postalCode', 'lat', 'lng', 'radiusMeters', 'sort'].some(
        (field) => params.get(field) !== queryParams.get(field),
      )
    )
      queryParams.delete('offset');
    queryParams.delete('vehicleId');
    if (vehicle) queryParams.set('vehicleType', vehicle.vehicleType);
    exploreApi
      .centers(queryParams)
      .then((res) => {
        if (live) {
          setResultData({ key: resultKey, items: res.items });
          setNext(res.nextOffset);
        }
      })
      .catch((e) => live && setError(errorMessage(e)));
    return () => {
      live = false;
    };
  }, [key, areaKey, vehicle?.vehicleType, revision]);
  function change(values: Record<string, string>) {
    const nextParams = new URLSearchParams(paramsRef.current);
    nextParams.delete('offset');
    Object.entries(values).forEach(([k, v]) =>
      v ? nextParams.set(k, v) : nextParams.delete(k),
    );
    setParams(nextParams);
  }
  function toggleService(id: string) {
    const selected = serviceIds.includes(id);
    if (!selected && serviceIds.length >= 10) {
      setFilterNotice(
        'Select up to 10 services. Remove a service to add another.',
      );
      return;
    }
    const nextParams = new URLSearchParams(params);
    nextParams.delete('offset');
    nextParams.delete('serviceId');
    nextParams.delete('serviceIds');
    (selected
      ? serviceIds.filter((value) => value !== id)
      : [...serviceIds, id]
    ).forEach((value) => nextParams.append('serviceIds', value));
    setFilterNotice('');
    setParams(nextParams);
  }
  function removeFilter(action: () => void) {
    filterSummaryRef.current?.focus();
    action();
  }
  const filters = [
    ...serviceIds.map((id) => ({
      key: id,
      label:
        definitions.find((service) => service.id === id)?.name ??
        'Selected service',
      remove: () => toggleService(id),
    })),
    ...(params.get('q')
      ? [
          {
            key: 'q',
            label: `Search: ${params.get('q')}`,
            remove: () => change({ q: '' }),
          },
        ]
      : []),
    ...(!vehicle && params.get('vehicleType')
      ? [
          {
            key: 'vehicleType',
            label: vehicleTypeLabel(params.get('vehicleType')!),
            remove: () => change({ vehicleType: '' }),
          },
        ]
      : []),
    ...(params.get('categoryId')
      ? [
          {
            key: 'categoryId',
            label: 'Selected category',
            remove: () => change({ categoryId: '' }),
          },
        ]
      : []),
    ...(params.get('sort')
      ? [
          {
            key: 'sort',
            label: params.get('sort') === 'nearest' ? 'Nearest first' : params.get('sort') === 'farthest' ? 'Farthest first' : 'Top rated first',
            remove: () => change({ sort: '' }),
          },
        ]
      : []),
  ];
  function search(e: FormEvent) {
    e.preventDefault();
    change({ q: query.trim() });
  }
  return (
    <section className="af-screen af-wide af-explore">
      <PageHeader
        title="Explore services"
        back={booking ? '/services/book/vehicle' : '/home'}
      />
      <p className="af-sub">
        {vehicle
          ? 'Find the work you need and compare centers for your vehicle.'
          : 'Find the work you need, compare centers, then choose your vehicle when you book.'}
      </p>
      {vehicle && (
        <p className="af-note">
          For {vehicle.label} · {vehicle.registrationNumber}
        </p>
      )}
      {!availableDefinitions && !error && (
        <p role="status">Finding services in your area…</p>
      )}
      {availableDefinitions?.length === 0 && (
        <p className="af-note">
          No catalog services are listed in this area for your vehicle type. Try
          another location or search by center name.
        </p>
      )}
      {browseServices.length > 0 && (
        <section
          className="af-service-browser"
          aria-labelledby="browse-services-title"
        >
          <div className="af-market-heading">
            <div>
              <h2 id="browse-services-title">What needs attention?</h2>
              <p>
                Choose one or more services. Find centers that offer any of
                them.
              </p>
            </div>
            {browseServices.length > 4 && (
              <button
                className="af-skip"
                type="button"
                aria-expanded={showAllServices}
                aria-controls="service-photo-options"
                onClick={() => setShowAllServices((value) => !value)}
              >
                {showAllServices
                  ? 'Show fewer services'
                  : `View all ${browseServices.length} services`}
              </button>
            )}
          </div>
          <div className="af-service-photo-options" id="service-photo-options">
            {(showAllServices
              ? browseServices
              : browseServices.slice(0, 4)
            ).map((service) => (
              <button
                type="button"
                className="af-service-photo-option"
                key={service.id}
                aria-label={`${service.name} · ${service.category}`}
                aria-pressed={serviceIds.includes(service.id)}
                onClick={() => toggleService(service.id)}
              >
                <MarketplaceImage
                  photo={servicePhoto({ ...service, vehicleType: browseTypes })}
                />
                <span>{service.name}</span>
                <small>{service.category}</small>
                {serviceIds.includes(service.id) && (
                  <b className="af-service-selected">✓ Selected</b>
                )}
              </button>
            ))}
          </div>
        </section>
      )}
      <div
        className="af-applied-filters"
        ref={filterSummaryRef}
        tabIndex={-1}
        aria-label="Applied filters"
      >
        <p role="status" aria-live="polite">
          {serviceIds.length
            ? serviceIds.length === 1
              ? 'Centers offering your selected service.'
              : `Centers offering any of your ${serviceIds.length} selected services.`
            : filters.length
              ? 'Filters applied to service centers.'
              : 'Choose services or add filters to narrow your search.'}
        </p>
        {filters.length > 0 && (
          <div className="af-filter-chips">
            {filters.map((filter) => (
              <button
                key={filter.key}
                type="button"
                className="af-filter-chip"
                aria-label={`Remove ${filter.label} filter`}
                onClick={() => removeFilter(filter.remove)}
              >
                <span>{filter.label}</span>
                <span aria-hidden="true">×</span>
              </button>
            ))}
          </div>
        )}
        {filterNotice && <p role="alert">{filterNotice}</p>}
        {availableDefinitions &&
          serviceIds.some(
            (id) => !availableDefinitions.some((d) => d.id === id),
          ) && (
            <p className="af-hint">
              Some selected services are not listed in this area for your
              vehicle type. You can keep the other services selected or remove
              their chips.
            </p>
          )}
      </div>
      <form className="af-explore-filters" onSubmit={search}>
        <label className="af-field">
          Search
          <input
            value={query}
            maxLength={100}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Tyre change, brakes, or center name"
          />
        </label>
        <button className="af-btn">Search</button>
      </form>
      <div className="af-explore-filters">
        <label className="af-field">
          Add a service
          <select
            value=""
            onChange={(e) => e.target.value && toggleService(e.target.value)}
          >
            <option value="">Choose services</option>
            {browseServices.map((d) => (
              <option
                value={d.id}
                key={d.id}
                disabled={serviceIds.includes(d.id)}
              >
                {d.category} · {d.name}
              </option>
            ))}
          </select>
        </label>
        {!vehicle && (
          <label className="af-field">
            Vehicle type
            <select
              value={params.get('vehicleType') ?? ''}
              onChange={(e) => change({ vehicleType: e.target.value })}
            >
              <option value="">All vehicle types</option>
              <option value="FOUR_WHEELER">Four-wheeler</option>
              <option value="TWO_WHEELER">Two-wheeler</option>
            </select>
          </label>
        )}
        <label className="af-field">
          Sort centers
          <select value={params.get('sort') ?? ''} onChange={e => change({ sort: e.target.value })}>
            <option value="">{location?.mode === 'COORDINATES' ? 'Nearest first' : 'Center name'}</option>
            <option value="nearest" disabled={location?.mode !== 'COORDINATES'}>Nearest first</option>
            <option value="farthest" disabled={location?.mode !== 'COORDINATES'}>Farthest first</option>
            <option value="top_rated">Top rated first</option>
          </select>
        </label>
        {location?.mode !== 'COORDINATES' && <button className="af-skip" type="button" onClick={openPicker}>Use my location for distance</button>}
        <button
          className="af-skip"
          onClick={() => {
            setQuery('');
            setFilterNotice('');
            const cleared = new URLSearchParams(vehicleId ? { vehicleId } : {});
            setParams(
              location ? applyDiscoveryLocation(cleared, location) : cleared,
            );
          }}
        >
          Clear filters
        </button>
      </div>
      <h2 className="af-center-results-heading">Service centers</h2>
      <p className="af-meta" role="status" aria-live="polite">
        {location ? locationDescription(location) : 'Choose a service location'}
        {serviceIds.length ? ' · Offering any selected service' : ''}
      </p>
      {error && (
        <div role="alert">
          <p>{error}</p>
          <button onClick={() => setRevision((n) => n + 1)}>Retry</button>
        </div>
      )}
      {!results && !error && <p role="status">Finding centers…</p>}
      {results?.length === 0 && (
        <div>
          <p>
            No centers match these filters in this area. Change location or
            remove a service filter.
          </p>
          <button className="af-skip" onClick={openPicker}>
            Change service location
          </button>
        </div>
      )}
      <div className="af-grid-2 af-center-results">
        {results?.map((center) => {
          const context = new URLSearchParams();
          context.set(
            'returnTo',
            `${booking ? '/services/book/center' : '/explore'}?${params}`,
          );
          if (vehicleId) context.set('vehicleId', vehicleId);
          if (params.get('vehicleType'))
            context.set('vehicleType', params.get('vehicleType')!);
          serviceIds.forEach((serviceId) =>
            context.append('serviceIds', serviceId),
          );
          const matchedCount = new Set(
            center.matchingServices
              .map((item) => item.serviceDefinitionId)
              .filter((id) => id && serviceIds.includes(id)),
          ).size;
          return (
            <Link
              key={center.id}
              className="af-center-card"
              to={`/explore/centers/${center.id}?${context}`}
            >
              <CenterGallery centerName={center.displayName} heroImageUrl={center.heroImageUrl} photoUrls={center.photoUrls} supportedVehicleTypes={center.supportedVehicleTypes} variant="preview" />
              <div className="af-center-card-copy">
                <div className="af-market-heading">
                  <h3>{center.displayName}</h3>
                  <span className="af-center-rating">
                    {center.ratingCount > 0 && center.ratingAvg
                      ? `★ ${center.ratingAvg.toFixed(1)} (${center.ratingCount})`
                      : 'No ratings yet'}
                  </span>
                </div>
                <p>{center.formattedAddress}</p>
                {center.distanceMeters !== null && (
                  <p>{formatKm(center.distanceMeters)} · straight-line distance</p>
                )}
                {center.postalCode && <p className="af-meta">PIN {center.postalCode}</p>}
                <p className="af-center-types">
                  {center.supportedVehicleTypes
                    ?.map(vehicleTypeLabel)
                    .join(' · ')}
                </p>
                {serviceIds.length > 0 && (
                  <p className="af-service-coverage">
                    Offers {matchedCount} of {serviceIds.length} selected{' '}
                    {serviceIds.length === 1 ? 'service' : 'services'}
                  </p>
                )}
                <div className="af-center-preview-prices">
                  {center.matchingServices.slice(0, 3).map((item) => (
                    <p key={item.id}>
                      <span>{item.name}</span>
                      <b>
                        {item.priceIsStarting ? 'From ' : ''}
                        {formatInr(Number(item.priceInr))}
                      </b>
                    </p>
                  ))}
                </div>
                <strong>View services & packages →</strong>
              </div>
            </Link>
          );
        })}
      </div>
      <p className="af-market-photo-note">
        Service photos are illustrative. Read each option for its included work.
      </p>
      <div className="af-explore-filters">
        {Number(params.get('offset') ?? 0) > 0 && (
          <button
            onClick={() =>
              change({
                offset: String(
                  Math.max(
                    0,
                    Number(params.get('offset')) -
                      Number(params.get('limit') ?? 20),
                  ),
                ),
              })
            }
          >
            Previous centers
          </button>
        )}
        {next !== null && results && (
          <button onClick={() => change({ offset: String(next) })}>
            More centers
          </button>
        )}
      </div>
    </section>
  );
}
export function ExploreCenterScreen() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const returnTo = params.get('returnTo');
  const back =
    returnTo &&
    (returnTo.startsWith('/explore?') ||
      returnTo.startsWith('/services/book/center?'))
      ? returnTo
      : '/explore';
  const { state } = useDomain();
  const navigate = useNavigate();
  const vehicle = state.vehicles.find(
    (v) => v.id === params.get('vehicleId') && v.status === 'ACTIVE',
  );
  const typeFilter =
    vehicle?.vehicleType ??
    (params.get('vehicleType') === 'FOUR_WHEELER'
      ? 'FOUR_WHEELER'
      : params.get('vehicleType') === 'TWO_WHEELER'
        ? 'TWO_WHEELER'
        : undefined);
  const [center, setCenter] = useState<ApiCenterDetail | null>(null);
  const [menu, setMenu] = useState<Choice[] | null>(null);
  const [picked, setPicked] = useState(new Set<string>());
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [revision, setRevision] = useState(0);
  const [definitions, setDefinitions] = useState<ServiceDefinition[]>([]);
  const serviceIds = selectedServiceIds(params);
  useEffect(() => {
    let live = true;
    exploreApi
      .services()
      .then((res) => live && setDefinitions(res.items))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [revision]);
  useEffect(() => {
    let live = true;
    setCenter(null);
    setMenu(null);
    setPicked(new Set());
    setError('');
    if (id)
      Promise.all([marketplaceApi.center(id), exploreApi.menu(id, typeFilter)])
        .then(([detail, rows]) => {
          if (live) {
            setCenter(detail);
            setMenu(rows);
          }
        })
        .catch((e) => live && setError(errorMessage(e)));
    return () => {
      live = false;
    };
  }, [id, typeFilter, revision]);
  const chosen = (menu ?? []).filter((item) => picked.has(choiceKey(item)));
  const overlaps = overlappingChoices(chosen);
  async function book(describeIssue = false) {
    if (
      !center ||
      !center.bookingEnabled ||
      (!describeIssue && (!chosen.length || chosen.length > 10 || overlaps))
    )
      return;
    setBusy(true);
    setError('');
    try {
      const options = await marketplaceApi.bookingOptions(center.id);
      patchDraft({
        entry: 'MARKETPLACE',
        centerId: center.id,
        centerName: center.displayName,
        centerAutoAccept: options.autoAccept,
        baseEstimateInr: Number(options.modes[0]?.estimateInr ?? 0),
        vehicleId: vehicle?.id,
        vehicleType: vehicle?.vehicleType,
        vehicleLabel: vehicle
          ? `${vehicle.label} · ${vehicle.registrationNumber}`
          : undefined,
        offerings: (describeIssue ? [] : chosen).map((c) => ({
          id: c.id,
          kind: c.kind,
          name: c.name,
          version: c.version,
          scope: c.scope,
          priceInr: Number(c.priceInr),
          priceIsStarting: c.priceIsStarting,
        })),
        slotStart: undefined,
        slotEnd: undefined,
        issueDescription: undefined,
      });
      navigate(vehicle ? '/services/book/services' : '/services/book/vehicle');
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="af-screen af-wide af-explore">
      <PageHeader title={center?.displayName ?? 'Service center'} back={back} />
      {error && (
        <div role="alert">
          <p>{error}</p>
          <button onClick={() => setRevision((n) => n + 1)}>Retry</button>
        </div>
      )}
      {!center && !error && <p role="status">Loading center…</p>}
      {center && (
        <>
          <div className="af-center-overview">
            <CenterGallery centerName={center.displayName} heroImageUrl={center.heroImageUrl} photoUrls={center.photoUrls} supportedVehicleTypes={center.supportedVehicleTypes} />
            <div className="af-center-overview-copy">
              <p className="af-center-types">
                {center.supportedVehicleTypes.map(vehicleTypeLabel).join(' · ')}
              </p>
              <p>{center.formattedAddress}</p>
              {center.postalCode && <p>PIN {center.postalCode}</p>}
              {(center.googleMapsUrl || (center.latitude != null && center.longitude != null)) && <a className="af-skip" href={center.googleMapsUrl || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${center.latitude},${center.longitude}`)}`} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer">Open center in Google Maps ↗</a>}
              <p>{center.about}</p>
              <p className="af-center-rating">
                {center.ratingCount > 0 && center.ratingAvg
                  ? `★ ${center.ratingAvg.toFixed(1)} (${center.ratingCount} ratings)`
                  : 'No ratings yet'}
              </p>
              <p>
                {vehicle
                  ? `For ${vehicle.label}`
                  : 'Choose your vehicle when you book. Compatibility is checked before confirmation.'}
              </p>
              {center.publicPhone && <p>Center phone: {center.publicPhone}</p>}
            </div>
          </div>
          {serviceIds.length > 0 && menu && (
            <section
              className="af-requested-services"
              aria-label="Your requested services"
            >
              <h2>Your requested services</h2>
              <p>Choose the work you want to book from the menu below.</p>
              <ul>
                {serviceIds.map((serviceId) => {
                  const offering = menu.find(
                    (item) =>
                      item.kind === 'SERVICE' &&
                      item.serviceDefinitionId === serviceId,
                  );
                  const name =
                    definitions.find((item) => item.id === serviceId)?.name ??
                    offering?.name ??
                    'Selected service';
                  return (
                    <li key={serviceId}>
                      <span>{name}</span>
                      <strong>
                        {offering
                          ? 'Listed at this center'
                          : typeFilter
                            ? 'Not listed for this vehicle type'
                            : 'Not listed at this center'}
                      </strong>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}
          {menu && (
            <MenuChoices
              menu={menu}
              picked={picked}
              toggle={(key) =>
                setPicked((old) => {
                  const next = new Set(old);
                  if (next.has(key)) next.delete(key);
                  else next.add(key);
                  return next;
                })
              }
            />
          )}
          {menu?.length === 0 && (
            <p>No bookable services for this vehicle are currently listed.</p>
          )}
          {overlaps && (
            <p role="alert">
              A service is included more than once. Remove the overlapping
              selection.
            </p>
          )}
          {chosen.length > 10 && (
            <p role="alert">
              Select up to 10 services or packages for one booking.
            </p>
          )}
          {chosen.length > 0 && (
            <div className="af-total">
              <span>
                {chosen.some((c) => c.priceIsStarting)
                  ? 'Starting estimate'
                  : 'Estimate'}
              </span>
              <b>
                {formatInr(
                  chosen.reduce((sum, c) => sum + Number(c.priceInr), 0),
                )}
              </b>
            </div>
          )}
          <button
            className="af-btn"
            disabled={
              busy ||
              !chosen.length ||
              chosen.length > 10 ||
              overlaps ||
              !center.bookingEnabled
            }
            onClick={() => void book()}
          >
            {busy ? 'Preparing booking…' : 'Book at this center'}
          </button>
          <button
            className="af-skip"
            disabled={busy || !center.bookingEnabled || !menu}
            onClick={() => void book(true)}
          >
            Not sure what you need? Describe an issue instead
          </button>
          {!center.bookingEnabled && (
            <p>This center is not accepting bookings.</p>
          )}
        </>
      )}
    </section>
  );
}
