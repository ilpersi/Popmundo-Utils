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

## If you lose or forget the EXPORT_TOKEN

Nobody can read the token back: Cloudflare only keeps the secret for the Worker, and GitHub only keeps it for the
workflow. If you do not have the value any more (or you think it leaked), make a new one and set **both** copies to
the same new value. The old token stops working as soon as the Worker's secret changes, and nothing else needs to
change: the extension does not use this token, only the sync workflow and your own `curl` checks do.

Run it in this folder. It needs `npx wrangler login` and `gh auth login` to have been done once (`gh` needs the `repo` scope).

```sh
TOKEN=$(openssl rand -hex 24)                                                         # a new random value, never typed or shown
printf '%s' "$TOKEN" | npx wrangler secret put EXPORT_TOKEN -c wrangler.local.toml    # the Worker's copy (no deploy needed: Wrangler makes a new version by itself)
printf '%s' "$TOKEN" | gh secret set NAMES_EXPORT_TOKEN --repo ilpersi/Popmundo-Utils # the GitHub copy, used by the sync workflow
unset TOKEN                                                                           # forget it; add `echo "$TOKEN"` before this line if you want to keep it, e.g. to try /export with curl
```

Always use `printf`, not `echo`: `echo` adds a newline to the secret and then no token ever matches.

Check that it worked:

```sh
npx wrangler secret list -c wrangler.local.toml           # must list EXPORT_TOKEN
gh secret list --repo ilpersi/Popmundo-Utils              # must list NAMES_EXPORT_TOKEN with a new date
gh workflow run "Sync interaction names" --repo ilpersi/Popmundo-Utils
gh run list --repo ilpersi/Popmundo-Utils --workflow "Sync interaction names" --limit 1   # wait for "completed success"
```

A successful run proves that both copies match: the script fails with `The Worker answered 401` when they differ.
If the first command works and the second fails, run the whole snippet again, the Worker and GitHub must always
hold the same value. If you use a `.dev.vars` file for `wrangler dev`, put the new value there too.

## Everyday commands

```sh
npx wrangler deploy --dry-run -c wrangler.local.toml     # checks the Worker and its bindings without uploading anything
npx wrangler deploy -c wrangler.local.toml               # publishes a new version after changing src/index.js
npx wrangler d1 execute popmundo-utils-names --remote -c wrangler.local.toml --command "SELECT COUNT(*) FROM submissions"
npx wrangler secret list -c wrangler.local.toml
```

After a deploy, the output must still list `env.DB (popmundo-utils-names)` as a D1 Database binding.

## Useful queries

The table is `submissions(lang, kind, key, value, install, ts)`: one row per install, language, kind (`name` or `group`)
and interaction id (`key`), holding the last `value` that install sent. `ts` is a time in milliseconds, the queries
below turn it into a date (UTC). D1 is SQLite, so any SQLite query works.

Run these in this folder. To avoid repeating the long command, define a shortcut once in your terminal:

```sh
q() { npx wrangler d1 execute popmundo-utils-names --remote -c wrangler.local.toml --command "$1"; }
```

Add `--json` to the command inside `q` if you want JSON instead of the table. The queries that only read data cannot
change anything. For long queries, the Cloudflare dashboard (Storage & Databases > D1 > popmundo-utils-names > Console)
is more comfortable.

**How much is there?**

```sh
q "SELECT COUNT(*) AS rows_total, COUNT(DISTINCT install) AS installs, COUNT(DISTINCT lang) AS languages, datetime(MIN(ts) / 1000, 'unixepoch') AS first_row, datetime(MAX(ts) / 1000, 'unixepoch') AS last_row FROM submissions"
q "SELECT lang, COUNT(DISTINCT install) AS installs, COUNT(*) AS rows_total FROM submissions GROUP BY lang ORDER BY installs DESC, lang"   # per game language
q "SELECT kind, COUNT(*) AS rows_total, COUNT(DISTINCT key) AS interactions FROM submissions GROUP BY kind"   # names against groups
q "SELECT lang, kind, key, value, datetime(ts / 1000, 'unixepoch') AS received FROM submissions ORDER BY ts DESC LIMIT 20"   # the latest 20 rows
q "SELECT lang, value AS group_label, COUNT(DISTINCT key) AS interactions, group_concat(DISTINCT key) AS ids FROM submissions WHERE kind = 'group' GROUP BY lang, value ORDER BY lang, interactions DESC"   # the groups as the game shows them
```

In the `group` rows the `key` is an interaction and the `value` is the label of its group, so a group with five
interactions has five rows with the same `value` and five different `key`s. That is normal. The last query above
shows it the other way round: one line per group label, with the interactions that are in it.

**What would the sync workflow do?** It accepts a value when at least 2 installs sent it and no other value has as many
votes (`../scripts/README.md`). These show the same data from the database side:

```sh
q "SELECT lang, kind, key, value, COUNT(*) AS votes FROM submissions GROUP BY lang, kind, key, value HAVING COUNT(*) >= 2 ORDER BY lang, kind, key"   # values with at least 2 votes
q "SELECT lang, COUNT(*) AS values_with_one_vote FROM (SELECT lang, kind, key, value FROM submissions GROUP BY lang, kind, key, value HAVING COUNT(*) = 1) GROUP BY lang ORDER BY lang"   # still waiting for a second install
q "SELECT lang, kind, key, COUNT(DISTINCT value) AS different_values, group_concat(DISTINCT value) AS values_seen FROM submissions GROUP BY lang, kind, key HAVING COUNT(DISTINCT value) > 1 ORDER BY lang, kind, key"   # installs that disagree
q "SELECT lang, kind, value, COUNT(*) AS votes FROM submissions WHERE key = 60 GROUP BY lang, kind, value ORDER BY lang, kind, votes DESC"   # everything sent for one interaction: change 60 to its id
```

**Is something odd?**

```sh
q "SELECT substr(install, 1, 8) AS install_prefix, COUNT(*) AS rows_total, COUNT(DISTINCT lang) AS languages, datetime(MIN(ts) / 1000, 'unixepoch') AS first_row, datetime(MAX(ts) / 1000, 'unixepoch') AS last_row FROM submissions GROUP BY install ORDER BY rows_total DESC LIMIT 10"   # busiest installs
q "SELECT name, type FROM sqlite_master WHERE type IN ('table', 'index') ORDER BY name"   # the schema in the database: must list the table submissions (and its automatic index, sqlite_autoindex_submissions_1)
```

An install with far more rows than the others, or rows in many languages, deserves a look: a normal install sends a
few dozen rows in one language. Only the first 8 characters of its id are shown, which is enough to find it again with
`WHERE install LIKE '1a2b3c4d%'`. The size of the database is in `npx wrangler d1 info popmundo-utils-names -c wrangler.local.toml`.

**Changing data (careful, there is no undo)**

Run the matching `SELECT` first, with the same `WHERE`, and check that it returns what you expect.

```sh
q "SELECT COUNT(*) FROM submissions WHERE key = 9999"   # the rows of the test interaction id 9999
q "DELETE FROM submissions WHERE key = 9999"            # remove them
q "DELETE FROM submissions WHERE lang = 4 AND kind = 'name' AND key = 60 AND value = 'the wrong text'"   # one bad value, from every install that sent it
q "DELETE FROM submissions WHERE ts < (strftime('%s', 'now', '-1 year') * 1000)"   # everything older than a year
q "DELETE FROM submissions"                              # start over: empties the table, the schema stays
```

To remove one person's data, see the last section.

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
