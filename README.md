# tavily-mcp-proxy

Tavily MCP Proxy - Search via Tavily MCP with multiple keys, randomly selecting one each time.

通过 Tavily MCP 进行搜索，支持配置多个 API Key，每次调用随机选取一个。

## Features / 功能

- 🐳 Docker-deployable Streamable HTTP MCP server / 支持 Docker 部署的 Streamable HTTP MCP 服务
- 🔑 Multiple Tavily API keys with random rotation / 多 Tavily API Key 随机轮换
- 🔒 Bearer token authentication for access control / Bearer Token 访问认证
- 📊 Real-time usage dashboard / 实时用量面板
- 🔍 `tavily_search` and `tavily_extract` tools / 包含 `tavily_search` 和 `tavily_extract` 两个工具

## Quick Start / 快速开始

```bash
git clone https://github.com/welyfun/tavily-mcp-proxy.git
cd tavily-mcp-proxy
```

Create a `.env` file or configure environment variables / 创建 `.env` 文件或配置环境变量

```bash
TAVILY_API_KEYS=tvly-xxx,tvly-yyy,tvly-zzz
ACCESS_KEYS=my-secret-key
PORT=3000
```

Generate a secure access key / 生成一个安全的访问密钥:

```bash
python3 generate-key.py
```

### Docker

```bash
docker compose up --build -d
```

### Local Dev / 本地开发

```bash
npm install
npm run dev
```

## Usage Page / 用量面板

Visit `http://localhost:3000/` to view real-time API key usage. / 访问 `http://localhost:3000/` 查看实时 API Key 用量。

- Enter your access key to log in / 输入访问密钥登录
- Usage data streams in as each key is fetched / 用量数据流式加载，逐个 Key 显示
- Progress bar shows overall fetch status / 进度条显示整体获取进度
- Each key card shows both key-level and account-level usage / 每个 Key 卡片展示 Key 级别和账户级别用量
- Key usage bars default to plan limit when key limit is not set / Key 用量条上限未设置时默认使用计划上限
- Auto-refresh available (60s interval) / 支持自动刷新（60 秒间隔）


## Configuration / 配置项

| Variable | Required | Description |
|----------|----------|-------------|
| `TAVILY_API_KEYS` | Yes | Tavily API keys, comma-separated / Tavily API Key，逗号分隔 |
| `ACCESS_KEYS` | No | Access keys for authentication, comma-separated. Omit to disable auth / 访问密钥，逗号分隔。留空则不校验 |
| `PORT` | No | Server port, default `3000` / 服务端口，默认 `3000` |

## Tools / 工具

### tavily_search

Search the web using Tavily Search API. The query is forwarded with `max_results` fixed at 10. Metadata fields (`response_time`, `usage`, `request_id`, etc.) are stripped from the response.

使用 Tavily Search API 搜索网页。`max_results` 固定为 10，响应中已剔除元数据字段。

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `query` | string | Yes | Search query / 搜索关键词 |

### tavily_extract

Extract web page content from one or more URLs using Tavily Extract API. Metadata fields are stripped from the response.

使用 Tavily Extract API 提取网页内容。响应中已剔除元数据字段。

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `urls` | string \| string[] | Yes | URL(s) to extract / 要提取的 URL |

## Client Configuration / 客户端配置

### Claude Desktop

```json
{
  "mcpServers": {
    "tavily": {
      "url": "http://localhost:3000/mcp",
      "headers": {
        "Authorization": "Bearer my-secret-key"
      }
    }
  }
}
```

### Codex

```toml
[mcp_servers.tavily]
url = "http://localhost:3000/mcp"
http_headers = { "Authorization" = "Bearer my-secret-key" }
default_tools_approval_mode = "approve"
```

## License

MIT
