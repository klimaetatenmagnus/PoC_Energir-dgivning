# Code Style and Conventions

## TypeScript
- Strict mode enabled (`strict: true` in tsconfig)
- `noUnusedLocals` and `noUnusedParameters` enforced
- ES Modules (`"type": "module"` in package.json)
- Target: ES2020, JSX: react-jsx
- Unused vars prefixed with `_` are allowed (`argsIgnorePattern: "^_"`)

## ESLint Rules
- `no-console`: warn (except `console.warn` and `console.error`)
- `@typescript-eslint/no-explicit-any`: off in test files
- `react-hooks/rules-of-hooks`: error
- `react-hooks/exhaustive-deps`: warn
- `react-refresh/only-export-components`: warn
- Zero warnings policy in lint command (`--max-warnings 0`)

## Naming
- Files: PascalCase for components (e.g. `AddressSearch.tsx`), kebab-case for services
- Components: PascalCase
- Variables/functions: camelCase
- Types/Interfaces: PascalCase

## Frontend Patterns
- Oslo Kommune Punkt design system components
- SWR for data fetching
- Zod for runtime validation
- Framer Motion for animations
- Tailwind CSS 4 for styling

## Backend Patterns
- Express 5 microservices
- SOAP integration via `soap` and `fast-xml-parser`
- `cross-env` for environment variables
- `ts-node` with SWC for fast TypeScript execution in dev

## Testing
- Vitest for all test types (unit, integration, e2e)
- Separate backend vitest config (`vitest.config.backend.ts`)
- Test files in `tests/` directory (not co-located)
- Nock for HTTP mocking
