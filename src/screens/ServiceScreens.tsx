import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  autoflex,
  type Booking,
  type Category,
  type CenterListItem,
  type GarageVehicle,
  type Slot,
} from '../lib/api';
import { clearDraft, getDraft, patchDraft } from '../lib/booking';
import {
  BENGALURU,
  bookingStatusLabel,
  formatInr,
  formatKm,
  formatSlot,
  formatWhen,
  ymd,
} from '../lib/format';

function useRedirectUnless(ok: boolean, fallback: string) {
  const navigate = useNavigate();
  useEffect(() => {
    if (!ok) navigate(fallback, { replace: true });
  }, [ok, fallback, navigate]);
}

export function ServiceListScreen() {
  const [items, setItems] = useState<Booking[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void autoflex<{ items: Booking[] }>('/v1/bookings', {}, true)
      .then((res) => setItems(res.items))
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : 'Could not load bookings'),
      )
      .finally(() => setLoading(false));
  }, []);

  return (
    <section className="af-screen af-list">
      <div className="af-top">
        <h1 className="af-title">Services</h1>
      </div>
      <Link className="af-btn" to="/services/book/vehicle">
        Book service
      </Link>
      {loading ? <p className="af-hint">Loading bookings…</p> : null}
      {error ? <p className="af-error">{error}</p> : null}
      {!loading && !error && items.length === 0 ? (
        <div className="af-empty">
          <h2>No bookings yet</h2>
          <p>When you confirm a visit, it shows up here.</p>
        </div>
      ) : null}
      {items.map((booking) => (
        <Link key={booking.id} className="af-card" to={`/services/${booking.id}`}>
          <div className="af-card-body">
            <h3>{booking.vehicleLabel || 'Vehicle'}</h3>
            <p className="af-meta">{bookingStatusLabel(booking.status)}</p>
            <p className="af-meta">{formatWhen(booking.slotStart)}</p>
            <p className="af-meta">{booking.centerName}</p>
          </div>
        </Link>
      ))}
    </section>
  );
}

export function BookVehicleScreen() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const preset = params.get('vehicleId');
  const [vehicles, setVehicles] = useState<GarageVehicle[]>([]);
  const [selected, setSelected] = useState<string>();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void autoflex<GarageVehicle[]>('/v1/me/vehicles', {}, true)
      .then((list) => {
        setVehicles(list);
        const initial = list.find((v) => v.id === preset)?.id ?? list[0]?.id;
        setSelected(initial);
      })
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : 'Could not load vehicles'),
      )
      .finally(() => setLoading(false));
  }, [preset]);

  function cont() {
    const vehicle = vehicles.find((item) => item.id === selected);
    if (!vehicle) return;
    patchDraft({
      vehicleId: vehicle.id,
      vehicleLabel: `${vehicle.make} ${vehicle.model}`,
      vehicleType: vehicle.vehicleType,
      categoryId: undefined,
      categoryName: undefined,
    });
    navigate('/services/book/type');
  }

  return (
    <section className="af-screen af-form">
      <h1 className="af-title">Select vehicle</h1>
      {loading ? <p className="af-hint">Loading vehicles…</p> : null}
      {error ? <p className="af-error">{error}</p> : null}
      {!loading && vehicles.length === 0 ? (
        <div className="af-empty">
          <p>Add a vehicle before booking a service.</p>
          <Link className="af-btn" to="/vehicles/new">
            Add vehicle
          </Link>
        </div>
      ) : null}
      {vehicles.map((vehicle) => (
        <button
          key={vehicle.id}
          className={selected === vehicle.id ? 'af-radio on' : 'af-radio'}
          type="button"
          onClick={() => setSelected(vehicle.id)}
        >
          <span className="af-dot" />
          <span>
            <strong>
              {vehicle.make} {vehicle.model}
            </strong>
            <span className="af-meta">{vehicle.registrationNumber}</span>
          </span>
        </button>
      ))}
      {vehicles.length > 0 ? (
        <div className="af-dock">
          <button className="af-btn" type="button" disabled={!selected} onClick={cont}>
            Continue
          </button>
        </div>
      ) : null}
    </section>
  );
}

export function BookTypeScreen() {
  const navigate = useNavigate();
  const draft = getDraft();
  useRedirectUnless(Boolean(draft?.vehicleId), '/services/book/vehicle');
  const [categories, setCategories] = useState<Category[]>([]);
  const [selected, setSelected] = useState(draft?.categoryId);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const type = draft?.vehicleType || 'TWO_WHEELER';
    void autoflex<{ items: Category[] }>(
      `/v1/marketplace/categories?vehicleType=${encodeURIComponent(type)}`,
    )
      .then((res) => setCategories(res.items))
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : 'Could not load services'),
      )
      .finally(() => setLoading(false));
  }, [draft?.vehicleType]);

  function cont() {
    const category = categories.find((item) => item.id === selected);
    if (!category) return;
    patchDraft({ categoryId: category.id, categoryName: category.name });
    navigate('/services/book/issue');
  }

  return (
    <section className="af-screen af-form">
      <h1 className="af-title">Service type</h1>
      <p className="af-sub">{draft?.vehicleLabel}</p>
      {loading ? <p className="af-hint">Loading services…</p> : null}
      {error ? <p className="af-error">{error}</p> : null}
      {!loading && !error && categories.length === 0 ? (
        <p className="af-hint">No service types are listed for this vehicle yet.</p>
      ) : null}
      {categories.map((category) => (
        <button
          key={category.id}
          className={selected === category.id ? 'af-radio on' : 'af-radio'}
          type="button"
          onClick={() => setSelected(category.id)}
        >
          <span className="af-dot" />
          <strong>{category.name}</strong>
        </button>
      ))}
      <div className="af-dock">
        <button className="af-btn" type="button" disabled={!selected} onClick={cont}>
          Continue
        </button>
      </div>
    </section>
  );
}

export function BookIssueScreen() {
  const navigate = useNavigate();
  const draft = getDraft();
  useRedirectUnless(Boolean(draft?.categoryId), '/services/book/type');
  const [text, setText] = useState(draft?.issueDescription ?? '');

  return (
    <section className="af-screen af-form">
      <h1 className="af-title">Describe the issue</h1>
      <p className="af-sub">{draft?.categoryName}. Photos are not part of this booking.</p>
      <label className="af-field">
        What should the center know?
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="There is a noise when I apply the brakes."
        />
      </label>
      <div className="af-dock">
        <button
          className="af-btn"
          type="button"
          onClick={() => {
            patchDraft({ issueDescription: text.trim() });
            navigate('/services/book/mode');
          }}
        >
          Continue
        </button>
      </div>
    </section>
  );
}

export function BookModeScreen() {
  const navigate = useNavigate();
  useRedirectUnless(Boolean(getDraft()?.vehicleId && getDraft()?.categoryId), '/services/book/issue');

  return (
    <section className="af-screen af-form">
      <h1 className="af-title">How should the vehicle arrive?</h1>
      <button className="af-radio on" type="button">
        <span className="af-dot" />
        <span>
          <strong>I&apos;ll visit the center</strong>
          <span className="af-meta">You bring the vehicle. Pay at the center.</span>
        </span>
      </button>
      <button className="af-radio" type="button" disabled>
        <span className="af-dot" />
        <span>
          <strong>Pickup</strong>
          <span className="af-meta">Not available yet.</span>
        </span>
      </button>
      <div className="af-dock">
        <button className="af-btn" type="button" onClick={() => navigate('/services/book/center')}>
          Continue
        </button>
      </div>
    </section>
  );
}

export function BookCenterScreen() {
  const navigate = useNavigate();
  useRedirectUnless(Boolean(getDraft()?.vehicleId), '/services/book/vehicle');
  const [centers, setCenters] = useState<CenterListItem[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    const qs = new URLSearchParams({
      lat: String(BENGALURU.lat),
      lng: String(BENGALURU.lng),
    });
    void autoflex<{ items: CenterListItem[] }>(`/v1/marketplace/centers?${qs}`)
      .then((res) => setCenters(res.items))
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : 'Could not load centers'),
      )
      .finally(() => setLoading(false));
  }, []);

  async function choose(center: CenterListItem) {
    setBusyId(center.id);
    setError('');
    try {
      const options = await autoflex<{ modes: { estimateInr: number }[] }>(
        `/v1/centers/${center.id}/booking-options`,
      );
      patchDraft({
        centerId: center.id,
        centerName: center.displayName,
        estimateInr: options.modes[0]?.estimateInr ?? 2499,
      });
      navigate('/services/book/schedule');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not open this center');
      setBusyId(null);
    }
  }

  return (
    <section className="af-screen af-list">
      <h1 className="af-title">Choose a center</h1>
      <p className="af-sub">Centers near Bengaluru. Distance is from the city center.</p>
      {loading ? <p className="af-hint">Loading centers…</p> : null}
      {error ? <p className="af-error">{error}</p> : null}
      {!loading && !error && centers.length === 0 ? (
        <p className="af-hint">No centers are available to book right now.</p>
      ) : null}
      {centers.map((center) => (
        <button
          key={center.id}
          className="af-card"
          type="button"
          disabled={busyId === center.id}
          onClick={() => void choose(center)}
        >
          <div className="af-card-body">
            <h3>{center.displayName}</h3>
            <p className="af-meta">{formatKm(center.distanceMeters)}</p>
            {center.formattedAddress ? <p className="af-meta">{center.formattedAddress}</p> : null}
          </div>
        </button>
      ))}
    </section>
  );
}

export function BookScheduleScreen() {
  const navigate = useNavigate();
  const draft = getDraft();
  useRedirectUnless(Boolean(draft?.centerId), '/services/book/center');
  const days = Array.from({ length: 7 }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() + i);
    return date;
  });
  const [date, setDate] = useState(ymd(days[0]));
  const [slots, setSlots] = useState<Slot[]>([]);
  const [selected, setSelected] = useState<Slot | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!draft?.centerId) return;
    setLoading(true);
    setSelected(null);
    void autoflex<{ slots: Slot[] }>(
      `/v1/centers/${draft.centerId}/slots?date=${date}`,
    )
      .then((res) => setSlots(res.slots))
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : 'Could not load slots'),
      )
      .finally(() => setLoading(false));
  }, [date, draft?.centerId]);

  function cont() {
    if (!selected) return;
    patchDraft({
      slotStart: selected.start,
      slotEnd: selected.end,
      slotLabel: `${date} · ${formatSlot(selected.start)}`,
    });
    navigate('/services/book/review');
  }

  return (
    <section className="af-screen af-form">
      <h1 className="af-title">Pick a time</h1>
      <p className="af-sub">{draft?.centerName}</p>
      <div className="af-days">
        {days.map((day) => {
          const key = ymd(day);
          return (
            <button
              key={key}
              type="button"
              className={key === date ? 'on' : undefined}
              onClick={() => setDate(key)}
            >
              {day.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
            </button>
          );
        })}
      </div>
      {loading ? <p className="af-hint">Loading times…</p> : null}
      {error ? <p className="af-error">{error}</p> : null}
      <div className="af-slots">
        {slots.map((slot) => (
          <button
            key={slot.start}
            type="button"
            className={selected?.start === slot.start ? 'af-slot on' : 'af-slot'}
            disabled={!slot.available}
            onClick={() => setSelected(slot)}
          >
            {formatSlot(slot.start)}
          </button>
        ))}
      </div>
      {!loading && slots.every((slot) => !slot.available) ? (
        <p className="af-hint">No open times on this day.</p>
      ) : null}
      <div className="af-dock">
        <button className="af-btn" type="button" disabled={!selected} onClick={cont}>
          Review
        </button>
      </div>
    </section>
  );
}

export function BookReviewScreen() {
  const navigate = useNavigate();
  const draft = getDraft();
  useRedirectUnless(
    Boolean(draft?.slotStart && draft.vehicleId && draft.centerId),
    '/services/book/schedule',
  );
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function confirm() {
    if (!draft?.vehicleId || !draft.centerId || !draft.slotStart || !draft.slotEnd) return;
    setBusy(true);
    setError('');
    try {
      const created = await autoflex<{ id: string }>(
        '/v1/bookings',
        {
          method: 'POST',
          body: JSON.stringify({
            serviceCenterId: draft.centerId,
            vehicleId: draft.vehicleId,
            mode: 'SELF_CHECKIN',
            slotStart: draft.slotStart,
            slotEnd: draft.slotEnd,
            issueDescription: draft.issueDescription || draft.categoryName,
            paymentMode: 'PAY_AT_CENTER',
            estimateInr: draft.estimateInr,
          }),
        },
        true,
      );
      clearDraft();
      navigate(`/services/${created.id}`, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not confirm booking');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="af-screen af-form">
      <h1 className="af-title">Review</h1>
      <article className="af-card">
        <div className="af-card-body">
          <p className="af-meta">Vehicle</p>
          <h3>{draft?.vehicleLabel}</h3>
          <p className="af-meta">Service</p>
          <h3>{draft?.categoryName}</h3>
          <p className="af-meta">Arrival</p>
          <h3>I&apos;ll visit the center</h3>
          <p className="af-meta">Center</p>
          <h3>{draft?.centerName}</h3>
          <p className="af-meta">Time</p>
          <h3>{draft?.slotStart ? formatWhen(draft.slotStart) : ''}</h3>
          <p className="af-meta">Estimate, pay at the center</p>
          <h3>{formatInr(draft?.estimateInr ?? 2499)}</h3>
          {draft?.issueDescription ? <p className="af-meta">{draft.issueDescription}</p> : null}
        </div>
      </article>
      {error ? <p className="af-error">{error}</p> : null}
      <button className="af-btn" type="button" disabled={busy} onClick={() => void confirm()}>
        Confirm booking
      </button>
    </section>
  );
}

export function ServiceDetailScreen() {
  const { id } = useParams();
  const [booking, setBooking] = useState<Booking | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    void autoflex<Booking>(`/v1/bookings/${id}`, {}, true)
      .then(setBooking)
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : 'Could not load booking'),
      )
      .finally(() => setLoading(false));
  }, [id]);

  return (
    <section className="af-screen af-form">
      <h1 className="af-title">Booking</h1>
      {loading ? <p className="af-hint">Loading booking…</p> : null}
      {error ? <p className="af-error">{error}</p> : null}
      {booking ? (
        <article className="af-card">
          <div className="af-card-body">
            <p className="af-meta">Status</p>
            <h3>{bookingStatusLabel(booking.status)}</h3>
            <p className="af-meta">Vehicle</p>
            <h3>
              {booking.vehicleLabel}
              {booking.registrationNumber ? ` · ${booking.registrationNumber}` : ''}
            </h3>
            <p className="af-meta">Center</p>
            <h3>{booking.centerName}</h3>
            <p className="af-meta">Time</p>
            <h3>{formatWhen(booking.slotStart)}</h3>
            <p className="af-meta">Payment</p>
            <h3>Pay at the center · {formatInr(Number(booking.estimateInr))}</h3>
            {booking.issueDescription ? <p className="af-meta">{booking.issueDescription}</p> : null}
          </div>
        </article>
      ) : null}
      <Link className="af-btn" to="/services">
        All services
      </Link>
    </section>
  );
}
