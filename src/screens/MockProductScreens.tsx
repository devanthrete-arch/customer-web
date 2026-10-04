import { useState, type FormEvent, type ReactNode } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { clearDraft, getDraft, patchDraft } from '../lib/booking';
import { formatInr, formatWhen } from '../lib/format';
import {
  ACTIVE_SERVICE_STAGES,
  serviceStatusLabel,
  useMockDomain,
  type Vehicle,
  type VaultDocument,
} from '../mock/domain';

const serviceTypes = [
  'Periodic Service',
  'General Inspection',
  'AC Service',
  'Brake Service',
  'Battery',
  'Tyres',
  'Engine',
  'Repair',
  'Detailing',
  'Other',
];

const centers = [
  {
    id: 'center-indiranagar',
    name: 'AutoFlex Care · Indiranagar',
    detail: '2.4 km · 8:00 AM–7:00 PM · All service types',
    estimate: 2499,
  },
  {
    id: 'center-koramangala',
    name: 'AutoFlex Care · Koramangala',
    detail: '5.8 km · 8:30 AM–6:30 PM · 4.7 demo rating',
    estimate: 2699,
  },
];

const slots = ['09:00 AM', '10:30 AM', '12:00 PM', '02:30 PM', '04:00 PM'];

function vehicleName(vehicle: Vehicle | undefined): string {
  return vehicle ? `${vehicle.make} ${vehicle.model}` : 'Vehicle';
}

function PageHeader({
  title,
  back,
  action,
}: {
  title: string;
  back?: string;
  action?: ReactNode;
}) {
  return (
    <div className="af-top">
      {back ? (
        <Link className="af-back af-back-link" to={back} aria-label="Back">
          ‹
        </Link>
      ) : null}
      <h1 className="af-title">{title}</h1>
      {action}
    </div>
  );
}

function DemoNotice({ children }: { children: ReactNode }) {
  return <p className="af-demo-note">Demo only · {children}</p>;
}

function StatusPill({ children, tone = 'blue' }: { children: ReactNode; tone?: 'blue' | 'orange' | 'green' | 'gray' }) {
  return <span className={`af-status af-status-${tone}`}>{children}</span>;
}

export function MockDashboardScreen() {
  const { state } = useMockDomain();
  const activeVehicles = state.vehicles.filter((vehicle) => vehicle.status === 'ACTIVE');
  const activeService = state.services.find((service) => service.status !== 'COMPLETED');
  const pending = activeService?.recommendations.find((item) => item.status === 'PENDING');
  const overdue = state.maintenance.find((item) => item.status === 'OVERDUE');
  const expiring = state.documents.find((item) => item.expiryDate && item.status === 'ACTIVE');
  const unread = state.notifications.filter((item) => !item.read).length;

  return (
    <section className="af-screen af-dash">
      <header className="af-dash-hero">
        <div className="af-dash-top">
          <div>
            <p className="af-dash-hello">Your vehicle home</p>
            <h1>Hello, {state.profile.name.split(' ')[0]}</h1>
            <p className="af-dash-city">{state.profile.city}</p>
          </div>
          <Link className="af-notification-button" to="/notifications" aria-label={`${unread} unread notifications`}>
            🔔 {unread ? <b>{unread}</b> : null}
          </Link>
        </div>
      </header>

      <div className="af-dash-actions">
        <Link to="/vehicles">
          <strong>{activeVehicles.length}</strong>
          <span>Vehicles</span>
        </Link>
        <Link className="primary" to="/services/book/vehicle">
          <strong>Book</strong>
          <span>Service</span>
        </Link>
        <Link to={activeService ? `/services/${activeService.id}` : '/services'}>
          <strong>{activeService ? '1' : '0'}</strong>
          <span>Active</span>
        </Link>
      </div>

      <div className="af-dash-split">
        <div>
          <h2 className="af-dash-heading">Needs attention</h2>
          <div className="af-attention-list">
            {pending && activeService ? (
              <Link className="af-attention af-attention-urgent" to={`/services/${activeService.id}/recommendations/${pending.id}`}>
                <div>
                  <StatusPill tone="orange">Decision needed</StatusPill>
                  <strong>{pending.title}</strong>
                  <span>{formatInr(pending.estimatedCost)} additional estimate</span>
                </div>
                <b>Review →</b>
              </Link>
            ) : null}
            {overdue ? (
              <Link className="af-attention" to={`/maintenance/${overdue.id}`}>
                <div>
                  <StatusPill tone="orange">Overdue</StatusPill>
                  <strong>{overdue.title}</strong>
                  <span>{vehicleName(state.vehicles.find((item) => item.id === overdue.vehicleId))}</span>
                </div>
                <b>View →</b>
              </Link>
            ) : null}
            {expiring ? (
              <Link className="af-attention" to={`/documents/${expiring.id}`}>
                <div>
                  <StatusPill>Expiring</StatusPill>
                  <strong>{expiring.title}</strong>
                  <span>Expires {expiring.expiryDate}</span>
                </div>
                <b>View →</b>
              </Link>
            ) : null}
          </div>
        </div>

        <div>
          <h2 className="af-dash-heading">Active service</h2>
          {activeService ? (
            <Link className="af-active-service" to={`/services/${activeService.id}`}>
              <div className="af-card-line">
                <div>
                  <span className="af-kicker">{activeService.id}</span>
                  <h3>{vehicleName(state.vehicles.find((item) => item.id === activeService.vehicleId))}</h3>
                </div>
                <StatusPill tone="orange">{serviceStatusLabel(activeService.status)}</StatusPill>
              </div>
              <p>{activeService.centerName}</p>
              <div className="af-progress-mini" aria-label="Service progress">
                {ACTIVE_SERVICE_STAGES.slice(0, 8).map((stage) => (
                  <span
                    key={stage}
                    className={ACTIVE_SERVICE_STAGES.indexOf(stage) <= ACTIVE_SERVICE_STAGES.indexOf(activeService.status) ? 'done' : ''}
                  />
                ))}
              </div>
              <b>Track service →</b>
            </Link>
          ) : (
            <div className="af-panel"><p>No active service.</p></div>
          )}
        </div>
      </div>

      <div className="af-card-line af-section-line">
        <h2 className="af-dash-heading">Your vehicles</h2>
        <Link to="/vehicles">View all</Link>
      </div>
      <div className="af-grid-2">
        {activeVehicles.map((vehicle) => {
          const next = state.maintenance.find((item) => item.vehicleId === vehicle.id && item.status !== 'COMPLETED');
          const last = state.services.find((item) => item.vehicleId === vehicle.id && item.status === 'COMPLETED');
          return (
            <article className="af-vehicle-card" key={vehicle.id}>
              <div className="af-card-line">
                <div>
                  <h3>{vehicleName(vehicle)}</h3>
                  <span className="af-plate">{vehicle.registrationNumber}</span>
                </div>
                <span className="af-vehicle-glyph">🚙</span>
              </div>
              <dl className="af-metrics">
                <div><dt>Mileage</dt><dd>{vehicle.mileage.toLocaleString('en-IN')} km</dd></div>
                <div><dt>Last service</dt><dd>{last ? new Date(last.appointmentAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}</dd></div>
                <div><dt>Next action</dt><dd>{next?.title ?? 'No reminders'}</dd></div>
              </dl>
              <div className="af-inline-actions">
                <Link to={`/vehicles/${vehicle.id}`}>View vehicle</Link>
                <Link to={`/services/book/vehicle?vehicleId=${vehicle.id}`}>Book service</Link>
              </div>
            </article>
          );
        })}
      </div>

      <h2 className="af-dash-heading">Quick access</h2>
      <div className="af-quick-grid">
        <Link to="/documents"><b>Documents</b><span>Vault & expiry</span></Link>
        <Link to="/history"><b>History</b><span>Reports</span></Link>
        <Link to="/maintenance"><b>Maintenance</b><span>Reminders</span></Link>
        <Link to="/payments"><b>Payments</b><span>Invoices</span></Link>
      </div>
    </section>
  );
}

export function MockVehicleListScreen() {
  const { state } = useMockDomain();
  const active = state.vehicles.filter((item) => item.status === 'ACTIVE');
  const archived = state.vehicles.filter((item) => item.status === 'ARCHIVED');
  return (
    <section className="af-screen af-wide">
      <PageHeader title="My vehicles" action={<Link className="af-skip" to="/vehicles/new">Add vehicle</Link>} />
      <p className="af-sub">Every service, document, reminder, and cost stays linked to a vehicle.</p>
      <div className="af-grid-2 af-content-gap">
        {active.map((vehicle) => (
          <Link className="af-vehicle-card" to={`/vehicles/${vehicle.id}`} key={vehicle.id}>
            <div className="af-card-line">
              <div><h3>{vehicleName(vehicle)}</h3><span className="af-plate">{vehicle.registrationNumber}</span></div>
              <span className="af-vehicle-glyph">🚙</span>
            </div>
            <p className="af-meta">{vehicle.variant} · {vehicle.year} · {vehicle.fuel}</p>
            <p><b>{vehicle.mileage.toLocaleString('en-IN')} km</b></p>
          </Link>
        ))}
      </div>
      {archived.length ? (
        <details className="af-panel">
          <summary>Archived vehicles ({archived.length})</summary>
          {archived.map((vehicle) => <p key={vehicle.id}>{vehicleName(vehicle)} · {vehicle.registrationNumber}</p>)}
        </details>
      ) : null}
    </section>
  );
}

export function MockVehicleAddScreen() {
  const { addVehicle } = useMockDomain();
  const navigate = useNavigate();
  const [step, setStep] = useState<'lookup' | 'confirm' | 'complete'>('lookup');
  const [plate, setPlate] = useState('');
  const [form, setForm] = useState({
    make: 'Maruti Suzuki',
    model: 'Grand Vitara',
    variant: 'Delta',
    year: '2023',
    fuel: 'Petrol',
    transmission: 'Automatic',
    mileage: '12800',
    purchaseDate: '2023-08-20',
  });

  function save(e: FormEvent) {
    e.preventDefault();
    const vehicle = addVehicle({
      make: form.make.trim(),
      model: form.model.trim(),
      variant: form.variant.trim(),
      year: Number(form.year),
      registrationNumber: plate.replace(/\s+/g, ' ').trim().toUpperCase(),
      fuel: form.fuel,
      transmission: form.transmission,
      mileage: Number(form.mileage),
      purchaseDate: form.purchaseDate,
    });
    navigate(`/vehicles/${vehicle.id}?added=1`, { replace: true });
  }

  return (
    <section className="af-screen af-form">
      <PageHeader title="Add vehicle" back="/vehicles" />
      <div className="af-stepper"><span className="on">1</span><i /><span className={step !== 'lookup' ? 'on' : ''}>2</span><i /><span className={step === 'complete' ? 'on' : ''}>3</span></div>
      {step === 'lookup' ? (
        <>
          <h2>Enter registration</h2>
          <p className="af-sub">The lookup is simulated for this frontend demo. You can confirm or edit the suggested details.</p>
          <label className="af-field">Registration number
            <input value={plate} onChange={(event) => setPlate(event.target.value.toUpperCase())} placeholder="KA 05 AB 1234" />
          </label>
          <button className="af-btn" disabled={plate.trim().length < 6} onClick={() => setStep('confirm')}>Run mock lookup</button>
          <button className="af-btn ghost" onClick={() => setStep('complete')}>Enter all details manually</button>
        </>
      ) : null}
      {step === 'confirm' ? (
        <>
          <DemoNotice>No government or vehicle registry was queried.</DemoNotice>
          <article className="af-vehicle-card">
            <h2>{form.make} {form.model}</h2>
            <p className="af-plate">{plate}</p>
            <p>{form.year} · {form.fuel} · {form.transmission}</p>
          </article>
          <button className="af-btn" onClick={() => setStep('complete')}>That’s my vehicle</button>
          <button className="af-btn ghost" onClick={() => setStep('complete')}>Edit details</button>
        </>
      ) : null}
      {step === 'complete' ? (
        <form onSubmit={save}>
          <h2>Complete vehicle details</h2>
          <div className="af-form-grid">
            {(['make', 'model', 'variant', 'year', 'mileage', 'purchaseDate'] as const).map((key) => (
              <label className="af-field" key={key}>{key === 'purchaseDate' ? 'Purchase date' : key[0].toUpperCase() + key.slice(1)}
                <input type={key === 'purchaseDate' ? 'date' : 'text'} required value={form[key]} onChange={(event) => setForm({ ...form, [key]: event.target.value })} />
              </label>
            ))}
            <label className="af-field">Registration
              <input required value={plate} onChange={(event) => setPlate(event.target.value.toUpperCase())} />
            </label>
            <label className="af-field">Fuel
              <select value={form.fuel} onChange={(event) => setForm({ ...form, fuel: event.target.value })}><option>Petrol</option><option>Diesel</option><option>Electric</option><option>Hybrid</option></select>
            </label>
            <label className="af-field">Transmission
              <select value={form.transmission} onChange={(event) => setForm({ ...form, transmission: event.target.value })}><option>Automatic</option><option>Manual</option></select>
            </label>
          </div>
          <button className="af-btn" type="submit">Save vehicle</button>
        </form>
      ) : null}
    </section>
  );
}

export function MockVehicleDetailScreen() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const { state, archiveVehicle } = useMockDomain();
  const navigate = useNavigate();
  const vehicle = state.vehicles.find((item) => item.id === id);
  if (!vehicle) return <NotFound title="Vehicle not found" back="/vehicles" />;
  const services = state.services.filter((item) => item.vehicleId === vehicle.id);
  const documents = state.documents.filter((item) => item.vehicleId === vehicle.id && item.status === 'ACTIVE');
  const maintenance = state.maintenance.filter((item) => item.vehicleId === vehicle.id);
  const timeline = [
    ...services.map((item) => ({ at: item.appointmentAt, title: `${item.serviceType} · ${serviceStatusLabel(item.status)}` })),
    ...documents.map((item) => ({ at: item.addedAt, title: `${item.category} added` })),
  ].sort((a, b) => b.at.localeCompare(a.at));
  return (
    <section className="af-screen af-wide">
      <PageHeader title={vehicleName(vehicle)} back="/vehicles" action={<Link className="af-skip" to={`/vehicles/${vehicle.id}/edit`}>Edit</Link>} />
      {params.get('added') ? <div className="af-success-banner">Vehicle added to your demo garage.</div> : null}
      <article className="af-vehicle-hero">
        <div><span className="af-plate">{vehicle.registrationNumber}</span><h2>{vehicle.variant}</h2><p>{vehicle.year} · {vehicle.fuel} · {vehicle.transmission}</p></div>
        <div className="af-odometer"><b>{vehicle.mileage.toLocaleString('en-IN')}</b><span>km</span></div>
      </article>
      <div className="af-inline-actions af-action-bar">
        <Link className="af-btn" to={`/services/book/vehicle?vehicleId=${vehicle.id}`}>Book service</Link>
        <Link className="af-btn secondary" to={services.find((item) => item.status !== 'COMPLETED') ? `/services/${services.find((item) => item.status !== 'COMPLETED')?.id}` : '/services'}>Track service</Link>
      </div>
      <div className="af-grid-3 af-content-gap">
        <Link className="af-panel" to="/history"><span className="af-kicker">Services</span><h3>{services.length} records</h3><p>History and reports</p></Link>
        <Link className="af-panel" to="/documents"><span className="af-kicker">Documents</span><h3>{documents.length} active</h3><p>Vault metadata</p></Link>
        <Link className="af-panel" to="/maintenance"><span className="af-kicker">Maintenance</span><h3>{maintenance.length} items</h3><p>Schedule and reminders</p></Link>
      </div>
      <h2>Vehicle timeline</h2>
      <div className="af-timeline">
        {timeline.map((event, index) => <div key={`${event.at}-${index}`}><i /><p><b>{event.title}</b><span>{new Date(event.at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span></p></div>)}
      </div>
      {vehicle.status === 'ACTIVE' ? (
        <button className="af-text-danger" onClick={() => { if (window.confirm('Archive this vehicle? Existing history stays available.')) { archiveVehicle(vehicle.id); navigate('/vehicles'); } }}>Archive vehicle</button>
      ) : null}
    </section>
  );
}

export function MockVehicleEditScreen() {
  const { id } = useParams();
  const { state, updateVehicle } = useMockDomain();
  const navigate = useNavigate();
  const vehicle = state.vehicles.find((item) => item.id === id);
  const [form, setForm] = useState(vehicle);
  if (!vehicle || !form) return <NotFound title="Vehicle not found" back="/vehicles" />;
  return (
    <section className="af-screen af-form">
      <PageHeader title="Edit vehicle" back={`/vehicles/${vehicle.id}`} />
      <form onSubmit={(event) => { event.preventDefault(); updateVehicle(vehicle.id, form); navigate(`/vehicles/${vehicle.id}`); }}>
        <div className="af-form-grid">
          {(['make', 'model', 'variant', 'registrationNumber', 'fuel', 'transmission', 'year', 'mileage'] as const).map((key) => (
            <label className="af-field" key={key}>{key === 'registrationNumber' ? 'Registration' : key[0].toUpperCase() + key.slice(1)}
              <input required value={form[key]} onChange={(event) => setForm({ ...form, [key]: key === 'year' || key === 'mileage' ? Number(event.target.value) : event.target.value })} />
            </label>
          ))}
        </div>
        <button className="af-btn">Save changes</button>
      </form>
    </section>
  );
}

export function MockServiceListScreen() {
  const { state } = useMockDomain();
  const [filter, setFilter] = useState<'ACTIVE' | 'COMPLETED'>('ACTIVE');
  const items = state.services.filter((service) => filter === 'COMPLETED' ? service.status === 'COMPLETED' : service.status !== 'COMPLETED');
  return (
    <section className="af-screen af-wide">
      <PageHeader title="Services" action={<Link className="af-skip" to="/services/book/vehicle">Book service</Link>} />
      <div className="af-tabs">
        <button className={filter === 'ACTIVE' ? 'on' : ''} onClick={() => setFilter('ACTIVE')}>Active & upcoming</button>
        <button className={filter === 'COMPLETED' ? 'on' : ''} onClick={() => setFilter('COMPLETED')}>Completed</button>
      </div>
      <div className="af-grid-2 af-content-gap">
        {items.map((service) => {
          const vehicle = state.vehicles.find((item) => item.id === service.vehicleId);
          return (
            <Link className="af-service-card" to={`/services/${service.id}`} key={service.id}>
              <div className="af-card-line"><span className="af-kicker">{service.id}</span><StatusPill tone={service.status === 'COMPLETED' ? 'green' : 'orange'}>{serviceStatusLabel(service.status)}</StatusPill></div>
              <h3>{service.serviceType}</h3>
              <p>{vehicleName(vehicle)} · {vehicle?.registrationNumber}</p>
              <p className="af-meta">{formatWhen(service.appointmentAt)}<br />{service.centerName}</p>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

export function MockBookVehicleScreen() {
  const { state } = useMockDomain();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const draft = getDraft();
  const vehicles = state.vehicles.filter((item) => item.status === 'ACTIVE');
  const [selected, setSelected] = useState(params.get('vehicleId') ?? draft?.vehicleId ?? vehicles[0]?.id);
  return (
    <BookingShell step={1} title="Which vehicle needs service?">
      {vehicles.map((vehicle) => (
        <button className={`af-radio ${selected === vehicle.id ? 'on' : ''}`} key={vehicle.id} onClick={() => setSelected(vehicle.id)}>
          <span className="af-dot" /><span><strong>{vehicleName(vehicle)}</strong><span className="af-meta">{vehicle.registrationNumber}</span></span>
        </button>
      ))}
      <button className="af-btn" disabled={!selected} onClick={() => {
        const vehicle = vehicles.find((item) => item.id === selected);
        if (!vehicle) return;
        patchDraft({ vehicleId: vehicle.id, vehicleLabel: vehicleName(vehicle), vehicleType: 'CAR' });
        navigate('/services/book/type');
      }}>Continue</button>
    </BookingShell>
  );
}

export function MockBookTypeScreen() {
  const draft = getDraft();
  const navigate = useNavigate();
  const [selected, setSelected] = useState(draft?.categoryName);
  if (!draft?.vehicleId) return <NotFound title="Start with a vehicle" back="/services/book/vehicle" />;
  return (
    <BookingShell step={2} title="What does it need?" subtitle={draft.vehicleLabel}>
      <div className="af-choice-grid">
        {serviceTypes.map((type) => <button className={selected === type ? 'on' : ''} key={type} onClick={() => setSelected(type)}>{type}</button>)}
      </div>
      <button className="af-btn" disabled={!selected} onClick={() => { patchDraft({ categoryId: selected?.toLowerCase().replace(/\s+/g, '-'), categoryName: selected }); navigate('/services/book/issue'); }}>Continue</button>
    </BookingShell>
  );
}

export function MockBookIssueScreen() {
  const draft = getDraft();
  const navigate = useNavigate();
  const [issue, setIssue] = useState(draft?.issueDescription ?? '');
  const [attachments, setAttachments] = useState(draft?.attachments ?? []);
  return (
    <BookingShell step={3} title="Tell us what’s happening" subtitle="Use your own words. Technical terminology is not required.">
      <label className="af-field">Issue or request
        <textarea value={issue} onChange={(event) => setIssue(event.target.value)} placeholder="There is a clicking sound when I turn..." />
      </label>
      <div className="af-panel">
        <h3>Photo or video metadata (optional)</h3>
        <DemoNotice>This records sample metadata only. No file leaves your device and no cloud upload occurs.</DemoNotice>
        {attachments.map((item) => <p key={item.id}><b>{item.name}</b> · {item.sizeLabel}</p>)}
        <button className="af-btn secondary" type="button" onClick={() => setAttachments([...attachments, { id: `att-${Date.now()}`, name: `issue-photo-${attachments.length + 1}.jpg`, type: 'image/jpeg', sizeLabel: '1.4 MB (mock)' }])}>Add mock attachment</button>
      </div>
      <button className="af-btn" onClick={() => { patchDraft({ issueDescription: issue.trim(), attachments }); navigate('/services/book/mode'); }}>Continue</button>
    </BookingShell>
  );
}

export function MockBookModeScreen() {
  const { state } = useMockDomain();
  const navigate = useNavigate();
  const draft = getDraft();
  const [mode, setMode] = useState<'SELF_DROP' | 'PICKUP'>(draft?.mode ?? 'SELF_DROP');
  const [address, setAddress] = useState(draft?.pickupAddress ?? state.addresses.find((item) => item.isDefault)?.line ?? '');
  return (
    <BookingShell step={4} title="Pickup or drop-off?">
      <button className={`af-radio ${mode === 'SELF_DROP' ? 'on' : ''}`} onClick={() => setMode('SELF_DROP')}><span className="af-dot" /><span><strong>I’ll drop it off</strong><span className="af-meta">Bring the vehicle to your selected center.</span></span></button>
      <button className={`af-radio ${mode === 'PICKUP' ? 'on' : ''}`} onClick={() => setMode('PICKUP')}><span className="af-dot" /><span><strong>Request pickup</strong><span className="af-meta">Demo pickup scheduling; no driver is dispatched.</span></span></button>
      {mode === 'PICKUP' ? (
        <>
          <DemoNotice>Pickup is simulated and does not dispatch a driver.</DemoNotice>
          <label className="af-field">Pickup address
            <select value={address} onChange={(event) => setAddress(event.target.value)}>
              {state.addresses.map((item) => <option value={`${item.line}, ${item.city}`} key={item.id}>{item.label} · {item.line}</option>)}
            </select>
          </label>
          <label className="af-field">Instructions<textarea placeholder="Gate, landmark, contact instructions..." /></label>
        </>
      ) : null}
      <button className="af-btn" disabled={mode === 'PICKUP' && !address} onClick={() => { patchDraft({ mode, pickupAddress: mode === 'PICKUP' ? address : undefined }); navigate('/services/book/center'); }}>Continue</button>
    </BookingShell>
  );
}

export function MockBookCenterScreen() {
  const navigate = useNavigate();
  return (
    <BookingShell step={5} title="Choose a service center" subtitle="Deterministic demo availability near Bengaluru.">
      {centers.map((center) => (
        <button className="af-service-card af-button-card" key={center.id} onClick={() => { patchDraft({ centerId: center.id, centerName: center.name, estimateInr: center.estimate }); navigate('/services/book/schedule'); }}>
          <h3>{center.name}</h3><p>{center.detail}</p><b>From {formatInr(center.estimate)} →</b>
        </button>
      ))}
    </BookingShell>
  );
}

export function MockBookScheduleScreen() {
  const navigate = useNavigate();
  const draft = getDraft();
  const days = Array.from({ length: 7 }, (_, index) => {
    const value = new Date();
    value.setDate(value.getDate() + index + 1);
    return value;
  });
  const [date, setDate] = useState(days[0].toISOString().slice(0, 10));
  const [slot, setSlot] = useState(slots[0]);
  return (
    <BookingShell step={6} title="Pick a date and slot" subtitle={draft?.centerName}>
      <div className="af-days">{days.map((day) => { const key = day.toISOString().slice(0, 10); return <button className={date === key ? 'on' : ''} key={key} onClick={() => setDate(key)}><b>{day.toLocaleDateString('en-IN', { day: 'numeric' })}</b><small>{day.toLocaleDateString('en-IN', { weekday: 'short' })}</small></button>; })}</div>
      <div className="af-slots">{slots.map((item) => <button className={`af-slot ${slot === item ? 'on' : ''}`} key={item} onClick={() => setSlot(item)}>{item}</button>)}</div>
      <button className="af-btn" onClick={() => {
        const [time, meridiem] = slot.split(' ');
        const [rawHour, minute] = time.split(':').map(Number);
        const hour = (rawHour % 12) + (meridiem === 'PM' ? 12 : 0);
        const start = new Date(`${date}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00+05:30`);
        patchDraft({ slotStart: start.toISOString(), slotEnd: new Date(start.getTime() + 60 * 60 * 1000).toISOString(), slotLabel: `${date} · ${slot}` });
        navigate('/services/book/review');
      }}>Review booking</button>
    </BookingShell>
  );
}

export function MockBookReviewScreen() {
  const { createBooking } = useMockDomain();
  const navigate = useNavigate();
  const draft = getDraft();
  if (!draft?.vehicleId || !draft.centerId || !draft.slotStart || !draft.slotEnd) return <NotFound title="Booking details are incomplete" back="/services/book/vehicle" />;
  return (
    <BookingShell step={7} title="Review your request">
      <div className="af-summary-list">
        <Summary label="Vehicle" value={draft.vehicleLabel ?? ''} edit="/services/book/vehicle" />
        <Summary label="Service" value={draft.categoryName ?? ''} edit="/services/book/type" />
        <Summary label="Issue" value={draft.issueDescription || 'No issue description'} edit="/services/book/issue" />
        <Summary label="Arrival" value={draft.mode === 'PICKUP' ? `Pickup · ${draft.pickupAddress}` : 'Self drop-off'} edit="/services/book/mode" />
        <Summary label="Center" value={draft.centerName ?? ''} edit="/services/book/center" />
        <Summary label="Appointment" value={formatWhen(draft.slotStart)} edit="/services/book/schedule" />
      </div>
      <div className="af-total"><span>Initial estimate</span><b>{formatInr(draft.estimateInr ?? 2499)}</b></div>
      <p className="af-hint">Estimated cost is not the final payable amount. Any additional work requires your explicit approval.</p>
      <DemoNotice>Confirming creates a local booking only. No center is contacted.</DemoNotice>
      <button className="af-btn" onClick={() => {
        const booking = createBooking({
          vehicleId: draft.vehicleId!,
          serviceType: draft.categoryName ?? 'General Service',
          issueDescription: draft.issueDescription ?? '',
          attachments: draft.attachments ?? [],
          mode: draft.mode ?? 'SELF_DROP',
          pickupAddress: draft.pickupAddress,
          centerId: draft.centerId!,
          centerName: draft.centerName ?? '',
          appointmentAt: draft.slotStart!,
          estimate: draft.estimateInr ?? 2499,
        });
        clearDraft();
        navigate(`/services/${booking.id}?confirmed=1`, { replace: true });
      }}>Confirm demo booking</button>
    </BookingShell>
  );
}

function BookingShell({ step, title, subtitle, children }: { step: number; title: string; subtitle?: string; children: ReactNode }) {
  return (
    <section className="af-screen af-form af-booking">
      <PageHeader title={title} back={step === 1 ? '/services' : undefined} />
      <p className="af-kicker">Booking · Step {step} of 7</p>
      {subtitle ? <p className="af-sub">{subtitle}</p> : null}
      <div className="af-booking-content">{children}</div>
    </section>
  );
}

function Summary({ label, value, edit }: { label: string; value: string; edit: string }) {
  return <div><span><small>{label}</small><b>{value}</b></span><Link to={edit}>Edit</Link></div>;
}

export function MockServiceDetailScreen() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const { state } = useMockDomain();
  const service = state.services.find((item) => item.id === id);
  if (!service) return <NotFound title="Service not found" back="/services" />;
  const vehicle = state.vehicles.find((item) => item.id === service.vehicleId);
  const invoice = state.invoices.find((item) => item.serviceId === service.id);
  const currentIndex = ACTIVE_SERVICE_STAGES.indexOf(service.status);
  return (
    <section className="af-screen af-wide">
      <PageHeader title="Service tracking" back="/services" />
      {params.get('confirmed') ? <div className="af-success-banner">Demo booking confirmed · {service.id}</div> : null}
      <div className="af-card-line af-service-heading">
        <div><span className="af-kicker">{service.id}</span><h2>{service.serviceType}</h2><p>{vehicleName(vehicle)} · {vehicle?.registrationNumber}</p></div>
        <StatusPill tone={service.status === 'COMPLETED' ? 'green' : 'orange'}>{serviceStatusLabel(service.status)}</StatusPill>
      </div>
      <div className="af-grid-main">
        <main>
          {service.recommendations.map((recommendation) => recommendation.status === 'PENDING' ? (
            <Link className="af-decision-card" key={recommendation.id} to={`/services/${service.id}/recommendations/${recommendation.id}`}>
              <StatusPill tone="orange">Your decision is required</StatusPill>
              <h3>{recommendation.title}</h3>
              <p>{recommendation.explanation}</p>
              <b>Review {formatInr(recommendation.estimatedCost)} recommendation →</b>
            </Link>
          ) : null)}
          <h2>Progress</h2>
          <div className="af-service-progress">
            {ACTIVE_SERVICE_STAGES.map((stage, index) => (
              <div className={index <= currentIndex ? 'done' : ''} key={stage}>
                <i>{index < currentIndex ? '✓' : index === currentIndex ? '●' : ''}</i>
                <span><b>{serviceStatusLabel(stage)}</b>{index === currentIndex ? <small>Current stage</small> : null}</span>
              </div>
            ))}
          </div>
          <h2>Updates</h2>
          <div className="af-timeline">
            {[...service.timeline].reverse().map((event) => <div key={event.id}><i /><p><b>{event.title}</b><span>{event.detail}<br />{formatWhen(event.at)}</span></p></div>)}
          </div>
        </main>
        <aside>
          <div className="af-panel">
            <h3>Appointment</h3><p>{formatWhen(service.appointmentAt)}</p>
            <h3>Center</h3><p>{service.centerName}</p>
            <h3>Arrival</h3><p>{service.mode === 'PICKUP' ? `Pickup · ${service.pickupAddress}` : 'Self drop-off'}</p>
            <h3>Initial estimate</h3><p>{formatInr(service.estimate)}</p>
            {service.finalAmount ? <><h3>Current total</h3><p>{formatInr(service.finalAmount)}</p></> : null}
          </div>
          {invoice ? <Link className="af-btn secondary" to={`/payments/${invoice.id}`}>View invoice</Link> : null}
          {service.status === 'COMPLETED' ? <Link className="af-btn" to={`/history/${service.id}`}>Open service report</Link> : null}
        </aside>
      </div>
    </section>
  );
}

export function MockRecommendationScreen() {
  const { id, recommendationId } = useParams();
  const { state, decideRecommendation } = useMockDomain();
  const navigate = useNavigate();
  const service = state.services.find((item) => item.id === id);
  const recommendation = service?.recommendations.find((item) => item.id === recommendationId);
  if (!service || !recommendation) return <NotFound title="Recommendation not found" back="/services" />;
  return (
    <section className="af-screen af-form">
      <PageHeader title="Additional work" back={`/services/${service.id}`} />
      <StatusPill tone={recommendation.priority === 'Urgent' ? 'orange' : 'blue'}>{recommendation.priority}</StatusPill>
      <h2>{recommendation.title}</h2>
      <div className="af-evidence-placeholder">Inspection image placeholder<br /><small>No media was uploaded</small></div>
      <div className="af-panel">
        <h3>What we found</h3><p>{recommendation.explanation}</p>
        <h3>If you defer it</h3><p>{recommendation.impactIfDeferred}</p>
        <h3>Time impact</h3><p>{recommendation.timeImpact}</p>
        <div className="af-total"><span>Additional estimate</span><b>{formatInr(recommendation.estimatedCost)}</b></div>
      </div>
      <DemoNotice>Your choice updates local demo state and adds an auditable timeline event.</DemoNotice>
      {recommendation.status === 'PENDING' ? (
        <div className="af-stack">
          <button className="af-btn" onClick={() => { decideRecommendation(service.id, recommendation.id, 'APPROVED'); navigate(`/services/${service.id}`); }}>Approve {formatInr(recommendation.estimatedCost)}</button>
          <button className="af-btn secondary" onClick={() => { decideRecommendation(service.id, recommendation.id, 'REJECTED'); navigate(`/services/${service.id}`); }}>Decline work</button>
          <Link className="af-center" to="/support">Ask for more information</Link>
        </div>
      ) : <div className="af-success-banner">Decision recorded: {recommendation.status.toLowerCase()}.</div>}
    </section>
  );
}

export function MockHistoryScreen() {
  const { state } = useMockDomain();
  const completed = state.services.filter((item) => item.status === 'COMPLETED');
  return (
    <section className="af-screen af-wide">
      <PageHeader title="Service history" />
      <p className="af-sub">Completed services and structured reports, grouped by vehicle.</p>
      {state.vehicles.filter((vehicle) => completed.some((item) => item.vehicleId === vehicle.id)).map((vehicle) => (
        <section key={vehicle.id}>
          <h2>{vehicleName(vehicle)}</h2>
          <div className="af-grid-2">
            {completed.filter((item) => item.vehicleId === vehicle.id).map((service) => (
              <Link className="af-service-card" to={`/history/${service.id}`} key={service.id}>
                <div className="af-card-line"><span className="af-kicker">{new Date(service.appointmentAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span><b>{formatInr(service.finalAmount ?? service.estimate)}</b></div>
                <h3>{service.serviceType}</h3><p>{service.centerName}</p><span>View report →</span>
              </Link>
            ))}
          </div>
        </section>
      ))}
    </section>
  );
}

export function MockHistoryDetailScreen() {
  const { id } = useParams();
  const { state } = useMockDomain();
  const service = state.services.find((item) => item.id === id && item.status === 'COMPLETED');
  if (!service) return <NotFound title="Completed service not found" back="/history" />;
  const vehicle = state.vehicles.find((item) => item.id === service.vehicleId);
  const invoice = state.invoices.find((item) => item.serviceId === service.id);
  return (
    <section className="af-screen af-wide">
      <PageHeader title="Service report" back="/history" />
      <article className="af-report-header"><div><span className="af-kicker">Digital service report</span><h2>{service.serviceType}</h2><p>{vehicleName(vehicle)} · {vehicle?.registrationNumber}</p></div><StatusPill tone="green">Completed</StatusPill></article>
      <div className="af-grid-main">
        <main>
          <div className="af-panel"><h3>Work performed</h3><ul>{service.workPerformed.map((item) => <li key={item}>{item}</li>)}</ul></div>
          <div className="af-panel"><h3>Parts replaced</h3><ul>{service.partsReplaced.map((item) => <li key={item}>{item}</li>)}</ul></div>
          <div className="af-panel"><h3>Service record</h3><p>Center: {service.centerName}</p><p>Date: {formatWhen(service.appointmentAt)}</p><p>Odometer: {service.odometer?.toLocaleString('en-IN')} km</p></div>
        </main>
        <aside className="af-panel"><h3>Charges</h3><div className="af-row"><span>Service and parts</span><b>{formatInr((service.finalAmount ?? service.estimate) - (service.laborCharge ?? 0) - (service.taxes ?? 0))}</b></div><div className="af-row"><span>Labour</span><b>{formatInr(service.laborCharge ?? 0)}</b></div><div className="af-row"><span>Taxes</span><b>{formatInr(service.taxes ?? 0)}</b></div><div className="af-total"><span>Total</span><b>{formatInr(service.finalAmount ?? service.estimate)}</b></div>{invoice ? <Link to={`/payments/${invoice.id}`}>View invoice →</Link> : null}</aside>
      </div>
    </section>
  );
}

export function MockDocumentsScreen() {
  const { state } = useMockDomain();
  const [filter, setFilter] = useState('All');
  const active = state.documents.filter((item) => item.status === 'ACTIVE' && (filter === 'All' || item.category === filter));
  const categories = ['All', ...new Set(state.documents.map((item) => item.category))];
  return (
    <section className="af-screen af-wide">
      <PageHeader title="Document vault" action={<Link className="af-skip" to="/documents/new">Add document</Link>} />
      <DemoNotice>Files are represented by metadata only; preview and download are not connected to cloud storage.</DemoNotice>
      <div className="af-chips">{categories.map((category) => <button className={`af-chip ${filter === category ? 'on' : ''}`} key={category} onClick={() => setFilter(category)}>{category}</button>)}</div>
      <div className="af-grid-2 af-content-gap">
        {active.map((document) => <DocumentCard document={document} key={document.id} vehicle={state.vehicles.find((item) => item.id === document.vehicleId)} />)}
      </div>
    </section>
  );
}

function DocumentCard({ document, vehicle }: { document: VaultDocument; vehicle?: Vehicle }) {
  return (
    <Link className="af-document-card" to={`/documents/${document.id}`}>
      <span className="af-document-icon">▤</span>
      <div><StatusPill>{document.category}</StatusPill><h3>{document.title}</h3><p>{vehicleName(vehicle)} · {document.fileName}</p>{document.expiryDate ? <b>Expires {document.expiryDate}</b> : <span>No expiry date</span>}</div>
    </Link>
  );
}

export function MockDocumentAddScreen() {
  const { state, addDocument } = useMockDomain();
  const navigate = useNavigate();
  const [form, setForm] = useState({ title: '', category: 'Insurance' as VaultDocument['category'], vehicleId: state.vehicles[0]?.id ?? '', expiryDate: '', fileName: '' });
  return (
    <section className="af-screen af-form">
      <PageHeader title="Add document metadata" back="/documents" />
      <DemoNotice>No file is uploaded. This creates a metadata-only vault entry.</DemoNotice>
      <form onSubmit={(event) => { event.preventDefault(); const document = addDocument({ ...form, vehicleId: form.vehicleId || undefined, expiryDate: form.expiryDate || undefined, fileName: form.fileName || 'demo-document.pdf', fileSize: '860 KB (mock)' }); navigate(`/documents/${document.id}`, { replace: true }); }}>
        <label className="af-field">Document title<input required value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="Insurance policy" /></label>
        <label className="af-field">Category<select value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value as VaultDocument['category'] })}>{['RC', 'Insurance', 'PUC', 'Invoice', 'Warranty', 'Driving licence', 'Other'].map((item) => <option key={item}>{item}</option>)}</select></label>
        <label className="af-field">Vehicle<select value={form.vehicleId} onChange={(event) => setForm({ ...form, vehicleId: event.target.value })}><option value="">Customer-level document</option>{state.vehicles.filter((item) => item.status === 'ACTIVE').map((item) => <option value={item.id} key={item.id}>{vehicleName(item)}</option>)}</select></label>
        <label className="af-field">Mock file name<input value={form.fileName} onChange={(event) => setForm({ ...form, fileName: event.target.value })} placeholder="insurance-policy.pdf" /></label>
        <label className="af-field">Expiry date (optional)<input type="date" value={form.expiryDate} onChange={(event) => setForm({ ...form, expiryDate: event.target.value })} /></label>
        <button className="af-btn">Save mock metadata</button>
      </form>
    </section>
  );
}

export function MockDocumentDetailScreen() {
  const { id } = useParams();
  const { state, archiveDocument } = useMockDomain();
  const navigate = useNavigate();
  const document = state.documents.find((item) => item.id === id);
  if (!document) return <NotFound title="Document not found" back="/documents" />;
  const vehicle = state.vehicles.find((item) => item.id === document.vehicleId);
  return (
    <section className="af-screen af-form">
      <PageHeader title="Document details" back="/documents" />
      <div className="af-document-preview">▤<span>Preview unavailable in mock mode</span></div>
      <div className="af-panel"><StatusPill>{document.category}</StatusPill><h2>{document.title}</h2><p>{vehicleName(vehicle)}</p><dl className="af-detail-list"><div><dt>File</dt><dd>{document.fileName}</dd></div><div><dt>Size</dt><dd>{document.fileSize}</dd></div><div><dt>Added</dt><dd>{document.addedAt}</dd></div><div><dt>Expiry</dt><dd>{document.expiryDate ?? 'Not set'}</dd></div></dl></div>
      <DemoNotice>Download and replace need signed storage URLs in the future API.</DemoNotice>
      {document.status === 'ACTIVE' ? <button className="af-text-danger" onClick={() => { archiveDocument(document.id); navigate('/documents'); }}>Archive document</button> : <StatusPill tone="gray">Archived</StatusPill>}
    </section>
  );
}

export function MockMaintenanceScreen() {
  const { state } = useMockDomain();
  return (
    <section className="af-screen af-wide">
      <PageHeader title="Maintenance" />
      <p className="af-sub">Rule-based demo reminders from dates, mileage, and recorded service history. No predictions or health scores.</p>
      {state.vehicles.filter((vehicle) => vehicle.status === 'ACTIVE').map((vehicle) => (
        <section key={vehicle.id}><h2>{vehicleName(vehicle)}</h2><div className="af-grid-2">{state.maintenance.filter((item) => item.vehicleId === vehicle.id).map((item) => <Link className="af-maintenance-card" to={`/maintenance/${item.id}`} key={item.id}><div className="af-card-line"><StatusPill tone={item.status === 'OVERDUE' ? 'orange' : item.status === 'COMPLETED' ? 'green' : 'blue'}>{item.status}</StatusPill><span>→</span></div><h3>{item.title}</h3><p>{item.dueMileage ? `Due at ${item.dueMileage.toLocaleString('en-IN')} km` : `Due ${item.dueDate}`}</p><span>{item.interval}</span></Link>)}</div></section>
      ))}
    </section>
  );
}

export function MockMaintenanceDetailScreen() {
  const { id } = useParams();
  const { state, snoozeMaintenance, completeMaintenance } = useMockDomain();
  const item = state.maintenance.find((entry) => entry.id === id);
  if (!item) return <NotFound title="Reminder not found" back="/maintenance" />;
  const vehicle = state.vehicles.find((entry) => entry.id === item.vehicleId);
  return (
    <section className="af-screen af-form">
      <PageHeader title="Maintenance details" back="/maintenance" />
      <StatusPill tone={item.status === 'OVERDUE' ? 'orange' : item.status === 'COMPLETED' ? 'green' : 'blue'}>{item.status}</StatusPill>
      <h2>{item.title}</h2><p className="af-sub">{vehicleName(vehicle)}</p>
      <div className="af-panel"><h3>Due</h3><p>{item.dueDate ?? 'Mileage-based'}{item.dueMileage ? ` · ${item.dueMileage.toLocaleString('en-IN')} km` : ''}</p><h3>Last completed</h3><p>{item.lastCompleted}</p><h3>Recommended interval</h3><p>{item.interval}</p><h3>Why it matters</h3><p>{item.notes}</p></div>
      <Link className="af-btn" to={`/services/book/vehicle?vehicleId=${item.vehicleId}`}>Book service</Link>
      <button className="af-btn secondary" onClick={() => completeMaintenance(item.id)}>Mark completed in demo</button>
      <button className="af-btn ghost" onClick={() => snoozeMaintenance(item.id)}>Snooze demo reminder</button>
    </section>
  );
}

export function MockPaymentsScreen() {
  const { state } = useMockDomain();
  const due = state.invoices.filter((item) => item.status === 'DUE').reduce((sum, item) => sum + item.amount, 0);
  return (
    <section className="af-screen af-wide">
      <PageHeader title="Payments & invoices" />
      <DemoNotice>Checkout is simulated. No payment gateway or real transaction is used.</DemoNotice>
      <article className="af-payment-total"><span>Outstanding</span><b>{formatInr(due)}</b><small>{state.invoices.filter((item) => item.status === 'DUE').length} invoice(s)</small></article>
      <div className="af-grid-2 af-content-gap">{state.invoices.map((invoice) => {
        const service = state.services.find((item) => item.id === invoice.serviceId);
        const vehicle = state.vehicles.find((item) => item.id === service?.vehicleId);
        return <Link className="af-service-card" to={`/payments/${invoice.id}`} key={invoice.id}><div className="af-card-line"><span className="af-kicker">{invoice.number}</span><StatusPill tone={invoice.status === 'PAID' ? 'green' : 'orange'}>{invoice.status}</StatusPill></div><h3>{formatInr(invoice.amount)}</h3><p>{service?.serviceType} · {vehicleName(vehicle)}</p><span>View invoice →</span></Link>;
      })}</div>
    </section>
  );
}

export function MockPaymentDetailScreen() {
  const { id } = useParams();
  const { state, payInvoice } = useMockDomain();
  const invoice = state.invoices.find((item) => item.id === id);
  if (!invoice) return <NotFound title="Invoice not found" back="/payments" />;
  const service = state.services.find((item) => item.id === invoice.serviceId);
  const [paidNow, setPaidNow] = useState(false);
  return (
    <section className="af-screen af-form">
      <PageHeader title={invoice.status === 'PAID' || paidNow ? 'Payment receipt' : 'Mock checkout'} back="/payments" />
      <DemoNotice>No real payment will be processed or charged.</DemoNotice>
      <div className="af-panel"><span className="af-kicker">{invoice.number}</span><h2>{service?.serviceType}</h2><div className="af-row"><span>Initial service estimate</span><b>{formatInr(service?.estimate ?? invoice.amount)}</b></div>{service?.recommendations.filter((item) => item.status === 'APPROVED').map((item) => <div className="af-row" key={item.id}><span>{item.title}</span><b>{formatInr(item.estimatedCost)}</b></div>)}<div className="af-total"><span>Total payable</span><b>{formatInr(invoice.amount)}</b></div></div>
      {invoice.status === 'DUE' && !paidNow ? <button className="af-btn" onClick={() => { payInvoice(invoice.id); setPaidNow(true); }}>Simulate payment success</button> : <div className="af-success"><div className="af-check">✓</div><h2>Mock payment recorded</h2><p>{invoice.transactionReference ?? 'A local transaction reference has been created.'}</p><Link to={`/services/${invoice.serviceId}`}>Return to service</Link></div>}
    </section>
  );
}

export function MockNotificationsScreen() {
  const { state, markNotificationRead } = useMockDomain();
  return (
    <section className="af-screen af-wide">
      <PageHeader title="Notifications" back="/home" />
      <div className="af-notification-list">{state.notifications.map((notification) => <Link className={notification.read ? 'read' : ''} to={notification.href} key={notification.id} onClick={() => markNotificationRead(notification.id)}><i /><div><span>{notification.category}</span><h3>{notification.title}</h3><p>{notification.body}</p><small>{formatWhen(notification.createdAt)}</small></div></Link>)}</div>
    </section>
  );
}

export function MockProfileScreen() {
  const { state, updateProfile, resetDemo } = useMockDomain();
  const [form, setForm] = useState(state.profile);
  const [saved, setSaved] = useState(false);
  return (
    <section className="af-screen af-form">
      <PageHeader title="Profile" />
      {saved ? <div className="af-success-banner">Profile saved locally.</div> : null}
      <form onSubmit={(event) => { event.preventDefault(); updateProfile(form); setSaved(true); }}>
        <label className="af-field">Full name<input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label>
        <label className="af-field">Email<input type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></label>
        <label className="af-field">Phone<input value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} /></label>
        <label className="af-field">City<input value={form.city} onChange={(event) => setForm({ ...form, city: event.target.value })} /></label>
        <button className="af-btn">Save profile</button>
      </form>
      <div className="af-link-list"><Link to="/profile/addresses"><b>Addresses</b><span>Pickup locations →</span></Link><Link to="/profile/preferences"><b>Preferences</b><span>Updates and reminders →</span></Link><Link to="/support"><b>Help & support</b><span>FAQs and contact →</span></Link></div>
      <div className="af-panel"><h3>Demo controls</h3><p>Restore deterministic vehicles, services, documents, and notifications.</p><button className="af-btn secondary" onClick={() => { if (window.confirm('Reset all local demo changes?')) { resetDemo(); window.location.assign('/home'); } }}>Reset demo data</button></div>
    </section>
  );
}

export function MockAddressesScreen() {
  const { state, addAddress, removeAddress } = useMockDomain();
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ label: 'Other', line: '', city: 'Bengaluru, Karnataka', phone: state.profile.phone, isDefault: false });
  return (
    <section className="af-screen af-form">
      <PageHeader title="Addresses" back="/profile" action={<button className="af-skip" onClick={() => setAdding(!adding)}>Add</button>} />
      {adding ? <form className="af-panel" onSubmit={(event) => { event.preventDefault(); addAddress(form); setAdding(false); }}><label className="af-field">Label<input value={form.label} onChange={(event) => setForm({ ...form, label: event.target.value })} /></label><label className="af-field">Address<input required value={form.line} onChange={(event) => setForm({ ...form, line: event.target.value })} /></label><label className="af-field">City<input value={form.city} onChange={(event) => setForm({ ...form, city: event.target.value })} /></label><label className="af-checkrow"><input type="checkbox" checked={form.isDefault} onChange={(event) => setForm({ ...form, isDefault: event.target.checked })} /> Set as default pickup address</label><button className="af-btn">Save address</button></form> : null}
      {state.addresses.map((address) => <article className="af-panel" key={address.id}><div className="af-card-line"><h3>{address.label}</h3>{address.isDefault ? <StatusPill tone="green">Default</StatusPill> : null}</div><p>{address.line}<br />{address.city}<br />{address.phone}</p>{!address.isDefault ? <button className="af-text-danger" onClick={() => removeAddress(address.id)}>Remove</button> : null}</article>)}
    </section>
  );
}

export function MockPreferencesScreen() {
  const { state, updateProfile } = useMockDomain();
  const [form, setForm] = useState(state.profile);
  return (
    <section className="af-screen af-form">
      <PageHeader title="Preferences" back="/profile" />
      <label className="af-field">Preferred communication<select value={form.communication} onChange={(event) => setForm({ ...form, communication: event.target.value as typeof form.communication })}><option>WhatsApp</option><option>SMS</option><option>Email</option></select></label>
      {[['serviceUpdates', 'Service status updates'], ['maintenanceReminders', 'Maintenance reminders'], ['documentReminders', 'Document expiry reminders']].map(([key, label]) => <label className="af-toggle" key={key}><span><b>{label}</b><small>Manage this demo preference.</small></span><input type="checkbox" checked={Boolean(form[key as keyof typeof form])} onChange={(event) => setForm({ ...form, [key]: event.target.checked })} /></label>)}
      <button className="af-btn" onClick={() => updateProfile(form)}>Save preferences</button>
    </section>
  );
}

export function MockSupportScreen() {
  const [sent, setSent] = useState(false);
  return (
    <section className="af-screen af-wide">
      <PageHeader title="Help & support" />
      <div className="af-grid-main">
        <main>
          <h2>Frequently asked</h2>
          {['How do I change a booking?', 'What happens after I approve extra work?', 'Where are my documents stored?', 'How do demo payments work?'].map((question) => <details className="af-panel" key={question}><summary>{question}</summary><p>This mock demonstrates the customer flow. Real fulfillment, secure storage, center communication, and payments require backend integrations.</p></details>)}
        </main>
        <aside className="af-panel"><h2>Contact support</h2><p>Describe what you need and this demo will record a visual success state only.</p><label className="af-field">Topic<select><option>Service help</option><option>Payments</option><option>Vehicle</option><option>Documents</option></select></label><label className="af-field">Message<textarea placeholder="How can we help?" /></label>{sent ? <div className="af-success-banner">Demo support request recorded. Nothing was sent.</div> : <button className="af-btn" onClick={() => setSent(true)}>Submit mock request</button>}</aside>
      </div>
    </section>
  );
}

function NotFound({ title, back }: { title: string; back: string }) {
  return <section className="af-screen af-form"><div className="af-empty"><h2>{title}</h2><Link className="af-btn" to={back}>Go back</Link></div></section>;
}
