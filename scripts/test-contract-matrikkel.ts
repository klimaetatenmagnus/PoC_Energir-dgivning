import assert from "node:assert/strict";
import nock from "nock";

import { __testing as matrikkelTesting } from "../services/building-info-service/matrikkel.ts";
import { metricsRegistry } from "../services/building-info-service/metrics.ts";
import { isLookupNotFoundError } from "../services/building-info-service/lookupErrors.ts";

async function main() {
  nock.disableNetConnect();

  try {
    metricsRegistry.resetMetrics();

    nock("https://ws.geonorge.no")
      .get("/adresser/v1/sok")
      .query({ sok: "Karl Johans gate 1", fuzzy: "true", kommunenummer: "0301" })
      .reply(200, {
        adresser: [
          {
            kommunenummer: "0301",
            gardsnummer: 209,
            bruksnummer: 10,
            adressekode: 12345,
            nummer: "1",
            poststed: "Oslo",
            postnummer: "0154",
            adressetekst: "Karl Johans gate 1",
          },
        ],
      });

    const adresse = await matrikkelTesting.lookupAdresse("Karl Johans gate 1");
    assert.equal(adresse.kommunenummer, "0301");
    assert.equal(adresse.gnr, 209);
    assert.equal(adresse.bnr, 10);

    const metrics = await metricsRegistry.getMetricsAsJSON();
    const externalRequests = metrics.find(
      (metric) => metric.name === "building_info_service_external_requests_total"
    );
    assert(externalRequests, "forventer metric for eksterne kall");
    const geonorgeSuccess = externalRequests.values.find(
      (sample) =>
        sample.labels.service === "geonorge" &&
        sample.labels.operation === "lookup" &&
        sample.labels.result === "success"
    );
    assert(geonorgeSuccess, "forventer geonorge=success metrikk");
    assert.equal(geonorgeSuccess.value, 1);

    metricsRegistry.resetMetrics();
    nock.cleanAll();

    nock("https://ws.geonorge.no")
      .get("/adresser/v1/sok")
      .query(true)
      .times(7)
      .reply(200, { adresser: [] });

    await assert.rejects(
      () => matrikkelTesting.lookupAdresse("Ukjent adresse 123"),
      (error: unknown) => {
        assert(error instanceof Error);
        assert.match(error.message, /Ingen adresse funnet/i);
        // «Ikke funnet» skal kunne skilles fra driftsfeil (gir 404, ikke 500)
        assert(isLookupNotFoundError(error), "forventer LookupNotFoundError");
        assert.equal(error.reason, "address");
        return true;
      }
    );

    const notFoundMetrics = await metricsRegistry.getMetricsAsJSON();
    const geonorgeNotFound = notFoundMetrics
      .find(
        (metric) => metric.name === "building_info_service_external_requests_total"
      )
      ?.values.find(
        (sample) =>
          sample.labels.service === "geonorge" &&
          sample.labels.operation === "lookup" &&
          sample.labels.result === "not_found"
      );

    assert(geonorgeNotFound, "forventer geonorge=not_found metrikk");
    assert.equal(geonorgeNotFound.value, 1);

    // Samme gateadresse finnes i flere kommuner: oppslaget skal bruke Oslo-treffet,
    // også når en annen kommune står først i svaret.
    metricsRegistry.resetMetrics();
    nock.cleanAll();

    nock("https://ws.geonorge.no")
      .get("/adresser/v1/sok")
      .query({ sok: "Ivar Aasens vei 23A", fuzzy: "true", kommunenummer: "0301" })
      .reply(200, {
        adresser: [
          {
            kommunenummer: "3222",
            gardsnummer: 107,
            bruksnummer: 2852,
            adressekode: 2890,
            nummer: "23",
            bokstav: "A",
            poststed: "LØRENSKOG",
            postnummer: "1476",
            adressetekst: "Ivar Aasens vei 23A",
          },
          {
            kommunenummer: "0301",
            gardsnummer: 39,
            bruksnummer: 56,
            adressekode: 14200,
            nummer: "23",
            bokstav: "A",
            poststed: "OSLO",
            postnummer: "0373",
            adressetekst: "Ivar Aasens vei 23A",
          },
        ],
      });

    const osloAdresse = await matrikkelTesting.lookupAdresse("Ivar Aasens vei 23A");
    assert.equal(osloAdresse.kommunenummer, "0301");
    assert.equal(osloAdresse.gnr, 39);
    assert.equal(osloAdresse.bnr, 56);

    // Bare treff utenfor Oslo skal behandles som «ikke funnet»
    nock.cleanAll();

    nock("https://ws.geonorge.no")
      .get("/adresser/v1/sok")
      .query(true)
      .times(7)
      .reply(200, {
        adresser: [
          {
            kommunenummer: "1103",
            gardsnummer: 28,
            bruksnummer: 647,
            adressekode: 16500,
            nummer: "9",
            bokstav: "A",
            poststed: "STAVANGER",
            postnummer: "4021",
            adressetekst: "Neptunveien 9A",
          },
        ],
      });

    await assert.rejects(
      () => matrikkelTesting.lookupAdresse("Neptunveien 9A"),
      (error: unknown) => {
        assert(error instanceof Error);
        assert.match(error.message, /Ingen adresse funnet/i);
        assert(isLookupNotFoundError(error), "forventer LookupNotFoundError");
        return true;
      }
    );

    // Geonorge nede (503 på alle søk): vi vet ikke om adressen finnes, så
    // dette skal være en driftsfeil – ikke «ikke funnet».
    metricsRegistry.resetMetrics();
    nock.cleanAll();

    nock("https://ws.geonorge.no")
      .get("/adresser/v1/sok")
      .query(true)
      .times(7)
      .reply(503, "Service Unavailable");

    await assert.rejects(
      () => matrikkelTesting.lookupAdresse("Karl Johans gate 1"),
      (error: unknown) => {
        assert(error instanceof Error);
        assert.match(error.message, /Geonorge adressesøk feilet/);
        assert(!isLookupNotFoundError(error), "driftsfeil skal ikke være LookupNotFoundError");
        return true;
      }
    );

    const outageMetrics = await metricsRegistry.getMetricsAsJSON();
    const geonorgeSamples =
      outageMetrics.find(
        (metric) => metric.name === "building_info_service_external_requests_total"
      )?.values ?? [];
    const geonorgeError = geonorgeSamples.find(
      (sample) =>
        sample.labels.service === "geonorge" &&
        sample.labels.operation === "lookup" &&
        sample.labels.result === "error"
    );
    assert(geonorgeError, "forventer geonorge=error metrikk ved driftsfeil");
    assert.equal(geonorgeError.value, 1);
    assert(
      !geonorgeSamples.some(
        (sample) =>
          sample.labels.service === "geonorge" &&
          sample.labels.result === "not_found"
      ),
      "driftsfeil skal ikke telles som not_found"
    );

    console.log("✅ matrikkel contract tests passed");
  } finally {
    nock.cleanAll();
    nock.enableNetConnect();
  }
}

main().catch((error) => {
  console.error("❌ matrikkel contract tests failed");
  console.error(error);
  process.exit(1);
});
