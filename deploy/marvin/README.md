# Marvin-eksempler

Denne mappen samler eksempelmanifest for GitOps-teamet. Tilpass navn, namespace og labels før bruk.

## Innhold

- `namespace.yaml` – (valgfritt) namespace for løsningen.
- `secretstore.yaml` / `externalsecret.yaml` – henter secrets fra Key Vault via External Secrets Operator.
- `configmap.yaml` – miljøvariabler og konfigurasjon.
- `deployment.yaml` – kjører containeren med nødvendige porter og env.
- `service.yaml` – eksponerer podden internt.
- `servicemonitor.yaml` – Prometheus scraping av `/metrics`.
- `argocd-application.yaml` – Argo CD Application for tjenesten.
- `applicationset.yaml` – eksempel på ApplicationSet for flere miljø.

## Python-avhengighet

`api-server.mjs` kjører Python-script (`scripts/python/stotteordning_cache.py`). Imagen forventer at `python3` finnes i PATH. Hvis Marvin-miljøet mangler Python, legg til egen base (multi-stage med `apt-get install python3`) eller en initContainer som monterer internen Python-runtime. Miljøvariabelen `PYTHON_BINARY` kan peke på alternativ sti.

## Røyktest av Dockerimage

1. Bygg: `docker build -t energiveiledning:local .`
2. Kjør: `docker run --rm -p 14000:4000 -p 13001:3001 --env-file .env energiveiledning:local`
3. Verifiser:
   - `curl http://localhost:14000/health`
   - `curl http://localhost:13001/health`
   - stopp med `Ctrl+C`

Oppdater kommandoer/porter hvis manifestene endres.
