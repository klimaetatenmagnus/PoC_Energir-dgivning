type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LoggerOptions {
  prefix: string;
  debugEnvVar?: string; // e.g., 'API_DEBUG' - uses import.meta.env for Vite or process.env for Node
}

function getDebugEnabled(debugEnvVar?: string): boolean {
  if (!debugEnvVar) {
    return false;
  }

  // Check Vite environment (browser/bundled)
  if (typeof import.meta !== 'undefined' && import.meta.env) {
    const viteEnv = import.meta.env as Record<string, string | undefined>;
    if (viteEnv[`VITE_${debugEnvVar}`] === '1' || viteEnv[debugEnvVar] === '1') {
      return true;
    }
  }

  // Check Node.js environment
  if (typeof process !== 'undefined' && process.env) {
    if (process.env[debugEnvVar] === '1') {
      return true;
    }
  }

  return false;
}

function createLogger(options: LoggerOptions) {
  const debugEnabled = getDebugEnabled(options.debugEnvVar);

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
