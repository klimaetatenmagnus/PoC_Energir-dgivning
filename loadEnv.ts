import { config } from "dotenv";
console.log("🔍 loadEnv.ts – before config:");
console.log("  PROD:", process.env.MATRIKKEL_API_BASE_URL_PROD);
console.log("  TEST:", process.env.MATRIKKEL_API_BASE_URL_TEST);

config({ path: new URL(".env", import.meta.url).pathname });

console.log("🔍 loadEnv.ts – after  config:");
console.log("  PROD:", process.env.MATRIKKEL_API_BASE_URL_PROD);
console.log("  TEST:", process.env.MATRIKKEL_API_BASE_URL_TEST);
