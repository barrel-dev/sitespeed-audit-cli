/**
 * `sitespeed trend [label]` — ASCII sparkline performance trend over time.
 *
 * Options:
 *   --metric <name>   Metric to plot (default: performance)
 *                     Supported: performance, accessibility, best-practices, seo,
 *                                lcp, fcp, fid, cls, tti, tbt, speed-index
 */
import chalk from 'chalk';

import { requireConfig, resolveDbPath } from '../config.js';
import { openDb } from '../db/index.js';
import { getAccountByName, getProjectByName, getAuditTrend } from '../db/queries.js';
import { sparklineWithStats } from '../utils/sparkline.js';
import { metricLabel, metricUnit, isLowerBetter, formatMetricValue } from '../utils/format.js';

export async function trendCommand(label, options) {
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

  const metric = options.metric ?? 'performance';
  const unit = metricUnit(metric);
  const lowerBetter = isLowerBetter(metric);

  // ── Fetch trend data ─────────────────────────────────────────────────────────
  const data = getAuditTrend(project.id, { label, metric });

  if (data.length === 0) {
    console.log(
      chalk.yellow(`\nNo data found for metric "${metric}"`) +
        (label ? ` with label "${label}"` : '') +
        ' in project ' +
        chalk.cyan(config.project) +
        '.\n',
    );
    return;
  }

  const values = data.map((d) => d.value);
  const { line, summary, first, last, min, max } = sparklineWithStats(values, { unit });

  // ── Header ───────────────────────────────────────────────────────────────────
  const title =
    chalk.bold(metricLabel(metric)) +
    ' trend' +
    (label ? `  label: ${chalk.gray(label)}` : '') +
    `  —  ${chalk.cyan(config.project)}`;

  const lowerNote = lowerBetter
    ? chalk.gray('  (lower is better)')
    : chalk.gray('  (higher is better)');

  console.log(`\n${title}${lowerNote}`);
  console.log(chalk.gray('─'.repeat(55)));

  // ── Sparkline ─────────────────────────────────────────────────────────────────
  // Colour the sparkline: green when trend is improving, red when degrading
  const trend = last - first;
  const improved = lowerBetter ? trend < 0 : trend > 0;
  const coloredLine = data.length === 1
    ? chalk.gray(line)
    : improved
    ? chalk.green(line)
    : chalk.red(line);

  console.log(`\n  ${coloredLine}  ${chalk.gray(`(${data.length} audits)`)}`);
  console.log(`  ${chalk.gray(summary)}\n`);

  // ── Recent data points ────────────────────────────────────────────────────────
  const recent = data.slice(-10); // last 10 points
  if (recent.length > 0) {
    console.log(chalk.bold('  Recent data points:'));
    for (const point of recent) {
      const date = new Date(point.run_at).toLocaleString();
      const val = formatMetricValue(point.value, metric);
      const deviceTag = chalk.gray(`[${point.device ?? 'desktop'}]`);
      const urlPart = chalk.gray(truncate(point.url, 45));
      console.log(`    ${chalk.gray(date)}  ${val}  ${deviceTag}  ${urlPart}`);
    }
    console.log();
  }
}

function truncate(str, len) {
  if (!str) return '';
  return str.length <= len ? str : str.slice(0, len - 1) + '…';
}
