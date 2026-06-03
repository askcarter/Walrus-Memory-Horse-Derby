"use server";

import { isValidSuiAddress } from "@mysten/sui/utils";
import { getMemWal } from "@/lib/memwal";
import { bettingNamespace } from "@/lib/namespaces";
import {
  formatRaceMemory,
  parseRaceMemory,
  buildStrategy,
  type BetOutcome,
  type Strategy,
} from "@/lib/raceMemory";

export type RecordOutcome =
  | { ok: true; text: string; blobId: string }
  | { ok: false; error: string };

/**
 * recordRace() — persist one finished race to Walrus Memory.
 *
 * We use remember() (not analyze()) on purpose: a race is a single atomic
 * record and we need all its fields to stay together for later analytics.
 * analyze() would shatter it into disconnected canonical facts ("user bet $50",
 * "PURPLE lost") and lose the per-race linkage the strategy advisor depends on.
 * rememberAndWait() blocks until the memory is durable so it's recallable
 * immediately (avoids the indexer-lag window).
 *
 * `owner` is the connected wallet's Sui address. We validate it (it arrives from
 * the client) and use it to scope the namespace so each player only ever writes
 * to their own history.
 */
export async function recordRace(owner: string, outcome: BetOutcome): Promise<RecordOutcome> {
  if (!isValidSuiAddress(owner)) return { ok: false, error: "connect a wallet to save races" };
  try {
    const text = formatRaceMemory(outcome);
    const memwal = getMemWal();
    const result = await memwal.rememberAndWait(text, bettingNamespace(owner));
    console.log(`[recordRace] ${owner.slice(0, 10)}… stored → ${text}`);
    return { ok: true, text, blobId: result.blob_id };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "unknown error" };
  }
}

export type StrategyResult =
  | { ok: true; strategy: Strategy; recalled: { text: string; distance: number }[] }
  | { ok: false; error: string };

/**
 * suggestStrategy() — recall the betting history and aggregate it into advice.
 *
 * Note on recall(): it returns the top-K memories by cosine distance, NOT an
 * exhaustive dump. For strategy we want the WHOLE history, so we use a generic
 * query that every race record is semantically near, a high limit, and we
 * deliberately do NOT apply a distance cutoff (the reading-tracker base app
 * filtered at 0.7) — older races sit a little farther from the query and we
 * don't want to drop them. With a modest number of races this returns all of
 * them; at large scale this is a known limitation worth surfacing.
 *
 * The advice itself is computed by a transparent heuristic (buildStrategy), not
 * an LLM — the SDK has no general completion endpoint, and pulling in the Vercel
 * AI SDK for one feature would violate the kit's no-heavy-dependencies rule.
 *
 * Scoped to the connected wallet's namespace, so the advice reflects only that
 * player's own betting history.
 */
export async function suggestStrategy(owner: string): Promise<StrategyResult> {
  if (!isValidSuiAddress(owner)) return { ok: false, error: "connect a wallet for strategy advice" };
  try {
    const memwal = getMemWal();
    const result = await memwal.recall(
      "horse race bet outcome win loss profit balance strategy",
      50,
      bettingNamespace(owner),
    );
    const outcomes = result.results
      .map((r) => parseRaceMemory(r.text))
      .filter((o): o is BetOutcome => o !== null);
    const strategy = buildStrategy(outcomes);
    return {
      ok: true,
      strategy,
      recalled: result.results.map((r) => ({ text: r.text, distance: r.distance })),
    };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "unknown error" };
  }
}
