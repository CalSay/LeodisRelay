#!/usr/bin/env bash
# sudo bash deploy/rollback-roles.sh /opt/relay-backups/<timestamp>
# Rolls application code back only; does not overwrite or delete user data.
set -Eeuo pipefail
cd /opt/relay
backup=$(realpath -e "${1:?Provide the backup directory printed by the upgrade}")
case "$backup" in /opt/relay-backups/*) ;; *) echo 'Expected a directory under /opt/relay-backups'; exit 1;; esac
previous=$(cat "$backup/previous-image.txt")
docker image inspect "$previous" >/dev/null
docker tag "$previous" relay:pilot
docker compose -f deploy/compose.yaml up -d --no-build --force-recreate web worker
docker compose -f deploy/compose.yaml ps
