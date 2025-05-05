@echo off
chcp 65001 >nul

echo =================================
echo 🔄 Sincronizando com o GitHub...
echo =================================

REM Verifica se há alterações pendentes
git diff --quiet
IF ERRORLEVEL 1 (
    echo ⚠️  Existem alterações locais não comitadas.
    echo 💡 Por favor, faça commit ou stash antes de sincronizar.
    goto end
)

REM Tenta fazer pull com rebase
git pull origin main --rebase
IF %ERRORLEVEL% NEQ 0 (
    echo ❌ Erro ao sincronizar com o GitHub.
    goto end
)

echo ✅ Tudo sincronizado com sucesso!

:end
echo.
pause