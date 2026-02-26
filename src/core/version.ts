import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { OpenAPIParser, OpenAPISpec } from './parser';
import { logger } from '../utils/logger';

export interface VersionInfo {
  version: string;
  timestamp: number;
  specHash: string;
  filesCount: number;
  changes?: ChangeSummary;
}

export interface ChangeSummary {
  added: string[];
  removed: string[];
  modified: string[];
}

export class VersionManager {
  private versionHistoryPath: string;
  private versions: Map<string, VersionInfo>;

  constructor(versionsDir: string = './versions') {
    this.versionHistoryPath = path.join(versionsDir, 'history.json');
    this.versions = new Map();
  }

  async loadHistory(): Promise<void> {
    try {
      if (fs.existsSync(this.versionHistoryPath)) {
        const content = await fs.promises.readFile(this.versionHistoryPath, 'utf8');
        const history = JSON.parse(content);
        this.versions = new Map(Object.entries(history));
        logger.info(`Loaded ${this.versions.size} version(s) from history`);
      }
    } catch (error: any) {
      logger.warn(`Failed to load version history: ${error.message}`);
      this.versions = new Map();
    }
  }

  async saveHistory(): Promise<void> {
    try {
      const dir = path.dirname(this.versionHistoryPath);
      if (!fs.existsSync(dir)) {
        await fs.promises.mkdir(dir, { recursive: true });
      }

      const history = Object.fromEntries(this.versions);
      await fs.promises.writeFile(this.versionHistoryPath, JSON.stringify(history, null, 2), 'utf8');
      logger.info(`Saved version history to ${this.versionHistoryPath}`);
    } catch (error: any) {
      logger.error(`Failed to save version history: ${error.message}`);
    }
  }

  calculateSpecHash(spec: OpenAPISpec): string {
    const specString = JSON.stringify(spec, Object.keys(spec).sort());
    return crypto.createHash('sha256').update(specString).digest('hex');
  }

  async createVersion(spec: OpenAPISpec, filesDir: string): Promise<VersionInfo> {
    const version = spec.info.version || 'unknown';
    const timestamp = Date.now();
    const specHash = this.calculateSpecHash(spec);
    const filesCount = await this.countFiles(filesDir);

    const versionInfo: VersionInfo = {
      version,
      timestamp,
      specHash,
      filesCount
    };

    // Check if this version already exists
    const existingKey = this.findVersionKey(version);
    if (existingKey) {
      const existing = this.versions.get(existingKey);
      if (existing && existing.specHash === specHash) {
        logger.info(`Version ${version} already exists with the same spec hash`);
        return existing;
      }
    }

    // Generate a unique key for this version
    const key = `${version}-${timestamp}`;
    this.versions.set(key, versionInfo);
    logger.info(`Created version ${version} (${specHash.substring(0, 8)})`);

    return versionInfo;
  }

  async countFiles(dir: string): Promise<number> {
    let count = 0;
    const entries = await fs.promises.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.isDirectory()) {
        count += await this.countFiles(path.join(dir, entry.name));
      } else if (entry.isFile()) {
        count++;
      }
    }

    return count;
  }

  async compareVersions(version1: string, version2: string, filesDir1: string, filesDir2: string): Promise<ChangeSummary> {
    const files1 = await this.getFileList(filesDir1);
    const files2 = await this.getFileList(filesDir2);

    const added: string[] = [];
    const removed: string[] = [];
    const modified: string[] = [];

    const allFiles = new Set([...files1, ...files2]);

    for (const file of allFiles) {
      const exists1 = files1.includes(file);
      const exists2 = files2.includes(file);

      if (!exists1 && exists2) {
        added.push(file);
      } else if (exists1 && !exists2) {
        removed.push(file);
      } else if (exists1 && exists2) {
        const content1 = await fs.promises.readFile(path.join(filesDir1, file), 'utf8');
        const content2 = await fs.promises.readFile(path.join(filesDir2, file), 'utf8');
        const hash1 = crypto.createHash('md5').update(content1).digest('hex');
        const hash2 = crypto.createHash('md5').update(content2).digest('hex');

        if (hash1 !== hash2) {
          modified.push(file);
        }
      }
    }

    return { added, removed, modified };
  }

  async getFileList(dir: string): Promise<string[]> {
    const files: string[] = [];

    async function walk(currentPath: string, relativePath: string) {
      const entries = await fs.promises.readdir(currentPath, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(currentPath, entry.name);
        const entryPath = path.join(relativePath, entry.name);

        if (entry.isDirectory()) {
          await walk(fullPath, entryPath);
        } else if (entry.isFile()) {
          files.push(entryPath);
        }
      }
    }

    await walk(dir, '');
    return files;
  }

  findVersionKey(version: string): string | undefined {
    for (const [key, info] of this.versions) {
      if (info.version === version) {
        return key;
      }
    }
    return undefined;
  }

  getVersion(version: string): VersionInfo | undefined {
    const key = this.findVersionKey(version);
    return key ? this.versions.get(key) : undefined;
  }

  getAllVersions(): VersionInfo[] {
    return Array.from(this.versions.values()).sort((a, b) => b.timestamp - a.timestamp);
  }

  async saveVersionSnapshot(spec: OpenAPISpec, outputDir: string, versionsDir: string): Promise<void> {
    const version = spec.info.version || 'unknown';
    const timestamp = Date.now();
    const snapshotDir = path.join(versionsDir, `snapshot-${version}-${timestamp}`);

    if (!fs.existsSync(snapshotDir)) {
      await fs.promises.mkdir(snapshotDir, { recursive: true });
    }

    // Save spec
    await fs.promises.writeFile(
      path.join(snapshotDir, 'openapi.json'),
      JSON.stringify(spec, null, 2),
      'utf8'
    );

    // Copy output files
    if (fs.existsSync(outputDir)) {
      await this.copyDirectory(outputDir, path.join(snapshotDir, 'docs'));
    }

    logger.info(`Saved version snapshot to ${snapshotDir}`);
  }

  async copyDirectory(src: string, dest: string): Promise<void> {
    if (!fs.existsSync(dest)) {
      await fs.promises.mkdir(dest, { recursive: true });
    }

    const entries = await fs.promises.readdir(src, { withFileTypes: true });

    for (const entry of entries) {
      const srcPath = path.join(src, entry.name);
      const destPath = path.join(dest, entry.name);

      if (entry.isDirectory()) {
        await this.copyDirectory(srcPath, destPath);
      } else if (entry.isFile()) {
        await fs.promises.copyFile(srcPath, destPath);
      }
    }
  }
}
