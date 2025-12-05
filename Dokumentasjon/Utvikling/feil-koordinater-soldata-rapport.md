# Feilrapport: Feil koordinater gir feil soldata

**Dato:** 2025-12-01
**Status:** ✅ Implementert og verifisert
**Alvorlighet:** Høy
**Testadresse:** Fallanveien 29, 0495 Oslo (gnr 75, bnr 812)

---

## Sammendrag

Ved oppslag på Fallanveien 29 returnerer backend-API-et koordinater (`coordinatesWgs84`) som peker på feil bygning. Dette forårsaker:

1. **Feil kartmarkør** på desktop (147 meter fra riktig adresse)
2. **Feil soldata** - appen viser ca. 4x for høy solenergi-besparelse

Mobilvisningen er ikke påvirket fordi den bruker Geonorge-oppslag for kartkoordinater.

---

## Detaljerte funn

### Koordinatavvik

| Kilde | Latitude | Longitude | Bygningsnr |
|-------|----------|-----------|------------|
| **Geonorge (riktig)** | 59.96215723 | 10.79299229 | 80190816 |
| **API coordinatesWgs84 (feil)** | 59.96285249 | 10.79073705 | 80190719 |

**Avstand mellom punktene: 147 meter**

### Sammenligning med PBE Solkart

Data hentet fra PBE sitt offisielle solkart (https://od2.pbe.oslo.kommune.no/solkart/) for Fallanveien 29:

#### PBE Solkart (offisiell referanse)

| Takflate ID | Areal | Innstråling | kWh/år |
|-------------|-------|-------------|--------|
| 16344 | 193,3 m² | 495 kWh/m²/år | 95 749 |
| 17202 | 186,3 m² | 1 135 kWh/m²/år | 211 361 |
| **TOTALT** | **380 m²** | - | **307 111** |

Filtrert solenergi (takflater >800 kWh/m², 85% utnyttelse, 20% virkningsgrad): **35 932 kWh**

#### Vårt API med Geonorge-koordinater (riktig)

| Takflate ID | Areal | Innstråling | kWh/år |
|-------------|-------|-------------|--------|
| 16344 | 193,3 m² | 495 kWh/m²/år | 95 749 |
| 17202 | 186,3 m² | 1 135 kWh/m²/år | 211 361 |
| **TOTALT** | **380 m²** | - | **307 111** |

Filtrert solenergi: **35 932 kWh** ✅ Matcher PBE!

#### Vårt API med coordinatesWgs84 (feil bygning)

| Takflate ID | Areal | Innstråling | kWh/år |
|-------------|-------|-------------|--------|
| 6124 | 396,9 m² | 811 kWh/m²/år | 321 743 |
| 6025 | 400,9 m² | 805 kWh/m²/år | 322 781 |
| 15819 | 198,6 m² | 711 kWh/m²/år | 141 143 |
| 15497 | 201,7 m² | 954 kWh/m²/år | 192 457 |
| **TOTALT** | **1 198 m²** | - | **978 124** |

Filtrert solenergi: **142 287 kWh** ❌ Feil bygning!

### Avviksoppsummering

| Metrikk | PBE (riktig) | API (feil) | Avvik |
|---------|--------------|------------|-------|
| Takareal | 380 m² | 1 198 m² | +216% |
| Sol kWh/år totalt | 307 111 | 978 124 | +218% |
| Filtrert solenergi | 35 932 kWh | 142 287 kWh | **+296%** |

**Brukeren ser nesten 4x for høy solenergi-besparelse.**

---

## Rotårsak

Backend-tjenesten `resolveBuildingData` returnerer `bygningsnummer: 80190719` og tilhørende `coordinatesWgs84` som tilhører en annen bygning på samme eiendom (gnr 75/bnr 812).

### Bygningsoversikt på eiendommen

| Bygningsnr | Adresse (fra CSV) | Kilde | Kommentar |
|------------|-------------------|-------|-----------|
| 80190816 | Fallanveien 29 | csvData | ✅ Riktig bygning |
| 80190719 | **Kurveien 50** | API bygningsnummer | ❌ Feil - nabobygning på samme eiendom |

Eiendommen gnr 75/bnr 812 består av flere bygninger med ulike adresser (Fallanveien 29 og Kurveien 50). API-et velger feil bygning fordi `selectBuildingImproved` eller fallback-logikken i `resolveBuildingData` ikke tar hensyn til adresse-matching på bygningsnivå.

---

## Påvirkede funksjoner

| Funksjon | Desktop | Mobil | Kommentar |
|----------|---------|-------|-----------|
| Kartmarkør | ❌ Feil | ✅ OK | Mobil bruker Geonorge-oppslag |
| Solenergi-beregning | ❌ Feil | ❌ Feil | Begge bruker API-koordinater for soloppslag |
| Gul liste | ✅ OK | ✅ OK | Bruker gnr/bnr, ikke koordinater |
| Energiattest | ✅ OK | ✅ OK | Bruker matrikkel, ikke koordinater |

---

## Viktig merknad

Det er **avgjørende** at metoden for å hente inn soldata er korrekt. Før endelig fix implementeres:

1. **Nye oppslags-teknikker må testes og valideres via testscript** før implementering i koden
2. Løsningen må **kryssjekkes med flere adresser** mot PBE sitt offisielle solkart (https://od2.pbe.oslo.kommune.no/solkart/)
3. Testscriptet skal verifisere at returnerte soldata matcher PBE sine verdier for hver testadresse

Foreslåtte testadresser for validering:
- [x] Fallanveien 29, 0495 Oslo (denne rapporten) ✅
- [x] Kurveien 50, 0495 Oslo (nabobygning - bekrefter feil) ✅
- [x] Kjelsåsveien 165, 0491 Oslo (enebolig) ✅
- [x] Hesteskoen 4M, 0493 Oslo (rekkehus) ✅
- [x] Fallanveien 31, 0495 Oslo (samme bygning som 29 - deler byggnr 80190816) ✅

---

## Oppfølgingspunkter

| # | Oppgave | Status | Prioritet |
|---|---------|--------|-----------|
| 1 | Undersøke `resolveBuildingData` i backend for å identifisere hvor feil bygningsnummer velges | ✅ Fullført | Høy |
| 2 | Krysssjekke soldata mot PBE solkart for flere testadresser | ✅ Fullført | Høy |
| 3 | Implementere og teste fix | ✅ Fullført | Høy |
| 4 | Vurdere om samme feil påvirker andre adresser i produksjon | Ikke startet | Middels |

---

## Validering utført

### Testscript
Testscript opprettet: `scripts/test-soldata-pbe-direct.ts`

Kjør med: `npx tsx scripts/test-soldata-pbe-direct.ts`

### Validerte oppslag-metoder

| Metode | Resultat | Kommentar |
|--------|----------|-----------|
| `bygg_nr` fra csvData | ✅ Korrekt | Matcher PBE solkart |
| `bygg_nr` fra API | ❌ Feil | Returnerer feil bygning |
| Geonorge-koordinater | ✅ Korrekt | Matcher PBE solkart |
| API-koordinater | ❌ Feil | Peker på feil bygning |

### Testresultater

**Fallanveien 29:**
- Riktig byggnr (80190816): Takflate 16344, 17202 - 380 m², 42 272 kWh ✅
- Feil byggnr (80190719): Takflate 6025, 6124, 15497, 15819 - 1198 m², 167 396 kWh ❌

**Kjelsåsveien 165 (enebolig):**
- Byggnr (80162642): 5 takflater, 150 m², 17 062 kWh ✅

**Kurveien 50 (nabobygning):**
- Byggnr (80190719): Takflate 6025, 6124, 15497, 15819 - 1198 m² ✅ (riktig for denne adressen)

**Hesteskoen 4M (rekkehus):**
- Byggnr (81454280): Takflate 8743, 9336 - 603 m², 62 683 kWh ✅
- Hele rekkehusrekken (4A-4M) deler samme bygningsnummer og soldata

**Fallanveien 31 (oppgang i samme bygning som 29):**
- Byggnr (80190816): Takflate 16344, 17202 - 380 m² ✅
- Fallanveien 29 og 31 er oppganger i samme bygning og deler bygningsnummer
- CSV-filen har kun oppføring for Fallanveien 29, men løsningen vil fungere via fallback

---

## Implementeringsspesifikasjon

### Problemet som skal løses

Funksjonen `resolveBuildingData` i `services/building-info-service/matrikkel.ts` bruker feil bygningsnummer for soloppslag. Den bruker `bygg.bygningsnummer` som kommer fra matrikkel-API-et, men dette kan peke på feil bygning når en eiendom (gnr/bnr) har flere bygninger med ulike adresser.

**Løsningen:** Bruk `csvData.bygningsNr` fra `data/raw/Matrikkel 2023.csv` i stedet, da denne alltid er korrekt koblet til adressen.

---

### Fil som skal endres

**Fil:** `services/building-info-service/matrikkel.ts`

---

### Steg 1: Flytt CSV-oppslag før soloppslag

CSV-oppslaget skjer i dag i `assembleBuildingResult` (i `resultAssembler.ts`), men vi trenger tilgang til `csvData.bygningsNr` **før** vi kaller `fetchSolarData`.

**Finn koden** på ca. linje 1297-1336 i `resolveBuildingData`:

```typescript
  const attest = await fetchEnergiattest({
    kommunenummer: adr.kommunenummer,
    gnr: adr.gnr,
    bnr: adr.bnr,
    seksjonsnummer: seksjonForEnova,
    bygningsnummer: bygg.bygningsnummer,
  });

  let lat: number | undefined;
  let lon: number | undefined;

  if (bygg.representasjonspunkt) {
    const wgs84Coords = proj4('EPSG:32632', 'EPSG:4326', [
      bygg.representasjonspunkt.east,
      bygg.representasjonspunkt.north,
    ]);
    lon = wgs84Coords[0];
    lat = wgs84Coords[1];

    if (LOG) {
      debugLog('📍 Konverterte koordinater for solenergi-oppslag:', {
        utm: {
          east: bygg.representasjonspunkt.east,
          north: bygg.representasjonspunkt.north,
          epsg: 'EPSG:32632',
        },
        wgs84: { lat, lon, epsg: 'EPSG:4326' },
      });
    }
  }

  const solarData = await fetchSolarData({
    byggId,
    byggNr: bygg.bygningsnummer ?? undefined,
    lat,
    lon,
    gnr: adr.gnr,
    bnr: adr.bnr,
    seksjonsnummer: seksjonForEnova,
  });
```

---

### Steg 2: Legg til CSV-oppslag og bruk riktig bygningsnummer

**Erstatt koden ovenfor med:**

```typescript
  const attest = await fetchEnergiattest({
    kommunenummer: adr.kommunenummer,
    gnr: adr.gnr,
    bnr: adr.bnr,
    seksjonsnummer: seksjonForEnova,
    bygningsnummer: bygg.bygningsnummer,
  });

  // === NYTT: Hent csvData FØR soloppslag for å få riktig bygningsnummer ===
  // CSV-filen har korrekt bygningsnummer per adresse, mens bygg.bygningsnummer
  // kan peke på feil bygning for eiendommer med flere bygninger (f.eks. Fallanveien 29)
  let csvBygningsNr: string | undefined;

  if (adr.adressetekst) {
    const csvData = csvService.findByExactAddress(adr.adressetekst);
    if (csvData?.bygningsNr) {
      csvBygningsNr = csvData.bygningsNr;
      if (LOG) {
        debugLog(`📊 CSV bygningsnummer for "${adr.adressetekst}": ${csvBygningsNr}`);
        if (bygg.bygningsnummer && bygg.bygningsnummer !== csvBygningsNr) {
          debugLog(`⚠️  AVVIK: Matrikkel-API ga bygningsnummer ${bygg.bygningsnummer}, men CSV har ${csvBygningsNr}`);
        }
      }
    }
  }

  // Fallback: Søk på adresse hvis eksakt match ikke fant noe
  if (!csvBygningsNr && adr.adressetekst) {
    const searchAddress = `${adr.adressetekst}${adr.husnummer || ''}${adr.bokstav || ''}`.trim();
    const matches = csvService.findByAddress(searchAddress);
    if (matches.length > 0 && matches[0].bygningsNr) {
      csvBygningsNr = matches[0].bygningsNr;
      if (LOG) {
        debugLog(`📊 CSV bygningsnummer via søk "${searchAddress}": ${csvBygningsNr}`);
      }
    }
  }

  // Prioriter csvBygningsNr for soloppslag - dette er alltid riktig for adressen
  const byggNrForSoloppslag = csvBygningsNr || bygg.bygningsnummer || undefined;

  let lat: number | undefined;
  let lon: number | undefined;

  // Kun bruk koordinater hvis vi IKKE har bygningsnummer fra CSV
  // (koordinater fra bygg.representasjonspunkt kan peke på feil bygning)
  if (!csvBygningsNr && bygg.representasjonspunkt) {
    const wgs84Coords = proj4('EPSG:32632', 'EPSG:4326', [
      bygg.representasjonspunkt.east,
      bygg.representasjonspunkt.north,
    ]);
    lon = wgs84Coords[0];
    lat = wgs84Coords[1];

    if (LOG) {
      debugLog('📍 Konverterte koordinater for solenergi-oppslag:', {
        utm: {
          east: bygg.representasjonspunkt.east,
          north: bygg.representasjonspunkt.north,
          epsg: 'EPSG:32632',
        },
        wgs84: { lat, lon, epsg: 'EPSG:4326' },
      });
    }
  }

  if (LOG) {
    debugLog(`☀️  Soloppslag med byggNr=${byggNrForSoloppslag}, lat=${lat}, lon=${lon}`);
  }

  const solarData = await fetchSolarData({
    byggId,
    byggNr: byggNrForSoloppslag,
    lat,
    lon,
    gnr: adr.gnr,
    bnr: adr.bnr,
    seksjonsnummer: seksjonForEnova,
  });
```

---

### Steg 3: Legg til import for csvService

**Øverst i filen** (`services/building-info-service/matrikkel.ts`), sjekk at følgende import finnes. Hvis ikke, legg den til:

```typescript
import { csvService } from '../../src/services/csvService.ts';
```

---

### Verifisering etter implementering

Kjør testscriptet for å verifisere at fixen fungerer:

```bash
npx tsx scripts/test-soldata-pbe-direct.ts
```

**Forventede resultater:**

| Adresse | Bygningsnummer | Takflater | Areal |
|---------|----------------|-----------|-------|
| Fallanveien 29 | 80190816 | 16344, 17202 | 380 m² |
| Kjelsåsveien 165 | 80162642 | 5 flater | 150 m² |
| Hesteskoen 4M | 81454280 | 8743, 9336 | 603 m² |

**Manuell verifisering:**

```bash
# Start tjenestene
npm run dev

# Test Fallanveien 29
curl -X POST "http://localhost:3001/api/address-lookup" \
  -H "Content-Type: application/json" \
  -d '{"address": "Fallanveien 29, 0495 Oslo"}'

# Verifiser at:
# 1. csvData.bygningsNr = "80190816"
# 2. takflater inneholder ID 16344 og 17202
# 3. filteredSolarEnergy ≈ 42000 kWh (ikke 167000 kWh)
```

---

### Fallback-oppførsel

Hvis CSV-data ikke finnes for en adresse:
1. Systemet faller tilbake til `bygg.bygningsnummer` fra matrikkel-API
2. Hvis heller ikke dette finnes, brukes koordinater for soloppslag
3. Logging vil vise hvilken kilde som ble brukt

---

### Langsiktige forbedringer (utenfor scope)

1. Undersøk hvorfor `selectBuildingImproved` velger feil bygning for eiendommer med flere adresser
2. Vurder å matche bygning mot adresse i stedet for kun gnr/bnr
3. Legg til varsling når `csvData.bygningsNr` avviker fra `bygg.bygningsnummer`

---

## Reproduksjon

```bash
# Hent data for Fallanveien 29
curl -X POST "http://localhost:3001/api/address-lookup" \
  -H "Content-Type: application/json" \
  -d '{"address": "Fallanveien 29, 0495 Oslo"}'

# Sammenlign bygningsnummer:
# - csvData.bygningsNr: 80190816 (riktig)
# - bygningsnummer: 80190719 (feil)

# Test soloppslag med riktige koordinater (Geonorge)
curl "http://localhost:3001/api/solar/solinnstraling?lat=59.96215723&lon=10.79299229"
# Returnerer takflate 16344, 17202 (riktig)

# Test soloppslag med feil koordinater (API)
curl "http://localhost:3001/api/solar/solinnstraling?lat=59.96285249&lon=10.79073705"
# Returnerer takflate 6124, 6025, 15819, 15497 (feil bygning)
```

---

## Vedlegg

- PBE solkart-data lastet ned: `.playwright-mcp/solkartData.csv`
- Skjermbilder fra PBE solkart: Kan hentes ved behov

---

## Endringslogg

| Dato | Endring |
|------|---------|
| 2025-12-01 | Opprettet rapport med foreløpige funn |
| 2025-12-01 | Validert rotårsak: Kurveien 50 (80190719) er nabobygning på samme gnr/bnr |
| 2025-12-01 | Testscript opprettet: `scripts/test-soldata-pbe-direct.ts` |
| 2025-12-01 | Bekreftet at csvData.bygningsNr gir korrekte soldata |
| 2025-12-01 | Lagt til Hesteskoen 4M (rekkehus) som testcase |
| 2025-12-01 | Fullstendig implementeringsspesifikasjon dokumentert |
| 2025-12-01 | Validert Fallanveien 31 - deler byggnr med Fallanveien 29 |
| 2025-12-01 | **Fix implementert i `matrikkel.ts`** - bruker csvData.bygningsNr for soloppslag |
| 2025-12-01 | **Verifisert**: Fallanveien 29 returnerer nå riktige takflater (16344, 17202) |
