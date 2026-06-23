// The Claudelance team. Each role becomes one agent member on the shared board
// with its own API key; `taskTypes` is what that worker pulls from `whatsNext`,
// `focus` is the repo surface it owns. Add a worker = add a row here, re-run
// `clw bootstrap` (creates the member + key) and `clw kits` (writes its agent kit).

export const PROJECT = {
  key: 'CLX',
  name: 'Claudelance Core',
  description:
    'Daily collaborative improvement of Claudelance - contracts, web, relayer, coworking, SDKs, identity, docs. All coordination happens here.',
};

export const ROSTER = [
  { role: 'contracts', displayName: 'Smart Contract Engineer', taskTypes: ['code', 'code_audit'], focus: 'contracts/ (Solidity v2/v3, Foundry, UUPS, gas)' },
  { role: 'frontend',  displayName: 'Frontend / MiniApp Engineer', taskTypes: ['code', 'design', 'bug'], focus: 'apps/web/ (Next.js 15, MiniPay, wagmi/viem, shadcn)' },
  { role: 'relayer',   displayName: 'Relayer & Keeper Engineer', taskTypes: ['devops', 'code'], focus: 'apps/relayer/ (keeper, settleStake/attestReputation, gas safety)' },
  { role: 'backend',   displayName: 'Backend / Coworking Engineer', taskTypes: ['code', 'bug'], focus: 'apps/coworking-api/ (Hono, Postgres/Drizzle, REST + MCP)' },
  { role: 'sdk',       displayName: 'SDK & DX Engineer', taskTypes: ['code', 'documentation'], focus: 'packages/* (typed clients, @yeheskieltame/claudelance-*)' },
  { role: 'identity',  displayName: 'Agent Identity & Reputation Specialist', taskTypes: ['research', 'code'], focus: 'ERC-8004 registries, 8004scan, reputation bridge' },
  { role: 'security',  displayName: 'Security Auditor', taskTypes: ['code_audit'], focus: 'whole repo (threat modeling, scope/authz, reentrancy)' },
  { role: 'devrel',    displayName: 'Docs & DevRel', taskTypes: ['documentation', 'content'], focus: 'docs/, README, npm + GH Packages, examples' },
  { role: 'qa',        displayName: 'QA & Release Engineer', taskTypes: ['qa', 'devops'], focus: 'tests, CI, deploy verification' },
];

export const roleByName = (displayName) => ROSTER.find((r) => r.displayName === displayName);

// Starter backlog - real, repo-grounded improvement work. `owner` is a roster
// role (the assignee) or 'owner' (the orchestrator). `col` defaults to 'todo';
// 'in_progress' marks a standing task that should never close.
export const BACKLOG = [
  { owner: 'sdk',       type: 'code',          priority: 3, title: 'Add createMember() + createApiKey() to CoworkingClient SDK', description: 'The worker runtime had to ship its own fetch client because the SDK could not create members or keys. The methods now exist in source - rebuild + republish the SDK so external consumers get them.' },
  { owner: 'frontend',  type: 'code',          priority: 3, title: 'Point apps/web at the live coworking API', description: 'NEXT_PUBLIC_COWORKING_API_URL still defaults to localhost:8080. Set it to the live Railway URL in Vercel so the board is reachable from the web UI.' },
  { owner: 'backend',   type: 'code',          priority: 2, title: 'Expose a first-class member expertise/skills field on /members', description: 'Today expertise lives only in displayName. Add a structured field so the board and whats_next routing can filter by skill.' },
  { owner: 'contracts', type: 'code',          priority: 2, title: 'Spec v3.2: batch settleStake to cut keeper gas', description: 'The keeper pays gas per settleStake. Investigate a batched settle path and write the UUPS upgrade plan (Safe-gated).' },
  { owner: 'relayer',   type: 'devops',        priority: 2, title: 'Alert when the keeper wallet balance < 0.6 CELO', description: 'Gas spikes have starved the keeper before. Add a low-balance alert before writes start reverting.' },
  { owner: 'identity',  type: 'research',      priority: 1, title: 'Backfill ERC-8004 feedback for the newest resolved v3 bounties', description: 'Verify every resolved v3 bounty carries its +1 attestReputation feedback on the worker agent; backfill any gaps.' },
  { owner: 'security',  type: 'code_audit',    priority: 3, title: 'Re-audit webhook scopes after the 2026-06-20 viewer-exfil finding', description: 'Confirm the admin-gated webhook register/delete fix holds and hunt for sibling exfiltration paths.' },
  { owner: 'devrel',    type: 'documentation', priority: 2, title: 'Publish coworking-sdk + coworking-types GH Packages mirror', description: 'Both are live on npmjs; the GitHub Packages mirror is still pending per the repo notes.' },
  { owner: 'qa',        type: 'qa',            priority: 2, title: 'CI smoke test: boot coworking-api on pglite + seed demo', description: 'Wire a CI job that boots the API against pglite and runs the demo seed so regressions surface before deploy.' },
  { owner: 'owner',     type: 'generic',       priority: 4, col: 'in_progress', title: 'Daily standup', description: 'Every worker posts yesterday / today / blockers as a comment here at the start of its session. Keep this task open.' },
];
