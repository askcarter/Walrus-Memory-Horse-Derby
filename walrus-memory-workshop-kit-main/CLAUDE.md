# Project context for Claude Code

This is the **Walrus Memory Workshop Kit** — a minimal Next.js starter that workshop
participants fork to learn how to build on top of Walrus Memory (a privacy-first AI
memory layer for Sui + Walrus).

## Naming note — important

This product was previously called **MemWal** and is now called **Walrus Memory**.
The rebrand is in progress: all user-facing prose in this repo uses *Walrus Memory*,
but the technical identifiers in the SDK and infrastructure haven't been renamed
yet, so the code still refers to "MemWal":

- npm package: `@mysten-incubation/memwal`
- exported class: `MemWal` (e.g. `MemWal.create({ ... })`)
- env vars: `MEMWAL_PRIVATE_KEY`, `MEMWAL_ACCOUNT_ID`, `MEMWAL_SERVER_URL`
- URLs: `memwal.ai`, `staging.memwal.ai`, `relayer.memwal.ai`, `docs.memwal.ai`
- on-chain Move struct: `MemWalAccount`
- internal file paths: `lib/memwal.ts`

**Treat `MemWal` and `Walrus Memory` as the same product.** Use *Walrus Memory* in
any new prose, UI text, comments-about-the-product, and documentation. Leave the
technical identifiers (imports, class names, env vars, URLs, file paths) exactly
as they are — renaming them would break the SDK install and the live endpoints.

## Read first

**`SKILL.md`** in the repo root is the canonical Walrus Memory SDK reference. Read it
before doing any Walrus Memory-related work — it covers installation, the SDK entry
points, the `remember` / `recall` / `analyze` API surface, configuration, and
common troubleshooting.

It is a snapshot of https://github.com/MystenLabs/MemWal/blob/main/SKILL.md —
if anything looks stale, that upstream version is the source of truth.

## What participants will do

Participants start on `main` (the working reading-tracker app), then build one
of the extensions on a feature branch using you (Claude Code) + the SDK skill
file. Completed reference implementations live on `extension/*` branches but
participants should not look at those until they're done.

## Project conventions

- TypeScript everywhere. `tsx` files for React, `ts` files for everything else.
- Server actions in `app/actions.ts` — anything that calls Walrus Memory stays
  server-side so the delegate private key never reaches the browser.
- One Walrus Memory client instance, cached in `lib/memwal.ts`. Read env once.
- Default namespace for the base app is `reading-tracker`. Extensions may
  introduce new namespaces; they should not change the default.
- Vanilla CSS in `app/globals.css`. No Tailwind, no UI framework — keep the
  surface area small so the Walrus Memory mechanics are the focus.
- Use `analyzeAndWait()` / `rememberAndWait()` for any save+recall flow in
  the same user interaction. The fire-and-forget variants will trip the
  indexer-lag window and look broken.

## What NOT to do

- Do not put the delegate private key in client code.
- Do not commit credentials to `.env.example` — that file is a template.
  Real values go in `.env.local` (gitignored).
- Do not introduce a database, auth layer, or third-party storage. The kit
  is intentionally Walrus Memory-only.
- Do not add heavy dependencies. The current footprint is Next + React + the
  Walrus Memory SDK + two tiny noble crypto libs for the verify script. Keep
  it there unless an extension genuinely needs more.
