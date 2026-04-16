/**
 * `sitespeed init` — interactive setup of .sitespeedrc.json.
 *
 * Flow:
 *  1. DB path (default ~/.sitespeed/data.db)
 *  2. Account — pick existing or create new
 *  3. Project — pick existing (for selected account) or create new (name + base URL)
 *  4. Default device
 *  5. Write .sitespeedrc.json
 */
import inquirer from 'inquirer';
const { Separator } = inquirer;
import chalk from 'chalk';
import { homedir } from 'os';
import { join } from 'path';

import { loadConfig, saveConfig, resolveDbPath } from '../config.js';
import { openDb } from '../db/index.js';
import {
  createAccount,
  getAllAccounts,
  createProject,
  getProjectsByAccountId,
} from '../db/queries.js';

export async function initCommand() {
  console.log(chalk.bold.cyan('\n🚀  sitespeed init\n'));

  // ── Step 1: DB path ──────────────────────────────────────────────────────────
  const existingConfig = loadConfig();
  const defaultDbPath = existingConfig?.dbPath ?? join(homedir(), '.sitespeed', 'data.db');

  const { dbPath } = await inquirer.prompt([
    {
      type: 'input',
      name: 'dbPath',
      message: 'Database file path:',
      default: defaultDbPath,
    },
  ]);

  openDb(resolveDbPath({ dbPath }));

  // ── Step 2: Account ──────────────────────────────────────────────────────────
  const allAccounts = getAllAccounts();
  let accountName;

  if (allAccounts.length === 0) {
    // No accounts yet — ask for a name directly
    const { name } = await inquirer.prompt([
      {
        type: 'input',
        name: 'name',
        message: 'No accounts found. Enter a name for your first account:',
        validate: (v) => v.trim() !== '' || 'Account name cannot be empty.',
      },
    ]);
    accountName = name.trim();
  } else {
    const { choice } = await inquirer.prompt([
      {
        type: 'list',
        name: 'choice',
        message: 'Select an account:',
        choices: [
          ...allAccounts.map((a) => ({ name: a.name, value: a.name })),
          new Separator(),
          { name: '+ Create new account', value: '__new__' },
        ],
      },
    ]);

    if (choice === '__new__') {
      const { name } = await inquirer.prompt([
        {
          type: 'input',
          name: 'name',
          message: 'New account name:',
          validate: (v) => v.trim() !== '' || 'Account name cannot be empty.',
        },
      ]);
      accountName = name.trim();
    } else {
      accountName = choice;
    }
  }

  const account = createAccount(accountName);

  // ── Step 3: Project ──────────────────────────────────────────────────────────
  const existingProjects = getProjectsByAccountId(account.id);
  let projectName;
  let baseUrl;

  if (existingProjects.length === 0) {
    const answers = await inquirer.prompt([
      {
        type: 'input',
        name: 'name',
        message: 'No projects yet. Enter a name for your first project:',
        validate: (v) => v.trim() !== '' || 'Project name cannot be empty.',
      },
      {
        type: 'input',
        name: 'baseUrl',
        message: 'Base URL for the project (e.g. https://example.com):',
        validate: (v) => {
          try {
            new URL(v);
            return true;
          } catch {
            return 'Please enter a valid URL including the scheme (https://).';
          }
        },
      },
    ]);
    projectName = answers.name.trim();
    baseUrl = answers.baseUrl.trim();
  } else {
    const { choice } = await inquirer.prompt([
      {
        type: 'list',
        name: 'choice',
        message: 'Select a project:',
        choices: [
          ...existingProjects.map((p) => ({
            name: `${p.name}  ${chalk.gray(p.base_url)}`,
            value: p.name,
          })),
          new Separator(),
          { name: '+ Create new project', value: '__new__' },
        ],
      },
    ]);

    if (choice === '__new__') {
      const answers = await inquirer.prompt([
        {
          type: 'input',
          name: 'name',
          message: 'New project name:',
          validate: (v) => v.trim() !== '' || 'Project name cannot be empty.',
        },
        {
          type: 'input',
          name: 'baseUrl',
          message: 'Base URL (e.g. https://example.com):',
          validate: (v) => {
            try {
              new URL(v);
              return true;
            } catch {
              return 'Please enter a valid URL including the scheme (https://).';
            }
          },
        },
      ]);
      projectName = answers.name.trim();
      baseUrl = answers.baseUrl.trim();
    } else {
      projectName = choice;
      baseUrl = existingProjects.find((p) => p.name === choice)?.base_url ?? '';
    }
  }

  const project = createProject(account.id, projectName, baseUrl);

  // ── Step 4: Default device ───────────────────────────────────────────────────
  const { device } = await inquirer.prompt([
    {
      type: 'list',
      name: 'device',
      message: 'Default audit device:',
      choices: [
        { name: 'Desktop', value: 'desktop' },
        { name: 'Mobile (emulated)', value: 'mobile' },
      ],
      default: existingConfig?.device ?? 'desktop',
    },
  ]);

  // ── Step 5: Write config ─────────────────────────────────────────────────────
  const config = { account: accountName, project: projectName, device, dbPath };
  saveConfig(config);

  console.log(chalk.green('\n✓ Configuration written to .sitespeedrc.json'));
  console.log(chalk.gray(`  Account  : ${accountName}`));
  console.log(chalk.gray(`  Project  : ${projectName}`));
  console.log(chalk.gray(`  Base URL : ${project.base_url}`));
  console.log(chalk.gray(`  Device   : ${device}`));
  console.log(chalk.gray(`  DB path  : ${dbPath}`));
  console.log(chalk.cyan('\nRun `sitespeed audit` to run your first audit!\n'));
}
