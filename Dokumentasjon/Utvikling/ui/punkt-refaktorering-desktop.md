# Refaktorering av desktop-visning til Punkt designsystem

## Bakgrunn

Desktop-visningen (side 2) bruker i dag en custom SVG-basert implementasjon, mens mobilvisningen konsekvent bruker komponenter fra Oslo kommunes Punkt designsystem. Dette dokumentet beskriver planen for å refaktorere desktop-visningen til å bruke Punkt-komponenter i større grad.

### Nåværende tilstand

| Komponent | Desktop | Mobil |
|-----------|---------|-------|
| Info-boks | SVG med `foreignObject` | `PktAccordion`, `PktTag`, `PktAlert` |
| Tiltak-liste | SVG-basert med hover | `PktCheckbox`, `PktButton` |
| Badges | SVG-rektangler | `PktTag` |
| Knapper | SVG med click handlers | `PktButton` |
| Varsler | Custom SVG overlay | `PktAlert` |

### Fordeler med refaktorering

1. **Konsistent brukeropplevelse** - Samme visuelle språk på desktop og mobil
2. **Bedre tilgjengelighet (a11y)** - Punkt-komponenter er testet for universell utforming
3. **Enklere vedlikehold** - Mindre custom kode, oppdateringer følger designsystemet
4. **Raskere utvikling** - Gjenbruk av velprøvde komponenter

---

## Status for refaktoreringsarbeidet

### Fullførte steg

| Steg | Beskrivelse | Status | Dato |
|------|-------------|--------|------|
| 1.0 | Sentral badge-konfigurasjon (inkl. byggeår-badge) | ✅ Fullført | 2025-12-14 |
| 1.1 | CSS-grunnstruktur (badges.css) | ✅ Fullført | 2025-12-14 |
| 1.2 | Erstatte SVG-badges med PktTag i WhiteInfoBox | ✅ Fullført | 2025-12-14 |
| 1.6 | Oppdatere MobileInfoBox med badge-ikoner | ✅ Fullført | 2025-12-14 |
| - | Oppdatere MobileEnergySolutions med badge-ikoner | ✅ Fullført | 2025-12-14 |
| 1.3 | Refaktorere Nøkkelinformasjon fra SVG til HTML/CSS med PktButton | ✅ Fullført | 2025-12-14 |
| 1.4 | Erstatte Gul liste-varsling med PktAccordion | ✅ Fullført | 2025-12-15 |
| 1.5 | Refaktorere besparelseskortet | ✅ Fullført | 2025-12-15 |
| 2.0 | CSS-grunnstruktur for EnergySolutionButtons | ✅ Fullført | 2025-12-15 |
| 2.1 | Refaktorere tiltak-listen fra SVG til HTML | ✅ Fullført | 2025-12-15 |
| 2.2 | Refaktorere "Hvordan gjennomføre tiltakene"-knappen | ✅ Fullført | 2025-12-15 |
| 2.3 | Oppdatere info-modal med PktIcon og CSS-klasser | ✅ Fullført | 2025-12-15 |
| 2.5 | Fjerne injisert CSS og rydde opp | ✅ Fullført | 2025-12-15 |

### Pågående arbeid

| Steg | Beskrivelse | Status |
|------|-------------|--------|
| 2.6 | Testing og finjustering (Fase 2) | 🔄 Neste |

### Gjenstående arbeid

| Steg | Beskrivelse | Status |
|------|-------------|--------|
| 1.7 | Sikre transitions og animasjoner (Fase 1) | ⏳ Venter |
| 1.8 | Testing og finjustering (Fase 1) | ⏳ Venter |

### Deloppgave fullført: Sentraliserte ordforklaringer for Gul liste

**Dato:** 2025-12-15

Ordforklaringene i Gul liste-overlay er nå integrert med det sentrale ordforklaringssystemet:

**Nye ordforklaringer lagt til i `content/dictionaries/index.json`:**
- `Byantikvarens` - Oslo Byantikvar er kommunens faginstans for kulturminnevern
- `kommunalt listeført` - Bygget er registrert i Gul liste og vurdert som verneverdig
- `vernet etter plan- og bygningsloven` - Bygget er sikret gjennom kommuneplan/reguleringsplan
- `fredet` - Bygget er vernet etter kulturminneloven av Riksantikvaren

**Endringer i WhiteInfoBox.tsx:**
- Importerer `useContentDictionary` og `glossaryHelpers`
- Bruker `renderParagraphWithGlossary` for automatisk tooltip-visning
- Fjernet 4 manuelle tooltip-states til fordel for én `hoveredGlossaryTerm`
- Ordforklaringene kan nå redigeres via admin-verktøyet under "Ordbok"

---

## Opprettede filer

Følgende filer er opprettet som del av refaktoreringsarbeidet:

| Fil | Beskrivelse |
|-----|-------------|
| `src/config/badgeConfig.ts` | Sentral konfigurasjon for badges/tags med ikoner |
| `src/config/badges.css` | Sentral CSS-styling for PktTag med ikoner |
| `src/components/FigmaBlokk/components/WhiteInfoBox.css` | CSS-stilark for WhiteInfoBox |
| `src/components/FigmaBlokk/components/Tiltak/glossaryHelpers.tsx` | Oppdatert for bedre mellomrom-håndtering |

---

## Overordnet plan

### Fase 1: WhiteInfoBox refaktorering
Refaktorere info-boksen til å bruke Punkt-komponenter for badges, nøkkelinformasjon, gul liste-varsling og redigeringsfunksjonalitet.

**Estimert kompleksitet:** Middels-høy
**Berørte filer:** `WhiteInfoBox.tsx`, `WhiteInfoBox.css` (ny), `badgeConfig.ts` (ny)

### Fase 2: EnergySolutionButtons refaktorering
Refaktorere tiltak-listen til å bruke Punkt-komponenter for checkbox-valg og knapper.

**Estimert kompleksitet:** Middels
**Berørte filer:** `EnergySolutionButtons.tsx`, `EnergySolutionButtons.css`

### Fase 3: Felles styling og polish
Sikre visuell konsistens, teste animasjoner og transitions, og optimalisere ytelse.

**Estimert kompleksitet:** Lav-middels
**Berørte filer:** Diverse CSS-filer, potensielt felles utilities

---

## Fase 1: WhiteInfoBox - Detaljert implementeringsplan

### Oversikt over nåværende WhiteInfoBox

Komponenten er ~1870 linjer og inneholder:
- Adressevisning med dynamisk skalering
- Badges for bydel og bygningstype (SVG-rektangler)
- "Nøkkelinformasjon"-seksjon med redigeringsmodus
- Energiforbruk-visning
- Besparelseskort med animerte tall
- Kartvisning (OpenStreetMap tiles)
- Gul liste info-overlay
- Tiltak-preview når utvidet

---

### Steg 1.0: Sentral badge-konfigurasjon (✅ FULLFØRT)

**Mål:** Sikre visuell konsistens for badges mellom desktop og mobil ved å ha én sentral konfigurasjon for ikoner og farger.

**Opprettet fil:** `src/config/badgeConfig.ts`

**Innhold:**

```typescript
// Sentral konfigurasjon for badges/tags brukt i applikasjonen.
// Sikrer visuell konsistens mellom desktop og mobil.

export type BadgeType = 'district' | 'buildingType';

export interface BadgeConfig {
  /** Punkt-ikonnavn (uten .svg) */
  iconName: string;
  /** PktTag skin */
  skin: 'green' | 'blue' | 'yellow' | 'red' | 'grey';
  /** Aria-label prefix for tilgjengelighet */
  ariaLabelPrefix: string;
}

// Badge for bydel
export const DISTRICT_BADGE: BadgeConfig = {
  iconName: 'location-pin',
  skin: 'green',
  ariaLabelPrefix: 'Bydel',
};

// Badge for bygningstype - varierer basert på type
export const BUILDING_TYPE_BADGES: Record<string, BadgeConfig> = {
  // Blokk/leilighetsbygg bruker 'organization'-ikonet
  blokk: { iconName: 'organization', skin: 'blue', ariaLabelPrefix: 'Bygningstype' },
  'store boligbygg': { iconName: 'organization', skin: 'blue', ariaLabelPrefix: 'Bygningstype' },

  // Småhus bruker 'home'-ikonet
  enebolig: { iconName: 'home', skin: 'blue', ariaLabelPrefix: 'Bygningstype' },
  tomannsbolig: { iconName: 'home', skin: 'blue', ariaLabelPrefix: 'Bygningstype' },
  rekkehus: { iconName: 'home', skin: 'blue', ariaLabelPrefix: 'Bygningstype' },
};

// Hjelpefunksjoner
export function getBuildingTypeBadgeConfig(buildingTypeName: string): BadgeConfig;
export function isBlockBuilding(buildingTypeName: string): boolean;
export function getDisplayBuildingTypeName(buildingTypeName: string): string;
```

**Punkt-ikoner brukt:**

| Badge | Ikon | Skin | Beskrivelse |
|-------|------|------|-------------|
| Bydel | `map` | green | Geografisk plassering (kart-ikon) |
| Bygningstype (blokk) | `organization` | blue | Store boligbygg/blokk |
| Bygningstype (småhus) | `home` | blue | Enebolig, rekkehus, tomannsbolig |
| Byggeår | `tool` | beige | Bygningens alder |

**Bruk i komponenter:**

```tsx
import {
  DISTRICT_BADGE,
  BUILDING_YEAR_BADGE,
  getBuildingTypeBadgeConfig,
  getDisplayBuildingTypeName,
} from '../../config/badgeConfig';
import '../../config/badges.css';

// I render:
const buildingBadge = getBuildingTypeBadgeConfig(buildingTypeName);
const displayName = getDisplayBuildingTypeName(buildingTypeName);

<PktTag skin={DISTRICT_BADGE.skin}>
  <PktIcon name={DISTRICT_BADGE.iconName} />
  <span>{districtName}</span>
</PktTag>

<PktTag skin={buildingBadge.skin}>
  <PktIcon name={buildingBadge.iconName} />
  <span>{displayName}</span>
</PktTag>
```

**Akseptansekriterier:**
- [x] Konfigurasjonsfil opprettet
- [x] Alle bygningstyper mappet til riktig ikon
- [x] Hjelpefunksjoner for å hente konfigurasjon
- [x] Desktop bruker konfigurasjonen (Steg 1.2)
- [x] Mobil bruker konfigurasjonen (Steg 1.6)

---

### Steg 1.1: Opprette CSS-fil og grunnstruktur (✅ FULLFØRT)

**Mål:** Flytte fra inline styles til CSS-klasser for bedre struktur.

**Opprettet fil:** `src/components/FigmaBlokk/components/WhiteInfoBox.css`

**Innhold:**
- CSS custom properties som bygger på Punkt-variabler
- Layout-klasser for container og content
- Styling for header, badges, info-rader
- Redigeringsmodus-styling
- Besparelseskort-styling
- Gul liste overlay-styling
- Punkt accordion-tilpasninger
- Support for `prefers-reduced-motion`

**CSS-variabler definert:**

```css
.white-info-box {
  --wib-bg: var(--pkt-color-brand-neutrals-white, #ffffff);
  --wib-text-primary: var(--pkt-color-brand-dark-blue-1000, #2a2859);
  --wib-text-secondary: var(--pkt-color-brand-neutrals-600, #666666);
  --wib-spacing-sm: var(--pkt-spacing-8, 0.5rem);
  --wib-spacing-md: var(--pkt-spacing-16, 1rem);
  --wib-spacing-lg: var(--pkt-spacing-24, 1.5rem);
  --wib-font-family: 'Oslo Sans', sans-serif;

  /* Besparelseskort */
  --wib-savings-bg: var(--pkt-color-status-green-95, #c7f6c9);
  --wib-savings-text: var(--pkt-color-status-green-10, #102c2c);

  /* Gul liste */
  --wib-gulliste-bg: var(--pkt-color-status-yellow-90, #ffe7bc);
}
```

**Akseptansekriterier:**
- [x] CSS-fil opprettet med riktig struktur
- [x] Punkt CSS-variabler integrert
- [x] Klasser for alle hovedseksjoner definert
- [x] Responsive og a11y-hensyn inkludert

---

### Steg 1.2: Erstatte badges med PktTag (✅ FULLFØRT)

**Nåværende implementasjon (linje 873-908):**
```tsx
<rect width={dynamicDistrictWidth} height="30" fill="#C7F6C9"/>
<text>...</text>
```

**Ny implementasjon med sentral konfigurasjon:**
```tsx
import { PktTag, PktIcon } from '@oslokommune/punkt-react';
import {
  DISTRICT_BADGE,
  getBuildingTypeBadgeConfig,
  getDisplayBuildingTypeName,
} from '../../../config/badgeConfig';

// I komponenten:
const buildingBadge = getBuildingTypeBadgeConfig(buildingTypeName);
const displayName = getDisplayBuildingTypeName(buildingTypeName);

// I render:
<div className="white-info-box__badges">
  <PktTag skin={DISTRICT_BADGE.skin}>
    <PktIcon name={DISTRICT_BADGE.iconName} />
    <span>{districtName}</span>
  </PktTag>
  <PktTag skin={buildingBadge.skin}>
    <PktIcon name={buildingBadge.iconName} />
    <span>{displayName}</span>
  </PktTag>
</div>
```

**Utfordringer:**
- Må posisjonere badges absolutt innenfor container
- Må håndtere overgang fra SVG-koordinatsystem til CSS-posisjonering

**Akseptansekriterier:**
- [x] Badges vises med riktig farge (grønn for bydel, blå for bygningstype)
- [x] Ikoner vises korrekt (location-pin for bydel, home/organization for bygningstype)
- [x] Responsive bredde basert på tekstinnhold (PktTag håndterer dette automatisk)
- [x] Sentral konfigurasjon brukes konsekvent

---

### Steg 1.3: Refaktorere Nøkkelinformasjon-seksjonen (✅ FULLFØRT)

**Tidligere implementasjon:**
- SVG `<text>` elementer for labels og verdier
- `foreignObject` med `<input>` for redigeringsmodus
- Custom SVG-basert Rediger-knapp

**Ny implementasjon:**

Valgte en enkel HTML-seksjon fremfor PktAccordion fordi:
1. Nøkkelinformasjonen bør alltid være synlig (ikke bak en nedtrekksmeny)
2. Enklere struktur = bedre vedlikehold
3. PktButton for redigering gir Punkt-konsistens

```tsx
import { PktButton } from '@oslokommune/punkt-react';

<foreignObject x="16" y={SECTION_TITLE_Y - 12} width="304" height={...}>
  <div className="white-info-box__section">
    <div className="white-info-box__section-header">
      <h3 className="white-info-box__section-title">Nøkkelinformasjon</h3>
      <PktButton
        skin="tertiary"
        size="small"
        variant="icon-left"
        iconName={isEditMode ? 'check' : 'edit'}
        onClick={handleEditToggle}
      >
        {isEditMode ? 'Lagre' : 'Rediger'}
      </PktButton>
    </div>
    <div className="white-info-box__key-info">
      {!isEditMode ? (
        <>
          <div className="white-info-box__info-row">
            <span className="white-info-box__info-label">Byggeår:</span>
            <span className="white-info-box__info-value">{savedByggeaar || 'Ukjent'}</span>
          </div>
          {/* ... flere info-rader ... */}
          <div className="white-info-box__energy-block">
            <span className="white-info-box__energy-label">Estimert energiforbruk:</span>
            <div className="white-info-box__energy-value">
              <span className="white-info-box__energy-amount">{savedEnergyDisplayValue}</span>
              <span className="white-info-box__energy-unit">kWh/år</span>
            </div>
          </div>
        </>
      ) : (
        <>
          <div className="white-info-box__edit-row">
            <label className="white-info-box__edit-label">Byggeår:</label>
            <input className="white-info-box__edit-input" ... />
          </div>
          {/* ... flere edit-rader ... */}
          <div className="white-info-box__edit-actions">
            <PktButton skin="secondary" size="small" onClick={handleCancel}>
              Avbryt
            </PktButton>
          </div>
        </>
      )}
    </div>
  </div>
</foreignObject>
```

**CSS-klasser lagt til i WhiteInfoBox.css:**

```css
.white-info-box__section {
  font-family: var(--wib-font-family);
  color: var(--wib-text-primary);
  padding: 0 14px;
}

.white-info-box__section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--wib-spacing-sm);
}

.white-info-box__key-info {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.white-info-box__edit-actions {
  display: flex;
  gap: var(--wib-spacing-sm);
  margin-top: var(--wib-spacing-sm);
}
```

**Hva som ble endret:**
- Erstattet SVG `<text>` med HTML `<div>` og `<span>` elementer
- Erstattet SVG-basert rediger-knapp med `PktButton`
- Fjernet ubrukte SVG-koordinatbaserte funksjoner (`renderVernestatusRow`, `renderEnergyBlock`, `calculateInputWidth`)
- Beholdt all funksjonalitet (redigering, Gul liste info-knapp)
- Bruker CSS-klasser i stedet for inline styles

**Akseptansekriterier:**
- [x] Nøkkelinformasjon vises uten å være bak en nedtrekksmeny
- [x] PktButton for redigering med riktig ikon (edit/check)
- [x] Alle info-rader vises korrekt
- [x] Input-felt i redigeringsmodus fungerer
- [x] Gul liste info-knapp åpner overlay
- [x] Avbryt-knapp i redigeringsmodus

---

### Steg 1.4: Erstatte Gul liste-varsling med PktAccordion (✅ FULLFØRT)

**Tidligere implementasjon:**
- Fullt custom overlay med SVG
- Custom accordion-lignende dropdown med SVG-rektangler
- Tooltips for termer

**Ny implementasjon:**
Hele overlaygt er nå HTML/CSS-basert med Punkt-komponenter:

```tsx
import { PktAccordion, PktAccordionItem, PktIcon } from '@oslokommune/punkt-react';

{shouldShowYellowBox && isGulListeInfoOpen && (
  <div className="white-info-box__gul-liste-overlay">
    {/* Lukkeknapp med PktIcon */}
    <button onClick={() => setIsGulListeInfoOpen(false)}>
      <PktIcon name="close" />
    </button>

    <h2>Hva er Gul liste?</h2>

    {/* Hovedtekst med glossary-støtte */}
    {renderParagraphWithGlossary({
      paragraph: 'Gul liste er Byantikvarens oversikt...',
      glossary: glossaryEntries,
      hoveredTerm: hoveredGlossaryTerm,
      setHoveredTerm: setHoveredGlossaryTerm
    })}

    {/* Info-boks med mørk bakgrunn */}
    <div className="white-info-box__gul-liste-info-box">
      Du kan absolutt gjøre tiltak for å energieffektivisere...
    </div>

    {/* PktAccordion for "Hvorfor ta vare på kulturminner" */}
    <PktAccordion skin="blue">
      <PktAccordionItem title="Hvorfor ta vare på kulturminner">
        <p>Kulturminner gir oss kunnskap om historien vår...</p>
      </PktAccordionItem>
    </PktAccordion>

    <a href="...">Les mer om Gul liste</a>
  </div>
)}
```

**Hva som ble endret:**
- Erstattet SVG-basert overlay med HTML/CSS-løsning
- Bruker custom HTML/CSS accordion som matcher originalt design (mørk blå #2A2859)
- Bruker inline SVG for lukkeknappen og chevron-ikon (identisk med original)
- Beholder `renderParagraphWithGlossary` for tooltip-funksjonalitet
- Overlay posisjonert med `bottom: 0` for å dekke hele WhiteInfoBox-området
- Absolutt posisjonering av alle elementer matcher det opprinnelige designet

**Feilrettinger (2025-12-15):**
- Fikset overlay til å dekke hele WhiteInfoBox (bruker `bottom: 0` i stedet for `top: 0`)
- Erstattet PktAccordion med custom accordion - PktAccordion `skin="blue"` ga feil farge (lys blå)
- Riktig farge på info-boks og accordion (#2A2859 mørk blå, hvit tekst)
- Oppdatert `renderParagraphWithGlossary` i glossaryHelpers.tsx til å returnere `React.ReactElement`
- **Kritisk bugfix:** Fikset glossary-matching i `renderParagraphWithGlossary` - termer ble ikke matchet fordi tekst ble wrappet i React.Fragment etter første term, noe som forhindret matching av påfølgende termer. Løst ved å beholde ikke-matchende tekstdeler som strenger gjennom hele prosessen.

**Akseptansekriterier:**
- [x] Overlay dekker hele WhiteInfoBox (ingen kart synlig bak)
- [x] Overskrift "Hva er Gul liste?" vises øverst
- [x] Info-boks vises med mørk bakgrunn (#2A2859)
- [x] Custom accordion matcher original design (mørk blå, hvit tekst, chevron)
- [x] Tooltips fungerer for termer (sentralisert ordforklaringssystem)
- [x] Eksterne lenker fungerer (Oslo kommune og Kulturminnefondet)

---

### Deloppgave fullført: Sentraliserte ordforklaringer for alle tiltak

**Dato:** 2025-12-15

Alle tiltak-komponenter bruker nå det sentrale ordforklaringssystemet:

**Opprettet komponent: `GlossaryTerm`** (i `glossaryHelpers.tsx`)
- Frittstående komponent for inline-bruk av ordforklaringer
- Støtter bøyde former (f.eks. "ansvarlige foretak" med term "ansvarlig foretak")
- Bruker samme tooltip-visning som `renderParagraphWithGlossary`

**Migrerte filer (7 tiltak-komponenter):**
- `Solenergi.tsx` - Fjernet ~200 linjer hardkodede tooltips
- `EtterisoleringYttervegg.tsx` - Fjernet ~200 linjer hardkodede tooltips
- `Varmepumpe.tsx` - La til GlossaryTerm for 3 termer
- `Temperaturstyring.tsx` - La til GlossaryTerm for 3 termer
- `Ventilasjon.tsx` - La til GlossaryTerm for 3 termer
- `Tetting.tsx` - La til GlossaryTerm for 3 termer
- `IsoleringAvKjellerOgLoft.tsx` - La til GlossaryTerm for 3 termer

**Termer som nå bruker sentral ordliste:**
- `søknadspliktig`
- `tiltakshaver`
- `ansvarlig foretak` (bøyes til "ansvarlige foretak")

**Endring i tooltip-header:**
- Endret fra "Ordforklaring" til selve termen som overskrift
- Gjelder alle ordforklaringer via glossary-systemet

---

### Steg 1.5: Refaktorere besparelseskortet (✅ FULLFØRT)

**Tidligere implementasjon:**
- foreignObject med inline styles
- Animert RollingDigitsDisplay-komponent med inline styles
- Inkonsistent typografi sammenlignet med resten av WhiteInfoBox

**Ny implementasjon:**
Flyttet all styling fra inline styles til CSS-klasser i WhiteInfoBox.css:

```tsx
<foreignObject x="16" y={savingsCardY} width="304" height={SAVINGS_CARD_HEIGHT}>
  <div className={`white-info-box__savings-card ${animationClass}`}>
    <span className="white-info-box__savings-label">Estimert besparelse</span>
    <div className="white-info-box__savings-value">
      <div className="white-info-box__savings-amount-wrapper">
        <RollingDigitsDisplay value={displayedSavings} ... />
      </div>
      <span className="white-info-box__savings-unit">kr/år</span>
    </div>
    <div className="white-info-box__savings-kwh">≈ {formattedSavingsKwh} kWh/år</div>
  </div>
</foreignObject>
```

**Endringer gjort:**
- Flyttet fra x="30" til x="16" for å matche Nøkkelinformasjon-seksjonen
- "Estimert besparelse" - Samme stil som "Nøkkelinformasjon" (1.25rem, font-weight 500, ikke uppercase)
- "kr/år" - Matcher info-value stil (1.125rem, font-weight 500)
- "≈ xxx kWh/år" - Matcher info-label stil (1.125rem, font-weight 300)
- RollingDigitsDisplay og RollingDigit bruker nå CSS-klasser
- Animasjon beholdt via CSS-klasser (`--animating` og `--visible`)

**CSS-klasser lagt til:**
- `.white-info-box__savings-card` - Container med padding 14px (flukt med andre elementer)
- `.white-info-box__savings-label` - Tittel med samme stil som section-title
- `.white-info-box__savings-value` - Flexbox for tall + enhet
- `.white-info-box__savings-unit` - "kr/år" med info-value stil
- `.white-info-box__savings-kwh` - kWh-visning med info-label stil
- `.white-info-box__rolling-digits` - Rolling digits container
- `.white-info-box__rolling-digit` - Enkelt siffer
- `.white-info-box__rolling-digit-inner` - Animert inner wrapper
- `.white-info-box__rolling-digit-value` - Sifferverdi
- `.white-info-box__rolling-digit-separator` - Tusenskilletegn

**Akseptansekriterier:**
- [x] Kortet vises med riktig grønn bakgrunn
- [x] Animasjonen fungerer som før
- [x] Tilgjengelighet (aria-label) bevart
- [x] Tekst i flukt med andre elementer i WhiteInfoBox
- [x] Konsistent typografi med resten av komponenten

---

### Steg 1.6: Oppdatere MobileInfoBox med badge-ikoner (✅ FULLFØRT)

**Mål:** Sikre at mobilvisningen bruker samme badge-konfigurasjon som desktop for visuell konsistens.

**Nåværende implementasjon (MobileInfoBox.tsx, linje 153-162):**
```tsx
<div className="mobile-info-box__tags">
  {districtName && (
    <PktTag skin="green">
      <span>{districtName}</span>
    </PktTag>
  )}
  {displayBuildingTypeName && (
    <PktTag skin="blue">
      <span>{displayBuildingTypeName}</span>
    </PktTag>
  )}
</div>
```

**Ny implementasjon med sentral konfigurasjon:**
```tsx
import {
  DISTRICT_BADGE,
  getBuildingTypeBadgeConfig,
  getDisplayBuildingTypeName,
} from '../../config/badgeConfig';

// I komponenten:
const buildingBadge = getBuildingTypeBadgeConfig(buildingTypeName);
const displayName = getDisplayBuildingTypeName(buildingTypeName);

// I render:
<div className="mobile-info-box__tags">
  {districtName && (
    <PktTag skin={DISTRICT_BADGE.skin}>
      <PktIcon name={DISTRICT_BADGE.iconName} />
      <span>{districtName}</span>
    </PktTag>
  )}
  {displayName && (
    <PktTag skin={buildingBadge.skin}>
      <PktIcon name={buildingBadge.iconName} />
      <span>{displayName}</span>
    </PktTag>
  )}
</div>
```

**Akseptansekriterier:**
- [x] MobileInfoBox bruker sentral badge-konfigurasjon
- [x] Ikoner vises i badges på mobil
- [x] Visuell konsistens mellom desktop og mobil

---

### Steg 1.7: Beholde kartvisningen (ingen endring)

Kartvisningen er tett integrert med SVG-koordinatsystemet og bruker OpenStreetMap tiles. Dette bør forbli som er i fase 1, da det ikke har en naturlig Punkt-erstatning.

---

### Steg 1.8: Håndtere transitions og animasjoner

**Nåværende animasjoner:**
- Clip-path transition for expand/collapse
- Opacity transitions for innhold
- Scale/opacity animasjon for besparelseskort

**Tilnærming:**
Beholde container-animasjonene på wrapper-elementet, men flytte innholdet fra SVG til HTML/React-komponenter.

```tsx
<div
  className="white-info-box"
  style={{
    clipPath: expandHeight
      ? 'inset(0 0 0 0)'
      : isExpanded
        ? 'inset(90px 0 0 0)'
        : 'inset(90px 504px 0 0)',
  }}
>
  {/* Punkt-komponenter her */}
</div>
```

**Akseptansekriterier:**
- [ ] Expand/collapse animasjon fungerer
- [ ] Innhold fades inn/ut korrekt
- [ ] Ingen visuell "hopp" under animasjon

---

### Steg 1.9: Testing og finjustering

**Testscenarier:**
1. Normal visning med alle data
2. Visning med manglende data (ukjent byggeår, etc.)
3. Gul liste-bygning
4. Blokk vs enebolig
5. Redigeringsmodus
6. Expand/collapse av tiltak
7. Responsivitet (ulike skjermstørrelser)
8. Tastaturnavigasjon
9. Skjermleser-testing

**Akseptansekriterier:**
- [ ] Alle testscenarier passerer
- [ ] Visuell paritet med nåværende design (eller bedre)
- [ ] Ingen regresjoner i funksjonalitet

---

## Implementeringsrekkefølge for Fase 1

```
Steg 1.0: Sentral badge-konfigurasjon        ✅
    ↓
Steg 1.1: CSS-grunnstruktur                  ✅
    ↓
Steg 1.2: PktTag for badges                  ✅
    ↓
Steg 1.6: MobileInfoBox badges               ✅
    ↓
Steg 1.3: HTML-seksjon med PktButton         ✅
    ↓
Steg 1.4: Custom accordion for gul liste     ✅
    ↓
Steg 1.5: Besparelseskort (CSS-klasser)      ✅
    ↓
Steg 1.7: Transitions og animasjoner         🔄 (neste)
    ↓
Steg 1.8: Testing                            ⏳
```

---

## Fase 2: EnergySolutionButtons - Detaljert implementeringsplan

### Oversikt over nåværende EnergySolutionButtons

Komponenten er ~930 linjer og inneholder:
- Energikarakter-visning med A-G bokser (inline styles)
- Tiltak-liste med SVG-rader og hover-effekter
- "Les mer" og "Legg til"-knapper som SVG-elementer
- Custom scrollbar for tiltakslisten
- "Hvordan gjennomføre tiltakene"-knapp (SVG)
- Info-modal "Hvordan fungerer siden?" (HTML)
- Kompleks logikk for energiberegninger (beholdes uendret)

### Hovedendringer

1. **Erstatte SVG-rader med HTML/CSS-struktur**
   - Bruke `<ul>/<li>` for semantisk korrekt liste
   - CSS Grid eller Flexbox for layout

2. **Bruke PktCheckbox for tiltak-valg**
   ```tsx
   <PktCheckbox
     id={`tiltak-${tiltak.id}`}
     label={tiltak.title}
     checked={checkedItems.has(tiltak.id)}
     onChange={() => toggleChecked(tiltak.id)}
   />
   ```

3. **Bruke PktButton for handlinger**
   ```tsx
   <PktButton skin="secondary" size="small" onClick={() => onSelectTiltak(tiltak.id)}>
     Les mer
   </PktButton>
   <PktButton skin="primary" size="small" onClick={() => toggleChecked(tiltak.id)}>
     Legg til
   </PktButton>
   ```

4. **Beholde energikarakter-visualisering**
   - Custom komponent er OK her da det er spesialisert visning
   - Kan vurdere å bruke CSS i stedet for SVG

### Utfordringer

- Hover-effekter må gjenskapes med CSS
- Scroll-container med custom scrollbar
- "Hvordan gjennomføre tiltakene"-boks

---

### Steg 2.0: Opprette CSS-fil og grunnstruktur (✅ FULLFØRT)

**Dato:** 2025-12-15

**Mål:** Utvide eksisterende CSS med klasser for den nye HTML-strukturen.

**Fil:** `src/components/FigmaBlokk/components/EnergySolutionButtons.css`

**Endringer gjort:**
- Lagt til CSS custom properties (variabler) for farger, størrelser og timing
- Lagt til animasjoner (`fadeIn`, `slideUpFadeIn`) direkte i CSS-filen
- Definert klasser for hovedcontainer med visibility-states
- Definert klasser for energikarakter-seksjon
- Definert klasser for tittel
- Definert klasser for tiltak-liste (`__list`, `__item`, `__item-title`, `__actions`)
- Definert klasser for "Hvordan gjennomføre"-knappen
- Definert klasser for info-modal
- Custom styling for PktButton i tiltak-listen

**CSS-variabler definert:**

```css
.energy-solution-buttons {
  --esb-bg-hover: #F8F0DD;
  --esb-bg-selected: #F8F0DD;
  --esb-bg-button: #2A2859;
  --esb-text-primary: #2A2859;
  --esb-text-light: #F9F9F9;
  --esb-border-color: #F9F9F9;
  --esb-font-family: 'Oslo Sans', sans-serif;
  --esb-item-height: 50px;
  --esb-item-width: 471px;
  --esb-transition-duration: 0.3s;
  --esb-transition-easing: ease-in-out;
}
```

**Akseptansekriterier:**
- [x] CSS-variabler definert med fallbacks til Punkt-variabler
- [x] Klasser for liste, liste-elementer og actions
- [x] Hover- og selected-states definert
- [x] Animasjoner for opacity/background

---

### Steg 2.1: Refaktorere tiltak-listen fra SVG til HTML (✅ FULLFØRT)

**Dato:** 2025-12-15

**Endringer gjort:**
- Erstattet SVG-basert tiltak-liste med semantisk HTML (`<ul>/<li>`)
- Importert `PktButton` fra `@oslokommune/punkt-react`
- Endret `scrollContainerRef` fra `HTMLDivElement` til `HTMLUListElement`
- Bruker CSS-klasser fra steg 2.0 for styling
- "Les mer" og "Legg til" bruker nå `PktButton` med `skin="primary"` og `size="small"`
- "Legg til"-knappen viser check-ikon når valgt (`variant="icon-right"`, `iconName="check"`)

**Ny implementasjon:**
```tsx
<ul ref={scrollContainerRef} className="tiltak-list-container energy-solution-buttons__list">
  {displayTiltak.map((tiltak, index) => {
    const isHovered = hoveredIndex === index;
    const isSelected = checkedItems.has(tiltak.id);
    const showActions = isHovered || isSelected;

    return (
      <li
        key={tiltak.id}
        className={`energy-solution-buttons__item${isSelected ? ' energy-solution-buttons__item--selected' : ''}`}
        onMouseEnter={() => setHoveredIndex(index)}
        onMouseLeave={() => setHoveredIndex(null)}
      >
        <span className="energy-solution-buttons__item-title">{tiltak.title}</span>
        {showActions && (
          <div className="energy-solution-buttons__actions" style={{ opacity: 1 }}>
            <PktButton skin="primary" size="small" onClick={...}>Les mer</PktButton>
            <PktButton
              skin="primary"
              size="small"
              variant={isSelected ? 'icon-right' : undefined}
              iconName={isSelected ? 'check' : undefined}
              onClick={...}
            >
              Legg til
            </PktButton>
          </div>
        )}
      </li>
    );
  })}
</ul>
```

**Akseptansekriterier:**
- [x] Semantisk HTML-liste (`<ul>/<li>`)
- [x] Hover-effekt med bakgrunnsfarge endring
- [x] "Les mer"-knapp med PktButton
- [x] "Legg til"-knapp med PktButton og checkbox-ikon
- [x] Valgte tiltak markert visuelt
- [x] Scrollbar fungerer som før (beholder eksisterende CSS-klasser)

---

### Steg 2.2: Refaktorere "Hvordan gjennomføre tiltakene"-knappen (✅ FULLFØRT)

**Dato:** 2025-12-15

**Tidligere implementasjon:**
- SVG med rektangel, tekst og chevron-ikon
- Inline animation style

**Ny implementasjon:**
Erstattet med HTML `<button>` element som bruker CSS-klasser:

```tsx
<div className="energy-solution-buttons__process-wrapper">
  <button
    className="energy-solution-buttons__process-btn"
    onClick={onProcessClick}
    type="button"
  >
    <span className="energy-solution-buttons__process-text">
      Hvordan gjennomføre tiltakene
    </span>
    <svg className="energy-solution-buttons__process-icon" aria-hidden="true">
      {/* chevron-ikon */}
    </svg>
  </button>
</div>
```

**Endringer gjort:**
- Erstattet SVG med semantisk `<button>` element
- Bruker CSS-klasser for all styling (ingen inline styles)
- Animasjon via `.energy-solution-buttons__process-wrapper` (slideUpFadeIn)
- Chevron-ikon bruker `fill="currentColor"` for å arve farge fra CSS
- Lagt til `type="button"` og `aria-hidden="true"` for tilgjengelighet

**Akseptansekriterier:**
- [x] Semantisk HTML button-element
- [x] Chevron-ikon til høyre
- [x] Slide-up animasjon bevart
- [x] Full bredde (528px)

---

### Steg 2.3: Oppdatere info-modal med PktIcon og CSS-klasser (✅ FULLFØRT)

**Dato:** 2025-12-15

**Tidligere implementasjon:**
- Inline styles for modal-overlay, modal-container og lukkeknapp
- Custom SVG for close-ikon

**Ny implementasjon:**
Hele modalen bruker nå CSS-klasser og PktIcon for lukkeknappen:

```tsx
<div className="energy-solution-buttons__modal-overlay">
  <div className="energy-solution-buttons__modal">
    <button
      className="energy-solution-buttons__modal-close"
      onClick={() => setShowEnergyInfo(false)}
      aria-label="Lukk"
      type="button"
    >
      <PktIcon name="close" />
    </button>
    <h2 className="energy-solution-buttons__modal-title">...</h2>
    <div className="energy-solution-buttons__modal-content">
      <h3 className="energy-solution-buttons__modal-section-title">...</h3>
      <p className="energy-solution-buttons__modal-paragraph">...</p>
      <a className="energy-solution-buttons__modal-link">...</a>
      <p className="energy-solution-buttons__modal-note">...</p>
    </div>
  </div>
</div>
```

**Endringer gjort:**
- Erstattet alle inline styles med CSS-klasser
- Bruker `PktIcon` for lukke-ikon i stedet for custom SVG
- Lagt til `aria-label="Lukk"` og `type="button"` for tilgjengelighet
- All styling definert i EnergySolutionButtons.css

**Akseptansekriterier:**
- [x] PktIcon for lukkeknapp
- [x] Riktig posisjonering (absolutt, øverst til høyre)
- [x] Tilgjengelig aria-label
- [x] All modal-styling via CSS-klasser

---

### Steg 2.4: Vurdere energikarakter-visualisering (valgfritt)

**Nåværende implementasjon (linje 544-610):**
Inline styles for A-G bokser med dynamisk størrelse basert på valgt karakter.

**Anbefaling:** Beholde som er. Dette er en spesialisert visualisering som ikke har en naturlig Punkt-erstatning. Eventuelt flytte inline styles til CSS-klasser for bedre vedlikehold, men dette er ikke kritisk for Fase 2.

**Mulig fremtidig forbedring:**
```css
.energy-rating-box {
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.3s ease;
}

.energy-rating-box--active {
  width: 73px;
  height: 73px;
  font-size: 45px;
}

.energy-rating-box--inactive {
  width: 53.5px;
  height: 53.5px;
  font-size: 33px;
}
```

---

### Steg 2.5: Fjerne injisert CSS og rydde opp (✅ FULLFØRT)

**Dato:** 2025-12-15

**Tidligere implementasjon:**
```tsx
React.useEffect(() => {
  const style = document.createElement('style');
  style.innerHTML = `@keyframes fadeIn {...}`;
  document.head.appendChild(style);
  return () => document.head.removeChild(style);
}, []);
```

**Ny implementasjon:**
Animasjonene er allerede definert i `EnergySolutionButtons.css`:

```css
@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes slideUpFadeIn {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
```

**Endringer gjort:**
- Fjernet hele useEffect-blokken som injiserte CSS dynamisk
- Lagt til kommentar som refererer til CSS-filen: `// Animasjoner (fadeIn, slideUpFadeIn) er definert i EnergySolutionButtons.css`
- Redusert runtime overhead ved å unngå DOM-manipulasjon

**Akseptansekriterier:**
- [x] Animasjoner flyttet til CSS-fil (var allerede der fra steg 2.0)
- [x] useEffect for style-injeksjon fjernet
- [x] Animasjoner fungerer som før

---

### Steg 2.6: Testing og finjustering

**Testscenarier:**
1. Hover-effekt på tiltak-rader
2. Klikk på "Les mer" åpner tiltak-detaljer
3. Klikk på "Legg til" toggler checkbox og viser "Hvordan gjennomføre"
4. Scrollbar fungerer med mange tiltak
5. Energikarakter oppdateres når tiltak velges
6. Info-modal åpnes og lukkes korrekt
7. Tastaturnavigasjon (Tab, Enter, Space)
8. Skjermleser-kompatibilitet

**Akseptansekriterier:**
- [ ] Alle testscenarier passerer
- [ ] Visuell paritet med nåværende design
- [ ] Ingen regresjoner i funksjonalitet
- [ ] Bedre tilgjengelighet

---

### Implementeringsrekkefølge for Fase 2

```
Steg 2.0: CSS-grunnstruktur                  ✅
    ↓
Steg 2.1: Tiltak-liste HTML/CSS              ✅
    ↓
Steg 2.2: "Hvordan gjennomføre"-knapp        ✅
    ↓
Steg 2.3: Info-modal med PktIcon             ✅
    ↓
Steg 2.4: Energikarakter (valgfritt)         ⏳
    ↓
Steg 2.5: Fjerne injisert CSS                ✅
    ↓
Steg 2.6: Testing                            🔄 (neste)
```

---

### Viktige hensyn

**Behold uendret:**
- All energiberegningslogikk (linje 16-434)
- State management (useState, useMemo, useCallback)
- Props-interface og kommunikasjon med parent
- Tiltak-filtrering basert på byggtype/byggår

**Risiko:**
- PktButton-styling matcher kanskje ikke perfekt det eksisterende designet
- Hover-timing kan variere fra SVG-implementasjonen
- Scrollbar-oppførsel med HTML-liste vs SVG-elementer

**Mitigering:**
- Bruke CSS custom properties for å justere Punkt-styling
- Teste grundig med ulike tiltak-mengder
- Sammenligne visuelt før/etter

---

## Tekniske hensyn

### Import av Punkt-komponenter

Sørg for at alle nødvendige komponenter er importert:

```tsx
import {
  PktButton,
  PktAccordion,
  PktAccordionItem,
  PktTag,
  PktAlert,
  PktIcon,
  PktCheckbox,
} from '@oslokommune/punkt-react';
```

### CSS-integrasjon

Punkt-komponentene kommer med egen styling. For custom overrides:

```css
/* Bruk spesifikke klasser for overrides */
.white-info-box .pkt-accordion {
  --pkt-accordion-border-color: transparent;
}

.white-info-box .pkt-tag {
  font-family: 'Oslo Sans', sans-serif;
}
```

### Tilgjengelighet

Punkt-komponenter håndterer mye tilgjengelighet automatisk, men verifiser:
- Fokusrekkefølge er logisk
- Alle interaktive elementer har tilgjengelige navn
- Fargekontrastene er tilstrekkelige
- Animasjoner respekterer `prefers-reduced-motion`

---

## Risiko og mitigering

| Risiko | Sannsynlighet | Konsekvens | Mitigering |
|--------|---------------|------------|------------|
| Visuell regresjon | Middels | Middels | Detaljert visuell testing, sammenligning før/etter |
| Animasjonsproblemer | Middels | Lav | Beholde wrapper-animasjoner, teste grundig |
| Ytelsesforringelse | Lav | Middels | Profilere før/etter, lazy loading ved behov |
| Punkt-versjon inkompatibilitet | Lav | Høy | Låse Punkt-versjon, teste ved oppgradering |

---

## Suksesskriterier

1. **Visuell paritet** - Desktop-visningen ser like bra ut (eller bedre) etter refaktorering
2. **Funksjonell paritet** - All eksisterende funksjonalitet bevart
3. **Forbedret tilgjengelighet** - Bedre score på a11y-testing
4. **Redusert kodekompleksitet** - Færre linjer custom kode
5. **Konsistens** - Desktop bruker samme komponenter som mobil der det er hensiktsmessig

---

*Sist oppdatert: 2025-12-15 (Steg 2.2, 2.3, 2.5 fullført)*
