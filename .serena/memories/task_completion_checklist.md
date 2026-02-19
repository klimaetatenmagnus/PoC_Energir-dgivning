# Task Completion Checklist

When completing a coding task, run these checks:

1. **Type check**: `npm run typecheck`
2. **Lint**: `npm run lint`
3. **Unit tests**: `npm run test:unit`
4. **Contract tests** (if backend changes): `npm run test:contract`

Or use the combined command:
- `npm run verify` (typecheck + lint + contract + smoke)

## Notes
- Known failing tests in `tests/unit/building-selection/garage-filtering.test.ts` (2 tests expect "skip" but get "exclude") - pre-existing
- Zero warnings policy for lint - all warnings must be resolved
- Integration and e2e tests require `LIVE=1` env var (access to external APIs)
