import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "GridSight",
  description:
    "Bengaluru parking enforcement priority ranking and weekly zone briefs.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="bg-slate-950 text-slate-950 antialiased">
        <header className="sticky top-0 z-[1000] border-b border-white/10 bg-slate-950/95 px-5 py-3 text-white backdrop-blur sm:px-8 lg:px-10">
          <nav className="mx-auto flex max-w-6xl items-center justify-between gap-4">
            <Link
              className="text-base font-semibold tracking-tight text-white"
              href="/"
            >
              GridSight
            </Link>
            <div className="flex items-center gap-4 text-sm font-medium text-slate-300">
              <Link className="transition hover:text-white" href="/">
                Dashboard
              </Link>
              <Link className="transition hover:text-white" href="/methodology">
                Methodology
              </Link>
            </div>
          </nav>
        </header>
        {children}
      </body>
    </html>
  );
}
