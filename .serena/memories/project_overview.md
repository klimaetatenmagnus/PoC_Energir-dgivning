# Energinøkkelen - Project Overview

## Purpose
Energinøkkelen (Energy Key) is a PoC web application for Oslo Kommune that helps citizens look up energy ratings and improvement suggestions for buildings. Users search by address, the app retrieves building data from the Norwegian Matrikkel registry (via SOAP API), and presents energy analysis results with upgrade recommendations.

## Tech Stack
- **Frontend**: React 19, Vite 7, TypeScript 5.9, Tailwind CSS 4, Framer Motion
- **Design system**: Oslo Kommune's Punkt (@oslokommune/punkt-react v13)
- **Backend**: Express 5 (Node.js), multiple microservices
- **Data**: CSV/JSON matrikkel data, SOAP API integration, GCS bucket for large files
- **Testing**: Vitest, Storybook 10, Playwright
- **Deployment**: Docker → Google Cloud Run via Cloud Build
- **Other**: Zod (validation), SWR (data fetching), proj4 (coordinate conversion)

## Architecture
- **Monorepo** with frontend (src/) and multiple backend services (services/)
- `server/index.ts` - Main Express server (proxy/gateway)
- `services/building-info-service/` - Matrikkel lookup, building data
- `services/solar-service/` - Solar energy calculations
- `services/admin-api/` - Admin endpoints
- `services/shared/` - Shared utilities across services
- `src/` - React frontend application
  - `src/components/FigmaBlokk/` - Main UI components (Figma-based design)
  - `src/components/mobile/` - Mobile-specific components
  - `src/hooks/` - React hooks
  - `src/services/` - Frontend service layer
  - `src/types/` - TypeScript type definitions

## Deployment
- GCP project: `energiverktoy-poc-1234`, region: `europe-north1`
- Cloud Build from `deploy/gcp` (staging) and `main` (prod)
- Data bucket: `gs://energinokkelen-data`
