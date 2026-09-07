# Microsoft sign-in

Relay signs people in with their Leodis Microsoft account (Entra ID). Until the
app registration exists it falls back to a local sign-in that checks nobody, and
says so on the sign-in screen and in the banner.

## What a tenant administrator needs to create

An **app registration** in Entra ID, and four values from it:

| Setting | Where it comes from |
| --- | --- |
| `ENTRA_TENANT_ID` | Directory (tenant) ID on the registration overview |
| `ENTRA_CLIENT_ID` | Application (client) ID on the same page |
| `ENTRA_CLIENT_SECRET` | Certificates & secrets — a new client secret |
| `ENTRA_REDIRECT_URI` | Must match a redirect URI registered below |

**Redirect URIs** to register, as platform type *Web*:

- `http://localhost:4310/api/auth/callback` — local development
- the same path on whatever host the pilot is deployed to

**Delegated permissions** — only what identifies a person:

- `openid`, `profile`, `email`, `User.Read`

Nothing about mail, files or SharePoint is requested. Those are separate
permissions and belong to a separate decision, made when reference data and
archiving are wired up (ADR-07).

## Configuring it

Put the values in `apps/web/.env.local`, which is not committed:

    ENTRA_TENANT_ID=...
    ENTRA_CLIENT_ID=...
    ENTRA_CLIENT_SECRET=...
    ENTRA_REDIRECT_URI=http://localhost:4310/api/auth/callback

Restart the dev server. The sign-in screen changes to "Sign in with Microsoft"
and the banner stops warning that identity is unchecked. No code changes.

## What identity is used for

The signed-in person becomes the author of what they capture, the reviewer when
they approve or return a report, and the actor on every issue transition. That
is what makes "a report cannot be reviewed by whoever wrote it" and "closure
must be verified by someone other than the person who did the work" real rules
rather than honour-system ones — before this, those names were typed into a box.

Identity is keyed on the Entra object id rather than an email address, because
people change name and address and a report signed off two years ago must still
resolve to the same person.
