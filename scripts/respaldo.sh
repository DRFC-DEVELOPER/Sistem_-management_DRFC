#!/usr/bin/env bash
# Respaldo de la base de datos. Guarda 30 días en ./respaldos
# Programarlo diario a las 2 a. m.:  crontab -e  →  0 2 * * * /opt/inventario/scripts/respaldo.sh
set -euo pipefail
cd "$(dirname "$0")/.."
set -a; . ./.env; set +a
mkdir -p respaldos
archivo="respaldos/inventario-$(date +%F-%H%M).sql.gz"
docker compose exec -T db pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists | gzip > "$archivo"
find respaldos -name 'inventario-*.sql.gz' -mtime +30 -delete
echo "Respaldo creado: $archivo"
