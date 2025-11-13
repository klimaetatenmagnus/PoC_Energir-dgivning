# Plan for redeploy-fri redigering av tiltakskort

## 1. Bakgrunn og mål
- Tiltakskomponentene i `src/components/FigmaBlokk/components/Tiltak` inneholder i dag statiske tekster, fordeler, lenker og støtteordningshenvisninger. Enhver endring krever kodeendring og redeploy.
- Kjøremiljøet (ref. `Dokumentasjon/gcp-driftshandbok.md`) støtter allerede runtime-innhold via JSON-filer i GCS (`content/`). Målet er å bruke dette sporet fullt ut slik at redaktører kan oppdatere alle tiltak uten utvikler- eller deployløp.
- Løsningen skal kunne brukes av ikke-utviklere gjennom et enkelt admin-grensesnitt med tilgangskontroll.
- For all beskrivelse av dagens kjøremiljø, driftsrutiner og GCP-ressurser skal `Dokumentasjon/gcp-driftshandbok.md` konsulteres parallelt med denne planen; oppdateringer her må speiles der og omvendt.

## 2. Overordnede prinsipper
- **Single source of truth:** Alt tiltakinnhold (tekster, “les mer”-lenker, fordelsbokser, metadata) flyttes til strukturerte JSON-filer under `content/tiltak/` og synkroniseres til dedikerte GCS-bøtter (staging/prod).
- **Miljø-paritet:** Støtt separate bøtter for staging (`gs://energinokkelen-content`) og prod (`gs://energinokkelen-content-prod`), med klar merking i admin-verktøyet.
- **Validering før publisering:** JSON må valideres mot et skjema (Zod/Yup) i API-serveren for å hindre at ugyldig innhold havner i produksjon.
- **Versjonering og rollback:** Bruk GCS object versioning og logg endringer, slik at redaktører raskt kan gjenopprette tidligere versjoner.

## 3. Løsningsskisse
| Lag | Beskrivelse |
| --- | ----------- |
| **Tiltaks- og tilskuddsmodell** | Ett JSON-dokument per tiltak og per tilskuddsordning. Tiltak inneholder titler, beskrivelser per bygningstype, fordeler, CTA-lenker, illustrasjon og en referanseliste til relevante tilskudd. Tilskuddsdokumenter beskriver ordningstype, satser, kriterier, gyldighet, lenker til søknadssider og hvilke tiltak/bygningstyper de gjelder for. |
| **Runtime-henting** | API-serveren eksponerer `/config/content/tiltak/<tiltak>.json` og `/config/content/tilskudd/<ordning>.json`. I tillegg leveres et indeksendepunkt slik at frontend kan liste alle tiltak/tilskudd dynamisk. Frontenden bruker hooks (SWR/React Query) og fallback-cache så UI alltid rendrer mot den nyeste publiserte versjonen. |
| **Admin-grensesnitt** | Dedikert React/Vite-app på egen Cloud Run-tjeneste (`energinokkelen-admin`). Har to hovedseksjoner: Tiltak og Tilskudd. Hver seksjon støtter CRUD, forhåndsvisning og relasjonsstyring (knytte tiltak ↔ tilskudd). Miljøvelger skiller tydelig mellom staging og prod. |
| **Lagring** | Admin-API i Cloud Run skriver til GCS via service account med `roles/storage.objectAdmin`. Kladd lagres i staging-bøtten og publisering kopierer fil(er) til prod-bøtten. Hver operasjon logger metadata (hvem/hva/når) og kan trigge CDN-invalidator dersom frontend henter innhold direkte fra bøtten. |

## 4. Data- og API-endringer
1. **Schema-definisjon:** Opprett `content/tiltak/schema.ts` og `content/tilskudd/schema.ts` med Zod-typer som dekker både eksisterende og nye elementer. Eksempel (forkortet):
   ```ts
   type TiltakContent = {
     id: string; // slug brukes som filnavn
     title: string;
     introParagraphs: string[];
     buildingTypeParagraphs: Record<TillatBygningstype, string>;
     benefits: { title: string; description: string }[];
     readMore: { label: string; url: string }[];
     grants: string[]; // refererer til tilskudds-id’er
     media?: { illustration: string; alt: string };
     metadata: { status: 'draft' | 'published'; updatedBy: string; updatedAt: string };
   };

   type TilskuddContent = {
     id: string;
     title: string;
     description: string;
     amountType: 'beløp' | 'prosent' | 'varierer';
     amountValue?: number;
     eligibility: string[];
     buildingTypes: TillatBygningstype[];
     appliesTo: string[]; // tiltak-id’er denne støtter
     applicationUrl: string;
     contact?: string;
     metadata: { status: 'draft' | 'published'; validFrom?: string; validTo?: string; updatedBy: string; updatedAt: string };
   };
   ```
   Skjemaene skal støtte at redaktører kan opprette helt nye tiltak/tilskudd eller arkivere eksisterende uten utviklerinvolvering.
- ✅ (2025-11-14) Schemaene er utvidet med `tabs[].buildingTypeBody`, `accordion[].glossary` og variant-spesifikke `grants`/`supportTags`, slik at tiltak kan modellere byggtypeavhengige faner, ordforklaringer og egne støttepakker for f.eks. gul liste.
2. **API-server:** 
   - ✅ (2025-11-12) Cache-/valideringslag er nå aktivert for alle `tiltak/*` og `tilskudd/*`-filer. Filer med `schemaVersion` valideres med Zod før retur, upubliserte dokumenter blokkeres i prod, og ugyldige filer svarer med `422` + logg av avvik.
   - ✅ (2025-11-12) `/config/content/tiltak/index.json` og `/config/content/tilskudd/index.json` genereres on-demand basert på validerte filer og reflekterer draft-filteret samt antall elementer som hoppes over (legacy, ugyldige, upubliserte).
   - ✅ (2025-11-12) `?draft=1` flagget kan brukes på både enkeltfiler og kataloger for å se kladder uten å eksponere dem for publikum.
   - ✅ (2025-11-12) `ETag`/`If-None-Match`-headere er nå på plass for både katalog- og enkeltfilendepunkter under `/config/content/**`, med versjonsstøtte basert på GCS generation/fil-mtime.
3. **Frontend:** 
  - ✅ (2025-11-12) SWR-baserte hooks (`useTiltakContent`, `useTilskuddContent`, `useTiltakCatalog`) henter `/config/content/**` med ETag/`If-None-Match` og eksponerer etag-versjoner til admin-klienten.
  - ✅ (2025-11-13) `EtterisoleringYttervegg` bruker nå `useTilskuddBatch` + tiltakets `grants`-felt til å bygge støtteordningstabellen direkte fra `content/tilskudd/enova-etterisolering.json` og `content/tilskudd/klimaoslo-fasadefond.json`, med legacy-API som reserve.
  - ✅ (2025-11-13) `IsoleringAvKjellerOgLoft` er koblet til `content/tiltak/etterisolering-kjeller-loft.json` slik at intro- og bygningstype-tekst kan endres redeploy-fritt (tilskuddet `enova-etterisolering-loft-kjeller` ligger som kladd).
  - ✅ (2025-11-13) `Solenergi` leser nå tittel, intro/bygningstekster, fordeler og “Les mer”-lenker fra `content/tiltak/solenergi.json` og bruker `grants` (`klimaoslo-solenergitilskudd`, `enova-solcelleanlegg`) via `useGrantAwareStotteordninger`.
  - ✅ (2025-11-13) `Varmepumpe` er refaktorert til å bruke tabs/innhold fra `content/tiltak/varmepumpe.json` og henter tilskudd fra `content/tilskudd/klimaoslo-vaeske-til-vann-varmepumpe.json` og `content/tilskudd/klimaoslo-varmepumpebereder.json`.
  - ✅ (2025-11-13) `useGrantAwareStotteordninger` erstatter manuelle `useTilskuddBatch`-kall og sørger for automatisk fallback til `useStotteordninger` bare når `grants` mangler eller feiler.
  - ✅ (2025-11-14) `Tetting` og `Ventilasjon` henter nå alt innhold via `useTiltakContent`, variantlogikk via `applyTiltakVariant` og støtteordninger via `useGrantAwareStotteordninger`, slik at både standard- og gul liste-data lever fra JSON.
  - ✅ (2025-11-15) `Temperaturstyring` (inkl. gul liste) bruker `content/tiltak/temperaturstyring.json`, `useTiltakContent`, `applyTiltakVariant` og `useGrantAwareStotteordninger` med nye tilskudd (`klimaoslo-smart-energistyring`, `klimaoslo-pris-effektstyring`). Legacy-komponenten og gule varianten er fjernet.
  - ✅ (2025-11-15) Alle gjenværende tiltaks-komponenter – inkludert `UtskiftningAvVindu` og samtlige `GulListeTiltak/*`-wrappere – henter nå innhold fra `content/tiltak/*.json` via `useTiltakContent`/`applyTiltakVariant`, slik at legacy-API-et kun brukes som nød-fallback i `useGrantAwareStotteordninger`.

## 5. Admin-grensesnitt (MVP-krav)
- **Autentisering:** Sikres med IAP og Google Workspace-gruppen `energinokkelredaktor@klimaoslo.no`. Andre brukere møter 403.
- **Funksjoner:** 
  - Dashbord med miljøvelger (staging/prod) og to faner: Tiltak og Tilskudd. Begge støtter søk, filtrering og statusvisning (kladd/publisert/arkivert).
  - Skjemavisning med sanntidsforhåndsvisning av tiltakskort/tilskuddskort. Felter har constraints (påkrevd, URL, dato, beløp) og relasjonsvalg (tiltak ↔ tilskudd).
  - CRUD: opprette nye tiltak/tilskudd, duplisere eksisterende, arkivere eller gjenåpne elementer. Sletting skjer som “arkivert” for audit.
  - Kladd/publiser-flyt: “Lagre kladd” skriver til staging-bøtten. “Publiser til prod” kopierer validerte JSON-filer fra staging → prod og oppdaterer katalogendepunkt.
  - Historikkpanel henter GCS object versions og tilbyr “rollback til valgt versjon” direkte i UI.
  - Varsling: Etter publisering kan appen POST’e til Slack-webhook for synlighet (valgfritt).
- **Teknologi:** Vite/React + Typescript. Admin-API (Node/Express på Cloud Run) skjuler GCS credentials, kjører Zod-validering og håndterer publiseringsflyt.

## 6. Arkitektur og komponenter
- **Admin-frontend (Cloud Run):** `energinokkelen-admin` og `energinokkelen-admin-prod` serverer React-appen med Vite-build. Ingress settes til “internal-and-cloud-load-balancing” slik at all trafikk må via HTTPS-load balanceren og IAP.
- **Admin-API (Cloud Run/BFF):** Node/Express-app som lever i samme repo og deployes sammen med admin-frontend. API-et håndterer autentiserte skriveoperasjoner mot GCS, kjører Zod-validering og oppdaterer katalogfiler.
- **Content buckets:** `gs://energinokkelen-content` (staging) og `gs://energinokkelen-content-prod` (prod) inneholder mapper for tiltak, tilskudd og katalogfiler. Object versioning og metadata muliggjør rollback, audit og publiseringsdetaljer.
- **Publiseringsjobb:** En Cloud Run job/Cloud Function trigges når en publisering skjer. Den kopierer godkjente JSON-filer fra staging til prod, regenererer indeksfiler og kaller Cloud CDN-invalidator (`/*config/content*`).
- **Runtime-klienter:** Hoved-frontend og admin preview bruker API-serverens `/config/content/...`-endepunkter. Feature flag og etag-basert caching sikrer at endringer kan tester i staging før de sendes videre.

## 7. Integrasjon med eksisterende Google Cloud-miljø
1. **Cloud Run-deploy:** Når admin-appen er klar, deploy `energinokkelen-admin` og `energinokkelen-admin-prod` fra Artifact Registry. Sett miljøvariabler for bucket-navn, API-base, Slack webhook osv.
2. **Serverless NEGs:** Opprett `staging-admin-neg` og `prod-admin-neg` (type Cloud Run). Disse peker til respektive tjenester og brukes videre i load balanceren.
3. **Backend services:** Lag `staging-admin-backend` og `prod-admin-backend` (HTTP, serverless). Koble de nye NEGs inn, aktiver logging og definer en health check (`/health`).
4. **URL map/routing:** I eksisterende HTTPS load balancer legges path rules (`/admin`, `/admin/*`). Trafikk mot staging-host peker til `staging-admin-backend`, prod-host mot `prod-admin-backend`.
5. **IAP:** Aktiver IAP på begge backendene ved å bruke eksisterende OAuth-klient (`Energinokkelen-IAP`). Legg til `group:energinokkelredaktor@klimaoslo.no` som `roles/iap.httpsResourceAccessor`. Test innlogging i staging før prod.
6. **IAM-rydding:** Når IAP fungerer, fjern `allUsers`/`allAuthenticatedUsers` fra begge Cloud Run-tjenestene. Servicekontoen får kun nødvendige roller (Storage Object Admin på content-bøttene, Secret Manager accessor).
7. **Observability:** Eksponer `/metrics` fra admin-API (prometheus-format) og legg tjenestene inn i eksisterende dashboard. Publiseringshendelser logges til Cloud Logging + Slack for revisjon.

## 8. Tilgang, sikkerhet og logging
- Service account `content-admin@energiverktoy-poc-1234.iam.gserviceaccount.com` brukes av admin-API og begrenses til Storage + Secret Manager.
- IAP er den eneste autentiseringsmekanismen foran admin-pathene. Workspace-gruppen `energinokkelredaktor@klimaoslo.no` håndterer hvem som kan logge inn.
- Audit: Admin-API legger `updatedBy`, `updatedAt`, `changeSummary` inn i metadatafeltet på hvert JSON-objekt. Cloud Logging + GCS object versioning gir ytterligere revisjon.
- Hendelser: Pub/Sub-notifikasjoner trigges på `content/tiltak/*` og `content/tilskudd/*` slik at Slack-kanalen #energinøkkelen-monitor får beskjed om publiseringer eller rollbacks.

## 9. Migreringsplan
1. **Kartlegg alt innhold:** Dokumenter alle eksisterende tiltak og tilskuddsordninger, inkludert relasjoner og manglende datafelt. Status og funn oppdateres fortløpende i `Dokumentasjon/Utvikling/tiltak-tilskudd-kartlegging.md` slik at nye utviklere raskt får oversikt.
2. **Definer og dokumenter schema + eksempeldata:** Lag JSON-schema/Zod for både tiltak og tilskudd, samt referansefiler i `content/examples/`.
3. **Bygg runtime-lesing:** Implementer `useTiltakContent`, `useTilskuddContent`, katalogendepunkt og valideringslag i API-serveren bak feature-flag.
4. **Migrer eksisterende data:** Konverter dagens hardkodede tiltak og tilskudd til JSON og legg dem i staging-bøtten. Sammenlign UI før/etter. ✅ Pilot (tiltak `etterisolering-yttervegg` + tilskudd `enova-etterisolering`) er ferdig og brukes i frontenden.
5. **Utvikle admin-appen lokalt:** Frontend (Vite) + BFF/Cloud Run API med full CRUD, forhåndsvisning og staging/prod-valg.
6. **Sett opp GCP-infrastruktur:** Deploy admin-Cloud-Run-tjenester, opprett NEGs, backend services, URL-map-regler og aktiver IAP med Workspace-gruppen.
7. **Pilot i staging:** Gi redaktører tilgang, la dem teste CRUD, publisering og rollback. Samle feedback og måle loggene.
8. **Produksjonssetting:** Synk godkjente JSON-filer til prod-bøtten, aktiver feature flag i frontend/API og oppdater driftsdokumentasjon.
9. **Opprydding:** Fjern hardkodet innhold, legg til regresjonstester og automatiske varsler når publisering feiler.

## 10. Utviklingsplan og tidslinje
| Uke | Aktivitet |
| --- | --------- |
| Uke 1 | Kartlegging av tiltak/tilskudd, Zod-schema, API-validering og katalogendepunkt bak feature flag |
| Uke 2 | Datamigrering til JSON (staging), bygg av hooks i frontend og verifikasjon på 2–3 tiltak/tilskudd |
| Uke 2–3 | Etabler felles Tiltak-UI (delt layoutkomponent for SVG/stil, fordelsbokser, “Les mer”, støtteordninger/accordion) slik at hver tiltakfil kun håndterer innholdsdata fra JSON og variantlogikk |
| Uke 3 | Lokal utvikling av admin-frontend + BFF (liste, skjema, forhåndsvisning, relasjoner) |
| Uke 4 | Deploy til Cloud Run, sett opp NEGs/backend services, aktiver IAP og gjennomfør staging-pilot |
| Uke 5 | Prodsetting, monitorering, dokumentasjon og opprydding av legacy-innhold |

**Status 2025-11-12:** Uke‑1 leveranser for kartlegging og Zod-skjema er gjennomført (se aktivitetslogg). Neste aktiviteter følger listen under.

## 11. Aktivitetslogg
| Dato | Aktivitet | Utført av |
| ---- | --------- | --------- |
| 2025-11-12 | Planen utvidet til å dekke tilskudd, CRUD-krav og admin-arkitektur | Codex |
| 2025-11-12 | Workspace-gruppen `energinokkelredaktor@klimaoslo.no` opprettet og fylt med redaktører | Magnus Lundstein |
| 2025-11-12 | Zod-skjema for tiltak og tilskudd etablert + eksempeldata lagt i `content/examples/*` | Codex |
| 2025-11-12 | API-serveren validerer nå `/config/content/**`, håndterer `?draft=1` og eksponerer dynamiske kataloger for tiltak/tilskudd | Codex |
| 2025-11-12 | `useTiltakContent`/`useTilskuddContent`/`useTiltakCatalog` implementert + første tiltak/tilskudd migrert (etterisolering ↔ enova) | Codex |
| 2025-11-13 | `useTilskuddBatch` lansert, støtteordninger leses nå fra `content/tilskudd/*.json`, og tiltaket `etterisolering-kjeller-loft` ligger som redeploy-fri JSON | Codex |
| 2025-11-13 | `Solenergi` og `Varmepumpe` er migrert til runtime-content og nye tilskuddsfiler (`klimaoslo-solenergitilskudd`, `enova-solcelleanlegg`, `klimaoslo-vaeske-til-vann-varmepumpe`, `klimaoslo-varmepumpebereder`) via `useGrantAwareStotteordninger` | Codex |
| 2025-11-14 | Lagt til `content/tiltak/{tetting,ventilasjon,vinduer}.json` inkl. gul-listevarianter og opprettet nye støttefiler (`klimaoslo-oppgradering-bygningskropp`, `klimaoslo-energitiltak-borettslag`, `klimaoslo-energikartlegging-borettslag`, `klimaoslo-balansert-ventilasjon`, `klimaoslo-vinduer-dorer`, `enova-energiradgivning`, `byantikvaren-istandsetting`) som grunnlag for videre frontend-migrering | Codex |
| 2025-11-14 | Tetting- og Ventilasjon-komponentene er refaktorert til `useTiltakContent` + `useGrantAwareStotteordninger`, med delt variant-/glossary-helper og gul liste-variant via `audience` | Codex |
| 2025-11-14 | Dokumentert filstruktur, helperbruk og migreringsløp i seksjon 14 slik at nye utviklere raskt kan fortsette arbeidet uten å reverse-engineere repoet | Codex |
| 2025-11-15 | `UtskiftningAvVindu` (standard + gul liste) henter nå alt innhold fra `content/tiltak/vinduer.json` via `useTiltakContent`/`useGrantAwareStotteordninger`, deler komponent på `audience`, og gamle hardkodede tabs/lenker/støtteordningstabeller er fjernet | Codex |
| 2025-11-15 | Solenergi, Varmepumpe, Etterisolering av yttervegg og Isolering av kjeller/loft er migrert til felles `*ContentComponent` med `audience`-varianter, oppdaterte JSON-filer (inkl. gul-listeinnhold) og `GulListeTiltak/*`-wrapperne er redusert til rene delegater | Codex |
| 2025-11-15 | Temperaturstyring (standard + gul liste) er koblet til `content/tiltak/temperaturstyring.json`, gjenbruker felles `TemperaturstyringContentComponent`, og nye støttefiler (`klimaoslo-smart-energistyring`, `klimaoslo-pris-effektstyring`) er lagt til | Codex |
| 2025-11-15 | TypeScript-feil i Ventilasjon, EtterisoleringYttervegg og glossary-helperen er rettet; `npm run typecheck` er grønn igjen | Codex |

## 12. Åpne spørsmål og risiko
- Trenger vi mer avansert arbeidsflyt (kladd → godkjenning → publisering) eller holder totrinns staging/prod?
- Skal admin-appen støtte oversettelser eller flere språk i nær fremtid?
- Hvor raskt må CDN/edge-cache invalidere etter publisering for å møte SLA?
- Hvordan håndteres tilgang til tilskuddsdata dersom andre team vil gjenbruke API-et?

## 13. Neste steg
- Verifiser at staging-bøtten for runtime-innhold (`gs://energinokkelen-content`) finnes. Hvis ikke, opprett den i `europe-north1` med versjonering (`gcloud storage buckets create gs://energinokkelen-content --location=europe-north1 --uniform-bucket-level-access --enable-object-versioning`) før du synker filer.
- Synk `content/tiltak/temperaturstyring.json` og tilknyttede tilskuddsfiler (`klimaoslo-smart-energistyring`, `klimaoslo-pris-effektstyring`) til `gs://energinokkelen-content`, og verifiser via `/config/content/tiltak/temperaturstyring.json?draft=1` før prod-publisering.
- Gjennomfør ende-til-ende testing av admin-UI og dynamiske tiltak/tilskudd i staging (redaktørflyt, forhåndsvisning, publisering) og dokumenter resultatene før funksjonen åpnes i prod.
- Etabler dokumentert og automatisert rutine for variant-/gul-listeinnhold (metadataflyt, schema-validering, skript for staging→prod-synk og auditlogging av endringer).
- Videreutvikle admin-frontend + BFF (listevisning, CRUD med relasjonsvelger, forhåndsvisning via `draft=1`, audit/logging) og planlegg bygg/deploy til Cloud Run bak IAP.
- Operationaliser publiseringsløpet: `gsutil rsync`-skript per miljø, sjekklister for metadata og driftslogg, samt automatisert CDN-invalidasjon for `/config/content/**`.
- Beskriv hvordan legacy-støtteordningskilden kan fases helt ut når alle `grants` er på plass, inkl. fallback-metrikk og alerting når legacy-data brukes.

✅ (2025-11-15) TypeScript-feilene i Ventilasjon, EtterisoleringYttervegg og glossary-helperen er ryddet, så `npm run typecheck` kjører uten feil igjen.

## 14. Filstruktur og helperbibliotek for tiltak og støtteordninger

### 14.1 Katalogoppsett
- `content/tiltak/*.json`: Ett dokument per tiltak (f.eks. `content/tiltak/vinduer.json`, `content/tiltak/tetting.json`). Filnavn speiler slug og samsvarer med `id`-feltet.
- `content/tilskudd/*.json`: Ett dokument per støtteordning (`content/tilskudd/klimaoslo-oppgradering-bygningskropp.json`, osv.). `grants`-feltene i tiltak peker hit.
- `content/examples/*.json`: Referansefiler som viser hele schemaet for tiltak/tilskudd og brukes som mal ved nye migreringer.
- `content/schema-helpers.ts`: Felles typer (`ContentAudience`, `MetadataSchema`, `BuildingTypeKeySchema` m.m.) som både tiltak- og tilskuddsskjemaene importerer.
- `content/tiltak/schema.ts` og `content/tilskudd/schema.ts`: Zod-skjemaene som definerer alle felter, `schemaVersion` og variantstøtte.
- Alle filer synkes til `gs://energinokkelen-content` (staging) og `gs://energinokkelen-content-prod` (prod) før de tas i bruk i miljøene, jf. `Dokumentasjon/gcp-driftshandbok.md`.
- `src/hooks/contentHooks.ts`: SWR-baserte hooks (`useTiltakContent`, `useTilskuddContent`, `useTilskuddBatch`, `useTiltakCatalog`) som henter `/config/content/**` med ETag/cache og håndterer `?draft=1`.
- `src/utils/tiltakContent.ts`: `applyTiltakVariant`, `normaliseBuildingTypeKey` og `getBuildingParagraphs` holder variantlogikk og byggtypeoppslag samlet.
- `src/components/FigmaBlokk/components/Tiltak/`: Alle tiltakskomponenter, `GulListeTiltak/`-wrapperne, `glossaryHelpers.tsx`, `useGrantAwareStotteordninger.ts` og `shared.ts`.
- `src/services/stotteordning-service.ts`: Legacy-kilde for støtteordninger. `useGrantAwareStotteordninger` faller tilbake hit kun når `grants` mangler eller feiler.
- `src/api-server.ts`: Eksponerer `/config/content/{tiltak,tilskudd}/<slug>.json` og indeksendepunktene. All validering går gjennom `loadContentDocument` som bruker Zod-skjemaene og stopper upubliserte filer i prod.

### 14.2 Skjemaer og validering
- **Tiltak** (`TiltakContentSchema`): Krever `introParagraphs`, `buildingTypeParagraphs` (må alltid ha `default`), `benefits`, `readMore`, `callsToAction`, `tabs`, `accordion`, `stats`, `media`, `grants`, `supportTags`, `audiences` og `metadata`. `variants[]` beskriver overrides per `audience` (nå `standard` og `gulliste`) og kan endre tekst, tabs, accordion, `grants` osv. Alle tekster ligger som arrays slik at admin-verktøyet kan vise hvert avsnitt separat.
- **Tilskudd** (`TilskuddContentSchema`): Dekker `provider`, `funding` (fixed/percentage/range/custom), `eligibility`, `requirements`, `application`, `contacts`, `buildingTypes`, `appliesToTiltak` og `tags`. `metadata.status` styrer eksponering (draft blokkeres i prod). Beløp brukes videre av `formatFundingSummary` i `useGrantAwareStotteordninger`.
- Begge skjemaene gjenbruker `MetadataSchema` for audit (status, hvem, når, oppsummering) og `ContentAudienceSchema` for å kontrollere hvilke målgrupper et felt gjelder for.
- Når filer ligger i `content/`, valideres de automatisk av `src/api-server.ts` ved oppstart og ved hver request. Avvik havner i loggene, og filen eksponeres ikke før den validerer.

### 14.3 Hooks og helpere i frontend
- `useTiltakContent('solenergi')`/`useTilskuddContent('klimaoslo-solenergitilskudd')` henter individuelle dokumenter via SWR. Hookene cachet på ETag og eksponerer `refresh()` som admin-appen kan bruke til optimistisk låsing.
- `useTilskuddBatch([...])` henter flere tilskudd samtidig (brukes av `useGrantAwareStotteordninger`) og dedupliserer id’er før kall.
- `useGrantAwareStotteordninger` tar `grantIds` + `legacyTiltakSlug` og:
  1. Henter ønskede tilskudd via `useTilskuddBatch`.
  2. Mapper hvert `TilskuddContent` til `Stotteordning`-format (`ordning`, `lenke`, `belop`, `overskrift`).
  3. Faller tilbake til `useStotteordninger` bare når `grantIds` mangler, feiler eller gir tomt resultat.
- `glossaryHelpers.tsx` injiserer ord-lister fra `accordion[].glossary` inn i paragrafer og viser tooltip med definisjon/lenker. Komponentene sender `glossary`-feltet som del av `renderParagraphWithGlossary`.
- `shared.ts` beholder `TiltakComponentProps`, energiberegninger, `useStotteordninger` (legacy fallback) og helperne for byggtype/overskrifter.

### 14.4 Komponentmønstre og gul-listevarianter
- Standardkomponentene ligger direkte i `src/components/FigmaBlokk/components/Tiltak/`. Alle `GulListeTiltak/*`-filene er nå rene delegater som kaller `<Navn>ContentComponent {...props} audience="gulliste" />`, slik at både standard- og gul liste-innhold hentes fra samme JSON-fil.
- Komponentene skal følge samme mønster:
  1. Kall `useTiltakContent('<slug>')`.
  2. Bruk `applyTiltakVariant` med aktuell `audience`.
  3. Hent byggtype-spesifikke tekster med `normaliseBuildingTypeKey`/`getBuildingParagraphs`.
  4. Send `content.grants` til `useGrantAwareStotteordninger`.
  5. Vis `introParagraphs`, `benefits`, `tabs`, `accordion`, `glossary` og `readMore` direkte fra JSON.
- `content/tiltak/vinduer.json` viser hvordan tabs (`tabs[].buildingTypeBody`) og `variants` brukes sammen med gul-listekontekst.

### 14.5 Migreringsoppskrift
1. **Kartlegg komponenten:** Finn slug og hvilke deler som fortsatt er hardkodet (`src/components/FigmaBlokk/components/Tiltak/<Navn>.tsx` + eventuell `GulListeTiltak`-versjon).
2. **Bygg eller oppdater JSON:** Lag `content/tiltak/<slug>.json` (bruk `content/examples/tiltak.example.json` som mal). Sørg for `schemaVersion`, `metadata`, `audiences`, `variants` og at `buildingTypeParagraphs` har `default`.
3. **Definer tilskudd:** Opprett/oppdater `content/tilskudd/*.json` for alle grants. Sett `appliesToTiltak` slik at katalogendepunktet vet hvilke tiltak som refererer til støtten.
4. **Koble relasjonen:** Legg `grants: ['klimaoslo-vinduer-dorer', ...]` i tiltaket og oppdater `appliesToTiltak` i tilskuddene. Bruk `metadata.status='draft'` til alt som ikke skal eksponeres i prod.
5. **Refaktorer komponenten:** Importer `useTiltakContent`, `applyTiltakVariant`, `renderParagraphWithGlossary` og `useGrantAwareStotteordninger`. Fjern hardkodede tekster/lenker og la komponenten lese alt fra JSON + hook-resultat.
6. **Samle gul-listevariantene:** Ekstraher fellespresentasjon til `<Navn>ContentComponent` og la `GulListeTiltak/<Navn>Gul.tsx` kun gjøre `return <Navn>ContentComponent {...props} audience="gulliste" />`.
7. **Test lokalt:** `npm run dev` + manuell QA. Bruk `/config/content/tiltak/<slug>.json?draft=1` for å bekrefte JSON-svar. Verifiser at `useGrantAwareStotteordninger.source === 'grants'`.
8. **Publiser til staging:** Når filene validerer, synk `content/` til `gs://energinokkelen-content/content/` (ref. driftshåndboka) og bekreft i UI. Prodversjon kopieres via `gsutil rsync` når metadata står til `published`.

### 14.6 Samspill med API og GCS
- Alle filer i `content/` deployes sammen med repoet *og* synkes til GCS. Cloud Run-API-et leser direkte fra lokal fil i utvikling og fra bøtten i drift, men eksponerer alltid samme REST-grensesnitt.
- Endepunkter:
  - `GET /config/content/tiltak/<slug>.json` og `.../tilskudd/<slug>.json` – støtter `?draft=1`, `ETag` og conditional requests.
  - `GET /config/content/tiltak/index.json` og `.../tilskudd/index.json` – gir katalog med `items[]`, `skippedLegacy`, `skippedInvalid`, osv. Admin-UI og CLI-skript skal bruke disse fremfor å liste bøtten selv.
- Når filer oppdateres:
  1. Zod validerer og `metadata.status` avgjør om fila kan serves i prod.
  2. `schemaVersion` gir bakoverkompatibilitet; API-et logger hvis en fil bruker ukjent versjon.
  3. GCS object versioning gjør rollback mulig direkte via `gcloud storage objects restore` eller admin-UI.
- Frontenden bruker `useTiltakContent` + SWR-cache slik at nye versjoner plukkes opp straks CDN invalidasjonen (fra publiseringsskriptet) er ferdig. Admin-appen skal også hente ETag fra hookene for å unngå race conditions ved skriving.
