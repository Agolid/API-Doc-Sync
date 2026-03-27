import { validateCommand } from '../src/commands/validate';
import * as path from 'path';

describe('validate command', () => {
  const projectRoot = path.join(__dirname, '..');
  const validSpec = path.join(projectRoot, 'examples/petstore.yaml');

  test('应该成功验证有效的 spec', async () => {
    // validateCommand calls process.exit on failure; valid spec should not throw
    await expect(validateCommand({ specPath: validSpec })).resolves.not.toThrow();
  });

  test('应该失败当 spec 无效', async () => {
    // process.exit(1) is called on validation failure
    const origExit = process.exit;
    const exitMock = jest.fn();
    process.exit = exitMock as any;

    // Suppress console output during test
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

    await validateCommand({ specPath: '/nonexistent/spec.yaml' });

    expect(exitMock).toHaveBeenCalledWith(1);
    consoleSpy.mockRestore();
    process.exit = origExit;
  });
});
