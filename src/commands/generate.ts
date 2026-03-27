import * as fs from 'fs';
import * as path from 'path';
import { OpenAPIParser } from '../core/parser';
import { DocGenerator } from '../core/generator';
import { configManager, Config } from '../utils/config';
import { VersionManager } from '../core/version';
import { logger } from '../utils/logger';

export async function generateCommand(options: {
  input?: string;
  output?: string;
  format?: 'markdown' | 'html' | 'pdf';
  config?: string;
  language?: string;
  noVersion?: boolean;
}): Promise<void> {
  // Load config
  if (options.config) {
    configManager.load(options.config);
  } else {
    configManager.load();
  }

  // Override config with command-line options
  if (options.input) {
    configManager.set({ input: options.input });
  }
  if (options.output) {
    configManager.set({ output: options.output });
  }
  if (options.format) {
    configManager.set({ format: options.format });
  }
  if (options.language) {
    configManager.set({ language: options.language as 'en' | 'zh' });
  }

  // Validate config
  configManager.validate();

  const config = configManager.get();

  logger.info('Starting documentation generation...');
  logger.info(`Input: ${config.input}`);
  logger.info(`Output: ${config.output}`);
  logger.info(`Format: ${config.format}`);

  try {
    // Parse OpenAPI spec
    const parser = await OpenAPIParser.load(config.input);
    logger.success(`Loaded ${parser.getTitle()} v${parser.getVersion()}`);
    logger.info(`Found ${Object.keys(parser.getPaths()).length} API paths`);
    logger.info(`Found ${parser.getTags().length} tags`);
    logger.info(`Found ${Object.keys(parser.getSchemas()).length} schemas`);

    // Generate documentation
    const generator = new DocGenerator(parser, {
      output: config.output,
      format: config.format,
      template: config.template,
      language: config.language
    });

    const generatedFiles = await generator.generate();

    logger.success(`Documentation generated successfully!`);

    // Print generated files
    logger.info('Generated files:');
    for (const file of generatedFiles) {
      const relativePath = path.relative(process.cwd(), file);
      logger.info(`  - ${relativePath}`);
    }

    // Generate summary
    const summaryPath = path.join(config.output, '.generation-summary.json');
    const summary = {
      generatedAt: new Date().toISOString(),
      apiInfo: {
        title: parser.getTitle(),
        version: parser.getVersion(),
        paths: Object.keys(parser.getPaths()).length,
        tags: parser.getTags().length,
        schemas: Object.keys(parser.getSchemas()).length
      },
      config,
      generatedFiles: generatedFiles.map(file => path.relative(process.cwd(), file))
    };

    fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2), 'utf8');
    logger.debug(`Generation summary saved to ${summaryPath}`);

    // Auto-save version if not disabled
    if (!options.noVersion) {
      try {
        const versionManager = new VersionManager(path.join(path.dirname(config.output), 'versions'));
        const parser = await OpenAPIParser.load(config.input);
        const spec = parser.getSpec();

        await versionManager.loadHistory();
        await versionManager.createVersion(spec, config.output);
        await versionManager.saveVersionSnapshot(spec, config.output, path.join(path.dirname(config.output), 'versions'));
        await versionManager.saveHistory();
        logger.success('Version snapshot saved');
      } catch (versionError: any) {
        logger.warn(`Failed to save version: ${versionError.message}`);
      }
    }

  } catch (error: any) {
    logger.error(`Failed to generate documentation: ${error.message}`);
    process.exit(1);
  }
}
