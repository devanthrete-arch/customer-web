import { useEffect, useState, type ReactNode } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { useDomain } from '../domain/DomainProvider';
import type { ApiCenterDetail, ApiCenterListItem, ApiOffering, ApiSlotDay } from '../domain/api-types';
import { marketplaceApi } from '../domain/client';
import { errorMessage } from '../lib/api';
import { clearDraft, draftEstimate, getDraft, patchDraft, type BookingDraft } from '../lib/booking';
import { BENGALURU, formatInr, formatKm, formatSlot, formatWhen } from '../lib/format';
import { ErrorText, PageHeader, istToday, useAction } from './ui';

const STEPS = 6;

function BookingShell({
  step,
  title,
  subtitle,
  back,
  children,
}: {
  step: number;
  title: string;
  subtitle?: string;
  back: string;
  children: ReactNode;
}) {
  return (
    <section className="af-screen af-form af-booking">
      <PageHeader title={title} back={back} />
      <p className="af-kicker">
        Booking · Step {step} of {STEPS}
      </p>
      {subtitle ? <p className="af-sub">{subtitle}</p> : null}
      <div className="af-booking-content">{children}</div>
    </section>
  );
}

/** Sends the user back to the first step the draft has not completed. */
function useDraftGuard(required: (keyof BookingDraft)[]): { draft: BookingDraft; redirect: string | null } {
  const draft = getDraft();
  const order: [keyof BookingDraft, string][] = [
    ['vehicleId', '/services/book/vehicle'],
    ['centerId', '/services/book/center'],
    ['slotStart', '/services/book/schedule'],
  ];
  const missing = order.find(([key]) => required.includes(key) && !draft[key]);
  return { draft, redirect: missing ? missing[1] : null };
}

export function BookVehicleScreen() {
  const { state } = useDomain();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const vehicles = state.vehicles.filter((item) => item.status === 'ACTIVE');
  const busyVehicleIds = new Set(
    state.services.filter((item) => item.isActive && item.vehicleId).map((item) => item.vehicleId),
  );
  const [selected, setSelected] = useState(params.get('vehicleId') ?? getDraft().vehicleId ?? vehicles[0]?.id);

  if (vehicles.length === 0) {
    return (
      <BookingShell step={1} title="Which vehicle needs service?" back="/services">
        <p className="af-note">Add a vehicle first. It takes under a minute.</p>
        <Link className="af-btn" to="/vehicles/new">Add vehicle</Link>
      </BookingShell>
    );
  }

  return (
    <BookingShell step={1} title="Which vehicle needs service?" back="/services">
      {vehicles.map((vehicle) => (
        <button
          className={`af-radio ${selected === vehicle.id ? 'on' : ''}`}
          key={vehicle.id}
          onClick={() => setSelected(vehicle.id)}
        >
          <span className="af-dot" />
          <span>
            <strong>{vehicle.label}</strong>
            <span className="af-meta">
              {vehicle.registrationNumber}
              {busyVehicleIds.has(vehicle.id) ? ' · has a service in progress' : ''}
            </span>
          </span>
        </button>
      ))}
      <button
        className="af-btn"
        disabled={!selected}
        onClick={() => {
          const vehicle = vehicles.find((item) => item.id === selected);
          if (!vehicle) return;
          const previous = getDraft();
          const changed = previous.vehicleType !== vehicle.vehicleType;
          patchDraft({
            vehicleId: vehicle.id,
            vehicleLabel: `${vehicle.label} · ${vehicle.registrationNumber}`,
            vehicleType: vehicle.vehicleType,
            ...(changed ? { centerId: undefined, centerName: undefined, offerings: [], slotStart: undefined } : {}),
          });
          navigate('/services/book/center');
        }}
      >
        Continue
      </button>
    </BookingShell>
  );
}

type CenterOption = ApiCenterListItem & Pick<ApiCenterDetail, 'supportedVehicleTypes' | 'bookingEnabled'>;

export function BookCenterScreen() {
  const { state } = useDomain();
  const navigate = useNavigate();
  const { draft, redirect } = useDraftGuard(['vehicleId']);
  const [centers, setCenters] = useState<CenterOption[] | null>(null);
  const [error, setError] = useState('');
  const lat = state.profile.lastLat ?? BENGALURU.lat;
  const lng = state.profile.lastLng ?? BENGALURU.lng;

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const list = await marketplaceApi.centers(lat, lng);
        const details = await Promise.all(list.map((center) => marketplaceApi.center(center.id)));
        if (cancelled) return;
        setCenters(
          list.map((center, index) => ({
            ...center,
            supportedVehicleTypes: details[index].supportedVehicleTypes,
            bookingEnabled: details[index].bookingEnabled,
          })),
        );
      } catch (err) {
        if (!cancelled) setError(errorMessage(err, 'Could not load centers'));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [lat, lng]);

  if (redirect) return <Navigate to={redirect} replace />;
  const usable = (centers ?? []).filter(
    (center) => center.bookingEnabled && draft.vehicleType && center.supportedVehicleTypes.includes(draft.vehicleType),
  );

  return (
    <BookingShell step={2} title="Choose a service center" subtitle={draft.vehicleLabel} back="/services/book/vehicle">
      <ErrorText error={error} />
      {!centers && !error ? <p className="af-hint">Finding centers near you…</p> : null}
      {centers && usable.length === 0 ? (
        <p className="af-note">No center near you services this vehicle type yet.</p>
      ) : null}
      {usable.map((center) => (
        <button
          className={`af-service-card af-button-card ${draft.centerId === center.id ? 'on' : ''}`}
          key={center.id}
          onClick={() => {
            void marketplaceApi
              .bookingOptions(center.id)
              .then((options) => {
                const changed = draft.centerId !== center.id;
                patchDraft({
                  centerId: center.id,
                  centerName: center.displayName,
                  centerAutoAccept: options.autoAccept,
                  baseEstimateInr: Number(options.modes[0]?.estimateInr ?? 0),
                  ...(changed ? { offerings: [], slotStart: undefined, slotEnd: undefined } : {}),
                });
                navigate('/services/book/services');
              })
              .catch((err: unknown) => setError(errorMessage(err)));
          }}
        >
          <h3>{center.displayName}</h3>
          <p>
            {formatKm(center.distanceMeters)}
            {center.formattedAddress ? ` · ${center.formattedAddress}` : ''}
          </p>
          <p className="af-meta">
            {center.ratingAvg ? `★ ${center.ratingAvg.toFixed(1)} (${center.ratingCount})` : 'New on Autoflex'}
          </p>
          <b>Choose →</b>
        </button>
      ))}
    </BookingShell>
  );
}

export function BookServicesScreen() {
  const navigate = useNavigate();
  const { draft, redirect } = useDraftGuard(['vehicleId', 'centerId']);
  const [menu, setMenu] = useState<ApiOffering[] | null>(null);
  const [error, setError] = useState('');
  const [picked, setPicked] = useState<Set<string>>(() => new Set((draft.offerings ?? []).map((item) => item.id)));

  useEffect(() => {
    if (!draft.centerId || !draft.vehicleType) return;
    let cancelled = false;
    marketplaceApi
      .offerings(draft.centerId, draft.vehicleType)
      .then((rows) => !cancelled && setMenu(rows))
      .catch((err: unknown) => !cancelled && setError(errorMessage(err, 'Could not load the service menu')));
    return () => {
      cancelled = true;
    };
  }, [draft.centerId, draft.vehicleType]);

  if (redirect) return <Navigate to={redirect} replace />;
  const chosen = (menu ?? []).filter((item) => picked.has(item.id));
  const total = chosen.reduce((sum, item) => sum + Number(item.priceInr), 0);

  function toggle(id: string) {
    setPicked((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <BookingShell step={3} title="What does it need?" subtitle={draft.centerName} back="/services/book/center">
      <ErrorText error={error} />
      {!menu && !error ? <p className="af-hint">Loading the service menu…</p> : null}
      <div className="af-line-list">
        {(menu ?? []).map((item) => (
          <label className={`af-line ${picked.has(item.id) ? '' : 'off'}`} key={item.id}>
            <input type="checkbox" checked={picked.has(item.id)} onChange={() => toggle(item.id)} />
            <span>
              <b>{item.name}</b>
              <small>
                {[item.categoryName, item.description, `about ${Math.round(item.durationMinutes / 60) || 1} h`]
                  .filter(Boolean)
                  .join(' · ')}
              </small>
            </span>
            <b>
              {item.priceIsStarting ? 'from ' : ''}
              {formatInr(Number(item.priceInr))}
            </b>
          </label>
        ))}
      </div>
      {chosen.length ? (
        <div className="af-total">
          <span>Estimate</span>
          <b>{formatInr(total)}</b>
        </div>
      ) : (
        <p className="af-hint">Not sure? Skip this and describe the problem on the next step.</p>
      )}
      <button
        className="af-btn"
        onClick={() => {
          patchDraft({
            offerings: chosen.map((item) => ({
              id: item.id,
              name: item.name,
              priceInr: Number(item.priceInr),
              priceIsStarting: item.priceIsStarting,
            })),
          });
          navigate('/services/book/issue');
        }}
      >
        {chosen.length ? 'Continue' : 'Skip and describe the issue'}
      </button>
    </BookingShell>
  );
}

export function BookIssueScreen() {
  const navigate = useNavigate();
  const { draft, redirect } = useDraftGuard(['vehicleId', 'centerId']);
  const [issue, setIssue] = useState(draft.issueDescription ?? '');
  if (redirect) return <Navigate to={redirect} replace />;
  const needsIssue = !(draft.offerings ?? []).length;
  return (
    <BookingShell
      step={4}
      title="Tell us what’s happening"
      subtitle="Use your own words. The center will inspect and confirm the work before starting."
      back="/services/book/services"
    >
      <label className="af-field">
        {needsIssue ? 'Issue or request' : 'Anything else? (optional)'}
        <textarea
          value={issue}
          maxLength={2000}
          onChange={(event) => setIssue(event.target.value)}
          placeholder="There is a clicking sound when I turn left…"
        />
      </label>
      <button
        className="af-btn"
        disabled={needsIssue && issue.trim().length < 3}
        onClick={() => {
          patchDraft({ issueDescription: issue.trim() || undefined });
          navigate('/services/book/schedule');
        }}
      >
        Continue
      </button>
    </BookingShell>
  );
}

export function BookScheduleScreen() {
  const navigate = useNavigate();
  const { draft, redirect } = useDraftGuard(['vehicleId', 'centerId']);
  const days = Array.from({ length: 7 }, (_, index) => istToday(index));
  const [date, setDate] = useState(
    draft.slotStart
      ? new Date(draft.slotStart).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
      : days[0],
  );
  const [day, setDay] = useState<ApiSlotDay | null>(null);
  const [slot, setSlot] = useState<{ start: string; end: string } | null>(
    draft.slotStart && draft.slotEnd ? { start: draft.slotStart, end: draft.slotEnd } : null,
  );
  const [error, setError] = useState('');

  useEffect(() => {
    if (!draft.centerId) return;
    let cancelled = false;
    setDay(null);
    marketplaceApi
      .slots(draft.centerId, date)
      .then((result) => !cancelled && setDay(result))
      .catch((err: unknown) => !cancelled && setError(errorMessage(err, 'Could not load slots')));
    return () => {
      cancelled = true;
    };
  }, [draft.centerId, date]);

  if (redirect) return <Navigate to={redirect} replace />;
  const open = (day?.slots ?? []).filter((item) => item.available);

  return (
    <BookingShell step={5} title="Pick a date and slot" subtitle={draft.centerName} back="/services/book/issue">
      <div className="af-days">
        {days.map((value) => {
          const noon = new Date(`${value}T12:00:00+05:30`);
          return (
            <button className={date === value ? 'on' : ''} key={value} onClick={() => setDate(value)}>
              <b>{noon.toLocaleDateString('en-IN', { day: 'numeric', timeZone: 'Asia/Kolkata' })}</b>
              <small>{noon.toLocaleDateString('en-IN', { weekday: 'short', timeZone: 'Asia/Kolkata' })}</small>
            </button>
          );
        })}
      </div>
      <ErrorText error={error} />
      {!day && !error ? <p className="af-hint">Checking availability…</p> : null}
      {day?.closed ? <p className="af-note">The center is closed on this day.</p> : null}
      {day && !day.closed && open.length === 0 ? <p className="af-note">No slots left on this day.</p> : null}
      <div className="af-slots">
        {open.map((item) => (
          <button
            className={`af-slot ${slot?.start === item.start ? 'on' : ''}`}
            key={item.start}
            onClick={() => setSlot({ start: item.start, end: item.end })}
          >
            {formatSlot(item.start)}
            {item.remaining === 1 ? <small> · last one</small> : null}
          </button>
        ))}
      </div>
      <button
        className="af-btn"
        disabled={!slot || !open.some((item) => item.start === slot.start)}
        onClick={() => {
          if (!slot) return;
          patchDraft({ slotStart: slot.start, slotEnd: slot.end });
          navigate('/services/book/review');
        }}
      >
        Review booking
      </button>
    </BookingShell>
  );
}

function Summary({ label, value, edit }: { label: string; value: string; edit: string }) {
  return (
    <div>
      <span>
        <small>{label}</small>
        <b>{value}</b>
      </span>
      <Link to={edit}>Edit</Link>
    </div>
  );
}

export function BookReviewScreen() {
  const { createBooking } = useDomain();
  const { draft, redirect } = useDraftGuard(['vehicleId', 'centerId', 'slotStart']);
  const { busy, error, run } = useAction();
  const [bookedId, setBookedId] = useState<string | null>(null);
  if (bookedId) return <Navigate to={`/services/${bookedId}?booked=1`} replace />;
  if (redirect) return <Navigate to={redirect} replace />;
  const offerings = draft.offerings ?? [];
  const startsFrom = offerings.some((item) => item.priceIsStarting) || offerings.length === 0;

  return (
    <BookingShell step={6} title="Review your booking" back="/services/book/schedule">
      <div className="af-summary-list">
        <Summary label="Vehicle" value={draft.vehicleLabel ?? ''} edit="/services/book/vehicle" />
        <Summary label="Center" value={draft.centerName ?? ''} edit="/services/book/center" />
        <Summary
          label="Services"
          value={offerings.length ? offerings.map((item) => item.name).join(', ') : 'Inspection and diagnosis'}
          edit="/services/book/services"
        />
        <Summary label="Your notes" value={draft.issueDescription || '—'} edit="/services/book/issue" />
        <Summary label="Appointment" value={formatWhen(draft.slotStart!)} edit="/services/book/schedule" />
        <Summary label="Arrival" value="You bring the vehicle to the center" edit="/services/book/center" />
      </div>
      <div className="af-total">
        <span>Estimate{startsFrom ? ' (starting)' : ''}</span>
        <b>{formatInr(draftEstimate(draft))}</b>
      </div>
      <p className="af-hint">
        You pay at the center after the work is done. Any extra work needs your approval first.
        {draft.centerAutoAccept === false ? ' The center confirms new bookings, usually within a few hours.' : ''}
      </p>
      <ErrorText error={error} />
      <button
        className="af-btn"
        disabled={busy}
        onClick={() =>
          void run(async () => {
            const id = await createBooking({
              serviceCenterId: draft.centerId!,
              vehicleId: draft.vehicleId!,
              slotStart: draft.slotStart!,
              slotEnd: draft.slotEnd!,
              offeringIds: offerings.map((item) => item.id),
              issueDescription: draft.issueDescription,
            });
            clearDraft();
            setBookedId(id);
          })
        }
      >
        {busy ? 'Booking…' : 'Confirm booking'}
      </button>
    </BookingShell>
  );
}
