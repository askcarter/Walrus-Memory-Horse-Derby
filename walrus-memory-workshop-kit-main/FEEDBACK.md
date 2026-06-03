# Feedback Log

Your AI assistant has been instructed to log friction here as it works on
the extension. Add your own observations too — anything that surprised you,
slowed you down, or felt awkward.

**The Walrus Memory team reads this file after the workshop.** Specific is better
than polite. Mild observations are still useful — log them.

---

## How to log an entry

Each entry has four short lines. Bullet points are fine; full sentences
aren't required.

- **Where it hit:** The moment, file, or command where you ran into it.
- **What was missing:** What didn't `SKILL.md`, `CLAUDE.md`, or the docs
  tell you that you needed to know?
- **What you did instead:** Where did the answer actually come from —
  Claude/your AI, the Sui docs, the SDK source, trial and error?
- **Workshop impact:** If the next participant hits this, would it block
  them? Confuse them? Be a minor annoyance?

---

## What counts as "worth logging"

- Something in `SKILL.md` that was ambiguous, missing, or wrong
- An SDK call that returned a shape you weren't expecting
- A dashboard step that wasn't obvious
- A naming choice that confused you
- A workflow that took more steps than you expected
- An error message that didn't help you understand what was wrong
- Anywhere your AI had to fill a gap by reading source or external docs

If in doubt, log it.

---

## SDK & docs gaps

**Where it hit:** `app/actions.ts` — wiring `recall(query, limit?, namespace?)`.
**What was missing:** SKILL.md documents the parameter signature in the API table but gives no example of passing all three arguments. The order (query, limit, namespace) has to be inferred from the table alone. An example like `memwal.recall("query", 10, "books")` would remove any ambiguity.
**What you did instead:** Inferred from the table; no external docs needed.
**Workshop impact:** Minor — the table is clear enough, but a one-liner example would speed things up.

---

**Where it hit:** `lib/memwal.ts` — constructor-level `namespace: "reading-tracker"`.
**What was missing:** CLAUDE.md says "extensions may introduce new namespaces; they should not change the default," but doesn't clarify whether the constructor-level default is superseded when every call passes an explicit namespace override. It's implicit in how the SDK works (per-call wins), but it's not stated.
**What you did instead:** Left the constructor default untouched as a safe no-op; relied on per-call override for all action calls.
**Workshop impact:** Could confuse participants who try to find where to "set" the active namespace — they might change the constructor rather than passing it at the call site.

---

**Where it hit:** `app/page.tsx` — choosing the initial selected namespace.
**What was missing:** CLAUDE.md doesn't specify which namespace should be pre-selected when the dropdown first renders. The three choices are `books`, `articles`, `papers`.
**What you did instead:** Defaulted to `"books"` (first in the list). Purely a judgment call.
**Workshop impact:** No functional impact; participants will want a stated convention so their demos look consistent.

---

**Where it hit:** `lib/raceMemory.ts` — storing structured race records (bet, horse, winner, profit, balance).
**What was missing:** A memory is plain text only — SKILL.md shows no structured/metadata field on `remember()`. To run analytics over past races (win rate, net P/L, per-color profit) I had to encode a fixed sentence shape and regex it back out on recall. There's no documented "store a JSON payload" path.
**What you did instead:** Wrote a matched `formatRaceMemory()` / `parseRaceMemory()` pair with a brittle regex contract. Works, but any wording change silently breaks parsing.
**Workshop impact:** Could block participants building anything analytics-shaped on top of memories. A note in SKILL.md ("memories are text; embed your own structure if you need to parse them back") would set expectations.

---

**Where it hit:** `app/actions.ts` — the "suggest a betting strategy" feature.
**What was missing:** SKILL.md's API surface is `remember`/`recall`/`analyze` plus the Vercel AI middleware. There's no general LLM/completion endpoint, so "use my history to suggest a strategy" can't be answered by the SDK directly — your options are (a) write the reasoning yourself or (b) add `ai` + a model provider SDK + an API key.
**What you did instead:** Wrote a transparent heuristic (`buildStrategy()`) over the recalled records, since CLAUDE.md forbids heavy dependencies. The "advice" is hand-rolled aggregation, not an LLM.
**Workshop impact:** Confusing for participants who expect "AI memory" to imply "the SDK reasons over my memories." Worth stating that recall returns rows and any synthesis is on you (unless you adopt the AI middleware).

---

**Where it hit:** `lib/memwal.ts` / `lib/namespaces.ts` — converting the base app's namespace.
**What was missing:** CLAUDE.md says "extensions may introduce new namespaces; they should not change the default [`reading-tracker`]." It doesn't address a *full conversion* of the base app (not an extension), where keeping `reading-tracker` for horse-betting data would be actively misleading.
**What you did instead:** Treated the guardrail as scoped to extensions and changed the default to `betting-history`, collapsing the books/articles/papers picker to a single namespace.
**Workshop impact:** Minor for this task, but the guardrail's wording implies the default is sacred — a participant doing a clean conversion might leave a mismatched namespace out of caution.

---

**Where it hit:** `app/actions.ts` — choosing `remember()` vs `analyze()` for each race.
**What was missing:** SKILL.md explains *what* each verb does but gives no guidance on *when* to prefer one. For a structured, atomic record I wanted it kept intact; `analyze()` would canonicalize and split it into disconnected facts.
**What you did instead:** Used `remember()` for the per-race record. Inferred from the verb descriptions, not from explicit guidance.
**Workshop impact:** Minor — a one-line rule of thumb ("remember() for records you'll parse; analyze() for free prose you'll query by meaning") would remove the guesswork.



## SDK & UX surprises

<!-- Behaviors that were correct but surprising — recall behavior, response shapes, naming, etc. -->

**Where it hit:** `app/actions.ts` — `suggestStrategy()` wanting the *full* betting history.
**What was missing:** `recall()` returns the top-K nearest memories by cosine distance — it's semantic search, not "list everything in this namespace." The base reading-tracker even filters at distance < 0.7. For analytics I needed every race, not the closest few, and there's no documented "fetch all" call (`restore()` returns counts, not contents).
**What you did instead:** Used a generic query every race record is near, bumped the limit to 50, and deliberately dropped the distance filter so older races aren't pruned. Fine at workshop scale; at large history it would silently truncate.
**Workshop impact:** A real gotcha. Anyone treating memory as a database and iterating "all my entries" will hit this. Worth calling out that recall is ranked + bounded, and noting the right pattern for exhaustive reads.

---

**Where it hit:** `app/actions.ts` — `recordRace()` calling `rememberAndWait()` after a race.
**What was missing:** SKILL.md says the `*AndWait()` variants "block until the memory is durable" but gives no sense of *how long* that is. An observed call took **~24.6s** to return (`POST / 200 in 24.6s … recordRace(…) in 24623ms`) — that's the relayer doing SEAL encryption + Walrus upload synchronously. Nothing warns you a durable write is tens of seconds, not the sub-second you'd assume.
**What you did instead:** The UI already shows a "saving to walrus memory…" note and stays interactive (you can start the next race while it saves), so it degrades gracefully — but only because we happened to design for async. A naive blocking spinner would look hung.
**Workshop impact:** Significant. Participants will think their app froze. SKILL.md should state a rough latency range for `rememberAndWait()`/`analyzeAndWait()` and recommend an optimistic-UI or fire-and-forget-with-status pattern. (Note: latency may also be variable — worth measuring a few calls.)

## Dashboard & onboarding

<!-- Anything from staging.memwal.ai sign-in through the first successful remember/recall -->

## AI assistant friction

<!-- Places where your AI got stuck, confused, or made the wrong call -->

## What worked well

<!-- One or two things that genuinely felt good. Positive signal is useful too. -->

## One thing I'd change

<!-- If you could change one thing about Walrus Memory or this kit, what is it? -->
