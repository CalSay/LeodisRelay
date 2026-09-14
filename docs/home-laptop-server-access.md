# Add the RELAY server profile to a home Windows laptop

This guide creates the same `ssh relay` shortcut used on the work PC. The home
laptop gets its own key, so either computer can be removed later without
affecting the other one.

## Before starting

- Use Windows PowerShell or Windows Terminal on both computers.
- Keep access to the work PC until the home connection has been tested.
- Never copy, upload or commit an SSH private key. A file ending in `.pub` is a
  public key and is safe to transfer; the matching file without `.pub` is
  private and must stay on the computer that created it.

## 1. Record the server fingerprint on the work PC

Run this while the existing `relay` connection is trusted:

```powershell
ssh relay "ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub"
```

Keep the displayed SHA256 fingerprint. Compare it with the fingerprint shown
when the home laptop connects for the first time. Do not accept a different
fingerprint.

## 2. Create a separate key on the home laptop

Open PowerShell and run:

```powershell
ssh-keygen -t ed25519 -a 100 -f "$env:USERPROFILE\.ssh\relay_home" -C "relay-home-laptop"
```

Use a passphrase when prompted. This creates:

- `relay_home` — the private key; keep it only on the home laptop.
- `relay_home.pub` — the public key to add to the server.

Display the public key:

```powershell
Get-Content "$env:USERPROFILE\.ssh\relay_home.pub"
```

Copy the complete single line beginning `ssh-ed25519`.

## 3. Authorise the home key from the work PC

The public key is not secret, so it can be moved to the work PC in a message or
secure note. Copy only that single public-key line to the work PC clipboard.

First check that the clipboard contains the expected key:

```powershell
$relayPublicKey = (Get-Clipboard).Trim()
if ($relayPublicKey -notmatch '^ssh-ed25519 ') { throw 'The clipboard does not contain an Ed25519 public key.' }
$relayPublicKey
```

Then append it to the server account:

```powershell
$relayPublicKey | ssh relay "umask 077; mkdir -p ~/.ssh; touch ~/.ssh/authorized_keys; cat >> ~/.ssh/authorized_keys; chmod 700 ~/.ssh; chmod 600 ~/.ssh/authorized_keys"
```

This adds access; it does not remove the work PC key.

## 4. Create the `relay` profile on the home laptop

Open the SSH configuration file:

```powershell
notepad "$env:USERPROFILE\.ssh\config"
```

Add this block and save it:

```text
Host relay
    HostName 2.29.47.29
    User relayadmin
    IdentityFile ~/.ssh/relay_home
    IdentitiesOnly yes
```

If the file did not previously exist, Notepad may ask to create it. Ensure the
filename is exactly `config`, with no `.txt` suffix.

## 5. Test from home

Run:

```powershell
ssh relay
```

On the first connection, compare the displayed fingerprint with the trusted
fingerprint recorded in step 1. Accept it only when they match. Enter the key
passphrase when asked.

After the server prompt appears, verify the account and leave the session:

```text
whoami
exit
```

`whoami` should display `relayadmin`. The normal RELAY commands can now use the
same `ssh relay` shortcut on the home laptop. A deployment using `sudo` will
still request the server account's sudo password.

## If it does not connect

Run the diagnostic form on the home laptop:

```powershell
ssh -v relay
```

Check that:

- the profile file is `%USERPROFILE%\.ssh\config`, not `config.txt`;
- `relay_home` still exists in the same `.ssh` folder;
- the public key copied to the server is the one from `relay_home.pub`;
- the first-connection fingerprint matches the trusted server fingerprint.

Keep the work PC key until the home connection succeeds. If both keys become
unavailable, use the Hetzner web console to regain server access rather than
moving a private key between computers.
