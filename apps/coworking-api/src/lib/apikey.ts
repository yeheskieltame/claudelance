import { createHash, randomBytes } from 'node:crypto';

export interface GeneratedApiKey {
  /** The full secret - returned to the caller exactly once, never stored. */
  key: string;
  /** First 12 chars, safe to display in a UI for identification. */
  prefix: string;
  /** sha256(key) hex - what we persist and look up on auth. */
  keyHash: string;
}

export function generateApiKey(): GeneratedApiKey {
  const key = `cwk_${randomBytes(24).toString('base64url')}`;
  return { key, prefix: key.slice(0, 12), keyHash: hashApiKey(key) };
}

export function hashApiKey(key: string): string {
  return createHash('sha256').update(key).digest('hex');
}
