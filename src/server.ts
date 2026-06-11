import { logInfo, logError, keyPreview } from "./logger.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import crypto from "node:crypto";

const TAVILY_API_BASE = "https://api.tavily.com";

function getApiKeys(): string[] {
  const raw = process.env.TAVILY_API_KEYS || "";
  const keys = raw.split(",").map(k => k.trim()).filter(Boolean);
  if (keys.length === 0) {
    throw new Error("TAVILY_API_KEYS must contain at least one API key");
  }
  return keys;
}

function pickRandomKey(): string {
  const keys = getApiKeys();
  return keys[crypto.randomInt(keys.length)];
}

function sanitizeSearchResponse(data: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {
    query: data.query,
    results: data.results,
  };
  if (data.answer) result.answer = data.answer;
  if (Array.isArray(data.images) && data.images.length > 0) result.images = data.images;
  return result;
}

function sanitizeExtractResponse(data: Record<string, unknown>): Record<string, unknown> {
  return {
    results: data.results,
    failed_results: data.failed_results,
  };
}

export function createServer(): McpServer {
  const server = new McpServer({
    name: "tavily-mcp-proxy",
    version: "1.0.0",
  });

  server.registerTool(
    "tavily_search",
    {
      title: "Tavily Search",
      description: "Search the web using Tavily Search API",
      inputSchema: { query: z.string() } as any,
    },
    async (args: any) => {
      const { query } = args as { query: string };
      const apiKey = pickRandomKey();
      logInfo("tavily_search called", { query, key: keyPreview(apiKey) });

      const body = { query, max_results: 10 };
      const startTime = Date.now();

      const res = await fetch(TAVILY_API_BASE + "/search", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + apiKey,
        },
        body: JSON.stringify(body),
      });

      const elapsed = Date.now() - startTime;

      if (!res.ok) {
        const errorText = await res.text();
        const msg = `Tavily Search API error (${res.status}): ${errorText}`;
        logError("tavily_search failed", new Error(msg));
        throw new Error(msg);
      }

      const data = await res.json();
      const sanitized = sanitizeSearchResponse(data);

      const resultCount = Array.isArray(sanitized.results) ? sanitized.results.length : 0;
      logInfo("tavily_search done", { status: res.status, elapsed: elapsed + "ms", results: resultCount });

      return { content: [{ type: "text" as const, text: JSON.stringify(sanitized) }] };
    }
  );

  server.registerTool(
    "tavily_extract",
    {
      title: "Tavily Extract",
      description: "Extract web page content from one or more URLs using Tavily Extract API",
      inputSchema: { urls: z.union([z.string(), z.array(z.string())]) } as any,
    },
    async (args: any) => {
      const { urls } = args as { urls: string | string[] };
      const apiKey = pickRandomKey();
      const urlsArray = Array.isArray(urls) ? urls : [urls];
      logInfo("tavily_extract called", { urls: urlsArray, key: keyPreview(apiKey) });

      const body = { urls: urlsArray };
      const startTime = Date.now();

      const res = await fetch(TAVILY_API_BASE + "/extract", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + apiKey,
        },
        body: JSON.stringify(body),
      });

      const elapsed = Date.now() - startTime;

      if (!res.ok) {
        const errorText = await res.text();
        const msg = `Tavily Extract API error (${res.status}): ${errorText}`;
        logError("tavily_extract failed", new Error(msg));
        throw new Error(msg);
      }

      const data = await res.json();
      const sanitized = sanitizeExtractResponse(data);

      const successCount = Array.isArray(sanitized.results) ? sanitized.results.length : 0;
      const failCount = Array.isArray(sanitized.failed_results) ? sanitized.failed_results.length : 0;
      logInfo("tavily_extract done", { status: res.status, elapsed: elapsed + "ms", success: successCount, failed: failCount });

      return { content: [{ type: "text" as const, text: JSON.stringify(sanitized) }] };
    }
  );

  return server;
}
