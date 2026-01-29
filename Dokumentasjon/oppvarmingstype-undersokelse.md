# Oppvarmingstype fra Matrikkelen: Metodikk og funn

## 1. Bakgrunn og maal

Undersoke om Matrikkelens SOAP-API kan brukes som kilde for oppvarmingstype og energikilde for boliger i Oslo, med sarlig fokus paa fjernvarmetilknytning. Kryssreferere med Enovas energiattester for aa vurdere datakvalitet.

## 2. Metodikk

### 2.1 Datakilder

| Kilde | Beskrivelse | Antall poster |
|-------|-------------|---------------|
| Matrikkel 2023 CSV | Bygningsregister for Oslo | ~123 000 bygninger (72 223 boliger) |
| Matrikkelen SOAP API | StoreService.getObject() | Live oppslag per bygning |
| Enova bulk-CSV | Energiattester for Oslo | ~74 000 attester (30 264 unike bygninger) |

### 2.2 Utvalgsmetode

- **Populasjon:** 72 223 boliger i Oslo (bygningstype 11-15) med gateadresse
- **Utvalgsstorrelse:** 100 adresser
- **Stratifisering:** Etter bydel og bygningstype-kategori (11-15), med round-robin-trekking fra buckets
- **Dekning:** Alle 17 bydeler representert

### 2.3 Oppslag-kjede per adresse

1. **Geonorge adresseoppslag** med multi-variant logikk (7 varianter: komma-fjerning, bokstav-splitting, punktum-fjerning osv.)
2. **MatrikkelClient.findMatrikkelenheter()** - finn matrikkelenhet fra GNR/BNR
3. **BygningClient.findByggForMatrikkelenhet()** - finn bygnings-ID
4. **StoreClient.getObject()** - hent bygningsdetaljer inkl. oppvarmingsKodeIds og energikildeKodeIds
5. **Enova-kryssreferanse** via bygningsnummer mot bulk-CSV

### 2.4 Utvidelse av StoreClient

Nye felter lagt til i `ByggInfo`-interfacet:
- `oppvarmingsKodeIds: number[]` - Kode-IDer for oppvarmingstype
- `energikildeKodeIds: number[]` - Kode-IDer for energikilde

Nye extract-funksjoner etter eksisterende monster (`extractBruksenhetIds`):
- `extractKodeIdArray()` - generisk hjelper for aa trekke ut kode-ID-arrays fra SOAP XML
- `extractOppvarmingsKodeIds()` og `extractEnergikildeKodeIds()`

### 2.5 Kodeverksdefinisjoner brukt

**OppvarmingsKode (opprinnelig antatt – FEIL, se avsnitt 7 for korrekt):**

| Kode-ID | Beskrivelse (antatt) |
|---------|-------------|
| 1 | Sentralvarme (vannbaaren) |
| 2 | Elektrisk |
| 3 | Annet |

**EnergikildeKode (opprinnelig antatt – FEIL, se avsnitt 7 for korrekt):**

| Kode-ID | Beskrivelse (antatt) |
|---------|-------------|
| 1 | Elektrisitet |
| 2 | Olje |
| 3 | Gass |
| 4 | Fast brensel |
| 5 | Fjernvarme/naervarme |
| 6 | Annet |
| 7 | ? (se avsnitt 4) |

## 3. Resultater

### 3.1 Oppslagskvalitet

| Metrikk | Verdi |
|---------|-------|
| Vellykkede oppslag | 97 / 100 (97%) |
| Feil (Geonorge ikke funnet) | 3 / 100 (3%) |
| Multi-variant-forbedring | Fra 75% (1 variant) til 97% (7 varianter) |

### 3.2 Matrikkeldata: Oppvarming og energikilde

| Metrikk | Verdi |
|---------|-------|
| Bygninger med oppvarmingsdata | 5 / 97 (~5%) |
| Bygninger med energikildedata | 3 / 97 (~3%) |
| Med fjernvarme energikilde (kode 5) | 0 |
| Med energikilde kode 7 | 3 |

**Konklusjon: Matrikkelen har svart lav utfyllingsgrad for oppvarming/energikilde-feltene.** Kun ~5% av bygninger har data registrert. Feltene er ikke egnet som primaerkilde for oppvarmingstype.

### 3.3 Enova-kryssreferanse

| Metrikk | Verdi |
|---------|-------|
| Treff i Enova-data (bygningsnummer) | 44 / 100 (44%) |
| Gronn/lysgronn oppvarmingskarakter totalt | 14 / 44 (31.8%) |
| Gronn/lysgronn blokker | 12 / 23 (52.2%) |
| Gronn/lysgronn smaahus | 2 / 21 (9.5%) |
| Bygninger med data i BEGGE kilder | 6 |

Enovas oppvarmingskarakter (fargekode) er en indirekte indikator: gronn/lysgronn indikerer lav andel el+fossilt, som er konsistent med fjernvarme, varmepumpe eller bio. Den skiller ikke mellom disse.

### 3.4 Sammenligning med kjent statistikk

| Kilde | Blokker | Smaahus | Totalt |
|-------|---------|---------|--------|
| SSB/Celsio (referanse) | ~25% | ~2% | ~15% |
| Matrikkelen (energikilde=5) | 0% | 0% | 0% |
| Enova gronn/lysgronn (proxy) | 52.2% | 9.5% | 31.8% |

Matrikkelen fanger opp 0 fjernvarmetilkoblinger (forventet ~15). Enova-proxyen overestimerer fordi den ogsaa inkluderer varmepumpe og bio.

### 3.5 Bygninger med energikilde kode 7

Tre bygninger returnerte energikildeKodeId = 7 (ikke i vaart kodeverk):

| Adresse | Bydel | Bygningstype | Enova karakter |
|---------|-------|-------------|----------------|
| Kristoffer Robins vei 64 | Stovner | 14 (Store boligbygg) | E/Lightgreen |
| Holmlia Senter vei 15 | Sondre Nordstrand | 14 (Store boligbygg) | G/Green |
| Selvbyggerveien 127 | Bjerke | 14 (Store boligbygg) | F/Green |

Alle tre har:
- Bygningstype 14 (store boligbygg / blokk)
- Oppvarmingskode 2 (elektrisk)
- Gronn eller lysgronn Enova-oppvarmingskarakter (indikerer fornybar)

## 4. Undersokelse av energikilde kode 7

### 4.1 Brukerens hypotese

I Kartverkets offisielle dokumentasjon (DataelementerOgKodelisterVer.2.0.htm, avsnitt 2.5.6) brukes bokstavkoder for EnergikildeKode, der kodeverdi "F" tilsvarer fjernvarme. Hypotesen er at intern kode-ID 7 kan tilsvare bokstaven "G" (7. bokstav), eller at "F" paa annet vis mapper til ID 7.

### 4.2 Funn

**Viktig presisering:** SOAP-APIet returnerer interne numeriske kode-IDer (som 7), ikke bokstavverdiene direkte. Mappingen mellom intern ID og kodeverdi (bokstav) er IKKE nødvendigvis alfabetisk. For bygningstype brukes f.eks. kodeverdier som "111", "121" osv., med helt andre interne IDer.

Konkret: Vi kan IKKE anta at intern ID 7 = bokstav G (7. bokstav) eller F (6. bokstav). Mappingen kan bare fastslaaes ved aa hente kodelisten fra APIet.

### 4.3 Indirekte bevis

Selv om vi ikke kan bekrefte at kode 7 = fjernvarme, er det sterke indisier:

1. **Alle tre bygninger er store boligblokker** - bygningstypen med hoyest fjernvarmeandel i Oslo
2. **Alle tre har gronn/lysgronn Enova-karakter** - konsistent med fjernvarme
3. **Alle tre ligger i bydeler med fjernvarmedekning** (Stovner, Sondre Nordstrand, Bjerke)
4. **Ingen bygninger har kode 5** (vaar antatte fjernvarmekode) - tyder paa at vaart kodeverk er ufullstendig

### 4.4 Anbefalt verifisering

For aa bekrefte/avkrefte, implementer et SOAP-kall til Matrikkelens kodeliste-tjeneste:

1. **Moenster:** `BygningClient.findAlleBygningstypeKoder()` (allerede implementert i kodebasen)
2. **Ny metode:** `findAlleEnergikildeKoder()` med SOAP-action `findAlleEnergikildeKoder`
3. **Alternativt:** Bruk `KodelisteService` endepunktet direkte
4. Kallet returnerer `id`, `kodeverdi` og `beskrivelse` for alle koder

Dette vil gi den definitive mappingen mellom numeriske IDer og kodebeskrivelser.

## 5. Plan: Utvidet Enova-datasett

### 5.1 Status for dagens Enova-data

Enovas bulk-CSV (lastet ned via `/Fil/{year}` API) inneholder IKKE detaljert oppvarmingstype. Den har kun:
- **Energikarakter** (A-G skala)
- **Oppvarmingskarakter** (Red/Orange/Yellow/Green/Lightgreen)
- **BeregnetFossilandel** (0.0-1.0)

Oppvarmingskarakteren er en indirekte indikator basert paa fargekode, ikke en eksplisitt oppvarmingskilde.

### 5.2 Mulige utvidede datakilder

#### a) Enova enkelt-oppslag API
- **Endepunkt:** `POST https://api.data.enova.no/ems/offentlige-data/v1/Energiattest`
- **Allerede i bruk:** `matrikkel.ts:fetchEnergiattest()`
- **Undersoek:** Sjekk om den detaljerte responsen inneholder felter for oppvarmingssystem/energikilde som ikke er i bulk-CSV. Responsen inneholder allerede `registering` (kWh-data) og `enhet.bygg` - mulig at det finnes flere felter.
- **Tiltak:** Utvid `fetchEnergiattest()` til aa logge/returnere hele respons-objektet for en bygning og analysere alle tilgjengelige felter.

#### b) Enova XML-eksport
- **Undersoek:** Om Enova tilbyr en utvidet bulk-eksport (XML-format) med flere felter enn CSV.
- **Tiltak:** Sjekk Enova Data- og API-portal for alternative eksportformater.

#### c) Matrikkelens kodeliste-API
- **Mest lovende for kode 7-sporsmaal:** Implementer `findAlleEnergikildeKoder()` for aa faa den offisielle mappingen.
- **Tiltak:** Kopier monsteret fra `findAlleBygningstypeKoder()` i BygningClient.

### 5.3 Prioritert handlingsplan

1. **Implementer `findAlleEnergikildeKoder()` i BygningClient** - Avklar kode 7 og faa komplett kodeverk
2. **Undersoek Enova enkelt-API respons** - Logg fullstendig respons for aa se om detaljert oppvarmingsinfo finnes
3. **Oppdater E2E-testscriptet** med korrekt kodeverk naar det er bekreftet
4. **Vurder kombinert kilde-strategi:** Matrikkel for bygninger med data + Enova som supplement

## 6. Konklusjoner

1. **Matrikkelen har svart lav datadekning** for oppvarming/energikilde (~5% av boliger). Feltene er ikke egnet som selvstendig primaerkilde.

2. **Energikilde kode 7 er ikke bekreftet**, men sterke indisier tyder paa at det kan vaere fjernvarme eller en beslektet fornybar kilde. Avklaring krever et SOAP-kall til kodeliste-tjenesten.

3. **Enova-data mangler eksplisitt oppvarmingstype** i bulk-CSV. Oppvarmingskarakteren (fargekode) gir kun en indirekte indikasjon.

4. **Kombinert strategi anbefales:** Bruk Matrikkelens oppvarming/energikilde-felter naar de er fylt ut, og supplement med Enovas oppvarmingskarakter som proxy.

5. **Neste steg:** ~~Implementer kodeliste-oppslag for aa avklare kode 7, og undersoek om Enova enkelt-API har mer detaljert info enn bulk-CSV.~~ (Utfoert – se avsnitt 7.)

## 7. Verifisering: Korrekt kodeverk fra KodelisteServiceWS

### 7.1 Metode

Brukte `KodelisteServiceWS.getKodelisterEnkel()` SOAP-kall for aa hente ALLE kodelister fra Matrikkelen.
Responsen inneholdt 111 kodelister med totalt 4840 koder. Blant disse fant vi de definitive kodene for energikilde og oppvarming.

### 7.2 Korrekt EnergikildeKode (fra KodelisteServiceWS)

| Intern ID | Kodeverdi | Beskrivelse |
|-----------|-----------|-------------|
| 0 | E | Elektrisitet |
| 1 | O | Olje/parafin/fl.brensel |
| 2 | B | Biobrensel |
| 3 | S | Solenergi |
| 4 | V | Varmepumpe |
| 5 | G | Gass |
| 6 | F | **Fjernvarme** |
| 7 | A | Annen energikilde |

**Kode-ID 7 = "Annen energikilde" (kodeverdi A)** – IKKE fjernvarme som hypotisert i avsnitt 4.

**Fjernvarme er kode-ID 6 (kodeverdi F)**, ikke kode 5 som det opprinnelige (feilaktige) kodeverket antok.

### 7.3 Korrekt OppvarmingsKode (fra KodelisteServiceWS)

| Intern ID | Kodeverdi | Beskrivelse |
|-----------|-----------|-------------|
| 0 | E | Elektrisk |
| 1 | S | Sentralvarme |
| 2 | A | Annen oppvarming |

### 7.4 Avvik fra opprinnelig kodeverk

Det opprinnelige kodeverket (avsnitt 2.5) var basert paa antakelser og var **fullstendig feil**:

1. **ID-offset:** Kodene er 0-indeksert, ikke 1-indeksert. Vaart antatte kodeverk startet paa 1.
2. **Rekkefoelje:** Kodene foelger IKKE samme rekkefoelje som den offisielle bokstav-kodelisten.
3. **Manglende koder:** Solenergi (ID 3) og Varmepumpe (ID 4) var ikke i vaart opprinnelige kodeverk.
4. **Kode 7:** Var antatt aa vaere fjernvarme, men er "Annen energikilde".
5. **Fjernvarme:** Er ID 6 (kodeverdi F), ikke ID 5 som antatt.

### 7.5 Revidert tolkning av E2E-resultatene

Med korrekt kodeverk maa E2E-resultatene fra avsnitt 3 omtolkes:

- De 3 bygningene med energikilde-kode 7 har **"Annen energikilde"**, ikke fjernvarme
- De 5 bygningene med oppvarmingsdata (kode 2) hadde **"Elektrisk"** (kode-ID 0=Elektrisk), ELLER hadde ukjent kode i gammelt system
- Bygninger med energikilde-kode 5 ville vaert **"Gass"** (ikke fjernvarme)
- For aa finne fjernvarme maa vi soeke etter **energikilde kode-ID 6**

**Viktig:** Resultatene fra foerste E2E-kjoering (avsnitt 3) maa re-evalueres med korrekt kodeverk. Alle analyser basert paa kode 5 = fjernvarme er ugyldige.

### 7.6 Enova enkelt-API: Ingen ekstra oppvarmingsfelter

Undersoekelese av Enova enkelt-API (`POST /Energiattest`) viste at den **IKKE** inneholder oppvarmingstype/energikilde utover det som allerede finnes i bulk-CSV:

- `oppvarmingskarakter` (fargekode: red/orange/yellow/green/lightgreen)
- `beregnetFossilandel` (0.0-1.0)
- `oppvarmetBra` (oppvarmet bruksareal i m2)

Ingen eksplisitt energikilde-felt (fjernvarme, el, olje, etc.) i Enova-dataene.

### 7.7 Oppdatert status for fjernvarmeidentifikasjon

| Datakilde | Har eksplisitt fjernvarme-felt? | Dekning | Kommentar |
|-----------|------|---------|-----------|
| Matrikkelen (energikildeKodeId=6) | Ja | ~5% av boliger | Korrekt kode, men svart lav utfyllingsgrad |
| Enova bulk-CSV | Nei (kun proxy) | ~44% treff | Oppvarmingskarakter groenn/lysgroenn som proxy |
| Enova enkelt-API | Nei (kun proxy) | ~44% treff | Ingen ekstra felter utover bulk-CSV |

### 7.8 Neste steg

1. **Re-kjoer E2E-test med korrekt kodeverk** – oppdater kodeverks-mappingen i testscriptet og kjoer paa nytt for aa faa korrekte tall
2. **Utvid soek til energikilde kode-ID 6** – sjekk om noen bygninger faktisk har fjernvarme registrert med korrekt kode
3. **Vurder stoerre utvalg** – 100 adresser ga svart faa med Matrikkel-data. Vurder 500-1000 for bedre statistisk grunnlag
4. **Kombinert strategi:** Matrikkelens energikildeKodeId=6 (fjernvarme) + Enovas oppvarmingskarakter groenn/lysgroenn som supplement

---

**Filer:**
- Testscript (opprinnelig): `scripts/test-oppvarmingstype-e2e.ts`
- Kodeliste-testscript: `scripts/test-energikilde-kodeliste.ts`
- Enova-responsanalyse: `scripts/test-enova-detaljert-respons.ts`
- StoreClient-utvidelse: `src/clients/StoreClient.ts`
- Resultater (CSV): `workspace-archive/oppvarmingstype-resultater.csv`
- Kodeliste raa XML: `workspace-archive/kodeliste-raw-response.xml`
- Kodeliste parsed: `workspace-archive/kodeliste-parsed.json`
- Referansedata: SSB tabell 10906 / Hafslund Oslo Celsio aarsrapporter
