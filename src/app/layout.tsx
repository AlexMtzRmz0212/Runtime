import type { Metadata, Viewport } from "next";
import { Archivo, Big_Shoulders } from "next/font/google";
import Link from "next/link";
import { preconnect } from "react-dom";
import { OwnerNav } from "@/components/OwnerNav";
import "./globals.css";

export const metadata: Metadata = { title: { default: "Runtime", template: "%s · Runtime" }, description: "Every show I’m running, one episode at a time: what I’m watching, what I’ve finished and what’s next" };
export const viewport: Viewport = { themeColor: "#1f2329", colorScheme: "dark" };

// Big Shoulders (condensed, Chicago street signage) for titles and race-bib figures, Archivo for everything else.
const display = Big_Shoulders({ subsets: ["latin", "latin-ext"], axes: ["opsz"], variable: "--font-shoulders" });
const sans = Archivo({ subsets: ["latin", "latin-ext"], axes: ["wdth"], variable: "--font-archivo" });

/** The wordmark's mark: a tiny race bib, the same one as the tab icon. */
function BibMark() {
  return (
    <svg aria-hidden viewBox="0 0 20 16" className="h-[0.8em] w-auto">
      <rect width="20" height="16" rx="2.5" fill="var(--paper)" />
      <path d="M0 2.5A2.5 2.5 0 0 1 2.5 0h15A2.5 2.5 0 0 1 20 2.5V5H0z" fill="var(--accent)" />
      <circle cx="3" cy="13" r="1.2" fill="var(--bg)" />
      <circle cx="17" cy="13" r="1.2" fill="var(--bg)" />
    </svg>
  );
}

const links = [
  { href: "/", label: "Library" },
  { href: "/finishers", label: "Finishers" },
  { href: "/top", label: "Top" },
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  // Every poster comes from TVmaze's image host.
  preconnect("https://static.tvmaze.com");
  return (
    <html lang="en" className={`${display.variable} ${sans.variable}`}>
      <body className="min-h-screen">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-md focus:bg-accent focus:px-3 focus:py-2 focus:text-sm focus:font-medium focus:text-bg"
        >
          Skip to content
        </a>
        <header className="border-b border-border bg-bg sm:sticky sm:top-0 sm:z-40">
          <nav aria-label="Main" className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-8 px-4 sm:h-16 sm:flex-nowrap sm:px-6">
            <Link href="/" className="flex h-12 items-center gap-2.5 font-display text-[26px] leading-none font-black sm:h-auto">
              <BibMark />
              <span translate="no">Runtime</span>
            </Link>
            <OwnerNav links={links} />
          </nav>
        </header>
        <main id="main" className="mx-auto max-w-6xl px-4 py-8 sm:px-6">{children}</main>
        <footer className="mx-auto max-w-6xl px-4 pb-10 text-xs text-muted sm:px-6">
          Episode data and covers from{" "}
          <a href="https://www.tvmaze.com" className="underline underline-offset-2 hover:text-text" rel="noreferrer" translate="no">TVmaze</a>.
        </footer>
      </body>
    </html>
  );
}
