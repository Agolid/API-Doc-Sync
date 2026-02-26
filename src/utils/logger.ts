import chalk from 'chalk';

export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
  SUCCESS = 'SUCCESS'
}

export class Logger {
  private static instance: Logger;
  private logLevel: LogLevel = LogLevel.INFO;

  private constructor() {}

  static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  setLogLevel(level: LogLevel): void {
    this.logLevel = level;
  }

  private shouldLog(level: LogLevel): boolean {
    const levels = [LogLevel.DEBUG, LogLevel.INFO, LogLevel.WARN, LogLevel.ERROR, LogLevel.SUCCESS];
    return levels.indexOf(level) >= levels.indexOf(this.logLevel);
  }

  private formatMessage(level: LogLevel, message: string): string {
    const timestamp = new Date().toISOString();
    const levelStr = chalk.gray(`[${timestamp}] ${level}`);
    return `${levelStr} ${message}`;
  }

  debug(message: string): void {
    if (this.shouldLog(LogLevel.DEBUG)) {
      console.log(this.formatMessage(LogLevel.DEBUG, chalk.gray(message)));
    }
  }

  info(message: string): void {
    if (this.shouldLog(LogLevel.INFO)) {
      console.log(this.formatMessage(LogLevel.INFO, chalk.blue(message)));
    }
  }

  warn(message: string): void {
    if (this.shouldLog(LogLevel.WARN)) {
      console.log(this.formatMessage(LogLevel.WARN, chalk.yellow(message)));
    }
  }

  error(message: string): void {
    if (this.shouldLog(LogLevel.ERROR)) {
      console.error(this.formatMessage(LogLevel.ERROR, chalk.red(message)));
    }
  }

  success(message: string): void {
    if (this.shouldLog(LogLevel.SUCCESS)) {
      console.log(this.formatMessage(LogLevel.SUCCESS, chalk.green(message)));
    }
  }

  step(step: number, total: number, message: string): void {
    const progress = chalk.cyan(`[${step}/${total}]`);
    console.log(`  ${progress} ${message}`);
  }
}

export const logger = Logger.getInstance();
