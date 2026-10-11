import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useDiscoveryLocation } from '../location/DiscoveryLocation';
import { AuthSplit } from '../components/AuthSplit';
import { autoflex, profileComplete, type Profile } from '../lib/api';
import { digitsOnly, localPhone } from '../lib/format';
import { BOOKING_AGE_POLICY } from '../lib/booking-policy';
import {
  clearPendingDisplayName,
  getAccessToken,
  getPendingAuth,
  peekPendingDisplayName,
  rememberAuthReturnTo,
  takeAuthReturnTo,
} from '../lib/session';

function ProfileForm({
  initialName,
  initialPhone,
  initialDateOfBirth,
  submitLabel,
  onDone,
}: {
  initialName: string;
  initialPhone: string;
  initialDateOfBirth: string;
  submitLabel: string;
  onDone: () => void | Promise<void>;
}) {
  const [name, setName] = useState(initialName);
  const [phone, setPhone] = useState(initialPhone);
  const [dateOfBirth, setDateOfBirth] = useState(initialDateOfBirth);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const today = new Date().toLocaleDateString('en-CA', {
    timeZone: 'Asia/Kolkata',
  });

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (name.trim().length < 2) {
      setError('Enter your full name.');
      return;
    }
    if (phone.length < 10) {
      setError('Enter a 10-digit Indian mobile number.');
      return;
    }
    if (!dateOfBirth) {
      setError('Enter your date of birth.');
      return;
    }
    setBusy(true);
    try {
      await autoflex(
        '/v1/me/profile',
        {
          method: 'PUT',
          body: JSON.stringify({
            displayName: name.trim(),
            phone,
            dateOfBirth,
            locale: 'en-IN',
          }),
        },
        true,
      );
      clearPendingDisplayName();
      await onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save profile');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit}>
      <label className="af-field">
        Full name
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Priya Sharma"
        />
      </label>
      <label className="af-field">
        Mobile
        <div className="af-phone">
          <div className="af-cc">+91</div>
          <input
            inputMode="numeric"
            autoComplete="tel"
            value={phone}
            onChange={(e) => setPhone(digitsOnly(e.target.value).slice(0, 10))}
          />
        </div>
      </label>
      <label className="af-field">
        Date of birth
        <input
          type="date"
          required
          min="1900-01-01"
          max={today}
          value={dateOfBirth}
          onChange={(e) => setDateOfBirth(e.target.value)}
        />
      </label>
      <p className="af-hint">
        We use your date of birth to check booking eligibility.{' '}
        {BOOKING_AGE_POLICY}
      </p>
      {error ? <p className="af-error">{error}</p> : null}
      <button className="af-btn" type="submit" disabled={busy}>
        {submitLabel}
      </button>
    </form>
  );
}

export function ProfileSetupScreen() {
  const navigate = useNavigate();
  const { refreshProfile } = useDiscoveryLocation();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void autoflex<Profile>('/v1/me/profile', {}, true)
      .then((me) => {
        if (cancelled) return;
        if (profileComplete(me)) {
          navigate(takeAuthReturnTo(), { replace: true });
          return;
        }
        setProfile(me);
        setReady(true);
      })
      .catch(() => {
        if (!cancelled) setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  if (!ready) {
    return (
      <section className="af-screen">
        <p className="af-hint">Loading profile…</p>
      </section>
    );
  }

  return (
    <AuthSplit>
      <section className="af-screen af-form" data-screen="AUTH-07">
        <h1 className="af-title">Your profile</h1>
        <p className="af-sub">
          We need your name, mobile number, and date of birth. Your service
          location is chosen separately.
        </p>
        <ProfileForm
          initialName={profile?.displayName ?? peekPendingDisplayName()}
          initialPhone={
            localPhone(profile?.phone) || getPendingAuth()?.mobile || ''
          }
          initialDateOfBirth={profile?.dateOfBirth ?? ''}
          submitLabel="Continue"
          onDone={async () => {
            await refreshProfile();
            navigate(takeAuthReturnTo(), { replace: true });
          }}
        />
      </section>
    </AuthSplit>
  );
}

export function RequireToken({ children }: { children: ReactNode }) {
  const location = useLocation();
  useEffect(() => {
    if (!getAccessToken())
      rememberAuthReturnTo(
        `${location.pathname}${location.search}${location.hash}`,
      );
  }, [location.pathname, location.search, location.hash]);
  if (!getAccessToken()) return <Navigate to="/auth/sign-in" replace />;
  return children;
}
