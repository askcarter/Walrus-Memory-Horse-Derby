import "./globals.css";
import "@mysten/dapp-kit/dist/index.css";
import type { Metadata } from "next";
import { Providers } from "./providers";

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
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
