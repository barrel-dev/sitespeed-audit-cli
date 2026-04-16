/**
 * All named query functions for sitespeed-audit-cli.
 * Commands must import from here — never call getDb() directly in command files.
 */
import { getDb } from './index.js';

// ─── Accounts ────────────────────────────────────────────────────────────────

/**
 * Insert an account by name (idempotent — returns existing row if name already exists).
 * @param {string} name
 * @returns {{ id: number, name: string, created_at: string }}
 */
export function createAccount(name) {
  const db = getDb();
  const result = db.prepare('INSERT OR IGNORE INTO accounts (name) VALUES (?)').run(name);
  if (result.changes === 0) {
    return getAccountByName(name);
  }
  return db.prepare('SELECT * FROM accounts WHERE id = ?').get(result.lastInsertRowid);
}

/**
 * @param {string} name
 * @returns {{ id: number, name: string, created_at: string }|undefined}
 */
export function getAccountByName(name) {
  return getDb().prepare('SELECT * FROM accounts WHERE name = ?').get(name);
}

/** @returns {Array<{ id: number, name: string, created_at: string }>} */
export function getAllAccounts() {
  return getDb().prepare('SELECT * FROM accounts ORDER BY name').all();
}

// ─── Projects ─────────────────────────────────────────────────────────────────

/**
 * Insert a project (idempotent — returns existing row on unique constraint hit).
 * @param {number} accountId
 * @param {string} name
 * @param {string} baseUrl
 */
export function createProject(accountId, name, baseUrl) {
  const db = getDb();
  const result = db
    .prepare('INSERT OR IGNORE INTO projects (account_id, name, base_url) VALUES (?, ?, ?)')
    .run(accountId, name, baseUrl);
  if (result.changes === 0) {
    return getProjectByName(accountId, name);
  }
  return db.prepare('SELECT * FROM projects WHERE id = ?').get(result.lastInsertRowid);
}

/**
 * @param {number} accountId
 * @param {string} name
 */
export function getProjectByName(accountId, name) {
  return getDb()
    .prepare('SELECT * FROM projects WHERE account_id = ? AND name = ?')
    .get(accountId, name);
}

/** @param {number} id */
export function getProjectById(id) {
  return getDb().prepare('SELECT * FROM projects WHERE id = ?').get(id);
}

/** @param {number} accountId */
export function getProjectsByAccountId(accountId) {
  return getDb()
    .prepare('SELECT * FROM projects WHERE account_id = ? ORDER BY name')
    .all(accountId);
}

/**
 * Return all projects with their account name and audit count.
 */
export function getAllProjectsWithCounts() {
  return getDb()
    .prepare(
      `SELECT
         a.name  AS account_name,
         p.id    AS project_id,
         p.name  AS project_name,
         p.base_url,
         p.created_at,
         COUNT(au.id) AS audit_count
       FROM accounts a
       JOIN projects p  ON p.account_id = a.id
       LEFT JOIN audits au ON au.project_id = p.id
       GROUP BY p.id
       ORDER BY a.name, p.name`,
    )
    .all();
}

// ─── Audits ───────────────────────────────────────────────────────────────────

/**
 * Insert a single audit record.
 *
 * @param {{
 *   projectId: number,
 *   url: string,
 *   label?: string|null,
 *   device?: string,
 *   scores: { performance: number, accessibility: number, bestPractices: number, seo: number },
 *   metrics: { lcp: number|null, fcp: number|null, fid: number|null, cls: number|null,
 *               tti: number|null, tbt: number|null, speedIndex: number|null },
 *   rawJson?: string|null,
 *   tags?: string[]|null,
 * }} params
 */
export function insertAudit({ projectId, url, label, device, scores, metrics, rawJson, tags }) {
  const db = getDb();
  const result = db
    .prepare(
      `INSERT INTO audits (
         project_id, url, label, device,
         score_performance, score_accessibility, score_best_practices, score_seo,
         metric_lcp, metric_fid, metric_cls, metric_fcp, metric_tti, metric_tbt, metric_speed_index,
         raw_json, tags
       ) VALUES (
         @projectId, @url, @label, @device,
         @scorePerformance, @scoreAccessibility, @scoreBestPractices, @scoreSeo,
         @metricLcp, @metricFid, @metricCls, @metricFcp, @metricTti, @metricTbt, @metricSpeedIndex,
         @rawJson, @tags
       )`,
    )
    .run({
      projectId,
      url,
      label: label ?? null,
      device: device ?? 'desktop',
      scorePerformance: scores.performance ?? null,
      scoreAccessibility: scores.accessibility ?? null,
      scoreBestPractices: scores.bestPractices ?? null,
      scoreSeo: scores.seo ?? null,
      metricLcp: metrics.lcp ?? null,
      metricFid: metrics.fid ?? null,
      metricCls: metrics.cls ?? null,
      metricFcp: metrics.fcp ?? null,
      metricTti: metrics.tti ?? null,
      metricTbt: metrics.tbt ?? null,
      metricSpeedIndex: metrics.speedIndex ?? null,
      rawJson: rawJson ?? null,
      tags: tags?.length ? JSON.stringify(tags) : null,
    });

  return db.prepare('SELECT * FROM audits WHERE id = ?').get(result.lastInsertRowid);
}

/**
 * Retrieve audits for a project with optional filters.
 *
 * @param {number} projectId
 * @param {{ last?: number, label?: string, device?: string, tag?: string }} opts
 */
export function getAudits(projectId, { last = 10, label, device, tag } = {}) {
  const db = getDb();
  const conditions = ['project_id = @projectId'];
  const params = { projectId };

  if (label) {
    conditions.push('label = @label');
    params.label = label;
  }
  if (device) {
    conditions.push('device = @device');
    params.device = device;
  }

  const where = conditions.join(' AND ');
  const rows = db
    .prepare(
      `SELECT * FROM audits
       WHERE ${where}
       ORDER BY run_at DESC
       LIMIT @last`,
    )
    .all({ ...params, last: parseInt(last, 10) });

  // Tag filter done in JS since tags is stored as a JSON array string
  if (tag) {
    return rows.filter((row) => {
      if (!row.tags) return false;
      try {
        return JSON.parse(row.tags).includes(tag);
      } catch {
        return false;
      }
    });
  }

  return rows;
}

/**
 * Return the first and last audit rows matching the given filters.
 *
 * @param {number} projectId
 * @param {{ label?: string, device?: string }} opts
 */
export function getFirstAndLastAudits(projectId, { label, device } = {}) {
  const db = getDb();
  const conditions = ['project_id = @projectId'];
  const params = { projectId };

  if (label) {
    conditions.push('label = @label');
    params.label = label;
  }
  if (device) {
    conditions.push('device = @device');
    params.device = device;
  }

  const where = conditions.join(' AND ');
  const first = db
    .prepare(`SELECT * FROM audits WHERE ${where} ORDER BY run_at ASC  LIMIT 1`)
    .get(params);
  const last = db
    .prepare(`SELECT * FROM audits WHERE ${where} ORDER BY run_at DESC LIMIT 1`)
    .get(params);

  return { first, last };
}

/**
 * Return time-series data for a given metric, used by the trend command.
 *
 * @param {number} projectId
 * @param {{ label?: string, metric?: string, limit?: number }} opts
 */
export function getAuditTrend(projectId, { label, metric = 'performance', limit = 100 } = {}) {
  const db = getDb();
  const conditions = ['project_id = @projectId'];
  const params = { projectId };

  if (label) {
    conditions.push('label = @label');
    params.label = label;
  }

  const col = resolveMetricColumn(metric);
  const where = conditions.join(' AND ');

  return db
    .prepare(
      `SELECT run_at, ${col} AS value, label, device, url
       FROM audits
       WHERE ${where} AND ${col} IS NOT NULL
       ORDER BY run_at ASC
       LIMIT @limit`,
    )
    .all({ ...params, limit });
}

/**
 * Return all audits for a project, ordered oldest-first (for export).
 * @param {number} projectId
 */
export function getAllAuditsForExport(projectId) {
  return getDb()
    .prepare('SELECT * FROM audits WHERE project_id = ? ORDER BY run_at ASC')
    .all(projectId);
}

/**
 * Return the distinct devices that have audit runs for a given label.
 * Used to detect when a label has both desktop and mobile runs.
 *
 * @param {number} projectId
 * @param {string} label
 * @returns {string[]}  e.g. ['desktop', 'mobile']
 */
export function getDistinctDevicesForLabel(projectId, label) {
  const rows = getDb()
    .prepare(
      `SELECT DISTINCT device FROM audits
       WHERE project_id = ? AND label = ?
       ORDER BY device`,
    )
    .all(projectId, label);
  return rows.map((r) => r.device);
}

/**
 * Return the latest audit row that includes a given tag value.
 * Tags are stored as a JSON array string, so filtering happens in JS.
 *
 * @param {number} projectId
 * @param {string} tag
 * @returns {object|null}
 */
export function getLatestAuditByTag(projectId, tag) {
  const rows = getDb()
    .prepare(
      `SELECT * FROM audits
       WHERE project_id = ? AND tags IS NOT NULL
       ORDER BY run_at DESC`,
    )
    .all(projectId);

  const match = rows.find((row) => {
    try {
      return JSON.parse(row.tags).includes(tag);
    } catch {
      return false;
    }
  });
  return match ?? null;
}

/**
 * Count audit rows matching a filter (used by cleanup before confirming deletion).
 *
 * @param {{ projectId: number, label?: string, before?: string }} filter
 * @returns {number}
 */
export function countAudits(filter) {
  const db = getDb();
  const { where, params } = buildFilterClause(filter);
  return db.prepare(`SELECT COUNT(*) AS n FROM audits WHERE ${where}`).get(params).n;
}

/**
 * Delete audit rows matching a filter.
 *
 * @param {{ projectId: number, label?: string, before?: string }} filter
 * @returns {number} Number of rows deleted.
 */
export function deleteAudits(filter) {
  const db = getDb();
  const { where, params } = buildFilterClause(filter);
  return db.prepare(`DELETE FROM audits WHERE ${where}`).run(params).changes;
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

/**
 * Build a WHERE clause and params object from a filter used by cleanup queries.
 * @param {{ projectId: number, label?: string, before?: string }} filter
 */
function buildFilterClause(filter) {
  const conditions = ['project_id = @projectId'];
  const params = { projectId: filter.projectId };

  if (filter.label) {
    conditions.push('label = @label');
    params.label = filter.label;
  }
  if (filter.before) {
    conditions.push('run_at < @before');
    params.before = filter.before;
  }

  return { where: conditions.join(' AND '), params };
}

/**
 * Map a human-friendly metric name to the corresponding DB column name.
 * @param {string} metric
 * @returns {string}
 */
function resolveMetricColumn(metric) {
  const map = {
    performance: 'score_performance',
    accessibility: 'score_accessibility',
    'best-practices': 'score_best_practices',
    bestPractices: 'score_best_practices',
    seo: 'score_seo',
    lcp: 'metric_lcp',
    fid: 'metric_fid',
    cls: 'metric_cls',
    fcp: 'metric_fcp',
    tti: 'metric_tti',
    tbt: 'metric_tbt',
    'speed-index': 'metric_speed_index',
    speedIndex: 'metric_speed_index',
  };
  return map[metric] ?? 'score_performance';
}
