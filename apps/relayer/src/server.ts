import { Hono } from 'hono';

import type { ChainClient } from './chain.js';
import type { RelayerConfig } from './config.js';
import { parseCiWebhook, verifyGithubSignature } from './github.js';
import { handleCiWebhook, type Logger } from './keeper.js';

export type ServerDeps = {
  chain: ChainClient;
  cfg: RelayerConfig;
  log?: Logger;
  // Serializes the webhook's signing against the keeper tick + reputation bridge
  // so the shared relayer key never races its nonce. Optional for standalone use.
  withSigner?: <T>(fn: () => Promise<T>) => Promise<T>;
};

const defaultServerLog: Logger = (message, meta) =>
  console.log(JSON.stringify({ t: new Date().toISOString(), message, ...meta }));

/** Build the keeper's HTTP surface: a status root, a health probe, and the GitHub CI webhook. */
export function createServer({ chain, cfg, log, withSigner }: ServerDeps): Hono {
  const app = new Hono();

  app.get('/', (c) =>
    c.json({
      name: 'Claudelance Protocol Keeper',
      role: 'ERC-8004 agent: CI attestation relayer + permissionless settlement keeper',
      network: cfg.network,
      core: chain.core,
      relayer: chain.relayerAddress ?? null,
      dryRun: cfg.dryRun,
    }),
  );

  app.get('/health', async (c) => {
    const balanceWei = await chain.relayerBalance().catch(() => null);
    return c.json({
      ok: true,
      network: cfg.network,
      core: chain.core,
      relayerBalanceWei: balanceWei === null ? null : balanceWei.toString(),
      lowBalance: balanceWei !== null && balanceWei < 300_000_000_000_000_000n,
    });
  });

  app.post('/webhooks/github', async (c) => {
    if (!cfg.githubWebhookSecret) {
      return c.json({ error: 'webhook secret not configured' }, 503);
    }

    const raw = await c.req.text();
    const signature = c.req.header('x-hub-signature-256');
    if (!verifyGithubSignature(raw, signature, cfg.githubWebhookSecret)) {
      return c.json({ error: 'invalid signature' }, 401);
    }

    let payload: unknown;
    try {
      payload = JSON.parse(raw);
    } catch {
      return c.json({ error: 'invalid json' }, 400);
    }

    const event = parseCiWebhook(payload);
    if (!event) {
      return c.json({ ignored: true, reason: 'not a CI run event' }, 202);
    }

    try {
      const run = (): Promise<Awaited<ReturnType<typeof handleCiWebhook>>> =>
        handleCiWebhook(chain, cfg, event, log);
      const result = withSigner ? await withSigner(run) : await run();
      return c.json(result, 202);
    } catch (err) {
      // A chain read failed (RPC down/slow). Report it instead of leaking a 500;
      // GitHub retries failed webhook deliveries.
      const message = err instanceof Error ? err.message : String(err);
      (log ?? defaultServerLog)('webhook.error', { error: message });
      return c.json({ error: 'upstream chain read failed', detail: message }, 502);
    }
  });

  return app;
}
