# Oppdatering av nøkkelkortet (WhiteInfoBox)

## Mål
- Vis gul liste-status mer subtile ved å erstatte informasjonsboksen med et ikon.
- Gjøre estimert besparelse tydeligere, både visuelt og ved å vise kroner basert på felles pris (1,10 kr/kWh).
- Redusere støyelementer ved å ta bort linjen «Estimerte verdier».

## Leveransepakker
1. **Gul liste-indikator**
   - ✅ Implementert: Tekstlinjen «Vernestatus: Gul liste» rendres nå med `<foreignObject>` og et inline, klikkbart gult ikon som henter opp full forklaring.
   - ✅ Implementert: Hele info-overlegget (tekst, dropdown, tooltip) er flyttet tilbake og trigges av ikonet, uten egen CTA-boks.
   - 🔁 Neste: Vurdere om vi skal legge på kort hover-tooltip direkte på ikonet (microcopy) eller holde oss til panel for å unngå støy.
2. **Estimatkort i NOK**
   - ✅ Implementert: Konvertering til NOK via ny util `convertKwhToNok` (default 1,10 kr/kWh) + valutaformattering i grønn kortboks.
   - ✅ Implementert: Ny HTML/`foreignObject`-basert besparelsesboks med oppdatert padding/typografi og `kr/år`-label.
   - ✅ Ferdig: Copy justert til «Estimert energiforbruk:» (kolon iht. microcopy) og alle «Estimerte verdier»-referanser fjernet.
   - ✅ Ferdig: Fjernet «Basert på 1,10 kr/kWh»-linjen, lot kWh-ekvivalensen stå igjen med samme vekt, og la inn dynamiske marginer slik at kortet aldri kolliderer med kartet (kr/år er låst til høyre uansett tallengde).
   - ✅ Ferdig: Besparelseskortet har rette hjørner uten border radius, i tråd med designmanualen til Oslo kommune.
3. **Animasjoner**
   - ✅ Kortet popper/fader inn første gang `totalEnergySavings > 0` (scale 0.96 → 1, opacity 0 → 1) synket med `ANIMATION_TIMINGS`-easing.
   - ✅ Tall «ruller» via egen `RollingDigit`, drevet av `requestAnimationFrame`-ticker og CSS transform.
   - ✅ `prefers-reduced-motion` guard lagt inn (både ticker og digit-animasjon faller tilbake til statisk visning).
   - 🔁 Neste: Vurdere mikrocopy-tooltip direkte på ikon (fra pkt. 1) og evt. tempojustering når flere tiltak toggles raskt.
4. **Opprydding**
   - ✅ Ferdig: Fjernet «Estimerte verdier»-linjer og oppdatert copy til «Estimert energiforbruk».
   - ✅ Ferdig: Gul liste CTA fjernet; ikon tar over uten å introdusere andre endringer i kortet.
   - 🔁 Neste: Når grønn boks er inne, verifiser at spacing fortsatt er konsekvent mot kart/tiltak.

## Pågående arbeid / tråd som må plukkes opp (oppdatert 7. nov 2025)

- ✅ **Energifelt + besparelsesboks:** `renderEnergyBlock` brukes nå både i visning og redigering, med felles `<foreignObject>` og stabil `kWh/år`-baseline. Energiblokken forankres automatisk 28 px under siste nøkkellinje (vernestatus/areal) – samme avstand som mellom «Nøkkelinformasjon» og «Byggeår».
- ✅ Besparelseskortet er låst til minimum 40 px klaring fra energiblokken og clampes alltid før kartet slik at verken grønn boks eller kart overlapper. Kartet holder fast `MAP_TOP_Y`, så hele panelet holder seg innenfor rammen også når kortet dukker opp.
- ✅ Gul liste / blokk-spesifikke felter (Eiertype, Areal leilighet) rendres kun når de har data eller er i redigering, slik at vertikal rytme ikke får ekstra luft.
- ✅ **Padding-justering (2025‑11‑10):** Adressen og chip-raden er flyttet 42 px nærmere toppkanten (lik margin som sidekantene), og besparelseskortet har fått økt bunnmarg (40 px) slik at det alltid har tydelig luft ned mot kartet – også når energiblokken er aktiv.
- ✅ **Spacing-tilpasning (2025‑11‑12):** Chip-raden arver nå samme vertikale margin som adressen, og vi kompenserer for fontens ascenders slik at «Nøkkelinformasjon» optisk ligger like langt unna. I tillegg deles lufta mellom energiblokken og kartet likt rundt besparelseskortet, så grønn boks alltid har symmetrisk padding uansett om Gul liste-raden vises eller ikke.
- 🔁 Neste:
  1. Vurder fortsatt mikrocopy-tooltip på gul-ikonet (fremdeles åpen beslutning fra pkt. 1).
  2. Tempojustering ved hurtig toggling av flere tiltak (ticker-oppdatering).
  3. QA på små skjermer/mobil for å sikre at nye avstander fungerer mot kart og tiltaksliste.

## Tekniske grep
- Opprett util `convertKwhToNok(kwh: number)` i f.eks. `src/utils/energy.ts` for gjenbruk.
- WhiteInfoBox får to nye props:
  - `energyPricePerKwh?: number` (default 1.1) for fremtidig fleks.
  - `animateSavings?: boolean` hvis vi skal trigge fra andre komponenter senere.
- Tilstand i WhiteInfoBox:
  - `const [hasShownSavings, setHasShownSavings] = useState(false);`
  - Oppdater når `totalEnergySavings > 0` for å trigge animasjon én gang.
- Tall-animasjon:
  - Memoiser `formattedSavings = useMemo(() => formatCurrency(kwhToNok(totalEnergySavings)), [totalEnergySavings])`.
  - `useEffect` på tallet for å kjøre `startTicker(from, to)` som oppdaterer `displayedValue` via `requestAnimationFrame`.
  - For «rulle»-effekten: Map hvert siffer til en vertikal stack med 0–9, og bruk CSS `transform` for å rulle til riktig posisjon (liten komponent `RollingDigit`) – hver kolonne er nå låst til 0.9ch med eksplisitt baseline-justering.
- Styling skjer inne i eksisterende `<svg>` – det kan bli tungt. Alternativer:
  1. Fortsette i SVG, men da må animasjoner kodes manuelt.
  2. Flytte besparelsesboksen til HTML via `<foreignObject>`; enklere for CSS/animations. Valg: HTML for enklere animasjon.
- Map fjernes? behold `<rect>` fallback, men legg en `mask-image` for screenshot? (ingen endring planlagt). Kort-posisjon beregnes nå opp mot `MAP_TOP_Y` for å sikre konsekvent spacing mot kartet.

## Test/checkliste
- Toggle ett tiltak: kort skal fade inn, tall rulle til nytt kr-beløp, beløp = `roundToNearestThousand(totalEnergySavings * 1.1)` (eller vurder nærmeste hundre?).
- Toggle flere tiltak raskt: animasjon skal oppdatere jevnt uten å hoppe.
- `prefers-reduced-motion`: hopp over scale + digit-rull, bruk vanlige tall.
- Gul liste = false: ikon vises ikke, spacing konsistent.
- Edit mode (isEditMode): kort skal fortsatt kunne redigeres; vernestatusfelt trenger ikon også der.
- Mobile breakpoint (hvis finnes) – verifiser at grønn boks brekker fint i smal layout.

## Mockup
- Light mockup ligger i `Dokumentasjon/Utvikling/ui/white-info-box-mock.svg`.
- Viser plassering av gul sirkel, grønn boks og fjernet «Estimerte verdier».
