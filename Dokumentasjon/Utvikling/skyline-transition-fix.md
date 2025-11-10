# Forbedringer av skyline-overgang

## Bakgrunn
Det ble observert et hopp når skylinen fra landingssiden skulle animere over til detaljvisningen. Årsaken var at skyline-SVG-en var låst til bunnen av viewporten, mens detaljsiden rendret et skalert artboard (1728×900) som var sentrert med egen offset. Det samme offset-avviket førte også til at bunnlinjen fikk feil bakgrunnsfarge etter at animasjonen var ferdig.

## Hovedendringer
1. **Felles viewport-metri kk**
   - Ny hook `useFigmaViewportMetrics` (`src/components/FigmaBlokk/hooks/useFigmaViewportMetrics.ts`) beregner skalering og vertikal offset basert på vindusstørrelsen.
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

## Animerte piksel-skyer
- Over skyline-renderingen ligger et nytt `CloudLayer`-lag der små kvadrater (~12 px) settes sammen til to ulike skyformer.
- Skyene bruker nå utelukkende hvite/grå Punkt-nyanser (`--pkt-color-brand-neutrals-white`, `--pkt-color-brand-neutrals-100/200`, `--pkt-color-grays-gray-100/200/300`) og beveger seg horisontalt ved hjelp av CSS-animasjonen `skyline-cloud-move`.
- Skyene er plassert mellom “Energinøkkelen”-tittelen og søkefeltet slik at de er synlige uten å kollidere med øvrig innhold. Høyde og farger kan justeres via `CLOUD_CONFIGS` i `src/App.tsx`.
- Kvadratene er ~12 px brede, tilsvarende vindusstørrelsene i skyline-SVG-en, slik at formene føles integrert med resten av illustrasjonen.
- `CloudLayer` renderes nå inne i artboardet, med `z-index` som legger skyene over bakgrunnsfargen men under søkefelt, logo og skyline-elementer.
- Alle skyene fylles av sammenhengende kvadrat-moduler (ingen transparente hull), slik at blokkene fremstår solide.
- Laget rendres kun i figs `figma`-modus, ligger bak hovedinnholdet (`pointer-events: none`) og kan enkelt tilpasses via `CLOUD_CONFIGS` i `src/App.tsx`.

## Tester
- `npm run typecheck`

## Videre oppfølging
- Valider i nettleser at skyline og bakken holder seg justert på tvers av ulike skjermstørrelser.
- Vurder om flere elementer på landingssiden bør bruke `useFigmaViewportMetrics` for å sikre pikselperfekt samsvar med detaljvisningen.

## Refaktoreringsplan
1. **Løft Figma-landingen ut av `App.tsx`**
   - Opprett `src/components/FigmaBlokk/FigmaLanding.tsx`.
   - Flytt hele markupen for søk, logo, sugestionsliste og tilhørende state fra Figma-grenen i `App.tsx` inn i den nye komponenten.
   - Eksponer nødvendige props (søkeverdier, hendelser, feilmeldinger, fadeverdier) slik at `App` bare trenger å velge mellom `FigmaLanding` og `FigmaMainScript`.

2. **Gjenbruk eksisterende grafikk-komponenter**
   - Erstatt inline Oslo-logoen i Figma-landingen med `OsloLogo` fra `src/components/FigmaBlokk/components/OsloLogo.tsx`, og gjør komponenten i stand til å motta størrelse/klasse-props ved behov.
   - Bruk `OsloSkyline` fra `src/components/FigmaBlokk/components/OsloSkyline.tsx` både i landingen og i detaljvisningen for å dele SVG-pathene og styling.
   - Trekk ut eventuelle variasjoner (viewBox, overlays) via props slik at skylineen kan tilpasses uten å duplisere SVG-en.

3. **Flytt animasjons- og viewportlogikk til FigmaBlokk**
   - Opprett et nytt hook (f.eks. `useLandingAnimation`) i `src/components/FigmaBlokk/hooks` som håndterer `skylineFadeOpacity`, `headerFadeOpacity`, bakke-fade og modusbytte; flytt relaterte tidskonstanter til `src/components/FigmaBlokk/animations.ts`.
   - Flytt `useFigmaViewportMetrics` inn i `src/components/FigmaBlokk/hooks` (eller eksporter en variant derfra) slik at alle artboardberegninger og bakke-/offset-stiler ligger under FigmaBlokk-domenet.
   - La både `FigmaLanding` og `FigmaMainScript` konsumere de samme hookene/konstantene for skala, vertikal offset, bakke-høyde og animasjonsvarighet.

4. **Rengjør `App.tsx`**
   - Etter at landingsinnholdet er flyttet ut, behold kun logikken som bestemmer `mode` og ruter til korrekt komponent.
   - Sørg for at `App` kun importerer FigmaBlokk-artefaktene den trenger (`FigmaLanding`, `FigmaMainScript`, hooks) og at all stilsetting skjer lokalt i komponentene.

5. **Verifiser og dokumenter**
   - Kjør relevante tester (`npm run typecheck`, ev. visuelle kontroller) for å sikre uendret funksjonalitet.
   - Oppdater denne filen med eventuelle ekstra erfaringer eller justeringer når refaktoreringen er gjennomført.

## Arbeidslogg
- **Steg 1 (pågår):** Gikk gjennom `src/App.tsx` for å kartlegge hele Figma-modusen, identifiserte hvilke props/state fra `useFigmaAddressSearch` som må eksponeres til ny komponent, og dokumenterte Figma-spesifikke avhengigheter (logo, skyline, ground layer).  
  **Neste steg:** Flytte landingssiden inn i `src/components/FigmaBlokk/FigmaLanding.tsx`, og begynne å bruke `OsloLogo` og `OsloSkyline`.
- **Steg 2:** Opprettet `FigmaLanding.tsx` i `src/components/FigmaBlokk`, flyttet hele landingsmark-upen dit og erstattet inline-SVG-er med `OsloLogo` (nå med props) og `OsloSkyline` (utvidet med viewBox/style-override). `App.tsx` rendrer nå kun `FigmaLanding` i Figma-modus, slik at designelementene bor i FigmaBlokk.  
  **Neste steg:** Flytte viewport- og fade-logikk (scale, offsets, animasjonsstate) fra `App.tsx`/`useFigmaAddressSearch` inn i dedikerte hooks under `FigmaBlokk`, og la begge modus bruke dem.
- **Steg 3:** Flyttet `useFigmaViewportMetrics` til `src/components/FigmaBlokk/hooks`, lot `FigmaLanding` konsumere hooken direkte (inkl. bakke-fyll) og oppdaterte `FigmaMainScript` til ny import. La til nytt `useLandingAnimation`-hook som håndterer skyline/header-fade og trigging av modusskifte; `useFigmaAddressSearch` importerer nå dette i stedet for å ha lokal animasjonsstate.  
  **Neste steg:** Kjør `npm run typecheck` og annen validering, og dokumenter resultatet i denne filen før ferdigstilling.
- **Steg 4:** Kjørte `npm run typecheck` – grønt. Ingen flere automatiske tester tilgjengelig akkurat nå.  
  **Neste steg:** Gjennomgå endringene en siste gang og oppsummer for innsending.
