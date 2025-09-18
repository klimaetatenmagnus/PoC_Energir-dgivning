import { config } from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

console.log("🔍 loadEnv.ts – before config:");
console.log("  PROD:", process.env.MATRIKKEL_API_BASE_URL_PROD);
console.log("  TEST:", process.env.MATRIKKEL_API_BASE_URL_TEST);

// Fix for Windows paths
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const envPath = join(__dirname, ".env");

config({ path: envPath });

console.log("🔍 loadEnv.ts – after  config:");
console.log("  PROD:", process.env.MATRIKKEL_API_BASE_URL_PROD);
console.log("  TEST:", process.env.MATRIKKEL_API_BASE_URL_TEST);
console.log("  USERNAME:", process.env.MATRIKKEL_USERNAME ? "SET" : "NOT SET");
console.log("  PASSWORD:", process.env.MATRIKKEL_PASSWORD ? "SET" : "NOT SET");
