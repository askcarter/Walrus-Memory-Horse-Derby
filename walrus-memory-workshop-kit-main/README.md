# Walrus Memory Workshop Kit — Horse Derby

A minimal Next.js betting game that exercises the core Walrus Memory surface:

- `remember()` — store each finished race (your bet, the winner, your profit/loss) as a memory
- `recall()` — pull your full betting history back out to suggest a strategy

Five colored-square horses race across a track. Each has four stats — but only
**speed** is visible when you bet. Endurance, temperament and luck are hidden;
luck rolls a pre-race boost to the other stats. Every race you bet is written to
Walrus Memory, and the **strategy advisor** recalls that history to spot patterns
(which colors pay off, favorites vs. underdogs, how you size your bets).

Connect a **Slush wallet** to play: each player's history is scoped to their own
wallet address (`betting-history:<0x…>`), so it persists across sessions and
devices and stays separate from every other player's. No database. The only
"auth" is the wallet connection itself.

## What Walrus Memory is

Walrus Memory is a privacy-first AI memory layer for Sui + Walrus.
See https://docs.memwal.ai and the SDK at https://www.npmjs.com/package/@mysten-incubation/memwal.

## Using Claude Code in this repo

Two files at the repo root are written for AI assistants:

- **`SKILL.md`** — a self-contained Walrus Memory SDK reference (installation, API surface,
  troubleshooting). Snapshot of https://github.com/MystenLabs/MemWal/blob/main/SKILL.md.
- **`CLAUDE.md`** — project conventions and guardrails for Claude Code.

Both are picked up automatically by Claude Code. If you're using a different AI
tool, paste `SKILL.md` into context before asking it to write Walrus Memory code.

## Prerequisites

- Node.js 18+ (22 recommended — matches the rest of the monorepo)
- pnpm
- A Walrus Memory account + a delegate key
- A **Slush wallet** (browser extension) to connect and play. Any Sui account
  works — the app only reads its address, so no testnet SUI or gas is needed.

## Setup

1. **Get credentials.** Sign in at one of:
   - Production (mainnet): https://memwal.ai
   - Staging (testnet): https://staging.memwal.ai

   Copy your **delegate private key** and your **account ID**.

2. **Configure.**
   ```bash
   cp .env.example .env.local
   ```
   Fill in `MEMWAL_PRIVATE_KEY` (the delegate **private** key shown in the
   dashboard — *not* the public key) and `MEMWAL_ACCOUNT_ID`. If you used
   staging, also set `MEMWAL_SERVER_URL=https://relayer.staging.memwal.ai`.

   You can sanity-check your env before starting the dev server:
   ```bash
   pnpm verify
   ```
   This derives the public key from `MEMWAL_PRIVATE_KEY` and prints it so
   you can compare against the dashboard.

3. **Install + run.**
   ```bash
   pnpm install
   pnpm dev
   ```
   Open http://localhost:3000.

## How to use

- **Connect your Slush wallet** (top-right). The game is gated until a wallet is
  connected — every recorded race is owned by a wallet address. The connection
  auto-reconnects on reload, and switching wallets starts a fresh session bound
  to that wallet's history.
- Pick one of the five horses in the **place your bet** card (you only see each
  horse's speed and its payout), set a wager, and hit race. The squares run; the
  winner is decided by the hidden stats plus luck.
- When the race settles, the result is written to Walrus Memory with
  `remember()` and the full (previously hidden) stats are revealed.
- Hit **suggest a betting strategy** any time. `recall()` pulls your betting
  history out of the `betting-history` namespace and the advisor aggregates it
  into concrete tips, showing the recalled memories with their distance scores.

## How a race is decided

Each horse has four stats (1–10). Every race, each horse gets a **performance
score**, and the highest score wins — the finish order and the on-screen running
speed both follow the scores:

```
performance = speed×1.5 + endurance×1.2 + temperament×0.8 + noise
```

| Stat | Visible when betting? | What it does |
|---|---|---|
| **Speed** | ✅ yes | Heaviest weight (×1.5). Also sets the **odds**: payout ≈ (total speed ÷ this horse's speed) × 0.85, min 1.2× — so the fastest horse is the favorite and pays the least. |
| **Endurance** | ❌ hidden | Second weight (×1.2). Pure power, no downside. |
| **Temperament** | ❌ hidden | Small direct weight (×0.8), but it's the **consistency** knob: race noise is `random(0 … 11 − temperament)`. High temperament → small swing (reliable); low → up to ~+10 swing (volatile — can upset or flop). |
| **Luck** | ❌ hidden | Doesn't score directly. Each race, every *other* stat has a `luck ÷ 10` chance to gain a temporary **+2 to +4** for that race only. |

Because only **speed** is visible when you bet, a horse with mediocre speed but
strong hidden stats is a long-odds value pick — and only your stored history
reveals which horses keep beating their odds. That's the whole point of the
**strategy advisor**. The full stats (and any luck boosts) are revealed after
each race. The simulation lives in `lib/horses.ts`.

## What's wired

| Surface | File |
|---|---|
| Walrus Memory client (cached per process) | `lib/memwal.ts` |
| Per-wallet namespace helper | `lib/namespaces.ts` |
| Game logic (roster, race sim, odds) | `lib/horses.ts` |
| Memory record schema + strategy heuristics | `lib/raceMemory.ts` |
| Server actions (`recordRace`, `suggestStrategy`) | `app/actions.ts` |
| Wallet providers (dapp-kit) | `app/providers.tsx` |
| UI (one client component) | `app/page.tsx` |
| Env sanity-check script | `verify.ts` |

## Notes

- Memories are namespaced **per wallet** as `betting-history:<address>`
  (`lib/namespaces.ts`). The connected wallet's Sui address is validated
  server-side before it's used as a namespace.
- Wallet connection uses `@mysten/dapp-kit`. This app makes **no Sui RPC calls** —
  it only reads the connected address — so dapp-kit's `SuiClientProvider` holds a
  dormant client that's never exercised (see `app/providers.tsx`).
- Saving uses `rememberAndWait()`, which blocks until the race record is durable.
  This avoids the ~3s indexer-lag window where a freshly-stored memory isn't yet
  recallable, so the strategy advisor sees it immediately.
- Your **bankroll** ($1000) lives in the browser and resets on reload — only your
  *betting history* is persisted to Walrus Memory. That's the point: the memory
  layer remembers how you bet, not your current chip stack.
- The delegate key lives in `.env.local` and stays server-side. Server actions
  call Walrus Memory; the browser only sees plaintext results.
