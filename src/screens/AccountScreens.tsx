import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useDomain } from '../domain/DomainProvider';
import type { ApiProfile, ApiSupportCategory } from '../domain/api-types';
import type { AddressInput, SupportInput } from '../domain/client';
import { formatDate } from '../domain/model';
import { digitsOnly, formatWhen, localPhone } from '../lib/format';
import { signOut } from '../lib/session';
import { ApiError } from '../lib/api';
import { BOOKING_AGE_POLICY } from '../lib/booking-policy';
import { Empty, ErrorText, PageHeader, StatusPill, useAction } from './ui';

const CATEGORY_LABEL: Record<string, string> = {
  SERVICE: 'Service',
  APPROVAL: 'Approval',
  PAYMENT: 'Payment',
  MAINTENANCE: 'Maintenance',
  DOCUMENTS: 'Documents',
  SUPPORT: 'Support',
};

export function NotificationsScreen() {
  const { state, markNotificationRead, markAllNotificationsRead } = useDomain();
  const { busy, run } = useAction();
  return (
    <section className="af-screen af-wide">
      <PageHeader
        title="Notifications"
        back="/home"
        action={
          state.unreadCount ? (
            <button className="af-skip" disabled={busy} onClick={() => void run(markAllNotificationsRead)}>
              Mark all read
            </button>
          ) : undefined
        }
      />
      <div className="af-notification-list">
        {state.notifications.map((notification) => (
          <Link
            className={notification.read ? 'read' : ''}
            to={notification.target}
            key={notification.id}
            onClick={() => void markNotificationRead(notification.id).catch(() => undefined)}
          >
            <i />
            <div>
              <span>{CATEGORY_LABEL[notification.category] ?? notification.category}</span>
              <h3>{notification.title}</h3>
              <p>{notification.body}</p>
              <small>{formatWhen(notification.createdAt)}</small>
            </div>
          </Link>
        ))}
      </div>
      {state.notifications.length === 0 ? <Empty title="Nothing yet" /> : null}
    </section>
  );
}

export function ProfileScreen() {
  const { state, updateProfile } = useDomain();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    displayName: state.profile.displayName ?? '',
    email: state.profile.email ?? '',
    phone: localPhone(state.profile.phone),
    selectedPlaceLabel: state.profile.selectedPlaceLabel ?? '',
    dateOfBirth: state.profile.dateOfBirth ?? '',
  });
  const [saved, setSaved] = useState(false);
  const { busy, error, run } = useAction();

  function save(event: FormEvent) {
    event.preventDefault();
    setSaved(false);
    void run(async () => {
      await updateProfile({
        displayName: form.displayName.trim(),
        email: form.email.trim() || undefined,
        phone: form.phone,
        selectedPlaceLabel: form.selectedPlaceLabel.trim(),
        dateOfBirth: form.dateOfBirth,
      });
      setSaved(true);
    });
  }

  return (
    <section className="af-screen af-form">
      <PageHeader title="Profile" />
      {saved ? <div className="af-success-banner">Profile saved.</div> : null}
      <form onSubmit={save}>
        <label className="af-field">
          Full name
          <input required minLength={2} value={form.displayName} onChange={(event) => setForm({ ...form, displayName: event.target.value })} />
        </label>
        <label className="af-field">
          Mobile
          <div className="af-phone">
            <div className="af-cc">+91</div>
            <input
              inputMode="numeric"
              value={form.phone}
              onChange={(event) => setForm({ ...form, phone: digitsOnly(event.target.value).slice(0, 10) })}
            />
          </div>
        </label>
        <label className="af-field">
          Email
          <input type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
        </label>
        <label className="af-field">
          Area and city
          <input
            required
            value={form.selectedPlaceLabel}
            onChange={(event) => setForm({ ...form, selectedPlaceLabel: event.target.value })}
          />
        </label>
        <label className="af-field">
          Date of birth
          <input
            type="date"
            required
            min="1900-01-01"
            max={new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })}
            value={form.dateOfBirth}
            onChange={(event) => setForm({ ...form, dateOfBirth: event.target.value })}
          />
        </label>
        {state.profile.ageYears !== null ? (
          <p className="af-hint">Age on this account: {state.profile.ageYears} years.</p>
        ) : null}
        <p className="af-hint">{BOOKING_AGE_POLICY}</p>
        <ErrorText error={error} />
        <button className="af-btn" disabled={busy}>
          Save profile
        </button>
      </form>
      <div className="af-link-list">
        <Link to="/profile/addresses">
          <b>Addresses</b>
          <span>Home, work and more →</span>
        </Link>
        <Link to="/profile/preferences">
          <b>Preferences</b>
          <span>Updates and reminders →</span>
        </Link>
        <Link to="/support">
          <b>Help & support</b>
          <span>FAQs and requests →</span>
        </Link>
      </div>
      <button
        className="af-btn ghost"
        type="button"
        onClick={() => {
          signOut();
          navigate('/', { replace: true });
        }}
      >
        Sign out
      </button>
    </section>
  );
}

const emptyAddress: AddressInput = {
  label: 'Home',
  line1: '',
  line2: '',
  landmark: '',
  city: 'Bengaluru',
  state: 'Karnataka',
  postalCode: '',
  isDefault: false,
};

export function AddressesScreen() {
  const { state, addAddress, removeAddress, setDefaultAddress } = useDomain();
  const [form, setForm] = useState<AddressInput | null>(null);
  const { busy, error, run } = useAction();
  const set = (key: keyof AddressInput) => (event: { target: { value: string } }) =>
    form && setForm({ ...form, [key]: event.target.value });

  return (
    <section className="af-screen af-form">
      <PageHeader
        title="Addresses"
        back="/profile"
        action={
          <button className="af-skip" onClick={() => setForm(form ? null : { ...emptyAddress, contactPhone: localPhone(state.profile.phone) })}>
            {form ? 'Close' : 'Add'}
          </button>
        }
      />
      {form ? (
        <form
          className="af-panel af-address-form"
          onSubmit={(event) => {
            event.preventDefault();
            void run(async () => {
              await addAddress({
                ...form,
                line2: form.line2?.trim() || undefined,
                landmark: form.landmark?.trim() || undefined,
                contactPhone: form.contactPhone?.trim() || undefined,
              });
              setForm(null);
            });
          }}
        >
          <label className="af-field">
            Label
            <input required value={form.label} onChange={set('label')} />
          </label>
          <label className="af-field">
            House, building, street
            <input required value={form.line1} onChange={set('line1')} />
          </label>
          <label className="af-field">
            Area
            <input value={form.line2} onChange={set('line2')} />
          </label>
          <label className="af-field">
            Landmark
            <input value={form.landmark} onChange={set('landmark')} />
          </label>
          <div className="af-form-grid">
            <label className="af-field">
              City
              <input required value={form.city} onChange={set('city')} />
            </label>
            <label className="af-field">
              State
              <input value={form.state} onChange={set('state')} />
            </label>
            <label className="af-field">
              PIN code
              <input required inputMode="numeric" pattern="\d{6}" value={form.postalCode} onChange={set('postalCode')} />
            </label>
            <label className="af-field">
              Contact phone
              <input inputMode="numeric" value={form.contactPhone} onChange={set('contactPhone')} />
            </label>
          </div>
          <label className="af-checkrow">
            <input
              type="checkbox"
              checked={Boolean(form.isDefault)}
              onChange={(event) => setForm({ ...form, isDefault: event.target.checked })}
            />
            Make this my default address
          </label>
          <ErrorText error={error} />
          <button className="af-btn" disabled={busy}>
            Save address
          </button>
        </form>
      ) : (
        <ErrorText error={error} />
      )}
      {state.addresses.map((address) => (
        <article className="af-panel" key={address.id}>
          <div className="af-card-line">
            <h3>{address.label}</h3>
            {address.isDefault ? <StatusPill tone="green">Default</StatusPill> : null}
          </div>
          <p>
            {address.summary}
            {address.contactPhone ? (
              <>
                <br />
                {address.contactPhone}
              </>
            ) : null}
          </p>
          <div className="af-inline-actions">
            {!address.isDefault ? (
              <button className="af-btn ghost" disabled={busy} onClick={() => void run(() => setDefaultAddress(address.id))}>
                Make default
              </button>
            ) : null}
            <button
              className="af-text-danger"
              disabled={busy}
              onClick={() => window.confirm('Remove this address?') && void run(() => removeAddress(address.id))}
            >
              Remove
            </button>
          </div>
        </article>
      ))}
      {state.addresses.length === 0 && !form ? <Empty title="No saved addresses" /> : null}
    </section>
  );
}

const PREFERENCES: { key: 'serviceUpdates' | 'maintenanceReminders' | 'documentReminders'; label: string; detail: string }[] = [
  { key: 'serviceUpdates', label: 'Service updates', detail: 'Check-in, approvals, ready for pickup.' },
  { key: 'maintenanceReminders', label: 'Maintenance reminders', detail: 'When a reminder is due soon or overdue.' },
  { key: 'documentReminders', label: 'Document expiry', detail: 'Before insurance, PUC or licence expire.' },
];

export function PreferencesScreen() {
  const { state, updateProfile } = useDomain();
  const [form, setForm] = useState({
    preferredChannel: state.profile.preferredChannel,
    whatsappConsent: state.profile.whatsappConsent,
    serviceUpdates: state.profile.serviceUpdates,
    maintenanceReminders: state.profile.maintenanceReminders,
    documentReminders: state.profile.documentReminders,
  });
  const [saved, setSaved] = useState(false);
  const { busy, error, run } = useAction();
  return (
    <section className="af-screen af-form">
      <PageHeader title="Preferences" back="/profile" />
      {saved ? <div className="af-success-banner">Preferences saved.</div> : null}
      <label className="af-field">
        Message me on
        <select
          value={form.preferredChannel}
          onChange={(event) => setForm({ ...form, preferredChannel: event.target.value as ApiProfile['preferredChannel'] })}
        >
          <option value="WHATSAPP">WhatsApp</option>
          <option value="SMS">SMS</option>
          <option value="EMAIL">Email</option>
        </select>
      </label>
      {form.preferredChannel === 'WHATSAPP' ? (
        <label className="af-toggle">
          <span>
            <b>WhatsApp consent</b>
            <small>Allow Autoflex and your service center to message you on WhatsApp.</small>
          </span>
          <input
            type="checkbox"
            checked={form.whatsappConsent}
            onChange={(event) => setForm({ ...form, whatsappConsent: event.target.checked })}
          />
        </label>
      ) : null}
      {PREFERENCES.map((item) => (
        <label className="af-toggle" key={item.key}>
          <span>
            <b>{item.label}</b>
            <small>{item.detail}</small>
          </span>
          <input
            type="checkbox"
            checked={form[item.key]}
            onChange={(event) => setForm({ ...form, [item.key]: event.target.checked })}
          />
        </label>
      ))}
      <ErrorText error={error} />
      <button
        className="af-btn"
        disabled={busy}
        onClick={() =>
          void run(async () => {
            await updateProfile(form);
            setSaved(true);
          })
        }
      >
        Save preferences
      </button>
    </section>
  );
}

const SUPPORT_CATEGORIES: { id: ApiSupportCategory; label: string }[] = [
  { id: 'SERVICE', label: 'A service or repair' },
  { id: 'BOOKING', label: 'A booking' },
  { id: 'PAYMENT', label: 'A bill or payment' },
  { id: 'ACCOUNT', label: 'My account' },
  { id: 'APP', label: 'Using the app' },
  { id: 'OTHER', label: 'Something else' },
];

const FAQ = [
  {
    q: 'How do I change a booking?',
    a: 'Open the booking under Services and cancel it before the slot starts, then book a new slot. The center is told straight away.',
  },
  {
    q: 'What happens when the center finds extra work?',
    a: 'You get a message with each item and its price. Approve all, some or none — only what you approve is added to the bill.',
  },
  {
    q: 'How do I pay?',
    a: 'Pay at the counter when you collect your vehicle, by UPI, card or cash. The receipt appears under Payments.',
  },
  {
    q: 'Are my documents safe?',
    a: 'Only you can see your vault. Service centers never see your documents unless you show them.',
  },
];

const SUPPORT_STATUS: Record<string, string> = {
  OPEN: 'Received',
  IN_PROGRESS: 'Being handled',
  RESOLVED: 'Resolved',
  CLOSED: 'Closed',
};

export function SupportScreen() {
  const { state, createSupportRequest, reloadSupport } = useDomain();
  const refreshRef = useRef(reloadSupport); refreshRef.current = reloadSupport;
  const [refreshError, setRefreshError] = useState('');
  useEffect(() => {
    const refresh = () => { if (document.visibilityState === 'visible') void refreshRef.current().then(() => setRefreshError('')).catch(() => setRefreshError('Could not refresh requests. Try again.')); };
    refresh(); const timer = window.setInterval(refresh, 30_000); window.addEventListener('focus', refresh);
    return () => { window.clearInterval(timer); window.removeEventListener('focus', refresh); };
  }, []);
  const pendingCreate = useRef<{ input: SupportInput; key: string } | null>(null);
  const [uncertain, setUncertain] = useState(false);
  const [sentId, setSentId] = useState('');
  const [params] = useSearchParams();
  const linked = params.get('jobId') ?? params.get('bookingId') ?? '';
  const [form, setForm] = useState({
    category: (linked ? 'SERVICE' : 'OTHER') as ApiSupportCategory,
    serviceId: linked,
    subject: '',
    message: '',
    preferredChannel: 'WHATSAPP' as NonNullable<SupportInput['preferredChannel']>,
  });
  const [sent, setSent] = useState('');
  const { busy, error, run } = useAction();

  function submit(event: FormEvent) {
    event.preventDefault();
    const service = state.services.find((item) => item.id === form.serviceId || item.bookingId === form.serviceId);
    void run(async () => {
      const input: SupportInput = {
        category: form.category,
        subject: form.subject.trim(),
        message: form.message.trim(),
        preferredChannel: form.preferredChannel,
        ...(service?.jobId ? { jobId: service.jobId } : service?.bookingId ? { bookingId: service.bookingId } : {}),
      };
      const attempt = pendingCreate.current ?? { input, key: crypto.randomUUID() };
      pendingCreate.current = attempt;
      let created;
      try { created = await createSupportRequest(attempt.input, attempt.key); }
      catch (err) { const unknown = !(err instanceof ApiError) || err.status === 0 || err.status >= 500; setUncertain(unknown); if (!unknown) pendingCreate.current = null; throw err; }
      pendingCreate.current = null; setUncertain(false); setSentId(created.id);
      setSent(created.referenceNumber);
      setForm({ ...form, subject: '', message: '' });
    });
  }

  return (
    <section className="af-screen af-wide">
      <PageHeader title="Help & support" />
      <div className="af-grid-main">
        <main>
          <h2>Frequently asked</h2>
          {FAQ.map((item) => (
            <details className="af-panel" key={item.q}>
              <summary>{item.q}</summary>
              <p>{item.a}</p>
            </details>
          ))}
          <h2>Your requests</h2>
          {refreshError ? <p className="af-error" role="alert">{refreshError} <button onClick={() => void refreshRef.current().then(() => setRefreshError('')).catch(() => setRefreshError('Could not refresh requests. Try again.'))}>Retry</button></p> : null}
          {state.supportRequests.length === 0 ? <p className="af-sub">No requests yet.</p> : null}
          {state.supportRequests.map((request) => (
            <article className="af-panel" key={request.id}>
              <div className="af-card-line">
                <span className="af-kicker">{request.referenceNumber}</span>
                <StatusPill tone={request.status === 'RESOLVED' || request.status === 'CLOSED' ? 'green' : 'blue'}>
                  {request.displayState === 'AWAITING_YOUR_REPLY' ? 'Awaiting your reply' : SUPPORT_STATUS[request.status]}
                </StatusPill>
              </div>
              <h3><Link to={`/support/${request.id}`}>{request.subject}</Link></h3>
              <p className="af-meta">{formatDate(request.createdAt)}</p>
            </article>
          ))}
        </main>
        <aside className="af-panel">
          <h2>Contact us</h2>
          {sent ? (
            <div className="af-success-banner">
              Request {sent} saved. <Link to={`/support/${sentId}`}>Read replies in Help & Support.</Link>
            </div>
          ) : null}
          <form onSubmit={submit}>
            <fieldset disabled={busy || uncertain} className="af-support-fieldset">
            <label className="af-field">
              It’s about
              <select value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value as ApiSupportCategory })}>
                {SUPPORT_CATEGORIES.map((item) => (
                  <option value={item.id} key={item.id}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
            {state.services.length ? (
              <label className="af-field">
                Service (optional)
                <select value={form.serviceId} onChange={(event) => setForm({ ...form, serviceId: event.target.value })}>
                  <option value="">Not about a specific service</option>
                  {state.services.map((service) => (
                    <option value={service.id} key={service.id}>
                      {service.reference} · {service.vehicleLabel}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            <label className="af-field">
              Subject
              <input required minLength={3} maxLength={150} value={form.subject} onChange={(event) => setForm({ ...form, subject: event.target.value })} />
            </label>
            <label className="af-field">
              Message
              <textarea
                required
                minLength={10}
                maxLength={4000}
                value={form.message}
                onChange={(event) => setForm({ ...form, message: event.target.value })}
                placeholder="Tell us what happened and how we can help."
              />
            </label>
            <label className="af-field">
              Reach me by
              <select
                value={form.preferredChannel}
                onChange={(event) => setForm({ ...form, preferredChannel: event.target.value as typeof form.preferredChannel })}
              >
                <option value="WHATSAPP">WhatsApp</option>
                <option value="CALL">Phone call</option>
                <option value="EMAIL">Email</option>
              </select>
            </label>
            </fieldset>
            {uncertain ? <p className="af-sub">The result could not be confirmed. Retry the same request to avoid sending it twice.</p> : null}
            <ErrorText error={error} />
            <button className="af-btn" disabled={busy}>
              {uncertain ? 'Retry same request' : 'Send request'}
            </button>
          </form>
        </aside>
      </div>
    </section>
  );
}
