import assert from "node:assert/strict";
import test from "node:test";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { Bounty } from "@yeheskieltame/claudelance-types";
import { BountyStatus, MAINNET, ZERO_ADDRESS } from "@yeheskieltame/claudelance-types";

import { BountyCard } from "./bounty-card";

const now = Date.UTC(2026, 4, 16, 3, 0, 0) / 1000;

const bounty: Bounty = {
  poster: "0x1111111111111111111111111111111111111111",
  amount: 125_000000000000000000n,
  winner: ZERO_ADDRESS,
  stakeRequired: 1_000000000000000000n,
  token: MAINNET.tokens.cUSD,
  deadline: BigInt(now + 3 * 86_400 + 4 * 3_600),
  maxSlots: 3,
  claimedSlots: 1,
  bountyType: 0,
  ciRequired: true,
  targetWorker: ZERO_ADDRESS,
  status: BountyStatus.Open,
  targetRepoUrl: "https://github.com/yeheskieltame/claudelance",
  instructionUrl: "https://github.com/yeheskieltame/claudelance/issues/149",
  requirementsHash: "0x1111111111111111111111111111111111111111111111111111111111111111",
};

test("BountyCard snapshot", () => {
  const html = renderToStaticMarkup(
    React.createElement(BountyCard, { bounty, now, href: "/bounty/demo" }),
  );

  assert.equal(
    html,
    '<article class="w-full rounded-lg border border-border bg-card text-card-foreground shadow-sm transition duration-200 ease-out [@media(hover:hover)]:hover:-translate-y-1 [@media(hover:hover)]:hover:shadow-glow focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 focus-within:ring-offset-background" data-token="cUSD"><a href="/bounty/demo" class="block p-4 outline-none sm:p-5"><div class="flex items-start justify-between gap-3"><div class="min-w-0"><h3 class="line-clamp-1 text-base font-semibold leading-6">yeheskieltame/claudelance bounty</h3><p class="mt-1 line-clamp-2 text-sm leading-5 text-muted-foreground">CI required for requirements 0x11111111...111111 from github.com.</p></div><span class="shrink-0 rounded-full border px-2.5 py-1 text-xs font-semibold text-muted-foreground">1/3</span></div><footer class="mt-4 flex items-center justify-between gap-3 text-sm"><span class="inline-flex min-w-0 items-center rounded-full border px-3 py-1 text-xs font-semibold border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200">125 cUSD</span><span class="shrink-0 text-xs font-medium text-muted-foreground">Due in 3d 4h</span></footer></a></article>',
  );
});
