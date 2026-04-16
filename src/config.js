/**
 * Config helpers for reading/writing .sitespeedrc.json in the current directory.
 */
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

const CONFIG_FILENAME = '.sitespeedrc.json';
export const DEFAULT_DB_PATH = join(homedir(), '.sitespeed', 'data.db');

/**
 * Load .sitespeedrc.json from cwd.
 * @returns {object|null} Parsed config, or null if not found.
 */
export function loadConfig() {
  const configPath = join(process.cwd(), CONFIG_FILENAME);
  if (!existsSync(configPath)) {
    return null;
  }
  try {
    return JSON.parse(readFileSync(configPath, 'utf-8'));
  } catch (err) {
    throw new Error(`Failed to parse ${CONFIG_FILENAME}: ${err.message}`);
  }
}

/**
 * Write config object back to .sitespeedrc.json in cwd.
 * @param {object} config
 */
export function saveConfig(config) {
  const configPath = join(process.cwd(), CONFIG_FILENAME);
  writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n', 'utf-8');
}

/**
 * Resolve the DB path from config, expanding ~ to the home directory.
 * @param {object|null} config
 * @returns {string} Absolute path to the SQLite DB file.
 */
export function resolveDbPath(config) {
  const raw = config?.dbPath ?? DEFAULT_DB_PATH;
  return raw.startsWith('~') ? raw.replace(/^~/, homedir()) : raw;
}

/**
 * Load config, exiting with an error message if it doesn't exist.
 * @returns {object} Parsed config.
 */
export function requireConfig() {
  const config = loadConfig();
  if (!config) {
    console.error(
      '\nNo .sitespeedrc.json found in the current directory.\n' +
        'Run \x1b[36msitespeed init\x1b[0m to set up your project first.\n',
    );
    process.exit(1);
  }
  return config;
}
