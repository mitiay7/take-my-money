"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  BadgeCheck,
  Bot,
  Check,
  Clock3,
  FileScan,
  RefreshCcw,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

type Scenario = {
  id: string;
  title: string;
  shortDescription: string;
  receiptAssetId: string;
  receiptImageUrl: string;
  lookupReference: string;
  evaluationTimeUtc: string;
  defaultTargetPlanId: string;
};

type Extraction = {
  productName: string | null;
  amountText: string | null;
  currencyCode: string | null;
  purchaseDateText: string | null;
  expiryOrRenewalDateText: string | null;
  syntheticLookupReference: string | null;
  confidence: string;
  warnings: string[];
};

type Verification = {
  operation: { publicId: string; status: string };
  source: {
    planName: string;
    status: string;
    periodStartUtc: string;
    periodEndUtc: string;
    amountPaidMinor: string;
    currency: string;
    autoRenew: boolean;
    provider: string;
  };
  eligibility: { status: string; reasons: string[]; riskFlags: string[] };
};

type Quote = {
  publicId: string;
  currency: string;
  migrationCreditMinor: string;
  targetPriceMinor: string;
  amountDueMinor: string;
  carryForwardMinor: string;
  periodDurationMs: string;
  remainingDurationMs: string;
  ratio: { numerator: string; denominator: string };
  policy: { id: string; version: string };
  roundingMode: string;
  expiresAt: string;
  fingerprintPrefix: string;
};

type Explanation = {
  headline: string;
  summary: string;
  calculationExplanation: string;
  nextSteps: string[];
  riskExplanation: string;
};

type AiStatus = { live: boolean; model: string; fallbackCode: string | null };

type DemoStep = "RECEIPT" | "VERIFY" | "PLAN" | "REVIEW" | "CONFIRM";

const steps: { id: DemoStep; label: string }[] = [
  { id: "RECEIPT", label: "Receipt" },
  { id: "VERIFY", label: "Verify" },
  { id: "PLAN", label: "Choose plan" },
  { id: "REVIEW", label: "Review credit" },
  { id: "CONFIRM", label: "Confirm" },
];

const plans = [
  {
    id: "direct-basic-monthly",
    name: "Direct Basic",
    priceMinor: "1900",
    note: "Illustrative monthly plan",
  },
  {
    id: "direct-pro-monthly",
    name: "Direct Pro",
    priceMinor: "22900",
    note: "Illustrative monthly plan",
    recommended: true,
  },
  {
    id: "direct-annual",
    name: "Direct Annual",
    priceMinor: "229000",
    note: "Coming after the demo",
    disabled: true,
  },
];

export function RebaseDemo() {
  const router = useRouter();
  const [csrfToken, setCsrfToken] = useState("");
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [scenarioId, setScenarioId] = useState("active-normal");
  const [operationId, setOperationId] = useState<string | null>(null);
  const [step, setStep] = useState<DemoStep>("RECEIPT");
  const [extraction, setExtraction] = useState<Extraction | null>(null);
  const [receiptAi, setReceiptAi] = useState<AiStatus | null>(null);
  const [verification, setVerification] = useState<Verification | null>(null);
  const [targetPlanId, setTargetPlanId] = useState("direct-pro-monthly");
  const [quote, setQuote] = useState<Quote | null>(null);
  const [explanation, setExplanation] = useState<Explanation | null>(null);
  const [explanationAi, setExplanationAi] = useState<AiStatus | null>(null);
  const [consents, setConsents] = useState([false, false, false]);
  const [busy, setBusy] = useState<string | null>("Initializing demo");
  const [error, setError] = useState<string | null>(null);

  const scenario = scenarios.find((item) => item.id === scenarioId) ?? null;
  const activeStepIndex = steps.findIndex((item) => item.id === step);
  const selectedPlan = plans.find((plan) => plan.id === targetPlanId) ?? plans[1]!;

  useEffect(() => {
    let active = true;
    async function initialize() {
      try {
        const [sessionResponse, scenarioResponse] = await Promise.all([
          fetch("/api/sessions", { method: "POST" }),
          fetch("/api/scenarios"),
        ]);
        const sessionData = await parseResponse<{ csrfToken: string }>(sessionResponse);
        const scenarioData = await parseResponse<{ scenarios: Scenario[] }>(scenarioResponse);
        if (!active) return;
        setCsrfToken(sessionData.csrfToken);
        setScenarios(scenarioData.scenarios);
      } catch (caught) {
        if (active) setError(messageFrom(caught));
      } finally {
        if (active) setBusy(null);
      }
    }
    void initialize();
    return () => {
      active = false;
    };
  }, []);

  const summary = useMemo(() => {
    if (!quote) return null;
    return {
      target: money(quote.targetPriceMinor, quote.currency),
      credit: money(quote.migrationCreditMinor, quote.currency),
      due: money(quote.amountDueMinor, quote.currency),
    };
  }, [quote]);

  async function mutate<T>(path: string, body: unknown, headers: Record<string, string> = {}) {
    const response = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-csrf-token": csrfToken, ...headers },
      body: JSON.stringify(body),
    });
    return parseResponse<T>(response);
  }

  async function readReceipt() {
    if (!scenario) return;
    setBusy("Reading synthetic receipt with GPT-5.6");
    setError(null);
    try {
      const created = await mutate<{ operation: { publicId: string } }>("/api/rebases", {
        scenarioId: scenario.id,
      });
      setOperationId(created.operation.publicId);
      const result = await mutate<{ extraction: Extraction } & AiStatus>(
        "/api/ai/extract-receipt",
        {
          operationId: created.operation.publicId,
          scenarioId: scenario.id,
          receiptAssetId: scenario.receiptAssetId,
        },
      );
      setExtraction(result.extraction);
      setReceiptAi({ live: result.live, model: result.model, fallbackCode: result.fallbackCode });
      setStep("VERIFY");
    } catch (caught) {
      setError(messageFrom(caught));
    } finally {
      setBusy(null);
    }
  }

  async function verifySource() {
    if (!scenario || !operationId) return;
    setBusy("Verifying with sandbox source provider");
    setError(null);
    try {
      const result = await mutate<Verification>("/api/subscriptions/verify", {
        operationId,
        lookupReference: scenario.lookupReference,
      });
      setVerification(result);
      if (result.eligibility.status === "ELIGIBLE") setStep("PLAN");
    } catch (caught) {
      setError(messageFrom(caught));
    } finally {
      setBusy(null);
    }
  }

  async function createQuote() {
    if (!operationId) return;
    setBusy("Calculating exact unused value");
    setError(null);
    try {
      const result = await mutate<{ quote: Quote }>(`/api/rebases/${operationId}/quote`, {
        targetPlanId,
      });
      setQuote(result.quote);
      setStep("REVIEW");
      const explained = await mutate<{ explanation: Explanation } & AiStatus>("/api/ai/explain", {
        operationId,
      });
      setExplanation(explained.explanation);
      setExplanationAi({
        live: explained.live,
        model: explained.model,
        fallbackCode: explained.fallbackCode,
      });
    } catch (caught) {
      setError(messageFrom(caught));
    } finally {
      setBusy(null);
    }
  }

  async function confirm() {
    if (!operationId || !quote) return;
    setBusy("Running migration saga");
    setError(null);
    try {
      await mutate(
        `/api/rebases/${operationId}/confirm`,
        {
          quotePublicId: quote.publicId,
          consents: {
            understandsSandbox: consents[0],
            understandsSourceCancellation: consents[1],
            authorizesSimulatedMigration: consents[2],
          },
        },
        { "Idempotency-Key": crypto.randomUUID() },
      );
      router.push(`/operation/${operationId}`);
    } catch (caught) {
      setError(messageFrom(caught));
      setBusy(null);
    }
  }

  async function resetDemo() {
    setBusy("Resetting demo");
    setError(null);
    try {
      await mutate("/api/demo/reset", {});
      setOperationId(null);
      setStep("RECEIPT");
      setExtraction(null);
      setReceiptAi(null);
      setVerification(null);
      setQuote(null);
      setExplanation(null);
      setExplanationAi(null);
      setConsents([false, false, false]);
    } catch (caught) {
      setError(messageFrom(caught));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="demo-shell shell">
      <header className="demo-title-row">
        <div>
          <div className="eyebrow-row">
            <span className="status-dot" aria-hidden="true" />
            <span>Demo environment</span>
            <span className="eyebrow-rule" aria-hidden="true" />
            <span>Demo clock: July 19, 2026, 00:00 UTC</span>
          </div>
          <h1>Rebase a subscription.</h1>
          <p>Complete the provider-neutral migration in under two minutes.</p>
        </div>
        <button className="button button-quiet" type="button" onClick={resetDemo} disabled={!!busy}>
          <RefreshCcw size={16} aria-hidden="true" /> Reset demo
        </button>
      </header>

      <ol className="stepper" aria-label="Migration progress">
        {steps.map((item, index) => (
          <li
            key={item.id}
            className={index === activeStepIndex ? "active" : index < activeStepIndex ? "done" : ""}
            aria-current={index === activeStepIndex ? "step" : undefined}
          >
            <span>{index < activeStepIndex ? <Check size={13} /> : index + 1}</span>
            {item.label}
          </li>
        ))}
      </ol>

      {error && (
        <div className="alert alert-error" role="alert">
          <AlertTriangle size={18} aria-hidden="true" />
          <div>
            <strong>Action could not complete</strong>
            <p>{error}</p>
          </div>
        </div>
      )}
      {busy && (
        <div className="process-banner" role="status" aria-live="polite">
          <span className="loading-pulse" aria-hidden="true" />
          <span>{busy}</span>
        </div>
      )}

      <div className="demo-layout">
        <section className="demo-main" aria-live="polite">
          {step === "RECEIPT" && (
            <div className="demo-panel">
              <PanelHeading
                icon={<FileScan />}
                kicker="Step 1"
                title="Choose synthetic source evidence"
                copy="Built-in receipt images are safe demo fixtures. Arbitrary uploads are disabled."
              />
              <div
                className="scenario-grid"
                role="radiogroup"
                aria-label="Synthetic receipt scenario"
              >
                {scenarios.map((item) => (
                  <button
                    className={`scenario-option ${scenarioId === item.id ? "selected" : ""}`}
                    type="button"
                    role="radio"
                    aria-checked={scenarioId === item.id}
                    key={item.id}
                    onClick={() => {
                      setScenarioId(item.id);
                      setTargetPlanId(item.defaultTargetPlanId);
                    }}
                    disabled={!!busy}
                  >
                    <strong>{item.title}</strong>
                    <span>{item.shortDescription}</span>
                  </button>
                ))}
              </div>
              {scenario && (
                <div className="receipt-preview">
                  <Image
                    src={scenario.receiptImageUrl}
                    alt={`Synthetic demo receipt for ${scenario.title}`}
                    width={1000}
                    height={1240}
                    priority
                  />
                  <div>
                    <span className="pill">Synthetic fixture</span>
                    <h3>{scenario.title}</h3>
                    <p>{scenario.shortDescription}</p>
                    <button
                      className="button button-primary"
                      type="button"
                      onClick={readReceipt}
                      disabled={!!busy || !csrfToken}
                    >
                      <Sparkles size={18} aria-hidden="true" /> Read receipt with GPT-5.6
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {step === "VERIFY" && extraction && (
            <div className="demo-panel">
              <PanelHeading
                icon={<Bot />}
                kicker="Unverified receipt details"
                title="Evidence extracted"
                copy="AI extraction helps locate the subscription. It does not approve a credit."
              />
              {receiptAi && <AiMode status={receiptAi} purpose="Receipt extraction" />}
              <dl className="fact-grid">
                <Fact label="Product" value={extraction.productName ?? "Not found"} />
                <Fact label="Amount" value={extraction.amountText ?? "Not found"} />
                <Fact label="Purchase date" value={extraction.purchaseDateText ?? "Not found"} />
                <Fact
                  label="Expiry / renewal"
                  value={extraction.expiryOrRenewalDateText ?? "Not found"}
                />
                <Fact
                  label="Synthetic reference"
                  value={extraction.syntheticLookupReference ?? "Not found"}
                />
                <Fact label="Confidence" value={extraction.confidence} />
              </dl>
              {extraction.warnings.map((warning) => (
                <p className="inline-note" key={warning}>
                  {warning}
                </p>
              ))}
              <button
                className="button button-primary"
                type="button"
                onClick={verifySource}
                disabled={!!busy}
              >
                <ShieldCheck size={18} aria-hidden="true" /> Verify with source provider
              </button>
            </div>
          )}

          {step === "VERIFY" && verification && verification.eligibility.status !== "ELIGIBLE" && (
            <DecisionPanel verification={verification} onReset={resetDemo} />
          )}

          {step === "PLAN" && verification && (
            <div className="demo-panel">
              <PanelHeading
                icon={<BadgeCheck />}
                kicker="Subscription verified"
                title="Choose the new direct plan"
                copy="Provider data is now authoritative. All target prices remain illustrative."
              />
              <div className="verified-strip">
                <BadgeCheck size={20} aria-hidden="true" />
                <div>
                  <strong>{verification.source.planName}</strong>
                  <span>
                    {money(verification.source.amountPaidMinor, verification.source.currency)} ·{" "}
                    {verification.source.status}
                  </span>
                </div>
              </div>
              <div className="plan-grid" role="radiogroup" aria-label="Target plan">
                {plans.map((plan) => (
                  <button
                    type="button"
                    role="radio"
                    aria-checked={targetPlanId === plan.id}
                    className={`plan-option ${targetPlanId === plan.id ? "selected" : ""}`}
                    key={plan.id}
                    onClick={() => setTargetPlanId(plan.id)}
                    disabled={plan.disabled || !!busy}
                  >
                    <span>
                      {plan.recommended ? "Recommended" : plan.disabled ? "Coming soon" : "Direct"}
                    </span>
                    <strong>{plan.name}</strong>
                    <b>{money(plan.priceMinor, "EUR")}</b>
                    <small>{plan.note}</small>
                  </button>
                ))}
              </div>
              <button
                className="button button-primary"
                type="button"
                onClick={createQuote}
                disabled={!!busy}
              >
                Create migration quote <ArrowRight size={18} aria-hidden="true" />
              </button>
            </div>
          )}

          {step === "REVIEW" && quote && verification && (
            <div className="demo-panel">
              <PanelHeading
                icon={<Clock3 />}
                kicker="Verified calculation"
                title="Keep the value of every unused day."
                copy={`You have ${quote.ratio.numerator} of ${quote.ratio.denominator} paid days remaining.`}
              />
              <Timeline quote={quote} source={verification.source} />
              <div className="calculation-card">
                <div>
                  <span>Target plan</span>
                  <strong>{money(quote.targetPriceMinor, quote.currency)}</strong>
                </div>
                <div className="credit-value">
                  <span>Migration credit</span>
                  <strong>−{money(quote.migrationCreditMinor, quote.currency)}</strong>
                </div>
                <div className="due-value">
                  <span>Simulated due now</span>
                  <strong>{money(quote.amountDueMinor, quote.currency)}</strong>
                </div>
              </div>
              <div className="policy-line">
                <span>
                  Policy {quote.policy.id} · v{quote.policy.version}
                </span>
                <span>
                  {quote.roundingMode} · quote {quote.fingerprintPrefix}…
                </span>
              </div>
              {explanation ? (
                <div className="explanation-card">
                  <div className="explanation-label">
                    <Sparkles size={15} aria-hidden="true" /> Explained from verified calculation
                    data · {explanationAi?.live ? explanationAi.model : "deterministic fallback"}
                  </div>
                  <h3>{explanation.headline}</h3>
                  <p>{explanation.summary}</p>
                  <p>{explanation.calculationExplanation}</p>
                  <div className="risk-copy">
                    <AlertTriangle size={17} aria-hidden="true" /> {explanation.riskExplanation}
                  </div>
                </div>
              ) : (
                <div className="process-banner" role="status">
                  <span className="loading-pulse" /> Preparing plain-language explanation…
                </div>
              )}
              <button
                className="button button-primary"
                type="button"
                onClick={() => setStep("CONFIRM")}
                disabled={!explanation || !!busy}
              >
                Continue to consent <ArrowRight size={18} aria-hidden="true" />
              </button>
            </div>
          )}

          {step === "CONFIRM" && quote && (
            <div className="demo-panel">
              <PanelHeading
                icon={<ShieldCheck />}
                kicker="Explicit consent"
                title="Confirm the simulated rebase"
                copy="Each statement is required. This sandbox never touches a real account or payment method."
              />
              <div className="consent-list">
                {[
                  "I understand this sandbox does not cancel or refund a real mobile-store subscription.",
                  "I understand that in a real migration I would still need to stop source auto-renewal.",
                  "I authorize this simulated rebase operation.",
                ].map((label, index) => (
                  <label key={label}>
                    <input
                      type="checkbox"
                      checked={consents[index]}
                      onChange={(event) =>
                        setConsents((current) =>
                          current.map((value, itemIndex) =>
                            itemIndex === index ? event.target.checked : value,
                          ),
                        )
                      }
                    />
                    <span>{label}</span>
                  </label>
                ))}
              </div>
              <button
                className="button button-primary button-large"
                type="button"
                onClick={confirm}
                disabled={consents.some((value) => !value) || !!busy}
              >
                Rebase and start the new plan <ArrowRight size={18} aria-hidden="true" />
              </button>
            </div>
          )}
        </section>

        <aside className="demo-summary" aria-label="Current migration summary">
          <p className="kicker">Live summary</p>
          <h2>{selectedPlan.name}</h2>
          <dl>
            <div>
              <dt>Source evidence</dt>
              <dd>{scenario?.title ?? "Loading"}</dd>
            </div>
            <div>
              <dt>Provider status</dt>
              <dd>{verification?.source.status ?? "Not verified"}</dd>
            </div>
            <div>
              <dt>Migration credit</dt>
              <dd>{summary ? `−${summary.credit}` : "Pending"}</dd>
            </div>
          </dl>
          <div className="summary-due">
            <span>Simulated due now</span>
            <strong>{summary?.due ?? money(selectedPlan.priceMinor, "EUR")}</strong>
          </div>
          <p className="summary-disclaimer">Illustrative prices · no payment performed</p>
        </aside>
      </div>
    </div>
  );
}

function AiMode({ status, purpose }: { status: AiStatus; purpose: string }) {
  return (
    <div className={`ai-mode ${status.live ? "live" : "fallback"}`}>
      <span aria-hidden="true" />
      <strong>{purpose}</strong>
      <b>{status.live ? `${status.model} live` : "Deterministic fallback"}</b>
      {!status.live && status.fallbackCode && <code>{status.fallbackCode}</code>}
    </div>
  );
}

function PanelHeading({
  icon,
  kicker,
  title,
  copy,
}: {
  icon: React.ReactNode;
  kicker: string;
  title: string;
  copy: string;
}) {
  return (
    <header className="panel-heading">
      <div className="panel-icon" aria-hidden="true">
        {icon}
      </div>
      <div>
        <p className="kicker">{kicker}</p>
        <h2>{title}</h2>
        <p>{copy}</p>
      </div>
    </header>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function DecisionPanel({ verification, onReset }: { verification: Verification; onReset(): void }) {
  const manual = verification.eligibility.status === "MANUAL_REVIEW_REQUIRED";
  return (
    <div className="demo-panel decision-panel">
      <div className={`decision-icon ${manual ? "warning" : "blocked"}`}>
        <AlertTriangle aria-hidden="true" />
      </div>
      <p className="kicker">{manual ? "Manual review required" : "Migration blocked"}</p>
      <h2>{manual ? "This migration needs review." : "This source cannot create a credit."}</h2>
      <p>
        {manual
          ? "The source provider may still recover a payment, so the system will not create a credit automatically."
          : verification.eligibility.reasons.includes("SOURCE_ALREADY_CONSUMED")
            ? "This subscription has already been migrated. A source transaction can create only one migration credit."
            : "The verified provider state does not satisfy the demo credit policy."}
      </p>
      <div className="reason-chips">
        {verification.eligibility.reasons.map((reason) => (
          <code key={reason}>{reason}</code>
        ))}
      </div>
      <button className="button button-primary" type="button" onClick={onReset}>
        Try another scenario <RefreshCcw size={17} aria-hidden="true" />
      </button>
    </div>
  );
}

function Timeline({ quote, source }: { quote: Quote; source: Verification["source"] }) {
  const remaining = Number(quote.remainingDurationMs);
  const total = Number(quote.periodDurationMs);
  const usedPercentage = Math.max(0, Math.min(100, ((total - remaining) / total) * 100));
  return (
    <div className="timeline-card">
      <div
        className="timeline-track"
        role="img"
        aria-label={`${quote.ratio.numerator} of ${quote.ratio.denominator} paid days remain`}
      >
        <span className="timeline-used" style={{ width: `${usedPercentage}%` }} />
        <span className="timeline-remaining" style={{ width: `${100 - usedPercentage}%` }} />
        <i style={{ left: `${usedPercentage}%` }} />
      </div>
      <div className="timeline-dates">
        <span>
          <b>Started</b>
          {shortDate(source.periodStartUtc)}
        </span>
        <span className="timeline-now">
          <b>Demo today</b>
          Jul 19
        </span>
        <span>
          <b>Ends</b>
          {shortDate(source.periodEndUtc)}
        </span>
      </div>
    </div>
  );
}

async function parseResponse<T>(response: Response): Promise<T> {
  const data = (await response.json()) as T & {
    error?: { userMessage?: string; message?: string };
  };
  if (!response.ok) {
    throw new Error(data.error?.userMessage ?? data.error?.message ?? "Request failed");
  }
  return data;
}

function messageFrom(error: unknown): string {
  return error instanceof Error ? error.message : "The demo could not complete this action.";
}

function money(amountMinor: string, currency: string): string {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency }).format(
    Number(amountMinor) / 100,
  );
}

function shortDate(value: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(new Date(value));
}
