import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, CheckCircle2, Clock3 } from "lucide-react";
import { getOperationView } from "@/lib/application/operation-query";
import { csrfTokenFor, requireSession } from "@/lib/auth/session";
import { getDatabase } from "@/lib/db/client";
import { ResultActions } from "@/components/operation/result-actions";

export const metadata: Metadata = { title: "Migration result" };
export const dynamic = "force-dynamic";

export default async function OperationPage({
  params,
}: {
  params: Promise<{ operationId: string }>;
}) {
  const session = await requireSession();
  const { operationId } = await params;
  let view;
  try {
    view = await getOperationView(getDatabase(), session.id, operationId);
  } catch {
    notFound();
  }
  const complete = view.operation.status === "COMPLETED";
  const reconciliation = view.operation.status === "RECONCILIATION_REQUIRED";

  return (
    <div className="result-page shell">
      <div className={`result-icon ${reconciliation ? "waiting" : ""}`}>
        {reconciliation ? <Clock3 aria-hidden="true" /> : <CheckCircle2 aria-hidden="true" />}
      </div>
      <p className="kicker">{reconciliation ? "Safe pause" : "Migration complete"}</p>
      <h1>{reconciliation ? "Target result needs reconciliation." : "You are upgraded."}</h1>
      <p className="result-lede">
        {reconciliation
          ? "The target request may have succeeded, so the sandbox will look it up by the original idempotency key before changing any financial state."
          : "Your unused source-subscription value has been applied as a simulated migration credit."}
      </p>

      {view.quote && (
        <div className="result-summary">
          <div>
            <span>Migration credit</span>
            <strong>{money(view.quote.migrationCreditMinor, view.quote.currency)}</strong>
          </div>
          <div>
            <span>Simulated amount due</span>
            <strong>{money(view.quote.amountDueMinor, view.quote.currency)}</strong>
          </div>
          <div>
            <span>New plan</span>
            <strong>{view.targetPlan?.displayName ?? "Pending"}</strong>
          </div>
          <div>
            <span>Next renewal</span>
            <strong>{complete ? "August 19, 2026" : "Pending reconciliation"}</strong>
          </div>
        </div>
      )}

      <div className="reminder-card">
        <strong>Auto-renewal reminder</strong>
        <p>
          In a production migration, the customer must confirm that source auto-renewal will not
          create a future duplicate charge.
        </p>
      </div>
      <ResultActions
        operationId={operationId}
        csrfToken={csrfTokenFor(session)}
        needsReconciliation={reconciliation}
        summary={`Take my money demo: ${view.quote ? money(view.quote.migrationCreditMinor, view.quote.currency) : "No"} migration credit applied to ${view.targetPlan?.displayName ?? "the target plan"}. No real payment or subscription was changed.`}
      />
      <Link className="system-link" href={`/operation/${operationId}/system`}>
        View system audit <ArrowRight size={17} aria-hidden="true" />
      </Link>
    </div>
  );
}

function money(amountMinor: string, currency: string): string {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency }).format(
    Number(amountMinor) / 100,
  );
}
