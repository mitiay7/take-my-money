"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Check, Copy, RefreshCcw, RotateCcw } from "lucide-react";

export function ResultActions({
  operationId,
  csrfToken,
  needsReconciliation,
  summary,
}: {
  operationId: string;
  csrfToken: string;
  needsReconciliation: boolean;
  summary: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function reconcile() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/rebases/${operationId}/reconcile`, {
        method: "POST",
        headers: { "x-csrf-token": csrfToken },
      });
      if (!response.ok) throw new Error("Reconciliation is not ready. Try again shortly.");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Reconciliation failed.");
    } finally {
      setBusy(false);
    }
  }

  async function reset() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/demo/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-csrf-token": csrfToken },
        body: "{}",
      });
      if (!response.ok) throw new Error("Demo reset failed.");
      router.push("/demo");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Demo reset failed.");
      setBusy(false);
    }
  }

  async function copy() {
    await navigator.clipboard.writeText(summary);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  return (
    <div className="result-actions">
      {error && <p role="alert">{error}</p>}
      {needsReconciliation && (
        <button className="button button-primary" type="button" onClick={reconcile} disabled={busy}>
          <RefreshCcw size={17} aria-hidden="true" /> {busy ? "Reconciling…" : "Reconcile safely"}
        </button>
      )}
      <button className="button button-quiet" type="button" onClick={copy}>
        {copied ? <Check size={17} aria-hidden="true" /> : <Copy size={17} aria-hidden="true" />}
        {copied ? "Copied" : "Copy customer summary"}
      </button>
      <button className="button button-quiet" type="button" onClick={reset} disabled={busy}>
        <RotateCcw size={17} aria-hidden="true" /> Try another scenario
      </button>
    </div>
  );
}
