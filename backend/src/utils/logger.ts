type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVEL_WEIGHT: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

const configured = (process.env.LOG_LEVEL as LogLevel | undefined) ?? 'info';
const threshold = LEVEL_WEIGHT[configured] ?? LEVEL_WEIGHT.info;

function write(level: LogLevel, event: string, meta?: Record<string, unknown>): void {
  if (LEVEL_WEIGHT[level] < threshold) return;

  const line = {
    ts: new Date().toISOString(),
    level,
    event,
    ...meta,
  };

  const serialized = JSON.stringify(line);
  if (level === 'error') console.error(serialized);
  else if (level === 'warn') console.warn(serialized);
  else console.log(serialized);
}

export const logger = {
  debug: (event: string, meta?: Record<string, unknown>) => write('debug', event, meta),
  info: (event: string, meta?: Record<string, unknown>) => write('info', event, meta),
  warn: (event: string, meta?: Record<string, unknown>) => write('warn', event, meta),
  error: (event: string, meta?: Record<string, unknown>) => write('error', event, meta),
};
