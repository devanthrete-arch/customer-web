import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useDomain } from '../domain/DomainProvider';
import type { ApiCenterDetail } from '../domain/api-types';
import { marketplaceApi } from '../domain/client';
import { MenuChoices } from '../components/MenuChoices';
import { errorMessage } from '../lib/api';
import { getDraft, patchDraft } from '../lib/booking';
import {
  choiceKey,
  exploreApi,
  overlappingChoices,
  type CenterResult,
  type Choice,
  type ServiceDefinition,
} from '../lib/marketplace';
import { formatInr, formatKm } from '../lib/format';
import { PageHeader } from './ui';

export function ExploreScreen({ booking = false }: { booking?: boolean }) {
  const { state } = useDomain();
  const [params, setParams] = useSearchParams();
  const vehicleId = booking ? getDraft().vehicleId : params.get('vehicleId');
  const vehicle = state.vehicles.find((v) => v.id === vehicleId && v.status === 'ACTIVE');
  const [definitions, setDefinitions] = useState<ServiceDefinition[]>([]);
  const [results, setResults] = useState<CenterResult[] | null>(null);
  const [next, setNext] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [query, setQuery] = useState(params.get('q') ?? '');
  const [city, setCity] = useState(params.get('city') ?? '');
  const [revision, setRevision] = useState(0);
  const key = params.toString();
  useEffect(() => {
    setQuery(params.get('q') ?? '');
    setCity(params.get('city') ?? '');
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
    let live = true;
    setResults(null);
    setError('');
    const queryParams = new URLSearchParams(params);
    queryParams.delete('vehicleId');
    if (vehicle) queryParams.set('vehicleType', vehicle.vehicleType);
    exploreApi
      .centers(queryParams)
      .then((res) => {
        if (live) {
          setResults(res.items);
          setNext(res.nextOffset);
        }
      })
      .catch((e) => live && setError(errorMessage(e)));
    return () => {
      live = false;
    };
  }, [key, vehicle?.vehicleType, revision]);
  function change(values: Record<string, string>) {
    const nextParams = new URLSearchParams(params);
    nextParams.delete('offset');
    Object.entries(values).forEach(([k, v]) => (v ? nextParams.set(k, v) : nextParams.delete(k)));
    setParams(nextParams);
  }
  function search(e: FormEvent) {
    e.preventDefault();
    change({ q: query.trim(), city: city.trim(), lat: '', lng: '' });
  }
  return (
    <section className="af-screen af-wide af-explore">
      <PageHeader title="Explore services" back={booking ? '/services/book/vehicle' : '/home'} />
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
        <label className="af-field">
          City
          <input
            value={city}
            maxLength={100}
            onChange={(e) => setCity(e.target.value)}
            placeholder="All cities"
          />
        </label>
        <button className="af-btn">Search</button>
      </form>
      <div className="af-explore-filters">
        <label className="af-field">
          Service
          <select
            value={params.get('serviceId') ?? ''}
            onChange={(e) => change({ serviceId: e.target.value })}
          >
            <option value="">All services</option>
            {definitions
              .filter((d) => !vehicle || d.vehicleTypes.includes(vehicle.vehicleType))
              .map((d) => (
                <option value={d.id} key={d.id}>
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
              <option value="">Car or bike</option>
              <option value="FOUR_WHEELER">Car</option>
              <option value="TWO_WHEELER">Bike / scooter</option>
            </select>
          </label>
        )}
        <button
          className="af-skip"
          type="button"
          onClick={() => {
            if (!navigator.geolocation) {
              setError('Location is unavailable. Search by city instead.');
              return;
            }
            navigator.geolocation.getCurrentPosition(
              (pos) => {
                setCity('');
                change({
                  lat: String(pos.coords.latitude),
                  lng: String(pos.coords.longitude),
                  city: '',
                });
              },
              () => setError('Location permission was unavailable. Search by city instead.'),
              { timeout: 10000 },
            );
          }}
        >
          Use my location
        </button>
        <button
          className="af-skip"
          onClick={() => {
            setQuery('');
            setCity('');
            setParams(vehicleId ? { vehicleId } : {});
          }}
        >
          Clear filters
        </button>
      </div>
      <p className="af-meta">
        {params.has('lat')
          ? 'Within 15 km of your selected location'
          : params.get('city') || 'All locations'}
        {params.get('serviceId') ? ' · Matching the selected service' : ''}
      </p>
      {error && (
        <div role="alert">
          <p>{error}</p>
          <button onClick={() => setRevision((n) => n + 1)}>Retry</button>
        </div>
      )}
      {!results && !error && <p role="status">Finding centers…</p>}
      {results?.length === 0 && (
        <p>No centers match these filters. Change the city or remove a service filter.</p>
      )}
      <div className="af-grid-2">
        {results?.map((center) => {
          const context = new URLSearchParams();
          context.set('returnTo', `${booking ? '/services/book/center' : '/explore'}?${params}`);
          if (vehicleId) context.set('vehicleId', vehicleId);
          if (params.get('vehicleType')) context.set('vehicleType', params.get('vehicleType')!);
          if (params.get('serviceId')) context.set('serviceId', params.get('serviceId')!);
          return (
            <Link
              key={center.id}
              className="af-service-card"
              to={`/explore/centers/${center.id}?${context}`}
            >
              <h2>{center.displayName}</h2>
              <p>{center.formattedAddress}</p>
              {center.distanceMeters !== null && <p>{formatKm(center.distanceMeters)}</p>}
              <p>
                {center.ratingCount > 0 && center.ratingAvg
                  ? `★ ${center.ratingAvg.toFixed(1)} (${center.ratingCount})`
                  : 'No ratings yet'}
              </p>
              {center.matchingServices.slice(0, 3).map((item) => (
                <p key={item.id}>
                  {item.name} · {item.priceIsStarting ? 'From ' : ''}
                  {formatInr(Number(item.priceInr))}
                </p>
              ))}
              <strong>View services & packages →</strong>
            </Link>
          );
        })}
      </div>
      <div className="af-explore-filters">
        {Number(params.get('offset') ?? 0) > 0 && (
          <button
            onClick={() =>
              change({
                offset: String(Math.max(0, Number(params.get('offset')) - 20)),
              })
            }
          >
            Previous centers
          </button>
        )}
        {next !== null && results && (
          <button onClick={() => change({ offset: String(next) })}>More centers</button>
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
    returnTo && (returnTo.startsWith('/explore?') || returnTo.startsWith('/services/book/center?'))
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
        vehicleLabel: vehicle ? `${vehicle.label} · ${vehicle.registrationNumber}` : undefined,
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
          <p>{center.formattedAddress}</p>
          <p>{center.about}</p>
          <p>
            {vehicle
              ? `For ${vehicle.label}`
              : 'Choose your vehicle when you book. Compatibility is checked before confirmation.'}
          </p>
          {center.publicPhone && <p>Center phone: {center.publicPhone}</p>}
          {params.get('serviceId') && (
            <p className="af-note">
              Your requested service:{' '}
              {menu?.find((m) => m.serviceDefinitionId === params.get('serviceId'))?.name ??
                'Not currently available for this vehicle'}
            </p>
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
          {menu?.length === 0 && <p>No bookable services for this vehicle are currently listed.</p>}
          {overlaps && (
            <p role="alert">
              A service is included more than once. Remove the overlapping selection.
            </p>
          )}
          {chosen.length > 10 && (
            <p role="alert">Select up to 10 services or packages for one booking.</p>
          )}
          {chosen.length > 0 && (
            <div className="af-total">
              <span>
                {chosen.some((c) => c.priceIsStarting) ? 'Starting estimate' : 'Estimate'}
              </span>
              <b>{formatInr(chosen.reduce((sum, c) => sum + Number(c.priceInr), 0))}</b>
            </div>
          )}
          <button
            className="af-btn"
            disabled={
              busy || !chosen.length || chosen.length > 10 || overlaps || !center.bookingEnabled
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
          {!center.bookingEnabled && <p>This center is not accepting bookings.</p>}
        </>
      )}
    </section>
  );
}
