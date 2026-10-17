import { useCallback, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { errorMessage } from '../lib/api';
import type {
  MaintenanceItem,
  ServiceStatus,
  VaultDocument,
} from '../domain/model';
import { Icon } from '../components/Icons';

export type Tone = 'blue' | 'orange' | 'green' | 'gray' | 'red';

export function PageHeader({
  title,
  back,
  action,
}: {
  title: string;
  back?: string;
  action?: ReactNode;
}) {
  return (
    <div className="af-top">
      {back ? (
        <Link className="af-back af-back-link" to={back} aria-label="Back">
          ‹
        </Link>
      ) : null}
      <h1 className="af-title">{title}</h1>
      {action}
    </div>
  );
}

export function StatusPill({
  children,
  tone = 'blue',
}: {
  children: ReactNode;
  tone?: Tone;
}) {
  return <span className={`af-status af-status-${tone}`}>{children}</span>;
}

export function NotFound({ title, back }: { title: string; back: string }) {
  return (
    <section className="af-screen af-form">
      <div className="af-empty">
        <h2>{title}</h2>
        <Link className="af-btn" to={back}>
          Go back
        </Link>
      </div>
    </section>
  );
}

export function Empty({
  title,
  children,
}: {
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="af-panel af-empty-panel">
      <span className="af-empty-mark" aria-hidden="true">
        <Icon name="file" />
      </span>
      <h3>{title}</h3>
      {children}
    </div>
  );
}

export function ErrorText({ error }: { error: string }) {
  return error ? (
    <p className="af-error" role="alert">
      {error}
    </p>
  ) : null;
}

/** Busy and error state for one async user action. */
export function useAction() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const run = useCallback(async (action: () => Promise<void>) => {
    setBusy(true);
    setError('');
    try {
      await action();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }, []);
  return { busy, error, setError, run };
}

export function serviceTone(status: ServiceStatus): Tone {
  if (status === 'COMPLETED') return 'green';
  if (status === 'CANCELLED' || status === 'NO_SHOW') return 'gray';
  if (status === 'AWAITING_APPROVAL' || status === 'ON_HOLD') return 'orange';
  if (status === 'READY_FOR_PICKUP') return 'green';
  return 'blue';
}

export function maintenanceTone(state: MaintenanceItem['state']): Tone {
  if (state === 'OVERDUE') return 'red';
  if (state === 'DUE_SOON') return 'orange';
  if (state === 'COMPLETED') return 'green';
  if (state === 'SNOOZED') return 'gray';
  return 'blue';
}

export function expiryTone(state: VaultDocument['expiryState']): Tone {
  if (state === 'EXPIRED') return 'red';
  if (state === 'EXPIRING_SOON') return 'orange';
  if (state === 'VALID') return 'green';
  return 'gray';
}

/** Today's date in India as YYYY-MM-DD. */
export function istToday(offsetDays = 0): string {
  const now = new Date(Date.now() + offsetDays * 86_400_000);
  return now.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
}
