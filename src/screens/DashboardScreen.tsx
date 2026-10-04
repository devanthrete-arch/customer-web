import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { LogoMark } from '../components/LogoLockup';
import { autoflex, type Booking, type GarageVehicle, type Profile } from '../lib/api';
import { bookingStatusLabel, formatWhen } from '../lib/format';
import { AUTH_BYPASS } from '../lib/session';

function isActive(booking: Booking): boolean {
  return booking.status !== 'CANCELLED';
}

function greeting(): string {
  const hour = Number(
    new Date().toLocaleString('en-IN', {
      hour: 'numeric',
      hour12: false,
      timeZone: 'Asia/Kolkata',
    }),
  );
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

function firstName(displayName: string | null | undefined): string {
  const name = displayName?.trim();
  if (!name) return 'there';
  return name.split(/\s+/)[0];
}

const sampleProfile: Profile = {
  id: 'preview',
  iamUserId: 'preview',
  displayName: 'Priya Sharma',
  phone: '+919876543210',
  selectedPlaceLabel: 'Bengaluru',
};

const sampleVehicles: GarageVehicle[] = [
  {
    id: 'v1',
    make: 'Honda',
    model: 'Activa',
    year: 2022,
    registrationNumber: 'KA01AB1234',
    vehicleType: 'TWO_WHEELER',
    fuel: 'Petrol',
    transmission: null,
  },
];

const sampleBooking: Booking = {
  id: 'b1',
  status: 'AWAITING_ARRIVAL',
  mode: 'SELF_CHECKIN',
  estimateInr: '2499',
  slotStart: '2026-10-10T04:30:00.000Z',
  slotEnd: '2026-10-10T05:30:00.000Z',
  paymentMode: 'PAY_AT_CENTER',
  issueDescription: null,
  vehicleId: 'v1',
  serviceCenterId: 'c1',
  vehicleLabel: 'Honda Activa',
  registrationNumber: 'KA01AB1234',
  centerName: 'Apex Auto Garage',
};

export function DashboardScreen() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [vehicles, setVehicles] = useState<GarageVehicle[]>([]);
  const [upcoming, setUpcoming] = useState<Booking[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (AUTH_BYPASS) {
      setProfile(sampleProfile);
      setVehicles(sampleVehicles);
      setUpcoming([sampleBooking]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    async function load() {
      try {
        const [me, garage, bookings] = await Promise.all([
          autoflex<Profile>('/v1/me/profile', {}, true),
          autoflex<GarageVehicle[]>('/v1/me/vehicles', {}, true),
          autoflex<{ items: Booking[] }>('/v1/bookings', {}, true),
        ]);
        if (cancelled) return;
        setProfile(me);
        setVehicles(garage);
        setUpcoming(bookings.items.filter(isActive));
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Could not load home');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const active = upcoming[0] ?? null;
  const name = firstName(profile?.displayName);
  const initial = (profile?.displayName?.trim() || 'A').slice(0, 1).toUpperCase();

  return (
    <section className="af-screen af-dash" data-screen="HOME-01">
      <header className="af-dash-hero">
        <div className="af-dash-top">
          <LogoMark decorative className="af-logo af-logo-nav" />
          <Link className="af-dash-avatar" to="/profile" aria-label="Profile">
            {initial}
          </Link>
        </div>
        <p className="af-dash-hello">{greeting()}</p>
        <h1>{name}</h1>
        {profile?.selectedPlaceLabel ? (
          <p className="af-dash-city">{profile.selectedPlaceLabel}</p>
        ) : null}
      </header>

      {loading ? (
        <div className="af-dash-skeleton" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
      ) : null}
      {error ? <p className="af-error">{error}</p> : null}

      {!loading && !error && vehicles.length === 0 ? (
        <div className="af-dash-empty" data-screen="HOME-02">
          <h2>Add your first vehicle</h2>
          <p>The dashboard starts from the vehicle. After that, you can book a visit and open it again.</p>
          <ol>
            <li>Save the make, model, and registration.</li>
            <li>Pick a center and a time.</li>
            <li>Bring it in and pay at the center.</li>
          </ol>
          <Link className="af-btn" to="/vehicles/new">
            Add vehicle
          </Link>
        </div>
      ) : null}

      {!loading && !error && vehicles.length > 0 ? (
        <>
          <div className="af-dash-actions">
            <Link to="/vehicles">
              <strong>{vehicles.length}</strong>
              <span>{vehicles.length === 1 ? 'Vehicle' : 'Vehicles'}</span>
            </Link>
            <Link className="primary" to="/services/book/vehicle">
              <strong>Book</strong>
              <span>New visit</span>
            </Link>
            <Link to={active ? `/services/${active.id}` : '/services'}>
              <strong>{upcoming.length}</strong>
              <span>{active ? 'Coming up' : 'Visits'}</span>
            </Link>
          </div>

          <div className="af-dash-split">
          {active ? (
            <Link className="af-dash-visit" to={`/services/${active.id}`}>
              <p className="af-dash-kicker">Coming up</p>
              <h2>{active.vehicleLabel}</h2>
              <p>{bookingStatusLabel(active.status)}</p>
              <p>{formatWhen(active.slotStart)}</p>
              <p>{active.centerName}</p>
              <span>Open visit</span>
            </Link>
          ) : (
            <div className="af-dash-quiet">
              <p>No visit booked.</p>
              <Link to="/services/book/vehicle">Book a service</Link>
            </div>
          )}

          <div className="af-dash-garage">
          <h2 className="af-dash-heading">Your vehicles</h2>
          <ul className="af-dash-vehicles">
            {vehicles.map((vehicle) => (
              <li key={vehicle.id}>
                <div>
                  <h3>
                    {vehicle.make} {vehicle.model}
                  </h3>
                  <p className="af-plate">{vehicle.registrationNumber}</p>
                  <p className="af-meta">
                    {[vehicle.year, vehicle.fuel].filter(Boolean).join(' · ') || 'On your account'}
                  </p>
                </div>
                <div className="af-dash-vehicle-links">
                  <Link to={`/vehicles/${vehicle.id}`}>View</Link>
                  <Link to={`/services/book/vehicle?vehicleId=${vehicle.id}`}>Book</Link>
                </div>
              </li>
            ))}
          </ul>
          </div>
          </div>
        </>
      ) : null}
    </section>
  );
}
