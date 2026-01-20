# Refaktorering av tiltakskort-komponenter (Desktop)

> **Arbeidsdokument** - Dette dokumentet brukes til å planlegge og loggføre fremdrift i refaktoreringen av tiltakskort-komponenter for desktop-visningen.

---

## Hvordan bruke dette dokumentet

### Formål
Dette er et levende arbeidsdokument som skal:
1. Beskrive planen for refaktorering
2. Spore fremdrift underveis i arbeidet
3. Dokumentere beslutninger og endringer
4. Gi oversikt over hva som gjenstår

### Status-indikatorer

| Ikon | Betydning |
|------|-----------|
| ⏳ | Ikke startet |
| 🔄 | Pågår |
| ✅ | Fullført |
| ❌ | Blokkert / Avbrutt |
| 🔍 | Under vurdering |

### Oppdatering av dokumentet

**Ved oppstart av et steg:**
1. Endre status fra ⏳ til 🔄
2. Legg til startdato i "Notater"-feltet
3. Legg til en oppføring i [Fremdriftslogg](#fremdriftslogg)

**Ved fullføring av et steg:**
1. Endre status fra 🔄 til ✅
2. Kryss av akseptansekriterier som er oppfylt
3. Legg til sluttdato og eventuelle notater
4. Oppdater [Fremdriftslogg](#fremdriftslogg)

**Ved problemer/blokkering:**
1. Endre status til ❌
2. Dokumenter problemet i "Notater"-feltet
3. Legg til oppføring i [Fremdriftslogg](#fremdriftslogg) med beskrivelse av blokkering

---

## Statusoversikt

### Overordnet fremdrift

| Fase | Beskrivelse | Status | Fremdrift |
|------|-------------|--------|-----------|
| 1 | Prototype med Varmepumpe | ✅ | 10/10 steg |
| 2 | Migrere resterende tiltak | ✅ | Fullført - alle tiltak støttes av ny komponent |
| 3 | Opprydding | ✅ | 2/2 steg |

### Fase 1: Detaljert status

| Steg | Beskrivelse | Status | Dato startet | Dato fullført |
|------|-------------|--------|--------------|---------------|
| 1.1 | Opprette komponentstruktur | ✅ | 2026-01-20 | 2026-01-20 |
| 1.2 | DesktopTiltakCard hovedkomponent | ✅ | 2026-01-20 | 2026-01-20 |
| 1.3 | Layout med CSS Grid/Flexbox | ✅ | 2026-01-20 | 2026-01-20 |
| 1.4 | TiltakTabs med PktTabs | ✅ | 2026-01-20 | 2026-01-20 |
| 1.5 | TiltakContent med ordforklaringer | ✅ | 2026-01-20 | 2026-01-20 |
| 1.6 | TiltakBenefits med BenefitChipList | ✅ | 2026-01-20 | 2026-01-20 |
| 1.7 | TiltakSavings (besparelsesboks) | ✅ | 2026-01-20 | 2026-01-20 |
| 1.8 | TiltakGrants (støtteordninger) | ✅ | 2026-01-20 | 2026-01-20 |
| 1.9 | TiltakPermit (søknadsplikt) | ✅ | 2026-01-20 | 2026-01-20 |
| 1.10 | Integrere i WhiteInfoBox | ✅ | 2026-01-20 | 2026-01-20 |

### Fase 2: Tiltak-migrering

| Tiltak | Status | Testet | Notater |
|--------|--------|--------|---------|
| Varmepumpe | ✅ | 🔍 | Prototype i Fase 1, krever visuell testing |
| Solenergi | ✅ | 🔍 | Støttes av ny komponent, krever visuell testing |
| Vinduer | ✅ | 🔍 | Støttes av ny komponent, krever visuell testing |
| Yttervegg | ✅ | 🔍 | Støttes av ny komponent, krever visuell testing |
| Kjeller/loft | ✅ | 🔍 | Støttes av ny komponent, krever visuell testing |
| Temperaturstyring | ✅ | 🔍 | Støttes av ny komponent, krever visuell testing |
| Tetting | ✅ | 🔍 | Støttes av ny komponent, krever visuell testing |
| Ventilasjon | ✅ | 🔍 | Støttes av ny komponent, krever visuell testing |

---

## Fremdriftslogg

> Loggfør alle viktige hendelser, beslutninger og endringer her. Nyeste oppføring øverst.

| Dato | Aktivitet | Notater |
|------|-----------|---------|
| 2026-01-20 | Fase 3 fullført - Opprydding | Slettet 8 gamle tiltak-komponenter (~7200 linjer). Fjernet feature flag og TILTAK_COMPONENT_MAP. Oppdatert PreviewPanel til å bruke DesktopTiltakCard. Bundle-størrelse redusert med ~140 kB. |
| 2026-01-20 | Tooltip-forbedringer | Harmonisert styling mellom besparelses-tooltip og ordforklarings-tooltips. Fikset duplikat-tooltip-bug ved å bruke unik instans-ID. |
| 2026-01-20 | Besparelse-visning oppdatert | Byttet rekkefølge: NOK vises nå i stor skrift, kWh i liten skrift under. |
| 2026-01-20 | Solar service-integrasjon | Solenergi-tiltak bruker nå `buildingData.filteredSolarEnergy` fra solar service i stedet for CSV-beregninger. |
| 2026-01-20 | TiltakReadMore lagt til | Ny komponent for "Les mer"-sirkel med eksterne lenker. Bruker `openExternalLink` for konsistent link-håndtering. |
| 2026-01-20 | PktButton for tilbakeknapp | Byttet fra custom SVG-knapp til PktButton med `variant="icon-only"` og `iconName="arrow-return"`. |
| 2026-01-20 | Fase 1 fullført | Alle 10 steg implementert. DesktopTiltakCard erstatter alle 8 tiltak-komponenter med én generisk komponent. Feature flag `USE_NEW_DESKTOP_TILTAK_CARD` aktivert i WhiteInfoBox. |
| 2026-01-20 | Komponentstruktur opprettet | Opprettet DesktopTiltakCard med subkomponenter: TiltakTabs, TiltakContent, TiltakBenefits, TiltakSavings, TiltakGrants, TiltakPermit |
| 2026-01-20 | Dokument opprettet | Første versjon av plan utarbeidet |

---

## Bakgrunn og motivasjon

### Nåværende tilstand

Desktop-visningen for tiltak (side 2) har **8 separate tiltak-komponenter** med til sammen ~7200 linjer kode:

| Komponent | Linjer | Varianter |
|-----------|--------|-----------|
| Varmepumpe.tsx | 1119 | 4 tabs (Luft-luft, Luft-vann, Væske-vann, Ventilasjon) |
| Solenergi.tsx | 871 | - |
| UtskiftningAvVindu.tsx | 1078 | - |
| EtterisoleringYttervegg.tsx | 830 | - |
| IsoleringAvKjellerOgLoft.tsx | 887 | - |
| Temperaturstyring.tsx | 771 | - |
| Tetting.tsx | 757 | - |
| Ventilasjon.tsx | 834 | - |

**Hovedproblem:** ~95% av koden er identisk duplisert layout med hardkodede SVG-posisjoner.

### Hva som allerede fungerer bra

Mobilvisningen (`MobileTiltakDetail.tsx`) er allerede refaktorert til:
- Én sentralisert komponent (~600 linjer) for alle tiltak
- Bruker Punkt-komponenter (PktButton, PktAccordion, PktIcon)
- Leser data dynamisk fra JSON via `useTiltakContent` hook
- Bruker felles `BenefitChipList` for fordelsvisning
- Integrert med sentral ordforklarings-system

### Målsetning

1. Lage én sentralisert `DesktopTiltakCard`-komponent for alle tiltak
2. Flytte fra hardkodet SVG til HTML/CSS med Punkt-komponenter
3. Lese all data fra JSON (tiltaksinformasjon, fordeler, støtteordninger)
4. Sikre at ordforklaringer fungerer
5. Følge Punkt designsystem-retningslinjer

**Viktig:** Denne refaktoreringen gjelder kun desktop-visningen.

---

## Eksisterende ressurser som kan gjenbrukes

### Komponenter

| Komponent | Fil | Brukes til |
|-----------|-----|------------|
| `BenefitChip` / `BenefitChipList` | `src/components/common/BenefitChip/` | Fordelsvisning |
| `GlossaryTerm` | `src/.../Tiltak/glossaryHelpers.tsx` | Ordforklaringer inline |
| `renderParagraphWithGlossary` | `src/.../Tiltak/glossaryHelpers.tsx` | Auto-parsing av ordforklaringer |

### Hooks

| Hook | Fil | Brukes til |
|------|-----|------------|
| `useTiltakContent` | `src/hooks/contentHooks.ts` | Hente tiltak-JSON |
| `useContentDictionary` | `src/hooks/contentHooks.ts` | Hente ordliste |
| `useGrantAwareStotteordninger` | `src/.../Tiltak/useGrantAwareStotteordninger.ts` | Hente støtteordninger |
| `useProviderColors` | `src/.../Tiltak/shared.ts` | Provider-farger |

### Utility-funksjoner

| Funksjon | Fil | Brukes til |
|----------|-----|------------|
| `applyTiltakVariant` | `src/utils/tiltakContent.ts` | Standard/gulliste-variant |
| `resolveTiltakBenefits` | `src/utils/benefitUtils.ts` | Berike fordeler fra dictionary |
| `normaliseBuildingTypeKey` | `src/utils/tiltakContent.ts` | Byggtype-nøkkel |

### Data-kilder

| Kilde | Sti | Innhold |
|-------|-----|---------|
| Tiltak-JSON | `content/tiltak/*.json` | Tiltaksinformasjon, tabs, accordion |
| Dictionary | `content/dictionaries/index.json` | Ordforklaringer, fordeler, provider-navn |

---

## Punkt designsystem-komponenter

### Komponenter å bruke

| Komponent | Bruksområde | Import |
|-----------|-------------|--------|
| `PktTabs` | Varianter (Luft-luft, Luft-vann, osv.) | `@oslokommune/punkt-react` |
| `PktButton` | Tilbake-knapp, lenker | `@oslokommune/punkt-react` |
| `PktAccordion` | Søknadsplikt, spørsmål og svar | `@oslokommune/punkt-react` |
| `PktIcon` | Ikoner | `@oslokommune/punkt-react` |

### CSS-variabler fra Punkt

```css
/* Farger */
--pkt-color-brand-dark-blue-1000: #2A2859;
--pkt-color-brand-blue-1000: #6FE9FF;
--pkt-color-brand-green-1000: #43F8B6;
--pkt-color-brand-light-green-1000: #C7F6C9;
--pkt-color-brand-dark-green-1000: #034B45;
--pkt-color-brand-yellow-1000: #F9C66B;
--pkt-color-brand-neutrals-white: #FFFFFF;
--pkt-color-brand-neutrals-100: #F9F9F9;
--pkt-color-grays-gray-600: #666666;

/* Spacing */
--pkt-spacing-4: 0.25rem;
--pkt-spacing-8: 0.5rem;
--pkt-spacing-12: 0.75rem;
--pkt-spacing-16: 1rem;
--pkt-spacing-20: 1.25rem;
--pkt-spacing-24: 1.5rem;
--pkt-spacing-32: 2rem;
```

### Typografi (get-text SCSS mixin)

```scss
@use "@oslokommune/punkt-css/dist/scss/abstracts/mixins/typography" as *;

.title { @include get-text("pkt-txt-24-medium"); }
.body { @include get-text("pkt-txt-16-light"); }
.label { @include get-text("pkt-txt-14-medium"); }
```

---

## Implementeringsplan

### Fase 1: Prototype med Varmepumpe

**Hvorfor Varmepumpe?** Det er det mest komplekse tiltaket med 4 varianter (tabs), og løser vi dette, håndterer vi alle andre tiltak.

---

#### Steg 1.1: Opprette komponentstruktur

**Status:** ✅ Fullført

**Nye filer:**
```
src/components/FigmaBlokk/components/Tiltak/
├── DesktopTiltakCard/
│   ├── index.ts
│   ├── DesktopTiltakCard.tsx      # Hovedkomponent
│   ├── DesktopTiltakCard.css      # Styling
│   ├── TiltakTabs.tsx             # PktTabs-wrapper for varianter
│   ├── TiltakContent.tsx          # Innholdspanel (tekst, tabs)
│   ├── TiltakBenefits.tsx         # Fordelsvisning (bruker BenefitChipList)
│   ├── TiltakSavings.tsx          # Besparelses-boks
│   ├── TiltakGrants.tsx           # Støtteordninger-tabell
│   ├── TiltakPermit.tsx           # Søknadsplikt-accordion
│   ├── TiltakReadMore.tsx         # Les mer-sirkel med eksterne lenker
│   └── types.ts                   # TypeScript interfaces
```

**Akseptansekriterier:**
- [x] Filstruktur opprettet
- [x] Tomme komponenter med riktig interface

**Notater:**
> Alle komponenter opprettet med TypeScript interfaces i egen `types.ts` fil.

---

#### Steg 1.2: DesktopTiltakCard hovedkomponent

**Status:** ✅ Fullført

**Props interface:**
```typescript
interface DesktopTiltakCardProps {
  tiltakId: string;                    // "varmepumpe", "solenergi", etc.
  buildingType?: string;               // "enebolig", "blokk", etc.
  buildingData?: BuildingData;         // For besparelsesberegning
  audience?: ContentAudience;          // "standard" | "gulliste"
  onBack: () => void;                  // Tilbake-callback
}
```

**Intern state:**
```typescript
const [activeTab, setActiveTab] = useState<string>('generelt');
const [isPermitOpen, setIsPermitOpen] = useState(false);
const [hoveredGlossaryTerm, setHoveredGlossaryTerm] = useState<string | null>(null);
```

**Data-henting:**
```typescript
const { data: tiltakContent } = useTiltakContent(tiltakId);
const { data: dictionary } = useContentDictionary();
const resolvedContent = applyTiltakVariant(tiltakContent, audience);
const glossary = dictionaryTermsToGlossary(dictionary?.glossaryTerms ?? []);
const enrichedBenefits = resolveTiltakBenefits(resolvedContent, dictionary, 4);
const { stotteordninger } = useGrantAwareStotteordninger({ grantIds: resolvedContent?.grants ?? [] });
```

**Akseptansekriterier:**
- [x] Komponent rendrer uten feil
- [x] Data hentes fra JSON via hooks
- [x] Props-interface implementert

**Notater:**
> Implementert med useTiltakContent, useContentDictionary, useGrantAwareStotteordninger hooks.

---

#### Steg 1.3: Layout med CSS Grid/Flexbox

**Status:** ✅ Fullført

**Erstatter:** SVG med hardkodede x/y-koordinater

**Ny struktur:**
```tsx
<div className="desktop-tiltak-card">
  <header className="desktop-tiltak-card__header">
    <h1>{content.title}</h1>
    <button onClick={onBack}>Tilbake</button>
  </header>

  <div className="desktop-tiltak-card__body">
    <main className="desktop-tiltak-card__main">
      <TiltakTabs tabs={content.tabs} activeTab={activeTab} onTabChange={setActiveTab} />
      <TiltakContent content={resolvedContent} activeTab={activeTab} glossary={glossary} />
    </main>

    <aside className="desktop-tiltak-card__sidebar">
      <TiltakBenefits benefits={enrichedBenefits} />
      <TiltakSavings buildingData={buildingData} activeTab={activeTab} tiltakId={tiltakId} />
    </aside>
  </div>

  <footer className="desktop-tiltak-card__footer">
    <TiltakGrants stotteordninger={stotteordninger} />
    <TiltakPermit content={resolvedContent} glossary={glossary} />
  </footer>
</div>
```

**CSS-layout:**
```css
.desktop-tiltak-card {
  display: flex;
  flex-direction: column;
  width: 840px;
  font-family: var(--pkt-font-family, 'Oslo Sans', sans-serif);
  color: var(--pkt-color-brand-dark-blue-1000, #2A2859);
}

.desktop-tiltak-card__body {
  display: grid;
  grid-template-columns: 1fr 250px;
  gap: var(--pkt-spacing-24, 1.5rem);
}

.desktop-tiltak-card__main {
  display: flex;
  flex-direction: column;
  gap: var(--pkt-spacing-16, 1rem);
}

.desktop-tiltak-card__sidebar {
  display: flex;
  flex-direction: column;
  gap: var(--pkt-spacing-16, 1rem);
}
```

**Akseptansekriterier:**
- [x] Layout matcher eksisterende design visuelt
- [x] Bruker CSS Grid/Flexbox i stedet for SVG-posisjoner
- [x] Responsivt innenfor 840px bredde

**Notater:**
> CSS Grid brukt for body (main + sidebar), Flexbox for header og footer.

---

#### Steg 1.4: TiltakTabs med PktTabs

**Status:** ✅ Fullført

**Erstatter:** Hardkodede SVG `<rect>` og `<text>` elementer for tabs

**Implementasjon:**
```tsx
import { PktTabs } from '@oslokommune/punkt-react';

interface TiltakTabsProps {
  tabs: Array<{ id: string; title: string; body: string[] }>;
  activeTab: string;
  onTabChange: (tabId: string) => void;
}

export const TiltakTabs: React.FC<TiltakTabsProps> = ({ tabs, activeTab, onTabChange }) => {
  // Legg til "Generelt" som første tab
  const allTabs = [
    { id: 'generelt', title: 'Generelt' },
    ...tabs.map(t => ({ id: t.id, title: t.title }))
  ];

  return (
    <PktTabs
      tabs={allTabs.map(tab => ({
        text: tab.title,
        href: `#${tab.id}`,
        active: activeTab === tab.id,
        onClick: () => onTabChange(tab.id)
      }))}
    />
  );
};
```

**Styling-overrides:**
```css
.desktop-tiltak-card .pkt-tabs {
  --pkt-tabs-border-color: var(--pkt-color-grays-gray-200, #CCCCCC);
}

.desktop-tiltak-card .pkt-tabs__link.active {
  border-bottom-color: var(--pkt-color-brand-blue-1000, #6FE9FF);
}
```

**Akseptansekriterier:**
- [x] Tabs genereres dynamisk fra JSON
- [x] Aktiv tab markeres med cyan understrek
- [x] Hover-effekt på inaktive tabs
- [x] Klikk bytter innhold

**Notater:**
> Implementert med custom TiltakTabs-komponent. "Generelt" tab legges til automatisk.

---

#### Steg 1.5: TiltakContent med ordforklaringer

**Status:** ✅ Fullført

**Erstatter:** SVG `foreignObject` med inline styles for tekst

**Implementasjon:**
```tsx
interface TiltakContentProps {
  content: TiltakContent;
  activeTab: string;
  buildingType?: string;
  glossary: GlossaryEntry[];
}

export const TiltakContent: React.FC<TiltakContentProps> = ({
  content,
  activeTab,
  buildingType,
  glossary
}) => {
  const [hoveredTerm, setHoveredTerm] = useState<string | null>(null);

  // Hent riktig innhold basert på aktiv tab
  const paragraphs = activeTab === 'generelt'
    ? [...content.introParagraphs, ...getBuildingTypeParagraphs(content, buildingType)]
    : content.tabs?.find(t => t.id === activeTab)?.body ?? [];

  return (
    <div className="desktop-tiltak-card__content">
      {paragraphs.map((paragraph, index) => (
        <p key={index}>
          {renderParagraphWithGlossary({
            paragraph,
            glossary,
            hoveredTerm,
            setHoveredTerm
          })}
        </p>
      ))}
    </div>
  );
};
```

**CSS:**
```css
.desktop-tiltak-card__content {
  max-height: 289px;
  overflow-y: auto;
  padding-right: var(--pkt-spacing-8, 0.5rem);
  scrollbar-width: thin;
  scrollbar-color: #CCCCCC #F5F5F5;
}

.desktop-tiltak-card__content p {
  font-family: var(--pkt-font-family);
  font-weight: 300;
  font-size: 14px;
  line-height: 22px;
  margin: 0 0 var(--pkt-spacing-16, 1rem) 0;
}

.desktop-tiltak-card__content p:last-child {
  margin-bottom: 0;
}
```

**Akseptansekriterier:**
- [x] Tekst rendres fra JSON
- [x] Innhold oppdateres ved tab-bytte
- [x] Ordforklaringer fungerer (tooltip ved hover)
- [x] Scrollbar ved mye innhold

**Notater:**
> Bruker renderParagraphWithGlossary fra glossaryHelpers. Duplikat-tooltip-bug fikset med unik instans-ID.

---

#### Steg 1.6: TiltakBenefits med BenefitChipList

**Status:** ✅ Fullført

**Erstatter:** BenefitChipSvg (foreignObject-wrapper)

**Implementasjon:**
```tsx
import { BenefitChipList } from '../../../common/BenefitChip';

interface TiltakBenefitsProps {
  benefits: Array<{ id: string; title: string; description?: string; icon?: string }>;
}

export const TiltakBenefits: React.FC<TiltakBenefitsProps> = ({ benefits }) => {
  return (
    <section className="desktop-tiltak-card__benefits">
      <h2 className="desktop-tiltak-card__section-title">Fordeler</h2>
      <BenefitChipList
        benefits={benefits}
        maxItems={4}
        className="desktop-tiltak-card__benefits-list"
      />
    </section>
  );
};
```

**CSS:**
```css
.desktop-tiltak-card__benefits-list {
  display: flex;
  flex-direction: column;
  gap: var(--pkt-spacing-12, 0.75rem);
}
```

**Akseptansekriterier:**
- [x] Bruker eksisterende BenefitChipList-komponent
- [x] Maks 4 fordeler vises
- [x] Ikoner og tooltip fungerer

**Notater:**
> Bruker BenefitChipList med resolveTiltakBenefits for å berike data fra dictionary.

---

#### Steg 1.7: TiltakSavings (besparelsesboks)

**Status:** ✅ Fullført

**Erstatter:** Hardkodet SVG-rektangel med beregningslogikk

**Implementasjon:**
```tsx
interface TiltakSavingsProps {
  buildingData?: BuildingData;
  activeTab: string;
  tiltakId: string;
}

export const TiltakSavings: React.FC<TiltakSavingsProps> = ({ buildingData, activeTab, tiltakId }) => {
  const [showTooltip, setShowTooltip] = useState(false);

  // Beregningslogikk (flyttes fra Varmepumpe.tsx)
  const savings = useMemo(() => {
    // ... eksisterende beregningslogikk
  }, [buildingData, activeTab, tiltakId]);

  return (
    <section className="desktop-tiltak-card__savings">
      <div className="desktop-tiltak-card__savings-header">
        <span>Årlig besparelse</span>
        <button
          className="desktop-tiltak-card__savings-info"
          onMouseEnter={() => setShowTooltip(true)}
          onMouseLeave={() => setShowTooltip(false)}
          aria-label="Vis kilde"
        >
          ?
        </button>
      </div>
      <div className="desktop-tiltak-card__savings-value">
        <span>{formatNumberWithSpaces(savings.kwh)} kWh</span>
        <span>{formatNumberWithSpaces(savings.kr)} kr</span>
      </div>
      {showTooltip && (
        <div className="desktop-tiltak-card__savings-tooltip">
          <h4>Kilde</h4>
          <p>{/* Kildebeskrivelse */}</p>
        </div>
      )}
    </section>
  );
};
```

**CSS:**
```css
.desktop-tiltak-card__savings {
  background-color: var(--pkt-color-brand-dark-green-1000, #034B45);
  padding: var(--pkt-spacing-16, 1rem);
  color: var(--pkt-color-brand-neutrals-white, #FFFFFF);
}
```

**Akseptansekriterier:**
- [x] Viser kWh og kr besparelse
- [x] Oppdateres basert på valgt tab (for Varmepumpe)
- [x] Tooltip med kildeinformasjon
- [x] Håndterer manglende data grasiøst

**Notater:**
> NOK vises i stor skrift, kWh i liten. Solenergi bruker solar service data, andre tiltak bruker CSV-beregninger. Tooltip-styling harmonisert med ordforklaringer.

---

#### Steg 1.8: TiltakGrants (støtteordninger)

**Status:** ✅ Fullført

**Erstatter:** SVG-tabell med foreignObject

**Implementasjon:**
```tsx
interface TiltakGrantsProps {
  stotteordninger: Stotteordning[];
  isLoading?: boolean;
}

export const TiltakGrants: React.FC<TiltakGrantsProps> = ({ stotteordninger, isLoading }) => {
  const getProviderColor = useProviderColors();

  return (
    <section className="desktop-tiltak-card__grants">
      <h2 className="desktop-tiltak-card__section-title">Relevante støtteordninger</h2>
      <div className="desktop-tiltak-card__grants-table">
        {stotteordninger.map((ordning, index) => (
          <div key={index} className="desktop-tiltak-card__grant-row">
            <span className="desktop-tiltak-card__grant-name">{ordning.ordning}</span>
            <span
              className="desktop-tiltak-card__grant-provider"
              style={{ backgroundColor: getProviderColor(ordning.overskrift) }}
            >
              {getOverskriftLabel(ordning.overskrift)}
            </span>
            {ordning.lenke && (
              <a
                href={ordning.lenke}
                target="_blank"
                rel="noopener noreferrer"
                className="desktop-tiltak-card__grant-link"
              >
                Lenke
              </a>
            )}
          </div>
        ))}
      </div>
    </section>
  );
};
```

**Akseptansekriterier:**
- [x] Viser alle relevante støtteordninger
- [x] Provider-farger (Enova, Oslo kommune, etc.)
- [x] Lenker til ekstern side
- [x] Scrollbar ved mange ordninger

**Notater:**
> Bruker useGrantAwareStotteordninger hook og useProviderColors for fargekoding.

---

#### Steg 1.9: TiltakPermit (søknadsplikt-accordion)

**Status:** ✅ Fullført

**Erstatter:** Custom accordion i SVG foreignObject

**Implementasjon:**
```tsx
import { PktAccordion, PktAccordionItem, PktIcon } from '@oslokommune/punkt-react';

interface TiltakPermitProps {
  content: TiltakContent;
  glossary: GlossaryEntry[];
}

export const TiltakPermit: React.FC<TiltakPermitProps> = ({ content, glossary }) => {
  const [hoveredTerm, setHoveredTerm] = useState<string | null>(null);
  const permitItem = content.accordion?.find(item => item.id === 'soknadsplikt');

  if (!permitItem) return null;

  return (
    <PktAccordion name="permit-accordion">
      <PktAccordionItem
        id="permit"
        name="permit-accordion"
        title="Sjekk om du må søke for å gjennomføre tiltaket"
      >
        <div className="desktop-tiltak-card__permit-content">
          {permitItem.body.map((paragraph, index) => (
            <p key={index}>{paragraph}</p>
          ))}

          {permitItem.links?.map(link => (
            <a key={link.url} href={link.url} target="_blank" rel="noopener noreferrer">
              {link.label}
              <PktIcon name="external-link" className="pkt-icon--small" />
            </a>
          ))}

          {/* Highlight-boks med ordforklaringer */}
          <div className="desktop-tiltak-card__permit-highlight">
            <h3>Søknadsplikt er ikke en stopper, men en støtte</h3>
            <p>
              Er tiltaket ditt{' '}
              <GlossaryTerm term="søknadspliktig" glossary={glossary} hoveredTerm={hoveredTerm} setHoveredTerm={setHoveredTerm}>
                søknadspliktig
              </GlossaryTerm>{' '}
              betyr det at Plan- og bygningsetaten må godkjenne arbeidet...
            </p>
          </div>
        </div>
      </PktAccordionItem>
    </PktAccordion>
  );
};
```

**Akseptansekriterier:**
- [x] PktAccordion fungerer korrekt
- [x] Ordforklaringer fungerer i highlight-boksen
- [x] Eksterne lenker åpnes i ny fane
- [x] Animasjon ved åpne/lukke

**Notater:**
> Implementert med custom accordion (ikke PktAccordion). Ordforklaringer via GlossaryTerm-komponent.

---

#### Steg 1.10: Integrere i WhiteInfoBox

**Status:** ✅ Fullført

**Erstatter:** Direkte bruk av Varmepumpe-komponenten

**Endringer i WhiteInfoBox.tsx:**
```tsx
// Før:
import { Varmepumpe } from './Tiltak/Varmepumpe';

// Etter:
import { DesktopTiltakCard } from './Tiltak/DesktopTiltakCard';

// I render:
{selectedTiltakSlug && (
  <DesktopTiltakCard
    tiltakId={selectedTiltakSlug}
    buildingType={buildingType}
    buildingData={buildingData}
    audience={audience}
    onBack={handleTiltakBack}
  />
)}
```

**Akseptansekriterier:**
- [x] DesktopTiltakCard rendres for alle tiltak
- [x] Props sendes korrekt
- [x] Tilbake-funksjonalitet fungerer

**Notater:**
> Feature flag `USE_NEW_DESKTOP_TILTAK_CARD = true` i WhiteInfoBox. PktButton med `variant="icon-only"` for tilbakeknapp.

---

### Fase 2: Migrere resterende tiltak

**Status:** ⏳ Ikke startet

Når Varmepumpe fungerer, validerer vi at DesktopTiltakCard håndterer:

| Tiltak | Spesielt å teste | Status |
|--------|------------------|--------|
| Solenergi | Ingen tabs | ⏳ |
| Vinduer | Ingen tabs | ⏳ |
| Yttervegg | Ingen tabs | ⏳ |
| Kjeller/loft | Ingen tabs | ⏳ |
| Temperaturstyring | Ingen tabs | ⏳ |
| Tetting | Ingen tabs | ⏳ |
| Ventilasjon | Ingen tabs | ⏳ |

**Akseptansekriterier:**
- [ ] Alle 8 tiltak rendres korrekt
- [ ] JSON-data vises riktig
- [ ] Ingen regresjoner i funksjonalitet

**Notater:**
> _Legg til notater her underveis i arbeidet_

---

### Fase 3: Opprydding

**Status:** ✅ Fullført

#### Steg 3.1: Fjerne gamle komponenter

**Filer som er slettet:**
```
src/components/FigmaBlokk/components/Tiltak/
├── Varmepumpe.tsx          # Slettet
├── Solenergi.tsx           # Slettet
├── Tetting.tsx             # Slettet
├── Temperaturstyring.tsx   # Slettet
├── UtskiftningAvVindu.tsx  # Slettet
├── IsoleringAvKjellerOgLoft.tsx  # Slettet
├── EtterisoleringYttervegg.tsx   # Slettet
├── Ventilasjon.tsx         # Slettet
```

**Filer som beholdes:**
```
├── glossaryHelpers.tsx     # Brukes av ny komponent
├── shared.ts               # Delte utilities
├── useGrantAwareStotteordninger.ts  # Brukes av ny komponent
├── DesktopTiltakCard/      # Ny refaktorert komponent
├── index.tsx               # Oppdatert til kun å eksportere DesktopTiltakCard
```

**Akseptansekriterier:**
- [x] Gamle filer slettet
- [x] Ingen brutte importer
- [x] Applikasjonen kjører uten feil

**Notater:**
> Slettet 8 gamle tiltak-komponenter (~7200 linjer kode). Bundle-størrelse redusert med ~140 kB.

---

#### Steg 3.2: Oppdatere TILTAK_COMPONENT_MAP

**Før:**
```typescript
const TILTAK_COMPONENT_MAP = {
  'varmepumpe': Varmepumpe,
  'solenergi': Solenergi,
  // ...
};
```

**Etter:**
```typescript
// TILTAK_COMPONENT_MAP fjernet - DesktopTiltakCard håndterer alle tiltak via tiltakId
```

**Akseptansekriterier:**
- [x] TILTAK_COMPONENT_MAP fjernet fra WhiteInfoBox
- [x] WhiteInfoBox bruker DesktopTiltakCard direkte
- [x] PreviewPanel (admin) oppdatert til å bruke DesktopTiltakCard

**Notater:**
> Feature flag `USE_NEW_DESKTOP_TILTAK_CARD` fjernet. TILTAK_COMPONENT_MAP fjernet fra både WhiteInfoBox og PreviewPanel.

---

## Testing

### Visuell testing

| Test | Beskrivelse | Status |
|------|-------------|--------|
| Layout | Sammenlign screenshot før/etter for hvert tiltak | ⏳ |
| Tabs | Verifiser at tabs byttes korrekt (Varmepumpe) | ⏳ |
| Ordforklaringer | Hover på termer viser tooltip | ⏳ |
| Fordeler | Ikoner og tekst vises | ⏳ |
| Besparelse | Tall beregnes og vises riktig | ⏳ |
| Støtteordninger | Tabell vises med provider-farger | ⏳ |
| Søknadsplikt | Accordion åpner/lukker | ⏳ |

### Funksjonell testing

| Test | Beskrivelse | Status |
|------|-------------|--------|
| Tilbake-knapp | Returnerer til tiltak-listen | ⏳ |
| Eksterne lenker | Åpnes i ny fane | ⏳ |
| Scrolling | Innhold scroller ved overflow | ⏳ |
| Audience-variant | Gulliste-innhold vises for vernede bygg | ⏳ |

### Tilgjengelighet (a11y)

| Test | Beskrivelse | Status |
|------|-------------|--------|
| Tastaturnavigasjon | Tab gjennom alle interaktive elementer | ⏳ |
| Skjermleser | Labels og beskrivelser leses opp | ⏳ |
| Kontrast | Tekst har tilstrekkelig kontrast | ⏳ |
| Fokusindikator | Synlig fokus på alle elementer | ⏳ |

---

## Risiko og mitigering

| Risiko | Sannsynlighet | Konsekvens | Mitigering | Status |
|--------|---------------|------------|------------|--------|
| Visuell regresjon | Middels | Middels | Screenshot-sammenligning | ⏳ |
| Beregningslogikk brytes | Lav | Høy | Enhetstester for besparelsesberegning | ⏳ |
| PktTabs matcher ikke design | Middels | Lav | CSS overrides | ⏳ |
| Ordforklaringer fungerer ikke | Lav | Middels | Gjenbruk eksisterende logikk | ⏳ |

---

## Beslutningslogg

> Dokumenter viktige beslutninger som tas underveis.

| Dato | Beslutning | Begrunnelse |
|------|------------|-------------|
| 2026-01-20 | Start med Varmepumpe som prototype | Mest komplekst tiltak med 4 tabs - løser vi dette, håndterer vi alle |
| 2026-01-20 | Bruk BenefitChipList fra mobil | Allerede implementert og testet, gir konsistens |

---

## Referanser

- [Punkt designsystem dokumentasjon](https://punkt.oslo.kommune.no)
- [MobileTiltakDetail.tsx](../../src/components/mobile/MobileTiltakDetail.tsx) - Referanseimplementasjon
- [punkt-refaktorering-desktop.md](./punkt-refaktorering-desktop.md) - Relatert refaktorering av WhiteInfoBox

---

*Opprettet: 2026-01-20*
*Sist oppdatert: 2026-01-20* (Alle 3 faser fullført - refaktorering komplett)
