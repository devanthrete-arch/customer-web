import { useState } from 'react';
import { Link, Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useDomain } from '../domain/DomainProvider';
import {
  SERVICE_STAGES,
  formatDate,
  serviceStatusLabel,
  stageLabel,
  type Approval,
  type ServiceLine,
  type ServiceRecord,
  type ServiceStage,
} from '../domain/model';
import { formatInr, formatWhen } from '../lib/format';
import { Empty, ErrorText, NotFound, PageHeader, StatusPill, serviceTone, useAction } from './ui';

const partLabel = (line: ServiceLine): string =>
  line.partType ? { OEM: 'OEM part', OES: 'OES part', LOCAL: 'Local part' }[line.partType] : '';

const lineMeta = (line: ServiceLine): string =>
  [line.kind === 'LABOUR' ? 'Labour' : line.kind === 'FEE' ? 'Fee' : 'Part', partLabel(line), line.quantity > 1 ? `× ${line.quantity}` : '']
    .filter(Boolean)
    .join(' · ');

function stagesFor(service: ServiceRecord): ServiceStage[] {
  return SERVICE_STAGES.filter((stage) => {
    if (!service.bookingId && (stage === 'REQUESTED' || stage === 'CONFIRMED')) return false;
    if (stage === 'AWAITING_APPROVAL') return service.approvals.length > 0 || service.stage === stage;
    return true;
  });
}

export function ServiceListScreen() {
  const { state } = useDomain();
  const [filter, setFilter] = useState<'ACTIVE' | 'PAST'>('ACTIVE');
  const items = state.services.filter((service) =>
    filter === 'ACTIVE' ? service.isActive : !service.isActive,
  );
  return (
    <section className="af-screen af-wide">
      <PageHeader
        title="My visits"
        action={
          <Link className="af-skip" to="/services/book/vehicle">
            Book service
          </Link>
        }
      />
      <div className="af-tabs">
        <button className={filter === 'ACTIVE' ? 'on' : ''} onClick={() => setFilter('ACTIVE')}>
          Active & upcoming
        </button>
        <button className={filter === 'PAST' ? 'on' : ''} onClick={() => setFilter('PAST')}>
          Past
        </button>
      </div>
      <div className="af-grid-2 af-content-gap">
        {items.map((service) => (
          <Link className="af-service-card" to={`/services/${service.id}`} key={service.id}>
            <div className="af-card-line">
              <span className="af-kicker">{service.reference}</span>
              <StatusPill tone={serviceTone(service.status)}>{serviceStatusLabel(service.status)}</StatusPill>
            </div>
            <h3>{service.title}</h3>
            <p>
              {service.vehicleLabel} · {service.registrationNumber}
            </p>
            <p className="af-meta">
              {formatWhen(service.appointmentAt)}
              <br />
              {service.centerName}
            </p>
            {service.pendingApproval ? <b>Your decision is needed →</b> : null}
          </Link>
        ))}
      </div>
      {items.length === 0 ? (
        <Empty title={filter === 'ACTIVE' ? 'Nothing in progress' : 'No past services yet'}>
          <Link to="/services/book/vehicle">Book a service →</Link>
        </Empty>
      ) : null}
    </section>
  );
}

function LineList({ lines }: { lines: ServiceLine[] }) {
  return (
    <>
      {lines.map((line) => (
        <div className={`af-row ${line.status === 'DECLINED' ? 'muted' : ''}`} key={line.id}>
          <span>
            {line.description}
            {!!line.scope?.length && (
              <small>
                {line.scope
                  .map(
                    (part) =>
                      `${part.quantity} × ${part.name}${part.description ? ': ' + part.description : ''}`,
                  )
                  .join(' · ')}
              </small>
            )}
            <small className="af-meta"> {lineMeta(line)}</small>
            {line.status === 'DECLINED' ? <small className="af-meta"> · declined</small> : null}
            {line.status === 'PENDING' ? <small className="af-meta"> · awaiting you</small> : null}
          </span>
          <b>{formatInr(line.amountInr)}</b>
        </div>
      ))}
    </>
  );
}

export function ServiceDetailScreen() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const { findService, cancelBooking } = useDomain();
  const { busy, error, run } = useAction();
  const service = findService(id);
  if (!service) return <NotFound title="Service not found" back="/services" />;
  if (service.id !== id) return <Navigate to={`/services/${service.id}`} replace />;
  const stages = stagesFor(service);
  const currentIndex = service.stage ? stages.indexOf(service.stage) : -1;
  const supportQuery = service.jobId ? `jobId=${service.jobId}` : `bookingId=${service.bookingId}`;

  return (
    <section className="af-screen af-wide">
      <PageHeader title="Service tracking" back="/services" />
      {params.get('booked') ? (
        <div className="af-success-banner">
          Booking sent · {service.reference}
          {service.status === 'REQUESTED' ? ' · the center will confirm shortly' : ''}
        </div>
      ) : null}
      <div className="af-card-line af-service-heading">
        <div>
          <span className="af-kicker">{service.reference}</span>
          <h2>{service.title}</h2>
          <p>
            {service.vehicleLabel} · {service.registrationNumber}
          </p>
        </div>
        <StatusPill tone={serviceTone(service.status)}>{serviceStatusLabel(service.status)}</StatusPill>
      </div>
      <div className="af-grid-main">
        <main>
          {service.status === 'REQUESTED' ? (
            <p className="af-note">
              {service.centerName} reviews new bookings and confirms the slot. We’ll message you as soon as they do.
            </p>
          ) : null}
          {service.status === 'ON_HOLD' ? (
            <div className="af-hold">
              <b>Work is paused.</b> {service.holdReason}
              {service.expectedResumeAt ? ` Expected to resume ${formatWhen(service.expectedResumeAt)}.` : ''}
            </div>
          ) : null}
          {service.status === 'CANCELLED' && service.kind === 'booking' ? (
            <p className="af-note">
              {service.cancelledBy === 'CENTER' ? 'The center declined this booking.' : 'You cancelled this booking.'}{' '}
              {service.cancellationReason}
            </p>
          ) : null}
          {service.pendingApproval ? (
            <Link className="af-decision-card" to={`/services/${service.id}/approval`}>
              <StatusPill tone="orange">Your decision is required</StatusPill>
              <h3>
                {service.pendingApproval.items.length} extra item{service.pendingApproval.items.length === 1 ? '' : 's'} proposed
              </h3>
              {service.pendingApproval.note ? <p>{service.pendingApproval.note}</p> : null}
              <b>Review {formatInr(service.pendingApproval.totalInr)} →</b>
            </Link>
          ) : null}
          {service.status === 'READY_FOR_PICKUP' ? (
            <div className="af-decision-card">
              <StatusPill tone="green">Ready for pickup</StatusPill>
              <h3>Your vehicle is ready at {service.centerName}</h3>
              <p>
                Pay {formatInr(service.balanceInr || service.currentInr || 0)} at the counter by UPI, card or cash when you
                collect it.
              </p>
              {service.invoiceId ? (
                <Link to={`/payments/${service.invoiceId}`}>View bill →</Link>
              ) : null}
            </div>
          ) : null}

          {stages.length && service.stage ? (
            <>
              <h2>Progress</h2>
              <div className="af-service-progress">
                {stages.map((stage, index) => (
                  <div className={index <= currentIndex ? 'done' : ''} key={stage}>
                    <i>{index < currentIndex || service.status === 'COMPLETED' ? '✓' : index === currentIndex ? '●' : ''}</i>
                    <span>
                      <b>{stageLabel(stage)}</b>
                      {index === currentIndex && service.status !== 'COMPLETED' ? (
                        <small>{service.status === 'ON_HOLD' ? 'Paused here' : 'Current stage'}</small>
                      ) : null}
                    </span>
                  </div>
                ))}
              </div>
            </>
          ) : null}

          {service.lines.length ? (
            <div className="af-panel">
              <h3>Work and estimate</h3>
              <LineList lines={service.lines} />
              <div className="af-total">
                <span>{service.finalInr !== null ? 'Final amount' : 'Current total'}</span>
                <b>{formatInr(service.finalInr ?? service.currentInr ?? 0)}</b>
              </div>
            </div>
          ) : null}

          <h2>Updates</h2>
          <div className="af-timeline">
            {[...service.timeline].reverse().map((event) => (
              <div key={event.id}>
                <i />
                <p>
                  <b>{event.title}</b>
                  <span>
                    {event.detail ? (
                      <>
                        {event.detail}
                        <br />
                      </>
                    ) : null}
                    {formatWhen(event.at)}
                  </span>
                </p>
              </div>
            ))}
          </div>
        </main>
        <aside>
          <div className="af-panel">
            <h3>{service.bookingId ? 'Appointment' : 'Checked in'}</h3>
            <p>{formatWhen(service.appointmentAt)}</p>
            <h3>Center</h3>
            <p>
              {service.centerName}
              {service.centerPhone ? (
                <>
                  <br />
                  <a href={`tel:${service.centerPhone}`}>{service.centerPhone}</a>
                </>
              ) : null}
            </p>
            {service.request ? (
              <>
                <h3>Your request</h3>
                <p>{service.request}</p>
              </>
            ) : null}
            {service.bookedItems.length ? (
              <>
                <h3>Booked</h3>
                {service.bookedItems.map((item) => (
                  <div className="af-row" key={item.name}>
                    <span>
                      {item.name}
                      {item.description && <small>{item.description}</small>}
                      {!!item.scope?.length && (
                        <small>
                          {item.scope
                            .map(
                              (part) =>
                                `${part.quantity} × ${part.name}${part.description ? ': ' + part.description : ''}`,
                            )
                            .join(' · ')}
                        </small>
                      )}
                    </span>
                    <b>
                      {item.priceIsStarting ? 'from ' : ''}
                      {formatInr(item.priceInr)}
                    </b>
                  </div>
                ))}
              </>
            ) : null}
            <h3>Initial estimate</h3>
            <p>{formatInr(service.estimateInr)}</p>
            {service.estimatedReadyAt && service.isActive ? (
              <>
                <h3>Estimated ready</h3>
                <p>{formatWhen(service.estimatedReadyAt)}</p>
              </>
            ) : null}
            {service.odometerKm ? (
              <>
                <h3>Odometer at check-in</h3>
                <p>{service.odometerKm.toLocaleString('en-IN')} km</p>
              </>
            ) : null}
            <p className="af-hint">Pay at the center when you collect your vehicle.</p>
          </div>
          {service.invoiceId ? (
            <Link className="af-btn secondary" to={`/payments/${service.invoiceId}`}>View bill</Link>
          ) : null}
          {service.status === 'COMPLETED' ? (
            <Link className="af-btn" to={`/history/${service.id}`}>Open service report</Link>
          ) : null}
          {service.canCancel ? (
            <button
              className="af-btn ghost"
              disabled={busy}
              onClick={() => {
                const reason = window.prompt('Cancel this booking? You can add a reason (optional).');
                if (reason === null) return;
                void run(() => cancelBooking(service.id, reason.trim() || undefined));
              }}
            >
              Cancel booking
            </button>
          ) : null}
          <ErrorText error={error} />
          <Link className="af-center" to={`/support?${supportQuery}`}>Need help with this service?</Link>
        </aside>
      </div>
    </section>
  );
}

function DecisionSummary({ approval }: { approval: Approval }) {
  const label = {
    PENDING: 'Waiting for you',
    APPROVED: 'Approved',
    PARTIALLY_APPROVED: 'Partly approved',
    DECLINED: 'Declined',
    WITHDRAWN: 'Withdrawn',
  }[approval.status];
  return (
    <div className="af-panel">
      <div className="af-card-line">
        <span className="af-kicker">{formatWhen(approval.requestedAt)}</span>
        <StatusPill tone={approval.status === 'DECLINED' || approval.status === 'WITHDRAWN' ? 'gray' : 'green'}>
          {label}
        </StatusPill>
      </div>
      <LineList lines={approval.items} />
      {approval.decidedBy === 'STAFF' ? (
        <p className="af-hint">Recorded by the center on your behalf.</p>
      ) : null}
    </div>
  );
}

export function ApprovalScreen() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { findService, decideApproval } = useDomain();
  const service = findService(id);
  const approval = service?.pendingApproval ?? null;
  const [selected, setSelected] = useState<Set<string>>(() => new Set(approval?.items.map((item) => item.id)));
  const [acknowledged, setAcknowledged] = useState(false);
  const { busy, error, run } = useAction();
  if (!service || !service.jobId) return <NotFound title="Service not found" back="/services" />;

  const past = service.approvals.filter((item) => item.id !== approval?.id);
  if (!approval) {
    return (
      <section className="af-screen af-form">
        <PageHeader title="Additional work" back={`/services/${service.id}`} />
        <p className="af-note">There is nothing waiting for your decision on this service.</p>
        {past.map((item) => (
          <DecisionSummary approval={item} key={item.id} />
        ))}
      </section>
    );
  }

  const chosen = approval.items.filter((item) => selected.has(item.id));
  const chosenTotal = chosen.reduce((sum, item) => sum + item.amountInr, 0);
  const needsAck = chosen.some((item) => item.partType === 'OES' || item.partType === 'LOCAL');
  const jobId = service.jobId;

  function toggle(lineId: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(lineId)) next.delete(lineId);
      else next.add(lineId);
      return next;
    });
  }

  function submit(approveSelection: boolean) {
    if (!approval) return;
    const allChosen = chosen.length === approval.items.length;
    const body =
      !approveSelection || chosen.length === 0
        ? { approved: false }
        : allChosen
          ? { approved: true }
          : { decisions: approval.items.map((item) => ({ lineItemId: item.id, approved: selected.has(item.id) })) };
    void run(async () => {
      await decideApproval(jobId, approval.id, {
        ...body,
        ...(approveSelection && needsAck ? { acknowledgeNonOemParts: true } : {}),
      });
      navigate(`/services/${service!.id}`);
    });
  }

  return (
    <section className="af-screen af-form">
      <PageHeader title="Additional work" back={`/services/${service.id}`} />
      <StatusPill tone="orange">Your decision is required</StatusPill>
      <h2>{service.centerName} recommends</h2>
      {approval.note ? <p className="af-sub">{approval.note}</p> : null}
      <div className="af-line-list">
        {approval.items.map((item) => (
          <label className={`af-line ${selected.has(item.id) ? '' : 'off'}`} key={item.id}>
            <input type="checkbox" checked={selected.has(item.id)} onChange={() => toggle(item.id)} />
            <span>
              <b>{item.description}</b>
              <small>{lineMeta(item)}</small>
            </span>
            <b>{formatInr(item.amountInr)}</b>
          </label>
        ))}
      </div>
      <div className="af-total">
        <span>Selected</span>
        <b>{formatInr(chosenTotal)}</b>
      </div>
      {needsAck ? (
        <label className="af-checkrow">
          <input type="checkbox" checked={acknowledged} onChange={(event) => setAcknowledged(event.target.checked)} />
          I understand some selected parts are not from the vehicle maker (OES or local).
        </label>
      ) : null}
      <p className="af-hint">
        Only what you approve is added to your bill. Untick anything you want to leave for later.
      </p>
      <ErrorText error={error} />
      <div className="af-stack">
        <button
          className="af-btn"
          disabled={busy || chosen.length === 0 || (needsAck && !acknowledged)}
          onClick={() => submit(true)}
        >
          {chosen.length === approval.items.length ? 'Approve all' : 'Approve selected'} ·{' '}
          {formatInr(chosenTotal)}
        </button>
        <button className="af-btn secondary" disabled={busy} onClick={() => submit(false)}>
          Decline all
        </button>
        <Link className="af-center" to={`/support?jobId=${jobId}`}>Ask for more information</Link>
      </div>
      {past.length ? <h3>Earlier decisions</h3> : null}
      {past.map((item) => (
        <DecisionSummary approval={item} key={item.id} />
      ))}
    </section>
  );
}

export function HistoryScreen() {
  const { state } = useDomain();
  const completed = state.services.filter((item) => item.status === 'COMPLETED');
  const groups = new Map<string, ServiceRecord[]>();
  for (const service of completed) {
    const key = `${service.vehicleLabel} · ${service.registrationNumber}`;
    groups.set(key, [...(groups.get(key) ?? []), service]);
  }
  return (
    <section className="af-screen af-wide">
      <PageHeader title="Service history" />
      <p className="af-sub">Completed services and their reports, grouped by vehicle.</p>
      {completed.length === 0 ? <Empty title="No completed services yet" /> : null}
      {[...groups.entries()].map(([label, services]) => (
        <section key={label}>
          <h2>{label}</h2>
          <div className="af-grid-2">
            {services.map((service) => (
              <Link className="af-service-card" to={`/history/${service.id}`} key={service.id}>
                <div className="af-card-line">
                  <span className="af-kicker">{formatDate(service.closedAt ?? service.appointmentAt)}</span>
                  <b>{formatInr(service.finalInr ?? service.currentInr ?? service.estimateInr)}</b>
                </div>
                <h3>{service.title}</h3>
                <p>{service.centerName}</p>
                <span>View report →</span>
              </Link>
            ))}
          </div>
        </section>
      ))}
    </section>
  );
}

export function HistoryDetailScreen() {
  const { id } = useParams();
  const { findService, state } = useDomain();
  const service = findService(id);
  if (!service || service.status !== 'COMPLETED') return <NotFound title="Completed service not found" back="/history" />;
  const billed = service.lines.filter((line) => line.status === 'INCLUDED' || line.status === 'APPROVED');
  const labour = billed.filter((line) => line.kind !== 'PART');
  const parts = billed.filter((line) => line.kind === 'PART');
  const declined = service.lines.filter((line) => line.status === 'DECLINED');
  const invoice = state.invoices.find((item) => item.id === service.invoiceId);
  return (
    <section className="af-screen af-wide">
      <PageHeader title="Service report" back="/history" />
      <article className="af-report-header">
        <div>
          <span className="af-kicker">{service.reference}</span>
          <h2>{service.title}</h2>
          <p>
            {service.vehicleLabel} · {service.registrationNumber}
          </p>
        </div>
        <StatusPill tone="green">Completed</StatusPill>
      </article>
      <div className="af-grid-main">
        <main>
          <div className="af-panel">
            <h3>Work performed</h3>
            {labour.length ? (
              <ul>
                {labour.map((line) => (
                  <li key={line.id}>{line.description}</li>
                ))}
              </ul>
            ) : (
              <p>—</p>
            )}
          </div>
          <div className="af-panel">
            <h3>Parts replaced</h3>
            {parts.length ? (
              <ul>
                {parts.map((line) => (
                  <li key={line.id}>
                    {line.description}
                    {partLabel(line) ? ` · ${partLabel(line)}` : ''}
                    {line.returnedToCustomer ? ' · old part handed back' : ''}
                  </li>
                ))}
              </ul>
            ) : (
              <p>—</p>
            )}
          </div>
          {declined.length ? (
            <div className="af-panel">
              <h3>Recommended for later</h3>
              <ul>
                {declined.map((line) => (
                  <li key={line.id}>{line.description}</li>
                ))}
              </ul>
            </div>
          ) : null}
          {service.finalNotes ? (
            <div className="af-panel">
              <h3>Notes from the center</h3>
              <p>{service.finalNotes}</p>
            </div>
          ) : null}
          <div className="af-panel">
            <h3>Service record</h3>
            <p>Center: {service.centerName}</p>
            <p>Checked in: {formatWhen(service.appointmentAt)}</p>
            {service.closedAt ? <p>Handed over: {formatWhen(service.closedAt)}</p> : null}
            {service.odometerKm ? (
              <p>Odometer: {service.odometerKm.toLocaleString('en-IN')} km</p>
            ) : null}
          </div>
        </main>
        <aside className="af-panel">
          <h3>Charges</h3>
          <LineList lines={billed} />
          {invoice && invoice.adjustmentInr !== 0 ? (
            <div className="af-row">
              <span>Adjustment</span>
              <b>{formatInr(invoice.adjustmentInr)}</b>
            </div>
          ) : null}
          <div className="af-total">
            <span>Total paid</span>
            <b>{formatInr(service.finalInr ?? service.currentInr ?? 0)}</b>
          </div>
          {service.invoiceId ? (
            <Link to={`/payments/${service.invoiceId}`}>View bill →</Link>
          ) : null}
        </aside>
      </div>
    </section>
  );
}
