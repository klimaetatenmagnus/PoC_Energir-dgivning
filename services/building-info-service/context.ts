import { getRuntimeConfig } from '../../packages/config/src/runtime.ts';
import { matrikkelEndpoint } from '../../src/utils/endpoints.ts';
import { MatrikkelClient } from '../../src/clients/MatrikkelClient.ts';
import { BygningClient } from '../../src/clients/BygningClient.ts';
import { StoreClient } from '../../src/clients/StoreClient.ts';
import { BruksenhetClient } from '../../src/clients/BruksenhetClient.ts';

const runtimeConfig = getRuntimeConfig();
const matrikkelConfig = runtimeConfig.flags.liveMode
  ? runtimeConfig.matrikkel.prod
  : runtimeConfig.matrikkel.current;

export const LOG = runtimeConfig.flags.logSoap;
export const ENOVA_KEY = runtimeConfig.enova.apiKey ?? '';
export const PORT = runtimeConfig.ports.buildingInfo;

export const storeClient = new StoreClient(
  matrikkelEndpoint(matrikkelConfig.baseUrl, 'StoreService'),
  matrikkelConfig.username,
  matrikkelConfig.password
);

export const bygningClient = new BygningClient(
  matrikkelEndpoint(matrikkelConfig.baseUrl, 'BygningService'),
  matrikkelConfig.username,
  matrikkelConfig.password
);

export const matrikkelClient = new MatrikkelClient(
  matrikkelEndpoint(matrikkelConfig.baseUrl, 'MatrikkelenhetService'),
  matrikkelConfig.username,
  matrikkelConfig.password
);

export const bruksenhetClient = new BruksenhetClient(
  matrikkelEndpoint(matrikkelConfig.baseUrl, 'BruksenhetService'),
  matrikkelConfig.username,
  matrikkelConfig.password
);

export type MatrikkelContext = ReturnType<typeof createMatrikkelContext>;

export function createMatrikkelContext() {
  return {
    locale: 'no_NO_B',
    brukOriginaleKoordinater: true,
    koordinatsystemKodeId: 25833,
    systemVersion: 'trunk',
    klientIdentifikasjon: 'building-info-service',
    snapshotVersion: { timestamp: '9999-01-01T00:00:00+01:00' },
  } as const;
}

export { runtimeConfig };
