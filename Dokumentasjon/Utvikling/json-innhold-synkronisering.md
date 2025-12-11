# Synkronisering av JSON-innhold fra legacy TSX-filer

Opprettet: 2025-11-26

> **Status: FULLFØRT OG LUKKET**
>
> Denne migrasjonen er fullført. `scripts/extract-tsx-content.mjs` og `GulListeTiltak/`-mappen med `*Gul.tsx`-filer er slettet.
> Dokumentet beholdes for historisk referanse.

---

## Problemstilling

Under refaktoreringen av tiltakskomponentene fra hardkodet innhold til JSON-basert innhold, ble tekstene i enkelte tilfeller sammenfattet eller forkortet av en AI-agent i stedet for å bli kopiert ordrett. Dette har ført til avvik mellom:

- **Prod-innholdet** (hardkodet i TSX-filer i `main`-branchen)
- **JSON-filene** (i `content/tiltak/*.json` i utviklingsbranchen)

## Mål

Oppdatere alle `content/tiltak/*.json`-filer med det eksakte tekstinnholdet fra de tilsvarende TSX-komponentene i `main`-branchen.

## Berørte filer

### JSON-filer som skal oppdateres

| Fil | Tilsvarende TSX i main |
|-----|------------------------|
| `content/tiltak/varmepumpe.json` | `src/components/FigmaBlokk/components/Tiltak/Varmepumpe.tsx` |
| `content/tiltak/solenergi.json` | `src/components/FigmaBlokk/components/Tiltak/Solenergi.tsx` |
| `content/tiltak/tetting.json` | `src/components/FigmaBlokk/components/Tiltak/Tetting.tsx` |
| `content/tiltak/ventilasjon.json` | `src/components/FigmaBlokk/components/Tiltak/Ventilasjon.tsx` |
| `content/tiltak/temperaturstyring.json` | `src/components/FigmaBlokk/components/Tiltak/Temperaturstyring.tsx` |
| `content/tiltak/vinduer.json` | `src/components/FigmaBlokk/components/Tiltak/UtskiftningAvVindu.tsx` |
| `content/tiltak/etterisolering-kjeller-loft.json` | `src/components/FigmaBlokk/components/Tiltak/IsoleringAvKjellerOgLoft.tsx` |
| `content/tiltak/etterisolering-yttervegg.json` | `src/components/FigmaBlokk/components/Tiltak/EtterisoleringYttervegg.tsx` |

## Tekstfelter som må synkroniseres

For hvert tiltak må følgende felter ekstraheres fra TSX og oppdateres i JSON:

| JSON-felt | Kilde i TSX |
|-----------|-------------|
| `introParagraphs[]` | Intro-tekst øverst i kortet |
| `buildingTypeParagraphs.*` | Byggtype-spesifikke avsnitt (enebolig, rekkehus, leilighet, etc.) |
| `tabs[].tabs[].body[]` | Innhold i faner (for tiltak med tabs) |
| `accordion[].body[]` | Innhold i accordion-seksjoner |
| `accordion[].applicationRequirement.content` | Søknadsplikttekst |
| `benefits[].title` | Fordelstitler |
| `benefits[].description` | Fordelsbeskrivelser |
| `readMore[].label` | Lenketekster |

## Valgt løsning: Semi-automatisk ekstraksjon

**Status:** ✅ Fullført og avsluttet (skriptet er nå slettet)

~~Vi har implementert et Node.js-skript (`scripts/extract-tsx-content.mjs`) som ekstraherer tekstinnhold fra TSX-filer i main-branchen og oppdaterer tilsvarende JSON-filer.~~

> **MERK:** Skriptet `scripts/extract-tsx-content.mjs` er slettet da migrasjonen er fullført. Innholdet ligger nå i JSON-filene under `content/tiltak/`.

### Skriptets funksjonalitet

Skriptet:
1. Henter TSX-filer fra main-branchen via `git show main:<path>`
2. Parser tekstinnhold fra `<p>`-tagger i `<foreignObject>`-seksjoner
3. Ekstraherer intro-avsnitt, byggtype-spesifikke tekster og tab-innhold
4. Oppdaterer JSON-filene med det ekstraherte innholdet
5. Beholder metadata, grants, readMore og andre felter uendret

### Bruk

```bash
# Forhåndsvis endringer uten å skrive til fil
node scripts/extract-tsx-content.mjs varmepumpe --dry-run

# Oppdater én JSON-fil (inkludert gul liste-variant)
node scripts/extract-tsx-content.mjs varmepumpe

# Oppdater alle tiltak
node scripts/extract-tsx-content.mjs --all

# Oppdater alle med forhåndsvisning først
node scripts/extract-tsx-content.mjs --all --dry-run

# Hopp over gul liste-varianter (kun standard innhold)
node scripts/extract-tsx-content.mjs varmepumpe --skip-gul
```

### Tilgjengelige tiltak-slugs

- `varmepumpe`
- `solenergi`
- `tetting`
- `ventilasjon`
- `temperaturstyring`
- `vinduer`
- `etterisolering-kjeller-loft`
- `etterisolering-yttervegg`

### Hva skriptet ekstraherer

| Felt | Kilde i TSX | Merknad |
|------|-------------|---------|
| `introParagraphs` | Første `<p>` i "Generelt"-seksjonen | Ubetinget tekst |
| `buildingTypeParagraphs` | Betinget rendrede `<p>` basert på `buildingType` | Ekstraheres per byggtype |
| `tabs[].body` | Innhold i tab-seksjoner (`activeButton === 'X'`) | Kun for tiltak med tabs |
| `variants[].introParagraphs` | Første `<p>` i gul liste TSX | Fra `*Gul.tsx`-filer |
| `variants[].buildingTypeParagraphs` | Betinget rendrede `<p>` i gul liste TSX | Fra `*Gul.tsx`-filer |

### Gul liste-støtte (UTGÅTT)

> **MERK:** `GulListeTiltak/`-mappen og alle `*Gul.tsx`-filer er slettet. Gul liste-innhold håndteres nå via `variants`-arrayen med `audience: "gulliste"` i JSON-filene.

~~Skriptet henter automatisk innhold fra gul liste-filer i `GulListeTiltak/`-mappen og oppdaterer `variants[]`-arrayen i JSON der `audience === "gulliste"`.~~

~~Gul liste-filer som støttes:~~
- ~~`VarmepumpeGul.tsx`~~
- ~~`SolenergiGul.tsx`~~
- ~~`TettingGul.tsx`~~
- ~~`VentilasjonGul.tsx`~~
- ~~`TemperaturstyringGul.tsx`~~
- ~~`UtskiftningAvVinduGul.tsx`~~
- ~~`IsoleringAvKjellerOgLoftGul.tsx`~~
- ~~`EtterisoleringYtterveggGul.tsx`~~

### Begrensninger

- **Accordion/søknadsplikt:** Disse seksjonene har mer kompleks struktur og må verifiseres manuelt.
- **Benefits-beskrivelser:** Kun titler finnes i TSX; beskrivelser beholdes fra JSON.
- **readMore/grants i varianter:** Disse feltene oppdateres ikke automatisk og må vedlikeholdes manuelt.

### Etter kjøring

Etter å ha kjørt skriptet, valider alltid med:

```bash
npm run content:validate
```

## Utfordringer

### Strukturforskjeller

TSX-filene har tekstinnhold:
- Direkte i `<text>`-elementer (SVG)
- I `<p>`-tagger innenfor `<foreignObject>`
- Betinget rendret basert på `buildingType`
- I `<tspan>`-elementer

JSON-strukturen forventer:
- Arrays av strenger (`introParagraphs: ["...", "..."]`)
- Objekter med nøkler (`buildingTypeParagraphs: { enebolig: [...] }`)

### Gul liste-varianter

Noen tiltak har egne gul liste-komponenter (`*Gul.tsx`) med alternative tekster. Disse må mappes til `variants[].audience: "gulliste"` i JSON.

## Gjennomføringsplan

| # | Oppgave | Status |
|---|---------|--------|
| 1 | Dokumentere problemstilling (dette dokumentet) | ✅ Ferdig |
| 2 | Velge teknisk tilnærming | ✅ Semi-automatisk ekstraksjon |
| 3 | Implementere ekstraksjonsskript | ✅ `scripts/extract-tsx-content.mjs` |
| 4 | Teste skriptet på varmepumpe | ✅ Ferdig |
| 5 | Kjøre synkronisering for alle 8 tiltak | ✅ Ferdig (7 av 8 oppdatert) |
| 6 | Verifisere at JSON validerer mot schema | ✅ Alle 10 tiltak validerer |
| 7 | Teste i admin-preview | ⏳ Venter |
| 8 | Teste i frontend (staging) | ⏳ Venter |

## Kommandoer for referanse

### Hente TSX-fil fra main-branchen

```bash
git show main:src/components/FigmaBlokk/components/Tiltak/Varmepumpe.tsx
```

### Validere JSON-filer etter oppdatering

```bash
npm run content:validate
```

### Liste alle tiltak-filer

```bash
ls -la content/tiltak/*.json
```

## Logg

| Dato | Aktivitet |
|------|-----------|
| 2025-11-26 | Opprettet arbeidsdokument |
| 2025-11-26 | Implementert `scripts/extract-tsx-content.mjs` |
| 2025-11-26 | Testet skriptet på varmepumpe - fungerer korrekt |
| 2025-11-26 | Oppdatert `content/tiltak/varmepumpe.json` med prod-innhold |
| 2025-11-26 | Utvidet skriptet med gul liste-støtte (`*Gul.tsx`-filer) |
| 2025-11-26 | Testet gul liste-ekstraksjon på varmepumpe - fungerer korrekt |
| 2025-11-26 | Fikset ekstraksjon for tiltak uten tabs (støtter nå begge strukturer) |
| 2025-11-26 | Kjørt synkronisering for alle 8 tiltak - 7 av 8 oppdatert |
| 2025-12-11 | Migrasjonen fullført. Slettet `scripts/extract-tsx-content.mjs` og dokumentert at `GulListeTiltak/`-mappen er fjernet |
