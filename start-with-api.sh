#!/bin/bash
# Script to start both API server and frontend

echo "🚀 Starting Adresseoppslag UI with API backend..."
echo ""

# Kill any existing processes on our ports
echo "🧹 Cleaning up old processes..."
lsof -ti:3001 | xargs kill -9 2>/dev/null || true
lsof -ti:5173 | xargs kill -9 2>/dev/null || true

# Start API server in background
echo "🔧 Starting API server on port 3001..."
LIVE=1 npx tsx src/api-server.ts &
API_PID=$!

# Wait for API to be ready
echo "⏳ Waiting for API server to start..."
sleep 3

# Start Vite dev server
echo "🎨 Starting UI on port 5173..."
echo ""
echo "================================================"
echo "✅ Ready!"
echo ""
echo "🌐 UI: http://localhost:5173"
echo "🔌 API: http://localhost:3001"
echo ""
echo "📋 Test addresses:"
echo "  - Kapellveien 156B, 0493 Oslo"
echo "  - Kapellveien 156C, 0493 Oslo"
echo "  - Kjelsåsveien 97B, 0491 Oslo"
echo ""
echo "Press Ctrl+C to stop both servers"
echo "================================================"
echo ""

# Start Vite (this will block)
pnpm run dev

# Cleanup on exit
kill $API_PID 2>/dev/null || true