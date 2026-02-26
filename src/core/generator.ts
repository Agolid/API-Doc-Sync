import * as fs from 'fs';
import * as path from 'path';
import * as Handlebars from 'handlebars';
import { marked } from 'marked';
import { OpenAPIParser, OpenAPISpec } from './parser';
import { logger } from '../utils/logger';

export interface GeneratorOptions {
  output: string;
  format: 'markdown' | 'html' | 'pdf';
  template?: string;
  language?: 'en' | 'zh';
}

export class DocGenerator {
  private parser: OpenAPIParser;
  private options: GeneratorOptions;

  constructor(parser: OpenAPIParser, options: GeneratorOptions) {
    this.parser = parser;
    this.options = options;
  }

  async generate(): Promise<string[]> {
    logger.info('Generating documentation...');

    const outputDir = path.resolve(this.options.output);

    // Create output directory if it doesn't exist
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const generatedFiles: string[] = [];

    // Generate README.md
    const readmePath = path.join(outputDir, 'README.md');
    await this.generateReadme(readmePath);
    generatedFiles.push(readmePath);

    // Generate API docs
    const apiDocsPath = path.join(outputDir, 'API.md');
    await this.generateApiDocs(apiDocsPath);
    generatedFiles.push(apiDocsPath);

    // Generate docs by tag if tags exist
    const tags = this.parser.getTags();
    if (tags.length > 0) {
      for (const tag of tags) {
        const tagPath = path.join(outputDir, `${this.slugify(tag.name)}.md`);
        await this.generateTagDocs(tagPath, tag.name);
        generatedFiles.push(tagPath);
      }
    }

    // Generate schemas docs
    const schemas = this.parser.getSchemas();
    if (Object.keys(schemas).length > 0) {
      const schemasPath = path.join(outputDir, 'Schemas.md');
      await this.generateSchemasDocs(schemasPath);
      generatedFiles.push(schemasPath);
    }

    logger.success(`Generated ${generatedFiles.length} documentation file(s)`);

    return generatedFiles;
  }

  private async generateReadme(outputPath: string): Promise<void> {
    logger.info('Generating README.md...');

    const spec = this.parser.getSpec();
    const info = this.parser.getInfo();
    const servers = this.parser.getServers();

    const content = this.renderTemplate('README.hbs', {
      title: info.title,
      version: info.version,
      description: info.description,
      contact: info.contact,
      license: info.license,
      servers,
      versionNumber: info.version,
      generatedAt: new Date().toISOString()
    });

    fs.writeFileSync(outputPath, content, 'utf8');
  }

  private async generateApiDocs(outputPath: string): Promise<void> {
    logger.info('Generating API.md...');

    const operations = this.parser.getOperations();

    // Group operations by path
    const paths: Record<string, any[]> = {};

    for (const { path, method, operation } of operations) {
      if (!paths[path]) {
        paths[path] = [];
      }
      paths[path].push({
        method,
        operation
      });
    }

    const content = this.renderTemplate('API.hbs', {
      paths,
      title: this.parser.getTitle(),
      version: this.parser.getVersion()
    });

    fs.writeFileSync(outputPath, content, 'utf8');
  }

  private async generateTagDocs(outputPath: string, tagName: string): Promise<void> {
    logger.info(`Generating ${tagName}.md...`);

    const operations = this.parser.getOperationsByTag(tagName);

    const content = this.renderTemplate('Tag.hbs', {
      tagName,
      operations,
      title: this.parser.getTitle()
    });

    fs.writeFileSync(outputPath, content, 'utf8');
  }

  private async generateSchemasDocs(outputPath: string): Promise<void> {
    logger.info('Generating Schemas.md...');

    const schemas = this.parser.getSchemas();

    const content = this.renderTemplate('Schemas.hbs', {
      schemas,
      title: this.parser.getTitle()
    });

    fs.writeFileSync(outputPath, content, 'utf8');
  }

  private renderTemplate(templateName: string, data: any): string {
    // Try custom template first
    if (this.options.template) {
      const customTemplatePath = path.resolve(this.options.template, templateName);
      if (fs.existsSync(customTemplatePath)) {
        const template = fs.readFileSync(customTemplatePath, 'utf8');
        return Handlebars.compile(template)(data);
      }
    }

    // Use built-in template
    const builtInTemplatePath = path.join(__dirname, '../../templates', templateName);

    if (!fs.existsSync(builtInTemplatePath)) {
      // Fallback to inline template
      return this.getInlineTemplate(templateName, data);
    }

    const template = fs.readFileSync(builtInTemplatePath, 'utf8');
    return Handlebars.compile(template)(data);
  }

  private getInlineTemplate(templateName: string, data: any): string {
    // Simple inline templates as fallback
    switch (templateName) {
      case 'README.hbs':
        return this.generateReadmeContent(data);
      case 'API.hbs':
        return this.generateApiContent(data);
      case 'Tag.hbs':
        return this.generateTagContent(data);
      case 'Schemas.hbs':
        return this.generateSchemasContent(data);
      default:
        return `Template ${templateName} not found`;
    }
  }

  private generateReadmeContent(data: any): string {
    let content = `# ${data.title}\n\n`;
    content += `**Version:** ${data.version}\n\n`;

    if (data.description) {
      content += `${data.description}\n\n`;
    }

    if (data.servers && data.servers.length > 0) {
      content += `## Servers\n\n`;
      for (const server of data.servers) {
        content += `- \`${server.url}\``;
        if (server.description) {
          content += ` - ${server.description}`;
        }
        content += '\n';
      }
      content += '\n';
    }

    content += `## Documentation\n\n`;
    content += `- [API Reference](./API.md)\n`;
    content += `- [Schemas](./Schemas.md)\n`;
    content += `- [Changelog](./CHANGELOG.md)\n`;

    content += `\n---\n\n`;
    content += `*Generated by [api-doc-sync](https://github.com/Agolid/api-doc-sync) on ${new Date().toISOString()}*\n`;

    return content;
  }

  private generateApiContent(data: any): string {
    let content = `# API Reference\n\n`;

    for (const [path, operations] of Object.entries(data.paths) as [string, any][]) {
      content += `## ${path}\n\n`;

      for (const { method, operation } of operations) {
        const methodEmoji = this.getMethodEmoji(method);
        content += `### ${methodEmoji} ${method.toUpperCase()}\n\n`;

        if (operation.summary) {
          content += `${operation.summary}\n\n`;
        }

        if (operation.description) {
          content += `${operation.description}\n\n`;
        }

        if (operation.operationId) {
          content += `**Operation ID:** \`${operation.operationId}\`\n\n`;
        }

        if (operation.parameters && operation.parameters.length > 0) {
          content += `#### Parameters\n\n`;
          content += `| Name | In | Type | Required | Description |\n`;
          content += `|------|-----|------|----------|-------------|\n`;

          for (const param of operation.parameters) {
            const type = param.type || param.schema?.type || 'unknown';
            const required = param.required ? 'Yes' : 'No';
            const description = param.description || '-';
            content += `| ${param.name} | ${param.in} | ${type} | ${required} | ${description} |\n`;
          }
          content += '\n';
        }

        if (operation.requestBody) {
          content += `#### Request Body\n\n`;
          if (operation.requestBody.description) {
            content += `${operation.requestBody.description}\n\n`;
          }
          content += `**Required:** ${operation.requestBody.required ? 'Yes' : 'No'}\n\n`;
        }

        if (operation.responses) {
          content += `#### Responses\n\n`;
          for (const [code, response] of Object.entries(operation.responses) as [string, any]) {
            content += `**${code}** - ${response.description}\n\n`;
          }
        }

        content += `---\n\n`;
      }
    }

    return content;
  }

  private generateTagContent(data: any): string {
    let content = `# ${data.tagName}\n\n`;

    for (const { path, method, operation } of data.operations) {
      const methodEmoji = this.getMethodEmoji(method);
      content += `## ${methodEmoji} ${method.toUpperCase()} ${path}\n\n`;

      if (operation.summary) {
        content += `${operation.summary}\n\n`;
      }

      if (operation.description) {
        content += `${operation.description}\n\n`;
      }

      content += `---\n\n`;
    }

    return content;
  }

  private generateSchemasContent(data: any): string {
    let content = `# Data Schemas\n\n`;

    for (const [name, schema] of Object.entries(data.schemas) as [string, any]) {
      content += `## ${name}\n\n`;

      if (schema.description) {
        content += `${schema.description}\n\n`;
      }

      if (schema.type) {
        content += `**Type:** ${schema.type}\n\n`;
      }

      if (schema.properties) {
        content += `### Properties\n\n`;
        content += `| Name | Type | Required | Description |\n`;
        content += `|------|------|----------|-------------|\n`;

        for (const [propName, propSchema] of Object.entries(schema.properties) as [string, any]) {
          const type = propSchema.type || 'unknown';
          const required = schema.required?.includes(propName) ? 'Yes' : 'No';
          const description = propSchema.description || '-';
          content += `| ${propName} | ${type} | ${required} | ${description} |\n`;
        }
        content += '\n';
      }

      content += `---\n\n`;
    }

    return content;
  }

  private getMethodEmoji(method: string): string {
    const emojis: Record<string, string> = {
      get: '🔍',
      post: '📝',
      put: '✏️',
      delete: '🗑️',
      patch: '🩹'
    };
    return emojis[method] || '📋';
  }

  private slugify(text: string): string {
    return text
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^\w-]+/g, '')
      .replace(/--+/g, '-')
      .replace(/^-+/, '')
      .replace(/-+$/, '');
  }
}
