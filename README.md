# sitespeed-audit-cli

A production-ready Node.js CLI tool for running **Lighthouse-based site speed audits**, storing results in a local SQLite database, and organising everything by **account** and **project**.

Track performance regressions over time, compare before/after deploys, and export data — all from the terminal.

---

## Prerequisites

| Requirement | Version |
|-------------|---------|
| Node.js | v18 or later |
| npm | v8 or later |

> **Chrome / Chromium:** No system Chrome is required. The CLI uses the Chromium bundled with Puppeteer automatically. On Linux/CI the runner passes `--no-sandbox` and `--disable-setuid-sandbox` for container compatibility.

---

## Installation

```bash
# Clone / download the project, then:
cd sitespeed-audit-cli
npm install

# Install the binary globally (choose one)
npm install -g .    # system-wide
npm link            # development symlink
```

Verify:

```bash
sitespeed --version
# 0.1.0

sitespeed --help
```

---

## Quick Start

```bash
# 1. Initialise a project in your working directory
cd my-website
sitespeed init

# 2. Run your first audit
sitespeed audit https://example.com --label homepage

# 3. View results
sitespeed report
```

---

## Commands

### `sitespeed init`

Interactively create `.sitespeedrc.json` in the current directory.

```
sitespeed init
```

Prompts you for:
- **Database path** — where audit data is stored (default: `~/.sitespeed/data.db`)
- **Account** — pick an existing account or create one (useful for agencies managing multiple clients)
- **Project** — pick an existing project or create one (name + base URL)
- **Default device** — `desktop` or `mobile`

The resulting `.sitespeedrc.json` looks like:

```json
{
  "account": "acme-corp",
  "project": "marketing-site",
  "device": "desktop",
  "dbPath": "~/.sitespeed/data.db"
}
```

---

### `sitespeed audit [url]`

Run a Lighthouse audit on one or more URLs. If `[url]` is omitted you are prompted to enter one interactively.

```bash
# Desktop audit (default)
sitespeed audit https://example.com

# Mobile audit
sitespeed audit https://example.com --device mobile --label mobile-homepage

# Run both desktop and mobile in one shot
sitespeed audit --urls-file urls.txt --label desktop-batch
sitespeed audit --urls-file urls.txt --label mobile-batch --device mobile

# Audit with a label and tags
sitespeed audit https://example.com/checkout --label checkout --tags "sprint-42,post-deploy"

# Audit multiple URLs from a file
sitespeed audit --urls-file urls.txt --label batch-run

# Save the full Lighthouse JSON report to the DB
sitespeed audit https://example.com --save-raw

# Shopify password-protected storefront
sitespeed audit https://mystore.myshopify.com --platform shopify --password mysecret

# Interactive — prompts for URL
sitespeed audit
```

**Options:**

| Flag | Description | Default |
|------|-------------|---------|
| `--label, -l <label>` | Tag this run (e.g. `"homepage"`) | — |
| `--device, -d <device>` | `desktop` or `mobile` | from config |
| `--tags, -t <tags>` | Comma-separated tags | — |
| `--save-raw` | Store full Lighthouse JSON in DB | off |
| `--urls-file <path>` | Newline-delimited file of URLs to audit | — |
| `--platform <platform>` | Platform type for authenticated audits (`shopify`) | — |
| `--password <password>` | Password for platform-authenticated audits | — |

> **Desktop vs Mobile:** Use `--device desktop` (default) or `--device mobile`. Mobile runs Lighthouse with a simulated throttled 4G connection and a mobile viewport. Run the same URL twice with different `--device` values and different `--label` values to compare both results side-by-side with `sitespeed report --compare`.

> **Shopify storefronts:** When `--platform shopify` is used the CLI launches Chromium via Puppeteer, navigates to the password form (`form[action="/password"]`), enters the password, submits, then passes the authenticated browser session directly to Lighthouse — so all scores reflect the real storefront.

**Example output:**

```
Auditing 1 URL on marketing-site [desktop]

✔ https://example.com
  Perf: 92  A11y: 98  Best Pr.: 100  SEO: 91

┌──────────────────────────┬────────────────────────┬──────────┬─────────┬──────┬──────┬──────────┬─────┬────────┬───────┬────────┐
│ Date                     │ URL                    │ Label    │ Device  │ Perf │ A11y │ Best Pr. │ SEO │ LCP    │ CLS   │ TBT    │
├──────────────────────────┼────────────────────────┼──────────┼─────────┼──────┼──────┼──────────┼─────┼────────┼───────┼────────┤
│ 1/15/2025, 2:34:01 PM    │ https://example.com    │ homepage │ desktop │ 92   │ 98   │ 100      │ 91  │ 1.24s  │ 0.002 │ 120ms  │
└──────────────────────────┴────────────────────────┴──────────┴─────────┴──────┴──────┴──────────┴─────┴────────┴───────┴────────┘

✓ 1 audit(s) saved.
```

---

### `sitespeed report`

Display audit history for the current project.

```bash
# Show last 10 audits (default)
sitespeed report

# Show last 20 audits
sitespeed report --last 20

# Filter to a specific label
sitespeed report --label homepage

# Filter to mobile audits only
sitespeed report --device mobile

# Filter by tag
sitespeed report --tag post-deploy

# Auto-grouped by device — shows 🖥 Desktop and 📱 Mobile sections
# when both devices have runs under the same label
sitespeed report --label homepage

# Smart compare: Desktop vs Mobile when both exist; First vs Latest otherwise
sitespeed report --compare --label homepage

# Compare latest run of two tags side-by-side
sitespeed report --compare-tags before,after

# Export to JSON / CSV
sitespeed report --json | jq '.[] | .Performance'
sitespeed report --csv > audits.csv
```

**Options:**

| Flag | Description | Default |
|------|-------------|---------|
| `--last, -n <n>` | Show last N audits | `10` |
| `--label, -l <label>` | Filter by label | — |
| `--device, -d <device>` | Filter by device (`desktop`\|`mobile`) | — |
| `--tag, -t <tag>` | Filter by tag | — |
| `--compare` | Smart compare: Desktop vs Mobile when both exist; otherwise First vs Latest | off |
| `--compare-tags <tags>` | Compare latest run of two tags, e.g. `"before,after"` | — |
| `--json` | Output as JSON | off |
| `--csv` | Output as CSV | off |

> **Auto device-grouping:** When you run `--label homepage` without `--device`, the CLI detects whether you have both desktop and mobile runs and automatically splits the output into two labelled sections. Add `--device desktop` to see only one device.

> **Tag-based comparison:** Tag your audits with `--tags "before"` before a deploy and `--tags "after"` after. Then compare them with `--compare-tags before,after` to see an exact Δ for every metric.

**Example: auto-grouped output**

```
🖥  Desktop — homepage  (marketing-site)

┌────────────────────────┬────────────────────────┬──────────┬─────────┬──────┬────────┬───────┬────────┐
│ Date                   │ URL                    │ Label    │ Device  │ Perf │ LCP    │ CLS   │ TBT    │
├────────────────────────┼────────────────────────┼──────────┼─────────┼──────┼────────┼───────┼────────┤
│ 1/15/2025, 2:34:01 PM  │ https://example.com    │ homepage │ desktop │ 92   │ 1.24s  │ 0.002 │ 120ms  │
└────────────────────────┴────────────────────────┴──────────┴─────────┴──────┴────────┴───────┴────────┘

📱 Mobile — homepage  (marketing-site)

┌────────────────────────┬────────────────────────┬──────────┬────────┬──────┬────────┬───────┬────────┐
│ Date                   │ URL                    │ Label    │ Device │ Perf │ LCP    │ CLS   │ TBT    │
├────────────────────────┼────────────────────────┼──────────┼────────┼──────┼────────┼───────┼────────┤
│ 1/15/2025, 2:35:44 PM  │ https://example.com    │ homepage │ mobile │ 68   │ 3.10s  │ 0.042 │ 510ms  │
└────────────────────────┴────────────────────────┴──────────┴────────┴──────┴────────┴───────┴────────┘
```

**Example: `--compare` output (Desktop vs Mobile)**

```
Comparison — marketing-site  label: homepage

┌────────────────────┬──────────────────────────┬──────────────────────────┬──────────────┐
│ Metric             │ 🖥  Desktop               │ 📱 Mobile                │ Δ Change     │
├────────────────────┼──────────────────────────┼──────────────────────────┼──────────────┤
│ Run At             │ 1/15/2025, 2:34:01 PM    │ 1/15/2025, 2:35:44 PM   │              │
│ Performance        │ 92                       │ 68                       │ -24          │
│ LCP                │ 1.24s                    │ 3.10s                    │ +1860ms      │
│ CLS                │ 0.002                    │ 0.042                    │ +0.040       │
└────────────────────┴──────────────────────────┴──────────────────────────┴──────────────┘
```

**Example: `--compare-tags` output**

```
Comparison — marketing-site  tags: before → after

┌────────────────────┬──────────────────────────┬──────────────────────────┬──────────────┐
│ Metric             │ before                   │ after                    │ Δ Change     │
├────────────────────┼──────────────────────────┼──────────────────────────┼──────────────┤
│ Run At             │ 1/10/2025, 10:00:00 AM   │ 1/15/2025, 2:34:01 PM   │              │
│ Performance        │ 45                       │ 92                       │ +47          │
│ LCP                │ 4.50s                    │ 1.24s                    │ -3260ms      │
│ CLS                │ 0.214                    │ 0.002                    │ -0.212       │
└────────────────────┴──────────────────────────┴──────────────────────────┴──────────────┘
```

---

### `sitespeed projects`

List all accounts and projects with their audit counts.
Works without a local `.sitespeedrc.json`.

```bash
sitespeed projects
```

```
All projects  (3 total, DB: /Users/you/.sitespeed/data.db)

┌───────────────┬─────────────────────┬──────────────────────────────┬────────┬────────────┐
│ Account       │ Project             │ Base URL                     │ Audits │ Created    │
├───────────────┼─────────────────────┼──────────────────────────────┼────────┼────────────┤
│ acme-corp     │ blog                │ https://blog.acme.com        │ 12     │ 1/10/2025  │
│ acme-corp     │ marketing-site      │ https://www.acme.com         │ 47     │ 12/1/2024  │
│ personal      │ portfolio           │ https://me.example.com       │ 8      │ 1/5/2025   │
└───────────────┴─────────────────────┴──────────────────────────────┴────────┴────────────┘
```

---

### `sitespeed trend [label]`

Show a metric trend over time as a Unicode sparkline.

```bash
# Performance trend for all audits
sitespeed trend

# Performance trend filtered to a specific label
sitespeed trend homepage

# LCP trend
sitespeed trend homepage --metric lcp

# CLS trend
sitespeed trend --metric cls
```

**Options:**

| Flag | Description | Default |
|------|-------------|---------|
| `--metric, -m <metric>` | `performance`, `accessibility`, `best-practices`, `seo`, `lcp`, `fcp`, `fid`, `cls`, `tti`, `tbt`, `speed-index` | `performance` |

**Example output:**

```
Performance trend  label: homepage  —  marketing-site  (higher is better)
───────────────────────────────────────────────────────

  ▁▂▃▄▅▅▆▇▇█  (10 audits)
  min: 43  max: 92  latest: 92  trend: +49

  Recent data points:
    1/10/2025, 10:00 AM  43  [desktop]  https://www.acme.com/
    1/11/2025, 11:30 AM  58  [desktop]  https://www.acme.com/
    1/12/2025, 9:15 AM   67  [desktop]  https://www.acme.com/
    1/13/2025, 2:00 PM   75  [desktop]  https://www.acme.com/
    1/14/2025, 4:45 PM   88  [desktop]  https://www.acme.com/
    1/15/2025, 2:34 PM   92  [desktop]  https://www.acme.com/
```

---

### `sitespeed export`

Export all audit records for the current project to JSON or CSV.

```bash
# Print JSON to stdout
sitespeed export

# Save JSON to file
sitespeed export --output audits.json

# Export as CSV
sitespeed export --format csv --output audits.csv

# Pipe JSON to another tool
sitespeed export | jq 'map(select(.score_performance < 50))'
```

**Options:**

| Flag | Description | Default |
|------|-------------|---------|
| `--format, -f <format>` | `json` or `csv` | `json` |
| `--output, -o <file>` | Write to file instead of stdout | — |

---

### `sitespeed cleanup`

Delete audit runs for the current project. Supports dry-run mode and multiple filter options.

```bash
# Preview what would be deleted (dry-run)
sitespeed cleanup --older-than 30 --dry-run

# Delete runs older than 30 days (with confirmation prompt)
sitespeed cleanup --older-than 30

# Delete runs older than 30 days, skip confirmation
sitespeed cleanup --older-than 30 --yes

# Delete runs before a specific date
sitespeed cleanup --before 2025-01-01

# Delete runs with a specific label
sitespeed cleanup --label staging

# Delete ALL audit runs for the current project
sitespeed cleanup --all --yes
```

**Options:**

| Flag | Description |
|------|-------------|
| `--all` | Delete all audit runs for this project |
| `--label <label>` | Delete only runs with this label |
| `--older-than <days>` | Delete runs older than N days |
| `--before <date>` | Delete runs before `YYYY-MM-DD` |
| `--dry-run` | Show what would be deleted without touching the DB |
| `-y, --yes` | Skip the confirmation prompt |

---

## Configuration Reference

`.sitespeedrc.json` is created by `sitespeed init` and lives in your working directory:

```json
{
  "account": "acme-corp",
  "project":  "marketing-site",
  "device":   "desktop",
  "dbPath":   "~/.sitespeed/data.db"
}
```

| Key | Description |
|-----|-------------|
| `account` | Account name (looked up by name in the DB) |
| `project` | Project name (looked up by name + account) |
| `device` | Default device for audits (`desktop` or `mobile`) |
| `dbPath` | Path to the SQLite database file; `~` is expanded to your home directory |

---

## Database

By default the database lives at **`~/.sitespeed/data.db`**. A single file holds all accounts, projects, and audits — making it trivially easy to back up.

### Backup

```bash
cp ~/.sitespeed/data.db ~/.sitespeed/data.db.backup-$(date +%Y%m%d)
```

### Inspect directly

```bash
sqlite3 ~/.sitespeed/data.db ".tables"
sqlite3 ~/.sitespeed/data.db "SELECT url, score_performance, run_at FROM audits ORDER BY run_at DESC LIMIT 5;"
```

### Schema overview

| Table | Purpose |
|-------|---------|
| `accounts` | Top-level organisational unit (e.g. client name) |
| `projects` | A website under an account, with a base URL |
| `audits` | Individual Lighthouse audit results with all scores and Core Web Vitals |

---

## Development

```bash
# Run without installing globally
node bin/sitespeed.js --help
node bin/sitespeed.js init
node bin/sitespeed.js audit https://example.com

# Lint
npm run lint
```

---

## Scores colour legend

| Score | Colour | Meaning |
|-------|--------|---------|
| ≥ 90 | 🟢 Green | Good |
| 50–89 | 🟡 Yellow | Needs improvement |
| < 50 | 🔴 Red | Poor |

---

## License

MIT
