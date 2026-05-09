@echo off
echo Starting Django server (fast mode)...
cd /d %~dp0
set DJANGO_SETTINGS_MODULE=ampics.settings
python manage.py runserver 0.0.0.0:8000 --noreload
pause
