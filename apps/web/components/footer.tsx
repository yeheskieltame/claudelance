import Link from "next/link";
import { Github, Globe } from "lucide-react";

import { contractCodeUrl } from "@/lib/celoscan";

const CORE = "0x1362d874F40B7e28836cBeCcA14f5EfBe6c6E423";

export function Footer() {
  return (
    <footer className="mx-auto w-full max-w-6xl px-4 pb-8 pt-12">
      <div className="glass flex flex-col items-center justify-between gap-4 rounded-3xl px-6 py-5 text-xs text-muted-foreground sm:flex-row">
        <p>
          © {new Date().getFullYear()} Claudelance · Built for{" "}
          <Link
            href="https://celo.org/proof-of-ship"
            target="_blank"
            rel="noreferrer"
            className="underline-offset-2 hover:underline"
          >
            Celo Proof of Ship #8
          </Link>
        </p>
        <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-4">
          <Link
            href="https://github.com/yeheskieltame/claudelance"
            target="_blank"
            rel="noreferrer"
            className="touch-target inline-flex items-center gap-1.5 rounded-full px-3 hover:text-foreground"
          >
            <Github className="h-3.5 w-3.5" /> Source on GitHub
          </Link>
          <Link href="/revenue" className="touch-target inline-flex items-center rounded-full px-3 hover:text-foreground">Live stats</Link>
          <Link href="/about" className="touch-target inline-flex items-center rounded-full px-3 hover:text-foreground">About</Link>
          <Link href="/docs" className="touch-target inline-flex items-center rounded-full px-3 hover:text-foreground">Docs</Link>
          <Link
            href={contractCodeUrl(CORE)}
            target="_blank"
            rel="noreferrer"
            className="touch-target inline-flex items-center gap-1.5 rounded-full px-3 hover:text-foreground"
          >
            <Globe className="h-3.5 w-3.5" /> Celoscan
          </Link>
        </div>
      </div>
    </footer>
  );
}
