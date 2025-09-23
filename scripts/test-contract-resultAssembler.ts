import assert from "node:assert/strict";

import { assembleBuildingResult } from "../services/building-info-service/resultAssembler.ts";
import { metricsRegistry } from "../services/building-info-service/metrics.ts";
import { csvService } from "../src/services/csvService.ts";

const baseAdresse = {
  kommunenummer: "0301",
  gnr: 209,
  bnr: 10,
  adressekode: 12345,
  husnummer: 1,
  bokstav: "",
  adressetekst: "Karl Johans gate 1",
  poststed: "Oslo",
  postnummer: "0154",
};

const baseBygg = {
  id: 1001,
  bruksarealM2: 120,
  byggeaar: 1975,
  bygningstypeKodeId: 1,
  bygningstypeBeskrivelse: "Enebolig",
} as const;

const emptyCsvRecord = {
  bygningsNr: "",
  byggidAnonym: "",
  bruksarealTotalt: 0,
  braBolig: 0,
  braAnnetBolig: 0,
  braHentetFraMatrikkel: 0,
  arealByggflate: 0,
  antallEtasjer: 0,
  bygningsstatusNavn: "",
  bygningstype: "",
  bygningstypeNavn: "",
  bygningstype3siffer: "",
  tattIBrukDato: "",
  fylke: "",
  kommune: "",
  bydelnr: "",
  bydelsnavn: "",
  delbydelnr: "",
  delbydelsnavn: "",
  grunnkretsNr: "",
  grunnkretsNavn: "",
  lokalitetskode: "",
  gateAdresse: baseAdresse.adressetekst,
  kalenderaar: "",
  hjelpekolonne: "",
  tiaar: "",
};

function patchCsv(record: typeof emptyCsvRecord | null) {
  csvService.findByExactAddress = () => record;
  csvService.findByAddress = () => (record ? [record] : []);
  csvService.findByBygningsNr = () => record;
}

async function main() {
  const originalExact = csvService.findByExactAddress;
  const originalByAddress = csvService.findByAddress;
  const originalByNumber = csvService.findByBygningsNr;

  try {
    // CSV scenario
    metricsRegistry.resetMetrics();
    patchCsv({
      ...emptyCsvRecord,
      bygningsNr: "CSV-1",
      bruksarealTotalt: 200,
      bygningstype3siffer: "111",
      bygningstypeNavn: "Bolig",
      tattIBrukDato: "1990-01-01",
      bydelsnavn: "Sentrum",
      antallEtasjer: 3,
      bygningsstatusNavn: "I bruk",
    });

    const csvResult = assembleBuildingResult({
      adresse: baseAdresse,
      matrikkelenhetsId: 1,
      bygg: { ...baseBygg },
      allBygningsInfo: [{ ...baseBygg }],
      seksjonsnummer: null,
      seksjonForEnova: null,
      rpPBE: null,
      attest: null,
      solarData: {
        takAreal_m2: 50,
        sol_kwh_m2_yr: 900,
        sol_kwh_bygg_tot: 10000,
        solKategori: "A",
        takflater: [],
        filteredSolarEnergy: 2000,
      },
    });

    assert.equal(csvResult.bruksarealM2, 200);

    let metrics = await metricsRegistry.getMetricsAsJSON();
    let bruksarealSource = metrics
      .find(
        (metric) =>
          metric.name ===
          "building_info_service_resultassembler_bruksareal_source_total"
      )
      ?.values.find((sample) => sample.labels.source === "csv");
    assert.ok(bruksarealSource, "forventer bruksareal=csv metrikk");
    assert.equal(bruksarealSource.value, 1);

    let solarPresence = metrics
      .find(
        (metric) =>
          metric.name ===
          "building_info_service_resultassembler_solar_presence_total"
      )
      ?.values.find((sample) => sample.labels.state === "present");
    assert.ok(solarPresence, "forventer solar=present metrikk");
    assert.equal(solarPresence.value, 1);

    // Enova scenario (no CSV)
    metricsRegistry.resetMetrics();
    patchCsv(null);

    const enovaResult = assembleBuildingResult({
      adresse: baseAdresse,
      matrikkelenhetsId: 2,
      bygg: { ...baseBygg },
      allBygningsInfo: [{ ...baseBygg }],
      seksjonsnummer: null,
      seksjonForEnova: null,
      rpPBE: null,
      attest: {
        energikarakter: "B",
        oppvarmingskarakter: "G",
        enovaBuildingData: {
          bruksareal: 180,
          byggeaar: 2001,
          bygningstype: "Tomannsbolig",
          kategori: "Bolig",
        },
      },
      solarData: null,
    });

    assert.equal(enovaResult.bruksarealM2, 180);
    assert.equal(enovaResult.byggeaar, 2001);

    metrics = await metricsRegistry.getMetricsAsJSON();
    bruksarealSource = metrics
      .find(
        (metric) =>
          metric.name ===
          "building_info_service_resultassembler_bruksareal_source_total"
      )
      ?.values.find((sample) => sample.labels.source === "enova");
    assert.ok(bruksarealSource, "forventer bruksareal=enova metrikk");
    assert.equal(bruksarealSource.value, 1);

    let byggeaarSource = metrics
      .find(
        (metric) =>
          metric.name ===
          "building_info_service_resultassembler_byggeaar_source_total"
      )
      ?.values.find((sample) => sample.labels.source === "enova");
    assert.ok(byggeaarSource, "forventer byggeår=enova metrikk");
    assert.equal(byggeaarSource.value, 1);

    solarPresence = metrics
      .find(
        (metric) =>
          metric.name ===
          "building_info_service_resultassembler_solar_presence_total"
      )
      ?.values.find((sample) => sample.labels.state === "missing");
    assert.ok(solarPresence, "forventer solar=missing metrikk");
    assert.equal(solarPresence.value, 1);

    // Matrikkel fallback
    metricsRegistry.resetMetrics();
    patchCsv(null);

    const matrikkelResult = assembleBuildingResult({
      adresse: baseAdresse,
      matrikkelenhetsId: 3,
      bygg: { ...baseBygg, bruksarealM2: 90, byggeaar: 1965 },
      allBygningsInfo: [{ ...baseBygg, id: 1001, bruksarealM2: 90 }],
      seksjonsnummer: null,
      seksjonForEnova: null,
      rpPBE: null,
      attest: null,
      solarData: null,
    });

    assert.equal(matrikkelResult.bruksarealM2, 90);
    assert.equal(matrikkelResult.byggeaar, 1965);

    metrics = await metricsRegistry.getMetricsAsJSON();
    bruksarealSource = metrics
      .find(
        (metric) =>
          metric.name ===
          "building_info_service_resultassembler_bruksareal_source_total"
      )
      ?.values.find((sample) => sample.labels.source === "matrikkel");
    assert.ok(bruksarealSource, "forventer bruksareal=matrikkel metrikk");
    assert.equal(bruksarealSource.value, 1);

    byggeaarSource = metrics
      .find(
        (metric) =>
          metric.name ===
          "building_info_service_resultassembler_byggeaar_source_total"
      )
      ?.values.find((sample) => sample.labels.source === "matrikkel");
    assert.ok(byggeaarSource, "forventer byggeår=matrikkel metrikk");
    assert.equal(byggeaarSource.value, 1);

    console.log("✅ resultAssembler contract tests passed");
  } finally {
    csvService.findByExactAddress = originalExact;
    csvService.findByAddress = originalByAddress;
    csvService.findByBygningsNr = originalByNumber;
  }
}

main().catch((error) => {
  console.error("❌ resultAssembler contract tests failed");
  console.error(error);
  process.exit(1);
});
