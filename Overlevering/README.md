# Overlevering – adresseoppslag

Oppdatert: 2025-09-28 (refaktor runde 2)

## Hoveddokument
- `../Dokumentasjon/Utvikling/README.md` – samlet beskrivelse av building-info-service, dataflyt, konfigurasjon og testløp.

## Øvrige referanser
- `prometheus-metrikker.md` (under `Dokumentasjon/Utvikling/`) – observability-handover og forslag til dashboards/alerts.
- Denne mappen inneholder tilleggsmateriell:
  - `UI-prosess-dokumentasjon.md` – historikk fra Figma- og brukerreise-arbeidet.
  - `bygningstype-logikk-og-datakvalitet.md` – notater om byggvalg og datakvalitet.
  - `*.docx` (Argo CD, External Secrets, nettverk, observability m.m.) – referanser fra Marvin-plattformen.
- `deploy/marvin/` – eksempelmanifester (SecretStore/ExternalSecret, ConfigMap, Deployment, Service, ServiceMonitor, Argo CD Application/ApplicationSet) som GitOps-teamet kan bruke som utgangspunkt.
- **Python-runtime:** containeren forventer `python3` i PATH for `stotteordning_cache.py`. Hvis Marvin-miljøet mangler Python, legg til eget lag i Dockerfile eller en init-container. `PYTHON_BINARY` kan overstyres i env.
- **Røyktest:** kjør `docker build -t energiveiledning:local .` og `docker run --rm -p 14000:4000 -p 13001:3001 --env-file .env energiveiledning:local`. Verifiser `http://localhost:14000/health` og `http://localhost:13001/health` før leveranse.

## Kort om hook-arkitekturen
- `useFigmaAddressSearch` (`src/hooks/useFigmaAddressSearch.ts`) gir hele adresseoppslagsflyten til både Figma-modus og blokkomponenten. Den debouncer forslag mot `buildingApi.fetchSuggestions`, trigger faktiske oppslag via `lookupAddress` og tilbyr ferdige handler-funksjoner til UI-et.
- `useEnergyRatingEstimator` (`src/hooks/useEnergyRatingEstimator.ts`) kalkulerer energimerke lokalt, fyller inn Enova-attest-data automatisk og eksponerer simuleringslogikken (enkel å justere uten å touche UI-et).
- `useGulListeStatus` (`src/hooks/useGulListeStatus.ts`) kapsler gul liste-endepunktet og velger adresse vs. gnr/bnr-oppslag. Hooken håndterer loading/error og gir tilbake `refetch()` for oppdatering.
- Alle hookene følger samme logg-/feilhåndteringsstandard som resten av tjenesten. Ved videreutvikling bør nye regler samles i hookene slik at Figma, App og fremtidige integrasjoner deler samme logikk.

## Verify-rutinen (`npm run verify`)
- Kommandoen kjører `tsc --noEmit`, full `eslint` og kontrakttestene. Den skal alltid være grønn før leveranse til Marvin.
- Sørg for at `.env.local` (eller `DOTENV_CONFIG_PATH`) peker på et gyldig testmiljø før kjøring. Ved feil les loggen for å se hvilket delsteg som feilet, fiks avviket og kjør på nytt.
- Resultatet – også dersom verify feiler – skal føres i `Dokumentasjon/Utvikling/refaktor-oversikt.md` under statuslogg. Oppgi dato, klokkeslett og relevante funn.
- Full chain-test: `npm run test:full-chain` (evt. `npm run test:full-chain -- --mock`) starter alle tjenester via `scripts/test-full-chain.ts` og kjører standard adresseoppslag. `--mock` eller `SOLAR_SERVICE_MOCK=1` gjør at solkart-delen bruker stub i stedet for PBE-endepunktet. Kjør lokalt uten sandbox for at `localhost`-trafikken skal fungere, og forvent at prosessene stenges etter testen.
- Se hoveddokumentet for øvrige tester (`scripts/test-known-addresses.ts`, kontrakttester m.m.).

## Lesing av `.docx`
Konverter raskt fra terminal ved behov:
```bash
textutil -convert txt -stdout "Overlevering/<filnavn>.docx"
```
Arbeid på en kopi dersom du skal gjøre endringer; originalene er referansegrunnlag for deploy-teamet.

## Kontakt og ansvar
- Deployment/Marvin-teamet eier drift, observability og GitOps-oppsett.
- Produktteamet oppdaterer `Dokumentasjon/Utvikling/README.md` og `refaktor-oversikt.md` ved funksjonelle endringer.

Se hoveddokumentet for detaljer om adresseoppslag, konfig og tester.
