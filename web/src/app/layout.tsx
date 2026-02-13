import type { Metadata } from "next";
import { Lora, Manrope } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const headingFont = Lora({
  subsets: ["latin"],
  variable: "--font-heading",
  weight: ["600", "700"],
});

const bodyFont = Manrope({
  subsets: ["latin"],
  variable: "--font-body",
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Century of Finance",
  description: "100 years of daily financial history and market-shaping events.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${headingFont.variable} ${bodyFont.variable}`}>
        <div className="ambient-glow ambient-glow-left" />
        <div className="ambient-glow ambient-glow-right" />
        <header className="site-header">
          <div className="site-shell">
            <Link href="/" className="brand">
              Century of Finance
            </Link>
            <nav className="site-nav">
              <Link href="/">Events</Link>
              <Link href="/events/stream">Event Stream</Link>
              <Link href="/timelines">Timelines</Link>
              <Link href="/calendar/09-15">On This Day</Link>
              <Link href="/admin">Admin</Link>
            </nav>
          </div>
        </header>
        <main className="site-shell">{children}</main>
      </body>
    </html>
  );
}
