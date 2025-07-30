# UI Prosess Dokumentasjon - Figma Design med Bygningstype-basert Navigering

## Oversikt
Dette dokumentet beskriver implementeringen av en dynamisk UI-løsning som navigerer til forskjellige visninger basert på bygningstype etter adressesøk i Figma Design-modus.

## Implementerte funksjoner

### 1. Bygningstype-deteksjon og routing
**Fil:** `src/App.tsx`

#### Implementert logikk:
```typescript
// Etter vellykket adressesøk i Figma-modus
const buildingTypeCode = result.bygningstypeKode;
const buildingTypeId = result.bygningstypeKodeId;

if (buildingTypeCode) {
  const code = parseInt(buildingTypeCode);
  // Enebolig (11x codes)
  if (code >= 110 && code < 120) {
    setMode('figma-enebolig');
  }
  // Blokk (14x codes)
  else if (code >= 140 && code < 150) {
    setMode('figma-blokk');
  }
  // Tomannsbolig og rekkehus - vises som enebolig
  else if (code >= 120 && code < 140) {
    setMode('figma-enebolig');
  } else {
    // Standard til blokk for andre boligtyper
    setMode('figma-blokk');
  }
}
```

#### Bygningstype-mapping:
- **Enebolig (110-119)**: Frittliggende enkeltboliger → `figma-enebolig`
- **Tomannsbolig (120-129)**: To-familieboliger → `figma-enebolig`
- **Rekkehus (130-139)**: Rekkehus/kjedehus → `figma-enebolig`
- **Blokk (140-149)**: Leilighetsbygg → `figma-blokk`

### 2. UI-komponenter

#### FigmaEnebolig (`src/components/FigmaEnebolig.tsx`)
- Viser enebolig-spesifikk UI
- Fader ut alle andre bygninger i skyline
- Beholder kun eneboligen synlig
- **Status:** Grunnstruktur implementert, venter på spesifikk SVG for enebolig

#### FigmaBlokk (`src/components/FigmaBlokk.tsx`)
- Viser blokk-spesifikk UI
- Implementert fade-effekt for skyline
- Kun blokken forblir synlig
- **Oppdatert:** Avansert animasjon med transformasjon og posisjonering

### 3. Fade-effekt implementering

#### Teknisk løsning:
```jsx
{/* Fade ut alle andre bygninger */}
<g style={{ opacity: 0, transition: 'opacity 1s ease-in-out' }}>
  {/* Alle andre bygninger i skyline */}
</g>

{/* Behold blokken synlig */}
<g style={{ opacity: 1, transition: 'opacity 1s ease-in-out' }}>
  {/* Blokk-bygningen */}
</g>
```

#### Effekt-parametere:
- **Fade-tid:** 1 sekund
- **Fade-type:** ease-in-out (myk start og slutt)
- **Sluttopasitet:** 0 (helt usynlig)
- **Blokk-opasitet:** 1 (fullt synlig)

### 4. Skalering og posisjonering

#### Avansert blokk-animasjon (Oppdatert):
```javascript
useEffect(() => {
  // Start fade animation after component mounts
  const fadeTimer = setTimeout(() => {
    setFadeOpacity(0);
  }, 500);

  // Start block transformation after fade begins
  const transformTimer = setTimeout(() => {
    // Blokken er ca 136 SVG units bred og 204 units høy
    // For å få 410px bredde: 410 / 136 ≈ 3.01
    // For å få 616px høyde: 616 / 204 ≈ 3.02
    // Bruker scale(3) for å oppnå ca 410x616px
    setBlockTransform('translate(200, -50) scale(3)');
  }, 1000);

  // Show header after animation completes
  const headerTimer = setTimeout(() => {
    setShowHeader(true);
  }, 3000);

  return () => {
    clearTimeout(fadeTimer);
    clearTimeout(transformTimer);
    clearTimeout(headerTimer);
  };
}, []);
```

#### Animasjonssekvens:
1. **Initial tilstand** (0-500ms): Alt synlig, bygninger i original posisjon
2. **Fade-start** (500ms): Alle bygninger unntatt blokken begynner å fade ut
3. **Transform-start** (1000ms): Blokken begynner transformasjon
4. **Header-visning** (3000ms): Klimaoslo header fader inn
5. **Sluttilstand** (4000ms): Blokken er forstørret, repositert og header synlig

#### Tekniske detaljer for blokk-transformasjon:
- **Original størrelse**: 136×204 SVG units
- **Målstørrelse**: 410×616 piksler
- **Skalafaktor**: 3x
- **Posisjon**: `translate(200, -50)` - flytter til høyre og ned (justert for header)
- **Transform origin**: `1100px 352px` - bunnen av bygningen
- **Animasjonstid**: 2 sekunder med ease-in-out

#### SVG-optimalisering:
```jsx
// Synkronisert viewBox mellom App.tsx og FigmaBlokk.tsx
viewBox="0 -10 1728 362"  // Utvidet for å unngå klipping av topper
style={{ overflow: 'visible' }}  // Sikrer at ingenting kuttes av
```

## Navigasjonsflyt

1. **Bruker søker adresse** i Figma Design-modus
2. **System henter bygningsdata** via API
3. **Bygningstype identifiseres** (kode eller intern ID)
4. **Automatisk navigering** til riktig UI:
   - Enebolig/rekkehus → `FigmaEnebolig`
   - Blokk/leiligheter → `FigmaBlokk`
5. **Fade-animasjon starter** når ny visning lastes
6. **Kun relevant bygning** forblir synlig etter 1 sekund

## Tekniske detaljer

### Mode-håndtering:
```typescript
// Oppdaterte modes i App.tsx
type Mode = "debug" | "wizard" | "lookup" | "figma" | "figma-enebolig" | "figma-blokk"
```

### Tilbake-navigering:
```javascript
onBack={() => {
  setMode("figma");
  setFigmaResult(null);
  setFigmaSearchValue("");
  setFigmaError(null);
}}
```

## Kjente begrensninger

1. **Enebolig SVG**: Trenger spesifikke SVG-paths for enebolig fra skyline
2. **Edge cases**: Noen bygningstyper kan mangle kode/ID
3. ~~**Animasjons-timing**: Optimalisert til 1 sekund for bedre brukeropplevelse~~ ✓ Løst med sekvensielle animasjoner

## Fremtidige forbedringer

1. **Flere bygningstyper**: Legge til spesifikke visninger for tomannsbolig, rekkehus
2. **Animasjons-varianter**: Forskjellige fade-effekter basert på bygningstype
3. **Informasjonsvisning**: Legge til bygningsinformasjon etter fade-effekt
4. **Interaktivitet**: Klikk på bygning for mer informasjon

## Testing

### Test-adresser:
- **Enebolig**: "Lille Frøens vei 1A, Oslo" (kode 111)
- **Blokk**: "Thereses gate 44B, Oslo" (kode 142)
- **Rekkehus**: "Kjelsåsveien 97B, Oslo" (kode 131)

### Verifiseringspunkter:
- [ ] Korrekt bygningstype-deteksjon
- [ ] Riktig UI-navigering
- [ ] Fade-effekt fungerer som forventet
- [ ] Bygning forblir på original posisjon
- [ ] Responsiv skalering fungerer

## Filer endret/opprettet

1. **Nye komponenter:**
   - `src/components/FigmaEnebolig.tsx`
   - `src/components/FigmaBlokk.tsx`

2. **Oppdaterte filer:**
   - `src/App.tsx` - Lagt til bygningstype-routing, nye modes, og synkronisert SVG viewBox
   - `src/components/FigmaBlokk.tsx` - Implementert avansert fade-effekt med transformasjon

3. **Test-filer:**
   - `scripts/test-building-type-routing.ts` - Verifisering av routing-logikk (slettet etter testing)

## Siste oppdateringer (2025-01-25)

### Implementert energiløsninger-liste:
1. **Varmepumpe-komponenter**:
   - La til 8 identiske "Varmepumpe" knapper med "Godtgegnet" status
   - SVG-baserte komponenter (471×50px hver)
   - Grønn bakgrunn (#C7F6C9) for godkjent-status
   - 20px mellomrom mellom hver knapp

2. **Posisjonering og layout**:
   - Sentrert horisontalt på skjermen (left: 50%, translateX(-50%))
   - Justert til 55px fra bunnen av skjermen
   - Vertikal stabling med flexbox (column direction)
   - Fade-inn animasjon synkronisert med header (0.5s forsinkelse)
   - Scrollbar hvis innholdet overstiger viewport

3. **Animasjonsoppdateringer**:
   - Blokk-transform justert til translate(215, -50) scale(3)
   - Fjernet hvit vertikal linje som tidligere fulgte bygningen
   - Beholdt sekvensielle animasjoner for smooth overgang

## Siste oppdateringer (2025-01-24)

### Implementert avansert blokk-animasjon:
1. **Fade-effekt forbedring**: 
   - Separert fade for skyline-elementer
   - Blokken forblir synlig gjennom hele animasjonen
   - Bruker SVG `<g>` grupper for selektiv fading

2. **Transform-animasjon**:
   - Blokken vokser til 410×616px (scale 3x)
   - Flytter seg til høyre side av skjermen
   - Justert vertikal posisjon med translate(200, -50)
   - 2 sekunders smooth animasjon

3. **SVG-synkronisering**:
   - Fikset viewBox-forskjeller mellom App.tsx og FigmaBlokk.tsx
   - La til overflow: visible for å unngå klipping
   - Justert viewBox til "0 -10 1728 362" for bedre toppvisning
   - Utvidet SVG bredde til 1728px for å romme header-knapp

### Implementert Klimaoslo header (2025-01-24):
1. **Header-komponent**:
   - Fader inn etter blokk-animasjon (3 sekunder)
   - Inneholder full Klimaoslo SVG med logo og "Energiportalen" tekst
   - Posisjonert med CSS Grid layout

2. **Tilbake-knapp**:
   - Flyttet fra separat knapp til integrert i header
   - Hele boksen med "Klimaoslo" tekst er klikkbar
   - Transparent fill for bedre klikkområde
   - Høyre-justert med blokken (x=1409, bredde=151)

3. **Knapp-alignment beregning**:
   - Blokk høyre vegg original: x=1186.71
   - Transform origin: 1100px
   - Avstand fra origin: 86.71
   - Etter scale(3): 86.71 × 3 = 260.13
   - Ny posisjon: 1100 + 260.13 + 200 (translate) = 1560.13
   - Knapp posisjon: 1560 - 151 = 1409

## Siste oppdateringer (2025-01-25 - Senere)

### Implementert UI-forbedringer for FigmaBlokk:

1. **Redusert spacing i varmepumpe-listen**:
   - Halverte avstanden mellom varmepumpe-knappene fra 20px til 10px
   - Gir en tettere og mer kompakt visning av tilgjengelige tiltak

2. **Lagt til "Tiltak for din bolig" overskrift**:
   - SVG-basert tekst plassert over varmepumpe-listen
   - 10px avstand fra listen for god visuell separasjon
   - Fade-inn animasjon synkronisert med andre UI-elementer

3. **Implementert hvit info-boks**:
   - Ny informasjonsboks lagt til i venstre del av skjermen
   - Posisjonert med samme avstand fra bunnen som tiltakslisten (55px)
   - Opprinnelig plassert med samme venstre padding som header (64px)
   - Deretter flyttet til 256px fra venstre (4x original avstand) for bedre layout
   - Fade-inn animasjon med samme timing som andre elementer (0.5s forsinkelse)

4. **Tekniske detaljer**:
   - Alle nye elementer bruker fixed positioning for presis plassering
   - Opacity-baserte animasjoner for smooth fade-inn effekt
   - Z-index håndtering for korrekt lag-struktur
   - Responsiv design beholdt med translateX(-50%) for sentrerte elementer

## Siste oppdateringer (2025-01-25 - Ettermiddag)

### Forbedringer av hvit info-boks i FigmaBlokk:

1. **Adresse-formattering**:
   - Fjernet kommunenummer og navn fra adressevisning (bruker kun første del før komma)
   - Oppdatert typografi til Oslo Sans, 36px med spesifisert styling
   - Sentrert adressetekst horisontalt i info-boksen (x=168px)
   - Dynamisk font-størrelse som skalerer ned hvis adressen er for lang

2. **Grønn boks-forbedringer**:
   - Oppdatert bydelsnavn-tekst til Oslo Sans, 14px med samme styling som andre elementer
   - Dynamisk bredde som tilpasser seg lengden på bydelsnavnet
   - Minimum bredde på 127px beholdt

3. **Blå boks-forbedringer**:
   - Lagt til 8px padding mellom grønn og blå boks
   - Erstattet statisk "Blokk" tekst med dynamisk bygningstype fra API
   - Posisjonert bygningsikon og vinduer dynamisk basert på boksens plassering
   - Justert tekst-spacing til å matche grønn boks (36px fra venstre kant)
   - **Oppdatert**: Dynamisk bredde basert på bygningstype-tekstens lengde (samme logikk som grønn boks)

4. **Layout-justeringer**:
   - Alle elementer følger nå 30px padding-regel i hvit info-boks
   - Konsistent spacing mellom ikoner og tekst i både grønn og blå boks
   - Bygningstype vises nå med faktisk data fra API (f.eks. "Boligblokk", "Enebolig")

## Siste oppdateringer (2025-01-25 - Formiddag)

### Fikset dynamisk kart-funksjonalitet:

1. **Identifisert og løst koordinat-henting fra Geonorge API**:
   - Problemet var at koden forventet koordinater som `coordinates` array
   - Geonorge API returnerer faktisk separate `lat` og `lon` felter
   - Oppdatert koden til: `const { lat, lon } = data.adresser[0].representasjonspunkt;`
   - La til omfattende debugging for å spore API-kall og responser

2. **Byttet kart-tile tjeneste**:
   - Opprinnelig URL-format for Kartverket fungerte ikke
   - Byttet fra: `https://cache.kartverket.no/tiles/v1/norges_grunnkart/${zoom}/${x}/${y}.png`
   - Til: `https://tile.openstreetmap.org/${zoom}/${x}/${y}.png`
   - Oppdatert copyright-attribusjon fra "© Kartverket" til "© OpenStreetMap"

3. **Oppgradert kart-markør**:
   - Erstattet enkel rød teardrop-markør med custom SVG
   - Først implementert outline-versjon (ikke tydelig nok)
   - Deretter oppgradert til fylt versjon for bedre synlighet
   - Markør-detaljer:
     - Størrelse: 32x32 piksler
     - Farge: Mørk blå/lilla (#2A2859)
     - Hvit sirkel i midten for lokasjonspunkt
     - Posisjonert sentralt på kartet med `transform: 'translate(-50%, -100%)'`

4. **Tekniske forbedringer**:
   - Lagt til error handling for kartbildelasting
   - Implementert console logging for debugging av koordinater og tile-URLs
   - Beholdt "Laster kart..." indikator mens koordinater hentes

## Siste oppdateringer (2025-01-25 - Kveld)

### Nøkkelinformasjon-seksjon:

1. **Erstattet SVG-path med tekstelementer**:
   - Fjernet SVG-path som rendret "Byggeår", "Areal", "Eiertype" og "Vernestatus" som paths
   - Implementert ekte tekstelementer med Oslo Sans, weight 300 (Light)
   - Font-størrelse: 18px, line-height: 28px, letter-spacing: -0.2px
   - Verdier etter kolon er nå bold (fontWeight: 700)

2. **Oppdaterte datakilder**:
   - **Byggeår**: Henter fra `tattIBrukDato` i CSV, viser kun årstall (første 4 tegn)
   - **Areal**: Henter fra `bruksarealTotalt` i CSV, viser med "m²"
   - **Eiertype**: Henter fra `eierform` i CSV (fallback fjernet)
   - **Vernestatus**: Henter fra `vernestatus` i CSV (fallback fjernet)

3. **CSV-parsing forbedringer**:
   - Fikset parsing av tall med mellomrom (f.eks. "1 122" blir nå korrekt tolket som 1122)
   - Oppdatert alle numeriske felt i csvService.ts til å fjerne mellomrom før parsing

4. **Dynamisk kart implementert**:
   - Lagt til kart nederst i hvit info-boks (336x204px)
   - Bruker Geonorge API for å hente koordinater basert på søkeadresse
   - Viser Kartverket-kart med zoom-nivå 16
   - Inkluderer rød markør på adressen
   - Viser "Laster kart..." mens koordinater hentes
   - Kartverket-attribusjon inkludert

## Siste oppdateringer (2025-01-25 - Kveld, senere)

### Header og info-boks posisjoneringsforbedringer:

1. **Header-forbedringer**:
   - Endret fra skalerbar header til fast størrelse: 1700x85 piksler
   - Fjernet `preserveAspectRatio` for å unngå skalering
   - Header er sentrert horisontalt med flexbox
   - Posisjonert dynamisk for å opprettholde 73px avstand fra info-boksen
   - Fikset tilbakeknappen som ble kuttet av ved å utvide viewBox fra 1600 til 1700px

2. **Hvit info-boks justeringer**:
   - Fast størrelse: 336x700 piksler
   - Posisjonert med `bottom: 55px` (samme som energitiltakslisten)
   - Fast avstand på 74px fra energitiltakslisten
   - Kartet flyttet til bunnen av boksen (y=496) for å matche ny høyde
   - ViewBox og clipPath oppdatert til 700px høyde

3. **Sentrering av fargede blokker**:
   - Grønn blokk (#C7F6C9) og blå blokk (#D1F9FF) er nå sentrert i info-boksen
   - Ny `blocksStartX` variabel beregner sentrert posisjon basert på total bredde
   - Alle relaterte ikoner og tekst er oppdatert til å følge den nye posisjoneringen
   - Opprettholder 8px mellomrom mellom blokkene

4. **Tekniske forbedringer**:
   - Header-posisjon: `top: 'calc(100vh - 55px - 700px - 73px - 85px)'`
   - Info-boks har både `top` og `bottom` constraints fjernet til fordel for kun `bottom: 55px`
   - Alle SVG-elementer bruker dynamiske beregninger for responsiv posisjonering

## Konklusjon

Løsningen gir en elegant overgang fra generell skyline-visning til fokusert bygningstype-visning. Fade-effekten skaper en visuell kobling mellom søkeresultat og bygningstype, mens den responsive skaleringen sikrer god visning på alle skjermstørrelser. De siste UI-forbedringene forbedrer brukeropplevelsen med tydeligere informasjonshierarki og bedre visuell organisering av tiltak og informasjon.