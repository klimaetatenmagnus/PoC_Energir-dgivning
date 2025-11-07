#!/usr/bin/env bash

set -euo pipefail

readonly script_name="$(basename "$0")"

err() {
  echo "[$script_name] $*" >&2
}

if [[ $# -lt 1 ]]; then
  err "usage: $script_name <url-map>"
  err "optionally provide CDN_PATHS env (comma-separated) and set CDN_DRY_RUN=true for dry run"
  exit 1
fi

url_map="$1"
shift || true

project="${PROJECT_ID:-}"
if [[ -z "$project" ]]; then
  err "PROJECT_ID environment variable must be set (Cloud Build exposes this automatically)."
  exit 2
fi

# Allow overriding paths through CDN_PATHS (comma-separated)
path_overrides=()
if [[ -n "${CDN_PATHS:-}" ]]; then
  IFS=',' read -r -a path_overrides <<< "${CDN_PATHS}"
fi

paths=()
if [[ ${#path_overrides[@]} -gt 0 ]]; then
  for path in "${path_overrides[@]}"; do
    trimmed="$(echo "$path" | xargs)"
    if [[ -n "$trimmed" ]]; then
      paths+=("$trimmed")
    fi
  done
fi

if [[ ${#paths[@]} -eq 0 ]]; then
  paths=("/index.html" "/config/*" "/assets/*" "/*")
fi

dry_run="${CDN_DRY_RUN:-false}"

cmd=(gcloud compute url-maps invalidate-cdn-cache "$url_map" "--project=${project}" "--async")
for path in "${paths[@]}"; do
  cmd+=("--path=${path}")
done

echo "[$script_name] invalidating CDN cache on url map '${url_map}' (project: ${project}) for paths: ${paths[*]}"

if [[ "$dry_run" == "true" || "$dry_run" == "1" ]]; then
  echo "[$script_name] dry-run enabled; command not executed:"
  printf '  %q' "${cmd[@]}"
  echo
  exit 0
fi

"${cmd[@]}"

echo "[$script_name] invalidate-cdn-cache command submitted (asynchronous)."
