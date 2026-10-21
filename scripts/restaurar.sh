#!/usr/bin/env bash
# Restaura un respaldo. Uso: ./scripts/restaurar.sh respaldos/inventario-AAAA-MM-DD-HHMM.sql.gz
set -euo pipefail
cd "$(dirname "$0")/.."
[ -f "${1:-}" ] || { echo "Indica el archivo de respaldo."; exit 1; }
set -a; . ./.env; set +a
read -r -p "Esto reemplaza los datos actuales con $1. Escribe SI para continuar: " ok
[ "$ok" = "SI" ] || { echo "Cancelado."; exit 1; }
docker compose stop api
gunzip -c "$1" | docker compose exec -T db psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v ON_ERROR_STOP=1 > /dev/null
docker compose start api
echo "Restauración completa."
