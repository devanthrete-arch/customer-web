import { FinancialNotes } from '../components/FinancialNotes';
import { InvoiceDownload } from '../components/InvoiceDownload';
import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useDomain } from '../domain/DomainProvider';
import type { ApiVaultCategory } from '../domain/api-types';
import type { DocumentInput } from '../domain/client';
import {
  VAULT_CATEGORIES,
  expiryLabel,
  formatDate,
  maintenanceStateLabel,
  vaultCategoryLabel,
  type MaintenanceItem,
  type VaultDocument,
} from '../domain/model';
import { formatInr, formatWhen } from '../lib/format';
import {
  Empty,
  ErrorText,
  NotFound,
  PageHeader,
  StatusPill,
  expiryTone,
  istToday,
  maintenanceTone,
  useAction,
} from './ui';

/* Documents */

function DocumentCard({ document }: { document: VaultDocument }) {
  return (
    <Link className="af-document-card" to={`/documents/${document.id}`}>
      <span className="af-document-icon">▤</span>
      <div>
        <StatusPill tone={expiryTone(document.expiryState)}>{vaultCategoryLabel(document.category)}</StatusPill>
        <h3>{document.title}</h3>
        <p>{document.vehicle ? `${document.vehicle.label} · ${document.vehicle.registrationNumber}` : 'Personal'}</p>
        <b>{expiryLabel(document)}</b>
      </div>
    </Link>
  );
}

export function DocumentsScreen() {
  const { state } = useDomain();
  const [filter, setFilter] = useState<ApiVaultCategory | 'ALL' | 'ARCHIVED'>('ALL');
  const present = new Set(state.documents.map((item) => item.category));
  const shown =
    filter === 'ARCHIVED'
      ? state.archivedDocuments
      : state.documents.filter((item) => filter === 'ALL' || item.category === filter);
  return (
    <section className="af-screen af-wide">
      <PageHeader title="Document vault" action={<Link className="af-skip" to="/documents/new">Add document</Link>} />
      <p className="af-sub">Keep RC, insurance, PUC and your licence in one place. We remind you before they expire.</p>
      <div className="af-chips">
        <button className={`af-chip ${filter === 'ALL' ? 'on' : ''}`} onClick={() => setFilter('ALL')}>
          All
        </button>
        {VAULT_CATEGORIES.filter((item) => present.has(item.id)).map((item) => (
          <button
            className={`af-chip ${filter === item.id ? 'on' : ''}`}
            key={item.id}
            onClick={() => setFilter(item.id)}
          >
            {item.label}
          </button>
        ))}
        {state.archivedDocuments.length ? (
          <button className={`af-chip ${filter === 'ARCHIVED' ? 'on' : ''}`} onClick={() => setFilter('ARCHIVED')}>
            Archived
          </button>
        ) : null}
      </div>
      <div className="af-grid-2 af-content-gap">
        {shown.map((document) => (
          <DocumentCard document={document} key={document.id} />
        ))}
      </div>
      {shown.length === 0 ? (
        <Empty title="No documents here yet">
          <Link to="/documents/new">Add a document →</Link>
        </Empty>
      ) : null}
    </section>
  );
}

type DocumentForm = {
  category: ApiVaultCategory;
  vehicleId: string;
  title: string;
  documentNumber: string;
  issuer: string;
  issueDate: string;
  expiryDate: string;
  notes: string;
};

function toDocumentInput(form: DocumentForm): DocumentInput {
  const optional = (value: string) => value.trim() || undefined;
  return {
    category: form.category,
    vehicleId: optional(form.vehicleId),
    title: form.title.trim(),
    documentNumber: optional(form.documentNumber),
    issuer: optional(form.issuer),
    issueDate: optional(form.issueDate),
    expiryDate: optional(form.expiryDate),
    notes: optional(form.notes),
  };
}

function DocumentFields({ form, setForm, lockCategory }: { form: DocumentForm; setForm: (form: DocumentForm) => void; lockCategory?: boolean }) {
  const { state } = useDomain();
  const rule = VAULT_CATEGORIES.find((item) => item.id === form.category);
  const set = (key: keyof DocumentForm) => (event: { target: { value: string } }) =>
    setForm({ ...form, [key]: event.target.value });
  return (
    <>
      <label className="af-field">
        Type
        <select
          value={form.category}
          disabled={lockCategory}
          onChange={(event) => {
            const category = event.target.value as ApiVaultCategory;
            const next = VAULT_CATEGORIES.find((item) => item.id === category);
            setForm({
              ...form,
              category,
              title: form.title || next?.label || '',
              vehicleId: next?.perVehicle === false ? '' : form.vehicleId,
            });
          }}
        >
          {VAULT_CATEGORIES.map((item) => (
            <option value={item.id} key={item.id}>
              {item.label}
            </option>
          ))}
        </select>
      </label>
      {rule?.perVehicle !== false ? (
        <label className="af-field">
          Vehicle
          <select value={form.vehicleId} required={rule?.perVehicle === true} onChange={set('vehicleId')}>
            {rule?.perVehicle === true ? <option value="">Choose a vehicle</option> : <option value="">Not tied to a vehicle</option>}
            {state.vehicles
              .filter((item) => item.status === 'ACTIVE')
              .map((item) => (
                <option value={item.id} key={item.id}>
                  {item.label} · {item.registrationNumber}
                </option>
              ))}
          </select>
        </label>
      ) : null}
      <label className="af-field">
        Title
        <input required value={form.title} onChange={set('title')} placeholder="Comprehensive insurance" />
      </label>
      <div className="af-form-grid">
        <label className="af-field">
          Number
          <input value={form.documentNumber} onChange={set('documentNumber')} placeholder="Policy or licence number" />
        </label>
        <label className="af-field">
          Issued by
          <input value={form.issuer} onChange={set('issuer')} placeholder="Insurer or RTO" />
        </label>
        <label className="af-field">
          Issue date
          <input type="date" value={form.issueDate} onChange={set('issueDate')} />
        </label>
        <label className="af-field">
          Expiry date
          <input type="date" value={form.expiryDate} onChange={set('expiryDate')} />
        </label>
      </div>
      <label className="af-field">
        Notes
        <textarea value={form.notes} onChange={set('notes')} />
      </label>
    </>
  );
}

export function DocumentAddScreen() {
  const { addDocument } = useDomain();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [form, setForm] = useState<DocumentForm>({
    category: 'INSURANCE',
    vehicleId: params.get('vehicleId') ?? '',
    title: 'Insurance',
    documentNumber: '',
    issuer: '',
    issueDate: '',
    expiryDate: '',
    notes: '',
  });
  const { busy, error, run } = useAction();

  function save(event: FormEvent) {
    event.preventDefault();
    void run(async () => {
      const document = await addDocument(toDocumentInput(form));
      navigate(`/documents/${document.id}`, { replace: true });
    });
  }

  return (
    <section className="af-screen af-form">
      <PageHeader title="Add document" back="/documents" />
      <form onSubmit={save}>
        <DocumentFields form={form} setForm={setForm} />
        <p className="af-note">You can attach a photo or PDF of the document once file storage is switched on.</p>
        <ErrorText error={error} />
        <button className="af-btn" type="submit" disabled={busy}>
          {busy ? 'Saving…' : 'Save document'}
        </button>
      </form>
    </section>
  );
}

export function DocumentDetailScreen() {
  const { id } = useParams();
  const { state, archiveDocument, restoreDocument, updateDocument } = useDomain();
  const navigate = useNavigate();
  const { busy, error, run } = useAction();
  const document = [...state.documents, ...state.archivedDocuments].find((item) => item.id === id);
  const [editing, setEditing] = useState<DocumentForm | null>(null);
  if (!document) return <NotFound title="Document not found" back="/documents" />;

  if (editing) {
    return (
      <section className="af-screen af-form">
        <PageHeader title="Edit document" back={`/documents/${document.id}`} />
        <form
          onSubmit={(event) => {
            event.preventDefault();
            const { category: _category, ...changes } = toDocumentInput(editing);
            void run(async () => {
              await updateDocument(document.id, changes);
              setEditing(null);
            });
          }}
        >
          <DocumentFields form={editing} setForm={setEditing} lockCategory />
          <ErrorText error={error} />
          <button className="af-btn" type="submit" disabled={busy}>
            Save changes
          </button>
          <button className="af-btn ghost" type="button" onClick={() => setEditing(null)}>
            Cancel
          </button>
        </form>
      </section>
    );
  }

  return (
    <section className="af-screen af-form">
      <PageHeader
        title="Document details"
        back="/documents"
        action={
          document.status === 'ACTIVE' ? (
            <button
              className="af-skip"
              onClick={() =>
                setEditing({
                  category: document.category,
                  vehicleId: document.vehicle?.id ?? '',
                  title: document.title,
                  documentNumber: document.documentNumber ?? '',
                  issuer: document.issuer ?? '',
                  issueDate: document.issueDate ?? '',
                  expiryDate: document.expiryDate ?? '',
                  notes: document.notes ?? '',
                })
              }
            >
              Edit
            </button>
          ) : undefined
        }
      />
      <div className="af-document-preview">
        ▤<span>{document.file?.fileName ?? 'No file attached'}</span>
      </div>
      <div className="af-panel">
        <StatusPill tone={expiryTone(document.expiryState)}>{expiryLabel(document)}</StatusPill>
        <h2>{document.title}</h2>
        <p>{document.vehicle ? `${document.vehicle.label} · ${document.vehicle.registrationNumber}` : 'Personal document'}</p>
        <dl className="af-detail-list">
          <div>
            <dt>Type</dt>
            <dd>{vaultCategoryLabel(document.category)}</dd>
          </div>
          <div>
            <dt>Number</dt>
            <dd>{document.documentNumber ?? '—'}</dd>
          </div>
          <div>
            <dt>Issued by</dt>
            <dd>{document.issuer ?? '—'}</dd>
          </div>
          <div>
            <dt>Issued</dt>
            <dd>{document.issueDate ? formatDate(document.issueDate) : '—'}</dd>
          </div>
          <div>
            <dt>Expiry</dt>
            <dd>{document.expiryDate ? formatDate(document.expiryDate) : 'Not set'}</dd>
          </div>
          <div>
            <dt>Added</dt>
            <dd>{formatDate(document.createdAt)}</dd>
          </div>
        </dl>
        {document.notes ? <p>{document.notes}</p> : null}
      </div>
      {document.expiryState === 'EXPIRED' || document.expiryState === 'EXPIRING_SOON' ? (
        <p className="af-note">Renewed it? Edit the expiry date and we’ll stop reminding you.</p>
      ) : null}
      <ErrorText error={error} />
      {document.status === 'ACTIVE' ? (
        <button
          className="af-text-danger"
          disabled={busy}
          onClick={() =>
            void run(async () => {
              await archiveDocument(document.id);
              navigate('/documents');
            })
          }
        >
          Archive document
        </button>
      ) : (
        <button className="af-btn secondary" disabled={busy} onClick={() => void run(() => restoreDocument(document.id))}>
          Restore document
        </button>
      )}
    </section>
  );
}

/* Maintenance */

function dueText(item: MaintenanceItem): string {
  const parts: string[] = [];
  if (item.dueDate) {
    const days = item.daysToDue ?? 0;
    parts.push(
      days < 0 ? `${Math.abs(days)} days overdue` : days === 0 ? 'Due today' : `Due ${formatDate(item.dueDate)}`,
    );
  }
  if (item.dueOdometerKm) {
    const km = item.kmToDue;
    parts.push(
      km !== null && km < 0
        ? `${Math.abs(km).toLocaleString('en-IN')} km past due`
        : `at ${item.dueOdometerKm.toLocaleString('en-IN')} km`,
    );
  }
  return parts.join(' · ') || 'No due point set';
}

function intervalText(item: MaintenanceItem): string {
  const parts = [
    item.intervalKm ? `${item.intervalKm.toLocaleString('en-IN')} km` : '',
    item.intervalMonths ? `${item.intervalMonths} month${item.intervalMonths === 1 ? '' : 's'}` : '',
  ].filter(Boolean);
  return parts.length ? `Every ${parts.join(' or ')}` : 'One-time';
}

export function MaintenanceScreen() {
  const { state } = useDomain();
  const [showCompleted, setShowCompleted] = useState(false);
  const items = state.maintenance.filter((item) => showCompleted || item.state !== 'COMPLETED');
  const vehicles = state.vehicles.filter((vehicle) => items.some((item) => item.vehicle.id === vehicle.id));
  return (
    <section className="af-screen af-wide">
      <PageHeader title="Maintenance" action={<Link className="af-skip" to="/maintenance/new">Add reminder</Link>} />
      <p className="af-sub">Reminders from dates and odometer readings. Completing one schedules the next.</p>
      {vehicles.map((vehicle) => (
        <section key={vehicle.id}>
          <h2>{vehicle.label}</h2>
          <div className="af-grid-2">
            {items
              .filter((item) => item.vehicle.id === vehicle.id)
              .map((item) => (
                <Link className="af-maintenance-card" to={`/maintenance/${item.id}`} key={item.id}>
                  <div className="af-card-line">
                    <StatusPill tone={maintenanceTone(item.state)}>{maintenanceStateLabel(item.state)}</StatusPill>
                    <span>→</span>
                  </div>
                  <h3>{item.title}</h3>
                  <p>{dueText(item)}</p>
                  <span>{intervalText(item)}</span>
                </Link>
              ))}
          </div>
        </section>
      ))}
      {items.length === 0 ? (
        <Empty title="No reminders yet">
          <Link to="/maintenance/new">Add a reminder →</Link>
        </Empty>
      ) : null}
      <label className="af-checkrow">
        <input type="checkbox" checked={showCompleted} onChange={(event) => setShowCompleted(event.target.checked)} />
        Show completed one-time reminders
      </label>
    </section>
  );
}

export function MaintenanceAddScreen() {
  const { state, addMaintenance } = useDomain();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const active = state.vehicles.filter((item) => item.status === 'ACTIVE');
  const [form, setForm] = useState({
    vehicleId: params.get('vehicleId') ?? active[0]?.id ?? '',
    title: '',
    dueDate: '',
    dueOdometerKm: '',
    intervalMonths: '',
    intervalKm: '',
    notes: '',
  });
  const { busy, error, run } = useAction();
  const set = (key: keyof typeof form) => (event: { target: { value: string } }) =>
    setForm({ ...form, [key]: event.target.value });
  const number = (value: string) => (value ? Number(value) : undefined);

  function save(event: FormEvent) {
    event.preventDefault();
    void run(async () => {
      const item = await addMaintenance({
        vehicleId: form.vehicleId,
        title: form.title.trim(),
        notes: form.notes.trim() || undefined,
        dueDate: form.dueDate || undefined,
        dueOdometerKm: number(form.dueOdometerKm),
        intervalMonths: number(form.intervalMonths),
        intervalKm: number(form.intervalKm),
      });
      navigate(`/maintenance/${item.id}`, { replace: true });
    });
  }

  return (
    <section className="af-screen af-form">
      <PageHeader title="Add reminder" back="/maintenance" />
      <form onSubmit={save}>
        <label className="af-field">
          Vehicle
          <select required value={form.vehicleId} onChange={set('vehicleId')}>
            {active.map((item) => (
              <option value={item.id} key={item.id}>
                {item.label} · {item.registrationNumber}
              </option>
            ))}
          </select>
        </label>
        <label className="af-field">
          What needs doing
          <input required value={form.title} onChange={set('title')} placeholder="Engine oil change" />
        </label>
        <div className="af-form-grid">
          <label className="af-field">
            Due date
            <input type="date" min={istToday()} value={form.dueDate} onChange={set('dueDate')} />
          </label>
          <label className="af-field">
            Due at (km)
            <input inputMode="numeric" value={form.dueOdometerKm} onChange={set('dueOdometerKm')} />
          </label>
          <label className="af-field">
            Repeat every (months)
            <input inputMode="numeric" value={form.intervalMonths} onChange={set('intervalMonths')} />
          </label>
          <label className="af-field">
            Repeat every (km)
            <input inputMode="numeric" value={form.intervalKm} onChange={set('intervalKm')} />
          </label>
        </div>
        <label className="af-field">
          Notes
          <textarea value={form.notes} onChange={set('notes')} />
        </label>
        <p className="af-hint">Set a due date, an odometer reading, or both.</p>
        <ErrorText error={error} />
        <button className="af-btn" type="submit" disabled={busy || (!form.dueDate && !form.dueOdometerKm)}>
          Save reminder
        </button>
      </form>
    </section>
  );
}

export function MaintenanceDetailScreen() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { state, snoozeMaintenance, completeMaintenance, removeMaintenance } = useDomain();
  const { busy, error, run } = useAction();
  const item = state.maintenance.find((entry) => entry.id === id);
  const [odometer, setOdometer] = useState('');
  if (!item) return <NotFound title="Reminder not found" back="/maintenance" />;
  const done = item.state === 'COMPLETED';

  return (
    <section className="af-screen af-form">
      <PageHeader title="Maintenance details" back="/maintenance" />
      <StatusPill tone={maintenanceTone(item.state)}>{maintenanceStateLabel(item.state)}</StatusPill>
      <h2>{item.title}</h2>
      <p className="af-sub">
        {item.vehicle.label} · {item.vehicle.registrationNumber}
      </p>
      <div className="af-panel">
        <h3>Due</h3>
        <p>{dueText(item)}</p>
        {item.state === 'SNOOZED' && item.snoozedUntil ? (
          <>
            <h3>Snoozed until</h3>
            <p>{formatDate(item.snoozedUntil)}</p>
          </>
        ) : null}
        <h3>Repeats</h3>
        <p>{intervalText(item)}</p>
        <h3>Last done</h3>
        <p>
          {item.lastCompletedOn ? formatDate(item.lastCompletedOn) : 'Not recorded'}
          {item.lastCompletedOdometerKm ? ` at ${item.lastCompletedOdometerKm.toLocaleString('en-IN')} km` : ''}
        </p>
        {item.notes ? (
          <>
            <h3>Notes</h3>
            <p>{item.notes}</p>
          </>
        ) : null}
      </div>
      <ErrorText error={error} />
      {!done ? (
        <>
          <Link className="af-btn" to={`/services/book/vehicle?vehicleId=${item.vehicle.id}`}>Book service</Link>
          <div className="af-panel">
            <h3>Done it already?</h3>
            <div className="af-inline-form">
              <label className="af-field">
                Odometer now (optional)
                <input
                  inputMode="numeric"
                  value={odometer}
                  placeholder={item.vehicle.currentOdometerKm ? String(item.vehicle.currentOdometerKm) : 'km'}
                  onChange={(event) => setOdometer(event.target.value.replace(/\D/g, ''))}
                />
              </label>
              <button
                className="af-btn secondary"
                disabled={busy}
                onClick={() => void run(() => completeMaintenance(item.id, odometer ? Number(odometer) : undefined))}
              >
                Mark done
              </button>
            </div>
          </div>
          <div className="af-inline-actions">
            <button className="af-btn ghost" disabled={busy} onClick={() => void run(() => snoozeMaintenance(item.id, istToday(7)))}>
              Snooze a week
            </button>
            <button className="af-btn ghost" disabled={busy} onClick={() => void run(() => snoozeMaintenance(item.id, istToday(30)))}>
              Snooze a month
            </button>
          </div>
        </>
      ) : null}
      <button
        className="af-text-danger"
        disabled={busy}
        onClick={() => {
          if (!window.confirm('Delete this reminder?')) return;
          void run(async () => {
            await removeMaintenance(item.id);
            navigate('/maintenance');
          });
        }}
      >
        Delete reminder
      </button>
    </section>
  );
}

/* Payments */

export function PaymentsScreen() {
  const { state } = useDomain();
  const due = state.invoices.filter((item) => item.status === 'DUE');
  const outstanding = due.reduce((sum, item) => sum + item.balanceInr, 0) + state.invoices.reduce((sum,item)=>sum+Number(item.corrections?.outstandingDebitInr??0),0);
  return (
    <section className="af-screen af-wide">
      <PageHeader title="Payments & bills" />
      <article className="af-payment-total">
        <span>To pay at the center</span>
        <b>{formatInr(outstanding)}</b>
        <small>
          {due.length} open bill{due.length === 1 ? '' : 's'} · includes issued additional charges
        </small>
      </article>
      <div className="af-grid-2 af-content-gap">
        {state.invoices.map((invoice) => (
          <Link className="af-service-card" to={`/payments/${invoice.id}`} key={invoice.id}>
            <div className="af-card-line">
              <span className="af-kicker">{invoice.invoiceNumber}</span>
              <StatusPill tone={invoice.status === 'PAID' ? 'green' : invoice.status === 'VOID' ? 'gray' : 'orange'}>
                {invoice.status === 'PAID' ? 'Paid' : invoice.status === 'VOID' ? 'Cancelled' : 'To pay'}
              </StatusPill>
            </div>
            <h3>{formatInr(invoice.totalInr)}</h3>
            {invoice.corrections?.pendingDebitCount ? <p className="af-note">An additional charge needs your attention.</p> : null}
            {Number(invoice.corrections?.outstandingDebitInr??0)>0 ? <p className="af-note">Additional charge due: {formatInr(Number(invoice.corrections!.outstandingDebitInr))}</p> : null}
            <p>
              {invoice.buyer.vehicleLabel ?? 'Vehicle'} · {invoice.buyer.vehicleRegistration}
            </p>
            <p className="af-meta">
              {invoice.seller.name} · {formatDate(invoice.issuedAt)}
            </p>
          </Link>
        ))}
      </div>
      {state.invoices.length === 0 ? <Empty title="No bills yet" /> : null}
    </section>
  );
}

const METHOD_LABEL: Record<string, string> = { CASH: 'Cash', UPI: 'UPI', CARD: 'Card', GATEWAY: 'Online' };

export function PaymentDetailScreen() {
  const { id } = useParams();
  const { state } = useDomain();
  const invoice = state.invoices.find((item) => item.id === id);
  if (!invoice) return <NotFound title="Bill not found" back="/payments" />;
  const upiLink = invoice.upiVpa
    ? `upi://pay?pa=${encodeURIComponent(invoice.upiVpa)}&pn=${encodeURIComponent(invoice.seller.name)}&am=${invoice.balanceInr.toFixed(2)}&cu=INR&tn=${encodeURIComponent(invoice.invoiceNumber)}`
    : null;

  return (
    <section className="af-screen af-form">
      <PageHeader title={invoice.status === 'PAID' ? 'Receipt' : 'Your bill'} back="/payments" />
      <div className="af-panel">
        <span className="af-kicker">{invoice.invoiceNumber}</span>
        <h2>{invoice.seller.name}</h2>
        <p className="af-meta">{invoice.schemaVersion === 2 ? ({ TAX_INVOICE: 'Tax invoice', BILL_OF_SUPPLY: 'Bill of supply', COMMERCIAL_BILL: 'Commercial bill' }[invoice.documentKind ?? ''] ?? 'Bill') : 'Legacy bill'}</p>
        {invoice.schemaVersion === 2 ? <>
          <p className="af-meta">{invoice.seller.address}{invoice.seller.gstin ? ` · GSTIN ${invoice.seller.gstin}` : ''}</p>
          <p className="af-meta">Billed to {invoice.buyer.name} · {invoice.buyer.address} · {invoice.buyer.pin}{invoice.buyer.gstin ? ` · GSTIN ${invoice.buyer.gstin}` : ''}</p>
          {invoice.placeOfSupply ? <p className="af-meta">Place of supply: state {invoice.placeOfSupply.stateCode}</p> : null}
        </> : null}
        <p className="af-meta">
          {invoice.buyer.vehicleLabel} · {invoice.buyer.vehicleRegistration} · {formatDate(invoice.issuedAt)}
        </p>
        {invoice.lineItems.map((line, index) => (
          <div className="af-row" key={`${line.description}-${index}`}>
            <span>
              {line.description}
              {line.quantity > 1 ? <small className="af-meta"> × {line.quantity}</small> : null}
              {line.taxSnapshot?.discountInr ? <small className="af-meta"> · Discount {formatInr(Number(line.taxSnapshot.discountInr))} ({line.taxSnapshot.discountReason})</small> : null}
              {line.taxSnapshot?.classificationCode ? <small className="af-meta"> · HSN/SAC {line.taxSnapshot.classificationCode}</small> : null}
            </span>
            <b>{formatInr(Number(line.amountInr))}</b>
          </div>
        ))}
        {invoice.schemaVersion === 2 && invoice.documentKind === 'TAX_INVOICE' ? <>
          <div className="af-row"><span>Taxable and exempt subtotal</span><b>{formatInr(invoice.subtotalInr)}</b></div>
          <div className="af-row"><span>CGST</span><b>{formatInr(invoice.lineItems.reduce((sum, line) => sum + Number(line.taxSnapshot?.cgstInr ?? 0), 0))}</b></div>
          <div className="af-row"><span>SGST / UTGST</span><b>{formatInr(invoice.lineItems.reduce((sum, line) => sum + Number(line.taxSnapshot?.sgstInr ?? 0), 0))}</b></div>
          <div className="af-row"><span>IGST</span><b>{formatInr(invoice.lineItems.reduce((sum, line) => sum + Number(line.taxSnapshot?.igstInr ?? 0), 0))}</b></div>
        </> : null}
        <div className="af-total">
          <span>Total</span>
          <b>{formatInr(invoice.totalInr)}</b>
        </div>
        {invoice.notes ? <p className="af-hint">{invoice.notes}</p> : null}
      </div>

      {invoice.schemaVersion === 2 ? <InvoiceDownload id={invoice.id} number={invoice.invoiceNumber}/> : null}
      {invoice.schemaVersion===2&&invoice.status==='PAID'?<FinancialNotes key={invoice.id} invoiceId={invoice.id}/>:null}
      {invoice.status === 'VOID' ? <p className="af-note">This invoice was cancelled. Do not pay it. {invoice.voidReason}</p> : invoice.status === 'PAID' ? (
        <div className="af-success">
          <div className="af-check">✓</div>
          <h2>Paid {formatInr(invoice.paidInr)}</h2>
          {invoice.payments.map((payment) => (
            <p key={payment.id}>
              {METHOD_LABEL[payment.method] ?? payment.method}
              {payment.reference ? ` · ${payment.reference}` : ''} · {formatWhen(payment.receivedAt)}
            </p>
          ))}
          <Link to={`/services/${invoice.jobId}`}>Back to the service</Link>
        </div>
      ) : (
        <>
          <p className="af-note">
            Pay {formatInr(invoice.balanceInr)} at the counter when you collect your vehicle — UPI, card or cash. The
            center marks the bill paid and you get a receipt here.
          </p>
          {invoice.upiVpa ? (
            <div className="af-upi">
              <span>UPI ID</span>
              <code>{invoice.upiVpa}</code>
              {upiLink ? (
                <a className="af-btn secondary" href={upiLink}>
                  Open UPI app
                </a>
              ) : null}
              <small className="af-meta">Show the payment confirmation at the counter.</small>
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}
