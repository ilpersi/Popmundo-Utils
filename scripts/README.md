# Scripts

## `sync-interaction-names.mjs`: community names -> pull request

Users of the extension send, anonymously, the game's own names of the interactions and of their groups (see
`../worker/README.md`). This script reads those votes from the Worker and rewrites
`../features/interaction-names-data.js`; the workflow `../.github/workflows/sync-interaction-names.yml` runs it and
opens a pull request. **Nothing is merged without you reading the pull request.**

It has no dependencies: it needs Node 18 or newer (the workflow uses 24).

### One-time setup

1. In the GitHub repository open Settings > Secrets and variables > Actions and add a **repository secret** called
   `NAMES_EXPORT_TOKEN` with the same value as the Worker's `EXPORT_TOKEN` secret (the one printed when you created it,
   it cannot be read back from Cloudflare).
2. In Settings > Actions > General > Workflow permissions, allow GitHub Actions to create pull requests (without it
   the last step of the workflow fails). Read and write permissions for the workflow are already requested by the
   workflow file itself.
3. The Worker address is written in the workflow file (`NAMES_EXPORT_URL`). It is public anyway: it is in `background.js`.
   If the Worker moves, change it in both places.

### Running it

Actions tab > "Sync interaction names" > Run workflow. The `quorum` input (default 2) is the number of different
installs that must send the same value.

- If something was accepted, the workflow opens (or updates) the pull request `sync-interaction-names`.
- If nothing changed, no pull request is created. The job summary still shows what is waiting for more votes.
- If the Worker cannot be reached or the token is wrong, the job fails with a short message. The answer of the
  Worker is deliberately never printed.

### The rules

- A value is accepted when at least `quorum` installs sent it **and** no other value has as many votes. A tie, or too
  few votes, accepts nothing and is listed in the pull request.
- Only **missing** values are added. If an accepted value differs from the one already in the file, it is listed under
  "not applied": change it by hand only if you are sure.
- Group names are matched between languages through the interaction id. The English name of the group is the
  language-independent key (`Close Physical` becomes `closePhysical`). A group the file does not know yet is created
  from its English name and added at the end of `INTERACTION_GROUP_ORDER`.
- Every row from the Worker is checked again (language, kind, id, length, no markup or links) even though the Worker
  already refuses them. The data file only receives text through `quote()`, and the pull request text only shows
  community text inside code spans, so a crafted name can neither become code nor ping people or add links.
- The script owns the format of the data file and rewrites all of it. The same data always gives the same text, so a
  run without new votes gives no diff. Do not hand-format that file; edit values if you must and the next run keeps them.

### Reviewing the pull request

1. Read the **Please check** sections of the description first. Anything under "not applied", "contradict each other"
   or "Ties" needs a decision from you, the script has left it out of the diff.
2. New groups are appended to `INTERACTION_GROUP_ORDER` in the order they were found, which is not the game's order.
   Fix the order by hand if you know it. The options page switches to the game's own groups only once every Mass
   Interact chip belongs to one, so wrong group data would show there.
3. Skim the diff for names that look wrong. A name is only 60 characters of plain text, but it comes from strangers.
4. Merge, then publish a new version of the extension: the names reach users with the next release.

### Trying it on your machine without changing the repository

```sh
read -rs NAMES_EXPORT_TOKEN && export NAMES_EXPORT_TOKEN      # type the token, it is not echoed or kept in the shell history
cp features/interaction-names-data.js /tmp/data-copy.js
NAMES_EXPORT_URL=https://popmundo-utils-names.ilpersi.workers.dev/export \
  DATA_FILE=/tmp/data-copy.js PR_BODY_FILE=/tmp/pr-body.md node scripts/sync-interaction-names.mjs
diff features/interaction-names-data.js /tmp/data-copy.js    # what the pull request would change
less /tmp/pr-body.md                                          # the pull request description
```

Settings: `NAMES_EXPORT_URL` and `NAMES_EXPORT_TOKEN` are required, `QUORUM` (default 2), `DATA_FILE` (default
`features/interaction-names-data.js`) and `PR_BODY_FILE` (default `pr-body.md`) are optional. The URL must be `https`,
because the token is sent to it.
