import { ConfigManager } from '../src/utils/config';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

describe('ConfigManager', () => {
  let cm: ConfigManager;
  let tmpDir: string;
  let configPath: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cfg-test-'));
    configPath = path.join(tmpDir, 'api-doc-sync.config.yml');
    // Reset singleton state
    cm = new (ConfigManager as any)();
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  describe('get / set', () => {
    test('get 返回默认配置', () => {
      const config = cm.get();
      expect(config.input).toBe('./openapi.yaml');
      expect(config.output).toBe('./docs');
      expect(config.format).toBe('markdown');
    });

    test('set 应该合并配置', () => {
      cm.set({ input: 'new.yaml', output: 'new-docs' });
      const config = cm.get();
      expect(config.input).toBe('new.yaml');
      expect(config.output).toBe('new-docs');
      expect(config.format).toBe('markdown'); // unchanged
    });

    test('set 应该深度合并 github 配置', () => {
      cm.set({ github: { token: 't1', owner: 'o1' } });
      cm.set({ github: { repo: 'r1' } });
      const config = cm.get();
      expect(config.github?.token).toBe('t1');
      expect(config.github?.owner).toBe('o1');
      expect(config.github?.repo).toBe('r1');
    });
  });

  describe('validate', () => {
    test('默认配置应验证通过', () => {
      expect(cm.validate()).toBe(true);
    });

    test('缺少 input 应抛错', () => {
      cm.set({ input: '' } as any);
      expect(() => cm.validate()).toThrow('Input path is required');
    });

    test('有 token 但缺少 owner 应抛错', () => {
      cm.set({ github: { token: 't' } });
      expect(() => cm.validate()).toThrow('GitHub owner and repo are required');
    });
  });

  describe('save / load', () => {
    test('save 应写入 YAML 文件', () => {
      cm.set({ input: 'custom.yaml' });
      cm.save(configPath);
      expect(fs.existsSync(configPath)).toBe(true);
      const content = fs.readFileSync(configPath, 'utf8');
      expect(content).toContain('custom.yaml');
    });

    test('load 应从文件读取配置', () => {
      fs.writeFileSync(configPath, `input: loaded.yaml\noutput: loaded-docs\nformat: markdown\n`);
      cm.load(configPath);
      const config = cm.get();
      expect(config.input).toBe('loaded.yaml');
      expect(config.output).toBe('loaded-docs');
    });
  });

  describe('reset', () => {
    test('应重置为默认配置', () => {
      cm.set({ input: 'changed.yaml', output: 'changed' });
      cm.reset();
      const config = cm.get();
      expect(config.input).toBe('./openapi.yaml');
      expect(config.output).toBe('./docs');
    });
  });
});
