# Test-struktur

## Oversikt

Testene er organisert i følgende kategorier:

- `unit/` - Isolerte enhetstester for funksjoner og klasser
- `integration/` - Integrasjonstester mot eksterne APIer (Matrikkel, Solar)
- `e2e/` - Ende-til-ende-tester med kjente adresser
- `fixtures/` - Testdata og hjelpefunksjoner

## Mappestruktur

```
tests/
├── unit/
│   ├── building-selection/
│   │   ├── borettslag-strategy.test.ts
│   │   └── garage-filtering.test.ts
│   └── utils/
│       └── xml-parsing.test.ts
├── integration/
│   ├── building-info-service/
│   │   └── building-selection.test.ts
│   ├── matrikkel/
│   │   ├── matrikkel-client.test.ts
│   │   ├── matrikkel-lookup.test.ts
│   │   ├── section-handling.test.ts
│   │   └── soap-client.test.ts
│   ├── solar-service/
│   │   └── solar-validation.test.ts
│   └── address-lookup/
│       ├── csv-comparison.test.ts
│       └── api-logic-validation.test.ts
├── e2e/
│   └── known-addresses/
│       ├── kapellveien-156.test.ts
│       ├── kjelsasveien-97.test.ts
│       └── edge-cases.test.ts
├── fixtures/
│   ├── addresses.ts
│   ├── expected-results.ts
│   ├── matrikkel-context.ts
│   └── extract-addresses.ts
├── setup.ts
└── README.md
```

## Kjøre tester

### Alle tester
```bash
npm run test:unit          # Kjør enhetstester
npm run test:integration   # Kjør integrasjonstester (krever API-tilgang)
npm run test:e2e           # Kjør E2E-tester
npm run test:all           # Kjør alle tester
npm run test:watch         # Watch mode
```

### Kontrakttester (i scripts/)
```bash
npm run test:contract      # Kjør kontrakttester med nock-mocking
npm run test:full-chain    # Kjør full kjede-test (spawner tjenester)
npm run test:smoke         # Kjør smoke-test mot API
```

### Verifisering
```bash
npm run verify             # Kjør typecheck, lint, contract og smoke
```

## Miljøvariabler

Integrasjons- og E2E-tester krever følgende miljøvariabler:

```env
# Matrikkel API (kanonisk navngivning - bruk disse)
MATRIKKEL_API_BASE_URL_PROD=https://www.matrikkel.no/matrikkelapi/wsapi/v1
MATRIKKEL_USERNAME=<brukernavn>
MATRIKKEL_PASSWORD=<passord>

# Matrikkel SOAP (for soap-client.test.ts)
MATRIKKEL_WSDL=<wsdl-url>
MATRIKKEL_ENDPOINT=<endpoint-url>  # valgfritt

# Test-miljø varianter (valgfritt - brukes som fallback)
MATRIKKEL_API_BASE_URL_TEST=<test-url>
MATRIKKEL_USERNAME_TEST=<test-brukernavn>

# Solar Service
SOLAR_SERVICE_BASE_URL=http://localhost:4003

# Enova (valgfritt)
ENOVA_API_KEY=<api-nokkel>
```

**VIKTIG**: Alle Matrikkel-tester bruker `MATRIKKEL_USERNAME` og `MATRIKKEL_PASSWORD`.
Eldre varianter som `MATRIKKEL_USER` og `MATRIKKEL_PASS` er fjernet for konsistens.

## Live-modus

For å kjøre tester mot live APIer, sett `LIVE=1`:

```bash
LIVE=1 npm run test:integration
```

Uten `LIVE=1` vil tester som krever API-tilgang bli hoppet over.

### Parallellisering

- **Unit-tester** (`npm run test:unit`): Kjøres parallelt for best ytelse
- **Live-tester** (`LIVE=1`): Kjøres sekvensielt (singleFork) for å unngå API-overbelastning

`vitest.config.backend.ts` sjekker `LIVE`-miljøvariabelen og aktiverer singleFork kun ved live-testing.

## Testkonvensjoner

### Navngivning
- Testfiler: `*.test.ts`
- Fixtures: Beskrivende navn i `fixtures/`

### Struktur
- Bruk `describe` for å gruppere relaterte tester
- Bruk `beforeAll` for å sette opp delte ressurser
- Bruk `it.each` for parametriserte tester

### Skip-logikk
```typescript
const LIVE = process.env.LIVE === "1";

describe.skipIf(!LIVE)("Integration tests", () => {
  // Tester som krever live API
});
```

## Migrert fra scripts/

Følgende filer ble konsolidert til tests/:

### E2E-tester (6 Kapellveien + 3 Kjelsåsveien + 3 edge cases → 3 filer)
- `test-kapellveien-*.ts` → `tests/e2e/known-addresses/kapellveien-156.test.ts`
- `test-kjelsasveien-*.ts` → `tests/e2e/known-addresses/kjelsasveien-97.test.ts`
- `test-hesteskoen-4.ts`, `test-fallanveien.ts`, `test-enova-lyseveien.ts` → `tests/e2e/known-addresses/edge-cases.test.ts`

### Integration-tester
- `test-improved-*.ts` → `tests/integration/building-info-service/building-selection.test.ts`
- `test-matrikkel*.ts` → `tests/integration/matrikkel/`
- `test-section-*.ts` → `tests/integration/matrikkel/section-handling.test.ts`
- `test-soldata-validation.ts` → `tests/integration/solar-service/solar-validation.test.ts`
- `compare-*.cjs` → `tests/integration/address-lookup/`

### Unit-tester
- `test-borettslag-strategy.ts` → `tests/unit/building-selection/borettslag-strategy.test.ts`
- `test-garage-filtering.ts` → `tests/unit/building-selection/garage-filtering.test.ts`
- `test-xml-parsing.ts` → `tests/unit/utils/xml-parsing.test.ts`

### Fixtures
- `test-utils.ts` → `tests/fixtures/matrikkel-context.ts`
- `.cjs`-filer → TypeScript i `tests/fixtures/`

## Kritiske tester beholdt i scripts/

Følgende tester forblir i `scripts/` fordi de har spesielle krav:

- `test-contract-matrikkel.ts` - Kontrakttester med nock-mocking
- `test-contract-resultAssembler.ts` - Kontrakttester med nock-mocking
- `test-full-chain.ts` - E2E-test som spawner tjenester
- `test-api-smoke.ts` - Smoke-test mot live API
