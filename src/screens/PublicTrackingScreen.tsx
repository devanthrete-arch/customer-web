import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { LogoMark } from '../components/LogoLockup';
import { formatWhen } from '../lib/format';
import { terminalTracking, trackingLabel, validTrackingToken } from '../lib/public-tracking';
import { usePublicTracking } from '../lib/usePublicTracking';

export function PublicTrackingScreen() {
  const { token = '' } = useParams();
  useEffect(() => {
    const title = document.title;
    const existing = document.querySelector<HTMLMetaElement>('meta[name="robots"]');
    const robots = existing ?? document.createElement('meta');
    const previous = robots.getAttribute('content');
    robots.name = 'robots';
    robots.content = 'noindex, nofollow, noarchive';
    if (!existing) document.head.append(robots);
    document.title = 'Service progress · Autoflex';
    return () => {
      document.title = title;
      if (!existing) robots.remove();
      else if (previous === null) robots.removeAttribute('content');
      else robots.content = previous;
    };
  }, []);
  return <TrackingPage key={token} token={token} />;
}

function TrackingPage({ token }: { token: string }) {
  const { data, checkedAt, busy, unavailable, error, retryAt, refresh } = usePublicTracking(token);
  const [announcement, setAnnouncement] = useState('');
  const previousStatus = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (data && previousStatus.current && previousStatus.current !== data.status) {
      setAnnouncement(`Status updated: ${trackingLabel(data.status)}.`);
    }
    previousStatus.current = data?.status;
  }, [data?.status]);
  const terminal = terminalTracking(data?.status);
  const tone =
    data &&
    (['READY_FOR_PICKUP', 'COMPLETED'].includes(data.status)
      ? 'ready'
      : ['ON_HOLD', 'AWAITING_APPROVAL'].includes(data.status)
        ? 'attention'
        : 'normal');
  const retryLimited = !!retryAt && Date.now() < retryAt;
  const retryDate = new Date(retryAt ?? NaN);
  const retryMessage = Number.isFinite(retryDate.getTime())
    ? `Next check after ${formatWhen(retryDate.toISOString())} IST.`
    : 'Please try again later.';
  return (
    <div className="af-track">
      <header className="af-track-header">
        <Link to="/" className="af-track-brand" aria-label="Autoflex home">
          <LogoMark decorative />
          <span>Service progress</span>
        </Link>
        <Link className="af-track-account" to="/services">
          My services <span aria-hidden="true">↗</span>
        </Link>
      </header>
      <main className="af-track-main">
        <span className="af-track-sr" role="status" aria-live="polite">
          {announcement}
        </span>
        {unavailable ? (
          <section className="af-track-message">
            <p className="af-kicker">Tracking link unavailable</p>
            <h1>We couldn’t find this service.</h1>
            <p>
              The link may be incorrect or have been replaced. Ask the service center for the latest
              tracking link.
            </p>
            {validTrackingToken(token) ? (
              <button className="af-btn" disabled={busy} onClick={refresh}>
                {busy ? 'Checking…' : 'Check again'}
              </button>
            ) : null}
            <Link to="/">Go to Autoflex</Link>
          </section>
        ) : !data ? (
          <section className="af-track-message" aria-busy={busy}>
            <p className="af-kicker">Service progress</p>
            <h1>{busy ? 'Checking your service…' : 'Progress is temporarily unavailable.'}</h1>
            <p>{busy ? 'Getting the latest update from the service center.' : error}</p>
            {!busy ? (
              <button className="af-btn" disabled={retryLimited} onClick={refresh}>
                Try again
              </button>
            ) : null}
            {retryLimited ? <p>{retryMessage}</p> : null}
          </section>
        ) : (
          <>
            <section className={`af-track-hero af-track-${tone}`}>
              <div>
                <p className="af-kicker">{data.jobNumber ?? 'Your service visit'}</p>
                <h1>{trackingLabel(data.status)}</h1>
                <p className="af-track-service">{data.serviceType}</p>
                {data.vehicleRegistration ? (
                  <span
                    className="af-track-plate"
                    aria-label={`Vehicle registration ${data.vehicleRegistration}`}
                  >
                    {data.vehicleRegistration}
                  </span>
                ) : null}
              </div>
              <div className="af-track-refresh">
                <button
                  className="af-track-button"
                  onClick={refresh}
                  disabled={busy || retryLimited}
                  aria-label="Refresh progress"
                >
                  {busy ? 'Refreshing…' : 'Refresh progress'}
                </button>
                {checkedAt ? (
                  <small>Last checked {formatWhen(new Date(checkedAt).toISOString())} IST</small>
                ) : null}
              </div>
            </section>
            {error ? (
              <div className="af-track-error" role="alert">
                <strong>Showing the last available update.</strong>
                <p>{error}</p>
                {retryLimited ? <small>{retryMessage}</small> : null}
              </div>
            ) : null}
            {data.awaitingApproval && !terminal ? (
              <div className="af-track-notice">
                <strong>The center is awaiting an approval.</strong>
                <p>
                  Contact the center, or open My services in the vehicle owner’s account to review
                  any request.
                </p>
              </div>
            ) : null}
            {data.status === 'ON_HOLD' ? (
              <div className="af-track-notice">
                <strong>Work is paused.</strong>
                <p>Contact the center for the latest information and expected timing.</p>
              </div>
            ) : null}
            {data.status === 'READY_FOR_PICKUP' ? (
              <div className="af-track-notice">
                <strong>Your vehicle is ready to collect.</strong>
                <p>Contact the center to arrange pickup and confirm the bill at the counter.</p>
              </div>
            ) : null}
            <div className="af-track-columns">
              <section className="af-track-history" aria-label="Recorded status history">
                <div className="af-track-section-heading">
                  <h2>Service updates</h2>
                  <span>India time · IST</span>
                </div>
                {data.progress.length ? (
                  <ol>
                    {data.progress.map((event, index) => (
                      <li key={`${event.status}:${event.at}:${index}`}>
                        <span className="af-track-marker" aria-hidden="true">
                          {String(index + 1).padStart(2, '0')}
                        </span>
                        <div>
                          <h3>{trackingLabel(event.status)}</h3>
                          {event.at ? (
                            <time dateTime={event.at}>{formatWhen(event.at)}</time>
                          ) : (
                            <span className="af-meta">Time unavailable</span>
                          )}
                        </div>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p>Recorded status updates will appear here.</p>
                )}
                {data.updatedAt ? (
                  <p className="af-track-updated">Job updated {formatWhen(data.updatedAt)} IST</p>
                ) : null}
              </section>
              <aside className="af-track-center">
                <p className="af-kicker">Your service center</p>
                <h2>{data.centerName ?? 'Service center'}</h2>
                {data.centerPhone ? (
                  <a className="af-btn" href={`tel:${data.centerPhone}`}>
                    Call center <span aria-hidden="true">↗</span>
                  </a>
                ) : (
                  <p>Contact the center using the details on your receipt or message.</p>
                )}
                {!terminal ? (
                  <div className="af-track-eta">
                    <h3>Estimated ready time</h3>
                    {data.estimatedReadyAt ? (
                      <>
                        <p>{formatWhen(data.estimatedReadyAt)} IST</p>
                        <small>
                          {Date.parse(data.estimatedReadyAt) < (checkedAt ?? Date.now()) ||
                          data.status === 'ON_HOLD'
                            ? 'This is the last estimate. Contact the center for the latest timing.'
                            : 'An estimate from the center; timing may change.'}
                        </small>
                      </>
                    ) : (
                      <p>The center hasn’t shared an estimate yet.</p>
                    )}
                  </div>
                ) : (
                  <p className="af-track-eta">
                    This visit is {data.status === 'COMPLETED' ? 'complete' : 'cancelled'}. Its
                    recorded status history remains available.
                  </p>
                )}
              </aside>
            </div>
          </>
        )}
        <footer className="af-track-footer">
          <p>Anyone with this link can see limited service progress. Share it with care.</p>
          <p>
            {data && !terminal
              ? 'Checks for updates every 30 seconds while this page is open and visible.'
              : 'Use the latest link provided by your service center.'}
          </p>
        </footer>
      </main>
    </div>
  );
}
