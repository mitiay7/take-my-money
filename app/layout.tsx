import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Take my money — subscription portability",
    template: "%s — Take my money",
  },
  description: "A subscription-portability sandbox that preserves the value of every paid day.",
  metadataBase: new URL(process.env.APP_BASE_URL ?? "http://localhost:3000"),
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body>
        <a className="skip-link" href="#main-content">
          Skip to content
        </a>
        <header className="site-header">
          <Link className="brand" href="/" aria-label="Take my money home">
            <span className="brand-mark" aria-hidden="true">
              TM
            </span>
            <span>Take my money</span>
          </Link>
          <nav aria-label="Primary navigation">
            <Link href="/about">How it works</Link>
            <a href="https://github.com/mitiay7/take-my-money" target="_blank" rel="noreferrer">
              GitHub <ArrowUpRight size={14} aria-hidden="true" />
            </a>
          </nav>
        </header>
        <main id="main-content">{children}</main>
        <footer className="site-footer">
          <p>
            Independent sandbox prototype. No real subscription, refund, cancellation, or payment is
            performed.
          </p>
          <span>OpenAI Build Week Challenge · 2026</span>
        </footer>
      </body>
    </html>
  );
}
