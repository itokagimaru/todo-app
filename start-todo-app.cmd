@echo off
chcp 65001 >nul
cd /d "%~dp0"

echo ============================================
echo  Todo アプリを起動します
echo ============================================
echo.

REM 初回のみ依存パッケージを自動インストール
if not exist "node_modules" (
  echo 初回セットアップ中（依存パッケージをインストール）...
  call npm install
  echo.
)

echo ブラウザが自動で開きます。
echo このウィンドウを閉じるとアプリは停止します。
echo （閉じても保存済みデータは消えません）
echo.

REM 開発サーバーを起動し、ブラウザを自動で開く（http://localhost:3000）
call npm run dev -- --open
