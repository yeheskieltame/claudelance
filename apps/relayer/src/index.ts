import { serve } from '@hono/node-server';

import { ChainClient } from './chain.js';
import { loadConfig } from './config.js';
import { ackReputation, listPendingReputation } from './coworking.js';
import { createKeeperState, runKeeperTick } from './keeper.js';
import { createBridgeState, runReputationBridgeTick } from './reputation-bridge.js';
import { createServer } from './server.js';

async function main(): Promise<void> {
  const cfg = loadConfig();
  const chain = new ChainClient(cfg);

  // Single signer, single nonce lane. The keeper tick, the CI webhook, and the
  // reputation bridge all broadcast from the same relayer key. A keeper tick awaits
  // all its receipts before returning, so serializing these three paths through one
  // lock guarantees no two ever have an unmined tx in flight at once - which is what
  // stops them from racing the shared nonce and silently dropping each other's txs.
  let signerLock: Promise<unknown> = Promise.resolve();
  const withSigner = <T>(fn: () => Promise<T>): Promise<T> => {
    const result = signerLock.then(fn, fn);
    signerLock = result.then(() => undefined, () => undefined);
    return result;
  };

  const app = createServer({ chain, cfg, withSigner });

  serve({ fetch: app.fetch, port: cfg.port });
  console.log(
    JSON.stringify({
      message: 'relayer.start',
      network: cfg.network,
      core: chain.core,
      relayer: chain.relayerAddress ?? null,
      dryRun: cfg.dryRun,
      port: cfg.port,
    }),
  );

  const keeperState = createKeeperState();
  // Overlap guard: a tick triggered while one is running queues exactly one
  // follow-up instead of stacking.
  let running = false;
  let queued = false;
  const tick = async (): Promise<void> => {
    if (running) {
      queued = true;
      return;
    }
    running = true;
    try {
      do {
        queued = false;
        await withSigner(() => runKeeperTick(chain, cfg, undefined, keeperState)).catch(
          (err: unknown) =>
            console.error(JSON.stringify({ message: 'keeper.tick.fatal', error: String(err) })),
        );
      } while (queued);
    } finally {
      running = false;
    }
  };

  await tick();
  const timer = setInterval(() => void tick(), cfg.keeperIntervalMs);

  // Instant reaction: a resolution or new deliverable triggers a tick within
  // one poll interval instead of waiting out the timer.
  const unwatch = chain.watchKeeperEvents(cfg.eventPollMs, (eventName) => {
    console.log(JSON.stringify({ message: 'keeper.event-trigger', eventName }));
    void tick();
  });

  // The Coworking -> ERC-8004 reputation bridge runs on its OWN independent
  // clock (NOT inside the keeper tick) and only when explicitly enabled. It
  // ships dormant: REPUTATION_BRIDGE_ENABLED gates scheduling, and even when
  // scheduled REPUTATION_BRIDGE_DRY_RUN (default true) keeps it observational.
  let bridgeTimer: ReturnType<typeof setInterval> | undefined;
  if (cfg.reputationBridgeEnabled) {
    const bridgeState = createBridgeState();
    const bridgeDeps = {
      chain,
      listPending: listPendingReputation,
      ack: ackReputation,
    };
    // Independent overlap guard so a slow bridge poll never stacks.
    let bridgeRunning = false;
    let bridgeQueued = false;
    const bridgeTick = async (): Promise<void> => {
      if (bridgeRunning) {
        bridgeQueued = true;
        return;
      }
      bridgeRunning = true;
      try {
        do {
          bridgeQueued = false;
          await withSigner(() => runReputationBridgeTick(bridgeDeps, cfg, bridgeState)).catch(
            (err: unknown) =>
              console.error(JSON.stringify({ message: 'bridge.tick.fatal', error: String(err) })),
          );
        } while (bridgeQueued);
      } finally {
        bridgeRunning = false;
      }
    };
    console.log(
      JSON.stringify({
        message: 'bridge.start',
        coworkingApiUrl: cfg.coworkingApiUrl,
        workspaces: cfg.coworkingApiKeys.length,
        dryRun: cfg.reputationBridgeDryRun,
        intervalMs: cfg.reputationBridgeIntervalMs,
      }),
    );
    void bridgeTick();
    bridgeTimer = setInterval(() => void bridgeTick(), cfg.reputationBridgeIntervalMs);
  }

  const shutdown = (): void => {
    clearInterval(timer);
    if (bridgeTimer) clearInterval(bridgeTimer);
    unwatch();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err: unknown) => {
  console.error(JSON.stringify({ message: 'relayer.fatal', error: String(err) }));
  process.exit(1);
});
