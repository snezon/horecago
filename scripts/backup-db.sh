#!/usr/bin/env bash
# Резервная копия боевой базы. Обычный cp при включённом WAL теряет
# последние транзакции, поэтому копируем средствами самого SQLite.
set -euo pipefail

DB="${DB_PATH:-/root/horecago-data/db/prod.db}"
DEST="${BACKUP_DIR:-/root/horecago-data/backups}"
KEEP_DAYS="${KEEP_DAYS:-14}"

# Без sqlite3 копию не сделать — падаем сразу с понятным сообщением,
# а не с "command not found" из середины скрипта.
if ! command -v sqlite3 >/dev/null 2>&1; then
  echo "Не найдена утилита sqlite3 — установите пакет sqlite3" >&2
  exit 1
fi

# В каталоге лежат персональные данные (в т.ч. паспорта из базы) — держим 700.
mkdir -p "$DEST"
chmod 700 "$DEST"

STAMP=$(date +%F-%H%M)
TMP_DB="$DEST/prod-$STAMP.db.partial"
TMP_GZ="$TMP_DB.gz"
FINAL="$DEST/prod-$STAMP.db.gz"

# Если скрипт прервётся на любом шаге — не оставляем недописанный огрызок:
# очистка по возрасту ищет только "prod-*.db.gz" и такой файл не тронет.
trap 'rm -f "$TMP_DB" "$TMP_GZ"' EXIT

sqlite3 "$DB" ".backup '$TMP_DB'"
gzip -f "$TMP_DB"
mv "$TMP_GZ" "$FINAL"

find "$DEST" -name 'prod-*.db.gz' -mtime "+$KEEP_DAYS" -delete
echo "Копия готова: $FINAL"
