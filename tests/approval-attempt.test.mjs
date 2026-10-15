import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import vm from 'node:vm';
import { build } from 'esbuild';

const storage = new Map();
const calls = [];
let failTransport = true;
const code = await build({
  entryPoints: ['src/lib/approval-attempt.ts'],
  bundle: true,
  platform: 'node',
  format: 'cjs',
  write: false,
  plugins: [{
    name: 'isolated-transport',
    setup(api) {
      api.onResolve({ filter: /^\.\/(api|session)$/ }, (args) => ({ path: args.path, namespace: 'test' }));
      api.onLoad({ filter: /.*/, namespace: 'test' }, (args) => ({
        contents: args.path === './api'
          ? `export class ApiError extends Error { constructor(status, message) { super(message); this.status = status; } }
             export async function autoflex(path, init) { return globalThis.testRequest(path, init); }`
          : `export function customerSessionId() { return 'test-customer-session'; }`,
        loader: 'js',
      }));
    },
  }],
});
const module = { exports: {} };
vm.runInNewContext(code.outputFiles[0].text, {
  module, exports: module.exports, AbortSignal, console,
  crypto: { randomUUID },
  sessionStorage: {
    getItem: (key) => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, value),
    removeItem: (key) => storage.delete(key),
  },
  testRequest: async (path, init) => {
    calls.push({ path, key: init.headers['Idempotency-Key'], body: init.body });
    if (failTransport) throw new Error('connection lost after commit');
    return { id: 'job-1', pendingApprovalId: null };
  },
});
const { submitApprovalDecision, clearApprovalAttempt } = module.exports;
const decision = { approved: true };
await assert.rejects(submitApprovalDecision('job-1', 'approval-1', decision), /connection lost/);
assert.equal(calls.length, 1);
await assert.rejects(
  submitApprovalDecision('job-1', 'approval-1', { approved: false }),
  /Check the result of your previous decision/,
);
assert.equal(calls.length, 1);
failTransport = false;
const response = await submitApprovalDecision('job-1', 'approval-1', decision);
assert.equal(response.pendingApprovalId, null);
assert.equal(calls.length, 2);
assert.equal(calls[0].key, calls[1].key);
assert.equal(calls[0].body, calls[1].body);
clearApprovalAttempt('job-1', 'approval-1');
assert.equal(storage.size, 0);
console.log('Approval retry preserves its key and body across response loss.');
