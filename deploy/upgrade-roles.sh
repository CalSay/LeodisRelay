#!/usr/bin/env bash
# Run with sudo from the extracted /opt/relay checkout.
set -Eeuo pipefail
cd /opt/relay
test -f deploy/.env
docker compose -f deploy/compose.yaml config --quiet
docker volume inspect relay_relay_data >/dev/null
previous_id=$(docker inspect --format '{{.Image}}' relay-web-1)
stamp=$(date -u +%Y%m%dT%H%M%SZ)
previous="relay:before-roles-$stamp"
candidate="relay:roles-$stamp"
backup="/opt/relay-backups/$stamp"
docker tag "$previous_id" "$previous"
install -d -m 700 "$backup"
cp deploy/compose.yaml "$backup/compose.yaml"
cp deploy/.env "$backup/.env"
chmod 600 "$backup/.env"
printf '%s\n' "$previous" > "$backup/previous-image.txt"
printf '%s\n' "$candidate" > "$backup/candidate-image.txt"

recover=0
on_error() {
  result=$?
  trap - ERR
  if [ "$recover" = 1 ]; then
    echo 'Upgrade failed; restarting the previous image with the existing data.'
    docker tag "$previous" relay:pilot
    docker compose -f deploy/compose.yaml up -d --no-build --force-recreate web worker || true
  fi
  echo "Upgrade did not finish. Backup/rollback information: $backup"
  exit "$result"
}
trap on_error ERR

echo 'Building the new image; the current application remains running.'
docker build --tag "$candidate" .
echo 'Pausing web and worker to take a consistent backup of reports and photographs.'
recover=1
docker compose -f deploy/compose.yaml stop -t 60 web worker
docker run --rm --user 0 --entrypoint tar \
  --mount type=volume,src=relay_relay_data,dst=/data,readonly \
  --mount "type=bind,src=$backup,dst=/backup" \
  "$previous" -czf /backup/relay-data.tar.gz -C /data .
tar -tzf "$backup/relay-data.tar.gz" >/dev/null
chmod 600 "$backup/relay-data.tar.gz"
sha256sum "$backup/relay-data.tar.gz" > "$backup/relay-data.sha256"
docker tag "$candidate" relay:pilot
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
recover=0
docker compose -f deploy/compose.yaml ps
echo "Upgrade started successfully. Backup: $backup"
echo "Previous image: $previous"
echo 'Sign in again and test Admin, Manager and Engineer accounts.'
echo 'This local backup still needs an off-server copy and a restore test.'
