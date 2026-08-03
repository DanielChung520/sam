// sam LINE Agent — Structured Logger
//
// 簡單 JSON logger：每行一個 JSON object，方便 grep 與後續接 log aggregator
// 不引入額外依賴（pino / winston 都太重）

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogFields {
  [key: string]: unknown;
}

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

const MIN_LEVEL: LogLevel = (process.env.LOG_LEVEL as LogLevel) ?? 'info';

function shouldLog(level: LogLevel): boolean {
  return LEVEL_PRIORITY[level] >= LEVEL_PRIORITY[MIN_LEVEL];
}

function formatLine(level: LogLevel, scope: string, fields: LogFields): string {
  const payload = {
    ts: new Date().toISOString(),
    level,
    scope,
    ...fields,
  };
  try {
    return JSON.stringify(payload);
  } catch {
    return JSON.stringify({ ts: payload.ts, level, scope, error: 'failed to serialize' });
  }
}

function log(level: LogLevel, scope: string, fields: LogFields): void {
  if (!shouldLog(level)) return;
  const line = formatLine(level, scope, fields);
  if (level === 'error') {
    console.error(line);
  } else if (level === 'warn') {
    console.warn(line);
  } else {
    console.log(line);
  }
}

export const logger = {
  debug(scope: string, fields: LogFields = {}): void {
    log('debug', scope, fields);
  },
  info(scope: string, fields: LogFields = {}): void {
    log('info', scope, fields);
  },
  warn(scope: string, fields: LogFields = {}): void {
    log('warn', scope, fields);
  },
  error(scope: string, fields: LogFields = {}): void {
    log('error', scope, fields);
  },
  child(scope: string): {
    debug: (fields: LogFields) => void;
    info: (fields: LogFields) => void;
    warn: (fields: LogFields) => void;
    error: (fields: LogFields) => void;
  } {
    return {
      debug: (fields) => log('debug', scope, fields),
      info: (fields) => log('info', scope, fields),
      warn: (fields) => log('warn', scope, fields),
      error: (fields) => log('error', scope, fields),
    };
  },
};