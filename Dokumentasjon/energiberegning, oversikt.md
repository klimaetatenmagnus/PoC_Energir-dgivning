# Oversikt: Energibesparelsesberegninger i Løsningen

Jeg har analysert kodebasen og kan nå gi deg en detaljert oversikt over hvordan løsningen beregner estimater for energibesparelse for de ulike tiltakene.

## 📊 Dataflyt-oversikt

## 🏗️ Hovedkomponenter og Filer

### 1. **Adresseoppslag og Datainnhenting**

#### `services/building-info-service/matrikkel.ts` (hovedfil)

* **Funksjon**: `resolveBuildingData(adresse: string)`
* **Ansvar**: Orkestrerer hele dataflyten fra adresse til komplett bygningsdata
* **Prosess**:
  1. Slår opp adresse via Geonorge API → får gnr/bnr/koordinater
  2. Henter matrikkelenhet-ID via `adresseClient.ts`
  3. Henter bygningsdata fra Matrikkel API via `BygningClient.ts`
  4. Henter energiattest fra Enova API
  5. Henter soldata via `solarEnergyService.ts`
  6. Korrigerer data med CSV-fil (Oslo-spesifikk data)

#### `src/clients/adresseClient.ts`

* Konverterer adresse til matrikkelenhet-ID via SOAP-kall til Matrikkel API

#### `src/clients/BygningClient.ts`

* Henter detaljert bygningsinfo (byggeår, bruksareal, bygningstype)

#### `services/building-info-service/resultAssembler.ts`

* **Funksjon**: `assembleBuildingResult()`
* Samler data fra alle kilder og prioriterer:
  * **Bruksareal**: CSV → Enova → Matrikkel
  * **Byggeår**: CSV → Enova → Matrikkel
  * **Bygningstype**: CSV → Enova → Matrikkel

### 2. **Energiberegninger - Grunnlag**

#### `src/utils/tekEnergyCalculations.ts`

Inneholder kjernelogikken for energiestimering basert på TEK-standard:

**Funksjoner**:

* `calculateTEK(byggeaar: number): string`
  * Bestemmer TEK-periode basert på byggeår
  * Mapping: TEK7 (2009+), TEK97 (1999-2008), TEK87 (1989-1998), TEK69 (1971-1988), TEK49 (1951-1970), eldre (<1951)
* `getEnergyIntensityFromTEK(tek, buildingType, bruksareal): number`
  * Beregner energiintensitet (kWh/m²/år) basert på TEK-periode
  * Bruker formler fra `data/raw/energimerke-grenser.json`

**Energiintensitetsformler** (fra `energimerke-grenser.json`):

**For småhus** (enebolig, rekkehus, tomannsbolig):

* A: `95 + 800/BRA`
* B: `120 + 1600/BRA`
* C: `145 + 2500/BRA`
* D: `175 + 4100/BRA`
* E: `205 + 5800/BRA`
* F: `250 + 8000/BRA`
* G: `> 250 + 8000/BRA`

**For blokk** (leilighetsbygg):

* A: `85 + 600/BRA`
* B: `95 + 1000/BRA`
* C: `100 + 1500/BRA`
* D: `135 + 2200/BRA`
* E: `160 + 3000/BRA`
* F: `200 + 4000/BRA`
* G: `> 200 + 4000/BRA`

**TEK-mapping til energikarakter**:

* TEK7 → D-nivå
* TEK97 → Mellom D og E
* TEK87 → E-nivå
* TEK69 → F-nivå
* TEK49/eldre → F + 10%

#### `src/utils/energy.ts`

* `convertKwhToNok(kwh, pricePerKwh)`: Konverterer kWh til NOK (standard: 1.1 kr/kWh)
* `formatCurrency(value)`: Formaterer beløp til norsk valutaformat

### 3. **Tiltaksspesifikke Besparelsesberegninger**

#### `src/components/FigmaBlokk/components/Tiltak/shared.ts`

Inneholder **ENERGY_SAVINGS_DATA** - en matrise med besparelsesprosenter per tiltak:

**Struktur**: `[TEK-periode][bygningstype][tiltakstype] = besparelse i kWh/m²`

**Eksempel for TEK69, småhus**:

* Vindu (U=0.75): 41.7 kWh/m²
* Vindu (U=1.2): 33.7 kWh/m²
* Etterisolering yttervegg: 27.7 kWh/m²
* Etterisolering tak/loft: 11.4 kWh/m²

**Funksjoner**:

* `calculateTekPeriod(byggeaar)`: Bestemmer TEK-periode
* `resolveEnergyCategory(buildingType)`: Mapper bygningstype til 'småhus' eller 'blokk'
* `parseNumericValue()`: Normaliserer numeriske verdier

### 4. **Tiltakskomponenter med Besparelseslogikk**

#### `src/components/FigmaBlokk/components/Tiltak/EtterisoleringYttervegg.tsx`

**Beregningslogikk** (linjer 296-407):

**typescript**

```typescript
// 1. Hent bygningsdataconstbruksareal=parseNumericValue(buildingData?.bruksarealM2)constbyggeaar=parseNumericValue(buildingData?.byggeaar)constbuildingCategory=resolveEnergyCategory(buildingType) // 'småhus' eller 'blokk'// 2. Bestem TEK-periodeconsttekPeriod=calculateTekPeriod(byggeaar) // f.eks. '69'// 3. Hent besparelsesdata fra matriseconstsavingsData=ENERGY_SAVINGS_DATA[tekPeriod][buildingCategory]constsavingsPerM2= savingsData.etteriso_yttervegg // kWh/m²// 4. Beregn total besparelseconsttotalSavings= savingsPerM2 * bruksareal // kWh/år// 5. Legg til usikkerhetsmargin (±10%)constlowerSavings= Math.round((totalSavings *0.9) /1000) *1000constupperSavings= Math.round((totalSavings *1.1) /1000) *1000// 6. Konverter til kronerconstnorgespris=1.1// kr/kWhconstlowerKr= lowerSavings * norgesprisconstupperKr= upperSavings * norgespris
```

**Resultat**: Viser f.eks. "15 000 - 18 000 kWh" og "16 500 - 19 800 kr"

#### `src/components/FigmaBlokk/components/Tiltak/Solenergi.tsx`

**Solenergi-beregning** (via `solarEnergyService.ts`):

**typescript**

```typescript
// 1. Hent takflater fra Solar APIconsttakflater= solarData.takflater// 2. Filtrer takflater med god solinnstråling (>800 kWh/m²)constfilteredTakflater= takflater.filter(tak=> tak.irr_kwh_m2_yr >800)// 3. Beregn produksjon med effektivitetsfaktorerconstsolarPanelEfficiency=0.2// 20% virkningsgradconsttakUtnyttelsesgrad=0.85// 85% av taket kan brukesfilteredSolarEnergy = filteredTakflater.reduce((sum, tak) =>  sum + tak.irr_kwh_m2_yr * tak.area_m2 * takUtnyttelsesgrad * solarPanelEfficiency,0)
```

**Formel**: `Produksjon = Innstråling × Takareal × Utnyttelsesgrad × Paneleffektivitet`

#### `src/components/FigmaBlokk/components/Tiltak/Varmepumpe.tsx`

**Fast besparelsesprosent**:

* Varmepumpe gir typisk **30% besparelse** av totalt energiforbruk
* Beregning: `besparelse = årligForbruk × 0.30`

### 5. **Energikarakter-estimering**

#### `src/hooks/useEnergyRatingEstimator.ts`

Brukes til å estimere energikarakter basert på forbruk:

**typescript**

```typescript
// 1. Beregn energiintensitetconstenergyIntensity= yearlyConsumption / bruksareal // kWh/m²/år// 2. Sammenlign med grenseverdierif (buildingCategory ==='småhus') {if (intensity <=95+800/bra) return'A'if (intensity <=120+1600/bra) return'B'// ... osv}
```

## 🔑 Nøkkelformler Oppsummert

### Energiintensitet fra TEK

```
Energiintensitet (kWh/m²/år) = base + braTerm / bruksareal
```

Hvor `base` og `braTerm` varierer per TEK-periode og bygningstype.

### Tiltaksbesparelse

```
Besparelse (kWh/år) = besparelse_per_m² × bruksarealBesparelse (kr/år) = besparelse_kWh × strømpris (1.1 kr/kWh)
```

### Solenergi

```
Produksjon (kWh/år) = Σ(innstråling × takareal × 0.85 × 0.20)
```

Kun for takflater med innstråling > 800 kWh/m²/år.

### Varmepumpe

```
Besparelse (kWh/år) = årlig_forbruk × 0.30
```

## 📁 Viktige Datafiler

* `data/raw/energimerke-grenser.json`: Grenseverdier for energikarakterer
* `src/components/FigmaBlokk/components/Tiltak/shared.ts`: ENERGY_SAVINGS_DATA-matrise
* CSV-fil (lastes av `csvService.ts`): Oslo-spesifikk bygningsdata for korrigering

## 🔄 Datakilder Prioritering

1. **CSV-data** (Oslo kommune) - høyest prioritet
2. **Enova energiattest** - hvis tilgjengelig
3. **Matrikkel API** - fallback
4. **TEK-basert estimering** - hvis ingen andre kilder

Denne arkitekturen sikrer at løsningen alltid har best mulig datagrunnlag for energiberegningene.
