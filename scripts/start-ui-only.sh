#!/bin/bash
# Start only the UI with required backend services

set -euo pipefail

# Ensure Homebrew and nvm paths are available
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
if [ -s "$HOME/.nvm/nvm.sh" ]; then
  source "$HOME/.nvm/nvm.sh"
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

cd "${ROOT_DIR}"

echo "🚀 Starting Adresseoppslag UI with backend services..."
echo ""

# Kill existing processes
echo "🧹 Cleaning up..."
pkill -f "node.*api-server" 2>/dev/null || true
pkill -f "node.*building-info-service" 2>/dev/null || true
pkill -f "node.*solar-service" 2>/dev/null || true
pkill -f "node.*services/admin-api" 2>/dev/null || true
pkill -f "vite" 2>/dev/null || true
sleep 1

# Load environment variables if present
if [ -f "${ROOT_DIR}/.env" ]; then
  # shellcheck disable=SC1090
  set -a
  source "${ROOT_DIR}/.env"
  set +a
fi

# Default admin preview content bases (can be overridden before running)
# Primær base peker lokalt gjennom Vite-proxy (/config -> http://localhost:3001)
export VITE_ADMIN_STAGING_CONTENT_BASE="${VITE_ADMIN_STAGING_CONTENT_BASE:-/config/content}"
export VITE_ADMIN_STAGING_FALLBACK_BASE="${VITE_ADMIN_STAGING_FALLBACK_BASE:-https://staging.xn--energinkkelen-hnb.no/config/content}"
export VITE_ADMIN_PROD_CONTENT_BASE="${VITE_ADMIN_PROD_CONTENT_BASE:-/config/content}"
export VITE_ADMIN_PROD_FALLBACK_BASE="${VITE_ADMIN_PROD_FALLBACK_BASE:-https://energinokkelen.no/config/content}"

# Default admin-API konfig til lokale dummyverdier slik at vi slipper ekte GCP-tilganger.
LOCAL_CONTENT_ROOT="${ROOT_DIR}/content"
LOCAL_LOG_DIR="${LOCAL_CONTENT_ROOT}/logs"
mkdir -p "${LOCAL_LOG_DIR}"

export ADMIN_CLOUD_BUILD_PROJECT="${ADMIN_CLOUD_BUILD_PROJECT:-local-dev}"
export GOOGLE_CLOUD_PROJECT="${GOOGLE_CLOUD_PROJECT:-$ADMIN_CLOUD_BUILD_PROJECT}"
export ADMIN_CLOUD_BUILD_LOCATION="${ADMIN_CLOUD_BUILD_LOCATION:-local}"
export ADMIN_CONTENT_STAGING_PREFIX="${ADMIN_CONTENT_STAGING_PREFIX:-$LOCAL_CONTENT_ROOT}"
export ADMIN_CONTENT_PROD_PREFIX="${ADMIN_CONTENT_PROD_PREFIX:-$LOCAL_CONTENT_ROOT}"
export ADMIN_CONTENT_LOG_PREFIX="${ADMIN_CONTENT_LOG_PREFIX:-$LOCAL_LOG_DIR}"
export ADMIN_CONTENT_PUBLISHER_SERVICE_ACCOUNT="${ADMIN_CONTENT_PUBLISHER_SERVICE_ACCOUNT:-content-admin@local-dev.iam.gserviceaccount.com}"
export ADMIN_API_PORT="${ADMIN_API_PORT:-4100}"

# Mirror Punkt-ikonene til public slik at pkt-icon kan lastes lokalt.
echo "📦 Syncing Punkt-ikoner til public/punkt-assets ..."
rsync -a --delete "${ROOT_DIR}/node_modules/@oslokommune/punkt-assets/dist/icons/" \
  "${ROOT_DIR}/public/punkt-assets/icons/"

# Check if Python is available
if ! command -v python &> /dev/null && ! command -v python3 &> /dev/null; then
    echo "❌ Python is not installed or not in PATH!"
    echo "   Støtteordninger API will not work properly."
    echo ""
fi

# Start building-info-service
echo "🏢 Starting building-info-service on port 4000..."
API_ENV=prod LIVE=1 LOG_SOAP=1 npx tsx services/building-info-service/index.ts &
BUILDING_PID=$!

# Start solar-service
echo "☀️  Starting solar-service on port 4003..."
API_ENV=prod PORT=4003 npx tsx services/solar-service/index.ts &
SOLAR_PID=$!

# Start API server
echo "🔧 Starting API server on port 3001..."
echo "  USERNAME: ${MATRIKKEL_USERNAME:0:10}..."
echo "  BASE_URL: $MATRIKKEL_API_BASE_URL_PROD"
API_ENV=prod LIVE=1 npx tsx src/api-server.ts &
API_PID=$!

# Start admin API
echo "🛠️ Starting admin API on port ${ADMIN_API_PORT}..."
npx tsx services/admin-api/index.ts &
ADMIN_API_PID=$!

# Wait for services
echo "⏳ Waiting for services to start..."
sleep 5

# Start ONLY Vite (not the full dev stack)
echo "🎨 Starting UI on port 5173..."
echo ""
echo "================================================"
echo "✅ Ready! All services are running:"
echo ""
echo "🌐 UI: http://localhost:5173"
echo "🔌 API: http://localhost:3001"
echo "🏢 Building Service: http://localhost:4000"
echo "☀️  Solar Service: http://localhost:4003"
echo "🔐 Admin API: http://localhost:4100/admin/api"
echo ""
echo "📋 Test addresses:"
echo "  - Rosenholmveien 25, Oslo"
echo "  - Kapellveien 156B, 0493 Oslo"
echo "  - Kjelsåsveien 143A, Oslo"
echo ""
echo "🔍 Solenergi-data vises nå i søkeresultatene!"
echo ""
echo "Press Ctrl+C to stop all services"
echo "================================================"
echo ""

# Trap to cleanup all services on exit
trap 'echo ""; echo "🛑 Stopping all services..."; kill $API_PID $BUILDING_PID $SOLAR_PID $ADMIN_API_PID 2>/dev/null || true; exit' INT TERM

# Start only vite
npm run dev:client

# Cleanup
kill $API_PID $BUILDING_PID $SOLAR_PID $ADMIN_API_PID 2>/dev/null || true
