/**
 * SQLite database connection singleton.
 * Call openDb(path) once at the start of each command; getDb() everywhere else.
 */
import Database from 'better-sqlite3';
import { mkdirSync, readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

/** @type {import('better-sqlite3').Database|null} */
let _db = null;

/**
 * Open (or create) the SQLite database at dbPath and apply the schema.
 * Idempotent — subsequent calls with the same path return the cached instance.
 *
 * @param {string} dbPath  Absolute path to the .db file.
 * @returns {import('better-sqlite3').Database}
 */
export function openDb(dbPath) {
  if (_db) return _db;

  // Ensure the parent directory exists
  mkdirSync(dirname(dbPath), { recursive: true });

  _db = new Database(dbPath);
  _db.pragma('journal_mode = WAL');
  _db.pragma('foreign_keys = ON');

  // Apply schema — CREATE TABLE IF NOT EXISTS is idempotent
  const schema = readFileSync(join(__dirname, 'schema.sql'), 'utf-8');
  _db.exec(schema);

  return _db;
}

/**
 * Return the already-opened database instance.
 * Throws if openDb() has not been called yet.
 *
 * @returns {import('better-sqlite3').Database}
 */
export function getDb() {
  if (!_db) {
    throw new Error('Database not initialized. Call openDb(dbPath) before running queries.');
  }
  return _db;
}

/**
 * Close the database and reset the singleton.
 * Mainly useful in tests.
 */
export function closeDb() {
  if (_db) {
    _db.close();
    _db = null;
  }
}
