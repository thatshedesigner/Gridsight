import type { Metadata } from "next";
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
      <body>{children}</body>
    </html>
  );
}
