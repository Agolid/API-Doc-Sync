#!/usr/bin/env node

import { Command } from 'commander';
import chalk from './utils/chalk';
import { initCommand } from './commands/init';
import { generateCommand } from './commands/generate';
import { syncCommand } from './commands/sync';
import { diffCommand } from './commands/diff';
import { validateCommand } from './commands/validate';
import { watchCommand } from './commands/watch';
import packageJson from '../package.json';

const program = new Command();

// CLI version
const version = packageJson.version;

// CLI info
program
  .name('api-doc-sync')
  .description('OpenAPI/Swagger documentation automation tool')
  .version(version);

// Banner
if (!process.env.SKIP_BANNER) {
  console.log(chalk.cyan.bold('\n  API-DOC-SYNC'));
  console.log(chalk.gray('  OpenAPI/Swagger Documentation Automation\n'));
}

// Init command
program
  .command('init')
  .description('Initialize api-doc-sync in your project')
  .action(async () => {
    try {
      await initCommand();
    } catch (error: any) {
      console.error(chalk.red(`Error: ${error.message}`));
      process.exit(1);
    }
  });

// Generate command
program
  .command('generate')
  .description('Generate documentation from OpenAPI spec')
  .option('-i, --input <path>', 'OpenAPI spec path or URL')
  .option('-o, --output <dir>', 'Output directory')
  .option('-f, --format <format>', 'Output format (markdown, html, pdf)', 'markdown')
  .option('-c, --config <path>', 'Path to config file')
  .option('-l, --language <lang>', 'Documentation language (en, zh)', 'en')
  .option('--no-version', 'Skip version saving')
  .action(async (options) => {
    try {
      await generateCommand(options);
    } catch (error: any) {
      console.error(chalk.red(`Error: ${error.message}`));
      process.exit(1);
    }
  });

// Sync command
program
  .command('sync')
  .description('Sync documentation to GitHub')
  .option('-c, --config <path>', 'Path to config file')
  .option('-m, --message <text>', 'Commit message')
  .option('-b, --branch <name>', 'Target branch')
  .option('--create-pr', 'Create a pull request instead of pushing directly')
  .option('--no-create-pr', 'Push directly instead of creating a PR')
  .action(async (options) => {
    try {
      await syncCommand(options);
    } catch (error: any) {
      console.error(chalk.red(`Error: ${error.message}`));
      process.exit(1);
    }
  });

// Diff command
program
  .command('diff')
  .description('Show changes between OpenAPI spec versions')
  .option('-c, --config <path>', 'Path to config file')
  .option('-v1, --version1 <version>', 'First version to compare')
  .option('-v2, --version2 <version>', 'Second version to compare')
  .option('-o, --output <dir>', 'Output directory')
  .action(async (options) => {
    try {
      await diffCommand(options);
    } catch (error: any) {
      console.error(chalk.red(`Error: ${error.message}`));
      process.exit(1);
    }
  });

// Validate command
program
  .command('validate [spec-path]')
  .description('Validate an OpenAPI/Swagger specification')
  .option('-c, --config <path>', 'Path to config file')
  .action(async (specPath, options) => {
    try {
      await validateCommand({ specPath, ...options });
    } catch (error: any) {
      console.error(chalk.red(`Error: ${error.message}`));
      process.exit(1);
    }
  });

// Watch command
program
  .command('watch')
  .description('Watch input spec and regenerate docs on change')
  .option('-i, --input <path>', 'OpenAPI spec path or URL')
  .option('-o, --output <dir>', 'Output directory')
  .option('-c, --config <path>', 'Path to config file')
  .option('-l, --language <lang>', 'Documentation language (en, zh)')
  .action(async (options) => {
    try {
      await watchCommand(options);
    } catch (error: any) {
      console.error(chalk.red(`Error: ${error.message}`));
      process.exit(1);
    }
  });

// Parse arguments
program.parse(process.argv);

// Show help if no command provided
if (!process.argv.slice(2).length) {
  program.outputHelp();
}
