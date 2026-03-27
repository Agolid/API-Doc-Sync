import * as fs from 'fs';
import * as path from 'path';
import * as Handlebars from 'handlebars';
import { marked } from 'marked';
import { OpenAPIParser, OpenAPISpec } from './parser';
import { logger } from '../utils/logger';

// Register Handlebars helpers
Handlebars.registerHelper('toUpperCase', (str: string) => str.toUpperCase());
Handlebars.registerHelper('json', (obj: any) => JSON.stringify(obj, null, 2));
Handlebars.registerHelper('contains', (arr: string[], item: string) => arr && arr.includes(item));
Handlebars.registerHelper('slugify', (str: string) => {
  return str.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]+/g, '').replace(/--+/g, '-').replace(/^-+/, '').replace(/-+$/, '');
});

// i18n labels
const I18N: Record<string, Record<string, string>> = {
  en: {
    apiReference: 'API Reference',
    dataSchemas: 'Data Schemas',
    parameters: 'Parameters',
    requestBody: 'Request Body',
    responses: 'Responses',
    properties: 'Properties',
    required: 'Required',
    example: 'Example',
    requiredFields: 'Required fields',
    operationId: 'Operation ID',
    tags: 'Tags',
    contact: 'Contact',
    license: 'License',
    servers: 'Servers',
    overview: 'Overview',
    documentation: 'Documentation',
    partOf: 'Part of',
  },
  zh: {
    apiReference: 'API 参考',
    dataSchemas: '数据模型',
    parameters: '参数',
    requestBody: '请求体',
    responses: '响应',
    properties: '属性',
    required: '必填',
    example: '示例',
    requiredFields: '必填字段',
    operationId: '操作 ID',
    tags: '标签',
    contact: '联系方式',
    license: '许可证',
    servers: '服务器',
    overview: '概述',
    documentation: '文档',
    partOf: '所属项目',
  },
};

export interface GeneratorOptions {
  output: string;
  format: 'markdown' | 'html' | 'pdf';
  template?: string;
  language?: 'en' | 'zh';
}

export class DocGenerator {
  private parser: OpenAPIParser;
  private options: GeneratorOptions;
  private i18n: Record<string, string>;

  constructor(parser: OpenAPIParser, options: GeneratorOptions) {
    this.parser = parser;
    this.options = options;
    this.i18n = I18N[this.options.language || 'en'] || I18N.en;
  }

  async generate(): Promise<string[]> {
    logger.info('Generating documentation...');

    const outputDir = path.resolve(this.options.output);
    const isHtml = this.options.format === 'html';
    const ext = isHtml ? 'html' : 'md';

    // Create output directory if it doesn't exist
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const generatedFiles: string[] = [];

    // Generate README
    const readmeName = isHtml ? 'index.html' : `README.${ext}`;
    const readmePath = path.join(outputDir, readmeName);
    await this.generateReadme(readmePath);
    generatedFiles.push(readmePath);

    // Generate API docs
    const apiDocsPath = path.join(outputDir, `API.${ext}`);
    await this.generateApiDocs(apiDocsPath);
    generatedFiles.push(apiDocsPath);

    // Generate docs by tag if tags exist
    const tags = this.parser.getTags();
    if (tags.length > 0) {
      for (const tag of tags) {
        const tagPath = path.join(outputDir, `${this.slugify(tag.name)}.${ext}`);
        await this.generateTagDocs(tagPath, tag.name, tags);
        generatedFiles.push(tagPath);
      }
    }

    // Generate schemas docs
    const schemas = this.parser.getSchemas();
    if (Object.keys(schemas).length > 0) {
      const schemasPath = path.join(outputDir, `Schemas.${ext}`);
      await this.generateSchemasDocs(schemasPath);
      generatedFiles.push(schemasPath);
    }

    logger.success(`Generated ${generatedFiles.length} documentation file(s)`);

    return generatedFiles;
  }

  private async generateReadme(outputPath: string): Promise<void> {
    const isHtml = this.options.format === 'html';
    const tplName = isHtml ? 'README.html.hbs' : 'README.hbs';
    logger.info(`Generating ${isHtml ? 'index.html' : 'README.md'}...`);

    const info = this.parser.getInfo();
    const servers = this.parser.getServers();
    const tags = this.parser.getTags();

    const content = this.renderTemplate(tplName, {
      title: info.title,
      version: info.version,
      description: info.description,
      contact: info.contact,
      license: info.license,
      servers,
      versionNumber: info.version,
      generatedAt: new Date().toISOString(),
      hasTags: tags.length > 0,
    });

    fs.writeFileSync(outputPath, content, 'utf8');
  }

  private async generateApiDocs(outputPath: string): Promise<void> {
    const isHtml = this.options.format === 'html';
    const tplName = isHtml ? 'API.html.hbs' : 'API.hbs';
    logger.info(`Generating API.${isHtml ? 'html' : 'md'}...`);

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

    const content = this.renderTemplate(tplName, {
      paths,
      title: this.parser.getTitle(),
      version: this.parser.getVersion()
    });

    fs.writeFileSync(outputPath, content, 'utf8');
  }

  private async generateTagDocs(outputPath: string, tagName: string, allTags?: any[]): Promise<void> {
    const isHtml = this.options.format === 'html';
    const tplName = isHtml ? 'Tag.html.hbs' : 'Tag.hbs';
    logger.info(`Generating ${tagName}.${isHtml ? 'html' : 'md'}...`);

    const operations = this.parser.getOperationsByTag(tagName);

    const content = this.renderTemplate(tplName, {
      tagName,
      operations,
      title: this.parser.getTitle(),
      allTags: allTags || this.parser.getTags(),
    });

    fs.writeFileSync(outputPath, content, 'utf8');
  }

  private async generateSchemasDocs(outputPath: string): Promise<void> {
    const isHtml = this.options.format === 'html';
    const tplName = isHtml ? 'Schemas.html.hbs' : 'Schemas.hbs';
    logger.info(`Generating Schemas.${isHtml ? 'html' : 'md'}...`);

    const schemas = this.parser.getSchemas();

    const content = this.renderTemplate(tplName, {
      schemas,
      title: this.parser.getTitle()
    });

    fs.writeFileSync(outputPath, content, 'utf8');
  }

  private renderTemplate(templateName: string, data: any): string {
    // Inject i18n labels into all template data
    const enrichedData = { ...data, i18n: this.i18n };

    // Try custom template first
    if (this.options.template) {
      const customTemplatePath = path.resolve(this.options.template, templateName);
      if (fs.existsSync(customTemplatePath)) {
        const template = fs.readFileSync(customTemplatePath, 'utf8');
        return Handlebars.compile(template)(enrichedData);
      }
    }

    // Use built-in template
    const builtInTemplatePath = path.join(__dirname, '../../templates', templateName);

    if (!fs.existsSync(builtInTemplatePath)) {
      // Fallback to inline template
      return this.getInlineTemplate(templateName, enrichedData);
    }

    const template = fs.readFileSync(builtInTemplatePath, 'utf8');
    return Handlebars.compile(template)(enrichedData);
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
    const t = data.i18n || I18N.en;
    let content = `# ${data.title}\n\n`;
    content += `**Version:** ${data.version}\n\n`;

    if (data.description) {
      content += `${data.description}\n\n`;
    }

    if (data.servers && data.servers.length > 0) {
      content += `## ${t.servers}\n\n`;
      for (const server of data.servers) {
        content += `- \`${server.url}\``;
        if (server.description) content += ` - ${server.description}`;
        content += '\n';
      }
      content += '\n';
    }

    content += `## ${t.documentation}\n\n`;
    content += `- [${t.apiReference}](./API.md)\n`;
    content += `- [${t.dataSchemas}](./Schemas.md)\n`;
    content += `- [Changelog](./CHANGELOG.md)\n`;

    content += `\n---\n\n`;
    content += `*Generated by [api-doc-sync](https://github.com/Agolid/api-doc-sync) on ${new Date().toISOString()}*\n`;

    return content;
  }

  private generateApiContent(data: any): string {
    const t = data.i18n || I18N.en;
    let content = `# ${t.apiReference}\n\n`;

    for (const [path, operations] of Object.entries(data.paths) as [string, any][]) {
      content += `## ${path}\n\n`;

      for (const { method, operation } of operations) {
        const methodEmoji = this.getMethodEmoji(method);
        content += `### ${methodEmoji} ${method.toUpperCase()}\n\n`;

        if (operation.summary) content += `${operation.summary}\n\n`;
        if (operation.description) content += `${operation.description}\n\n`;
        if (operation.operationId) content += `**${t.operationId}:** \`${operation.operationId}\`\n\n`;

        if (operation.parameters && operation.parameters.length > 0) {
          content += `#### ${t.parameters}\n\n`;
          content += `| Name | In | Type | ${t.required} | Description |\n`;
          content += `|------|-----|------|----------|-------------|\n`;
          for (const param of operation.parameters) {
            const type = param.type || param.schema?.type || 'unknown';
            content += `| ${param.name} | ${param.in} | ${type} | ${param.required ? 'Yes' : 'No'} | ${param.description || '-'} |\n`;
          }
          content += '\n';
        }

        if (operation.requestBody) {
          content += `#### ${t.requestBody}\n\n`;
          if (operation.requestBody.description) content += `${operation.requestBody.description}\n\n`;
          content += `**${t.required}:** ${operation.requestBody.required ? 'Yes' : 'No'}\n\n`;
        }

        if (operation.responses) {
          content += `#### ${t.responses}\n\n`;
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
    const t = data.i18n || I18N.en;
    let content = `# ${data.tagName}\n\n`;
    content += `> ${t.partOf} **${data.title}**\n\n`;

    for (const { path, method, operation } of data.operations) {
      const methodEmoji = this.getMethodEmoji(method);
      content += `## ${methodEmoji} ${method.toUpperCase()} ${path}\n\n`;
      if (operation.summary) content += `${operation.summary}\n\n`;
      if (operation.description) content += `${operation.description}\n\n`;
      content += `---\n\n`;
    }
    return content;
  }

  private generateSchemasContent(data: any): string {
    const t = data.i18n || I18N.en;
    let content = `# ${t.dataSchemas}\n\n`;

    for (const [name, schema] of Object.entries(data.schemas) as [string, any]) {
      content += `## ${name}\n\n`;
      if (schema.description) content += `${schema.description}\n\n`;
      if (schema.type) content += `**Type:** ${schema.type}\n\n`;

      if (schema.properties) {
        content += `### ${t.properties}\n\n`;
        content += `| Name | Type | ${t.required} | Description |\n`;
        content += `|------|------|----------|-------------|\n`;
        for (const [propName, propSchema] of Object.entries(schema.properties) as [string, any]) {
          const type = propSchema.type || 'unknown';
          const required = schema.required?.includes(propName) ? 'Yes' : 'No';
          content += `| ${propName} | ${type} | ${required} | ${propSchema.description || '-'} |\n`;
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
