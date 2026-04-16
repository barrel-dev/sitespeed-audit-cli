/**
 * cli-table3 helper functions for consistent tabular output.
 */
import Table from 'cli-table3';
import chalk from 'chalk';
import { colorScore, formatMs, formatCls } from './format.js';

// ─── Audit history table ──────────────────────────────────────────────────────

/**
 * Render an array of audit rows as a formatted ASCII table string.
 *
 * @param {object[]} audits  DB rows from getAudits()
 * @returns {string}
 */
export function createAuditTable(audits) {
  const table = new Table({
    head: [
      chalk.bold('Date'),
      chalk.bold('URL'),
      chalk.bold('Label'),
      chalk.bold('Device'),
      chalk.bold('Perf'),
      chalk.bold('A11y'),
      chalk.bold('Best Pr.'),
      chalk.bold('SEO'),
      chalk.bold('LCP'),
      chalk.bold('CLS'),
      chalk.bold('TBT'),
    ],
    style: { head: [], border: [] },
  });

  for (const audit of audits) {
    table.push([
      new Date(audit.run_at).toLocaleString(),
      truncate(audit.url, 38),
      audit.label ?? chalk.gray('—'),
      audit.device ?? 'desktop',
      colorScore(audit.score_performance),
      colorScore(audit.score_accessibility),
      colorScore(audit.score_best_practices),
      colorScore(audit.score_seo),
      formatMs(audit.metric_lcp),
      formatCls(audit.metric_cls),
      formatMs(audit.metric_tbt),
    ]);
  }

  return table.toString();
}

// ─── Compare table ────────────────────────────────────────────────────────────

/**
 * Render a side-by-side first-vs-last comparison table.
 *
 * @param {object} first  First matching audit row.
 * @param {object} last   Latest matching audit row.
 * @returns {string}
 */
export function createCompareTable(first, last) {
  const table = new Table({
    head: [
      chalk.bold('Metric'),
      chalk.bold('First audit'),
      chalk.bold('Latest audit'),
      chalk.bold('Δ Change'),
    ],
    style: { head: [], border: [] },
    colWidths: [22, 26, 26, 14],
    wordWrap: true,
  });

  table.push(
    ['Run at', fmtDate(first.run_at), fmtDate(last.run_at), ''],
    ['URL', truncate(first.url, 22), truncate(last.url, 22), ''],
    ['Label', first.label ?? chalk.gray('—'), last.label ?? chalk.gray('—'), ''],
    ['Device', first.device ?? 'desktop', last.device ?? 'desktop', ''],
    ['', '', '', ''],
    [
      'Performance',
      colorScore(first.score_performance),
      colorScore(last.score_performance),
      deltaScore(first.score_performance, last.score_performance),
    ],
    [
      'Accessibility',
      colorScore(first.score_accessibility),
      colorScore(last.score_accessibility),
      deltaScore(first.score_accessibility, last.score_accessibility),
    ],
    [
      'Best Practices',
      colorScore(first.score_best_practices),
      colorScore(last.score_best_practices),
      deltaScore(first.score_best_practices, last.score_best_practices),
    ],
    [
      'SEO',
      colorScore(first.score_seo),
      colorScore(last.score_seo),
      deltaScore(first.score_seo, last.score_seo),
    ],
    ['', '', '', ''],
    [
      'LCP',
      formatMs(first.metric_lcp),
      formatMs(last.metric_lcp),
      deltaMs(first.metric_lcp, last.metric_lcp, /* lowerIsBetter */ true),
    ],
    [
      'FCP',
      formatMs(first.metric_fcp),
      formatMs(last.metric_fcp),
      deltaMs(first.metric_fcp, last.metric_fcp, true),
    ],
    [
      'TBT',
      formatMs(first.metric_tbt),
      formatMs(last.metric_tbt),
      deltaMs(first.metric_tbt, last.metric_tbt, true),
    ],
    [
      'TTI',
      formatMs(first.metric_tti),
      formatMs(last.metric_tti),
      deltaMs(first.metric_tti, last.metric_tti, true),
    ],
    [
      'CLS',
      formatCls(first.metric_cls),
      formatCls(last.metric_cls),
      deltaCls(first.metric_cls, last.metric_cls),
    ],
    [
      'Speed Index',
      formatMs(first.metric_speed_index),
      formatMs(last.metric_speed_index),
      deltaMs(first.metric_speed_index, last.metric_speed_index, true),
    ],
  );

  return table.toString();
}

// ─── Projects table ───────────────────────────────────────────────────────────

/**
 * Render the list of all accounts/projects with audit counts.
 *
 * @param {object[]} rows  Rows from getAllProjectsWithCounts()
 * @returns {string}
 */
export function createProjectsTable(rows) {
  const table = new Table({
    head: [
      chalk.bold('Account'),
      chalk.bold('Project'),
      chalk.bold('Base URL'),
      chalk.bold('Audits'),
      chalk.bold('Created'),
    ],
    style: { head: [], border: [] },
  });

  for (const row of rows) {
    table.push([
      row.account_name,
      row.project_name,
      truncate(row.base_url, 40),
      String(row.audit_count),
      new Date(row.created_at).toLocaleDateString(),
    ]);
  }

  return table.toString();
}

// ─── Private helpers ──────────────────────────────────────────────────────────

function truncate(str, len) {
  if (!str) return '';
  return str.length <= len ? str : str.slice(0, len - 1) + '…';
}

function fmtDate(isoString) {
  if (!isoString) return chalk.gray('—');
  return new Date(isoString).toLocaleString();
}

/** Higher is better (scores). */
function deltaScore(oldVal, newVal) {
  if (oldVal === null || newVal === null || oldVal === undefined || newVal === undefined)
    return chalk.gray('N/A');
  const d = Math.round(newVal - oldVal);
  if (d > 0) return chalk.green(`+${d}`);
  if (d < 0) return chalk.red(String(d));
  return chalk.gray('±0');
}

/** Lower is better for timing metrics when lowerIsBetter=true. */
function deltaMs(oldVal, newVal, lowerIsBetter = false) {
  if (oldVal === null || newVal === null || oldVal === undefined || newVal === undefined)
    return chalk.gray('N/A');
  const d = Math.round(newVal - oldVal);
  if (d === 0) return chalk.gray('±0');
  const improved = lowerIsBetter ? d < 0 : d > 0;
  const label = (d > 0 ? '+' : '') + d + 'ms';
  return improved ? chalk.green(label) : chalk.red(label);
}

/** Lower is better for CLS. */
function deltaCls(oldVal, newVal) {
  if (oldVal === null || newVal === null || oldVal === undefined || newVal === undefined)
    return chalk.gray('N/A');
  const d = newVal - oldVal;
  if (Math.abs(d) < 0.0005) return chalk.gray('≈0');
  const label = (d > 0 ? '+' : '') + d.toFixed(3);
  return d < 0 ? chalk.green(label) : chalk.red(label);
}
