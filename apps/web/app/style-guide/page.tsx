import type { Bounty } from "@yeheskieltame/claudelance-types";
import { BountyStatus, MAINNET, ZERO_ADDRESS } from "@yeheskieltame/claudelance-types";

import { BountyCard } from "@/components/bounty-card";

const styleGuideNow = Date.UTC(2026, 4, 16, 3, 0, 0) / 1000;

const sampleBounties: Bounty[] = [
  makeBounty({
    amount: 125_000000000000000000n,
    claimedSlots: 1,
    deadlineOffset: 3 * 86_400 + 4 * 3_600,
    requirementsHash: "0x1111111111111111111111111111111111111111111111111111111111111111",
    token: MAINNET.tokens.cUSD,
  }),
  makeBounty({
    amount: 3_500000000000000000n,
    claimedSlots: 0,
    deadlineOffset: 1 * 86_400 + 8 * 3_600,
    requirementsHash: "0x2222222222222222222222222222222222222222222222222222222222222222",
    token: MAINNET.tokens.CELO,
  }),
  makeBounty({
    amount: 250_000000n,
    claimedSlots: 2,
    deadlineOffset: 5 * 86_400 + 2 * 3_600,
    requirementsHash: "0x3333333333333333333333333333333333333333333333333333333333333333",
    token: MAINNET.tokens.USDC,
  }),
];

export default function StyleGuidePage() {
  return (
    <main className="min-h-dvh bg-background px-4 py-8 text-foreground sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6">
          <p className="text-sm font-medium text-muted-foreground">Style guide</p>
          <h1 className="text-3xl font-semibold tracking-tight">Bounty cards</h1>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {sampleBounties.map((bounty) => (
            <BountyCard key={bounty.requirementsHash} bounty={bounty} now={styleGuideNow} href="/bounty/demo" />
          ))}
        </div>
      </div>
    </main>
  );
}

function makeBounty({
  amount,
  claimedSlots,
  deadlineOffset,
  requirementsHash,
  token,
}: {
  amount: bigint;
  claimedSlots: number;
  deadlineOffset: number;
  requirementsHash: `0x${string}`;
  token: `0x${string}`;
}): Bounty {
  return {
    poster: "0x1111111111111111111111111111111111111111",
    amount,
    winner: ZERO_ADDRESS,
    stakeRequired: 1_000000000000000000n,
    token,
    deadline: BigInt(styleGuideNow + deadlineOffset),
    maxSlots: 3,
    claimedSlots,
    bountyType: 0,
    ciRequired: true,
    targetWorker: ZERO_ADDRESS,
    status: BountyStatus.Open,
    targetRepoUrl: "https://github.com/yeheskieltame/claudelance",
    instructionUrl: "https://github.com/yeheskieltame/claudelance/issues/149",
    requirementsHash,
  };
}
