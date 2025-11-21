# syntax=docker/dockerfile:1

FROM node:20-bookworm-slim AS base
WORKDIR /app

FROM base AS deps
ENV NODE_ENV=development
COPY package.json package-lock.json ./
RUN npm ci

FROM deps AS build
ARG VITE_BASE_PATH="/"
ENV VITE_BASE_PATH=${VITE_BASE_PATH}
COPY . .
RUN npm run build:prod
RUN npm prune --omit=dev

FROM base AS runtime
ENV NODE_ENV=production
WORKDIR /app

# Install Python runtime and dependencies for support scripts
COPY --from=build /app/python/requirements.txt ./python/requirements.txt
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 python3-pip \
  && python3 -m pip install --no-cache-dir --requirement python/requirements.txt --target /opt/python \
  && rm -rf /var/lib/apt/lists/*

ENV PYTHONPATH=/opt/python \
    PYTHON_BINARY=/usr/bin/python3 \
    LC_ALL=C.UTF-8 \
    LANG=C.UTF-8 \
    PYTHONIOENCODING=utf-8

COPY --from=build /app/package.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/data ./data
COPY --from=build /app/scripts/python ./scripts/python
COPY --from=build /app/content ./content
COPY --from=build /app/services ./services

# Optional static artefacts (frontend, metrics docs, etc.)
COPY --from=build /app/public ./public

EXPOSE 3001 4000

CMD ["node", "./dist/backend/building-info-service.mjs"]
