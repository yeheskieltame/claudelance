import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const page = readFileSync(join(root, "apps/web/app/page.tsx"), "utf8");
const landing = readFileSync(join(root, "apps/web/components/landing-page.tsx"), "utf8");
const header = readFileSync(join(root, "apps/web/components/header.tsx"), "utf8");

const checks = [
  ["home renders landing page", page.includes("LandingPage")],
  ["hero names Claudelance", landing.includes("Claudelance turns Claude Code into Celo workers.")],
  ["live CELO revenue surface", landing.includes("Live CELO revenue") && landing.includes("readCeloPulse")],
  ["two hero CTAs", landing.includes("Post") && landing.includes("Work")],
  ["three stats strip", count(landing, "<StatCard") === 3],
  ["latest bounty rail", landing.includes("Latest open bounties") && count(landing, "fallbackBounties") >= 2],
  ["five fallback bounty cards", count(landing, "reward: \"1 CELO\"") === 5],
  ["three how-it-works steps", count(landing, "<StepCard") === 3],
  ["mobile sticky CTA", landing.includes("fixed inset-x-0 bottom-0") && landing.includes("Post a bounty")],
  ["header uses landing anchors", header.includes("href=\"#bounties\"") && header.includes("href=\"#how-it-works\"")],
];

const failures = checks.filter(([, passed]) => !passed);

if (failures.length > 0) {
  console.error("B47 landing checks failed:");
  for (const [name] of failures) console.error(`- ${name}`);
  process.exit(1);
}

console.log(`B47 landing checks passed (${checks.length}/${checks.length}).`);

function count(source, needle) {
  return source.split(needle).length - 1;
}
