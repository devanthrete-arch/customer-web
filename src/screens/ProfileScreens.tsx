import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { AuthSplit } from '../components/AuthSplit';
import {
  autoflex,
  profileComplete,
  type Profile,
} from '../lib/api';
import { digitsOnly, localPhone } from '../lib/format';
import {
  clearPendingDisplayName,
  getAccessToken,
  getPendingAuth,
  peekPendingDisplayName,
} from '../lib/session';

function ProfileForm({
  initialName,
  initialPhone,
  initialCity,
  initialDateOfBirth,
  submitLabel,
  onDone,
}: {
  initialName: string;
  initialPhone: string;
  initialCity: string;
  initialDateOfBirth: string;
  submitLabel: string;
  onDone: () => void;
}) {
  const [name, setName] = useState(initialName);
  const [phone, setPhone] = useState(initialPhone);
  const [city, setCity] = useState(initialCity);
  const [dateOfBirth, setDateOfBirth] = useState(initialDateOfBirth);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

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
    if (city.trim().length < 2) {
      setError('Enter your city.');
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
            selectedPlaceLabel: city.trim(),
            dateOfBirth,
            locale: 'en-IN',
          }),
        },
        true,
      );
      clearPendingDisplayName();
      onDone();
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
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Priya Sharma" />
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
        City
        <input value={city} onChange={(e) => setCity(e.target.value)} placeholder="Bengaluru" />
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
      <p className="af-hint">Kept on your account. We use it to know your age. We do not store a separate age.</p>
      {error ? <p className="af-error">{error}</p> : null}
      <button className="af-btn" type="submit" disabled={busy}>
        {submitLabel}
      </button>
    </form>
  );
}

export function ProfileSetupScreen() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void autoflex<Profile>('/v1/me/profile', {}, true)
      .then((me) => {
        if (cancelled) return;
        if (profileComplete(me)) {
          navigate('/home', { replace: true });
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
      <p className="af-sub">We need your name, mobile number, city, and date of birth before the dashboard.</p>
      <ProfileForm
        initialName={profile?.displayName ?? peekPendingDisplayName()}
        initialPhone={localPhone(profile?.phone) || getPendingAuth()?.mobile || ''}
        initialCity={profile?.selectedPlaceLabel ?? ''}
        initialDateOfBirth={profile?.dateOfBirth ?? ''}
        submitLabel="Continue"
        onDone={() => navigate('/home', { replace: true })}
      />
    </section>
    </AuthSplit>
  );
}

export function RequireToken({ children }: { children: ReactNode }) {
  if (!getAccessToken()) return <Navigate to="/auth/sign-in" replace />;
  return children;
}
