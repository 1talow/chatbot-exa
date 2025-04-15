@echo off
chcp 65001 >nul

echo =================================
echo 🔄 Sincronizando com o GitHub...
echo =================================

git add . >nul
git commit -m "💾 Salvando alterações locais automáticas" >nul 2>nul

git pull origin main --rebase

echo.
echo ✅ Sincronização concluída!
pause
