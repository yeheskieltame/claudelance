/**
 * Site-wide ambient backdrop: a fine engineering grid fading out radially,
 * plus three slow-drifting glows in the brand's warm hues. Pure CSS, fixed
 * and non-interactive, animating transform only so it never causes layout
 * work; motion-reduce pins every layer still.
 */
export function AmbientBackground() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div
        className="absolute inset-0 [background-image:linear-gradient(to_right,hsl(var(--border)/0.55)_1px,transparent_1px),linear-gradient(to_bottom,hsl(var(--border)/0.55)_1px,transparent_1px)] [background-size:56px_56px] [mask-image:radial-gradient(ellipse_75%_55%_at_50%_0%,black_25%,transparent_100%)]"
      />
      <div className="absolute -top-48 left-1/2 h-[42rem] w-[64rem] -translate-x-1/2 rounded-full bg-primary/[0.13] blur-3xl animate-drift-a motion-reduce:animate-none" />
      <div className="absolute top-1/3 -left-48 h-[30rem] w-[34rem] rounded-full bg-amber-500/[0.07] blur-3xl animate-drift-b motion-reduce:animate-none" />
      <div className="absolute -bottom-40 -right-48 h-[30rem] w-[40rem] rounded-full bg-orange-700/[0.08] blur-3xl animate-drift-c motion-reduce:animate-none" />
      <div className="noise absolute inset-0 opacity-[0.025] dark:opacity-[0.04]" />
    </div>
  );
}
