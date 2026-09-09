#!/usr/bin/env bash
# Резервная копия боевой базы. Обычный cp при включённом WAL теряет
# последние транзакции, поэтому копируем средствами самого SQLite.
set -euo pipefail

DB="${DB_PATH:-/root/horecago-data/db/prod.db}"
DEST="${BACKUP_DIR:-/root/horecago-data/backups}"
KEEP_DAYS="${KEEP_DAYS:-14}"

mkdir -p "$DEST"
STAMP=$(date +%F-%H%M)
sqlite3 "$DB" ".backup '$DEST/prod-$STAMP.db'"
gzip -f "$DEST/prod-$STAMP.db"
find "$DEST" -name 'prod-*.db.gz' -mtime "+$KEEP_DAYS" -delete
echo "Копия готова: $DEST/prod-$STAMP.db.gz"
