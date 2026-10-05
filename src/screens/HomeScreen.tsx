import { Link } from 'react-router-dom';
import { useDomain } from '../domain/DomainProvider';
import {
  SERVICE_STAGES,
  expiryLabel,
  formatDate,
  maintenanceStateLabel,
  serviceStatusLabel,
} from '../domain/model';
import { formatInr } from '../lib/format';
import { StatusPill, maintenanceTone, serviceTone, type Tone } from './ui';

type Attention = { key: string; to: string; tone: Tone; pill: string; title: string; detail: string; urgent?: boolean };

export function DashboardScreen() {
  const { state } = useDomain();
  const activeVehicles = state.vehicles.filter((vehicle) => vehicle.status === 'ACTIVE');
  const activeServices = state.services.filter((service) => service.isActive);
  const featured = activeServices[0];

  const attention: Attention[] = [
    ...activeServices
      .filter((service) => service.pendingApproval)
      .map((service) => ({
        key: `approval-${service.id}`,
        to: `/services/${service.id}/approval`,
        tone: 'orange' as Tone,
        pill: 'Decision needed',
        title: `Extra work on ${service.vehicleLabel}`,
        detail: `${formatInr(service.pendingApproval!.totalInr)} proposed by ${service.centerName}`,
        urgent: true,
      })),
    ...activeServices
      .filter((service) => service.status === 'READY_FOR_PICKUP')
      .map((service) => ({
        key: `ready-${service.id}`,
        to: `/services/${service.id}`,
        tone: 'green' as Tone,
        pill: 'Ready for pickup',
        title: service.vehicleLabel,
        detail: `Collect from ${service.centerName}`,
      })),
    ...state.documents
      .filter((doc) => doc.expiryState === 'EXPIRED' || doc.expiryState === 'EXPIRING_SOON')
      .map((doc) => ({
        key: `doc-${doc.id}`,
        to: `/documents/${doc.id}`,
        tone: (doc.expiryState === 'EXPIRED' ? 'red' : 'orange') as Tone,
        pill: doc.expiryState === 'EXPIRED' ? 'Expired' : 'Expiring',
        title: doc.title,
        detail: `${doc.vehicle?.registrationNumber ?? 'Personal'} · ${expiryLabel(doc)}`,
      })),
    ...state.maintenance
      .filter((item) => item.state === 'OVERDUE' || item.state === 'DUE_SOON')
      .map((item) => ({
        key: `mnt-${item.id}`,
        to: `/maintenance/${item.id}`,
        tone: maintenanceTone(item.state),
        pill: maintenanceStateLabel(item.state),
        title: item.title,
        detail: item.vehicle.label,
      })),
  ];

  const firstName = state.profile.displayName?.split(' ')[0] ?? 'there';
  const stageIndex = featured?.stage ? SERVICE_STAGES.indexOf(featured.stage) : -1;

  return (
    <section className="af-screen af-dash">
      <header className="af-dash-hero">
        <div className="af-dash-top">
          <div>
            <p className="af-dash-hello">Your vehicle home</p>
            <h1>Hello, {firstName}</h1>
            <p className="af-dash-city">{state.profile.selectedPlaceLabel ?? state.profile.city}</p>
          </div>
          <Link
            className="af-notification-button"
            to="/notifications"
            aria-label={`${state.unreadCount} unread notifications`}
          >
            🔔 {state.unreadCount ? <b>{state.unreadCount}</b> : null}
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
        <Link to="/services">
          <strong>{activeServices.length}</strong>
          <span>Active</span>
        </Link>
      </div>

      <div className="af-dash-split">
        <div>
          <h2 className="af-dash-heading">Needs attention</h2>
          <div className="af-attention-list">
            {attention.length ? (
              attention.map((item) => (
                <Link
                  className={`af-attention ${item.urgent ? 'af-attention-urgent' : ''}`}
                  to={item.to}
                  key={item.key}
                >
                  <div>
                    <StatusPill tone={item.tone}>{item.pill}</StatusPill>
                    <strong>{item.title}</strong>
                    <span>{item.detail}</span>
                  </div>
                  <b>View →</b>
                </Link>
              ))
            ) : (
              <div className="af-panel">
                <p>You’re all caught up.</p>
              </div>
            )}
          </div>
        </div>

        <div>
          <h2 className="af-dash-heading">Active service</h2>
          {featured ? (
            <Link className="af-active-service" to={`/services/${featured.id}`}>
              <div className="af-card-line">
                <div>
                  <span className="af-kicker">{featured.reference}</span>
                  <h3>{featured.vehicleLabel}</h3>
                </div>
                <StatusPill tone={serviceTone(featured.status)}>{serviceStatusLabel(featured.status)}</StatusPill>
              </div>
              <p>{featured.centerName}</p>
              <div className="af-progress-mini" aria-label="Service progress">
                {SERVICE_STAGES.slice(0, 8).map((stage, index) => (
                  <span key={stage} className={index <= stageIndex ? 'done' : ''} />
                ))}
              </div>
              <b>Track service →</b>
            </Link>
          ) : (
            <div className="af-panel">
              <p>No active service.</p>
              <Link to="/services/book/vehicle">Book a service →</Link>
            </div>
          )}
        </div>
      </div>

      <div className="af-card-line af-section-line">
        <h2 className="af-dash-heading">Your vehicles</h2>
        <Link to="/vehicles">View all</Link>
      </div>
      <div className="af-grid-2">
        {activeVehicles.map((vehicle) => {
          const next = state.maintenance.find(
            (item) => item.vehicle.id === vehicle.id && item.state !== 'COMPLETED',
          );
          const last = state.services.find(
            (item) => item.vehicleId === vehicle.id && item.status === 'COMPLETED',
          );
          return (
            <article className="af-vehicle-card" key={vehicle.id}>
              <div className="af-card-line">
                <div>
                  <h3>{vehicle.label}</h3>
                  <span className="af-plate">{vehicle.registrationNumber}</span>
                </div>
                <span className="af-vehicle-glyph">{vehicle.vehicleType === 'TWO_WHEELER' ? '🛵' : '🚙'}</span>
              </div>
              <dl className="af-metrics">
                <div>
                  <dt>Odometer</dt>
                  <dd>{vehicle.mileage !== null ? `${vehicle.mileage.toLocaleString('en-IN')} km` : '—'}</dd>
                </div>
                <div>
                  <dt>Last service</dt>
                  <dd>{last ? formatDate(last.closedAt ?? last.appointmentAt) : '—'}</dd>
                </div>
                <div>
                  <dt>Next action</dt>
                  <dd>{next?.title ?? 'No reminders'}</dd>
                </div>
              </dl>
              <div className="af-inline-actions">
                <Link to={`/vehicles/${vehicle.id}`}>View vehicle</Link>
                <Link to={`/services/book/vehicle?vehicleId=${vehicle.id}`}>Book service</Link>
              </div>
            </article>
          );
        })}
        {activeVehicles.length === 0 ? (
          <Link className="af-vehicle-card" to="/vehicles/new">
            <h3>Add your first vehicle</h3>
            <p className="af-meta">Services, documents and reminders hang off each vehicle.</p>
          </Link>
        ) : null}
      </div>

      <h2 className="af-dash-heading">Quick access</h2>
      <div className="af-quick-grid">
        <Link to="/documents">
          <b>Documents</b>
          <span>Vault & expiry</span>
        </Link>
        <Link to="/history">
          <b>History</b>
          <span>Reports</span>
        </Link>
        <Link to="/maintenance">
          <b>Maintenance</b>
          <span>Reminders</span>
        </Link>
        <Link to="/payments">
          <b>Payments</b>
          <span>Bills</span>
        </Link>
      </div>
    </section>
  );
}
