import { useEffect, useRef, useState } from "react";
import { Link, useParams, useNavigate, useLocation } from "react-router-dom";
import { autoflex, ApiError, errorMessage } from "../lib/api";
import { getAccessToken, rememberAuthReturnTo, signOut } from "../lib/session";
import { ErrorText } from "./ui";
type Context = {
  id: string;
  version: number;
  state: string;
  centerName: string;
  phoneHint: string;
  expiresAt: string;
  identityReady: boolean;
  identityMode: "LOCAL_TEST" | "EXTERNAL";
};
export function ReceptionConsentScreen() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const challenge =
    new URLSearchParams(location.hash.slice(1)).get("challenge") ?? "";
  const alive = useRef(true);
  const inFlight = useRef(false);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  const [context, setContext] = useState<Context | null>(null);
  const [error, setError] = useState("");
  const [name, setName] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [revision, setRevision] = useState(0);
  const pending = useRef<{ body: object; key: string; version: number } | null>(
    null,
  );
  const session = getAccessToken();
  useEffect(() => {
    let active = true;
    if (!session || !id || !challenge) return;
    setContext(null);
    setError("");
    void autoflex<Context>(
      `/v1/me/reception-sessions/${id}/context`,
      { method: "POST", body: JSON.stringify({ challenge }) },
      true,
    )
      .then((value) => {
        if (active && getAccessToken() === session) setContext(value);
      })
      .catch((err) => {
        if (active) setError(errorMessage(err));
      });
    return () => {
      active = false;
    };
  }, [id, challenge, session, revision]);
  useEffect(() => {
    pending.current = null;
    setAccepted(false);
  }, [id, challenge, session]);
  if (!id || !challenge)
    return (
      <main className="af-screen af-form">
        <h1>Registration link unavailable</h1>
        <p>Ask reception to show you the complete registration link.</p>
      </main>
    );
  if (!session)
    return (
      <main className="af-screen af-form">
        <h1>Register for your workshop visit</h1>
        <p>
          Use your own phone and account to confirm the request from reception.
        </p>
        <Link
          className="af-btn"
          to="/auth/register"
          onClick={() =>
            rememberAuthReturnTo(
              window.location.pathname + window.location.hash,
            )
          }
        >
          Create my account
        </Link>
        <Link
          className="af-btn ghost"
          to="/auth/sign-in"
          onClick={() =>
            rememberAuthReturnTo(
              window.location.pathname + window.location.hash,
            )
          }
        >
          I already have an account
        </Link>
      </main>
    );
  async function consent() {
    if (!context || inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError("");
    try {
      if (!pending.current) {
        const proof = await autoflex<{ assertion: string }>(
          context.identityMode === "LOCAL_TEST"
            ? "/v1/dev/reception-proof"
            : `/v1/me/reception-sessions/${id}/verification`,
          {
            method: "POST",
            body: JSON.stringify(
              context.identityMode === "LOCAL_TEST"
                ? { sessionId: id }
                : { challenge },
            ),
          },
          true,
        );
        if (!alive.current || getAccessToken() !== session) return;
        pending.current = {
          body: {
            challenge,
            consent: true,
            name: name.trim(),
            verificationAssertion: proof.assertion,
          },
          key: crypto.randomUUID(),
          version: context.version,
        };
      }
      const attempt = pending.current;
      await autoflex(
        `/v1/me/reception-sessions/${id}/consent`,
        {
          method: "POST",
          headers: {
            "If-Match": String(attempt.version),
            "Idempotency-Key": attempt.key,
          },
          body: JSON.stringify(attempt.body),
        },
        true,
      );
      if (!alive.current || getAccessToken() !== session) return;
      pending.current = null;
      setRevision((v) => v + 1);
    } catch (err) {
      if (
        err instanceof ApiError &&
        err.status >= 400 &&
        err.status < 500 &&
        ![408, 429].includes(err.status)
      )
        pending.current = null;
      if (alive.current && getAccessToken() === session)
        setError(errorMessage(err));
    } finally {
      inFlight.current = false;
      if (alive.current) setBusy(false);
    }
  }
  return (
    <main className="af-screen af-form">
      <h1>Confirm your workshop registration</h1>
      <ErrorText error={error} />
      <button
        type="button"
        className="af-btn ghost"
        disabled={busy}
        onClick={() => {
          const target = window.location.pathname + window.location.hash;
          pending.current = null;
          signOut();
          rememberAuthReturnTo(target);
          navigate("/auth/sign-in", { replace: true });
        }}
      >
        Use a different account
      </button>
      {!context ? (
        <button
          className="af-btn secondary"
          onClick={() => setRevision((v) => v + 1)}
        >
          Check registration
        </button>
      ) : (
        <>
          <section className="af-panel">
            <span className="af-kicker">Workshop request</span>
            <h2>{context.centerName}</h2>
            <p>For the phone ending {context.phoneHint.slice(-4)}.</p>
            <p>
              This links your account to this workshop for your visit. It does
              not transfer vehicle ownership or reveal earlier visits.
            </p>
            <p>
              Use the account for this phone. This registration link cannot
              change an existing account phone number.
            </p>
          </section>
          {["CONSENTED", "COMPLETED"].includes(context.state) ? (
            <section className="af-success">
              <h2>Registration confirmed</h2>
              <p>
                Reception can now finish linking your account and continue with
                the vehicle and visit. No booking is required.
              </p>
              <button
                className="af-btn secondary"
                onClick={() => setRevision((v) => v + 1)}
              >
                Refresh status
              </button>
              <Link to="/home">Go to my account</Link>
            </section>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void consent();
              }}
            >
              {context.identityMode === "LOCAL_TEST" ? (
                <p className="af-note">
                  Local demonstration: phone verification uses the development
                  identity service. This is not live IAM verification.
                </p>
              ) : null}
              <label className="af-field">
                Your contact and billing name
                <input
                  required
                  maxLength={160}
                  disabled={busy || !!pending.current}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </label>
              <label className="af-check">
                <input
                  type="checkbox"
                  checked={accepted}
                  onChange={(e) => setAccepted(e.target.checked)}
                  disabled={busy || !!pending.current}
                />
                I confirm this is my phone and permit this workshop to register
                my account for this visit.
              </label>
              <p className="af-hint">
                Expires{" "}
                {new Date(context.expiresAt).toLocaleTimeString("en-IN", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
                .
              </p>
              <button
                className="af-btn"
                disabled={
                  busy || !accepted || !name.trim() || !context.identityReady
                }
              >
                {busy
                  ? "Confirming…"
                  : pending.current
                    ? "Check my confirmation"
                    : "Verify my phone and confirm"}
              </button>
              {!context.identityReady ? (
                <p>
                  Phone verification is not available yet. Reception must
                  complete the IAM setup before linking your account.
                </p>
              ) : null}
              <button
                type="button"
                className="af-btn ghost"
                disabled={busy}
                onClick={() => setRevision((v) => v + 1)}
              >
                Check existing confirmation
              </button>
            </form>
          )}
        </>
      )}
    </main>
  );
}
