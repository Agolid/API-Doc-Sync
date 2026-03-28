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
    let rawSpec: any;
    let lenient = false;

    if (specPath.startsWith('http://') || specPath.startsWith('https://')) {
      // Load from URL
      logger.info(`Loading OpenAPI spec from URL: ${specPath}`);
      try {
        rawSpec = await SwaggerParser.validate(specPath);
      } catch (err: any) {
        logger.warn(`Strict validation failed (${err.message}), loading in lenient mode...`);
        const response = await fetch(specPath);
        const text = await response.text();
        try { rawSpec = JSON.parse(text); } catch { rawSpec = yaml.load(text); }
        lenient = true;
      }
    } else {
      // Load from file
      const fullPath = path.resolve(specPath);
      logger.info(`Loading OpenAPI spec from file: ${fullPath}`);

      if (!fs.existsSync(fullPath)) {
        throw new Error(`OpenAPI spec file not found: ${fullPath}`);
      }

      const content = fs.readFileSync(fullPath, 'utf8');

      if (fullPath.endsWith('.json')) {
        rawSpec = JSON.parse(content);
      } else {
        rawSpec = yaml.load(content);
      }

      // Validate spec
      try {
        await SwaggerParser.validate(rawSpec);
      } catch (err: any) {
        logger.warn(`Strict validation failed (${err.message}), continuing in lenient mode...`);
        lenient = true;
      }
    }

    // In lenient mode, resolve $refs manually (stub missing ones)
    const spec = lenient ? this.lenientResolve(rawSpec) : rawSpec;

    return new OpenAPIParser(spec as OpenAPISpec);
  }

  /**
   * Resolve a spec leniently: follow internal $refs that exist, stub out missing ones.
   * This allows generating docs from imperfect/spec-noncompliant OpenAPI files.
   */
  private static lenientResolve(spec: any): any {
    const visited = new Set<string>();

    function resolveRef(ref: string): any {
      if (visited.has(ref)) return { description: `[Circular ref: ${ref}]` };
      visited.add(ref);

      if (ref.startsWith('#/')) {
        const parts = ref.substring(2).split('/');
        let current: any = spec;
        for (const part of parts) {
          if (current && typeof current === 'object' && part in current) {
            current = current[part];
          } else {
            return { description: `[Missing ref: ${ref}]`, type: 'object' };
          }
        }
        return walk(current);
      }
      return { description: `[External ref: ${ref}]`, type: 'object' };
    }

    function walk(obj: any): any {
      if (obj === null || typeof obj !== 'object') return obj;
      if (Array.isArray(obj)) return obj.map(walk);

      // Handle $ref — merge resolved with any sibling keys (allOf / oneOf pattern)
      if (typeof obj.$ref === 'string') {
        const resolved = resolveRef(obj.$ref);
        const rest: any = {};
        for (const [k, v] of Object.entries(obj)) {
          if (k !== '$ref') rest[k] = walk(v);
        }
        // Merge: resolved as base, sibling keys on top
        if (typeof resolved === 'object' && resolved !== null && !Array.isArray(resolved) && typeof resolved.description === 'string' && resolved.description.startsWith('[Missing')) {
          // Stub — keep sibling keys if any
          return Object.keys(rest).length > 0 ? rest : resolved;
        }
        return { ...resolved, ...rest };
      }

      const result: any = {};
      for (const [key, value] of Object.entries(obj)) {
        result[key] = walk(value);
      }
      return result;
    }

    return walk(spec);
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
    // If top-level tags are defined, use them
    if (this.spec.tags && this.spec.tags.length > 0) {
      return this.spec.tags;
    }
    // Otherwise, extract unique tags from operations
    const tagSet = new Set<string>();
    for (const op of this.getOperations()) {
      if (op.operation.tags) {
        op.operation.tags.forEach(t => tagSet.add(t));
      }
    }
    return [...tagSet].map(name => ({ name }));
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
