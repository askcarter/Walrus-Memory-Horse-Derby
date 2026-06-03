"use client";

// dapp-kit needs three nested providers. We only read the connected wallet's
// address (Option A: scope memories by address) — this app makes ZERO Sui RPC
// calls, so the SuiClientProvider's client is dormant wiring that dapp-kit
// requires but never exercises. dapp-kit 1.x only accepts a JSON-RPC client
// here (no gRPC support in its context), hence this config; no JSON-RPC traffic
// is ever sent. `autoConnect` re-links the last-used Slush wallet on reload, so
// the connection persists across sessions.

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SuiClientProvider, WalletProvider, createNetworkConfig } from "@mysten/dapp-kit";
import { getJsonRpcFullnodeUrl } from "@mysten/sui/jsonRpc";

const { networkConfig } = createNetworkConfig({
  testnet: { url: getJsonRpcFullnodeUrl("testnet"), network: "testnet" },
});

const queryClient = new QueryClient();

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <SuiClientProvider networks={networkConfig} defaultNetwork="testnet">
        <WalletProvider autoConnect>{children}</WalletProvider>
      </SuiClientProvider>
    </QueryClientProvider>
  );
}
