import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import SwaggerParser from '@apidevtools/swagger-parser';
import { logger } from '../utils/logger';

export interface OpenAPISpec {
  openapi?: string;
  swagger?: string;
  info: {
    title: string;
    version: string;
    description?: string;
    contact?: {
      name?: string;
      email?: string;
      url?: string;
    };
    license?: {
      name?: string;
      url?: string;
    };
  };
  servers?: Array<{
    url: string;
    description?: string;
  }>;
  paths: Record<string, PathItem>;
  components?: {
    schemas?: Record<string, any>;
    securitySchemes?: Record<string, any>;
  };
  tags?: Array<{
    name: string;
    description?: string;
  }>;
}

export interface PathItem {
  get?: Operation;
  post?: Operation;
  put?: Operation;
  delete?: Operation;
  patch?: Operation;
  summary?: string;
  description?: string;
  parameters?: Parameter[];
}

export interface Operation {
  operationId?: string;
  summary?: string;
  description?: string;
  tags?: string[];
  parameters?: Parameter[];
  requestBody?: RequestBody;
  responses?: Record<string, Response>;
  security?: Record<string, string[]>;
}

export interface Parameter {
  name: string;
  in: 'query' | 'header' | 'path' | 'cookie';
  description?: string;
  required?: boolean;
  schema?: any;
  type?: string;
  enum?: any[];
}

export interface RequestBody {
  description?: string;
  required?: boolean;
  content?: Record<string, MediaType>;
}

export interface MediaType {
  schema?: any;
  example?: any;
  examples?: Record<string, any>;
}

export interface Response {
  description: string;
  content?: Record<string, MediaType>;
  headers?: Record<string, any>;
}

export class OpenAPIParser {
  private spec: OpenAPISpec;

  constructor(spec: OpenAPISpec) {
    this.spec = spec;
  }

  static async load(specPath: string): Promise<OpenAPIParser> {
    let spec: any;

    if (specPath.startsWith('http://') || specPath.startsWith('https://')) {
      // Load from URL
      logger.info(`Loading OpenAPI spec from URL: ${specPath}`);
      spec = await SwaggerParser.validate(specPath);
    } else {
      // Load from file
      const fullPath = path.resolve(specPath);
      logger.info(`Loading OpenAPI spec from file: ${fullPath}`);

      if (!fs.existsSync(fullPath)) {
        throw new Error(`OpenAPI spec file not found: ${fullPath}`);
      }

      const content = fs.readFileSync(fullPath, 'utf8');

      if (fullPath.endsWith('.json')) {
        spec = JSON.parse(content);
      } else {
        spec = yaml.load(content);
      }

      // Validate spec
      await SwaggerParser.validate(spec);
    }

    return new OpenAPIParser(spec as OpenAPISpec);
  }

  getSpec(): OpenAPISpec {
    return this.spec;
  }

  getInfo() {
    return this.spec.info;
  }

  getVersion(): string {
    return this.spec.info.version;
  }

  getTitle(): string {
    return this.spec.info.title;
  }

  getServers() {
    return this.spec.servers || [];
  }

  getPaths(): Record<string, PathItem> {
    return this.spec.paths;
  }

  getTags() {
    return this.spec.tags || [];
  }

  getOperations(): Array<{
    path: string;
    method: string;
    operation: Operation;
  }> {
    const operations: Array<{
      path: string;
      method: string;
      operation: Operation;
    }> = [];

    for (const [path, pathItem] of Object.entries(this.getPaths())) {
      for (const [method, operation] of Object.entries(pathItem)) {
        if (['get', 'post', 'put', 'delete', 'patch'].includes(method)) {
          operations.push({
            path,
            method,
            operation: operation as Operation
          });
        }
      }
    }

    return operations;
  }

  getOperationsByTag(tag: string): Array<{
    path: string;
    method: string;
    operation: Operation;
  }> {
    return this.getOperations().filter(
      ({ operation }) => operation.tags && operation.tags.includes(tag)
    );
  }

  getSchemas(): Record<string, any> {
    return this.spec.components?.schemas || {};
  }

  getSchema(name: string): any {
    return this.spec.components?.schemas?.[name];
  }

  isOpenAPI3(): boolean {
    return !!this.spec.openapi;
  }

  isSwagger2(): boolean {
    return !!this.spec.swagger;
  }
}
