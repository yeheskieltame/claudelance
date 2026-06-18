// Minimal MCP server over JSON-RPC 2.0 (Streamable HTTP style: one POST /mcp).
// initialize + tools/list are open for discovery; tools/call forwards to the
// internal REST API carrying the caller's Authorization header, so the REST
// auth layer is the single source of truth and there is zero logic duplication.

import type { Context } from 'hono';

import type { AppEnv } from '../lib/context.js';
import { TOOLS } from './tools.js';

/** Calls the app's own REST surface in-process. */
export type CallApi = (
  method: string,
  path: string,
  body: unknown,
  authorization: string | undefined,
) => Promise<Response>;

const PROTOCOL_VERSION = '2024-11-05';

interface RpcMessage {
  id?: unknown;
  method?: string;
  params?: { name?: string; arguments?: Record<string, unknown> } & Record<string, unknown>;
}

const rpcResult = (id: unknown, result: unknown): object => ({ jsonrpc: '2.0', id: id ?? null, result });
const rpcError = (id: unknown, code: number, message: string): object => ({
  jsonrpc: '2.0',
  id: id ?? null,
  error: { code, message },
});

async function handleMessage(
  msg: RpcMessage,
  authorization: string | undefined,
  callApi: CallApi,
): Promise<object | null> {
  const { id, method, params } = msg;

  switch (method) {
    case 'initialize':
      return rpcResult(id, {
        protocolVersion: PROTOCOL_VERSION,
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: 'claudelance-coworking', version: '0.1.0' },
      });
    case 'ping':
      return rpcResult(id, {});
    case 'tools/list':
      return rpcResult(id, {
        tools: TOOLS.map(({ name, description, inputSchema }) => ({ name, description, inputSchema })),
      });
    case 'tools/call': {
      const name = params?.name;
      const tool = TOOLS.find((t) => t.name === name);
      if (!tool) return rpcError(id, -32602, `unknown tool: ${String(name)}`);
      let mapped: { method: string; path: string; body?: unknown };
      try {
        mapped = tool.rest(params?.arguments ?? {});
      } catch (err) {
        return rpcError(id, -32602, err instanceof Error ? err.message : 'invalid arguments');
      }
      const res = await callApi(mapped.method, mapped.path, mapped.body, authorization);
      const text = await res.text();
      return rpcResult(id, {
        content: [{ type: 'text', text: text || '{}' }],
        isError: res.status >= 400,
      });
    }
    default:
      // Notifications (no id, e.g. notifications/initialized) get no response.
      if (id === undefined) return null;
      return rpcError(id, -32601, `method not found: ${String(method)}`);
  }
}

/** Build the POST /mcp handler. */
export function mcpHandler(callApi: CallApi): (c: Context<AppEnv>) => Promise<Response> {
  return async (c) => {
    const authorization = c.req.header('authorization');
    let payload: unknown;
    try {
      payload = await c.req.json();
    } catch {
      return c.json(rpcError(null, -32700, 'parse error'), 400);
    }

    if (Array.isArray(payload)) {
      const responses = (
        await Promise.all((payload as RpcMessage[]).map((m) => handleMessage(m, authorization, callApi)))
      ).filter((r): r is object => r !== null);
      return c.json(responses);
    }

    const response = await handleMessage(payload as RpcMessage, authorization, callApi);
    if (response === null) return c.body(null, 202);
    return c.json(response);
  };
}
