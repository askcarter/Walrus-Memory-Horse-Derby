import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Walrus Memory Horse Derby",
  description: "Bet on the derby. Walrus Memory learns how you bet.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
