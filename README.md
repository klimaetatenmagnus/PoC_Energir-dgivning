# Energirådgivning – PoC

Monorepo for energirådgivnings-prototypen til Oslo kommune. Repoet inneholder bygg-/solar-tjenester (Node/TypeScript), støtteordningsscripts og React-frontend (Vite).

## Utvikling

- `npm install` – installerer avhengigheter.
- `npm run dev` – starter frontend, backend og solar-service lokalt (bruker `.env`).
- `npm run dev:local` – variant som bytter solar-service med subsidy-service.

Se `Dokumentasjon/Utvikling/refaktor-oversikt.md` for gjeldende refaktorplan og status.

## Verifisering

- `npm run verify` – kjører `tsc --noEmit`, `npm run lint` og kontraktstestene (`scripts/test-contract-*`). Kommandoen speiler GitHub Actions-workflowen `.github/workflows/verify.yml`.
- Lint-delen feiler fortsatt for enkelte legacy-filer; disse ryddes fortløpende i fase C/D (se refaktor-oversikten for plan/risiko).
- `npm run test:contract` kan kjøres separat dersom du ønsker kun kontrakttestene.

## Dokumentasjon

Alt Marvin- og refaktor-relatert underlag ligger i `Dokumentasjon/Utvikling/`. Viktige oppslag:

- `Dokumentasjon/Utvikling/refaktor-oversikt.md` – single source of truth for plan, status, testløp.
- `Dokumentasjon/Utvikling/prometheus-metrikker.md` – detaljert observability-handover (metrics, dashboards, alerts).
- Øvrige `.docx`/`.pdf`-filer beskriver GitOps, Argo CD, secrets og drift på Marvin-plattformen.
