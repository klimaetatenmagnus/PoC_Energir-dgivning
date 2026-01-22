# Datakilder for energibesparelsespotensial i Oslo

> Utarbeidet: 22. januar 2026
> Formål: Kartlegge tilgjengelige datakilder for å berike Energinøkkelens beregninger med geografisk kontekst og sammenligningsgrunnlag.

---

## Sammendrag

Denne rapporten kartlegger datakilder som kan brukes til å:
1. Estimere TEK-periode når byggeår mangler
2. Sammenligne brukerens bolig med gjennomsnitt i Oslo/Norge
3. Beregne aggregert energibesparelsespotensial per bydel

**Hovedfunn:**
- Oslo kommune har et offentlig tilgjengelig ArcGIS-API med boligdata (type, BRA, bydel)
- SSB har detaljert statistikk over boliger fordelt på byggeår som kan mappes til TEK-perioder
- Enova tilbyr *ikke* geografisk nedbrutt statistikk offentlig, kun nasjonale tall
- For sammenligning må vi bruke nasjonale gjennomsnittstall fra SSB

---

## 1. Oslo kommune Boligdashboard

### Beskrivelse
Oslo kommune har et offentlig dashboard som viser boligstatistikk fordelt på boligtype og bruksareal per bydel.

**Dashboard-URL:** https://www.arcgis.com/apps/dashboards/2a2aa3dbcff14af3a3e115fcca519451

### API-tilgang

Dashboardet henter data fra en ArcGIS Feature Server som er offentlig tilgjengelig:

```
Base URL:
https://services-eu1.arcgis.com/Hky23fkHucfDZYMu/arcgis/rest/services/KPA_variert_boligstruktur/FeatureServer
```

**Tilgjengelige lag:**

| ID | Navn | Type | Beskrivelse |
|----|------|------|-------------|
| 0 | Boliger | Point | Individuelle boliger med attributter |
| 1 | Bydeler | Polygon | Bydelsgrenser (demografisk data) |
| 2 | Delbydeler | Polygon | Delbydelgrenser |
| 3 | Grunnkretser | Polygon | Statistiske grunnkretser |
| 4 | Skolekretser | Polygon | Skolekretser |

### Tilgjengelige felter i Boliger-laget (Layer 0)

| Felt | Type | Beskrivelse | Relevans for Energinøkkelen |
|------|------|-------------|----------------------------|
| `Bygningstype` | String | Blokkleilighet, Enebolig, Andre småhus, Annet | Direkte mapping til `boligtype` |
| `BRA` | Double | Bruksareal i m² | Direkte mapping til `bruksarealM2` |
| `BRA_leilighetsnorm` | String | Størrelseskategori (0-30, 30-50, etc.) | Validering/default-verdier |
| `BRA_20kvm_intervall` | String | Finere størrelseskategorier | Detaljert analyse |
| `Bydel` | String | Bydelsnavn | Geografisk kontekst |
| `Delbydel` | String | Delbydelsnavn | Mer presis lokalisering |
| `Grunnkrets` | String | Statistisk område | Fineste geografiske nivå |

### Eksempel på API-spørring

**Statistikk per boligtype for en bydel:**
```
GET https://services-eu1.arcgis.com/Hky23fkHucfDZYMu/arcgis/rest/services/KPA_variert_boligstruktur/FeatureServer/0/query?
  where=Bydel='Frogner'&
  outStatistics=[
    {"statisticType":"count","onStatisticField":"OBJECTID","outStatisticFieldName":"antall"},
    {"statisticType":"avg","onStatisticField":"BRA","outStatisticFieldName":"snitt_bra"}
  ]&
  groupByFieldsForStatistics=Bygningstype,BRA_leilighetsnorm&
  f=json
```

**Eksempel respons (Frogner):**
- Blokkleilighet: 28,663 enheter
- Enebolig: 816 enheter
- Andre småhus: 1,582 enheter
- Gjennomsnittlig BRA varierer fra ~24 m² (0-30 kategori) til ~231 m² (>160 kategori)

### Begrensninger

- **Ingen byggeår** - Kan ikke utlede TEK-periode direkte fra dette datasettet
- **Ingen energidata** - Må kombineres med andre kilder
- Data dekker kun Oslo kommune

---

## 2. SSB Boligstatistikk

### Beskrivelse
SSB har detaljert statistikk over boliger fordelt på bygningstype og byggeår per kommune. Dette er den beste kilden for å estimere TEK-fordeling.

**Kilde:** [SSB Tabell 06266](https://www.ssb.no/statbank/table/06266) - Boliger, etter bygningstype og byggeår

### API-tilgang

SSB tilbyr et JSON-stat API:

```
POST https://data.ssb.no/api/v0/no/table/06266
Content-Type: application/json

{
  "query": [
    {"code": "Region", "selection": {"filter": "item", "values": ["0301"]}},
    {"code": "BygnType", "selection": {"filter": "all", "values": ["*"]}},
    {"code": "BygnAr", "selection": {"filter": "all", "values": ["*"]}},
    {"code": "ContentsCode", "selection": {"filter": "item", "values": ["Boliger"]}},
    {"code": "Tid", "selection": {"filter": "item", "values": ["2024"]}}
  ],
  "response": {"format": "json-stat2"}
}
```

### Byggeår → TEK-mapping

| Byggeår (SSB) | TEK-periode | Beskrivelse |
|---------------|-------------|-------------|
| 1900 og tidligere | Eldre | Før moderne byggeforskrifter |
| 1901-1920 | Eldre | |
| 1921-1940 | Eldre | |
| 1941-1945 | TEK49 | Overgangsperiode |
| 1946-1960 | TEK49 | Første moderne forskrift |
| 1961-1970 | TEK69 | |
| 1971-1980 | TEK69 | |
| 1981-1990 | TEK87 | |
| 1991-2000 | TEK97 | |
| 2001-2010 | TEK07 | |
| 2011-2020 | TEK10 | |
| 2021 og etter | TEK17 | Gjeldende forskrift |

### Oslo-data (2024)

**Boliger fordelt på TEK-periode og boligtype:**

| TEK-periode | Småhus | Blokk | Annet | Totalt | Andel |
|-------------|--------|-------|-------|--------|-------|
| Eldre | 20,176 | 5,906 | 14,057 | 40,139 | 11.4% |
| TEK49 | 7,444 | 1,978 | 4,759 | 14,181 | 4.0% |
| TEK69 | 14,560 | 41,043 | 50,103 | 105,706 | 29.9% |
| TEK87 | 59,698 | 27,178 | 35,698 | 122,574 | 34.7% |
| TEK97 | 52,049 | 156 | 952 | 53,157 | 15.0% |
| TEK07 | 1,885 | 1,545 | 1,725 | 5,155 | 1.5% |
| TEK10 | 6,913 | 481 | 588 | 7,982 | 2.3% |
| TEK17 | 694 | 432 | 1,346 | 2,472 | 0.7% |
| **Totalt** | **164,766** | **78,967** | **109,523** | **353,256** | **100%** |

**Nøkkelfunn:**
- ~65% av Oslos boliger er fra TEK69/TEK87-perioden (høyest besparelsespotensial)
- Småhus: 46.6% av boligmassen
- Blokk: 22.4% av boligmassen

### Foreslått TEK-estimeringslogikk

Når byggeår ikke er kjent, kan vi bruke denne fordelingen som sannsynlighetsvekter:

```typescript
const OSLO_TEK_DISTRIBUTION = {
  småhus: {
    'Eldre': 0.122, 'TEK49': 0.045, 'TEK69': 0.088, 'TEK87': 0.362,
    'TEK97': 0.316, 'TEK07': 0.011, 'TEK10': 0.042, 'TEK17': 0.004
  },
  blokk: {
    'Eldre': 0.075, 'TEK49': 0.025, 'TEK69': 0.520, 'TEK87': 0.344,
    'TEK97': 0.002, 'TEK07': 0.020, 'TEK10': 0.006, 'TEK17': 0.005
  }
};
```

---

## 3. Enova Energimerkestatistikk

### Nåværende integrasjon

Energinøkkelen bruker allerede Enovas API for individuelle energiattester:

```
POST https://api.data.enova.no/ems/offentlige-data/v1/Energiattest
```

Dette returnerer energikarakter, oppvarmingskarakter, kWh/m², byggeår etc. for en spesifikk adresse.

### Aggregert statistikk

**Tilgjengelighet:** Enova har en [statistikkportal](https://portal.ems.enova.no/statistikk) med aggregerte tall, men:

- **Ingen geografisk nedbrytning** - Kun nasjonale tall er offentlig tilgjengelige
- **Ingen API for statistikk** - Portalen er kun visuell (JavaScript-basert)
- **Mulig utvidet tilgang** - Enova tilbyr mer detaljerte data for forskning og tredjeparter etter avtale

### Anbefaling

Kontakt Enova via [Enova Svarer](https://www.enova.no/om-enova/kontakt-oss/) for å forhøre seg om:
1. Om aggregert statistikk per fylke/kommune er tilgjengelig
2. Om det finnes et statistikk-endepunkt i API-et
3. Mulighet for forskningssamarbeid

---

## 4. Nasjonale gjennomsnittstall for sammenligning

### Energiforbruk per boligtype (SSB 2022)

Siden Oslo-spesifikke tall ikke er tilgjengelige, kan nasjonale gjennomsnitt brukes:

| Boligtype | Totalt kWh/m²/år | Strøm kWh/m²/år |
|-----------|------------------|-----------------|
| Enebolig | ~150 | ~129 |
| Rekkehus | ~149 | ~130 |
| Blokkleilighet | ~159 | ~134 |
| Våningshus | ~172 | ~130 |

**Kilde:** [SSB - Hva er gjennomsnittlig strømforbruk i husholdningene?](https://www.ssb.no/energi-og-industri/energi/artikler/hva-er-gjennomsnittlig-stromforbruk-i-husholdningene)

### Typisk årsforbruk etter størrelse

| Boligtype | Areal | Typisk forbruk |
|-----------|-------|----------------|
| Liten leilighet | ~50 m² | 5,000-8,000 kWh |
| Stor leilighet | ~100 m² | 10,000-12,000 kWh |
| Rekkehus | ~120 m² | 12,000-16,000 kWh |
| Enebolig | ~200 m² | 18,000-25,000 kWh |

### Foreslått sammenligningstekst

```
"Din bolig bruker estimert {X} kWh/m²/år.

Sammenlignet med gjennomsnittet for {leilighet/enebolig} i Norge:
• Nasjonalt snitt: {150-159} kWh/m²/år
• Din bolig: {X} kWh/m²/år
• Du bruker {Y}% {mer/mindre} enn gjennomsnittet"
```

---

## 5. Integrasjonsmuligheter

### 5.1 Bydels-kontekst ved adresseoppslag

Når bruker oppgir adresse, hent statistikk fra ArcGIS:

```typescript
async function getBydelContext(bydel: string) {
  const url = `https://services-eu1.arcgis.com/Hky23fkHucfDZYMu/arcgis/rest/services/KPA_variert_boligstruktur/FeatureServer/0/query?` +
    `where=Bydel='${encodeURIComponent(bydel)}'&` +
    `outStatistics=[{"statisticType":"count","onStatisticField":"OBJECTID","outStatisticFieldName":"antall"}]&` +
    `groupByFieldsForStatistics=Bygningstype&f=json`;

  const res = await fetch(url);
  return res.json();
}
```

### 5.2 Smart BRA-default

Hvis bruker ikke oppgir BRA, bruk gjennomsnitt for bydel/boligtype:

```typescript
async function getDefaultBRA(bydel: string, boligtype: string) {
  // Hent fra ArcGIS API
  // Returner f.eks. 65 m² for blokk i Frogner
}
```

### 5.3 TEK-estimering uten byggeår

Bruk SSB-basert sannsynlighetsfordeling:

```typescript
function getMostLikelyTek(boligtype: 'småhus' | 'blokk'): TEKPeriod {
  // For blokk i Oslo: TEK69 (52% sannsynlighet)
  // For småhus i Oslo: TEK87 (36% sannsynlighet)
}
```

### 5.4 Aggregert energipotensial per bydel

Kombiner alle datakildene for å beregne totalt besparelsespotensial:

```typescript
interface BydelEnergySummary {
  bydel: string;
  totalBoliger: number;
  boligtypefordeling: { blokk: number; småhus: number };
  estimertTekFordeling: Record<TEKPeriod, number>;
  totalBesparelsespotensial: number; // kWh/år
}
```

---

## 6. Oppsummering og anbefalinger

### Tilgjengelige datakilder

| Kilde | Data | Geografisk nivå | API |
|-------|------|-----------------|-----|
| Oslo Boligdashboard | Boligtype, BRA | Bydel/Grunnkrets | Ja (ArcGIS) |
| SSB Tabell 06266 | Byggeår/TEK | Kommune | Ja (JSON-stat) |
| Enova Energiattest | Energikarakter, kWh | Adresse | Ja (eksisterende) |
| Enova Statistikk | Aggregerte tall | Kun nasjonalt | Nei |
| SSB Energibruk | kWh/m² snitt | Kun nasjonalt | Nei |

### Anbefalte neste steg

1. **Kort sikt:** Implementer sammenligning mot nasjonale SSB-gjennomsnitt
2. **Mellom sikt:** Integrer ArcGIS-data for bydels-kontekst og smartere defaults
3. **Lang sikt:** Kontakt Enova om tilgang til geografisk nedbrutt statistikk
4. **Alternativ:** Bygg egen statistikk ved å logge/aggregere data fra eksisterende Enova-oppslag

### Begrensninger å være klar over

- Ingen offentlig Oslo-spesifikk energimerkestatistikk
- SSB-data har ingen energiinformasjon, kun byggeår
- ArcGIS-data har ingen byggeår eller energiinformasjon
- Kombinasjonen av kildene gir estimater, ikke eksakte tall

---

## Vedlegg: API-eksempler

### A. SSB API - Hent Oslo boligdata

```bash
curl -X POST "https://data.ssb.no/api/v0/no/table/06266" \
  -H "Content-Type: application/json" \
  -d '{
    "query": [
      {"code": "Region", "selection": {"filter": "item", "values": ["0301"]}},
      {"code": "BygnType", "selection": {"filter": "all", "values": ["*"]}},
      {"code": "BygnAr", "selection": {"filter": "all", "values": ["*"]}},
      {"code": "ContentsCode", "selection": {"filter": "item", "values": ["Boliger"]}},
      {"code": "Tid", "selection": {"filter": "item", "values": ["2024"]}}
    ],
    "response": {"format": "json-stat2"}
  }'
```

### B. ArcGIS API - Hent bydelsstatistikk

```bash
curl "https://services-eu1.arcgis.com/Hky23fkHucfDZYMu/arcgis/rest/services/KPA_variert_boligstruktur/FeatureServer/0/query?where=1=1&outStatistics=%5B%7B%22statisticType%22%3A%22count%22%2C%22onStatisticField%22%3A%22OBJECTID%22%2C%22outStatisticFieldName%22%3A%22total%22%7D%5D&groupByFieldsForStatistics=Bydel%2CBygningstype&f=json"
```

---

*Rapport generert som del av utforskning av integrasjonsmuligheter mellom Energinøkkelen og Oslo kommunes boligdata.*
