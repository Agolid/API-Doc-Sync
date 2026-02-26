import * as fs from 'fs';
import * as path from 'path';
import chalk from 'chalk';
import { VersionManager, ChangeSummary } from '../core/version';
import { OpenAPIParser } from '../core/parser';
import { DocGenerator } from '../core/generator';
import { logger } from '../utils/logger';
import { configManager } from '../utils/config';

export interface DiffOptions {
  config?: string;
  version1?: string;
  version2?: string;
  output?: string;
}

export async function diffCommand(options: DiffOptions = {}): Promise<void> {
  logger.info('Starting diff comparison...');

  // Load config
  const config = configManager.load(options.config);
  configManager.validate();

  const versionsDir = path.join(path.dirname(config.output), 'versions');
  const versionManager = new VersionManager(versionsDir);

  await versionManager.loadHistory();

  const allVersions = versionManager.getAllVersions();

  if (allVersions.length < 2) {
    logger.warn('Not enough versions to compare. Need at least 2 versions.');
    return;
  }

  // Determine which versions to compare
  let version1 = options.version1;
  let version2 = options.version2;

  if (!version1 || !version2) {
    // Compare the two most recent versions
    version1 = allVersions[0].version;
    version2 = allVersions[1]?.version;

    if (!version1 || !version2) {
      throw new Error('Not enough versions to compare');
    }
  }

  logger.info(`Comparing version ${version1} vs ${version2}`);

  const v1Info = versionManager.getVersion(version1);
  const v2Info = versionManager.getVersion(version2);

  if (!v1Info || !v2Info) {
    throw new Error(`One or both versions not found: ${version1}, ${version2}`);
  }

  console.log(chalk.cyan.bold('\n  Version Comparison'));
  console.log(chalk.gray('  ================\n'));

  console.log(chalk.yellow('Version 1:'), chalk.white(`${v1Info.version}`));
  console.log(chalk.gray(`  Timestamp: ${new Date(v1Info.timestamp).toISOString()}`));
  console.log(chalk.gray(`  Spec Hash: ${v1Info.specHash.substring(0, 8)}...`));
  console.log(chalk.gray(`  Files: ${v1Info.filesCount}\n`));

  console.log(chalk.yellow('Version 2:'), chalk.white(`${v2Info.version}`));
  console.log(chalk.gray(`  Timestamp: ${new Date(v2Info.timestamp).toISOString()}`));
  console.log(chalk.gray(`  Spec Hash: ${v2Info.specHash.substring(0, 8)}...`));
  console.log(chalk.gray(`  Files: ${v2Info.filesCount}\n`));

  // Compare spec hashes
  if (v1Info.specHash === v2Info.specHash) {
    console.log(chalk.green('✓ No changes in OpenAPI specification'));
  } else {
    console.log(chalk.red('✗ OpenAPI specification has changed'));
  }

  // Find snapshot directories
  const snapshot1 = findSnapshotDirectory(versionsDir, version1, v1Info.timestamp);
  const snapshot2 = findSnapshotDirectory(versionsDir, version2, v2Info.timestamp);

  if (snapshot1 && snapshot2) {
    const docs1 = path.join(snapshot1, 'docs');
    const docs2 = path.join(snapshot2, 'docs');

    if (fs.existsSync(docs1) && fs.existsSync(docs2)) {
      const changes = await versionManager.compareVersions(version1, version2, docs1, docs2);
      displayChanges(changes);
    }
  }
}

function findSnapshotDirectory(versionsDir: string, version: string, timestamp: number): string | null {
  const dirName = `snapshot-${version}-${timestamp}`;
  const dirPath = path.join(versionsDir, dirName);

  if (fs.existsSync(dirPath)) {
    return dirPath;
  }

  return null;
}

function displayChanges(changes: ChangeSummary): void {
  console.log(chalk.cyan.bold('\n  Documentation Changes'));
  console.log(chalk.gray('  ======================\n'));

  if (changes.added.length > 0) {
    console.log(chalk.green(`\n+ Added (${changes.added.length}):`));
    for (const file of changes.added) {
      console.log(chalk.green(`  ${file}`));
    }
  }

  if (changes.removed.length > 0) {
    console.log(chalk.red(`\n- Removed (${changes.removed.length}):`));
    for (const file of changes.removed) {
      console.log(chalk.red(`  ${file}`));
    }
  }

  if (changes.modified.length > 0) {
    console.log(chalk.yellow(`\n~ Modified (${changes.modified.length}):`));
    for (const file of changes.modified) {
      console.log(chalk.yellow(`  ${file}`));
    }
  }

  if (changes.added.length === 0 && changes.removed.length === 0 && changes.modified.length === 0) {
    console.log(chalk.gray('\n  No documentation changes'));
  }

  console.log();
}
