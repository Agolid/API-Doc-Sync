import * as fs from 'fs';
import * as path from 'path';
import { Octokit } from 'octokit';
import { logger } from '../utils/logger';
import { configManager } from '../utils/config';

export interface SyncOptions {
  config?: string;
  message?: string;
  branch?: string;
}

export async function syncCommand(options: SyncOptions = {}): Promise<void> {
  logger.info('Starting GitHub sync...');

  // Load config
  const config = configManager.load(options.config);
  configManager.validate();

  if (!config.github) {
    throw new Error('GitHub configuration not found. Run `api-doc-sync init` to set up GitHub integration.');
  }

  const { token, owner, repo, branch = 'main', path: repoPath = 'docs' } = config.github;

  if (!token || !owner || !repo) {
    throw new Error('GitHub token, owner, and repo are required');
  }

  logger.info(`Syncing to ${owner}/${repo} (${branch})`);

  // Initialize Octokit
  const octokit = new Octokit({
    auth: token
  });

  // Check if output directory exists
  const outputDir = path.resolve(config.output);
  if (!fs.existsSync(outputDir)) {
    throw new Error(`Output directory not found: ${outputDir}. Run \`api-doc-sync generate\` first.`);
  }

  // Get current commit SHA
  const { data: refData } = await octokit.rest.git.getRef({
    owner,
    repo,
    ref: `heads/${branch}`
  });

  const currentSha = refData.object.sha;
  logger.info(`Current commit: ${currentSha}`);

  // Get the latest commit to use as parent
  const { data: commitData } = await octokit.rest.git.getCommit({
    owner,
    repo,
    commit_sha: currentSha
  });

  const parentCommit = commitData;
  logger.info(`Parent commit: ${parentCommit.sha}`);

  // Create a new tree with the documentation files
  const files = await getFilesForCommit(outputDir, repoPath);

  const { data: treeData } = await octokit.rest.git.createTree({
    owner,
    repo,
    tree: files.map((file) => ({
      path: file.path,
      mode: '100644' as const,
      type: 'blob' as const,
      content: file.content
    }))
  });

  logger.info(`Created tree with ${files.length} file(s)`);

  // Create a new commit
  const commitMessage = options.message || 'Update documentation via api-doc-sync';
  const { data: newCommit } = await octokit.rest.git.createCommit({
    owner,
    repo,
    message: commitMessage,
    tree: treeData.sha,
    parents: [parentCommit.sha]
  });

  logger.info(`Created commit: ${newCommit.sha}`);

  // Update the branch reference
  await octokit.rest.git.updateRef({
    owner,
    repo,
    ref: `heads/${branch}`,
    sha: newCommit.sha
  });

  logger.success(`Successfully pushed to ${owner}/${repo}`);
  logger.success(`Commit: ${newCommit.html_url}`);
}

async function getFilesForCommit(dir: string, basePath: string): Promise<Array<{ path: string; content: string }>> {
  const files: Array<{ path: string; content: string }> = [];

  async function walk(currentPath: string, relativePath: string) {
    const entries = await fs.promises.readdir(currentPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(currentPath, entry.name);
      const entryPath = path.join(relativePath, entry.name);

      if (entry.isDirectory()) {
        await walk(fullPath, entryPath);
      } else if (entry.isFile()) {
        const content = await fs.promises.readFile(fullPath, 'utf8');
        files.push({
          path: entryPath,
          content
        });
      }
    }
  }

  await walk(dir, basePath);
  return files;
}
