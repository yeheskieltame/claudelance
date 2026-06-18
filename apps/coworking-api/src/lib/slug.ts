import { eq } from 'drizzle-orm';

import type { Database } from '../db/client.js';
import { workspaces } from '../db/schema.js';

export function slugify(input: string): string {
  const base = input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return base || 'workspace';
}

/** Append -2, -3, ... until the slug is free. */
export async function uniqueWorkspaceSlug(db: Database, base: string): Promise<string> {
  let slug = base;
  let n = 1;
  for (;;) {
    const rows = await db
      .select({ id: workspaces.id })
      .from(workspaces)
      .where(eq(workspaces.slug, slug))
      .limit(1);
    if (rows.length === 0) return slug;
    n += 1;
    slug = `${base}-${n}`.slice(0, 60);
  }
}
