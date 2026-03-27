import { syncCommand } from '../src/commands/sync';
import * as configMod from '../src/utils/config';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// Mock octokit module
jest.mock('octokit', () => ({
  Octokit: jest.fn().mockImplementation(() => ({
    rest: {
      git: {
        getRef: jest.fn().mockResolvedValue({
          data: { object: { sha: 'abc123' } }
        }),
        getCommit: jest.fn().mockResolvedValue({
          data: { sha: 'abc123' }
        }),
        createTree: jest.fn().mockResolvedValue({
          data: { sha: 'tree123' }
        }),
        createCommit: jest.fn().mockResolvedValue({
          data: { sha: 'commit123', html_url: 'https://github.com/test/test/commit/commit123' }
        }),
        updateRef: jest.fn().mockResolvedValue({})
      }
    }
  }))
}));

describe('sync command', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sync-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('缺少 GitHub config 时应抛错', async () => {
    jest.spyOn(configMod.configManager, 'load').mockReturnValue({
      input: './openapi.yaml',
      output: tmpDir,
      format: 'markdown',
      github: undefined
    });
    jest.spyOn(configMod.configManager, 'validate').mockReturnValue(true);

    await expect(syncCommand()).rejects.toThrow('GitHub configuration not found');
  });

  test('output 目录不存在时应抛错', async () => {
    jest.spyOn(configMod.configManager, 'load').mockReturnValue({
      input: './openapi.yaml',
      output: '/nonexistent/dir',
      format: 'markdown',
      github: { token: 't', owner: 'o', repo: 'r' }
    });
    jest.spyOn(configMod.configManager, 'validate').mockReturnValue(true);

    await expect(syncCommand()).rejects.toThrow('Output directory not found');
  });

  test('正常流程应创建 commit 并 push', async () => {
    const outputDir = path.join(tmpDir, 'docs');
    fs.mkdirSync(outputDir);
    fs.writeFileSync(path.join(outputDir, 'README.md'), '# Docs');

    jest.spyOn(configMod.configManager, 'load').mockReturnValue({
      input: './openapi.yaml',
      output: outputDir,
      format: 'markdown',
      github: { token: 't', owner: 'o', repo: 'r', branch: 'main' }
    });
    jest.spyOn(configMod.configManager, 'validate').mockReturnValue(true);

    await expect(syncCommand()).resolves.not.toThrow();
  });
});
