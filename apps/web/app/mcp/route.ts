import { NextRequest } from "next/server";

// Stateless MCP (Model Context Protocol) server over Streamable HTTP, hand-rolled
// as plain JSON-RPC so it runs on any Vercel runtime with no Redis/session state.
// Exposes the Claudelance marketplace as read-only tools so agents/LLMs (and
// 8004scan, which health-checks MCP services + reads mcpTools) can use it.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BASE = "https://claudelance.xyz";
const SERVER = { name: "claudelance-marketplace", version: "1.0.0" };
const PROTOCOL = "2025-06-18";

const cors: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Mcp-Session-Id, Mcp-Protocol-Version, Authorization",
};

type Args = Record<string, unknown>;
type Tool = { name: string; description: string; inputSchema: object; run: (a: Args) => Promise<unknown> };

async function api(path: string): Promise<unknown> {
  const r = await fetch(`${BASE}${path}`, { headers: { accept: "application/json" } });
  if (!r.ok) throw new Error(`upstream ${r.status} for ${path}`);
  return r.json();
}

const TOOLS: Tool[] = [
  {
    name: "list_bounties",
    description: "List Claudelance marketplace bounties (onchain AI-agent tasks). Optional status filter + limit.",
    inputSchema: {
      type: "object",
      properties: {
        status: { type: "string", enum: ["open", "resolved", "all"], description: "filter by status" },
        limit: { type: "number", description: "max items, 1-50" },
      },
    },
    run: (a) =>
      api(
        `/api/bounties?limit=${Math.min(Number(a.limit) || 20, 50)}${a.status ? `&status=${encodeURIComponent(String(a.status))}` : ""}`,
      ),
  },
  {
    name: "get_bounty",
    description: "Get a single Claudelance bounty by its numeric id.",
    inputSchema: { type: "object", properties: { id: { type: "string", description: "bounty id" } }, required: ["id"] },
    run: (a) => api(`/api/bounty/${encodeURIComponent(String(a.id))}`),
  },
  {
    name: "get_stats",
    description: "Get Claudelance marketplace stats (bounties resolved, volume, protocol fees, agent counts).",
    inputSchema: { type: "object", properties: {} },
    run: () => api(`/api/stats`),
  },
  {
    name: "list_swarm",
    description: "List the Claudelance ERC-8004 agent swarm (worker agents + keeper).",
    inputSchema: { type: "object", properties: {} },
    run: () => api(`/api/swarm`),
  },
  {
    name: "get_worker",
    description: "Get a Claudelance worker agent's profile + stats by wallet address.",
    inputSchema: {
      type: "object",
      properties: { address: { type: "string", description: "0x wallet address" } },
      required: ["address"],
    },
    run: (a) => api(`/api/worker/${encodeURIComponent(String(a.address))}`),
  },
];

const ok = (id: unknown, result: unknown) => ({ jsonrpc: "2.0", id, result });
const fail = (id: unknown, code: number, message: string) => ({ jsonrpc: "2.0", id, error: { code, message } });

async function handle(msg: { id?: unknown; method?: string; params?: Record<string, unknown> } | null) {
  const id = msg?.id ?? null;
  const method = msg?.method;
  const params = msg?.params ?? {};
  if (method === "initialize") {
    return ok(id, {
      protocolVersion: (params.protocolVersion as string) || PROTOCOL,
      capabilities: { tools: {} },
      serverInfo: SERVER,
      instructions: "Read-only tools over the Claudelance onchain AI-agent task marketplace.",
    });
  }
  if (method === "ping") return ok(id, {});
  if (method === "tools/list") {
    return ok(id, { tools: TOOLS.map(({ name, description, inputSchema }) => ({ name, description, inputSchema })) });
  }
  if (method === "tools/call") {
    const tool = TOOLS.find((t) => t.name === params.name);
    if (!tool) return fail(id, -32602, `unknown tool: ${String(params.name)}`);
    try {
      const data = await tool.run((params.arguments as Args) || {});
      return ok(id, { content: [{ type: "text", text: JSON.stringify(data) }] });
    } catch (e) {
      return ok(id, { content: [{ type: "text", text: `error: ${(e as Error).message}` }], isError: true });
    }
  }
  if (typeof method === "string" && method.startsWith("notifications/")) return null; // notifications get no reply
  return fail(id, -32601, `method not found: ${String(method)}`);
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: cors });
}

export async function GET() {
  return Response.json(
    { ...SERVER, protocol: "mcp", transport: "streamable-http", endpoint: "/mcp", tools: TOOLS.map((t) => t.name) },
    { headers: cors },
  );
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json(fail(null, -32700, "parse error"), { headers: cors });
  }
  if (Array.isArray(body)) {
    const out = (await Promise.all(body.map((m) => handle(m)))).filter(Boolean);
    return Response.json(out, { headers: cors });
  }
  const res = await handle(body as { id?: unknown; method?: string; params?: Record<string, unknown> });
  if (res === null) return new Response(null, { status: 202, headers: cors });
  return Response.json(res, { headers: cors });
}
