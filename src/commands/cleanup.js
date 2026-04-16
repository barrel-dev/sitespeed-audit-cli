/**
 * `sitespeed cleanup` — delete audit runs for the current project.
 *
 * Options:
 *   --all                Delete ALL audit runs for this project
 *   --label <label>      Delete only runs with this label
 *   --older-than <days>  Delete runs older than N days
 *   --before <date>      Delete runs before YYYY-MM-DD
 *   --dry-run            Show what would be deleted without touching the DB
 *   -y, --yes            Skip the confirmation prompt
 */
import inquirer from 'inquirer';
import chalk from 'chalk';

import { requireConfig, resolveDbPath } from '../config.js';
import { openDb } from '../db/index.js';
import { getAccountByName, getProjectByName, countAudits, deleteAudits } from '../db/queries.js';

export async function cleanupCommand(options) {
  const config = requireConfig();
  openDb(resolveDbPath(config));

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

  // ── Build filter ─────────────────────────────────────────────────────────────
  const filter = buildFilter(options, project.id);

  if (!filter) {
    console.log(
      chalk.yellow('\nNo filter specified. Provide at least one of:') +
        '\n  --all  --label <label>  --older-than <days>  --before <date>\n',
    );
    process.exit(1);
  }

  // ── Count matching rows ───────────────────────────────────────────────────────
  const count = countAudits(filter);

  if (count === 0) {
    console.log(chalk.gray('\nNo audit runs match the given filter. Nothing to delete.\n'));
    return;
  }

  console.log(
    chalk.bold(`\n${options.dryRun ? chalk.cyan('[dry-run] ') : ''}`) +
      `${count} audit run${count !== 1 ? 's' : ''} will be deleted` +
      describeFilter(options) +
      chalk.gray(` on project "${config.project}"`),
  );

  if (options.dryRun) {
    console.log(chalk.cyan('\nDry run — no records were deleted.\n'));
    return;
  }

  // ── Confirm unless -y ────────────────────────────────────────────────────────
  if (!options.yes) {
    const { confirmed } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirmed',
        message: chalk.red(`Delete ${count} record${count !== 1 ? 's' : ''}? This cannot be undone.`),
        default: false,
      },
    ]);
    if (!confirmed) {
      console.log(chalk.gray('\nAborted. Nothing was deleted.\n'));
      return;
    }
  }

  // ── Delete ────────────────────────────────────────────────────────────────────
  const deleted = deleteAudits(filter);
  console.log(chalk.green(`\n✓ ${deleted} audit run${deleted !== 1 ? 's' : ''} deleted.\n`));
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildFilter(options, projectId) {
  const filter = { projectId };
  let hasFilter = false;

  if (options.all) {
    hasFilter = true;
  }
  if (options.label) {
    filter.label = options.label;
    hasFilter = true;
  }
  if (options.olderThan) {
    const days = parseInt(options.olderThan, 10);
    if (isNaN(days) || days < 1) {
      console.error(chalk.red('--older-than must be a positive integer (number of days).'));
      process.exit(1);
    }
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    filter.before = cutoff.toISOString();
    hasFilter = true;
  }
  if (options.before) {
    const d = new Date(options.before);
    if (isNaN(d.getTime())) {
      console.error(chalk.red('--before must be a valid date in YYYY-MM-DD format.'));
      process.exit(1);
    }
    filter.before = d.toISOString();
    hasFilter = true;
  }

  return hasFilter ? filter : null;
}

function describeFilter(options) {
  const parts = [];
  if (options.label) parts.push(` with label "${options.label}"`);
  if (options.olderThan) parts.push(` older than ${options.olderThan} day(s)`);
  if (options.before) parts.push(` before ${options.before}`);
  if (options.all && parts.length === 0) parts.push(' (all runs)');
  return parts.join('');
}
