import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { BodyMark, FuelMark } from '../components/VehicleMarks';
import { useDomain } from '../domain/DomainProvider';
import { customerApi, type VehicleInput } from '../domain/client';
import { getDraft } from '../lib/booking';
import type { ApiCatalogConfiguration, ApiVehicleCatalog } from '../domain/api-types';
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
            {vehicle.mileage !== null ? (
              <p>
                <b>{vehicle.mileage.toLocaleString('en-IN')} km</b>
              </p>
            ) : null}
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
  catalogConfigurationId: string;
  makeId: string;
  modelId: string;
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
  catalogConfigurationId: '',
  makeId: '',
  modelId: '',
  registrationNumber: '',
  make: '',
  model: '',
  variant: '',
  year: '',
  fuel: 'Petrol',
  transmission: '',
  color: '',
  odometer: '',
  purchaseDate: '',
};

function toForm(vehicle: Vehicle): VehicleForm {
  return {
    vehicleType: vehicle.vehicleType,
    catalogConfigurationId: vehicle.catalogConfigurationId ?? '',
    makeId: '',
    modelId: '',
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
  const shared = {
    vehicleType: form.vehicleType,
    registrationNumber: form.registrationNumber.replace(/\s+/g, '').toUpperCase(),
    year: form.year ? Number(form.year) : undefined,
    color: optional(form.color),
    currentOdometerKm: form.odometer ? Number(form.odometer) : undefined,
    purchaseDate: optional(form.purchaseDate),
  };
  if (form.vehicleType === 'FOUR_WHEELER' && form.catalogConfigurationId) {
    return {
      ...shared,
      catalogConfigurationId: form.catalogConfigurationId,
      make: form.make,
      model: form.model,
      variant: optional(form.variant),
      fuel: optional(form.fuel),
      transmission: optional(form.transmission),
    };
  }
  return {
    ...shared,
    make: form.make.trim(),
    model: form.model.trim(),
    variant: optional(form.variant),
    fuel: optional(form.fuel),
    transmission: form.vehicleType === 'FOUR_WHEELER' ? optional(form.transmission) : undefined,
  };
}

function VehicleFields({
  form,
  setForm,
  useCatalog,
  fixedVehicleType,
}: {
  form: VehicleForm;
  setForm: (form: VehicleForm) => void;
  useCatalog: boolean;
  fixedVehicleType?: VehicleInput['vehicleType'];
}) {
  const [catalog, setCatalog] = useState<ApiVehicleCatalog | null>(null);
  const [catalogError, setCatalogError] = useState('');
  const set = (key: keyof VehicleForm) => (event: { target: { value: string } }) =>
    setForm({ ...form, [key]: event.target.value });

  useEffect(() => {
    let cancelled = false;
    customerApi.vehicleCatalog().then(
      (tree) => {
        if (!cancelled) setCatalog(tree);
      },
      () => {
        if (!cancelled) setCatalogError('The car list could not be loaded.');
      },
    );
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!catalog || !form.catalogConfigurationId || form.makeId) return;
    for (const make of catalog.makes) {
      for (const model of make.models) {
        const match = model.configurations.find((item) => item.id === form.catalogConfigurationId);
        if (!match) continue;
        setForm({
          ...form,
          makeId: make.id,
          modelId: model.id,
          make: make.name,
          model: model.name,
          variant: match.variant,
          fuel: match.fuel,
          transmission: match.gearboxCode,
        });
        return;
      }
    }
  }, [catalog, form, setForm]);

  const selectedMake = catalog?.makes.find((make) => make.id === form.makeId);
  const selectedModel = selectedMake?.models.find((model) => model.id === form.modelId);
  const selectedConfiguration = selectedModel?.configurations.find(
    (configuration) => configuration.id === form.catalogConfigurationId,
  );
  const colourOptions = selectedConfiguration?.colours ?? [];

  function chooseMake(makeId: string) {
    setForm({
      ...form,
      makeId,
      modelId: '',
      catalogConfigurationId: '',
      make: '',
      model: '',
      variant: '',
      fuel: '',
      transmission: '',
    });
  }

  function chooseModel(modelId: string) {
    setForm({
      ...form,
      modelId,
      catalogConfigurationId: '',
      model: '',
      variant: '',
      fuel: '',
      transmission: '',
    });
  }

  function chooseConfiguration(configuration: ApiCatalogConfiguration, makeName: string, modelName: string) {
    const colours = configuration.colours ?? [];
    setForm({
      ...form,
      catalogConfigurationId: configuration.id,
      make: makeName,
      model: modelName,
      variant: configuration.variant,
      fuel: configuration.fuel,
      transmission: configuration.gearboxCode,
      color: colours.includes(form.color) ? form.color : '',
    });
  }

  return (
    <div className="af-form-grid">
      <label className="af-field">
        Vehicle type
        <select
          value={form.vehicleType}
          disabled={Boolean(fixedVehicleType)}
          onChange={(event) =>
            setForm({
              ...form,
              vehicleType: event.target.value as VehicleForm['vehicleType'],
              catalogConfigurationId: '',
              makeId: '',
              modelId: '',
              make: '',
              model: '',
              variant: '',
              fuel: event.target.value === 'TWO_WHEELER' ? 'Petrol' : '',
              transmission: '',
            })
          }
        >
          <option value="FOUR_WHEELER">Four-wheeler</option>
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
      {form.vehicleType === 'FOUR_WHEELER' && useCatalog ? (
        <>
          <label className="af-field">
            Make
            <select required value={form.makeId} onChange={(event) => chooseMake(event.target.value)}>
              <option value="">Choose a make</option>
              {catalog?.makes.map((make) => (
                <option key={make.id} value={make.id}>{make.name}</option>
              ))}
            </select>
          </label>
          {catalogError ? <p className="af-error">{catalogError}</p> : null}
          {selectedMake ? (
            <div className="af-field">
              Model
              <div className="af-choice-grid">
                {selectedMake.models.map((model) => (
                  <button
                    key={model.id}
                    className={model.id === form.modelId ? 'af-catalog-choice on' : 'af-catalog-choice'}
                    type="button"
                    onClick={() => chooseModel(model.id)}
                  >
                    <BodyMark style={model.bodyStyle} />
                    <span>{model.name}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : null}
          {selectedModel ? (
            <div className="af-field">
              Variant
              <div className="af-choice-grid">
                {selectedModel.configurations.map((configuration) => (
                  <button
                    key={configuration.id}
                    className={configuration.id === form.catalogConfigurationId ? 'af-catalog-choice on' : 'af-catalog-choice'}
                    type="button"
                    onClick={() => chooseConfiguration(configuration, selectedMake?.name ?? '', selectedModel.name)}
                  >
                    <FuelMark fuel={configuration.fuel} />
                    <span>
                      {configuration.variant}
                      <small>{configuration.fuel} · {configuration.gearboxCode}</small>
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </>
      ) : (
        <>
          <label className="af-field">
            Make
            <input required value={form.make} onChange={set('make')} placeholder="Honda" />
          </label>
          <label className="af-field">
            Model
            <input required value={form.model} onChange={set('model')} placeholder="Activa" />
          </label>
          <label className="af-field">
            Variant
            <input value={form.variant} onChange={set('variant')} />
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
              Gearbox
              <input value={form.transmission} onChange={set('transmission')} placeholder="5MT" />
            </label>
          ) : null}
        </>
      )}
      <label className="af-field">
        Year
        <input inputMode="numeric" value={form.year} onChange={set('year')} placeholder="2022" />
      </label>
      <label className="af-field">
        Odometer (km)
        <input inputMode="numeric" value={form.odometer} onChange={set('odometer')} placeholder="12000" />
      </label>
      <label className="af-field">
        Colour
        {form.vehicleType === 'FOUR_WHEELER' && colourOptions.length > 0 ? (
          <select value={form.color} onChange={set('color')}>
            <option value="">Choose a colour</option>
            {form.color && !colourOptions.includes(form.color) ? (
              <option value={form.color}>{form.color}</option>
            ) : null}
            {colourOptions.map((name) => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
        ) : (
          <input value={form.color} onChange={set('color')} />
        )}
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
  const [params] = useSearchParams();
  const returnToBooking = params.get('return') === 'booking';
  const draft = getDraft();
  const requiredVehicleType = returnToBooking
    ? draft.compatibleVehicleTypes?.length === 1
      ? draft.compatibleVehicleTypes[0]
      : draft.requiredVehicleType
    : undefined;
  const [form, setForm] = useState<VehicleForm>(() => ({
    ...emptyForm,
    ...(requiredVehicleType
      ? {
          vehicleType: requiredVehicleType,
          fuel: requiredVehicleType === 'TWO_WHEELER' ? 'Petrol' : '',
        }
      : {}),
  }));
  const { busy, error, run } = useAction();

  function save(event: FormEvent) {
    event.preventDefault();
    void run(async () => {
      if (requiredVehicleType && form.vehicleType !== requiredVehicleType)
        throw new Error(
          'Add a vehicle compatible with your selected work, or return and change your selections.',
        );
      if (form.vehicleType === 'FOUR_WHEELER' && !form.catalogConfigurationId) {
        throw new Error('Choose the make, model, and variant.');
      }
      const vehicle = await addVehicle(toInput(form));
      navigate(
        returnToBooking
          ? `/services/book/vehicle?vehicleId=${vehicle.id}&resume=1`
          : `/vehicles/${vehicle.id}?added=1`,
        { replace: true },
      );
    });
  }

  return (
    <section className="af-screen af-form">
      <PageHeader
        title="Add vehicle"
        back={returnToBooking ? '/services/book/vehicle' : '/vehicles'}
      />
      <form onSubmit={save}>
        <VehicleFields
          form={form}
          setForm={setForm}
          useCatalog={form.vehicleType === 'FOUR_WHEELER'}
          fixedVehicleType={requiredVehicleType}
        />
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
        <VehicleFields
          form={form}
          setForm={setForm}
          useCatalog={Boolean(vehicle.catalogConfigurationId)}
        />
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
      {params.get('added') ? (
        <div className="af-success-banner">Vehicle added to your garage.</div>
      ) : null}
      {vehicle.status === 'ARCHIVED' ? (
        <p className="af-note">This vehicle is archived. Its history stays available.</p>
      ) : null}
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
