#!/usr/bin/env bash
# WaterWise full deploy — run on the Linux server from the project root.
# Usage:
#   chmod +x deploy.sh
#   ./deploy.sh
#   SKIP_GIT=1 ./deploy.sh              # skip git pull
#   SKIP_PM2=1 ./deploy.sh              # skip PM2 restart
#   VITE_API_BASE_URL=https://api.example.com ./deploy.sh
#
# Prerequisites on server: git, python3, node/npm, backend/.env configured,
# PM2 processes already created (or set SKIP_PM2=1 and restart manually).

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

# --- Config (override with environment variables) ---
GIT_BRANCH="${GIT_BRANCH:-main}"
PYTHON_BIN="${PYTHON_BIN:-python3}"
VENV_DIR="${VENV_DIR:-$ROOT/backend/.venv}"
# Production API URL baked into the Vite build:
VITE_API_BASE_URL="${VITE_API_BASE_URL:-https://api.waterwise.loficode.tech}"
# PM2 process names (must match `pm2 list`); empty = skip restart even if pm2 exists
PM2_BACKEND="${PM2_BACKEND:-waterwise-api}"
PM2_FRONTEND="${PM2_FRONTEND:-waterwise-web}"

SKIP_GIT="${SKIP_GIT:-0}"
SKIP_PM2="${SKIP_PM2:-0}"

for arg in "$@"; do
  case "$arg" in
    --no-git)  SKIP_GIT=1 ;;
    --no-pm2)  SKIP_PM2=1 ;;
    -h|--help)
      echo "Usage: $0 [--no-git] [--no-pm2]"
      echo "Env: GIT_BRANCH, VENV_DIR, VITE_API_BASE_URL, PM2_BACKEND, PM2_FRONTEND, SKIP_GIT, SKIP_PM2"
      exit 0
      ;;
    *)
      echo "Unknown option: $arg (try --help)"
      exit 1
      ;;
  esac
done

echo "==> Deploy root: $ROOT"

if [[ "$SKIP_GIT" != "1" ]]; then
  if [[ -n "$(git status --porcelain 2>/dev/null)" ]]; then
    echo "WARN: Working tree has local changes. Pull may conflict; commit or stash first."
  fi
  echo "==> Git: pull origin $GIT_BRANCH"
  git fetch origin
  git checkout "$GIT_BRANCH"
  git pull origin "$GIT_BRANCH"
else
  echo "==> Skipping git (SKIP_GIT=1 or --no-git)"
fi

echo "==> Backend: venv + pip"
if [[ ! -d "$VENV_DIR" ]]; then
  "$PYTHON_BIN" -m venv "$VENV_DIR"
fi
# shellcheck source=/dev/null
source "$VENV_DIR/bin/activate"
pip install --upgrade pip
pip install -r "$ROOT/backend/requirements.txt"

echo "==> Backend: migrate + collectstatic"
cd "$ROOT/backend"
export DJANGO_SETTINGS_MODULE="${DJANGO_SETTINGS_MODULE:-core.settings}"
python manage.py migrate --noinput
python manage.py collectstatic --noinput
deactivate || true

echo "==> Frontend: npm ci + build"
cd "$ROOT/frontend"
if [[ -f package-lock.json ]]; then
  npm ci
else
  echo "WARN: no package-lock.json; using npm install"
  npm install
fi
export VITE_API_BASE_URL
npm run build

if [[ "$SKIP_PM2" != "1" ]] && command -v pm2 >/dev/null 2>&1; then
  echo "==> PM2 restart"
  if [[ -n "$PM2_BACKEND" ]]; then
    pm2 restart "$PM2_BACKEND" || echo "WARN: pm2 restart $PM2_BACKEND failed (check process name)"
  fi
  if [[ -n "$PM2_FRONTEND" ]]; then
    pm2 restart "$PM2_FRONTEND" || echo "WARN: pm2 restart $PM2_FRONTEND failed (check process name)"
  fi
  pm2 save 2>/dev/null || true
else
  if [[ "$SKIP_PM2" == "1" ]]; then
    echo "==> Skipping PM2 (--no-pm2 or SKIP_PM2=1)"
  else
    echo "==> pm2 not in PATH; restart Gunicorn and the frontend server yourself"
  fi
fi

echo "==> Deploy finished OK."
