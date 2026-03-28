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

    // Always deep-resolve $refs. In lenient mode, stub missing ones.
    const spec = this.deepResolve(rawSpec, lenient);

    return new OpenAPIParser(spec as OpenAPISpec);
  }

  /**
   * Deep-resolve all $ref pointers in the spec (both lenient and strict mode).
   * In lenient mode, missing refs are stubbed instead of crashing.
   */
  private static deepResolve(spec: any, lenient: boolean): any {
    const visited = new Set<string>();

    function resolveRef(ref: string): any {
      if (visited.has(ref)) return { description: '', type: 'object' };
      visited.add(ref);

      if (ref.startsWith('#/')) {
        const parts = ref.substring(2).split('/');
        let current: any = spec;
        for (const part of parts) {
          if (current && typeof current === 'object' && part in current) {
            current = current[part];
          } else {
            return lenient
              ? { description: '', type: 'object' }
              : { description: '', type: 'object' };
          }
        }
        return walk(current);
      }
      return { description: '', type: 'object' };
    }

    function resolveAllOf(obj: any): any {
      // If the object has allOf, merge all sub-schemas
      if (Array.isArray(obj.allOf)) {
        const merged: any = { properties: {}, required: [] };
        for (const sub of obj.allOf) {
          const resolved = walk(sub);
          if (resolved.properties) {
            Object.assign(merged.properties, resolved.properties);
          }
          if (resolved.required) {
            merged.required.push(...resolved.required);
          }
          // Merge other fields (description, type, etc.) — first non-empty wins
          for (const [k, v] of Object.entries(resolved)) {
            if (k !== 'properties' && k !== 'required' && !(k in merged)) {
              merged[k] = v;
            }
          }
        }
        // Copy over any direct properties on the object itself
        for (const [k, v] of Object.entries(obj)) {
          if (k !== 'allOf' && !(k in merged)) {
            merged[k] = walk(v);
          }
        }
        // Remove empty required
        if (merged.required.length === 0) delete merged.required;
        // Remove empty properties
        if (Object.keys(merged.properties).length === 0) delete merged.properties;
        return merged;
      }
      return null;
    }

    function resolveOneOfAnyOf(obj: any): any {
      // For oneOf/anyOf, pick the first match that has the most info
      for (const key of ['oneOf', 'anyOf']) {
        if (Array.isArray(obj[key]) && obj[key].length > 0) {
          // Find the richest schema (most properties)
          let best = walk(obj[key][0]);
          for (let i = 1; i < obj[key].length; i++) {
            const candidate = walk(obj[key][i]);
            const props = Object.keys(candidate.properties || {}).length;
            if (props > Object.keys(best.properties || {}).length) {
              best = candidate;
            }
          }
          const result: any = { ...best };
          // Copy over any direct properties on the object itself
          for (const [k, v] of Object.entries(obj)) {
            if (k !== 'oneOf' && k !== 'anyOf' && !(k in result)) {
              result[k] = walk(v);
            }
          }
          return result;
        }
      }
      return null;
    }

    function walk(obj: any): any {
      if (obj === null || typeof obj !== 'object') return obj;
      if (Array.isArray(obj)) return obj.map(walk);

      // Handle $ref — resolve and merge with sibling keys
      if (typeof obj.$ref === 'string') {
        const resolved = resolveRef(obj.$ref);
        const rest: any = {};
        for (const [k, v] of Object.entries(obj)) {
          if (k !== '$ref') rest[k] = walk(v);
        }
        return { ...resolved, ...rest };
      }

      // Handle allOf
      const allOfResult = resolveAllOf(obj);
      if (allOfResult) return allOfResult;

      // Handle oneOf/anyOf — pick the richest variant
      const oneOfResult = resolveOneOfAnyOf(obj);
      if (oneOfResult) return oneOfResult;

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
