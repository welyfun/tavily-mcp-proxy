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
      const body = { query, max_results: 10 };

      const res = await fetch(TAVILY_API_BASE + "/search", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + apiKey,
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error("Tavily Search API error (" + res.status + "): " + errorText);
      }

      const data = await res.json();
      const sanitized = sanitizeSearchResponse(data);
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
      const body = { urls: urlsArray };

      const res = await fetch(TAVILY_API_BASE + "/extract", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + apiKey,
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error("Tavily Extract API error (" + res.status + "): " + errorText);
      }

      const data = await res.json();
      const sanitized = sanitizeExtractResponse(data);
      return { content: [{ type: "text" as const, text: JSON.stringify(sanitized) }] };
    }
  );

  return server;
}
