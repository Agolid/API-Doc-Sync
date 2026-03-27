/**
 * Lightweight console color utility.
 * Supports: chalk.red('text') and chalk.cyan.bold('text')
 * No external ESM dependencies — works with ts-jest.
 */

const NO_COLOR = !process.stdout.isTTY && process.env.FORCE_COLOR !== '1';

const CODES: Record<string, string> = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  gray: '\x1b[90m',
  redBright: '\x1b[91m',
  greenBright: '\x1b[92m',
  yellowBright: '\x1b[93m',
  blueBright: '\x1b[94m',
  cyanBright: '\x1b[96m',
};

function applyColor(codes: string, text: string): string {
  if (NO_COLOR) return text;
  return `${codes}${text}${CODES.reset}`;
}

function createChalk(baseCodes: string = ''): ChalkChain {
  const fn = function(text: string): string {
    return applyColor(baseCodes, text);
  } as ChalkChain;

  // Use getter-based laziness to avoid infinite recursion
  const handler: ProxyHandler<ChalkChain> = {
    get(_target, prop: string) {
      const code = CODES[prop];
      if (code) {
        return createChalk(baseCodes + code);
      }
      return undefined;
    },
  };

  return new Proxy(fn, handler);
}

interface ChalkChain {
  (text: string): string;
  [key: string]: ChalkChain;
}

// Standalone shortcuts
export const c = {
  red: (t: string) => applyColor(CODES.red, t),
  green: (t: string) => applyColor(CODES.green, t),
  yellow: (t: string) => applyColor(CODES.yellow, t),
  blue: (t: string) => applyColor(CODES.blue, t),
  cyan: (t: string) => applyColor(CODES.cyan, t),
  gray: (t: string) => applyColor(CODES.gray, t),
  bold: (t: string) => applyColor(CODES.bold, t),
  dim: (t: string) => applyColor(CODES.dim, t),
  white: (t: string) => applyColor(CODES.white, t),
};

// chalk-compatible default export
// chalk.red('hi'), chalk.cyan('hi'), chalk.cyan.bold('hi')
export default createChalk();
