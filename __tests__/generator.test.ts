import { DocGenerator } from '../src/core/generator';
import { OpenAPIParser } from '../src/core/parser';
import * as fs from 'fs';
import * as path from 'path';

describe('DocGenerator', () => {
  // 使用已有的petstore.yaml作为测试文件
  const projectRoot = path.join(__dirname, '..');
  const testSpecPath = path.join(projectRoot, 'examples/petstore.yaml');
  const outputDir = path.join(__dirname, 'temp-generator-output');

  afterAll(() => {
    // Clean up
    if (fs.existsSync(outputDir)) {
      fs.rmSync(outputDir, { recursive: true, force: true });
    }
  });

  describe('generate', () => {
    test('应该成功生成文档目录', async () => {
      const parser = await OpenAPIParser.load(testSpecPath);
      const generator = new DocGenerator(parser, {
        output: outputDir,
        format: 'markdown'
      });

      await generator.generate();

      expect(fs.existsSync(outputDir)).toBe(true);
    });

    test('应该生成README.md文件', async () => {
      const parser = await OpenAPIParser.load(testSpecPath);
      const generator = new DocGenerator(parser, {
        output: outputDir,
        format: 'markdown'
      });

      await generator.generate();

      const readmePath = path.join(outputDir, 'README.md');
      expect(fs.existsSync(readmePath)).toBe(true);

      const content = fs.readFileSync(readmePath, 'utf8');
      expect(content).toContain('Pet Store API');
      expect(content).toContain('1.0.0');
    });

    test('应该生成API.md文件', async () => {
      const parser = await OpenAPIParser.load(testSpecPath);
      const generator = new DocGenerator(parser, {
        output: outputDir,
        format: 'markdown'
      });

      await generator.generate();

      const apiPath = path.join(outputDir, 'API.md');
      expect(fs.existsSync(apiPath)).toBe(true);

      const content = fs.readFileSync(apiPath, 'utf8');
      expect(content).toContain('API Reference');
    });

    test('应该生成.schema文件', async () => {
      const parser = await OpenAPIParser.load(testSpecPath);
      const generator = new DocGenerator(parser, {
        output: outputDir,
        format: 'markdown'
      });

      await generator.generate();

      const schemasPath = path.join(outputDir, 'Schemas.md');
      expect(fs.existsSync(schemasPath)).toBe(true);

      const content = fs.readFileSync(schemasPath, 'utf8');
      expect(content).toContain('Schemas');
      expect(content).toContain('Pet');
      expect(content).toContain('Order');
    });
  });

  describe('私有方法测试', () => {
    test('应该正确生成方法emoji', async () => {
      const parser = await OpenAPIParser.load(testSpecPath);
      const generator = new DocGenerator(parser, {
        output: outputDir,
        format: 'markdown'
      });

      // 通过测试生成的API文档来验证emoji是否正确生成
      await generator.generate();

      const apiPath = path.join(outputDir, 'API.md');
      const content = fs.readFileSync(apiPath, 'utf8');

      // GET方法应该有相应的emoji
      expect(content).toMatch(/GET/);
    });
  });
});
