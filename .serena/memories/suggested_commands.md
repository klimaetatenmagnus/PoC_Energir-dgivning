# Suggested Commands

## Development
- `npm run dev` - Start all services (client + server + buildings + solar) concurrently
- `npm run dev:local` - Start with test API (no live external APIs)
- `npm run dev:client` - Start only Vite frontend dev server
- `npm run dev:server` - Start only Express gateway server
- `npm run dev:buildings` - Start only building-info-service
- `npm run dev:solar` - Start only solar-service

## Build
- `npm run build` - Build frontend (sync assets + tsc + vite build)
- `npm run build:backend` - Build backend services (esbuild)
- `npm run build:prod` - Full production build (frontend + backend)

## Testing
- `npm run test:unit` - Run unit tests (vitest)
- `npm run test:integration` - Run integration tests (requires LIVE=1)
- `npm run test:e2e` - Run end-to-end tests (requires LIVE=1)
- `npm run test:all` - Run all test suites sequentially
- `npm run test:watch` - Watch mode for tests
- `npm run test:smoke` - API smoke tests
- `npm run test:contract` - Contract tests for matrikkel + resultAssembler

## Quality
- `npm run typecheck` - TypeScript type checking (tsc --noEmit)
- `npm run lint` - ESLint (zero warnings policy)
- `npm run verify` - Full verification: typecheck + lint + contract + smoke tests

## Storybook
- `npm run storybook` - Start Storybook dev server (port 6006)
- `npm run build-storybook` - Build static Storybook

## Content
- `npm run content:validate` - Validate CMS content
- `npm run content:publish` - Publish content updates
