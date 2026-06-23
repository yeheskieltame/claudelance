import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const page = readFileSync(join(root, "apps/web/app/post/page.tsx"), "utf8");
const component = readFileSync(join(root, "apps/web/components/post-bounty-page.tsx"), "utf8");

const expectations = [
  [page.includes("PostBountyPage"), "route renders PostBountyPage"],
  [component.includes("z.object"), "uses Zod validation"],
  [component.includes('z.enum(["cUSD", "CELO", "USDC"])'), "token select validates cUSD/CELO/USDC"],
  [component.includes("repoUrl") && component.includes("issueUrl"), "repo and issue fields exist"],
  [component.includes("stake") && component.includes("maxSlots") && component.includes("deadline"), "rules fields exist"],
  [component.includes('functionName: "approve"'), "approve(token) write is wired"],
  [component.includes('functionName: "postBounty"'), "postBounty write is wired"],
  [component.includes("useWriteContract"), "uses wagmi useWriteContract"],
  [component.includes("useTransactionToast"), "transaction toast feedback is connected"],
  [component.includes('data-step={step}'), "current step is exposed for smoke checks"],
  [component.includes("Mobile") === false, "does not rely on instructional mobile copy"],
];

const failures = expectations.filter(([ok]) => !ok).map(([, message]) => message);

if (failures.length) {
  console.error(failures.map((failure) => `Missing: ${failure}`).join("\n"));
  process.exit(1);
}

console.log("B50 post bounty page wiring looks complete.");
