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
 * Render a side-by-side comparison table for two audit rows.
 *
 * @param {object} a        Left-hand audit row.
 * @param {object} b        Right-hand audit row.
 * @param {{ colA?: string, colB?: string }} [labels]  Column header overrides.
 * @returns {string}
 */
export function createCompareTable(a, b, { colA = 'First audit', colB = 'Latest audit' } = {}) {
  const table = new Table({
    head: [
      chalk.bold('Metric'),
      chalk.bold(colA),
      chalk.bold(colB),
      chalk.bold('Δ Change'),
    ],
    style: { head: [], border: [] },
    colWidths: [22, 26, 26, 14],
    wordWrap: true,
  });

  table.push(
    ['Run at', fmtDate(a.run_at), fmtDate(b.run_at), ''],
    ['URL', truncate(a.url, 22), truncate(b.url, 22), ''],
    ['Label', a.label ?? chalk.gray('—'), b.label ?? chalk.gray('—'), ''],
    ['Device', a.device ?? 'desktop', b.device ?? 'desktop', ''],
    ['', '', '', ''],
    [
      'Performance',
      colorScore(a.score_performance),
      colorScore(b.score_performance),
      deltaScore(a.score_performance, b.score_performance),
    ],
    [
      'Accessibility',
      colorScore(a.score_accessibility),
      colorScore(b.score_accessibility),
      deltaScore(a.score_accessibility, b.score_accessibility),
    ],
    [
      'Best Practices',
      colorScore(a.score_best_practices),
      colorScore(b.score_best_practices),
      deltaScore(a.score_best_practices, b.score_best_practices),
    ],
    [
      'SEO',
      colorScore(a.score_seo),
      colorScore(b.score_seo),
      deltaScore(a.score_seo, b.score_seo),
    ],
    ['', '', '', ''],
    [
      'LCP',
      formatMs(a.metric_lcp),
      formatMs(b.metric_lcp),
      deltaMs(a.metric_lcp, b.metric_lcp, /* lowerIsBetter */ true),
    ],
    [
      'FCP',
      formatMs(a.metric_fcp),
      formatMs(b.metric_fcp),
      deltaMs(a.metric_fcp, b.metric_fcp, true),
    ],
    [
      'TBT',
      formatMs(a.metric_tbt),
      formatMs(b.metric_tbt),
      deltaMs(a.metric_tbt, b.metric_tbt, true),
    ],
    [
      'TTI',
      formatMs(a.metric_tti),
      formatMs(b.metric_tti),
      deltaMs(a.metric_tti, b.metric_tti, true),
    ],
    [
      'CLS',
      formatCls(a.metric_cls),
      formatCls(b.metric_cls),
      deltaCls(a.metric_cls, b.metric_cls),
    ],
    [
      'Speed Index',
      formatMs(a.metric_speed_index),
      formatMs(b.metric_speed_index),
      deltaMs(a.metric_speed_index, b.metric_speed_index, true),
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
