import { createFileRoute } from "@tanstack/react-router";
import { useProgress } from "@react-three/drei";
import { useEffect, useRef, useState } from "react";
import RoomScene from "@/components/innerview/RoomScene";
import { InterviewDemo } from "@/components/innerview/InterviewDemo";
import { scrollState, smooth } from "@/components/innerview/scroll-state";

export const Route = createFileRoute("/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Innerview — Mock interviews with real people" },
      {
        name: "description",
        content:
          "Practice live technical interviews face to face with real interviewers — video, a shared editor, a shared canvas and real test cases in one room.",
      },
      { property: "og:title", content: "Innerview — Practice the interview, not just the problem" },
      {
        property: "og:description",
        content: "Real people. Real problems. Real pressure. The room you practice in — and can get hired in.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

const CHAPTERS = [
  { a: 0.0, b: 0.09, kicker: "", title: "Innerview", body: "Mock interviews with real people — because solving alone won't teach you to think while someone watches.", hero: true },
  { a: 0.15, b: 0.27, kicker: "01 — The match", title: "A real person, across the table.", body: "Get matched with a peer or a coach who's sat in that chair. Real face, real voice, real time." },
  { a: 0.31, b: 0.42, kicker: "02 — The nerves", title: "Feel the room first.", body: "Half the interview is being watched. Practice with the pressure on — that's the whole point." },
  { a: 0.5, b: 0.6, kicker: "03 — The problem", title: "One problem, two screens.", body: "A shared editor with live cursors. Talk it through as you type — exactly like the real thing." },
  { a: 0.64, b: 0.76, kicker: "04 — The thinking", title: "Think out loud.", body: "A shared canvas for diagrams, edge cases and the “what if N is huge?” moments." },
  { a: 0.8, b: 0.9, kicker: "05 — The verdict", title: "Run it. Hear the truth.", body: "Tests land on both screens — then honest feedback from a human who just watched you work." },
];

function Loader() {
  const { progress, active } = useProgress();
  return (
    <div
      className={`pointer-events-none fixed inset-0 z-50 flex flex-col items-center justify-center bg-background transition-opacity duration-1000 ${
        active || progress < 100 ? "opacity-100" : "opacity-0"
      }`}
    >
      <span className="font-display text-4xl italic text-primary">Innerview</span>
      <div className="mt-4 h-px w-48 bg-border">
        <div className="h-px bg-primary transition-all" style={{ width: `${progress}%` }} />
      </div>
      <span className="mt-3 font-mono text-xs text-muted-foreground">Finding your interviewer · {Math.round(progress)}%</span>
    </div>
  );
}

function Index() {
  const story = useRef<HTMLDivElement>(null);
  const [p, setP] = useState(0);

  useEffect(() => {
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const el = story.current;
        if (!el) return;
        const r = el.getBoundingClientRect();
        const v = Math.min(1, Math.max(0, -r.top / (r.height - window.innerHeight)));
        scrollState.target = v;
        setP(v);
      });
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  const dive = smooth(0.93, 1, p);

  return (
    <main className="bg-background text-foreground">
      <Loader />

      {/* Nav */}
      <header className="fixed inset-x-0 top-0 z-40 flex items-center justify-between px-6 py-5 md:px-10">
        <span className="font-display text-2xl italic text-primary">Innerview</span>
        <a
          href="#demo"
          className="rounded-full border border-border px-4 py-1.5 text-sm text-foreground/80 transition-colors hover:border-primary hover:text-primary"
        >
          See it live
        </a>
      </header>

      {/* Scrollytelling story */}
      <div ref={story} className="relative" style={{ height: "900vh" }}>
        <div className="sticky top-0 h-screen w-full overflow-hidden">
          <RoomScene />

          {/* vignette */}
          <div
            className="pointer-events-none absolute inset-0"
            style={{ background: "radial-gradient(ellipse at center, transparent 45%, var(--background) 110%)" }}
          />

          {/* chapters */}
          {CHAPTERS.map((c) => {
            const o = smooth(c.a, c.a + 0.025, p) * (1 - smooth(c.b - 0.025, c.b, p));
            const show = c.hero ? 1 - smooth(c.b - 0.04, c.b, p) : o;
            const y = (1 - show) * 24;
            return (
              <div
                key={c.title}
                className={`pointer-events-none absolute inset-0 flex px-6 md:px-16 ${
                  c.hero ? "items-end justify-start pb-24" : "items-center justify-start"
                }`}
                style={{ opacity: show, transform: `translateY(${y}px)` }}
              >
                <div className={c.hero ? "max-w-3xl" : "max-w-md"}>
                  {c.kicker && (
                    <div className="mb-3 font-mono text-xs uppercase tracking-[0.2em] text-primary">{c.kicker}</div>
                  )}
                  <h2
                    className={`font-display leading-[0.95] ${
                      c.hero ? "text-7xl italic md:text-[9rem]" : "text-5xl md:text-6xl"
                    }`}
                  >
                    {c.title}
                  </h2>
                  <p className={`mt-4 text-muted-foreground ${c.hero ? "text-lg md:text-xl" : "text-base"}`}>
                    {c.body}
                  </p>
                  {c.hero && (
                    <div className="mt-10 flex items-center gap-3 font-mono text-xs text-muted-foreground">
                      <span className="block h-8 w-px animate-pulse bg-primary" /> Scroll to take a seat
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {/* progress rail */}
          <div className="absolute right-6 top-1/2 hidden h-40 w-px -translate-y-1/2 bg-border md:block">
            <div className="w-px bg-primary" style={{ height: `${p * 100}%` }} />
          </div>

          {/* screen dive fade */}
          <div className="pointer-events-none absolute inset-0 bg-background" style={{ opacity: dive }} />
        </div>
      </div>

      {/* Live demo */}
      <section id="demo" className="relative px-4 pb-24 pt-10 md:px-8">
        <div className="mx-auto mb-10 max-w-3xl text-center">
          <div className="font-mono text-xs uppercase tracking-[0.2em] text-primary">You're in</div>
          <h2 className="mt-3 font-display text-5xl md:text-7xl">This is the interview.</h2>
          <p className="mt-4 text-muted-foreground">
            Video, problem, code, canvas and tests — one room, two people, zero tab‑switching.
          </p>
        </div>
        <InterviewDemo />
      </section>

      {/* Features */}
      <section className="mx-auto grid max-w-6xl gap-px overflow-hidden rounded-xl border border-border bg-border md:grid-cols-4">
        {[
          ["Video call", "Built‑in HD video with speaker focus and recording."],
          ["Shared editor", "Live cursors, 20+ languages, syntax highlighting."],
          ["Shared canvas", "Whiteboard systems and algorithms together."],
          ["Test cases", "Hidden and visible tests, run in a sandbox, instantly."],
        ].map(([t, d], i) => (
          <div key={t} className="bg-background p-8">
            <div className="font-mono text-xs text-primary">0{i + 1}</div>
            <h3 className="mt-6 font-display text-3xl">{t}</h3>
            <p className="mt-2 text-sm text-muted-foreground">{d}</p>
          </div>
        ))}
      </section>

      <section className="px-6 py-32 text-center">
        <h2 className="font-display text-6xl italic md:text-8xl">Pull up a chair.</h2>
        <p className="mx-auto mt-5 max-w-md text-muted-foreground">
          Run your next technical interview on Innerview.
        </p>
        <a
          href="#demo"
          className="mt-10 inline-block rounded-full bg-primary px-8 py-3 font-medium text-primary-foreground transition-transform hover:scale-105"
        >
          Book a demo
        </a>
      </section>

      <footer className="border-t border-border px-6 py-8 text-center font-mono text-xs text-muted-foreground">
        © {new Date().getFullYear()} Innerview
      </footer>
    </main>
  );
}
