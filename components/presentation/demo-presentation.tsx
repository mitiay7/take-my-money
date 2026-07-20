import Image from "next/image";
import {
  ArrowRight,
  BadgeCheck,
  Bot,
  Braces,
  Check,
  CircleDollarSign,
  Code2,
  Database,
  GitBranch,
  LockKeyhole,
  RefreshCcw,
  ShieldCheck,
  Smartphone,
  Sparkles,
  TestTube2,
} from "lucide-react";

type PresentationProps = {
  scene: string;
  phase: "evidence" | "ending";
  recording: boolean;
};

const sceneNames: Record<string, string> = {
  "01": "The upgrade problem",
  "02": "Synthetic source",
  "03": "The portability bridge",
  "04": "Extract, then verify",
  "05": "Deterministic calculation",
  "06": "Execute exactly once",
  "07": "Trace every decision",
  "08": "Built with Codex",
};

export function DemoPresentation({ scene, phase, recording }: PresentationProps) {
  return (
    <div className={`presentation-stage ${recording ? "is-recording" : ""}`}>
      <header className="presentation-chrome">
        <div className="presentation-brand">
          <span>TM</span>
          <strong>Take my money</strong>
        </div>
        <div className="presentation-meta">
          <span>Synthetic sandbox</span>
          <b>
            {scene} / 08 · {sceneNames[scene]}
          </b>
        </div>
      </header>
      <main className="presentation-canvas">{renderScene(scene, phase)}</main>
      <footer className="presentation-disclaimer">
        Demo values only · No real subscription, payment, refund, or cancellation
      </footer>
    </div>
  );
}

function renderScene(scene: string, phase: "evidence" | "ending") {
  switch (scene) {
    case "01":
      return <HookScene />;
    case "02":
      return <SourceScene />;
    case "03":
      return <SolutionScene />;
    case "08":
      return phase === "ending" ? <EndingScene /> : <BuildScene />;
    default:
      return <BridgeScene scene={scene} />;
  }
}

function HookScene() {
  return (
    <section className="presentation-hook" data-testid="presentation-hook">
      <div>
        <p className="presentation-kicker">A subscription portability prototype</p>
        <h1>Switch plans without paying twice.</h1>
        <p>
          The customer is ready to upgrade. The value they already paid for is still held behind a
          different billing boundary.
        </p>
      </div>
      <div className="hook-problem" aria-label="Duplicate payment risk">
        <span>Paid mobile period</span>
        <strong>19 days remain</strong>
        <i />
        <span>New direct plan</span>
        <strong>Ready now</strong>
        <div>Duplicate-payment risk</div>
      </div>
    </section>
  );
}

function SourceScene() {
  return (
    <section className="presentation-source" data-testid="current-subscription">
      <div className="source-copy">
        <p className="presentation-kicker">Existing paid value</p>
        <h1>A real problem, modelled with synthetic data.</h1>
        <p>
          No account is connected. This version-controlled sandbox record is the only source shown
          in the demo.
        </p>
        <div className="synthetic-seal">
          <ShieldCheck aria-hidden="true" />
          <span>
            <strong>100% synthetic</strong>
            No live store receipt or customer identifier
          </span>
        </div>
      </div>
      <div className="source-record-card">
        <div className="source-record-head">
          <span data-testid="source-provider">Apple sandbox adapter</span>
          <b>ACTIVE</b>
        </div>
        <div className="source-record-body">
          <Image
            data-testid="synthetic-receipt"
            src="/receipts/receipt-active-normal.png"
            alt="Synthetic mobile-billed Plus receipt"
            width={1000}
            height={1240}
            priority
          />
          <dl>
            <Fact label="Plan" value="Plus — mobile billed demo" />
            <Fact label="Paid amount" value="€24.99" testId="source-amount" />
            <Fact label="Paid period" value="Jul 7 – Aug 7, 2026 UTC" testId="source-period" />
            <Fact label="Demo today" value="Jul 19, 2026 UTC" />
            <Fact label="Unused period" value="19 of 31 days" />
            <Fact label="Auto-renew" value="On · customer action still required" />
          </dl>
        </div>
      </div>
    </section>
  );
}

function SolutionScene() {
  return (
    <section className="presentation-solution">
      <div className="solution-heading">
        <p className="presentation-kicker">The rebase protocol</p>
        <h1>Move service value. Never pretend it is a refund.</h1>
        <p>A verified unused period becomes one controlled credit on a new direct plan.</p>
      </div>
      <div className="portability-flow" aria-label="Provider-neutral portability flow">
        <FlowNode
          icon={<Smartphone />}
          number="01"
          title="Source provider"
          copy="Verify paid period"
        />
        <ArrowRight aria-hidden="true" />
        <FlowNode icon={<BadgeCheck />} number="02" title="Unused value" copy="19 / 31 · €15.32" />
        <ArrowRight aria-hidden="true" />
        <FlowNode
          icon={<CircleDollarSign />}
          number="03"
          title="One-time credit"
          copy="Exactly-once consumption"
        />
        <ArrowRight aria-hidden="true" />
        <FlowNode
          icon={<Sparkles />}
          number="04"
          title="Direct Pro"
          copy="€213.68 due"
          testId="target-plan"
        />
      </div>
      <div className="not-refund-note">
        <LockKeyhole aria-hidden="true" />
        <span>
          <strong>Credit bridge, not cash movement</strong>
          No store refund · no payment performed · no real subscription changed
        </span>
      </div>
    </section>
  );
}

function BridgeScene({ scene }: { scene: string }) {
  return (
    <section className="presentation-bridge" data-testid={`presentation-scene-${scene}`}>
      <RefreshCcw aria-hidden="true" />
      <p className="presentation-kicker">Live product flow</p>
      <h1>{sceneNames[scene]}</h1>
      <p>The recorder now continues inside the real deployed migration experience.</p>
    </section>
  );
}

function BuildScene() {
  return (
    <section className="presentation-build" data-testid="codex-build-log">
      <div className="build-heading">
        <p className="presentation-kicker">Codex contribution</p>
        <h1>Built as a system, not a slideshow.</h1>
        <p>
          Codex helped implement and verify the architecture, billing core, provider adapters,
          migration saga, tests, documentation, and interface iterations.
        </p>
      </div>
      <div className="build-grid">
        <BuildCard
          icon={<Braces />}
          title="Deterministic core"
          copy="Bigint money · exact UTC duration · HALF_UP"
        />
        <BuildCard
          icon={<GitBranch />}
          title="Migration saga"
          copy="Locks · idempotency · compensation · reconciliation"
        />
        <BuildCard
          icon={<Database />}
          title="PostgreSQL truth"
          copy="Immutable quotes · ledger · ordered audit"
        />
        <BuildCard
          icon={<TestTube2 />}
          title="Release evidence"
          copy="Unit · real PostgreSQL · desktop/mobile E2E · Axe"
        />
      </div>
      <div className="gpt-boundary" data-testid="gpt-usage">
        <div>
          <Bot aria-hidden="true" />
          <span>
            <strong>GPT-5.6 product roles</strong>
            Synthetic receipt extraction · Structured Outputs · verified-fact explanation
          </span>
        </div>
        <div>
          <Code2 aria-hidden="true" />
          <span>
            <strong>Hard boundary</strong>
            AI never authorizes eligibility, money, credits, provider calls, or state transitions
          </span>
        </div>
        <p>
          Recording runtime: <b>deterministic fallback</b> · live model path available when a
          server-side key is configured
        </p>
      </div>
    </section>
  );
}

function EndingScene() {
  return (
    <section className="presentation-ending" data-testid="ending-card">
      <div className="ending-mark">TM</div>
      <p>Subscription portability · provider-neutral by design</p>
      <h1>Take my money</h1>
      <h2>Upgrade now. Keep every paid day.</h2>
      <div className="ending-impact">
        <span>
          <Check aria-hidden="true" /> Upgrade without waiting
        </span>
        <span>
          <Check aria-hidden="true" /> Reduce duplicate-charge friction
        </span>
        <span>
          <Check aria-hidden="true" /> Connect more billing platforms
        </span>
      </div>
      <strong>take-my-money-psi.vercel.app</strong>
    </section>
  );
}

function Fact({ label, value, testId }: { label: string; value: string; testId?: string }) {
  return (
    <div data-testid={testId}>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function FlowNode({
  icon,
  number,
  title,
  copy,
  testId,
}: {
  icon: React.ReactNode;
  number: string;
  title: string;
  copy: string;
  testId?: string;
}) {
  return (
    <article data-testid={testId}>
      <div>
        {icon}
        <span>{number}</span>
      </div>
      <h2>{title}</h2>
      <p>{copy}</p>
    </article>
  );
}

function BuildCard({ icon, title, copy }: { icon: React.ReactNode; title: string; copy: string }) {
  return (
    <article>
      {icon}
      <h2>{title}</h2>
      <p>{copy}</p>
    </article>
  );
}
