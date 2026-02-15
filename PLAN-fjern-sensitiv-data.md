# Plan: Fjern sensitiv data fra GitHub-repo

## Bakgrunn

Repoet inneholder tre datafiler som brukes i bygg og runtime, men som inneholder
sensitiv eiendoms-/adresseinformasjon fra Oslo. I tillegg finnes det historiske
credentials i git-historikken.

### Filer som fortsatt trackes (nødvendig for bygg)

| Fil | Størrelse | Brukes av | Når |
|-----|-----------|-----------|-----|
| `data/raw/Matrikkel 2023.csv` | 33 MB | `csvService.ts` | Runtime (oppslag) |
| `data/raw/Input til modellen-Tabell 1.csv` | 9 KB | `energySavingsData.ts` | Build-time (Vite `?raw` import) |
| `data/raw/energimerke-grenser.json` | 2.4 KB | `energyRatingService.ts` | Runtime (oppslag) |

### Allerede fjernet fra tracking

| Fil | Status |
|-----|--------|
| `data/raw/enova-energimerker-oslo.csv` (74k linjer) | Fjernet fra git, kun brukt av scripts |
| `Dokumentasjon/Utvikling/*.csv` og `*.xlsx` | Fjernet fra git |
| `.gcloud-config/*` (credentials.db, tokens) | Fjernet fra git |

### Historisk eksponering i git

| Innhold | Commit lagt til | Commit fjernet |
|---------|-----------------|----------------|
| Google Cloud OAuth credentials | `91ce101` | `ff6b1dc` |
| `.gcloud-config/credentials.db` | `91ce101` | `a10038a` |

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

**Risiko:** Middels (krever infrastrukturendring)
**Effekt:** Fjerner den siste og største sensitive filen (33 MB) fra git

Denne filen brukes ved runtime av `csvService.ts` for oppslag av bygningsdata.
Den er for stor til å hardkode og inneholder sensitiv eiendomsinformasjon.

### Eksisterende infrastruktur

GCS-bucketen `energinokkelen-data` finnes allerede (dokumentert i driftshåndboken § 4.5)
med formål "Rådata/CSV/Excel". Cloud Run SA (`run-energinokkelen`) har allerede
`roles/storage.objectViewer` på denne bucketen.

### Implementasjon

1. Last opp `Matrikkel 2023.csv` til `gs://energinokkelen-data/matrikkel/Matrikkel 2023.csv`
2. Legg til ny miljøvariabel `DATA_BUCKET=energinokkelen-data` i Cloud Run
3. Legg til `DATA_BUCKET` i Secret Manager eller som env-var i `deploy/gcp/cloudrun.yaml`
4. Oppdater `csvService.ts` til å laste CSV fra GCS ved oppstart (én gang, cache i minne)
   - Bruk `@google-cloud/storage` (allerede en dependency)
   - Fallback til lokal fil for utvikling (`data/raw/Matrikkel 2023.csv`)
5. Oppdater Dockerfile:
   - Fjern `COPY --from=build /app/data ./data` (eller gjør den betinget)
6. Fjern filen fra git-tracking
7. Oppdater `.gitignore` til å ignorere hele `data/raw/`
8. Verifiser at Cloud Run-containeren fungerer med GCS-basert lasting
9. **Oppdater `Dokumentasjon/gcp-driftshandbok.md`** med ny rutine (se under)

**Kodeendring i `csvService.ts`:**
```typescript
async function loadCSV(): Promise<RawCSVRecord[]> {
  const bucketName = process.env.DATA_BUCKET; // 'energinokkelen-data'
  const matrikkelFile = process.env.DATA_MATRIKKEL_FILE ?? 'matrikkel/Matrikkel 2023.csv';

  if (bucketName) {
    // Produksjon: last fra GCS
    const storage = new Storage();
    const [content] = await storage.bucket(bucketName).file(matrikkelFile).download();
    return parse(content.toString(), { columns: true, skip_empty_lines: true });
  }

  // Utvikling: last fra lokal fil
  const csvPath = path.join(process.cwd(), 'data', 'raw', 'Matrikkel 2023.csv');
  const content = fs.readFileSync(csvPath, 'utf-8');
  return parse(content, { columns: true, skip_empty_lines: true });
}
```

### Rutine for oppdatering av Matrikkel-data (legges inn i driftshåndboken)

Matrikkel-CSV-en inneholder eiendomsdata for Oslo og oppdateres typisk årlig
(eller ved behov). Etter migrering til GCS er prosessen:

1. **Hent ny eksport** fra Matrikkelens dataeksport (SSB/Kartverket)
2. **Valider filformat** – sjekk at kolonnenavnene matcher `RawCSVRecord` i `csvService.ts`
   ```bash
   head -1 "Ny-Matrikkel.csv"  # Sjekk header mot eksisterende
   ```
3. **Last opp til staging-bucket** for testing:
   ```bash
   gsutil cp "Ny-Matrikkel.csv" gs://energinokkelen-data/matrikkel/Matrikkel-ny.csv
   ```
4. **Test mot staging** ved å sette `DATA_MATRIKKEL_FILE=matrikkel/Matrikkel-ny.csv`
   i staging Cloud Run og verifisere noen kjente adresser
5. **Erstatt produksjonsfilen** når verifisert:
   ```bash
   # Behold gammel versjon (GCS har versjonering)
   gsutil cp "Ny-Matrikkel.csv" gs://energinokkelen-data/matrikkel/Matrikkel 2023.csv
   ```
6. **Restart Cloud Run** for å laste ny fil (CSV caches i minne ved oppstart):
   ```bash
   gcloud run services update energinokkelen-prod \
     --region europe-north1 \
     --update-env-vars MATRIKKEL_CSV_GENERATION=$(date +%s)
   ```
   (Legger til en dummy-variabel for å trigge ny revisjon og restart)
7. **Verifiser** at oppslag fungerer korrekt i produksjon
8. **Logg endringen** i driftshåndbokens endringslogg

---

## Steg 4: Rens git-historikk

**Risiko:** Høy (rewrite av git-historikk, alle må klone på nytt)
**Effekt:** Fjerner all sensitiv data permanent fra repoet

**Forutsetninger:** Steg 1-3 er ferdig og verifisert i produksjon.

**Tiltak:**
1. Ta backup av hele repoet
2. Installer `git-filter-repo` (`brew install git-filter-repo`)
3. Kjør filtrering:
   ```bash
   git filter-repo \
     --path "data/raw/Matrikkel 2023.csv" --invert-paths \
     --path "data/raw/enova-energimerker-oslo.csv" --invert-paths \
     --path "data/raw/Input til modellen-Tabell 1.csv" --invert-paths \
     --path "data/raw/energimerke-grenser.json" --invert-paths \
     --path ".gcloud/" --invert-paths \
     --path ".gcloud-config/" --invert-paths
   ```
4. Force-push til GitHub (krever at alle teammedlemmer er varslet)
5. Alle kloner repoet på nytt

---

## Steg 5: Roter eksponerte credentials

**Risiko:** Lav (men viktig)

Disse credentials har vært synlige i git-historikken:

| Credential | Tiltak |
|------------|--------|
| Google Cloud OAuth refresh_token | Roter i Google Cloud Console |
| Google Cloud client_secret | Roter i Google Cloud Console |
| Enova API-nøkkel (i `.env`, aldri committet) | Vurder rotasjon for sikkerhets skyld |
| Matrikkel-passord (i `.env`, aldri committet) | OK - har aldri vært i git |

---

## Anbefalt rekkefølge

```
Steg 1 (lav risiko)  ──→  Steg 2 (lav risiko)  ──→  Steg 3 (middels risiko)
     │                          │                          │
     └── Verifiser bygg ────────└── Verifiser bygg ────────└── Verifiser prod
                                                                    │
                                                              Steg 4 (høy risiko)
                                                                    │
                                                              Steg 5 (rotasjon)
```

**Estimat:**
- Steg 1-2: Kan gjøres umiddelbart, rent kodearbeid
- Steg 3: Krever GCS-bucket oppsett og testing mot Cloud Run
- Steg 4: Bør gjøres etter at steg 1-3 er verifisert i prod
- Steg 5: Kan gjøres parallelt med steg 4
