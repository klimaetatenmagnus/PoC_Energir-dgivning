# Analyse: Svakhet i adresseoppslag for spesielle adresser

**Dato:** 2024-12-14
**Trigger:** Kapellveien 156A, 0493 Oslo - tjenesten henger
**Status:** Analyse fullført, løsningsforslag utarbeidet

---

## 1. Problemstilling

Når brukeren slår opp **Kapellveien 156A, 0493 Oslo**, henger tjenesten. Denne adressen er rapportert som et tilbygg eller garasje, noe som indikerer et problem i hvordan systemet håndterer adresser med:
- Bokstav-suffiks som IKKE er seksjoner
- Eiendommer med både garasje og bolig registrert på samme adresse

---

## 2. Datafunn

### 2.1 CSV-data (Matrikkel 2023.csv)

For **Kapellveien 156A** finnes to bygninger i CSV:

| Bygningsnr | Bygningstype | Kode | Areal | Byggeår |
|------------|--------------|------|-------|---------|
| 80172818 | Garasje og uthus til bolig | 181 | 66 m² | 1927 |
| 80861737 | Enebolig | 111 | 205 m² | 1981 |

### 2.2 Geonorge-oppslag

```bash
curl "https://ws.geonorge.no/adresser/v1/sok?sok=Kapellveien%20156A%200493%20Oslo"
```

Returnerer:
- **gnr/bnr: 73/227** for Kapellveien 156A
- **gnr/bnr: 73/704** for Kapellveien 156B, 156C, 156D, 156E (seksjonert eiendom)

**Viktig funn:** 156A er på en **separat eiendom** (73/227), mens 156B-E er seksjoner på felles eiendom (73/704).

### 2.3 Bygningstype-klassifisering

```
Bygningstype 181 (Garasje/uthus):
  isResidential: true
  reportingLevel: exclude
  shouldProcess: false  ← Filtreres ut!
```

---

## 3. Dagens dataflyt

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        DATAFLYT: resolveBuildingData()                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  INPUT: "Kapellveien 156A, 0493 Oslo"                                       │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ STEG 1: lookupAdresse() → Geonorge API                              │   │
│  │   Returnerer: kommunenummer, gnr=73, bnr=227, bokstav="A"           │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                              │                                              │
│                              ▼                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ STEG 2: letterToSeksjonsnummer("A") = 1                             │   │
│  │   Bokstav "A" tolkes som seksjonsnummer 1                           │   │
│  │   ⚠️  SVAKHET: 156A er IKKE en seksjon!                             │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                              │                                              │
│                              ▼                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ STEG 3: findMatrikkelenheter(73/227) → Kartverket SOAP API          │   │
│  │   Returnerer: liste med matrikkelenhet-IDer                         │   │
│  │   Timeout: 10 sekunder per kall                                     │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                              │                                              │
│                              ▼                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ STEG 4: FOR EACH matrikkelenhet-ID:                                 │   │
│  │   ├── getMatrikkelInfo() → Hent XML, parse hovedadresse/seksjon     │   │
│  │   ├── Sjekk addressMatch (husnummer, bokstav)                       │   │
│  │   └── Hvis bokstav og ingen hovedadresse funnet:                    │   │
│  │       └── analyzeMatrikkelenhet() for ALLE IDs                      │   │
│  │           ├── findByggForMatrikkelenhet() → Kartverket              │   │
│  │           ├── FOR EACH byggId: getObject() → StoreService           │   │
│  │           └── FOR EACH bygg: loadBruksenheterForBuilding()          │   │
│  │                                                                     │   │
│  │   ⚠️  SVAKHET: Mange sekvensielle API-kall, kan ta lang tid!        │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                              │                                              │
│                              ▼                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ STEG 5: Velg bygg via shouldProcessBuildingType()                   │   │
│  │   - Garasje (181) → EKSKLUDERES                                     │   │
│  │   - Enebolig (111) → INKLUDERES                                     │   │
│  │                                                                     │   │
│  │   ⚠️  PROBLEM: Hvis Kartverket ikke returnerer eneboligen,          │   │
│  │       eller eneboligen ikke matcher forventet seksjon,              │   │
│  │       faller systemet gjennom uten gyldig bygg!                     │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                              │                                              │
│                              ▼                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ STEG 6: CSV-berikelse (linje 1307-1335)                             │   │
│  │   csvService.findByExactAddress() / findByAddress()                 │   │
│  │                                                                     │   │
│  │   ⚠️  SVAKHET: Dette skjer ETTER hele Kartverket-flyten!            │   │
│  │       Hvis flyten henger, kommer vi aldri hit.                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                              │                                              │
│                              ▼                                              │
│  OUTPUT: BuildingResult                                                     │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Identifiserte svakheter

### Svakhet 1: Bokstav tolkes alltid som seksjon

**Lokasjon:** `matrikkel.ts:146-148`

```typescript
function letterToSeksjonsnummer(letter: string): number {
  return letter.toUpperCase().charCodeAt(0) - 'A'.charCodeAt(0) + 1;
}
```

**Problem:** Kapellveien 156A er en selvstendig grunneiendom, ikke en seksjon. Systemet leter etter seksjonsnummer 1 som ikke eksisterer.

### Svakhet 2: Ingen tidlig CSV-fallback

**Lokasjon:** `matrikkel.ts:1307-1335`

CSV-data brukes først ETTER at hele Kartverket-flyten har kjørt. Hvis Kartverket-flyten henger eller feiler, kommer vi aldri til CSV-fallback.

### Svakhet 3: Sekvensielle API-kall uten total timeout

**Lokasjon:** `matrikkel.ts:754-908`

Hver matrikkelenhet analyseres sekvensielt. Med 10s timeout per SOAP-kall og potensielt mange matrikkelenheter, kan total ventetid bli svært lang.

### Svakhet 4: Ingen deteksjon av "falske seksjoner"

Adresser som "156A" på eiendom 73/227 er ikke en seksjon, men systemet behandler den som det fordi den har bokstav-suffiks.

---

## 5. Foreslått løsning

### 5.1 Tidlig CSV-validering

Legg til en tidlig sjekk som bruker CSV-data for å:
1. Verifisere at adressen finnes i CSV
2. Identifisere bygningstyper på adressen
3. Oppdage potensielle problemer (kun garasje, ingen bolig, etc.)

```typescript
// Tidlig i resolveBuildingData, etter lookupAdresse
const csvMatches = csvService.findByAddress(adr.adressetekst);

const residentialInCsv = csvMatches.filter(m =>
  shouldProcessBuildingType(parseInt(m.bygningstype3siffer))
);

const onlyGarageInCsv = csvMatches.length > 0 &&
  residentialInCsv.length === 0 &&
  csvMatches.every(m => m.bygningstype3siffer === '181');

if (onlyGarageInCsv) {
  // Adressen har kun garasje - gi tidlig feilmelding
  throw new Error(`Adressen ${adr.adressetekst} inneholder kun garasje/uthus`);
}
```

### 5.2 Forbedret seksjons-deteksjon

Sjekk om adressen faktisk er en seksjon ved å sammenligne gnr/bnr:

```typescript
// Detekter om bokstav faktisk er seksjon eller selvstendig eiendom
async function isActualSection(adr: LookupAdresseResult): Promise<boolean> {
  if (!adr.bokstav) return false;

  // Sjekk om det finnes andre adresser på samme gnr/bnr med andre bokstaver
  const siblings = await lookupSiblingAddresses(adr);

  // Hvis alle "søsken" har samme gnr/bnr, er det sannsynligvis seksjoner
  // Hvis de har forskjellige gnr/bnr, er det separate eiendommer
  return siblings.every(s => s.gnr === adr.gnr && s.bnr === adr.bnr);
}
```

### 5.3 Total timeout for flyten

Legg til en AbortController med total timeout:

```typescript
export async function resolveBuildingData(
  adresse: string,
  options: BuildingDataOptions = {}
): Promise<BuildingResult> {
  const controller = new AbortController();
  const totalTimeout = setTimeout(() => controller.abort(), 30_000); // 30s total

  try {
    // ... eksisterende logikk med signal: controller.signal på fetch-kall
  } finally {
    clearTimeout(totalTimeout);
  }
}
```

### 5.4 CSV-basert fallback ved timeout

```typescript
if (controller.signal.aborted) {
  // Kartverket-flyt tok for lang tid - bruk CSV som fallback
  const csvData = csvService.findByAddress(adresse);
  if (csvData.length > 0) {
    return assembleBuildingResultFromCSV(csvData[0], adr);
  }
  throw new Error('Tidsavbrudd ved oppslag mot Kartverket');
}
```

---

## 6. Testplan

### 6.1 Testscript-struktur

Opprett et testscript som sammenligner original og forbedret logikk:

```
scripts/
└── compare-address-lookup-logic.ts
```

### 6.2 Testadresser fra CSV

Velg et representativt utvalg adresser som dekker edge cases:

| Kategori | Eksempeladresse | Forventet oppførsel |
|----------|-----------------|---------------------|
| Normal enebolig | Kapellveien 156A | Returnerer enebolig 205 m² |
| Seksjonert B | Kapellveien 156B | Returnerer seksjon 1, 186 m² |
| Seksjonert C | Kapellveien 156C | Returnerer seksjon 2, 159 m² |
| Rekkehus | Kjelsåsveien 97B | Returnerer rekkehus |
| Kun garasje | (finn eksempel) | Feilmelding |
| Stor blokk | Kapellveien 160A | Returnerer boligblokk |
| Tomannsbolig | Kapellveien 164B | Returnerer tomannsbolig |

### 6.3 Testscript-pseudokode

```typescript
// scripts/compare-address-lookup-logic.ts

interface TestResult {
  address: string;
  originalResult: BuildingResult | Error;
  improvedResult: BuildingResult | Error;
  originalTimeMs: number;
  improvedTimeMs: number;
  differences: string[];
  status: 'pass' | 'fail' | 'improved' | 'regression';
}

const TEST_ADDRESSES = [
  // Fra CSV - representative adresser
  "Kapellveien 156A, 0493 Oslo",   // Problemadresse - enebolig + garasje
  "Kapellveien 156B, 0493 Oslo",   // Seksjonert eiendom
  "Kapellveien 156C, 0493 Oslo",   // Seksjonert eiendom
  "Kjelsåsveien 97B, 0491 Oslo",   // Rekkehus
  "Kapellveien 164A, 0493 Oslo",   // Tomannsbolig
  // ... flere fra CSV
];

async function runComparison(): Promise<TestResult[]> {
  const results: TestResult[] = [];

  for (const address of TEST_ADDRESSES) {
    // Test original logikk
    const originalStart = Date.now();
    let originalResult: BuildingResult | Error;
    try {
      originalResult = await resolveBuildingDataOriginal(address);
    } catch (e) {
      originalResult = e as Error;
    }
    const originalTime = Date.now() - originalStart;

    // Test forbedret logikk
    const improvedStart = Date.now();
    let improvedResult: BuildingResult | Error;
    try {
      improvedResult = await resolveBuildingDataImproved(address);
    } catch (e) {
      improvedResult = e as Error;
    }
    const improvedTime = Date.now() - improvedStart;

    // Sammenlign resultater
    const differences = compareResults(originalResult, improvedResult);
    const status = determineStatus(originalResult, improvedResult, differences);

    results.push({
      address,
      originalResult,
      improvedResult,
      originalTimeMs: originalTime,
      improvedTimeMs: improvedTime,
      differences,
      status,
    });
  }

  return results;
}

function compareResults(
  original: BuildingResult | Error,
  improved: BuildingResult | Error
): string[] {
  const differences: string[] = [];

  // Sammenlign nøkkelfelt
  if (original instanceof Error && !(improved instanceof Error)) {
    differences.push(`Original feilet, forbedret returnerte data`);
  }
  if (!(original instanceof Error) && improved instanceof Error) {
    differences.push(`REGRESJON: Original returnerte data, forbedret feilet`);
  }
  if (!(original instanceof Error) && !(improved instanceof Error)) {
    if (original.bruksarealM2 !== improved.bruksarealM2) {
      differences.push(`Areal: ${original.bruksarealM2} → ${improved.bruksarealM2}`);
    }
    if (original.bygningstype !== improved.bygningstype) {
      differences.push(`Type: ${original.bygningstype} → ${improved.bygningstype}`);
    }
    if (original.byggeaar !== improved.byggeaar) {
      differences.push(`År: ${original.byggeaar} → ${improved.byggeaar}`);
    }
  }

  return differences;
}
```

### 6.4 Forventet output

```
╔════════════════════════════════════════════════════════════════════════════╗
║                    ADRESSEOPPSLAG: SAMMENLIGNING AV LOGIKK                 ║
╠════════════════════════════════════════════════════════════════════════════╣
║ Testet: 10 adresser                                                        ║
║ Pass: 8 | Forbedret: 2 | Regresjoner: 0                                    ║
╠════════════════════════════════════════════════════════════════════════════╣
║                                                                            ║
║ ✅ Kapellveien 156B, 0493 Oslo                                             ║
║    Original: 186 m², Tomannsbolig, 1952 (2340 ms)                          ║
║    Forbedret: 186 m², Tomannsbolig, 1952 (2210 ms)                         ║
║    Status: PASS (identisk resultat)                                        ║
║                                                                            ║
║ 🔧 Kapellveien 156A, 0493 Oslo                                             ║
║    Original: TIMEOUT etter 30000 ms                                        ║
║    Forbedret: 205 m², Enebolig, 1981 (1840 ms)                             ║
║    Status: FORBEDRET (tidligere timeout, nå fungerer)                      ║
║                                                                            ║
║ ...                                                                        ║
╚════════════════════════════════════════════════════════════════════════════╝
```

---

## 7. Implementasjonsplan

### Fase 1: Testscript (denne PR)
1. Opprett `scripts/compare-address-lookup-logic.ts`
2. Velg 20-30 testadresser fra CSV som dekker alle edge cases
3. Kjør baseline-test med eksisterende logikk
4. Dokumenter resultater

### Fase 2: Implementer forbedringer
1. Legg til tidlig CSV-validering
2. Implementer total timeout
3. Forbedre seksjons-deteksjon
4. Legg til CSV-fallback ved timeout

### Fase 3: Verifisering
1. Kjør testscript på nytt med forbedret logikk
2. Verifiser at ingen regresjoner oppstår
3. Dokumenter forbedringer for problemadresser

### Fase 4: Produksjon
1. Deploy til staging
2. Test manuelt med kjente problemadresser
3. Monitor feilrater
4. Deploy til produksjon

---

## 8. Relaterte filer

- `services/building-info-service/matrikkel.ts` - Hovedlogikk
- `src/services/csvService.ts` - CSV-oppslag
- `src/utils/buildingTypeUtils.ts` - Bygningstype-klassifisering
- `services/building-info-service/improved-building-selection.ts` - Byggvalg
- `src/clients/MatrikkelClient.ts` - Kartverket SOAP-klient

---

## 9. Referanser

- CSV-data: `data/raw/Matrikkel 2023.csv`
- Geonorge API: https://ws.geonorge.no/adresser/v1/
- Kartverket Matrikkel API: https://matrikkel.statkart.no/
- Bygningstype-klassifisering: https://www.ssb.no/klass/klassifikasjoner/31
