import { useEffect, useRef, useState } from 'react';
import { ApiError } from './api';
import {
  publicTrackingApi,
  terminalTracking,
  validTrackingToken,
  type PublicTracking,
} from './public-tracking';

type ReadState = {
  data?: PublicTracking;
  checkedAt?: number;
  busy: boolean;
  unavailable: boolean;
  error: string;
  retryAt?: number;
};

/** Each mounted instance belongs to exactly one token (the screen keys it). */
export function usePublicTracking(token: string) {
  const [state, setState] = useState<ReadState>({
    busy: validTrackingToken(token),
    unavailable: !validTrackingToken(token),
    error: '',
  });
  const refresh = useRef<() => void>(() => undefined);
  useEffect(() => {
    if (!validTrackingToken(token)) return;
    let alive = true,
      running = false,
      blocked = false,
      failures = 0,
      retryAt = 0,
      sequence = 0;
    let current: PublicTracking | undefined;
    let controller: AbortController | undefined;
    let timer: number | undefined, timeout: number | undefined;
    // Coalesce visibility+focus events even when the response finishes between them.
    let lastStarted = -Infinity;
    let nextAutomaticDelay = 30_000;
    function schedule(delay: number) {
      window.clearTimeout(timer);
      if (
        !alive ||
        blocked ||
        document.visibilityState !== 'visible' ||
        (terminalTracking(current?.status) && !retryAt)
      )
        return;
      timer = window.setTimeout(
        () => {
          void read(false);
        },
        Math.min(delay, 2_147_483_647),
      );
    }
    async function read(manual: boolean) {
      if (!alive || running) return;
      if (!manual && (blocked || document.visibilityState !== 'visible')) return;
      if (Date.now() < retryAt) {
        schedule(retryAt - Date.now());
        return;
      }
      if (!manual && Date.now() - lastStarted < 1_000) {
        schedule(nextAutomaticDelay);
        return;
      }
      window.clearTimeout(timer);
      blocked = false;
      running = true;
      const readSequence = ++sequence;
      let requestTimeout: number | undefined;
      lastStarted = Date.now();
      controller = new AbortController();
      const activeController = controller;
      setState((old) => ({ ...old, busy: true, retryAt: undefined }));
      let nextDelay = 30_000;
      try {
        const expiry = new Promise<never>((_, reject) => {
          requestTimeout = timeout = window.setTimeout(() => {
            activeController.abort();
            reject(new ApiError(0, 'Request timed out'));
          }, 15_000);
        });
        const data = await Promise.race([
          publicTrackingApi.load(token, activeController.signal),
          expiry,
        ]);
        if (!alive || readSequence !== sequence) return;
        current = data;
        failures = 0;
        retryAt = 0;
        setState({ data, checkedAt: Date.now(), busy: false, unavailable: false, error: '' });
      } catch (err) {
        if (!alive || readSequence !== sequence) return;
        const status = err instanceof ApiError ? err.status : 0;
        if (status >= 400 && status < 500 && status !== 408 && status !== 429) {
          current = undefined;
          blocked = true;
          retryAt = 0;
          setState({ busy: false, unavailable: true, error: '' });
        } else {
          failures++;
          nextDelay = Math.min(60_000 * 2 ** Math.min(failures - 1, 3), 300_000);
          retryAt =
            status === 429
              ? Date.now() + Math.max(nextDelay, (err as ApiError).retryAfterMs ?? 0)
              : 0;
          if (retryAt) nextDelay = retryAt - Date.now();
          setState((old) => ({
            ...old,
            busy: false,
            unavailable: false,
            retryAt: retryAt || undefined,
            error:
              status === 429
                ? 'Updates are temporarily limited. We’ll check again shortly.'
                : 'Could not refresh progress. Check your connection and try again.',
          }));
        }
      } finally {
        window.clearTimeout(requestTimeout);
        if (alive && readSequence === sequence) {
          running = false;
          nextAutomaticDelay = nextDelay;
          schedule(nextDelay);
        }
      }
    }
    refresh.current = () => {
      void read(true);
    };
    const onFocus = () => {
      void read(false);
    };
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') window.clearTimeout(timer);
      else void read(false);
    };
    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) {
        // A restored browser snapshot must be revalidated before being presented.
        current = undefined;
        blocked = false;
        const limited = Date.now() < retryAt;
        setState({
          busy: !limited,
          unavailable: false,
          retryAt: limited ? retryAt : undefined,
          error: limited ? 'Updates are temporarily limited. We’ll check again shortly.' : '',
        });
        void read(true);
      }
    };
    const onPageHide = () => {
      ++sequence;
      controller?.abort();
      running = false;
      window.clearTimeout(timer);
      window.clearTimeout(timeout);
    };
    void read(true);
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pageshow', onPageShow);
    window.addEventListener('pagehide', onPageHide);
    return () => {
      alive = false;
      controller?.abort();
      window.clearTimeout(timer);
      window.clearTimeout(timeout);
      refresh.current = () => undefined;
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pageshow', onPageShow);
      window.removeEventListener('pagehide', onPageHide);
    };
  }, [token]);
  return { ...state, refresh: () => refresh.current() };
}
