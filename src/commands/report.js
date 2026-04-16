/**
 * `sitespeed report` — display audit history for the current project.
 *
 * Options:
 *   --last <n>          Show last N audits (default: 10)
 *   --label <label>     Filter by label
 *   --device <d>        Filter by device
 *   --tag <tag>         Filter by tag
 *   --compare           Side-by-side first vs latest comparison
 *   --json              Output raw JSON to stdout
 *   --csv               Output CSV to stdout
 */
import chalk from 'chalk';

import { requireConfig, resolveDbPath } from '../config.js';
import { openDb } from '../db/index.js';
import { getAccountByName, getProjectByName, getAudits, getFirstAndLastAudits } from '../db/queries.js';
import { createAuditTable, createCompareTable } from '../utils/table.js';

export async function reportCommand(options) {
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

  const filters = {
    last: parseInt(options.last ?? '10', 10),
    label: options.label,
    device: options.device,
    tag: options.tag,
  };

  // ── Compare mode ─────────────────────────────────────────────────────────────
  if (options.compare) {
    const { first, last } = getFirstAndLastAudits(project.id, {
      label: options.label,
      device: options.device,
    });

    if (!first || !last) {
      console.log(chalk.yellow('\nNo audits found for the current filters.\n'));
      return;
    }

    if (first.id === last.id) {
      console.log(
        chalk.yellow('\nOnly one audit matches — showing it compared to itself.\n'),
      );
    }

    console.log(
      `\n${chalk.bold('Comparison')} — ${chalk.cyan(config.project)}` +
        (options.label ? `  label: ${chalk.gray(options.label)}` : '') +
        '\n',
    );
    console.log(createCompareTable(first, last));
    console.log();
    return;
  }

  // ── Fetch audits ─────────────────────────────────────────────────────────────
  const audits = getAudits(project.id, filters);

  if (audits.length === 0) {
    console.log(chalk.yellow('\nNo audits found for the current filters.'));
    console.log(chalk.gray('Run `sitespeed audit` to create your first audit.\n'));
    return;
  }

  // ── JSON output ───────────────────────────────────────────────────────────────
  if (options.json) {
    process.stdout.write(JSON.stringify(audits, null, 2) + '\n');
    return;
  }

  // ── CSV output ────────────────────────────────────────────────────────────────
  if (options.csv) {
    process.stdout.write(toCSV(audits) + '\n');
    return;
  }

  // ── Default: ASCII table ──────────────────────────────────────────────────────
  const heading =
    `\n${chalk.bold('Audit history')} — ${chalk.cyan(config.project)}` +
    (options.label ? `  label: ${chalk.gray(options.label)}` : '') +
    (options.device ? `  device: ${chalk.gray(options.device)}` : '') +
    (options.tag ? `  tag: ${chalk.gray(options.tag)}` : '') +
    `  ${chalk.gray(`(last ${audits.length})`)}\n`;

  console.log(heading);
  console.log(createAuditTable(audits));
  console.log();
}

// ─── CSV serialiser ───────────────────────────────────────────────────────────

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
