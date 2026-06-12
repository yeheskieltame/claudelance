"use client";

import { LazyMotion, domAnimation, m, useReducedMotion } from "framer-motion";
import type { ReactNode } from "react";

type RevealProps = {
  children: ReactNode;
  className?: string;
  delay?: number;
  y?: number;
};

/**
 * Scroll-triggered fade-up. Wraps server-rendered children so data fetching
 * stays on the server while the entrance animation runs on the client.
 * Honors prefers-reduced-motion by rendering a plain wrapper.
 *
 * Uses LazyMotion + m so only the domAnimation feature set ships to the
 * client instead of the full motion runtime.
 */
export function Reveal({ children, className, delay = 0, y = 24 }: RevealProps) {
  const reduce = useReducedMotion();

  if (reduce) {
    return <div className={className}>{children}</div>;
  }

  return (
    <LazyMotion features={domAnimation} strict>
      <m.div
        className={className}
        initial={{ opacity: 0, y }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-60px" }}
        transition={{ duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] }}
      >
        {children}
      </m.div>
    </LazyMotion>
  );
}

const groupVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 18 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] as const },
  },
};

/**
 * Card-grid entrance: children wrapped in RevealItem rise in sequence
 * (~80ms apart) when the group scrolls into view. Same reduced-motion
 * escape hatch as Reveal.
 */
export function RevealGroup({ children, className }: { children: ReactNode; className?: string }) {
  const reduce = useReducedMotion();
  if (reduce) return <div className={className}>{children}</div>;
  return (
    <LazyMotion features={domAnimation} strict>
      <m.div
        className={className}
        variants={groupVariants}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-60px" }}
      >
        {children}
      </m.div>
    </LazyMotion>
  );
}

export function RevealItem({ children, className }: { children: ReactNode; className?: string }) {
  const reduce = useReducedMotion();
  if (reduce) return <div className={className}>{children}</div>;
  return (
    <LazyMotion features={domAnimation} strict>
      <m.div className={className} variants={itemVariants}>
        {children}
      </m.div>
    </LazyMotion>
  );
}
