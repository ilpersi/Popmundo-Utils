// ─────────────────────────────────────────────────────────────────────────────
// What this file is
// ─────────────────────────────────────────────────────────────────────────────
// Collects the game's own names of the Popmundo interactions and of their groups, sent anonymously by the extension
// (see submitInteractionNames in background.js). Runs on Cloudflare Workers with a D1 database (see schema.sql).
//
//   POST /submit   { schema: 1, lang, install, entries: [{ kind: 'name' | 'group', id, value }] }
//   GET  /export   Authorization: Bearer <EXPORT_TOKEN>, returns how many installs sent each value
//
// Nothing here is trusted: every field is validated, and names are only ever stored and returned as data.
//
// ─────────────────────────────────────────────────────────────────────────────
// How Cloudflare Workers work, in short
// ─────────────────────────────────────────────────────────────────────────────
// - A Worker is just a JavaScript module that Cloudflare runs on its own servers every time an HTTP request reaches
//   its URL. There is no server of ours to start, patch or keep alive: when nobody calls it, nothing runs.
// - The entry point is the `fetch` function exported at the bottom of this file. Cloudflare calls it with
//   (request, env): the incoming request and the "environment".
// - `request` and the `Response` we return are the same web standard objects used by the browser `fetch()` API.
//   `URL`, `Headers` and `TextEncoder` used below are standard too.
// - `env` is where Cloudflare hands us what we configured outside the code:
//     env.DB            the D1 database ("binding" named DB in wrangler.toml). D1 is SQLite hosted by Cloudflare.
//     env.EXPORT_TOKEN  a secret set with `wrangler secret put EXPORT_TOKEN`. It never appears in the repository.
// - Each request is handled on its own: variables defined at the top of the file are constants, nothing is kept in
//   memory between requests. Everything that must survive is written to the database.

// ─────────────────────────────────────────────────────────────────────────────
// Rules for what we accept
// ─────────────────────────────────────────────────────────────────────────────

// Game language ids (the ones of Utils.getGameLanguage in the extension). Anything else is refused.
const KNOWN_LANGUAGES = new Set([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 14, 19, 23, 24, 33, 36, 39, 43, 50, 51, 56, 60, 106]);

// 'name'  : the game's name of an interaction in that language
// 'group' : the label of the group the interaction belongs to in that language
const KINDS = new Set(['name', 'group']);

// Version of the request format. If the extension changes the format it bumps this number, and old Workers refuse it.
const SCHEMA_VERSION = 1;

// Limits that keep a single request small, so nobody can fill the free database with one huge call
const MAX_BODY_BYTES = 16 * 1024;
const MAX_ENTRIES = 80; // same value as TRANSLATIONS_CHUNK_SIZE in background.js
const MAX_VALUE_LENGTH = 60; // same value as MAX_NAME_LENGTH in the collector
const MAX_ID = 9999;

// The random id of an install: a version 1-8 UUID, like 11111111-2222-4333-8444-555555555555
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// Names are shown later in the extension and end up in a pull request, so we refuse anything that is not plain text:
// control characters, markup (< >) and anything that looks like a link
const FORBIDDEN_VALUE = /[\u0000-\u001f\u007f<>]|https?:|www\./i;

// ─────────────────────────────────────────────────────────────────────────────
// CORS
// ─────────────────────────────────────────────────────────────────────────────
// A browser (and an extension's background script) only lets a page read the answer of another website if that website
// says so with these headers. For a POST with a JSON body the browser first sends an OPTIONS "preflight" request to ask
// whether it is allowed, see the OPTIONS branch in handleRequest.
// '*' means any origin: the extension has a different origin on every browser, and the data is public, harmless and
// anonymous anyway. The export route is protected by its token, not by CORS.
const CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400' // the browser may remember the preflight answer for a day
};

// ─────────────────────────────────────────────────────────────────────────────
// SQL
// ─────────────────────────────────────────────────────────────────────────────
// The ? are placeholders: the values are given separately with bind() and are never glued into the text of the query.
// This is what prevents SQL injection, so never build these strings by concatenating request data.

// "Upsert": insert the row, but if this install already sent a value for the same (lang, kind, key) change that row
// instead of adding another one (the primary key in schema.sql is what detects the conflict). So one install is
// always exactly one vote. The WHERE makes the update happen only when the value really changed: sending the same
// thing twice then writes nothing, which spares the daily write quota of the free plan.
const UPSERT = `INSERT INTO submissions (lang, kind, key, value, install, ts) VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT (lang, kind, key, install) DO UPDATE SET value = excluded.value, ts = excluded.ts
    WHERE submissions.value <> excluded.value`;

// Counts how many different installs sent each value. HAVING keeps only values with at least the requested number of
// votes (the single ? at the end). Install ids are not selected, so they can never leak through the export.
const EXPORT = `SELECT lang, kind, key, value, COUNT(*) AS votes FROM submissions
    GROUP BY lang, kind, key, value HAVING COUNT(*) >= ?
    ORDER BY lang, kind, key, votes DESC, value`;

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

// Builds a JSON answer. Every answer carries the CORS headers, errors included: otherwise the browser would hide the
// error from the extension. 'no-store' tells Cloudflare and browsers never to keep a copy.
function json(body, status = 200) {
    return new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...CORS_HEADERS }
    });
}

/**
 * Checks a submission body, which is whatever a stranger sent us, so every field is checked one by one.
 * It is exported only so that it can be tested on its own.
 * @return {{error: string}|{lang: number, install: string, entries: Array<{kind: string, id: number, value: string}>}}
 *         Either an error message, or the same data cleaned up (values are trimmed, unknown fields are dropped).
 */
export function validateSubmission(body) {
    if (!body || typeof body !== 'object' || Array.isArray(body)) return { error: 'The body must be an object' };
    if (body.schema !== SCHEMA_VERSION) return { error: 'Unsupported schema' };
    if (!Number.isInteger(body.lang) || !KNOWN_LANGUAGES.has(body.lang)) return { error: 'Unknown language' };
    if (typeof body.install !== 'string' || !UUID.test(body.install)) return { error: 'Invalid install id' };
    if (!Array.isArray(body.entries) || body.entries.length === 0) return { error: 'No entries' };
    if (body.entries.length > MAX_ENTRIES) return { error: `At most ${MAX_ENTRIES} entries` };

    const entries = [];
    for (const entry of body.entries) {
        if (!entry || typeof entry !== 'object') return { error: 'Invalid entry' };
        if (!KINDS.has(entry.kind)) return { error: 'Invalid kind' };
        if (!Number.isInteger(entry.id) || entry.id < 1 || entry.id > MAX_ID) return { error: 'Invalid interaction id' };
        if (typeof entry.value !== 'string') return { error: 'Invalid value' };

        const value = entry.value.trim();
        if (value.length === 0 || value.length > MAX_VALUE_LENGTH || FORBIDDEN_VALUE.test(value)) return { error: 'Invalid value' };

        // We copy only the fields we know, so extra fields sent by a stranger never reach the database
        entries.push({ kind: entry.kind, id: entry.id, value });
    }

    // One invalid entry makes the whole request fail (we returned above): nothing is stored from a half-bad request
    return { lang: body.lang, install: body.install, entries };
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /submit: called by the extension
// ─────────────────────────────────────────────────────────────────────────────
async function submit(request, env) {
    // First a cheap check on the size announced by the client...
    const declared = Number(request.headers.get('Content-Length'));
    if (declared > MAX_BODY_BYTES) return json({ error: 'Too large' }, 413);

    // ...then on the real size, because the header can be missing or wrong
    const text = await request.text();
    if (new TextEncoder().encode(text).length > MAX_BODY_BYTES) return json({ error: 'Too large' }, 413);

    // JSON.parse throws on invalid JSON: that is a client error (400), not a crash of the Worker
    let body;
    try {
        body = JSON.parse(text);
    } catch (_) {
        return json({ error: 'Invalid JSON' }, 400);
    }

    const checked = validateSubmission(body);
    if (checked.error) return json({ error: checked.error }, 400);

    // env.DB is the D1 binding. prepare() compiles the query once, bind() fills the ? for one row, and
    // batch() sends all the rows together and runs them in a single transaction: either every entry is
    // stored or none is, so a failure in the middle never leaves a request half saved.
    const now = Date.now();
    const statement = env.DB.prepare(UPSERT);
    try {
        await env.DB.batch(checked.entries.map(entry =>
            statement.bind(checked.lang, entry.kind, entry.id, entry.value, checked.install, now)));
    } catch (_) {
        // 5xx tells the extension that retrying later makes sense (4xx would tell it that the data itself was refused)
        return json({ error: 'Storage error' }, 500);
    }

    return json({ accepted: checked.entries.length });
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /export: called by the maintainer's sync script, protected by the secret token
// ─────────────────────────────────────────────────────────────────────────────

// Compares two secrets. A normal === stops at the first different character, so the time it takes could, in theory,
// reveal how many characters of a guessed token are right. Here the whole text is always compared.
function sameSecret(given, expected) {
    if (typeof given !== 'string' || typeof expected !== 'string' || given.length !== expected.length) return false;
    let diff = 0;
    for (let i = 0; i < expected.length; i++) diff |= given.charCodeAt(i) ^ expected.charCodeAt(i);
    return diff === 0;
}

async function exportRows(request, env) {
    // The caller sends "Authorization: Bearer <token>". If the secret was never configured on the Worker, nobody gets in.
    const header = request.headers.get('Authorization') || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : '';
    if (!env.EXPORT_TOKEN || !sameSecret(token, env.EXPORT_TOKEN)) return json({ error: 'Unauthorized' }, 401);

    // ?min=2 keeps only the values sent by at least 2 installs. Anything that is not a number counts as 1.
    const min = Math.max(1, parseInt(new URL(request.url).searchParams.get('min')) || 1);
    try {
        // all() returns { results: [one object per row], ... }
        const { results } = await env.DB.prepare(EXPORT).bind(min).all();
        return json({ generated: new Date().toISOString(), min, rows: results });
    } catch (_) {
        return json({ error: 'Storage error' }, 500);
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Entry point
// ─────────────────────────────────────────────────────────────────────────────

// Decides what to do with every request that reaches the Worker. It is a named export too, so that the tests can
// call it directly with a fake request and a fake database, without Cloudflare.
export async function handleRequest(request, env) {
    // The browser's CORS preflight: just say "yes, this is allowed", with no body (204)
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS_HEADERS });

    const { pathname } = new URL(request.url);
    if (pathname === '/submit') return request.method === 'POST' ? submit(request, env) : json({ error: 'Method not allowed' }, 405);
    if (pathname === '/export') return request.method === 'GET' ? exportRows(request, env) : json({ error: 'Method not allowed' }, 405);
    return json({ error: 'Not found' }, 404);
}

// This is what Cloudflare looks for: the default export of the module with a `fetch` function, which it calls
// for every HTTP request (main = "src/index.js" in wrangler.toml points to this file).
export default {
    fetch: handleRequest
};
