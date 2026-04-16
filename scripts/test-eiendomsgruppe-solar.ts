/**
 * Verifiserer solar-data fra aggregeringen:
 *  1. Kjør aggregering for Oppsal Borettslag
 *  2. Plukk ett sample bygg fra resultatet
 *  3. Slå opp samme bygg via eksisterende fetchSolarData-pipeline
 *  4. Sammenlign at sol_kwh_bygg_tot og takAreal_m2 er identiske
 *
 * Kjøres med: (husk at solar-service må kjøres på port 4003)
 *   npm run dev:solar &
 *   API_ENV=prod LIVE=1 VITE_SOLAR_BASE=http://localhost:4003 \
 *     npx tsx scripts/test-eiendomsgruppe-solar.ts
 */
import { aggregateForBorettslag, clearEiendomsgruppeCache } from "../services/grunnbok-service/EiendomsgruppeService.ts";

const SOLAR_BASE = (
  process.env.SOLAR_SERVICE_BASE_URL ?? "http://localhost:4003"
).replace(/\/$/, "");

async function fetchSolarData(params: { byggId: number }) {
  const url = `${SOLAR_BASE}/solinnstraling?bygg_id=${params.byggId}`;
  const res = await fetch(url);
  if (!res.ok) return null;
  return (await res.json()) as {
    takAreal_m2?: number;
    sol_kwh_bygg_tot?: number;
    takflater?: Array<unknown>;
  };
}

async function main() {
  // Tøm cache så vi kjører friske oppslag
  clearEiendomsgruppeCache();

  console.log("=== Kjører aggregering for Oppsal Borettslag ===");
  const start = Date.now();
  const result = await aggregateForBorettslag("948544474");
  console.log(`Ferdig på ${((Date.now() - start) / 1000).toFixed(1)}s`);
  console.log(
    `Bygg: ${result.antallUnikeBygg}, med solar-data: ${result.antallByggMedSolarData}`
  );
  console.log(
    `Total solar-potensial: ${result.totalSolarPotensialKwhPerAar.toLocaleString("nb-NO")} kWh/år`
  );
  console.log(
    `Total takareal:        ${result.totalTakarealM2.toLocaleString("nb-NO")} m²`
  );

  // Finn et bygg som faktisk har solar-data for sanity-sjekk
  const sample = result.bygninger.find(
    (b) => b.solar && b.solar.sol_kwh_bygg_tot && b.solar.sol_kwh_bygg_tot > 0
  );
  if (!sample) {
    console.log("\n⚠️  Ingen bygg med solar-data å verifisere mot.");
    return;
  }

  console.log(`\n=== Verifiserer bygg ${sample.byggId} ===`);
  console.log(`Aggregering: takAreal=${sample.solar!.takAreal_m2} m², ` +
    `kWh/år=${sample.solar!.sol_kwh_bygg_tot}, ` +
    `takflater=${sample.solar!.antallTakflater}`);

  const direct = await fetchSolarData({ byggId: sample.byggId });
  if (!direct) {
    console.log("⚠️  fetchSolarData returnerte null direkte");
    return;
  }
  console.log(`Direkte:     takAreal=${direct.takAreal_m2} m², ` +
    `kWh/år=${direct.sol_kwh_bygg_tot}, ` +
    `takflater=${direct.takflater?.length ?? 0}`);

  const matchArea = direct.takAreal_m2 === sample.solar!.takAreal_m2;
  const matchKwh = direct.sol_kwh_bygg_tot === sample.solar!.sol_kwh_bygg_tot;
  const matchTakflater =
    (direct.takflater?.length ?? 0) === sample.solar!.antallTakflater;

  if (matchArea && matchKwh && matchTakflater) {
    console.log("\n✓ Solar-data matcher perfekt mellom aggregering og direkte oppslag");
  } else {
    console.log("\n✗ Mismatch:");
    if (!matchArea) console.log(`  takAreal: ${sample.solar!.takAreal_m2} vs ${direct.takAreal_m2}`);
    if (!matchKwh) console.log(`  kWh/år:   ${sample.solar!.sol_kwh_bygg_tot} vs ${direct.sol_kwh_bygg_tot}`);
    if (!matchTakflater) console.log(`  takflater: ${sample.solar!.antallTakflater} vs ${direct.takflater?.length ?? 0}`);
    process.exit(1);
  }

  // Topp 3 bygg med mest solar-potensial
  const topp = [...result.bygninger]
    .filter((b) => b.solar?.sol_kwh_bygg_tot)
    .sort((a, b) => (b.solar!.sol_kwh_bygg_tot ?? 0) - (a.solar!.sol_kwh_bygg_tot ?? 0))
    .slice(0, 3);
  console.log("\nTopp 3 bygg etter solar-potensial:");
  for (const b of topp) {
    console.log(
      `  byggId=${b.byggId} byggeår=${b.byggeaar} BRA=${b.bruksarealM2}m² ` +
      `→ ${b.solar!.sol_kwh_bygg_tot?.toLocaleString("nb-NO")} kWh/år ` +
      `på ${b.solar!.takAreal_m2}m² tak`
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
