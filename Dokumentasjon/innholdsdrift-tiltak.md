# Driftsrutine for tiltak- og tilskuddsinnhold

Oppdatert: 2025-11-13 (Codex)

Dette dokumentet er **single source of truth** for både dagens innholdsdrift og utviklingen av admin-UI-et. Her finner utviklere all nødvendig informasjon om dataflyt, filstruktur, rutiner og fremdriftsplaner. Rutinen dekker variant-/gul-liste-data, schema-validering, staging→prod-synk og auditlogging i GCS. Når admin-UI lanseres skal den følge samme prosess under panseret, og alle endringer i arkitektur eller arbeidsprosess må gjenspeiles her før implementering.

---

## 0. Formål og scope

- Samle alle retningslinjer for tiltak-/tilskuddinnhold og admin-UI i ett dokument som utviklere og redaktører kan lene seg på under hele implementasjonen.
- Beskrive hvordan dataene modelleres, hvor de ligger i repoet, og hvilke skript/GCP-ressurser som er involvert.
- Dokumentere fremdriftsplan, ansvar og historikk for admin-UI, inkludert hva som er gjort, hva som gjenstår og hvordan publisering til staging/prod skal fungere.
- Fungere som landingsside for nye bidragsytere: hver seksjon peker til relevante filer (`content/`, `src/hooks/…`, `deploy/gcp/…`) slik at man raskt finner riktig kode.

---

## 1. Roller og tilgang

- **Redaktører:** medlemmer av Google Workspace-gruppen *Energinøkkel-redaktør* (`energinokkel-redaktor@klimaoslo.no`). Gruppen gis tilgang til admin-UI, GCS og Cloud Run når disse settes opp.
- **Utviklere/opperativ drift:** ansvarlige for å holde skript og dokumentasjon oppdatert, samt bistå ved feil i schema eller integrasjon.
- **Servicekontoer:** `content-admin@energiverktoy-poc-1234.iam.gserviceaccount.com` utfører skriptoperasjoner i Cloud Build/Cloud Run. Kontoen må ha `roles/storage.objectAdmin` på begge content-bøtter.

---

## 2. Repo- og filstruktur

| Område               | Path(er)                                                                                                          | Beskrivelse                                                                                                                                                  |
| --------------------- | ----------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Innhold               | `content/tiltak/*.json`, `content/tilskudd/*.json`                                                            | Kildedata for UI-et. Ett dokument per tiltak/tilskudd, inkl. varianter, grants og metadata.                                                                  |
| Schema & helpers      | `content/tiltak/schema.ts`, `content/tilskudd/schema.ts`, `content/schema-helpers.ts`                       | Zod-definisjoner + felles typer (audiences, metadata, byggtyper). Må oppdateres ved nye felter.                                                             |
| Eksempelfiler         | `content/examples/*.json`                                                                                       | Komplett referanse til alle felter. Brukes ved migreringer og testing.                                                                                       |
| Frontendkonsum        | `src/hooks/contentHooks.tsx`, `src/utils/tiltakContent.ts`, `src/components/FigmaBlokk/components/Tiltak/*` | Hooks og komponenter som leser JSON og gjengir tiltak. Admin-UI preview skal gjenbruke disse.                                                                |
| Admin-API             | `services/admin-api/*`                                                                                          | Express-basert BFF som håndterer Cloud Build-kall for publisering og blir senere skrivepunktet mot GCS.                                                     |
| Publiseringsskript    | `package.json` (`content:*`), `deploy/gcp/cloudbuild.yaml`, `deploy/gcp/invalidate-cdn-cache.sh`          | Automatiserer validering, staging/prod-synk og CDN-invalidator. Admin-UI skal trigge samme pipeline.                                                         |
| Ordbøker for UI      | `content/dictionaries/index.json`, `content/dictionaries/schema.ts`                                           | Sentrale verdilister for boligtyper, fordelkort og `supportTags`. Valideres av `content:validate` og eksponeres via `/config/dictionaries/index.json`. |
| Punkt-assets (lokalt) | `public/punkt-assets/icons`, `scripts/start-ui-only.sh`, `npm run sync:punkt-assets`                        | Lokalt speil av `@oslokommune/punkt-assets`-ikonene. Dev-skriptet og build-pipelinen synker ikonene slik at `pkt-icon` kan lastes uten ekstern CDN.      |
| GCP-konfig            | `Dokumentasjon/gcp-driftshandbok.md`                                                                            | Full oversikt over Cloud Run, buckets (`gs://energinokkelen-content` og `gs://energinokkelen-content-prod`), IAM, Cloud Build triggers og monitorering.  |
| Historikk og kontekst | `Dokumentasjon/Utvikling/tiltak-innholdsredigering-plan.md`                                                     | Tidligere arkitekturvalg, helperbibliotek og migreringsoppskrifter for tiltak.                                                                               |

---

## 3. Artefakter og begreper

| Element                                             | Beskrivelse                                                                                                        |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `content/tiltak/*.json`                           | Ett dokument per tiltak. Må inneholde `audiences`, `metadata` og eventuelle `variants[]` for gul liste.     |
| `content/tilskudd/*.json`                         | Ett dokument per støtteordning. Refereres fra tiltak via `grants`.                                              |
| `TiltakContentSchema` / `TilskuddContentSchema` | Definerer påkrevde felter, variant- og metadata-struktur. Valideres av script og API.                             |
| **Staging-bøtte**                            | `gs://energinokkelen-content/content/` – brukes til daglige oppdateringer og QA.                                |
| **Prod-bøtte**                               | `gs://energinokkelen-content-prod/content/` – eksponeres av API-et i prod.                                      |
| **Publiseringslogg**                          | JSON-filer i `gs://energinokkelen-content-prod/content/logs/` som beskriver hvem som promoterte innhold og når. |

---

## 4. Dataflyt og arbeidsprosess

1. **Redigering:** JSON opprettes/oppdateres i repoet eller via admin-UI. Struktur styres av schemaene i `content/`.
2. **Lokal validering:** `npm run content:validate` (og Admin-API) stopper avvik før filer lastes opp.
3. **Staging:** `npm run content:publish -- push-staging` synker `content/` til `gs://energinokkelen-content/content/`. API-server i staging leser direkte derfra og leverer `/config/content/**`.
4. **Runtime konsum:** Frontend (og admin-UI preview) bruker `useTiltakContent`/`useTilskuddContent` m.fl. med ETag/`If-None-Match`, noe som gir redeploy-fri oppdatering.
5. **Prod-publisering:** `npm run content:publish -- promote` eller tilsvarende Cloud Build-jobb kopierer staging-innhold til `gs://energinokkelen-content-prod/content/`, regenererer indeksene og logger publiseringen.
6. **Rollback og historikk:** GCS object versioning + publiseringsloggene gjør det mulig å rulle tilbake enkeltfiler eller hele synker. Admin-UI skal eksponere dette direkte.

### 4.1 Standard arbeidsløp

1. **Rediger lokalt** – oppdater tiltak/tilskudd i `content/`, sett `metadata.updatedBy`, `updatedAt` og fyll `changeSummary`.
2. **Valider schema** – `npm run content:validate`. Skriptet sikrer at alle filer (inkl. gul-listevarianter) følger gjeldende schema.
3. **Synk til staging** – `npm run content:publish -- push-staging` laster opp hele `content/`-mappen til staging-bøtten.
4. **QA i staging** – bruk staging-frontend/Admin (når tilgjengelig) + `curl https://.../config/content/<slug>.json?draft=1` for å se data, inkl. `audience=gulliste`-variantene.
5. **Oppdater metadata** – sett `metadata.status` til `published` når QA er godkjent. Drafts skal ha `status=draft`.
6. **Promoter til prod** – `npm run content:publish -- promote` kopierer staging-bøtten til prod og legger igjen en publiseringslogg i `content/logs/`.
7. **Verifiser prod** – kall prod-endepunktet `/config/content/<slug>.json` (uten `draft=1`). Sørg for at frontend plukker opp endringen.

---

## 5. Variant- og gul-listeretningslinjer

- `audiences` i hoveddokumentet må alltid inkludere `standard`. Legg til `gulliste` når tiltaket har egne tekster for vernede bygg.
- `variants[]` brukes til overrides. Hvert objekt må ha `audience`. Feltene du angir her erstatter verdiene fra basen. Felter du ikke spesifiserer arver standardinnholdet.
- `buildingTypeParagraphs` på hovednivå _og_ i varianter skal alltid ha `default` i tillegg til spesifikke byggtyper dersom du ønsker fallback-tekst. (Varianter kan droppe `default` dersom de kun overstyrer enkeltbygg; basen brukes da som fallback.)
- `grants` og `supportTags` kan settes per variant hvis støtteordninger/tags varierer mellom standard- og gul liste.
- Sett `metadata.reviewStatus` til `in-review` mens teksten kvalitetssikres, og `approved` når alt er godkjent. Dette feltet logges i publish-skriptet.

---

## 6. Skript og kommandoer

| Kommando                                    | Når brukes den?                                                                  | Effekt                                                                                                                                                                                                                                              |
| ------------------------------------------- | --------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run content:validate`                | Etter hver endring i `content/`                                                 | Validerer alle tiltak- og tilskuddsfiler mot Zod-skjemaene. Feiler hvis noe mangler (inkl. variantfelter).                                                                                                                                          |
| `npm run content:publish -- push-staging` | Når endringer skal testes i staging                                              | Kjører `gsutil -m rsync -d -r content gs://energinokkelen-content/content`. Sletter objekter i staging som ikke finnes lokalt.                                                                                                                   |
| `npm run content:publish -- promote`      | Når staging-versjonen er godkjent                                                | Kjører `gsutil -m rsync` fra staging-bøtten til prod og skriver loggfil til `gs://energinokkelen-content-prod/content/logs/publish-<timestamp>.json`.                                                                                         |
| `npm run sync:punkt-assets`               | Før bygg/deploy eller ved endringer i `node_modules/@oslokommune/punkt-assets` | Kopierer Punkt-ikonene til `public/punkt-assets/icons/` slik at admin-UI (og lokal dev via `scripts/start-ui-only.sh`) kan serve `pkt-icon` uten 403-feil. Kommandoen kjøres automatisk av `npm run build`, men kan også kjøres manuelt. |

> **Tips:** Legg ved `changeSummary` i hvert JSON-dokument. Det gjør det enklere å forstå publiseringsloggen i etterkant.

---

## 7. Kvalitetssikring før prod

1. Åpne staging-frontend (`https://energinokkelen-168751968131.europe-north1.run.app`) og naviger til tiltaket.
2. Test begge målgrupper ved å bruke gul-liste-rutene i UI eller ved å sette `audience`-parametere i komponenten.
3. Bekreft at `/config/content/tiltak/<slug>.json?draft=1` og `/config/content/tilskudd/<slug>.json?draft=1` returnerer forventet `metadata.status`.
4. Når alt er godkjent, kjør promote-skriptet og ta en kjapp smoke-test i prod (`https://energinøkkelen.no/config/content/...`).

> **Tips:** Sluttbruker-QA i staging skjer via `https://staging.energinokkelen.no`. Lokalt må du mappe domenet i `/etc/hosts` (`34.111.174.210 staging.energinokkelen.no`). Frontend og `/api/*`-kall går da gjennom samme load balancer som prod.

---

## 8. Audit, logging og rollback

- **Publiseringslogg:** Hver `promote`-operasjon lager et JSON-objekt i `gs://energinokkelen-content-prod/content/logs/` med brukernavn, tidspunkt og `gitSha`. Loggen kan lastes ned med `gcloud storage cp`.
- **GCS object versioning:** Begge content-bøtter har versjonering aktivert. Bruk `gcloud storage objects list --versions` for å finne tidligere versjoner og `gcloud storage objects restore` for å rulle tilbake.
- **Metadata:** Feltene `metadata.updatedBy`, `updatedAt`, `changeSummary` og `reviewStatus` fungerer som audit per fil. API-et og admin-UI (senere) skal vise disse verdiene.

---

## 9. Veien videre mot admin-UI

Admin-verktøyet skal i praksis gjøre følgende på vegne av redaktøren:

1. Skrive JSON til staging-bøtten med samme struktur som beskrevet over.
2. Kjøre tilsvarende schema-validering (bruk `TiltakContentSchema` og `TilskuddContentSchema` fra `content/`).
3. La redaktøren forhåndsvise data i staging-miljøet (`draft=1`).
4. Trigge `promote`-flyten med logging når publisering godkjennes.

Til vi er der, brukes kommandoene over som “grunnsannhet” for hvordan pipeline fungerer.

### 9.1 Mål og scope for UI-klienten

- Erstatte manuelle skript med et selvbetjent, sikkert grensesnitt for Google Workspace-gruppen `energinokkel-redaktor@klimaoslo.no`.
- Tydeliggjøre de to hovedbrukergruppene (tiltaksredaktører og tilskuddsredaktører) gjennom et dashbord som lar dem velge riktig redigeringsmodus før de ser data.
- Støtte full CRUD på både tiltak og tilskudd, inkl. relasjonsstyring (tiltak ↔ grants) og variantdata (gul liste).
- Gi redaktører mulighet til å publisere til staging selv, men kreve vanlig Cloud Build-approval når prod-knappen (“Publiser til energinokkelen.no”) trykkes.
- Ivareta miljøseparasjon: alle endringer skjer i staging først, og publisering til prod skjer eksplisitt etter QA.
- Sørge for at gjenbrukbare verdier (f.eks. boligtyper, fordelsikoner, metadata-tags) velges gjennom kontrollerte dropdowns/autocomplete-felter, mens øvrige felt er ren fritekst.
- Bygge hele UI-opplevelsen på React-komponenter fra Punkt designsystem slik at løsningen følger Oslo kommunes profil og UU-krav.
- Synliggjøre status, versjon, endringslogg og hvem som har gjort siste oppdatering, slik at auditkravene fra `Dokumentasjon/gcp-driftshandbok.md` og denne rutinen oppfylles.
- Tilby forhåndsvisning mot eksisterende `/config/content/**`-endepunkter, slik at redaktører ser hvordan tiltakskortet vil rendres uten å involvere utviklere.

### 9.2 Systemarkitektur og komponenter

- **Frontend:** Egen Vite/React-app (`energinokkelen-admin` / `energinokkelen-admin-prod` på Cloud Run) bak HTTPS-load balancer og IAP («internal-and-cloud-load-balancing»-ingress). Appen lever i samme repo som Energinøkkelen, bygger via Cloud Build og ligger i samme Artifact Registry som hovedappen (ref. `Dokumentasjon/gcp-driftshandbok.md`).
  - UI-laget bygges med Punkt-designsystemets React-komponenter (knapper, faner, cards, skjemafelt) for å følge Oslo kommunes visuelle profil, AA-kontrastkrav og tastaturnavigasjon out-of-the-box.
  - Hvilke Punkt-komponenter som kan brukes uendret og hvilke som trenger tilpasning avklares iterativt sammen med design under utviklingen; vi starter med standardkomponentene og legger til lokale wrappers kun når kravet ikke dekkes.
  - Første skjerm etter login viser to tydelige kort (“Rediger tiltak” og “Rediger tilskudd”) slik at brukergruppene finner riktig modus før de går videre til katalogen.
- **Admin-API/BFF:** Node/Express-tjeneste deployet sammen med frontend. API-et bruker servicekontoen `content-admin@energiverktoy-poc-1234.iam.gserviceaccount.com` med `roles/storage.objectAdmin` på `energinokkelen-content` og `energinokkelen-content-prod`. All skrivetilgang til GCS skjer via dette laget; frontend har kun lesetilgang via API-serveren.
- **Dataflyt:**
  - Lesing: UI-en bruker API-serverens `GET /config/content/tiltak|tilskudd/index.json` og `/<slug>.json?draft=1` for å vise katalog og detaljer.
  - Skriving: Admin-API mottar patcher, validerer mot `TiltakContentSchema`/`TilskuddContentSchema`, og skriver filene til staging-bøtten under riktig sti (`content/tiltak/<id>.json` osv.). Gjenbrukbare verdier (boligtyper, fordelikoner, tagger) hentes fra et internt ordbok-endepunkt slik at frontend kan rendre dropdowns/autocomplete fremfor tekstfelt.
  - Publisering:
    - **Til staging:** en “Publiser til staging”-kommando oppdaterer staging-bøtten umiddelbart (inkl. indeksfiler) og tagger versjonen slik at QA vet hvilken build som skal testes.
    - **Til prod:** når en redaktør klikker “Publiser til energinokkelen.no”, oppretter Admin-API en Cloud Build-jobb som bruker den eksisterende `content:publish -- promote`-pipen beskrevet i `Dokumentasjon/gcp-driftshandbok.md`. Jobben stanser i manual approval; administrator godkjenner den i Cloud Build UI og pipeline gjør resten (kopier til prod, oppdater logg, valgfri CDN-invalidator).
- **Observability:** Alle endringer logges til Cloud Logging (via Admin-API) og i publiseringsloggene i `gs://energinokkelen-content-prod/content/logs/` (samme format som `npm run content:publish -- promote`). GCS object versioning brukes for rollback direkte i UI.
- **Konfig/Secrets:** Admin-API henter bucket-navn, Slack-webhook og andre hemmeligheter fra Secret Manager, slik det beskrives i driftshåndboka. Miljøvariabler peker mot riktig bøtte og Slack-kanal per miljø.

### 9.3 Redigerings- og publiseringsflyt i UI

1. **Pålogging, modussvalg og miljøvelger:** Etter IAP autentisering presenteres to Punkt-kort (“Rediger tiltak” / “Rediger tilskudd”). Brukeren velger modus, deretter miljø (staging først, prod i read-only). Prod-miljøet viser data men blokkerer redigering utenom å trigge Cloud Build-publisering.
2. **Lister og søk:** UI-en henter katalogendepunktene og viser filtre på status (`draft`, `in-review`, `published`, `archived`), målgruppe (`standard`, `gulliste`), bygningstype og sist oppdatert. Hver liste er tilpasset valgt modus (tiltak ↔ tilskudd).
3. **Skjemaredigering:**
   - Tiltak-skjemaet speiler `content/examples/tiltak.example.json`, grupperer felter (intro, byggtype, fordeler, tabs, accordion, glossary, grants, metadata) og lar redaktøren slå på gul-listevarianter per seksjon.
   - Alle tekstfelter og textareaer bygger nå på Punkt sine feltskomponenter (`PktTextinput`, `PktTextarea` og `PktInputWrapper`) slik at helper-tekst, validering, ikonstøtte og tastaturnavigasjon er identisk med designsystemet. Eldre `PktInput`-wrappere er fjernet for å unngå React-warnings.
   - Tiltak bruker nå `benefitRefs` (maks 4) for å peke på globale fordeler fra dictionaryen. Admin-UI lar deg velge inntil fire kort fra listen (pkt-icon + beskrivelse) – rekkefølgen i arrayen reflekterer rekkefølgen i UI. Feltet `benefits[]` blir automatisk fylt av API-serveren basert på referansene for å holde frontend bakoverkompatibel.
   - Tilskudd-skjemaet styrer innholdet i den hvite tilskuddsboksen i tiltakskortet. Redaktøren velger hvilke tiltak (`appliesToTiltak`), byggtyper (`buildingTypes`) og målgrupper/audiences (inkl. gulliste) som skal vise ordningen; kombinasjonen av disse filtrene avgjør synlighet i UI-et. Feltet `tags` brukes til å markere spesifikke kampanjer (f.eks. «gul liste»).
   - Samme skjema lar redaktøren oppdatere finansiering (fast beløp, prosent, intervall), kriterier og gyldighet, men også kommunikasjon: `links[]` definerer “Les mer”-lenken (første element eksponeres i kortet), mens `provider.name`/`provider.url` beskriver avsender (Oslo kommune, Enova, Byantikvaren osv.).
   - Gjenbrukbare verdier (boligtype, fordel-ikon, tablayout, supportTags) velges via dropdown/autocomplete med data fra schema-ordbøker. Fritekstfelt gjenstår bare der det ikke finnes standardiserte alternativer.
   - Begge skjemaer viser samtidig forhåndsvisning ved å fylle React/Punkt-komponenter med JSON-data lokalt i admin-appen.
4. **Validering:** Zod-validering skjer i nettleseren (for rask feedback) og igjen i Admin-API før lagring. Feil vises med forklaring og hvilke felter som mangler.
5. **Lagre kladd / publiser til staging:** En lagring skriver JSON til staging-bøtten med oppdatert `metadata.updatedBy`, `updatedAt` og `changeSummary`. Når feltene validerer og redaktøren velger “Publiser til staging”, settes `metadata.status` til `in-review/published` og objektet markeres som kandidat for QA. Responsen inkluderer GCS `generation` for konfliktkontroll.
6. **QA/previews:** Brukere kan åpne staging-frontend direkte via lenke fra UI, eller slå over til “render med staging-data” i admin-klienten (kall mot `/config/... ?draft=1`).
7. **Publiser til prod:** Når et tiltak og alle tilhørende tilskudd er klare, trykker redaktøren “Publiser til energinokkelen.no”. Admin-API:
   - Bekrefter at `metadata.status='published'` for alle filer og at staging-versjonen som er testet er siste `generation`.
   - Oppretter en Cloud Build-jobb som gjenbruker dagens `content:publish -- promote`-pipeline (dokumentert i `Dokumentasjon/gcp-driftshandbok.md`) og legger ved metadata (hvem, hvilke filer, changeSummary). Jobben stopper automatisk i manual approval.
   - Når administrator godkjenner i Cloud Build UI, kjører den etablerte pipen: staging-objektene og indeksene kopieres til prod-bøtten, publiseringsloggen skrives til `content/logs/`, og (valgfritt) Slack-notifikasjon sendes / CDN invalidasjon trigges.
8. **Rollback:** UI-en viser tidligere GCS-versjoner per fil og kan sette en valgt versjon som gjeldende (kopier versjonen tilbake til staging + marker `changeSummary="Rollback from <version>"`).

### 9.4 Tilgangskontroll, sikkerhet og drift

- IAP håndterer autentisering. Bare `energinokkel-redaktor@klimaoslo.no` (og driftsteamet) får tilgang via gruppemedlemskap; andre får 403.
- Innenfor gruppen kan vi differensiere roller: “Tiltak”-redaktører og “Tilskudd”-redaktører får standard tilgang til sine respektive moduser, mens drift/administratorer får begge moduser og prod-approval-dashboard.
- Cloud Run-tjenestene kjøres uten offentlig ingress; all tilgang skjer via load balanceren som allerede beskrives i `Dokumentasjon/gcp-driftshandbok.md`.
- Servicekontoen som skriver til GCS får kun nødvendige roller. Lesetilgang til `/config/content/**` reiser via API-serveren slik at vi gjenbruker eksisterende caching, rate limits og auditlogging.
- Admin-API sjekker ETag/generation før skriving for å hindre at to redaktører overstyrer hverandre. Ved konflikt må brukeren hente siste versjon og forsøke igjen.
- Prod-publisering krever fortsatt menneskelig godkjenning: UI-en kan bare starte Cloud Build jobben; IAM-policyen der sørger for at kun prosjektadministratorer kan approvere (speiler dagens rutine).
- Alle operasjoner (lagre, publiser, rollback) logges med `user`, `environment`, `changeSummary`, `targetFiles` og `gitSha` for å speile dagens manuelle logg.

### 9.5 Implementasjonsmilepæler

1. **Fundament (uke 1–2):** Opprett de nye Cloud Run-tjenestene for admin-frontend og admin-API (staging/prod), koble dem til eksisterende buckets (`energinokkelen-content` / `-prod`) og Workspace-gruppen *Energinøkkel-redaktør*, aktiver IAP, og etabler en felles CI-build. Parallelt integreres Punkt-designrammeverket i koden og det bygges et første dashbord (valg av tiltak/tilskudd + katalog/lesemodus).
2. **Tiltak-editor (uke 3–4):** Bygg skjema, forhåndsvisning og lagre-/publiser-til-staging-flyt for tiltak, inkl. variantredigering og grant-velger som henter tilskuddskatalogen og dictionary-baserte dropdowns.
3. **Tilskudd-editor (uke 5):** Samme funksjonalitet for tilskudd, med kobling til tiltak og støtte for finansieringsnivåer, gyldighet og kontakter.
4. **Publisering, Cloud Build-integrasjon og rollback (uke 6):** Implementer prod-knappen som starter en Cloud Build promote-jobb med approval, publiseringslogg, Slack-varsler og UI for å plukke tidligere GCS-versjoner.
5. **Hardening og launch (uke 7):** Full QA mot staging, last-/samkjøringstester, dokumentasjon (oppdatere denne filen + `Dokumentasjon/gcp-driftshandbok.md`), samt endelig IAM-rydding (fjerne `allUsers` fra Cloud Run-tjenestene når IAP er verifisert).

Planen over erstatter ad-hoc-notater rundt admin-klienten og fungerer som aksjonsliste frem til første produksjonssetting av UI-verktøyet.

### 9.6 Punkt-integrasjon og designplan

| UI-del                            | Punkt-komponenter / referanser                                         | Notater                                                                                                                                                                                                                      |
| --------------------------------- | ---------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Landing/dashbord                  | `pkt-card` (kart og CTA’er) + `pkt-alert` for statusmeldinger     | Cards beskrives i Punkt docs (heading/subheading/metadata). Bruk `skin="outlined"` til valgfliser og ikon + kort tekst for tiltak/tilskudd-modus. Alerts brukes til å vise staging/prod-status eller manglende tilganger. |
| Navigasjon mellom tiltak/tilskudd | `pkt-tabs`                                                           | Tabs gir tydelig markering av aktiv modus; støtter ikoner og tags (“Ny”, “Beta”).                                                                                                                                       |
| Tiltak-/tilskudds-lister          | `pkt-card` + `pkt-tag` + evt. `pkt-progressbar`                  | Card-layout for hvert tiltak med metadata (status, dato, eier). Tags indikerer `draft/in-review/published`. Progressbar kan senere brukes til å vise valideringsgrad.                                                     |
| Skjema/accordion-seksjoner        | `pkt-accordion` for grupperte felter (intro, varianter, tilskudd)    | Accordion lar redaktører fokusere på én seksjon om gangen; f.eks. en accordion per byggtype eller metadata-gruppe.                                                                                                        |
| Skjema- og hjelpetekst            | `PktTextinput`, `PktTextarea`, `PktInputWrapper` + `pkt-alert` | Gir konsistente helper-tekster og error states når Zod-validering feiler. React-variantene brukes nå i admin-skjemaene for å unngå custom wrappers.                                                                      |
| Logg og statuspanel               | `pkt-card` med `pkt-tag`/`pkt-icon`                              | Viser siste publisering, Cloud Build-lenke og ETag/generation.                                                                                                                                                               |

**Tekniske avklaringer:**

- Bruk `@oslokommune/punkt-react` som primær kilde. Importer komponenter direkte (`import { PktAccordion } from '@oslokommune/punkt-react';`) og følg dokumentasjonen for struktur/props.
- Punkt støtter også web components (`pkt-card`, `pkt-accordion` osv.). Om React-pakken ikke dekker et behov kan vi midlertidig bruke web components (se kodeeksemplene i Punkt-dokumentasjonen) frem til React-versjon er på plass.
- Designsystemet beskriver komponentanatomi (f.eks. Alert med ikon/tittel/melding/dato/close). Følg anbefalt struktur og tokens (`skin`, `compact`, `ariaLive`).
- Typografi, farger, spacing, grid, hjelpeklasser og breakpoints hentes fra `@oslokommune/punkt-css` og `@oslokommune/punkt-assets` (allerede importert i `src/punkt.scss`). Dermed kan admin-UI bruke samme Oslo Sans-fonter, palett, responsive token-sett og layoutklasser som resten av Energinøkkelen uten ekstra oppsett.
- Alle `pkt-icon`-kall peker nå mot `/punkt-assets/icons` i `public/`. Kjør `npm run sync:punkt-assets` (automatisk i `npm run build` og `scripts/start-ui-only.sh`) når `@oslokommune/punkt-assets` oppdateres, ellers faller icon-fetch tilbake til CDN og gir 403-linjer i konsollen.
- Legg til en lokal “Design Playground”-route i admin-appen hvor komponentkombinasjoner testes før de brukes i skjemaene. Dette gir rask feedback uten å påvirke hovedflyten.
- Dokumenter avklaringer med designløpet i denne seksjonen (lagre under tabellen når vi vet hvilke komponenter som krever wrappers eller ekstra tokens).
- Per 2025-11-15 finnes en første prototype av dashbordet tilgjengelig lokalt på `/admin`. Den bruker mock-data, Punkt-komponenter (`PktLinkCard`, `PktTabs`, `PktTag`, `PktAlert`, `PktTextinput`) og bytter til admin-modus automatisk når path starter med `/admin`.

### 9.7 Cloud Build-integrasjon (Admin-API)

- Admin-API ligger i `services/admin-api/*` og starter et lite Express-API (`npm run dev:admin-api`) som eksponerer `POST /admin/api/publish`. Når den deployes bak IAP vil `X-Goog-Authenticated-User-Email` bestemme `initiatedBy`.
- Request-body (JSON):| Felt                  | Type                                 | Beskrivelse                                                                                               |
  | --------------------- | ------------------------------------ | --------------------------------------------------------------------------------------------------------- |
  | `changeSummary`     | string (5–1000 tegn)                | Kort forklaring som legges i publiseringsloggen.                                                          |
  | `items[]`           | array av `{ id, collection: 'tiltak' | 'tilskudd', generation? }`                                                                                |
  | `dryRun`            | boolean (optional)                   | Setter pipeline i “tørrkjøring” – hopper over `rsync` og loggskriving. Primært for lokal testing. |
  | `targetEnvironment` | `"prod"` (default)                 | Holder døren åpen for en fremtidig staging→staging-knapp.                                              |
- Autentisering:
  - **Prod/staging (IAP):** `X-Goog-Authenticated-User-Email` (`user:<epost>`) og valgfritt `X-Goog-Authenticated-User-Display-Name` brukes til auditfeltet `initiatedBy`.
  - **Lokal dev:** sett header `x-admin-user=<epost>` for å simulere autentisering.
- Response: `202 Accepted` med
  ```jsonc
  {
    "requestId": "51d7b3ab-...",
    "buildId": "f1fa2a88-...",
    "operationName": "operations/build/...",
    "status": "QUEUED",
    "logUrl": "https://console.cloud.google.com/cloud-build/builds/f1fa2a88-...?project=energiverktoy-poc-1234",
    "consoleUrl": "https://console.cloud.google.com/cloud-build/builds/f1fa2a88-...?project=energiverktoy-poc-1234"
  }
  ```
- Cloud Build-jobben settes opp direkte i koden (`cloudBuild.ts`) og kjører to steg med servicekontoen `content-admin@energiverktoy-poc-1234.iam.gserviceaccount.com`:
  1. `gsutil -m rsync -d -r gs://energinokkelen-content/content gs://energinokkelen-content-prod/content` (skippes ved `dryRun=1`).
  2. Python-script som bygger `publish-log.json` (bruker requestmetadataen) og laster den opp til `gs://energinokkelen-content-prod/content/logs/publish-<timestamp>.json`.
- Konfig styres av miljøvariabler (default-verdier i parentes):| Variabel                                                                         | Beskrivelse                                 |
  | -------------------------------------------------------------------------------- | ------------------------------------------- |
  | `ADMIN_CLOUD_BUILD_PROJECT` (`$GOOGLE_CLOUD_PROJECT`)                        | Prosjekt-id for builden.                    |
  | `ADMIN_CLOUD_BUILD_LOCATION` (`global`)                                      | Cloud Build-region.                         |
  | `ADMIN_CONTENT_STAGING_PREFIX` (`gs://energinokkelen-content/content`)       | Sti som rsyncer fra.                        |
  | `ADMIN_CONTENT_PROD_PREFIX` (`gs://energinokkelen-content-prod/content`)     | Sti som rsyncer til.                        |
  | `ADMIN_CONTENT_LOG_PREFIX` (`gs://energinokkelen-content-prod/content/logs`) | Hvor publiseringslogger plasseres.          |
  | `ADMIN_CONTENT_PUBLISHER_SERVICE_ACCOUNT` (`content-admin@…`)               | Servicekontoen Cloud Build kjører som.     |
  | `ADMIN_API_PORT` (`4100`)                                                    | Lokal porter ved `npm run dev:admin-api`. |
- Eksempel (lokal tørrkjøring):
  ```bash
  npm run dev:admin-api
  curl -X POST http://localhost:4100/admin/api/publish \
    -H "Content-Type: application/json" \
    -H "x-admin-user=redaktor@klimaoslo.no" \
    -d '{"changeSummary":"QA godkjent for solenergi + Enova","items":[{"id":"solenergi","collection":"tiltak"},{"id":"enova-solcelleanlegg","collection":"tilskudd"}],"dryRun":true}'
  ```
- Cloud Build-taggen `content-publish` gjør det enkelt å filtrere jobber i konsollen. Pipeline logger detaljer i Cloud Logging også når `dryRun` er aktivert.

### 9.8 Dictionary-endepunkt

- **Kilde:** `content/dictionaries/index.json` (+ `schema.ts`). Filen versjoneres med `schemaVersion` og ligger i `content/` slik at den alltid blir med når `content:publish` synker staging/prod. `npm run content:validate` validerer filen på linje med tiltak/tilskudd.
- **Struktur:** JSON inneholder tre lister som admin-UI kan bygge dropdowns/autocomplete fra:

  - `buildingTypes[]`: `{ id, label, description?, aliases[], internalOnly }`. `id` matcher `buildingTypeParagraphs`-nøkler. `internalOnly=true` brukes for `default` slik at UI kan skjule fallback-valget for redaktører men fremdeles forstå eksisterende JSON.
  - `benefits[]`: `{ id, title, description, icon?, tags[] }`. `id` gjenbrukes i `benefitRefs[]` i tiltak. `icon` beskriver anbefalt Punkt-ikon (`pkt-icon`), mens `tags` brukes til å gruppere/prefiltrere forslag basert på støtteordning/tema. Admin-UI har et eget skjema for å lage/oppdatere disse oppføringene før de publiseres i dictionary-filen.
  - `supportTags[]`: `{ id, label, description?, synonyms[], category? }`. `id` matcher slugene i `supportTags`. `synonyms` gjør det mulig å søke på flere uttrykk i UI, mens `category` lar vi gruppere taggene i UI-spesifikke seksjoner.
- **Endepunkt:**

  - **Lesing:** `GET /config/dictionaries/index.json` leveres av `src/api-server.ts` for frontend, mens `GET /admin/api/dictionary` (nytt) brukes av admin-UI for å hente dictionary + GCS `generation`/`etag` til optimistisk låsing.
  - **Skriving:** `POST /admin/api/dictionary/benefits`, `PUT /admin/api/dictionary/benefits/:id` og `DELETE /admin/api/dictionary/benefits/:id` oppdaterer `content/dictionaries/index.json` via servicekontoen. Alle kall må inkludere `generation`-verdien fra forrige `GET /admin/api/dictionary` slik at GCS avviser konflikter.
    Eksempel:

  ```bash
  curl http://localhost:4100/admin/api/dictionary | jq '.dictionary.buildingTypes[0]'
  ```
- **Bruk:** Admin-UI henter dictionaryen ved oppstart og fyller skjema-komponenter (byggtype-dropdown, fordelvelger, tag-autocomplete). Både frontend og Admin-API kan slå opp metadata (f.eks. vise `label`/`description` eller validere at en valgt verdi er lovlig) uten hardkodede lister i koden.

### 9.9 Preview-strategi for Admin-UI

- **Mål:** Redaktører skal kunne forhåndsvise tiltak direkte i admin-grensesnittet med de samme React-komponentene som brukes i frontend (`src/components/FigmaBlokk/components/Tiltak/*`). Løsningen må kunne veksle mellom staging (inkl. utkast/draft) og prod-data uten å duplisere innhold eller layoutlogikk.
- **Teknisk løsning:**
  - Et nytt `ContentFetchProvider` i `src/hooks/contentHooks.ts` lar oss overstyre både base-URL (`/config/content` som standard eller `https://energinokkelen.no/config/content` ved prod-lesing) og `includeDrafts`. Provider-verdien brukes automatisk av `useTiltakContent`/`useTilskuddContent`, slik at Punkt-komponentene henter riktige data selv om de ikke kjenner til admin-miljøet.
  - Admin-appen (`src/admin/AdminApp.tsx`) pakker hele admin-opplevelsen i `ContentFetchProvider` + `AdminDictionaryProvider`. `EnvironmentToggle` setter nå både UI-tekst og content-source (staging ⇒ `includeDrafts=true`, prod ⇒ `includeDrafts=false`). Prod-basen kan overstyres via `VITE_ADMIN_PROD_CONTENT_BASE` dersom admin-konsollen kjører i et annet miljø enn prod.
  - `PreviewPanel` (`src/admin/components/PreviewPanel.tsx`) trigges fra kataloglisten og gjengir riktig tiltakskomponent basert på `id`. Panelet tilbyr publikumsvelger (standard/gulliste), byggtype-dropdown (fra dictionaryen) og viser hvilke data som brukes (staging vs prod). Kontrollene setter props på `...ContentComponent`-versjonene av tiltakene, som igjen gjenbruker `useTiltakContent`. Panelet kan vises både som høyre-drawer og som “inline preview” under raden som inneholder valgt tiltak, slik at kortlayouten ikke hopper.
  - `ContentList` og tilhørende CSS (`src/admin/components/ContentList.tsx` / `.css`) beregner nå reelt antall kolonner per rad, sørger for like høye kort (tittel + sammendrag line-clampes) og injiserer inline forhåndsvisning som et eget gridelement mellom radene. Dette gjør at previewen legger seg rett under riktig rad og at tre kort fortsatt vises i bredden på store skjermer.
  - `PreviewPanel` måler SVG-høyden til tiltakskomponentene og setter panelets høyde dynamisk, med fornuftige min-/maksgrenser. Dermed slipper redaktørene store “dead space”-felt selv om tiltakene har ulik høyde, og scrollingen blir kortere.
  - Tilskuddsmodus i panelet lar redaktøren velge et tiltak fra `appliesToTiltak`, byggtype og målgruppe. UI-et henter tilknyttede `grants[]`, filtrerer tilskuddsfilene basert på valgt kombinasjon og viser hvilke ordninger som faktisk renderes i tiltakskortet (inkl. avsender, beløp og “Les mer”-lenke). Dersom et tilskudd ikke treffer kombinasjonen, vises en advarsel slik at redaktøren kan oppdatere `buildingTypes`/`audiences`/`appliesToTiltak`.
  - Fordelseditoren under forhåndsvisningen lar redaktører lese, opprette, redigere og slette de globale dictionary-oppføringene (`content/dictionaries/index.json`) samt velge hvilke IDs (`benefitRefs[]`) et tiltak skal bruke. UI-et viser alle forslag med `pkt-icon`-navn (samme som `pkt-icon`-webkomponenten) og sender endringene direkte til Admin-API-et slik at staging-bøtten oppdateres uten manuell JSON-kopi.
- **Konsekvenser/refaktorer:** Frontendkomponentene for tiltak krevde ingen kodeendringer fordi de allerede eksponerer `...ContentComponent` og gjenbruker `useTiltakContent`. Det eneste vi måtte gjøre var å utvide hooken med context-støtte slik at den respekterer valgt miljø. På sikt bør kataloglistene bytte fra mock til ekte katalog-endepunkt (`/config/content/tiltak/index.json`) – provideren er allerede klar for dette.
- **Konfig:**
  - `VITE_ADMIN_PROD_CONTENT_BASE` (valgfri) peker på produksjons-endpointet når admin UI kjører i staging/dev men skal vise prod-data i lesevisning.
  - `ContentFetchProvider` kan gjenbrukes i andre deler av koden (f.eks. egne forhåndsvisninger i frontend) dersom vi trenger å simulere staging/prod i samme app.

### 9.10 Admin-API for fordeler

- **Innsikt og concurrency:**
  - `GET /admin/api/content/tiltak/:id/metadata` returnerer `benefitRefs[]`, `metadata` og GCS `generation`/`etag` for tiltaket. Admin-UI viser verdiene i fordelseditoren og bruker `generation` som `ifGenerationMatch` ved lagring.
  - `GET /admin/api/dictionary` returnerer dictionary + `generation` slik at både fordelseditoren og andre skjemaer kan sende riktig versjon når de skriver `content/dictionaries/index.json`.
- **Skriveendepunkter:**
  - `PUT /admin/api/content/tiltak/:id/benefit-refs` setter `benefitRefs[]`, regenererer `benefits[]` basert på dictionaryen og oppdaterer `metadata.updatedAt/updatedBy/changeSummary`. Request-body: `{ generation, benefitRefs[], changeSummary? }`. Response inkluderer ny `generation`, slik at UI-et kan trigge ny lagring uten å refreshe hele siden.
  - `POST /admin/api/dictionary/benefits` oppretter en ny fordel, `PUT /admin/api/dictionary/benefits/:id` oppdaterer eksisterende, og `DELETE /admin/api/dictionary/benefits/:id` fjerner en oppføring. Alle tre krever `generation` fra siste `GET /admin/api/dictionary`.
- **Validering og logging:** Payloads valideres mot `TiltakContentSchema` og `ContentDictionarySchema`. Ukjente `benefitRefs` gir HTTP 400, og alle operasjoner logges med `[admin-api] <epost>` i Cloud Logging samt via `metadata`-feltene i selve dokumentet.
- **Fallback lokalt:** `ADMIN_CONTENT_STAGING_PREFIX` kan settes til lokal `content/`-mappe ved utvikling. `ContentStorage` detekterer `gs://` vs lokalt og beregner `generation` fra filsystemet slik at samme API-kontrakt fungerer uten GCS-tilgang.

---

## 10. Utviklingslogg

| Dato       | Aktivitet                                                                                                                                                                                                                                  | Referanse                                                                                                                                                                                                                                               |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2025-11-13 | Dokumentert ny tiltak-/tilskuddsprosess og første plan for admin-UI.                                                                                                                                                                      | `Dokumentasjon/innholdsdrift-tiltak.md`                                                                                                                                                                                                               |
| 2025-11-14 | Oppdatert UI-plan med modussvalg, staging/publisering, Punkt-krav og Cloud Build-integrasjon.                                                                                                                                              | `Dokumentasjon/innholdsdrift-tiltak.md`                                                                                                                                                                                                               |
| 2025-11-15 | Gjort dokumentet til single source: la til repooversikt, dataflyt, logg- og neste-steg-seksjoner.                                                                                                                                          | `Dokumentasjon/innholdsdrift-tiltak.md`                                                                                                                                                                                                               |
| 2025-11-15 | Opprettet lokal admin-prototype (`/admin`) med Punkt-baserte dashbord- og listemoduler for Design/Punkt-iterasjoner.                                                                                                                     | `src/admin/*`                                                                                                                                                                                                                                         |
| 2025-11-16 | La til Admin-API med Cloud Build-publisering (`POST /admin/api/publish`) og beskrev API-kontrakten.                                                                                                                                      | `services/admin-api/*`, `Dokumentasjon/innholdsdrift-tiltak.md`                                                                                                                                                                                     |
| 2025-11-16 | Etablerte dictionary-ordbok (`content/dictionaries`) og `GET /config/dictionaries/index.json` for boligtyper/fordeler/supportTags.                                                                                                     | `content/dictionaries/*`, `src/api-server.ts`                                                                                                                                                                                                       |
| 2025-11-16 | Første versjon av tiltak-preview i admin +`ContentFetchProvider` for å styre staging/prod/draft i gjenbrukte hooks.                                                                                                                    | `src/admin/AdminApp.tsx`, `src/admin/components/PreviewPanel.tsx`, `src/hooks/contentHooks.ts`                                                                                                                                                    |
| 2025-11-16 | Admin-UI henter nå dictionary-data via `/config/dictionaries/index.json` og eksponerer status/feil i dashbordet.                                                                                                                        | `src/admin/AdminApp.tsx`, `src/admin/context/*`                                                                                                                                                                                                     |
| 2025-11-17 | Bygget katalog mot index-endepunktene og la til tilskudd-preview for å teste tiltak/byggtype-kombinasjoner.                                                                                                                               | `src/admin/*`, `Dokumentasjon/innholdsdrift-tiltak.md`                                                                                                                                                                                              |
| 2025-11-17 | La til fordelseditor i admin-panelet slik at redaktører kan opprette/endre/slette `benefits[]` inkl. `pkt-icon`-valg.                                                                                                                 | `src/admin/components/BenefitsEditor.tsx`, `Dokumentasjon/innholdsdrift-tiltak.md`                                                                                                                                                                  |
| 2025-11-18 | Admin-API kan nå lese/lagre dictionary-oppføringer og `benefitRefs` direkte mot staging-bøtten; fordelseditoren bruker de nye endepunktene med versjonskontroll.                                                                      | `services/admin-api/*`, `src/admin/components/BenefitsEditor.tsx`, `scripts/start-ui-only.sh`, `Dokumentasjon/innholdsdrift-tiltak.md`                                                                                                          |
| 2025-11-19 | Polerte tiltakskatalog og forhåndsvisning: jevne kort-høyder, inline preview mellom rader og dynamisk høyde i `PreviewPanel`.                                                                                                         | `src/admin/components/ContentList.tsx`, `src/admin/components/ContentList.css`, `src/admin/components/PreviewPanel.tsx`                                                                                                                           |
| 2025-11-18 | Første staging-deploy av `energinokkelen-admin` på Cloud Run med dedikert SA + `admin-server`, `staging-admin-neg`/`staging-admin-backend`, `/admin`-path i LB og aktivert IAP (`group:energinokkel-redaktor@klimaoslo.no`). | `services/admin-server/*`, `scripts/sync-punkt-assets.mjs`, `deploy/gcp/staging-frontend-map.yaml`, Cloud Run/NEG/backend konfig via gcloud                                                                                                       |
| 2025-11-20 | Punkt-breakpoints rullet ut for fordelseditor, preview-panel, katalogvisning og øvrige admin-moduler, samt delt stylesheet for energiverktøyet.                                                                                          | `src/admin/components/BenefitsEditor.css`, `src/admin/components/PreviewPanel.css`, `src/admin/components/ContentList.css`, `src/admin/components/ModeCards.css`, `src/admin/components/EnvironmentToggle.css`, `src/styles/components.css` |
| 2025-11-21 | Feilsøkte IAP error 52 i staging: DNS/SSL for `staging.energinøkkelen.no` manglet. Dokumenterte punycode-host, nødvendige LB hostRules og plan for nytt Managed SSL før videre IAM-arbeid.                                           | `Dokumentasjon/innholdsdrift-tiltak.md`, `deploy/gcp/staging-frontend-map.yaml`, Cloud DNS / SSL-konfig                                                                                                                                             |
| 2025-11-21 | Opprettet egen Cloud Build-trigger for admin (`energinokkelen-admin-staging`), bygde med `VITE_BASE_PATH=/admin/` og deployet. Admin-lenken fungerer med IAP (kun `energinokkel-redaktor@klimaoslo.no`).                            | `deploy/gcp/cloudbuild-admin.yaml`, `Dokumentasjon/gcp-driftshandbok.md`, Cloud Build trigger                                                                                                                                                      |
| 2025-11-21 | La til inline fordelsredigering i admin-preview for tiltak: kan fjerne/legge til fordeler via pluss/placeholders, lagre mot Admin-API med `generation`, og auto-oppdatere metadata/changeSummary.                                       | `src/admin/components/PreviewPanel.tsx`, `src/admin/components/PreviewPanel.css`                                                                                                                                                                    |

Legg til en ny rad hver gang arkitektur, plan eller prosess endres slik at historikk og ansvar er synlig.

---

## 11. Neste steg

> **Utviklings- og testfilosofi:** Alle UI-endringer bygges og testes først lokalt (Vite dev-server + mock/BFF). Lesing mot staging (`/config/content/**`) gjøres med konfigurerbare base-URLer, men skrivetilgang holdes lokalt/in-memory til funksjonaliteten er klar for staging-deploy. Først når en milepæl er stabil, deployes den til Cloud Run for helhetlig QA.

1. **Full CRUD for tiltak/tilskudd:** Bygg skjemaene ferdig, koble til Admin-API for skriving til `content/tiltak/*.json` og `content/tilskudd/*.json`, legg på schema-validering i UI, og bruk GCS `generation` for konfliktkontroll. (Dette låser opp reell redigering uten Git.)
   - Delplan for inline fordeler/redigering i forhåndsvisning:
     - Tiltak: eksisterende `benefitRefs` kan fjernes med kryss; når et kort fjernes, vis en tom, striplet placeholder med samme dimensjoner og et `+`-ikon (Punkt-komponenter) for å legge til ny fordel. Dropdown/autocomplete bygges med Punkt Selector og listes opp fra dictionary (`benefits[]`).
     - Inlinefelt i preview: tekstbeskrivelser, “Les mer”-lenke (`links[0]`), “Sjekk om du må søke…”-tekst og støtteordninger/`supportTags` kan redigeres direkte i forhåndsvisningen. Bruk Punkt-felter (`Textfield`/`Textarea`, Selector for valg) i edit-modus per seksjon.
     - Oppdatering mot Admin-API bruker eksisterende JSON-felt (f.eks. `benefitRefs`, `links`, `metadata.changeSummary`) med `generation` for konfliktkontroll. Endringer setter automatisk `metadata.updatedAt/updatedBy/changeSummary`.
     - Start med tiltak; tilskudd inline-redigering (grants, appliesToTiltak, buildingTypes) tas i neste iterasjon.
2. **Katalogfilter og paginering:** Aktiver server-side filter/paginering basert på `/config/content/tiltak|tilskudd/index.json`, og del visninger for tiltak vs tilskudd så listene skalerer.
3. **Prod-klar admin-pipeline:** Etabler prod-trigger/konfig for admin (Cloud Build + Cloud Run) og prod-hostrule/SSL når prod-host er klart, slik at admin kan kjøres i prod med samme base `/admin/` og IAP-policy.
4. **Komponentopprydding:** Rydd React-warnings/hardkodede props i `src/components/FigmaBlokk/**` slik at admin-preview samsvarer med prod-render og konsollen er ren.
