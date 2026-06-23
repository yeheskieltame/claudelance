// Shared helpers: paths, env loading, logging. Zero dependencies - this runtime
// is meant to run on a bare `node` with no install step.

import { readFileSync, existsSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const PKG_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const REPO_ROOT = resolve(PKG_ROOT, '..', '..');
// Secrets + generated kits live here and are gitignored (see .gitignore).
export const LOCAL_DIR = join(PKG_ROOT, '.local');
export const WORKERS_DIR = join(PKG_ROOT, 'workers');
export const ENV_FILE = join(LOCAL_DIR, '.env.workers');
export const WORKSPACE_FILE = join(LOCAL_DIR, 'workspace.json');

/** Parse a KEY=VALUE .env file into a plain object (ignores blanks + # comments). */
function parseEnv(text) {
  const out = {};
  for (const line of text.split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq === -1) continue;
    out[t.slice(0, eq).trim()] = t.slice(eq + 1).trim();
  }
  return out;
}

/**
 * Effective config: .env.workers as the base, real process.env wins on top, so
 * an operator can override any key (URL, a worker key) from the shell.
 */
export function loadEnv() {
  const fromFile = existsSync(ENV_FILE) ? parseEnv(readFileSync(ENV_FILE, 'utf8')) : {};
  return { ...fromFile, ...process.env };
}

export function baseUrl(env = loadEnv()) {
  const url = env.COWORKING_API_URL;
  if (!url) throw new Error('COWORKING_API_URL is not set (run bootstrap, or export it).');
  return url.replace(/\/+$/, '');
}

/** Env var name carrying a given role's API key, e.g. CLW_KEY_CONTRACTS. */
export const keyVar = (role) => `CLW_KEY_${role.toUpperCase()}`;

export const log = (...a) => console.log(...a);
export const die = (msg) => {
  console.error(typeof msg === 'string' ? msg : (msg?.message ?? String(msg)));
  process.exit(1);
};
