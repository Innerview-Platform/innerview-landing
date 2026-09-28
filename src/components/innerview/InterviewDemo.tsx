import { useEffect, useRef, useState } from "react";
import camInterviewer from "@/assets/cam-interviewer.jpg";
import camCandidate from "@/assets/cam-candidate.jpg";

type Tok = [string, string];
const K = "text-primary";
const F = "text-accent";
const N = "text-success";
const P = "text-foreground/85";
const C = "text-muted-foreground italic";

const CODE: Tok[][] = [
  [["def ", K], ["merge", F], ["(intervals):", P]],
  [["    # sort by start, then sweep", C]],
  [["    intervals.", P], ["sort", F], ["(key=", P], ["lambda ", K], ["x: x[", P], ["0", N], ["])", P]],
  [["    out = [intervals[", P], ["0", N], ["]]", P]],
  [["    for ", K], ["s, e ", P], ["in ", K], ["intervals[", P], ["1", N], [":]:", P]],
  [["        if ", K], ["s <= out[-", P], ["1", N], ["][", P], ["1", N], ["]:", P]],
  [["            out[-", P], ["1", N], ["][", P], ["1", N], ["] = ", P], ["max", F], ["(out[-", P], ["1", N], ["][", P], ["1", N], ["], e)", P]],
  [["        else", K], [":", P]],
  [["            out.", P], ["append", F], ["([s, e])", P]],
  [["    return ", K], ["out", P]],
];
const TOTAL = CODE.flat().reduce((n, [t]) => n + t.length, 0);

const TESTS = [
  { input: "[[1,3],[2,6],[8,10],[15,18]]", out: "[[1,6],[8,10],[15,18]]", ms: 3 },
  { input: "[[1,4],[4,5]]", out: "[[1,5]]", ms: 1 },
  { input: "[[1,4],[0,4]]", out: "[[0,4]]", ms: 1 },
  { input: "10⁴ random intervals", out: "✓ matches reference", ms: 18 },
];

const CHAT = [
  { who: "Daniel", text: "Take your time — talk me through the approach first." },
  { who: "You", text: "Sort by start, then merge anything that overlaps the last one." },
  { who: "Daniel", text: "Nice. What's the complexity?" },
  { who: "You", text: "O(n log n) for the sort, O(n) for the sweep." },
];

export function InterviewDemo() {
  const root = useRef<HTMLDivElement>(null);
  const [started, setStarted] = useState(false);
  const [typed, setTyped] = useState(0);
  const [tests, setTests] = useState<number>(-1); // index of last finished test
  const [running, setRunning] = useState(false);
  const [tab, setTab] = useState<"code" | "canvas">("code");
  const [secs, setSecs] = useState(24 * 60 + 12);
  const [chat, setChat] = useState(0);

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => e.isIntersecting && setStarted(true), { threshold: 0.35 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!started) return;
    const t = setInterval(() => setSecs((s) => s + 1), 1000);
    const c = setInterval(() => setChat((n) => Math.min(CHAT.length, n + 1)), 2600);
    return () => {
      clearInterval(t);
      clearInterval(c);
    };
  }, [started]);

  useEffect(() => {
    if (!started || typed >= TOTAL) return;
    const t = setTimeout(() => setTyped((n) => n + 2), 28);
    return () => clearTimeout(t);
  }, [started, typed]);

  const run = () => {
    setRunning(true);
    setTests(-1);
    TESTS.forEach((_, i) => setTimeout(() => setTests(i), 500 + i * 450));
    setTimeout(() => setRunning(false), 500 + TESTS.length * 450);
  };

  useEffect(() => {
    if (typed >= TOTAL) {
      const t = setTimeout(run, 500);
      return () => clearTimeout(t);
    }
  }, [typed]);

  // Show the shared canvas briefly while the candidate explains
  useEffect(() => {
    if (chat === 1) setTab("canvas");
    if (chat === 3) setTab("code");
  }, [chat]);

  let budget = typed;
  const mm = Math.floor(secs / 60);
  const ss = (secs % 60).toString().padStart(2, "0");

  return (
    <div
      ref={root}
      className="mx-auto w-full max-w-[1400px] overflow-hidden rounded-xl border border-border bg-panel shadow-[0_40px_120px_-40px_oklch(0.8_0.14_70/0.25)]"
    >
      {/* Top bar */}
      <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2.5 sm:px-4">
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          <span className="font-display text-xl italic text-primary">Innerview</span>
          <span className="hidden truncate text-xs text-muted-foreground md:inline">
            Senior Backend Engineer · Round 2
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-2 font-mono text-[10px] sm:gap-4 sm:text-xs">
          <span className="flex items-center gap-1.5 text-destructive">
            <span className="h-2 w-2 animate-pulse rounded-full bg-destructive" /> REC
          </span>
          <span className="text-muted-foreground">
            {mm}:{ss}
          </span>
          <button className="min-h-9 rounded-md bg-destructive/15 px-2 py-1 text-destructive sm:px-3">End</button>
        </div>
      </div>

      <div className="grid min-h-[640px] grid-cols-1 lg:grid-cols-[300px_1fr_320px]">
        {/* Problem */}
        <aside className="border-b border-border p-4 sm:p-5 lg:border-b-0 lg:border-r">
          <div className="mb-2 flex items-center gap-2">
            <span className="rounded bg-primary/15 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-primary">
              Medium
            </span>
            <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Arrays · Sorting</span>
          </div>
          <h3 className="font-display text-3xl">Merge Intervals</h3>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            Given an array of <code className="font-mono text-foreground">intervals</code> where{" "}
            <code className="font-mono text-foreground">intervals[i] = [start, end]</code>, merge all overlapping
            intervals and return an array of the non-overlapping intervals that cover all the input.
          </p>
          <div className="mt-5 rounded-md border border-border bg-background/60 p-3 font-mono text-xs leading-6">
            <div className="text-muted-foreground">Input</div>
            <div>[[1,3],[2,6],[8,10],[15,18]]</div>
            <div className="mt-1 text-muted-foreground">Output</div>
            <div className="text-success">[[1,6],[8,10],[15,18]]</div>
          </div>
          <ul className="mt-5 space-y-1.5 text-xs text-muted-foreground">
            <li>· 1 ≤ intervals.length ≤ 10⁴</li>
            <li>· 0 ≤ start ≤ end ≤ 10⁴</li>
          </ul>
        </aside>

        {/* Editor / Canvas */}
        <section className="flex min-w-0 flex-col border-b border-border lg:border-b-0 lg:border-r">
          <div className="flex items-center justify-between border-b border-border px-3">
            <div className="flex min-w-0">
              {(["code", "canvas"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`min-h-10 border-b-2 px-2 py-2.5 font-mono text-[10px] capitalize transition-colors sm:px-4 sm:text-xs ${
                    tab === t ? "border-primary text-foreground" : "border-transparent text-muted-foreground"
                  }`}
                >
                  {t === "code" ? "solution.py" : "Shared canvas"}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <span className="hidden -space-x-1.5 sm:flex">
                <span className="h-5 w-5 rounded-full border-2 border-panel bg-primary" />
                <span className="h-5 w-5 rounded-full border-2 border-panel bg-accent" />
              </span>
              <button
                onClick={run}
                disabled={running}
                className="min-h-9 rounded-md bg-primary px-2 py-1 font-mono text-[10px] font-medium text-primary-foreground transition-opacity disabled:opacity-60 sm:px-3 sm:text-xs"
              >
                {running ? "Running…" : "▶ Run tests"}
              </button>
            </div>
          </div>

          <div className="relative flex-1">
            {/* code */}
            <div
              className={`absolute inset-0 overflow-auto p-4 font-mono text-[13px] leading-6 transition-opacity duration-500 ${
                tab === "code" ? "opacity-100" : "pointer-events-none opacity-0"
              }`}
            >
              {CODE.map((line, i) => {
                const lineLen = line.reduce((n, [t]) => n + t.length, 0);
                const lineStart = budget;
                const active = lineStart > 0 && lineStart < lineLen;
                const parts = line.map(([t, cls], j) => {
                  const shown = t.slice(0, Math.max(0, budget));
                  budget -= t.length;
                  return (
                    <span key={j} className={cls}>
                      {shown}
                    </span>
                  );
                });
                return (
                  <div key={i} className="flex whitespace-pre">
                    <span className="w-8 shrink-0 select-none text-right text-muted-foreground/40">{i + 1}</span>
                    <span className="pl-4">
                      {parts}
                      {active && <span className="ml-px inline-block h-4 w-0.5 translate-y-0.5 animate-pulse bg-primary" />}
                    </span>
                    {active && i > 0 && (
                      <span className="ml-2 rounded bg-accent px-1.5 text-[10px] leading-5 text-accent-foreground">
                        Sara
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
            {/* canvas */}
            <div
              className={`absolute inset-0 flex items-center justify-center p-6 transition-opacity duration-500 ${
                tab === "canvas" ? "opacity-100" : "pointer-events-none opacity-0"
              }`}
              style={{
                backgroundImage: "radial-gradient(var(--border) 1px, transparent 1px)",
                backgroundSize: "18px 18px",
              }}
            >
              <svg viewBox="0 0 520 260" className="w-full max-w-xl">
                {[
                  [40, 120, 50],
                  [90, 240, 95],
                  [300, 380, 140],
                  [430, 500, 185],
                ].map(([x1, x2, y], i) => (
                  <line
                    key={i}
                    x1={x1}
                    x2={x2}
                    y1={y}
                    y2={y}
                    stroke="var(--accent)"
                    strokeWidth={7}
                    strokeLinecap="round"
                    className="draw"
                    style={{ animationDelay: `${i * 0.35}s` }}
                  />
                ))}
                <path
                  d="M40 225 L240 225"
                  stroke="var(--primary)"
                  strokeWidth={8}
                  strokeLinecap="round"
                  className="draw"
                  style={{ animationDelay: "1.6s" }}
                />
                <path
                  d="M150 70 C 180 150, 140 180, 140 212"
                  stroke="var(--primary)"
                  strokeWidth={2}
                  fill="none"
                  strokeDasharray="4 5"
                  className="draw"
                  style={{ animationDelay: "1.2s" }}
                />
                <text x="250" y="230" fill="var(--primary)" className="font-mono" fontSize="14">
                  merged → [1, 6]
                </text>
                <text x="40" y="30" fill="var(--muted-foreground)" className="font-mono" fontSize="12">
                  overlap if start ≤ last.end
                </text>
              </svg>
            </div>
          </div>

          {/* Tests */}
          <div className="border-t border-border">
            <div className="flex items-center justify-between px-4 py-2 font-mono text-xs">
              <span className="text-muted-foreground">Test cases</span>
              <span className={tests === TESTS.length - 1 ? "text-success" : "text-muted-foreground"}>
                {Math.max(0, tests + 1)}/{TESTS.length} passed
              </span>
            </div>
            <div className="grid gap-px bg-border sm:grid-cols-2">
              {TESTS.map((t, i) => {
                const done = i <= tests;
                const pending = running && i === tests + 1;
                return (
                  <div key={i} className="flex items-start gap-3 bg-panel px-4 py-2.5 font-mono text-[11px]">
                    <span
                      className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[9px] transition-all duration-300 ${
                        done
                          ? "scale-100 bg-success text-background"
                          : pending
                            ? "animate-pulse bg-primary/40"
                            : "bg-muted"
                      }`}
                    >
                      {done ? "✓" : ""}
                    </span>
                    <div className="min-w-0">
                      <div className="truncate text-foreground/80">{t.input}</div>
                      <div className={done ? "text-success" : "text-muted-foreground/50"}>
                        {done ? `${t.out} · ${t.ms}ms` : "waiting"}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Video + chat */}
        <aside className="flex flex-col gap-3 p-3">
          {[
            { src: camInterviewer, name: "Daniel · Interviewer", speaking: chat % 2 === 1 },
            { src: camCandidate, name: "Sara · You", speaking: chat % 2 === 0 && chat > 0 },
          ].map((v) => (
            <div
              key={v.name}
              className={`relative overflow-hidden rounded-lg ring-2 transition-all duration-500 ${
                v.speaking ? "ring-primary" : "ring-transparent"
              }`}
            >
              <img src={v.src} alt={v.name} loading="lazy" width={944} height={626} className="kenburns aspect-[4/3] w-full object-cover" />
              <div className="absolute bottom-2 left-2 flex items-center gap-2 rounded bg-background/70 px-2 py-0.5 text-[11px]">
                {v.speaking && (
                  <span className="flex items-end gap-0.5">
                    {[0, 1, 2].map((b) => (
                      <span key={b} className="eq w-0.5 bg-primary" style={{ animationDelay: `${b * 0.15}s` }} />
                    ))}
                  </span>
                )}
                {v.name}
              </div>
            </div>
          ))}
          <div className="flex flex-1 flex-col gap-2 rounded-lg border border-border p-3 text-xs">
            {CHAT.slice(0, chat).map((m, i) => (
              <div key={i} className="animate-fade-in">
                <span className={m.who === "You" ? "text-accent" : "text-primary"}>{m.who}</span>
                <p className="text-foreground/80">{m.text}</p>
              </div>
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
}
