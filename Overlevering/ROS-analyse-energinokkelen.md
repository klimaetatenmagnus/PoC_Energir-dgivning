# ROS-analyse: Energinøkkelen

**Prosjekt:** Energinøkkelen (PoC Energirådgivning)
**Dato:** 2025-02-05
**Versjon:** 1.0
**Status:** Utkast

---

## 1. Innledning

### 1.1 Formål
Identifisere og vurdere risikoer knyttet til Energinøkkelen-løsningen, med fokus på datatilgang, systemsikkerhet og tjenestekvalitet.

### 1.2 Omfang
Analysen dekker:
- Frontend-applikasjon (React)
- Backend API-tjenester (Cloud Run)
- Integrasjoner mot Enova og Kartverket
- Datalagring og -behandling

### 1.3 Metode
Forenklet ROS basert på NS 5814, med risikovurdering etter sannsynlighet × konsekvens.

---

## 2. Risikomatrise

| Sannsynlighet ↓ / Konsekvens → | Lav (1) | Moderat (2) | Høy (3) |
|--------------------------------|---------|-------------|---------|
| **Høy (3)** | Moderat | Høy | Kritisk |
| **Moderat (2)** | Lav | Moderat | Høy |
| **Lav (1)** | Ubetydelig | Lav | Moderat |

---

## 3. Identifiserte risikoer

### R1: Lekkasje av API-nøkkel

| Aspekt | Vurdering |
|--------|-----------|
| **Beskrivelse** | Enova API-nøkkel eksponeres til uautoriserte |
| **Sannsynlighet** | Lav (1) |
| **Konsekvens** | Moderat (2) - Misbruk av kvote, potensielt kostnader |
| **Risikoverdi** | **Lav** |
| **Eksisterende tiltak** | API-nøkkel i GCP Secret Manager, aldri i frontend |
| **Ytterligere tiltak** | Roter nøkkel ved mistanke om lekkasje |

---

### R2: Enova API utilgjengelig

| Aspekt | Vurdering |
|--------|-----------|
| **Beskrivelse** | Enova API er nede eller endrer format |
| **Sannsynlighet** | Moderat (2) |
| **Konsekvens** | Moderat (2) - Sanntidsoppslag feiler |
| **Risikoverdi** | **Moderat** |
| **Eksisterende tiltak** | Fallback til mock-data i utviklingsmiljø |
| **Ytterligere tiltak** | Implementer caching, vis tydelig feilmelding til bruker |

---

### R3: Feilaktige energidata fra Enova

| Aspekt | Vurdering |
|--------|-----------|
| **Beskrivelse** | Enova-data inneholder feil som videreformidles |
| **Sannsynlighet** | Lav (1) |
| **Konsekvens** | Moderat (2) - Feilinformasjon til bruker |
| **Risikoverdi** | **Lav** |
| **Eksisterende tiltak** | Enova fraskriver seg ansvar i vilkår |
| **Ytterligere tiltak** | Vis "Kilde: Enova" og link til original attest |

---

### R4: Kartverket-tjenester utilgjengelig

| Aspekt | Vurdering |
|--------|-----------|
| **Beskrivelse** | Adresseoppslag eller matrikkel-API feiler |
| **Sannsynlighet** | Lav (1) |
| **Konsekvens** | Høy (3) - Hele tjenesten stopper |
| **Risikoverdi** | **Moderat** |
| **Eksisterende tiltak** | Ingen |
| **Ytterligere tiltak** | Implementer retry-logikk, vurder lokal cache |

---

### R5: DDoS eller overbelastning

| Aspekt | Vurdering |
|--------|-----------|
| **Beskrivelse** | Tjenesten overbelastes av ondsinnet eller utilsiktet trafikk |
| **Sannsynlighet** | Lav (1) |
| **Konsekvens** | Moderat (2) - Tjenesten blir treg/utilgjengelig |
| **Risikoverdi** | **Lav** |
| **Eksisterende tiltak** | Cloud Run autoskalering |
| **Ytterligere tiltak** | Vurder rate-limiting på API-nivå |

---

### R6: Feil i beregningslogikk

| Aspekt | Vurdering |
|--------|-----------|
| **Beskrivelse** | Feil i percentil-/sammenligningsberegninger |
| **Sannsynlighet** | Lav (1) |
| **Konsekvens** | Lav (1) - Misvisende sammenligning |
| **Risikoverdi** | **Ubetydelig** |
| **Eksisterende tiltak** | Enhetstester for beregninger |
| **Ytterligere tiltak** | Manuell validering mot kjente verdier |

---

### R7: Utdaterte bydelstatistikker

| Aspekt | Vurdering |
|--------|-----------|
| **Beskrivelse** | Aggregert statistikk blir utdatert over tid |
| **Sannsynlighet** | Høy (3) |
| **Konsekvens** | Lav (1) - Mindre nøyaktige sammenligninger |
| **Risikoverdi** | **Moderat** |
| **Eksisterende tiltak** | Årlig bulk-import planlagt |
| **Ytterligere tiltak** | Vis "Sist oppdatert"-dato i UI |

---

## 4. Risikooversikt

| ID | Risiko | Verdi | Prioritet |
|----|--------|-------|-----------|
| R2 | Enova API utilgjengelig | Moderat | 1 |
| R4 | Kartverket utilgjengelig | Moderat | 2 |
| R7 | Utdaterte statistikker | Moderat | 3 |
| R1 | API-nøkkel lekkasje | Lav | 4 |
| R3 | Feilaktige Enova-data | Lav | 5 |
| R5 | DDoS/overbelastning | Lav | 6 |
| R6 | Beregningsfeil | Ubetydelig | 7 |

---

## 5. Tiltak og ansvar

### 5.1 Prioriterte tiltak

| Tiltak | Risiko | Ansvar | Frist |
|--------|--------|--------|-------|
| Implementer tydelig feilhåndtering ved API-feil | R2, R4 | Utvikler | - |
| Vis "Kilde: Enova" med link til original attest | R3 | Utvikler | - |
| Vis "Sist oppdatert"-dato for statistikk | R7 | Utvikler | - |
| Dokumenter prosedyre for API-nøkkelrotasjon | R1 | DevOps | - |

### 5.2 Aksepterte risikoer

Følgende risikoer aksepteres uten ytterligere tiltak:
- **R6 (Beregningsfeil):** Lav sannsynlighet og konsekvens, dekket av tester

---

## 6. Forutsetninger og begrensninger

### 6.1 Forutsetninger
- Enova og Kartverket opprettholder sine API-tjenester
- GCP Secret Manager er sikker
- Cloud Run håndterer normal trafikk

### 6.2 Begrensninger
- Analysen dekker ikke fysisk sikkerhet
- Analysen dekker ikke interne trusler (insider threats)
- PoC-nivå - produksjon krever utvidet analyse

---

## 7. Konklusjon

Løsningen har **akseptabel risikoprofil** for en PoC. De viktigste risikoene er knyttet til tilgjengelighet av eksterne tjenester (Enova, Kartverket), ikke til sikkerhet eller personvern.

**Anbefalte tiltak før produksjon:**
1. Implementer robust feilhåndtering med brukervennlige meldinger
2. Vurder caching-strategi for å redusere avhengighet av sanntids-API
3. Etabler overvåking og varsling for API-feil

---

## 8. Dokumenthistorikk

| Versjon | Dato | Endring | Forfatter |
|---------|------|---------|-----------|
| 1.0 | 2025-02-05 | Første utkast | [Navn] |

---

*Denne analysen bør revideres ved vesentlige endringer i løsningen eller trusselbildet.*
