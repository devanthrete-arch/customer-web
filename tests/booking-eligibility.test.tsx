import { act, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom';
import { RequireBookingEligibility } from '../src/components/BookingEligibility';
import { customerApi } from '../src/domain/client';
import type { ApiBookingEligibility, ApiProfile } from '../src/domain/api-types';

// Runs against the real mounted route guard with controlled network responses.
// No API, sign-in, or customer data is used by this standalone test entry point.
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
const allowed: ApiBookingEligibility = { eligible: true, minimumAge: 18, code: null, message: null };
const denied: ApiBookingEligibility = {
  eligible: false, minimumAge: 18, code: 'BOOKING_MINIMUM_AGE', message: 'Under 18',
};
type Pending = { resolve: (profile: ApiProfile) => void; reject: (error: Error) => void };
const pending: Pending[] = [];
const originalProfile = customerApi.profile;
customerApi.profile = () => new Promise<ApiProfile>((resolve, reject) => pending.push({ resolve, reject }));

const fixture = document.getElementById('fixture')!;
const results = document.getElementById('results')!;
const root = createRoot(fixture);
const mounts: Record<string, number> = {};
let navigate: ReturnType<typeof useNavigate>;
let editDraft: (text: string) => void;

function Probe({ step }: { step: string }) {
  const [draft, setDraft] = useState('');
  editDraft = setDraft;
  useEffect(() => { mounts[step] = (mounts[step] ?? 0) + 1; }, [step]);
  return <section data-step={step}><h2>{step}</h2><output>{draft}</output></section>;
}

function TestRoutes() {
  navigate = useNavigate();
  return (
    <Routes>
      <Route element={<RequireBookingEligibility />}>
        {['vehicle', 'issue', 'review'].map((step) => (
          <Route key={step} path={`/${step}`} element={<Probe key={step} step={step} />} />
        ))}
      </Route>
    </Routes>
  );
}

function check(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}
function passed(message: string) {
  const item = document.createElement('li');
  item.textContent = `PASS: ${message}`;
  results.append(item);
}
async function respond(request: Pending, eligibility: ApiBookingEligibility) {
  await act(async () => { request.resolve({ bookingEligibility: eligibility } as ApiProfile); });
}
function takeRequest() {
  const request = pending.shift();
  if (!request) throw new Error('Expected a profile check');
  return request;
}
function currentStep() { return fixture.querySelector('[data-step]'); }

try {
  await act(async () => { root.render(<MemoryRouter initialEntries={['/vehicle']}><TestRoutes /></MemoryRouter>); });
  check(!currentStep() && fixture.textContent?.includes('Checking your booking eligibility'), 'Initial entry must wait for eligibility');
  const first = takeRequest();
  await act(async () => { first.reject(new Error('Initial connection failed')); });
  check(!currentStep() && fixture.textContent?.includes('Initial connection failed'), 'Initial failure must stay blocked');
  await act(async () => { fixture.querySelector<HTMLButtonElement>('button')!.click(); });
  await respond(takeRequest(), allowed);
  check(currentStep()?.getAttribute('data-step') === 'vehicle', 'Adult should enter the wizard');
  passed('Initial loading/failure block entry; retry admits an adult.');

  await act(async () => { navigate('/issue'); });
  const issueRequest = takeRequest();
  const issueNode = currentStep();
  check(issueNode?.getAttribute('data-step') === 'issue', 'Next step must render while the refresh is pending');
  check(!fixture.textContent?.includes('Checking your booking eligibility'), 'Navigation must not show a blocking check');
  await act(async () => { editDraft('Unsaved issue details'); });
  await respond(issueRequest, allowed);
  check(currentStep() === issueNode && mounts.issue === 1, 'Eligible refresh must not remount the step');
  check(fixture.querySelector('output')?.textContent === 'Unsaved issue details', 'Draft must survive eligible refresh');
  passed('Navigation and a delayed eligible response keep the next step and its draft mounted.');

  await act(async () => { window.dispatchEvent(new Event('focus')); });
  const failedRefresh = takeRequest();
  await act(async () => { failedRefresh.reject(new Error('Refresh connection failed')); });
  check(currentStep() === issueNode && fixture.textContent?.includes('Refresh connection failed'), 'Refresh error must be inline');
  await act(async () => { fixture.querySelector<HTMLButtonElement>('button')!.click(); });
  check(currentStep() === issueNode, 'Retry must preserve the step while pending');
  await respond(takeRequest(), allowed);
  check(currentStep() === issueNode && fixture.querySelector('output')?.textContent === 'Unsaved issue details', 'Retry must preserve unsaved input');
  passed('Background failure and retry preserve the step and unsaved input.');

  await act(async () => { window.dispatchEvent(new Event('focus')); });
  const stale = takeRequest();
  await act(async () => { navigate('/review'); });
  const latest = takeRequest();
  await respond(stale, denied);
  check(currentStep()?.getAttribute('data-step') === 'review', 'Cancelled route request must not overwrite the latest route');
  await respond(latest, allowed);
  check(mounts.review === 1, 'Review must not remount after an eligible result');
  passed('An obsolete route response cannot replace the current step.');

  await act(async () => { window.dispatchEvent(new Event('focus')); });
  await respond(takeRequest(), denied);
  check(!currentStep() && fixture.textContent?.includes('An adult needs to make this booking'), 'Fresh denial must block the wizard');
  await act(async () => { navigate('/vehicle'); });
  const deniedNavigation = takeRequest();
  check(!currentStep(), 'Known ineligibility must stay blocked during a route refresh');
  await respond(deniedNavigation, allowed);
  check(currentStep()?.getAttribute('data-step') === 'vehicle', 'Corrected profile must re-enter the flow');
  passed('A fresh denial replaces the step; a corrected eligible profile restores access.');

  document.getElementById('status')!.textContent = 'All 5 regression scenarios passed.';
} catch (error) {
  document.getElementById('status')!.textContent = `FAILED: ${error instanceof Error ? error.message : String(error)}`;
  console.error(error);
} finally {
  await act(async () => { root.unmount(); });
  customerApi.profile = originalProfile;
}
