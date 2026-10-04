import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { AuthSplit } from '../components/AuthSplit';
import {
  autoflex,
  profileComplete,
  type Profile,
} from '../lib/api';
import { digitsOnly, localPhone } from '../lib/format';
import {
  clearAccessToken,
  clearPendingDisplayName,
  getAccessToken,
  getPendingAuth,
  peekPendingDisplayName,
} from '../lib/session';

function ProfileForm({
  initialName,
  initialPhone,
  initialCity,
  submitLabel,
  onDone,
}: {
  initialName: string;
  initialPhone: string;
  initialCity: string;
  submitLabel: string;
  onDone: () => void;
}) {
  const [name, setName] = useState(initialName);
  const [phone, setPhone] = useState(initialPhone);
  const [city, setCity] = useState(initialCity);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

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
      <p className="af-sub">We need your name, mobile number, and city before the dashboard.</p>
      <ProfileForm
        initialName={profile?.displayName ?? peekPendingDisplayName()}
        initialPhone={localPhone(profile?.phone) || getPendingAuth()?.mobile || ''}
        initialCity={profile?.selectedPlaceLabel ?? ''}
        submitLabel="Continue"
        onDone={() => navigate('/home', { replace: true })}
      />
    </section>
    </AuthSplit>
  );
}

export function ProfileScreen() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    void autoflex<Profile>('/v1/me/profile', {}, true)
      .then(setProfile)
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : 'Could not load profile'),
      );
  }, []);

  function signOut() {
    clearAccessToken();
    navigate('/', { replace: true });
  }

  return (
    <section className="af-screen af-form">
      <h1 className="af-title">Profile</h1>
      {error ? <p className="af-error">{error}</p> : null}
      {profile ? (
        <ProfileForm
          initialName={profile.displayName ?? ''}
          initialPhone={localPhone(profile.phone)}
          initialCity={profile.selectedPlaceLabel ?? ''}
          submitLabel="Save"
          onDone={() => navigate('/home')}
        />
      ) : (
        <p className="af-hint">Loading profile…</p>
      )}
      <div className="af-stack">
        <Link to="/history">Service history</Link>
        <Link to="/maintenance">Maintenance</Link>
        <Link to="/payments">Payments</Link>
        <Link to="/support">Support</Link>
      </div>
      <button className="af-btn ghost" type="button" onClick={signOut}>
        Sign out
      </button>
    </section>
  );
}

export function RequireToken({ children }: { children: ReactNode }) {
  if (!getAccessToken()) return <Navigate to="/auth/sign-in" replace />;
  return children;
}
