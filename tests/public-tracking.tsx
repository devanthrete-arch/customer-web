import { act, StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, useNavigate } from 'react-router-dom';
import App from '../src/App';
import { TRACKING_STATUSES } from '../src/lib/public-tracking';
import { SIGNED_OUT_EVENT } from '../src/lib/session';
import '../src/index.css';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;
const fixture = document.getElementById('fixture')!;
const results = document.getElementById('results')!;
const root = createRoot(fixture);
const originalFetch = window.fetch,
  originalNow = Date.now;
const originalTimeout = window.setTimeout.bind(window),
  originalClear = window.clearTimeout.bind(window);
const originalVisibility = Object.getOwnPropertyDescriptor(document, 'visibilityState');
const originalToken = localStorage.getItem('af_access_token');
const initialTitle = document.title;
let now = Date.parse('2026-10-09T06:30:00Z'),
  timerId = 1_000_000,
  visible = true;
const timers = new Map<number, { at: number; run: () => void }>();
Date.now = () => now;
Object.defineProperty(document, 'visibilityState', {
  configurable: true,
  get: () => (visible ? 'visible' : 'hidden'),
});
window.setTimeout = ((callback: TimerHandler, delay = 0, ...args: unknown[]) => {
  if (delay < 1_000 || typeof callback !== 'function')
    return originalTimeout(callback, delay, ...args);
  const id = ++timerId;
  timers.set(id, { at: now + delay, run: () => callback(...args) });
  return id;
}) as typeof window.setTimeout;
window.clearTimeout = (id) => {
  if (!timers.delete(id!)) originalClear(id);
};
const sample = {
  jobNumber: 'JC-TEST-PUBLIC',
  status: 'IN_PROGRESS',
  serviceType: 'Periodic service',
  estimatedReadyAt: '2026-10-09T11:00:00Z',
  centerName: 'Apex Auto Garage',
  centerPhone: '+918023456789',
  vehicleRegistration: 'KA01••1234',
  awaitingApproval: false,
  updatedAt: '2026-10-09T06:00:00Z',
  progress: [
    { status: 'CHECKED_IN', at: '2026-10-09T04:00:00Z' },
    { status: 'INSPECTION', at: '2026-10-09T04:30:00Z' },
    { status: 'IN_PROGRESS', at: '2026-10-09T06:00:00Z' },
  ],
};
const response = (body: unknown = sample, status = 200, headers?: HeadersInit) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });
let handler: (url: string, init: RequestInit) => Promise<Response> = async () => response();
const calls: { url: string; init: RequestInit }[] = [];
window.fetch = async (input, init = {}) => {
  const url = String(input);
  calls.push({ url, init });
  return handler(url, init);
};
let navigate: ReturnType<typeof useNavigate>;
function Navigation() {
  navigate = useNavigate();
  return null;
}
let instance = 0,
  passed = 0;
const check = (value: unknown, message: string) => {
  if (!value) throw new Error(message);
};
const flush = async () =>
  act(async () => {
    await new Promise<void>((resolve) => originalTimeout(resolve, 10));
  });
const body = () => fixture.textContent ?? '';
const heading = () => fixture.querySelector('h1')?.textContent;
function pass(message: string) {
  const p = document.createElement('p');
  p.textContent = `PASS · ${message}`;
  results.append(p);
  passed++;
}
async function mount(path = '/t/token-A') {
  visible = true;
  await act(async () =>
    root.render(
      <StrictMode>
        <MemoryRouter key={++instance} initialEntries={[path]}>
          <Navigation />
          <App />
        </MemoryRouter>
      </StrictMode>,
    ),
  );
  await flush();
}
async function click(label = 'Refresh progress') {
  const button = [...fixture.querySelectorAll<HTMLButtonElement>('button')].find(
    (b) => b.getAttribute('aria-label') === label || b.textContent === label,
  );
  check(button, `Missing button ${label}`);
  await act(async () => button!.click());
  await flush();
}
async function advance(ms: number) {
  const target = now + ms;
  for (let guard = 0; guard < 100; guard++) {
    const next = [...timers.entries()]
      .filter(([, value]) => value.at <= target)
      .sort((a, b) => a[1].at - b[1].at)[0];
    if (!next) break;
    now = next[1].at;
    timers.delete(next[0]);
    await act(async () => next[1].run());
    await flush();
  }
  now = target;
}
function pending<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

try {
  localStorage.setItem('af_access_token', 'af001-expired-test-session');
  handler = async () =>
    response({
      ...sample,
      serviceType: '<img src=x onerror=alert(1)>',
      privateNote: 'Do not expose',
      progress: [...sample.progress, { status: null, at: null }],
    });
  await mount();
  check(heading() === 'Service in progress', 'Guest public route should load');
  check(
    calls.every(
      (call) =>
        call.url.includes('/v1/track/') &&
        !new Headers(call.init.headers).has('Authorization') &&
        call.init.credentials === 'omit' &&
        call.init.cache === 'no-store' &&
        call.init.referrerPolicy === 'no-referrer',
    ),
    'Only anonymous no-store tracking requests are allowed',
  );
  check(
    !fixture.querySelector('main img') &&
      body().includes('<img src=x') &&
      !body().includes('Do not expose'),
    'Public text must be escaped and extra fields ignored',
  );
  check(
    localStorage.getItem('af_access_token') === 'af001-expired-test-session',
    'Reading tracking must not alter account session',
  );
  pass('Anonymous route omits JWT/cookies, avoids account calls and escapes public text');

  await act(async () => window.dispatchEvent(new Event(SIGNED_OUT_EVENT)));
  check(heading() === 'Service in progress', 'Public view must survive sign-out event');
  handler = async () => response();
  await act(async () => navigate('/auth/sign-in'));
  localStorage.removeItem('af_access_token');
  await act(async () => window.dispatchEvent(new Event(SIGNED_OUT_EVENT)));
  await flush();
  check(
    !fixture.querySelector('.af-track') &&
      document.title === initialTitle &&
      !document.querySelector('meta[name="robots"]'),
    'Private sign-out must leave tracking metadata restored',
  );
  pass('Public sign-out isolation preserves existing private navigation and restores metadata');

  await mount();
  const originalHeading = fixture.querySelector('h1');
  handler = async () => response({ message: 'Failure' }, 503);
  await click();
  check(
    fixture.querySelector('h1') === originalHeading &&
      body().includes('Showing the last available update'),
    'Refresh failure must retain the mounted snapshot',
  );
  const failedRefreshCalls = calls.length;
  await act(async () => window.dispatchEvent(new Event('focus')));
  await advance(30_000);
  check(calls.length === failedRefreshCalls, 'Coalesced focus must not shorten the failure backoff');
  await advance(30_000);
  check(calls.length === failedRefreshCalls + 1, 'The first failure must retry after 60 seconds');
  handler = async () => response({ ...sample, progress: sample.progress.slice(0, 1) });
  await click();
  check(
    !body().includes('Showing the last available update') &&
      fixture.querySelectorAll('.af-track-history li').length === 1,
    'Success replaces history and clears stale notice',
  );
  pass('Temporary failures preserve the snapshot; recovery replaces authoritative history');

  handler = async () => response({ message: 'Not found' }, 404);
  await click();
  check(
    !fixture.querySelector('.af-track-history') &&
      !fixture.querySelector('a[href^="tel:"]') &&
      !body().includes('JC-TEST-PUBLIC'),
    '404 must erase all previously loaded visit information',
  );
  const unavailableCalls = calls.length;
  await advance(90_000);
  await act(async () => window.dispatchEvent(new Event('focus')));
  check(calls.length === unavailableCalls, 'Unavailable links must not keep polling');
  pass('A replaced link clears history/contact and stops automatic reads');

  localStorage.setItem('af_access_token', 'af001-expired-test-session');
  handler = async () => response();
  await mount();
  handler = async () => response({ message: 'Forbidden' }, 403);
  await click();
  check(
    body().includes('Tracking link unavailable') &&
      localStorage.getItem('af_access_token') === 'af001-expired-test-session',
    'Public 403 must clear data without signing out',
  );
  pass('Unexpected access refusal clears the snapshot without changing the account session');

  const obsolete = pending<Response>();
  const obsoleteSignals: AbortSignal[] = [];
  handler = async (url, init) => {
    if (url.endsWith('token-A')) {
      obsoleteSignals.push(init.signal!);
      return obsolete.promise.then((value) => value.clone());
    }
    return response({ ...sample, jobNumber: 'JOB-B', status: 'ON_HOLD' });
  };
  await mount();
  await act(async () => navigate('/t/token-B'));
  await flush();
  await act(async () => obsolete.resolve(response({ ...sample, jobNumber: 'OBSOLETE-A' })));
  await flush();
  check(
    body().includes('JOB-B') &&
      !body().includes('OBSOLETE-A') &&
      obsoleteSignals.every((signal) => signal.aborted),
    'Obsolete token responses must not overwrite the current visit',
  );
  pass('Changing tokens cancels old work and rejects late responses');

  handler = async () => response();
  await mount();
  let count = calls.length;
  await advance(30_000);
  check(calls.length === count + 1, 'Active visible page polls after 30 seconds');
  visible = false;
  await act(async () => document.dispatchEvent(new Event('visibilitychange')));
  count = calls.length;
  await advance(90_000);
  check(calls.length === count, 'Hidden page must not poll');
  visible = true;
  await act(async () => {
    document.dispatchEvent(new Event('visibilitychange'));
    window.dispatchEvent(new Event('focus'));
  });
  await flush();
  check(calls.length === count + 1, 'Focus/visibility must coalesce into one refresh');
  pass('Visible polling, hidden pause and focus refresh coalesce correctly');

  const never = pending<Response>();
  let timeoutSignal: AbortSignal | undefined;
  handler = async (_, init) => {
    timeoutSignal = init.signal!;
    return never.promise;
  };
  await mount();
  await advance(15_000);
  check(
    body().includes('Progress is temporarily unavailable') && timeoutSignal?.aborted,
    'A hung read must time out and abort',
  );
  handler = async () => response();
  await click('Try again');
  check(heading() === 'Service in progress', 'Timeout retry must recover');
  pass('Hung requests time out, abort and recover through retry');

  handler = async () => response({ ...sample, status: 'COMPLETED' });
  await mount();
  count = calls.length;
  await advance(90_000);
  check(
    calls.length === count && !body().includes('Estimated ready time'),
    'Completed job stops automatic polling and hides ETA',
  );
  await act(async () => window.dispatchEvent(new Event('focus')));
  await flush();
  check(calls.length === count + 1, 'Completed job still revalidates on focus');
  pass('Terminal visits retain history and stop interval reads while allowing revalidation');

  handler = async () => response();
  await mount();
  handler = async () => response({ message: 'Rate limited' }, 429, { 'Retry-After': '120' });
  await click();
  count = calls.length;
  handler = async () => response();
  await act(async () =>
    window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: true })),
  );
  await act(async () =>
    window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true })),
  );
  await flush();
  check(
    calls.length === count && !body().includes('JC-TEST-PUBLIC'),
    'Restoration must hide the cached snapshot and retain Retry-After',
  );
  await advance(119_000);
  await act(async () => window.dispatchEvent(new Event('focus')));
  check(calls.length === count, 'Retry-After must prevent early automatic/focus attempts');
  check(
    Array.from(fixture.querySelectorAll('button')).some(
      (button) => button.textContent === 'Try again' && button.disabled,
    ),
    'Manual refresh must respect Retry-After',
  );
  await advance(1_000);
  check(
    calls.length === count + 1 && !body().includes('temporarily limited'),
    'Retry-After must recover once its delay expires',
  );
  await advance(30_000);
  check(calls.length === count + 2, 'Successful recovery must reset normal polling');
  pass('Rate limits retain progress, honor Retry-After and restore the regular interval');

  handler = async () =>
    response({ message: 'Rate limited' }, 429, { 'Retry-After': '99999999999999999999' });
  await mount();
  check(
    body().includes('Please try again later.') && !body().includes('Invalid Date'),
    'An unrepresentable Retry-After date must not crash the page',
  );
  count = calls.length;
  await advance(300_000);
  check(calls.length === count, 'A very long delay must not overflow into an immediate retry loop');
  pass('Oversized Retry-After values cannot crash rendering or overflow the polling timer');

  for (const [status, label] of Object.entries(TRACKING_STATUSES)) {
    handler = async () =>
      response({ ...sample, status, awaitingApproval: status === 'AWAITING_APPROVAL' });
    await mount();
    check(heading() === label, `Wrong status rendering for ${status}`);
    check(
      !fixture.querySelector('a[href*="approval"]') && !body().includes('₹'),
      'Public status must not expose approval/payment controls',
    );
  }
  handler = async () =>
    response({
      ...sample,
      status: '__proto__',
      centerPhone: 'javascript:alert(1)',
      estimatedReadyAt: 'not-a-date',
      updatedAt: 'invalid',
      progress: [{ status: 'ON_HOLD', at: 'invalid' }, { status: null }],
    });
  await mount();
  check(
    heading() === 'Service update' &&
      body().includes('Time unavailable') &&
      !body().includes('Invalid Date') &&
      !fixture.querySelector('a[href^="tel:"]'),
    'Unknown/null fields require safe fallbacks',
  );
  pass('All nine statuses, unknown fields, missing times and unsafe contacts have safe views');

  handler = async () => response();
  await mount();
  const oldRefresh = pending<Response>();
  handler = async () => oldRefresh.promise;
  await click();
  await act(async () =>
    window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: true })),
  );
  handler = async () => response({ message: 'Gone' }, 404);
  await act(async () =>
    window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true })),
  );
  await flush();
  await act(async () => oldRefresh.resolve(response()));
  await flush();
  check(
    body().includes('Tracking link unavailable') && !body().includes('JC-TEST-PUBLIC'),
    'Browser restoration must not revive a response from before pagehide',
  );
  pass('Browser history restoration revalidates and discards pre-suspension responses');

  count = calls.length;
  for (const path of ['/t', '/t/extra/path', '/t/a%2Fb', `/t/${'a'.repeat(129)}`]) {
    await mount(path);
    check(body().includes('Tracking link unavailable'), 'Malformed path must remain on CW-04');
  }
  check(calls.length === count, 'Malformed links must not issue API requests');
  pass('Missing, malformed and oversized links stay on the public unavailable screen');

  handler = async () => response();
  await mount();
  await act(async () => root.render(null));
  count = calls.length;
  await advance(300_000);
  await act(async () => window.dispatchEvent(new Event('focus')));
  check(calls.length === count && timers.size === 0, 'Unmount must clear polling and listeners');
  check(
    document.title === initialTitle && !document.querySelector('meta[name="robots"]'),
    'Unmount must restore metadata',
  );
  pass('Unmount removes every timer/listener and restores document metadata');
  document.getElementById('status')!.textContent = `All ${passed} regression scenarios passed.`;
} catch (error) {
  document.getElementById('status')!.textContent =
    `FAILED after ${passed}: ${error instanceof Error ? error.message : String(error)}`;
  console.error(error);
} finally {
  await act(async () => root.render(null));
  Date.now = originalNow;
  window.setTimeout = originalTimeout;
  window.clearTimeout = originalClear;
  if (originalVisibility) Object.defineProperty(document, 'visibilityState', originalVisibility);
  else Reflect.deleteProperty(document, 'visibilityState');
  if (originalToken === null) localStorage.removeItem('af_access_token');
  else localStorage.setItem('af_access_token', originalToken);
  window.fetch = originalFetch;
}
