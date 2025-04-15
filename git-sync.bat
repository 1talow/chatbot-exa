@echo off
chcp 65001 >nul
echo =================================
echo 🔄 Sincronizando com o GitHub...
echo =================================

git pull origin main --rebase

echo.
echo ✅ Sincronização concluída!
pause