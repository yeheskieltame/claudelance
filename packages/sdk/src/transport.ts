import { fallback, http, type Transport } from 'viem';

/**
 * RPC inputs shared by every client factory. `rpcUrl` stays for back-compat;
 * `rpcUrls` lets production deployments pass several endpoints for redundancy.
 */
export type RpcInput = {
  /** Single RPC URL. Falls back to the chain's default when omitted. */
  rpcUrl?: string;
  /**
   * Multiple RPC URLs. When two or more are given the SDK builds a viem
   * `fallback` transport, so a single endpoint outage or rate-limit does not
   * stall an agent. Takes precedence over `rpcUrl`.
   */
  rpcUrls?: string[];
};

/**
 * Tuning shared by every endpoint:
 * - `batch`: coalesce concurrent eth_calls into one JSON-RPC request. At swarm
 *   scale (many multicalls per tick) this is the single biggest round-trip win.
 * - `retryCount`/`retryDelay`: ride out forno's transient 5xx + replica lag
 *   instead of surfacing them to the caller.
 * - `timeout`: bound a hung endpoint so `fallback` can move on.
 */
const HTTP_CONFIG = {
  batch: true,
  retryCount: 3,
  retryDelay: 250,
  timeout: 30_000,
} as const;

/**
 * Build a tuned viem transport from {@link RpcInput}. One URL → a single tuned
 * `http`; several → a `fallback` over all of them; none → the chain default,
 * still tuned. Used by every `ClaudelanceClient` factory so production callers
 * get batching, retries, and multi-RPC redundancy without extra wiring.
 */
export function buildTransport(opts: RpcInput = {}): Transport {
  const urls =
    opts.rpcUrls && opts.rpcUrls.length > 0
      ? opts.rpcUrls
      : opts.rpcUrl
        ? [opts.rpcUrl]
        : [];

  if (urls.length === 0) return http(undefined, HTTP_CONFIG);
  if (urls.length === 1) return http(urls[0], HTTP_CONFIG);
  return fallback(
    urls.map((url) => http(url, HTTP_CONFIG)),
    // rank: false → deterministic order (primary first), fall through on error,
    // rather than continuously latency-ranking and reordering endpoints.
    { rank: false },
  );
}
