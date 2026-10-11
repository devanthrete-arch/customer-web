import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AuthSplit } from '../components/AuthSplit';
import { destinationAfterAuth, devSignIn } from '../lib/api';
import { digitsOnly } from '../lib/format';
import {
  generateOtp,
  iamConfigured,
  loginOtp,
  registerCustomer,
  resendOtp,
} from '../lib/iam';
import {
  getPendingAuth,
  beginAuthenticatedSession,
  setPendingAuth,
  setPendingDisplayName,
} from '../lib/session';

const DEV_OTP_ID = 'dev';

function PhoneField({
  mobile,
  setMobile,
}: {
  mobile: string;
  setMobile: (v: string) => void;
}) {
  return (
    <label className="af-field">
      Mobile
      <div className="af-phone">
        <div className="af-cc">+91</div>
        <input
          inputMode="numeric"
          autoComplete="tel"
          placeholder="9876543210"
          value={mobile}
          onChange={(e) => setMobile(digitsOnly(e.target.value).slice(0, 10))}
        />
      </div>
    </label>
  );
}

export function AuthSignInScreen() {
  const navigate = useNavigate();
  const [mobile, setMobile] = useState('');
  const [jwt, setJwt] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function sendOtp(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (mobile.length < 10) {
      setError('Enter a 10-digit Indian mobile number.');
      return;
    }
    if (!iamConfigured()) {
      setPendingAuth({ mobile, otpId: DEV_OTP_ID });
      navigate('/auth/otp');
      return;
    }
    setBusy(true);
    try {
      const res = await generateOtp(mobile);
      setPendingAuth({ mobile, otpId: res.otpId });
      navigate('/auth/otp');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send OTP');
    } finally {
      setBusy(false);
    }
  }

  async function pasteJwt(e: FormEvent) {
    e.preventDefault();
    setError('');
    const token = jwt.trim();
    if (!token) {
      setError('Paste an access token.');
      return;
    }
    setBusy(true);
    try {
      beginAuthenticatedSession(token);
      navigate(await destinationAfterAuth(), { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Token rejected by Autoflex');
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthSplit>
    <section className="af-screen" data-screen="AUTH-01">
      <div className="af-auth-hero">
        <p className="af-auth-kicker">Autoflex</p>
        <h1 className="af-title">Sign in</h1>
        <p className="af-sub">Book a service, watch the visit, and pay at the center.</p>
      </div>
      <form onSubmit={sendOtp}>
        <PhoneField mobile={mobile} setMobile={setMobile} />
        {error ? <p className="af-error">{error}</p> : null}
        <button className="af-btn" type="submit" disabled={busy}>
          Send OTP
        </button>
      </form>
      {!iamConfigured() ? (
        <p className="af-note">
          Local mode: any mobile number signs in and any 6-digit code works. Use 9876543210 for the sample garage.
        </p>
      ) : null}
      <p className="af-linkrow">
        Don&apos;t have an account? <Link to="/auth/register">Sign Up</Link>
      </p>
      <details className="af-details">
        <summary>Paste test JWT (IAM down)</summary>
        <form onSubmit={pasteJwt}>
          <textarea
            value={jwt}
            onChange={(e) => setJwt(e.target.value)}
            placeholder="eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9..."
          />
          <button className="af-btn" type="submit" disabled={busy} style={{ marginTop: 8 }}>
            Continue with JWT
          </button>
        </form>
      </details>
    </section>
    </AuthSplit>
  );
}

export function AuthRegisterScreen() {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [mobile, setMobile] = useState('');
  const [agreed, setAgreed] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (!agreed) {
      setError('Agree with Terms & Condition to continue.');
      return;
    }
    if (name.trim().length < 2 || mobile.length < 10) {
      setError('Name and a 10-digit mobile are required.');
      return;
    }
    if (!iamConfigured()) {
      setPendingDisplayName(name.trim());
      setPendingAuth({ mobile, otpId: DEV_OTP_ID });
      navigate('/auth/otp');
      return;
    }
    setBusy(true);
    try {
      await registerCustomer(name.trim(), mobile);
      const res = await generateOtp(mobile);
      setPendingDisplayName(name.trim());
      setPendingAuth({ mobile, otpId: res.otpId });
      navigate('/auth/otp');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create account');
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthSplit>
    <section className="af-screen" data-screen="AUTH-02">
      <div className="af-auth-hero">
        <p className="af-auth-kicker">Autoflex</p>
        <h1 className="af-title">Get started</h1>
        <p className="af-sub">Your name and an Indian mobile number. We&apos;ll send a one-time code.</p>
      </div>
      <form onSubmit={onSubmit}>
        <label className="af-field">
          Full name
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Priya Sharma" />
        </label>
        <PhoneField mobile={mobile} setMobile={setMobile} />
        <label className="af-checkrow">
          <input
            type="checkbox"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
          />
          Agree with Terms & Condition
        </label>
        {error ? <p className="af-error">{error}</p> : null}
        <button className="af-btn" type="submit" disabled={busy}>
          Sign Up
        </button>
      </form>
      <p className="af-linkrow">
        Already have an account? <Link to="/auth/sign-in">Sign In</Link>
      </p>
    </section>
    </AuthSplit>
  );
}

export function AuthOtpScreen() {
  const navigate = useNavigate();
  const pending = getPendingAuth();
  const [digits, setDigits] = useState(['', '', '', '', '', '']);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const refs = useRef<Array<HTMLInputElement | null>>([]);

  useEffect(() => {
    if (!pending) navigate('/auth/sign-in', { replace: true });
  }, [navigate, pending]);

  function setDigit(i: number, value: string) {
    const d = digitsOnly(value).slice(-1);
    const next = [...digits];
    next[i] = d;
    setDigits(next);
    if (d && i < 5) refs.current[i + 1]?.focus();
  }

  async function verify(e: FormEvent) {
    e.preventDefault();
    if (!pending) return;
    const otp = digits.join('');
    if (otp.length < 4) {
      setError('Enter the verification code.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const token =
        pending.otpId === DEV_OTP_ID
          ? await devSignIn(pending.mobile)
          : await loginOtp(pending.otpId, otp);
      beginAuthenticatedSession(token);
      navigate(await destinationAfterAuth(), { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'OTP failed');
    } finally {
      setBusy(false);
    }
  }

  async function resend() {
    if (!pending || pending.otpId === DEV_OTP_ID) return;
    setError('');
    try {
      const res = await resendOtp(pending.otpId);
      setPendingAuth({ ...pending, otpId: res.otpId || pending.otpId });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Resend failed');
    }
  }

  return (
    <AuthSplit>
    <section className="af-screen" data-screen="AUTH-03">
      <p className="af-auth-kicker">Autoflex</p>
      <h1 className="af-title">Enter the code</h1>
      <p className="af-sub">
        We sent a one-time code to +91 {pending?.mobile}
      </p>
      <form onSubmit={verify}>
        <div className="af-otp">
          {digits.map((d, i) => (
            <input
              key={i}
              ref={(el) => {
                refs.current[i] = el;
              }}
              inputMode="numeric"
              maxLength={1}
              value={d}
              onChange={(e) => setDigit(i, e.target.value)}
            />
          ))}
        </div>
        {error ? <p className="af-error">{error}</p> : null}
        <button className="af-btn" type="submit" disabled={busy}>
          Verify
        </button>
      </form>
      <p className="af-linkrow">
        Didn&apos;t receive OTP?{' '}
        <button className="af-btn ghost" type="button" onClick={resend}>
          Resend code
        </button>
      </p>
    </section>
    </AuthSplit>
  );
}
