import { existsSync, readFileSync } from "node:fs";

const files = [
  "apps/web/app/bounties/page.tsx",
  "apps/web/components/bounties-feed.tsx",
];

const missing = files.filter((file) => !existsSync(file));
if (missing.length > 0) {
  console.error(`Missing expected B48 file(s): ${missing.join(", ")}`);
  process.exit(1);
}

const page = readFileSync(files[0], "utf8");
const feed = readFileSync(files[1], "utf8");

const expectations = [
  [page, "BountiesFeed", "the /bounties route renders the feed component"],
  [feed, "/api/bounties", "feed fetches from /api/bounties"],
  [feed, "All", "feed includes the All filter pill"],
  [feed, "cUSD", "feed includes the cUSD filter pill"],
  [feed, "CELO", "feed includes the CELO filter pill"],
  [feed, "USDC", "feed includes the USDC filter pill"],
  [feed, "Open", "feed includes the Open filter pill"],
  [feed, "Resolved", "feed includes the Resolved filter pill"],
  [feed, "IntersectionObserver", "feed loads the next page at scroll end"],
  [feed, "grid-cols-1", "feed renders a one-column phone grid"],
  [feed, "md:grid-cols-2", "feed renders a two-column tablet grid"],
  [feed, "lg:grid-cols-3", "feed renders a three-column desktop grid"],
  [feed, "Post a bounty", "feed has an empty-state CTA"],
];

const failures = expectations
  .filter(([source, token]) => !source.includes(token))
  .map(([, , message]) => message);

if (failures.length > 0) {
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log("Bounties feed page contract is present.");
