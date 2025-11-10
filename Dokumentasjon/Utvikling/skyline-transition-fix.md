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

## Tester
- `npm run typecheck`

## Videre oppfølging
- Valider i nettleser at skyline og bakken holder seg justert på tvers av ulike skjermstørrelser.
- Vurder om flere elementer på landingssiden bør bruke `useFigmaViewportMetrics` for å sikre pikselperfekt samsvar med detaljvisningen.
