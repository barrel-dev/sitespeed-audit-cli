/**
 * `sitespeed projects` — list all accounts and projects with audit counts.
 *
 * Works without a local .sitespeedrc.json — uses the default DB path if no
 * config file is present in the cwd.
 */
import chalk from 'chalk';
import { homedir } from 'os';
import { join } from 'path';

import { loadConfig, resolveDbPath } from '../config.js';
import { openDb } from '../db/index.js';
import { getAllProjectsWithCounts } from '../db/queries.js';
import { createProjectsTable } from '../utils/table.js';

export async function projectsCommand() {
  // Gracefully fall back to the default DB if there's no config in cwd
  const config = loadConfig();
  const dbPath = config ? resolveDbPath(config) : join(homedir(), '.sitespeed', 'data.db');

  openDb(dbPath);

  const rows = getAllProjectsWithCounts();

  if (rows.length === 0) {
    console.log(
      chalk.yellow('\nNo projects found in the database.') +
        '\n' +
        chalk.gray(`DB: ${dbPath}`) +
        '\n' +
        chalk.gray('Run `sitespeed init` to create your first account and project.\n'),
    );
    return;
  }

  console.log(
    `\n${chalk.bold('All projects')}  ${chalk.gray(`(${rows.length} total, DB: ${dbPath})`)}\n`,
  );
  console.log(createProjectsTable(rows));
  console.log();
}
