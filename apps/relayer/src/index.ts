import { serve } from '@hono/node-server';

import { ChainClient } from './chain.js';
import { loadConfig } from './config.js';
import { createKeeperState, runKeeperTick } from './keeper.js';
import { createServer } from './server.js';

async function main(): Promise<void> {
  const cfg = loadConfig();
  const chain = new ChainClient(cfg);
  const app = createServer({ chain, cfg });

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
        await runKeeperTick(chain, cfg, undefined, keeperState).catch((err: unknown) =>
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

  const shutdown = (): void => {
    clearInterval(timer);
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
