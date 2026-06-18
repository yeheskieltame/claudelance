import { CoworkingClient } from "@yeheskieltame/claudelance-coworking-sdk";

/**
 * Base URL of the Coworking API. The browser talks to it directly with a
 * workspace API key (CORS is enabled server-side). Falls back to localhost for
 * dev before the Railway service is provisioned.
 */
export const COWORKING_API_URL =
  process.env.NEXT_PUBLIC_COWORKING_API_URL?.replace(/\/+$/, "") || "http://localhost:8080";

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
  members: ["coworking", "members"] as const,
  myTasks: ["coworking", "me", "tasks"] as const,
  whatsNext: (projectId: string) => ["coworking", "next", projectId] as const,
  activity: (projectId?: string) => ["coworking", "activity", projectId ?? "all"] as const,
};
