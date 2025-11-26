# Tiltakskort – paritet mellom legacy og TiltakCardRenderer

Opprettet: 2025-11-22 (Codex)

Dette dokumentet sporer arbeidet med å sikre 1:1-paritet mellom dagens legacy-tiltakskomponenter
(`src/components/FigmaBlokk/components/Tiltak/*.tsx`) og den refaktorerte rendereren
`src/components/FigmaBlokk/components/Tiltak/TiltakCardRenderer.tsx`. Det fungerer som arbeidslogg,
paritetsmatrise og TODO-liste for teamet.

## 1. Mål

- Kartlegge alle visuelle/strukturelle elementer i legacy-kortene og speile dem i TiltakCardRenderer.
- Dokumentere avvik per tiltak slik at utviklere kan jobbe parallelt uten å overse elementer.
- Synliggjøre hva som må testes manuelt i nettleser vs hva som kan verifiseres ved kodegjennomgang.

## 2. Arbeidsmetodikk

For å komme vekk fra «hagle»-tilnærmingen jobber vi nå fasevis: først etablerer vi identisk ramme, deretter det
overordnede layoutet, og til slutt ferdigstiller vi hvert enkelt element. All fremdrift krysses av i elementtabellen i
§2.2 før vi markerer tiltaket som ferdig i paritetsmatrisen.

### 2.0 Fasebasert paritetsløp

1. **Ramme (R-serien i tabellen):** Kopier kortets overordnede dimensjoner, bakgrunn, overgangsanimasjoner og
   kolonne/gutter-oppsett. Ingen elementparitet blir bekreftet før R1–R4 er ✅.
2. **Layout (fortsatt R-serien):** Når rammen stemmer, plasser hero, tabs, CTA-område, støttekolonne og accordion i samme
   koordinater som legacy. Bruk computed styles fra `solenergi`, `vinduer` og `varmepumpe` for å låse inn marginer.
3. **Elementer (E-serien):** Gå element for element (fordelschips, støttetabell, «Årlig besparelse» osv.) og match typografi,
   farger, ikonografi og interaksjon én komponent av gangen.
4. **Interaksjoner/metainfo (I-serien):** Bekreft keyboard/ARIA, hover/focus-states og inline glossary-tooltips. Først når
   alt i tabellen er ✅ for et tiltak, kan `TiltakCardRenderer` anses parity-klar for det tiltaket.

> **Automatisering:** Når fase 1–2 er på plass for minst tre tiltak settes Playwright-sammenligning opp under
> `tests/parity/` for å ta skjermbilder av legacy vs refaktor. Scriptet dokumenteres i denne seksjonen før bruk.

### 2.1 Operasjonell sjekkliste (for alle agenter)

Følg denne sjekklisten hver gang du tar på deg en ny parity-oppgave. Oppdater §2.2, §3–§8 og loggen når du er ferdig.

1. **Identifiser mønsterfamilie:**
   - Tabs-kort = `vinduer` eller `varmepumpe`.
   - Standardkort uten tabs = `solenergi` (representerer alle med hero+fordeler+lenker).
   - TEK/energi-kort = velg `solenergi` eller `etterisolering-yttervegg` for referansestiler (selv om tall mangler i andre tiltak skal UI være identisk).
   - Accordion/glossary-fokus = `tetting` (dekker tetting/temperaturstyring/ventilasjon).
   - Når du jobber på en familie, logg funn på raden som representerer familien og noter hvilke andre sluger som arver resultatet.
2. **Forbered filene:** Åpne legacy-komponenten(e), `TiltakCardRenderer.tsx` og relevante CSS-filer. Hold §2.2-tabellen oppe
   slik at du vet hvilke elementer som allerede er kartlagt.
3. **Roller i datainnsamlingen:** Codex-agenter henter struktur/logikk fra kildekoden (eks. hvordan `ENERGY_SAVINGS_DATA`
   beregnes), mens redaktør/QA skaffer computed styles og skjermdump av elementene Codex trenger. Når en verdi måles i
   nettleser, logg den i §8 og oppdater «Måling/QA»-feltet i tabellen.
4. **Lag sammenligningsnotat:** Bruk tabellen i §8.x eller opprett en ny §8.y for valgt tiltak. Ta med:
   - Elementnavn
   - Legacy-observasjon (med fil og linjenummer, f.eks. `Solenergi.tsx:397`)
   - Hvordan rendereren gjør det i dag (fil + klasse)
   - Hva som mangler eller må besluttes
   - Hvilke andre tiltak påvirkes
5. **Parameter-capture:** Når marginer/fonter/farger er viktige, noter verdiene i notatet (eks: `margin-top: 24px`, `font-size: 14px`).
   Hvis de bare kan konstateres via nettleser, skriv «VENTER PÅ SKJERMBILDE» og logg behov under §6. Når målingen er levert,
   oppdater §2.2 og kryss av riktig element.
6. **Oppgavekobling:** Når et gap er klart definert, legg til/oppdater en rad i §4 (P-nummer). Bruk kort beskrivelse,
   status (`Åpen`, `Pågår`, `Blokker`) og eier dersom kjent. Hvis du oppretter en issue/PR, lenk til ID i beskrivelsen.
7. **QA-håndtering:**
   - Trenger du visuelle bekreftelser ⇒ fyll ut §6 og ping nestemann.
   - Har du mottatt skjermbilde ⇒ flytt posten fra §6 til §5 og beskriv hva som ble verifisert.
8. **Avslutt passet:** Oppdater loggen (§7) med dato, tiltak, og kort beskrivelse av hva som ble analysert eller
   implementert. Dette er kritisk for å gi neste agent historikk.

### 2.2 Elementbibliotek for paritet

Bruk tabellene under som fasit for hva som må kopieres fra legacy. Sett status til ✅ når vi har dokumentert at
TiltakCardRenderer matcher legacy i både kode og QA-skjermbilder. ⚠️ betyr “delvis” (kode er oppdatert men venter QA eller
omvendt). Alle noterte målemetoder skal logges i §8 ved bruk.

**Ramme og layout (fase 1–2)**

| ID | Element/layout | Legacy-referanse | Hva må kopieres fra legacy | Måling/QA | Status |
| -- | -------------- | ---------------- | -------------------------- | --------- | ------ |
| R1 | Kort-ramme (840×1400, mørk bakgrunn, absolutte koordinater, overgang `transform 0.6s ease-in-out`) | `Solenergi.tsx` (`LEGACY_FRAME_PROPS`), `UtskiftningAvVindu.tsx` | Fast bredde/høyde, bakgrunn `#0C2B29`, hvit border, `overflow:hidden`, samme `transform`-animering ved hover/accordion | Devtools legacy måling 2025-11-23: 840 × 790 innholdsflate, `position:absolute`, `left:218.5px`, `bottom:55px`, `transition: opacity 1s ease-in-out` | ⚠️ |
| R2 | Kolonneoppsett og gutters (hero vs høyrekolonne) | `Solenergi.tsx` hero foreignObject + støttekolonne, `Varmepumpe.tsx` | 60 px venstremarg, hero bredde 465 px, gutter 40 px, høyrekolonne starter på `x=565 px` og innholdsbredde ~211 px (64 px høyremarg). Skal replikeres før tabs/layout QA | Måling 2025-11-23 (legacy solenergi): `foreignObject x=60`, `width=465`; Årlig besparelse `x=565`, `width=211` ⇒ gutter=40 px | ⚠️ |
| R3 | Headerlinje (tilbakeknapp, tittel, audience-chip, CTA-stack) | `legacyComponents.ts` (`Header`), `Solenergi.tsx:300+` | Knappestørrelser, ikonposisjon, spacing til tittel og gulliste-/audience-label | QA-skjermdump + sammenligning i admin | ☒ |
| R4 | Tabs-container & panel viewport | `Varmepumpe.tsx` (`TAB_BUTTON_SLOTS`, foreignObject med scrollbar) | Sticky tablist, underline-anim, faste høyder pr panel, fokus/aria-attributter | DOM- og CSS-inspeksjon i legacy tabs + keyboard-test | ☒ |

**Elementer og innhold (fase 3)**

| ID | Element | Legacy-referanse | Hva må kopieres | Måling/QA | Status |
| -- | ------- | ---------------- | --------------- | --------- | ------ |
| E1 | Hero-tekst og byggtype-stack | `Solenergi.tsx:120-220`, `UtskiftningAvVindu.tsx` | Oslo Sans 14/22, `font-weight:300`, `max-height:338px` med scrollbar, «Tilpasset …»-label | Devtools typografi + scroll-video (solenergi legacy 2025-11-23: width 465px, height 338px, `overflow-y:auto`, `padding-right:10px`, font-weight 300) | ⚠️ |
| E2 | Fordelschips m. ikon | `fordelsbokser.tsx`, `Solenergi.tsx:230-360` | Lime `#C7F6C9`, 30 px høyde, autosizing bredde (ex: «Egenprodusert strøm» 183 px), ikon `fill:#2A2859`, heading “Fordeler” | QA-skjermdump + CSS-verdier i §8 (legacy 2025-11-23: font 16/24 px, `font-weight:300`, tekst `font-size:14px`, `font-weight:500`, `letter-spacing:-0.2px`, `text-wrap:nowrap`) | ⚠️ |
| E3 | «Årlig besparelse»/stats-kort + tooltip | `Solenergi.tsx:397-620`, `Tetting.tsx:460-520` | 211 × 124 px boks `#034B45` (legacy måling 2025-11-23), hvit tekst, tooltip-knapp og overlay, fallback-tekst | Måling i devtools + plan for dataflyt (`ENERGY_SAVINGS_DATA`) | ☒ |
| E4 | «Les mer»-sirkel | `Solenergi.tsx:620-720` | Sirkel `r=110px` (`fill #2A2859`, `cx=170`, `cy=490`), heading 18/27 px `font-weight:700`, hvite lenker 14/21 px `font-weight:300` med underline, maks 3 lenker, responsivt fallback <640 px | QA-skjermdump + mobil-view (måling 2025-11-23) | ⚠️ |
| E5 | CTA-område (knaplister, back button) | `legacyComponents.ts`, `Solenergi.tsx` CTA-blokk | Button skins (`primary/secondary/link`), ikonplassering, spacing vs hero, inline link-states | Devtools screenshot + keyboard test | ☒ |
| E6 | Tabs-nav med underline & slot-bredder | `Varmepumpe.tsx`, `UtskiftningAvVindu.tsx` | Underline anim, `TAB_BUTTON_SLOTS`-breddene, `aria-controls`, scroll i tabpanel | DOM/ARIA inspection + Playwright test | ☒ |
| E7 | TEK-/energikort (beregningsruten) | `EtterisoleringYttervegg.tsx:360-520` | Struktur, iconography, tooltip for kilde, fallback-tekst, tallformat | Devtools + hooking `ENERGY_SAVINGS_DATA` | ☒ |
| E8 | Glossary inline highlight | `glossaryHelpers.tsx`, `Solenergi.tsx:694-774` | Dotted underline, tooltip bakgrunn `#D1F9FF`, close-knapp, plassering relativ til ord | DOM-snapshot + keyboard nav | ☒ |
| E9 | Accordion generelt | `Tetting.tsx` (accordion implementation) | Bakgrunn, border, ikonrotasjon, typografi for header/body | QA-sammenligning av et accordion med og uten glossary | ☒ |
| E10 | Søknadsplikt-callout | `Solenergi.tsx:750-820`, `Tetting.tsx:820+` | Trigger-knapp 720 × 40 px, border 2 px `rgba(42,40,89,0.5)`, font 14/22 px `font-weight:500`, `justify-content:space-between`, padding 16 px. Expand-panel 720 px bredt med hvit bakgrunn, `border:2px rgba(42,40,89,0.5)` og max-height transition 0.6s, inneholder tekst 14/22 px og blå seksjon (bakgrunn `#2A2859`, padding 16 px) med heading 16/24 px `font-weight:700`. | Computed styles + focus/ARIA test (legacy måling 2025-11-23) | ☒ |
| E11 | Støtteordningstabell | `Solenergi.tsx:420-565`, `legacyComponents.ts` | 3 kolonner («Relevante støtteordninger», «Søk til», «Les mer») med header-font 16/24 px `font-weight:500` og `letter-spacing:-0.2px`, rader 474 px brede × 36 px høye (`fill #F9F9F9` / `#FFFFFF`), badges 82 × 23 px (`#D1F9FF`), scroll-container 482 × 144 px med thin scrollbar | QA-skjermdump, scroll-video, devtools måling 2025-11-23 | ⚠️ |
| E12 | Grant metadata (overskriftfarger, beløp) | `shared.ts`, `getOverskriftColor`, `legacyComponents.ts` | Samme fargekart, beløpsformat, CTA-knapper per rad | DOM-inspeksjon + JSON vs UI-kontroll | ⚠️ |
| E13 | Building-type avsnitt + `buildingTypeParagraphs` fallback | `shared.ts`, `getBuildingParagraphs` output i legacy | Marginer, heading-typografi, fallback «Alle byggtyper»-tekst | QA-screenshot pr audience/building type | ☒ |
| E14 | Custom sections / rich content blocks | `Varmepumpe.tsx` (faneblader), `legacyComponents.ts` | Layout for tabpanel cards, iconography, listestiler | DOM-inspeksjon | ☒ |

**Interaksjon og metadata**

| ID | Element/interaksjon | Legacy-referanse | Hva må kopieres | Måling/QA | Status |
| -- | ------------------- | ---------------- | --------------- | --------- | ------ |
| I1 | Audience/gulliste-label & variantfarger | `GulListeTiltak/*`, `legacyComponents.ts` | Labeltekst, bakgrunnsfarger, plassering vs hero | QA-skjermdump for både `standard` og `gulliste` | ☒ |
| I2 | Hover/focus-states på knapper, tabs, lenker | Alle tiltakskomponenter | Fargeendring, outline-handtering, ikonbevegelse | Keyboard-navigasjon + Storybook-sjekk | ☒ |
| I3 | Scroll/overflow-håndtering (hero, tabs, støtte) | `Solenergi.tsx` foreignObjects | Samme scrollbars, momentum, gradient overlay ved overflow | Video av scroll i legacy vs admin | ⚠️ |
| I4 | Tooltip «Kilde» og andre overlay-panel | `Solenergi.tsx:580-620`, `Varmepumpe.tsx` | Enter/exit-animasjon, fokusfelle, ESC-lukking | Playwright test + QA | ☒ |
| I5 | Inline-redigering hooks (admin) vs ren visning (frontend) | `TiltakBenefitInlineEditor.tsx`, `legacyComponents.ts` | Sørge for at redigerbare elementer ikke påvirker visningsparitet (skjul kontroller) | Admin-preview QA + flaggtest i frontend | ⚠️ |

> **Statuslegende:** ☒ Ikke startet, ⚠️ Pågår (kode eller QA gjenstår), ✅ Ferdig/verifisert.

## 3. Paritetsmatrise (per tiltak)

| Tiltak (slug) | Legacy-fil | Viktige elementer | Status | Notater |
| ------------- | ---------- | ----------------- | ------ | ------- |
| varmepumpe | `Tiltak/Varmepumpe.tsx` | Tabs (5), fordelsgrid, beregningskort, støtteordning, søknadsplikt | ☐ Ikke startet | |
| solenergi | `Tiltak/Solenergi.tsx` | Hero, fordeler, lenkeliste, støtteordning, søknadsplikt | ⚠️ Pågår | Hero-tekst/fordeler/støtteordningstabell refaktorert 2025-11-23 – se §8.2 for rester |
| etterisolering-yttervegg | `Tiltak/EtterisoleringYttervegg.tsx` | TEK/energikort, lenker, søknadsplikt, støtteordning | ☐ Ikke startet | |
| etterisolering-kjeller-loft | `Tiltak/IsoleringAvKjellerOgLoft.tsx` | TEK/energikort, lenker, støtteordning | ☐ Ikke startet | |
| vinduer | `Tiltak/UtskiftningAvVindu.tsx` | Tabs (4), fordeler, accordion, lenker, støtteordning | ⚠️ Pågår | Se §8.1 for avviksliste |
| tetting | `Tiltak/Tetting.tsx` | Fordeler, accordion, glossary, støtteordning, lenker | ☐ Ikke startet | |
| temperaturstyring | `Tiltak/Temperaturstyring.tsx` | Fordeler, accordion, glossary, støtteordning | ☐ Ikke startet | |
| ventilasjon | `Tiltak/Ventilasjon.tsx` | Fordeler, accordion, glossary, støtteordning | ☐ Ikke startet | |

_Noter gjerne ekstra rader for nye tiltak eller generiske komponenter (fordelskort, støtteordningskort osv.)._

> **Felleskomponent – «Årlig besparelse»:** Alle legacy-tiltak bruker identisk markup for besparelsesboksen (se f.eks.
> `Solenergi.tsx:397`, `Tetting.tsx:469`, `Varmepumpe.tsx:701`). Bruk én av disse som referanse og anta at samme stil
> skal gjelde for samtlige tiltak når du oppdaterer `TiltakCardRenderer`. Tallgrunnlaget kan være fraværende, men UI skal
> alltid vise den mørkegrønne boksen med tooltip.

## 4. Åpne oppgaver

| ID | Tema | Beskrivelse | Status | Eier |
| -- | ---- | ----------- | ------ | ---- |
| P1 | Tabs-paritet | Sikre at tab-nav markup/aria fra legacy (Varmepumpe/Vinduer) matcher TiltakCardRenderer | Åpen | |
| P2 | Fordelskort-layout | Hero-typografi, fordelschips, Les mer-sirkel og legacy-backknapp oppdatert 2025-11-23; gjenstår CTA-alignment og responsive tester | Pågår | Codex |
| P3 | Støtteordningspanel | Zebra-tabell + fast høyde/scroll implementert 2025-11-23; gjenstår gradient-overlay og lenkestater | Pågår | Codex |
| P4 | Glossary/tooltip | Inline-markup, ikon, aria fra legacy accordion | Åpen | |
| P5 | CTA-område | Knapp/lenke-layout og responsivitet nederst i kortet | Åpen | |
| P6 | Energi/TEK-kort | Tallformat, tooltip og ikonbruk (etterisolering) | Åpen | |
| P7 | Les mer-kort | Sirkel-layout og lenkestil fra standardkort (solenergi) | Åpen | |
| P8 | Søknadsplikt-panel | “Sjekk om du må søke”-accordion + glossary tooltips | Åpen | |

(Oppdater tabellen når avvik identifiseres eller løses. Referer til commits/PRer.)

## 5. QA og skjermbilder

| Dato | Tiltak | Miljø | Hva er verifisert? | Resultat | Notater/lenke |
| ---- | ------ | ----- | ----------------- | -------- | ------------- |
|      |        |       |                   |          |               |

Fylles ut etter hver nettleser-sjekk (legacy vs refaktor).

## 6. Behov for manuelt QA

- Når en utvikler trenger computed styles eller DOM-snapshots, legg inn en forespørsel her med
  spesifikt tiltak, URL og hva som må måles. Sett status til «Venter på skjermbilde» og flytt til QA-tabellen
  når resultat foreligger.

| Tiltak | URL | Elementer som må sjekkes | Status | Notater |
| ------ | --- | ----------------------- | ------ | ------- |
| solenergi | `legacy frontenden` | Computed styles/spacing for innholdet inni «Sjekk om du må søke for å gjennomføre tiltaket»-boksen (ikke bare trigger-knappen) | Venter | Må matches før P8 kan lukkes |

## 7. Logg

- 2025-11-22: Opprettet dokumentet og definerte arbeidsmetodikk/paritetsmatrise (Codex).
- 2025-11-22: Kartla `UtskiftningAvVindu.tsx` vs `TiltakCardRenderer.tsx` og oppdaterte §8.1 + oppgave-oversikt (Codex).
- 2025-11-22: La til operasjonell sjekkliste, mønsterfamilier og «Årlig besparelse»-notat for sømløs overlevering (Codex).
- 2025-11-22: Dokumenterte `Solenergi.tsx` som referanse for standardkort (hero, fordeler, «Les mer»-sirkel, søknadsplikt) og opprettet P7–P8 (Codex).
- 2025-11-23: Refaktor i TiltakCardRenderer for hero-typografi/scroll, fordelschips og støtteordningstabell (P2/P3) + docs oppdatert (Codex).
- 2025-11-23: Implementerte «Les mer»-sirkel og legacy-backknapp i TiltakCardRenderer (P2/P7) + dokumenterte videre CTA-behov (Codex).
- 2025-11-23: Lagt inn legacy-ramme (840×1400 px), fordelschip-dimensjoner og Les mer-typografi i renderer + dokumentasjon (Codex).

## 8. Kartleggingsnotater

### 8.1 Oppgradering av vindu (`vinduer`) – gjennomgang 2025-11-22

| Element | Legacy-observasjon (`UtskiftningAvVindu.tsx`) | TiltakCardRenderer i dag | Gap / oppgave |
| ------- | --------------------------------------------- | ------------------------ | ------------- |
| Hero/layout | Absolutt-posisjonert `svg`-scene (840×1400) med bakgrunner, sirkler, ikonography og tekst som flyttes når accordion åpnes | Fleksibel CSS-grid/stack uten dekorative grafikk | Beslutning: enten droppe dekor eller bygge CSS-baserte ekvivalenter. Dokumentere krav i UI/Design før implementasjon. |
| Tabs | Håndtegnet tabs med `TAB_BUTTON_SLOTS`, fokus-statuser, underline-anim og scrollbar for tab-content (foreignObject) | Punkt-inspirerte knapper (`button` role tab) uten highlightlinje, tabpanel scroll følger naturlig layout | Må måle spacing/typography og implementere underline + sticky tablist for parity. |
| Intro + byggtype | Legacy deler hero-tekst i to kolonner med «Tilpasset …»-etikett; fallback til defaults | Renderer har tilsvarende tekststack, men marginer/fonter avviker | Må hente nøyaktige marginer/linjeavstand fra legacy CSS og kopiere til `.tiltak-card__text-stack`. |
| Fordeler | Fire bokser med faste bredder, inline SVG-ikoner og limegrønn bakgrunn; padder for hånd | Renderer viser chips med pkt-icon til venstre, stacked tekst | Trenger CSS-grid med eksakt bakgrunnsfarge/border + valgfri inline-SVG eller mappe dictionary-ikon → `pkt-icon` som matcher legacy. |
| «Årlig besparelse» | Mørkegrønn blokk m. tooltip (question mark) og tekstlinjer beregnet i komponent via `ENERGY_SAVINGS_DATA`, `buildingData`, `calculateTekPeriod` | Renderer støtter `stats`-felt, men ingen inline beregning/panel i hero | Avgjør om `stats` skal fylles fra API eller om renderer må ta inn buildingData-prop igjen. Krever produktbeslutning + kodeendring. |
| Les mer | Primærlenke vs sekundære (max 3) i hero; ikoner? | Renderer viser ubestemt liste under hero | Legg til støtte for markering av første lenke eller behold uniform. |
| Accordion | Legacy deler første avsnitt ut som intro og resten i liste, togglet via lokal state + custom tooltip for glossary | Renderer bruker `PktAccordion` + `renderParagraphWithGlossary` | Paritet ok semantisk, men styling (bakgrunn/margin + tooltip) må måles av manuelt QA. |
| Støtteordning | Viser maks 4 kort i scroll-container, med fast høyde, CTA-knapp, beløp, gradient overlay, toggles `needsScroll` for `overflow` | Renderer viser responsive grid uten scroll-begrensning og betingede PktButton | Implementer fixed-height container + `overflow-y:auto` + gradient. |
| CTA-område | Legacy har `Tilbake`-knapp + CTA-knapp øverst til høyre? (må bekreftes i DOM) | Renderer har `PktButton`-gruppe i header; layout likely different spacing | Når design måles, oppdater `.tiltak-card__header-actions`. |

**Neste steg for §8.1**

1. Hent nettleser-skjermbilder (legacy vs admin) av `vinduer` for hero, tabs, fordeler, støtteordning, CTA.
2. Bekreft med design/PO om den illustrerte `svg`-bakgrunnen må bevares i refaktor eller om vi kan konvergere til “kort”-layout.
3. Beskriv hvordan `ENERGY_SAVINGS_DATA` skal eksponeres i JSON-innhold (stats-felt vs runtime beregning).
4. Når beslutninger foreligger, bryt opp tasks i §4 (P1–P6) og lenk til issues/PRs.

### 8.2 Solenergi (`solenergi`) – standardkortreferanse 2025-11-22

| Element | Legacy-observasjon (`Solenergi.tsx`) | TiltakCardRenderer i dag | Gap / oppgave |
| ------- | ------------------------------------ | ------------------------ | ------------- |
| Hero-tekstområde | `foreignObject` 465×338 px med scroll, typografi `Oslo Sans 14px / 22px`, `font-weight 300`, `margin-bottom 16px` mellom avsnitt (`Solenergi.tsx:127-190`). Byggtype-tekst bruker samme stil. Hele kortet ligger i en 840×1400 px SVG med mørk grønn bakgrunn og følgende computed styles på root (legacy frame): `width:840px`, `height:1400px`, `font-size:16px`, `font-weight:300`, `line-height:24px`, `overflow:hidden`, `position:absolute`, `transition: transform 0.6s ease-in-out`. Øvrige border-verdier er 0 med farge `rgb(229,231,235)`. | Flex-stack (`.tiltak-card__hero-main`) uten scrolleffekt og uten SVG-rammen rundt. | Kopier line-height, `margin-bottom`-logikk og vurder scrollbar for høye tekster. Verdiene er nå implementert, men hele kortet trenger samme “ramme” (bredden/padding, grønn bakgrunn og absolutte posisjonering) for 1:1. |
| Fordeler-heading | Egen “Fordeler”-overskrift (`text` node ved y=20) som alltid vises, selv om tooltip overlay er aktiv. Fordelsbokser = lime `#C7F6C9`, faste mål 162×30 px (computed: `width:162px`, `height:30px`, `font-size:16px`, `line-height:24px`, `font-weight:300`, `display:inline`, `fill:rgb(199,246,201)`), tekstfarge `#2A2859`. Ikonene er inline-SVG med `fill:#2A2859` og samme typografi. | Renderer viser chips uten heading og bruker `pkt-icon`/borderless design. | P2 må utvides til å inkludere heading + replikere chip-design (bakgrunn, høyde, ikonposisjon). |
| Les mer-seksjon | Sirkel (`r=110`, `fill #2A2859`) sentrert på `(170, 490)` med “Les mer” overskrift (`font-size:18px`, `font-weight:700`, `text-anchor:middle`, `fill:#fff`) og hvite lenker (`font-size:14px`, `font-weight:300`, `text-decoration:underline`, `cursor:pointer`). | Renderer viser “Les mer”-liste som vanlig `<ul>` i hero. | Opprett egen layoutvariant: sirkulært kort eller designbeslutning. Ref nye oppgave P7. |
| Tilbake-knapp | Absolutt posisjonert kvadrat m. hvit pil (`Solenergi.tsx:342`). | Renderer bruker `PktButton variant="label-only"` i header. | Enten redesign for alle kort eller implementer nytt ikonknapp-skin. Documenter under P5. |
| Årlig besparelse-blokk | Mørkegrønn blokk `#034B45` (211×124 px, plassert ved `x=565, y=260`), heading `font-size 16px / line-height 24px`, white bodytekst, tooltip-knapp ved `728×278`, fallback “Boligen din er ikke egnet …” (`Solenergi.tsx:214-270`). | Renderer bruker generiske `stats`-seksjoner, ikke hero-blokk. | Jf. fellesnotat – må definere felles komponent. P6 dekker tall/tooltip; CSS-verdier nå dokumentert. |
| Støtteordningsliste | Heading-tekst `font-size 16px / line-height 24px / font-weight 500 / letter-spacing -0.2px` (“Relevante støtteordninger / Søk til / Les mer”), ordningsnavn `font-size 12px / line-height 18px / font-weight 300 / letter-spacing -0.2px`, rader 474×36 px med zebra-farger (`#F9F9F9` / `#FFFFFF`), containerhøyde 144 px + scrollbar, tag-bokser (`Oslo kommune` 82×23 px `#D1F9FF`, `Enova` 43×23 px `#C7F6C9`), `Lenke`-tekst `font-size 12px / line-height 18px / underline / letter-spacing -0.13px`, (`Solenergi.tsx:420-565`). | Renderer viser fleksibelt kort-grid. | P3 må beskrive denne tabell-layouten, inkl. overskrifter, zebra-farger og `needsScroll` heuristikk. |
| Søknadsplikt-callout | Custom button (`width 720px`, `height 40px`, `display: flex`, `justify-content: space-between`, `font 14px/22px`, `font-weight 500`, `border 2px solid rgba(42,40,89,0.5)`, padding 16px) som åpner panel med tekst og lenker, border-boks og inline glossary tooltips (`hoveredWord` state). | Renderer bruker `PktAccordion` for generiske Q&A. | Trenger generisk “permit” accordion/sheet eller mappe inn i `accordion[]`. Dokumenter krav i P4 (glossary) + P8 (permit-panel). |
| Glossary tooltip | Håndlaget `div` m. `background #D1F9FF`, h4/h5 typografi, posisjonert på inline ord (`Solenergi.tsx:694-774`). | `renderParagraphWithGlossary` renderer `<button>`/`abbr`? – men styling er standard. | P4 må inkludere dotted underline + tooltip-grafikk for inline spans. |
| Grant metadata | Legacy bruker `getOverskriftColor` for label bakgrunn og tre kolonner (“Relevante…”, “Søk til”, “Les mer”). | Renderer viser tag + amount + `PktButton`. | Krever designvalg: enten ta i bruk legacy layout eller tilpasse data for cards. Følg opp i P3. |
| Tooltip “Kilde” | Når besparelses-ikon hovered, overlay card (211×354) med tekst + close-knapp (`Solenergi.tsx:580-620`). | Ikke støttet. | Avgjør om `stats`-kort skal ha tooltip-slot. Hvis ja, ny oppgave i P6. |

**Oppdatering 2025-11-23:**
- Hero-tekststacken i TiltakCardRenderer har nå Oslo Sans 14/22, `font-weight:300`, 465 px maks bredde og scrollbar slik legacy-foreignObjecten hadde. Kortet rendres i en 840 px bred ramme med mørk bakgrunn tilsvarende legacy-SVG-en (inkl. dokumenterte transition-verdier).
- Fordelsseksjonen viser «Fordeler»-heading og limegrønne chips med pkt-icon og samme høyde/spacing som legacy-boksene (162×30 px, `font-size:16px`, `line-height:24px`, `font-weight:300`).
- Støtteordningsdelen er bygd som zebra-tabell med faste høyder, «Relevante / Søk til / Les mer»-overskrifter, tag-badges og scroll for >4 rader. Mangler fortsatt gradient-overlay og tekst-animasjoner fra SVG-versjonen.
- Les mer-seksjonen rendres nå som sirkulært kort (`r≈110px`, heading 18px/700 og lenker 14px/300) med maks tre lenker og tonet bakgrunn; tilbake-knappen i headeren matcher legacy-ikonet. CTA-knappene må fortsatt justeres for spacing/skin.
- Utenfor scope for denne runden: CTA-skin/spacing, årlig besparelse-boks, permit-callout og tooltip-“Kilde”.
- **Måling 2025-11-23 (legacy solenergi):**
  - Hero foreignObject: `x=60`, `width=465`, `height=338`, `overflow-y:auto`, `padding-right:10px`.
  - Høyrekolonne starter på `x=565` ⇒ 40 px gutter fra hero. «Årlig besparelse»-rektangelet: `width=211`, `height=124`, `fill=#034B45`, `y=260`, hvilket gir 64 px høyremarg innenfor den 840 px brede hvite flaten.
  - Fordelschip («Egenprodusert strøm»): `width≈183px`, `height=30px`, bakgrunn `#C7F6C9`, ikon `x=573`, tekst `font-size:14px`, `font-weight:500`, `letter-spacing:-0.2px`, `line-height:21px`, nowrap.
  - Støtteordningstabell: Header `font-size:16px`, `font-weight:500`, `letter-spacing:-0.2px`; rader 474 px brede × 36 px høye (`fill #F9F9F9`/`#FFFFFF`), badge («Oslo kommune») 82 × 23 px (`#D1F9FF`), scroll-container 482 × 144 px med `scrollbar-width:thin`.
  - «Les mer»-sirkel: `r=110px`, `cx=170`, `cy=490`, `fill #2A2859`; heading 18/27 px `font-weight:700`, lenker 14/21 px `font-weight:300`, `text-anchor:middle`, hvit tekst med underline.
  - Søknadsplikt-callout: Trigger-knapp 720 × 40 px (`font-size:14px`, `font-weight:500`, `line-height:22px`, `letter-spacing:-0.2px`, padding 16 px, border 2 px `rgba(42,40,89,0.5)`), expand-panel 720 px bredt (`border:2px rgba(42,40,89,0.5)`, `max-height` overgang 0.6s, hvit bakgrunn) med brødtekst 14/22 px og blå informasjonseksjon (`background #2A2859`, padding 16 px, heading 16/24 px `font-weight:700`).
- **Måling 2025-11-23 (legacy solenergi):** Hero tekstcontainer (`foreignObject`) = bredde 465 px, høyde 338 px, `overflow-y:auto`, `padding-right:10px`, Oslo Sans 14px/22px (`font-weight:300`). Brukes som fasit for R2/E1.

**Neste steg for §8.2**

1. **Devtools-verdier:** Skaff skjermbilder / computed styles for hero-tekst, fordelsbokser, sirkel og støtteordningstabell. Legg tallene i denne seksjonen.
2. **Designbeslutninger:** Avklar om sirkel og tabell skal gjeninnføres som er eller om vi skal redesigne (dokumenter beslutning i §8.2 og i §4-oppgaver).
3. **Oppgaver:**
   - Utvid P2 (fordeler) og P3 (støtteordning) med konkrete krav fra solenergi.
   - Opprett P7 (Les mer-sirkel) og P8 (permit-panel) for nye elementer.
4. Når CSS er implementert i `TiltakCardRenderer.css`, logg QA i §5 (legg inn slug, miljø og resultat).

## 9. Neste oppgaver (handover)

1. **Standardkort – hero/fordeler (P2 & P7):**
   - Verifiser (via skjermdump) at hero-scrollen matcher legacy-høyden i alle tiltak og juster ved behov.
   - Finpuss CTA-/tilbakeknapp-spacing og legg til mobil fallback for «Les mer»-sirkelen (ev. bytte til liste <640px) dersom QA avdekker avvik.
2. **Årlig besparelse (P6):**
   - Flytt dagens stats-data inn i hero-blokken. Bruk 211×124 px-boksen (`#034B45`), tooltip-knapp (`x=728`, `y=278`) og hvit tekst. Avklar hvordan `buildingData` hentes i refaktor (eventuelt eksponér via hooks).
3. **Støtteordninger (P3):**
   - QA zebra-tabellen mot legacy (f.eks. `solenergi`) og legg til gradient-overlay/CTA-state hvis det fortsatt er visuelt avvik.
4. **Søknadsplikt-panel (P4 & P8):**
   - Repliker “Sjekk om du må søke”-knappen (40 px høy, `font-weight 500`, border 2 px rgba(42,40,89,0.5)).
   - Lag expandable panel med glossary-tooltips (dotted underline, tooltip bakgrunn `#D1F9FF`).
5. **Tabs/CTA (P1 & P5):**
   - For vinduer/varmepumpe: implementer underline-anim og slot-bredder (se §8.1) og sørg for at `Tilbake`-knapp matcher legacy-ikonet.
6. **QA-plan:**
   - Når hvert av punktene over er implementert, test i admin med `TiltakCardRenderer` og i legacy-frontenden (flag off) side-om-side. Logg resultat i §5 med dato/miljø.
7. **Dok-oppdatering:**
   - Etter hver ferdigstilt deloppgave: oppdater §4 (status), §8 (beskriv hvilke elementer nå matcher), og §7 (logg)
   - Dokumenter eventuelle redesign-beslutninger eksplisitt slik at senere agenter vet avviket er bevisst.
