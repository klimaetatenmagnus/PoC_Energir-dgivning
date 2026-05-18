#!/usr/bin/env bash
#
# Tvinger ny revisjon av Cloud Run-tjenester slik at de plukker opp siste
# versjon av Secret Manager-secrets som er mappet via `:latest`.
#
# Brukes f.eks. ved passord-rotasjon (MATRIKKEL_PASSWORD, GRUNNBOK_PASSWORD).
# `services replace` med uendret `spec.template` lager ingen ny revisjon
# fordi Cloud Run dedupliserer. Dette scriptet legger til en `rotated-at`-
# label på revision-templaten, som tvinger fram en ny revisjon. Den nye
# revisjonen leser `MATRIKKEL_PASSWORD:latest` (og andre `:latest`-secrets)
# på nytt fra Secret Manager ved start.
#
# Merk: `gcloud run services update --update-secrets` krasjer på dagens
# `run.googleapis.com/secrets`-annotasjon (mangler `/versions/<v>`). Bruk
# dette scriptet i stedet for å rulle ny secret-versjon ut i prod.
#
# Bruk:
#   bash scripts/force-cloudrun-revision.sh
#
# Egendefinerte tjenester / prosjekt / region:
#   SERVICES="energinokkelen-prod" \
#   PROJECT=energiverktoy-poc-1234 \
#   REGION=europe-north1 \
#     bash scripts/force-cloudrun-revision.sh
#
# Forutsetninger: gcloud autentisert, python3 med pyyaml.

set -euo pipefail

PROJECT="${PROJECT:-energiverktoy-poc-1234}"
REGION="${REGION:-europe-north1}"
SERVICES="${SERVICES:-energinokkelen-prod energinokkelen}"
TS="$(date -u +%Y%m%d-%H%M%S)"
TMPDIR="$(mktemp -d)"
trap 'rm -rf "$TMPDIR"' EXIT

if ! command -v python3 >/dev/null; then
  echo "FEIL: python3 ikke funnet" >&2
  exit 1
fi
if ! python3 -c "import yaml" >/dev/null 2>&1; then
  echo "FEIL: python3 mangler pyyaml. Installer med: pip3 install pyyaml" >&2
  exit 1
fi

for SVC in $SERVICES; do
  echo
  echo "=== $SVC ==="
  YAML="$TMPDIR/svc-$SVC.yaml"

  before="$(gcloud run services describe "$SVC" \
    --region="$REGION" --project="$PROJECT" \
    --format='value(status.latestReadyRevisionName)')"
  echo "Forrige revisjon: $before"

  gcloud run services describe "$SVC" \
    --region="$REGION" --project="$PROJECT" \
    --format=export > "$YAML"

  TS="$TS" python3 - "$YAML" <<'PY'
import os, sys, yaml
path = sys.argv[1]
ts = os.environ["TS"]
with open(path) as f:
    d = yaml.safe_load(f)
tmpl = d["spec"]["template"].setdefault("metadata", {})
tmpl.setdefault("labels", {})["rotated-at"] = ts
with open(path, "w") as f:
    yaml.safe_dump(d, f, sort_keys=False)
PY

  gcloud run services replace "$YAML" \
    --region="$REGION" --project="$PROJECT"

  after="$(gcloud run services describe "$SVC" \
    --region="$REGION" --project="$PROJECT" \
    --format='value(status.latestReadyRevisionName)')"
  echo "Ny revisjon:      $after"

  if [[ "$before" == "$after" ]]; then
    echo "ADVARSEL: revisjonsnavn uendret — sjekk at template ble modifisert." >&2
  fi
done

echo
echo "Ferdig. Verifiser at ny revisjon ruter 100% trafikk og at $SERVICES svarer normalt."
