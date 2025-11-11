# Plan for redeploy-fri redigering av tiltakskort

## 1. Bakgrunn og mål
- Tiltakskomponentene i `src/components/FigmaBlokk/components/Tiltak` inneholder i dag statiske tekster, fordeler, lenker og støtteordningshenvisninger. Enhver endring krever kodeendring og redeploy.
- Kjøremiljøet (ref. `Dokumentasjon/gcp-driftshandbok.md`) støtter allerede runtime-innhold via JSON-filer i GCS (`content/`). Målet er å bruke dette sporet fullt ut slik at redaktører kan oppdatere alle tiltak uten utvikler- eller deployløp.
- Løsningen skal kunne brukes av ikke-utviklere gjennom et enkelt admin-grensesnitt med tilgangskontroll.

## 2. Overordnede prinsipper
- **Single source of truth:** Alt tiltakinnhold (tekster, “les mer”-lenker, fordelsbokser, metadata) flyttes til strukturerte JSON-filer under `content/tiltak/` og synkroniseres til dedikerte GCS-bøtter (staging/prod).
- **Miljø-paritet:** Støtt separate bøtter for staging (`gs://energinokkelen-content`) og prod (`gs://energinokkelen-content-prod`), med klar merking i admin-verktøyet.
- **Validering før publisering:** JSON må valideres mot et skjema (Zod/Yup) i API-serveren for å hindre at ugyldig innhold havner i produksjon.
- **Versjonering og rollback:** Bruk GCS object versioning og logg endringer, slik at redaktører raskt kan gjenopprette tidligere versjoner.

## 3. Løsningsskisse
| Lag | Beskrivelse |
| --- | ----------- |
| **Innholdsmodell** | Ett JSON-dokument per tiltak med felter for tittelinformasjon, beskrivelse per bygningstype, fordelsliste, CTA-lenker, tilskuddsreferanser og illustrasjonsdata. |
| **Runtime-henting** | API-serveren eksponerer `/config/content/tiltak/<tiltak>.json` (allerde støttet). Frontend-hook erstatter hardkodet tekst med data fra endepunktet. |
| **Admin-grensesnitt** | Enkel React/Vite-app på egen Cloud Run-tjeneste (eller delt i eksisterende app bak `/admin`). Viser forhåndsvisning i vanlig tiltakslayout, men med redigerbare felter og publiserknapp. |
| **Lagring** | Admin-API (Cloud Run eller Cloud Functions) skriver til GCS via service account med `roles/storage.objectAdmin`. Publisering kan også trigge lett CDN-invalidator hvis frontend leser direkte fra bøtten. |

## 4. Data- og API-endringer
1. **Schema-definisjon:** Opprett `content/tiltak/schema.ts` med Zod-type. Foreslåtte felter:
   ```ts
   type TiltakContent = {
     id: string;
     title: string;
     introParagraphs: string[];
     buildingTypeParagraphs: Record<'enebolig' | 'rekkehus' | 'tomannsbolig' | 'blokk' | 'default', string>;
     benefits: { title: string; description: string }[];
     readMore: { label: string; url: string }[];
     supportTags: string[]; // brukes av støtteordnings-API for filtrering
     metadata?: { updatedBy: string; updatedAt: string };
   };
   ```
2. **API-server:** 
   - Legg til cache/validation-lag som laster JSON fra GCS og validerer mot schema før retur.
   - Gi mulighet til å lese ut kladd vs. publisert versjon (f.eks. `?draft=1`) dersom behov.
3. **Frontend:** 
   - Lag hook `useTiltakContent(tiltakId)` som bruker SWR/React Query mot `/config/content/tiltak/<id>.json`.
   - Tiltakskomponentene mottar data-objekt og rendrer tekster dynamisk; UI-logikk (tabs, grafer) forblir i kode.

## 5. Admin-grensesnitt (MVP-krav)
- **Autentisering:** Sikres med IAP (Google Workspace) eller Auth0; kun redaktørgruppen får tilgang.
- **Funksjoner:** 
  - Liste over tiltak med søk/filtrering og tydelig miljøvelger (staging/prod).
  - Skjemavisning + sanntids forhåndsvisning. Grunnleggende feltsjekk (påkrevd/URL-validering).
  - “Lagre kladd” (skriver til staging-bøtte) og “Publiser til prod” (kopierer fra staging → prod etter godkjenning).
  - Vis objekthistorikk (hent versjoner via GCS API) og knapp for rollback.
- **Teknologi:** Vite/React + Typescript. Backend API (Node/Express eller Cloud Run functions) håndterer GCS-skriving og validering for å holde credentials ute av klienten.

## 6. Tilgang, sikkerhet og logging
- Service account `content-admin@energiverktoy-poc-1234.iam.gserviceaccount.com` med begrenset tilgang til innholdsbøtter.
- IAP eller tilsvarende for å sikre UI. Audit-logg alle skriveoperasjoner (Cloud Logging + metadatafelt `updatedBy`).
- Mulig å sette opp Pub/Sub-notifikasjon når filer endres → Slack-alert for synlighet.

## 7. Migreringsplan
1. **Kartlegg innhold:** Inventer alle tiltakskomponenter og lag referansetabell over eksisterende tekster/lenker.
2. **Definer og dokumenter JSON-skjema + eksempel filer.**
3. **Bygg leselogikken:** Implementer `useTiltakContent` og validering i API-serveren bak feature flag (`ENABLE_DYNAMIC_TILTAK_CONTENT`).
4. **Migrer data:** Konverter eksisterende tiltak til JSON. Legg filene i staging-bøtten og test i sandbox.
5. **Utvikle admin-verktøyet** (basis CRUD + autentisering).
6. **Pilot i staging:** Gi redaktører tilgang, samle feedback. 
7. **Produksjonssetting:** Synk data til prod-bøtten, skru på feature flag, oppdater driftsdokumentasjon.
8. **Opprydding:** Fjern hardkodet tekst når alt er bekreftet og legg inn regressjonstester.

## 8. Estimert tidslinje (høytsvevende)
| Uke | Aktivitet |
| --- | --------- |
| Uke 1 | Skjema, backend-validering, hook og feature flag |
| Uke 2 | Datamigrering + refaktor av 2–3 tiltak (MVP) |
| Uke 3 | Admin-UI (autentisering, CRD) |
| Uke 4 | Kladd/publiser-workflow, historikk, staging-pilot |
| Uke 5 | Prodsetting, monitorering, dokumentasjon |

## 9. Åpne spørsmål og risiko
- Skal redaktører kunne opprette nye tiltak selv, eller kun redigere eksisterende?
- Behov for arbeidsflyt (kladd → godkjenning) utover enkel publiseringsknapp?
- Trenger vi oversettelsesstøtte/flerspråk fremover? I så fall må schemaet utvides før utrulling.
- CDN-cache: må invalidere `/_app/config/content/*` eller tilsvarende etter publisering hvis frontend ikke poller.

## 10. Videre arbeid
- Avklar åpne spørsmål med produkt/innholdsredaktører.
- Start implementasjon iht. migreringsplanen og oppdater `gcp-driftshandbok.md` med nye rutiner når løst.
