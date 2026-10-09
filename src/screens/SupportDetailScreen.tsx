import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { customerApi } from '../domain/client';
import type { ApiSupportEvent, ApiSupportRequest } from '../domain/api-types';
import { ApiError, errorMessage } from '../lib/api';
import { formatWhen } from '../lib/format';
import { PageHeader, StatusPill } from './ui';
export function SupportDetailScreen() {
  const { id = '' } = useParams();
  return <Conversation key={id} id={id} />;
}
function Conversation({ id }: { id: string }) {
  const [request, setRequest] = useState<ApiSupportRequest>(),
    [events, setEvents] = useState<ApiSupportEvent[]>([]),
    [before, setBefore] = useState<number | null>(null);
  const [readError, setReadError] = useState(''),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [refreshing, setRefreshing] = useState(false),
    [historyBusy, setHistoryBusy] = useState(false),
    [draft, setDraft] = useState(''),
    [saved, setSaved] = useState(false),
    [stale, setStale] = useState(false),
    [uncertain, setUncertain] = useState(false);
  const attempt = useRef<{ message: string; version: number; key: string } | null>(null),
    sequence = useRef(0),
    historyInitialized = useRef(false),
    inFlight = useRef(false),
    alive = useRef(true);
  const refresh = useCallback(async () => {
    const seq = ++sequence.current;
    setRefreshing(true);
    try {
      const [row, page] = await Promise.all([
        customerApi.supportRequest(id),
        customerApi.supportHistory(id),
      ]);
      if (!alive.current || seq !== sequence.current) return;
      setRequest(row);
      setEvents((old) =>
        [...old, ...page.items]
          .filter(
            (event, index, array) => array.findIndex((item) => item.id === event.id) === index,
          )
          .sort((a, b) => a.version - b.version),
      );
      if (!historyInitialized.current) {
        setBefore(page.nextBeforeVersion);
        historyInitialized.current = true;
      }
      setReadError('');
    } catch (err) {
      if (alive.current && seq === sequence.current) {
        setReadError(errorMessage(err));
        if (err instanceof ApiError && [403, 404].includes(err.status)) {
          setRequest(undefined);
          setEvents([]);
        }
      }
      throw err;
    } finally {
      if (alive.current && seq === sequence.current) setRefreshing(false);
    }
  }, [id]);
  useEffect(() => {
    alive.current = true;
    void refresh().catch(() => undefined);
    const tick = () => {
      if (document.visibilityState === 'visible') void refresh().catch(() => undefined);
    };
    const timer = window.setInterval(tick, 30_000);
    window.addEventListener('focus', tick);
    document.addEventListener('visibilitychange', tick);
    return () => {
      alive.current = false;
      ++sequence.current;
      window.clearInterval(timer);
      window.removeEventListener('focus', tick);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [refresh]);
  async function review() {
    try {
      await refresh();
      setStale(false);
      setError('');
    } catch {
      /* independent read error */
    }
  }
  async function older() {
    if (!before || historyBusy) return;
    setHistoryBusy(true);
    try {
      const page = await customerApi.supportHistory(id, before);
      if (alive.current) {
        setEvents((old) =>
          [...page.items, ...old]
            .filter(
              (event, index, array) => array.findIndex((item) => item.id === event.id) === index,
            )
            .sort((a, b) => a.version - b.version),
        );
        setBefore(page.nextBeforeVersion);
      }
    } catch (err) {
      setReadError(errorMessage(err));
    } finally {
      if (alive.current) setHistoryBusy(false);
    }
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!request || inFlight.current || stale) return;
    const pending = attempt.current ?? {
      message: draft.trim(),
      version: request.version,
      key: crypto.randomUUID(),
    };
    if (!pending.message) return;
    attempt.current = pending;
    inFlight.current = true;
    setBusy(true);
    setError('');
    setSaved(false);
    try {
      const receipt = await customerApi.replySupport(
        id,
        pending.message,
        pending.version,
        pending.key,
      );
      if (!alive.current) return;
      attempt.current = null;
      setUncertain(false);
      setDraft('');
      setSaved(true);
      setRequest((old) =>
        old ? { ...old, version: receipt.version, status: receipt.status } : old,
      );
      await refresh().catch(() => undefined);
    } catch (err) {
      if (!alive.current) return;
      const unknown = !(err instanceof ApiError) || err.status === 0 || err.status >= 500;
      setUncertain(unknown);
      if (!unknown) attempt.current = null;
      setError(
        unknown
          ? 'The result could not be confirmed. Retry the same reply to recover its result.'
          : errorMessage(err),
      );
      if (err instanceof ApiError && err.status === 409) setStale(true);
    } finally {
      inFlight.current = false;
      if (alive.current) setBusy(false);
    }
  }
  return (
    <section className="af-screen af-form">
      <PageHeader
        title="Your support request"
        back="/support"
        action={
          <button className="af-skip" disabled={refreshing || busy} onClick={() => void review()}>
            {refreshing ? 'Refreshing…' : 'Refresh'}
          </button>
        }
      />
      {readError ? (
        <p className="af-error" role="alert">
          {saved ? 'Your reply is saved. Could not refresh: ' : ''}
          {readError} <button onClick={() => void review()}>Retry refresh</button>
        </p>
      ) : null}
      {!request ? (
        <p role="status">{refreshing ? 'Loading your request…' : 'This request is unavailable.'}</p>
      ) : (
        <>
          <article className="af-panel">
            <span className="af-kicker">{request.referenceNumber}</span>
            <h2>{request.subject}</h2>
            <StatusPill tone={['CLOSED', 'RESOLVED'].includes(request.status) ? 'green' : 'blue'}>
              {request.displayState === 'AWAITING_YOUR_REPLY'
                ? 'Awaiting your reply'
                : request.status.toLowerCase().replace('_', ' ')}
            </StatusPill>
            <p className="af-sub">Opened {formatWhen(request.createdAt)}</p>
            {request.jobId || request.bookingId ? (
              <Link to={`/services/${request.jobId ?? request.bookingId}`}>
                View linked service
              </Link>
            ) : null}
          </article>
          <h2>Conversation</h2>
          {before ? (
            <button className="af-skip" disabled={historyBusy} onClick={() => void older()}>
              {historyBusy ? 'Loading…' : 'Load older messages'}
            </button>
          ) : null}
          <article className="af-panel af-support-message">
            <strong>You</strong>
            <small>{formatWhen(request.createdAt)}</small>
            <p>{request.message}</p>
          </article>
          {events
            .filter((event) => event.type !== 'CREATED')
            .map((event) => (
              <article className="af-panel af-support-message" key={event.id}>
                <div className="af-card-line">
                  <strong>{event.author}</strong>
                  <small>{formatWhen(event.createdAt)}</small>
                </div>
                {['RESOLVED', 'CLOSED', 'REOPENED'].includes(event.type) ? (
                  <span className="af-kicker">{event.type.toLowerCase()}</span>
                ) : null}
                <p>{event.body}</p>
              </article>
            ))}
          {request.legacyResolutionUnknown ? (
            <p className="af-sub">
              This older request was marked {request.status.toLowerCase()} before explanations were
              recorded.
            </p>
          ) : null}
          {saved ? (
            <p className="af-success-banner" role="status">
              Your reply is saved.
            </p>
          ) : null}
          {error ? (
            <p className="af-error" role="alert">
              {error}
            </p>
          ) : null}
          {stale ? (
            <div className="af-panel">
              <p>Your draft is kept. Refresh and review the conversation before sending again.</p>
              <button
                className="af-btn"
                onClick={() => void review()}
                disabled={refreshing || busy}
              >
                Refresh and review
              </button>
            </div>
          ) : null}
          {request.status === 'CLOSED' ? (
            <article className="af-panel">
              <h3>This request is closed</h3>
              <p>For more help, start a new request.</p>
              <Link className="af-btn" to="/support">
                New request
              </Link>
            </article>
          ) : (
            <form className="af-panel" onSubmit={(event) => void submit(event)}>
              <h3>Reply to Autoflex Support</h3>
              {request.status === 'RESOLVED' ? (
                <p className="af-sub">Replying will reopen this request.</p>
              ) : null}
              <label className="af-field">
                Message
                <textarea
                  required
                  maxLength={4000}
                  value={draft}
                  disabled={busy || uncertain}
                  onChange={(event) => setDraft(event.target.value)}
                />
              </label>
              <button className="af-btn" disabled={busy || stale || (!uncertain && !draft.trim())}>
                {busy ? 'Sending…' : uncertain ? 'Retry same reply' : 'Send reply'}
              </button>
            </form>
          )}
        </>
      )}
    </section>
  );
}
