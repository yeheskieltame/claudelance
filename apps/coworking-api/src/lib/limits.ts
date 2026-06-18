// Premium gating (billing deferred). Free workspaces are capped; a workspace
// with is_premium = true bypasses the caps. Limits are read once from the
// environment so they can be tuned per-deployment; set COWORKING_ENFORCE_LIMITS=false
// to disable gating entirely (handy for local dev / dogfooding).

function parseBool(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined || value === "") return fallback;
  return value === "1" || value.toLowerCase() === "true";
}

export const LIMITS = {
  enforce: parseBool(process.env.COWORKING_ENFORCE_LIMITS, true),
  freeMaxProjects: Number(process.env.COWORKING_FREE_MAX_PROJECTS ?? 3),
  freeMaxTasksPerProject: Number(process.env.COWORKING_FREE_MAX_TASKS_PER_PROJECT ?? 100),
};
