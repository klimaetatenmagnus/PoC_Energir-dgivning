# syntax=docker/dockerfile:1

FROM node:20-bookworm-slim AS base
WORKDIR /app

FROM base AS deps
ENV NODE_ENV=development
COPY package.json package-lock.json ./
RUN npm ci

FROM deps AS build
COPY . .
RUN npm run build:prod
RUN npm prune --omit=dev

FROM base AS runtime
ENV NODE_ENV=production
WORKDIR /app

COPY --from=build /app/package.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build ["/app/Matrikkel 2023.csv", "./Matrikkel 2023.csv"]
COPY --from=build ["/app/stotteordninger_data.json", "./stotteordninger_data.json"]
COPY --from=build ["/app/stotteordning_cache.py", "./stotteordning_cache.py"]

# Optional static artefacts (frontend, metrics docs, etc.)
COPY --from=build /app/public ./public

EXPOSE 3001 4000

CMD ["node", "./dist/backend/building-info-service.mjs"]
