import "../loadEnv.ts";
process.env.LOG_SOAP = "1";
import { resolveBuildingData } from "../services/building-info-service/index.ts";

resolveBuildingData("Kapellveien 156C, 0493 Oslo")
  .then(r => console.log("\n✅ RESULT:", r.byggId, r.bruksarealM2 + "m²", r.byggeaar))
  .catch(e => console.error("❌", e.message));