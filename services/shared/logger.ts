type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LoggerOptions {
  prefix: string;
  debugEnvVar?: string; // e.g., 'DEBUG_BUILDING_INFO'
}

function createLogger(options: LoggerOptions) {
  const debugEnabled = options.debugEnvVar
    ? process.env[options.debugEnvVar] === '1'
    : false;

  return {
    debug: (...args: unknown[]) => {
      if (debugEnabled) {
        console.warn(`[${options.prefix}:debug]`, ...args);
      }
    },
    info: (...args: unknown[]) => console.warn(`[${options.prefix}]`, ...args),
    warn: (...args: unknown[]) => console.warn(`[${options.prefix}:warn]`, ...args),
    error: (...args: unknown[]) => console.error(`[${options.prefix}:error]`, ...args),
  };
}

export { createLogger };
export type { LoggerOptions, LogLevel };
