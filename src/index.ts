import express from "express";
import type { Request, Response, NextFunction } from "express";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createServer } from "./server.js";

const PORT = parseInt(process.env.PORT || "3000", 10);
const ACCESS_KEYS = (process.env.ACCESS_KEYS || "")
  .split(",")
  .map(k => k.trim())
  .filter(Boolean);

function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  if (ACCESS_KEYS.length === 0) {
    next();
    return;
  }
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({ error: "Missing or invalid Authorization header" });
    return;
  }
  const token = authHeader.slice(7);
  if (!ACCESS_KEYS.includes(token)) {
    res.status(401).json({ error: "Invalid access key" });
    return;
  }
  next();
}

async function main(): Promise<void> {
  const keys = process.env.TAVILY_API_KEYS || "";
  if (!keys.split(",").map(k => k.trim()).filter(Boolean).length) {
    console.error("FATAL: TAVILY_API_KEYS must contain at least one API key");
    process.exit(1);
  }

  const app = express();
  app.use(express.json());

  app.get("/health", (_req: Request, res: Response) => {
    res.json({ status: "ok" });
  });

  app.post("/mcp", authMiddleware, async (req: Request, res: Response) => {
    try {
      const server = createServer();
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined,
      });
      res.on("close", () => {
        transport.close();
        server.close();
      });
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
    } catch (error) {
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: "2.0",
          error: { code: -32603, message: "Internal server error" },
          id: null,
        });
      }
    }
  });

  app.listen(PORT, () => {
    console.log(`tavily-mcp-proxy running on http://0.0.0.0:${PORT}/mcp`);
    console.log(`Access keys configured: ${ACCESS_KEYS.length > 0 ? ACCESS_KEYS.length : "none (open)"}`);
  });
}

main().catch((err) => {
  console.error("Fatal startup error:", err);
  process.exit(1);
});
