#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import { initCommand } from './commands/init';
import { generateCommand } from './commands/generate';

const program = new Command();

// CLI version
const packageJson = require('../package.json');
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
  .action(async (options) => {
    try {
      await generateCommand(options);
    } catch (error: any) {
      console.error(chalk.red(`Error: ${error.message}`));
      process.exit(1);
    }
  });

// Sync command (placeholder)
program
  .command('sync')
  .description('Sync documentation to GitHub')
  .option('-c, --config <path>', 'Path to config file')
  .action(async (options) => {
    console.log(chalk.yellow('Sync command coming soon!'));
    console.log(chalk.gray('This feature is planned for Phase 3.'));
  });

// Diff command (placeholder)
program
  .command('diff')
  .description('Show changes between OpenAPI spec versions')
  .option('-i, --input <path>', 'OpenAPI spec path or URL')
  .option('-c, --config <path>', 'Path to config file')
  .action(async (options) => {
    console.log(chalk.yellow('Diff command coming soon!'));
    console.log(chalk.gray('This feature is planned for Phase 4.'));
  });

// Parse arguments
program.parse(process.argv);

// Show help if no command provided
if (!process.argv.slice(2).length) {
  program.outputHelp();
}
