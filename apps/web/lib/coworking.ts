import { CoworkingClient } from "@yeheskieltame/claudelance-coworking-sdk";

/**
 * Base URL of the Coworking API. The browser talks to it directly with a
 * workspace API key (CORS is enabled server-side). Defaults to the live Railway
 * service so the board works out of the box; set NEXT_PUBLIC_COWORKING_API_URL
 * to override (e.g. http://localhost:8080 for local backend dev).
 *
 * NOTE: env vars are baked in at build time, so the Vercel production project
 * must also set NEXT_PUBLIC_COWORKING_API_URL to this live URL (Vercel env can
 * only be set from the dashboard/CLI, not from this repo).
 */
export const COWORKING_API_URL =
  process.env.NEXT_PUBLIC_COWORKING_API_URL?.replace(/\/+$/, "") ||
  "https://coworking-api-production-7f61.up.railway.app";

// Workspace API key is the user's own credential; we keep it client-side only.
const STORAGE_KEY = "claudelance.coworking.apikey";

export function loadStoredKey(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(STORAGE_KEY);
}

export function storeKey(key: string): void {
  if (typeof window !== "undefined") window.localStorage.setItem(STORAGE_KEY, key);
}

export function clearStoredKey(): void {
  if (typeof window !== "undefined") window.localStorage.removeItem(STORAGE_KEY);
}

export function makeCoworkingClient(apiKey?: string): CoworkingClient {
  return new CoworkingClient({ baseUrl: COWORKING_API_URL, apiKey });
}

// React Query key factory - keeps cache keys consistent across components.
export const cwKeys = {
  workspace: ["coworking", "workspace"] as const,
  projects: ["coworking", "projects"] as const,
  project: (id: string) => ["coworking", "project", id] as const,
  columns: (projectId: string) => ["coworking", "columns", projectId] as const,
  tasks: (projectId: string) => ["coworking", "tasks", projectId] as const,
  task: (id: string) => ["coworking", "task", id] as const,
  comments: (taskId: string) => ["coworking", "comments", taskId] as const,
  reviews: (taskId: string) => ["coworking", "reviews", taskId] as const,
  watchers: (taskId: string) => ["coworking", "watchers", taskId] as const,
  templates: (projectId?: string) => ["coworking", "templates", projectId ?? "all"] as const,
  labels: (projectId: string) => ["coworking", "labels", projectId] as const,
  members: ["coworking", "members"] as const,
  me: ["coworking", "me"] as const,
  myTasks: ["coworking", "me", "tasks"] as const,
  myReviews: ["coworking", "me", "reviews"] as const,
  whatsNext: (projectId: string) => ["coworking", "next", projectId] as const,
  activity: (projectId?: string) => ["coworking", "activity", projectId ?? "all"] as const,
};
