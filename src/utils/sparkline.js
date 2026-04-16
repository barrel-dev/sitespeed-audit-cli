/**
 * ASCII sparkline renderer using Unicode block characters.
 * Maps a series of numeric values to 8 block heights (▁▂▃▄▅▆▇█).
 */

const BLOCKS = ['▁', '▂', '▃', '▄', '▅', '▆', '▇', '█'];

/**
 * Render an array of numbers as a Unicode sparkline string.
 *
 * @param {Array<number|null|undefined>} values
 * @returns {string}
 */
export function sparkline(values) {
  const filtered = (values ?? []).filter((v) => v !== null && v !== undefined && !Number.isNaN(v));
  if (filtered.length === 0) return '';

  const min = Math.min(...filtered);
  const max = Math.max(...filtered);
  const range = max - min;

  return filtered
    .map((v) => {
      if (range === 0) return BLOCKS[3]; // flat midline when all values equal
      const normalised = (v - min) / range;
      const idx = Math.min(Math.floor(normalised * 8), 7);
      return BLOCKS[idx];
    })
    .join('');
}

/**
 * Render a sparkline and return statistics alongside it.
 *
 * @param {Array<number|null|undefined>} values
 * @param {{ unit?: 'ms'|'score'|'cls'|'' }} opts
 * @returns {{
 *   line: string,
 *   summary: string,
 *   first: number, last: number, min: number, max: number, count: number
 * }|{ line: '', summary: 'No data' }}
 */
export function sparklineWithStats(values, { unit = '' } = {}) {
  const filtered = (values ?? []).filter((v) => v !== null && v !== undefined && !Number.isNaN(v));
  if (filtered.length === 0) return { line: '', summary: 'No data' };

  const min = Math.min(...filtered);
  const max = Math.max(...filtered);
  const first = filtered[0];
  const last = filtered[filtered.length - 1];
  const trend = last - first;

  const fmt = (v) => {
    if (unit === 'ms') return `${Math.round(v)}ms`;
    if (unit === 'score') return String(Math.round(v));
    if (unit === 'cls') return v.toFixed(3);
    return Number.isInteger(v) ? String(v) : v.toFixed(2);
  };

  const trendStr = (trend >= 0 ? '+' : '') + fmt(trend);

  return {
    line: sparkline(filtered),
    summary: `min: ${fmt(min)}  max: ${fmt(max)}  latest: ${fmt(last)}  trend: ${trendStr}`,
    first,
    last,
    min,
    max,
    count: filtered.length,
  };
}
