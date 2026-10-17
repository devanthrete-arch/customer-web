import { useEffect, useRef, useState } from "react";
import { autoflex, ApiError, errorMessage } from "../lib/api";
import { customerSessionId, getAccessToken } from "../lib/session";
import { InvoiceDownload } from "./InvoiceDownload";
type Note = {
  id: string;
  version: number;
  kind: "CREDIT" | "DEBIT";
  state: string;
  reason: string;
  totalInr: string;
  noteNumber: string | null;
  paymentState: string;
  lines: { description: string; netInr: string; taxInr: string }[];
};
type Attempt = {
  id: string;
  version: number;
  decision: "ACCEPT" | "DECLINE";
  key: string;
};
const money = (v: string) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(
    Number(v),
  );
export function FinancialNotes({ invoiceId }: { invoiceId: string }) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [agreed, setAgreed] = useState<Record<string, boolean>>({});
  const alive = useRef(true);
  const inFlight = useRef(false);
  const token = getAccessToken();
  const storageKey = `af:note-decision:${customerSessionId()}:${invoiceId}`;
  const [attempt, setAttempt] = useState<Attempt | null>(() => {
    try {
      const a = JSON.parse(
        sessionStorage.getItem(storageKey) || "null",
      ) as Attempt | null;
      return a &&
        /^[a-f0-9-]{36}$/i.test(a.id) &&
        /^[a-f0-9-]{36}$/i.test(a.key) &&
        ["ACCEPT", "DECLINE"].includes(a.decision) &&
        Number.isSafeInteger(a.version) &&
        a.version > 0
        ? a
        : null;
    } catch {
      return null;
    }
  });
  const current = () => alive.current && getAccessToken() === token;
  async function load() {
    try {
      const result = await autoflex<{ notes: Note[] }>(
        `/v1/me/invoices/${invoiceId}/notes`,
        {},
        true,
      );
      if (current()) setNotes(result.notes);
    } catch (err) {
      if (current()) setError(errorMessage(err));
    }
  }
  useEffect(() => {
    alive.current = true;
    void load();
    return () => {
      alive.current = false;
    };
  }, [invoiceId, token]);
  async function decide(a: Attempt) {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError("");
    try {
      sessionStorage.setItem(storageKey, JSON.stringify(a));
      setAttempt(a);
      await autoflex(
        `/v1/me/financial-notes/${a.id}/decision`,
        {
          method: "POST",
          headers: { "Idempotency-Key": a.key, "If-Match": String(a.version) },
          body: JSON.stringify({ decision: a.decision }),
        },
        true,
      );
      if (!current()) return;
      sessionStorage.removeItem(storageKey);
      setAttempt(null);
      await load();
    } catch (err) {
      if (!current()) return;
      if (
        err instanceof ApiError &&
        err.status >= 400 &&
        err.status < 500 &&
        ![408, 429].includes(err.status)
      ) {
        sessionStorage.removeItem(storageKey);
        setAttempt(null);
      }
      setError(errorMessage(err));
    } finally {
      inFlight.current = false;
      if (current()) setBusy(false);
    }
  }
  return (
    <section className="af-panel">
      <h2>Corrections and additional charges</h2>
      {error ? (
        <p className="af-error" role="alert">
          {error}
        </p>
      ) : null}
      <button
        type="button"
        className="af-btn ghost"
        disabled={busy}
        onClick={() => void load()}
      >
        Refresh corrections
      </button>
      {attempt ? (
        <div className="af-note">
          <p>Your previous decision needs confirmation.</p>
          <button
            type="button"
            className="af-btn secondary"
            disabled={busy}
            onClick={() => void decide(attempt)}
          >
            Check saved decision
          </button>
        </div>
      ) : null}
      {!notes.length ? (
        <p className="af-meta">No corrections proposed.</p>
      ) : null}
      {notes.map((n) => (
        <article className="af-service-card" key={n.id}>
          <span className="af-kicker">
            {n.noteNumber ??
              (n.kind === "CREDIT"
                ? "Credit proposal"
                : "Additional charge request")}
          </span>
          <h3>{money(n.totalInr)}</h3>
          <p>{n.reason}</p>
          {n.lines.map((l, index) => (
            <p className="af-meta" key={index}>
              {l.description}: net {money(l.netInr)} + tax {money(l.taxInr)}
            </p>
          ))}
          <p className="af-meta">
            {n.state.toLowerCase().replaceAll("_", " ")}
          </p>
          {n.kind === "CREDIT" ? (
            <p className="af-note">
              This is a reduction of the original charge. No money refund has
              been recorded.
            </p>
          ) : (
            <p className="af-note">
              {n.paymentState === "DUE"
                ? `Pay ${money(n.totalInr)} directly at the center. Show the transaction confirmation to staff.`
                : n.paymentState === "PAID"
                  ? "Full counter payment recorded."
                  : "This proposal is not payable. The original invoice remains unchanged."}
            </p>
          )}
          {n.kind === "DEBIT" && n.state === "PROPOSED" && !attempt ? (
            <>
              <label className="af-check">
                <input
                  type="checkbox"
                  disabled={busy}
                  checked={!!agreed[n.id]}
                  onChange={(e) =>
                    setAgreed({ ...agreed, [n.id]: e.target.checked })
                  }
                />
                I agree to this additional charge of {money(n.totalInr)}.
              </label>
              <button
                className="af-btn"
                type="button"
                disabled={busy || !agreed[n.id]}
                onClick={() =>
                  void decide({
                    id: n.id,
                    version: n.version,
                    decision: "ACCEPT",
                    key: crypto.randomUUID(),
                  })
                }
              >
                Approve additional charge
              </button>
              <button
                className="af-btn ghost"
                type="button"
                disabled={busy}
                onClick={() =>
                  void decide({
                    id: n.id,
                    version: n.version,
                    decision: "DECLINE",
                    key: crypto.randomUUID(),
                  })
                }
              >
                Decline additional charge
              </button>
            </>
          ) : null}
          {n.state === "ISSUED" && n.noteNumber ? (
            <InvoiceDownload id={n.id} number={n.noteNumber} note />
          ) : null}
        </article>
      ))}
    </section>
  );
}
