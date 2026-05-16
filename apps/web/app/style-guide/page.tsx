import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Style Guide — Claudelance",
  description: "Design system tokens reference",
};

const typeScale = [
  { name: "xs", class: "text-xs", size: "0.75rem / 1rem", usage: "Small labels, footnotes" },
  { name: "sm", class: "text-sm", size: "0.875rem / 1.25rem", usage: "Metadata, secondary text" },
  { name: "base", class: "text-base", size: "1rem / 1.5rem", usage: "Body copy" },
  { name: "lg", class: "text-lg", size: "1.125rem / 1.75rem", usage: "Lead paragraphs" },
  { name: "xl", class: "text-xl", size: "1.375rem / 1.875rem", usage: "Subheadings" },
  { name: "2xl", class: "text-2xl", size: "1.75rem / 2.25rem", usage: "Section headings" },
  { name: "3xl", class: "text-3xl", size: "2.25rem / 2.75rem", usage: "Hero headings" },
];

const tokens = [
  { label: "Primary BG", light: "bg-primary", dark: "bg-primary" },
  { label: "Foreground", light: "bg-foreground", dark: "bg-foreground" },
  { label: "Muted BG", light: "bg-muted", dark: "bg-muted" },
  { label: "Accent BG", light: "bg-accent", dark: "bg-accent" },
  { label: "Card BG", light: "bg-card", dark: "bg-card" },
  { label: "Destructive", light: "bg-destructive", dark: "bg-destructive" },
  { label: "Border", light: "bg-border", dark: "bg-border" },
  { label: "Input", light: "bg-input", dark: "bg-input" },
];

const radii = [
  { name: "sm", value: "0.375rem", usage: "Buttons, compact chips" },
  { name: "md", value: "0.5rem", usage: "Inputs, small cards" },
  { name: "lg", value: "1rem", usage: "Cards, dialogs" },
  { name: "xl", value: "1.25rem", usage: "Modals, mobile drawers" },
  { name: "2xl", value: "1.5rem", usage: "Bottom sheets, hero sections" },
];

export default function StyleGuidePage() {
  return (
    <div className="space-y-12 py-8 text-foreground">
      <section>
        <h1 className="text-3xl font-bold">Design Tokens</h1>
        <p className="text-muted-foreground text-base mt-2">
          All tokens meet WCAG AA against their paired background.
        </p>
      </section>

      {/* Type Scale */}
      <section>
        <h2 className="text-2xl font-bold mb-6">Type Scale</h2>
        <div className="grid gap-4">
          {typeScale.map((t) => (
            <div key={t.name} className="flex items-baseline gap-6 border-b border-border pb-3">
              <span className="w-16 text-sm font-mono text-muted-foreground">{t.name}</span>
              <span className={`flex-1 ${t.class}`}>The quick brown fox</span>
              <span className="w-48 text-sm text-muted-foreground text-right">{t.size}</span>
              <span className="w-48 text-sm text-muted-foreground">{t.usage}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Color Tokens */}
      <section>
        <h2 className="text-2xl font-bold mb-6">Color Tokens</h2>
        <div className="flex flex-wrap gap-4">
          {tokens.map((t) => (
            <div key={t.label} className="flex flex-col items-center gap-2">
              <div className={`w-16 h-16 rounded-xl ${t.light} dark:${t.dark} border border-border`} />
              <span className="text-xs font-mono text-muted-foreground">{t.label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Border Radius */}
      <section>
        <h2 className="text-2xl font-bold mb-6">Border Radius</h2>
        <div className="flex flex-wrap gap-8 items-end">
          {radii.map((r) => (
            <div key={r.name} className="flex flex-col items-center gap-2">
              <div
                className="w-20 h-20 bg-primary/20 border border-border"
                style={{ borderRadius: r.value }}
              />
              <span className="text-xs font-mono text-muted-foreground">{r.name}</span>
              <span className="text-xs text-muted-foreground">{r.value}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Motion */}
      <section>
        <h2 className="text-2xl font-bold mb-6">Motion Primitives</h2>
        <div className="grid gap-4">
          <div className="flex items-center gap-4 border-b border-border pb-3">
            <span className="w-32 text-sm font-mono text-muted-foreground">ease-out-quad</span>
            <span className="text-sm">180ms default (cubic-bezier(0.25, 0.46, 0.45, 0.94))</span>
            <div className="w-4 h-4 bg-primary rounded-full animate-[bounce_180ms_ease-out-quad_infinite]" />
          </div>
          <div className="flex items-center gap-4 border-b border-border pb-3">
            <span className="w-32 text-sm font-mono text-muted-foreground">ease-in-out-quad</span>
            <span className="text-sm">240ms slow (cubic-bezier(0.455, 0.03, 0.515, 0.955))</span>
          </div>
        </div>
      </section>
    </div>
  );
}
