import express from "express";
import type { Request, Response, NextFunction } from "express";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createServer } from "./server.js";
import { logInfo, logError, keyPreview } from "./logger.js";

const PORT = parseInt(process.env.PORT || "3000", 10);
const ACCESS_KEYS = (process.env.ACCESS_KEYS || "")
  .split(",")
  .map(k => k.trim())
  .filter(Boolean);

const TAVILY_API_BASE = "https://api.tavily.com";

function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now();
  res.on("finish", () => {
    const elapsed = Date.now() - start;
    logInfo("http", { method: req.method, path: req.path, status: res.statusCode, elapsed: elapsed + "ms" });
  });
  next();
}

function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  if (ACCESS_KEYS.length === 0) {
    next();
    return;
  }
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    logInfo("auth rejected: missing or invalid Authorization header", { path: req.path, ip: req.ip });
    res.status(401).json({ error: "Missing or invalid Authorization header" });
    return;
  }
  const token = authHeader.slice(7);
  if (!ACCESS_KEYS.includes(token)) {
    logInfo("auth rejected: invalid access key", { path: req.path, ip: req.ip, key: keyPreview(token) });
    res.status(401).json({ error: "Invalid access key" });
    return;
  }
  next();
}

const USAGE_PAGE_HTML = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Tavily Usage</title>
<style>
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
body {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  background: #f5f5f5;
  color: #1a1a1a;
  min-height: 100vh;
}
.modal-overlay {
  position: fixed; inset: 0;
  background: rgba(0,0,0,0.45);
  display: flex; align-items: center; justify-content: center;
  z-index: 100;
}
.modal-overlay.hidden { display: none; }
.modal-box {
  background: #fff; border-radius: 8px; padding: 32px; width: 380px;
  box-shadow: 0 4px 24px rgba(0,0,0,0.15);
}
.modal-box h2 { font-size: 20px; margin-bottom: 6px; }
.modal-box .hint { font-size: 14px; color: #888; margin-bottom: 20px; }
.modal-box input {
  width: 100%; padding: 10px 12px;
  border: 1px solid #d1d5db; border-radius: 6px;
  font-size: 14px; outline: none;
}
.modal-box input:focus { border-color: #3b82f6; box-shadow: 0 0 0 2px rgba(59,130,246,0.2); }
.modal-box .error { color: #ef4444; font-size: 13px; margin-top: 8px; min-height: 20px; }
.modal-box button {
  width: 100%; margin-top: 14px; padding: 10px;
  background: #3b82f6; color: #fff; border: none; border-radius: 6px;
  font-size: 14px; cursor: pointer;
}
.modal-box button:hover { background: #2563eb; }

.header {
  background: #fff; border-bottom: 1px solid #e5e7eb;
  padding: 14px 24px;
  display: flex; align-items: center; justify-content: space-between;
  flex-wrap: wrap; gap: 12px;
}
.header h1 { font-size: 18px; font-weight: 600; }
.header-controls { display: flex; align-items: center; gap: 16px; font-size: 13px; color: #666; }
.header-controls button {
  padding: 6px 14px; background: #3b82f6; color: #fff;
  border: none; border-radius: 6px; font-size: 13px; cursor: pointer;
}
.header-controls button:hover { background: #2563eb; }
.header-controls button:disabled { opacity: 0.5; cursor: not-allowed; }
.header-controls label { display: flex; align-items: center; gap: 6px; cursor: pointer; user-select: none; }

.container { max-width: 960px; margin: 0 auto; padding: 24px; }

.key-card {
  background: #fff; border: 1px solid #e5e7eb; border-radius: 8px;
  padding: 24px; margin-bottom: 16px;
}
.key-card h3 { font-size: 15px; margin-bottom: 16px; font-family: "SF Mono", "Cascadia Code", "Consolas", monospace; color: #555; }
.key-card .section-title {
  font-size: 12px; font-weight: 600; text-transform: uppercase;
  color: #999; margin: 18px 0 10px; letter-spacing: 0.5px;
}
.key-card .section-title:first-of-type { margin-top: 0; }

.usage-row { margin-bottom: 10px; }
.usage-label {
  display: flex; justify-content: space-between; align-items: center;
  font-size: 13px; margin-bottom: 4px;
}
.usage-label .name { color: #555; }
.usage-label .value { color: #333; font-weight: 500; font-variant-numeric: tabular-nums; }

.bar { height: 6px; background: #e5e7eb; border-radius: 3px; overflow: hidden; }
.bar .fill { height: 100%; border-radius: 3px; transition: width 0.4s ease; }
.bar.sub { height: 4px; border-radius: 2px; }
.fill-green { background: #22c55e; }
.fill-yellow { background: #eab308; }
.fill-red { background: #ef4444; }

.error-card {
  background: #fef2f2; border: 1px solid #fecaca; border-radius: 6px;
  padding: 14px 16px; margin-bottom: 12px; color: #b91c1c; font-size: 13px;
}

.empty-state { text-align: center; padding: 60px 20px; color: #999; font-size: 14px; }
.spinner {
  display: inline-block; width: 20px; height: 20px;
  border: 2px solid #e5e7eb; border-top-color: #3b82f6;
  border-radius: 50%; animation: spin 0.6s linear infinite;
  vertical-align: middle; margin-right: 8px;
}
@keyframes spin { to { transform: rotate(360deg); } }

.skeleton {
  background: linear-gradient(90deg, #eee 25%, #f5f5f5 50%, #eee 75%);
  background-size: 200% 100%;
  animation: shimmer 1.4s ease-in-out infinite;
}
@keyframes shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

.stat-row {
  display: flex; justify-content: space-between; align-items: center;
  font-size: 13px; padding: 4px 0;
}
.stat-row .stat-name { color: #888; }
.stat-row .stat-value { color: #333; font-weight: 500; }

.progress-bar-wrap {
  background: #fff; border: 1px solid #e5e7eb; border-radius: 8px;
  padding: 16px 24px; margin-bottom: 20px;
  display: flex; align-items: center; gap: 14px;
}
.progress-bar-wrap .label { font-size: 13px; color: #666; white-space: nowrap; }
.progress-bar-wrap .bar-outer {
  flex: 1; height: 8px; background: #e5e7eb; border-radius: 4px; overflow: hidden;
}
.progress-bar-wrap .bar-inner {
  height: 100%; background: #3b82f6; border-radius: 4px; transition: width 0.3s ease;
}
.progress-bar-wrap .count { font-size: 12px; color: #888; white-space: nowrap; }
</style>
</head>
<body>

<div id="loginModal" class="modal-overlay">
  <div class="modal-box">
    <h2>登录</h2>
    <p class="hint">输入访问密钥以查看用量</p>
    <input id="accessKeyInput" type="password" placeholder="Access Key" autocomplete="off" />
    <div id="loginError" class="error"></div>
    <button id="loginBtn">确认</button>
  </div>
</div>

<div id="app">
  <div class="header">
    <h1>Tavily Usage</h1>
    <div class="header-controls">
      <span id="fetchTime">--</span>
      <button id="refreshBtn">刷新</button>
      <label>
        <input type="checkbox" id="autoRefreshCheck" />
        自动刷新 (60s)
      </label>
    </div>
  </div>
  <div class="container" id="content"></div>
</div>

<script>
var accessKey = "";
var autoRefreshTimer = null;



var sseAbort = null;
var keyData = {};
var prefixList = [];
var fetchedCount = 0;

document.addEventListener("DOMContentLoaded", function () {
  var input = document.getElementById("accessKeyInput");
  input.focus();
  document.getElementById("loginModal").classList.remove("hidden");
  document.getElementById("loginBtn").addEventListener("click", doLogin);
  input.addEventListener("keydown", function (e) {
    if (e.key === "Enter") doLogin();
  });
  document.getElementById("refreshBtn").addEventListener("click", refresh);
  document.getElementById("autoRefreshCheck").addEventListener("change", toggleAutoRefresh);
});

function doLogin() {
  var key = document.getElementById("accessKeyInput").value.trim();
  var errEl = document.getElementById("loginError");
  if (!key) { errEl.textContent = "\u8bf7\u8f93\u5165\u5bc6\u94a5"; return; }
  errEl.textContent = "";
  var btn = document.getElementById("loginBtn");
  btn.textContent = "\u9a8c\u8bc1\u4e2d...";
  btn.disabled = true;
  accessKey = key;
  startSSE(function (ok) {
    if (ok) {
      document.getElementById("loginModal").classList.add("hidden");
    } else {
      accessKey = "";
      errEl.textContent = "\u5bc6\u94a5\u65e0\u6548";
    }
    btn.textContent = "\u786e\u8ba4";
    btn.disabled = false;
  });
}

function disconnectSSE() {
  if (sseAbort) { sseAbort.abort(); sseAbort = null; }
}

function startSSE(onConnected) {
  disconnectSSE();
  sseAbort = new AbortController();
  var signal = sseAbort.signal;
  var headers = {};
  if (accessKey) headers["Authorization"] = "Bearer " + accessKey;

  fetch("/api/usage/stream", { headers: headers, signal: signal })
    .then(function (res) {
      if (!res.ok) { if (onConnected) onConnected(false); return; }
      if (onConnected) onConnected(true);
      keyData = {}; prefixList = []; fetchedCount = 0;
      var reader = res.body.getReader();
      var decoder = new TextDecoder();
      var buf = "";
      var evt = "";

      function pump() {
        return reader.read().then(function (r) {
          if (r.done) return true;
          buf += decoder.decode(r.value, { stream: true });
          var parts = buf.split("\\n");
          buf = parts.pop();
          for (var i = 0; i < parts.length; i++) {
            var line = parts[i];
            if (line.startsWith("event: ")) {
              evt = line.slice(7).trim();
            } else if (line.startsWith("data: ")) {
              try {
                handleEvent(evt, JSON.parse(line.slice(6)));
              } catch (e) {}
              evt = "";
            }
          }
          return pump();
        });
      }
      return pump();
    }).catch(function () {});
}

function handleEvent(evt, data) {
  if (evt === "init") {
    prefixList = data.prefixes || [];
    fetchedCount = 0;
    renderPage();
  } else if (evt === "usage") {
    keyData[data.prefix] = data;
    fetchedCount = Object.keys(keyData).length;
    renderPage();
  } else if (evt === "done") {
    updateFetchTime(data.fetchedAt);
    var btn = document.getElementById("refreshBtn");
    btn.disabled = false;
    btn.textContent = "\u5237\u65b0";
  }
}

function renderPage() {
  var content = document.getElementById("content");
  if (prefixList.length === 0) {
    content.innerHTML = '<div class="empty-state">\u6682\u65e0 API Key \u914d\u7f6e</div>';
    return;
  }
  var total = prefixList.length;
  var pct = total > 0 ? Math.round(fetchedCount / total * 100) : 0;
  var html = '<div class="progress-bar-wrap">' +
    '<span class="label">\u6b63\u5728\u83b7\u53d6 Key \u7528\u91cf</span>' +
    '<div class="bar-outer"><div class="bar-inner" style="width:' + pct + '%"></div></div>' +
    '<span class="count">' + fetchedCount + ' / ' + total + '</span>' +
    '</div>';

  for (var i = 0; i < prefixList.length; i++) {
    var p = prefixList[i];
    var d = keyData[p];
    if (d) {
      html += renderCard(d);
    } else {
      html += '<div class="key-card"><h3>' + esc(p) + '</h3>' +
        '<div class="empty-state" style="padding:20px"><span class="spinner"></span>\u83b7\u53d6\u4e2d...</div>' +
        '</div>';
    }
  }
  content.innerHTML = html;
}

function refresh() {
  var btn = document.getElementById("refreshBtn");
  btn.disabled = true;
  btn.textContent = "\u5237\u65b0\u4e2d...";
  startSSE(null);
}

function toggleAutoRefresh() {
  if (document.getElementById("autoRefreshCheck").checked) {
    refresh();
    autoRefreshTimer = setInterval(refresh, 60000);
  } else {
    if (autoRefreshTimer) { clearInterval(autoRefreshTimer); autoRefreshTimer = null; }
  }
}

function updateFetchTime(iso) {
  var d = new Date(iso);
  document.getElementById("fetchTime").textContent = "\u5237\u65b0\u65f6\u95f4: " + d.toLocaleTimeString();
}

function barColor(ratio) {
  if (ratio < 0.6) return "fill-green";
  if (ratio < 0.85) return "fill-yellow";
  return "fill-red";
}

function renderBar(label, used, limit, isSub) {
  var numUsed = Number(used) || 0;
  var numLimit = Number(limit) || 0;
  var ratio = numLimit > 0 ? Math.min(numUsed / numLimit, 1) : 0;
  var pct = Math.round(ratio * 100);
  return '<div class="usage-row">' +
    '<div class="usage-label"><span class="name">' + esc(label) + '</span><span class="value">' + numUsed + ' / ' + (numLimit || '--') + ' (' + pct + '%)</span></div>' +
    '<div class="bar' + (isSub ? ' sub' : '') + '"><div class="fill ' + barColor(ratio) + '" style="width:' + pct + '%"></div></div>' +
    '</div>';
}

function renderCard(k) {
  var h = '<div class="key-card"><h3>' + esc(k.prefix) + '</h3>';
  if (k.error) {
    h += '<div class="error-card">' + esc(k.error) + '</div></div>';
    return h;
  }
  var data = k.data;
  var planLimit = (data && data.account && data.account.plan_limit) ? data.account.plan_limit : 0;
  if (data && data.key) {
    var keyLimit = Number(data.key.limit) || planLimit;
    h += '<div class="section-title">Key \u7528\u91cf</div>';
    h += renderBar("\u603b\u8ba1", data.key.usage, keyLimit);
    h += renderBar("\u641c\u7d22", data.key.search_usage, keyLimit, true);
    h += renderBar("\u63d0\u53d6", data.key.extract_usage, keyLimit, true);
    h += renderBar("\u722c\u866b", data.key.crawl_usage, keyLimit, true);
    h += renderBar("\u5730\u56fe", data.key.map_usage, keyLimit, true);
    h += renderBar("\u7814\u7a76", data.key.research_usage, keyLimit, true);
  }
  if (data && data.account) {
    h += '<div class="section-title">\u8d26\u6237\u7528\u91cf</div>';
    h += '<div class="stat-row"><span class="stat-name">\u5f53\u524d\u8ba1\u5212</span><span class="stat-value">' + esc(String(data.account.current_plan || "--")) + '</span></div>';
    h += renderBar("\u8ba1\u5212", data.account.plan_usage, data.account.plan_limit);
    h += renderBar("\u5373\u7528\u5373\u4ed8", data.account.paygo_usage, data.account.paygo_limit);
  }
  h += '</div>';
  return h;
}

function esc(s) {
  if (s == null) return "";
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
<\/script>
</body>
</html>`;

async function main(): Promise<void> {
  const keys = process.env.TAVILY_API_KEYS || "";
  if (!keys.split(",").map(k => k.trim()).filter(Boolean).length) {
    logError("FATAL: TAVILY_API_KEYS must contain at least one API key");
    process.exit(1);
  }

  const app = express();
  app.use(express.json());
  app.use(requestLogger);

  app.get("/health", (_req: Request, res: Response) => {
    res.json({ status: "ok" });
  });

  app.get("/api/usage/stream", authMiddleware, async (req: Request, res: Response) => {
    const rawKeys = process.env.TAVILY_API_KEYS || "";
    const keys = rawKeys.split(",").map(k => k.trim()).filter(Boolean);

    const authed = ACCESS_KEYS.length === 0 || !!req.headers.authorization;
    logInfo("usage stream started", { authed, keys: keys.length });
    res.writeHead(200, {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    });

    const send = (event: string, data: unknown) => {
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };

    const prefixes = keys.map(k => keyPreview(k));
    send("init", { prefixes });

    let aborted = false;
    req.on("close", () => { aborted = true; });
    let fetched = 0; let errors = 0;

    for (let i = 0; i < keys.length; i++) {
      if (aborted) break;

      const apiKey = keys[i];
      const prefix = prefixes[i];

      if (i > 0) {
        await new Promise(resolve => setTimeout(resolve, 500));
        if (aborted) break;
      }

      try {
        const fetchRes = await fetch(TAVILY_API_BASE + "/usage", {
          method: "GET",
          headers: { Authorization: "Bearer " + apiKey },
        });

        if (!fetchRes.ok) {
          const text = await fetchRes.text();
          errors++;
          logError("usage stream key error", new Error(`HTTP ${fetchRes.status} for ${prefix}`));
          send("usage", { prefix, error: `HTTP ${fetchRes.status}: ${text.slice(0, 200)}` });
          continue;
        }

        const data = await fetchRes.json() as { key?: Record<string, unknown>; account?: Record<string, unknown> };
        fetched++;
        logInfo("usage stream key fetched", { prefix, key: keyPreview(apiKey) });
        send("usage", { prefix, data: { key: data.key || null, account: data.account || null } });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        errors++;
        logError("usage stream key error", err instanceof Error ? err : new Error(message));
        send("usage", { prefix, error: message });
      }
    }

    if (!aborted) {
      logInfo("usage stream done", { total: keys.length, fetched, errors });
      send("done", { fetchedAt: new Date().toISOString() });
    }
    res.end();
  });

  app.get("/usage", (_req: Request, res: Response) => {
    res.type("html").send(USAGE_PAGE_HTML);
  });

  app.post("/mcp", authMiddleware, async (req: Request, res: Response) => {
    logInfo("mcp session started");
    try {
      const server = createServer();
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined,
      });
      res.on("close", () => {
        logInfo("mcp session closed");
        transport.close();
        server.close();
      });
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
    } catch (error) {
      logError("mcp handler error", error);
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: "2.0",
          error: { code: -32603, message: "Internal server error" },
          id: null,
        });
      }
    }
  });

  process.on("uncaughtException", (err) => {
    logError("uncaught exception", err);
    process.exit(1);
  });

  process.on("unhandledRejection", (reason) => {
    logError("unhandled rejection", reason instanceof Error ? reason : new Error(String(reason)));
  });

  app.listen(PORT, () => {
    logInfo("server started", { port: PORT });
    logInfo("MCP endpoint: http://0.0.0.0:" + PORT + "/mcp");
    logInfo("Usage page: http://0.0.0.0:" + PORT + "/usage");
    logInfo("Access keys configured: " + (ACCESS_KEYS.length > 0 ? ACCESS_KEYS.length : "none (open)"));
    logInfo("LOG_LEVEL: " + (process.env.LOG_LEVEL || "info"));
  });
}

main().catch((err) => {
  logError("fatal startup error", err);
  process.exit(1);
});
