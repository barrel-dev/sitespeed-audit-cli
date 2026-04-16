/**
 * `sitespeed audit [url]` — run a Lighthouse audit on one or more URLs.
 *
 * Options:
 *   --label <label>     Tag this run (e.g. "homepage")
 *   --device <desktop|mobile>  Override the default device from config
 *   --tags <t1,t2>      Comma-separated tags stored as JSON array
 *   --save-raw          Store the full Lighthouse JSON in the DB
 *   --urls-file <path>  Newline-delimited text file of URLs to audit
 */
import { readFileSync } from 'fs';
import inquirer from 'inquirer';
import chalk from 'chalk';
import ora from 'ora';

import { requireConfig, resolveDbPath } from '../config.js';
import { openDb } from '../db/index.js';
import { getAccountByName, getProjectByName, insertAudit } from '../db/queries.js';
import { runAudit } from '../lighthouse/runner.js';
import { createAuditTable } from '../utils/table.js';
import { colorScore } from '../utils/format.js';

export async function auditCommand(urlArg, options) {
  const config = requireConfig();
  openDb(resolveDbPath(config));

  // ── Resolve account & project ────────────────────────────────────────────────
  const account = getAccountByName(config.account);
  if (!account) {
    console.error(
      chalk.red(`Account "${config.account}" not found in the database.`) +
        '\nRun `sitespeed init` to reconfigure.',
    );
    process.exit(1);
  }

  const project = getProjectByName(account.id, config.project);
  if (!project) {
    console.error(
      chalk.red(`Project "${config.project}" not found for account "${config.account}".`) +
        '\nRun `sitespeed init` to reconfigure.',
    );
    process.exit(1);
  }

  const device = options.device ?? config.device ?? 'desktop';
  const saveRaw = options.saveRaw ?? false;
  const label = options.label ?? null;
  const tags = options.tags
    ? options.tags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean)
    : null;

  // ── Build URL list ───────────────────────────────────────────────────────────
  let urls = [];

  if (options.urlsFile) {
    let content;
    try {
      content = readFileSync(options.urlsFile, 'utf-8');
    } catch (err) {
      console.error(chalk.red(`Cannot read URLs file: ${err.message}`));
      process.exit(1);
    }
    urls = content
      .split('\n')
      .map((u) => u.trim())
      .filter(Boolean);
    if (urls.length === 0) {
      console.error(chalk.red('The --urls-file contains no valid URLs.'));
      process.exit(1);
    }
  } else if (urlArg) {
    urls = [urlArg];
  } else {
    // Interactive — prompt for a full URL
    const { fullUrl } = await inquirer.prompt([
      {
        type: 'input',
        name: 'fullUrl',
        message: 'URL to audit:',
        validate: (v) => {
          try {
            new URL(v.trim());
            return true;
          } catch {
            return 'Please enter a valid URL including the scheme (https://).';
          }
        },
      },
    ]);
    urls = [fullUrl.trim()];
  }

  // ── Audit each URL ───────────────────────────────────────────────────────────
  console.log(
    chalk.bold(`\nAuditing ${urls.length} URL${urls.length > 1 ? 's' : ''} ` +
      `on ${chalk.cyan(config.project)} [${device}]\n`),
  );

  const savedAudits = [];

  for (const url of urls) {
    const spinner = ora({
      text: `${url}`,
      prefixText: chalk.gray('[running]'),
    }).start();

    try {
      const result = await runAudit(url, { device, saveRaw });

      spinner.succeed(
        `${chalk.white(url)}\n` +
          `  Perf: ${colorScore(result.scores.performance)}  ` +
          `A11y: ${colorScore(result.scores.accessibility)}  ` +
          `Best Pr.: ${colorScore(result.scores.bestPractices)}  ` +
          `SEO: ${colorScore(result.scores.seo)}`,
      );

      const audit = insertAudit({
        projectId: project.id,
        url,
        label,
        device,
        scores: result.scores,
        metrics: result.metrics,
        rawJson: result.rawJson,
        tags,
      });

      savedAudits.push(audit);
    } catch (err) {
      spinner.fail(`${chalk.red(url)}\n  ${err.message}`);
    }
  }

  // ── Summary table ────────────────────────────────────────────────────────────
  if (savedAudits.length > 0) {
    console.log('\n' + createAuditTable(savedAudits));
    console.log(
      chalk.green(`\n✓ ${savedAudits.length} audit(s) saved.`) +
        chalk.gray(' Run `sitespeed report` to see history.\n'),
    );
  }
}
