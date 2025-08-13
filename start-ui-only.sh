#!/bin/bash
# Start only the UI with required backend services

echo "🚀 Starting Adresseoppslag UI with backend services..."
echo ""

# Kill existing processes
echo "🧹 Cleaning up..."
pkill -f "node.*api-server" 2>/dev/null || true
pkill -f "node.*building-info-service" 2>/dev/null || true
pkill -f "node.*solar-service" 2>/dev/null || true
pkill -f "vite" 2>/dev/null || true
sleep 1

# Load environment variables
export $(grep -v '^#' .env | xargs)

# Check if Python is available
if ! command -v python &> /dev/null; then
    echo "❌ Python is not installed or not in PATH!"
    echo "   Støtteordninger API will not work properly."
    echo ""
fi

# Start building-info-service
echo "🏢 Starting building-info-service on port 4000..."
LOG_SOAP=1 npx tsx services/building-info-service/index.ts &
BUILDING_PID=$!

# Start solar-service
echo "☀️  Starting solar-service on port 4003..."
PORT=4003 node services/solar-service/index.js &
SOLAR_PID=$!

# Start API server
echo "🔧 Starting API server on port 3001..."
echo "  USERNAME: ${MATRIKKEL_USERNAME:0:10}..."
echo "  BASE_URL: $MATRIKKEL_API_BASE_URL_PROD"
LIVE=1 npx tsx src/api-server.ts &
API_PID=$!

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
echo "📊 Støtteordninger: http://localhost:3001/api/stotteordninger"
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
trap 'echo ""; echo "🛑 Stopping all services..."; kill $API_PID $BUILDING_PID $SOLAR_PID 2>/dev/null || true; exit' INT TERM

# Start only vite
npm run dev:client

# Cleanup
kill $API_PID $BUILDING_PID $SOLAR_PID 2>/dev/null || true