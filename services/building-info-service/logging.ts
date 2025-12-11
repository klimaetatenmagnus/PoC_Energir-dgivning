import { createLogger } from '../shared/logger.js';

export const logger = createLogger({
  prefix: 'building-info',
  debugEnvVar: 'DEBUG_BUILDING_INFO',
});

// Eksporter individuelle funksjoner for bakoverkompatibilitet
export const debugLog = logger.debug;
export const infoLog = logger.info;
export const warnLog = logger.warn;
export const errorLog = logger.error;
