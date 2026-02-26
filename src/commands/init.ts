import * as fs from 'fs';
import * as path from 'path';
import inquirer from 'inquirer';
import { logger } from '../utils/logger';
import { configManager, Config } from '../utils/config';

export async function initCommand(): Promise<void> {
  logger.info('Initializing api-doc-sync...');

  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'input',
      message: 'OpenAPI spec path or URL:',
      default: './openapi.yaml',
      validate: (input: string) => {
        if (!input) {
          return 'Input path is required';
        }
        return true;
      }
    },
    {
      type: 'input',
      name: 'output',
      message: 'Output directory:',
      default: './docs',
      validate: (input: string) => {
        if (!input) {
          return 'Output directory is required';
        }
        return true;
      }
    },
    {
      type: 'list',
      name: 'format',
      message: 'Output format:',
      choices: ['markdown', 'html', 'pdf'],
      default: 'markdown'
    },
    {
      type: 'confirm',
      name: 'setupGitHub',
      message: 'Setup GitHub integration?',
      default: false
    },
    {
      type: 'input',
      name: 'githubToken',
      message: 'GitHub token (from https://github.com/settings/tokens):',
      when: (answers: any) => answers.setupGitHub,
      validate: (input: string) => {
        if (!input) {
          return 'GitHub token is required for GitHub integration';
        }
        return true;
      }
    },
    {
      type: 'input',
      name: 'githubOwner',
      message: 'GitHub repository owner:',
      when: (answers: any) => answers.setupGitHub,
      validate: (input: string) => {
        if (!input) {
          return 'Repository owner is required';
        }
        return true;
      }
    },
    {
      type: 'input',
      name: 'githubRepo',
      message: 'GitHub repository name:',
      when: (answers: any) => answers.setupGitHub,
      validate: (input: string) => {
        if (!input) {
          return 'Repository name is required';
        }
        return true;
      }
    },
    {
      type: 'input',
      name: 'githubBranch',
      message: 'Default branch:',
      default: 'main',
      when: (answers: any) => answers.setupGitHub
    },
    {
      type: 'input',
      name: 'githubPath',
      message: 'Docs path in repository:',
      default: 'docs',
      when: (answers: any) => answers.setupGitHub
    }
  ]);

  const config: Partial<Config> = {
    input: answers.input,
    output: answers.output,
    format: answers.format
  };

  if (answers.setupGitHub) {
    config.github = {
      token: answers.githubToken,
      owner: answers.githubOwner,
      repo: answers.githubRepo,
      branch: answers.githubBranch,
      path: answers.githubPath
    };
  }

  configManager.set(config);

  // Save config
  const configPath = 'api-doc-sync.config.yml';
  configManager.save(configPath);

  logger.success(`Configuration saved to ${configPath}`);

  // Create example OpenAPI spec if it doesn't exist
  const specPath = path.resolve(answers.input);
  if (!fs.existsSync(specPath)) {
    logger.info('Creating example OpenAPI spec...');
    createExampleSpec(specPath);
    logger.success(`Example spec created at ${specPath}`);
  }

  // Create .gitignore entry for config if sensitive
  if (answers.githubToken) {
    const gitignorePath = '.gitignore';
    let gitignoreContent = '';

    if (fs.existsSync(gitignorePath)) {
      gitignoreContent = fs.readFileSync(gitignorePath, 'utf8');
    }

    if (!gitignoreContent.includes('api-doc-sync.config.yml')) {
      gitignoreContent += '\n# api-doc-sync config (contains sensitive data)\napi-doc-sync.config.yml\n';
      fs.writeFileSync(gitignorePath, gitignoreContent, 'utf8');
      logger.info('Added api-doc-sync.config.yml to .gitignore');
    }
  }

  logger.success('Initialization complete! Run `api-doc-sync generate` to generate documentation.');
}

function createExampleSpec(filePath: string): void {
  const exampleSpec = {
    openapi: '3.0.0',
    info: {
      title: 'Example API',
      version: '1.0.0',
      description: 'This is an example OpenAPI specification'
    },
    servers: [
      {
        url: 'https://api.example.com/v1',
        description: 'Production server'
      }
    ],
    paths: {
      '/users': {
        get: {
          summary: 'List all users',
          operationId: 'listUsers',
          tags: ['Users'],
          responses: {
            '200': {
              description: 'Successful response',
              content: {
                'application/json': {
                  schema: {
                    type: 'array',
                    items: {
                      $ref: '#/components/schemas/User'
                    }
                  }
                }
              }
            }
          }
        },
        post: {
          summary: 'Create a new user',
          operationId: 'createUser',
          tags: ['Users'],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/UserInput'
                }
              }
            }
          },
          responses: {
            '201': {
              description: 'User created successfully',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/User'
                  }
                }
              }
            }
          }
        }
      },
      '/users/{id}': {
        get: {
          summary: 'Get user by ID',
          operationId: 'getUser',
          tags: ['Users'],
          parameters: [
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: {
                type: 'integer'
              }
            }
          ],
          responses: {
            '200': {
              description: 'Successful response',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/User'
                  }
                }
              }
            },
            '404': {
              description: 'User not found'
            }
          }
        }
      }
    },
    components: {
      schemas: {
        User: {
          type: 'object',
          required: ['id', 'name', 'email'],
          properties: {
            id: {
              type: 'integer',
              description: 'User ID'
            },
            name: {
              type: 'string',
              description: 'User name'
            },
            email: {
              type: 'string',
              format: 'email',
              description: 'User email address'
            }
          }
        },
        UserInput: {
          type: 'object',
          required: ['name', 'email'],
          properties: {
            name: {
              type: 'string',
              description: 'User name'
            },
            email: {
              type: 'string',
              format: 'email',
              description: 'User email address'
            }
          }
        }
      }
    }
  };

  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(filePath, JSON.stringify(exampleSpec, null, 2), 'utf8');
}
