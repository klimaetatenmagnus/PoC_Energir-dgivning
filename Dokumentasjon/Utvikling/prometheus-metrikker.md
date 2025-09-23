# Prometheus metrics for building-info-service

## Hensikt
- Gir UKE driftsteam oversikt over kva metrics som eksponeras av building-info-service i Marvin.
- Dokumenterer labels, namn og forventningar slik at ServiceMonitor, dashboards og alerts kan setjast opp utan detaljkunnskap om koden.

## Endpoint og port
- HTTP endpoint: `/metrics`
- Port: `PORT` (default 4000 i dev). Porten kjem fraa `packages/config/src/runtime.ts` og kan overridast via miljøvariabel.
- Ingen autentisering er bygd inn i applikasjonen. Sikring maa gjerast i Kubernetes (for eksempel via namespace policy eller ServiceMonitor-namespace).

## Metric families
Alle eigendefinerte metrics har prefiks `building_info_service_`. I tillegg samlast Prometheus sine standard process-/runtime-metrics inn via `collectDefaultMetrics`, som ogsaa faar same prefiks.

| Metric | Type | Labels | Beskrivelse |
| --- | --- | --- | --- |
| `building_info_service_lookup_requests_total` | Counter | `result` (`success`/`error`) | Telleverk for sluttstatus paa `/lookup` og `/address/:address` kall. |
| `building_info_service_lookup_duration_seconds` | Histogram | `result` | Responstid for oppslag i tjenesta. Same buckets i sekund: 0.05, 0.1, 0.25, 0.5, 1, 2, 5, 10. |
| `building_info_service_cache_operations_total` | Counter | `state` (`hit`/`miss`) | Cache-treff vs cache-bom i NodeCache-laget. |
| `building_info_service_external_requests_total` | Counter | `service`, `operation`, `result` (`success`/`error`/`not_found`/`cached`) | Kor mange eksterne kall som er gjort mot SOAP/REST bakendar. Sjaa lista under for moglege verdiar. |
| `building_info_service_external_request_duration_seconds` | Histogram | `service`, `operation`, `result` | Varighet paa same eksterne kall som ovanfor, med identiske buckets som lookup-histogrammet. |
| `building_info_service_resultassembler_bruksareal_source_total` | Counter | `source` (`csv`/`enova`/`matrikkel`/`unknown`) | Kva datakjelde som vann i samanstillinga av bruksareal. |
| `building_info_service_resultassembler_byggeaar_source_total` | Counter | `source` (`csv`/`enova`/`matrikkel`/`unknown`) | Kva datakjelde som vann i samanstillinga av byggeaar. |
| `building_info_service_resultassembler_solar_presence_total` | Counter | `state` (`present`/`missing`) | Om sol-data vart funne for resultatet. |

### Standard metrics (collectDefaultMetrics)
Desse kjem automatisk fra `prom-client` og faar prefiks `building_info_service_`, til dømes `building_info_service_process_cpu_user_seconds_total`, `..._process_resident_memory_bytes`, `..._nodejs_eventloop_lag_seconds`. UKE kan bruke dei til ressursmonitorering utan ekstra arbeid.

## Eksterne tenester og service-labels
Følgjande `service`-verdiar er i bruk i `building_info_service_external_*`-metrics:

- `geonorge` – REST-oppslag for adresser (operation `lookup`).
- `matrikkel` – SOAP `findMatrikkelenheter` (operation `findMatrikkelenheter`).
- `store-service` – SOAP `getObjectXml`, `getObject`, `getBruksenhet`.
- `bygning-service` – SOAP `findByggForMatrikkelenhet`.
- `bruksenhet-service` – SOAP `findBruksenheterForVegadresse`.
- `enova` – REST `Energiattest`-oppslag.
- `solar-service` – Intern solar proxy (`lookup`).

Labels `operation` speglar funksjonsnamn i koden og gjer det enklare aa filtrere i dashboards. `result` syner sluttstatus (`success`, `error`, `not_found`, `cached`).

## ServiceMonitor eksempel
`ServiceMonitor` under viser typisk oppsett i Marvin. Tilpass namespace, selector og scrape-interval etter behov. Portnamn maa samsvare med Kubernetes Service.

```yaml
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: building-info-service
  namespace: <namespace>
spec:
  selector:
    matchLabels:
      app: building-info-service
  namespaceSelector:
    matchNames:
      - <namespace>
  endpoints:
    - port: http
      path: /metrics
      interval: 30s
      scheme: http
      honorLabels: false
```

## Dashboard og alerts

### Dashboard-forslag
Grafana-instansen for teamet får eiga Prometheus-datakjelde per namespace (sjå `Om Grafana.pdf`). Ei anbefalt tavle kan delast i tre rader: tenestehelse, eksterne avhengnader og datakvalitet. Panela under kan opprettast som "Stat", "Time series" eller "Bar gauge" avhengig av kva som gjev best oversikt.

**Lookup og API-helse**

- `Lookup suksessrate (%)` – `100 * sum(rate(building_info_service_lookup_requests_total{result="success"}[5m])) / sum(rate(building_info_service_lookup_requests_total[5m]))` (Time series). Gir rask indikasjon på feilandel.
- `Lookup error rate` – `sum(rate(building_info_service_lookup_requests_total{result="error"}[5m]))` (Bar gauge eller Single stat). Kombiner med alerten under.
- `Lookup p95 latenstid (s)` – `histogram_quantile(0.95, sum(rate(building_info_service_lookup_duration_seconds_bucket[5m])) by (le))` (Time series). Overvaker sluttbrukaropplevinga.

**Eksterne avhengnader**

- `Feilrate per teneste (%)` – `100 * sum(rate(building_info_service_external_requests_total{result!="success"}[5m])) by (service) / sum(rate(building_info_service_external_requests_total[5m])) by (service)` (Bar gauge med `service` som serie). Avslører kva integrasjon som feilar.
- `p95 varigheit per teneste (s)` – `histogram_quantile(0.95, sum(rate(building_info_service_external_request_duration_seconds_bucket[5m])) by (service, le))` (Time series eller Table). Viser tregingar i eksterne kall.
- `Cache hit-rate (%)` – `100 * sum(rate(building_info_service_cache_operations_total{state="hit"}[5m])) / sum(rate(building_info_service_cache_operations_total[5m]))` (Stat). Bekreftar at cache fungerer.

**Datakvalitet**

- `Bruksareal-kjelder siste 24 t` – `sum(increase(building_info_service_resultassembler_bruksareal_source_total[24h])) by (source)` (Stacked bar). Viser kor data kjem frå.
- `Byggeår-kjelder siste 24 t` – `sum(increase(building_info_service_resultassembler_byggeaar_source_total[24h])) by (source)` (Stacked bar).
- `Sol-data dekning (%)` – `100 * sum(rate(building_info_service_resultassembler_solar_presence_total{state="present"}[1h])) / sum(rate(building_info_service_resultassembler_solar_presence_total[1h]))` (Stat). Varslar dersom sol-data fell bort.

Legg gjerne på ein dashboard-variabel `namespace` dersom fleire miljø deler instans, og filtrer panela med `namespace="$namespace"`.

### Alert-forslag
Alertane kan leggjast i ein `PrometheusRule` som GitOps-/driftsteamet eig i Marvin-repoet. Juster tersklar per miljø før produksjonssetting.

```yaml
apiVersion: monitoring.coreos.com/v1
kind: PrometheusRule
metadata:
  name: building-info-service
  namespace: <namespace>
spec:
  groups:
    - name: building-info-service.rules
      rules:
        - alert: BuildingInfoLookupErrorRateHigh
          expr: sum(rate(building_info_service_lookup_requests_total{result="error"}[10m])) /
                sum(rate(building_info_service_lookup_requests_total[10m])) > 0.05
          for: 10m
          labels:
            severity: warning
            team: <team>
          annotations:
            summary: "Building info lookup error-rate > 5 %"
            description: "Sjekk applikasjonslogg og eksterne avhengnader."
        - alert: BuildingInfoExternalDependencyFailures
          expr: sum(rate(building_info_service_external_requests_total{result!="success"}[10m])) by (service) /
                sum(rate(building_info_service_external_requests_total[10m])) by (service) > 0.10
          for: 5m
          labels:
            severity: warning
            team: <team>
          annotations:
            summary: "Ekstern avhengnad feilar for {{ $labels.service }}"
            description: "Feilrate over 10 % siste 10 minutt."
        - alert: BuildingInfoLookupLatencyHigh
          expr: histogram_quantile(0.95, sum(rate(building_info_service_lookup_duration_seconds_bucket[10m])) by (le)) > 2
          for: 10m
          labels:
            severity: critical
            team: <team>
          annotations:
            summary: "Lookup p95 er over 2 sekund"
            description: "Brukarar opplever tregt oppslag."
        - alert: BuildingInfoSolarCoverageDrop
          expr: sum(rate(building_info_service_resultassembler_solar_presence_total{state="present"}[30m])) /
                sum(rate(building_info_service_resultassembler_solar_presence_total[30m])) < 0.6
          for: 30m
          labels:
            severity: warning
            team: <team>
          annotations:
            summary: "Sol-data manglar for meir enn 40 % av svar"
            description: "Undersøk solar-service eller PBE Solkart."
```

Driftsteamet bør knyte alertane mot eigne contact points i Grafana (ref. `Om Grafana.pdf`) og legge til miljø-/namespace-labelar som passar. Når ServiceMonitor er på plass bør reglane og dashboarda sjekkes inn i GitOps-repoet slik at observability-konfigurasjonen er sporbar.

## Testar og validering
- `npm run test:contract` kjorer to kontrakttestar:
  - `scripts/test-contract-matrikkel.ts` mocker Geonorge og sjekkar at metrics syner `success`/`not_found`.
  - `scripts/test-contract-resultAssembler.ts` simulerer ulike datakjelder og verifiserer `bruksareal_source`, `byggeaar_source` og `solar_presence`.
- Kjør testane lokalt før du endrar metric-namn eller labels slik at kontraktane oppdaterast samtidig.

## Vedlikehald
1. Oppdater tabellen over dersom nye metrics kjem til eller labels endrar seg.
2. Ver sikker paa at `npm run test:contract` og `npx tsc --noEmit` er gronne etter endringane.
3. Juster `ServiceMonitor`-snutt i dette dokumentet dersom port eller path endrast.
4. Loggfør strukturendringar i `refaktor-oversikt.md` slik at historikken er synleg.
