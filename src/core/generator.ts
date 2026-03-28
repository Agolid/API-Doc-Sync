import * as fs from 'fs';
import * as path from 'path';
import * as Handlebars from 'handlebars';
import { marked } from 'marked';
import { OpenAPIParser, OpenAPISpec } from './parser';
import { logger } from '../utils/logger';

// Register Handlebars helpers
Handlebars.registerHelper('toUpperCase', (str: string) => str.toUpperCase());
Handlebars.registerHelper('json', (obj: any) => JSON.stringify(obj, null, 2));
Handlebars.registerHelper('contains', (arr: string[], item: string) => {
  return arr && arr.includes(item);
});
Handlebars.registerHelper('schemaType', (schema: any) => {
  if (!schema) return 'object';
  if (schema.type) return schema.type;
  if (schema.properties) return 'object';
  if (schema.items) return 'array';
  return 'object';
});

Handlebars.registerHelper('schemaFormat', (schema: any) => {
  if (!schema || !schema.format) return '';
  return schema.format;
});

Handlebars.registerHelper('escapeHtml', (str: string) => {
  if (!str) return str;
  return str
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&').replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'").replace(/&#39;/g, "'");
});

Handlebars.registerHelper('cleanHtml', (str: string) => {
  if (!str) return str;
  // Handlebars triple-stache passes raw value; convert HTML to markdown-friendly plain text
  return new Handlebars.SafeString(
    str
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/?\w+(?:\s[^>]*)?>/g, '')   // strip remaining HTML tags
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#x27;/g, "'")
      .replace(/&#39;/g, "'")
      .replace(/&nbsp;/g, ' ')
      .replace(/\n{3,}/g, '\n\n')  // collapse multiple newlines
      .trim()
  );
});

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
    const format = this.options.format;
    const isHtml = format === 'html';
    const isPdf = format === 'pdf';
    const ext = isHtml ? 'html' : 'md';

    // Create output directory if it doesn't exist
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const generatedFiles: string[] = [];

    if (isPdf) {
      // For PDF: generate markdown files first, then create a single print-friendly HTML
      return this.generatePdf(outputDir);
    }

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

    // Generate schemas docs — include both component schemas and extracted inline schemas
    const allSchemas: Record<string, any> = {};
    const componentSchemas = this.parser.getSchemas();
    Object.assign(allSchemas, componentSchemas);

    // Extract unique inline schemas from operations
    const seenKeys = new Set<string>();
    for (const { path, method, operation } of this.parser.getOperations()) {
      const rb = operation.requestBody;
      if (rb?.content) {
        for (const [ct, mt] of Object.entries(rb.content || {})) {
          const schema = (mt as any).schema;
          if (schema?.properties) {
            const key = JSON.stringify(Object.keys(schema.properties).sort());
            const name = this.inlineSchemaName(path, method, 'request', key, seenKeys);
            if (name) {
              allSchemas[name] = { ...schema, description: schema.description || `Request body for ${method.toUpperCase()} ${path}` };
            }
          }
        }
      }
      if (operation.responses) {
        for (const [code, resp] of Object.entries(operation.responses)) {
          for (const [ct, mt] of Object.entries((resp as any).content || {})) {
            const schema = (mt as any).schema;
            if (schema?.properties) {
              const key = JSON.stringify(Object.keys(schema.properties).sort());
              const name = this.inlineSchemaName(path, method, `response_${code}`, key, seenKeys);
              if (name) {
                allSchemas[name] = { ...schema, description: schema.description || `Response body for ${method.toUpperCase()} ${path} → ${code}` };
              }
            }
          }
        }
      }
    }

    if (Object.keys(allSchemas).length > 0) {
      const schemasPath = path.join(outputDir, `Schemas.${ext}`);
      await this.generateSchemasDocs(schemasPath, allSchemas);
      generatedFiles.push(schemasPath);
    }

    logger.success(`Generated ${generatedFiles.length} documentation file(s)`);

    return generatedFiles;
  }

  private async generatePdf(outputDir: string): Promise<string[]> {
    const generatedFiles: string[] = [];

    // Temporarily set format to markdown to generate .md files
    const originalFormat = this.options.format;
    this.options.format = 'markdown';

    // Generate all markdown files
    const readmePath = path.join(outputDir, 'README.md');
    await this.generateReadme(readmePath);
    generatedFiles.push(readmePath);

    const apiDocsPath = path.join(outputDir, 'API.md');
    await this.generateApiDocs(apiDocsPath);
    generatedFiles.push(apiDocsPath);

    const tags = this.parser.getTags();
    for (const tag of tags) {
      const tagPath = path.join(outputDir, `${this.slugify(tag.name)}.md`);
      await this.generateTagDocs(tagPath, tag.name, tags);
      generatedFiles.push(tagPath);
    }

    const componentSchemas = this.parser.getSchemas();
    if (Object.keys(componentSchemas).length > 0) {
      const schemasPath = path.join(outputDir, 'Schemas.md');
      await this.generateSchemasDocs(schemasPath, componentSchemas);
      generatedFiles.push(schemasPath);
    }

    // Restore format
    this.options.format = originalFormat;

    // Now combine all markdown into a single print-friendly HTML
    logger.info('Generating print-friendly HTML for PDF...');
    const htmlContent = await this.generatePdfHtml(outputDir, generatedFiles);
    const htmlPath = path.join(outputDir, 'index.html');
    fs.writeFileSync(htmlPath, htmlContent, 'utf8');
    generatedFiles.unshift(htmlPath);

    logger.success(`Generated ${generatedFiles.length} documentation file(s)`);
    return generatedFiles;
  }

  private async generatePdfHtml(outputDir: string, mdFiles: string[]): Promise<string> {
    // Read all markdown files and convert to HTML
    const sections: { title: string; html: string; id: string }[] = [];

    for (const filePath of mdFiles) {
      const md = fs.readFileSync(filePath, 'utf8');
      const html = await marked(md);
      const fileName = path.basename(filePath, '.md');
      // Extract first H1 as section title, or use filename
      const h1Match = md.match(/^#\s+(.+)$/m);
      const title = h1Match ? h1Match[1] : fileName;
      sections.push({ title, html, id: this.slugify(title) });
    }

    // Build table of contents
    let tocItems = '';
    for (const section of sections) {
      tocItems += `<li><a href="#${section.id}">${section.title}</a></li>\n`;
    }

    // Build body content with page breaks
    let bodyContent = '';
    for (let i = 0; i < sections.length; i++) {
      bodyContent += `<section id="${sections[i].id}" class="doc-section">${sections[i].html}</section>\n`;
      if (i < sections.length - 1) {
        bodyContent += '<div class="page-break"></div>\n';
      }
    }

    const pageTitle = this.parser.getTitle() || 'API Documentation';

    return `<!DOCTYPE html>
<html lang="${this.options.language || 'en'}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${pageTitle}</title>
  <style>
    @page {
      margin: 2cm;
      @bottom-center {
        content: counter(page);
      }
    }

    * { box-sizing: border-box; }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #1a1a1a;
      max-width: 100%;
      margin: 0;
      padding: 0;
    }

    .container {
      max-width: 900px;
      margin: 0 auto;
      padding: 20px;
    }

    h1 { font-size: 2em; border-bottom: 2px solid #e0e0e0; padding-bottom: 0.3em; }
    h2 { font-size: 1.5em; border-bottom: 1px solid #e0e0e0; padding-bottom: 0.2em; margin-top: 2em; }
    h3 { font-size: 1.25em; margin-top: 1.5em; }
    h4 { font-size: 1.1em; }

    table {
      border-collapse: collapse;
      width: 100%;
      margin: 1em 0;
      font-size: 0.9em;
    }

    th, td {
      border: 1px solid #d0d0d0;
      padding: 8px 12px;
      text-align: left;
    }

    th {
      background-color: #f5f5f5;
      font-weight: 600;
    }

    tr:nth-child(even) { background-color: #fafafa; }

    code {
      background-color: #f4f4f4;
      padding: 2px 6px;
      border-radius: 3px;
      font-size: 0.9em;
    }

    pre {
      background-color: #f8f8f8;
      border: 1px solid #e0e0e0;
      border-radius: 4px;
      padding: 12px;
      overflow-x: auto;
      font-size: 0.85em;
      line-height: 1.5;
    }

    pre code {
      background: none;
      padding: 0;
    }

    blockquote {
      border-left: 4px solid #ddd;
      margin: 1em 0;
      padding: 0.5em 1em;
      color: #666;
    }

    a { color: #0366d6; text-decoration: none; }
    a:hover { text-decoration: underline; }

    hr { border: none; border-top: 1px solid #e0e0e0; margin: 2em 0; }

    .toc {
      background: #f9f9f9;
      border: 1px solid #e0e0e0;
      border-radius: 6px;
      padding: 16px 24px;
      margin: 20px 0;
    }

    .toc h2 { margin-top: 0; border: none; font-size: 1.2em; }

    .toc ul {
      list-style: none;
      padding: 0;
      margin: 0;
    }

    .toc li { padding: 4px 0; }

    .page-break {
      page-break-after: always;
      border: none;
      margin: 0;
      padding: 0;
    }

    .doc-section { margin-bottom: 1em; }

    @media print {
      body { padding: 0; }
      .container { padding: 0; max-width: 100%; }
      .toc { break-after: page; }
      .page-break { display: block; }
      h2 { break-after: avoid; }
      table { break-inside: avoid; }
      pre { break-inside: avoid; }
      a { color: #000; text-decoration: underline; }
      a[href^="http"]::after { content: " (" attr(href) ")"; font-size: 0.8em; }
    }

    @media screen {
      body { background: #fff; }
    }

    .print-hint {
      text-align: center;
      padding: 10px;
      background: #e8f4fd;
      border: 1px solid #b3d9f2;
      border-radius: 4px;
      margin-bottom: 20px;
      font-size: 0.9em;
    }

    @media print {
      .print-hint { display: none; }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="print-hint">
      🖨️ Use <strong>Ctrl+P</strong> (or <strong>Cmd+P</strong> on Mac) to print or save as PDF
    </div>

    <div class="toc">
      <h2>📑 Table of Contents</h2>
      <ul>${tocItems}</ul>
    </div>

    ${bodyContent}
  </div>
</body>
</html>`;
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
        path,
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

  private async generateSchemasDocs(outputPath: string, schemasOverride?: Record<string, any>): Promise<void> {
    const isHtml = this.options.format === 'html';
    const tplName = isHtml ? 'Schemas.html.hbs' : 'Schemas.hbs';
    logger.info(`Generating Schemas.${isHtml ? 'html' : 'md'}...`);

    const resolvedSchemas = schemasOverride || this.parser.getSchemas();

    const content = this.renderTemplate(tplName, {
      schemas: resolvedSchemas,
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
    const builtInTemplatePath = path.join(__dirname, '../templates', templateName);

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
    content += `> **${data.title}** — Version ${data.version}\n\n---\n\n`;

    for (const [path, operations] of Object.entries(data.paths) as [string, any][]) {
      content += `## \`${path}\`\n\n`;

      for (const { method, operation } of operations) {
        const methodEmoji = this.getMethodEmoji(method);
        content += `### ${methodEmoji} ${method.toUpperCase()} ${path}\n\n`;
        if (operation.summary) content += `> **${operation.summary}**\n\n`;
        if (operation.description) content += `${this.cleanHtml(operation.description)}\n\n`;
        if (operation.operationId) content += `**${t.operationId}:** \`${operation.operationId}\`\n\n`;

        if (operation.tags && operation.tags.length > 0) {
          content += `**Tags:** ${operation.tags.map((t: string) => `\`${t}\``).join(' ')}\n\n`;
        }

        content += this.renderParameters(operation.parameters, t);
        content += this.renderRequestBody(operation.requestBody, t);
        content += this.renderResponses(operation.responses, t);
        content += `---\n\n`;
      }
    }
    return content;
  }

  private generateTagContent(data: any): string {
    const t = data.i18n || I18N.en;
    let content = `# ${data.tagName}\n\n`;
    content += `> ${t.partOf} **${data.title}**\n\n---\n\n`;

    for (const { path, method, operation } of data.operations) {
      const methodEmoji = this.getMethodEmoji(method);
      content += `## ${methodEmoji} \`${method.toUpperCase()}\` ${path}\n\n`;
      if (operation.summary) content += `> ${operation.summary}\n\n`;
      if (operation.description) content += `${this.cleanHtml(operation.description)}\n\n`;
      if (operation.operationId) content += `**${t.operationId}:** \`${operation.operationId}\`\n\n`;

      content += this.renderParameters(operation.parameters, t);
      content += this.renderRequestBody(operation.requestBody, t);
      content += this.renderResponses(operation.responses, t);
      content += `---\n\n`;
    }
    return content;
  }

  private renderParameters(parameters: any[] | undefined, t: Record<string, string>): string {
    if (!parameters || parameters.length === 0) return '';
    let content = `### ${t.parameters}\n\n`;
    content += `| Name | Located In | Type | ${t.required} | Description |\n`;
    content += `|------|-----------|------|----------|-------------|\n`;
    for (const param of parameters) {
      const type = this.inferSchemaType(param.schema || param);
      const fmt = (param.schema || param).format ? ` (${(param.schema || param).format})` : '';
      const items = (param.schema || param).items ? '[]' : '';
      content += `| \`${param.name}\` | **${param.in}** | ${type}${fmt}${items} | ${param.required ? '✅ Yes' : '❌ No'} | ${this.cleanHtml(param.description || '-')} |\n`;
    }
    return content + '\n';
  }

  private renderRequestBody(requestBody: any, t: Record<string, string>): string {
    if (!requestBody) return '';
    let content = `### ${t.requestBody}\n\n`;
    if (requestBody.description) content += `${this.cleanHtml(requestBody.description)}\n\n`;
    content += `- **Required:** ${requestBody.required ? 'Yes' : 'No'}\n\n`;

    for (const [ct, mediaType] of Object.entries(requestBody.content || {})) {
      content += `- **Content-Type:** \`${ct}\`\n`;
      const schema = (mediaType as any).schema;
      if (schema?.properties) {
        content += this.renderSchemaProperties(schema.properties, schema.required, 2);
      } else if (schema?.items?.properties) {
        content += `  **Array of:** ${this.inferSchemaType(schema.items)}\n\n`;
        content += this.renderSchemaProperties(schema.items.properties, schema.items.required, 2);
      } else {
        content += `  - **Type:** \`${this.inferSchemaType(schema)}\`\n`;
      }
    }
    return content + '\n';
  }

  private renderResponses(responses: Record<string, any> | undefined, t: Record<string, string>): string {
    if (!responses) return '';
    let content = `### ${t.responses}\n\n`;
    content += `| Status Code | Description |\n`;
    content += `|-------------|-------------|\n`;
    for (const [code, resp] of Object.entries(responses)) {
      content += `| **${code}** | ${this.cleanHtml(resp.description || '-')} |\n`;
    }
    content += '\n';

    for (const [code, resp] of Object.entries(responses)) {
      for (const [ct, mediaType] of Object.entries(resp.content || {})) {
        const schema = (mediaType as any).schema;
        if (schema?.properties) {
          content += `**Response Body** (\`${ct}\`):\n\n`;
          content += this.renderSchemaProperties(schema.properties, schema.required, 0);
          content += '\n';
        }
      }
    }
    return content;
  }

  private renderSchemaProperties(properties: Record<string, any>, requiredFields: string[] | undefined, indent: number): string {
    const pad = '  '.repeat(indent);
    const typeCol = 'Type';
    const reqCol = indent === 0 ? 'Description' : '';
    let content = `${pad}| Name | Type | ${reqCol} |\n`;
    content += `${pad}|------|------|${reqCol ? '-------------|' : ''}\n`;
    for (const [name, prop] of Object.entries(properties)) {
      const type = this.inferSchemaType(prop);
      const items = prop.items ? `[${this.inferSchemaType(prop.items)}]` : '';
      const format = prop.format ? ` (${prop.format})` : '';
      const required = requiredFields?.includes(name) ? '✅ Yes' : '❌ No';
      if (indent === 0) {
        content += `${pad}| \`${name}\` | ${type}${format}${items} | ${this.cleanHtml(prop.description || '-')} |\n`;
      } else {
        content += `${pad}| \`${name}\` | ${type}${format}${items} | ${required} | ${this.cleanHtml(prop.description || '-')} |\n`;
      }
    }
    return content + '\n';
  }

  private inferSchemaType(schema: any): string {
    if (!schema || typeof schema !== 'object') return 'object';
    if (schema.type) return schema.type;
    if (schema.properties) return 'object';
    if (schema.items) return 'array';
    if (schema.oneOf || schema.anyOf) return 'object';
    return 'object';
  }

  private inlineSchemaName(path: string, method: string, suffix: string, propertyKey: string, seen: Set<string>): string | null {
    if (seen.has(propertyKey)) return null;
    seen.add(propertyKey);
    // Create a readable name from path + method + suffix
    const pathPart = path.replace(/^\//, '').replace(/\//g, '_').replace(/[^a-zA-Z0-9_]/g, '');
    const methodPart = method.charAt(0).toUpperCase() + method.slice(1);
    const suffixPart = suffix.replace(/[^a-zA-Z0-9]/g, '_');
    return `${methodPart}${pathPart}${suffixPart}Schema`;
  }

  private generateSchemasContent(data: any): string {
    const t = data.i18n || I18N.en;
    let content = `# ${t.dataSchemas}\n\n`;
    content += `> **${data.title}** — Schema Definitions\n\n---\n\n`;

    for (const [name, schema] of Object.entries(data.schemas) as [string, any]) {
      content += `## \`${name}\`\n\n`;
      if (schema.description) content += `> ${schema.description}\n\n`;
      content += `**Type:** \`${this.inferSchemaType(schema)}\`\n\n`;

      if (schema.properties) {
        content += `### ${t.properties}\n\n`;
        content += this.renderSchemaProperties(schema.properties, schema.required, 0);
      }

      if (schema.required && schema.required.length > 0) {
        content += `**Required fields:** ${schema.required.map((r: string) => `\`${r}\``).join(', ')}\n\n`;
      }

      if (schema.example) {
        content += `### Example\n\n\`\`\`json\n${JSON.stringify(schema.example, null, 2)}\n\`\`\`\n\n`;
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

  private cleanHtml(str: string): string {
    if (!str) return str;
    return str
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/?\w+(?:\s[^>]*)?>/g, '')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#x27;/g, "'")
      .replace(/&#39;/g, "'")
      .replace(/&nbsp;/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }
}
