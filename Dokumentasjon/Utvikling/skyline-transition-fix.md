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
