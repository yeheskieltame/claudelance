export interface CoworkingConfig {
  databaseUrl: string;
  port: number;
  nodeEnv: string;
  /** Run pending migrations before serving. */
  migrateOnStart: boolean;
}

function parseBool(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined || value === '') return fallback;
  return value === '1' || value.toLowerCase() === 'true';
}

/**
 * Build the API config from the environment. Fails fast without DATABASE_URL so
 * a misconfigured deploy never boots into a broken half-state.
 */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): CoworkingConfig {
  const databaseUrl = env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('[coworking-api] DATABASE_URL is required');
  }

  return {
    databaseUrl,
    port: Number(env.PORT ?? 8080),
    nodeEnv: env.NODE_ENV ?? 'development',
    migrateOnStart: parseBool(env.MIGRATE_ON_START, true),
  };
}
