import { useEffect, useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import type { ApiBookingEligibility, BookingEligibilityCode } from '../domain/api-types';
import { customerApi } from '../domain/client';
import { errorMessage } from '../lib/api';
import { signOut } from '../lib/session';
import { PageHeader } from '../screens/ui';

export function isBookingEligibilityCode(code: string | undefined): code is BookingEligibilityCode {
  return code === 'BOOKING_MINIMUM_AGE' || code === 'BOOKING_DATE_OF_BIRTH_REQUIRED' ||
    code === 'BOOKING_DATE_OF_BIRTH_INVALID';
}

export function BookingEligibilityNotice({ code }: { code: BookingEligibilityCode }) {
  const underAge = code === 'BOOKING_MINIMUM_AGE';
  return (
    <div className="af-panel" role="alert">
      <h2>{underAge ? 'An adult needs to make this booking' : 'Check your date of birth'}</h2>
      <p>
        {underAge
          ? 'You need to be 18 to book a service. An adult can book from their own Autoflex account.'
          : 'Add a valid date of birth to your profile before booking a service.'}
      </p>
      {underAge ? <button className="af-btn" type="button" onClick={signOut}>Switch account</button> : null}
      <Link className="af-btn ghost" to="/profile">
        {underAge ? 'Correct my date of birth' : 'Complete my profile'}
      </Link>
      <Link className="af-btn ghost" to="/services">Back to my services</Link>
    </div>
  );
}

/** All booking entry points use current server eligibility, including deep links. */
export function RequireBookingEligibility() {
  const { pathname } = useLocation();
  const [result, setResult] = useState<ApiBookingEligibility | null>(null);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let requestId = 0;
    const indiaDay = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
    let checkedDay = indiaDay();
    const check = async () => {
      const id = ++requestId;
      try {
        const profile = await customerApi.profile();
        if (cancelled || id !== requestId) return;
        setResult(profile.bookingEligibility);
        checkedDay = indiaDay();
        setError('');
      } catch (err) {
        if (!cancelled && id === requestId) setError(errorMessage(err, 'Could not check booking eligibility.'));
      }
    };
    const onFocus = () => void check();
    void check();
    window.addEventListener('focus', onFocus);
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible' && checkedDay !== indiaDay()) void check();
    }, 60_000);
    return () => {
      cancelled = true;
      window.removeEventListener('focus', onFocus);
      window.clearInterval(timer);
    };
  }, [pathname, retry]);

  const retryCheck = () => { setError(''); setRetry((n) => n + 1); };
  const refreshError = error ? (
    <div className="af-note" role="alert">
      <p>{error}</p>
      {result?.eligible ? <p>You can keep filling out your booking. Eligibility is checked again when you confirm.</p> : null}
      <button className="af-btn ghost" type="button" onClick={retryCheck}>Try again</button>
    </div>
  ) : null;

  // Only the first check blocks the flow. Refreshes must keep the current step
  // mounted, including its unsaved inputs, until the API reports ineligibility.
  if (!result) {
    return (
      <section className="af-screen af-form">
        <PageHeader title="Book a service" back="/services" />
        {refreshError ?? <p role="status">Checking your booking eligibility…</p>}
      </section>
    );
  }
  if (!result.eligible) {
    return (
      <section className="af-screen af-form">
        <PageHeader title="Book a service" back="/services" />
        <BookingEligibilityNotice code={result.code} />
        {refreshError}
      </section>
    );
  }
  return (
    <>
      {refreshError}
      <Outlet />
    </>
  );
}
