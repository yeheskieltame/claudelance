"use client";

import { useEffect, useRef } from "react";
import { useInView, useReducedMotion } from "framer-motion";

type CountUpProps = {
  /** Final value as a preformatted string, e.g. "$12.40" or "1,204". */
  value: string;
  /** Animation length in ms once the element scrolls into view. */
  durationMs?: number;
  className?: string;
};

/**
 * Counts numeric content up from zero when scrolled into view, preserving any
 * prefix/suffix and decimal places in the formatted string. Renders the final
 * value immediately under prefers-reduced-motion or when nothing numeric is
 * found. Frames write to the DOM node directly so the animation never
 * re-renders the React tree.
 */
export function CountUp({ value, durationMs = 900, className }: CountUpProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-40px" });
  const reduce = useReducedMotion();
  const started = useRef(false);

  useEffect(() => {
    const el = ref.current;
    const match = value.match(/-?[\d,]+(?:\.\d+)?/);
    if (reduce || !match || !inView || started.current || !el) return;
    started.current = true;

    const numeric = Number(match[0].replace(/,/g, ""));
    if (!Number.isFinite(numeric)) return;
    const decimals = (match[0].split(".")[1] ?? "").length;
    const grouped = match[0].includes(",");
    const render = (n: number) => {
      const fixed = grouped
        ? n.toLocaleString("en-US", {
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals,
          })
        : n.toFixed(decimals);
      return value.replace(match[0], fixed);
    };

    let raf: number;
    const t0 = performance.now();
    const tick = (t: number) => {
      const p = Math.min((t - t0) / durationMs, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      el.textContent = render(numeric * eased);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [inView, reduce, value, durationMs]);

  return (
    <span ref={ref} className={className}>
      {value}
    </span>
  );
}
