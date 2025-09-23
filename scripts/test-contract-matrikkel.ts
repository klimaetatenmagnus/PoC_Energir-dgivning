import assert from "node:assert/strict";
import nock from "nock";

import { __testing as matrikkelTesting } from "../services/building-info-service/matrikkel.ts";
import { metricsRegistry } from "../services/building-info-service/metrics.ts";

async function main() {
  nock.disableNetConnect();

  try {
    metricsRegistry.resetMetrics();

    nock("https://ws.geonorge.no")
      .get("/adresser/v1/sok")
      .query({ sok: "Karl Johans gate 1", fuzzy: "true" })
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
      /Ingen adresse funnet/i
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
