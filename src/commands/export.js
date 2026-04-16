/**
 * `sitespeed export` — export all audit records for the current project.
 *
 * Options:
 *   --format <json|csv>   Output format (default: json)
 *   --output <file>       Write to file instead of stdout
 */
import { writeFileSync } from 'fs';
import chalk from 'chalk';

import { requireConfig, resolveDbPath } from '../config.js';
import { openDb } from '../db/index.js';
import { getAccountByName, getProjectByName, getAllAuditsForExport } from '../db/queries.js';

export async function exportCommand(options) {
  const config = requireConfig();
  openDb(resolveDbPath(config));

  // ── Resolve project ──────────────────────────────────────────────────────────
  const account = getAccountByName(config.account);
  if (!account) {
    console.error(chalk.red(`Account "${config.account}" not found. Run \`sitespeed init\`.`));
    process.exit(1);
  }

  const project = getProjectByName(account.id, config.project);
  if (!project) {
    console.error(chalk.red(`Project "${config.project}" not found. Run \`sitespeed init\`.`));
    process.exit(1);
  }

  const format = (options.format ?? 'json').toLowerCase();
  if (!['json', 'csv'].includes(format)) {
    console.error(chalk.red('--format must be "json" or "csv".'));
    process.exit(1);
  }

  // ── Fetch and humanize ───────────────────────────────────────────────────────
  const raw = getAllAuditsForExport(project.id);

  if (raw.length === 0) {
    console.log(chalk.yellow('\nNo audits to export for this project.\n'));
    return;
  }

  const audits = raw.map(humanize);

  // ── Format output ────────────────────────────────────────────────────────────
  const content = format === 'csv' ? toCSV(audits) : JSON.stringify(audits, null, 2);

  // ── Write or print ────────────────────────────────────────────────────────────
  if (options.output) {
    writeFileSync(options.output, content + '\n', 'utf-8');
    console.log(
      chalk.green(`\n✓ Exported ${audits.length} audit(s) to ${options.output}\n`),
    );
  } else {
    process.stdout.write(content + '\n');
  }
}

// ─── Humanize ─────────────────────────────────────────────────────────────────

/**
 * Transform a raw DB audit row into a human-readable object.
 * - Underscore field names → Title Case labels
 * - Timing values (ms) → "1.24s" / "120ms"
 * - CLS → 3 decimal places
 * - run_at ISO string → locale date string
 * - Tags JSON array string → comma-separated string
 */
function humanize(row) {
  return {
    'ID':               row.id,
    'URL':              row.url,
    'Label':            row.label ?? '',
    'Device':           row.device,
    'Run At':           row.run_at ? new Date(row.run_at).toLocaleString() : '',
    'Performance':      row.score_performance ?? '',
    'Accessibility':    row.score_accessibility ?? '',
    'Best Practices':   row.score_best_practices ?? '',
    'SEO':              row.score_seo ?? '',
    'LCP':              fmtMs(row.metric_lcp),
    'FCP':              fmtMs(row.metric_fcp),
    'FID (Max)':        fmtMs(row.metric_fid),
    'CLS':              fmtCls(row.metric_cls),
    'TTI':              fmtMs(row.metric_tti),
    'TBT':              fmtMs(row.metric_tbt),
    'Speed Index':      fmtMs(row.metric_speed_index),
    'Tags':             fmtTags(row.tags),
  };
}

function fmtMs(ms) {
  if (ms === null || ms === undefined) return '';
  if (ms >= 1000) return `${(ms / 1000).toFixed(2)}s`;
  return `${Math.round(ms)}ms`;
}

function fmtCls(v) {
  if (v === null || v === undefined) return '';
  return Number(v).toFixed(3);
}

function fmtTags(tags) {
  if (!tags) return '';
  try {
    const arr = JSON.parse(tags);
    return Array.isArray(arr) ? arr.join(', ') : tags;
  } catch {
    return tags;
  }
}

// ─── CSV helpers ──────────────────────────────────────────────────────────────

function toCSV(audits) {
  if (audits.length === 0) return '';

  const headers = Object.keys(audits[0]);

  const escape = (v) => {
    if (v === null || v === undefined) return '';
    const s = String(v);
    if (s.includes(',') || s.includes('"') || s.includes('\n')) {
      return '"' + s.replace(/"/g, '""') + '"';
    }
    return s;
  };

  const rows = [
    headers.join(','),
    ...audits.map((a) => headers.map((h) => escape(a[h])).join(',')),
  ];

  return rows.join('\n');
}
