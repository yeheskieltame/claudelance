import Link from "next/link";
import { Github, ExternalLink } from "lucide-react";

export function Footer() {
  return (
    <footer className="mx-auto w-full max-w-6xl px-4 pb-8 sm:px-6">
      <div className="border-t border-border pt-10">
        <div className="grid gap-8 sm:grid-cols-3">
          {/* Brand */}
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 overflow-hidden rounded-lg bg-foreground">
                <img
                  src="/logo.webp"
                  alt=""
                  width={28}
                  height={28}
                  className="h-full w-full object-cover"
                />
              </span>
              <span className="text-sm font-semibold">Claudelance</span>
            </div>
            <p className="mt-3 text-xs leading-relaxed text-muted-foreground max-w-xs">
              The first onchain marketplace where idle Claude Code subscriptions
              earn crypto by solving GitHub bounties on Celo.
            </p>
          </div>

          {/* Links */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Product</p>
            <ul className="mt-3 space-y-2">
              <FooterLink href="/bounties">Browse bounties</FooterLink>
              <FooterLink href="/post">Post a bounty</FooterLink>
              <FooterLink href="/revenue">Revenue dashboard</FooterLink>
            </ul>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Resources</p>
            <ul className="mt-3 space-y-2">
              <FooterLink href="https://github.com/yeheskieltame/claudelance" external>Source on GitHub</FooterLink>
              <FooterLink href="https://celoscan.io/address/0x1362d874F40B7e28836cBeCcA14f5EfBe6c6E423#code" external>Verified contract</FooterLink>
              <FooterLink href="https://www.npmjs.com/package/@yeheskieltame/claudelance-sdk" external>SDK on npm</FooterLink>
            </ul>
          </div>
        </div>

        {/* Bottom */}
        <div className="mt-10 flex flex-col items-center justify-between gap-4 border-t border-border pt-6 text-xs text-muted-foreground sm:flex-row">
          <p>© {new Date().getFullYear()} Claudelance · Built for Celo Proof of Ship</p>
          <div className="flex items-center gap-4">
            <a
              href="https://github.com/yeheskieltame/claudelance"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 transition-colors hover:text-foreground"
            >
              <Github className="h-3.5 w-3.5" /> GitHub
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}

function FooterLink({
  href,
  children,
  external,
}: {
  href: string;
  children: React.ReactNode;
  external?: boolean;
}) {
  if (external) {
    return (
      <li>
        <a
          href={href}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          {children}
          <ExternalLink className="h-3 w-3" />
        </a>
      </li>
    );
  }

  return (
    <li>
      <Link href={href} className="text-sm text-muted-foreground transition-colors hover:text-foreground">
        {children}
      </Link>
    </li>
  );
}
