import {
  Counter,
  Histogram,
  Registry,
  collectDefaultMetrics,
} from "prom-client";

type LookupResultLabel = "success" | "error";
type CacheStateLabel = "hit" | "miss";
type ExternalResultLabel = "success" | "error" | "not_found" | "cached";
type ResultAssemblerSourceLabel = "csv" | "enova" | "matrikkel" | "unknown";
type ResultAssemblerSolarLabel = "present" | "missing";

export const metricsRegistry = new Registry();

collectDefaultMetrics({
  register: metricsRegistry,
  prefix: "building_info_service_",
});

const lookupRequestsTotal = new Counter({
  name: "building_info_service_lookup_requests_total",
  help: "Antall oppslag i building-info-service sortert på resultat",
  labelNames: ["result"],
  registers: [metricsRegistry],
});

const lookupDurationSeconds = new Histogram({
  name: "building_info_service_lookup_duration_seconds",
  help: "Respons-tid for oppslag i building-info-service",
  labelNames: ["result"],
  buckets: [0.05, 0.1, 0.25, 0.5, 1, 2, 5, 10],
  registers: [metricsRegistry],
});

const cacheOperationsTotal = new Counter({
  name: "building_info_service_cache_operations_total",
  help: "Cache-treff og -bom for building-info-service",
  labelNames: ["state"],
  registers: [metricsRegistry],
});

const externalRequestsTotal = new Counter({
  name: "building_info_service_external_requests_total",
  help: "Antall eksterne kall fra building-info-service",
  labelNames: ["service", "operation", "result"],
  registers: [metricsRegistry],
});

const externalRequestDurationSeconds = new Histogram({
  name: "building_info_service_external_request_duration_seconds",
  help: "Varighet på eksterne kall fra building-info-service",
  labelNames: ["service", "operation", "result"],
  buckets: [0.05, 0.1, 0.25, 0.5, 1, 2, 5, 10],
  registers: [metricsRegistry],
});

const resultAssemblerBruksarealSourceTotal = new Counter({
  name: "building_info_service_resultassembler_bruksareal_source_total",
  help: "Kilde for bruksareal valgt av resultAssembler",
  labelNames: ["source"],
  registers: [metricsRegistry],
});

const resultAssemblerByggeaarSourceTotal = new Counter({
  name: "building_info_service_resultassembler_byggeaar_source_total",
  help: "Kilde for byggeår valgt av resultAssembler",
  labelNames: ["source"],
  registers: [metricsRegistry],
});

const resultAssemblerSolarPresenceTotal = new Counter({
  name: "building_info_service_resultassembler_solar_presence_total",
  help: "Tilgjengelighet av sol-data per resultat",
  labelNames: ["state"],
  registers: [metricsRegistry],
});

export function startLookupTimer() {
  const endTimer = lookupDurationSeconds.startTimer();
  return (result: LookupResultLabel) => {
    lookupRequestsTotal.inc({ result });
    endTimer({ result });
  };
}

export function recordCacheOperation(state: CacheStateLabel) {
  cacheOperationsTotal.inc({ state });
}

export function startExternalCall(
  service: string,
  operation: string
) {
  const endTimer = externalRequestDurationSeconds.startTimer({
    service,
    operation,
  });

  return (result: ExternalResultLabel) => {
    externalRequestsTotal.inc({ service, operation, result });
    endTimer({ result });
  };
}

export function recordBruksarealSource(source: ResultAssemblerSourceLabel) {
  resultAssemblerBruksarealSourceTotal.inc({ source });
}

export function recordByggeaarSource(source: ResultAssemblerSourceLabel) {
  resultAssemblerByggeaarSourceTotal.inc({ source });
}

export function recordSolarPresence(state: ResultAssemblerSolarLabel) {
  resultAssemblerSolarPresenceTotal.inc({ state });
}

export type {
  CacheStateLabel,
  ExternalResultLabel,
  LookupResultLabel,
  ResultAssemblerSolarLabel,
  ResultAssemblerSourceLabel,
};
