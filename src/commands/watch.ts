import * as fs from 'fs';
import * as path from 'path';
import { configManager } from '../utils/config';
import { logger } from '../utils/logger';
import { generateCommand } from './generate';
import chalk from '../utils/chalk';

const i18n: Record<string, Record<string, string>> = {
  en: {
    watching: 'Watching for changes:',
    changed: 'File changed, regenerating...',
    generated: 'Documentation generated successfully',
    error: 'Generation failed',
    pressCtrlC: 'Press Ctrl+C to stop',
  },
  zh: {
    watching: '正在监听文件变化:',
    changed: '文件已变更，正在重新生成...',
    generated: '文档生成成功',
    error: '生成失败',
    pressCtrlC: '按 Ctrl+C 停止',
  },
};

export async function watchCommand(options: {
  input?: string;
  output?: string;
  config?: string;
  language?: string;
}): Promise<void> {
  // Load config
  if (options.config) {
    configManager.load(options.config);
  } else {
    configManager.load();
  }

  const config = configManager.get();
  const lang = options.language || config.language || 'en';
  const t = i18n[lang] || i18n.en;
  const inputPath = options.input || config.input;

  if (!inputPath) {
    logger.error('No input path provided. Use --input or set input in config.');
    process.exit(1);
  }

  // Resolve to absolute path
  const resolvedPath = path.resolve(inputPath);
  if (!fs.existsSync(resolvedPath)) {
    logger.error(`Input file not found: ${resolvedPath}`);
    process.exit(1);
  }

  // Build generate options
  const generateOptions: any = {
    input: options.input,
    output: options.output,
    config: options.config,
    language: options.language,
  };

  console.log('');
  console.log(chalk.cyan(`👀 ${t.watching}`));
  console.log(chalk.gray(`   ${resolvedPath}`));
  console.log(chalk.gray(`   ${t.pressCtrlC}`));
  console.log('');

  // Debounce timer
  let timer: ReturnType<typeof setTimeout> | null = null;

  const onChange = () => {
    if (timer) clearTimeout(timer);

    const timestamp = new Date().toLocaleTimeString();
    console.log(chalk.yellow(`[${timestamp}] ${t.changed}`));

    timer = setTimeout(async () => {
      try {
        await generateCommand(generateOptions);
        console.log(chalk.green(`[${new Date().toLocaleTimeString()}] ${t.generated}`));
      } catch (error: any) {
        console.log(chalk.red(`[${new Date().toLocaleTimeString()}] ${t.error}: ${error.message}`));
      }
      console.log('');
    }, 500);
  };

  // Run once on start
  await generateCommand(generateOptions);

  // Watch the file
  fs.watchFile(resolvedPath, { interval: 500 }, (curr, prev) => {
    if (curr.mtimeMs !== prev.mtimeMs) {
      onChange();
    }
  });

  // Keep process alive
  return new Promise(() => {});
}
