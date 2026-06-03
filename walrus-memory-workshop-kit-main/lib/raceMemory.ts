// The schema for what we store in Walrus Memory, plus the heuristics that turn
// recalled history into betting advice.
//
// Walrus Memory stores PLAIN TEXT — there's no structured/metadata field on a
// memory. So to do analytics over past races we embed a fixed, parseable shape
// in the remembered sentence and re-parse it on recall. format/parse are a
// matched pair; keep them in sync.

import { AVG_SPEED } from "@/lib/horses";

export type BetOutcome = {
  horseName: string;
  speed: number;
  payout: number;
  betAmount: number;
  winnerName: string;
  won: boolean;
  net: number; // signed: profit on a win, negative stake on a loss
  balanceAfter: number;
};

function money(n: number): string {
  return `${n >= 0 ? "+" : "-"}$${Math.abs(n)}`;
}

/** One human-readable, machine-parseable line per race. */
export function formatRaceMemory(o: BetOutcome): string {
  const result = o.won ? "WIN" : "LOSS";
  return (
    `Race result: bet $${o.betAmount} on ${o.horseName} ` +
    `(speed ${o.speed}, payout ${o.payout}x). ` +
    `Winner: ${o.winnerName}. Outcome: ${result}, net ${money(o.net)}. ` +
    `Balance after: $${o.balanceAfter}.`
  );
}

const RACE_RE =
  /bet \$(\d+) on ([A-Z]+) \(speed (\d+), payout ([\d.]+)x\)\. Winner: ([A-Z]+)\. Outcome: (WIN|LOSS), net ([+-])\$(\d+)\. Balance after: \$(\d+)/;

export function parseRaceMemory(text: string): BetOutcome | null {
  const m = text.match(RACE_RE);
  if (!m) return null;
  return {
    betAmount: Number(m[1]),
    horseName: m[2],
    speed: Number(m[3]),
    payout: Number(m[4]),
    winnerName: m[5],
    won: m[6] === "WIN",
    net: (m[7] === "-" ? -1 : 1) * Number(m[8]),
    balanceAfter: Number(m[9]),
  };
}

export type Strategy = {
  totalRaces: number;
  wins: number;
  winRate: number; // 0..1
  net: number;
  bestColor?: { name: string; net: number; bets: number };
  advice: string[];
};

function avg(nums: number[]): number {
  if (nums.length === 0) return 0;
  return Math.round(nums.reduce((a, b) => a + b, 0) / nums.length);
}

/** Aggregate parsed race history into a few concrete, transparent suggestions. */
export function buildStrategy(outcomes: BetOutcome[]): Strategy {
  const totalRaces = outcomes.length;
  if (totalRaces === 0) {
    return {
      totalRaces: 0,
      wins: 0,
      winRate: 0,
      net: 0,
      advice: ["No betting history yet — play a few races, then ask again."],
    };
  }

  const wins = outcomes.filter((o) => o.won).length;
  const winRate = wins / totalRaces;
  const net = outcomes.reduce((s, o) => s + o.net, 0);

  // Net P/L per horse you backed.
  const byColor = new Map<string, { net: number; bets: number; wins: number }>();
  for (const o of outcomes) {
    const cur = byColor.get(o.horseName) ?? { net: 0, bets: 0, wins: 0 };
    cur.net += o.net;
    cur.bets += 1;
    if (o.won) cur.wins += 1;
    byColor.set(o.horseName, cur);
  }
  let bestColor: Strategy["bestColor"];
  for (const [name, s] of byColor) {
    if (!bestColor || s.net > bestColor.net) bestColor = { name, net: s.net, bets: s.bets };
  }

  // Favorites (visible speed at/above roster average) vs underdogs.
  const favNet = outcomes.filter((o) => o.speed >= AVG_SPEED).reduce((s, o) => s + o.net, 0);
  const dogNet = outcomes.filter((o) => o.speed < AVG_SPEED).reduce((s, o) => s + o.net, 0);
  const sawFav = outcomes.some((o) => o.speed >= AVG_SPEED);
  const sawDog = outcomes.some((o) => o.speed < AVG_SPEED);

  const winBets = outcomes.filter((o) => o.won).map((o) => o.betAmount);
  const lossBets = outcomes.filter((o) => !o.won).map((o) => o.betAmount);

  const advice: string[] = [];
  advice.push(
    `${totalRaces} races on record: ${wins} wins (${Math.round(winRate * 100)}%), net ${money(net)}.`,
  );

  if (bestColor && bestColor.bets >= 2) {
    advice.push(
      `Your most profitable pick is ${bestColor.name} (net ${money(bestColor.net)} across ${bestColor.bets} bets).`,
    );
  }

  if (sawFav && sawDog) {
    if (dogNet > favNet) {
      advice.push(
        `Underdogs (speed < ${AVG_SPEED.toFixed(0)}) have out-earned favorites for you: ` +
          `${money(dogNet)} vs ${money(favNet)}. The visible speed stat isn't the whole story — hidden stats matter.`,
      );
    } else {
      advice.push(
        `Favorites (speed ≥ ${AVG_SPEED.toFixed(0)}) have paid off better: ` +
          `${money(favNet)} vs ${money(dogNet)} on underdogs.`,
      );
    }
  }

  if (winBets.length > 0 && lossBets.length > 0 && avg(lossBets) > avg(winBets)) {
    advice.push(
      `You stake more on losses ($${avg(lossBets)} avg) than wins ($${avg(winBets)} avg) — ` +
        `consider sizing down on uncertain picks.`,
    );
  }

  if (winRate < 0.34 && totalRaces >= 3) {
    advice.push(
      `Win rate is low — with five horses, backing your best color more consistently may help.`,
    );
  }

  return { totalRaces, wins, winRate, net, bestColor, advice };
}
