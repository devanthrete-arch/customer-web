import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { customerApi } from '../src/domain/client';
import { SupportDetailScreen } from '../src/screens/SupportDetailScreen';
import { ApiError } from '../src/lib/api';
import type { ApiSupportEvent, ApiSupportRequest } from '../src/domain/api-types';
import '../src/index.css';
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;
const row: ApiSupportRequest = {
  id: 'e0000000-0000-4000-8000-000000000001',
  referenceNumber: 'SR-CUSTOMER-TEST',
  category: 'ACCOUNT',
  subject: 'Customer conversation regression',
  message: 'Please help with the account.',
  jobId: null,
  bookingId: null,
  status: 'OPEN',
  version: 1,
  displayState: 'OPEN',
  resolutionSummary: null,
  closureSummary: null,
  legacyResolutionUnknown: false,
  resolvedAt: null,
  closedAt: null,
  lastActivityAt: '2026-10-09T00:00:00Z',
  createdAt: '2026-10-09T00:00:00Z',
};
const history: ApiSupportEvent[] = [];
const calls: { message: string; version: number; key: string }[] = [];
const receipts = new Map<
  string,
  { requestId: string; version: number; status: ApiSupportRequest['status']; eventId: string }
>();
let mode: 'normal' | 'conflict' | 'uncertain' | 'readFailure' = 'normal',
  failRead = false;
customerApi.supportRequest = async () => {
  if (failRead) {
    failRead = false;
    throw new ApiError(0, 'Injected refresh failure');
  }
  return { ...row };
};
customerApi.supportHistory = async () => ({ items: [...history], nextBeforeVersion: null });
customerApi.replySupport = async (id, message, version, key) => {
  calls.push({ message, version, key });
  if (receipts.has(key)) return receipts.get(key)!;
  if (mode === 'conflict') {
    mode = 'normal';
    row.version++;
    throw new ApiError(409, 'The conversation changed', 'SUPPORT_VERSION_CONFLICT');
  }
  row.version++;
  const result = {
    requestId: id,
    version: row.version,
    status: row.status,
    eventId: crypto.randomUUID(),
  };
  receipts.set(key, result);
  history.push({
    id: result.eventId,
    version: row.version,
    type: 'CUSTOMER_REPLY',
    body: message,
    author: 'You',
    createdAt: new Date().toISOString(),
  });
  if (mode === 'uncertain') {
    mode = 'normal';
    throw new ApiError(0, 'Response lost');
  }
  if (mode === 'readFailure') {
    mode = 'normal';
    failRead = true;
  }
  return result;
};
const results = document.getElementById('results')!;
results.style.cssText = 'padding:24px;background:#1e4d45;color:white;';
results.innerHTML = '<h1>AF-010 · Customer conversation regressions</h1>';
const flush = async () =>
  act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 20));
  });
const textarea = () => document.querySelector('textarea')!;
async function fill(value: string) {
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(
      textarea(),
      value,
    );
    textarea().dispatchEvent(new Event('input', { bubbles: true }));
  });
}
async function click(name: string) {
  await act(async () => {
    const button = [...document.querySelectorAll('button')].find(
      (button) => button.textContent === name,
    );
    if (!button || button.disabled) throw new Error(`Unavailable button ${name}`);
    button.click();
  });
  await flush();
}
const assert = (condition: unknown, message: string) => {
  if (!condition) throw new Error(message);
};
async function test(name: string, run: () => Promise<void>) {
  try {
    await run();
    results.insertAdjacentHTML('beforeend', `<p>PASS · ${name}</p>`);
  } catch (error) {
    results.insertAdjacentHTML(
      'beforeend',
      `<p>FAIL · ${name}: ${error instanceof Error ? error.message : String(error)}</p>`,
    );
    throw error;
  }
}
async function main() {
  await act(async () => {
    createRoot(document.getElementById('root')!).render(
      <MemoryRouter initialEntries={['/support/' + row.id]}>
        <Routes>
          <Route path="/support/:id" element={<SupportDetailScreen />} />
        </Routes>
      </MemoryRouter>,
    );
  });
  await flush();
  await test('Conflict retains the customer draft through refresh and uses a fresh attempt', async () => {
    await fill('Draft after a changed conversation');
    mode = 'conflict';
    await click('Send reply');
    assert(textarea().value === 'Draft after a changed conversation', 'Draft lost');
    const failed = calls[calls.length - 1];
    await click('Refresh and review');
    assert(textarea().value === 'Draft after a changed conversation', 'Refresh lost draft');
    await click('Send reply');
    const retry = calls[calls.length - 1];
    assert(retry.key !== failed.key && retry.version === failed.version + 1, 'Stale retry');
  });
  await test('Uncertain reply recovers the exact receipt without duplication', async () => {
    await fill('This reply must be sent once');
    mode = 'uncertain';
    await click('Send reply');
    assert(
      textarea().value === 'This reply must be sent once' && textarea().disabled,
      'Draft not protected',
    );
    await click('Retry same reply');
    assert(
      JSON.stringify(calls[calls.length - 1]) === JSON.stringify(calls[calls.length - 2]),
      'Retry changed attempt',
    );
    assert(
      history.filter((event) => event.body === 'This reply must be sent once').length === 1,
      'Duplicate reply',
    );
  });
  await test('Successful reply remains saved when its following read fails', async () => {
    await fill('A saved message with a failed refresh');
    mode = 'readFailure';
    await click('Send reply');
    assert(
      document.body.textContent?.includes('Your reply is saved. Could not refresh'),
      'Missing committed state',
    );
    assert(
      !document.body.textContent?.includes('Retry same reply'),
      'Successful send marked failed',
    );
    const count = history.length;
    await click('Retry refresh');
    assert(history.length === count, 'Refresh submitted again');
  });
  results.insertAdjacentHTML('beforeend', '<strong>3/3 scenarios passed</strong>');
}
void main().catch((error) => console.error(error));
