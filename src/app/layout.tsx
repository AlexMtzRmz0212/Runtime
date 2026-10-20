import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Hanken_Grotesk } from "next/font/google";
import Link from "next/link";
import { OwnerNav } from "@/components/OwnerNav";
import "./globals.css";

export const metadata: Metadata = { title: { default: "TV Shows", template: "%s · TV Shows" }, description: "What I'm watching, what I've watched and what's next" };
export const viewport: Viewport = { themeColor: "#0f1115", colorScheme: "dark" };

// Bricolage Grotesque for titles and figures, Hanken Grotesk for everything else.
const display = Bricolage_Grotesque({ subsets: ["latin", "latin-ext"], variable: "--font-bricolage" });
const sans = Hanken_Grotesk({ subsets: ["latin", "latin-ext"], variable: "--font-hanken" });

const links = [
  { href: "/", label: "Library" },
  { href: "/top", label: "Top" },
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${sans.variable}`}>
      <body className="min-h-screen">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-md focus:bg-accent focus:px-3 focus:py-2 focus:text-sm focus:font-medium focus:text-bg"
        >
          Skip to content
        </a>
        <header className="border-b border-border bg-bg/95 backdrop-blur-sm sm:sticky sm:top-0 sm:z-40">
          <nav aria-label="Main" className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-8 px-4 sm:h-16 sm:flex-nowrap sm:px-6">
            <Link href="/" className="flex h-12 items-center gap-2 font-display text-2xl leading-none font-extrabold tracking-tight sm:h-auto">
              <span aria-hidden className="size-2.5 rounded-full bg-accent" />
              TV Shows
            </Link>
            <OwnerNav links={links} />
          </nav>
        </header>
        <main id="main" className="mx-auto max-w-6xl px-4 py-8 sm:px-6">{children}</main>
        <footer className="mx-auto max-w-6xl px-4 pb-10 text-xs text-muted sm:px-6">
          Episode data and covers from{" "}
          <a href="https://www.tvmaze.com" className="underline underline-offset-2 hover:text-text" rel="noreferrer">TVmaze</a>.
        </footer>
      </body>
    </html>
  );
}
