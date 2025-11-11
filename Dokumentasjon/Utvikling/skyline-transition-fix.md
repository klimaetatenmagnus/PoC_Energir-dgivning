# Forbedringer av skyline-overgang

## Bakgrunn

Det ble observert et hopp når skylinen fra landingssiden skulle animere over til detaljvisningen. Årsaken var at skyline-SVG-en var låst til bunnen av viewporten, mens detaljsiden rendret et skalert artboard (1728×900) som var sentrert med egen offset. Det samme offset-avviket førte også til at bunnlinjen fikk feil bakgrunnsfarge etter at animasjonen var ferdig.

## Hovedendringer

1. **Felles viewport-metri kk**

   - Ny hook `useFigmaViewportMetrics` (`src/hooks/useFigmaViewportMetrics.ts`) beregner skalering og vertikal offset basert på vindusstørrelsen.
   - Både `App.tsx` og `FigmaMainScript.tsx` bruker hooken slik at landingssiden og detaljvisningen får identisk koordinatsystem.
2. **Synkron skyline og bakke**

   - Landingssiden rendrer nå hele artboardet i samme skalering som detaljvisningen, noe som gjør at skyline og bygning starter på identisk posisjon før animasjonen.
   - En ny "bakke"-flate renderes under skyline og benytter `--pkt-color-grays-gray-100` (med lys fallback). Bakken følger samme fade som skyline slik at alt glir sømløst ut når en adresse slås opp.
3. **Opprydding i detaljvisningen**

   - Tidligere bakke-lag i `FigmaMainScript` ble fjernet for å unngå at bakke-elementet dukker opp igjen etter overgangen.

## Dynamiske vinduslys

- Landingssiden har fått en subtil vinduslys-animasjon som gjør skyline mer levende. Kun kvadratiske, mørke (#2A2859) vindusflater over bakkenivå detekteres, og ca. 10 % av dem starter som «på».
- Hvert tredje sekund velges ett tilfeldig vindu som enten slås av eller på (så lenge `prefers-reduced-motion` ikke ber om redusert animasjon), noe som gir et organisk uttrykk.
- Farge for aktive vinduer bruker `--pkt-color-brand-yellow-1000` med `#BB8A1D` som fallback for å stå i stil med øvrig profil.
- Effekten kan aktiveres/deaktiveres ved å sette `SKYLINE_LIGHTS_ENABLED` i `src/App.tsx`. Når flagget er `false` beholder alle vinduer originalfargen og all animasjonslogikk er slått av.
- Vindusutvelgelsen filtrerer nå kun helt rektangulære paths (kun `M/H/V/Z`-kommandoer) og ignorerer større flater, slik at takplater og klokketårn ikke påvirkes.

## Tester

- `npm run typecheck`

## Videre oppfølging

- Valider i nettleser at skyline og bakken holder seg justert på tvers av ulike skjermstørrelser.
- Vurder om flere elementer på landingssiden bør bruke `useFigmaViewportMetrics` for å sikre pikselperfekt samsvar med detaljvisningen.

## Status 2025-02-15

- **Snapshot-basert startposisjon:** `useFigmaAddressSearch` fanger nå viewport-koordinatene for både hus (`#landing-enebolig`) og blokk (`#block-building`) idet skyline fader ut. Disse koordinatene oversettes til Figma-koordinatsystemet og sendes til `FigmaMainScript`, slik at animasjonen bruker ekte startposisjon fremfor hardkodede tall. Se `captureLandingSnapshot` i `src/hooks/useFigmaAddressSearch.ts`.
- **Enkelt bygg per scene:** `FigmaMainScript` ble refaktorert til én komponent per bygningstype (ikke lenger “bygning 1/bygning 2” med egen fade). Kun `bottom`/`left`/`transform` animeres, og CSS-opacity holdes konstant slik at huset/blokken ikke fader underveis.
- **Klone/fade-lag fjernet:** For å unngå doble fades fjernet vi midlertidige skyline-kloner og bakke-elementer i detaljvisningen; resten av layouten relyer på samme artboard-transform som landing-siden.
- **Maestro-problem gjenstår:** Til tross for snapshot-løsningen hopper bygget fortsatt kort ned til bunnen når detaljvisningen mountes i store vinduer. Hypotese: `FigmaMainScript` rendres før snapshot-data er tilgjengelig (React mount -> fallback posisjon brukes en render), eller CSS transform for artboarden initielt skaleres uten å vente på `landingSnapshot`, slik at `bottom` beregnes mot en midlertidig `0`. Neste steg er å blokke render (evt. skeleton) til snapshot finnes, eller gjøre bygningens `top/left` relative til viewport i stedet for artboard ved første render.

## Status 2025-11-11

- **Garantert startkoordinater før animasjon:** `FigmaMainScript` bruker nå en intern hook (`useBuildingStartCoordinates`) som holder bygget skjult til vi enten har ekte snapshot-koordinater eller en kontrollert fallback etter 250 ms. Dermed kan React gjerne mounte detaljvisningen før `landingSnapshot` er klar uten at huset/blokken rekker å “falle” til `bottom: 0`.
- **Snapshot vinner alltid:** Dersom fallback først blir brukt men snapshot dukker opp senere (før animasjonen starter), overskrives fallback-koordinatene nå automatisk. I dev bygger vi også på `console.info`-logging (`[skyline-transition] ... start pinned/fell back`) slik at vi kan kontrollere hvilken kilde som ble brukt i nettleseren.
- **Kildebevisst animasjonsdelay:** Animasjons-hookene for hus/blokk tar hensyn til om startkoordinatene kommer fra snapshot eller fallback. Kun snapshot-løpet får den eksisterende 80 ms forsinkelsen; fallback starter umiddelbart for å unngå ekstra ventetid når vi ikke har sanntidsdata.
- **Portal-basert overgangslag:** Når søket lykkes fanges DOM-rect for huset/blokka og mates inn til en global `TransitionOverlayContext`. Overlegget kopierer bygget, låser seg til akkurat samme posisjon som på landingssiden og følger brukeren videre mens resten av skyline fader ut. Når detaljvisningen mountes rapporterer den ønsket sluttposisjon (via `setTargetRect`), og overlayet lerper via en ren CSS-transform i viewport-koordinater.
- **Detaljvisning fases inn igjen:** Alt innhold holdes skjult kun mens vi er i `captured`-fasen (før målet er målt). Når overlayet starter selve animasjonen er detaljvisningen allerede på plass bak kulissene med huset/blokken i sluttposisjon, slik at overgangen oppleves som ett og samme objekt.
- **Bygg-spesifikk easing:** Overgangslagets transform bruker nå lengre varighet og mykere kurve for eneboliger (`2000 ms`, `cubic-bezier(0.28, 0.72, 0.18, 0.99)`), mens blokkene beholder en litt raskere ease (`1600 ms`). Dette matcher den visuelle reiselengden slik at huset føles roligere når det zoomes inn.
- **Synliggjøring først etter målgang:** Selve detalj-layouten fader ikke inn før overlayet har signalisert at animasjonen er ferdig (`phase === 'idle'`). Dermed rekker ikke “det virkelige” huset eller blokken å dukke opp før klonen har landet i sluttposisjonen, og vi slipper dobbel gjengang.
- **Overlayen blir stående i sluttposisjon:** Etter at transformasjonen er ferdig går overlayen inn i en `settling`-fase, hvor den blir liggende i sluttposisjon mens detaljsiden fader inn. Først når fade‑overgangen er ferdig rydder vi vekk overlayen og lar den underliggende komponenten ta over, slik at øyet aldri ser et hopp.

### Manuell verifisering 2025-11-11

- Eneboligoppslag (Lyseveien 3) og blokkoppslag (Thereses gate 44A) demonstrerer nå en kontinuerlig overgang uten hopp: skyline > overlay-klone > detaljside.
- Ingen “blink” mellom overlay og detaljbygget; overlay-klonen beholdes gjennom fade-in og fjernes ~450 ms etter at detaljscenen begynner å vises.
