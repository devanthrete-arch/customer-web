import { useState } from "react";
import { autoflex, errorMessage } from "../lib/api";
import { getAccessToken } from "../lib/session";
export function InvoiceDownload({
  id,
  number,
  note = false,
}: {
  id: string;
  number: string;
  note?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function download() {
    const token = getAccessToken();
    if (!token) return;
    setBusy(true);
    setMessage("");
    try {
      const state = await autoflex<{ state: string; retryAt: string | null }>(
        `/v1/me/${note ? "financial-notes" : "invoices"}/${id}/document`,
        { method: "POST", body: "{}" },
        true,
      );
      if (getAccessToken() !== token) return;
      if (state.state !== "READY") {
        setMessage(
          state.state === "FAILED"
            ? "The PDF could not be prepared. Retry after the document service recovers."
            : "The PDF is preparing. Try Download PDF again shortly.",
        );
        return;
      }
      const base =
        import.meta.env.VITE_AUTOFLEX_API_URL || "http://localhost:3001";
      const response = await fetch(
        `${base}/v1/me/${note ? "financial-notes" : "invoices"}/${id}/pdf`,
        { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" },
      );
      if (!response.ok)
        throw new Error(
          "Could not download the private invoice. Refresh and retry.",
        );
      const blob = await response.blob();
      if (getAccessToken() !== token) return;
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = number.replace(/[^A-Za-z0-9_-]/g, "-") + ".pdf";
      anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 30000);
    } catch (err) {
      if (getAccessToken() === token) setMessage(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div>
      <button
        type="button"
        className="af-btn secondary"
        disabled={busy}
        onClick={() => void download()}
      >
        {busy
          ? "Preparing PDF…"
          : note
            ? "Download correction PDF"
            : "Download invoice PDF"}
      </button>
      {message ? (
        <p role="status" className="af-note">
          {message}
        </p>
      ) : null}
    </div>
  );
}
