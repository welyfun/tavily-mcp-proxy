# tavily-mcp-proxy

Tavily MCP Proxy - Search via Tavily MCP with multiple keys, randomly selecting one each time.

通过 Tavily MCP 进行搜索，支持配置多个 API Key，每次调用随机选取一个。

## Features / 功能

- 🐳 Docker-deployable Streamable HTTP MCP server / 支持 Docker 部署的 Streamable HTTP MCP 服务
- 🔑 Multiple Tavily API keys with random rotation / 多 Tavily API Key 随机轮换
- 🔒 Bearer token authentication for access control / Bearer Token 访问认证
- 🔍 `tavily_search` and `tavily_extract` tools / 包含 `tavily_search` 和 `tavily_extract` 两个工具

## Quick Start / 快速开始

```bash
git clone <repo-url>
cd tavily-mcp-proxy
```

Create a `.env` file or configure environment variables / 创建 `.env` 文件或配置环境变量

```bash
TAVILY_API_KEYS=tvly-xxx,tvly-yyy,tvly-zzz
ACCESS_KEYS=my-secret-key
PORT=3000
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
approval_mode = "approve"
```

## License

MIT
