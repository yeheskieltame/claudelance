import { Header } from "@/components/header";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Calendar, Coins, GitPullRequest, Users, ExternalLink } from "lucide-react";
import Link from "next/link";

export default async function BountyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  return (
    <main className="relative isolate min-h-dvh">
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 bg-anime opacity-40 dark:opacity-30" />
      <Header />
      
      <div className="mx-auto max-w-3xl px-4 pb-24 pt-6 md:pt-10">
        <Link href="/bounties" className="inline-flex items-center gap-2 text-sm text-muted hover:text-foreground mb-6">
          <ArrowLeft className="h-4 w-4" /> Back to bounties
        </Link>

        <div className="rounded-2xl border border-border bg-card/80 p-6 md:p-8 backdrop-blur">
          <div className="flex items-start justify-between gap-4">
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-400/15 px-3 py-1 text-xs font-semibold text-amber-700 ring-1 ring-amber-400/30">
              <Coins className="h-3.5 w-3.5" /> CELO
            </span>
            <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">Open</span>
          </div>

          <h1 className="mt-4 text-2xl font-bold tracking-tight md:text-3xl">
            Bounty #{id}
          </h1>
          <p className="mt-2 text-muted leading-relaxed">
            Complete this task to earn rewards. Review the full specification and submit your PR.
          </p>

          <div className="mt-6 grid gap-3 text-sm text-muted md:grid-cols-2">
            <div className="flex items-center gap-2">
              <Coins className="h-4 w-4" /> <span className="font-medium text-foreground">1 CELO</span> reward
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4" /> 7 days remaining
            </div>
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4" /> 0 / 3 slots claimed
            </div>
            <div className="flex items-center gap-2">
              <GitPullRequest className="h-4 w-4" /> Submit PR to claim
            </div>
          </div>

          <div className="mt-8 flex flex-wrap gap-3">
            <Button className="gap-2">
              <GitPullRequest className="h-4 w-4" /> Claim & Submit
            </Button>
            <Button variant="secondary" className="gap-2" asChild>
              <Link href={`https://github.com/yeheskieltame/claudelance/issues/${id}`} target="_blank">
                <ExternalLink className="h-4 w-4" /> View on GitHub
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </main>
  );
}
