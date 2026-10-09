// Turns the votes collected by the Worker (see ../worker/README.md) into an update of
// features/interaction-names-data.js. Run by .github/workflows/sync-interaction-names.yml, which then opens a pull
// request: nothing is ever merged without a human reading the pull request.
//
//   NAMES_EXPORT_URL     full URL of the Worker /export route                       (required, https)
//   NAMES_EXPORT_TOKEN   the Worker EXPORT_TOKEN secret                             (required)
//   QUORUM               distinct installs that must agree on a value (default 2)
//   DATA_FILE            file to update (default features/interaction-names-data.js)
//   PR_BODY_FILE         where to write the pull request text (default pr-body.md)
//
// The rules, in short:
//  - A value is accepted when at least QUORUM installs sent it and it has strictly more votes than any other value
//    for the same thing. A tie, or too few votes, accepts nothing: it is listed in the pull request instead.
//  - Only missing values are added. A value that differs from the one already shipped is never replaced here: it is
//    listed as "not applied", and changing it is a decision for the maintainer.
//  - Group names are matched between languages by interaction id: the English group name of an interaction gives
//    the language-independent key, the other languages only provide the wording.
//  - Everything that comes from the Worker is untrusted text. It is checked again here, written to the data file
//    only through quote(), and written to the pull request text only inside code spans.

import fs from 'node:fs';
import vm from 'node:vm';
import { pathToFileURL } from 'node:url';

// Same lists and limits as worker/src/index.js: the Worker already refuses anything else, we do not rely on it.
export const KNOWN_LANGUAGES = {
    1: 'Swedish', 2: 'US English', 3: 'German', 4: 'Italian', 5: 'French', 6: 'Spanish', 7: 'Norwegian', 8: 'Danish',
    9: 'Suomi', 10: 'Dutch', 11: 'Portuguese', 13: 'Polish', 14: 'Russian', 19: 'Turkish', 23: 'Romanian',
    24: 'UK English', 33: 'Hungarian', 36: 'Estonian', 39: 'Croatian', 43: 'Bulgarian', 50: 'Portuguese, Brazil',
    51: 'Spanish, Latin American', 56: 'Lithuanian', 60: 'Spanish, Argentina', 106: 'Chinese, Mainland'
};
const MAX_VALUE_LENGTH = 60;
const MAX_ID = 9999;
const FORBIDDEN_VALUE = /[\u0000-\u001f\u007f<>]|https?:|www\./i;
const ENGLISH = '2'; // the language every group is known in, it gives the language-independent group key
const WRAP_WIDTH = 118;
const MAX_LISTED = 40; // rows listed per section of the pull request text

// ─────────────────────────────────────────────────────────────────────────────
// Reading the data file
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Reads the constants of the data file. The file is our own reviewed code, it is run in an empty sandbox only to read them.
 * @return {{groupNames: Object, groupById: Object, groupOrder: string[], namesDb: Object}} Plain objects, keys are strings.
 */
export function parseDataFile(source) {
    const sandbox = vm.createContext({});
    const result = vm.runInContext(
        `${source}\n;JSON.stringify({ groupNames: INTERACTION_GROUP_NAMES, groupById: INTERACTION_GROUP_BY_ID, ` +
        'groupOrder: INTERACTION_GROUP_ORDER, namesDb: INTERACTION_NAMES_DB })', sandbox, { timeout: 5000 });
    return JSON.parse(result);
}

// ─────────────────────────────────────────────────────────────────────────────
// Reading the votes
// ─────────────────────────────────────────────────────────────────────────────

/** @return {string|null} Why the row is not usable, null when it is. */
export function rowProblem(row) {
    if (!row || typeof row !== 'object') return 'not an object';
    if (!Object.hasOwn(KNOWN_LANGUAGES, String(row.lang))) return 'unknown language';
    if (row.kind !== 'name' && row.kind !== 'group') return 'unknown kind';
    if (!Number.isInteger(row.key) || row.key < 1 || row.key > MAX_ID) return 'invalid interaction id';
    if (!Number.isInteger(row.votes) || row.votes < 1) return 'invalid votes';
    if (typeof row.value !== 'string') return 'invalid value';
    if (row.value !== row.value.trim() || row.value.length === 0 || row.value.length > MAX_VALUE_LENGTH || FORBIDDEN_VALUE.test(row.value)) {
        return 'invalid value';
    }
    return null;
}

/**
 * Decides, for every (language, kind, interaction id), which value the votes accept.
 * @return {{accepted: Array, tied: Array, waiting: Array, outvoted: Array, invalid: number}}
 */
export function decideVotes(rows, quorum) {
    const byKey = new Map();
    let invalid = 0;
    for (const row of rows) {
        if (rowProblem(row)) { invalid++; continue; }
        const id = `${row.lang}|${row.kind}|${row.key}`;
        if (!byKey.has(id)) byKey.set(id, { lang: String(row.lang), kind: row.kind, id: String(row.key), values: new Map() });
        const entry = byKey.get(id);
        entry.values.set(row.value, (entry.values.get(row.value) || 0) + row.votes);
    }

    const accepted = [], tied = [], waiting = [], outvoted = [];
    for (const entry of byKey.values()) {
        const ranked = [...entry.values].map(([value, votes]) => ({ value, votes })).sort((a, b) => b.votes - a.votes || (a.value < b.value ? -1 : 1));
        const [top, second] = ranked;
        const base = { lang: entry.lang, kind: entry.kind, id: entry.id };
        if (top.votes < quorum) waiting.push({ ...base, ranked });
        else if (second && second.votes === top.votes) tied.push({ ...base, ranked });
        else {
            accepted.push({ ...base, value: top.value, votes: top.votes });
            if (second) outvoted.push({ ...base, winner: top, losers: ranked.slice(1) });
        }
    }
    return { accepted, tied, waiting, outvoted, invalid };
}

// ─────────────────────────────────────────────────────────────────────────────
// Merging the accepted values into the data
// ─────────────────────────────────────────────────────────────────────────────

/** "Close Physical" -> "closePhysical", the language-independent key of a group. */
export function groupKeyOf(englishLabel) {
    const words = englishLabel.split(/[^A-Za-z0-9]+/).filter(Boolean);
    return words.map((w, i) => (i === 0 ? w.toLowerCase() : w[0].toUpperCase() + w.slice(1).toLowerCase())).join('');
}

const clone = (value) => JSON.parse(JSON.stringify(value));
const byNumber = (a, b) => Number(a) - Number(b);

/**
 * Adds the accepted values that are missing from the data. Never replaces a value that is already there.
 * @return {{data: Object, report: Object}} data has the same shape as the one parseDataFile returns.
 */
export function mergeVotes(existing, decisions) {
    const data = clone(existing);
    const report = {
        added: { names: [], groupLabels: [], groupIds: [], newGroups: [] },
        notApplied: [], // an accepted value that differs from the shipped one
        conflicts: [],  // accepted values that contradict each other
        unaligned: [],  // group labels that cannot be placed in a group yet
    };

    // ── names: one value per (language, interaction id)
    for (const vote of decisions.accepted.filter(v => v.kind === 'name')) {
        const language = data.namesDb[vote.lang] || (data.namesDb[vote.lang] = { options: {} });
        const shipped = language.options[vote.id];
        if (shipped === undefined) {
            language.options[vote.id] = vote.value;
            report.added.names.push(vote);
        } else if (shipped !== vote.value) {
            report.notApplied.push({ what: 'name', lang: vote.lang, id: vote.id, shipped, proposed: vote.value, votes: vote.votes });
        }
    }
    for (const lang of Object.keys(data.namesDb)) {
        if (Object.keys(data.namesDb[lang].options).length === 0) delete data.namesDb[lang];
    }

    // ── groups
    const groupVotes = decisions.accepted.filter(v => v.kind === 'group');
    const labelsById = new Map(); // interaction id -> Map(lang -> label)
    for (const vote of groupVotes) {
        if (!labelsById.has(vote.id)) labelsById.set(vote.id, new Map());
        labelsById.get(vote.id).set(vote.lang, vote);
    }

    // 1. which group (language-independent key) each interaction belongs to, from its English label
    for (const [id, perLang] of [...labelsById].sort((a, b) => byNumber(a[0], b[0]))) {
        const english = perLang.get(ENGLISH) || perLang.get('24'); // UK English words the groups the same way
        const shippedKey = data.groupById[id];

        // Already placed in a group: the wording of its group is checked below, with the other interactions of the group
        if (shippedKey !== undefined) continue;
        if (!english) continue; // the group of this interaction is not known in English yet: handled below as unaligned

        let key = Object.keys(data.groupNames).find(k => data.groupNames[k][ENGLISH] === english.value);
        if (key === undefined) {
            key = groupKeyOf(english.value);
            if (!key || Object.hasOwn(data.groupNames, key)) {
                report.conflicts.push({ what: 'new group key', id, detail: `the English group name "${english.value}" gives the key "${key}", which is not usable` });
                continue;
            }
            data.groupNames[key] = { [ENGLISH]: english.value };
            data.groupOrder.push(key);
            report.added.newGroups.push({ key, english: english.value });
        }
        data.groupById[id] = key;
        report.added.groupIds.push({ id, key, votes: english.votes });
    }

    // 2. the wording of each group in every language, from the interactions that belong to it
    const wording = new Map(); // `${key}|${lang}` -> Map(label -> [ids])
    for (const vote of groupVotes) {
        const key = data.groupById[vote.id];
        if (key === undefined) { report.unaligned.push({ lang: vote.lang, id: vote.id, label: vote.value, votes: vote.votes }); continue; }
        const slot = `${key}|${vote.lang}`;
        if (!wording.has(slot)) wording.set(slot, new Map());
        const labels = wording.get(slot);
        if (!labels.has(vote.value)) labels.set(vote.value, []);
        labels.get(vote.value).push(vote.id);
    }

    const labelInUse = (lang, label) => Object.keys(data.groupNames).find(k => data.groupNames[k][lang] === label);
    for (const [slot, labels] of [...wording].sort((a, b) => (a[0] < b[0] ? -1 : 1))) {
        const [key, lang] = slot.split('|');
        if (!Object.hasOwn(data.groupNames, key)) {
            report.conflicts.push({ what: 'group label', key, lang, detail: `the data file places interactions in the group "${key}", which has no names` });
            continue;
        }
        const shipped = data.groupNames[key][lang];

        if (labels.size > 1) {
            report.conflicts.push({ what: 'group label', key, lang, detail: `interactions of the same group have different labels: ${[...labels].map(([l, ids]) => `"${l}" (ids ${ids.join(', ')})`).join('; ')}` });
            continue;
        }
        const [label] = [...labels.keys()];
        if (shipped === label) continue;
        if (shipped !== undefined) {
            report.notApplied.push({ what: 'group label', lang, id: key, shipped, proposed: label, votes: null });
            continue;
        }
        const clash = labelInUse(lang, label);
        if (clash !== undefined && clash !== key) {
            report.conflicts.push({ what: 'group label', key, lang, detail: `the label "${label}" is already the label of the group "${clash}" in this language` });
            continue;
        }
        data.groupNames[key][lang] = label;
        report.added.groupLabels.push({ key, lang, label });
    }

    return { data, report };
}

// ─────────────────────────────────────────────────────────────────────────────
// Writing the data file
// ─────────────────────────────────────────────────────────────────────────────

/** A JavaScript string literal with single quotes, safe whatever the text is. */
// The two line separators are built from their character codes: older JavaScript engines refuse them inside a string.
const LINE_SEPARATORS = new RegExp(`[${String.fromCharCode(0x2028)}${String.fromCharCode(0x2029)}]`, 'g');

export function quote(text) {
    // JSON already escapes the double quotes, the backslashes and the control characters. We turn the double quote
    // back into a plain character, and escape the single quote (not escaped by JSON) and the line separators.
    const inner = JSON.stringify(String(text)).slice(1, -1)
        .replace(/\\"/g, '"')
        .replace(/'/g, "\\'")
        .replace(LINE_SEPARATORS, (c) => '\\u' + c.charCodeAt(0).toString(16));
    return `'${inner}'`;
}

/** Puts the items on as few lines as possible, at most WRAP_WIDTH columns wide, never splitting an item. */
function wrapItems(items, indent) {
    const lines = [];
    let current = '';
    items.forEach((item, i) => {
        const piece = item + (i < items.length - 1 ? ',' : '');
        if (current && (indent + current + ' ' + piece).length > WRAP_WIDTH) { lines.push(indent + current); current = piece; }
        else current = current ? `${current} ${piece}` : piece;
    });
    if (current) lines.push(indent + current);
    return lines.join('\n');
}

const sortedKeys = (object) => Object.keys(object).sort(byNumber);

/** The whole data file. The same data always gives the same text, so an unchanged vote gives no diff. */
export function renderDataFile(data) {
    const known = new Set([...Object.keys(data.groupNames), ...Object.values(data.groupById)]);
    const order = [...data.groupOrder.filter(k => known.has(k)), ...[...known].filter(k => !data.groupOrder.includes(k)).sort()];

    const groupNames = order.filter(k => data.groupNames[k]).map(key =>
        `    ${key}: {\n${wrapItems(sortedKeys(data.groupNames[key]).map(l => `${l}: ${quote(data.groupNames[key][l])}`), '        ')}\n    }`
    ).join(',\n');

    const groupById = order.map(key => {
        const ids = sortedKeys(data.groupById).filter(id => data.groupById[id] === key);
        return ids.length ? wrapItems(ids.map(id => `${id}: ${quote(key)}`), '    ') : null;
    }).filter(Boolean).join(',\n');

    const namesDb = sortedKeys(data.namesDb).map(lang =>
        `    ${lang}: {\n        options: {\n${wrapItems(sortedKeys(data.namesDb[lang].options).map(id => `${id}: ${quote(data.namesDb[lang].options[id])}`), '            ')}\n        }\n    }`
    ).join(',\n');

    return `// Game wording of the interaction groups, per game language id (the ids of Utils.getGameLanguage()).
//
// The Interact page tags every option with a localized data-group (e.g. "Phone" is "Telefoniche" in Italian), so
// the group name cannot be compared with an English string. The names below were read from the interaction
// dropdown of the Interact page in each of the 25 game languages, and are extended with the names sent by the
// community (see worker/README.md and scripts/sync-interaction-names.mjs, which rewrites this whole file).
// Only groups that were seen in the game are listed.
const INTERACTION_GROUP_NAMES = {
${groupNames}
};

// The game group of each interaction id, as a language-independent key (the English group name, in camelCase).
// Only the interactions that were seen in the game are listed: the others are unlocked by the relationship level
// and are expected to be added by the community collection.
const INTERACTION_GROUP_BY_ID = {
${groupById}
};

// The game groups in the order the dropdown showed them (provisional, to be confirmed with the full data).
const INTERACTION_GROUP_ORDER = [${order.map(quote).join(', ')}];

// The game's name of each interaction, per game language id: { langId: { options: { interactionId: name } } }.
// Only the interactions that were seen in the game are listed: the options page falls back to the extension's own
// label for the missing ones.
const INTERACTION_NAMES_DB = {
${namesDb}
};

// Every spelling of the Phone group, in all the languages. It is language-agnostic on purpose: the group is
// recognized by its data-group value whatever the game language is, so no language lookup is needed.
const INTERACTION_PHONE_GROUP_LABELS = new Set(Object.values(INTERACTION_GROUP_NAMES.phone));
`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Writing the pull request text
// ─────────────────────────────────────────────────────────────────────────────

/** Text from the community inside a Markdown code span: no links, no @mentions, no formatting, whatever it contains. */
export function code(text, max = 80) {
    let flat = String(text).replace(/\s+/g, ' ').trim();
    if (flat.length > max) flat = flat.slice(0, max) + '…';
    const longestRun = Math.max(0, ...(flat.match(/`+/g) || []).map(run => run.length));
    const fence = '`'.repeat(longestRun + 1);
    return `${fence}${/^`|`$/.test(flat) ? ` ${flat} ` : flat}${fence}`;
}

const languageLabel = (lang) => `${lang} (${KNOWN_LANGUAGES[lang] || '?'})`;

function listSection(lines, title, rows, render) {
    if (rows.length === 0) return;
    lines.push(`### ${title} (${rows.length})`, '');
    rows.slice(0, MAX_LISTED).forEach(row => lines.push(`- ${render(row)}`));
    if (rows.length > MAX_LISTED) lines.push(`- … and ${rows.length - MAX_LISTED} more`);
    lines.push('');
}

export function renderPrBody({ report, decisions, quorum, changed }) {
    const { added } = report;
    const lines = [
        'Updates `features/interaction-names-data.js` with the names that users of the extension sent anonymously.',
        '',
        `A value is accepted when at least **${quorum}** different installs sent it and no other value has as many votes. Only missing values are added, a value that is already shipped is never replaced here.`,
        '',
        '## What this pull request adds',
        '',
        `- Interaction names: **${added.names.length}**`,
        `- Group names: **${added.groupLabels.length}**`,
        `- Interactions placed in a group: **${added.groupIds.length}**`,
        `- New groups: **${added.newGroups.length}**`,
        '',
    ];
    if (!changed) lines.push('_No change to the data file._', '');

    lines.push('## Please check', '');
    listSection(lines, 'New groups (their position in the list is provisional)', added.newGroups, g => `${code(g.key)} from the English name ${code(g.english)}. Check \`INTERACTION_GROUP_ORDER\``);
    listSection(lines, 'Accepted but different from what is shipped (not applied)', report.notApplied,
        n => `${languageLabel(n.lang)}, ${n.what} ${code(n.id)}: shipped ${code(n.shipped)}, proposed ${code(n.proposed)}${n.votes ? ` (${n.votes} votes)` : ''}`);
    listSection(lines, 'Votes that contradict each other (not applied)', report.conflicts,
        c => `${c.what}${c.id ? ` ${code(c.id)}` : ''}${c.lang ? ` in ${languageLabel(c.lang)}` : ''}: ${c.detail}`);
    listSection(lines, 'Ties (not applied)', decisions.tied,
        t => `${languageLabel(t.lang)}, ${t.kind} ${code(t.id)}: ${t.ranked.map(r => `${code(r.value)} ${r.votes}`).join(' vs ')}`);
    listSection(lines, 'Accepted although other values got votes', decisions.outvoted,
        o => `${languageLabel(o.lang)}, ${o.kind} ${code(o.id)}: ${code(o.winner.value)} ${o.winner.votes}, against ${o.losers.map(r => `${code(r.value)} ${r.votes}`).join(', ')}`);
    listSection(lines, 'Group names that cannot be placed yet (the English group of the interaction is not known)', report.unaligned,
        u => `${languageLabel(u.lang)}, interaction ${code(u.id)}: ${code(u.label)}`);

    lines.push('## Still waiting for more votes', '',
        `${decisions.waiting.length} value(s) have fewer than ${quorum} votes${decisions.invalid ? `, and ${decisions.invalid} row(s) from the Worker were ignored as invalid` : ''}.`, '');
    decisions.waiting.slice(0, 15).forEach(w =>
        lines.push(`- ${languageLabel(w.lang)}, ${w.kind} ${code(w.id)}: ${w.ranked.map(r => `${code(r.value)} ${r.votes}`).join(', ')}`));
    if (decisions.waiting.length > 15) lines.push(`- … and ${decisions.waiting.length - 15} more`);
    lines.push('');

    lines.push('---', 'Generated by `scripts/sync-interaction-names.mjs`. Every value comes from strangers: read the diff before merging.');
    return lines.join('\n').slice(0, 60000) + '\n';
}

// ─────────────────────────────────────────────────────────────────────────────
// Running it
// ─────────────────────────────────────────────────────────────────────────────

export function synchronize({ source, rows, quorum }) {
    const existing = parseDataFile(source);
    const decisions = decideVotes(rows, quorum);
    const { data, report } = mergeVotes(existing, decisions);
    const output = renderDataFile(data);
    const changed = output !== source;
    return { output, changed, decisions, report, body: renderPrBody({ report, decisions, quorum, changed }) };
}

async function main() {
    const { NAMES_EXPORT_URL, NAMES_EXPORT_TOKEN, GITHUB_STEP_SUMMARY, GITHUB_OUTPUT } = process.env;
    const quorum = Math.max(1, parseInt(process.env.QUORUM || '2') || 2);
    const dataFile = process.env.DATA_FILE || 'features/interaction-names-data.js';
    const bodyFile = process.env.PR_BODY_FILE || 'pr-body.md';

    if (!NAMES_EXPORT_URL || !NAMES_EXPORT_TOKEN) throw new Error('NAMES_EXPORT_URL and NAMES_EXPORT_TOKEN are required');
    const url = new URL(NAMES_EXPORT_URL);
    if (url.protocol !== 'https:') throw new Error('NAMES_EXPORT_URL must be https, the token is sent to it');
    url.searchParams.set('min', '1'); // every vote, the quorum is applied here so that we can also report what is missing

    const response = await fetch(url, { headers: { Authorization: `Bearer ${NAMES_EXPORT_TOKEN}` }, signal: AbortSignal.timeout(30000) });
    // Fixed messages only: whatever the Worker answers is not ours to trust, and a log line that starts with "::" is a
    // GitHub Actions command. JSON.parse errors quote the text they choke on, so its message is not used either.
    if (!response.ok) throw new Error(`The Worker answered ${response.status}`);
    let body;
    try {
        body = await response.json();
    } catch (_) {
        throw new Error('The Worker answer is not valid JSON');
    }
    if (!body || !Array.isArray(body.rows)) throw new Error('The Worker answer has no rows');

    const source = fs.readFileSync(dataFile, 'utf8');
    const result = synchronize({ source, rows: body.rows, quorum });

    if (result.changed) fs.writeFileSync(dataFile, result.output);
    fs.writeFileSync(bodyFile, result.body);
    if (GITHUB_STEP_SUMMARY) fs.appendFileSync(GITHUB_STEP_SUMMARY, result.body);
    if (GITHUB_OUTPUT) fs.appendFileSync(GITHUB_OUTPUT, `changed=${result.changed}\n`);

    const { added } = result.report;
    console.log(`rows: ${body.rows.length}, quorum: ${quorum}, changed: ${result.changed}`);
    console.log(`added: ${added.names.length} names, ${added.groupLabels.length} group names, ${added.groupIds.length} interactions placed, ${added.newGroups.length} new groups`);
    console.log(`not applied: ${result.report.notApplied.length}, conflicts: ${result.report.conflicts.length}, ties: ${result.decisions.tied.length}, waiting: ${result.decisions.waiting.length}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    main().catch(error => {
        console.error(`sync-interaction-names failed: ${error.message}`);
        process.exit(1);
    });
}
