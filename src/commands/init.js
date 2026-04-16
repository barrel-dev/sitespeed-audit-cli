/**
 * `sitespeed init` — interactive setup of .sitespeedrc.json.
 *
 * Flow:
 *  1. Account — pick existing or create new
 *  2. Project — pick existing (for selected account) or create new
 *     (base URL is optional — can be set later or overridden per audit)
 *  3. Default device
 *  4. Write .sitespeedrc.json  (DB always stored at .sitespeed/data.db in CWD)
 */
import inquirer from 'inquirer';
const { Separator } = inquirer;
import chalk from 'chalk';

import { loadConfig, saveConfig, resolveDbPath, DEFAULT_DB_PATH } from '../config.js';
import { openDb } from '../db/index.js';
import {
  createAccount,
  getAllAccounts,
  createProject,
  getProjectsByAccountId,
} from '../db/queries.js';

export async function initCommand() {
  console.log(chalk.bold.cyan('\n🚀  sitespeed init\n'));

  // DB is always .sitespeed/data.db inside the current project directory
  const existingConfig = loadConfig();
  const dbPath = existingConfig?.dbPath ?? DEFAULT_DB_PATH;
  openDb(resolveDbPath({ dbPath }));

  // ── Step 1: Account ──────────────────────────────────────────────────────────
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
    ]);
    projectName = answers.name.trim();
    baseUrl = null;
  } else {
    const { choice } = await inquirer.prompt([
      {
        type: 'list',
        name: 'choice',
        message: 'Select a project:',
        choices: [
          ...existingProjects.map((p) => ({
            name: p.base_url ? `${p.name}  ${chalk.gray(p.base_url)}` : p.name,
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
      ]);
      projectName = answers.name.trim();
      baseUrl = null;
    } else {
      projectName = choice;
      baseUrl = existingProjects.find((p) => p.name === choice)?.base_url ?? null;
    }
  }

  const project = createProject(account.id, projectName, baseUrl);

  // ── Step 3: Default device ───────────────────────────────────────────────────
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

  // ── Step 4: Write config ─────────────────────────────────────────────────────
  const config = { account: accountName, project: projectName, device, dbPath };
  saveConfig(config);

  console.log(chalk.green('\n✓ Configuration written to .sitespeedrc.json'));
  console.log(chalk.gray(`  Account  : ${accountName}`));
  console.log(chalk.gray(`  Project  : ${projectName}`));
  console.log(chalk.gray(`  Device   : ${device}`));
  console.log(chalk.gray(`  DB path  : ${dbPath}  ${chalk.dim('(relative to project root)')}`));
  console.log(chalk.cyan('\nRun `sitespeed audit <url>` to run your first audit!\n'));
}
