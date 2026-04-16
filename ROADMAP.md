# Sitespeed Audit CLI — Roadmap

## ✅ v0.1.0 — Core Audit Engine _(shipped)_
- [x] Lighthouse-based audits (LCP, FCP, FID, CLS, TTI, TBT, Speed Index + 4 scores)
- [x] Multi-account / multi-project SQLite storage
- [x] Labels, tags, device modes (desktop / mobile)
- [x] `report` — tabular history with `--compare` (first vs last)
- [x] `trend` — Unicode sparkline per metric over time
- [x] `export` — JSON / CSV to stdout or file (human-readable field names + formatted times)
- [x] `projects` — cross-account project listing
- [x] `cleanup` — delete runs by age, label, date, or all
- [x] Shopify storefront auth (`--platform shopify --password`) with pre-flight pass/fail feedback
- [x] Smart `report --compare` — Desktop vs Mobile when both exist; First vs Latest otherwise
- [x] Auto device-grouped report sections (🖥 Desktop / 📱 Mobile) under the same label
- [x] Tag-based comparison with `--compare-tags before,after`

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

## v0.4.0 — Web Dashboard (Catalyst)

**Goal:** Port every CLI operation to a full web dashboard — all the same power as the terminal commands, accessible through a polished UI with clickable buttons, dropdowns, filters, data tables, grouped cards, and interactive charts.

### Stack
- **UI framework**: [Catalyst](https://catalyst.tailwindui.com/) (Tailwind CSS + Headless UI component library) — gives a consistent, accessible design system out of the box
- **Frontend**: React + Vite — fast dev builds, no config overhead
- **Server**: `fastify` — REST API backed by the same SQLite queries as the CLI
- **Charts**: `Chart.js` (or `Recharts`) — line, bar, and radar charts for metric visualisation
- **Launch**: `sitespeed dashboard [--port 3333] [--open]` — starts the API server and serves the built frontend; optionally opens the browser

### CLI parity — every command gets a UI equivalent

| CLI command | Dashboard equivalent |
|---|---|
| `sitespeed init` | **New Project** modal — account/project/device dropdowns, base URL field |
| `sitespeed audit <url>` | **Run Audit** panel — URL input, label/device/tags fields, platform toggle, password field; live progress indicator |
| `sitespeed report` | **Audit History** table — sortable columns, label/device/tag filter dropdowns, pagination |
| `sitespeed report --compare` | **Compare** view — select two runs from dropdowns; renders delta table with ↑↓ arrows and colour coding |
| `sitespeed report --compare-tags` | **Tag Compare** — pick two tags from a dropdown; auto-fetches latest run per tag |
| `sitespeed trend` | **Trend chart** — metric selector, label filter, interactive line chart over time |
| `sitespeed export` | **Export panel** — JSON / CSV download buttons with optional label/device/tag filters |
| `sitespeed cleanup` | **Cleanup** modal — date range picker, label filter, dry-run toggle, confirmation step |
| `sitespeed projects` | **Projects sidebar** — account → project tree with audit count badges |
| `sitespeed advise` | **AI Advisor** tab per run — surfaces recommendations with category grouping (v0.4 if v0.2 ships first) |

### Dashboard layout

```
┌─────────────────────────────────────────────────────────┐
│  Sidebar                  │  Main content area           │
│  ─────────────            │  ──────────────────────────  │
│  Accounts                 │  [Breadcrumb: Acme / Blog]   │
│   └ Acme Corp             │                              │
│       ├ marketing-site ●  │  Filters: Label ▾  Device ▾ │
│       └ blog              │           Tag ▾   Last N ▾  │
│   └ Personal              │                              │
│       └ portfolio         │  ┌──────────────────────┐   │
│                           │  │ Score cards (4×)     │   │
│  [+ New Project]          │  │ Perf  A11y  BP  SEO  │   │
│  [▶ Run Audit]            │  └──────────────────────┘   │
│                           │                              │
│                           │  Trend chart (Chart.js)      │
│                           │                              │
│                           │  Audit history table         │
│                           │  (sortable, paginated)       │
└─────────────────────────────────────────────────────────┘
```

### Key UI components (Catalyst)

| Component | Used for |
|---|---|
| `Table` | Audit history, project listing, compare delta table |
| `Select` / `Listbox` | Label, device, tag, metric dropdowns and filters |
| `Dialog` / `Modal` | Run Audit, New Project, Cleanup confirmation |
| `Badge` | Score colour coding (green / yellow / red), device labels |
| `Card` | Per-metric summary cards on project overview |
| `Button` | Run Audit, Export, Compare, Cleanup |
| `Input` | URL field, password field, label/tag inputs |
| `Tabs` | History / Trends / Compare / AI Advisor per project |
| `Sparkline` / chart | Inline score trends in project cards |

### API routes (fastify)

```
GET    /api/accounts
GET    /api/projects?account_id=
POST   /api/projects
GET    /api/audits?project_id=&label=&device=&tag=&limit=&page=
GET    /api/audits/:id
POST   /api/audits                     ← triggers a new Lighthouse run
DELETE /api/audits?project_id=&before=&label=
GET    /api/trend?project_id=&label=&metric=
GET    /api/compare?a=:audit_id&b=:audit_id
GET    /api/compare-tags?project_id=&tag_a=&tag_b=
GET    /api/export?project_id=&format=json|csv
GET    /api/recommendations?audit_id=
```

### Security
- Binds to `127.0.0.1` only (no external exposure)
- Optional `--token <secret>` flag for Bearer auth on all API routes

---

## v0.5.0 — Scheduling & CI Integration

- `sitespeed schedule` — cron-like recurring audits via a background daemon
- `sitespeed ci` — CI-friendly command: exits non-zero if any score is below configured thresholds; outputs JUnit XML for test reporters
- GitHub Actions YAML example in README
- Slack / webhook notifications on score regressions

---

## Contributing

Issues and PRs welcome. For large changes, open an issue first to discuss scope.
