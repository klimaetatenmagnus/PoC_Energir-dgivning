# Energinøkkelen: Bydelssammenligning av energieffektivitet

> **Presentasjon av muligheter basert på Enova bulk-data**
> Dato: 22. januar 2026

---

## 1. Datakildene vi har tilgang til

### Enova Bulk API (nytt funn!)

| Data | Kilde | Oppdatering |
|------|-------|-------------|
| **34,199 energimerker** for Oslo (2024) | Enova API v1/v2 | Månedlig |
| Postnummer per bolig | Inkludert i CSV | - |
| Energikarakter (A-G) | Inkludert i CSV | - |
| kWh/m² beregnet | Inkludert i CSV | - |
| Bygningskategori | Inkludert i CSV | - |
| Byggeår | Inkludert i CSV | - |

### Eksisterende datakilder

| Data | Kilde |
|------|-------|
| Bydel/delbydel per bygning | Matrikkel 2023 CSV |
| Postnummer → bydel mapping | Kan bygges fra data |
| Boligtype-kategorier | ArcGIS Oslo kommune |

---

## 2. Hva kan vi vise brukerne?

### 2.1 Sammenligning mot bydel

```
┌─────────────────────────────────────────────────────────────────┐
│  📊 Din bolig sammenlignet med Nordre Aker                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Din blokkleilighet bruker:     145 kWh/m²/år                  │
│  Snitt for blokk i Nordre Aker: 168 kWh/m²/år                  │
│                                                                 │
│  ✅ Du bruker 14% mindre energi enn gjennomsnittet!            │
│                                                                 │
│  ┌──────────────────────────────────────────────────────┐      │
│  │ ████████████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ │      │
│  │ Din bolig                              Bydelssnitt   │      │
│  └──────────────────────────────────────────────────────┘      │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 Energikarakter-fordeling i bydelen

```
┌─────────────────────────────────────────────────────────────────┐
│  🏠 Energikarakter-fordeling for blokkleiligheter i Frogner    │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  A  ██░░░░░░░░░░░░░░░░░░░░░░░░░░░░  3%                         │
│  B  ████░░░░░░░░░░░░░░░░░░░░░░░░░░  8%                         │
│  C  ██████████░░░░░░░░░░░░░░░░░░░░  18%                        │
│  D  ████████████████░░░░░░░░░░░░░░  28%  ← Din bolig (D)       │
│  E  ██████████████░░░░░░░░░░░░░░░░  24%                        │
│  F  ████████░░░░░░░░░░░░░░░░░░░░░░  14%                        │
│  G  ███░░░░░░░░░░░░░░░░░░░░░░░░░░░  5%                         │
│                                                                 │
│  📍 Din bolig ligger på medianen for bydelen                   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Punkt-implementasjon:**
- **Progressbar:** `<PktProgressbar statusType="percentage">` for hver energikarakter
- **Fremheving:** Brukerens rad får `pkt-color-bg-surface-default-light-green` bakgrunn
- **Typografi:** Karakter-bokstav i `pkt-txt-24-medium`, prosent i `pkt-txt-16-light`
- **Farger per karakter:**
  - A: `--pkt-color-brand-green-1000` (#43F8B6)
  - B: `--pkt-color-brand-light-green-1000` (#C7F6C9)
  - C: `--pkt-color-brand-yellow-500` (#FFE7BC)
  - D: `--pkt-color-brand-yellow-1000` (#F9C66B)
  - E-F: `--pkt-color-brand-red-600` (#FFB4AC)
  - G: `--pkt-color-brand-red-1000` (#FF8274)

### 2.3 Besparelsespotensial relativt til bydel

```
┌─────────────────────────────────────────────────────────────────┐
│  💡 Ditt forbedringspotensial                                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Hvis du oppgraderer til energikarakter B:                     │
│                                                                 │
│  • Du vil bruke 95 kWh/m²/år (ned fra 168)                     │
│  • Det er 43% bedre enn bydelssnitt                            │
│  • Du vil være blant topp 11% i Frogner                        │
│                                                                 │
│  ┌─────────────────────────────────────────────┐               │
│  │   Nå        Mål         Beste i bydelen    │               │
│  │    D    →    B              A              │               │
│  │  168 kWh   95 kWh         65 kWh           │               │
│  └─────────────────────────────────────────────┘               │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 3. Geografiske sammenligningsnivåer

### Tre nivåer av sammenligning

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│   ┌─────────────┐                                               │
│   │    OSLO     │  Nivå 1: Hele byen                           │
│   │  353,256    │  "Sammenlignet med Oslo generelt"            │
│   │   boliger   │                                               │
│   └──────┬──────┘                                               │
│          │                                                      │
│   ┌──────▼──────┐                                               │
│   │   BYDEL     │  Nivå 2: Bydel (15 bydeler)                  │
│   │  ~23,500    │  "Sammenlignet med Nordre Aker"              │
│   │   boliger   │                                               │
│   └──────┬──────┘                                               │
│          │                                                      │
│   ┌──────▼──────┐                                               │
│   │  DELBYDEL   │  Nivå 3: Delbydel (94 delbydeler)            │
│   │  ~3,750     │  "Sammenlignet med Tåsen"                    │
│   │   boliger   │                                               │
│   └─────────────┘                                               │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Postnummer → Bydel mapping

Vi kan bygge en mapping-tabell basert på Matrikkel-dataene:

| Postnummer | Poststed | Bydel | Delbydel |
|------------|----------|-------|----------|
| 0271 | Oslo | Frogner | Frogner |
| 0585 | Oslo | Bjerke | Veitvet |
| 0661 | Oslo | Gamle Oslo | Ensjø |
| 0491 | Oslo | Nordre Aker | Tåsen |
| ... | ... | ... | ... |

---

## 4. Mulige sammenligningsmetrikker

### 4.1 Primære metrikker

| Metrikk | Beskrivelse | Visning |
|---------|-------------|---------|
| **kWh/m²/år** | Energiforbruk per kvadratmeter | Tall + stolpediagram |
| **Energikarakter** | A-G skala | Bokstav + posisjon i fordeling |
| **Percentil** | Hvor du ligger i bydelen | "Topp 20%" |

### 4.2 Kontekstuelle metrikker

| Metrikk | Beskrivelse |
|---------|-------------|
| **Byggeår-justert** | Sammenlign med boliger fra samme periode |
| **Størrelse-justert** | Sammenlign med boliger av lignende størrelse |
| **Oppvarmingstype** | Sammenlign basert på oppvarmingskarakter |

---

## 5. Eksempel på brukerreise

### Steg 1: Bruker slår opp adresse

```
┌─────────────────────────────────────────────────────────────────┐
│  🔍 Kapellveien 156C, 0493 Oslo                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Boligtype:     Tomannsbolig (Småhus)                          │
│  Bydel:         Nordre Aker                                     │
│  Delbydel:      Tåsen                                           │
│  Byggeår:       2013                                            │
│  Bruksareal:    159 m²                                          │
│                                                                 │
│  Energimerke:   C (fra Enova)                                  │
│  Forbruk:       123 kWh/m²/år                                  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Steg 2: System beregner sammenligning

```
Henter statistikk for:
├── Boligtype: Småhus
├── Bydel: Nordre Aker
├── Postnummer: 0493
└── Byggeår-gruppe: 2010-2020 (TEK10)

Resultat fra 847 lignende boliger:
├── Snitt kWh/m²: 142
├── Median karakter: D
└── Standardavvik: 34
```

### Steg 3: Visning til bruker

```
┌─────────────────────────────────────────────────────────────────┐
│  🏆 Gratulerer! Din bolig er mer energieffektiv enn            │
│     gjennomsnittet for småhus i Nordre Aker!                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                                                         │   │
│  │     BEDRE ◄──────────────────────────────► DÅRLIGERE    │   │
│  │                                                         │   │
│  │  A    B    C    D    E    F    G                       │   │
│  │            ▲                                           │   │
│  │         DIN BOLIG                                      │   │
│  │            │                                           │   │
│  │            └── 13% bedre enn bydelssnitt               │   │
│  │                                                         │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  📊 Statistikk for småhus i Nordre Aker:                       │
│                                                                 │
│  • 847 boliger i sammenligningsgruppen                         │
│  • Gjennomsnitt: 142 kWh/m²/år                                 │
│  • Din bolig: 123 kWh/m²/år                                    │
│  • Du er blant de 35% mest energieffektive                     │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 6. Datakilder for brukerens bolig i sammenligningen

### Prioritering av datakilder

For å sikre "epler med epler"-sammenligning prioriterer systemet datakildene slik:

| Prioritet | Datakilde | Beskrivelse |
|-----------|-----------|-------------|
| 1 | **Enova bulk-data** | Hvis brukerens bolig finnes i `enova-building-index.json` |
| 2 | **TEK-estimering** | Beregnet basert på byggeår, areal og bygningstype |

### Hvorfor prioritere Enova bulk-data?

- **Samme datakilde**: Både brukerens kWh/m² og bydelsstatistikken kommer fra historiske Enova-attester
- **Konsistent sammenligning**: Unngår å sammenligne estimerte verdier mot faktiske attester
- **Ny karakterskala**: Enova gikk over til NS 3031:2025 ved nyttår 2026. Gamle attester vises ikke til bruker, men kan fortsatt brukes for konsistent sammenligning

### Implementasjon

```
┌─────────────────────────────────────────────────────────────────┐
│  Bruker slår opp: "Høybråtenveien 78B, 1088 Oslo"              │
│                                                                 │
│  1. Hent bygningsnummer/matrikkel fra adresseoppslag           │
│     └── bygningsnummer: 80261640, gnr: 107, bnr: 617           │
│                                                                 │
│  2. Slå opp i enova-building-index.json                        │
│     └── Funnet! kwhPerM2: 238.8, energikarakter: E             │
│                                                                 │
│  3. Bruk 238.8 kWh/m² i "Sammenlign deg med naboen"            │
│     └── Sammenlignes mot bydelssnitt fra samme bulk-data       │
│                                                                 │
│  ✅ Resultat: Konsistent "epler med epler"-sammenligning       │
└─────────────────────────────────────────────────────────────────┘
```

### Filer

| Fil | Beskrivelse |
|-----|-------------|
| `scripts/aggregate-district-statistics.ts` | Genererer både bydelsstatistikk og bygnings-indeks |
| `src/data/district-statistics-enova.json` | Aggregert statistikk per bydel/delbydel |
| `src/data/enova-building-index.json` | Indeks for oppslag av enkelt-boliger (~88k boliger) |
| `src/services/districtStatisticsService.ts` | Service med `lookupBuildingFromEnovaData()` |

---

## 7. Dataflyt og arkitektur

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│  ┌──────────────┐     ┌──────────────┐     ┌──────────────┐   │
│  │  Enova API   │     │  Matrikkel   │     │   ArcGIS     │   │
│  │  Bulk CSV    │     │    CSV       │     │    Oslo      │   │
│  └──────┬───────┘     └──────┬───────┘     └──────┬───────┘   │
│         │                    │                    │            │
│         ▼                    ▼                    ▼            │
│  ┌────────────────────────────────────────────────────────┐   │
│  │              STATISTIKK-DATABASE                       │   │
│  │                                                        │   │
│  │  • Aggregert per bydel/delbydel/postnummer            │   │
│  │  • Fordelt på boligtype og byggeår                    │   │
│  │  • Oppdateres månedlig fra Enova                      │   │
│  │                                                        │   │
│  └────────────────────────────┬───────────────────────────┘   │
│                               │                               │
│                               ▼                               │
│  ┌────────────────────────────────────────────────────────┐   │
│  │                    ENERGINØKKELEN                      │   │
│  │                                                        │   │
│  │  Bruker slår opp adresse                              │   │
│  │         │                                              │   │
│  │         ▼                                              │   │
│  │  Hent boligdata + energimerke                         │   │
│  │         │                                              │   │
│  │         ▼                                              │   │
│  │  Slå opp statistikk for bydel/type                    │   │
│  │         │                                              │   │
│  │         ▼                                              │   │
│  │  Vis sammenligning til bruker                         │   │
│  │                                                        │   │
│  └────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 7. Foreslåtte visninger i UI

### 7.1 Kompakt badge-visning (alltid synlig)

```
┌──────────────────────────────────────────┐
│  📊 13% bedre enn snitt i Nordre Aker   │
└──────────────────────────────────────────┘
```

**Punkt-implementasjon:**
- Bruk `<PktAlert skin="success" compact>` for positiv feedback
- Bruk `<PktAlert skin="info" compact>` for nøytral informasjon
- CSS-klasse: `pkt-txt-16-medium` for tekst

### 7.2 Utvidet sammenligning (klikk for detaljer)

```
┌─────────────────────────────────────────────────────────────────┐
│  Energisammenligning for din bolig                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────┬─────────────┬─────────────┬─────────────┐     │
│  │   Din       │  Nordre     │   Oslo      │  Norge      │     │
│  │   bolig     │  Aker       │   snitt     │  snitt      │     │
│  ├─────────────┼─────────────┼─────────────┼─────────────┤     │
│  │   123       │   142       │   156       │   152       │     │
│  │  kWh/m²     │  kWh/m²     │  kWh/m²     │  kWh/m²     │     │
│  └─────────────┴─────────────┴─────────────┴─────────────┘     │
│                                                                 │
│  Din bolig er:                                                  │
│  • 13% bedre enn bydelssnitt                                   │
│  • 21% bedre enn Oslo-snitt                                    │
│  • Blant topp 35% i din bydel                                  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Punkt-implementasjon:**
- **Grid-layout:** `pkt-grid pkt-grid--phablet` med `pkt-cell--span3-tablet-up` for 4-kolonne sammenligning
- **Overskrift:** `pkt-txt-24-medium` (mobil) → `pkt-txt-30-medium` (desktop)
- **Tall:** `pkt-txt-40-light` for store kWh-verdier
- **Label:** `pkt-txt-14-light` for "kWh/m²"
- **Bakgrunn:** `pkt-color-bg-surface-default-light-blue` for brukerens kolonne
- **Border:** `pkt-color-border-border-blue` for å fremheve brukerens data
- **Tabs:** `<PktTabs>` for å bytte mellom sammenligning mot Bydel/Oslo/Norge

### 7.3 Motiverende meldinger basert på posisjon

| Percentil | Melding | Punkt skin |
|-----------|---------|------------|
| Topp 10% | "Imponerende! Du er blant de mest energieffektive i {bydel}!" | `<PktAlert skin="success">` |
| Topp 25% | "Bra jobbet! Din bolig er godt over gjennomsnittet i {bydel}" | `<PktAlert skin="success">` |
| 25-50% | "Din bolig er bedre enn gjennomsnittet i {bydel}" | `<PktAlert skin="info">` |
| 50-75% | "Det finnes gode muligheter for å forbedre energieffektiviteten" | `<PktAlert skin="warning">` |
| Under 75% | "Med noen tiltak kan du spare betydelig på energiregningen" | `<PktAlert skin="warning">` |

**Merk:** Punkt anbefaler å unngå emojis i UI - bruk heller ikonene fra Punkt-ikonbiblioteket

---

## 8. Datakvalitet og begrensninger

### Styrker

✅ **34,199 datapunkter** for Oslo i 2024 alene
✅ Offisielle Enova-data med energikarakter
✅ Postnummer muliggjør geografisk gruppering
✅ Månedlig oppdatering tilgjengelig
✅ Historiske data tilbake til 2010

### Begrensninger å kommunisere

⚠️ Kun boliger med registrert energiattest er inkludert
⚠️ Kan være skjevhet mot nyere/renoverte boliger
⚠️ Statistikken er basert på beregnet forbruk, ikke faktisk

### Foreslått disclaimer

```
"Sammenligningen er basert på {N} boliger med energiattest
i {bydel}. Tallene viser beregnet energiforbruk og kan
avvike fra faktisk forbruk."
```

---

## 9. Implementasjonsplan

### Fase 1: Datainnhenting (1-2 uker)
- [ ] Script for å laste ned Enova bulk-data
- [ ] Bygge postnummer → bydel mapping
- [ ] Opprette statistikk-database/JSON

### Fase 2: Backend-integrasjon (1 uke)
- [ ] API-endepunkt for bydelsstatistikk
- [ ] Caching av statistikk
- [ ] Månedlig oppdateringsrutine

### Fase 3: Frontend-visning (1-2 uker)
- [ ] Kompakt badge-komponent
- [ ] Utvidet sammenligningsvisning
- [ ] Integrasjon i eksisterende UI

---

## 10. Konklusjon

### Vi kan tilby brukerne:

1. **"Din bolig bruker X% mindre/mer energi enn snitt i {bydel}"**
2. **"Du er blant topp Y% mest energieffektive i {bydel}"**
3. **Visuell fordeling av energikarakterer i bydelen**
4. **Motiverende meldinger basert på posisjon**

### Nøkkeltall for Oslo

| Metrikk | Verdi |
|---------|-------|
| Energiattester 2024 | 34,199 |
| Bydeler | 15 |
| Delbydeler | 94 |
| Boligkategorier | 4-6 |

### Alt dette er mulig med eksisterende API-tilgang! ✅

---

*Dokumentet er basert på utforskning av Enova API-portal 22. januar 2026*

---

## 11. Punkt Designsystem - Implementasjonsguide

### 11.1 Grunnleggende stilregler

#### Typografi (Oslo Sans)
```css
/* Punkt typografi-klasser */
.pkt-txt-54        /* H1 - Store overskrifter */
.pkt-txt-40-light  /* Store tall/verdier */
.pkt-txt-30-medium /* H2 - Seksjonsoverskrifter */
.pkt-txt-24-medium /* H3 - Kortoverskrifter */
.pkt-txt-16-light  /* Brødtekst standard (font-weight: 300) */
.pkt-txt-16-medium /* Fremhevet tekst */
.pkt-txt-14-light  /* Mindre tekst/labels */
```

#### Fargepalett (semantiske farger)
```css
/* Bakgrunner */
--pkt-color-background-default: #FFFFFF;
--pkt-color-background-subtle: #F9F9F9;
--pkt-color-surface-default-light-blue: #D1F9FF;
--pkt-color-surface-default-light-green: #C7FDE9;

/* Tekst */
--pkt-color-text-body-default: #2A2859;  /* brand-dark-blue-1000 */
--pkt-color-text-body-light: #FFFFFF;

/* Status/Energikarakterer */
--pkt-color-brand-green-1000: #43F8B6;   /* A-karakter */
--pkt-color-brand-light-green-1000: #C7F6C9; /* B-karakter */
--pkt-color-brand-yellow-500: #FFE7BC;   /* C-karakter */
--pkt-color-brand-yellow-1000: #F9C66B;  /* D-karakter */
--pkt-color-brand-red-600: #FFB4AC;      /* E/F-karakter */
--pkt-color-brand-red-1000: #FF8274;     /* G-karakter */
```

#### Breakpoints
```scss
/* Punkt breakpoints */
$phablet: 576px;   /* phablet-up */
$tablet: 768px;    /* tablet-up */
$tablet-big: 1024px; /* tablet-big-up */
$laptop: 1280px;   /* laptop-up */
$desktop: 1600px;  /* desktop-up */
```

#### Grid-system
```html
<!-- Responsivt 12-kolonne grid -->
<section class="pkt-grid pkt-grid--phablet">
  <div class="pkt-cell pkt-cell--span12 pkt-cell--span6-tablet-up">
    <!-- Full bredde mobil, halv bredde tablet+ -->
  </div>
</section>

<!-- 4-kolonne sammenligning -->
<section class="pkt-grid pkt-grid--phablet">
  <div class="pkt-cell pkt-cell--span6 pkt-cell--span3-tablet-up">Din bolig</div>
  <div class="pkt-cell pkt-cell--span6 pkt-cell--span3-tablet-up">Bydel</div>
  <div class="pkt-cell pkt-cell--span6 pkt-cell--span3-tablet-up">Oslo</div>
  <div class="pkt-cell pkt-cell--span6 pkt-cell--span3-tablet-up">Norge</div>
</section>
```

#### Spacing
```css
/* Punkt spacing tokens */
--pkt-spacing-4: 0.25rem;   /* 4px */
--pkt-spacing-8: 0.5rem;    /* 8px */
--pkt-spacing-16: 1rem;     /* 16px */
--pkt-spacing-24: 1.5rem;   /* 24px */
--pkt-spacing-32: 2rem;     /* 32px */
--pkt-spacing-48: 3rem;     /* 48px */
```

### 11.2 Anbefalte komponenter

| Visning | Punkt-komponent | Props |
|---------|-----------------|-------|
| Motiverende melding | `<PktAlert>` | `skin="success\|info\|warning"`, `compact` |
| Sammenligning tabs | `<PktTabs>` | `tabs=[{text, href, active}]` |
| Energifordeling | `<PktProgressbar>` | `statusType="percentage"`, `valueCurrent` |
| Detaljer ekspander | `<PktAccordion>` | `skin="outlined"` |
| Statistikk-kort | `<PktCard>` | `tags=[{text, skin}]` |

### 11.3 React-komponentstruktur for Side 2

```tsx
// Anbefalt filstruktur
src/components/
├── Page2/
│   ├── DistrictComparison.tsx      // Hovedkomponent
│   ├── ComparisonGrid.tsx          // 4-kolonne kWh-sammenligning
│   ├── EnergyDistributionChart.tsx // A-G fordeling i bydel
│   ├── MotivationalMessage.tsx     // PktAlert-basert melding
│   ├── ImprovementPotential.tsx    // Forbedringspotensial-visning
│   └── Page2.css                   // Punkt-baserte stiler
├── mobile/
│   └── MobilePage2.tsx             // Mobiltilpasset versjon
└── FigmaBlokk/
    └── FigmaPage2.tsx              // Desktop-versjon
```

### 11.4 Desktop-integrasjon i WhiteInfoBox

#### Plassering og layout
Sammenligningsknappen plasseres i WhiteInfoBox mellom besparelseskortet og kartet:

```
┌─────────────────────────────────────────┐
│ [Adresse + badges]                      │
│ [Nøkkelinformasjon]                     │
│ [Besparelseskort - grønn]               │
├─────────────────────────────────────────┤
│ ▼ Sammenlign med naboene         [NY]   │
│ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ │
│ Nå:        Topp 65% i Nordre Aker       │
│ Med tiltak: Topp 35% (+30%)             │
│ [Visual: bruker vs snitt]               │
├─────────────────────────────────────────┤
│ [Kart]                                  │
└─────────────────────────────────────────┘
```

#### Ekspanderbar knapp med PktButton

```tsx
import { PktButton, PktIcon } from '@oslokommune/punkt-react';

// Ekspanderbar knapp - matcher "Rediger"-knappen i WhiteInfoBox
<PktButton
  skin="tertiary"
  size="small"
  variant="icon-right"
  iconName={isComparisonExpanded ? 'chevron-thin-up' : 'chevron-thin-down'}
  onClick={() => setIsComparisonExpanded(!isComparisonExpanded)}
  aria-expanded={isComparisonExpanded}
  aria-controls="district-comparison-content"
>
  Sammenlign med naboene
</PktButton>
```

**Alternativ: Mer fremtredende knapp**
```tsx
// Sekundær knapp for mer synlighet
<PktButton
  skin="secondary"
  size="small"
  variant="icon-left"
  iconName="users"
  onClick={() => setIsComparisonExpanded(!isComparisonExpanded)}
>
  Sammenlign med naboene
</PktButton>
```

#### CSS for ekspanderbart innhold

```css
/* Ekspanderbar sammenligning i WhiteInfoBox */
.white-info-box__comparison-section {
  padding: 0 14px;
  overflow: hidden;
  transition: max-height 0.3s ease-out, opacity 0.2s ease-out;
}

.white-info-box__comparison-section--collapsed {
  max-height: 0;
  opacity: 0;
}

.white-info-box__comparison-section--expanded {
  max-height: 200px;
  opacity: 1;
}

.white-info-box__comparison-content {
  display: flex;
  flex-direction: column;
  gap: var(--pkt-spacing-8, 0.5rem);
  padding: var(--pkt-spacing-12, 0.75rem) 0;
  border-top: 1px solid var(--pkt-color-brand-neutrals-200, #f2f2f2);
}

.white-info-box__comparison-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.875rem;
}

.white-info-box__comparison-label {
  font-weight: 300;
  color: var(--pkt-color-brand-dark-blue-1000, #2a2859);
}

.white-info-box__comparison-value {
  font-weight: 500;
  color: var(--pkt-color-brand-dark-blue-1000, #2a2859);
}

.white-info-box__comparison-value--positive {
  color: var(--pkt-color-brand-dark-green-1000, #034b45);
}

.white-info-box__comparison-value--negative {
  color: var(--pkt-color-brand-red-1000, #ff8274);
}
```

### 11.5 Dynamisk oppdatering med tiltak

Sammenligningen skal automatisk oppdateres når bruker velger/fjerner tiltak:

```tsx
interface DistrictComparisonProps {
  currentKwhPerM2: number;        // Fra savedEnergiforbruk / bruksareal
  totalEnergySavings: number;     // Fra valgte tiltak (kWh/år)
  bruksareal: number;             // m²
  districtName: string;
  districtAvgKwhPerM2: number;    // Fra bydelsstatistikk
}

const DistrictComparison: React.FC<DistrictComparisonProps> = ({
  currentKwhPerM2,
  totalEnergySavings,
  bruksareal,
  districtName,
  districtAvgKwhPerM2,
}) => {
  // Beregn projisert forbruk etter tiltak
  const projectedKwhPerM2 = useMemo(() => {
    const savingsPerM2 = totalEnergySavings / bruksareal;
    return Math.max(0, currentKwhPerM2 - savingsPerM2);
  }, [currentKwhPerM2, totalEnergySavings, bruksareal]);

  // Beregn prosentvis forbedring vs bydel
  const currentVsDistrict = ((districtAvgKwhPerM2 - currentKwhPerM2) / districtAvgKwhPerM2) * 100;
  const projectedVsDistrict = ((districtAvgKwhPerM2 - projectedKwhPerM2) / districtAvgKwhPerM2) * 100;
  const improvement = projectedVsDistrict - currentVsDistrict;

  // Estimer percentil-posisjon (forenklet)
  const estimatePercentile = (kwhPerM2: number) => {
    const diff = (districtAvgKwhPerM2 - kwhPerM2) / districtAvgKwhPerM2;
    if (diff > 0.3) return 10;
    if (diff > 0.2) return 25;
    if (diff > 0.1) return 35;
    if (diff > 0) return 45;
    if (diff > -0.1) return 55;
    if (diff > -0.2) return 70;
    return 85;
  };

  const currentPercentile = estimatePercentile(currentKwhPerM2);
  const projectedPercentile = estimatePercentile(projectedKwhPerM2);

  return (
    <div className="white-info-box__comparison-content">
      <div className="white-info-box__comparison-row">
        <span className="white-info-box__comparison-label">Nå:</span>
        <span className={`white-info-box__comparison-value ${currentVsDistrict > 0 ? '--positive' : '--negative'}`}>
          Topp {currentPercentile}% i {districtName}
        </span>
      </div>
      {totalEnergySavings > 0 && (
        <div className="white-info-box__comparison-row">
          <span className="white-info-box__comparison-label">Med tiltak:</span>
          <span className="white-info-box__comparison-value white-info-box__comparison-value--positive">
            Topp {projectedPercentile}% (+{currentPercentile - projectedPercentile}%)
          </span>
        </div>
      )}
    </div>
  );
};
```

### 11.6 Eksempel: React-implementasjon av motiverende melding

```tsx
import { PktAlert } from '@oslokommune/punkt-react';

interface MotivationalMessageProps {
  percentile: number;
  bydel: string;
}

export const MotivationalMessage = ({ percentile, bydel }: MotivationalMessageProps) => {
  const getMessage = () => {
    if (percentile <= 10) return { skin: 'success', text: `Imponerende! Du er blant de mest energieffektive i ${bydel}!` };
    if (percentile <= 25) return { skin: 'success', text: `Bra jobbet! Din bolig er godt over gjennomsnittet i ${bydel}` };
    if (percentile <= 50) return { skin: 'info', text: `Din bolig er bedre enn gjennomsnittet i ${bydel}` };
    if (percentile <= 75) return { skin: 'warning', text: 'Det finnes gode muligheter for å forbedre energieffektiviteten' };
    return { skin: 'warning', text: 'Med noen tiltak kan du spare betydelig på energiregningen' };
  };

  const { skin, text } = getMessage();
  return <PktAlert skin={skin} compact>{text}</PktAlert>;
};
```

---

## 12. Kodebase-oversikt (relevant for implementasjon)

### 12.1 Nåværende applikasjonsarkitektur

```
src/
├── App.tsx                          # Hovedruter - håndterer mode ('figma' | 'figma-blokk')
├── components/
│   ├── FigmaMainScript.tsx          # Desktop resultatside-orkestrator (600+ linjer)
│   ├── FigmaBlokk/
│   │   ├── components/
│   │   │   ├── WhiteInfoBox.tsx     # 🎯 Hovedintegrasjonspunkt (1310 linjer)
│   │   │   ├── WhiteInfoBox.css     # Eksisterende stiler
│   │   │   ├── EnergySolutionButtons.tsx  # Tiltak-liste med besparelsesberegning
│   │   │   └── BuildingSprites.tsx  # Animerte bygning-SVGer
│   │   ├── hooks/
│   │   │   └── useAddressCoordinates.ts
│   │   └── styles/
│   └── mobile/
│       ├── MobileEnergySolutions.tsx # Mobil resultatside
│       ├── MobileInfoBox.tsx         # Mobil-ekvivalent av WhiteInfoBox
│       └── MobileSavingsFooter.tsx   # Footer med totale besparelser
├── hooks/
│   ├── useFigmaAddressSearch.ts     # Adressesøk og mode-håndtering
│   └── useResponsive.ts             # Mobil/desktop deteksjon
├── services/
│   ├── buildingApi.ts               # Bygningsdata API-kall
│   └── energyRatingService.ts       # Energikarakter-beregning
├── utils/
│   ├── tekEnergyCalculations.ts     # TEK-baserte energiberegninger
│   └── energy.ts                    # Formatering og konvertering
├── config/
│   └── badgeConfig.ts               # Badge-konfigurasjoner (bydel, bygningstype)
└── data/
    └── raw/
        ├── Matrikkel 2023.csv       # Bygningsdata med bydel/delbydel
        └── energimerke-grenser.json # Energikarakter-grenser (NS 3031:2025)
```

### 12.2 Nøkkelfiler for bydelssammenligning

#### WhiteInfoBox.tsx - Integrasjonspunkt
**Plassering:** `src/components/FigmaBlokk/components/WhiteInfoBox.tsx`

```typescript
// Viktige props som allerede finnes:
interface WhiteInfoBoxProps {
  districtName: string;              // ✅ Bydel finnes allerede
  buildingTypeName: string;          // ✅ Bygningstype finnes
  buildingData: AddressLookupResponse; // ✅ Inkluderer postnummer, areal, energiforbruk
  totalEnergySavings?: number;       // ✅ Totale besparelser fra valgte tiltak
  // ... andre props
}

// Relevante interne states:
const [savedEnergiforbruk, setSavedEnergiforbruk] = useState<string>('');
const [savedAreal, setSavedAreal] = useState<string>('');
```

**Layout-konstanter (linje 28-50):**
```typescript
const BOX_WIDTH = 360;
const MAP_TOP_Y = 496;               // Kart starter her
const SAVINGS_CARD_HEIGHT = 132;     // Besparelseskort høyde
// 🎯 Ny seksjon må plasseres mellom savings card og map
```

#### AddressLookupResponse - Datastruktur
**Plassering:** `src/services/buildingApi.ts`

```typescript
interface AddressLookupResponse {
  address: string;
  gnr: string;
  bnr: string;
  postnummer?: string;               // ✅ Kan brukes til bydel-mapping
  byggeaar?: string;
  bruksareal?: string;
  bygningstype?: string;
  energiattest?: {                   // Fra Enova (hvis tilgjengelig)
    energikarakter?: string;
    beregnetForbruk?: number;
  };
  csvData?: {
    bydelsnavn?: string;             // ✅ Bydel fra Matrikkel
    delbydelsnavn?: string;          // ✅ Delbydel fra Matrikkel
    // ...
  };
}
```

### 12.3 Eksisterende dataflyt for tiltak og besparelser

```
┌─────────────────────────────────────────────────────────────────┐
│  FigmaMainScript.tsx                                            │
│  ├── selectedSolutions: Set<string>  (valgte tiltak)            │
│  ├── totalEnergySavings: number      (aggregert fra tiltak)     │
│  └── passes these as props to:                                  │
│       ├── EnergySolutionButtons (for tiltak-liste)              │
│       └── WhiteInfoBox (for besparelseskort)                    │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  WhiteInfoBox.tsx                                                │
│  ├── Mottar: totalEnergySavings, buildingData, districtName     │
│  ├── Beregner: displayedSavings (med animasjon)                 │
│  └── 🎯 NY: Kan beregne percentil basert på bydelsstatistikk    │
└─────────────────────────────────────────────────────────────────┘
```

---

## 13. Eksterne datakilder - Detaljert oversikt

### 13.1 Enova Data- og API-portal

**Portal:** https://data.enova.no/

**API-nøkkel (i prosjektet):**
```
# .env
ENOVA_API_KEY=0c5e4a53ce3d4262b3371de8a499c9ca
```

**Konfigurert i:** `packages/config/src/runtime.ts` → `services/building-info-service/context.ts`

#### Tilgjengelige API-er

| API | Endepunkt | Beskrivelse |
|-----|-----------|-------------|
| **ems-offentlige-data** | `Energiattest_GetEnergiattest` | Hent energiattest for spesifikk bygning |
| **Bulk-eksport** | Portal → CSV nedlasting | Månedlige CSV-filer med alle energiattester |

#### Bulk CSV-format (fra portal)
```
Registreringsnummer,Postnummer,Kommunenummer,Bygningskategori,
Energikarakter,Oppvarmingskarakter,BeregnetLevertEnergi,BRA,Byggeår,...
```

**Relevante felter for bydelssammenligning:**
- `Postnummer` → Kan mappes til bydel via Matrikkel
- `Energikarakter` (A-G)
- `BeregnetLevertEnergi` (kWh/år)
- `BRA` (bruksareal m²)
- `Bygningskategori` (Småhus, Blokk, etc.)

### 13.2 Matrikkel CSV (eksisterende)

**Plassering:** `data/raw/Matrikkel 2023.csv`

**Kolonner (fra CSV-header):**
```
BYGNINGS_NR;BYGGID_ANONYM;BRUKSAREAL_TOTALT;BRA_BOLIG;...;
BYDELNR;BYDELSNAVN;DELBYDELNR;DELBYDELSNAVN;GRUNNKRETS_NR;...
```

**Postnummer → Bydel mapping kan bygges fra denne filen:**
```typescript
// Eksempel på mapping-struktur
interface PostnummerMapping {
  [postnummer: string]: {
    bydel: string;
    delbydel: string;
    bydelsnr: string;
  }
}
```

### 13.3 Oslo kommune ArcGIS

**Dashboard:** https://www.arcgis.com/apps/dashboards/

**API-endepunkt (fra PBE):**
```
PBE_MAP_BASE_URL=https://pbe.oslo.kommune.no/arcgis/rest/services/solkart_2024/MapServer
```

**Boligstatistikk-endepunkt:**
```
https://services-eu1.arcgis.com/Hky23fkHucfDZYMu/arcgis/rest/services/
KPA_variert_boligstruktur/FeatureServer/0/query
```

**Eksempel: Hent statistikk per bydel**
```bash
curl "https://services-eu1.arcgis.com/.../query?
  where=Bydel='Frogner'&
  outStatistics=[{
    "statisticType":"count",
    "onStatisticField":"OBJECTID",
    "outStatisticFieldName":"total"
  }]&
  groupByFieldsForStatistics=Bygningstype&
  f=json"
```

### 13.4 Data som må opprettes

| Data | Kilde | Format | Plassering |
|------|-------|--------|------------|
| Postnummer → Bydel mapping | Matrikkel CSV | JSON | `src/data/postnummer-bydel.json` |
| Bydelsstatistikk | Enova bulk + aggregering | JSON | `src/data/district-statistics.json` |
| Mock-data for testing | Manuelt opprettet | JSON | `src/data/mock-district-stats.json` |

---

## 14. Detaljert implementeringsplan

### Fase 0: Datagrunnlag (forutsetning)

#### 0.1 Last ned Enova bulk-data
```bash
# Manuell nedlasting fra https://data.enova.no/ (bulk-eksport)
# Lagre som: data/raw/enova-energimerker-oslo-2024.csv
```

#### 0.2 Opprett postnummer → bydel mapping
**Ny fil:** `scripts/build-postnummer-mapping.ts`
```typescript
// Les Matrikkel CSV og bygg mapping
// Input: data/raw/Matrikkel 2023.csv
// Output: src/data/postnummer-bydel.json
```

#### 0.3 Aggreger bydelsstatistikk
**Ny fil:** `scripts/aggregate-district-stats.ts`
```typescript
// Les Enova CSV, mapp til bydel, aggreger
// Output struktur:
interface DistrictStatistics {
  [bydel: string]: {
    [boligtype: string]: {
      antall: number;
      snittKwhPerM2: number;
      medianKwhPerM2: number;
      karakterFordeling: { [karakter: string]: number };
      percentiler: { p10: number; p25: number; p50: number; p75: number; p90: number };
    }
  }
}
```

### Fase 1: Mock-data og typer

#### 1.1 Opprett type-definisjoner
**Ny fil:** `src/types/districtStatistics.ts`
```typescript
export interface DistrictStats {
  avgKwhPerM2: number;
  medianKwhPerM2: number;
  count: number;
  percentiles: {
    p10: number;
    p25: number;
    p50: number;
    p75: number;
    p90: number;
  };
  energyGradeDistribution: {
    A: number;
    B: number;
    C: number;
    D: number;
    E: number;
    F: number;
    G: number;
  };
}

export interface DistrictStatisticsData {
  lastUpdated: string;
  source: 'enova-bulk' | 'mock';
  districts: {
    [districtName: string]: {
      småhus: DistrictStats;
      blokk: DistrictStats;
    };
  };
  subdistricts: {
    // Nøkkelformat: "Bydel/Delbydel" (f.eks. "Nordre Aker/Tåsen")
    [subdistrictKey: string]: {
      småhus: DistrictStats;
      blokk: DistrictStats;
    };
  };
  oslo: {
    småhus: DistrictStats;
    blokk: DistrictStats;
  };
}
```

#### 1.2 Opprett mock-data
**Ny fil:** `src/data/mock-district-statistics.json`
```json
{
  "lastUpdated": "2024-01-22",
  "source": "mock",
  "districts": {
    "Nordre Aker": {
      "småhus": {
        "avgKwhPerM2": 142,
        "medianKwhPerM2": 138,
        "count": 2847,
        "percentiles": { "p10": 95, "p25": 115, "p50": 138, "p75": 165, "p90": 195 },
        "energyGradeDistribution": { "A": 3, "B": 8, "C": 18, "D": 28, "E": 24, "F": 14, "G": 5 }
      },
      "blokk": { ... }
    },
    "Frogner": { ... },
    // ... alle 15 bydeler
  },
  "subdistricts": {
    "Nordre Aker/Tåsen": {
      "småhus": {
        "avgKwhPerM2": 139,
        "medianKwhPerM2": 135,
        "count": 487,
        "percentiles": { "p10": 92, "p25": 112, "p50": 135, "p75": 162, "p90": 192 },
        "energyGradeDistribution": { "A": 4, "B": 9, "C": 19, "D": 27, "E": 23, "F": 13, "G": 5 }
      },
      "blokk": { ... }
    },
    "Nordre Aker/Ullevål": { ... },
    // ... alle ~80 delbydeler
  },
  "oslo": {
    "småhus": { "avgKwhPerM2": 156, ... },
    "blokk": { "avgKwhPerM2": 148, ... }
  }
}
```

### Fase 2: Service-lag

#### 2.1 Opprett statistikk-service
**Ny fil:** `src/services/districtStatisticsService.ts`
```typescript
import mockData from '../data/mock-district-statistics.json';
import type { DistrictStatisticsData, DistrictStats } from '../types/districtStatistics';

let cachedData: DistrictStatisticsData | null = null;

export async function getDistrictStatistics(): Promise<DistrictStatisticsData> {
  if (cachedData) return cachedData;

  // TODO: Bytt til reell data-henting når tilgjengelig
  cachedData = mockData as DistrictStatisticsData;
  return cachedData;
}

export function getStatsForDistrict(
  data: DistrictStatisticsData,
  districtName: string,
  buildingType: 'småhus' | 'blokk'
): DistrictStats | null {
  const normalizedDistrict = normalizeDistrictName(districtName);
  return data.districts[normalizedDistrict]?.[buildingType] ?? null;
}

// NY: Hent statistikk for delbydel
export function createSubdistrictKey(
  districtName: string,
  subdistrictName: string
): string {
  const normalizedDistrict = normalizeDistrictName(districtName);
  const normalizedSubdistrict = normalizeDistrictName(subdistrictName);
  return `${normalizedDistrict}/${normalizedSubdistrict}`;
}

export function getStatsForSubdistrict(
  data: DistrictStatisticsData,
  districtName: string,
  subdistrictName: string,
  buildingType: 'småhus' | 'blokk'
): DistrictStats | null {
  const key = createSubdistrictKey(districtName, subdistrictName);
  return data.subdistricts?.[key]?.[buildingType] ?? null;
}

export function calculatePercentile(
  kwhPerM2: number,
  stats: DistrictStats
): number {
  const { percentiles } = stats;
  if (kwhPerM2 <= percentiles.p10) return 10;
  if (kwhPerM2 <= percentiles.p25) return 25;
  if (kwhPerM2 <= percentiles.p50) return 50;
  if (kwhPerM2 <= percentiles.p75) return 75;
  if (kwhPerM2 <= percentiles.p90) return 90;
  return 95;
}

function normalizeDistrictName(name: string): string {
  // Håndter varianter: "Nordre Aker", "NORDRE AKER", etc.
  return name.trim().split(' ')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}
```

### Fase 3: UI-komponenter

#### 3.1 Opprett DistrictComparison-komponent
**Ny fil:** `src/components/FigmaBlokk/components/DistrictComparison.tsx`
```typescript
// Se eksisterende kode i seksjon 11.5
// Legg til:
// - Hook for å hente statistikk
// - Håndtering av loading state
// - Animert overgang ved ekspandering
```

#### 3.2 Oppdater WhiteInfoBox.tsx

**Endringer som kreves:**

1. **Importer ny komponent og service** (linje ~20)
```typescript
import { DistrictComparison } from './DistrictComparison';
import { getDistrictStatistics, getStatsForDistrict } from '../../../services/districtStatisticsService';
```

2. **Legg til state for ekspandering** (linje ~200)
```typescript
const [isComparisonExpanded, setIsComparisonExpanded] = useState(false);
const [districtStats, setDistrictStats] = useState<DistrictStats | null>(null);
```

3. **Hent statistikk ved mount** (ny useEffect)
```typescript
useEffect(() => {
  getDistrictStatistics().then(data => {
    const buildingType = isBlockBuilding ? 'blokk' : 'småhus';
    const stats = getStatsForDistrict(data, districtName, buildingType);
    setDistrictStats(stats);
  });
}, [districtName, isBlockBuilding]);
```

4. **Plasser ny seksjon mellom savings card og map** (linje ~930)
```tsx
{/* Ny: Bydelssammenligning */}
{districtStats && (
  <foreignObject x="0" y={savingsCardY + SAVINGS_CARD_HEIGHT + 8} width={BOX_WIDTH} height={isComparisonExpanded ? 150 : 50}>
    <DistrictComparison
      isExpanded={isComparisonExpanded}
      onToggle={() => setIsComparisonExpanded(!isComparisonExpanded)}
      currentKwhPerM2={parseFloat(savedEnergiforbruk) / parseFloat(savedAreal)}
      totalEnergySavings={totalEnergySavings}
      bruksareal={parseFloat(savedAreal)}
      districtName={districtName}
      districtStats={districtStats}
    />
  </foreignObject>
)}
```

5. **Juster MAP_TOP_Y dynamisk** basert på ekspandert tilstand

#### 3.3 Oppdater WhiteInfoBox.css
**Legg til nye stiler** (se seksjon 11.4)

### Fase 4: Integrasjon og testing

#### 4.1 Oppdater FigmaMainScript.tsx
Ingen endringer nødvendig - data flyter allerede riktig.

#### 4.2 Skriv tester
**Ny fil:** `tests/components/DistrictComparison.test.tsx`
```typescript
// Test percentil-beregning
// Test ekspandering/kollapsing
// Test dynamisk oppdatering ved tiltak-endring
```

### Fase 5: Mobil-versjon (fremtidig)

#### 5.1 Opprett MobileDistrictComparison
**Ny fil:** `src/components/mobile/MobileDistrictComparison.tsx`

#### 5.2 Integrer i MobileInfoBox.tsx

---

## 15. Filendringer - Oppsummering

| Fil | Endring | Prioritet |
|-----|---------|-----------|
| `src/types/districtStatistics.ts` | **NY** - Type-definisjoner | P1 |
| `src/data/mock-district-statistics.json` | **NY** - Mock-data | P1 |
| `src/services/districtStatisticsService.ts` | **NY** - Service for statistikk | P1 |
| `src/components/FigmaBlokk/components/DistrictComparison.tsx` | **NY** - Sammenligningskomponent | P1 |
| `src/components/FigmaBlokk/components/WhiteInfoBox.tsx` | **MODIFISER** - Integrer ny seksjon | P1 |
| `src/components/FigmaBlokk/components/WhiteInfoBox.css` | **MODIFISER** - Nye stiler | P1 |
| `scripts/build-postnummer-mapping.ts` | **NY** - Bygge mapping | P2 |
| `scripts/aggregate-district-stats.ts` | **NY** - Aggreger statistikk | P2 |
| `src/components/mobile/MobileDistrictComparison.tsx` | **NY** - Mobil-versjon | P3 |

---

## 16. Risikoer og avhengigheter

### Avhengigheter
1. **Enova bulk-data** - Må lastes ned manuelt fra portal
2. **Matrikkel CSV** - Allerede tilgjengelig i `data/raw/`
3. **Punkt-komponenter** - Allerede integrert

### Risikoer
| Risiko | Sannsynlighet | Konsekvens | Mitigering |
|--------|---------------|------------|------------|
| Enova API endrer format | Lav | Medium | Versjonshåndtering i scripts |
| SVG-layout i WhiteInfoBox bryter | Medium | Høy | Grundig testing av Y-koordinater |
| Statistikk blir utdatert | Medium | Lav | Månedlig oppdateringsrutine |
| Postnummer-mapping ufullstendig | Lav | Medium | Fallback til Oslo-snitt |

---

*Sist oppdatert: 22. januar 2026*

---

## 17. Fremdriftsplan (hold oppdatert under implementering)

> ⚠️ **DENNE SEKSJONEN SKAL HOLDES OPPDATERT UNDER IMPLEMENTERING**

### Status: ⚠️ UI ferdig, men bruker MOCK-DATA

> **Viktig:** Løsningen er funksjonell, men bruker mock-data fordi Enova bulk-CSV aldri ble lastet ned. **Se seksjon 21 for instruksjoner om å aktivere ekte data.**
>
> **Hva er ferdig:**
> - ✅ Modal-basert visning med knapp på kartet
> - ✅ Toggle mellom bydel og delbydel
> - ✅ ArcGIS-integrasjon for supplerende data
> - ✅ Aggregeringsscript klart til bruk
>
> **Hva mangler:**
> - ❌ Enova bulk-CSV må lastes ned manuelt fra https://data.enova.no/
> - ❌ Aggregeringsscript må kjøres for å generere ekte statistikk

| Oppgave | Status | Fil(er) | Kommentar |
|---------|--------|---------|-----------|
| **Fase 1: Mock-data og typer** ||||
| 1.1 Type-definisjoner | ✅ Ferdig | `src/types/districtStatistics.ts` | Inkluderer delbydel-støtte |
| 1.2 Mock-data JSON | ✅ Ferdig | `src/data/mock-district-statistics.json` | Alle 15 bydeler + ~80 delbydeler |
| **Fase 2: Service-lag** ||||
| 2.1 Statistikk-service | ✅ Ferdig | `src/services/districtStatisticsService.ts` | Inkluderer `getStatsForSubdistrict()` |
| **Fase 3: UI-komponenter** ||||
| 3.1 DistrictComparison-karusell | ✅ Ferdig | `src/components/FigmaBlokk/components/DistrictComparison/index.tsx` | Med bydel/delbydel toggle |
| 3.2 DistrictComparisonModal | ✅ Ferdig | `src/components/FigmaBlokk/components/DistrictComparison/DistrictComparisonModal.tsx` | Modal-wrapper med backdrop |
| 3.3 Integrasjon i WhiteInfoBox | ✅ Ferdig | `src/components/FigmaBlokk/components/WhiteInfoBox.tsx` | Henter og sender delbydel-data |
| 3.4 CSS-stiler (karusell) | ✅ Ferdig | `src/components/FigmaBlokk/components/DistrictComparison/DistrictComparisonCarousel.css` | Med toggle-stiler |
| 3.5 CSS-stiler (modal) | ✅ Ferdig | `src/components/FigmaBlokk/components/DistrictComparison/DistrictComparisonModal.css` | |
| **Fase 4: Delbydel-støtte** ||||
| 4.1 Utvid mock-data med delbydeler | ✅ Ferdig | `mock-district-statistics.json` | ~80 delbydeler med variasjon |
| 4.2 Service-funksjoner for delbydel | ✅ Ferdig | `districtStatisticsService.ts` | `getStatsForSubdistrict()`, `createSubdistrictKey()` |
| 4.3 Backend: delbydelsnavn i API-respons | ✅ Ferdig | `buildingApi.ts`, `resultAssembler.ts` | Matrikkel-data sendes til frontend |
| 4.4 UI: Toggle mellom bydel/delbydel | ✅ Ferdig | `DistrictComparison/index.tsx` | Bruker kan velge nivå |
| **Fase 5: Testing** ||||
| 5.1 Build verifisert | ✅ Ferdig | | `npm run build` kjører uten feil |
| 5.2 Visuell testing | ⬜ Venter | | Kjør `npm run dev` og test manuelt |

### Logg

| Dato | Aktivitet | Detaljer |
|------|-----------|----------|
| 22.01.2026 | Implementering startet | Fremdriftsplan opprettet |
| 22.01.2026 | Type-definisjoner ferdig | `src/types/districtStatistics.ts` opprettet |
| 22.01.2026 | Mock-data ferdig | Alle 15 bydeler med statistikk |
| 22.01.2026 | Service-lag ferdig | Beregninger og hjelpefunksjoner |
| 22.01.2026 | UI-komponenter ferdig | DistrictComparison + CSS |
| 22.01.2026 | Integrasjon ferdig | Lagt til i WhiteInfoBox |
| 22.01.2026 | Build verifisert | Ingen kompileringsfeil |
| 22.01.2026 | Layout-fix | Kartet flytter seg nå dynamisk ned basert på bydelssammenligning |
| 22.01.2026 | **Modal-refaktorering** | Byttet fra PktAccordion til modal-visning. Knapp på kartet, modal sentrert på siden |
| 22.01.2026 | **Delbydel-støtte implementert** | delbydelsnavn fra Matrikkel sendes til frontend, mock-data utvidet med ~80 delbydeler, toggle i UI |
| 22.01.2026 | **Dropdown-meny for områdevalg** | Byttet fra toggle-knapper til PktSelect dropdown under korttittelen. Tittelen endres dynamisk ("Sammenlign med bydel" / "Sammenlign med delbydel") |

### Neste steg
- [ ] Kjør `npm run dev` og test visuelt
- [ ] Finjuster dropdown-styling om nødvendig

---

## 18. Karusell-implementering med Punkt

> **Merk:** Punkt har ingen native karusell-komponent. Vi bygger en tilpasset løsning med `PktButton` og chevron-ikoner.

### 18.1 Designvalg for navigasjon

#### Alternativ A: Pil-navigasjon (anbefalt)
```
┌─────────────────────────────────────────────────────────────────┐
│  ◀  Sammenlign med naboene (1/3)                            ▶  │
├─────────────────────────────────────────────────────────────────┤
│  [Kort-innhold vises her]                                       │
└─────────────────────────────────────────────────────────────────┘
```

**Fordeler:**
- Kompakt design som passer i WhiteInfoBox
- Tydelig navigasjon med piler
- Indikator viser posisjon (1/3, 2/3, 3/3)

#### Alternativ B: Dot-navigasjon
```
┌─────────────────────────────────────────────────────────────────┐
│  Sammenlign med naboene                                         │
├─────────────────────────────────────────────────────────────────┤
│  [Kort-innhold vises her]                                       │
│                                                                 │
│                        ● ○ ○                                    │
└─────────────────────────────────────────────────────────────────┘
```

### 18.2 Karusell-arkitektur

#### Nye filer
```
src/components/FigmaBlokk/components/
├── DistrictComparison/
│   ├── index.tsx                      # Hovedkomponent med karusell
│   ├── DistrictComparison.css         # Felles stiler
│   ├── cards/
│   │   ├── ComparisonCard.tsx         # Kort 2.1: kWh-sammenligning
│   │   ├── EnergyGradeCard.tsx        # Kort 2.2: A-G fordeling
│   │   └── ImprovementCard.tsx        # Kort 2.3: Forbedringspotensial
│   └── CarouselNavigation.tsx         # Navigasjonsknapper
```

#### Karusell-komponent (React)

```tsx
import React, { useState } from 'react';
import { PktButton, PktIcon } from '@oslokommune/punkt-react';
import { ComparisonCard } from './cards/ComparisonCard';
import { EnergyGradeCard } from './cards/EnergyGradeCard';
import { ImprovementCard } from './cards/ImprovementCard';

interface DistrictComparisonCarouselProps {
  currentKwhPerM2: number;
  totalEnergySavings: number;
  bruksareal: number;
  districtName: string;
  districtStats: DistrictStats;
}

const CARDS = [
  { id: 'comparison', title: 'Sammenlign med bydel', Component: ComparisonCard },
  { id: 'distribution', title: 'Energikarakter-fordeling', Component: EnergyGradeCard },
  { id: 'improvement', title: 'Forbedringspotensial', Component: ImprovementCard },
];

export const DistrictComparisonCarousel: React.FC<DistrictComparisonCarouselProps> = (props) => {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isExpanded, setIsExpanded] = useState(false);

  const goToPrevious = () => {
    setActiveIndex((prev) => (prev === 0 ? CARDS.length - 1 : prev - 1));
  };

  const goToNext = () => {
    setActiveIndex((prev) => (prev === CARDS.length - 1 ? 0 : prev + 1));
  };

  const ActiveCard = CARDS[activeIndex].Component;

  return (
    <div className="district-carousel">
      <div className="district-carousel__header">
        <PktButton
          skin="tertiary"
          size="small"
          variant="icon-only"
          iconName="chevron-left"
          onClick={goToPrevious}
          aria-label="Forrige kort"
          disabled={!isExpanded}
        />

        <button
          className="district-carousel__title"
          onClick={() => setIsExpanded(!isExpanded)}
          aria-expanded={isExpanded}
        >
          <span>{CARDS[activeIndex].title}</span>
          <span className="district-carousel__indicator">
            ({activeIndex + 1}/{CARDS.length})
          </span>
          <PktIcon name={isExpanded ? 'chevron-thin-up' : 'chevron-thin-down'} />
        </button>

        <PktButton
          skin="tertiary"
          size="small"
          variant="icon-only"
          iconName="chevron-right"
          onClick={goToNext}
          aria-label="Neste kort"
          disabled={!isExpanded}
        />
      </div>

      <div
        className={`district-carousel__content ${
          isExpanded ? 'district-carousel__content--expanded' : ''
        }`}
      >
        <ActiveCard {...props} />
      </div>

      {/* Dot-indikatorer */}
      {isExpanded && (
        <div className="district-carousel__dots">
          {CARDS.map((card, index) => (
            <button
              key={card.id}
              className={`district-carousel__dot ${
                index === activeIndex ? 'district-carousel__dot--active' : ''
              }`}
              onClick={() => setActiveIndex(index)}
              aria-label={`Gå til ${card.title}`}
            />
          ))}
        </div>
      )}
    </div>
  );
};
```

#### CSS for karusell

```css
.district-carousel {
  width: 100%;
}

.district-carousel__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--pkt-spacing-8, 0.5rem);
}

.district-carousel__title {
  display: flex;
  align-items: center;
  gap: var(--pkt-spacing-8, 0.5rem);
  background: none;
  border: none;
  cursor: pointer;
  font-family: 'Oslo Sans', sans-serif;
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--pkt-color-brand-dark-blue-1000, #2a2859);
  flex: 1;
  justify-content: center;
}

.district-carousel__indicator {
  font-weight: 300;
  color: var(--pkt-color-brand-neutrals-500, #666);
}

.district-carousel__content {
  max-height: 0;
  overflow: hidden;
  transition: max-height 0.3s ease-out, opacity 0.2s ease-out;
  opacity: 0;
}

.district-carousel__content--expanded {
  max-height: 300px;
  opacity: 1;
}

.district-carousel__dots {
  display: flex;
  justify-content: center;
  gap: var(--pkt-spacing-8, 0.5rem);
  padding-top: var(--pkt-spacing-8, 0.5rem);
}

.district-carousel__dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  border: none;
  background-color: var(--pkt-color-brand-neutrals-300, #ccc);
  cursor: pointer;
  transition: background-color 0.2s ease;
}

.district-carousel__dot--active {
  background-color: var(--pkt-color-brand-dark-blue-1000, #2a2859);
}

.district-carousel__dot:hover {
  background-color: var(--pkt-color-brand-dark-blue-800, #3d3a7a);
}
```

### 18.3 De tre sammenligningskortene

#### Kort 2.1: Sammenligning mot bydel (ComparisonCard)

```tsx
// Viser: kWh/m² sammenligning med bydelssnitt
// Bruker: PktProgressbar eller custom bar
// Innhold:
// - Din bolig: X kWh/m²
// - Bydelssnitt: Y kWh/m²
// - Prosentforskjell
// - Motiverende melding
```

#### Kort 2.2: Energikarakter-fordeling (EnergyGradeCard)

```tsx
// Viser: A-G fordeling for bydelen
// Bruker: PktProgressbar for hver karakter
// Innhold:
// - 7 rader (A-G) med prosentandel
// - Markering av brukerens karakter
// - Fargekodet etter energikarakter
```

#### Kort 2.3: Forbedringspotensial (ImprovementCard)

```tsx
// Viser: Hva skjer hvis bruker forbedrer seg
// Bruker: Visuell sammenligning nå vs mål
// Innhold:
// - Nåværende percentil
// - Projisert percentil med tiltak
// - Visuell fremstilling av forbedring
```

---

## 19. API-integrasjon for ekte data

### 19.1 Enova Bulk API

#### Datainnhenting

**Kilde:** https://data.enova.no/ (Bulk-eksport)

**Prosess:**
1. Last ned månedlig CSV-eksport for Oslo (kommunenummer 0301)
2. Parse CSV og aggreger per postnummer
3. Mapp postnummer → bydel via Matrikkel-data
4. Beregn statistikk per bydel og boligtype

**Ny script:** `scripts/fetch-enova-data.ts`

```typescript
interface EnovaCsvRow {
  Registreringsnummer: string;
  Postnummer: string;
  Kommunenummer: string;
  Bygningskategori: string;
  Energikarakter: string;
  OppvarmingsKarakter: string;
  BeregnetLevertEnergi: number;
  BRA: number;
  Byggeaar: number;
}

async function processEnovaData(csvPath: string): Promise<DistrictStatisticsData> {
  // 1. Les CSV
  // 2. Filtrer på Oslo (kommunenummer 0301)
  // 3. Mapp postnummer til bydel
  // 4. Gruppér etter bydel og boligtype
  // 5. Beregn statistikk (snitt, median, percentiler)
  // 6. Generer JSON-output
}
```

#### Postnummer → Bydel mapping

**Ny fil:** `src/data/postnummer-bydel-mapping.json`

```json
{
  "0271": { "bydel": "Frogner", "delbydel": "Frogner" },
  "0585": { "bydel": "Bjerke", "delbydel": "Veitvet" },
  "0661": { "bydel": "Gamle Oslo", "delbydel": "Ensjø" },
  "0491": { "bydel": "Nordre Aker", "delbydel": "Tåsen" }
}
```

**Script for å bygge mapping:** `scripts/build-postnummer-mapping.ts`
- Leser `data/raw/Matrikkel 2023.csv`
- Ekstraherer unik postnummer → bydel kobling
- Genererer JSON-fil

### 19.2 ArcGIS Oslo kommune

**API-endepunkt:**
```
https://services-eu1.arcgis.com/Hky23fkHucfDZYMu/arcgis/rest/services/
KPA_variert_boligstruktur/FeatureServer/0/query
```

**Bruksområde:** Supplerende data om boligstruktur per bydel

**Eksempel-kall:**
```typescript
async function fetchArcGISDistrictData(bydel: string) {
  const params = new URLSearchParams({
    where: `Bydel='${bydel}'`,
    outStatistics: JSON.stringify([
      { statisticType: 'count', onStatisticField: 'OBJECTID', outStatisticFieldName: 'total' }
    ]),
    groupByFieldsForStatistics: 'Bygningstype',
    f: 'json'
  });

  const response = await fetch(`${ARCGIS_BASE_URL}/query?${params}`);
  return response.json();
}
```

### 19.3 Service-oppdatering

**Oppdater:** `src/services/districtStatisticsService.ts`

```typescript
// Legg til API-integrasjon
const DATA_SOURCE: 'mock' | 'enova' | 'api' =
  process.env.REACT_APP_DISTRICT_DATA_SOURCE as any || 'mock';

export async function getDistrictStatistics(): Promise<DistrictStatisticsData> {
  if (cachedData) return cachedData;

  switch (DATA_SOURCE) {
    case 'enova':
      cachedData = await fetchFromEnovaProcessedData();
      break;
    case 'api':
      cachedData = await fetchFromLiveAPI();
      break;
    default:
      cachedData = mockData as DistrictStatisticsData;
  }

  return cachedData;
}
```

---

## 20. Oppdatert fremdriftsplan

### Status: ✅ Fase 3 ferdig - API-integrasjon klar

| Oppgave | Status | Fil(er) | Prioritet |
|---------|--------|---------|-----------|
| **Fase 1: Grunnimplementasjon** | ✅ Ferdig | | |
| **Fase 2: Karusell og kort** | ✅ Ferdig | | |
| 2.1 Refaktorer til karusell-struktur | ✅ Ferdig | `DistrictComparison/index.tsx` | P1 |
| 2.2 Implementer navigasjonskomponent | ✅ Ferdig | Integrert i `index.tsx` | P1 |
| 2.3 Lag ComparisonCard (2.1) | ✅ Ferdig | `cards/ComparisonCard.tsx` | P1 |
| 2.4 Lag EnergyGradeCard (2.2) | ✅ Ferdig | `cards/EnergyGradeCard.tsx` | P1 |
| 2.5 Lag ImprovementCard (2.3) | ✅ Ferdig | `cards/ImprovementCard.tsx` | P1 |
| 2.6 Karusell CSS | ✅ Ferdig | `DistrictComparisonCarousel.css` | P1 |
| **Fase 2.5: Delbydel-støtte** | ✅ Ferdig | | P1 |
| 2.5.1 Utvid mock-data med delbydeler | ✅ Ferdig | `mock-district-statistics.json` | P1 |
| 2.5.2 Service-funksjoner for delbydel | ✅ Ferdig | `districtStatisticsService.ts` | P1 |
| 2.5.3 Backend: delbydelsnavn i respons | ✅ Ferdig | `buildingApi.ts`, `resultAssembler.ts` | P1 |
| 2.5.4 UI: Toggle bydel/delbydel | ✅ Ferdig | `DistrictComparison/index.tsx` | P1 |
| **Fase 3: API-integrasjon** | ✅ Ferdig | | |
| 3.1 Bygg postnummer→bydel mapping | ✅ Ferdig | Inkludert i aggregeringsscript | P2 |
| 3.2 Prosesser Enova bulk-data | ✅ Ferdig | `scripts/aggregate-district-statistics.ts` | P2 |
| 3.3 Integrer ArcGIS-data | ✅ Ferdig | `src/services/arcgisService.ts` | P3 |
| 3.4 Oppdater service for ekte data | ✅ Ferdig | `districtStatisticsService.ts` | P2 |
| **Fase 4: Mobil** | | | |
| 4.1 Mobil-versjon av karusell | ⬜ Venter | `mobile/MobileDistrictComparison.tsx` | P3 |

### Logg (fortsettelse)

| Dato | Aktivitet | Detaljer |
|------|-----------|----------|
| 22.01.2026 | Karusell-plan dokumentert | Seksjon 18 lagt til |
| 22.01.2026 | API-integrasjonsplan | Seksjon 19 med Enova og ArcGIS |
| 22.01.2026 | Fase 2 ferdig | Karusell med 3 kort implementert |
| 22.01.2026 | **Delbydel-støtte** | Mock-data utvidet med ~80 delbydeler, toggle i UI, backend oppdatert |
| 22.01.2026 | **Fase 3 ferdig** | Script for å prosessere Enova bulk-data, service oppdatert for ekte data |
| 22.01.2026 | **ArcGIS-integrasjon** | `arcgisService.ts` opprettet med KPA_variert_boligstruktur API, caching, retry-logikk |
| 22.01.2026 | **Analyse: Mock-data i bruk** | Oppdaget at løsningen fortsatt bruker mock-data. Enova CSV aldri lastet ned. Mock-data har identisk `energyGradeDistribution` for alle delbydeler (bug). Se seksjon 21. |

### Nye filer opprettet i Fase 2

```
src/components/FigmaBlokk/components/DistrictComparison/
├── index.tsx                         # Hovedkarusell-komponent
├── DistrictComparisonCarousel.css    # Stiler for karusell og kort
└── cards/
    ├── index.ts                      # Eksporter
    ├── ComparisonCard.tsx            # Kort 1: kWh/m² sammenligning
    ├── EnergyGradeCard.tsx           # Kort 2: A-G fordeling
    └── ImprovementCard.tsx           # Kort 3: Forbedringspotensial
```

### Nye filer opprettet i Fase 3

```
scripts/aggregate-district-statistics.ts   # Script for å aggregere Enova bulk-data
src/data/district-statistics-enova.json    # Placeholder for ekte data (genereres av script)
src/services/arcgisService.ts              # ArcGIS REST API integrasjon (KPA_variert_boligstruktur)
```

### Neste steg
- [ ] **KRITISK: Last ned Enova bulk CSV** (se seksjon 21)
- [ ] Kjør aggregeringsscript for å generere ekte statistikk
- [ ] Vurder å starte på Fase 4 (Mobil-versjon)
- [x] ~~ArcGIS-integrasjon~~ (ferdig - `src/services/arcgisService.ts`)

---

## 21. ⚠️ VIKTIG: Aktivere ekte data (må gjøres!)

### Nåværende status

**Løsningen bruker fortsatt MOCK-DATA** fordi:
1. Enova bulk CSV er aldri lastet ned
2. Placeholder-filen `src/data/district-statistics-enova.json` er tom
3. Service faller automatisk tilbake til mock-data

### Kjente problemer med mock-data

| Problem | Konsekvens |
|---------|------------|
| `energyGradeDistribution` er **identisk** for alle delbydeler | Energikarakter-fordelingen endres IKKE når bruker bytter fra bydel til delbydel |
| Percentiler har lite variasjon | "Din posisjon" endres minimalt mellom områder |
| Antall boliger (`count`) er fiktive | Viser ikke reell datadekning |

### Hva må gjøres for ekte data

#### Steg 1: Last ned Enova bulk-data (manuelt)

1. Gå til **https://data.enova.no/**
2. Logg inn (krever tilgang)
3. Naviger til **Bulk-eksport** eller **Datakatalog**
4. Last ned CSV for energiattester i Oslo (kommunenummer 0301)
5. Lagre filen som: `data/raw/enova-energimerker-oslo.csv`

**Forventet CSV-format:**
```csv
Registreringsnummer,Postnummer,Kommunenummer,Bygningskategori,Energikarakter,OppvarmingsKarakter,BeregnetLevertEnergi,BRA,Byggeaar,...
```

#### Steg 2: Kjør aggregeringsscript

```bash
npx tsx scripts/aggregate-district-statistics.ts
```

Scriptet vil:
1. Parse Enova CSV og filtrere for Oslo (kommunenummer 0301)
2. Mappe postnummer → bydel/delbydel via Matrikkel-data
3. Beregne statistikk (snitt, median, percentiler, energikarakter-fordeling) per område og boligtype
4. Skrive resultat til `src/data/district-statistics-enova.json`

#### Steg 3: Verifiser at ekte data brukes

```bash
# Sjekk at filen har riktig source
cat src/data/district-statistics-enova.json | jq '.source, .lastUpdated'
# Skal vise: "enova-bulk" og en dato (ikke "placeholder")

# Sjekk at data finnes
cat src/data/district-statistics-enova.json | jq '.districts | keys | length'
# Skal vise: 15 (antall bydeler)

# Kjør appen og verifiser i console
npm run dev
# Se etter: "📊 Bruker ekte Enova-statistikk (oppdatert: YYYY-MM-DD)"
```

### Service-logikk (`districtStatisticsService.ts`)

```typescript
// Filen laster data i denne prioritetsrekkefølgen:
1. district-statistics-enova.json (hvis source === 'enova-bulk' && lastUpdated !== 'placeholder')
2. mock-district-statistics.json (fallback)
```

### Alternativ: Bruk Enova API direkte

Hvis bulk-nedlasting ikke er mulig, kan man vurdere å:
1. Bruke Enova sitt offentlige API (`/ems/offentlige-data/v1/Energiattest`)
2. Hente energiattester for alle postnumre i Oslo
3. Aggregere statistikken on-the-fly eller via scheduled job

**Merk:** API-et har begrensninger (maks 25 treff per søk), så dette krever paginering.

---

## 22. Bruksanvisning: Generere ekte bydelsstatistikk (detaljert)

### Forutsetninger

1. **Last ned Enova bulk-data:**
   - Gå til https://data.enova.no/
   - Naviger til bulk-eksport
   - Last ned CSV for Oslo (kommunenummer 0301)
   - Lagre som: `data/raw/enova-energimerker-oslo.csv`

### Kjør aggregeringsscript

```bash
npx tsx scripts/aggregate-district-statistics.ts
```

Scriptet vil:
1. Parse Enova CSV og filtrer for Oslo
2. Mappe postnummer til bydel/delbydel
3. Aggregere statistikk (snitt, median, percentiler) per bydel og boligtype
4. Skrive resultat til `src/data/district-statistics-enova.json`

### Verifiser resultat

```bash
# Se sammendrag
cat src/data/district-statistics-enova.json | jq '.districts | keys'

# Sjekk antall
cat src/data/district-statistics-enova.json | jq '.oslo.småhus.count, .oslo.blokk.count'
```

### Service-oppførsel

`districtStatisticsService.ts` laster automatisk ekte data hvis tilgjengelig:
- Hvis `district-statistics-enova.json` har `source: "enova-bulk"` → bruker ekte data
- Ellers → fallback til mock-data

---

*Sist oppdatert: 22. januar 2026*
*Status: Fase 3 ferdig - API-integrasjon klar for ekte Enova-data*
