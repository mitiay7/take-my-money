import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Braces, Database, Fingerprint, GitCommitHorizontal } from "lucide-react";
import { getSystemView } from "@/lib/application/operation-query";
import { requireSession } from "@/lib/auth/session";
import { getDatabase } from "@/lib/db/client";
import { SystemJsonDownload } from "@/components/system/json-download";

export const metadata: Metadata = { title: "System audit" };
export const dynamic = "force-dynamic";

export default async function SystemPage({ params }: { params: Promise<{ operationId: string }> }) {
  const session = await requireSession();
  const { operationId } = await params;
  const view = await getSystemView(getDatabase(), session.id, operationId);

  return (
    <div className="system-page shell">
      <div className="system-topbar">
        <Link className="back-link" href={`/operation/${operationId}`}>
          <ArrowLeft size={16} aria-hidden="true" /> Back to result
        </Link>
        <SystemJsonDownload data={view} filename={`take-my-money-${operationId}.json`} />
      </div>
      <p className="kicker">Sanitized technical view</p>
      <h1>Every decision has a trace.</h1>
      <p className="lede">
        Follow verified input through deterministic calculation, state transitions, provider calls,
        and append-only credit entries. Secrets and full transaction identifiers are excluded.
      </p>

      <div className="system-overview">
        <SystemStat icon={<GitCommitHorizontal />} label="State" value={view.operation.status} />
        <SystemStat
          icon={<Fingerprint />}
          label="Quote fingerprint"
          value={`${view.quote?.fingerprintPrefix ?? "—"}…`}
        />
        <SystemStat
          icon={<Braces />}
          label="Algorithm"
          value={view.quote?.algorithmVersion ?? "—"}
        />
        <SystemStat icon={<Database />} label="Ledger entries" value={String(view.ledger.length)} />
      </div>

      <section className="system-section">
        <div className="system-section-head">
          <span>01</span>
          <div>
            <p className="kicker">Verification</p>
            <h2>Normalized source snapshot</h2>
          </div>
        </div>
        <dl className="technical-grid">
          <Tech label="Provider adapter" value={view.technical.providerAdapter} />
          <Tech label="Provider" value={view.source?.provider ?? "—"} />
          <Tech label="Status" value={view.source?.status ?? "—"} />
          <Tech
            label="Fingerprint prefix"
            value={`${view.technical.sourceFingerprintPrefix ?? "—"}…`}
            mono
          />
          <Tech label="Period start" value={view.source?.periodStart ?? "—"} mono />
          <Tech label="Period end" value={view.source?.periodEnd ?? "—"} mono />
        </dl>
      </section>

      <section className="system-section">
        <div className="system-section-head">
          <span>02</span>
          <div>
            <p className="kicker">Calculation</p>
            <h2>Immutable quote inputs</h2>
          </div>
        </div>
        <dl className="technical-grid">
          <Tech label="Source value" value={view.quote?.sourceValueMinor ?? "—"} mono />
          <Tech
            label="Remaining duration (ms)"
            value={view.quote?.remainingDurationMs ?? "—"}
            mono
          />
          <Tech
            label="Unused ratio"
            value={view.quote ? `${view.quote.ratioNumerator}/${view.quote.ratioDenominator}` : "—"}
            mono
          />
          <Tech label="Migration credit" value={view.quote?.migrationCreditMinor ?? "—"} mono />
          <Tech label="Amount due" value={view.quote?.amountDueMinor ?? "—"} mono />
          <Tech
            label="Policy"
            value={view.quote ? `${view.quote.policyId}@${view.quote.policyVersion}` : "—"}
            mono
          />
        </dl>
      </section>

      <section className="system-section">
        <div className="system-section-head">
          <span>03</span>
          <div>
            <p className="kicker">State machine</p>
            <h2>Ordered audit events</h2>
          </div>
        </div>
        <ol className="audit-list">
          {view.audits.map((event) => (
            <li key={`${event.sequenceNumber}-${event.eventType}`}>
              <span>{String(event.sequenceNumber).padStart(2, "0")}</span>
              <div>
                <strong>{event.eventType}</strong>
                <small>
                  {event.previousState ?? "event"} → {event.nextState ?? "recorded"}
                </small>
              </div>
              <time>
                {new Date(event.createdAt).toLocaleTimeString("en-GB", { timeZone: "UTC" })} UTC
              </time>
            </li>
          ))}
        </ol>
      </section>

      <section className="system-section">
        <div className="system-section-head">
          <span>04</span>
          <div>
            <p className="kicker">Credit ledger</p>
            <h2>Append-only entries</h2>
          </div>
        </div>
        <div className="ledger-list">
          {view.ledger.length ? (
            view.ledger.map((entry, index) => (
              <div key={`${entry.entryType}-${index}`}>
                <code>{entry.entryType}</code>
                <strong>
                  {entry.amountMinor} {entry.currency} minor units
                </strong>
              </div>
            ))
          ) : (
            <p>No credit was issued for this operation.</p>
          )}
        </div>
      </section>

      <section className="system-section">
        <div className="system-section-head">
          <span>05</span>
          <div>
            <p className="kicker">AI boundary</p>
            <h2>Sanitized model interactions</h2>
          </div>
        </div>
        <div className="ledger-list">
          {view.ai.length ? (
            view.ai.map((entry, index) => (
              <div key={`${entry.purpose}-${index}`}>
                <code>{entry.purpose}</code>
                <strong>
                  {entry.model} · {entry.status}
                </strong>
              </div>
            ))
          ) : (
            <p>No AI interaction was required.</p>
          )}
        </div>
      </section>
    </div>
  );
}

function SystemStat({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="system-stat">
      <span>{icon}</span>
      <small>{label}</small>
      <strong>{value}</strong>
    </div>
  );
}

function Tech({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd className={mono ? "mono" : ""}>{value}</dd>
    </div>
  );
}
