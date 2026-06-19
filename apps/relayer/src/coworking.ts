// Tiny typed HTTP client for the off-chain Coworking API, used only by the
// reputation bridge. Plain `fetch` + a Bearer header - NO web3, NO coworking-sdk
// dependency, so the relayer image stays unchanged. Shapes mirror
// PendingReputationItem in @yeheskieltame/claudelance-coworking-types; we inline
// them here to avoid pulling the package into the relayer build.

/**
 * One approved task review owed an on-chain reputation signal, as served by
 * GET /v1/reputation/pending. On-chain ids are decimal strings (JSON-safe).
 */
export type PendingReputationItem = {
  /** = TaskReview.id; the idempotency unit acked back via POST /reputation/ack. */
  reviewId: string;
  taskId: string;
  taskNumber: number;
  /** Coworking task type string; mapped to an on-chain bounty type for tag2. */
  taskType: string;
  projectId: string;
  /** The project's linked marketplace bounty id (decimal string), if any. */
  linkedBountyId: string | null;
  /** ERC-8004 agent id of the assignee member (decimal string). */
  agentId: string;
  assigneeMemberId: string;
  /** ISO-8601 timestamp the approving review was recorded. */
  reviewedAt: string;
  /** Optional 1-5 quality score from the review. */
  score: number | null;
};

export type PendingReputationPage = {
  items: PendingReputationItem[];
  /** Review-createdAt cursor to pass as `since` on the next poll, or null. */
  nextCursor: string | null;
};

export type AckReputationBody = {
  reviewId: string;
  /** Present on the live path; omitted in dry-run (which never acks anyway). */
  txHash?: string;
  agentId: string;
};

function authHeaders(key: string): Record<string, string> {
  return { authorization: `Bearer ${key}`, accept: 'application/json' };
}

/** Trim a trailing slash so `${base}/v1/...` never doubles up. */
function joinUrl(base: string, path: string): string {
  return `${base.replace(/\/+$/, '')}${path}`;
}

/**
 * Fetch the next page of pending reputation write-backs for the workspace the
 * key authorizes. `since` is the review-createdAt cursor from a prior page.
 */
export async function listPendingReputation(
  baseUrl: string,
  key: string,
  opts: { since?: string; limit?: number } = {},
): Promise<PendingReputationPage> {
  const url = new URL(joinUrl(baseUrl, '/v1/reputation/pending'));
  if (opts.since !== undefined) url.searchParams.set('since', opts.since);
  if (opts.limit !== undefined) url.searchParams.set('limit', String(opts.limit));

  const res = await fetch(url, { headers: authHeaders(key) });
  if (!res.ok) {
    throw new Error(`[relayer] coworking pending ${res.status}: ${await res.text().catch(() => '')}`);
  }
  return (await res.json()) as PendingReputationPage;
}

/**
 * Record that the relayer has handled a review (idempotent upsert server-side).
 * Only the live path calls this; dry-run never acks.
 */
export async function ackReputation(
  baseUrl: string,
  key: string,
  body: AckReputationBody,
): Promise<void> {
  const res = await fetch(joinUrl(baseUrl, '/v1/reputation/ack'), {
    method: 'POST',
    headers: { ...authHeaders(key), 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`[relayer] coworking ack ${res.status}: ${await res.text().catch(() => '')}`);
  }
}
