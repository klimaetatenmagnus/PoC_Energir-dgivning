# Rapport: Adresseoppslag i Matrikkel-systemet

## Oversikt
Dette dokumentet beskriver hvordan adresseoppslag fungerer i test-e2e-buildings.ts, inkludert arkitektur, dataflyt og identifiserte problemer som må løses.

**Sist oppdatert:** 2025-06-23 (v3.0)  
**Viktige endringer:** Lagt til seksjonsnummer-håndtering, bygningsnummer for Enova-oppslag, forbedret matrikkelenhet-valg

## 1. Arkitektur og dataflyt

### 1.1 Overordnet flyt
Systemet følger denne kjeden for å hente bygningsdata basert på en tekstadresse:

```
Tekstadresse → Geonorge (koordinater) → Matrikkelenhet (m/seksjon) → Bygg-ID → Bygningsdata → Energiattest
```

### 1.2 Involverte komponenter

#### Klienter:
1. **Geonorge REST API** - Adressesøk
2. **MatrikkelClient** - Håndterer matrikkelenhets-oppslag
3. **BygningClient** - Finner bygg tilknyttet matrikkelenheter
4. **StoreClient** - Henter detaljert bygningsinformasjon

#### Hjelpemoduler:
1. **buildingTypeUtils.ts** - Klassifiserer bygningstyper
2. **bygningstypeMapping.ts** - Mapper interne ID-er til standard koder

### 1.3 Detaljert dataflyt

#### Steg 1: Adressesøk (Geonorge)
```typescript
// Fra adresse til koordinater og matrikkeldata
const adr = await lookupAdresse("Kapellveien 156C, 0493 Oslo");
// Returnerer: { kommunenummer, gnr, bnr, adressekode, husnummer, bokstav }
```

#### Steg 2: Finn matrikkelenhet
```typescript
// Bruker MatrikkelClient for å finne matrikkelenhets-ID
const ids = await matrikkelClient.findMatrikkelenheter({
  kommunenummer: adr.kommunenummer,
  gnr: adr.gnr,
  bnr: adr.bnr,
  adressekode: adr.adressekode,
  husnummer: adr.husnummer,
  bokstav: adr.bokstav
}, ctx());
```

**Oppdatert logikk for valg av matrikkelenhet:**
1. Prioriterer matrikkelenhet med `<hovedadresse>true</hovedadresse>`
2. Hvis ingen hovedadresse, velger matrikkelenhet som har boligbygg
3. Henter seksjonsnummer fra valgt matrikkelenhet (`<seksjonsnummer>`)
4. Siste fallback: første matrikkelenhet i listen

#### Steg 3: Finn bygg-ID-er
```typescript
// Bruker BygningClient for å finne alle bygg på matrikkelenheten
const byggIdListe = await bygningClient.findByggForMatrikkelenhet(
  matrikkelenhetsId,
  ctx()
);
```

#### Steg 4: Hent bygningsdata
```typescript
// Bruker StoreClient for hver bygg-ID
for (const id of byggIdListe) {
  const byggInfo = await storeClient.getObject(id);
  // Returnerer: { id, byggeaar, bruksarealM2, representasjonspunkt, 
  //              bygningstypeKodeId, bygningstypeKode, bygningstypeBeskrivelse,
  //              bygningsnummer }  // NY: Unikt ID for bygget
}
```

#### Steg 5: Bygningstype-mapping
Matrikkelen returnerer interne ID-er (f.eks. 4, 8, 13) som må mappes til standard 3-sifrede koder:
- ID 4 → 121 (Tomannsbolig, vertikaldelt)
- ID 8 → 131 (Rekkehus)
- ID 13 → 142 (Store frittliggende boligbygg)

#### Steg 6: Velg riktig bygg
Systemet filtrerer og velger bygg basert på:
1. Bygningstype (kun boligbygg prosesseres)
2. Rapporteringsnivå (seksjon vs. bygning)
3. Størst bruksareal (for å unngå tilbygg/garasjer)

#### Steg 7: Hent energiattest (valgfri)
```typescript
// Bruker Enova API med seksjonsnummer og bygningsnummer
const attest = await fetchEnergiattest({
  kommunenummer: adr.kommunenummer,
  gnr: adr.gnr,
  bnr: adr.bnr,
  seksjonsnummer: seksjonsnummer,      // Fra matrikkelenhet
  bygningsnummer: bygg.bygningsnummer, // Fra bygningsdata
});
```

**Enova API-parametere:**
- Påkrevd: kommunenummer, gårdsnummer, bruksnummer
- Valgfri: seksjonsnummer, bygningsnummer, bruksenhetsnummer
- Returnerer: Array med energiattester (tar første match)

## 2. Relevant dokumentasjon

### 2.1 API-dokumentasjon
| Fil | Beskrivelse |
|-----|-------------|
| **matrikkelAPI.txt** | Hovedguide for Matrikkel-API. Inneholder boblemodell-konseptet, historikk-håndtering, tekniske detaljer om MatrikkelContext, og beskrivelse av alle tjenester |
| **Brukerstøtte1.txt** | Grunnleggende informasjon om Matrikkel-systemet og tilgang |

### 2.2 WSDL/XSD-filer (SOAP-kontrakter)
| Fil | Beskrivelse |
|-----|-------------|
| **BygningServiceWS.wsdl** | SOAP-definisjon for BygningService. Definerer operasjoner som `findByggForMatrikkelenhet` og `findAlleBygningstypeKoder` |
| **AdresseServiceWS.wsdl** | SOAP-definisjon for AdresseService. Brukes for adresse-relaterte oppslag |
| **StoreServiceWS.wsdl** | SOAP-definisjon for StoreService. Kritisk for `getObject`-kall som henter bygningsdata |
| **BygningServiceWS_schema1.xsd** | XML-skjema for bygningsdata-strukturer |
| **AdresseServiceWS_schema1.xsd** | XML-skjema for adressedata-strukturer |
| **StoreServiceWS_schema1.xsd** | XML-skjema for Store-service datatyper |
| **adresseService.xsd** | Tilleggsskjema for adressetjenester |

### 2.3 Brukerstøtte-dokumenter (RTF)
Lokasjon: `/Dokumentasjon/Salgsoppgaver/`

| Fil | Innhold |
|-----|---------|
| **Brukerstøtte matrikkel API 1.rtf** | Introduksjon til Matrikkel-API og grunnleggende konsepter |
| **Brukerstøtte matrikkel API 2.rtf** | Detaljert gjennomgang av tjenester og metoder |
| **Brukerstøtte matrikkel API 3.rtf** | Eksempler på bruk og vanlige problemstillinger |
| **Brukerstøtte matrikkel API 4.rtf** | Feilsøking og ytelsesoptimalisering |
| **Brukerstøtte matrikkel API 5.rtf** | Avanserte emner og spesialtilfeller |

### 2.4 Standarder og referanser
| Fil | Beskrivelse |
|-----|-------------|
| **bygningstype-standard.txt** | Komplett liste over bygningstype-koder fra SSB. Kritisk referanse for å forstå 3-sifrede koder (111-199) |

### 2.5 Eksempeldata
Lokasjon: `/Dokumentasjon/Salgsoppgaver/`

Inneholder faktiske oppslag for:
- Frysjaveien 42 H, 0884 Oslo
- Hesteskoen 10 A, 0493 Oslo  
- Kjelsåsveien 139, 0491 Oslo

Hver adresse har:
- `.txt` - Rå data fra oppslag
- `_converted.txt` - Konvertert/prosessert versjon

### 2.6 Viktige referanser i dokumentasjonen

#### Fra matrikkelAPI.txt:
- **Kapittel 2**: Boblemodellen - forklarer ID-basert navigasjon
- **Kapittel 4**: MatrikkelContext - påkrevd for alle API-kall
- **Kapittel 5**: StoreService - hvordan hente objekter via ID

#### Fra bygningstype-standard.txt:
- **Koder 111-119**: Eneboliger
- **Koder 121-124**: Tomannsboliger  
- **Koder 131-136**: Rekkehus/kjedehus
- **Koder 141-146**: Store boligbygg

### 2.7 Debugging-tips fra dokumentasjonen

Fra matrikkelAPI.txt:
```xml
<!-- Korrekt snapshotVersion for sanntidsdata -->
<dom:snapshotVersion>
  <dom:timestamp>9999-01-01T00:00:00+01:00</dom:timestamp>
</dom:snapshotVersion>
```

## 3. Utført testing og løste problemer (2025-06-23)

### 3.1 Nye implementerte forbedringer (v3.0)

#### Forbedring 1: Intelligent matrikkelenhet-valg ✅ IMPLEMENTERT
**Problem:** For adresser med flere matrikkelenheter (som Kjelsåsveien 97B) ble feil enhet valgt, som førte til "ingen bygg funnet".

**Løsning:** Oppdatert logikk i `resolveBuildingData` (linje 198-283):
```typescript
// Prioritert rekkefølge:
1. Matrikkelenhet med hovedadresse=true
2. Matrikkelenhet som har boligbygg (sjekker bygningstype)
3. Matrikkelenhet som har bygg (uansett type)
4. Første matrikkelenhet (fallback)
```

#### Forbedring 2: Seksjonsnummer-håndtering ✅ IMPLEMENTERT
**Problem:** Seksjonerte eiendommer (som Kjelsåsveien 97B seksjon 2) ble ikke håndtert korrekt.

**Løsning:** 
- Henter `<seksjonsnummer>` fra matrikkelenhet XML
- Bruker seksjonsnummer i Enova API-kall
- Returnerer seksjonsnummer i resultat-objektet

#### Forbedring 3: Bygningsnummer for Enova ✅ IMPLEMENTERT
**Problem:** Enova-oppslag kunne gi for mange treff uten bygningsnummer.

**Løsning:**
- Lagt til `extractBygningsnummer()` i StoreClient (linje 194-211)
- Henter `<bygningsnummer>` fra bygg XML (f.eks. "80184506")
- Sender bygningsnummer til Enova API for mer presise treff

#### Forbedring 4: Forbedret adressehåndtering ✅ IMPLEMENTERT
**Problem:** Adresser med mellomrom mellom husnummer og bokstav (f.eks. "97 B") feilet.

**Løsning:** Utvidet `lookupAdresse()` til å teste 5 varianter:
```typescript
1. Original streng
2. Komma → mellomrom
3. Komma → mellomrom + legg til mellomrom (97B → 97 B)
4. Komma → mellomrom + fjern mellomrom (97 B → 97B)
5. Behold komma men fjern mellomrom (97 B → 97B)
```

### 3.2 Løste problemer

#### Problem 1: Bruksareal = 0 ✅ LØST
**Årsak:** Mange bygninger i Matrikkelen har `ufullstendigAreal=true` og mangler bruksareal i standard felt.

**Løsning:** Oppdatert `StoreClient.extractBruksareal()` til å sjekke `alternativtArealBygning` i `kommunalTilleggsdel`:
```typescript
// src/clients/StoreClient.ts linje 224-231
const kommunalDel = find(tree, "kommunalTilleggsdel");
if (kommunalDel) {
  const altAreal = extractNumber(kommunalDel, "alternativtArealBygning");
  if (Number.isFinite(altAreal) && altAreal! > 0) {
    console.log(`✅ Bruker alternativtArealBygning: ${altAreal} m²`);
    return altAreal;
  }
}
```

#### Problem 2: XML-parsing for matrikkelenhets-ID ✅ LØST
**Årsak:** MatrikkelClient feilet i parsing av XML-respons med namespace `ns3:item`.

**Løsning:** Lagt til regex-basert parsing som fallback:
```typescript
// src/clients/MatrikkelClient.ts linje 260-264
const matches = [...xml.matchAll(/<ns3:item><value>(\d+)<\/value><\/ns3:item>/g)];
if (matches.length > 0) {
  return matches.map(m => Number(m[1])).filter(n => n > 0);
}
```

#### Problem 3: Bygningstype-mapping ✅ LØST
**Årsak:** Intern ID 127 var feilmappet til 121 (tomannsbolig) i stedet for 142 (boligblokk).

**Løsning:** Oppdatert mapping i både `bygningstypeMapping.ts` og `buildingTypeUtils.ts`:
```typescript
map.set(127, { id: 127, kodeverdi: "142", beskrivelse: "Store frittliggende boligbygg på 3 og 4 etasjer" });
```

#### Problem 4: Valg av feil bygg (små tilbygg) ✅ LØST
**Årsak:** Algoritmen valgte bygg med bare 4 m² for Fallanveien 29.

**Løsning:** Lagt til minimumsareal-filter:
```typescript
// services/building-info-service/index.ts linje 236-239
const MIN_AREA_THRESHOLD = 20; // m²
eligibleBuildings = eligibleBuildings.filter(bygg => 
  (bygg.bruksarealM2 ?? 0) >= MIN_AREA_THRESHOLD
);
```

#### Problem 5: SOAP-dump opphopning ✅ LØST
**Årsak:** Over 2000 filer akkumulert i `/soap-dumps/`.

**Løsning:** Implementert automatisk opprydding som beholder kun 25 nyeste filer:
```typescript
// src/utils/soapDump.ts - kjører automatisk etter hver dump
await cleanupOldDumps(); // Sletter gamle filer over 25
```

### 3.3 Verifiserte resultater

#### Tomannsbolig-test (Kapellveien 156)
| Seksjon | Matrikkelenhets-ID | Bygnings-ID | Bruksareal | Byggeår | Koordinater |
|---------|-------------------|-------------|------------|---------|-------------|
| **156C** | 510390945 | 286103541 | 279 m² | 1952 | 599417, 6648465 |
| **156B** | 510390946 | 286103642 | 186 m² | 1952 | 599422, 6648459 |

✅ **Konklusjon:** Seksjonshåndtering fungerer korrekt - hver seksjon får egen data.

## 4. Fremtidig utvikling: Borettslag og sameier

### 4.1 Nåværende begrensninger
- **Fallanveien 29**: Borettslag med org.nr 948152436
- **Hesteskoen 12K**: Del av sameie
- **Problem**: Uten grunnbokstilgang kan vi ikke identifisere eierform

### 4.2 Foreslått løsning (krever grunnbokstilgang)

```typescript
// TODO i services/building-info-service/index.ts linje 163-168
// Når grunnbokstilgang er på plass:
// 1. Sjekk om adressen tilhører et borettslag
// 2. Hvis borettslag: Hent alle boligbygg for gnr/bnr
// 3. Hvis ikke: Fortsett med dagens logikk (enkeltbygg/seksjon)
```

### 4.3 Implementeringsplan for borettslag

1. **Identifisere borettslag**
   - Integrer med Grunnboken eller Brønnøysundregistrene
   - Søk på matrikkelenhet for å finne eierform/org.nr

2. **Hente alle bygg for borettslag**
   ```typescript
   // Pseudokode for fremtidig implementering
   if (await isBorettslag(matrikkelenhetsId)) {
     const alleMatrikkelenheter = await matrikkelClient.findMatrikkelenheter({
       kommunenummer, gnr, bnr // Uten adresse-filter
     });
     
     const alleBygg = await hentAlleBoligbyggForMatrikkelenheter(alleMatrikkelenheter);
     return aggregertBorettslagData(alleBygg);
   }
   ```

3. **Aggregere data for borettslag**
   - Sum av bruksareal for alle boligbygg
   - Gjennomsnittlig byggeår
   - Liste over alle bygninger med koordinater

### 4.4 Midlertidig løsning (uten grunnbok)
For kjente borettslag/sameier kan man:
1. Manuelt vedlikeholde liste over borettslag-adresser
2. Bruke bygningstype som indikator (142-146 ofte borettslag)
3. La bruker spesifisere om adressen er borettslag

## 5. Nyttige ressurser

### 5.1 Eksterne API-er og tjenester
- **Kartverket Matrikkel**: https://www.kartverket.no/api-og-data/eiendomsdata
- **Geonorge adressesøk**: https://ws.geonorge.no/adresser/v1/
- **Enova energiattest**: https://api.data.enova.no/
- **Grunnboken** (krever tilgang): https://www.kartverket.no/grunnboken/
- **Brønnøysundregistrene**: https://data.brreg.no/

### 5.2 Dokumentasjon og standarder
- **SSB Bygningstype-standard**: https://www.ssb.no/klass/klassifikasjoner/31
- **Matrikkel datakvalitet**: https://www.kartverket.no/eiendom/lokal-matrikkelmyndighet/datakvalitet
- **SOSI-standard bygning**: https://register.geonorge.no/sosi-kodelister/fkb/bygning/5.0

### 5.3 Testverktøy
- **Seeiendom.no**: https://seeiendom.no/ (for manuell verifisering)
- **Matrikkelkartet**: https://matrikkel.no/ (krever innlogging)
- **FinnKart**: https://kart.finn.no/ (viser eiendomsgrenser)

### 5.4 Intern dokumentasjon
- `/soap-dumps/`: Faktiske SOAP request/response eksempler (maks 25 nyeste)
- `/Dokumentasjon/Salgsoppgaver/`: Eksempeloppslag med data
- `/Dokumentasjon/matrikkelAPI.txt`: Komplett API-dokumentasjon
- `/Dokumentasjon/bygningstype-standard.txt`: Alle bygningstype-koder

## 6. Kjente problemer og feilsøking

### 6.1 Timeout-problemer
**Problem:** Test-scriptet får timeout ved kjøring av full testsuite.

**Symptomer:**
- Scriptet henger etter behandling av flere adresser
- Ingen feilmelding, bare timeout etter 2 minutter

**Mulige årsaker:**
1. For mange samtidige SOAP-kall til Matrikkel API
2. Manglende lukking av HTTP-forbindelser
3. Node.js event loop blokkering

**Feilsøkingssteg:**
```bash
# 1. Test enkeltadresser isolert
LIVE=1 npx tsx scripts/test-kjelsasveien-summary.ts
LIVE=1 npx tsx scripts/test-kjelsasveien-seksjon2.ts

# 2. Kjør med timeout-logging
LIVE=1 NODE_OPTIONS="--trace-warnings" npx tsx scripts/test-e2e-building.ts

# 3. Bruk færre test-adresser
# Reduser antall adresser i testAdresser-arrayet
```

### 6.2 Manglende energiattest for Kjelsåsveien 97B
**Problem:** Selv om adressen skal ha energiattest med karakter G, returnerer Enova API ingen resultater.

**Mulige årsaker:**
1. Feil i adresseformat eller seksjonsnummer
2. Energiattesten er registrert på annen måte i Enova
3. Attesten er ikke offentlig tilgjengelig via API

**Debugging:**
```typescript
// Test direkte Enova-oppslag med ulike parametere
async function debugEnovaLookup() {
  // Test 1: Kun GNR/BNR
  const result1 = await fetchEnergiattest({
    kommunenummer: "0301",
    gnr: 75,
    bnr: 284
  });
  
  // Test 2: Med seksjonsnummer
  const result2 = await fetchEnergiattest({
    kommunenummer: "0301",
    gnr: 75,
    bnr: 284,
    seksjonsnummer: 2
  });
  
  // Test 3: Med bygningsnummer hvis tilgjengelig
  // Hent bygningsnummer fra matrikkel først
}
```

### 6.3 Feil bruksareal for seksjonerte eiendommer
**Problem:** Matrikkel returnerer feil bruksareal for enkelte seksjoner.

**Eksempel:** Kjelsåsveien 97B seksjon 2 skal ha 95 m² (92+3), men Matrikkel kan returnere annen verdi.

**Løsning:** Implementer validering mot forventede verdier og logg avvik for manuell oppfølging.

## 7. Test-kommandoer

### 7.1 Grunnleggende tester
```bash
# Test enkeltadresse med full debugging
LIVE=1 LOG_SOAP=1 npx tsx scripts/test-kjelsasveien-summary.ts

# Test spesifikk seksjon
LIVE=1 npx tsx scripts/test-kjelsasveien-seksjon2.ts

# Kjør full e2e-test
LIVE=1 npx tsx scripts/test-e2e-building.ts
```

### 7.2 Feilsøking
```bash
# Test med timeout-debugging
LIVE=1 NODE_OPTIONS="--trace-warnings --max-old-space-size=4096" npx tsx scripts/test-e2e-building.ts

# Test borettslag-strategi (når implementert)
LIVE=1 npx tsx scripts/test-borettslag-strategy.ts

# Sammenlign seksjoner
LIVE=1 npx tsx scripts/test-seksjon-sammenligning.ts
```

### 7.3 Vedlikehold
```bash
# Rydd opp SOAP-dumps
npx tsx scripts/cleanup-soap-dumps.ts

# Generer bygningstype-mapping på nytt
LIVE=1 npx tsx scripts/generate-bygningstype-mapping.ts
```

## 8. Videre arbeid

### 8.1 Høy prioritet
1. **Løse timeout-problemer**
   - Implementer connection pooling for SOAP-klienter
   - Legg til eksplisitt avslutning av HTTP-forbindelser
   - Vurder å dele opp test-suite i mindre batcher

2. **Finne adresser med faktiske energiattester**
   - Bruk Enova's årlige lister for å identifisere adresser
   - Test med kjente energisertifiserte bygg
   - Dokumenter fungerende test-caser

3. **Forbedre areal-beregning for seksjoner**
   - Implementer logikk for å summere areal fra flere etasjer
   - Håndter BRA-i vs BRA-e korrekt
   - Validere mot kjente verdier

### 8.2 Medium prioritet
1. **Implementere borettslag-håndtering**
   - Venter på grunnbok-tilgang
   - Design API for å identifisere borettslag
   - Implementer aggregering av borettslags-data

2. **Utvide test-coverage**
   - Legge til flere bygningstyper
   - Teste edge-cases (manglende data, feil i matrikkel)
   - Automatiserte regresjonstester

3. **Forbedre feilhåndtering**
   - Mer spesifikke feilmeldinger
   - Retry-logikk for transiente feil
   - Bedre logging og sporing

### 8.3 Lav prioritet
1. **Ytelsesoptimalisering**
   - Implementer parallell prosessering
   - Optimalisere cache-strategi
   - Redusere antall API-kall

2. **Dokumentasjon**
   - API-dokumentasjon med OpenAPI/Swagger
   - Brukerguide for frontend-integrasjon
   - Arkitektur-diagrammer

---
*Rapport oppdatert: 2025-06-23*
*Forfatter: Claude (AI-assistent)*
*Versjon: 3.0*