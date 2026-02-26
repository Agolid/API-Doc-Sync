import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as yaml from 'js-yaml';

export interface Config {
  input: string; // OpenAPI spec path or URL
  output: string; // Output directory
  format: 'markdown' | 'html' | 'pdf';
  github?: GitHubConfig;
  template?: string; // Custom template path
  language?: 'en' | 'zh';
}

export interface GitHubConfig {
  token?: string;
  owner?: string;
  repo?: string;
  branch?: string;
  path?: string; // Docs path in repo
  createPR?: boolean;
}

const DEFAULT_CONFIG: Config = {
  input: './openapi.yaml',
  output: './docs',
  format: 'markdown',
  language: 'en'
};

const CONFIG_FILE = 'api-doc-sync.config.yml';

export class ConfigManager {
  private static instance: ConfigManager;
  private config: Config;

  private constructor() {
    this.config = { ...DEFAULT_CONFIG };
  }

  static getInstance(): ConfigManager {
    if (!ConfigManager.instance) {
      ConfigManager.instance = new ConfigManager();
    }
    return ConfigManager.instance;
  }

  load(configPath?: string): Config {
    if (configPath) {
      return this.loadFromFile(configPath);
    }

    // Try to load from current directory
    if (fs.existsSync(CONFIG_FILE)) {
      return this.loadFromFile(CONFIG_FILE);
    }

    return this.config;
  }

  private loadFromFile(filePath: string): Config {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const parsed = yaml.load(content) as Partial<Config>;

      // Merge with defaults
      this.config = {
        ...DEFAULT_CONFIG,
        ...parsed,
        github: {
          ...DEFAULT_CONFIG.github,
          ...parsed.github
        }
      };

      return this.config;
    } catch (error) {
      throw new Error(`Failed to load config from ${filePath}: ${error}`);
    }
  }

  save(configPath?: string): void {
    const filePath = configPath || CONFIG_FILE;
    const content = yaml.dump(this.config, {
      indent: 2,
      lineWidth: -1
    });

    fs.writeFileSync(filePath, content, 'utf8');
  }

  get(): Config {
    return { ...this.config };
  }

  set(config: Partial<Config>): void {
    this.config = {
      ...this.config,
      ...config,
      github: {
        ...this.config.github,
        ...config.github
      }
    };
  }

  reset(): void {
    this.config = { ...DEFAULT_CONFIG };
  }

  validate(): boolean {
    const { input, output, github } = this.config;

    if (!input) {
      throw new Error('Input path is required');
    }

    if (!output) {
      throw new Error('Output path is required');
    }

    if (github?.token && (!github.owner || !github.repo)) {
      throw new Error('GitHub owner and repo are required when token is provided');
    }

    return true;
  }
}

export const configManager = ConfigManager.getInstance();
