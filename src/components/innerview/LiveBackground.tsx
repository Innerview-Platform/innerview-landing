import { useEffect, useRef } from "react";

/**
 * Fixed ambient layer behind the whole page: drifting auroras, a pointer-follow
 * glow and film grain. Everything visual lives in styles.css (.live-bg et al);
 * this component feeds the pointer position in with a short, eased trail.
 */
export function LiveBackground() {
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    // Start centred-ish so the first frame matches the CSS defaults.
    let tx = window.innerWidth / 2;
    let ty = window.innerHeight * 0.25;
    let x = tx;
    let y = ty;
    let raf = 0;

    const tick = () => {
      x += (tx - x) * 0.06;
      y += (ty - y) * 0.06;
      el.style.setProperty("--mx", `${x}px`);
      el.style.setProperty("--my", `${y}px`);
      if (Math.abs(tx - x) + Math.abs(ty - y) > 0.5) {
        raf = requestAnimationFrame(tick);
      } else {
        raf = 0;
      }
    };

    const onMove = (e: PointerEvent) => {
      tx = e.clientX;
      ty = e.clientY;
      if (!raf) raf = requestAnimationFrame(tick);
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onMove);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div ref={root} className="live-bg" aria-hidden="true">
      <div className="aurora aurora-a" />
      <div className="aurora aurora-b" />
      <div className="aurora aurora-c" />
      <div className="cursor-glow" />
      <div className="grain" />
    </div>
  );
}
