import { createFileRoute } from "@tanstack/react-router";
import { Component, lazy, Suspense, useEffect, useRef, useState, type ReactNode } from "react";
import { LiveBackground } from "@/components/innerview/LiveBackground";
import { scrollState, smooth } from "@/components/innerview/scroll-state";

const RoomScene = lazy(() => import("@/components/innerview/RoomScene"));
const InterviewDemo = lazy(() =>
  import("@/components/innerview/InterviewDemo").then(({ InterviewDemo }) => ({ default: InterviewDemo })),
);

export const Route = createFileRoute("/")({
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

class SceneErrorBoundary extends Component<
  { children: ReactNode; onError: () => void },
  { failed: boolean }
> {
  override state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  override componentDidCatch() {
    this.props.onError();
  }

  override render() {
    return this.state.failed ? null : this.props.children;
  }
}

function Index() {
  const story = useRef<HTMLDivElement>(null);
  const demo = useRef<HTMLElement>(null);
  const [p, setP] = useState(0);
  const [sceneReady, setSceneReady] = useState(false);
  const [sceneUnavailable, setSceneUnavailable] = useState(false);
  const [compact, setCompact] = useState<boolean | null>(null);
  const [sceneProgress, setSceneProgress] = useState(0);
  const [sceneLoadElapsed, setSceneLoadElapsed] = useState(0);
  const [loadDemo, setLoadDemo] = useState(false);
  const sceneGateActive = !sceneReady && !sceneUnavailable;

  useEffect(() => {
    const media = window.matchMedia("(max-width: 767px)");
    const updateCompact = () => setCompact(media.matches);
    updateCompact();
    media.addEventListener("change", updateCompact);
    try {
      const canvas = document.createElement("canvas");
      if (!canvas.getContext("webgl2") && !canvas.getContext("webgl")) {
        setSceneUnavailable(true);
      }
    } catch {
      setSceneUnavailable(true);
    }
    return () => media.removeEventListener("change", updateCompact);
  }, []);

  useEffect(() => {
    if (!sceneGateActive) return;

    const html = document.documentElement;
    const body = document.body;
    const previousHtmlOverflow = html.style.overflow;
    const previousBodyOverflow = body.style.overflow;
    const previousHtmlOverscroll = html.style.overscrollBehavior;
    html.style.overflow = "hidden";
    html.style.overscrollBehavior = "none";
    body.style.overflow = "hidden";

    const preventScrollKeys = (event: KeyboardEvent) => {
      if ([" ", "ArrowDown", "ArrowUp", "PageDown", "PageUp", "Home", "End"].includes(event.key)) {
        event.preventDefault();
      }
    };
    window.addEventListener("keydown", preventScrollKeys, { capture: true });

    return () => {
      html.style.overflow = previousHtmlOverflow;
      html.style.overscrollBehavior = previousHtmlOverscroll;
      body.style.overflow = previousBodyOverflow;
      window.removeEventListener("keydown", preventScrollKeys, { capture: true });
    };
  }, [sceneGateActive]);

  useEffect(() => {
    if (!sceneGateActive) return;
    const startedAt = performance.now();
    const timer = window.setInterval(() => {
      setSceneLoadElapsed((performance.now() - startedAt) / 1000);
    }, 250);
    return () => window.clearInterval(timer);
  }, [sceneGateActive]);

  useEffect(() => {
    const element = demo.current;
    if (!element) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setLoadDemo(true);
          observer.disconnect();
        }
      },
      { rootMargin: "600px" },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let raf = 0;
    let lastProgressUpdate = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const now = performance.now();
        if (window.innerWidth < 768 && now - lastProgressUpdate < 32) return;
        lastProgressUpdate = now;
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
  const displayedProgress = sceneReady ? 100 : Math.min(98, Math.max(0, Math.round(sceneProgress)));
  const secondsRemaining =
    displayedProgress > 0 && sceneLoadElapsed > 0
      ? Math.max(1, Math.ceil((sceneLoadElapsed * (100 - displayedProgress)) / displayedProgress))
      : null;
  const remainingLabel = sceneReady
    ? "Ready"
    : sceneProgress >= 100
      ? "Finishing the room…"
      : secondsRemaining == null
        ? "Estimating remaining time…"
        : secondsRemaining >= 60
          ? `About ${Math.ceil(secondsRemaining / 60)} min left`
          : `About ${secondsRemaining} sec left`;

  return (
    <>
    <main className="relative text-foreground" inert={sceneGateActive} aria-busy={sceneGateActive}>
      <LiveBackground />

      {/* Nav */}
      <header className="fixed inset-x-0 top-0 z-40 flex items-center justify-between px-4 py-4 sm:px-6 sm:py-5 md:px-10">
        <span className="font-display text-2xl italic text-primary">Innerview</span>
        <a
          href="#demo"
          className="min-h-10 rounded-full border border-border px-4 py-2 text-sm text-foreground/80 transition-colors hover:border-primary hover:text-primary sm:min-h-0 sm:py-1.5"
        >
          See it live
        </a>
      </header>

      {/* Scrollytelling story */}
      <div ref={story} className="relative z-10 h-[900svh] md:h-[900vh]">
        <div className="sticky top-0 h-[100svh] w-full overflow-hidden md:h-screen">
          {!sceneUnavailable && compact !== null && (
            <SceneErrorBoundary onError={() => setSceneUnavailable(true)}>
              <Suspense fallback={null}>
                <RoomScene compact={compact} onReady={setSceneReady} onProgress={setSceneProgress} />
              </Suspense>
            </SceneErrorBoundary>
          )}
          <div
            className={`story-scene-placeholder ${sceneReady && !sceneUnavailable ? "opacity-0" : "opacity-100"}`}
            aria-hidden="true"
          />

          {/* vignette */}
          <div
            className="pointer-events-none absolute inset-0"
            style={{ background: "radial-gradient(ellipse at center, transparent 45%, var(--background) 110%)" }}
          />
          <div className="story-atmosphere" aria-hidden="true" />

          {/* chapters */}
          {CHAPTERS.map((c) => {
            const o = smooth(c.a, c.a + 0.025, p) * (1 - smooth(c.b - 0.025, c.b, p));
            const show = c.hero ? 1 - smooth(c.b - 0.04, c.b, p) : o;
            const y = (1 - show) * 24;
            return (
              <div
                key={c.title}
                className={`pointer-events-none absolute inset-0 flex px-5 sm:px-6 md:px-16 ${
                  c.hero ? "items-end justify-start pb-16 sm:pb-24" : "items-center justify-start py-16"
                }`}
                style={{ opacity: show, transform: `translateY(${y}px)` }}
              >
                <div className={`story-copy w-full ${c.hero ? "max-w-3xl" : "max-w-md"}`}>
                  {c.kicker && (
                    <div className="mb-3 font-mono text-xs uppercase tracking-[0.2em] text-primary">{c.kicker}</div>
                  )}
                  <h2
                    className={`font-display leading-[0.95] ${
                      c.hero ? "text-[clamp(2.75rem,14vw,5.5rem)] italic sm:text-7xl md:text-[9rem]" : "text-[clamp(2.5rem,11vw,4rem)] sm:text-5xl md:text-6xl"
                    }`}
                  >
                    {c.title}
                  </h2>
                  <p className={`mt-3 max-w-[38rem] text-muted-foreground sm:mt-4 ${c.hero ? "text-base sm:text-lg md:text-xl" : "text-sm sm:text-base"}`}>
                    {c.body}
                  </p>
                  {c.hero && (
                    <div className="mt-6 flex items-center gap-3 font-mono text-[11px] text-muted-foreground sm:mt-10 sm:text-xs">
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
      <section ref={demo} id="demo" className="relative z-10 scroll-mt-16 px-3 pb-20 pt-14 min-[400px]:px-4 md:px-8 md:pb-24 md:pt-10">
        <div className="mx-auto mb-8 max-w-3xl text-center sm:mb-10">
          <div className="font-mono text-xs uppercase tracking-[0.2em] text-primary">You're in</div>
          <h2 className="mt-3 font-display text-[clamp(2.5rem,11vw,4.5rem)] leading-none md:text-7xl">This is the interview.</h2>
          <p className="mx-auto mt-4 max-w-lg text-sm leading-relaxed text-muted-foreground sm:text-base">
            Video, problem, code, canvas and tests — one room, two people, zero tab‑switching.
          </p>
        </div>
        <Suspense fallback={<div className="min-h-[680px] rounded-xl border border-border bg-panel/80" />}>
          {loadDemo ? <InterviewDemo /> : <div className="min-h-[680px] rounded-xl border border-border bg-panel/80" />}
        </Suspense>
      </section>

      {/* Features */}
      <section className="relative z-10 mx-3 grid max-w-6xl grid-cols-1 gap-px overflow-hidden rounded-xl border border-border bg-border/60 backdrop-blur-sm min-[420px]:grid-cols-2 min-[420px]:mx-4 md:mx-auto md:grid-cols-4">
        {[
          ["Video call", "Built‑in HD video with speaker focus and recording."],
          ["Shared editor", "Live cursors, 20+ languages, syntax highlighting."],
          ["Shared canvas", "Whiteboard systems and algorithms together."],
          ["Test cases", "Hidden and visible tests, run in a sandbox, instantly."],
        ].map(([t, d], i) => (
          <div
            key={t}
            className="group bg-background/60 p-5 transition-colors duration-500 hover:bg-background/25 sm:p-8"
          >
            <div className="font-mono text-xs text-primary">0{i + 1}</div>
            <h3 className="mt-4 font-display text-2xl sm:mt-6 sm:text-3xl">{t}</h3>
            <p className="mt-2 text-xs text-muted-foreground sm:text-sm">{d}</p>
          </div>
        ))}
      </section>

      <section className="relative z-10 px-5 py-24 text-center md:py-32">
        <h2 className="font-display text-[clamp(3rem,13vw,6rem)] leading-none italic md:text-8xl">Pull up a chair.</h2>
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

      <footer className="relative z-10 border-t border-border px-6 py-8 text-center font-mono text-xs text-muted-foreground">
        © {new Date().getFullYear()} Innerview
      </footer>
    </main>
    {sceneGateActive && (
      <div className="scene-loading-screen" role="status" aria-live="polite">
        <div className="scene-loading-card">
          <div className="scene-loading-brand">
            <span className="scene-loading-spinner" aria-hidden="true" />
            <span>INNERVIEW <span className="scene-loading-separator">/</span> 3D ROOM</span>
          </div>
          <h1>Pulling up a chair</h1>
          <p>Preparing the interview room and its graphics.</p>
          <div className="scene-loading-details">
            <span>{remainingLabel}</span>
            <span>{displayedProgress}%</span>
          </div>
          <div
            className="scene-loading-track"
            role="progressbar"
            aria-label="Interview room graphics loading"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={displayedProgress}
          >
            <span style={{ width: `${displayedProgress}%` }} />
          </div>
          <span className="scene-loading-footnote">The experience will open as soon as the room is ready.</span>
          {sceneLoadElapsed >= 15 && (
            <button className="scene-loading-skip" onClick={() => setSceneUnavailable(true)}>
              Continue without 3D
            </button>
          )}
        </div>
      </div>
    )}
    </>
  );
}
