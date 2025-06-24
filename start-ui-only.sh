#!/bin/bash
# Start only the UI with API backend

echo "🚀 Starting Adresseoppslag UI..."
echo ""

# Kill existing processes
echo "🧹 Cleaning up..."
pkill -f "node.*api-server" 2>/dev/null || true
pkill -f "vite" 2>/dev/null || true
sleep 1

# Start API server
echo "🔧 Starting API server on port 3001..."
LIVE=1 npx tsx src/api-server.ts &
API_PID=$!

# Wait for API
echo "⏳ Waiting for API..."
sleep 3

# Start ONLY Vite (not the full dev stack)
echo "🎨 Starting UI on port 5173..."
echo ""
echo "================================================"
echo "✅ Ready!"
echo ""
echo "🌐 Open in browser: http://localhost:5173"
echo "🔌 API running on: http://localhost:3001"
echo ""
echo "📋 Test addresses:"
echo "  - Kapellveien 156B, 0493 Oslo"
echo "  - Kapellveien 156C, 0493 Oslo"
echo ""
echo "Press Ctrl+C to stop"
echo "================================================"
echo ""

# Start only vite
pnpm run dev:client

# Cleanup
kill $API_PID 2>/dev/null || true