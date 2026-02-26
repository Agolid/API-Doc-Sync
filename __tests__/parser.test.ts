import { OpenAPIParser } from '../src/core/parser';
import * as fs from 'fs';
import * as path from 'path';

describe('OpenAPIParser', () => {
  // 使用已有的petstore.yaml作为测试文件
  const projectRoot = path.join(__dirname, '..');
  const testSpecPath = path.join(projectRoot, 'examples/petstore.yaml');

  describe('load', () => {
    test('应该成功加载本地YAML文件', async () => {
      const parser = await OpenAPIParser.load(testSpecPath);
      expect(parser).toBeInstanceOf(OpenAPIParser);
    });

    test('应该正确解析OpenAPI spec信息', async () => {
      const parser = await OpenAPIParser.load(testSpecPath);
      const info = parser.getInfo();

      expect(info).toMatchObject({
        title: 'Pet Store API',
        version: '1.0.0'
      });
      expect(info.description).toBeDefined();
    });

    test('应该正确解析服务器列表', async () => {
      const parser = await OpenAPIParser.load(testSpecPath);
      const servers = parser.getServers();

      expect(servers.length).toBeGreaterThan(0);
      expect(servers[0]).toMatchObject({
        url: expect.any(String),
        description: expect.any(String)
      });
    });

    test('应该正确解析API路径', async () => {
      const parser = await OpenAPIParser.load(testSpecPath);
      const paths = parser.getPaths();

      expect(paths).toHaveProperty('/pets');
      expect(paths).toHaveProperty('/pets/{petId}');
      expect(paths).toHaveProperty('/store/order');
    });

    test('应该正确解析标签列表', async () => {
      const parser = await OpenAPIParser.load(testSpecPath);
      const tags = parser.getTags();

      expect(tags.length).toBeGreaterThan(0);
      expect(tags.map((t: any) => t.name)).toContain('pets');
      expect(tags.map((t: any) => t.name)).toContain('store');
    });
  });

  describe('getSpec', () => {
    test('应该返回完整的OpenAPI spec', async () => {
      const parser = await OpenAPIParser.load(testSpecPath);
      const spec = parser.getSpec();

      expect(spec).toHaveProperty('openapi');
      expect(spec).toHaveProperty('info');
      expect(spec).toHaveProperty('paths');
      expect(spec).toHaveProperty('components');
    });
  });

  describe('错误处理', () => {
    test('应该抛出错误当文件不存在', async () => {
      await expect(OpenAPIParser.load('/nonexistent/file.yaml'))
        .rejects
        .toThrow();
    });
  });
});
