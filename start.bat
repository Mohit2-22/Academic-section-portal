@echo off
echo ========================================
echo  TechPro Institute Management System
echo ========================================
echo.
echo Starting Backend (Flask) on port 5000...
echo Starting Frontend (Vite+React) on port 5173...
echo.
echo Open http://localhost:5173 in your browser
echo.

start "Flask Backend" cmd /c "cd /d C:\computer_institute_app\backend && python app.py"
timeout /t 3 >nul
start "React Frontend" cmd /c "cd /d C:\computer_institute_app\react-frontend && npm run dev -- --host"

echo.
echo Both servers starting...
echo Flask API: http://localhost:5000
echo React App: http://localhost:5173
echo.
echo Login Credentials:
echo   Student     : aman.kumar / student123
echo   Faculty     : dr_amit    / faculty123
echo   Admin       : admin1     / admin123
echo   Admission   : admission1 / staff123
echo   Super Admin : superadmin / superadmin123
echo.
pause
