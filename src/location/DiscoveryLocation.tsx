import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react';
import { ApiError, errorMessage, type Profile } from '../lib/api';
import { clearDraft } from '../lib/booking';
import {
  lastUsedLocation,
  locationApi,
  locationDescription,
  validDiscoveryLocation,
  type DiscoveryLocation,
  type LocationSource,
  type PostalLookup,
} from '../lib/discovery-location';
import {
  customerSessionId,
  DISCOVERY_SESSION_KEY,
  getAccessToken,
  SIGNED_IN_EVENT,
  SIGNED_OUT_EVENT,
} from '../lib/session';
import { Icon } from '../components/Icons';
import {
  LocationContext,
  useDiscoveryLocation,
  type DiscoveryLocationContext,
} from './context';
export { useDiscoveryLocation } from './context';
type Resolution = { location: DiscoveryLocation; source: LocationSource };
type StoredResolution = Resolution & {
  session: string;
  account: string | null;
};

function readResolution(account: string | null): Resolution | null {
  try {
    const raw = sessionStorage.getItem(DISCOVERY_SESSION_KEY);
    if (!raw) return null;
    const value = JSON.parse(raw) as StoredResolution;
    if (
      value.session !== customerSessionId() ||
      !account ||
      value.account !== account ||
      !validDiscoveryLocation(value.location) ||
      !['MANUAL', 'GPS', 'LAST_USED', 'DEFAULT'].includes(value.source)
    )
      return null;
    return { location: value.location, source: value.source };
  } catch {
    return null;
  }
}

export function DiscoveryLocationProvider({
  children,
  initialLocation,
  resolvedSession = true,
}: {
  children: ReactNode;
  /** Isolated browser fixtures can supply a resolved location without account/network access. */
  initialLocation?: DiscoveryLocation;
  resolvedSession?: boolean;
}) {
  const [resolution, setResolution] = useState<Resolution | null>(
    initialLocation && resolvedSession
      ? { location: initialLocation, source: 'MANUAL' }
      : null,
  );
  const [profile, setProfile] = useState<Profile | null>(null);
  const [fallbackDefault, setFallbackDefault] =
    useState<DiscoveryLocation | null>(null);
  const [radius, setRadius] = useState(15000);
  const [ready, setReady] = useState(Boolean(initialLocation));
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [revision, setRevision] = useState(0);
  const generation = useRef(0);
  const account = useRef<string | null>(null);
  const resolutionRef = useRef(resolution);
  const saveQueue = useRef<Promise<unknown>>(Promise.resolve());
  const returnFocus = useRef<HTMLElement | null>(null);
  resolutionRef.current = resolution;
  useEffect(() => {
    if (!pickerOpen && returnFocus.current) {
      const target = returnFocus.current.isConnected
        ? returnFocus.current
        : document.querySelector<HTMLElement>('.af-location-switch');
      target?.focus();
      returnFocus.current = null;
    }
  }, [pickerOpen]);

  function remember(value: Resolution, id = account.current) {
    try {
      sessionStorage.setItem(
        DISCOVERY_SESSION_KEY,
        JSON.stringify({ ...value, session: customerSessionId(), account: id }),
      );
    } catch {
      setNotice(
        'Location is active for this visit, but could not be remembered in this browser.',
      );
    }
  }

  function identify(id: string | null) {
    try {
      const previous = sessionStorage.getItem('af_location_account');
      if (previous && previous !== id) clearDraft();
      if (id) sessionStorage.setItem('af_location_account', id);
    } catch {
      /* Identity isolation in provider memory remains in place. */
    }
    account.current = id;
  }

  useEffect(() => {
    const reset = () => {
      generation.current++;
      account.current = null;
      setResolution(null);
      setProfile(null);
      setFallbackDefault(null);
      setReady(false);
      setNotice('');
      setError('');
      setPickerOpen(false);
      setRevision((value) => value + 1);
    };
    const storage = (event: StorageEvent) => {
      if (event.key === 'af_access_token') reset();
    };
    window.addEventListener(SIGNED_IN_EVENT, reset);
    window.addEventListener(SIGNED_OUT_EVENT, reset);
    window.addEventListener('storage', storage);
    return () => {
      generation.current++;
      window.removeEventListener(SIGNED_IN_EVENT, reset);
      window.removeEventListener(SIGNED_OUT_EVENT, reset);
      window.removeEventListener('storage', storage);
    };
  }, []);

  useEffect(() => {
    if (initialLocation) return;
    const request = ++generation.current;
    if (!getAccessToken()) return;
    let live = true;
    setReady(false);
    void Promise.allSettled([locationApi.profile(), locationApi.config()]).then(
      ([me, config]) => {
        if (!live || request !== generation.current) return;
        const found = me.status === 'fulfilled' ? me.value : null;
        identify(found?.id ?? null);
        setProfile(found);
        if (config.status === 'fulfilled') {
          const value = config.value;
          setFallbackDefault(
            validDiscoveryLocation(value.defaultLocation)
              ? value.defaultLocation
              : null,
          );
          setRadius(
            Number.isFinite(value.radiusMeters) &&
              value.radiusMeters >= 100 &&
              value.radiusMeters <= 100000
              ? value.radiusMeters
              : 15000,
          );
        }
        if (
          me.status === 'rejected' &&
          !(me.reason instanceof ApiError && me.reason.status === 404)
        )
          setError(
            'Your last-used location could not be loaded. Look up a PIN, use your exact location, or retry.',
          );
        else if (config.status === 'rejected')
          setError(
            'The default location could not be loaded. Look up a PIN, use your exact location, or use your last-used location.',
          );
        else setError('');
        setResolution(readResolution(found?.id ?? null));
        setReady(true);
      },
    );
    return () => {
      live = false;
    };
  }, [initialLocation, revision]);

  async function refreshProfile() {
    const request = generation.current;
    const found = await locationApi.profile();
    if (request !== generation.current) return;
    identify(found.id);
    setProfile(found);
    if (resolutionRef.current) remember(resolutionRef.current, found.id);
  }

  function choose(location: DiscoveryLocation, source: LocationSource) {
    if (!validDiscoveryLocation(location)) return;
    const value = { location, source };
    const request = generation.current;
    resolutionRef.current = value;
    setResolution(value);
    setError('');
    setNotice('');
    setPickerOpen(false);
    remember(value);
    if (source === 'DEFAULT' || source === 'LAST_USED' || initialLocation)
      return;
    // A usable session choice survives a failed persistence request.
    const save = saveQueue.current
      .catch(() => undefined)
      .then(() => {
        if (request !== generation.current) return null;
        return locationApi.save(location);
      });
    saveQueue.current = save;
    void save
      .then((saved) => {
        if (!saved) return;
        if (
          request !== generation.current ||
          resolutionRef.current?.location !== location
        )
          return;
        identify(saved.id);
        setProfile(saved);
        remember(value, saved.id);
      })
      .catch(() => {
        if (
          request === generation.current &&
          resolutionRef.current?.location === location
        )
          setNotice(
            'Location is active now, but could not be saved for your next sign-in.',
          );
      });
  }
  const lastUsed = lastUsedLocation(profile, radius);
  const fallback = lastUsed ?? fallbackDefault;
  const context: DiscoveryLocationContext = {
    location: resolution?.location ?? null,
    source: resolution?.source ?? null,
    resolved: Boolean(resolution),
    ready,
    notice,
    error,
    openPicker: () => {
      returnFocus.current =
        document.activeElement instanceof HTMLElement &&
        document.activeElement !== document.body
          ? document.activeElement
          : document.querySelector<HTMLElement>('.af-location-switch');
      setPickerOpen(true);
    },
    refreshProfile,
    retry: () => setRevision((value) => value + 1),
  };
  return (
    <LocationContext.Provider value={context}>
      {children}
      {pickerOpen && (
        <LocationPicker
          required={!resolution}
          current={resolution?.location ?? lastUsed}
          fallback={fallback}
          fallbackSource={lastUsed ? 'LAST_USED' : 'DEFAULT'}
          radius={radius}
          error={error}
          onRetry={context.retry}
          onChoose={choose}
          onClose={() => setPickerOpen(false)}
        />
      )}
    </LocationContext.Provider>
  );
}

export function LocationToolbar() {
  const { location, source, notice, ready, openPicker } =
    useDiscoveryLocation();
  return (
    <header className="af-location-toolbar">
      <div className="af-location-context" role="status">
        {source === 'LAST_USED'
          ? 'Using your last-used location'
          : source === 'DEFAULT'
            ? 'Using the default location'
            : ''}
        {notice && <span>{notice}</span>}
      </div>
      <button
        type="button"
        className="af-location-switch"
        onClick={openPicker}
        disabled={!ready}
        aria-label={`Change location, ${location ? locationDescription(location) : 'choose an area'}`}
      >
        <Icon name="pin" />
        <span>
          <small>Service location</small>
          <strong>
            {location ? locationDescription(location) : 'Choose an area'}
          </strong>
        </span>
        <span aria-hidden="true">⌄</span>
      </button>
    </header>
  );
}

export function RequireDiscoveryLocation({
  children,
}: {
  children: ReactNode;
}) {
  const { ready, resolved, openPicker, error, retry } = useDiscoveryLocation();
  useEffect(() => {
    if (ready && !resolved) openPicker();
  }, [ready, resolved]);
  if (resolved) return children;
  return (
    <section className="af-screen af-location-gate">
      <h1>Find services in your area</h1>
      <p>
        {ready
          ? 'Choose your service location to continue.'
          : 'Loading your service location…'}
      </p>
      {error && <p role="alert">{error}</p>}
      {ready && (
        <button className="af-btn" onClick={openPicker}>
          Choose location
        </button>
      )}
      {error && (
        <button className="af-skip" onClick={retry}>
          Retry location settings
        </button>
      )}
    </section>
  );
}

function LocationPicker({
  required,
  current,
  fallback,
  fallbackSource,
  radius,
  error,
  onRetry,
  onChoose,
  onClose,
}: {
  required: boolean;
  current: DiscoveryLocation | null;
  fallback: DiscoveryLocation | null;
  fallbackSource: 'LAST_USED' | 'DEFAULT';
  radius: number;
  error: string;
  onRetry: () => void;
  onChoose: (location: DiscoveryLocation, source: LocationSource) => void;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const requests = useRef(0);
  const [gpsBusy, setGpsBusy] = useState(false);
  const [gpsError, setGpsError] = useState('');
  const [postalCode, setPostalCode] = useState(
    current && current.mode !== 'CITY' ? current.postalCode ?? '' : '',
  );
  const [postalResult, setPostalResult] = useState<PostalLookup | null>(null);
  const [postalArea, setPostalArea] = useState(0);
  const [postalBusy, setPostalBusy] = useState(false);
  const [postalError, setPostalError] = useState('');
  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    element?.querySelector<HTMLInputElement>('input')?.focus();
    return () => {
      requests.current++;
      element?.close();
    };
  }, []);
  async function lookupPin(event: FormEvent) {
    event.preventDefault();
    if (!/^[1-9]\d{5}$/.test(postalCode)) return;
    const request = ++requests.current;
    setPostalBusy(true);
    setGpsBusy(false);
    setPostalResult(null);
    setPostalError('');
    setGpsError('');
    try {
      const result = await locationApi.postal(postalCode);
      if (request !== requests.current) return;
      if (result.postalCode !== postalCode || !result.areas.length)
        throw new Error('No postal areas were returned. Try another PIN.');
      setPostalResult(result);
      setPostalArea(0);
    } catch (error) {
      if (request === requests.current)
        setPostalError(errorMessage(error));
    } finally {
      if (request === requests.current) setPostalBusy(false);
    }
  }
  function selectPostalArea() {
    const area = postalResult?.areas[postalArea];
    if (!area || !postalResult) return;
    requests.current++;
    onChoose(
      {
        mode: 'PIN',
        postalCode: postalResult.postalCode,
        city: area.district,
        state: area.state,
        locality: area.locality,
        label: `${area.locality}, ${area.district} · ${postalResult.postalCode}`,
      },
      'MANUAL',
    );
  }
  function geolocate() {
    const request = ++requests.current;
    setGpsError('');
    setPostalBusy(false);
    setPostalResult(null);
    setPostalError('');
    if (!navigator.geolocation) {
      setGpsBusy(false);
      setGpsError(
        'Location is unavailable in this browser. Look up your PIN instead.',
      );
      return;
    }
    setGpsBusy(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        if (request !== requests.current) return;
        const location = {
          mode: 'COORDINATES' as const,
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          radiusMeters: radius,
          label: 'Selected location',
        };
        setGpsBusy(false);
        if (!validDiscoveryLocation(location)) {
          setGpsError(
            'Your location could not be read. Look up your PIN instead.',
          );
          return;
        }
        onChoose(location, 'GPS');
      },
      () => {
        if (request !== requests.current) return;
        setGpsBusy(false);
        setGpsError(
          'Location permission was unavailable. Look up your PIN or skip for now.',
        );
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
    );
  }
  return (
    <dialog
      className="af-location-dialog"
      ref={dialog}
      role="dialog"
      aria-labelledby="af-location-title"
      onCancel={(event) => {
        if (required) event.preventDefault();
        else onClose();
      }}
    >
      <div className="af-location-dialog-heading">
        <Icon name="pin" />
        {!required && (
          <button
            type="button"
            className="af-skip"
            aria-label="Close location picker"
            onClick={onClose}
          >
            Close
          </button>
        )}
      </div>
      <h2 id="af-location-title">Where do you need vehicle service?</h2>
      <p>
        See services and centers in this area. You can change it from the top
        right of any screen.
      </p>
      <form onSubmit={lookupPin}>
        <label className="af-field">
          PIN code
          <input
            required
            inputMode="numeric"
            autoComplete="postal-code"
            pattern="[1-9][0-9]{5}"
            maxLength={6}
            placeholder="Enter your six-digit PIN"
            value={postalCode}
            onChange={(e) => {
              requests.current++;
              setPostalCode(e.target.value.replace(/\D/g, '').slice(0, 6));
              setPostalResult(null);
              setPostalError('');
              setGpsError('');
              setPostalBusy(false);
              setGpsBusy(false);
            }}
          />
        </label>
        <button className="af-btn" type="submit" disabled={postalBusy}>
          {postalBusy ? 'Finding postal areas…' : 'Look up PIN'}
        </button>
      </form>
      {postalError && (
        <p className="af-error" role="alert">{postalError}</p>
      )}
      {postalResult && (
        <div className="af-location-postal-result">
          <label className="af-field">
            Postal area
            <select
              value={postalArea}
              onChange={(e) => setPostalArea(Number(e.target.value))}
            >
              {postalResult.areas.map((area, index) => (
                <option
                  value={index}
                  key={`${area.locality}:${area.district}:${area.state}`}
                >
                  {area.locality}, {area.district}, {area.state}
                </option>
              ))}
            </select>
          </label>
          <p className="af-hint">
            Showing centers registered in PIN {postalResult.postalCode}.
            Postal areas identify the district and state; they do not
            provide an exact distance.
          </p>
          <button className="af-btn" type="button" onClick={selectPostalArea}>
            Use this postal area
          </button>
        </div>
      )}
      <button
        type="button"
        className="af-location-gps"
        disabled={gpsBusy}
        onClick={geolocate}
      >
        <Icon name="pin" />
        {gpsBusy ? 'Finding your location…' : 'Use my exact location'}
      </button>
      <p className="af-hint">
        Your browser asks for permission. Nearby search covers {radius / 1000}{' '}
        km around your current location.
      </p>
      {gpsError && (
        <p className="af-error" role="alert">
          {gpsError}
        </p>
      )}
      {error && (
        <div role="alert">
          <p>{error}</p>
          <button className="af-skip" onClick={onRetry}>
            Retry location settings
          </button>
        </div>
      )}
      <div className="af-location-fallback">
        <button
          type="button"
          className="af-skip"
          disabled={!fallback}
          onClick={() => {
            if (fallback) {
              requests.current++;
              onChoose(fallback, fallbackSource);
            }
          }}
        >
          Skip for now
        </button>
        <p>
          {fallback
            ? `Use ${fallbackSource === 'LAST_USED' ? 'your last-used location' : 'the default location'}: ${locationDescription(fallback)}.`
            : 'Look up a PIN or use your exact location to continue. No last-used location or platform default is available yet.'}
        </p>
      </div>
    </dialog>
  );
}
