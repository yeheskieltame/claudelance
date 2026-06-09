import { serve } from '@hono/node-server';

import { ChainClient } from './chain.js';
import { loadConfig } from './config.js';
import { runKeeperTick } from './keeper.js';
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

  const tick = (): Promise<unknown> =>
    runKeeperTick(chain, cfg).catch((err: unknown) =>
      console.error(JSON.stringify({ message: 'keeper.tick.fatal', error: String(err) })),
    );

  await tick();
  const timer = setInterval(tick, cfg.keeperIntervalMs);

  const shutdown = (): void => {
    clearInterval(timer);
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err: unknown) => {
  console.error(JSON.stringify({ message: 'relayer.fatal', error: String(err) }));
  process.exit(1);
});
