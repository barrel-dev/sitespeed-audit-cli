/**
 * `sitespeed report` — display audit history for the current project.
 *
 * Options:
 *   --last <n>              Show last N audits (default: 10)
 *   --label <label>         Filter by label
 *   --device <d>            Filter by device
 *   --tag <tag>             Filter by tag
 *   --compare               Smart comparison:
 *                             - label with both devices → Desktop vs Mobile
 *                             - otherwise → First vs Latest
 *   --compare-tags <t1,t2>  Compare latest run of tag t1 vs latest run of tag t2
 *   --json                  Output raw JSON to stdout
 *   --csv                   Output CSV to stdout
 */
import chalk from 'chalk';

import { requireConfig, resolveDbPath } from '../config.js';
import { openDb } from '../db/index.js';
import {
  getAccountByName,
  getProjectByName,
  getAudits,
  getFirstAndLastAudits,
  getDistinctDevicesForLabel,
  getLatestAuditByTag,
} from '../db/queries.js';
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

  // ── --compare-tags <t1,t2> ────────────────────────────────────────────────────
  if (options.compareTags) {
    const parts = options.compareTags.split(',').map((t) => t.trim()).filter(Boolean);
    if (parts.length !== 2) {
      console.error(chalk.red('--compare-tags expects exactly two comma-separated tags, e.g. "before,after"'));
      process.exit(1);
    }
    const [tagA, tagB] = parts;
    const auditA = getLatestAuditByTag(project.id, tagA);
    const auditB = getLatestAuditByTag(project.id, tagB);

    if (!auditA) {
      console.log(chalk.yellow(`\nNo audits found with tag "${tagA}".\n`));
      return;
    }
    if (!auditB) {
      console.log(chalk.yellow(`\nNo audits found with tag "${tagB}".\n`));
      return;
    }

    console.log(
      `\n${chalk.bold('Tag comparison')} — ${chalk.cyan(config.project)}` +
        `  ${chalk.gray(tagA)} vs ${chalk.gray(tagB)}\n`,
    );
    console.log(createCompareTable(auditA, auditB, {
      colA: tagA,
      colB: tagB,
    }));
    console.log();
    return;
  }

  // ── --compare ────────────────────────────────────────────────────────────────
  if (options.compare) {
    // If a label is given and both desktop + mobile runs exist → device comparison
    if (options.label && !options.device) {
      const devices = getDistinctDevicesForLabel(project.id, options.label);
      if (devices.includes('desktop') && devices.includes('mobile')) {
        const { last: desktop } = getFirstAndLastAudits(project.id, {
          label: options.label, device: 'desktop',
        });
        const { last: mobile } = getFirstAndLastAudits(project.id, {
          label: options.label, device: 'mobile',
        });

        if (desktop && mobile) {
          console.log(
            `\n${chalk.bold('Desktop vs Mobile')} — ${chalk.cyan(config.project)}` +
              `  label: ${chalk.gray(options.label)}\n`,
          );
          console.log(createCompareTable(desktop, mobile, {
            colA: '🖥  Desktop',
            colB: '📱 Mobile',
          }));
          console.log();
          return;
        }
      }
    }

    // Default: first vs latest
    const { first, last } = getFirstAndLastAudits(project.id, {
      label: options.label,
      device: options.device,
    });

    if (!first || !last) {
      console.log(chalk.yellow('\nNo audits found for the current filters.\n'));
      return;
    }

    if (first.id === last.id) {
      console.log(chalk.yellow('\nOnly one audit matches — showing it compared to itself.\n'));
    }

    console.log(
      `\n${chalk.bold('First vs Latest')} — ${chalk.cyan(config.project)}` +
        (options.label ? `  label: ${chalk.gray(options.label)}` : '') +
        '\n',
    );
    console.log(createCompareTable(first, last));
    console.log();
    return;
  }

  // ── Fetch audits ─────────────────────────────────────────────────────────────
  const filters = {
    last: parseInt(options.last ?? '10', 10),
    label: options.label,
    device: options.device,
    tag: options.tag,
  };

  const audits = getAudits(project.id, filters);

  if (audits.length === 0) {
    console.log(chalk.yellow('\nNo audits found for the current filters.'));
    console.log(chalk.gray('Run `sitespeed audit` to create your first audit.\n'));
    return;
  }

  // ── JSON / CSV passthrough ────────────────────────────────────────────────────
  if (options.json) {
    process.stdout.write(JSON.stringify(audits, null, 2) + '\n');
    return;
  }
  if (options.csv) {
    process.stdout.write(toCSV(audits) + '\n');
    return;
  }

  // ── Default table — auto-group by device when label has both ──────────────────
  if (options.label && !options.device) {
    const devices = getDistinctDevicesForLabel(project.id, options.label);
    if (devices.length > 1) {
      for (const device of devices) {
        const rows = audits.filter((a) => a.device === device);
        if (rows.length === 0) continue;
        const icon = device === 'mobile' ? '📱' : '🖥 ';
        console.log(
          `\n${chalk.bold('Audit history')} — ${chalk.cyan(config.project)}` +
            `  label: ${chalk.gray(options.label)}` +
            `  ${icon} ${chalk.bold(device)}` +
            `  ${chalk.gray(`(${rows.length} run${rows.length > 1 ? 's' : ''})`)}\n`,
        );
        console.log(createAuditTable(rows));
      }
      console.log();
      return;
    }
  }

  // Single-device or unfiltered: plain table
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
