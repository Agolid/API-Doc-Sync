import * as path from 'path';
import * as parser from '@apidevtools/swagger-parser';
import { configManager } from '../utils/config';
import { logger } from '../utils/logger';
import chalk from '../utils/chalk';

export async function validateCommand(options: {
  specPath?: string;
  config?: string;
}): Promise<void> {
  // Load config
  if (options.config) {
    configManager.load(options.config);
  } else {
    configManager.load();
  }

  const config = configManager.get();
  const specPath = options.specPath || config.input;

  if (!specPath) {
    logger.error('No spec path provided. Use --input or set input in config.');
    process.exit(1);
  }

  logger.info(`Validating: ${specPath}`);

  try {
    const api = await (parser as any).default.validate(specPath);
    const title = (api as any).info?.title || 'Unknown';
    const version = (api as any).info?.version || 'N/A';

    console.log('');
    console.log(chalk.green('✓ Valid OpenAPI/Swagger specification'));
    console.log(chalk.gray(`  Title: ${title}`));
    console.log(chalk.gray(`  Version: ${version}`));
    console.log('');
  } catch (error: any) {
    console.log('');
    console.log(chalk.red('✗ Validation failed'));
    if (error.message) {
      console.log(chalk.red(`  ${error.message}`));
    }
    if (error.details) {
      for (const detail of error.details) {
        console.log(chalk.red(`  - ${detail}`));
      }
    }
    console.log('');
    process.exit(1);
  }
}
