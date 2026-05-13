@echo off
echo FinGPT X — Starting Services
echo ============================

echo.
echo [1/3] Starting Ollama...
start "Ollama" cmd /k "ollama serve"
timeout /t 2 >nul

echo [2/3] Starting FastAPI backend...
start "FinGPT API" cmd /k "cd /d %~dp0apps\api && .venv\Scripts\activate && uvicorn main:app --reload --host 0.0.0.0 --port 8000"
timeout /t 3 >nul

echo [3/3] Starting Next.js frontend...
start "FinGPT Web" cmd /k "cd /d %~dp0apps\web && npm run dev"

echo.
echo All services starting...
echo Frontend: http://localhost:3000
echo API Docs:  http://localhost:8000/docs
echo.
pause
