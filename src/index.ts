import express from "express";
import type { Request, Response, NextFunction } from "express";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createServer } from "./server.js";

const PORT = parseInt(process.env.PORT || "3000", 10);
const ACCESS_KEYS = (process.env.ACCESS_KEYS || "")
  .split(",")
  .map(k => k.trim())
  .filter(Boolean);

const TAVILY_API_BASE = "https://api.tavily.com";

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

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

interface UsageKeyEntry {
  prefix: string;
  key?: Record<string, unknown>;
  account?: Record<string, unknown>;
  error?: string;
}

interface UsageResponse {
  keys: UsageKeyEntry[];
  fetchedAt: string;
}

async function fetchAllUsage(): Promise<UsageResponse> {
  const rawKeys = process.env.TAVILY_API_KEYS || "";
  const keys = rawKeys.split(",").map(k => k.trim()).filter(Boolean);
  const results: UsageKeyEntry[] = [];

  for (let i = 0; i < keys.length; i++) {
    const apiKey = keys[i];
    if (i > 0) {
      await delay(500);
    }

    const prefix = apiKey.length > 8 ? apiKey.slice(0, 8) + "..." : apiKey;

    try {
      const res = await fetch(TAVILY_API_BASE + "/usage", {
        method: "GET",
        headers: { Authorization: "Bearer " + apiKey },
      });

      if (!res.ok) {
        const text = await res.text();
        results.push({ prefix, error: `HTTP ${res.status}: ${text.slice(0, 200)}` });
        continue;
      }

      const data = await res.json() as { key?: Record<string, unknown>; account?: Record<string, unknown> };
      results.push({ prefix, key: data.key, account: data.account });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      results.push({ prefix, error: message });
    }
  }

  return { keys: results, fetchedAt: new Date().toISOString() };
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

.stat-row {
  display: flex; justify-content: space-between; align-items: center;
  font-size: 13px; padding: 4px 0;
}
.stat-row .stat-name { color: #888; }
.stat-row .stat-value { color: #333; font-weight: 500; }
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

document.addEventListener("DOMContentLoaded", function () {
  var input = document.getElementById("accessKeyInput");
  input.focus();

  // Try without auth first
  fetch("/api/usage")
    .then(function (res) {
      if (res.ok) {
        document.getElementById("loginModal").classList.add("hidden");
        return res.json();
      }
      return Promise.reject("auth required");
    })
    .then(function (data) {
      updateFetchTime(data.fetchedAt);
      renderUsage(data);
    })
    .catch(function () {
      // Auth required or network error — keep modal visible
      document.getElementById("loginModal").classList.remove("hidden");
    });

  // Login button
  document.getElementById("loginBtn").addEventListener("click", doLogin);
  input.addEventListener("keydown", function (e) {
    if (e.key === "Enter") doLogin();
  });

  // Refresh button
  document.getElementById("refreshBtn").addEventListener("click", refresh);

  // Auto refresh toggle
  document.getElementById("autoRefreshCheck").addEventListener("change", toggleAutoRefresh);
});

function doLogin() {
  var key = document.getElementById("accessKeyInput").value.trim();
  var errEl = document.getElementById("loginError");
  if (!key) { errEl.textContent = "请输入密钥"; return; }

  errEl.textContent = "";
  var btn = document.getElementById("loginBtn");
  btn.textContent = "验证中...";
  btn.disabled = true;

  fetch("/api/usage", { headers: { Authorization: "Bearer " + key } })
    .then(function (res) {
      if (!res.ok) throw new Error("invalid");
      return res.json();
    })
    .then(function (data) {
      accessKey = key;
      document.getElementById("loginModal").classList.add("hidden");
      updateFetchTime(data.fetchedAt);
      renderUsage(data);
    })
    .catch(function () {
      errEl.textContent = "密钥无效";
    })
    .finally(function () {
      btn.textContent = "确认";
      btn.disabled = false;
    });
}

function fetchUsage() {
  var headers = {};
  if (accessKey) headers["Authorization"] = "Bearer " + accessKey;
  return fetch("/api/usage", { headers: headers }).then(function (res) {
    if (!res.ok) throw new Error("HTTP " + res.status);
    return res.json();
  });
}

function loadUsage() {
  var content = document.getElementById("content");
  content.innerHTML = '<div class="empty-state"><span class="spinner"></span>加载中...</div>';
  return fetchUsage().then(function (data) {
    updateFetchTime(data.fetchedAt);
    renderUsage(data);
  }).catch(function (err) {
    content.innerHTML = '<div class="empty-state" style="color:#ef4444">加载失败: ' + esc(String(err.message || err)) + '</div>';
  });
}

function refresh() {
  var btn = document.getElementById("refreshBtn");
  btn.disabled = true;
  btn.textContent = "刷新中...";
  loadUsage().finally(function () {
    btn.disabled = false;
    btn.textContent = "刷新";
  });
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
  document.getElementById("fetchTime").textContent =
    "刷新时间: " + d.toLocaleTimeString();
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

  if (k.key) {
    h += '<div class="section-title">Key 用量</div>';
    h += renderBar("总计", k.key.usage, k.key.limit);
    h += renderBar("搜索", k.key.search_usage, k.key.limit, true);
    h += renderBar("提取", k.key.extract_usage, k.key.limit, true);
    h += renderBar("爬虫", k.key.crawl_usage, k.key.limit, true);
    h += renderBar("地图", k.key.map_usage, k.key.limit, true);
    h += renderBar("研究", k.key.research_usage, k.key.limit, true);
  }

  if (k.account) {
    h += '<div class="section-title">账户用量</div>';
    h += '<div class="stat-row"><span class="stat-name">当前计划</span><span class="stat-value">' + esc(String(k.account.current_plan || "--")) + '</span></div>';
    h += renderBar("计划", k.account.plan_usage, k.account.plan_limit);
    h += renderBar("即用即付", k.account.paygo_usage, k.account.paygo_limit);
    h += '<div class="section-title" style="margin-top:14px">操作明细</div>';
    h += '<div class="stat-row"><span class="stat-name">搜索</span><span class="stat-value">' + (k.account.search_usage || 0) + '</span></div>';
    h += '<div class="stat-row"><span class="stat-name">提取</span><span class="stat-value">' + (k.account.extract_usage || 0) + '</span></div>';
    h += '<div class="stat-row"><span class="stat-name">爬虫</span><span class="stat-value">' + (k.account.crawl_usage || 0) + '</span></div>';
    h += '<div class="stat-row"><span class="stat-name">地图</span><span class="stat-value">' + (k.account.map_usage || 0) + '</span></div>';
    h += '<div class="stat-row"><span class="stat-name">研究</span><span class="stat-value">' + (k.account.research_usage || 0) + '</span></div>';
  }

  h += '</div>';
  return h;
}

function renderUsage(data) {
  var content = document.getElementById("content");
  if (!data.keys || data.keys.length === 0) {
    content.innerHTML = '<div class="empty-state">暂无 API Key 配置</div>';
    return;
  }
  content.innerHTML = data.keys.map(renderCard).join("");
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
    console.error("FATAL: TAVILY_API_KEYS must contain at least one API key");
    process.exit(1);
  }

  const app = express();
  app.use(express.json());

  app.get("/health", (_req: Request, res: Response) => {
    res.json({ status: "ok" });
  });

  app.get("/api/usage", authMiddleware, async (_req: Request, res: Response) => {
    try {
      const data = await fetchAllUsage();
      res.json(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: "Failed to fetch usage: " + message });
    }
  });

  app.get("/usage", (_req: Request, res: Response) => {
    res.type("html").send(USAGE_PAGE_HTML);
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
    console.log("tavily-mcp-proxy running on http://0.0.0.0:" + PORT + "/mcp");
    console.log("Usage page: http://0.0.0.0:" + PORT + "/usage");
    console.log("Access keys configured: " + (ACCESS_KEYS.length > 0 ? ACCESS_KEYS.length : "none (open)"));
  });
}

main().catch((err) => {
  console.error("Fatal startup error:", err);
  process.exit(1);
});
