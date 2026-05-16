import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Style Guide — Claudelance",
  description: "Design system tokens reference",
};

export default function StyleGuidePage() {
  return (
    <div className="space-y-12 py-8 text-foreground">
      <section>
        <h1 className="text-2xl font-bold">Design Tokens</h1>
        <p className="text-muted-foreground mt-1">All tokens meet WCAG AA.</p>
      </section>

      <section>
        <h2 className="text-xl font-bold mb-4">Type Scale</h2>
        <div className="space-y-3">
          {["xs","sm","base","lg","xl","2xl","3xl"].map((s) => (
            <div key={s} className="flex items-baseline gap-4 border-b border-border pb-2">
              <span className="w-16 text-xs font-mono text-muted-foreground">{s}</span>
              <span className={`text-${s}`}>The quick brown fox</span>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-xl font-bold mb-4">Radius</h2>
        <div className="flex gap-4">
          {["sm","md","lg","xl","2xl"].map((r) => (
            <div key={r} className="flex flex-col items-center gap-1">
              <div className={`w-16 h-16 bg-primary/20 border border-border rounded-${r}`} />
              <span className="text-xs text-muted-foreground">{r}</span>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-xl font-bold mb-4">Motion</h2>
        <div className="text-sm text-muted-foreground space-y-1">
          <p>ease-out-quad: cubic-bezier(0.25, 0.46, 0.45, 0.94) — 180ms default</p>
          <p>ease-in-out-quad: cubic-bezier(0.455, 0.03, 0.515, 0.955) — 240ms slow</p>
        </div>
      </section>
    </div>
  );
}
