@echo off
echo Starting Adresseoppslag UI with backend services...
echo.

REM Kill existing processes
echo Cleaning up...
taskkill /F /IM node.exe /FI "WINDOWTITLE eq *api-server*" 2>nul
taskkill /F /IM node.exe /FI "WINDOWTITLE eq *building-info*" 2>nul
taskkill /F /IM node.exe /FI "WINDOWTITLE eq *solar-service*" 2>nul
taskkill /F /IM node.exe /FI "WINDOWTITLE eq *vite*" 2>nul
timeout /t 1 /nobreak >nul

REM Load environment variables from .env file
for /f "delims=" %%x in (.env) do (set "%%x")

REM Check if Python is available
where python >nul 2>nul
if errorlevel 1 (
    echo WARNING: Python is not installed or not in PATH!
    echo          Stotteordninger API will not work properly.
    echo.
)

REM Start building-info-service
echo Starting building-info-service on port 4000...
start "building-info-service" cmd /c "set LOG_SOAP=1 && npx tsx services/building-info-service/index.ts"

REM Start solar-service
echo Starting solar-service on port 4003...
start "solar-service" cmd /c "set PORT=4003 && node services/solar-service/index.js"

REM Start API server
echo Starting API server on port 3001...
start "api-server" cmd /c "set LIVE=1 && npx tsx src/api-server.ts"

REM Wait for services
echo Waiting for services to start...
timeout /t 5 /nobreak >nul

REM Start UI
echo Starting UI on port 5173...
echo.
echo ================================================
echo Ready! All services are running:
echo.
echo   UI: http://localhost:5173
echo   API: http://localhost:3001
echo   Building Service: http://localhost:4000
echo   Solar Service: http://localhost:4003
echo   Stotteordninger: http://localhost:3001/api/stotteordninger
echo.
echo Test addresses:
echo   - Rosenholmveien 25, Oslo
echo   - Lyseveien 3, Oslo
echo   - Kapellveien 156B, 0493 Oslo
echo.
echo Solenergi-data vises naa i soekeresultatene!
echo.
echo Press Ctrl+C to stop all services
echo ================================================
echo.

REM Start vite
call npm run dev:client

REM Cleanup when vite exits
echo.
echo Stopping all services...
taskkill /F /IM node.exe /FI "WINDOWTITLE eq *api-server*" 2>nul
taskkill /F /IM node.exe /FI "WINDOWTITLE eq *building-info*" 2>nul
taskkill /F /IM node.exe /FI "WINDOWTITLE eq *solar-service*" 2>nul