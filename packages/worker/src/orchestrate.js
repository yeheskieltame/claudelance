// Tech Lead view, run with the owner key. `status` prints the board grouped by
// column; `orchestrate` shows the review inbox (tasks awaiting the lead's verdict)
// and can approve/request-changes on one. The lead does NOT auto-merge - a human
// or the lead's own judgement gates each verdict.

import { CoworkingApi } from './api.js';
import { PROJECT } from './roster.js';
import { loadEnv, baseUrl, log, die } from './util.js';

function ownerApi() {
  const env = loadEnv();
  const ownerKey = env.CLW_OWNER_KEY || env.COWORKING_API_KEY;
  if (!ownerKey) die('Need the owner key: set CLW_OWNER_KEY (run bootstrap first).');
  return new CoworkingApi(baseUrl(env), ownerKey);
}

export async function status() {
  const api = ownerApi();
  const ws = await api.getWorkspace();
  const members = await api.listMembers();
  const project = (await api.listProjects()).find((p) => p.key === PROJECT.key);
  log(`# ${ws.name}  -  ${members.length} members`);
  if (!project) return log(`(no ${PROJECT.key} project yet - run bootstrap)`);

  const cols = await api.listColumns(project.id);
  const tasks = await api.listTasks(project.id);
  const colName = Object.fromEntries(cols.map((c) => [c.id, c.name]));
  const byName = Object.fromEntries(members.map((m) => [m.id, m.displayName]));
  const grouped = {};
  for (const t of tasks) (grouped[colName[t.statusColumnId] ?? '?'] ||= []).push(t);
  for (const c of cols) {
    const list = grouped[c.name] ?? [];
    if (!list.length) continue;
    log(`\n## ${c.name} (${list.length})`);
    for (const t of list.sort((a, b) => b.priority - a.priority)) {
      log(`  #${t.number} [${t.type}] ${t.title}  -> ${byName[t.assigneeMemberId] ?? 'unassigned'}`);
    }
  }
}

export async function orchestrate(args) {
  const api = ownerApi();
  const [sub, taskId] = args;

  if (sub === 'approve' || sub === 'reject' || sub === 'changes') {
    if (!taskId) die(`usage: clw orchestrate ${sub} <taskId>`);
    const verdict = sub === 'approve' ? 'approved' : sub === 'reject' ? 'rejected' : 'changes_requested';
    await api.submitReview(taskId, { verdict });
    return log(`task ${taskId}: ${verdict}`);
  }

  const inbox = await api.myReviews();
  if (!inbox.length) return log('review inbox empty.');
  log(`# Review inbox (${inbox.length})`);
  for (const t of inbox) log(`  #${t.number} [${t.type}] ${t.title}  (id ${t.id})`);
  log(`\napprove: clw orchestrate approve <taskId>   (or: changes / reject)`);
}
