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

  // ── Fetch all audits ─────────────────────────────────────────────────────────
  const audits = getAllAuditsForExport(project.id);

  if (audits.length === 0) {
    console.log(chalk.yellow('\nNo audits to export for this project.\n'));
    return;
  }

  // ── Format output ─────────────────────────────────────────────────────────────
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

// ─── CSV helpers ──────────────────────────────────────────────────────────────

const CSV_HEADERS = [
  'id', 'url', 'label', 'device', 'run_at',
  'score_performance', 'score_accessibility', 'score_best_practices', 'score_seo',
  'metric_lcp', 'metric_fid', 'metric_cls', 'metric_fcp',
  'metric_tti', 'metric_tbt', 'metric_speed_index',
  'tags',
];

function toCSV(audits) {
  const escape = (v) => {
    if (v === null || v === undefined) return '';
    const s = String(v);
    if (s.includes(',') || s.includes('"') || s.includes('\n')) {
      return '"' + s.replace(/"/g, '""') + '"';
    }
    return s;
  };

  const rows = [
    CSV_HEADERS.join(','),
    ...audits.map((a) => CSV_HEADERS.map((h) => escape(a[h])).join(',')),
  ];

  return rows.join('\n');
}
