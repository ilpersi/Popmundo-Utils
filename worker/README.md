# Interaction names collector (Cloudflare Worker)

Receives the game's own names of the Popmundo interactions and of their groups, sent anonymously by the extension
(`submitInteractionNames` in `../background.js`), and keeps one vote per install in a D1 database.
It is not part of the extension package: `pack.*` only zips the extension folders.

| Route | What it does |
|---|---|
| `POST /submit` | Validates `{ schema: 1, lang, install, entries: [{ kind: 'name' \| 'group', id, value }] }` and stores it. At most 80 entries and 16 KB per request. |
| `GET /export` | `Authorization: Bearer <EXPORT_TOKEN>`. Returns `{ rows: [{ lang, kind, key, value, votes }] }`, `?min=2` keeps the values sent by at least 2 installs. Install ids are never returned. |

## The two configuration files

| File | In git? | What it is |
|---|---|---|
| `wrangler.toml` | yes | The Worker configuration, with a **placeholder** instead of the D1 `database_id`. |
| `wrangler.local.toml` | **no** (`.gitignore`) | A private copy of `wrangler.toml` with the **real** `database_id`. |

The database id is an identifier, not a credential (it does not give access to the data), but we keep it out of the
repository anyway. Wrangler cannot read the id from an environment variable or a `.env` file, so the real id lives in a
second config file and every command is told to use it with `-c wrangler.local.toml`.

Rules:
- Use `-c wrangler.local.toml` on **every** Wrangler command after the database exists. The only exceptions are
  `wrangler login` and `wrangler d1 create`, which do not read the config. Without the flag Wrangler picks up
  `wrangler.toml`, whose placeholder id is not valid, so the command fails instead of touching anything.
- Keep the two files identical apart from `database_id`: when you change a setting in one, change it in the other.
- Never commit `wrangler.local.toml`. `git status` must not list it, and `git check-ignore -v worker/wrangler.local.toml`
  must print the `.gitignore` rule that excludes it.
- Tokens are a different matter and must never be written in either file: the `EXPORT_TOKEN` value only goes through
  `wrangler secret put`, and local development secrets go in `.dev.vars` (also ignored).

### Setting up on a new machine, or after a fresh clone

1. Copy `wrangler.toml` to `wrangler.local.toml`.
2. Replace the placeholder `database_id` in the copy with the real id. Find it in the Cloudflare dashboard
   (Storage & Databases > D1 > popmundo-utils-names), or with `npx wrangler d1 list`.
3. Check that `git status` does not show the new file.

## Deploy (once)

Run these in this folder. Check Cloudflare's current free plan limits first, they change over time.

```sh
npx wrangler login
npx wrangler d1 create popmundo-utils-names       # prints the database_id: put it in wrangler.local.toml (copy of wrangler.toml), not in wrangler.toml
npx wrangler d1 execute popmundo-utils-names --remote --file=./schema.sql -c wrangler.local.toml
npx wrangler secret put EXPORT_TOKEN -c wrangler.local.toml    # EXPORT_TOKEN is the NAME of the secret, Wrangler then asks for its value
npx wrangler deploy -c wrangler.local.toml                     # prints the Worker URL
```

The value of `EXPORT_TOKEN` is any long random string that you generate yourself and keep private (it is used by the
sync step and to read `/export`). A safe way to create and set it in one go, without it ever being typed or pasted anywhere else:

```sh
TOKEN=$(openssl rand -hex 24)
printf '%s' "$TOKEN" | npx wrangler secret put EXPORT_TOKEN -c wrangler.local.toml   # printf, not echo: echo would add a newline to the secret
echo "$TOKEN"                                                                         # copy it to a password manager, it cannot be read back
```

`npx wrangler secret list -c wrangler.local.toml` must then show a secret whose name is `EXPORT_TOKEN`. Secret names are
not secret, so never use the token itself as a name.

Then put `<Worker URL>/submit` in `TRANSLATIONS_ENDPOINT` at the bottom of `../background.js`. While it is empty
the extension sends nothing.

## Using the votes

The votes are turned into a pull request by `../scripts/sync-interaction-names.mjs` (run by the workflow
`../.github/workflows/sync-interaction-names.yml`). It needs the Worker's `EXPORT_TOKEN` as the GitHub secret
`NAMES_EXPORT_TOKEN`: see `../scripts/README.md`.

## Everyday commands

```sh
npx wrangler deploy --dry-run -c wrangler.local.toml     # checks the Worker and its bindings without uploading anything
npx wrangler deploy -c wrangler.local.toml               # publishes a new version after changing src/index.js
npx wrangler d1 execute popmundo-utils-names --remote -c wrangler.local.toml --command "SELECT COUNT(*) FROM submissions"
npx wrangler secret list -c wrangler.local.toml
```

After a deploy, the output must still list `env.DB (popmundo-utils-names)` as a D1 Database binding.

## Try it locally

```sh
npx wrangler d1 execute popmundo-utils-names --local --file=./schema.sql -c wrangler.local.toml
npx wrangler dev -c wrangler.local.toml
curl -X POST http://localhost:8787/submit -H 'Content-Type: application/json' \
  -d '{"schema":1,"lang":4,"install":"11111111-2222-4333-8444-555555555555","entries":[{"kind":"name","id":60,"value":"Test"}]}'
curl -H 'Authorization: Bearer <EXPORT_TOKEN>' 'http://localhost:8787/export?min=1'
```

For `wrangler dev` set `EXPORT_TOKEN=...` in a `.dev.vars` file (it is not committed).

## Removing someone's data

Each install is a random uuid, shown in the extension under Options > Misc > Community translations > View last submission.

```sh
npx wrangler d1 execute popmundo-utils-names --remote -c wrangler.local.toml --command "DELETE FROM submissions WHERE install = '<uuid>'"
```
