// Pure horse-derby game logic. No Walrus Memory, no React — just the simulation.
// Kept separate from the UI (app/page.tsx) and the memory I/O (app/actions.ts) so
// each layer stays small and testable, mirroring the kit's existing separation.

export type StatKey = "speed" | "endurance" | "temperament" | "luck";

export type Horse = {
  id: string; // stable key, e.g. "red"
  name: string; // display name, e.g. "RED"
  color: string; // hex for the racing square
  speed: number; // VISIBLE — the only stat you see before betting
  endurance: number; // hidden until the results reveal
  temperament: number; // hidden
  luck: number; // hidden — rolls pre-race boosts to the other stats
};

// Fixed roster with fixed hidden stats. The whole point of the Walrus Memory
// integration is that you LEARN the hidden stats across races/sessions — e.g.
// PURPLE looks slow (speed 4) but its endurance + temperament make it a value
// pick. A stable roster makes that cross-session learning meaningful.
export const HORSES: Horse[] = [
  { id: "red", name: "RED", color: "#f87171", speed: 8, endurance: 4, temperament: 5, luck: 3 },
  { id: "yellow", name: "YELLOW", color: "#facc15", speed: 7, endurance: 5, temperament: 4, luck: 5 },
  { id: "blue", name: "BLUE", color: "#60a5fa", speed: 6, endurance: 8, temperament: 7, luck: 4 },
  { id: "green", name: "GREEN", color: "#4ade80", speed: 5, endurance: 7, temperament: 6, luck: 7 },
  { id: "purple", name: "PURPLE", color: "#c084fc", speed: 4, endurance: 9, temperament: 8, luck: 6 },
];

const BOOSTABLE: Exclude<StatKey, "luck">[] = ["speed", "endurance", "temperament"];

export type RaceHorseResult = {
  horse: Horse;
  /** Per-race luck boosts applied to the other stats (empty if luck didn't fire). */
  boosts: Partial<Record<Exclude<StatKey, "luck">, number>>;
  effective: { speed: number; endurance: number; temperament: number };
  performance: number;
  /** Animation duration in ms — the winner gets the shortest. */
  durationMs: number;
  place: number; // 1 = winner
};

export type RaceResult = {
  lineup: RaceHorseResult[]; // original roster order (for stable lane rendering)
  finishOrder: RaceHorseResult[]; // sorted by place
  winner: Horse;
};

const MIN_DUR = 2200;
const MAX_DUR = 3600;

/**
 * Simulate one race.
 *
 * 1. Luck check per horse: higher luck → more likely to boost the other stats,
 *    for this race only.
 * 2. Performance = weighted sum of effective stats + noise. Temperament both
 *    raises the score AND tightens the noise spread (consistency), so a calm
 *    horse is more predictable. Speed matters most but does NOT dominate —
 *    that's what keeps the hidden stats (and the memory-driven strategy) worth
 *    learning.
 */
export function simulateRace(): RaceResult {
  const raw = HORSES.map((horse) => {
    const boosts: Partial<Record<Exclude<StatKey, "luck">, number>> = {};
    for (const stat of BOOSTABLE) {
      // Probability of a boost scales with luck (luck 7 → ~70% chance per stat).
      if (Math.random() * 10 < horse.luck) {
        boosts[stat] = 2 + Math.floor(Math.random() * 3); // +2..+4
      }
    }
    const effective = {
      speed: horse.speed + (boosts.speed ?? 0),
      endurance: horse.endurance + (boosts.endurance ?? 0),
      temperament: horse.temperament + (boosts.temperament ?? 0),
    };
    const spread = Math.max(1, 11 - effective.temperament);
    const noise = Math.random() * spread;
    const performance =
      effective.speed * 1.5 + effective.endurance * 1.2 + effective.temperament * 0.8 + noise;
    return { horse, boosts, effective, performance };
  });

  const ranked = [...raw].sort((a, b) => b.performance - a.performance);
  const maxP = ranked[0].performance;
  const minP = ranked[ranked.length - 1].performance;

  const lineup: RaceHorseResult[] = raw.map((r) => {
    // Map performance → duration so the finish animation matches the result.
    const t = maxP === minP ? 1 : (r.performance - minP) / (maxP - minP);
    const durationMs = Math.round(MAX_DUR - t * (MAX_DUR - MIN_DUR));
    const place = ranked.indexOf(r) + 1;
    return { ...r, durationMs, place };
  });

  const finishOrder = [...lineup].sort((a, b) => a.place - b.place);
  return { lineup, finishOrder, winner: finishOrder[0].horse };
}

/** Average visible speed across the roster — the favorite/underdog dividing line. */
export const AVG_SPEED =
  HORSES.reduce((sum, h) => sum + h.speed, 0) / HORSES.length;

/**
 * Payout multiplier derived from the ONLY visible stat (speed). Faster horse =
 * shorter odds (favorite). `multiplier` is the total return per $1 staked, so
 * net profit on a win is `bet * (multiplier - 1)`. Includes a small house edge.
 */
export function payoutMultiplier(horse: Horse): number {
  const totalSpeed = HORSES.reduce((sum, h) => sum + h.speed, 0);
  const fair = totalSpeed / horse.speed; // implied-odds inverse
  const withEdge = fair * 0.85;
  return Math.max(1.2, Math.round(withEdge * 10) / 10);
}
