import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useDomain } from '../domain/DomainProvider';
import type { VehicleInput } from '../domain/client';
import {
  expiryLabel,
  formatDate,
  maintenanceStateLabel,
  serviceStatusLabel,
  vaultCategoryLabel,
  type Vehicle,
} from '../domain/model';
import {
  ErrorText,
  NotFound,
  PageHeader,
  StatusPill,
  expiryTone,
  maintenanceTone,
  serviceTone,
  useAction,
} from './ui';

const glyph = (vehicle: Vehicle) => (vehicle.vehicleType === 'TWO_WHEELER' ? '🛵' : '🚙');

export function VehicleListScreen() {
  const { state } = useDomain();
  const active = state.vehicles.filter((item) => item.status === 'ACTIVE');
  const archived = state.vehicles.filter((item) => item.status === 'ARCHIVED');
  return (
    <section className="af-screen af-wide">
      <PageHeader title="My vehicles" action={<Link className="af-skip" to="/vehicles/new">Add vehicle</Link>} />
      <p className="af-sub">Every service, document, reminder and bill stays linked to a vehicle.</p>
      <div className="af-grid-2 af-content-gap">
        {active.map((vehicle) => (
          <Link className="af-vehicle-card" to={`/vehicles/${vehicle.id}`} key={vehicle.id}>
            <div className="af-card-line">
              <div>
                <h3>{vehicle.label}</h3>
                <span className="af-plate">{vehicle.registrationNumber}</span>
              </div>
              <span className="af-vehicle-glyph">{glyph(vehicle)}</span>
            </div>
            <p className="af-meta">
              {[vehicle.variant, vehicle.year, vehicle.fuel].filter(Boolean).join(' · ')}
            </p>
            {vehicle.mileage !== null ? <p><b>{vehicle.mileage.toLocaleString('en-IN')} km</b></p> : null}
          </Link>
        ))}
        {active.length === 0 ? (
          <Link className="af-vehicle-card" to="/vehicles/new">
            <h3>Add your first vehicle</h3>
            <p className="af-meta">It takes under a minute.</p>
          </Link>
        ) : null}
      </div>
      {archived.length ? (
        <details className="af-panel">
          <summary>Archived vehicles ({archived.length})</summary>
          {archived.map((vehicle) => (
            <p key={vehicle.id}>
              <Link to={`/vehicles/${vehicle.id}`}>{vehicle.label} · {vehicle.registrationNumber}</Link>
            </p>
          ))}
        </details>
      ) : null}
    </section>
  );
}

type VehicleForm = {
  vehicleType: VehicleInput['vehicleType'];
  registrationNumber: string;
  make: string;
  model: string;
  variant: string;
  year: string;
  fuel: string;
  transmission: string;
  color: string;
  odometer: string;
  purchaseDate: string;
};

const emptyForm: VehicleForm = {
  vehicleType: 'FOUR_WHEELER',
  registrationNumber: '',
  make: '',
  model: '',
  variant: '',
  year: '',
  fuel: 'Petrol',
  transmission: 'Manual',
  color: '',
  odometer: '',
  purchaseDate: '',
};

function toForm(vehicle: Vehicle): VehicleForm {
  return {
    vehicleType: vehicle.vehicleType,
    registrationNumber: vehicle.registrationNumber,
    make: vehicle.make,
    model: vehicle.model,
    variant: vehicle.variant ?? '',
    year: vehicle.year ? String(vehicle.year) : '',
    fuel: vehicle.fuel ?? '',
    transmission: vehicle.transmission ?? '',
    color: vehicle.color ?? '',
    odometer: vehicle.currentOdometerKm !== null ? String(vehicle.currentOdometerKm) : '',
    purchaseDate: vehicle.purchaseDate ?? '',
  };
}

function toInput(form: VehicleForm): VehicleInput {
  const optional = (value: string) => value.trim() || undefined;
  return {
    vehicleType: form.vehicleType,
    registrationNumber: form.registrationNumber.replace(/\s+/g, '').toUpperCase(),
    make: form.make.trim(),
    model: form.model.trim(),
    variant: optional(form.variant),
    year: form.year ? Number(form.year) : undefined,
    fuel: optional(form.fuel),
    transmission: form.vehicleType === 'TWO_WHEELER' ? undefined : optional(form.transmission),
    color: optional(form.color),
    currentOdometerKm: form.odometer ? Number(form.odometer) : undefined,
    purchaseDate: optional(form.purchaseDate),
  };
}

function VehicleFields({ form, setForm }: { form: VehicleForm; setForm: (form: VehicleForm) => void }) {
  const set = (key: keyof VehicleForm) => (event: { target: { value: string } }) =>
    setForm({ ...form, [key]: event.target.value });
  return (
    <div className="af-form-grid">
      <label className="af-field">
        Vehicle type
        <select value={form.vehicleType} onChange={set('vehicleType')}>
          <option value="FOUR_WHEELER">Car</option>
          <option value="TWO_WHEELER">Two-wheeler</option>
        </select>
      </label>
      <label className="af-field">
        Registration number
        <input
          required
          value={form.registrationNumber}
          onChange={(event) => setForm({ ...form, registrationNumber: event.target.value.toUpperCase() })}
          placeholder="KA05AB1234"
        />
      </label>
      <label className="af-field">
        Make
        <input required value={form.make} onChange={set('make')} placeholder="Hyundai" />
      </label>
      <label className="af-field">
        Model
        <input required value={form.model} onChange={set('model')} placeholder="i20" />
      </label>
      <label className="af-field">
        Variant
        <input value={form.variant} onChange={set('variant')} placeholder="Asta" />
      </label>
      <label className="af-field">
        Year
        <input inputMode="numeric" value={form.year} onChange={set('year')} placeholder="2022" />
      </label>
      <label className="af-field">
        Fuel
        <select value={form.fuel} onChange={set('fuel')}>
          <option>Petrol</option>
          <option>Diesel</option>
          <option>CNG</option>
          <option>Electric</option>
          <option>Hybrid</option>
        </select>
      </label>
      {form.vehicleType === 'FOUR_WHEELER' ? (
        <label className="af-field">
          Transmission
          <select value={form.transmission} onChange={set('transmission')}>
            <option>Manual</option>
            <option>Automatic</option>
          </select>
        </label>
      ) : null}
      <label className="af-field">
        Odometer (km)
        <input inputMode="numeric" value={form.odometer} onChange={set('odometer')} placeholder="12000" />
      </label>
      <label className="af-field">
        Colour
        <input value={form.color} onChange={set('color')} />
      </label>
      <label className="af-field">
        Purchase date
        <input type="date" value={form.purchaseDate} onChange={set('purchaseDate')} />
      </label>
    </div>
  );
}

export function VehicleAddScreen() {
  const { addVehicle } = useDomain();
  const navigate = useNavigate();
  const [form, setForm] = useState<VehicleForm>(emptyForm);
  const { busy, error, run } = useAction();

  function save(event: FormEvent) {
    event.preventDefault();
    void run(async () => {
      const vehicle = await addVehicle(toInput(form));
      navigate(`/vehicles/${vehicle.id}?added=1`, { replace: true });
    });
  }

  return (
    <section className="af-screen af-form">
      <PageHeader title="Add vehicle" back="/vehicles" />
      <form onSubmit={save}>
        <VehicleFields form={form} setForm={setForm} />
        <ErrorText error={error} />
        <button className="af-btn" type="submit" disabled={busy}>
          {busy ? 'Saving…' : 'Save vehicle'}
        </button>
      </form>
    </section>
  );
}

export function VehicleEditScreen() {
  const { id } = useParams();
  const { state, updateVehicle } = useDomain();
  const navigate = useNavigate();
  const vehicle = state.vehicles.find((item) => item.id === id);
  const [form, setForm] = useState<VehicleForm | null>(vehicle ? toForm(vehicle) : null);
  const { busy, error, run } = useAction();
  if (!vehicle || !form) return <NotFound title="Vehicle not found" back="/vehicles" />;

  function save(event: FormEvent) {
    event.preventDefault();
    if (!vehicle || !form) return;
    const { vehicleType: _type, ...changes } = toInput(form);
    void run(async () => {
      await updateVehicle(vehicle.id, changes);
      navigate(`/vehicles/${vehicle.id}`);
    });
  }

  return (
    <section className="af-screen af-form">
      <PageHeader title="Edit vehicle" back={`/vehicles/${vehicle.id}`} />
      <form onSubmit={save}>
        <VehicleFields form={form} setForm={setForm} />
        <ErrorText error={error} />
        <button className="af-btn" type="submit" disabled={busy}>
          {busy ? 'Saving…' : 'Save changes'}
        </button>
      </form>
    </section>
  );
}

export function VehicleDetailScreen() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const { state, archiveVehicle, restoreVehicle } = useDomain();
  const navigate = useNavigate();
  const { busy, error, run } = useAction();
  const vehicle = state.vehicles.find((item) => item.id === id);
  if (!vehicle) return <NotFound title="Vehicle not found" back="/vehicles" />;
  const services = state.services.filter((item) => item.vehicleId === vehicle.id);
  const active = services.find((item) => item.isActive);
  const documents = state.documents.filter((item) => item.vehicle?.id === vehicle.id);
  const maintenance = state.maintenance.filter(
    (item) => item.vehicle.id === vehicle.id && item.state !== 'COMPLETED',
  );

  return (
    <section className="af-screen af-wide">
      <PageHeader
        title={vehicle.label}
        back="/vehicles"
        action={<Link className="af-skip" to={`/vehicles/${vehicle.id}/edit`}>Edit</Link>}
      />
      {params.get('added') ? <div className="af-success-banner">Vehicle added to your garage.</div> : null}
      {vehicle.status === 'ARCHIVED' ? <p className="af-note">This vehicle is archived. Its history stays available.</p> : null}
      <article className="af-vehicle-hero">
        <div>
          <span className="af-plate">{vehicle.registrationNumber}</span>
          <h2>{vehicle.variant ?? vehicle.model}</h2>
          <p>{[vehicle.year, vehicle.fuel, vehicle.transmission].filter(Boolean).join(' · ')}</p>
        </div>
        <div className="af-odometer">
          <b>{vehicle.mileage !== null ? vehicle.mileage.toLocaleString('en-IN') : '—'}</b>
          <span>km</span>
        </div>
      </article>
      {vehicle.status === 'ACTIVE' ? (
        <div className="af-inline-actions af-action-bar">
          <Link className="af-btn" to={`/services/book/vehicle?vehicleId=${vehicle.id}`}>Book service</Link>
          {active ? (
            <Link className="af-btn secondary" to={`/services/${active.id}`}>Track service</Link>
          ) : null}
        </div>
      ) : null}

      <div className="af-grid-3 af-content-gap">
        <div className="af-panel">
          <span className="af-kicker">Maintenance</span>
          {maintenance.length ? (
            maintenance.slice(0, 3).map((item) => (
              <p key={item.id}>
                <Link to={`/maintenance/${item.id}`}>{item.title}</Link>{' '}
                <StatusPill tone={maintenanceTone(item.state)}>{maintenanceStateLabel(item.state)}</StatusPill>
              </p>
            ))
          ) : (
            <p>No reminders</p>
          )}
          <Link to={`/maintenance/new?vehicleId=${vehicle.id}`}>Add reminder →</Link>
        </div>
        <div className="af-panel">
          <span className="af-kicker">Documents</span>
          {documents.length ? (
            documents.map((doc) => (
              <p key={doc.id}>
                <Link to={`/documents/${doc.id}`}>{vaultCategoryLabel(doc.category)}</Link>{' '}
                <StatusPill tone={expiryTone(doc.expiryState)}>{expiryLabel(doc)}</StatusPill>
              </p>
            ))
          ) : (
            <p>No documents yet</p>
          )}
          <Link to={`/documents/new?vehicleId=${vehicle.id}`}>Add document →</Link>
        </div>
        <div className="af-panel">
          <span className="af-kicker">Services</span>
          <h3>{services.length} record{services.length === 1 ? '' : 's'}</h3>
          <Link to="/history">Service history →</Link>
        </div>
      </div>

      <h2>Service timeline</h2>
      {services.length ? (
        <div className="af-timeline">
          {services.map((service) => (
            <div key={service.id}>
              <i />
              <p>
                <b>
                  <Link to={`/services/${service.id}`}>{service.title}</Link>
                </b>
                <span>
                  <StatusPill tone={serviceTone(service.status)}>{serviceStatusLabel(service.status)}</StatusPill>{' '}
                  {formatDate(service.closedAt ?? service.appointmentAt)} · {service.centerName}
                </span>
              </p>
            </div>
          ))}
        </div>
      ) : (
        <p className="af-sub">No services yet.</p>
      )}

      <ErrorText error={error} />
      {vehicle.status === 'ACTIVE' ? (
        <button
          className="af-text-danger"
          disabled={busy || Boolean(active)}
          title={active ? 'Finish the active service first' : undefined}
          onClick={() => {
            if (!window.confirm('Archive this vehicle? Its history stays available.')) return;
            void run(async () => {
              await archiveVehicle(vehicle.id);
              navigate('/vehicles');
            });
          }}
        >
          Archive vehicle
        </button>
      ) : (
        <button className="af-btn secondary" disabled={busy} onClick={() => void run(() => restoreVehicle(vehicle.id))}>
          Restore vehicle
        </button>
      )}
    </section>
  );
}
