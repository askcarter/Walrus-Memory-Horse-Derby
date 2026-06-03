// Each connected wallet gets its own slice of memory. We scope by Sui address:
// `betting-history:<0x…>`. Same wallet → same namespace → your history follows
// you across sessions and devices, isolated from other players.
export const BETTING_NAMESPACE_BASE = "betting-history";

// Constructor-level fallback only — every call passes an explicit per-wallet
// namespace, so this is never actually used to read/write game data.
export const DEFAULT_NAMESPACE = BETTING_NAMESPACE_BASE;

export function bettingNamespace(owner: string): string {
  return `${BETTING_NAMESPACE_BASE}:${owner}`;
}
