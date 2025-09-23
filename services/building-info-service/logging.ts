const debugEnabled =
  process.env.DEBUG_BUILDING_INFO === "1" || process.env.LOG_SOAP === "1";

export function debugLog(...args: unknown[]) {
  if (debugEnabled) {
    console.warn("[building-info:debug]", ...args);
  }
}

export function infoLog(...args: unknown[]) {
  console.warn("[building-info]", ...args);
}

export function warnLog(...args: unknown[]) {
  console.warn("[building-info:warn]", ...args);
}

export const errorLog = console.error.bind(console, "[building-info:error]");
