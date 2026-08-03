#!/usr/bin/env bash
# Löscht alle automatischen Backups der Flohmarkt-Datenbank-Instanz.
#
# Manuell auszuführen, kurz nachdem scripts/deletion_job.py gelaufen ist
# (Löschjob-Cron in infra/main.tf, täglich 03:00 ab 07.10.2026). Bewusst
# NICHT automatisiert: das unwiderrufliche Löschen von Backups soll ein
# Mensch bewusst anstoßen, nicht ein weiterer stiller Cron-Job.
#
# Hintergrund: Die Standard-Datenbank-Instanz behält automatische Backups
# laut backup_schedule_retention (infra/main.tf, aktuell 3 Tage) - das kann
# den Löschtermin knapp überschreiten. Dieses Skript räumt sie explizit weg,
# statt sich auf das rollierende Fenster zu verlassen.
#
# Voraussetzung: Scaleway CLI (scw), authentifiziert per Env-Vars
# (SCW_ACCESS_KEY, SCW_SECRET_KEY, SCW_DEFAULT_PROJECT_ID) oder `scw init`.
#
# Aufruf: ./scripts/purge_scaleway_backups.sh <rdb-instance-id> [region]
#
# Hinweis: Die genaue JSON-Struktur von `scw rdb backup list --output=json`
# wurde anhand der Scaleway-CLI-Dokumentation umgesetzt, aber noch nicht
# gegen einen echten Account verifiziert - vor dem ersten produktiven
# Einsatz einmal mit `scw rdb backup list ... --output=json` gegenprüfen.

set -euo pipefail

INSTANCE_ID="${1:?Verwendung: $0 <rdb-instance-id> [region]}"
REGION="${2:-fr-par}"

echo "Suche Backups für Instanz $INSTANCE_ID in $REGION ..."
BACKUP_IDS=$(scw rdb backup list "instance-id=$INSTANCE_ID" "region=$REGION" --output=json | jq -r '.[].id')

if [ -z "$BACKUP_IDS" ]; then
  echo "Keine Backups gefunden."
  exit 0
fi

for id in $BACKUP_IDS; do
  echo "Lösche Backup $id ..."
  scw rdb backup delete "$id" "region=$REGION"
done

echo "Fertig."
