# Sitespeed Audit CLI — Roadmap

## Current: v0.1.0 — Core Audit Engine
- [x] Lighthouse-based audits (LCP, FCP, FID, CLS, TTI, TBT, Speed Index + 4 scores)
- [x] Multi-account / multi-project SQLite storage
- [x] Labels, tags, device modes (desktop / mobile)
- [x] `report` — tabular history with `--compare` (first vs last)
- [x] `trend` — Unicode sparkline per metric over time
- [x] `export` — JSON / CSV to stdout or file
- [x] `projects` — cross-account project listing

---

## v0.2.0 — AI Fix Advisor _(next)_

**Goal:** After every audit, surface actionable, AI-generated fix recommendations keyed to the actual Lighthouse findings for that run.

### What it covers

| Feature | Detail |
|---|---|
| `sitespeed advise [audit-id]` | New command — reads stored Lighthouse findings and calls an LLM to produce prioritised, code-level fix suggestions |
| `--inline` flag on `audit` | Run advise automatically right after an audit completes |
| Finding extraction | Pulls `opportunities`, `diagnostics`, and `passed-audits` from the stored raw JSON |
| Structured output | Returns fixes grouped by category (Images, JavaScript, Fonts, Server, CSS) with estimated score impact |
| Diff-aware advice | If a label has prior runs, the advisor compares regressions and explains what changed |
| Save recommendations | Recommendations stored in a new `recommendations` table linked to `audits.id` |
| `--output md` | Export as a Markdown file (ready to paste into a ticket or PR description) |

### New DB table
```sql
CREATE TABLE IF NOT EXISTS recommendations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  audit_id INTEGER NOT NULL REFERENCES audits(id),
  provider TEXT,           -- "openai" | "anthropic" | "ollama"
  model TEXT,
  prompt_version TEXT,
  findings_json TEXT,      -- extracted Lighthouse findings sent to LLM
  response_text TEXT,      -- raw LLM response
  created_at TEXT DEFAULT (datetime('now'))
);
```

### MCP hook (prep)
- Abstract the LLM call behind a `src/ai/advisor.js` interface so it can be backed by:
  - A direct API call (OpenAI / Anthropic SDK) for standalone use
  - An **MCP tool call** (`mcp://llm/complete`) when the CLI is running inside an MCP-enabled host — swap backends via `SITESPEED_AI_BACKEND=mcp|openai|anthropic|ollama`
- This makes v0.3.0 MCP wiring a drop-in, not a rewrite

---

## v0.3.0 — MCP Integration

**Goal:** Expose the audit database and advisor as MCP tools so AI agents (Copilot, Claude, etc.) can query audit history, trigger new runs, and request recommendations without leaving the chat.

### MCP tools to expose

| Tool | Description |
|---|---|
| `sitespeed/list_projects` | Returns all accounts + projects |
| `sitespeed/run_audit` | Triggers a Lighthouse audit and returns the result |
| `sitespeed/get_report` | Returns audit history for a project (filterable) |
| `sitespeed/get_trend` | Returns metric trend data as JSON |
| `sitespeed/advise` | Returns AI fix recommendations for an audit |

### Transport
- `src/mcp/server.js` — MCP stdio server, registered via `mcp` key in `package.json`
- Works with Claude Desktop, GitHub Copilot (MCP hosts), and any MCP-compatible agent

### Config
```json
{
  "mcpServers": {
    "sitespeed": {
      "command": "node",
      "args": ["/path/to/sitespeed-audit-cli/bin/mcp.js"]
    }
  }
}
```

---

## v0.4.0 — Web Dashboard

**Goal:** A local web dashboard to visualise and compare audit runs for any project without leaving the terminal workflow.

### Stack
- **Server**: `fastify` — serves API + static files
- **Frontend**: Vanilla JS + `Chart.js` — no build step, no bundler
- **Launch**: `sitespeed dashboard [--port 3333] [--open]` — starts server, optionally opens browser

### Dashboard views

| View | Detail |
|---|---|
| **Overview** | Account → project tree; latest score badges per project |
| **Run timeline** | Line chart of all 4 Lighthouse scores over time, filterable by label/device/tag |
| **Metric deep-dive** | LCP, FCP, CLS, TBT, TTI, Speed Index charts side by side |
| **Run compare** | Select any two audit IDs — renders a diff table with delta arrows and colour coding |
| **Recommendations** | Surfaces saved AI recommendations; links back to the audit run |
| **Export panel** | Download CSV / JSON directly from the browser |

### API routes (served by fastify)
```
GET /api/accounts
GET /api/projects?account_id=
GET /api/audits?project_id=&label=&device=&tag=&limit=
GET /api/audits/:id
GET /api/trend?project_id=&label=&metric=
GET /api/compare?a=:audit_id&b=:audit_id
GET /api/recommendations?audit_id=
```

### Security
- Binds to `127.0.0.1` only (no external exposure)
- Optional `--token <secret>` flag for Bearer auth on API routes

---

## v0.5.0 — Scheduling & CI Integration

- `sitespeed schedule` — cron-like recurring audits via a background daemon
- `sitespeed ci` — CI-friendly command: exits non-zero if any score is below configured thresholds; outputs JUnit XML for test reporters
- GitHub Actions YAML example in README
- Slack / webhook notifications on score regressions

---

## Contributing

Issues and PRs welcome. For large changes, open an issue first to discuss scope.
