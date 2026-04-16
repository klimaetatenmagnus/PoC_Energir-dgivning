import { getRuntimeConfig } from "../../packages/config/src/runtime.ts";
import { IdentService } from "./IdentService.ts";
import { RegisterenhetService } from "./RegisterenhetService.ts";
import { RegisterenhetsrettService } from "./RegisterenhetsrettService.ts";
import { RegisterenhetsrettsandelService } from "./RegisterenhetsrettsandelService.ts";
import { StoreService } from "./StoreService.ts";
import { defaultContext } from "./GrunnbokSoapClient.ts";

const runtimeConfig = getRuntimeConfig();
const grunnbokConfig = runtimeConfig.grunnbok.current;
const ctx = defaultContext("energinokkelen");

function hasCredentials(): boolean {
  return Boolean(grunnbokConfig.username && grunnbokConfig.password);
}

const enabled = hasCredentials();
const { baseUrl, username, password } = grunnbokConfig;

export const identService = enabled
  ? new IdentService(baseUrl, username, password, ctx)
  : null;
export const registerenhetService = enabled
  ? new RegisterenhetService(baseUrl, username, password, ctx)
  : null;
export const registerenhetsrettService = enabled
  ? new RegisterenhetsrettService(baseUrl, username, password, ctx)
  : null;
export const registerenhetsrettsandelService = enabled
  ? new RegisterenhetsrettsandelService(baseUrl, username, password, ctx)
  : null;
export const storeService = enabled
  ? new StoreService(baseUrl, username, password, ctx)
  : null;

export function grunnbokEnabled(): boolean {
  return hasCredentials();
}

export { grunnbokConfig };
