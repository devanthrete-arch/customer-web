import { ApiError, autoflex } from './api';
import { customerSessionId } from './session';
import type { ApprovalDecision } from '../domain/client';
import type { ApiCustomerJob } from '../domain/api-types';

type Attempt = { key: string; decision: ApprovalDecision };
const storageKey = (jobId: string, approvalId: string) =>
  `af_approval_attempt:${customerSessionId()}:${jobId}:${approvalId}`;

export function clearApprovalAttempt(jobId: string, approvalId: string): void {
  try {
    sessionStorage.removeItem(storageKey(jobId, approvalId));
  } catch {
    /* Sign-out also clears the session when browser storage is available. */
  }
}

export async function submitApprovalDecision(
  jobId: string,
  approvalId: string,
  decision: ApprovalDecision,
): Promise<ApiCustomerJob> {
  const key = storageKey(jobId, approvalId);
  let stored: Attempt | null;
  try {
    const raw = sessionStorage.getItem(key);
    try {
      stored = JSON.parse(raw ?? 'null') as Attempt | null;
    } catch {
      stored = null;
      sessionStorage.removeItem(key);
    }
    if (
      stored &&
      (typeof stored.key !== 'string' ||
        !/^[\w.:-]{8,128}$/.test(stored.key) ||
        !stored.decision ||
        typeof stored.decision !== 'object')
    ) {
      stored = null;
      sessionStorage.removeItem(key);
    }
  } catch {
    throw new ApiError(0, 'Unable to save this decision for a safe retry. Check browser storage and try again.');
  }
  if (stored && JSON.stringify(stored.decision) !== JSON.stringify(decision)) {
    throw new ApiError(409, 'Check the result of your previous decision before changing it. Retry the same selection or refresh the visit.');
  }
  const attempt = stored ?? { key: crypto.randomUUID(), decision };
  try {
    sessionStorage.setItem(key, JSON.stringify(attempt));
  } catch {
    throw new ApiError(0, 'Unable to save this decision for a safe retry. Check browser storage and try again.');
  }
  try {
    return await autoflex<ApiCustomerJob>(
      `/v1/me/jobs/${jobId}/approvals/${approvalId}/decision`,
      {
        method: 'POST',
        signal: AbortSignal.timeout(15000),
        headers: { 'Idempotency-Key': attempt.key },
        body: JSON.stringify(attempt.decision),
      },
      true,
    );
  } catch (error) {
    if (error instanceof ApiError && error.status >= 400 && error.status < 500 && ![408, 429].includes(error.status)) {
      clearApprovalAttempt(jobId, approvalId);
    }
    throw error;
  }
}
