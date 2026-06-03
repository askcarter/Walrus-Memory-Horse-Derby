import { MemWal } from "@mysten-incubation/memwal";
import { DEFAULT_NAMESPACE } from "@/lib/namespaces";

let cached: MemWal | null = null;

export function getMemWal(): MemWal {
  if (cached) return cached;

  const key = process.env.MEMWAL_PRIVATE_KEY;
  const accountId = process.env.MEMWAL_ACCOUNT_ID;
  const serverUrl = process.env.MEMWAL_SERVER_URL ?? "https://relayer.memwal.ai";

  if (!key || !accountId) {
    throw new Error(
      "MEMWAL_PRIVATE_KEY and MEMWAL_ACCOUNT_ID must be set in .env.local. Generate them at https://memwal.ai (or https://staging.memwal.ai for testnet)."
    );
  }

  cached = MemWal.create({
    key,
    accountId,
    serverUrl,
    namespace: DEFAULT_NAMESPACE,
  });
  return cached;
}
