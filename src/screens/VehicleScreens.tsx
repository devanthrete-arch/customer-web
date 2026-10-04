import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { autoflex, type GarageVehicle } from '../lib/api';
import { patchDraft } from '../lib/booking';

export function VehicleListScreen() {
  const [vehicles, setVehicles] = useState<GarageVehicle[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void autoflex<GarageVehicle[]>('/v1/me/vehicles', {}, true)
      .then(setVehicles)
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : 'Could not load vehicles'),
      )
      .finally(() => setLoading(false));
  }, []);

  return (
    <section className="af-screen af-list">
      <div className="af-top">
        <h1 className="af-title">Vehicles</h1>
        <Link className="af-skip" to="/vehicles/new">
          Add
        </Link>
      </div>
      {loading ? <p className="af-hint">Loading vehicles…</p> : null}
      {error ? <p className="af-error">{error}</p> : null}
      {!loading && !error && vehicles.length === 0 ? (
        <div className="af-empty">
          <h2>No vehicles yet</h2>
          <p>Add the vehicle you want to service. You can add more later.</p>
          <Link className="af-btn" to="/vehicles/new">
            Add vehicle
          </Link>
        </div>
      ) : null}
      {vehicles.map((vehicle) => (
        <Link key={vehicle.id} className="af-card" to={`/vehicles/${vehicle.id}`}>
          <div className="af-card-body">
            <h3>
              {vehicle.make} {vehicle.model}
            </h3>
            <p className="af-meta">{vehicle.registrationNumber}</p>
            {vehicle.year ? <p className="af-meta">{vehicle.year}</p> : null}
          </div>
        </Link>
      ))}
    </section>
  );
}

export function VehicleAddScreen() {
  const navigate = useNavigate();
  const [make, setMake] = useState('');
  const [model, setModel] = useState('');
  const [year, setYear] = useState('');
  const [plate, setPlate] = useState('');
  const [fuel, setFuel] = useState('');
  const [transmission, setTransmission] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (!make.trim() || !model.trim() || !plate.trim()) {
      setError('Make, model, and registration are required.');
      return;
    }
    setBusy(true);
    try {
      const created = await autoflex<GarageVehicle>(
        '/v1/me/vehicles',
        {
          method: 'POST',
          body: JSON.stringify({
            vehicleType: 'TWO_WHEELER',
            make: make.trim(),
            model: model.trim(),
            year: year ? Number(year) : undefined,
            registrationNumber: plate.trim().toUpperCase(),
            fuel: fuel.trim() || undefined,
            transmission: transmission.trim() || undefined,
          }),
        },
        true,
      );
      navigate(`/vehicles/${created.id}`, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add vehicle');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="af-screen af-form">
      <div className="af-top">
        <button className="af-back" type="button" onClick={() => navigate('/vehicles')}>
          ‹
        </button>
        <h1 className="af-title">Add vehicle</h1>
      </div>
      <form onSubmit={onSubmit}>
        <label className="af-field">
          Make
          <input value={make} onChange={(e) => setMake(e.target.value)} placeholder="Honda" />
        </label>
        <label className="af-field">
          Model
          <input value={model} onChange={(e) => setModel(e.target.value)} placeholder="Activa" />
        </label>
        <label className="af-field">
          Year
          <input
            inputMode="numeric"
            value={year}
            onChange={(e) => setYear(e.target.value.replace(/\D/g, '').slice(0, 4))}
            placeholder="2022"
          />
        </label>
        <label className="af-field">
          Registration
          <input
            value={plate}
            onChange={(e) => setPlate(e.target.value.toUpperCase())}
            placeholder="KA01AB1234"
          />
        </label>
        <label className="af-field">
          Fuel
          <input value={fuel} onChange={(e) => setFuel(e.target.value)} placeholder="Petrol" />
        </label>
        <label className="af-field">
          Transmission
          <input
            value={transmission}
            onChange={(e) => setTransmission(e.target.value)}
            placeholder="Automatic"
          />
        </label>
        {error ? <p className="af-error">{error}</p> : null}
        <button className="af-btn" type="submit" disabled={busy}>
          Save vehicle
        </button>
      </form>
    </section>
  );
}

export function VehicleDetailScreen() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [vehicle, setVehicle] = useState<GarageVehicle | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void autoflex<GarageVehicle[]>('/v1/me/vehicles', {}, true)
      .then((list) => {
        const found = list.find((item) => item.id === id) ?? null;
        if (!found) setError('That vehicle is not on your account.');
        setVehicle(found);
      })
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : 'Could not load vehicle'),
      )
      .finally(() => setLoading(false));
  }, [id]);

  function book() {
    if (!vehicle) return;
    patchDraft({
      vehicleId: vehicle.id,
      vehicleLabel: `${vehicle.make} ${vehicle.model}`,
      vehicleType: vehicle.vehicleType,
    });
    navigate('/services/book/type');
  }

  return (
    <section className="af-screen af-form">
      <div className="af-top">
        <button className="af-back" type="button" onClick={() => navigate('/vehicles')}>
          ‹
        </button>
        <h1 className="af-title">Vehicle</h1>
      </div>
      {loading ? <p className="af-hint">Loading vehicle…</p> : null}
      {error ? <p className="af-error">{error}</p> : null}
      {vehicle ? (
        <article className="af-card">
          <div className="af-card-body">
            <h3>
              {vehicle.make} {vehicle.model}
            </h3>
            <p className="af-meta">{vehicle.registrationNumber}</p>
            {vehicle.year ? <p className="af-meta">Year {vehicle.year}</p> : null}
            {vehicle.fuel ? <p className="af-meta">{vehicle.fuel}</p> : null}
            {vehicle.transmission ? <p className="af-meta">{vehicle.transmission}</p> : null}
          </div>
        </article>
      ) : null}
      {vehicle ? (
        <button className="af-btn" type="button" onClick={book}>
          Book service
        </button>
      ) : null}
    </section>
  );
}
