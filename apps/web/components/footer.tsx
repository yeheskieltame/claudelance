import Image from "next/image";
import Link from "next/link";
import { Github, Globe } from "lucide-react";

import { contractCodeUrl } from "@/lib/celoscan";

// v3 UUPS proxy (primary contract).
const CORE = "0x68c83D75Ee95860E83A893Aa13556AdE8411e3c8";

export function Footer() {
  return (
    <footer className="mx-auto w-full max-w-6xl px-4 pb-8 pt-12">
      <div className="glass rounded-3xl px-6 py-6 text-xs text-muted-foreground">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <Image
              src="/logo.webp"
              alt="Claudelance"
              width={36}
              height={36}
              className="h-9 w-9 rounded-full object-cover"
            />
            <div>
              <p className="font-display text-[0.95rem] font-bold text-foreground">Claudelance</p>
              <p className="mt-0.5">
                © {new Date().getFullYear()} · Putting Claude — and every AI
                agent — to work for everyone, onchain.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1">
            <Link
              href="https://github.com/yeheskieltame/claudelance"
              target="_blank"
              rel="noreferrer"
              className="touch-target inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 hover:text-foreground hover:bg-muted/60 transition-colors"
            >
              <Github className="h-3.5 w-3.5" /> GitHub
            </Link>
            <a
              href="https://x.com/Claudelanc0x"
              target="_blank"
              rel="noreferrer"
              aria-label="Claudelance on X"
              className="touch-target inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 hover:text-foreground hover:bg-muted/60 transition-colors"
            >
              <svg viewBox="0 0 24 24" aria-hidden className="h-3.5 w-3.5 fill-current">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </svg>
              X
            </a>
            <Link href="/revenue" className="touch-target inline-flex items-center rounded-full px-3 py-1.5 hover:text-foreground hover:bg-muted/60 transition-colors">Stats</Link>
            <Link href="/about" className="touch-target inline-flex items-center rounded-full px-3 py-1.5 hover:text-foreground hover:bg-muted/60 transition-colors">About</Link>
            <Link href="/docs" className="touch-target inline-flex items-center rounded-full px-3 py-1.5 hover:text-foreground hover:bg-muted/60 transition-colors">Docs</Link>
            <a href="mailto:support@claudelance.xyz" className="touch-target inline-flex items-center rounded-full px-3 py-1.5 hover:text-foreground hover:bg-muted/60 transition-colors">Support</a>
            <Link href="/terms" className="touch-target inline-flex items-center rounded-full px-3 py-1.5 hover:text-foreground hover:bg-muted/60 transition-colors">Terms</Link>
            <Link href="/privacy" className="touch-target inline-flex items-center rounded-full px-3 py-1.5 hover:text-foreground hover:bg-muted/60 transition-colors">Privacy</Link>
            <Link
              href={contractCodeUrl(CORE)}
              target="_blank"
              rel="noreferrer"
              className="touch-target inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 hover:text-foreground hover:bg-muted/60 transition-colors"
            >
              <Globe className="h-3.5 w-3.5" /> Contract
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
