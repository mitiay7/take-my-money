import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ArrowRight, CheckCircle2, ShieldCheck } from "lucide-react";

export const metadata: Metadata = { title: "How it works" };

export default function AboutPage() {
  return (
    <div className="content-page shell">
      <Link className="back-link" href="/">
        <ArrowLeft size={16} aria-hidden="true" /> Back home
      </Link>
      <p className="kicker">Subscription portability</p>
      <h1>Keep service value intact across billing boundaries.</h1>
      <p className="lede">
        A subscription rebase recognizes the unused service period from one provider and creates a
        controlled, one-time credit at another. It is a credit bridge, not a refund or money
        transfer.
      </p>
      <div className="about-grid">
        <section className="about-card">
          <CheckCircle2 aria-hidden="true" />
          <h2>What this demo proves</h2>
          <p>
            Verified source data, exact proration, one-time consumption, idempotent confirmation,
            append-only accounting, reconciliation, and a customer-readable result.
          </p>
        </section>
        <section className="about-card">
          <ShieldCheck aria-hidden="true" />
          <h2>What it never does</h2>
          <p>
            It never accesses a real account, contacts a real billing provider, accepts payment
            data, issues a refund, cancels renewal, or changes a real subscription.
          </p>
        </section>
      </div>
      <Link className="button button-primary about-cta" href="/demo">
        Try the migration demo <ArrowRight size={17} aria-hidden="true" />
      </Link>
    </div>
  );
}
