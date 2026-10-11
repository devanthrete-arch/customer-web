import { ExploreScreen } from './ExploreScreens';
import { MenuChoices } from '../components/MenuChoices';
import { choiceKey, exploreApi, overlappingChoices, type Choice } from '../lib/marketplace';
import { useEffect, useState, type ReactNode } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { useDomain } from '../domain/DomainProvider';
import type { ApiSlotDay, BookingEligibilityCode } from '../domain/api-types';
import {
  BookingEligibilityNotice,
  isBookingEligibilityCode,
} from '../components/BookingEligibility';
import { marketplaceApi } from '../domain/client';
import { ApiError, errorMessage } from '../lib/api';
import { clearDraft, draftEstimate, getDraft, patchDraft, type BookingDraft } from '../lib/booking';
import { formatInr, formatSlot, formatWhen } from '../lib/format';
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
        <Link className="af-btn" to="/vehicles/new?return=booking">
          Add vehicle
        </Link>
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
      <Link className="af-skip" to="/vehicles/new?return=booking">Add another vehicle</Link>
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
            ...(changed ? { slotStart: undefined, slotEnd: undefined } : {}),
          });
          const freshVehicleEntry = params.has('vehicleId') && params.get('resume') !== '1';
          if (freshVehicleEntry)
            patchDraft({
              entry: 'VEHICLE',
              centerId: undefined,
              centerName: undefined,
              offerings: [],
              slotStart: undefined,
              slotEnd: undefined,
            });
          navigate(
            !freshVehicleEntry && previous.entry === 'MARKETPLACE' && previous.centerId
              ? '/services/book/services'
              : '/services/book/center',
          );
        }}
      >
        Continue
      </button>
    </BookingShell>
  );
}

export function BookCenterScreen() {
  return <ExploreScreen booking />;
}

export function BookServicesScreen() {
  const navigate = useNavigate();
  const { draft, redirect } = useDraftGuard(['vehicleId', 'centerId']);
  const [menu, setMenu] = useState<Choice[] | null>(null);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  const [picked, setPicked] = useState<Set<string>>(
    () => new Set((draft.offerings ?? []).map(choiceKey)),
  );
  useEffect(() => {
    if (!draft.centerId || !draft.vehicleType) return;
    let live = true;
    setError('');
    setMenu(null);
    Promise.all([
      marketplaceApi.center(draft.centerId),
      exploreApi.menu(draft.centerId, draft.vehicleType),
    ])
      .then(([center, rows]) => {
        if (!live) return;
        if (!center.bookingEnabled || !center.supportedVehicleTypes.includes(draft.vehicleType!)) {
          setError(
            'This center cannot accept a booking for this vehicle. Choose another vehicle or center.',
          );
          return;
        }
        setMenu(rows);
      })
      .catch((e) => live && setError(errorMessage(e)));
    return () => {
      live = false;
    };
  }, [draft.centerId, draft.vehicleType, revision]);
  if (redirect) return <Navigate to={redirect} replace />;
  const chosen = (menu ?? []).filter((item) => picked.has(choiceKey(item)));
  const missing = menu
    ? (draft.offerings ?? []).filter(
        (item) =>
          picked.has(choiceKey(item)) && !menu.some((m) => choiceKey(m) === choiceKey(item)),
      )
    : [];
  const changed = chosen.some((item) => {
    const old = draft.offerings?.find((o) => choiceKey(o) === choiceKey(item));
    return old && old.version !== item.version;
  });
  const overlap = overlappingChoices(chosen);
  const total =
    chosen.reduce((paise, item) => paise + Math.round(Number(item.priceInr) * 100), 0) / 100;
  function toggle(key: string) {
    setPicked((old) => {
      const next = new Set(old);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  return (
    <BookingShell
      step={3}
      title="Review services & packages"
      subtitle={`${draft.centerName} · ${draft.vehicleLabel}`}
      back={draft.entry === 'MARKETPLACE' ? '/services/book/vehicle' : '/services/book/center'}
    >
      <ErrorText error={error} />
      {error && <button onClick={() => setRevision((n) => n + 1)}>Retry menu</button>}
      {!menu && !error && <p role="status">Checking the current menu for your vehicle…</p>}
      {changed && (
        <p role="status" className="af-note">
          Price or scope changed since you selected this work. Review the details and total below
          before continuing.
        </p>
      )}
      {missing.map((item) => (
        <p role="alert" key={choiceKey(item)}>
          {item.name} is no longer available for this vehicle.{' '}
          <button onClick={() => toggle(choiceKey(item))}>Remove this selection</button>
        </p>
      ))}
      {menu && <MenuChoices menu={menu} picked={picked} toggle={toggle} />}
      {overlap && (
        <p role="alert">
          A service is included more than once. Remove an overlapping service or package.
        </p>
      )}
      {chosen.length ? (
        <div className="af-total">
          <span>{chosen.some((c) => c.priceIsStarting) ? 'Starting estimate' : 'Estimate'}</span>
          <b>{formatInr(total)}</b>
        </div>
      ) : (
        <p>Not sure what you need? Describe the issue on the next step.</p>
      )}
      <button
        className="af-btn"
        disabled={!menu || !!error || !!missing.length || overlap || chosen.length > 10}
        onClick={() => {
          patchDraft({
            offerings: chosen.map((item) => ({
              id: item.id,
              kind: item.kind,
              version: item.version,
              scope: item.scope,
              name: item.name,
              priceInr: Number(item.priceInr),
              priceIsStarting: item.priceIsStarting,
            })),
          });
          navigate('/services/book/issue');
        }}
      >
        {chosen.length ? 'Confirm these selections' : 'Describe the issue'}
      </button>
      <Link className="af-skip" to="/services/book/center">
        Choose another center
      </Link>
      <Link className="af-skip" to="/services/book/vehicle">
        Choose another vehicle
      </Link>
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
      {day && !day.closed && open.length === 0 ? (
        <p className="af-note">No slots left on this day.</p>
      ) : null}
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
  const [eligibilityError, setEligibilityError] = useState<BookingEligibilityCode | null>(null);
  if (bookedId) return <Navigate to={`/services/${bookedId}?booked=1`} replace />;
  if (redirect) return <Navigate to={redirect} replace />;
  if (eligibilityError) {
    return (
      <BookingShell step={6} title="Review your booking" back="/services">
        <BookingEligibilityNotice code={eligibilityError} />
      </BookingShell>
    );
  }
  const offerings = draft.offerings ?? [];
  if (offerings.some((item) => !item.version))
    return <Navigate to="/services/book/services" replace />;
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
      {offerings
        .filter((item) => item.kind === 'PACKAGE')
        .map((item) => (
          <section key={item.id}>
            <h3>{item.name} includes</h3>
            <ul>
              {item.scope?.map((part) => (
                <li key={part.offeringId}>
                  {part.quantity} × {part.name}
                  {part.description ? ` — ${part.description}` : ''}
                </li>
              ))}
            </ul>
          </section>
        ))}
      <p className="af-hint">
        You pay at the center after the work is done. Any extra work needs your approval first.
        {draft.centerAutoAccept === false ? ' The center confirms new bookings, usually within a few hours.' : ''}
      </p>
      <ErrorText error={error} />
      {error && <Link to="/services/book/services">Review current services and prices</Link>}
      <button
        className="af-btn"
        disabled={busy}
        onClick={() =>
          void run(async () => {
            try {
              const id = await createBooking({
                serviceCenterId: draft.centerId!,
                vehicleId: draft.vehicleId!,
                slotStart: draft.slotStart!,
                slotEnd: draft.slotEnd!,
                selections: offerings.map((item) => ({
                  kind: item.kind ?? 'SERVICE',
                  id: item.id,
                  version: item.version!,
                })),
                issueDescription: draft.issueDescription,
              });
              clearDraft();
              setBookedId(id);
            } catch (err) {
              if (err instanceof ApiError && isBookingEligibilityCode(err.code)) {
                setEligibilityError(err.code);
                return;
              }
              throw err;
            }
          })
        }
      >
        {busy ? 'Booking…' : 'Confirm booking'}
      </button>
    </BookingShell>
  );
}
