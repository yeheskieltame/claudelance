// Bootstrap the shared Claudelance workspace: ensure every roster role exists as
// an agent member with its own API key, ensure the CLX project + board, and seed
// the starter backlog assigned per expertise. Idempotent - re-running only fills
// gaps (matches members by displayName, tasks by title), never duplicates.
//
// Needs an owner/admin key: CLW_OWNER_KEY (or COWORKING_API_KEY) + COWORKING_API_URL.
// Writes the per-role keys to .local/.env.workers and the id map to
// .local/workspace.json (both gitignored).

import { mkdirSync, writeFileSync } from 'node:fs';

import { CoworkingApi } from './api.js';
import { ROSTER, PROJECT, BACKLOG } from './roster.js';
import { loadEnv, baseUrl, keyVar, LOCAL_DIR, ENV_FILE, WORKSPACE_FILE, log } from './util.js';

export async function bootstrap() {
  const env = loadEnv();
  const url = baseUrl(env);
  const ownerKey = env.CLW_OWNER_KEY || env.COWORKING_API_KEY;
  if (!ownerKey) throw new Error('Need an owner/admin key: set CLW_OWNER_KEY (or COWORKING_API_KEY).');
  const api = new CoworkingApi(url, ownerKey);

  const me = await api.getMe();
  const workspace = await api.getWorkspace();
  log(`workspace ${workspace.slug} (${workspace.name}) as ${me.displayName} [${me.role}]`);

  const members = await api.listMembers();
  const owner = members.find((m) => m.role === 'owner') ?? me;

  // Preserve any keys already issued (recorded in .env.workers); only mint new ones.
  const keys = {};
  for (const r of ROSTER) if (env[keyVar(r.role)]) keys[r.role] = env[keyVar(r.role)];

  const memberIdByRole = {};
  for (const r of ROSTER) {
    let m = members.find((x) => x.displayName === r.displayName);
    if (!m) {
      m = await api.createMember({ displayName: r.displayName, kind: 'agent', role: 'member' });
      log(`+ member ${r.displayName}`);
    }
    memberIdByRole[r.role] = m.id;
    if (!keys[r.role]) {
      const k = await api.createApiKey({ memberId: m.id, name: r.role, scopes: ['read', 'write'] });
      keys[r.role] = k.key;
      log(`  key issued -> ${r.role}`);
    }
  }

  let project = (await api.listProjects()).find((p) => p.key === PROJECT.key);
  if (!project) {
    project = await api.createProject(PROJECT);
    log(`+ project ${project.key} (${project.name})`);
  }

  const existing = await api.listTasks(project.id);
  for (const t of BACKLOG) {
    if (existing.some((x) => x.title === t.title)) continue;
    const assigneeMemberId = t.owner === 'owner' ? owner.id : memberIdByRole[t.owner];
    await api.createTask({
      projectId: project.id,
      title: t.title,
      description: t.description,
      type: t.type,
      priority: t.priority,
      assigneeMemberId,
      reviewerMemberId: owner.id,
      statusColumnKey: t.col ?? 'todo',
    });
    log(`+ task -> ${t.owner}: ${t.title}`);
  }

  mkdirSync(LOCAL_DIR, { recursive: true });
  const envLines = [
    `COWORKING_API_URL=${url}`,
    `CLW_OWNER_KEY=${ownerKey}`,
    ...ROSTER.map((r) => `${keyVar(r.role)}=${keys[r.role]}`),
  ];
  writeFileSync(ENV_FILE, envLines.join('\n') + '\n');
  writeFileSync(
    WORKSPACE_FILE,
    JSON.stringify({ baseUrl: url, workspace, project, ownerMemberId: owner.id, members: memberIdByRole }, null, 2),
  );
  log(`\nwrote ${ENV_FILE}`);
  log(`wrote ${WORKSPACE_FILE}`);
  log(`\nNext: \`clw kits\` to generate each worker's agent kit.`);
  return { project, memberIdByRole, ownerMemberId: owner.id };
}
