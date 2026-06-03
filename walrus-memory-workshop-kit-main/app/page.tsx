"use client";

import { useEffect, useState, useTransition } from "react";
import { ConnectButton, useCurrentAccount } from "@mysten/dapp-kit";
import { recordRace, suggestStrategy, type StrategyResult } from "./actions";
import {
  HORSES,
  simulateRace,
  payoutMultiplier,
  type Horse,
  type RaceResult,
} from "@/lib/horses";
import type { BetOutcome } from "@/lib/raceMemory";

const STARTING_BALANCE = 1000;

type Phase = "betting" | "racing" | "result";

export default function Home() {
  const account = useCurrentAccount();
  const address = account?.address ?? null;

  const [balance, setBalance] = useState(STARTING_BALANCE);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [betAmount, setBetAmount] = useState(50);

  const [phase, setPhase] = useState<Phase>("betting");
  const [race, setRace] = useState<RaceResult | null>(null);
  const [running, setRunning] = useState(false);
  const [outcome, setOutcome] = useState<BetOutcome | null>(null);
  const [saveNote, setSaveNote] = useState<string | null>(null);

  const [strategy, setStrategy] = useState<StrategyResult | null>(null);
  const [showStrategy, setShowStrategy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [advising, startAdvise] = useTransition();
  const [saving, startSave] = useTransition();

  const selected = HORSES.find((h) => h.id === selectedId) ?? null;
  const bet = Math.min(betAmount, balance);
  const canBet =
    selected !== null && bet > 0 && bet <= balance && phase === "betting" && address !== null;

  // Switching (or disconnecting) wallets starts a fresh session — the strategy
  // advisor and history belong to whichever wallet is connected.
  useEffect(() => {
    setPhase("betting");
    setRace(null);
    setRunning(false);
    setOutcome(null);
    setSaveNote(null);
    setSelectedId(null);
    setBalance(STARTING_BALANCE);
    setStrategy(null);
    setShowStrategy(false);
  }, [address]);

  // Kick off the CSS transition one frame after the lanes mount.
  useEffect(() => {
    if (phase !== "racing") return;
    const id = setTimeout(() => setRunning(true), 50);
    return () => clearTimeout(id);
  }, [phase]);

  // Settle once the slowest horse has crossed the line.
  useEffect(() => {
    if (phase !== "racing" || !running || !race || !outcome) return;
    const longest = Math.max(...race.lineup.map((l) => l.durationMs));
    const id = setTimeout(() => {
      setBalance(outcome.balanceAfter);
      setPhase("result");
      if (!address) {
        setSaveNote("not saved — wallet disconnected");
        return;
      }
      setSaveNote("saving to walrus memory…");
      startSave(async () => {
        const res = await recordRace(address, outcome);
        setSaveNote(res.ok ? "saved to walrus memory ✓" : `save failed: ${res.error}`);
      });
    }, longest + 250);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running]);

  function handleRace() {
    if (!selected || !canBet) return;
    setError(null);
    const result = simulateRace();
    const multiplier = payoutMultiplier(selected);
    const won = result.winner.id === selected.id;
    const net = won ? Math.round(bet * (multiplier - 1)) : -bet;
    setOutcome({
      horseName: selected.name,
      speed: selected.speed,
      payout: multiplier,
      betAmount: bet,
      winnerName: result.winner.name,
      won,
      net,
      balanceAfter: balance + net,
    });
    setRace(result);
    setRunning(false);
    setSaveNote(null);
    setPhase("racing");
  }

  function handleNextRace() {
    setPhase("betting");
    setRace(null);
    setRunning(false);
    setOutcome(null);
    setSaveNote(null);
    setSelectedId(null);
  }

  function handleReset() {
    handleNextRace();
    setBalance(STARTING_BALANCE);
  }

  function clearStrategy() {
    setShowStrategy(false);
    setStrategy(null);
  }

  function handleStrategy() {
    if (!address) return;
    clearStrategy();
    setError(null);
    setShowStrategy(true);
    startAdvise(async () => {
      const res = await suggestStrategy(address);
      if (!res.ok) {
        setError(res.error);
        setStrategy(null);
        return;
      }
      setStrategy(res);
    });
  }

  const broke = balance <= 0 && phase === "betting";

  return (
    <main className="container">
      <header>
        <div className="header-row">
          <div>
            <h1>walrus memory horse derby</h1>
            <p className="sub">
              bet on a square. only speed is visible. walrus memory learns how you bet.
            </p>
            <p className="sub">
              you start with $1000. reloading resets your cash — your race history doesn&apos;t.
            </p>
          </div>
          <div className="wallet-box">
            <ConnectButton />
            {address && (
              <div className="balance-box">
                <label>balance</label>
                <div className={`balance ${balance < STARTING_BALANCE ? "down" : "up"}`}>
                  ${balance}
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {!address && (
        <section className="card connect-card">
          <h3 className="verdict">connect your slush wallet to play</h3>
          <p className="hint">
            your betting history is stored per wallet in walrus memory, so it follows you
            across sessions and devices — and stays separate from every other player&apos;s.
            connect a wallet to start betting.
          </p>
          <ConnectButton />
        </section>
      )}

      {address && (
        <>
      {/* ---- The track ---- */}
      <section className="card">
        <div className="track">
          {(race ? race.lineup : HORSES.map((h) => ({ horse: h, durationMs: 0 }))).map((lane) => {
            const h = lane.horse;
            const isSel = h.id === selectedId;
            const isWinner = phase === "result" && race?.winner.id === h.id;
            return (
              <div className="lane" key={h.id}>
                <div
                  className={`runner${isWinner ? " winner" : ""}`}
                  style={{
                    background: h.color,
                    left:
                      (phase === "racing" && running) || phase === "result"
                        ? "calc(100% - 26px)"
                        : "2px",
                    transitionDuration: `${"durationMs" in lane ? lane.durationMs : 0}ms`,
                  }}
                  aria-label={h.name}
                />
                {isSel && phase !== "result" && <span className="your-pick">your pick</span>}
                <span className="finish" />
              </div>
            );
          })}
        </div>
        {phase === "racing" && <p className="empty">and they're off…</p>}
      </section>

      {/* ---- Betting ---- */}
      {phase === "betting" && (
        <section className="card">
          <label>place your bet</label>
          {broke ? (
            <div className="facts">
              <p className="empty">you&apos;re out of money.</p>
              <button onClick={handleReset}>reset bankroll to ${STARTING_BALANCE}</button>
            </div>
          ) : (
            <>
              <div className="horse-grid">
                {HORSES.map((h) => (
                  <HorseCard
                    key={h.id}
                    horse={h}
                    selected={h.id === selectedId}
                    onSelect={() => setSelectedId(h.id)}
                  />
                ))}
              </div>
              <div className="bet-row">
                <div className="bet-amount">
                  <label htmlFor="amt">wager</label>
                  <input
                    id="amt"
                    type="number"
                    min={1}
                    max={balance}
                    value={betAmount}
                    onChange={(e) => setBetAmount(Math.max(1, Number(e.target.value) || 0))}
                  />
                  <div className="chips">
                    {[10, 50, 100].map((c) => (
                      <button
                        key={c}
                        type="button"
                        className="secondary chip"
                        onClick={() => setBetAmount(Math.min(c, balance))}
                      >
                        ${c}
                      </button>
                    ))}
                    <button
                      type="button"
                      className="secondary chip"
                      onClick={() => setBetAmount(balance)}
                    >
                      all in
                    </button>
                  </div>
                </div>
                <button onClick={handleRace} disabled={!canBet}>
                  {selected
                    ? `bet $${bet} on ${selected.name} → race`
                    : "select a horse"}
                </button>
              </div>
              <p className="hint">
                only <strong>speed</strong> is shown. endurance, temperament and luck are
                hidden — luck rolls a pre-race boost to the other stats. payouts are set
                from speed, so the favorite pays least.
              </p>
              <details className="how-it-works">
                <summary>how racing works</summary>
                <p className="hint">
                  each race, every horse gets a score and the highest wins:{" "}
                  <strong>speed×1.5 + endurance×1.2 + temperament×0.8 + a little noise</strong>.
                  luck is rolled first and can boost the other stats before scoring.
                </p>
                <ul className="how-list">
                  <li>
                    <strong>speed</strong> — visible. biggest factor, and it sets the payout
                    (fast = favorite = pays least).
                  </li>
                  <li>
                    <strong>endurance</strong> — hidden. pure power, no downside.
                  </li>
                  <li>
                    <strong>temperament</strong> — hidden. high = consistent finishes, low =
                    wild swings (can upset or flop).
                  </li>
                  <li>
                    <strong>luck</strong> — hidden. each race, every other stat has a luck-in-10
                    chance to gain +2 to +4 for that race only.
                  </li>
                </ul>
              </details>
            </>
          )}
        </section>
      )}

      {/* ---- Result ---- */}
      {phase === "result" && outcome && race && (
        <section className="card">
          <h3 className={outcome.won ? "verdict win" : "verdict loss"}>
            {outcome.won
              ? `you won ${money(outcome.net)} — ${outcome.horseName} came home!`
              : `you lost $${Math.abs(outcome.net)} — ${outcome.winnerName} took it.`}
          </h3>
          <p className="hint">{saveNote}</p>

          <div className="facts">
            <h3>final stats (hidden until now)</h3>
            <p className="hint">
              spd = speed, end = endurance, tmp = temperament, lck = luck. a green +n is a
              luck boost applied for this race only.
            </p>
            <div className="reveal-grid">
              {race.finishOrder.map((l) => (
                <div
                  key={l.horse.id}
                  className={`reveal-row${l.horse.id === outcome.horseName.toLowerCase() ? " mine" : ""}`}
                >
                  <span className="place">{ordinal(l.place)}</span>
                  <span className="swatch" style={{ background: l.horse.color }} />
                  <span className="rname">{l.horse.name}</span>
                  <span className="stat">
                    spd {l.effective.speed}
                    {l.boosts.speed ? <em> (+{l.boosts.speed})</em> : null}
                  </span>
                  <span className="stat">
                    end {l.effective.endurance}
                    {l.boosts.endurance ? <em> (+{l.boosts.endurance})</em> : null}
                  </span>
                  <span className="stat">
                    tmp {l.effective.temperament}
                    {l.boosts.temperament ? <em> (+{l.boosts.temperament})</em> : null}
                  </span>
                  <span className="stat luck">lck {l.horse.luck}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="button-row">
            <button onClick={handleNextRace}>next race</button>
            <button className="secondary" onClick={handleReset}>
              reset bankroll
            </button>
          </div>
        </section>
      )}

      {/* ---- Strategy advisor (recall) ---- */}
      <section className="card">
        <label>walrus memory strategy advisor</label>
        <p className="hint">
          recall() pulls your full betting history out of walrus memory and looks for
          patterns — which colors pay off, whether you do better on favorites or underdogs,
          how you size your bets.
        </p>
        <div className="button-row">
          <button onClick={handleStrategy} disabled={advising}>
            {advising ? "thinking…" : "suggest a betting strategy"}
          </button>
          {showStrategy && (
            <button className="secondary" onClick={clearStrategy}>
              clear
            </button>
          )}
        </div>

        {showStrategy && strategy?.ok && (
          <div className="facts">
            <h3>advice</h3>
            <ul>
              {strategy.strategy.advice.map((a, i) => (
                <li key={i} className="saved">
                  {a}
                </li>
              ))}
            </ul>
            {strategy.recalled.length > 0 && (
              <>
                <h3 style={{ marginTop: 16 }}>
                  recalled memories ({strategy.recalled.length})
                </h3>
                <ul className="results">
                  {strategy.recalled.map((m, i) => (
                    <li key={i}>
                      <span className="dist">d={m.distance.toFixed(2)}</span>
                      <span>{m.text}</span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        )}
      </section>
        </>
      )}

      {error && <div className="error">{error}</div>}
    </main>
  );
}

function HorseCard({
  horse,
  selected,
  onSelect,
}: {
  horse: Horse;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      className={`horse-card${selected ? " selected" : ""}`}
      onClick={onSelect}
    >
      <span className="swatch big" style={{ background: horse.color }} />
      <span className="rname">{horse.name}</span>
      <span className="stat">speed {horse.speed}</span>
      <span className="stat muted">pays {payoutMultiplier(horse)}x</span>
    </button>
  );
}

function ordinal(n: number): string {
  return ["1st", "2nd", "3rd", "4th", "5th"][n - 1] ?? `${n}th`;
}

function money(n: number): string {
  return `${n >= 0 ? "+" : "-"}$${Math.abs(n)}`;
}
