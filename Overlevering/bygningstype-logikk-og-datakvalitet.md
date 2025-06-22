# Bygningstype-logikk og datakvalitetsproblematikk

## Oversikt

Dette dokumentet beskriver den implementerte logikken for bygningstype-basert oppslag i building-info-service, samt datakvalitetsproblemer som ble oppdaget under utviklingen.

## Bygningstype-klassifisering (SSB Standard)

Systemet implementerer logikk basert på SSB sin standard for bygningstyper for å bestemme rapporteringsnivå:

### Boligtyper som prosesseres (1xx-koder):

**Seksjonsnivå-rapportering** (individuelle boliger):
- 11x: Eneboliger
- 12x: Tomannsboliger  
- 16x: Fritidsboliger
- 17x: Koier, seterhus

**Bygningsnivå-rapportering** (kollektive boliger):
- 13x: Rekkehus, kjedehus
- 14x: Store boligbygg

**Ekskluderes**:
- 15x: Bygning for bofellesskap
- 18x: Garasjer og uthus
- 19x: Andre boligbygninger
- 2xx+: Alle ikke-boligbygninger

## Implementerte filer

### `/src/utils/buildingTypeUtils.ts`
Inneholder hovedlogikken for bygningstype-klassifisering:
- `shouldProcessBuildingType()` - Sjekker om bygningstype skal prosesseres
- `shouldReportSectionLevel()` - Bestemmer om seksjonsnivå skal brukes
- `shouldReportBuildingLevel()` - Bestemmer om bygningsnivå skal brukes
- `determineBuildingTypeStrategy()` - Returnerer komplett strategi med beskrivelse

### `/services/building-info-service/index.ts`
Oppdatert med bygningstype-logikk:
- Linje 215-253: Filtrering og fallback-logikk
- Linje 254-285: Bygningsvalg basert på strategi
- Linje 266-271: **ENDRET** - Fra minste til største areal for å unngå tilbygg/garasjer

### `/src/clients/StoreClient.ts`
Utvidet med bygningstype-ekstrahering:
- Linje 148-151: `extractBygningstypeKodeId()` funksjon
- ByggInfo interface inkluderer `bygningstypeKodeId`

## Fallback-mekanisme

**Problem**: Matrikkel-data inneholder feilklassifiserte bygninger.

**Løsning**: Hvis ingen bygg klassifiseres som bolig, aksepterer systemet alle bygg som fallback.

```typescript
// Fallback: hvis ingen bygg klassifiseres som bolig, aksepter alle bygg
if (eligibleBuildings.length === 0) {
  console.log("⚠️  Ingen bygg klassifisert som bolig, aksepterer alle bygg som fallback");
  eligibleBuildings = allBygningsInfo;
}
```

## Datakvalitetsproblem: Kapellveien 156C

### Beskrivelse av problemet

**Eiendom**: 0301/73/704 (Kapellveien 156C, Oslo)

**Forventet bygningstype**: 121 (Tomannsbolig, vertikaldelt)
- Kilde: https://seeiendom.kartverket.no/eiendom/0301/73/704/0/2

**Faktisk bygningstype fra Matrikkel SOAP API**: 4 (Non-residential building)
- Kilde: getObject response fra StoreServiceWS

### Tekniske detaljer

**Matrikkelenhet ID**: 510390945  
**Bygg ID**: 286103541  
**Byggeår**: 1952  
**Bruksareal**: 279m²  

**SOAP Response viser**:
```xml
<ns10:bygningstypeKodeId><value>4</value></ns10:bygningstypeKodeId>
```

### Implikasjoner

1. **Datainkonsistens**: Forskjellige Kartverket-systemer viser forskjellig informasjon
2. **Fallback aktiveres**: Systemet bruker fallback-logikk for å fortsatt levere data
3. **Korrekt seksjonsspesifikk data**: Til tross for feilklassifisering leveres riktig data for seksjon C

### Sammenligning seksjon B vs C

| Parameter | Seksjon B | Seksjon C |
|-----------|-----------|-----------|
| Matrikkelenhet ID | 510390946 | 510390945 |
| Bygg ID | 286103642 | 286103541 |
| Bruksareal | 186m² | 279m² |
| Bygningstype | 4 | 4 |

**Konklusjon**: Systemet leverer korrekt seksjonsspesifikke data til tross for feilklassifisering.

## Anbefalinger for videre arbeid

### 1. Datakvalitet
- **Kontakt Kartverket** angående diskrepans mellom SOAP API og seeiendom.kartverket.no
- **Undersøk andre eiendommer** for å kartlegge omfanget av feilklassifiseringer
- **Vurder datakvalitetssjekker** som sammenligner med andre kilder

### 2. Monitorering
- **Legg til logging** som flagger når fallback-mekanismen aktiveres
- **Tell statistikk** over hvor ofte ulike bygningstyper forekommer
- **Overvåk** eiendommer som endrer bygningstype over tid

### 3. Robust håndtering
- **Vurder flere datakilder** hvis tilgjengelig
- **Implementer validering** basert på andre eiendomsattributter
- **Forbedre fallback-logikk** med mer sofistikerte heuristikker

## Testing

Kjør integrasjonstest:
```bash
npm run test:e2e:live
```

Testen validerer:
- Korrekt seksjonsspesifikk data for Kapellveien 156B og 156C
- Fallback-mekanisme for feilklassifiserte bygninger  
- Automatisk cleanup av SOAP dump-filer
- Ingen timeout-problemer

## Relaterte filer

- `/scripts/test-e2e-building.ts` - Integrasjonstest
- `/src/utils/soapDump.ts` - SOAP dump cleanup
- `/Dokumentasjon/bygningstype-standard.txt` - SSB bygningstype-standard
- `/.gitignore` - Ekskluderer SOAP dump-filer fra versjonskontroll

---

*Dokumentet oppdatert: 22. juni 2025*  
*Implementert av: Claude Code (AI-assistent)*