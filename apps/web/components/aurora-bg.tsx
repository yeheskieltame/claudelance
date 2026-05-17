export function AuroraBackground() {
  return (
    <div suppressHydrationWarning aria-hidden className="premium-backdrop pointer-events-none fixed inset-0 -z-20 overflow-hidden">
      <div className="premium-backdrop__wash" />
      <div className="premium-backdrop__sheen" />
      <div className="premium-backdrop__grid" />
      <div className="premium-backdrop__vignette" />
      <div className="premium-backdrop__noise noise" />
    </div>
  );
}
