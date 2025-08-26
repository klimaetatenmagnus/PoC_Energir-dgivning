# Overleveringsrapport - FigmaBlokk Systemet

# Systemintroduksjon

FigmaBlokk er et webbasert system utviklet for Oslo kommune som gir energirådgivning til boligeiere. Systemet henter bygningsdata fra ulike kilder og presenterer skreddersydde energitiltak basert på bygningstype, byggeår og vernestatus.

# Datakilder

CSV fil "Matrikkel 2023.cvs
- Henter BRA, bygningstype og byggeår

Data fra "Erfaringspriser Obos Prosjekt AS (versjon 1).xlsb
- Lagret som en dictionary - brukes til å beregne besparelse for tiltak basert på TEK og byggtype (småhus/blokk)

Energikarakter grenser fra Enova
- Forenklet versjon basert på levert strøm og BRA

APIer (mer detaljert under Dataflyt) henter informasjon om:
* Enova energiattest
* Vernestatus (Gul liste) 
* Solpotensial


# Dataflyt

1. **Adressesøk**:
  Fra brukerinput brukes Geonorge API til å komme med adresseforslag, og formatterer adressen riktig til videre bruk

2. **Bygningsoppslag**:
Fra adressen som input kjøres API/CVS i bakgrunnen og henter informasjon:

    DATAKILDE               INPUT             OUTPUT
  Geonorge                Adresse      →   GNR/BNR + koordinater
  CVS / Matrikkel API     GNR/BNR      →   bygningsdata  
  Enova API               GNR/BNR      →   energiattest + strømforbruk
  Gul Liste sjekk         GNR/BNR      →   teigid → Gul liste status
  Solar service           koordinater  →   solpotensial


# UI struktur
Hovedstrukturen er lik for alle og endres automatisk. Forskjellen er animasjon for bygningstype, om tiltakskort vises som gulliste eller ikke (ligger som seperate filer), og en if statement i disse som viser korrekt avsnitt basert på bygningstype

# Variabler
* Gul liste
En Gul liste variabel "showYellowBox" er True eller False ut ifra om bygget er på Gul liste eller ikke
Hvis gullistet så vises en gul infoboks i den hvite infoboksen til venstre på hovedsiden, og egne tiltak for gullistete bygg.

* Bygningstype
Fra APIen får man en kode som tilsvarer mange forskjellige byggtyper (enebolig, fritidsbolig, koie osv). Disse skal kategoriseres til en av 3: Småhus / Blokk / Flermannsbolig

Ut ifra bygningstype vises det forskjellig tekst på tiltakskortene, og forskjellige tall blir brukt for besparelsen fra hvert av tiltakene. I tillegg vises egen animasjon for hver boligtype. (funksjon for flermannsbolig er foreløpig ikke implementert)

# Beregninger
* Solenergi
- Filtrerer bort takflater fra apien med innstrålig mindre enn 800kWh/m^2
- Regner ut total årlig innstrålig fra gjenværende flater: summen av (innstrålig takflate * takflate areal)
- Ganger total årlig innstrålig med en virkningsgrad satt til 20%

* TEK
Regnes ut ifra byggeåret med lag/forsinkelse på 2 år  slik at 
- Eldre (før 1951)
- TEK49 (1951-1970)
- TEK69 (1971-1988)
- TEK87 (1989-1998)
- TEK97 (1999-2008)
- TEK7 (2009+)

Dette brukes foreløpig i alle energispareberegninger utenom solenergi
Her blir det gjort en grov antakelse om at ingen tiltak allerede har blitt gjort, noe som sannsynligvis ikke stemmer

* Besparelse
Besparelsen for tiltakene implementert er ut ifra data fra Erfaringspriser OBOS basert på TEK, bygningstype og BRA

* Energikarakter
- Estimert energikarakter regnes ut ifra grenseverdier fra enova med utgangspunkt i levert energi pr BRA. Grenseverdiene varierer for blokk og småhus
- Ny energikarakter er basert på nytt strømforbruk etter tiltak er gjort: orginalt strømforbruk - Besparelse for tiltak (kWh), med samme karaktergrenseverdier som tidligere





Mer teknisk:
# Filstruktur

#### Frontend (React/TypeScript)

```
src/
├── components/
│   ├── FigmaMainScript.tsx         # Hovedkomponent
│   ├── FigmaBlokk/
│   │   ├── animations.ts           # Animasjonsfunksjoner
│   │   ├── constants.ts            # Energiløsninger, konstanter
│   │   ├── styles.ts               # Stilfunksjoner
│   │   ├── hooks/                  # Custom React hooks
│   │   ├── utils/                  # Beregningsfunksjoner
│   │   └── components/
│   │       ├── EnergySolutionButtons.tsx  # Tiltakslisten på hovedsiden
│   │       ├── WhiteInfoBox.tsx           # Hvit infoboks til venstre på hovedsiden
│   │       ├── ProsessenVidere/    # Prossen Videre siden
│   │       └── Tiltak/             # Energitiltakskort
│   │           ├── Varmepumpe.tsx
│   │           ├── Solenergi.tsx
│   │           ├── Tetting.tsx
│   │           └── GulListeTiltak/ # Gul liste-varianter av tiltakskortene
│   ├── AddressSearch.tsx           # Adressesøk
│   ├── GulListeStatus.tsx          # Gul liste status
│   └── EnergyRatingEstimator.tsx   # Estimert Enerikarakter beregning
├── services/
│   ├── buildingApi.ts              # Frontend API-klient
│   ├── gul-liste-service.ts        # Gul liste integrasjon
│   ├── csvService.ts               # CSV-håndtering
│   └── solarEnergyService.ts       # Solenergi-beregninger
└── utils/
    ├── buildingTypeUtils.ts        # Bygningstype-logikk
    ├── bygningstypeMapping.ts      # Type-mapping
    └── endpoints.ts                # API-endepunkter
```

#### Backend (Node.js)

```
services/
├── building-info-service/
│   └── index.ts                    # Hovedtjeneste for bygningsdata
├── solar-service/
│   └── index.js                    # Solenergi-tjeneste
└── subsidy-service/
    └── index.js                    # Støtteordninger
```

### Viktige konfigurasjoner

**Frontend (Vite)**:
- `vite.config.ts` - Build og dev-server konfigurasjon
- `tsconfig.json` - TypeScript innstillinger
- `tailwind.config.js` - Tailwind CSS

**Backend**:
- `package.json` - Dependencies og scripts
- Hver service har egen port (3001, 3002, 3003)

### Caching

- **Building-info-service**: 24 timer cache (NodeCache)
- **Solar-service**: 1 time cache
- **Frontend**: Ingen persistent cache



Kjekt å vite

# Kjøring av systemet
  ./start-ui-only.sh kjøres i terminalen
  
# Lagring til github
  git add .
  git commit -m "kort beskrivelse"
  git push

# Tips for bruk av claude
* Del opp i mindre oppgaver
* Vær spesifikk på relevant plassering/navn på komponent/kode - gjør prosessen kjappere
* Vær tydelig på ønsket kode struktur (lag ny fil - plasser i mappe) - gjør prosessen kjappere, og koden mer   
  oversiktelig
* Ctrl Shift C på nettsiden kan gi kode for en spesifikk komponent - har noen ganger matet den til claude
* Claude sliter med å lage animasjoner, anbefaler på det sterkeste å lagre før en jobber med det

# Generelle kommentarer
* Anbefaler å plassere alt i skalerbare containere som justeres ut ifra brukerens skjermstørrelse. Alt utenom
  Adressesøk-siden og blokk figur/animasjonen er implementert på denne måten.
* Prøvde MCP for å koble figma til claude. Dette fungerte dårlig ettersom token grenser ble for fort nådd. Enklere
  å bare kopiere inn SVG kode for ikoner eller forklare plassering/typografi ut ifra Figma layout

# Delbar nettside
Har sett litt på muligheten for å dele nettside. APIene kjøres lokalt på PCen som er et hinder. Har lagd inn lagret data for 3 adresser (slik at du ikke trenger api) som kommer opp ved å skrive 1,2 eller 3 i adressesøkfeltet. Dette er forklart i TEST_MODE_README.md Da kan nettsiden bli delt via IP f.eks lokalt over samme nettverk. Prøvde også kjapt ngrok, uten å få det til.


Askeladden passord; hymPTB:YDyHuw4r