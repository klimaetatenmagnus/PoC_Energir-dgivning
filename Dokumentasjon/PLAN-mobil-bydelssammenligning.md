# Implementasjonsplan: Bydelssammenligning for mobilvisning

> **For agent:** Dette dokumentet inneholder all nødvendig kontekst for å implementere bydelssammenligning på mobilvisningen. Les hele dokumentet før du starter.

---

## 1. Oppgavebeskrivelse

Implementer "Sammenlign deg med naboene dine"-funksjonaliteten fra desktop-versjonen på mobilvisningen (`MobileEnergySolutions.tsx`).

### Ønsket resultat
- En knapp plassert **over "Velg tiltak for din bolig"** som åpner en modal
- Modalen viser en karusell med 3 kort (som desktop):
  1. **ComparisonCard** - kWh/m² sammenligning
  2. **EnergyGradeCard** - A-G fordeling i bydelen
  3. **ImprovementCard** - Din posisjon/percentil
- Swipe-gesture mellom kort (touch-vennlig)
- Toggle mellom bydel og delbydel

---

## 2. Eksisterende filer å gjenbruke

### 2.1 Service og typer (gjenbruk 100%)

**`src/services/districtStatisticsService.ts`**
- `getDistrictStatistics()` - Henter statistikk-data
- `getStatsForDistrict()` - Statistikk for bydel
- `getStatsForSubdistrict()` - Statistikk for delbydel
- `calculatePercentile()` - Beregn percentil
- `calculateProjectedConsumption()` - Projisert forbruk etter tiltak
- `getMotivationalMessage()` - Motiverende melding basert på percentil

**`src/types/districtStatistics.ts`**
```typescript
interface DistrictStats {
  avgKwhPerM2: number;
  medianKwhPerM2: number;
  count: number;
  percentiles: { p10, p25, p50, p75, p90: number };
  energyGradeDistribution: { A, B, C, D, E, F, G: number };
}
type EnergyGrade = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G';
type BuildingTypeCategory = 'småhus' | 'blokk';
```

### 2.2 Kort-komponenter (gjenbruk ~90%)

Alle ligger i `src/components/FigmaBlokk/components/DistrictComparison/cards/`:

**`ComparisonCard.tsx`** - Viser kWh/m² sammenligning med bydelssnitt
**`EnergyGradeCard.tsx`** - Viser A-G fordeling med brukerens karakter markert
**`ImprovementCard.tsx`** - Viser percentil-posisjon og forbedringspotensial

Disse kan importeres direkte. CSS ligger i `DistrictComparisonCarousel.css`.

### 2.3 Desktop-implementasjon (referanse)

**`src/components/FigmaBlokk/components/DistrictComparison/index.tsx`**
- Karusell-logikk med `activeIndex` state
- Bydel/delbydel toggle med `PktSelect`
- Beregningslogikk i `useMemo`

---

## 3. Punkt designsystem - Nødvendig dokumentasjon

### 3.1 Breakpoints

```scss
// Punkt breakpoints
mobile:      opptil 575px    // Mobilvisningen bruker denne
phablet:     576-767px       // Store telefoner
tablet:      768-1023px      // Her tar desktop over
tablet-big:  1024-1279px
laptop:      1280-1599px
desktop:     1600px+

// SCSS mixin
@include bp('mobile') { /* opptil 575px */ }
@include bp('phablet-up') { /* 576px og opp */ }
```

### 3.2 Tilgjengelige komponenter

```jsx
// Importer fra Punkt
import {
  PktButton,      // Knapper
  PktIcon,        // Ikoner
  PktSelect,      // Dropdown
  PktTabs,        // Tabs (alternativ til swipe)
  PktTag,         // Tags/badges
} from '@oslokommune/punkt-react';
```

### 3.3 PktTabs (alternativ til swipe)

```jsx
<PktTabs
  tabs={[
    { text: "Energiforbruk", href: "#comparison", active: true },
    { text: "Karakterer", href: "#distribution", active: false },
    { text: "Din posisjon", href: "#improvement", active: false },
  ]}
/>
```

### 3.4 Spacing tokens

```css
--pkt-spacing-4: 0.25rem;   /* 4px */
--pkt-spacing-8: 0.5rem;    /* 8px */
--pkt-spacing-12: 0.75rem;  /* 12px */
--pkt-spacing-16: 1rem;     /* 16px */
--pkt-spacing-24: 1.5rem;   /* 24px */
```

### 3.5 Farger

```css
/* Tekst */
--pkt-color-brand-dark-blue-1000: #2a2859;  /* Hovedtekst */
--pkt-color-brand-neutrals-500: #666;       /* Sekundærtekst */

/* Bakgrunn */
--pkt-color-brand-neutrals-white: #ffffff;
--pkt-color-brand-neutrals-100: #f9f9f9;

/* Energikarakterer */
--pkt-color-brand-green-1000: #43F8B6;      /* A */
--pkt-color-brand-light-green-1000: #C7F6C9; /* B */
--pkt-color-brand-yellow-500: #FFE7BC;      /* C */
--pkt-color-brand-yellow-1000: #F9C66B;     /* D */
--pkt-color-brand-red-600: #FFB4AC;         /* E/F */
--pkt-color-brand-red-1000: #FF8274;        /* G */

/* Status */
--pkt-color-brand-dark-green-1000: #034b45; /* Positiv */
```

---

## 4. Implementasjonsdetaljer

### 4.1 Ny filstruktur

```
src/components/mobile/
├── MobileEnergySolutions.tsx        # Eksisterende - må oppdateres
├── MobileEnergySolutions.css        # Eksisterende - må utvides
├── MobileDistrictComparison/        # NY MAPPE
│   ├── index.tsx                    # Hovedkomponent med swipe-karusell
│   ├── MobileDistrictComparison.css # Mobilspesifikke stiler
│   └── useSwipeGesture.ts           # Custom hook for swipe (valgfritt)
```

### 4.2 Swipe-implementasjon

Punkt har ingen innebygd swipe-komponent. Alternativer:

**Alternativ A: Enkel touch-gesture (anbefalt)**
```tsx
// Custom hook for swipe detection
const useSwipeGesture = (onSwipeLeft: () => void, onSwipeRight: () => void) => {
  const touchStart = useRef<number | null>(null);

  const handleTouchStart = (e: TouchEvent) => {
    touchStart.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: TouchEvent) => {
    if (touchStart.current === null) return;
    const diff = e.changedTouches[0].clientX - touchStart.current;
    if (Math.abs(diff) > 50) { // Min 50px swipe
      diff > 0 ? onSwipeRight() : onSwipeLeft();
    }
    touchStart.current = null;
  };

  return { handleTouchStart, handleTouchEnd };
};
```

**Alternativ B: PktTabs for navigasjon**
```tsx
// Bruk tabs i stedet for swipe
<PktTabs
  tabs={CARDS.map((card, i) => ({
    text: card.title,
    href: `#${card.id}`,
    active: i === activeIndex,
  }))}
/>
```

### 4.3 MobileDistrictComparison komponent

```tsx
// src/components/mobile/MobileDistrictComparison/index.tsx

import React, { useState, useMemo, useRef } from 'react';
import { PktButton, PktIcon, PktSelect } from '@oslokommune/punkt-react';
import type { DistrictStats, EnergyGrade, BuildingTypeCategory } from '../../../types/districtStatistics';
import {
  calculatePercentile,
  calculateProjectedConsumption,
  getMotivationalMessage,
} from '../../../services/districtStatisticsService';
// Gjenbruk kort-komponenter fra desktop
import { ComparisonCard, EnergyGradeCard, ImprovementCard } from '../../FigmaBlokk/components/DistrictComparison/cards';
import './MobileDistrictComparison.css';

interface MobileDistrictComparisonProps {
  isOpen: boolean;
  onClose: () => void;
  currentKwhPerM2: number;
  totalEnergySavings: number;
  bruksareal: number;
  districtName: string;
  districtStats: DistrictStats;
  subdistrictName?: string;
  subdistrictStats?: DistrictStats;
  userEnergyGrade?: EnergyGrade | null;
  buildingTypeCategory?: BuildingTypeCategory;
}

const CARDS = [
  { id: 'comparison', title: 'Energiforbruk', iconName: 'district' },
  { id: 'distribution', title: 'Karakterer', iconName: 'bulb' },
  { id: 'improvement', title: 'Din posisjon', iconName: 'location-pin' },
];

export const MobileDistrictComparison: React.FC<MobileDistrictComparisonProps> = ({
  isOpen,
  onClose,
  currentKwhPerM2,
  totalEnergySavings,
  bruksareal,
  districtName,
  districtStats,
  subdistrictName,
  subdistrictStats,
  userEnergyGrade,
  buildingTypeCategory = 'småhus',
}) => {
  const [activeIndex, setActiveIndex] = useState(0);
  const [comparisonLevel, setComparisonLevel] = useState<'district' | 'subdistrict'>('district');
  const touchStartX = useRef<number | null>(null);

  // Swipe handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const diff = e.changedTouches[0].clientX - touchStartX.current;
    if (Math.abs(diff) > 50) {
      if (diff > 0 && activeIndex > 0) {
        setActiveIndex(activeIndex - 1);
      } else if (diff < 0 && activeIndex < CARDS.length - 1) {
        setActiveIndex(activeIndex + 1);
      }
    }
    touchStartX.current = null;
  };

  // ... resten av logikken fra desktop-versjonen

  if (!isOpen) return null;

  return (
    <div className="mobile-district-overlay" onClick={onClose}>
      <div
        className="mobile-district-modal"
        onClick={(e) => e.stopPropagation()}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {/* Header med lukk-knapp */}
        <div className="mobile-district-header">
          <h2>Sammenlign med naboene</h2>
          <PktButton
            skin="tertiary"
            size="small"
            variant="icon-only"
            iconName="close"
            onClick={onClose}
            aria-label="Lukk"
          />
        </div>

        {/* Dropdown for bydel/delbydel */}
        {subdistrictStats && (
          <div className="mobile-district-level-select">
            <PktSelect
              id="mobile-district-level"
              name="district-level"
              label=" "
              value={comparisonLevel}
              onChange={(e) => setComparisonLevel(e.target.value as 'district' | 'subdistrict')}
            >
              <option value="district">Sammenlign med {districtName}</option>
              <option value="subdistrict">Sammenlign med {subdistrictName}</option>
            </PktSelect>
          </div>
        )}

        {/* Karusell-innhold */}
        <div className="mobile-district-carousel">
          {/* Aktivt kort */}
          <div className="mobile-district-card">
            {renderActiveCard()}
          </div>
        </div>

        {/* Dot-indikatorer + swipe-hint */}
        <div className="mobile-district-nav">
          <div className="mobile-district-dots">
            {CARDS.map((card, i) => (
              <button
                key={card.id}
                className={`mobile-district-dot ${i === activeIndex ? 'mobile-district-dot--active' : ''}`}
                onClick={() => setActiveIndex(i)}
                aria-label={card.title}
              />
            ))}
          </div>
          <span className="mobile-district-swipe-hint">Sveip for å bytte kort</span>
        </div>
      </div>
    </div>
  );
};
```

### 4.4 CSS for mobil

```css
/* src/components/mobile/MobileDistrictComparison/MobileDistrictComparison.css */

.mobile-district-overlay {
  position: fixed;
  inset: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: flex-end;
  justify-content: center;
  z-index: 1000;
  animation: fadeIn 0.2s ease-out;
}

.mobile-district-modal {
  background-color: var(--pkt-color-brand-neutrals-white, #ffffff);
  width: 100%;
  max-height: 85vh;
  overflow-y: auto;
  padding: var(--pkt-spacing-16, 1rem);
  padding-bottom: max(var(--pkt-spacing-24, 1.5rem), env(safe-area-inset-bottom));
  animation: slideUp 0.3s ease-out;
  border-radius: 16px 16px 0 0;
}

.mobile-district-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--pkt-spacing-16, 1rem);
}

.mobile-district-header h2 {
  font-family: 'Oslo Sans', sans-serif;
  font-size: 1.25rem;
  font-weight: 500;
  color: var(--pkt-color-brand-dark-blue-1000, #2a2859);
  margin: 0;
}

.mobile-district-level-select {
  margin-bottom: var(--pkt-spacing-16, 1rem);
}

.mobile-district-level-select .pkt-select__label {
  display: none !important;
}

.mobile-district-carousel {
  touch-action: pan-y; /* Tillat vertikal scroll, fang horisontal swipe */
  min-height: 280px;
}

.mobile-district-card {
  padding: var(--pkt-spacing-8, 0.5rem) 0;
}

.mobile-district-nav {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--pkt-spacing-8, 0.5rem);
  padding-top: var(--pkt-spacing-16, 1rem);
  border-top: 1px solid var(--pkt-color-brand-neutrals-200, #f2f2f2);
}

.mobile-district-dots {
  display: flex;
  gap: var(--pkt-spacing-12, 0.75rem);
}

.mobile-district-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  border: none;
  background-color: var(--pkt-color-brand-neutrals-300, #ccc);
  cursor: pointer;
  transition: background-color 0.2s ease, transform 0.15s ease;
  /* Touch-target minimum 44px */
  padding: 16px;
  margin: -16px;
  background-clip: content-box;
}

.mobile-district-dot--active {
  background-color: var(--pkt-color-brand-dark-blue-1000, #2a2859);
}

.mobile-district-swipe-hint {
  font-size: 0.75rem;
  color: var(--pkt-color-brand-neutrals-500, #666);
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes slideUp {
  from { transform: translateY(100%); }
  to { transform: translateY(0); }
}

/* Tilpass kort-stiler for mobil */
.mobile-district-modal .carousel-card__bar-label {
  font-size: 0.8125rem;
  width: 75px;
}

.mobile-district-modal .carousel-card__bar-value {
  font-size: 0.9375rem;
}

/* Respekt for reduced motion */
@media (prefers-reduced-motion: reduce) {
  .mobile-district-overlay,
  .mobile-district-modal {
    animation: none !important;
  }
}
```

### 4.5 Integrasjon i MobileEnergySolutions.tsx

Legg til følgende endringer:

```tsx
// 1. Importer
import { MobileDistrictComparison } from './MobileDistrictComparison';
import { getDistrictStatistics, getStatsForDistrict, getStatsForSubdistrict } from '../../services/districtStatisticsService';

// 2. Legg til state
const [showDistrictComparison, setShowDistrictComparison] = useState(false);
const [districtStats, setDistrictStats] = useState<DistrictStats | null>(null);
const [subdistrictStats, setSubdistrictStats] = useState<DistrictStats | null>(null);

// 3. Hent statistikk ved mount
useEffect(() => {
  getDistrictStatistics().then(data => {
    const buildingType = boligtype === 'blokk' ? 'blokk' : 'småhus';
    const bydelStats = getStatsForDistrict(data, districtName, buildingType);
    setDistrictStats(bydelStats);

    // Hent delbydel hvis tilgjengelig
    const subdistrictName = buildingData.csvData?.delbydelsnavn;
    if (subdistrictName) {
      const delbydelStats = getStatsForSubdistrict(data, districtName, subdistrictName, buildingType);
      setSubdistrictStats(delbydelStats);
    }
  });
}, [districtName, boligtype, buildingData.csvData?.delbydelsnavn]);

// 4. Beregn kWh/m²
const currentKwhPerM2 = useMemo(() => {
  const consumption = yearlyConsumption ? parseFloat(yearlyConsumption) : estimatedAnnualConsumption;
  return bruksareal && bruksareal > 0 ? consumption / bruksareal : 0;
}, [yearlyConsumption, estimatedAnnualConsumption, bruksareal]);

// 5. Legg til knapp i JSX (mellom address-section og tiltak-header)
{districtStats && (
  <button
    className="mobile-energy-solutions__compare-button"
    onClick={() => setShowDistrictComparison(true)}
  >
    <PktIcon name="users" className="pkt-icon--medium" />
    <span>Sammenlign deg med naboene dine</span>
    <PktIcon name="chevron-thin-right" className="pkt-icon--small" />
  </button>
)}

// 6. Legg til modal-komponent (før footer)
<MobileDistrictComparison
  isOpen={showDistrictComparison}
  onClose={() => setShowDistrictComparison(false)}
  currentKwhPerM2={currentKwhPerM2}
  totalEnergySavings={calculatedSavings}
  bruksareal={bruksareal || 0}
  districtName={districtName}
  districtStats={districtStats!}
  subdistrictName={buildingData.csvData?.delbydelsnavn}
  subdistrictStats={subdistrictStats ?? undefined}
  userEnergyGrade={estimatedRating as EnergyGrade | null}
  buildingTypeCategory={boligtype || 'småhus'}
/>
```

### 4.6 CSS for knappen

Legg til i `MobileEnergySolutions.css`:

```css
/* Sammenlign med naboene - knapp */
.mobile-energy-solutions__compare-button {
  display: flex;
  align-items: center;
  gap: var(--pkt-spacing-12, 0.75rem);
  width: 100%;
  padding: var(--pkt-spacing-16, 1rem);
  background-color: var(--pkt-color-brand-neutrals-white, #ffffff);
  border: 1px solid var(--pkt-color-brand-neutrals-200, #f2f2f2);
  border-radius: 8px;
  cursor: pointer;
  font-family: 'Oslo Sans', sans-serif;
  font-size: 1rem;
  font-weight: 500;
  color: var(--pkt-color-brand-dark-blue-1000, #2a2859);
  text-align: left;
  transition: background-color 0.15s ease, border-color 0.15s ease;
  margin-bottom: var(--pkt-spacing-8, 0.5rem);
}

.mobile-energy-solutions__compare-button:hover,
.mobile-energy-solutions__compare-button:active {
  background-color: var(--pkt-color-brand-neutrals-100, #f9f9f9);
  border-color: var(--pkt-color-brand-dark-blue-1000, #2a2859);
}

.mobile-energy-solutions__compare-button span {
  flex: 1;
}

.mobile-energy-solutions__compare-button .pkt-icon--medium {
  color: var(--pkt-color-brand-dark-blue-1000, #2a2859);
}

.mobile-energy-solutions__compare-button .pkt-icon--small {
  color: var(--pkt-color-brand-neutrals-500, #666);
}
```

---

## 5. Testing

### 5.1 Bygg og kjør

```bash
npm run build   # Verifiser ingen kompileringsfeil
npm run dev     # Test visuelt
```

### 5.2 Testscenarier

1. **Åpne modal**: Trykk på "Sammenlign deg med naboene dine"-knappen
2. **Swipe mellom kort**: Sveip venstre/høyre
3. **Dot-navigasjon**: Trykk på dots for å bytte kort
4. **Bydel/delbydel toggle**: Bytt nivå i dropdown
5. **Lukk modal**: Trykk på X eller utenfor modalen
6. **Med valgte tiltak**: Sjekk at projiserte verdier vises

### 5.3 Touch targets

Verifiser at alle interaktive elementer har minimum 44x44px touch target.

---

## 6. Filreferanser

| Fil | Formål |
|-----|--------|
| `src/components/mobile/MobileEnergySolutions.tsx` | Integrer knapp og modal |
| `src/components/mobile/MobileEnergySolutions.css` | CSS for knappen |
| `src/components/mobile/MobileDistrictComparison/index.tsx` | **NY** - Hovedkomponent |
| `src/components/mobile/MobileDistrictComparison/MobileDistrictComparison.css` | **NY** - Modal-stiler |
| `src/components/FigmaBlokk/components/DistrictComparison/cards/` | Gjenbruk kort |
| `src/services/districtStatisticsService.ts` | Gjenbruk beregninger |
| `src/types/districtStatistics.ts` | Gjenbruk typer |

---

## 7. Viktige hensyn

### 7.1 Data-tilgjengelighet

Løsningen bruker for øyeblikket **mock-data** fordi Enova bulk-CSV ikke er lastet ned. Funksjonaliteten virker, men tallene er ikke ekte. Se `Dokumentasjon/presentasjon-bydelssammenligning.md` seksjon 21 for instruksjoner om å aktivere ekte data.

### 7.2 Delbydel

`delbydelsnavn` hentes fra `buildingData.csvData?.delbydelsnavn` (Matrikkel-data). Ikke alle adresser har delbydel-info.

### 7.3 Energikarakter

Brukerens energikarakter kommer fra `estimatedRating` prop (beregnet basert på byggeår/areal, eller fra Enova-attest hvis tilgjengelig).

---

*Opprettet: 22. januar 2026*
