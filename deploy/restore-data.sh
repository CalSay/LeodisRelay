#!/usr/bin/env bash
# sudo bash deploy/restore-data.sh /opt/relay-backups/<timestamp>
#
# Puts reports and photographs back to the state captured in a backup.
#
# This is the other half of upgrade-pilot.sh, which takes a backup on every run
# but had no scripted way to use one. rollback-roles.sh deliberately restores
# code only; this is the script for the case where the data itself is wrong.
#
# Destructive by definition: everything written since the backup is discarded.
# So it refuses to run without a typed confirmation, and it takes its own
# backup of the current data first — a restore run against the wrong timestamp
# must itself be reversible.
set -Eeuo pipefail
cd /opt/relay
backup=$(realpath -e "${1:?Provide the backup directory printed by the upgrade}")
case "$backup" in /opt/relay-backups/*) ;; *) echo 'Expected a directory under /opt/relay-backups'; exit 1;; esac
archive="$backup/relay-data.tar.gz"
test -f "$archive"

# Verify before stopping anything. Discovering a truncated archive after the
# volume has been emptied is the worst possible moment to discover it.
( cd "$backup" && sha256sum --check --status relay-data.sha256 )
tar -tzf "$archive" >/dev/null
echo "Archive verified: $archive"
echo "Taken: $(date -u -r "$archive" +%Y-%m-%dT%H:%M:%SZ)"
echo
echo 'This DISCARDS every report, photograph and issue recorded since that time.'
read -r -p 'Type RESTORE to continue: ' confirm
test "$confirm" = RESTORE || { echo 'Cancelled; nothing was changed.'; exit 1; }

image=$(docker inspect --format '{{.Image}}' relay-web-1)
stamp=$(date -u +%Y%m%dT%H%M%SZ)
safety="/opt/relay-backups/before-restore-$stamp"
install -d -m 700 "$safety"

echo 'Pausing web and worker.'
docker compose -f deploy/compose.yaml stop -t 60 web worker

on_error() {
  result=$?
  trap - ERR
  echo 'Restore did not finish. The data volume may be incomplete.'
  echo "The state from immediately before this run is in: $safety"
  echo 'Start again with that directory once the cause is understood.'
  exit "$result"
}
trap on_error ERR

echo 'Backing up the current data before replacing it.'
docker run --rm --user 0 --entrypoint tar \
  --mount type=volume,src=relay_relay_data,dst=/data,readonly \
  --mount "type=bind,src=$safety,dst=/backup" \
  "$image" -czf /backup/relay-data.tar.gz -C /data .
tar -tzf "$safety/relay-data.tar.gz" >/dev/null
chmod 600 "$safety/relay-data.tar.gz"
( cd "$safety" && sha256sum relay-data.tar.gz > relay-data.sha256 )

echo 'Replacing the contents of the data volume.'
docker run --rm --user 0 --entrypoint sh \
  --mount type=volume,src=relay_relay_data,dst=/data \
  --mount "type=bind,src=$backup,dst=/backup,readonly" \
  "$image" -euc 'find /data -mindepth 1 -delete && tar -xzf /backup/relay-data.tar.gz -C /data'

docker compose -f deploy/compose.yaml up -d --no-build --force-recreate web worker

# Two separate questions, because they have opposite remedies. If the container
# is unhealthy the new image is at fault and rolling back is right. If the
# container is healthy but the site is unreachable, the fault is DNS, Caddy or
# the certificate, and rolling the application back would fix nothing while
# discarding a good deployment.
ready=0
for attempt in $(seq 1 60); do
  if [ "$(docker inspect --format '{{.State.Health.Status}}' relay-web-1 2>/dev/null)" = healthy ]; then
    ready=1
    break
  fi
  sleep 2
done
if [ "$ready" != 1 ]; then
  echo 'The application container did not report healthy. Recent log:'
  docker compose -f deploy/compose.yaml logs --tail 50 web || true
fi
test "$ready" = 1
test "$(docker inspect --format '{{.State.Running}}' relay-worker-1)" = true
if ! curl --fail --silent --output /dev/null https://app.relaybyleodis.com/signin; then
  echo
  echo 'WARNING: the application is healthy but https://app.relaybyleodis.com is not responding.'
  echo 'That is DNS, Caddy or the certificate, not this release. Do not roll back;'
  echo 'check "docker compose -f deploy/compose.yaml logs caddy".'
fi
trap - ERR
docker compose -f deploy/compose.yaml ps
echo "Restore complete from: $backup"
echo "The data as it stood before this run: $safety"
echo 'Sign in and confirm a known report and its photographs are present.'
