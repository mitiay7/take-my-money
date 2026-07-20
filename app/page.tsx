import Link from "next/link";
import { ArrowRight, BadgeCheck, Braces, RefreshCcw } from "lucide-react";

const protocol = [
  {
    number: "01",
    title: "Verify paid value",
    copy: "Synthetic receipt evidence locates a subscription; a provider adapter verifies the facts.",
    icon: BadgeCheck,
  },
  {
    number: "02",
    title: "Calculate the unused part",
    copy: "Deterministic bigint arithmetic prices the exact remaining UTC duration. Never an LLM.",
    icon: Braces,
  },
  {
    number: "03",
    title: "Rebase once",
    copy: "A one-time migration credit starts the direct plan with idempotency and an audit trail.",
    icon: RefreshCcw,
  },
];

export default function HomePage() {
  return (
    <>
      <section className="hero shell">
        <div className="eyebrow-row">
          <span className="status-dot" aria-hidden="true" />
          <span>Demo environment</span>
          <span className="eyebrow-rule" aria-hidden="true" />
          <span>100% synthetic data</span>
        </div>
        <div className="hero-grid">
          <div>
            <h1>Switch plans without paying twice.</h1>
            <p className="hero-copy">
              Take my money turns the unused part of a mobile-billed subscription into a one-time
              credit for a new direct plan.
            </p>
            <div className="hero-actions">
              <Link className="button button-primary" href="/about">
                Explore the protocol <ArrowRight size={18} aria-hidden="true" />
              </Link>
              <a className="text-link" href="#protocol">
                See the three steps
              </a>
            </div>
          </div>
          <aside className="value-card" aria-label="Example migration calculation">
            <div className="value-card-top">
              <span>Illustrative rebase</span>
              <span className="pill">EUR</span>
            </div>
            <div className="value-lines">
              <div>
                <span>Direct Pro</span>
                <strong>€229.00</strong>
              </div>
              <div className="credit-line">
                <span>19 paid days kept</span>
                <strong>−€15.32</strong>
              </div>
            </div>
            <div className="due-row">
              <span>Simulated due now</span>
              <strong>€213.68</strong>
            </div>
            <div
              className="timeline-mini"
              role="img"
              aria-label="19 of 31 subscription days remain"
            >
              <span className="used" />
              <span className="remaining" />
            </div>
            <div className="timeline-labels">
              <span>12 used</span>
              <span>19 days kept</span>
            </div>
          </aside>
        </div>
      </section>

      <section className="protocol shell" id="protocol" aria-labelledby="protocol-title">
        <div className="section-heading">
          <p className="kicker">The rebase protocol</p>
          <h2 id="protocol-title">Portable value, controlled end to end.</h2>
        </div>
        <div className="protocol-grid">
          {protocol.map(({ number, title, copy, icon: Icon }) => (
            <article className="protocol-card" key={number}>
              <div className="protocol-card-head">
                <span>{number}</span>
                <Icon size={22} strokeWidth={1.7} aria-hidden="true" />
              </div>
              <h3>{title}</h3>
              <p>{copy}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="boundary shell" aria-labelledby="boundary-title">
        <div>
          <p className="kicker">Hard boundary</p>
          <h2 id="boundary-title">AI reads and explains. Code controls every cent.</h2>
        </div>
        <p>
          GPT-5.6 can extract unverified facts from a synthetic receipt and explain verified
          results. Eligibility, proration, credits, state transitions, and execution remain
          deterministic.
        </p>
      </section>
    </>
  );
}
