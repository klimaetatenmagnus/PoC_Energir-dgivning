# Energinøkkelen - Claude Code Instructions

## Serena (MCP)

Ved oppstart av hver sesjon, kjør Serena onboarding:

1. Aktiver prosjektet: `activate_project` med path `/Users/magnuslundstein/PoC_Energir-dgivning`
2. Sjekk onboarding-status: `check_onboarding_performed`
3. Hvis onboarding ikke er gjort, kjør `onboarding` og følg instruksjonene
4. Les relevante Serena-minner for kontekst om prosjektet

Bruk Serenas symbolske verktøy (`find_symbol`, `get_symbols_overview`, `replace_symbol_body` etc.) for presis kodenavigasjon og redigering fremfor å lese hele filer unødvendig.

## Prosjekt

- **Språk**: Norsk i kommentarer og commit-meldinger, engelsk i kode
- **Design system**: Oslo Kommune Punkt (@oslokommune/punkt-react v13)
- **Null-advarsler**: ESLint kjøres med `--max-warnings 0`

## Kvalitetssjekk etter endringer

Kjør før commit:
```bash
npm run typecheck && npm run lint && npm run test:unit
```

Eller fullstendig:
```bash
npm run verify
```

## Kjente problemer

- `tests/unit/building-selection/garage-filtering.test.ts` har 2 feilende tester (pre-eksisterende)
