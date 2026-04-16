# Grunnbok & Eiendomsgruppe — Teknisk arkitekturnotat

**Branch:** `feat/grunnbok-borettslag` (egen git worktree, ikke merget til main)
**Status per 2026-04-16:** MVP ferdig. UI viser toggle + aggregat-sammendrag. Task #19 gjenstår (full aggregert tiltaksmatematikk).

Denne filen er sannhetsforteller for arkitekturen. Når ting endres i koden skal denne filen oppdateres i samme commit.

---

## Hvorfor denne featuren finnes

OBOS ba om å kunne se samlet energidata for hele borettslaget/sameiet en bruker tilhører — ikke bare egen bolig. Use case: "Din bolig kan spare X kWh, men hele borettslaget kan spare Y." Krever Grunnbok-API-tilgang (Berettiget interesse) for å koble adresse → org.nr → alle andeler/seksjoner.

---

## Dataflyt (ende-til-ende)

```
Bruker skriver adresse
         │
         ▼
  /api/address-lookup                    (eksisterende, uendret)
         │
         ├─► Geonorge + Matrikkel         ─► BuildingData (én bolig)
         │
         ▼
  Side 1 viser energikarakter, animasjon til side 2
         │
         │ (parallelt, speculativt):
         ▼
  useEiendomsgruppe-hook
         │
         ├─► POST /api/eiendomsgruppe/detekter        (75–440ms)
         │        │
         │        ├─► IdentService.findMatrikkelenhetId
         │        ├─► RegisterenhetService.findSeksjonerFor
         │        │   (hvis >0 → sameie)
         │        └─► RegisterenhetsrettService → andel → person → org.nr
         │            (hvis navn contains "Borettslag" → borettslag)
         │
         │ Hvis type ≠ "enkelt" OG antallEnheter >= 5:
         ▼
         └─► GET /api/eiendomsgruppe/{borettslag|sameie}/...    (7–8s, cached 1t)
                  │
                  ├─► Finn alle andeler/seksjoner
                  ├─► Map til unike matrikkel-bruksenheter
                  ├─► Dedup til unike byggIds
                  ├─► Hent ByggInfo (byggeår, bruksareal)
                  ├─► calculateTEK(byggeår) per bygg
                  └─► Solar-prefetch per bygg (parallell, concurrency=10)

Side 2:
  ─ EnergySolutionButtons (uendret, regner på enkeltbolig)
  ─ EiendomsgruppeToggle:
      ─ mens aggregat laster → PktLoader "Henter data for X"
      ─ ferdig → to-valgs-knapp "Denne boligen | Hele Oppsal borettslaget (598)"
  ─ viewMode === 'gruppe' → sammendragsboks (bygg, m², solpotensial, TEK-fordeling)
```

---

## Filer og deres ansvar

### Backend: `services/grunnbok-service/`

| Fil | Ansvar |
|-----|--------|
| `types.ts` | Delte TS-typer (GrunnbokContext, Borettslagsandel, Seksjon, Person, Adresse) |
| `GrunnbokSoapClient.ts` | Base-klasse for SOAP: basic auth, envelope, xsi:type |
| `IdentService.ts` | `findMatrikkelenhetId(ident)`, `findBorettslagId(orgnr)` |
| `RegisterenhetService.ts` | `findSeksjonerFor()`, `findBorettslagsandelerForBorettslag()` |
| `RegisterenhetsrettService.ts` | `findRetterForEnheter(matrikkelenhetId)` |
| `RegisterenhetsrettsandelService.ts` | `findAndelerIRetter(rettId)` |
| `StoreService.ts` | `getObject()` med xsi:type — henter alle domeneobjekter |
| `context.ts` | Instansierer klientene fra runtime config |
| `cache.ts` | `TtlCache` med request coalescing — 1t TTL |
| `MatrikkelBruksenhetHelper.ts` | Rå SOAP + regex fordi eksisterende `BruksenhetClient` har buggy parser |
| `EiendomsgruppeDetector.ts` | Rask detektor (75–440ms) — borettslag / sameie / enkelt |
| `EiendomsgruppeService.ts` | Full aggregering + solar-prefetch + cache |

### Frontend: `src/`

| Fil | Ansvar |
|-----|--------|
| `services/buildingApi.ts` | Utvidet med 3 nye klient-metoder + typer (EiendomsgruppeDetection, EiendomsgruppeResult) |
| `hooks/useEiendomsgruppe.ts` | Speculativ prefetch, MIN_GRUPPESTORELSE_FOR_TOGGLE = 5 |
| `components/EiendomsgruppeToggle/EiendomsgruppeToggle.tsx` | PktLoader → toggle-knapp |
| `components/EiendomsgruppeToggle/EiendomsgruppeToggle.css` | Punkt-farger, to-valgs pill-design |
| `components/FigmaMainScript.tsx` | Bruker hook, rendrer toggle + sammendrag over EnergySolutionButtons |

### API-endepunkter (`src/api-server.ts`)

| Metode + path | Beskrivelse | Ventet tid |
|---------------|-------------|------------|
| `POST /api/eiendomsgruppe/detekter` | `{kommunenummer, gaardsnummer, bruksnummer}` → detection | 75–440ms |
| `GET /api/eiendomsgruppe/borettslag/:orgnr` | Full aggregering for borettslag | 7–8s (0ms cached) |
| `GET /api/eiendomsgruppe/sameie/:kommunenummer/:gnr/:bnr` | Full aggregering for sameie | 7–8s (0ms cached) |

Secrets/config i `.env` (gitignored):
```
GRUNNBOK_USERNAME=oslokomprod
GRUNNBOK_PASSWORD=*****
GRUNNBOK_API_BASE_URL_PROD=https://grunnbok.no/grunnbok/wsapi/v2
GRUNNBOK_API_BASE_URL_TEST=https://syntest.grunnbok.no/grunnbok/wsapi/v2
```
I prod (Cloud Run): deploy/gcp/cloudbuild.yaml og cloudrun.yaml har de samme GRUNNBOK_*-secrets.

---

## Kjente begrensninger

1. **Hardkodet kommunenummer "0301"** i `useEiendomsgruppe`-kall. Gjør at featuren *kun virker for Oslo* i nåværende form. Må parameteriseres via `buildingData.kommunenummer` (hvor den enn finnes i response-en) når vi utvider.

2. **2-seksjons sameier** filtreres av UI. Pilestredet 37 er teknisk et sameie (2 seksjoner), men gir lite verdi å toggle på. Terskelen `MIN_GRUPPESTORELSE_FOR_TOGGLE = 5` i `useEiendomsgruppe.ts` kan justeres.

3. **Tiltak-matematikken er ikke aggregert** (Task #19). Når viewMode === 'gruppe' viser vi et sammendrag, men `EnergySolutionButtons` regner fortsatt kWh/kr for enkeltbolig. Å summere riktig krever at komponenten tar en bygg-liste (hver med byggeår/bruksareal/TEK) i stedet for ett bygg, og at beregningen kjører per bygg og summeres.

4. **Solar-data kan mangle** hvis PBE Solkart er nede (Oracle-feil observert 2026-04-16 formiddag). Koden returnerer `null`-solar på bygg-nivå, UI viser ingen solar-seksjon. Ingen krasj.

5. **BruksenhetClient.findBruksenheterForMatrikkelenhet har buggy parser** som returnerer tom array. Derfor lager vi `MatrikkelBruksenhetHelper` i Grunnbok-mappen. Hvis parseren i core-koden blir fikset senere, kan helperen erstattes.

6. **xsi:type er påkrevd** på alle abstrakte ID-typer i SOAP-envelopes. Uten det får man "Error mapping from ... to ..." på server-siden. Dette gjelder:
   - `StoreService.getObject` (alltid)
   - `RegisterenhetService.findBorettslagsandelerForBorettslag` for BorettslagId
   - Andre operasjoner med abstrakte ID-typer

---

## Dev-oppsett

### Forutsetninger
- `.env` i worktree må ha alle `MATRIKKEL_*`, `ENOVA_*` og `GRUNNBOK_*`-variabler
- Node-prosesser fra main-worktree må ikke kjøre på de samme portene — sjekk med:
  ```bash
  lsof -p $(lsof -ti:3001) | awk '$4=="cwd" {print $NF}'
  ```
  Skal peke til worktree, ikke main.

### Start alle tjenester

```bash
cd ~/PoC_Energir-dgivning-grunnbok
./scripts/start-ui-only.sh
```

**Husk:** `start-ui-only.sh` setter `LIVE=1` men IKKE `API_ENV=prod`. For at Grunnbok skal treffe prod-endepunktet må du restarte api-serveren manuelt:

```bash
kill $(lsof -ti:3001)
API_ENV=prod LIVE=1 npx tsx src/api-server.ts &
```

### Test-adresser

| Adresse | Forventet toggle |
|---------|------------------|
| Haakon Tveters vei 44 | "Hele Oppsal borettslaget (598)" |
| Fallanveien 29 | "Hele Myrer borettslaget (~408)" |
| Hesteskoen 4A (eller 4B–4K) | "Hele sameiet (196)" |
| Pilestredet 37 | Ingen toggle (kun 2 seksjoner) |

---

## Test-script

Alle kjøres fra worktree-roten med `API_ENV=prod LIVE=1 npx tsx scripts/<navn>.ts`:

| Script | Hva det tester |
|--------|---------------|
| `test-grunnbok-oppsal.ts` | SOAP-klienter end-to-end: Oppsal 598 andeler, Hesteskoen 196 seksjoner |
| `test-eiendomsgruppe-aggregering.ts` | Full aggregering + bygg-dedup + byggeår-fordeling |
| `test-eiendomsgruppe-detektor.ts` | 3 cases: Oppsal (borettslag), Hesteskoen (sameie), Pilestredet (2-seksj sameie) |
| `test-eiendomsgruppe-solar.ts` | Solar-data matcher direkte solar-oppslag |

---

## Task #19: Full aggregert tiltaksmatematikk

**Mål:** Når brukeren toggler til gruppe-visning, skal `computeTiltakSavings` kjøres per bygg og summeres, slik at checkbox-interaksjon påvirker gruppe-totaler i sanntid.

**Nåværende begrensning:** `EnergySolutionButtons` tar `buildingData: AddressLookupResponse` (én bygning). Komponenten bruker denne direkte i `calculateCombinedSavings()`-memo.

**Implementasjonsskisse:**

1. Utvid `EnergySolutionButtons`-props med valgfri `aggregatedBuildings?: EiendomsgruppeBygning[]`.
2. Hvis `aggregatedBuildings` er satt:
   - I `tiltakInfo`-memo, iterer alle bygg og kjør `calculateCombinedSavings()` per bygg. Summer kWh og kr.
   - Bygningstype per bygg utledes fra `bygningstypeKodeId` (samme som dagens logikk).
   - For solar-tiltak: bruk `b.solar.filteredSolarEnergy` fra aggregatet i stedet for `buildingData.filteredSolarEnergy`.
3. Pass `aggregatedBuildings` fra `FigmaMainScript` når `viewMode === 'gruppe'` og `eiendomsgruppe.aggregat` er satt.
4. Oppdater `WhiteInfoBox` til å vise aggregerte totaler (total årlig forbruk = sum av bygg-forbruk).
5. `newRating`-memo må også jobbe på aggregerte tall for å vise en ny energikarakter for hele gruppen.

**Test-kriterier:**
- Toggle "gruppe" + huke av "vinduer" for Oppsal → total-besparelse er sum av 25 byggs besparelse, ikke 25× enkeltbolig
- Rating-beregningen bruker vektet gjennomsnitt av TEK eller similar heuristic

---

## Migrasjonssti til main

Når MVP er godkjent og task #19 er løst:

1. Pull siste main inn i `feat/grunnbok-borettslag` (rebase eller merge)
2. Verifiser at `npm run verify` passerer
3. Lag PR fra `feat/grunnbok-borettslag` til `main`
4. Før merge: sørg for at GCP Secret Manager har `GRUNNBOK_*`-secrets opprettet (3 stk)
5. Etter merge: verifiser i staging at toggle dukker opp for kjente test-adresser
