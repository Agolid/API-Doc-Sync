import { VersionManager, VersionInfo } from '../src/core/version';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const mockSpec = (version: string = '1.0.0') => ({
  openapi: '3.0.0',
  info: { title: 'Test API', version },
  paths: {}
});

describe('VersionManager', () => {
  let vm: VersionManager;
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vm-test-'));
    vm = new VersionManager(tmpDir);
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  describe('calculateSpecHash', () => {
    test('不同 spec 返回不同 hash', () => {
      const h1 = vm.calculateSpecHash(mockSpec('1.0.0'));
      const h2 = vm.calculateSpecHash(mockSpec('2.0.0'));
      expect(h1).not.toBe(h2);
    });

    test('相同 spec 返回相同 hash', () => {
      const h1 = vm.calculateSpecHash(mockSpec('1.0.0'));
      const h2 = vm.calculateSpecHash(mockSpec('1.0.0'));
      expect(h1).toBe(h2);
    });
  });

  describe('createVersion', () => {
    test('应该创建版本', async () => {
      const spec = mockSpec('1.0.0');
      const dir = path.join(tmpDir, 'out');
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'f.txt'), 'hello');

      const info = await vm.createVersion(spec, dir);
      expect(info.version).toBe('1.0.0');
      expect(info.specHash).toBeDefined();
      expect(info.filesCount).toBe(1);
    });

    test('重复版本相同 spec 应返回已有版本', async () => {
      const spec = mockSpec('1.0.0');
      const dir = path.join(tmpDir, 'out');
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'f.txt'), 'hello');

      const info1 = await vm.createVersion(spec, dir);
      const info2 = await vm.createVersion(spec, dir);
      expect(info1).toBe(info2);
    });
  });

  describe('compareVersions', () => {
    test('应该检测新增和删除文件', async () => {
      const dir1 = path.join(tmpDir, 'v1');
      const dir2 = path.join(tmpDir, 'v2');
      fs.mkdirSync(dir1, { recursive: true });
      fs.mkdirSync(dir2, { recursive: true });
      fs.writeFileSync(path.join(dir1, 'old.txt'), 'old');
      fs.writeFileSync(path.join(dir2, 'new.txt'), 'new');

      const changes = await vm.compareVersions('v1', 'v2', dir1, dir2);
      expect(changes.added).toContain('new.txt');
      expect(changes.removed).toContain('old.txt');
      expect(changes.modified).toHaveLength(0);
    });

    test('应该检测修改的文件', async () => {
      const dir1 = path.join(tmpDir, 'v1');
      const dir2 = path.join(tmpDir, 'v2');
      fs.mkdirSync(dir1, { recursive: true });
      fs.mkdirSync(dir2, { recursive: true });
      fs.writeFileSync(path.join(dir1, 'same.txt'), 'a');
      fs.writeFileSync(path.join(dir2, 'same.txt'), 'b');

      const changes = await vm.compareVersions('v1', 'v2', dir1, dir2);
      expect(changes.modified).toContain('same.txt');
      expect(changes.added).toHaveLength(0);
      expect(changes.removed).toHaveLength(0);
    });
  });

  describe('getAllVersions / findVersionKey', () => {
    test('getAllVersions 按时间倒序排序', async () => {
      const dir = path.join(tmpDir, 'out');
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'f.txt'), 'x');

      await vm.createVersion(mockSpec('1.0.0'), dir);
      // small delay to ensure different timestamps
      await new Promise(r => setTimeout(r, 10));
      await vm.createVersion(mockSpec('2.0.0'), dir);

      const all = vm.getAllVersions();
      expect(all).toHaveLength(2);
      expect(all[0].timestamp).toBeGreaterThanOrEqual(all[1].timestamp);
    });

    test('findVersionKey 返回正确的 key', async () => {
      const dir = path.join(tmpDir, 'out');
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'f.txt'), 'x');

      await vm.createVersion(mockSpec('3.0.0'), dir);
      const key = vm.findVersionKey('3.0.0');
      expect(key).toBeDefined();
      expect(key).toContain('3.0.0');
    });
  });

  describe('saveHistory / loadHistory', () => {
    test('应该能保存并加载历史', async () => {
      const dir = path.join(tmpDir, 'out');
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'f.txt'), 'x');

      await vm.createVersion(mockSpec('1.0.0'), dir);
      await vm.saveHistory();

      const vm2 = new VersionManager(tmpDir);
      await vm2.loadHistory();
      expect(vm2.getAllVersions()).toHaveLength(1);
      expect(vm2.getAllVersions()[0].version).toBe('1.0.0');
    });

    test('空目录加载历史应正常', async () => {
      await vm.loadHistory();
      expect(vm.getAllVersions()).toHaveLength(0);
    });
  });
});
