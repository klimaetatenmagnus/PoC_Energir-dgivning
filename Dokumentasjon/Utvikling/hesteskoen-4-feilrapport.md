# Feilrapport: Hesteskoen 4L / 4M

## Bakgrunn
- Brukeropplevelse: Oppslag på `Hesteskoen 4L` og `Hesteskoen 4M` returnerer bruksareal **129 m²**, byggeår **1901** og kartposisjon som peker mot `Hesteskoen 6` – verdier som gjelder én enkelt enhet (bygg ID `288011907`).
- Samme tjeneste returnerer riktig samlet bruksareal **1473 m²**, byggeår **1960** og korrekt kartkoordinat for andre seksjoner i Hesteskoen 4 (f.eks. 4A / 4D).
- Oppførselen ble reprodusert ved å kjøre:
  ```bash
  LOG=1 DEBUG_BUILDING_INFO=1 node --import tsx \
    -e "import('./services/building-info-service/index.ts').then(async ({resolveBuildingData}) => { console.log(await resolveBuildingData(process.argv[1])); })" \
    "Hesteskoen 4M, Oslo"
  ```

## Funn

| Felt                        | Hesteskoen 4A (forventet)       | Hesteskoen 4L/4M (observasjon)             |
|----------------------------|---------------------------------|-------------------------------------------|
| Matrikkelenhets‑ID         | `284466768`                     | `284466671` *(tilhører annet byggfelt)*   |
| Bygg‑ID / bygningsnummer   | `287992697 / 81454280`          | `288011907 / 81479267`                    |
| Registrert byggeår         | `1960`                          | `1901`                                    |
| Bruksareal (csv fallback)  | `1473 m²` (fra `Matrikkel 2023.csv`) | `129 m²` (fra valgt bygg)                 |
| Koordinater WGS84          | `59.96196, 10.77519`            | `59.96217, 10.77580` (Hesteskoen 6)       |

### Årsakskjede
1. **Matrikkelenhet velges feil**  
   - I `services/building-info-service/matrikkel.ts:503‑580` søker vi først etter `hovedadresse=true` eller et seksjonsnummer som matcher bokstaven.  
   - Når begge mangler (tilfellet for bokstavene L/M), faller vi tilbake til å plukke **første matrikkelenhets‑ID som har et boligbygg**.  
   - For Hesteskoen 4 returnerer `findMatrikkelenheter` både den faktiske seksjonen (`284466768`) *og* flere tilgrensende matrikkelenheter (garasjer/småbygg). Fordi rekken ikke filtreres på husnummer/bokstav velges ID `284466671`, som er knyttet til småbygg for Hesteskoen 6.

2. **Byggvalg for seksjonert eiendom**  
   - Med feil matrikkelenhet får vi 17 bygg med blandet type (garasjer, boder, to boligseksjoner).  
   - Heuristikken på linje ~700 (“Kjelsåsveien-type: velg bygg med flere bruksenheter og areal ≥ 100 m²”) finner kun bygg `288011907` (to bruksenheter à 0 og 129 m²), og antar at dette representerer seksjonen.  
   - Dermed rapporteres byggeår 1901 og koordinater til dette bygget.

3. **Fravær av CSV-data for seksjonsbokstaver**  
   - `data/raw/Matrikkel 2023.csv` inneholder kun adressen “Hesteskoen 4A”; seksjoner som L/M mangler.  
   - I `resultAssembler.ts:106‑114` prioriteres CSV>Enova>Matrikkel, så 4L/4M ender opp med 129 m² fra byggdata i stedet for husrekke‑nivåets 1473 m².

## Anbefalte tiltak

1. **Strammere filtrering før matrikkelenhet velges**  
   - Når vi allerede henter `getObjectXml` per ID kan vi sammenlikne `<vegadresse><nummer>` og `<vegadresse><bokstav>` med søkeadresse (`husnummer=4`, `bokstav=L/M`).  
   - Kun IDer som matcher både nummer og bokstav bør få delta i fallbacken som velger “første med boligbygg”. Dette hindrer at garasje‑/naboeiendommer med samme GNR/BNR blir valgt.

2. **Bruk bruksenheter for å bekrefte riktig matrikkelenhet/bygg**  
   - Etter at vi har hentet `bruksenhetIds` kan vi sjekke om noen enheter har `leilighetnummer` eller `seksjonsnummer` som matcher adressens bokstav.  
   - Hvis ikke: fortsett til neste matrikkelenhets‑ID i listen. Dette gir en deterministisk måte å knytte bokstaver til riktig bygg og eliminerer heuristiske gjetninger.

3. **Fallback for bruksareal på seksjonerte adresser uten CSV-treff**  
   - Når `csvData` mangler men eiendommen er seksjonert, vurder å sette `finalBruksareal = totalBygningsareal` dersom vi har identifisert hovedbygget.  
   - Det gir konsistente tall mellom bokstaver (samme praksis som 4A) selv om CSV-uttrekket kun har en rad.

4. **(Valgfritt) Midlertidig “pinning”**  
   - Til feilen er rettet kan vi legge Hesteskoen 4 inn i en adressespesifikk override (f.eks. i `residential-building-cache` eller egen konfig) slik at oppslag alltid bruker `matrikkelenhetId=284466768` og bygg `287992697`.

## Neste steg
1. Implementer filtrering i matrikkelenhets-fallback (tiltak 1).  
2. Utvid bygg/bruksenhet-logikken slik at bokstav→seksjon alltid verifiseres mot faktiske bruksenheter (tiltak 2).  
3. Tester: legg inn regressjonstest i `scripts/test-seksjon-sammenligning.ts` eller lag en ny jest/TS test som kaller `resolveBuildingData` for Hesteskoen 4A vs 4L/4M og forventer samme matrikkelenhet/bygg‑ID.  
4. Eventuelt oppdater CSV eller innfør fallback (tiltak 3) for å sikre konsistente bruksareal i mellomtiden.

## Implementerte endringer i adresseoppslag

1. **Eksplisitt adressematching på matrikkelenhetsnivå**  
   - `services/building-info-service/matrikkel.ts` parser nå hvert `getObjectXml` én gang og trekker ut vegadresse, objekt‑type (`Seksjon`, `Grunneiendom`, osv.) og et `AddressMatchInfo`.  
   - Fallback‑rekkefølgen favoriserer IDer som både har korrekt husnummer og bokstav. For seksjonsoppslag ignoreres `Grunneiendom`/garasje‑IDer selv om de har `hovedadresse=true`.

2. **Bruksenhetsverifisering før vi velger matrikkelenhet/bygg**  
   - Hver kandidat analyseres med `analyzeMatrikkelenhet`: vi henter tilknyttede bygg og deres `bruksenhetIds`, og sjekker om minst én bruksenhet har seksjonsnummer/leilighetsbokstav som matcher forespørselen.  
   - Dersom ingen bruksenheter matcher, forkastes kandidaten og vi går videre til neste ID. Samme logikk brukes senere til å filtrere bygninger slik at vi kun vurderer bygg der vi faktisk finner en matchende seksjon.

3. **Gjenbruk av bruksenheter når byggdata berikes**  
   - Når et bygg først er valgt trenger vi ikke nye SOAP‑kall; vi gjenbruker bruksenhetene vi hentet under utvelgelsen. Dette reduserer støynivået i loggene og gir deterministisk resultat for alle seksjoner i rekken.

4. **Bedre bruksareal‑fallback for seksjonerte adresser**  
   - `services/building-info-service/resultAssembler.ts` bruker nå hovedbyggets totale bruksareal dersom CSV/Enova mangler rad for spesifikke bokstaver. Dermed får 4A = 4L = 4M = 1473 m² selv om CSV kun inneholder én rad.

5. **Ny regresjonstest**  
   - `scripts/test-hesteskoen-4.ts` henter data for 4A/4L/4M og feiler dersom matrikkelenhet, bygg, areal eller koordinater er inkonsistente. Kjøres med `node --import tsx scripts/test-hesteskoen-4.ts` (kræver nett mot Geonorge/Matrikkel).

## Testdekning og resultater

| Kommando | Hensikt | Resultat |
|----------|---------|----------|
| `node --import tsx scripts/test-hesteskoen-4.ts` | Sikrer at alle seksjoner i Hesteskoen 4 peker til samme bygg og areal | ✅ 4L/4M knyttes nå til riktige seksjons‑IDer og rapporterer 1473 m² |
| `npm run test:smoke` | Verifiserer at API‑serveren starter og eksponerer `/config/app.json` og `/metrics` | ✅ Server startet (LIVE‑moduser) og smoketesten fullførte |

## Status etter utbedring

| Felt                        | Hesteskoen 4A (baseline) | Hesteskoen 4L (nå) | Hesteskoen 4M (nå) |
|----------------------------|--------------------------|--------------------|--------------------|
| Matrikkelenhets‑ID         | `284466768`              | `284466778`        | `284466779`        |
| Bygg‑ID / bygningsnummer   | `287992697 / 81454280`   | `287992697 / 81454280` | `287992697 / 81454280` |
| Registrert byggeår         | `1960`                   | `1960`             | `1960`             |
| Bruksareal (endelig)       | `1473 m²`                | `1473 m²`          | `1473 m²`          |
| Koordinater WGS84          | `59.96196, 10.77519`     | `59.96196, 10.77519` | `59.96196, 10.77519` |

Hesteskoen 4L/4M får nå hver sin seksjons‑ID (Seksjon‑objekter) men deler matrikkelbygg og sluttrapporterte verdier med hovedseksjonen, slik forventet. All logikk er bakoverkompatibel for andre adresser; endringene slår kun inn når vi har seksjonsbokstav eller behov for fallback ved manglende CSV‑data.
