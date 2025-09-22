import { getRuntimeConfig } from "./packages/config/src/runtime.ts";

// Calling getRuntimeConfig ensures that dotenv is initialised once and
// required environment variables are validated at startup.
getRuntimeConfig();
