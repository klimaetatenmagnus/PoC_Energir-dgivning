# Oppdateringsplan: Forbedringer til mobil bydelssammenligning

> **For agent:** Dette dokumentet inneholder endringer som skal gjøres på eksisterende implementasjon. Les hele dokumentet før du starter.

---

## 1. Oppgavebeskrivelse

Forbedre brukeropplevelsen for bydelssammenligning på mobilvisningen med:

1. **PktButton** i stedet for custom button (som på desktop)
2. **Venstrestilt plassering** med korrekt Punkt-spacing
3. **Visuell swipe-indikasjon** - vis partielle kort på sidene
4. **Slide-animasjon** på kortene ved swipe

---

## 2. Filer som skal endres

| Fil | Endring |
|-----|---------|
| `src/components/mobile/MobileEnergySolutions.tsx` | Bytt ut custom button med PktButton |
| `src/components/mobile/MobileEnergySolutions.css` | Fjern custom button-stiler, legg til spacing |
| `src/components/mobile/MobileDistrictComparison/index.tsx` | Legg til slide-animasjon og partielle kort |
| `src/components/mobile/MobileDistrictComparison/MobileDistrictComparison.css` | CSS for animasjon og partielle kort |

---

## 3. Punkt designsystem - Referanse

### 3.1 PktButton (referanse fra desktop)

Desktop bruker denne knappen i `EnergySolutionButtons.tsx`:

```jsx
<PktButton
  skin="tertiary"
  size="small"
  variant="icon-only"
  iconName="information"
  aria-label="Hvordan fungerer siden?"
  onClick={() => setShowInfoModal(true)}
/>
```

For "Sammenlign med naboene"-knappen, bruk:

```jsx
import { PktButton } from '@oslokommune/punkt-react';

<PktButton
  skin="tertiary"
  size="medium"
  variant="icon-left"
  iconName="users"
  onClick={() => setShowDistrictComparison(true)}
>
  Sammenlign deg med naboene dine
</PktButton>
```

### 3.2 Spacing (Punkt)

```scss
// Punkt spacing tokens
$spacing: (
  "size-0": 0rem,
  "size-4": 0.25rem,
  "size-8": 0.5rem,
  "size-12": 0.75rem,
  "size-16": 1rem,      // ← Bruk denne mellom knapp og overskrift
  "size-24": 1.5rem,
  "size-32": 2rem,
);

// CSS custom properties
--pkt-spacing-16: 1rem;
--pkt-spacing-24: 1.5rem;
```

### 3.3 Animasjon (CSS transitions)

Punkt har ikke innebygde animasjoner, men følger disse retningslinjene:
- Varighet: 200-300ms for UI-elementer
- Easing: `ease-out` for inngang, `ease-in` for utgang
- Respekter `prefers-reduced-motion`

---

## 4. Detaljerte endringer

### 4.1 MobileEnergySolutions.tsx - Bytt button

**Finn denne koden:**
```tsx
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
```

**Erstatt med:**
```tsx
{districtStats && (
  <div className="mobile-energy-solutions__compare-section">
    <PktButton
      skin="tertiary"
      size="medium"
      variant="icon-left"
      iconName="users"
      onClick={() => setShowDistrictComparison(true)}
    >
      Sammenlign deg med naboene dine
    </PktButton>
  </div>
)}
```

### 4.2 MobileEnergySolutions.css - Oppdater stiler

**Fjern** hele `.mobile-energy-solutions__compare-button` blokken (ca. 30 linjer).

**Legg til:**
```css
/* Sammenlign med naboene - seksjon */
.mobile-energy-solutions__compare-section {
  display: flex;
  justify-content: flex-start; /* Venstrestilt */
  padding: 0 var(--pkt-spacing-16, 1rem);
  margin-bottom: var(--pkt-spacing-16, 1rem); /* Spacing ned til "Velg tiltak" */
}

/* Overstyr Punkt-knapp for å matche design */
.mobile-energy-solutions__compare-section .pkt-btn--tertiary {
  color: var(--pkt-color-brand-dark-blue-1000, #2a2859);
  font-weight: 500;
}
```

### 4.3 MobileDistrictComparison/index.tsx - Slide-animasjon

**Oppdater state og refs:**
```tsx
const [activeIndex, setActiveIndex] = useState(0);
const [slideDirection, setSlideDirection] = useState<'left' | 'right' | null>(null);
const [isAnimating, setIsAnimating] = useState(false);
const touchStartX = useRef<number | null>(null);
```

**Oppdater swipe handlers:**
```tsx
const goToCard = (newIndex: number) => {
  if (isAnimating || newIndex === activeIndex) return;
  if (newIndex < 0 || newIndex >= CARDS.length) return;

  setSlideDirection(newIndex > activeIndex ? 'left' : 'right');
  setIsAnimating(true);

  // Start animasjon, deretter oppdater index
  setTimeout(() => {
    setActiveIndex(newIndex);
    setIsAnimating(false);
    setSlideDirection(null);
  }, 250); // Match CSS transition duration
};

const handleTouchStart = (e: React.TouchEvent) => {
  if (isAnimating) return;
  touchStartX.current = e.touches[0].clientX;
};

const handleTouchEnd = (e: React.TouchEvent) => {
  if (touchStartX.current === null || isAnimating) return;
  const diff = e.changedTouches[0].clientX - touchStartX.current;

  if (Math.abs(diff) > 50) {
    if (diff < 0 && activeIndex < CARDS.length - 1) {
      goToCard(activeIndex + 1); // Swipe left → next
    } else if (diff > 0 && activeIndex > 0) {
      goToCard(activeIndex - 1); // Swipe right → prev
    }
  }
  touchStartX.current = null;
};
```

**Oppdater JSX for karusell med partielle kort:**
```tsx
{/* Karusell-innhold med partielle kort synlige */}
<div className="mobile-district-carousel">
  <div
    className={`mobile-district-cards-container ${
      slideDirection ? `mobile-district-cards--slide-${slideDirection}` : ''
    }`}
    onTouchStart={handleTouchStart}
    onTouchEnd={handleTouchEnd}
  >
    {/* Forrige kort (delvis synlig) */}
    {activeIndex > 0 && (
      <div
        className="mobile-district-card mobile-district-card--prev"
        onClick={() => goToCard(activeIndex - 1)}
      >
        {renderCard(activeIndex - 1)}
      </div>
    )}

    {/* Aktivt kort */}
    <div className="mobile-district-card mobile-district-card--active">
      {renderCard(activeIndex)}
    </div>

    {/* Neste kort (delvis synlig) */}
    {activeIndex < CARDS.length - 1 && (
      <div
        className="mobile-district-card mobile-district-card--next"
        onClick={() => goToCard(activeIndex + 1)}
      >
        {renderCard(activeIndex + 1)}
      </div>
    )}
  </div>
</div>
```

**Legg til renderCard helper:**
```tsx
const renderCard = (index: number) => {
  const stats = comparisonLevel === 'district' ? districtStats : (subdistrictStats || districtStats);
  const areaName = comparisonLevel === 'district' ? districtName : (subdistrictName || districtName);

  switch (index) {
    case 0:
      return (
        <ComparisonCard
          currentKwhPerM2={currentKwhPerM2}
          projectedKwhPerM2={projectedKwhPerM2}
          avgKwhPerM2={stats.avgKwhPerM2}
          areaName={areaName}
          hasSelectedTiltak={totalEnergySavings > 0}
        />
      );
    case 1:
      return (
        <EnergyGradeCard
          distribution={stats.energyGradeDistribution}
          userGrade={userEnergyGrade}
          areaName={areaName}
        />
      );
    case 2:
      return (
        <ImprovementCard
          currentPercentile={currentPercentile}
          projectedPercentile={projectedPercentile}
          motivationalMessage={motivationalMessage}
          hasSelectedTiltak={totalEnergySavings > 0}
        />
      );
    default:
      return null;
  }
};
```

### 4.4 MobileDistrictComparison.css - Animasjon og partielle kort

**Erstatt karusell-CSS:**
```css
/* ==========================================================================
   Karusell med partielle kort og slide-animasjon
   ========================================================================== */

.mobile-district-carousel {
  position: relative;
  overflow: hidden;
  min-height: 300px;
  margin: 0 calc(-1 * var(--pkt-spacing-16, 1rem)); /* Utvid til kantene */
  padding: 0 var(--pkt-spacing-16, 1rem);
}

.mobile-district-cards-container {
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  touch-action: pan-y; /* Tillat vertikal scroll, fang horisontal */
  min-height: 280px;
}

/* Kortene */
.mobile-district-card {
  position: absolute;
  width: calc(100% - 3rem); /* Gi plass til partielle kort på sidene */
  max-width: 340px;
  transition: transform 0.25s ease-out, opacity 0.25s ease-out;
  will-change: transform, opacity;
}

/* Aktivt kort (sentrert) */
.mobile-district-card--active {
  position: relative;
  z-index: 2;
  transform: translateX(0);
  opacity: 1;
}

/* Forrige kort (delvis synlig til venstre) */
.mobile-district-card--prev {
  left: 0;
  z-index: 1;
  transform: translateX(-85%);
  opacity: 0.5;
  cursor: pointer;
}

.mobile-district-card--prev:hover {
  opacity: 0.7;
}

/* Neste kort (delvis synlig til høyre) */
.mobile-district-card--next {
  right: 0;
  z-index: 1;
  transform: translateX(85%);
  opacity: 0.5;
  cursor: pointer;
}

.mobile-district-card--next:hover {
  opacity: 0.7;
}

/* Slide-animasjoner */
.mobile-district-cards--slide-left .mobile-district-card--active {
  animation: slideOutLeft 0.25s ease-out forwards;
}

.mobile-district-cards--slide-left .mobile-district-card--next {
  animation: slideInFromRight 0.25s ease-out forwards;
}

.mobile-district-cards--slide-right .mobile-district-card--active {
  animation: slideOutRight 0.25s ease-out forwards;
}

.mobile-district-cards--slide-right .mobile-district-card--prev {
  animation: slideInFromLeft 0.25s ease-out forwards;
}

@keyframes slideOutLeft {
  from {
    transform: translateX(0);
    opacity: 1;
  }
  to {
    transform: translateX(-100%);
    opacity: 0;
  }
}

@keyframes slideInFromRight {
  from {
    transform: translateX(85%);
    opacity: 0.5;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
}

@keyframes slideOutRight {
  from {
    transform: translateX(0);
    opacity: 1;
  }
  to {
    transform: translateX(100%);
    opacity: 0;
  }
}

@keyframes slideInFromLeft {
  from {
    transform: translateX(-85%);
    opacity: 0.5;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
}

/* Respekt for reduced motion */
@media (prefers-reduced-motion: reduce) {
  .mobile-district-card,
  .mobile-district-cards--slide-left .mobile-district-card--active,
  .mobile-district-cards--slide-left .mobile-district-card--next,
  .mobile-district-cards--slide-right .mobile-district-card--active,
  .mobile-district-cards--slide-right .mobile-district-card--prev {
    animation: none !important;
    transition: none !important;
  }
}

/* ==========================================================================
   Fjern swipe-hint tekst, erstatt med visuell indikasjon
   ========================================================================== */

.mobile-district-swipe-hint {
  display: none; /* Fjern tekst-hint, partielle kort er nok */
}

/* Oppdater dots for bedre touch */
.mobile-district-dots {
  display: flex;
  justify-content: center;
  gap: var(--pkt-spacing-16, 1rem);
  padding: var(--pkt-spacing-16, 1rem) 0;
}

.mobile-district-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  border: none;
  background-color: var(--pkt-color-brand-neutrals-300, #ccc);
  cursor: pointer;
  transition: background-color 0.2s ease, transform 0.15s ease;
  /* Touch-target minimum 44px - usynlig padding */
  padding: 17px;
  margin: -17px;
  background-clip: content-box;
}

.mobile-district-dot--active {
  background-color: var(--pkt-color-brand-dark-blue-1000, #2a2859);
  transform: scale(1.2);
}
```

---

## 5. Oppsummering av endringer

| Komponent | Før | Etter |
|-----------|-----|-------|
| Knapp | Custom `<button>` med manuell styling | `<PktButton skin="tertiary" variant="icon-left">` |
| Plassering | Full bredde med justify-content | Venstrestilt med `justify-content: flex-start` |
| Spacing | `margin-bottom: 0.5rem` | `margin-bottom: var(--pkt-spacing-16)` (1rem) |
| Swipe-indikasjon | Tekst "Sveip for å bytte kort" | Partielle kort synlige på sidene |
| Animasjon | Ingen | Slide venstre/høyre med 250ms ease-out |

---

## 6. Testing

### 6.1 Verifiser etter endring

```bash
npm run build   # Ingen kompileringsfeil
npm run dev     # Test visuelt
```

### 6.2 Testscenarier

1. **Knapp-utseende**: Verifiser at PktButton ser riktig ut (tertiary skin, ikon til venstre)
2. **Venstrestilt**: Knappen skal være venstrestilt, ikke sentrert
3. **Spacing**: 16px (1rem) mellom knappen og "Velg tiltak"-overskriften
4. **Partielle kort**: Neste/forrige kort skal være synlige på sidene (ca. 15% synlig)
5. **Swipe-animasjon**: Kort skal glide inn/ut ved swipe
6. **Dot-navigasjon**: Fortsatt fungere, med animasjon
7. **Reduced motion**: Ingen animasjon når `prefers-reduced-motion: reduce`

---

## 7. Filreferanser

| Fil | Formål |
|-----|--------|
| `src/components/mobile/MobileEnergySolutions.tsx` | Erstatt custom button med PktButton |
| `src/components/mobile/MobileEnergySolutions.css` | Fjern gammel button CSS, legg til spacing |
| `src/components/mobile/MobileDistrictComparison/index.tsx` | Slide-animasjon og partielle kort |
| `src/components/mobile/MobileDistrictComparison/MobileDistrictComparison.css` | Animasjons-CSS |

---

*Oppdatert: 22. januar 2026*
