# Energirådgivning – PoC

Monorepo for energirådgivnings-prototypen til Oslo kommune. Repoet inneholder bygg-/solar-tjenester (Node/TypeScript), støtteordningsscripts og React-frontend (Vite).

## Utvikling

- `npm install` – installerer avhengigheter.
- `npm run dev` – starter frontend, backend og solar-service lokalt (bruker `.env`).
- `npm run dev:local` – variant som bytter solar-service med subsidy-service.

Se `Dokumentasjon/Utvikling/refaktor-oversikt.md` for gjeldende refaktorplan og status.

## Backend og konfigurasjon

- `services/building-info-service/` er delt i moduler: `context.ts` injiserer klienter og runtime-flagg, `matrikkel.ts` orchestrerer eksterne oppslag, mens `resultAssembler.ts` samler sluttresultatet. `index.ts` holder kun Express-skallet og eksponerer `/lookup`, `/metrics` og health-endepunktene.
- `packages/config` leverer typed runtime-konfigurasjon og erstatter tidligere `loadEnv.ts`. Modulen laster `.env.local`/`.env` i utvikling, men forventer at Marvin-miljøet injiserer variablene via External Secrets/Key Vault.
- Secrets logges aldri, og diagnoseflagg (`LIVE`, `LOG_SOAP`, `DEBUG_BUILDING_INFO`) er av som standard. Aktiver dem eksplisitt ved feilsøking.

## Verifisering

- `npm run verify` – kjører `tsc --noEmit`, `npm run lint` og kontraktstestene (`scripts/test-contract-*`). Kommandoen speiler GitHub Actions-workflowen `.github/workflows/verify.yml`.
- Lint-delen feiler fortsatt for enkelte legacy-filer; disse ryddes fortløpende i fase C/D (se refaktor-oversikten for plan/risiko).
- `npm run test:contract` kan kjøres separat dersom du ønsker kun kontrakttestene.

## Observability

- `building-info-service` eksponerer Prometheus-metrikker på `/metrics` (`building_info_service_*`). Se `Dokumentasjon/Utvikling/prometheus-metrikker.md` for komplette navn, labels og forslag til dashboards/alerts.
- Kontrakttestene validerer både Matrikkel-flyt og metrikker – kjør `npm run test:contract` ved endringer i klientene/resultAssembler for å sikre at timeouts, labels og kilderegistrering ikke regresserer.
- HTTP-/SOAP-logging styres via diagnoseflaggene; hold dem av i Marvin med mindre drift trenger ekstra innsikt.

## Dokumentasjon

Alt Marvin- og refaktor-relatert underlag ligger i `Dokumentasjon/Utvikling/`. Viktige oppslag:

- `Dokumentasjon/Utvikling/refaktor-oversikt.md` – single source of truth for plan, status, testløp.
- `Dokumentasjon/Utvikling/prometheus-metrikker.md` – detaljert observability-handover (metrics, dashboards, alerts).
- Øvrige `.docx`/`.pdf`-filer beskriver GitOps, Argo CD, secrets og drift på Marvin-plattformen.
