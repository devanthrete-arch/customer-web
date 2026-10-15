import { clearBookingAttempt, readBookingAttempt } from '../lib/booking-attempt';
import { ExploreScreen } from './ExploreScreens';
import { MenuChoices } from '../components/MenuChoices';
import {
  choiceKey,
  exploreApi,
  menuSelections,
  overlappingChoices,
  VEHICLE_TYPES,
  type Choice,
  type VehicleType,
} from '../lib/marketplace';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { useDomain } from '../domain/DomainProvider';
import type { ApiSlotDay, BookingEligibilityCode } from '../domain/api-types';
import {
  BookingEligibilityNotice,
  isBookingEligibilityCode,
} from '../components/BookingEligibility';
import { marketplaceApi } from '../domain/client';
import { ApiError, errorMessage } from '../lib/api';
import {
  clearDraft,
  draftEstimate,
  getDraft,
  marketplaceBack,
  patchDraft,
  selectionDraft,
  type BookingDraft,
} from '../lib/booking';
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
function useDraftGuard(required: (keyof BookingDraft)[]): {
  draft: BookingDraft;
  redirect: string | null;
} {
  const { state } = useDomain();
  const draft = getDraft();
  const order: [keyof BookingDraft, string][] = [
    ['vehicleId', '/services/book/vehicle'],
    ['centerId', '/services/book/center'],
    ['slotStart', '/services/book/schedule'],
  ];
  const vehicle = state.vehicles.find((item) => item.id === draft.vehicleId);
  const invalidVehicle =
    !vehicle || vehicle.status !== 'ACTIVE' || vehicle.vehicleType !== draft.vehicleType;
  const missing = order.find(
    ([key]) => required.includes(key) && (!draft[key] || (key === 'vehicleId' && invalidVehicle)),
  );
  return { draft, redirect: missing ? missing[1] : null };
}

export function BookVehicleScreen() {
  const { state } = useDomain();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const draft = getDraft();
  const freshVehicleEntry = params.has('vehicleId') && params.get('resume') !== '1';
  const [checkedTypes, setCheckedTypes] = useState<VehicleType[] | null>(null);
  const [error, setError] = useState('');
  const [checking, setChecking] = useState(false);
  const [revision, setRevision] = useState(0);
  const needsCheck = !freshVehicleEntry && !!draft.centerId;
  const selectionsKey = JSON.stringify(draft.offerings ?? []);
  useEffect(() => {
    let live = true;
    setCheckedTypes(null);
    setError('');
    setChecking(needsCheck);
    if (needsCheck) {
      Promise.resolve()
        .then(() =>
          marketplaceApi.validateSelection(draft.centerId!, menuSelections(draft.offerings ?? [])),
        )
        .then((result) => {
          if (live) {
            patchDraft({
              compatibleVehicleTypes: result.vehicleTypes,
              requiredVehicleType:
                draft.offerings?.length && result.vehicleTypes.length === 1
                  ? result.vehicleTypes[0]
                  : undefined,
            });
            setCheckedTypes(result.vehicleTypes);
          }
        })
        .catch((e) => {
          if (live) setError(errorMessage(e));
        })
        .finally(() => {
          if (live) setChecking(false);
        });
    }
    return () => {
      live = false;
    };
  }, [needsCheck, draft.centerId, selectionsKey, revision]);
  const allowedTypes = freshVehicleEntry
    ? VEHICLE_TYPES
    : (checkedTypes ??
      draft.compatibleVehicleTypes ??
      (draft.requiredVehicleType ? [draft.requiredVehicleType] : VEHICLE_TYPES));
  const requiredVehicleType = allowedTypes.length === 1 ? allowedTypes[0] : undefined;
  const vehicles = state.vehicles.filter((item) => item.status === 'ACTIVE');
  const compatibleVehicles = vehicles.filter((item) => allowedTypes.includes(item.vehicleType));
  const busyVehicleIds = new Set(
    state.services.filter((item) => item.isActive && item.vehicleId).map((item) => item.vehicleId),
  );
  const [selected, setSelected] = useState(() =>
    compatibleVehicles.some((item) => item.id === params.get('vehicleId'))
      ? params.get('vehicleId')!
      : compatibleVehicles.some((item) => item.id === draft.vehicleId)
        ? draft.vehicleId
        : compatibleVehicles[0]?.id,
  );
  const vehicleIds = compatibleVehicles.map((item) => item.id).join(',');
  const requestedVehicleId = params.get('vehicleId');
  useEffect(() => {
    setSelected((old) =>
      compatibleVehicles.some((item) => item.id === requestedVehicleId)
        ? requestedVehicleId!
        : compatibleVehicles.some((item) => item.id === old)
          ? old
          : compatibleVehicles[0]?.id,
    );
  }, [vehicleIds, requestedVehicleId]);
  const back = freshVehicleEntry ? '/services' : marketplaceBack(draft);

  const validationStatus = (
    <>
      {checking && <p role="status">Checking which vehicles can receive this work…</p>}
      <ErrorText error={error} />
      {error && (
        <>
          <button onClick={() => setRevision((n) => n + 1)}>Check selection again</button>
          <Link to={back}>Review selected work</Link>
        </>
      )}
    </>
  );

  if (compatibleVehicles.length === 0) {
    return (
      <BookingShell step={1} title="Which vehicle needs service?" back={back}>
        {validationStatus}
        {!error && !checking && (
          <p className="af-note">
            {requiredVehicleType
              ? `Add a ${requiredVehicleType === 'TWO_WHEELER' ? 'two-wheeler' : 'four-wheeler'} for the work you selected.`
              : 'Add a vehicle first. It takes under a minute.'}
          </p>
        )}
        {!error && !checking && (
          <Link
            className="af-btn"
            to={`/vehicles/new?return=booking${requiredVehicleType ? `&vehicleType=${requiredVehicleType}` : ''}`}
          >
            Add vehicle
          </Link>
        )}
      </BookingShell>
    );
  }

  return (
    <BookingShell step={1} title="Which vehicle needs service?" back={back}>
      {validationStatus}
      {compatibleVehicles.map((vehicle) => (
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
      <Link
        className="af-skip"
        to={`/vehicles/new?return=booking${requiredVehicleType ? `&vehicleType=${requiredVehicleType}` : ''}`}
      >
        Add another vehicle
      </Link>
      <button
        className="af-btn"
        disabled={
          !selected ||
          checking ||
          !!error ||
          (needsCheck && !checkedTypes) ||
          !compatibleVehicles.some((item) => item.id === selected)
        }
        onClick={() => {
          const vehicle = compatibleVehicles.find((item) => item.id === selected);
          if (!vehicle || checking || error || (needsCheck && !checkedTypes)) return;
          const previous = draft;
          const changed = previous.vehicleType !== vehicle.vehicleType;
          patchDraft({
            vehicleId: vehicle.id,
            vehicleLabel: `${vehicle.label} · ${vehicle.registrationNumber}`,
            vehicleType: vehicle.vehicleType,
            ...(changed ? { slotStart: undefined, slotEnd: undefined } : {}),
          });
          if (freshVehicleEntry)
            patchDraft({
              entry: 'VEHICLE',
              centerId: undefined,
              centerName: undefined,
              marketplaceCenterPath: undefined,
              requiredVehicleType: undefined,
              compatibleVehicleTypes: undefined,
              centerAutoAccept: undefined,
              baseEstimateInr: undefined,
              issueDescription: undefined,
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
  const [busy, setBusy] = useState(false);
  const attempt = useRef(0);
  useEffect(
    () => () => {
      attempt.current += 1;
    },
    [draft.centerId, draft.vehicleId],
  );
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
      {menu && <MenuChoices menu={menu} picked={picked} toggle={toggle} busy={busy} />}
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
        disabled={busy || !menu || !!error || !!missing.length || overlap || chosen.length > 10}
        onClick={async () => {
          if (busy || !menu || error || missing.length || overlap || chosen.length > 10) return;
          setBusy(true);
          const request = ++attempt.current;
          try {
            // Do not narrow the stored cart to the chosen vehicle: shared work can still be moved to another type.
            const checked = await marketplaceApi.validateSelection(
              draft.centerId!,
              menuSelections(chosen),
            );
            if (request !== attempt.current) return;
            if (!draft.vehicleType || !checked.vehicleTypes.includes(draft.vehicleType))
              throw new Error(
                'This work is unavailable for your vehicle. Choose another vehicle or review the menu.',
              );
            patchDraft(selectionDraft(chosen, checked.vehicleTypes));
            navigate('/services/book/issue');
          } catch (e) {
            if (request === attempt.current) setError(errorMessage(e));
          } finally {
            if (request === attempt.current) setBusy(false);
          }
        }}
      >
        {busy
          ? 'Checking selections…'
          : chosen.length
            ? 'Confirm these selections'
            : 'Describe the issue'}
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
  const [refresh, setRefresh] = useState(0);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    const update = () => setRefresh((value) => value + 1);
    window.addEventListener('focus', update);
    const timer = window.setInterval(update, 60000);
    return () => { window.removeEventListener('focus', update); window.clearInterval(timer); };
  }, []);

  useEffect(() => {
    if (!draft.centerId) return;
    let cancelled = false;
    setDay(null);
    setLoading(true);
    setError('');
    marketplaceApi
      .slots(draft.centerId, date)
      .then((result) => !cancelled && setDay(result))
      .catch((err: unknown) => !cancelled && setError(errorMessage(err, 'Could not load slots')))
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => {
      cancelled = true;
    };
  }, [draft.centerId, date, refresh]);

  if (redirect) return <Navigate to={redirect} replace />;
  const open = (day?.date === date ? day.slots : []).filter((item) => item.available);
  const outsideWindow = !!day && (date < day.firstDate || date > day.lastDate);

  return (
    <BookingShell
      step={5}
      title="Pick a date and slot"
      subtitle={draft.centerName}
      back="/services/book/issue"
    >
      <p className="af-hint">All times are in India Standard Time. Choose your arrival time; servicing may take longer than the slot.</p>
      {day && <label>Choose a date<input type="date" value={date} min={day.firstDate} max={day.lastDate} onChange={(event) => { if (event.target.value) { setDate(event.target.value); setSlot(null); } }} /></label>}
      <div className="af-days">
        {days.filter((value) => !day || (value >= day.firstDate && value <= day.lastDate)).map((value) => {
          const noon = new Date(`${value}T12:00:00+05:30`);
          return (
            <button
              className={date === value ? 'on' : ''}
              key={value}
              onClick={() => { setDate(value); setSlot(null); }}
            >
              <b>
                {noon.toLocaleDateString('en-IN', { day: 'numeric', timeZone: 'Asia/Kolkata' })}
              </b>
              <small>
                {noon.toLocaleDateString('en-IN', { weekday: 'short', timeZone: 'Asia/Kolkata' })}
              </small>
            </button>
          );
        })}
      </div>
      <ErrorText error={error} />
      <button type="button" className="af-btn secondary" disabled={loading} onClick={() => setRefresh((value) => value + 1)}>{loading ? 'Checking availability…' : 'Refresh availability'}</button>
      {outsideWindow && <p className="af-note">Choose a date between {day?.firstDate} and {day?.lastDate}.</p>}
      {!!day?.leadMinutes && <p className="af-hint">This center requires {day.leadMinutes} minutes' advance notice.</p>}
      {!day && !error ? <p className="af-hint">Checking availability…</p> : null}
      {day?.closed ? <p className="af-note">The center is closed on this day.</p> : null}
      {day && !day.closed && !outsideWindow && open.length === 0 ? (
        <p className="af-note">No bookable arrival slots on this day. Choose another date.</p>
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
        disabled={loading || !!error || !slot || !open.some((item) => item.start === slot.start && item.end === slot.end)}
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
  const [pendingAttempt, setPendingAttempt] = useState(readBookingAttempt);
  const [eligibilityError, setEligibilityError] = useState<BookingEligibilityCode | null>(null);
  if (bookedId) return <Navigate to={`/services/${bookedId}?booked=1`} replace />;
  if (pendingAttempt) return <BookingShell step={6} title="Check your booking" back="/services">
    <ErrorText error={error} />
    <p className="af-note">Your previous booking request may have succeeded. Check its result before making another booking. Your original selection will be used.</p>
    <button className="af-btn" disabled={busy} onClick={() => void run(async () => {
      try {
        const id = await createBooking(pendingAttempt.input);
        clearBookingAttempt(); clearDraft(); setBookedId(id);
      } finally { setPendingAttempt(readBookingAttempt()); }
    })}>{busy ? 'Checking…' : 'Check previous booking result'}</button>
  </BookingShell>;
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
          value={
            offerings.length
              ? offerings.map((item) => item.name).join(', ')
              : 'Inspection and diagnosis'
          }
          edit="/services/book/services"
        />
        <Summary
          label="Your notes"
          value={draft.issueDescription || '—'}
          edit="/services/book/issue"
        />
        <Summary
          label="Appointment"
          value={formatWhen(draft.slotStart!)}
          edit="/services/book/schedule"
        />
        <Summary
          label="Arrival"
          value="You bring the vehicle to the center"
          edit="/services/book/center"
        />
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
        {draft.centerAutoAccept === false
          ? ' The center confirms new bookings, usually within a few hours.'
          : ''}
      </p>
      <ErrorText error={error} />
      {error && (
        <>
          <Link to="/services/book/services">Review current services and prices</Link>
          <Link to="/services/book/vehicle">Choose another vehicle</Link>
          <Link to="/services/book/schedule">Choose a current arrival slot</Link>
        </>
      )}
      <button
        className="af-btn"
        disabled={busy || !!pendingAttempt}
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
              clearBookingAttempt();
              clearDraft();
              setBookedId(id);
            } catch (err) {
              setPendingAttempt(readBookingAttempt());
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
