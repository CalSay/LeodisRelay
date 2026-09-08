# Hetzner pilot

One Node 24 web process and one worker share the local SQLite/media volume.
Caddy serves HTTPS for app.relaybyleodis.com. Only ports 80 and 443 are published.
Keep SSH access and allow HTTP/HTTPS in any Hetzner firewall as well as UFW.
This is a pilot: SharePoint media filing and live email delivery are not implemented.

Copy .env.example to .env on the server and set the four Entra values. Use the
client secret VALUE, not its ID. Keep this file mode 600 and out of source control.
The callback must also be registered as a Web redirect URI in Microsoft Entra.
Restrict the enterprise application to assigned pilot users and grant consent to
the existing delegated identity permissions (openid, profile, email, User.Read).

From the repository root, after building/loading the Linux image:

```sh
sudo docker compose -f deploy/compose.yaml up -d --no-build
sudo docker compose -f deploy/compose.yaml ps
sudo docker compose -f deploy/compose.yaml logs --tail=80 web worker caddy
```

Build the image on an amd64 Linux Docker host (or with buildx --platform linux/amd64)
using `docker build -t relay:pilot .`, then `docker save -o relay-image.tar relay:pilot`.
Transfer and load with `sudo docker load -i relay-image.tar`. Building on the CX23
is possible with `sudo docker compose -f deploy/compose.yaml build web`, but has
not been memory-tested; prefer an external build host.

Verify HTTPS, Microsoft sign-in, rejection of an unassigned account, photo upload,
and PDF worker processing. Restart web and worker and verify data survives.
Do not run `docker compose down -v`: it deletes the persistent volumes.

Before real data, enable server backups and rehearse a restore.

`upgrade-pilot.sh` takes a verified backup on every run; `restore-data.sh` puts
one back. Rehearse it on a copy before you need it in anger:

    sudo bash deploy/restore-data.sh /opt/relay-backups/<timestamp>

It verifies the archive first, asks you to type RESTORE, and takes its own
backup of the current data before replacing it, so a restore from the wrong
timestamp is itself reversible. `rollback-roles.sh` is the different case: it
returns the application to the previous image and does not touch data.

For a consistent full data backup, stop web and worker, back up relay_relay_data,
then start both again. Include images and SQLite together. Store an encrypted
backup off the server; restore into a separate volume and verify reports/photos.
Keep the prior image for rollback and back up data before every upgrade.
