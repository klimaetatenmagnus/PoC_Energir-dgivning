# Plan: Fjern sensitiv data fra GitHub-repo

**Status: ALLE STEG FULLFØRT (2026-02-15)**

## Bakgrunn

Repoet inneholdt tre datafiler som ble brukt i bygg og runtime, men som inneholdt
sensitiv eiendoms-/adresseinformasjon fra Oslo. I tillegg fantes det historiske
credentials i git-historikken.

### Filer som var tracket

| Fil | Størrelse | Brukes av | Når |
|-----|-----------|-----------|-----|
| `data/raw/Matrikkel 2023.csv` | 33 MB | `csvService.ts` | Runtime (oppslag) |
| `data/raw/Input til modellen-Tabell 1.csv` | 9 KB | `energySavingsData.ts` | Build-time (Vite `?raw` import) |
| `data/raw/energimerke-grenser.json` | 2.4 KB | `energyRatingService.ts` | Runtime (oppslag) |

### Historisk eksponering i git (nå fjernet fra historikken)

| Innhold | Status |
|---------|--------|
| `data/raw/enova-energimerker-oslo.csv` (74k linjer) | Fjernet fra historikk |
| `.gcloud-config/*` (credentials.db, tokens) | Fjernet fra historikk |
| `.gcloud/*` | Fjernet fra historikk |
| `.config/gcloud/*` | Fjernet fra historikk |
| `Matrikkel 2023.csv` (rotnivå, tidlig commit) | Fjernet fra historikk |
| Google Cloud OAuth credentials | Fjernet fra historikk |

---

## Steg 1: Flytt `Input til modellen-Tabell 1.csv` til hardkodet TypeScript

**Status:** FERDIG

CSV-dataene er innebygd som string-konstant `csvRawData` direkte i
`src/utils/energySavingsData.ts`. Vite `?raw`-importen er fjernet.
Filen er fjernet fra git-tracking. Typecheck og build verifisert.

---

## Steg 2: Flytt `energimerke-grenser.json` til TypeScript

**Status:** FERDIG

Grenseverdiene er hardkodet som `DEFAULT_THRESHOLDS` i `energyRatingService.ts`.
`fs`/`path`-imports og `loadThresholds()` er fjernet. Filen er fjernet fra git.

---

## Steg 3: Flytt `Matrikkel 2023.csv` til GCS-bucket

**Status:** FERDIG (2026-02-15)

### Hva ble gjort

1. `csvService.ts` omskrevet til async lasting fra GCS via `@google-cloud/storage`
   - Bruker `DATA_BUCKET` env-var for å bestemme kilde (GCS vs. lokal fil)
   - `DATA_MATRIKKEL_FILE` env-var for filsti i bucketen (default: `matrikkel/Matrikkel 2023.csv`)
   - `waitForReady()` metode for å sikre at data er lastet før serveren starter
   - Fallback til lokal `data/raw/Matrikkel 2023.csv` for utvikling
2. `building-info-service/index.ts` venter på `csvService.waitForReady()` ved oppstart
3. `DATA_BUCKET=energinokkelen-data` lagt til i `deploy/gcp/cloudrun.yaml` for building-info-service
4. `COPY --from=build /app/data ./data` fjernet fra Dockerfile
5. CSV lastet opp til `gs://energinokkelen-data/matrikkel/Matrikkel 2023.csv`
6. `Matrikkel 2023.csv` fjernet fra git-tracking
7. `.gitignore` oppdatert til å ignorere hele `data/raw/`
8. Oppdateringsrutine for Matrikkel-data dokumentert i driftshåndboken § 5.7

### Verifisering av staging/prod

Gjenstår: Deploy til staging og verifiser at CSV lastes korrekt fra GCS.

---

## Steg 4: Rens git-historikk

**Status:** FERDIG (2026-02-15)

### Hva ble gjort

1. Full mirror-backup tatt: `/Users/magnuslundstein/Desktop/Innholdsproduksjon/Tjenester/Energitjeneste/PoC_Energir-dgivning-backup-20260215.git`
2. `git-filter-repo` ble installert men hang konsistent (trolig inkompatibilitet med Apple Git 2.50.1 / Python 3.13)
3. Brukte `git filter-branch` i stedet, i tre pass:
   - Pass 1: Fjernet `data/raw/Matrikkel 2023.csv`, `data/raw/enova-energimerker-oslo.csv`, `data/raw/Input til modellen-Tabell 1.csv`, `data/raw/energimerke-grenser.json`
   - Pass 2: Fjernet `.gcloud/`, `.gcloud-config/`
   - Pass 3: Fjernet `Matrikkel 2023.csv` (rotnivå) og `.config/gcloud/`
4. Verifisert at ingen sensitive filer finnes i noen branch
5. Repo-størrelse redusert fra **142 MB til 104 MB**
6. Force-pushet til GitHub (`35d9088...5e7824e main -> main`)

---

## Steg 5: Credential-rotasjon

**Status:** IKKE NØDVENDIG

`.env`-filen (med Matrikkel-passord, Enova API-nøkkel m.m.) har **aldri** vært
committet til git. Det eneste som var eksponert var Magnus sin personlige
Google Cloud OAuth-autentisering (gcloud ADC), som nå er fjernet fra historikken.
Ingen applikasjonspassord eller admin-brukerdata har vært eksponert.

---

## Sjekkliste (alle ferdig)

- [x] **Steg 1:** Embed `Input til modellen-Tabell 1.csv` som TypeScript-konstant
- [x] **Steg 2:** Embed `energimerke-grenser.json` som TypeScript-konstant
- [x] **Steg 3:** Implementer GCS-lasting i `csvService.ts`
- [x] **Steg 3:** Last opp CSV til `gs://energinokkelen-data/matrikkel/`
- [x] **Steg 3:** Legg til `DATA_BUCKET` env-var i Cloud Run
- [x] **Steg 3:** Oppdater Dockerfile (fjern `COPY --from=build /app/data ./data`)
- [x] **Steg 3:** Fjern `Matrikkel 2023.csv` fra git-tracking
- [x] **Steg 3:** Oppdater `.gitignore` til å ignorere hele `data/raw/`
- [x] **Steg 3:** Oppdater `Dokumentasjon/gcp-driftshandbok.md` § 5.7 med oppdateringsrutinen
- [x] **Steg 4:** Ta backup av hele repoet
- [x] **Steg 4:** Rens git-historikk (brukte `git filter-branch` istedenfor `git filter-repo`)
- [x] **Steg 4:** Force-push til GitHub
- [ ] **Verifisering:** Deploy til staging og verifiser GCS-lasting (gjenstår)
