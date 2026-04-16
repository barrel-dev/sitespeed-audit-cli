/**
 * Formatting helpers shared across commands and table renderers.
 */
import chalk from 'chalk';

/**
 * Colorize a 0–100 performance score.
 * ≥90 → green, 50–89 → yellow, <50 → red.
 *
 * @param {number|null|undefined} score
 * @returns {string} Chalk-colored string.
 */
export function colorScore(score) {
  if (score === null || score === undefined) return chalk.gray('N/A');
  const n = Math.round(score);
  if (n >= 90) return chalk.green(String(n));
  if (n >= 50) return chalk.yellow(String(n));
  return chalk.red(String(n));
}

/**
 * Format a millisecond value as a human-readable string.
 * Values ≥1000ms are shown in seconds.
 *
 * @param {number|null|undefined} ms
 * @returns {string}
 */
export function formatMs(ms) {
  if (ms === null || ms === undefined) return chalk.gray('N/A');
  if (ms >= 1000) return `${(ms / 1000).toFixed(2)}s`;
  return `${Math.round(ms)}ms`;
}

/**
 * Format a Cumulative Layout Shift value (3 decimal places).
 *
 * @param {number|null|undefined} value
 * @returns {string}
 */
export function formatCls(value) {
  if (value === null || value === undefined) return chalk.gray('N/A');
  return value.toFixed(3);
}

/**
 * Format a metric value based on its type.
 * Score metrics → colorScore; CLS → formatCls; timing metrics → formatMs.
 *
 * @param {number|null|undefined} value
 * @param {string} metric  e.g. "performance", "lcp", "cls"
 * @returns {string}
 */
export function formatMetricValue(value, metric) {
  if (value === null || value === undefined) return chalk.gray('N/A');
  const scoreMetrics = new Set(['performance', 'accessibility', 'best-practices', 'seo']);
  if (scoreMetrics.has(metric)) return colorScore(value);
  if (metric === 'cls') return formatCls(value);
  return formatMs(value);
}

/**
 * Return the display unit string for a metric.
 *
 * @param {string} metric
 * @returns {'score'|'cls'|'ms'}
 */
export function metricUnit(metric) {
  const scoreMetrics = new Set(['performance', 'accessibility', 'best-practices', 'seo']);
  if (scoreMetrics.has(metric)) return 'score';
  if (metric === 'cls') return 'cls';
  return 'ms';
}

/**
 * Human-readable label for a metric key.
 *
 * @param {string} metric
 * @returns {string}
 */
export function metricLabel(metric) {
  const labels = {
    performance: 'Performance',
    accessibility: 'Accessibility',
    'best-practices': 'Best Practices',
    seo: 'SEO',
    lcp: 'LCP (Largest Contentful Paint)',
    fid: 'FID (Max Potential)',
    cls: 'CLS (Cumulative Layout Shift)',
    fcp: 'FCP (First Contentful Paint)',
    tti: 'TTI (Time to Interactive)',
    tbt: 'TBT (Total Blocking Time)',
    speedIndex: 'Speed Index',
    'speed-index': 'Speed Index',
  };
  return labels[metric] ?? metric;
}

/**
 * True when a lower value for the metric means better performance.
 *
 * @param {string} metric
 * @returns {boolean}
 */
export function isLowerBetter(metric) {
  return ['lcp', 'fid', 'cls', 'fcp', 'tti', 'tbt', 'speedIndex', 'speed-index'].includes(metric);
}
