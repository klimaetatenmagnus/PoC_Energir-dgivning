# GDPR-vurdering: Bruk av Enova energimerkedata

**Prosjekt:** Energinøkkelen (PoC Energirådgivning)
**Dato:** 2025-02-05
**Versjon:** 1.0
**Status:** Utkast

---

## 1. Sammendrag

Denne vurderingen konkluderer med at løsningen **ikke behandler personopplysninger** i GDPR-forordningens forstand. Dataene som brukes er offentlig tilgjengelige bygningsdata fra Enova, og løsningen er utformet slik at individuelle personer ikke kan identifiseres.

---

## 2. Bakgrunn og formål

### 2.1 Om løsningen
Energinøkkelen er en tjeneste som lar brukere:
- Slå opp energimerke for sin bolig
- Sammenligne energiforbruk med andre boliger i samme bydel
- Få anbefalinger om energieffektiviseringstiltak

### 2.2 Formål med vurderingen
Dokumentere at løsningens databehandling er i tråd med personvernregelverket (GDPR/personopplysningsloven).

---

## 3. Datakilder og datatyper

### 3.1 Data fra Enova

| Dataelement | Type | Personopplysning? |
|-------------|------|-------------------|
| Energikarakter (A-G) | Kategorisk | Nei |
| Energiintensitet (kWh/m²) | Numerisk | Nei |
| Bruksareal | Numerisk | Nei |
| Byggeår | Numerisk | Nei |
| Bygningstype | Kategorisk | Nei |
| Attestnummer | Identifikator | Nei |

### 3.2 Matrikkeldata (for oppslag)

| Dataelement | Type | Personopplysning? |
|-------------|------|-------------------|
| Kommunenummer | Numerisk | Nei |
| Gårdsnummer | Numerisk | Nei* |
| Bruksnummer | Numerisk | Nei* |
| Seksjonsnummer | Numerisk | Nei* |
| Bygningsnummer | Numerisk | Nei |

*Se vurdering under punkt 4.2

### 3.3 Lisens og tilgang
Dataene er lisensiert under **Norsk lisens for offentlige data (NLOD)** og gjort tilgjengelig via Enovas offentlige API (data.enova.no).

---

## 4. Vurdering mot GDPR

### 4.1 Definisjon av personopplysninger

GDPR artikkel 4(1) definerer personopplysninger som:
> "enhver opplysning om en identifisert eller identifiserbar fysisk person"

En person er identifiserbar dersom vedkommende kan identifiseres, direkte eller indirekte.

### 4.2 Er matrikkeldata personopplysninger?

**Direkte identifisering:** Nei
Matrikkeldata (gårds-/bruksnummer) identifiserer en eiendom, ikke en person.

**Indirekte identifisering:** Teoretisk mulig
Ved å kombinere matrikkeldata med Kartverkets grunnbok kan man finne hjemmelshaver (eier). Dette krever imidlertid:
- Tilgang til grunnboken (ekstern kilde)
- Aktiv handling for å koble data
- At eierskapet er registrert på en fysisk person (ikke selskap)

**Vurdering:** Løsningen foretar ingen slik kobling og har ikke tilgang til grunnboksdata. Matrikkeldata behandles utelukkende som bygningsidentifikator.

### 4.3 Behandling av brukerdata

| Aspekt | Beskrivelse |
|--------|-------------|
| Brukerens søkeadresse | Brukes kun for sanntidsoppslag, lagres ikke |
| IP-adresse | Standard serverlogger, ikke koblet til søk |
| Brukeridentifikator | Ingen - løsningen krever ikke innlogging |
| Cookies | Kun teknisk nødvendige (ingen sporingsdata) |

### 4.4 Aggregering og anonymisering

Bulk-data fra Enova aggregeres til bydelsnivå før lagring:
- Ingen individuelle boliger lagres med fullstendig adresse
- Statistikk beregnes på gruppenivå (minimum 50+ boliger per gruppe)
- Percentiler og gjennomsnitt erstatter individuelle verdier

---

## 5. Databehandleravtale (DBA)

### 5.1 Er DBA nødvendig?

**Nei**, fordi:
1. Enova-dataene er offentlig tilgjengelige under NLOD
2. Vi behandler ikke personopplysninger på vegne av Enova
3. Vi er ikke databehandler i GDPR-forstand

### 5.2 Forpliktelser ved bruk av Enova API

Ved bruk av API-nøkkel aksepteres Enovas vilkår:
- Data skal ikke endres på en måte som endrer opprinnelig mening
- Rate-limits og kvoter skal respekteres
- API-nøkkel skal beskyttes mot uautorisert tilgang
- Enova skal krediteres som datakilde

---

## 6. Tekniske og organisatoriske tiltak

### 6.1 Implementerte tiltak

| Tiltak | Beskrivelse |
|--------|-------------|
| **API-nøkkelhåndtering** | Lagret i GCP Secret Manager, aldri eksponert til frontend |
| **Ingen persistent lagring av søk** | Brukerens adresseoppslag lagres ikke |
| **Aggregering** | Statistikk på bydelsnivå, ikke individnivå |
| **HTTPS** | All kommunikasjon kryptert |
| **Ingen brukerkontoer** | Ingen kobling mellom søk og identitet |

### 6.2 Dataminimering

Løsningen følger prinsippet om dataminimering:
- Kun nødvendige data hentes fra Enova
- Ingen lagring av overflødige felter
- Aggregering fjerner individnivå-detaljer

---

## 7. Rettigheter etter GDPR

Siden løsningen ikke behandler personopplysninger, kommer ikke de registrertes rettigheter (innsyn, sletting, retting osv.) til anvendelse.

Dersom vurderingen skulle endres (f.eks. ved innføring av brukerkontoer), må følgende implementeres:
- Personvernerklæring
- Innsynsløsning
- Slettemekanisme
- Samtykkehåndtering

---

## 8. DPIA (Data Protection Impact Assessment)

### 8.1 Er DPIA påkrevd?

**Nei**, fordi:
- Ingen systematisk overvåking av offentlige områder
- Ingen behandling av særlige kategorier personopplysninger
- Ingen automatiserte beslutninger med rettsvirkning
- Ingen behandling i stor skala av personopplysninger

### 8.2 Terskel for DPIA

DPIA vil bli nødvendig dersom løsningen utvides til å inkludere:
- Brukerkontoer med personopplysninger
- Historikk over brukerens søk
- Kobling mot andre datakilder med personopplysninger

---

## 9. Konklusjon og anbefalinger

### 9.1 Konklusjon

Løsningen behandler **ikke personopplysninger** i GDPR-forstand. Dataene er:
- Offentlig tilgjengelige bygningsdata
- Aggregert til et nivå som ikke tillater individuell identifisering
- Ikke koblet til fysiske personer

### 9.2 Anbefalinger

| Prioritet | Anbefaling | Status |
|-----------|------------|--------|
| **Påkrevd** | Krediter Enova som datakilde (NLOD-krav) | Bør implementeres |
| **Anbefalt** | Legg til enkel personvernerklæring i footer | Valgfritt |
| **Ved endring** | Oppdater denne vurderingen ved vesentlige endringer | - |

### 9.3 Hendelser som utløser ny vurdering

- Innføring av brukerkontoer eller innlogging
- Lagring av søkehistorikk
- Kobling mot nye datakilder
- Endringer i Enovas vilkår eller API

---

## 10. Referanser

- [GDPR (EU) 2016/679](https://lovdata.no/dokument/NL/lov/2018-06-15-38)
- [Personopplysningsloven](https://lovdata.no/dokument/NL/lov/2018-06-15-38)
- [Norsk lisens for offentlige data (NLOD)](https://data.norge.no/nlod/no/2.0)
- [Enova Data- og API-portal](https://data.enova.no/)
- [Datatilsynets veileder om DPIA](https://www.datatilsynet.no/rettigheter-og-plikter/virksomhetenes-plikter/vurdere-personvernkonsekvenser/)

---

## 11. Dokumenthistorikk

| Versjon | Dato | Endring | Forfatter |
|---------|------|---------|-----------|
| 1.0 | 2025-02-05 | Første utkast | [Navn] |

---

*Dette dokumentet er et internt arbeidsdokument og erstatter ikke juridisk rådgivning ved tvil.*
