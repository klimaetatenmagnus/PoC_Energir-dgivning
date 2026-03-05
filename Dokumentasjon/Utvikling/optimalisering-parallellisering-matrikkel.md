# Optimalisering: Parallellisering av resolveBuildingData

**Dato:** 2026-03-05
**Status:** Validert med testscript, klar for implementering
**Fil:** `services/building-info-service/matrikkel.ts`

## Bakgrunn

Oppslag på seksjonerte eiendommer (f.eks. Hesteskoen 4M) tar 4-10 sekunder.
Hovedarsaken er at alle eksterne API-kall (SOAP mot Kartverket, HTTP mot Enova/Solar)
gjores sekvensielt i `for`-lokker med `await`. For eiendommer med mange
matrikkelenheter og bruksenheter multipliseres latensen.

## Testresultater

Optimalisert versjon er validert mot 10 adresser med identiske resultater:

| Adresse                  | Original | Optimalisert | Speedup |
|--------------------------|----------|--------------|---------|
| Hesteskoen 4M, Oslo      | 3947 ms  | 2813 ms      | 29%     |
| Hesteskoen 4A, Oslo      | 3892 ms  | 3207 ms      | 18%     |
| Fallanveien 29, Oslo     | 6467 ms  | 2498 ms      | 61%     |
| Grenseveien 99, Oslo     | 3927 ms  | 853 ms       | 78%     |
| Dammanns vei 13, Oslo    | 4419 ms  | 1476 ms      | 67%     |
| Bygdoy terrasse 16, Oslo | 3409 ms  | 761 ms       | 78%     |
| Stromsborgveien 55B      | 3282 ms  | 1063 ms      | 68%     |

Alle felter i `BuildingResult` er sammenlignet og identiske (deep compare).
Testscript: `scripts/test-parallel-lookup.ts`, kandidatkode: `scripts/parallel-lookup-candidate.ts`.

## Oversikt over endringer

Fem isolerte endringer, alle i `resolveBuildingData` i `matrikkel.ts`.
Ingen endringer i signaturer, returtyper eller andre filer.

---

### Endring 1: Dedupliser URL-varianter i lookupAdresse

**Hvor:** Funksjon `lookupAdresse`, ca. linje 205-233.

**Problem:** Funksjonen genererer 7 varianter av adressestrengen og prover dem
sekvensielt mot Geonorge. Flere varianter produserer identisk URL
(f.eks. "Hesteskoen 4M, Oslo" og "Hesteskoen 4M Oslo" gir samme sok-parameter).

**Endring:** Dedupliser varianter basert pa generert URL for loopen starter.

**Eksisterende kode (linje 205-233):**
```typescript
const variants = [
  adresse,
  adresse.replace(/,/g, ' ').trim().replace(/\s+/g, ' '),
  // ... 5 varianter til
];

for (const variant of variants) {
  const response = await fetch(buildUrl(variant), headers);
  // ...
}
```

**Ny kode:**
```typescript
const variants = [
  adresse,
  adresse.replace(/,/g, ' ').trim().replace(/\s+/g, ' '),
  // ... 5 varianter til (uendret)
];

// Dedupliser varianter som gir identisk URL
const seen = new Set<string>();
const uniqueVariants: string[] = [];
for (const v of variants) {
  const url = buildUrl(v);
  if (!seen.has(url)) {
    seen.add(url);
    uniqueVariants.push(v);
  }
}

for (const variant of uniqueVariants) {
  const response = await fetch(buildUrl(variant), headers);
  // ... (resten uendret)
}
```

**Risiko:** Ingen. Identiske URLer ville gitt identisk respons.

---

### Endring 2: Parallelliser getMatrikkelInfo for alle matrikkelenhets-IDer

**Hvor:** Rett etter `findMatrikkelenheter`-kallet, ca. linje 795-800.

**Problem:** `findMatrikkelenheter` returnerer en liste med IDer (ofte 10-20 for
seksjonerte eiendommer). Deretter itererer koden sekvensielt gjennom IDene
og kaller `getMatrikkelInfo(id)` for hver (linje 803). Hver er et SOAP-kall
til StoreService.

**Endring:** Legg til ett `Promise.all`-kall som forhands-populerer cachen for
alle IDer parallelt. De etterfolgene sekvensielle lokkene treffer da cachen.

**Eksisterende kode (etter linje 799):**
```typescript
if (!ids.length) {
  throw new Error('Fant ingen matrikkelenhets-ID for adressen');
}

let matrikkelenhetsId: number | undefined;

for (const id of ids) {
  const info = await getMatrikkelInfo(id);  // <-- sekvensiell
  // ...
}
```

**Ny kode:**
```typescript
if (!ids.length) {
  throw new Error('Fant ingen matrikkelenhets-ID for adressen');
}

// Hent matrikkelinfo for alle IDer parallelt (populerer matrikkelXmlCache)
await Promise.all(ids.map((id) => getMatrikkelInfo(id)));

let matrikkelenhetsId: number | undefined;

for (const id of ids) {
  const info = await getMatrikkelInfo(id);  // treffer naa cachen
  // ...
}
```

**Risiko:** Ingen. `getMatrikkelInfo` har allerede intern cache (`matrikkelXmlCache`).
De pafolgene kallene returnerer fra cache. Logikk og rekkefolgeavhengigheter
i seksjonsmatchingen er uendret.

---

### Endring 3: Parallelliser bruksenhet-henting i loadBruksenheterForBuilding

**Hvor:** Funksjon `loadBruksenheterForBuilding`, ca. linje 641-684.

**Problem:** For hvert bygg itererer funksjonen sekvensielt gjennom
`bygg.bruksenhetIds` og kaller `storeClient.getBruksenhet(bruksenhetId)`
en om gangen. For bygg med 15-20 bruksenheter gir dette 15-20 sekvensielle
SOAP-kall.

**Endring:** Erstatt `for`-lokken med `Promise.allSettled` for parallell henting.

**Eksisterende kode (linje 649-683):**
```typescript
const bruksenheter: BruksenhetInfo[] = [];
if (!bygg.bruksenhetIds || bygg.bruksenhetIds.length === 0) {
  byggBruksenhetCache.set(bygg.id, bruksenheter);
  return bruksenheter;
}

if (LOG) {
  debugLog(
    `Henter ${bygg.bruksenhetIds.length} bruksenheter for bygg ${bygg.id}`
  );
}

for (const bruksenhetId of bygg.bruksenhetIds) {
  if (LOG) {
    debugLog(`  Henter bruksenhet ${bruksenhetId} via StoreService...`);
  }
  try {
    const bruksenhetInfo = await withExternalMetrics(
      'store-service',
      'getBruksenhet',
      () => storeClient.getBruksenhet(bruksenhetId)
    );
    if (bruksenhetInfo) {
      bruksenheter.push(bruksenhetInfo);
    }
  } catch (error) {
    debugLog(
      `  Kunne ikke hente detaljer for bruksenhet ${bruksenhetId}:`,
      error
    );
  }
}

byggBruksenhetCache.set(bygg.id, bruksenheter);
return bruksenheter;
```

**Ny kode:**
```typescript
if (!bygg.bruksenhetIds || bygg.bruksenhetIds.length === 0) {
  byggBruksenhetCache.set(bygg.id, []);
  return [];
}

if (LOG) {
  debugLog(
    `📦 Henter ${bygg.bruksenhetIds.length} bruksenheter for bygg ${bygg.id}`
  );
}

const results = await Promise.allSettled(
  bygg.bruksenhetIds.map((bruksenhetId) =>
    withExternalMetrics('store-service', 'getBruksenhet', () =>
      storeClient.getBruksenhet(bruksenhetId)
    )
  )
);

const bruksenheter: BruksenhetInfo[] = [];
for (const result of results) {
  if (result.status === 'fulfilled' && result.value) {
    bruksenheter.push(result.value);
  }
}

byggBruksenhetCache.set(bygg.id, bruksenheter);
return bruksenheter;
```

**Risiko:** Lav. `Promise.allSettled` haandterer feil per kall (som den
eksisterende try/catch). Rekkefolgeen pa bruksenheter i arrayet kan endres,
men nedstroms kode bruker `.find()` og `.some()` som er rekkefolgeuavhengige.

**Merk:** Per-bruksenhet debug-logging fjernes fordi parallelle kall gjor
interleavet logging uleselig. Samle-loggen med antall beholdes.

---

### Endring 4: Gjenbruk byggIds og byggInfo via cache

**Hvor:** To steder i `resolveBuildingData`:

**4a.** Legg til to nye cacher ved siden av de eksisterende (ca. linje 593-598):

```typescript
const matrikkelXmlCache = new Map<...>();
const matrikkelCandidateCache = new Map<number, MatrikkelCandidate>();
const byggBruksenhetCache = new Map<number, BruksenhetInfo[]>();
// NYE CACHER:
const byggIdsCache = new Map<number, number[]>();
const byggInfoCache = new Map<number, ByggInfo & { id: number }>();
```

**4b.** Legg til to hjelpefunksjoner (etter `getMatrikkelInfo`):

```typescript
const getByggIdsForMatrikkelenhet = async (
  matrikkelenhetsId: number
): Promise<number[]> => {
  const cached = byggIdsCache.get(matrikkelenhetsId);
  if (cached) return cached;

  const ids = await withExternalMetrics(
    'bygning-service',
    'findByggForMatrikkelenhet',
    () => bygningClient.findByggForMatrikkelenhet(matrikkelenhetsId, ctx()),
    (result) => (result.length > 0 ? 'success' : 'not_found')
  );
  byggIdsCache.set(matrikkelenhetsId, ids);
  return ids;
};

const getByggInfo = async (byggId: number): Promise<ByggInfo & { id: number }> => {
  const cached = byggInfoCache.get(byggId);
  if (cached) return cached;

  const byggInfo = await withExternalMetrics(
    'store-service',
    'getObject',
    () => storeClient.getObject(byggId)
  );
  const result = { ...byggInfo, id: byggId };
  byggInfoCache.set(byggId, result);
  return result;
};
```

**4c.** Oppdater `analyzeMatrikkelenhet` (ca. linje 713-777):
Erstatt direkte `bygningClient.findByggForMatrikkelenhet`-kall med
`getByggIdsForMatrikkelenhet(id)`, og erstatt direkte
`storeClient.getObject(byggId)` med `getByggInfo(byggId)`.

**4d.** Oppdater byggIdListe-hentingen etter matrikkelenhet er valgt (ca. linje 963):
Erstatt:
```typescript
let byggIdListe = await withExternalMetrics(
  'bygning-service',
  'findByggForMatrikkelenhet',
  () => bygningClient.findByggForMatrikkelenhet(matrikkelenhetsId, ctx()),
  (result) => (result.length > 0 ? 'success' : 'not_found')
);
```
Med:
```typescript
let byggIdListe = await getByggIdsForMatrikkelenhet(matrikkelenhetsId);
```

**4e.** Oppdater bygg-info-hentingen (ca. linje 1015-1020):
Erstatt:
```typescript
for (const id of byggIdListe) {
  const byggInfo = await withExternalMetrics(
    'store-service',
    'getObject',
    () => storeClient.getObject(id)
  );
  allBygningsInfo.push({ ...byggInfo, id });
}
```
Med:
```typescript
// Parallelliser henting av bygg som ikke allerede er cachet
const uncachedByggIds = byggIdListe.filter((id) => !byggInfoCache.has(id));
if (uncachedByggIds.length > 0) {
  await Promise.all(uncachedByggIds.map((id) => getByggInfo(id)));
}

for (const id of byggIdListe) {
  const info = byggInfoCache.get(id);
  if (info) {
    allBygningsInfo.push(info);
  }
}
```

**Risiko:** Ingen. Cachene sikrer at identiske data returneres. Duplikate
nettverkskall elimineres.

---

### Endring 5: Parallelliser fetchEnergiattest og fetchSolarData

**Hvor:** Slutten av `resolveBuildingData`, ca. linje 1371-1436.

**Problem:** `fetchEnergiattest` og `fetchSolarData` kalles sekvensielt, men
er helt uavhengige av hverandre.

**Eksisterende kode:**
```typescript
const attest = await fetchEnergiattest({
  kommunenummer: adr.kommunenummer,
  gnr: adr.gnr,
  bnr: adr.bnr,
  seksjonsnummer: seksjonForEnova,
  bygningsnummer: bygg.bygningsnummer,
});

// ... CSV-data og koordinatberegning ...

const solarData = await fetchSolarData({
  byggId,
  byggNr: byggNrForSoloppslag,
  lat: latForSol,
  lon: lonForSol,
  gnr: adr.gnr,
  bnr: adr.bnr,
  seksjonsnummer: seksjonForEnova,
});
```

**Ny kode:** Flytt CSV-data og koordinatberegning (som er synkrone operasjoner)
FoR Promise.all-kallet, og kjor begge async-kall parallelt:

```typescript
// === CSV-data og koordinatberegning (synkront, uendret) ===
let csvBygningsNr: string | undefined;
// ... (eksisterende CSV-logikk, uendret) ...

const byggNrForSoloppslag = csvBygningsNr || bygg.bygningsnummer || undefined;

let latForKart: number | undefined;
let lonForKart: number | undefined;
// ... (eksisterende koordinatberegning, uendret) ...

const latForSol = csvBygningsNr ? undefined : latForKart;
const lonForSol = csvBygningsNr ? undefined : lonForKart;

// === Parallell henting av energiattest og soldata ===
const [attest, solarData] = await Promise.all([
  fetchEnergiattest({
    kommunenummer: adr.kommunenummer,
    gnr: adr.gnr,
    bnr: adr.bnr,
    seksjonsnummer: seksjonForEnova,
    bygningsnummer: bygg.bygningsnummer,
  }),
  fetchSolarData({
    byggId,
    byggNr: byggNrForSoloppslag,
    lat: latForSol,
    lon: lonForSol,
    gnr: adr.gnr,
    bnr: adr.bnr,
    seksjonsnummer: seksjonForEnova,
  }),
]);
```

**Merk:** Den synkrone koden mellom de to kallene (CSV-oppslag, koordinatberegning)
ma flyttes til FOR `Promise.all`-kallet. Denne koden avhenger av `bygg`-objektet
som allerede er tilgjengelig pa dette tidspunktet.

**Risiko:** Ingen. Kallene er uavhengige. `fetchEnergiattest` fanger egne feil
og returnerer `null` ved feil. `fetchSolarData` gjor det samme.

---

## Rekkefolgeavhengigheter

Endringene er uavhengige og kan implementeres enkeltvis, men gir best effekt
samlet. Den eneste rekkefolgeavhengigheten er:

- **Endring 4b** (hjelpefunksjoner) ma inn for **4c-4e** (bruk av dem).
- **Endring 5** krever at synkron kode flyttes opp, men dette er en
  ren rekkefolgejustering uten logikkendring.

## Validering etter implementering

Kjor testscriptet for a verifisere identiske resultater:

```bash
# Start solar-service forst
node --import tsx services/solar-service/index.ts &

# Kjor full test
node --import tsx scripts/test-parallel-lookup.ts
```

**Merk:** Etter implementering ma testscriptet oppdateres til a kalle
`resolveBuildingData` to ganger (i stedet for original + kandidat), eller
kandidatfilen kan slettes. Alternativt kan testscriptet beholdes som
regresjonstest ved framtidige endringer.

Kjor ogsa standardverifisering:
```bash
npm run typecheck && npm run lint && npm run test:unit
```

## Filer

| Fil | Rolle |
|-----|-------|
| `services/building-info-service/matrikkel.ts` | Produksjonskode (endres) |
| `scripts/test-parallel-lookup.ts` | Testscript (beholdes) |
| `scripts/parallel-lookup-candidate.ts` | Validert kandidat (referanse, kan slettes etter impl.) |
