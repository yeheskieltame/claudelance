import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const page = readFileSync(join(root, "apps/web/app/bounty/[id]/page.tsx"), "utf8");
const component = readFileSync(join(root, "apps/web/components/bounty-detail-page.tsx"), "utf8");

const expectations = [
  [page.includes("BountyDetailPage"), "route renders BountyDetailPage"],
  [component.includes("fetch(`/api/bounty/${encodeURIComponent(bountyId)}`"), "page reads /api/bounty/[id]"],
  [component.includes("useWriteContract"), "uses wagmi useWriteContract"],
  [component.includes('functionName: "claimSlot"'), "claimSlot write is wired"],
  [component.includes('functionName: "submitPR"'), "submitPR write is wired"],
  [component.includes('functionName: "pickWinner"'), "pickWinner write is wired"],
  [component.includes('data-role-branch={branch}'), "role branch is exposed for smoke checks"],
  [component.includes('"poster-pick-winner"'), "poster winner branch exists"],
  [component.includes('"worker-submit-pr"'), "claimer submit branch exists"],
  [component.includes('"visitor-claim-slot"'), "visitor claim branch exists"],
  [component.includes("useTransactionToast"), "transaction toast feedback is connected"],
  [component.includes("normalizeCommitHash"), "commit hash is normalized before submitPR"],
];

const failures = expectations.filter(([ok]) => !ok).map(([, message]) => message);

if (failures.length) {
  console.error(failures.map((failure) => `Missing: ${failure}`).join("\n"));
  process.exit(1);
}

console.log("B49 bounty detail page wiring looks complete.");
