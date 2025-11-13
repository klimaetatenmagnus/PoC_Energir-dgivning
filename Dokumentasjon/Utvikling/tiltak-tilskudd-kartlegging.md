# Kartlegging av tiltak- og tilskuddsdata

Oppdatert: 2025-11-14

Denne kartleggingen samler dagens kunnskap om hvilke data som driver tiltakskomponentene i Energinøkkelen, hvordan støtte-/tilskuddsinformasjon håndteres, og hvilke gap som må lukkes før vi kan bygge et redeploy-fritt innholdsverktøy.

## 1. Tiltakskomponenter i dagens kode

Alle tiltak ligger i `src/components/FigmaBlokk/components/Tiltak/`. De fleste komponentene har lik layout (intro-tekst, fordelsbokser, “Les mer”-lenker, støtteordningstabell, søknadsplikt-accordion). `useStotteordninger` henter tilskudd ved å sende et `tiltak`-slug og bygningstype (`shared.ts` kartlegger byggtyper, ref. `src/components/FigmaBlokk/components/Tiltak/shared.ts:3-120`).

### Etterisolering av yttervegg
- **Component:** `src/components/FigmaBlokk/components/Tiltak/EtterisoleringYttervegg.tsx`
- **Støtteordningsslug:** `etterisolering_fasade` (`src/components/FigmaBlokk/components/Tiltak/EtterisoleringYttervegg.tsx:46`)
- **Innholdselementer:**
  - Tittel, intro-avsnitt og bygningstype-tekst leses allerede fra `content/tiltak/etterisolering-yttervegg.json` via `useRuntimeJson` (`src/components/FigmaBlokk/components/Tiltak/EtterisoleringYttervegg.tsx:51`, `content/tiltak/etterisolering-yttervegg.json:1-12`).
  - Fire grønne fordelsbokser (“Mindre trekk”, “Ivaretar boligen”, “Høyere boligverdi”, “Redusert energibehov”) ligger hardkodet i SVG (ca. `src/components/FigmaBlokk/components/Tiltak/EtterisoleringYttervegg.tsx:214-247`).
  - Årlig besparelse-kort bruker `ENERGY_SAVINGS_DATA` kombinert med byggdata, men alle tekster (“Årlig besparelse”, tooltip-tekst osv.) er hardkodet (`src/components/FigmaBlokk/components/Tiltak/EtterisoleringYttervegg.tsx:248-450`).
  - “Les mer”-sirkelen inneholder tre lenker (DIBK, Enova, Sintef) som er hardkodet (`src/components/FigmaBlokk/components/Tiltak/EtterisoleringYttervegg.tsx:563-615`).
  - Søknadsplikt-accordion består av flere tekstblokker som repeteres i andre tiltak (`src/components/FigmaBlokk/components/Tiltak/EtterisoleringYttervegg.tsx:731-1090`).
  - Støtteordningstabellen leser data fra API men kolonneoverskrifter og hjelpetekster er hardkodet (`src/components/FigmaBlokk/components/Tiltak/EtterisoleringYttervegg.tsx:616-720`).
- **Status 2025-11-12:** Tiltaket er først ute med nytt JSON-schema (`content/tiltak/etterisolering-yttervegg.json`, schemaVersion 1) og hentes nå via `useTiltakContent` i frontenden.
- **Status 2025-11-13:** Støtteordningstabellen bruker `useTilskuddBatch` og tiltakets `grants`-liste (`enova-etterisolering`, `klimaoslo-fasadefond`) slik at hele kortet, inkludert tilskudd, kan redigeres i JSON.

### Etterisolering av kjeller og loft
- **Component:** `src/components/FigmaBlokk/components/Tiltak/IsoleringAvKjellerOgLoft.tsx`
- **Slug:** `etterisolering_kjeller_loft` (`src/components/FigmaBlokk/components/Tiltak/IsoleringAvKjellerOgLoft.tsx:21`)
- **Innhold:** Samme layout som over, men alt innhold (intro, byggtypebeskrivelser, fordelsbokser, lenker) ligger i komponenten. Ingen runtime-JSON finnes.
- **Status 2025-11-13:** Første draft av JSON (`content/tiltak/etterisolering-kjeller-loft.json`) er sjekket inn og komponenten bruker nå `useTiltakContent` for tittel og tekst. Tilknyttet tilskudd (`enova-etterisolering-loft-kjeller`) ligger i `content/tilskudd/` med status `draft`.

### Solenergi
- **Component:** `src/components/FigmaBlokk/components/Tiltak/Solenergi.tsx`
- **Slug:** `solenergi` (`src/components/FigmaBlokk/components/Tiltak/Solenergi.tsx:17`)
- **Innhold:** Intro-tekst med lenke til solkart, tre byggtype-spesifikke paragrafer (`src/components/FigmaBlokk/components/Tiltak/Solenergi.tsx:49-96`), fordelsbokser, tre “Les mer”-lenker og søknadsplikt-accordion.
- **Status 2025-11-13:** `content/tiltak/solenergi.json` (published) leverer tittel, intro, byggtype-tekst, fordeler og “Les mer”-lenker via `useTiltakContent`, mens `useGrantAwareStotteordninger` bruker `grants` (`klimaoslo-solenergitilskudd`, `enova-solcelleanlegg`) til å hente tilskudd direkte fra `content/tilskudd/`.

### Tetting
- **Component:** `src/components/FigmaBlokk/components/Tiltak/Tetting.tsx`
- **Slug:** `tetting` (`src/components/FigmaBlokk/components/Tiltak/Tetting.tsx:17`)
- **Innhold:** Lik basislayout. Har building-type-branch (enebolig vs. øvrige). Ingen ekstern data.
- **Status 2025-11-14:** Innholdet er modellert i `content/tiltak/tetting.json` (draft) med gul-listevariant, søknadsplikt-ordliste og grants (`klimaoslo-oppgradering-bygningskropp`, `klimaoslo-energitiltak-borettslag`, `klimaoslo-energikartlegging-borettslag`, `klimaoslo-vinduer-dorer`, `enova-energiradgivning`, `byantikvaren-istandsetting`). React-komponenten leser fortsatt hardkodet innhold og må kobles til `useTiltakContent`.

### Temperaturstyring
- **Component:** `src/components/FigmaBlokk/components/Tiltak/Temperaturstyring.tsx`
- **Slug:** `temperaturstyring` for runtime-content (legacy `smart_energistyring` brukes fortsatt som fallback i `useGrantAwareStotteordninger`)
- **Innhold:** Lik basislayout (intro, byggtype-tekst, fordelsbokser, “Les mer”-sirkel, støtteordningstabell og søknadsplikt-accordion).
- **Status 2025-11-15:** Innholdet ligger i `content/tiltak/temperaturstyring.json` (inkludert gul-listevariant, glossary og `grants`). React-komponenten bruker nå `useTiltakContent` + `applyTiltakVariant`, og `GulListeTiltak/TemperaturstyringGul` er redusert til en ren wrapper med `audience="gulliste"`. Støtteordningstabellen henter `enova-energiradgivning`, `klimaoslo-smart-energistyring`, `klimaoslo-pris-effektstyring` (variant: `byantikvaren-istandsetting`) via `useGrantAwareStotteordninger`.

### Ventilasjon
- **Component:** `src/components/FigmaBlokk/components/Tiltak/Ventilasjon.tsx`
- **Slug:** `ventilasjon` (`src/components/FigmaBlokk/components/Tiltak/Ventilasjon.tsx:16`)
- **Innhold:** Lik basislayout. Byggtype-paragrafer for enebolig/rekkehus/blokk.
- **Status 2025-11-14:** `content/tiltak/ventilasjon.json` (draft) dekker standard og gul-listeinnhold samt grants (`klimaoslo-balansert-ventilasjon`, `klimaoslo-energitiltak-borettslag`, `klimaoslo-energikartlegging-borettslag`, `byantikvaren-istandsetting`, `enova-energiradgivning`). Frontenden bruker fremdeles hardkodet tekst/legacy-støtteordninger.

### Varmepumpe
- **Component:** `src/components/FigmaBlokk/components/Tiltak/Varmepumpe.tsx`
- **Slug:** `varmepumpe` (`src/components/FigmaBlokk/components/Tiltak/Varmepumpe.tsx:18`)
- **Innhold:** Samme grunnstruktur, men har interaktive faner (Generelt, Luft-luft, Luft-vann, Væske-vann, Ventilasjon) med egne tekster (`src/components/FigmaBlokk/components/Tiltak/Varmepumpe.tsx:27-120`). Søknadsplikt-accordion og “Les mer”-lenker ligger også her.
- **Status 2025-11-13:** `content/tiltak/varmepumpe.json` (published) driver fanene og lenkene via `useTiltakContent`, og komponenten henter `klimaoslo-vaeske-til-vann-varmepumpe` + `klimaoslo-varmepumpebereder` fra `content/tilskudd/` med den nye grant-hooken.

### Utskiftning av vindu
- **Component:** `src/components/FigmaBlokk/components/Tiltak/UtskiftningAvVindu.tsx`
- **Slug:** `vinduer` (`src/components/FigmaBlokk/components/Tiltak/UtskiftningAvVindu.tsx:22`)
- **Innhold:** Faneløsning for “Generelt”, “Vedlikehold”, “Oppgradering” og “Utskiftning” med ulik tekst (`src/components/FigmaBlokk/components/Tiltak/UtskiftningAvVindu.tsx:62-190`). Har i tillegg egne infobokser og “les mer”-lenker. Alt ligger i komponenten.
- **Status 2025-11-14:** Fanelogikken og gulvariant er nå definert i `content/tiltak/vinduer.json` (draft) med tabs, ordforklaring (U-verdi) og grants (`klimaoslo-vinduer-dorer`, `klimaoslo-oppgradering-bygningskropp`, `klimaoslo-energitiltak-borettslag`, `klimaoslo-energikartlegging-borettslag`, `byantikvaren-istandsetting`, `enova-energiradgivning`). React-komponenten er ennå ikke koblet til JSON.

### Gul liste-varianter
- **Plassering:** `src/components/FigmaBlokk/components/Tiltak/GulListeTiltak/*`
- **Beskrivelse:** Kopier av standard-tiltak, men `useStotteordninger` kalles med `gulliste: true` (`src/components/FigmaBlokk/components/Tiltak/GulListeTiltak/TettingGul.tsx:15-26`). Tekstene er ofte mer restriktive (bevaring/antikvariske hensyn) og ligger i egne filer. Det finnes gul-versjoner av de fleste tiltak (Solenergi, Varmepumpe, Ventilasjon, osv.), noe som dobler vedlikeholdet.

### Fellesfunksjoner
- **Building-/energikategorier:** `shared.ts` definerer mappinger mellom brukerens bygningstype og `enebolig/rekkehus/blokk` kategorier (`src/components/FigmaBlokk/components/Tiltak/shared.ts:21-83`).
- **Energidata:** `ENERGY_SAVINGS_DATA` holder tabeller for ulike TEK-perioder (`src/components/FigmaBlokk/components/Tiltak/shared.ts:102-188`); tekstene rundt beregning er hardkodet i hver komponent.
- **Støtteordningstjeneste:** `src/services/stotteordning-service.ts` mapper tiltak/bygningstype til API-parametere og returnerer `ordning/lenke/beløp/overskrift` (`src/services/stotteordning-service.ts:3-90`).

### Oppsummering av tiltaksgap
- `Etterisolering av yttervegg`, `Etterisolering av kjeller/loft`, `Solenergi` og `Varmepumpe` er koblet til `content/`, mens Tetting, Ventilasjon og Vinduer (inkl. gul-varianter) har fått JSON-filer men UI-et bruker fremdeles hardkodet innhold/legacy-støtteordninger.
- Fordelsbokser, “Les mer”-lenker, CTA-tekst og søknadspliktinformasjon er fremdeles duplisert i React for tiltak som ikke er bundet til `useTiltakContent`.
- Tab- og accordionstrukturen for Vinduer/Tetting/Ventilasjon ligger i `content/tiltak/*.json`, men komponentene må skrus om til å lese tabs + ordforklaringer fra schemaet.
- Gul liste-variantene modelleres nå som `variants[]` i JSON, men runtime bruker fortsatt egne komponentkopier, så vi får ikke gjenbruk før komponentene bytter til variant-override.

## 2. Tilskudds-/støtteordningsdata

### Kilde og struktur
- **Autogenerert fil:** `src/data/stotteordningData.js` bygges av Python-skriptet `stotteordning_cache.py` (`src/data/stotteordningData.js:1-5`). Strukturen er `stotteordningData = { sist_oppdatert, <tiltak>: { enebolig: [...], rekkehus: [...], blokk: [...] }, gulliste: { ... } }`.
- **Felter per ordning:** `ordning`, `lenke`, `belop`, `overskrift`. Ingen unike ID-er, beskrivelser, kategorier eller gyldighetsperioder finnes (`src/data/stotteordningData.js:5-210`).
- **API-server:** `/api/stotteordninger` og `/api/stotteordninger-live` kjører Python-skript for å hente data direkte fra Excel/Google Sheets (`src/api-server.ts:624-715`). `/api/update-stotteordninger` oppdaterer cache-filen (`src/api-server.ts:719-742`).
- **Klient:** `useStotteordninger` kallet API-et hver gang et tiltak vises. Resultatet brukes direkte i tabellen.

### Identifiserte gap
- Støtteordningsdata ligger ikke i `content/` og kan ikke oppdateres uten å kjøre Python-skript + commit. Ingen metadata om hvem som oppdaterte dataene.
- Strukturen støtter kun tre bygningstyper + valgfritt gulliste-flagg. Det er ingen måte å beskrive vilkår, satser (beløp vs. prosent), søknadsfrister, kontaktpunkter eller hvilke tiltak en ordning gjelder for.
- Mangler stabile ID-er; admin-verktøy får problemer med å referere til ordninger.
- Ingen kobling mellom tiltak og tilskudd utover `supportTags`-feltet som planlagt i ny løsning (per nå finnes ikke dette feltet i dataene).
- **Status 2025-11-12:** Tilskuddet `enova-etterisolering` ligger nå i `content/tilskudd/enova-etterisolering.json` (schemaVersion 1) og refereres fra tiltaket `etterisolering-yttervegg`.
- **Status 2025-11-13:** `content/tilskudd/klimaoslo-fasadefond.json` (published) og `content/tilskudd/enova-etterisolering-loft-kjeller.json` (draft) er lagt til. Frontenden bruker `useTilskuddBatch` for å hente relaterte tilskudd basert på tiltakets `grants`-felt.
- **Status 2025-11-13:** Nye tilskudd for sol/varmepumpe (`klimaoslo-solenergitilskudd`, `enova-solcelleanlegg`, `klimaoslo-vaeske-til-vann-varmepumpe`, `klimaoslo-varmepumpebereder`) er publisert i `content/tilskudd/` og brukes nå av Solenergi- og Varmepumpe-komponentene via `useGrantAwareStotteordninger`.
- **Status 2025-11-14:** Tetting/Ventilasjon/Vinduer er dekket av nye støttefiler (`klimaoslo-oppgradering-bygningskropp`, `klimaoslo-energitiltak-borettslag`, `klimaoslo-energikartlegging-borettslag`, `klimaoslo-balansert-ventilasjon`, `klimaoslo-vinduer-dorer`, `enova-energiradgivning`, `byantikvaren-istandsetting`) med full metadata/eligibility, men React-komponentene kobler ennå ikke `grants`-listene inn i UI.
- **Status 2025-11-15:** Temperaturstyring er koblet til `content/tilskudd/klimaoslo-smart-energistyring.json`, `content/tilskudd/klimaoslo-pris-effektstyring.json` og eksisterende `enova-energiradgivning.json`. Variant for gul liste bruker i tillegg `byantikvaren-istandsetting`. Alle tre filene har metadata for staging/prod og er referert fra tiltakets `grants`.

Denne kartleggingen beskriver dagens kode/data og funn. Alle fremdriftsplaner og «neste steg» administreres videre i `Dokumentasjon/Utvikling/tiltak-innholdsredigering-plan.md`.
