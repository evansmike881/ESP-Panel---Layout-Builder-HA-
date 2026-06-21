#!/usr/bin/with-contenv bashio
set -euo pipefail

export PORT="${PORT:-8099}"

echo "[ESP Panel Layout Builder] Starting server on port ${PORT}"

cd /opt/esp-panel-layout-builder/app
exec node server.js
