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

### Breakpoints

| Breakpoint | Bredde | Enhet |
|------------|--------|-------|
| `sm` | < 640px | Små mobiler (iPhone SE) |
| `md` | 640-767px | Store mobiler |
| `lg` | 768-1023px | Tablets |
| `xl` | ≥ 1024px | Desktop |

---

## Neste skritt

> **Oppdater denne seksjonen** hver gang du starter på en ny oppgave eller fullfører en oppgave.

### Aktiv oppgave
*Ingen aktiv oppgave - klart for å starte Fase 1*

### Kommende oppgaver
1. [ ] Opprette `useResponsive` hook (`src/hooks/useResponsive.ts`)
2. [ ] Oppdatere `useFigmaViewportMetrics.ts` med `isMobileView`
3. [ ] Definere Tailwind breakpoints i `tailwind.config.js`

---

## Faseoversikt og logg

> **VIKTIG:** Oppdater loggen hver gang en oppgave fullføres. Kryss av fasen når ALLE oppgaver i fasen er fullført.

| Fase | Beskrivelse | Status | Fullført |
|------|-------------|--------|----------|
| **Fase 1** | Infrastruktur og deteksjon | Ikke startet | [ ] |
| **Fase 2** | Landing-side (Skjerm 1) | Ikke startet | [ ] |
| **Fase 3** | Tiltaksvalg (Skjerm 2) | Ikke startet | [ ] |
| **Fase 4** | Tiltaksdetalj (Skjerm 3) | Ikke startet | [ ] |
| **Fase 5** | Animasjoner og overganger | Ikke startet | [ ] |
| **Fase 6** | Testing og polish | Ikke startet | [ ] |

---

### Fase 1: Infrastruktur og deteksjon

**Mål:** Legge grunnlaget for responsiv design

**Oppgaver:**
| # | Oppgave | Status |
|---|---------|--------|
| 1.1 | Opprette `useResponsive` hook | [ ] |
| 1.2 | Oppdatere `useFigmaViewportMetrics.ts` med `isMobileView` | [ ] |
| 1.3 | Definere Tailwind breakpoints | [ ] |

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
| *Ingen loggføringer ennå* | | |

---

### Fase 2: Landing-side (Skjerm 1)

**Mål:** Responsiv landing-side

**Oppgaver:**
| # | Oppgave | Status |
|---|---------|--------|
| 2.1 | Opprette `MobileLanding.tsx` | [ ] |
| 2.2 | Betinget rendering i `App.tsx` | [ ] |
| 2.3 | Responsivt søkefelt | [ ] |

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
| *Ingen loggføringer ennå* | | |

---

### Fase 3: Tiltaksvalg (Skjerm 2)

**Mål:** Responsiv tiltaksvalg-side

**Oppgaver:**
| # | Oppgave | Status |
|---|---------|--------|
| 3.1 | Opprette `MobileEnergySolutions.tsx` | [ ] |
| 3.2 | Opprette `MobileInfoBox.tsx` | [ ] |
| 3.3 | Responsiv energiskala | [ ] |
| 3.4 | Betinget rendering i `FigmaMainScript.tsx` | [ ] |

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
| *Ingen loggføringer ennå* | | |

---

### Fase 4: Tiltaksdetalj (Skjerm 3)

**Mål:** Responsiv tiltaksdetalj-side

**Oppgaver:**
| # | Oppgave | Status |
|---|---------|--------|
| 4.1 | Opprette `MobileTiltakDetail.tsx` | [ ] |
| 4.2 | Responsive tabs | [ ] |
| 4.3 | Touch-friendly interaksjoner | [ ] |

**Desktop (≥768px):**
- Behold eksisterende modal/overlay-layout

**Mobil (<768px):**
- Full-skjerm visning (ikke modal)
- Vertikal stacking av innhold
- Tabs som horisontal scroll eller accordion
- Touch-friendly lenker og knapper

**Detaljer:**
1. **Opprette `MobileTiltakDetail.tsx`**
   - Full-skjerm layout
   - Sticky header med tilbake-knapp
   - Scrollbart innhold

2. **Responsive tabs**
   - Horisontal scroll på smale skjermer
   - Eller konvertere til accordion

3. **Touch-friendly interaksjoner**
   - Alle lenker og knapper min 44×44px
   - Tydelig tap-feedback

**Filer som endres:**
- `src/components/mobile/MobileTiltakDetail.tsx` (ny)
- Eksisterende tiltaksdetalj-komponenter (betinget)

#### Logg Fase 4
| Dato | Handling | Detaljer |
|------|----------|----------|
| *Ingen loggføringer ennå* | | |

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
