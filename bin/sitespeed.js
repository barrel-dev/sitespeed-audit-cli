#!/usr/bin/env node
/**
 * sitespeed — Lighthouse-based site speed audit CLI.
 *
 * Entry point: registers all commands with Commander and dispatches to the
 * appropriate handler in src/commands/.
 */
import { Command } from 'commander';

import { initCommand } from '../src/commands/init.js';
import { auditCommand } from '../src/commands/audit.js';
import { reportCommand } from '../src/commands/report.js';
import { projectsCommand } from '../src/commands/projects.js';
import { trendCommand } from '../src/commands/trend.js';
import { exportCommand } from '../src/commands/export.js';

const program = new Command();

program
  .name('sitespeed')
  .description(
    'Lighthouse-based site speed audit CLI.\n' +
      'Audits are organised by account and project and stored in a local SQLite database.',
  )
  .version('0.1.0', '-v, --version', 'Print version number');

// ─── sitespeed init ───────────────────────────────────────────────────────────
program
  .command('init')
  .description('Interactively set up .sitespeedrc.json in the current directory.')
  .action(initCommand);

// ─── sitespeed audit [url] ────────────────────────────────────────────────────
program
  .command('audit [url]')
  .description(
    'Run a Lighthouse audit.\n' +
      'If [url] is omitted you will be prompted to enter the full URL to audit.',
  )
  .option('-l, --label <label>', 'Tag this run (e.g. "homepage", "checkout")')
  .option('-d, --device <device>', 'Override device — desktop or mobile', 'desktop')
  .option('-t, --tags <tags>', 'Comma-separated tags stored with the audit (e.g. "sprint-42,post-deploy")')
  .option('--save-raw', 'Store the full Lighthouse JSON report in the database')
  .option('--urls-file <path>', 'Audit multiple URLs read from a newline-delimited text file')
  .action(auditCommand);

// ─── sitespeed report ─────────────────────────────────────────────────────────
program
  .command('report')
  .description('Display audit history for the current project.')
  .option('-n, --last <n>', 'Show last N audits', '10')
  .option('-l, --label <label>', 'Filter by label')
  .option('-d, --device <device>', 'Filter by device (desktop|mobile)')
  .option('-t, --tag <tag>', 'Filter by tag')
  .option('--compare', 'Side-by-side comparison of the first and latest matching audits')
  .option('--json', 'Output as JSON (suitable for piping)')
  .option('--csv', 'Output as CSV')
  .action(reportCommand);

// ─── sitespeed projects ───────────────────────────────────────────────────────
program
  .command('projects')
  .description('List all accounts and projects with their audit counts.')
  .action(projectsCommand);

// ─── sitespeed trend [label] ──────────────────────────────────────────────────
program
  .command('trend [label]')
  .description(
    'Show a metric trend over time as a Unicode sparkline.\n' +
      'Optionally filter to audits with a specific label.',
  )
  .option(
    '-m, --metric <metric>',
    'Metric to plot: performance | accessibility | best-practices | seo |\n' +
      '               lcp | fcp | fid | cls | tti | tbt | speed-index',
    'performance',
  )
  .action(trendCommand);

// ─── sitespeed export ─────────────────────────────────────────────────────────
program
  .command('export')
  .description('Export all audit records for the current project to JSON or CSV.')
  .option('-f, --format <format>', 'Output format: json or csv', 'json')
  .option('-o, --output <file>', 'Write to a file instead of stdout')
  .action(exportCommand);

program.parse(process.argv);
