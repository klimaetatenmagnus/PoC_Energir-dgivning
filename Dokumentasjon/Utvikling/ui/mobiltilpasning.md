# Mobiltilpasning av Energirådgivning

## Målsetning

Tilpasse web-tjenesten for mobil slik at den fungerer godt på smarttelefoner og nettbrett. Løsningen er i dag designet for desktop (1728×900px) med skalering, men mangler ekte responsivt design.

## Nåværende situasjon

### Desktop-first design
- Faste dimensjoner: 1728×900px designflate
- Skalering via `useFigmaViewportMetrics.ts` - hele designet skaleres ned proporsjonalt
- Absolutt posisjonering med hardkodede pikselverdier
- Ingen CSS media queries eller Tailwind breakpoints

### Skaleringssystemet i detalj

**Hook:** `src/hooks/useFigmaViewportMetrics.ts`

```
Design Dimensions:
- DESIGN_WIDTH = 1728px
- DESIGN_HEIGHT = 900px
- VIEWPORT_PADDING = 10px

Skaleringlogikk:
- scaleX = viewportWidth / 1728
- scaleY = viewportHeight / 900
- scaleFactor = Math.min(scaleX, scaleY, 1)  // Skalerer ALDRI opp, kun ned
- verticalOffset = (viewportHeight - scaledHeight) / 2  // Sentrerer vertikalt
```

**Hovedproblem:** Designet skaleres ned proporsjonalt på små skjermer, noe som gjør tekst og knapper uleselig.

### Visuell analyse (utført med Playwright MCP)

| Skjerm | Desktop (1280×800) | Mobil (375×812) |
|--------|-------------------|-----------------|
| **Landing** | Fungerer bra | Logo/tittel svært små, mye grå plass |
| **Tiltaksvalg** | Side-ved-side layout | Alt skalert ned, uleselig |
| **Tiltaksdetalj** | Fungerer bra | Tabs og tekst for små |

**Skjermbilder lagret i:** `.playwright-mcp/`
- `app-desktop-landing.png`
- `app-mobile-landing.png`
- `screen2-desktop.png`
- `screen2-mobile.png`
- `screen3-tiltak-detail-desktop.png`
- `screen3-tiltak-detail-mobile.png`

### Hovedutfordringer
1. **Tiltaksknapper** (471×50px) - for små på mobil når de skaleres ned
2. **Husanimasjon** fra side 1 til 2 - krever presise koordinater som ikke fungerer på smale skjermer
3. **Infoboks** (840×790px) - høyere enn de fleste mobilskjermer
4. **Side-ved-side layout** - fungerer ikke på smale skjermer
5. **Touch-targets** - knapper blir under 44×44px minimumskrav

### Komponenter med hardkodede dimensjoner

| Komponent | Fil | Hardkodede verdier | Utfordring |
|-----------|-----|--------------------|------------|
| **Artboard** | `FigmaLanding.tsx` | 1728×900px | Alt innhold skaleres |
| **Skyline** | `OsloSkyline.tsx` | viewBox="0 -10 1728 362" | Faste koordinater for animasjon |
| **Tiltaksknapper** | `EnergySolutionButtons.tsx` | 471×50px per knapp, 53.5-73px energibokser | For smalt på mobil |
| **Infoboks** | `WhiteInfoBox.tsx` | 840×790px, 30+ y-koordinater | Kompleks SVG-layout |
| **Animasjon** | `FigmaMainScript.tsx` | ENEBOLIG_START_LEFT=289, BLOKK_START_LEFT=1051 | Faste pikselkoordinater |

---

## Verktøy for utvikling

### Storybook (v10.1.1)
Isolert komponentutvikling og testing.

**Oppstart:**
```bash
npm run storybook
```

**URL:** http://localhost:6006

**Viewport-testing:**
- Trykk `V` for viewport-velger, eller meny øverst til høyre
- Forhåndsdefinerte enheter: iPhone SE/14/14 Pro Max, Pixel 7, Galaxy S21, iPad Mini/Pro, Desktop

**Konfigurasjon:**
- `.storybook/main.ts` - addons og story-patterns
- `.storybook/preview.ts` - viewport-størrelser og globale parametere

### Storybook MCP Addon
Gir AI-agenter (Claude Code) direkte tilgang til Storybook-informasjon.

**Installert:** `@storybook/addon-mcp`

**MCP-endepunkt:** http://localhost:6006/mcp (når Storybook kjører)

**Konfigurasjon:** `.mcp.json` (prosjektrot)
```json
{
  "mcpServers": {
    "storybook": {
      "type": "http",
      "url": "http://localhost:6006/mcp"
    }
  }
}
```

**Viktig:** Storybook må kjøre FØR Claude Code startes for at MCP-tilkoblingen skal fungere.

### Playwright MCP
Lar Claude Code interagere med nettleseren direkte for testing og utforsking.

**Konfigurasjon:** `.mcp.json` (prosjektrot)
```json
{
  "mcpServers": {
    "playwright": {
      "command": "npx",
      "args": ["@playwright/mcp@latest"]
    }
  }
}
```

**Bruksområder for mobiltilpasning:**
- Navigere til appen og Storybook
- Resize viewport til mobil/tablet/desktop størrelser
- Ta skjermbilder for dokumentasjon
- Verifisere touch-targets (min 44×44px)
- Sjekke accessibility-tree

### Punkt designsystem
Oslo kommunes designsystem med responsive komponenter.

**Pakker installert:**
- `@oslokommune/punkt-react` - React-komponenter
- `@oslokommune/punkt-css` - Stilark
- `@oslokommune/punkt-assets` - Fonter og ikoner

**Relevante komponenter for mobiltilpasning:**
- `PktButton` - Touch-friendly knapper
- `PktAccordion` - Sammenleggbare seksjoner
- `PktTag` - Etiketter
- `PktCard` - Kort-komponenter

---

## Plan for mobiltilpasning

> **VIKTIG:** Denne planen er et levende dokument. Logg og "Neste skritt"-seksjonen MÅ holdes oppdatert underveis i arbeidet. Oppdater loggen hver gang en oppgave fullføres, og oppdater "Neste skritt" når du starter på en ny oppgave.

### Anbefalt tilnærming: Hybrid

Kombinere desktop Figma-design med responsiv mobilversjon:
- **Desktop/Tablet (≥768px):** Behold eksisterende Figma-basert design
- **Mobil (<768px):** Ny responsiv layout med vertikal stacking

#### Designprinsipper for mobil

**Bruk av Punkt designsystem:**
- Alle Figma-komponenter som erstattes på mobil skal så langt det lar seg gjøre erstattes av komponenter fra [Punkt designsystem](https://punkt.oslo.kommune.no/)
- Følg Punkt sine designretningslinjer for spacing, typografi, farger og interaksjon
- Bruk Punkt-komponenter som `PktButton`, `PktAccordion`, `PktCard`, `PktTag` etc. der det er relevant
- Sørg for konsistens med Oslo kommunes visuelle identitet

### Breakpoints

Følger Oslo kommune Punkt designsystem:
https://punkt.oslo.kommune.no/latest/grunnleggende/ressurser/breakpoints/

| Breakpoint | Bredde | Enhet |
|------------|--------|-------|
| `mobile` | < 576px | Små mobiler (iPhone SE) |
| `phablet` | 576-767px | Store mobiler |
| `tablet` | 768-1023px | Tablets (MOBIL/DESKTOP BREAKPOINT) |
| `tablet-big` | 1024-1279px | Store tablets |
| `laptop` | 1280-1599px | Laptop |
| `desktop` | ≥ 1600px | Desktop |

---

## Neste skritt

> **Oppdater denne seksjonen** hver gang du starter på en ny oppgave eller fullfører en oppgave.

### Aktiv oppgave
*Fase 5 - Animasjoner og overganger*

### Kommende oppgaver
1. [x] Opprette `useResponsive` hook (`src/hooks/useResponsive.ts`)
2. [x] Oppdatere `useFigmaViewportMetrics.ts` med `isMobileView`
3. [x] Definere Tailwind breakpoints i `tailwind.config.js`
4. [x] Opprette `MobileLanding.tsx` (med Punkt-komponenter)
5. [x] Betinget rendering i `App.tsx`
6. [x] Responsivt søkefelt
7. [x] Opprette `MobileEnergySolutions.tsx`
8. [x] Opprette `MobileInfoBox.tsx`
9. [x] Responsiv energiskala (statisk)
10. [x] **Besparelseskort på mobil** (MobileSavingsFooter - grunnimplementasjon ferdig)
11. [x] **Forbedre besparelsesfooter** (layout, animasjon, Punkt-farger)
12. [x] **Dynamisk energikarakter på mobil** (oppdatere A-G skala ved tiltaksvalg)
13. [x] **Forbedret besparelsesgraf** (x-akse med hakk og kroneverdier, dynamisk skalering)
14. [x] **Opprette `MobileTiltakDetail.tsx`** (Fase 4) - Full-skjerm tiltaksdetaljer med tabs, accordion og støtteordninger
15. [ ] Forenklet mobilanimasjon (Fase 5)
16. [ ] Respektere `prefers-reduced-motion` (Fase 5)

---

## Faseoversikt og logg

> **VIKTIG:** Oppdater loggen hver gang en oppgave fullføres. Kryss av fasen når ALLE oppgaver i fasen er fullført.

| Fase | Beskrivelse | Status | Fullført |
|------|-------------|--------|----------|
| **Fase 1** | Infrastruktur og deteksjon | Fullført | [x] |
| **Fase 2** | Landing-side (Skjerm 1) | Fullført | [x] |
| **Fase 3** | Tiltaksvalg (Skjerm 2) | Fullført | [x] |
| **Fase 4** | Tiltaksdetalj (Skjerm 3) | Fullført | [x] |
| **Fase 5** | Animasjoner og overganger | Ikke startet | [ ] |
| **Fase 6** | Testing og polish | Ikke startet | [ ] |

---

### Fase 1: Infrastruktur og deteksjon

**Mål:** Legge grunnlaget for responsiv design

**Oppgaver:**
| # | Oppgave | Status |
|---|---------|--------|
| 1.1 | Opprette `useResponsive` hook | [x] |
| 1.2 | Oppdatere `useFigmaViewportMetrics.ts` med `isMobileView` | [x] |
| 1.3 | Definere Tailwind breakpoints | [x] |

**Detaljer:**
1. **Opprette `useResponsive` hook**
   - Detektere viewport-bredde
   - Returnere `isMobile`, `isTablet`, `isDesktop` flags
   - Fil: `src/hooks/useResponsive.ts`

2. **Oppdatere `useFigmaViewportMetrics.ts`**
   - Returnere `isMobileView` basert på breakpoint
   - Tillate betinget rendering av mobil/desktop-versjoner

3. **Definere Tailwind breakpoints**
   - Oppdatere `tailwind.config.js` med konsistente breakpoints

**Filer som endres:**
- `src/hooks/useFigmaViewportMetrics.ts`
- `src/hooks/useResponsive.ts` (ny)
- `tailwind.config.js`

#### Logg Fase 1
| Dato | Handling | Detaljer |
|------|----------|----------|
| 2025-11-28 | Opprettet `useResponsive.ts` | Hook med Punkt breakpoints (mobile/phablet/tablet/tablet-big/laptop/desktop) |
| 2025-11-28 | Oppdatert `useFigmaViewportMetrics.ts` | Lagt til `isMobileView` basert på tablet breakpoint (768px) |
| 2025-11-28 | Oppdatert `tailwind.config.js` | Definert Punkt-kompatible breakpoints |
| 2025-11-28 | Oppdatert dokumentasjon | Breakpoints endret til Punkt designsystem standard |

---

### Fase 2: Landing-side (Skjerm 1)

**Mål:** Responsiv landing-side

**Oppgaver:**
| # | Oppgave | Status |
|---|---------|--------|
| 2.1 | Opprette `MobileLanding.tsx` | [x] |
| 2.2 | Betinget rendering i `App.tsx` | [x] |
| 2.3 | Responsivt søkefelt | [x] |

**Desktop (≥768px):**
- Behold eksisterende Figma-layout med skyline

**Mobil (<768px):**
- Forenklet layout uten skyline-animasjon
- Større logo og tittel
- Full-bredde søkefelt
- Statisk bakgrunnsbilde eller forenklet skyline

**Detaljer:**
1. **Opprette `MobileLanding.tsx`**
   - Responsiv versjon av FigmaLanding
   - Bruk Tailwind for layout
   - Full-bredde søkefelt med touch-friendly knapp

2. **Betinget rendering i `App.tsx`**
   - Vis `MobileLanding` på mobil
   - Vis `FigmaLanding` på desktop

3. **Responsivt søkefelt**
   - Min 44×44px touch-target på søkeknapp
   - Autocomplete som fungerer på mobil

**Filer som endres:**
- `src/App.tsx`
- `src/components/MobileLanding.tsx` (ny)
- `src/components/FigmaBlokk/FigmaLanding.tsx` (betinget)

#### Logg Fase 2
| Dato | Handling | Detaljer |
|------|----------|----------|
| 2025-11-28 | Opprettet `MobileLanding.tsx` | Mobil landing med Punkt-komponenter (PktButton, PktAlert) |
| 2025-11-28 | Implementert betinget rendering | App.tsx bruker `isMobileView` fra useResponsive hook |
| 2025-11-28 | Responsivt søkefelt | Touch-friendly (min 48px), pkt-input klasse, full-bredde |
| 2025-11-28 | CSS for mobil | Nye stiler i components.css med Punkt breakpoints |
| 2025-11-28 | Punkt-stiler på søkefelt | `border-radius: 0`, Punkt CSS-variabler, 8px gap |
| 2025-11-28 | Opprettet `MiniSkyline.tsx` | Komplette bygninger fra OsloSkyline med justerbar posisjonering |
| 2025-11-28 | Blinkende vinduer i MiniSkyline | Integrert `useSkylineLights` hook for animerte vinduer |

#### Forbedringsmuligheter (backlog)
- [x] ~~**Søkefelt-ramme:** Legg til gul ramme langs høyre kant av søkefeltet~~ → Endret til Punkt-standard: `border-radius: 0`, 2px mørkeblå ramme
- [x] **Søkeknapp-høyde:** Juster søkeknappen til samme høyde som søkefeltet (3rem/48px)
- [x] ~~**Søkeknapp-farger:** Inverter farger~~ → Beholder Punkt primary-stil for konsistens
- [x] **Padding mellom felt og knapp:** Lagt til 8px gap mellom søkefelt og knapp
- [x] **Mini-skyline:** Lagt til `MiniSkyline.tsx` med komplette bygninger fra OsloSkyline (høy blokk, enebolig, trapp-tak bygning, enebolig med tilbygg)

---

### Fase 3: Tiltaksvalg (Skjerm 2)

**Mål:** Responsiv tiltaksvalg-side

**Oppgaver:**
| # | Oppgave | Status |
|---|---------|--------|
| 3.1 | Opprette `MobileEnergySolutions.tsx` | [x] |
| 3.2 | Opprette `MobileInfoBox.tsx` | [x] |
| 3.3 | Responsiv energiskala | [x] |
| 3.4 | Betinget rendering i `App.tsx` | [x] |

**Desktop (≥768px):**
- Behold side-ved-side layout (infoboks + tiltaksknapper + illustrasjon)

**Mobil (<768px):**
- Vertikal stacking:
  1. Header med tilbake-knapp
  2. Adresse og nøkkelinfo (sammenleggbar)
  3. Energiskala (full bredde)
  4. Tiltaksliste (full bredde, scrollbar)
- Dropp hus-illustrasjon på mobil

**Detaljer:**
1. **Opprette `MobileEnergySolutions.tsx`**
   - Vertikal layout med Tailwind
   - Touch-friendly tiltaksknapper (min 44×44px)
   - Full-bredde energiskala

2. **Opprette `MobileInfoBox.tsx`**
   - Sammenleggbar nøkkelinformasjon
   - Bruk `PktAccordion` fra Punkt
   - Kart som egen ekspanderbar seksjon

3. **Responsiv energiskala**
   - Horisontal scroll på smale skjermer
   - Eller vertikal visning

4. **Oppdatere `FigmaMainScript.tsx`**
   - Betinget rendering av mobil/desktop

**Filer som endres:**
- `src/components/FigmaMainScript.tsx`
- `src/components/mobile/MobileEnergySolutions.tsx` (ny)
- `src/components/mobile/MobileInfoBox.tsx` (ny)
- `src/components/mobile/MobileEnergyScale.tsx` (ny)

#### Logg Fase 3
| Dato | Handling | Detaljer |
|------|----------|----------|
| 2025-11-28 | Opprettet `MobileEnergySolutions.tsx` | Responsiv tiltaksvalg med Punkt-komponenter (PktCheckbox, PktTag, PktAccordion, PktButton) |
| 2025-11-28 | Opprettet `MobileEnergySolutions.css` | Stiler med Punkt CSS-variabler og spacing |
| 2025-11-28 | Betinget rendering i `App.tsx` | Viser MobileEnergySolutions på mobil i figma-blokk mode |
| 2025-11-28 | Opprettet `MobileInfoBox.tsx` | Mobil infoboks med adresse, nøkkelinfo, besparelser, kart og Gul liste-støtte |
| 2025-11-28 | Opprettet `MobileInfoBox.css` | Stiler for infoboks med slide-up animasjon |
| 2025-11-28 | Integrert MobileInfoBox i MobileEnergySolutions | Kan åpnes som modal via "Vis mer om boligen"-knapp |
| 2025-11-28 | Opprettet `MobileSavingsFooter.tsx` | Sticky footer med besparelsesvisning og animert søyle |
| 2025-11-28 | Opprettet `MobileSavingsFooter.css` | Stiler for footer med CSS-animasjoner |
| 2025-11-28 | Implementert beregningslogikk | `calculateSavings` og `calculatedYearlyConsumption` i MobileEnergySolutions |
| 2025-11-28 | Fikset bruksareal-henting | Støtte for `bruksarealM2`, `bruksareal_totalt` m.fl. feltnavn |
| 2025-11-28 | Fikset tiltaksnavn-matching | Støtte for både "Isolering av kjeller og loft" og "Etterisolering av kjeller og loft" |
| 2025-11-28 | Forbedret MobileSavingsFooter | Ny layout (overskrift→graf→verdier), animert søyle, Punkt-farger |
| 2025-12-01 | Midtstilt adresse og infoblokker | Adresse-seksjon og tags sentrert for bedre visuell balanse |
| 2025-12-01 | Bygningsillustrasjon ved energiskala | Importert `EneboligSvg` og `BlokkSvg` fra BuildingSprites, vises til høyre for energiskala |
| 2025-12-01 | Forbedret tips-knapp | Flyttet rett til høyre for "Energikarakter"-overskriften, økt klikkbart område (min 44x44px) |
| 2025-12-01 | Fikset soldata-henting for mobil | `fetchSolarData` kaltes med feil argumenter (to separate vs. objekt), gnr/bnr konverteres til number |
| 2025-12-03 | Forbedret MobileSavingsFooter graf | Lagt til x-akse med 41 hakk og 5 kroneverdier, dynamisk skalering |
| 2025-12-03 | Implementert "voks først, zoom ut etterpå" | Søylen viser vekst før skalaen utvides |
| 2025-12-03 | Endret bakgrunnsfarge | Fra beige til lysegrå (`--pkt-color-surface-strong-gray`) |
| 2025-12-03 | Oppdatert overskrift-font | Matcher "Velg tiltak for din bolig" (Oslo Sans, 1.125rem, weight 500) |
| 2025-12-03 | Fjernet besparelse fra MobileInfoBox | Vises kun i MobileSavingsFooter for å unngå duplisering |
| 2025-12-03 | InfoBox høyde | Strekker seg ned til footer når begge vises (`100dvh - 130px`) |
| 2025-12-03 | Større lukke-knapp | Ikon økt til 32x32px, touch-target 48x48px |
| 2025-12-03 | Highlight-effekt | Bakgrunn blinker `--pkt-color-grays-gray-100` når tiltak legges til |
| 2025-12-03 | Energikarakter z-index | Ny karakter (`--new`) ligger over opprinnelig (`z-index: 2` vs `1`) |
| 2025-12-03 | Visuell seksjonering | Grå bakgrunn på hele siden (`neutrals-100`), skillelinjer mellom seksjoner (`grays-gray-100`) |
| 2025-12-03 | Scrollbar tiltaksliste | Kun tiltakslisten scroller, header/adresse/energiskala forblir synlig |
| 2025-12-03 | Fjernet "X tiltak valgt" accordion | Redundant oppsummering fjernet, info vises i MobileSavingsFooter |
| 2025-12-03 | Fikset scrolling med footer | Lagt til `padding-bottom: 170px` på tiltak-seksjonen når footer vises, slik at siste tiltak kan scrolles over footeren |
| 2025-12-03 | Redesignet tiltaksliste | Tiltakene er nå samlet i ett kort med felles ramme og skillelinjer mellom, i stedet for individuelle rammer per tiltak |
| 2025-12-03 | Scroll-indikator | Lagt til nedoverpekende chevron som vises når listen kan scrolles, forsvinner når brukeren begynner å scrolle |
| 2025-12-05 | Synkronisert zoom-ut animasjon | Graf og akse animeres nå synkront - hakk komprimeres mot venstre, nye hakk glir inn fra høyre, søylen krymper i takt |

#### Fullført arbeid (Fase 3)

##### ✅ Implementert: Besparelsesfooter (MobileSavingsFooter)

Sticky footer som viser estimert besparelse når tiltak velges:
- `MobileSavingsFooter.tsx` - komponent med animert søyle
- `MobileSavingsFooter.css` - stiler med animasjoner
- Beregningslogikk basert på TEK-periode, bruksareal og tiltakstype
- Viser kr/år og kWh/år

##### ✅ Forbedringspunkter for besparelsesfooter (FULLFØRT 2025-12-03)

Alle forbedringer er implementert:

1. **Layout og struktur** ✅
   - [x] "Estimert besparelse" står øverst som overskrift (h3, Oslo Sans font)
   - [x] Grafen (søylen) vises under overskriften
   - [x] X-akse med 41 hakk og 5 kroneverdier (0 kr, 25%, 50%, 75%, maks kr)
   - [x] kr/år og kWh/år står nederst i boksen

2. **Animasjon av grafen** ✅
   - [x] Dynamisk skala basert på første tiltak (~50% av grafen)
   - [x] Søylen vokser først, deretter zoomer skalaen ut ved 90%
   - [x] **Synkronisert zoom-ut animasjon** (2025-12-05):
     - Hakk komprimeres fysisk mot venstre (representerer gammel skala)
     - Nye hakk glir inn fra høyre med fade-in
     - Søylen krymper synkront med aksen (samme timing, 600ms ease-out cubic)
     - Kroneverdier interpoleres smooth fra gamle til nye verdier
     - Implementert via `zoomAnimation` state med `requestAnimationFrame`
   - [x] Pop-animasjon (`barBounce`) når søylen vokser
   - [x] `isGrowing` state for å trigge animasjon ved økning
   - [x] Highlight-effekt på bakgrunn når tiltak legges til (`--pkt-color-grays-gray-100`)
   - [x] Skala resettes når alle tiltak fjernes

3. **Punkt designsystem farger** ✅
   - [x] Bakgrunn: `--pkt-color-surface-strong-gray` (#f2f2f2)
   - [x] Søyle: `--pkt-color-brand-dark-green-1000` (#034b45) med gradient
   - [x] Tekst: `--pkt-color-brand-dark-blue-1000` (#2a2859)
   - [x] X-akse verdier: `--pkt-color-brand-neutrals-700` (#4d4d4d)
   - [x] Hakk: `--pkt-color-brand-neutrals-400/600` for små/store hakk

4. **Responsiv justering** ✅
   - [x] `white-space: nowrap` på beløp for å unngå linjeskift
   - [x] Redusert font-size på små skjermer (<350px)
   - [x] `flex-wrap: wrap` for å håndtere veldig smale skjermer
   - [x] Padding på høyre side for sentrert siste x-akse verdi

##### ✅ Dynamisk energikarakter (FULLFØRT 2025-12-03)

- [x] **Dynamisk energikarakter på mobil**
  - Energiskalaen (A-G) oppdateres dynamisk når tiltak velges
  - Ny karakter vises med "Ny"-label og har høyere z-index enn opprinnelig
  - Forbedret karakter vises med mørkeblå ramme og puls-animasjon

##### ✅ MobileInfoBox forbedringer (FULLFØRT 2025-12-03)

- [x] Fjernet besparelseskort fra MobileInfoBox (vises kun i MobileSavingsFooter)
- [x] InfoBox strekker seg helt ned til footer når begge vises
- [x] Større lukke-knapp (32x32px ikon, 48x48px touch-target)

##### ✅ Visuell seksjonering og layout (FULLFØRT 2025-12-03)

Forbedret visuell gruppering av elementer på mobilskjermen:

1. **Bakgrunnsfarge**
   - [x] Hele siden har nå grå bakgrunn (`--pkt-color-brand-neutrals-100`, #f9f9f9)
   - [x] Header beholder hvit bakgrunn for kontrast

2. **Skillelinjer mellom seksjoner**
   - [x] Energiseksjonen har skillelinjer over og under (`--pkt-color-grays-gray-100`, #e6e6e6)
   - [x] Punkt designsystem har ikke dedikert divider-komponent, bruker border med gray-100

3. **Scrollbar kun på tiltaksliste**
   - [x] Header, adresse og energikarakter forblir synlig (sticky)
   - [x] Kun tiltakslisten scroller ved mange tiltak
   - [x] Implementert med flexbox: `height: 100dvh`, `overflow: hidden` på rot, `overflow-y: auto` på tiltaksseksjon

4. **Opprydding**
   - [x] Fjernet redundant "X tiltak valgt" accordion (PktAccordion)
   - [x] Fjernet ubrukte imports (PktAccordion, PktAccordionItem)

---

### Fase 4: Tiltaksdetalj (Skjerm 3)

**Mål:** Responsiv tiltaksdetalj-side

**Oppgaver:**
| # | Oppgave | Status |
|---|---------|--------|
| 4.1 | Opprette `MobileTiltakDetail.tsx` | [x] |
| 4.2 | Responsive tabs | [x] |
| 4.3 | Touch-friendly interaksjoner | [x] |
| 4.4 | Integrere med App.tsx | [x] |

**Desktop (≥768px):**
- Behold eksisterende modal/overlay-layout

**Mobil (<768px):**
- Full-skjerm visning (ikke modal)
- Vertikal stacking av innhold
- Tabs som horisontal scroll
- Touch-friendly lenker og knapper (min 44×44px)

**Detaljer:**
1. **Opprette `MobileTiltakDetail.tsx`**
   - Full-skjerm layout
   - Sticky header med tilbake-knapp
   - Scrollbart innhold

2. **Responsive tabs**
   - Horisontal scroll på smale skjermer
   - Aktiv tab med mørkeblå bakgrunn
   - Touch-vennlige knapper

3. **Touch-friendly interaksjoner**
   - Alle lenker og knapper min 44×44px
   - Tydelig hover/active feedback

**Filer som endres:**
- `src/components/mobile/MobileTiltakDetail.tsx` (ny)
- `src/components/mobile/MobileTiltakDetail.css` (ny)
- `src/App.tsx` (integrering)

#### Logg Fase 4
| Dato | Handling | Detaljer |
|------|----------|----------|
| 2025-12-05 | Opprettet `MobileTiltakDetail.tsx` | Full-skjerm tiltaksvisning med Punkt-komponenter |
| 2025-12-05 | Opprettet `MobileTiltakDetail.css` | Stiler med Punkt CSS-variabler, responsive tabs, touch-targets |
| 2025-12-05 | Integrert med App.tsx | Navigering fra tiltaksliste til detaljvisning |
| 2025-12-05 | Implementert seksjoner | Hero, intro, fordeler, tabs, les mer, accordion, støtteordninger, CTA |
| 2025-12-05 | Horisontalt scrollbare tabs | Tab-knapper med `-webkit-overflow-scrolling: touch` |
| 2025-12-05 | Touch-friendly design | Min 44×44px på alle interaktive elementer |
| 2025-12-05 | Søknadsplikt-seksjon | Spesialseksjon med gul bakgrunn og venstre-kant |
| 2025-12-05 | Støtteordninger | Dynamisk visning av grants med provider-badges og lenker |
| 2025-12-05 | Refaktorering: Fordels-chips | Flyttet fordeler til grønne chips under tittel (som desktop) |
| 2025-12-05 | Refaktorering: Fjernet fordel-liste | Fjernet den gamle Fordeler-seksjonen lenger ned |
| 2025-12-05 | Bygningsspesifikke paragrafer | La til `buildingTypeParagraphs` etter intro-tekst (f.eks. blokk-spesifikk info) |
| 2025-12-05 | Fjernet beløpslinje | Fjernet beløpsvisning fra støtteordninger |
| 2025-12-05 | Søknadsplikt flyttet nederst | Som PktAccordion med "Sjekk om du må søke..." og "Søknadsplikt er ikke en stopper" |
| 2025-12-05 | Årlig besparelse | Ny seksjon med kWh/kr og ?-knapp for kilde-tooltip |
| 2025-12-05 | Fordeler fra dictionary | Fordeler hentes fra `content/dictionaries/index.json` med ikoner via `pkt-icon` web component |
| 2025-12-05 | Identisk fordels-stil | CSS identisk med desktop (`tiltak-card__benefit-chip`): pill-form, 30px høyde, pkt-icon 16x16px |

#### Implementerte funksjoner

##### ✅ MobileTiltakDetail-komponent

Full-skjerm tiltaksdetalj med følgende seksjoner:

1. **Header**
   - [x] Oslo-logo og "Energinøkkelen"-tittel
   - [x] Sticky posisjonering (z-index: 100)
   - [x] Tilbake-knapp med PktButton

2. **Hero-seksjon**
   - [x] Eyebrow-tekst ("Tiltak")
   - [x] Tiltakstittel (h1)
   - [x] Fordels-chips (grønne bokser med fordeltitler, som på desktop)

3. **Intro-tekst**
   - [x] Paragrafrendering fra JSON-innhold
   - [x] Bygningsspesifikke paragrafer (f.eks. blokk-spesifikk info)
   - [x] Punkt-typografi og spacing

4. **Tab-seksjoner**
   - [x] Horisontalt scrollbare tabs
   - [x] Aktiv tab med mørkeblå bakgrunn
   - [x] Tab-panel med fade-in animasjon
   - [x] Bygningstypetilpasset innhold
   - [x] Les mer-lenker per tab

6. **Les mer**
   - [x] Generelle lenker med external-link ikon
   - [x] Touch-vennlig størrelse (44px høyde)

7. **Spørsmål og svar**
   - [x] PktAccordion med PktAccordionItem
   - [x] Tekst-stacker for paragrafrendering
   - [x] Lenker per accordion-item

8. **Årlig besparelse**
   - [x] Mørk grønn boks med kWh og kr per år
   - [x] ?-knapp for å vise kilde-tooltip
   - [x] Cyan tooltip-boks med lukkekryss
   - [x] Valgfritt: Vises kun når `annualSavingsKwh` er tilgjengelig

9. **Støtteordninger**
   - [x] Dynamisk henting via `useGrantAwareStotteordninger`
   - [x] Provider-badges med fargekoding
   - [x] Lenker til støtteordninger
   - [x] Beløpslinje fjernet (som ønsket)

10. **Søknadsplikt (ekspandérbar)**
    - [x] PktAccordion med tittel "Sjekk om du må søke..."
    - [x] Paragrafrendering og lenker fra permitItem
    - [x] Mørkeblå highlight-boks: "Søknadsplikt er ikke en stopper, men en støtte"

11. **CTA-knapper**
    - [x] Sticky footer (når CTA finnes)
    - [x] Full-bredde knapper
    - [x] Primary/secondary skin

##### ✅ CSS-stiler

- [x] Punkt CSS-variabler for farger, spacing og typografi
- [x] Oslo Sans font-family
- [x] Safe-area-inset for notch/home-indikator
- [x] Responsive design for smale skjermer (<340px)
- [x] Tab-scrolling uten synlig scrollbar
- [x] Fade-in animasjon for tab-panel

---

### Fase 5: Animasjoner og overganger

**Mål:** Tilpassede overganger for mobil

**Oppgaver:**
| # | Oppgave | Status |
|---|---------|--------|
| 5.1 | Forenklet mobilanimasjon | [ ] |
| 5.2 | Respektere `prefers-reduced-motion` | [ ] |

**Desktop:**
- Behold eksisterende hus-animasjon

**Mobil:**
- Enklere slide/fade overganger
- Reduser bevegelse for ytelse
- Respekter `prefers-reduced-motion`

**Detaljer:**
1. **Forenklet mobilanimasjon**
   - Dropp kompleks husanimasjon
   - Bruk CSS transitions

2. **Respektere brukerpreferanser**
   - Sjekk `prefers-reduced-motion`
   - Reduser animasjoner tilsvarende

**Filer som endres:**
- `src/components/FigmaMainScript.tsx`
- `src/components/TransitionOverlay.tsx`

#### Logg Fase 5
| Dato | Handling | Detaljer |
|------|----------|----------|
| *Ingen loggføringer ennå* | | |

---

### Fase 6: Testing og polish

**Mål:** Sikre kvalitet på alle enheter

**Oppgaver:**
| # | Oppgave | Status |
|---|---------|--------|
| 6.1 | Manuell testing på mobil | [ ] |
| 6.2 | Automatisert testing med Playwright | [ ] |
| 6.3 | Ytelsesoptimalisering | [ ] |

**Detaljer:**
1. **Manuell testing**
   - Test på iPhone SE (minste støttede)
   - Test på iPhone 14 Pro Max (største mobil)
   - Test på iPad Mini og Pro

2. **Automatisert testing med Playwright**
   - Viewport-testing på ulike størrelser
   - Screenshot-sammenligning
   - Accessibility-testing

3. **Ytelsesoptimalisering**
   - Lazy-load komponenter
   - Optimalisere bilder
   - Redusere bundle-størrelse for mobil

#### Logg Fase 6
| Dato | Handling | Detaljer |
|------|----------|----------|
| *Ingen loggføringer ennå* | | |

---

## Prioritert oppgaveliste

| Prioritet | Oppgave | Kompleksitet | Estimat |
|-----------|---------|--------------|---------|
| P1 | `useResponsive` hook | Lav | 1-2t |
| P1 | Tailwind breakpoints | Lav | 0.5t |
| P2 | `MobileLanding.tsx` | Medium | 3-4t |
| P2 | Responsivt søkefelt | Lav | 1t |
| P3 | `MobileEnergySolutions.tsx` | Høy | 4-6t |
| P3 | `MobileInfoBox.tsx` | Medium | 2-3t |
| P3 | `MobileEnergyScale.tsx` | Medium | 2t |
| P4 | `MobileTiltakDetail.tsx` | Høy | 4-5t |
| P4 | Responsive tabs | Medium | 2t |
| P5 | Forenklet animasjoner | Lav | 1-2t |
| P5 | Testing og polish | Medium | 3-4t |

**Total estimert tid:** 24-32 timer

---

## Beslutninger som må tas

### Avklarte spørsmål
- [x] MCP-konfigurasjon: Skal ligge i `.mcp.json` i prosjektrot (ikke `~/.claude/mcp.json`)
- [x] Storybook må kjøre før Claude Code for MCP-tilkobling

### Åpne spørsmål
- [ ] Skal husanimasjonen droppes helt på mobil, eller vises som statisk bilde?
- [ ] Skal kartet i infoboksen være interaktivt på mobil, eller statisk bilde?
- [ ] Skal tiltaksdetalj åpnes som ny side eller som full-skjerm modal?
- [ ] Hvilken minimums iOS/Android-versjon skal støttes?

---

## Stories opprettet

| Story | Beskrivelse |
|-------|-------------|
| `EnergySolutionButtons/Default` | Standard enebolig (1985) |
| `EnergySolutionButtons/Collapsed` | Minimert visning |
| `EnergySolutionButtons/WithoutHeader` | Uten header |
| `EnergySolutionButtons/Blokk` | Boligblokk-variant |
| `EnergySolutionButtons/GammeltHus` | Gammelt hus (1920), energikarakter G |
| `EnergySolutionButtons/NyttHus` | Nytt hus (2020), energikarakter B |

### Nye stories som trengs
- [ ] `MobileLanding/Default`
- [ ] `MobileEnergySolutions/Default`
- [ ] `MobileInfoBox/Default`
- [ ] `MobileInfoBox/Expanded`
- [ ] `MobileTiltakDetail/Default`

---

## Referanser

- [Storybook dokumentasjon](https://storybook.js.org/docs)
- [Punkt designsystem](https://punkt.oslo.kommune.no/)
- [Storybook MCP addon](https://storybook.js.org/addons/@storybook/addon-mcp)
- [Playwright MCP](https://github.com/microsoft/playwright-mcp)
- [WCAG Touch Target Size](https://www.w3.org/WAI/WCAG21/Understanding/target-size.html)
