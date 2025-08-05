# Overleveringsrapport - FigmaBlokk Systemet

## Innholdsfortegnelse
1. [Systemintroduksjon](#systemintroduksjon)
2. [Datakilder](#datakilder)
3. [Variabler og utregninger](#variabler-og-utregninger)
4. [Utviklingsmiljø og konfigurasjon](#utviklingsmiljø-og-konfigurasjon)

## Systemintroduksjon

FigmaBlokk er et webbasert system utviklet for Oslo kommune som gir energirådgivning til boligeiere. Systemet henter bygningsdata fra ulike kilder og presenterer skreddersydde energitiltak basert på bygningstype, byggeår og vernestatus.

## Datakilder

### 1. CSV-filer

#### Matrikkel 2023.csv
- **Innhold**: Historisk bygningsdata fra matrikkelen
- **Brukes av**: `CSVService` for å hente ut BRA, bygningstype og byggeår


### 2. Eksterne APIer

#### Matrikkel API  (alternativ til cvs)
- **Tjenester**:
  - `StoreService` - Generell bygningsinfo
  - `BygningService` - Detaljert bygningsdata
  - `MatrikkelenhetService` - Matrikkelenheter
  - `BruksenhetService` - Bruksenheter

#### Geonorge Adresse API
  - `/sok` - Adressesøk med autocomplete
  - `/adresser/{adressekode}` - Detaljert adresseinfo
- **Brukes for**: Adresse → GNR/BNR/SNR konvertering + Koordinater (til sol APIen)

#### Oslo Kommune - Gul Liste API
- **Tjenester**:
  - `WFS_SOK` - Finn teigid fra GNR/BNR
  - `EIENDOM_TABELL` - Sjekk gul liste status fra teigid
- **Data**: Bevaringsverdige bygninger i Oslo

#### PBE Solkart 2024 API
- **Tjeneste**: Beregner solinnstråling på takflater
- **Input parametere**:
  - `lat/lon` - Koordinater

#### Enova Energiattest API
- **Data**: Energikarakter, årlig energiforbruk

### 3. Data fra "Erfaringspriser Obos Prosjekt AS (versjon 1).xlsb
- **Tjeneste**: Beregner besparelse for tiltak basert på TEK og byggtype (småhus/blokk)
- **Data**: Lagret som en dictionary



### Dataflyt

1. **Adressesøk**:
  Brukerinput → Geonorge API → Adresseforslag med automatisk formatering

2. **Bygningsoppslag**:
Fra adressen kjøres API/CVS som backend service:

  Geonorge              (Adresse → GNR/BNR + koordinater)
  CVS / Matrikkel API   (GNR/BNR → bygningsdata)   
  Enova API             (GNR/BNR → energiattest)
  Gul Liste sjekk       (GNR/BNR → teigid → gul liste status)
  Solar service         (koordinater → solpotensial)



### Caching

- **Building-info-service**: 24 timer cache (NodeCache)
- **Solar-service**: 1 time cache
- **Frontend**: Ingen persistent cache

## Variabler og utregninger

### 1. Gul Liste (Bevaringsverdige bygninger)

**Deteksjon**:
- Automatisk sjekk ved oppstart via GNR/BNR
- Krever at bygningen er i Oslo kommune
- Resultat lagres i `showYellowBox` state

**Endringer for gul liste bygninger**:
- **Visuelt**: Gul infoboks (#FFE7BC) med vernestatus
- **Tiltak**: Spesialtilpassede varianter for:
  - Solenergi (SolenergiGul)
  - Tetting (TettingGul)
  - Vindusutskiftning (UtskiftningAvVinduGul)
- **Informasjon**: Ekstra veiledning om kulturminnehensyn

### 2. Bygningstype

**Kategorisering**:
- **Individuelle boliger** (seksjonsnivå):
  - 11x: Eneboliger
  - 12x: Tomannsboliger
  - 16x: Fritidsboliger
  - 17x: Koier, seterhus

- **Kollektive boliger** (bygningsnivå):
  - 13x: Rekkehus, kjedehus
  - 14x: Store boligbygg

**Visuelle forskjeller**:
- **Enebolig**: Animert hus fra Oslo skyline
- **Blokk**: Animert boligblokk med zoom-effekt

**Beregningsforskjeller**:
- Ulike energiforbruksterskler for småhus vs blokk for estimert energikarakter
- Påvirker sparepotensialet for tiltak

### 3. TEK-standard (byggeår)
  Regnes ut ifra byggeåret med innlag 2 års forsinkelse
**Klassifisering**:
- Eldre (før 1951)
- TEK49 (1951-1970)
- TEK69 (1971-1988)
- TEK87 (1989-1998)
- TEK97 (1999-2008)
- TEK7 (2009+)

**Påvirkning**:
- Brukes i alle energispareberegninger
- Eldre bygg har generelt høyere sparepotensial - men antar at ingen tiltak allerede har blitt gjort

### 4. Energitiltak

**Standard tiltak (alltid 8 stk)**:
1. Varmepumpe
2. Solenergi
3. Tetting
4. Temperaturstyring
5. Utskiftning av vindu
6. Isolering av kjeller og loft
7. Etterisolering av yttervegg
8. Ventilasjon

**Beregningsgrunnlag** (tar utgangspunkt i Erfaringspris verdiene):
- Bygningstype (småhus/blokk)
- TEK-standard
- Bruksareal

- Solenergi (fra api)
  * Takflater med innstrålig mindre enn 800kWh/m^2 blir filtrert bort
  * Regner ut total årlig innstrålig fra gjenværende flater (innstrrålig * takflate areal)
  * Ganger total årlig innstrålig med en virkningsgrad (20%)

### 5. Energikarakter beregninger
- Estimert energikarakter regnes ut ifra grenseverdier med utgangspunkt i levert energi pr BRA. Disse varierer for blokk og småhus
- Ny energikarakter regner ut besparelse for tiltak som er huket av (kWh), og regner ut en ny karakter for det nye strømforbruket (orginalt strømforbruk - besparelse fra tiltak) ut ifra samme grenseverdier for karakterene.

## Utviklingsmiljø og konfigurasjon

### Filstruktur

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

### Kjøring av systemet
  ./start-ui-only.sh kjøres i terminalen
  
### Lagring til github
  git add .
  git commit -m "kort beskrivelse"
  git push