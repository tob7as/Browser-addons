// Capri Browser's leaderboards and bug/idea box, run as a Cloudflare Worker, so nobody needs a GitHub account.
//
//   GET  /board.txt  the boards for the Leaderboards tab (only leaderboard names and numbers)
//   GET  /board.md   the same as LEADERBOARD.md, which a GitHub Action copies into the repo
//   POST /name       {name, key}                   claims a leaderboard name for this install
//   POST /stats      {name, key, hours, ...}       puts this install's stats (all time) on the boards
//   POST /week       the same, from Capri Browsers that still send a week (its numbers only ever raise yours)
//   POST /rank       {key}                         this install's own place on each board (nobody else's)
//   POST /feedback   {kind, title, text, windows, version, key} saves a bug or idea privately for tob7as to read
//   POST /admin/feedback {admin}                 the bugs and ideas, for tob7as only (needs the ADMIN_KEY secret)
//   POST /admin/delete   {admin, id}             deletes one, for tob7as only
//   POST /admin/names    {admin}                 every leaderboard name, for tob7as only
//   POST /admin/ban      {admin, name}           removes a name and its stats, and bans the name, for tob7as only
//
// Safety:
// - There are no accounts. Each install makes a random key and keeps it; only its SHA-256 is stored, and only that key
//   can update its name. Nothing personal is sent or kept.
// - Internet addresses are never stored. Rate limits count a salted hash of the address that changes every day.
// - Names and numbers get the same checks as Capri Browser's BadName, plus checks that the numbers fit the time that has
//   passed.
// - Bugs and ideas are kept privately in the database, never put on a public page. Emails, phone numbers and anything
//   that looks like a key are still blanked first, so personal details aren't kept by accident.
// - There's no GitHub key. The one secret, ADMIN_KEY, only lets its holder read and delete bugs and ideas; without it set,
//   the admin requests are switched off. Wrong keys are rate limited.
// - Only JSON is accepted, so a web page can't quietly post here from someone's browser.
// - Bindings: DB (a D1 database). Secret: ADMIN_KEY (optional).

const BOARDS = [
  ['hours', 'Most hours watched', 'Hours watched', 'h', 100000],
  ['videos', 'Most videos finished', 'Videos finished', '', 1000000],
  ['sites', 'Most sites visited', 'Sites visited', '', 10000000],
  ['survival', 'Best survival run', 'Best survival run', ' words', 400],
  ['guess', 'Best Guess the Site run', 'Best guess the site run', '', 400],
  ['wpm', 'Best typing speed', 'Best typing speed', ' WPM', 250],
];

// Same lists as Capri Browser's BadName and .github/leaderboard.js.
const RUDE_BITS = ['fuck', 'fuk', 'fck', 'fcuk', 'fack', 'fcker', 'phuck', 'shit', 'cunt', 'bitch', 'biatch', 'nigg', 'niga', 'nigr', 'negro', 'fag', 'retard', 'spastic', 'whore', 'slut', 'skank', 'pussy', 'penis', 'vagin', 'porn', 'nazi', 'hitler', 'heil', 'kkk', 'twat', 'wank', 'jizz', 'killyourself', 'killurself', 'suicide', 'tranny', 'molest', 'pedo', 'paedo', 'bastard', 'asshole', 'arsehole', 'dumbass', 'jackass', 'asshat', 'asswipe', 'dildo', 'vibrator', 'buttplug', 'boob', 'titty', 'titties', 'tits', 'nipple', 'horny', 'nude', 'naked', 'cock', 'dick', 'sex', 'raper', 'sexx', 'sexual', 'sexting', 'cumshot', 'cumming', 'semen', 'sperm', 'orgasm', 'orgy', 'blowjob', 'handjob', 'rimjob', 'boner', 'erection', 'hentai', 'milf', 'xxx', 'nsfw', 'onlyfans', 'rapist', 'raping', 'raped', 'chink', 'kike', 'dyke', 'piss', 'prick', 'bollock', 'bellend', 'knob', 'cocaine', 'heroin', 'admin', 'moderat', 'official'];
const RUDE_WORDS = ['sex', 'rape', 'cum', 'anal', 'anus', 'ass', 'arse', 'hoe', 'thot', 'shag', 'spic', 'coon', 'paki', 'gook', 'isis', 'kys', 'kms', 'meth', 'capri', 'tobtas', 'lachy', 'staff', 'system', 'null', 'everyone', 'anthropic'];
// Real words that only look rude, taken out before the check (Sussex, Scunthorpe, peacock, torpedo...).
const ALLOWED = ['essex', 'sussex', 'wessex', 'middlesex', 'scunthorpe', 'penistone', 'peacock', 'hancock', 'woodcock', 'babcock', 'hitchcock', 'cockatoo', 'cockatiel', 'cockpit', 'cockney', 'cockroach', 'shuttlecock', 'dickens', 'dickinson', 'dickson', 'torpedo', 'speedo', 'pedometer', 'knobbly', 'therapist', 'scraper', 'scrapper', 'draper', 'grapes'];

export const nameKey = (n) => n.toLowerCase().replace(/[ _-]/g, '');

export function badName(name) {
  if (typeof name !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9 _-]{1,14}[A-Za-z0-9]$/.test(name) || name.includes('  ')) return 'Names are 3 to 16 letters or numbers (spaces, - and _ in the middle are fine).';
  const leet = { '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '8': 'b', '9': 'g' };
  const plain = name.replace(/[_-]/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase().split('').map((c) => leet[c] || c).filter((c) => /[a-z ]/.test(c)).join('');
  const squash = (w) => w.replace(/(.)\1+/g, '$1');
  const joined = plain.replace(/ /g, ''), squashed = squash(joined);
  const allow = (w) => ALLOWED.reduce((t, a) => t.split(a).join('').split(squash(a)).join(''), w);
  if (RUDE_BITS.some((b) => allow(squashed).includes(b) || allow(joined).includes(b))) return "That name isn't allowed on the board.";
  const words = plain.split(' ').filter(Boolean).concat([joined, squashed]);
  if (words.some((w) => RUDE_WORDS.some((b) => w === b || squash(w) === b || w === b + 's'))) return "That name isn't allowed on the board.";
  return null;
}

// Capri Browser's week label ("2026w47"): weeks start on Monday and week 1 holds 1 January.
export function weekOf(date) {
  const y = date.getUTCFullYear();
  const jan1 = Date.UTC(y, 0, 1);
  const day = Math.floor((Date.UTC(y, date.getUTCMonth(), date.getUTCDate()) - jan1) / 86400000);
  const jan1Monday = (new Date(jan1).getUTCDay() + 6) % 7;
  return y + 'w' + (Math.floor((day + jan1Monday) / 7) + 1);
}
const wkNum = (w) => { const m = /^(\d{4})w(\d{1,2})$/.exec(w); return m ? +m[1] * 100 + +m[2] : 0; };
// The boards are all time: everyone's stats live in one row each, under wk 0. Other rows are weeks from before.
const ALL = 0;

const SCHEMA = [
  'CREATE TABLE IF NOT EXISTS meta (k TEXT PRIMARY KEY, v TEXT NOT NULL)',
  'CREATE TABLE IF NOT EXISTS names (namekey TEXT PRIMARY KEY, name TEXT NOT NULL, owner TEXT NOT NULL UNIQUE, used INTEGER NOT NULL DEFAULT 0)',
  'CREATE TABLE IF NOT EXISTS scores (wk INTEGER NOT NULL, owner TEXT NOT NULL, name TEXT NOT NULL, hours REAL NOT NULL, videos INTEGER NOT NULL, sites INTEGER NOT NULL, survival INTEGER NOT NULL, guess INTEGER NOT NULL, wpm INTEGER NOT NULL, at INTEGER NOT NULL, sent INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (wk, owner))',
  'CREATE TABLE IF NOT EXISTS hits (k TEXT PRIMARY KEY, n INTEGER NOT NULL, until INTEGER NOT NULL)',
  // Players kept off the boards (owner hashes).
  'CREATE TABLE IF NOT EXISTS hidden (owner TEXT PRIMARY KEY)',
  // Names tob7as removed: nobody can take them again.
  'CREATE TABLE IF NOT EXISTS banned (namekey TEXT PRIMARY KEY)',
  'CREATE TABLE IF NOT EXISTS feedback (id INTEGER PRIMARY KEY AUTOINCREMENT, at TEXT NOT NULL, kind TEXT NOT NULL, title TEXT NOT NULL, text TEXT NOT NULL, version TEXT NOT NULL, windows TEXT NOT NULL)',
];
let ready = false;
async function setUp(db) {
  if (ready) return;
  await db.batch(SCHEMA.map((s) => db.prepare(s)));
  // Databases made before names had a "last used" time get it here (it fails harmlessly once it's there).
  try { await db.prepare('ALTER TABLE names ADD COLUMN used INTEGER NOT NULL DEFAULT 0').run(); } catch (e) { }
  // Names from before then count as used now, so nobody can take them straight away.
  await db.prepare('UPDATE names SET used = ?1 WHERE used = 0').bind(Date.now()).run();
  try { await db.prepare('ALTER TABLE scores ADD COLUMN sent INTEGER NOT NULL DEFAULT 0').run(); } catch (e) { }
  ready = true;
}

const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
const sha = async (text) => hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)));

// A random salt made on first use and kept only in the database, so hashed addresses can't be guessed back.
async function salt(db) {
  const got = await db.prepare("SELECT v FROM meta WHERE k = 'salt'").first();
  if (got) return got.v;
  const fresh = hex(crypto.getRandomValues(new Uint8Array(32)));
  await db.prepare("INSERT OR IGNORE INTO meta (k, v) VALUES ('salt', ?1)").bind(fresh).run();
  return (await db.prepare("SELECT v FROM meta WHERE k = 'salt'").first()).v;
}

// True when this counter has gone over max within its window.
async function over(db, key, max, seconds) {
  const now = Math.floor(Date.now() / 1000);
  const row = await db.prepare('INSERT INTO hits (k, n, until) VALUES (?1, 1, ?2) ON CONFLICT(k) DO UPDATE SET n = CASE WHEN until < ?3 THEN 1 ELSE n + 1 END, until = CASE WHEN until < ?3 THEN ?2 ELSE until END RETURNING n')
    .bind(key, now + seconds, now).first();
  if (Math.random() < 0.02) await db.prepare('DELETE FROM hits WHERE until < ?1').bind(now).run();
  return row.n > max;
}

const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
const no = (status, why) => json(status, { ok: false, why });
const SLOW = "You're sending a lot, choom. Try again in a bit.";

async function body(request) {
  if (!/^application\/json\b/i.test(request.headers.get('Content-Type') || '')) return null;
  const text = await request.text();
  if (text.length > 12000) return null;
  try { const v = JSON.parse(text); return v && typeof v === 'object' && !Array.isArray(v) ? v : null; } catch (e) { return null; }
}

// The install's key: random hex made by Capri Browser. Only its hash is kept.
const ownerOf = async (key) => (typeof key === 'string' && /^[a-f0-9]{32,64}$/.test(key) ? sha('owner:' + key) : null);

// A name nobody has picked or sent a week with for 8 weeks is free again (for someone who reinstalled and lost their key).
const NAME_KEPT_MS = 56 * 86400000;

// Claims name for owner. Returns why not, or null.
async function claim(db, name, owner) {
  const key = nameKey(name), now = Date.now();
  if (await db.prepare('SELECT 1 AS b FROM banned WHERE namekey = ?1').bind(key).first()) return "That name isn't allowed on the board.";
  const had = await db.prepare('SELECT owner, name, used FROM names WHERE namekey = ?1').bind(key).first();
  if (had && had.owner !== owner && had.used > now - NAME_KEPT_MS) return 'Someone already has the name ' + had.name + '. Pick another, choom.';
  // One name per install: a new one frees the old one.
  await db.batch([
    db.prepare('DELETE FROM names WHERE owner = ?1 AND namekey != ?2').bind(owner, key),
    db.prepare('INSERT INTO names (namekey, name, owner, used) VALUES (?1, ?2, ?3, ?4) ON CONFLICT(namekey) DO UPDATE SET name = excluded.name, owner = excluded.owner, used = excluded.used').bind(key, name, owner, now),
  ]);
  return null;
}

async function postName(db, got, who) {
  if (await over(db, 'name:' + who, 60, 3600)) return no(429, SLOW);
  const owner = await ownerOf(got.key);
  if (!owner) return no(400, "Capri Browser's key is missing. Update Capri Browser and try again.");
  if (await over(db, 'nameby:' + owner, 10, 3600)) return no(429, SLOW);
  const bad = badName(got.name);
  if (bad) return no(400, bad);
  const why = await claim(db, got.name, owner);
  if (why) return no(409, why);
  await db.prepare('UPDATE scores SET name = ?1 WHERE owner = ?2').bind(got.name, owner).run();
  return json(200, { ok: true, name: got.name });
}

async function postStats(db, got, who) {
  const owner = await ownerOf(got.key);
  if (!owner) return no(400, "Capri Browser's key is missing. Update Capri Browser and try again.");
  if (await over(db, 'week:' + who, 120, 3600)) return no(429, SLOW);
  const bad = badName(got.name);
  if (bad) return no(400, bad + ' Pick another name and send your stats again.');
  const v = {};
  for (const b of BOARDS) {
    const raw = got[b[0]] === undefined ? '0' : String(got[b[0]]);
    const n = Number(raw);
    if (!/^\d{1,8}(\.\d)?$/.test(raw) || !(n >= 0) || n > b[4] || (b[0] !== 'hours' && !Number.isInteger(n))) return no(400, 'The ' + b[2].toLowerCase() + " number doesn't look right.");
    v[b[0]] = n;
  }
  // Numbers that time makes impossible: since the last send, watch time can only grow as fast as real time (half as fast
  // again, in case two players were counted), and videos and sites get generous per-hour limits.
  const now = Date.now();
  const prev = await db.prepare('SELECT hours, videos, sites, sent FROM scores WHERE wk = ?1 AND owner = ?2').bind(ALL, owner).first();
  if (prev && prev.sent) {
    const hrs = (now - prev.sent) / 3600000;
    if (v.hours - prev.hours > hrs * 1.5 + 0.5 || v.videos - prev.videos > hrs * 30 + 30 || v.sites - prev.sites > hrs * 300 + 100) return no(400, "Your numbers went up faster than time has passed since you last sent, so I can't use them.");
  }
  // One good send every 2 minutes per install (refused ones don't count).
  if (await over(db, 'weekby:' + owner, 1, 120)) return no(429, SLOW);
  const why = await claim(db, got.name, owner);
  if (why) return no(409, why);
  // Keeps the best of each number.
  await db.prepare('INSERT INTO scores (wk, owner, name, hours, videos, sites, survival, guess, wpm, at, sent) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?10) '
    + 'ON CONFLICT(wk, owner) DO UPDATE SET name = excluded.name, sent = excluded.sent, hours = max(hours, excluded.hours), videos = max(videos, excluded.videos), sites = max(sites, excluded.sites), '
    + 'survival = max(survival, excluded.survival), guess = max(guess, excluded.guess), wpm = max(wpm, excluded.wpm)')
    .bind(ALL, owner, got.name, v.hours, v.videos, v.sites, v.survival, v.guess, v.wpm, now).run();
  // Old rows follow a rename too, so a freed name doesn't stay on them as someone else's.
  await db.prepare('UPDATE scores SET name = ?1 WHERE owner = ?2').bind(got.name, owner).run();
  return json(200, { ok: true, message: "You're on the boards as " + got.name + ', choom. Your stats update by themselves every week, or press Send my stats any time.' });
}

// This install's own place on each board, as the boards order them (higher first, then whoever got there first), and how
// many players there are. Only the key's owner can ask, so nobody can look up someone else's place.
async function postRank(db, got, who) {
  const owner = await ownerOf(got.key);
  if (!owner) return no(400, "Capri Browser's key is missing. Update Capri Browser and try again.");
  if (await over(db, 'rank:' + who, 240, 3600)) return no(429, SLOW);
  const mine = await db.prepare('SELECT hours, videos, sites, survival, guess, wpm, at FROM scores WHERE wk = ?1 AND owner = ?2').bind(ALL, owner).first();
  if (!mine) return json(200, { ok: true, message: '' });
  const ahead = BOARDS.map((b, i) => 'SUM(CASE WHEN ' + b[0] + ' > ?' + (i + 3) + ' OR (' + b[0] + ' = ?' + (i + 3) + ' AND at < ?9) THEN 1 ELSE 0 END) AS ' + b[0]).join(', ');
  const n = await db.prepare('SELECT COUNT(*) AS total, ' + ahead + ' FROM scores WHERE wk = ?1 AND owner != ?2 AND owner NOT IN (SELECT owner FROM hidden)')
    .bind(ALL, owner, ...BOARDS.map((b) => mine[b[0]]), mine.at).first();
  // "total=312;hours=57:7.4;videos=3:120;..." (place:number), so older Capri Browsers can read it as a plain message.
  const out = ['total=' + ((n.total || 0) + 1)].concat(BOARDS.map((b) => b[0] + '=' + ((n[b[0]] || 0) + 1) + ':' + num(mine[b[0]], b)));
  return json(200, { ok: true, message: out.join(';') });
}

// Only the holder of the ADMIN_KEY secret: compared as hashes so the time taken says nothing about the key.
async function isAdmin(env, db, got, who) {
  if (await over(db, 'admin:' + who, 60, 3600)) return false;
  const real = env.ADMIN_KEY;
  if (typeof real !== 'string' || real.length < 32 || typeof got.admin !== 'string' || got.admin.length > 200) return false;
  return (await sha('admin:' + got.admin)) === (await sha('admin:' + real));
}

// The bugs and ideas, newest first, one per line: id, time, kind, title, text, version, Windows, each URI-encoded and split by tabs.
async function adminFeedback(env, db, got, who) {
  if (!(await isAdmin(env, db, got, who))) return new Response('Not here.\n', { status: 404 });
  const rows = (await db.prepare('SELECT id, at, kind, title, text, version, windows FROM feedback ORDER BY id DESC LIMIT 500').all()).results;
  const txt = rows.map((r) => [r.id, r.at, r.kind, r.title, r.text, r.version, r.windows].map((v) => encodeURIComponent(String(v))).join('\t')).join('\n');
  return new Response(txt, { headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
}

async function adminDelete(env, db, got, who) {
  if (!(await isAdmin(env, db, got, who))) return new Response('Not here.\n', { status: 404 });
  const id = Number(got.id);
  if (!Number.isInteger(id) || id < 1) return no(400, 'Which one?');
  await db.prepare('DELETE FROM feedback WHERE id = ?1').bind(id).run();
  return json(200, { ok: true, message: 'Deleted.' });
}

// Every name, newest first: name, hours, best typing speed, when last used (ms), one per line, URI-encoded and split by tabs.
async function adminNames(env, db, got, who) {
  if (!(await isAdmin(env, db, got, who))) return new Response('Not here.\n', { status: 404 });
  const rows = (await db.prepare('SELECT n.name AS name, COALESCE(s.hours, 0) AS hours, COALESCE(s.wpm, 0) AS wpm, n.used AS used FROM names n LEFT JOIN scores s ON s.owner = n.owner AND s.wk = ?1 ORDER BY n.used DESC LIMIT 1000').bind(ALL).all()).results;
  const txt = rows.map((r) => [r.name, r.hours, r.wpm, r.used].map((v) => encodeURIComponent(String(v))).join('\t')).join('\n');
  return new Response(txt, { headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
}

// Removes a name: its owner's stats and the name go, and the name is banned so nobody can take it again.
async function adminBan(env, db, got, who) {
  if (!(await isAdmin(env, db, got, who))) return new Response('Not here.\n', { status: 404 });
  if (typeof got.name !== 'string' || got.name.length < 1 || got.name.length > 40) return no(400, 'Which name?');
  const key = nameKey(got.name);
  const had = await db.prepare('SELECT owner FROM names WHERE namekey = ?1').bind(key).first();
  const out = [db.prepare('INSERT OR IGNORE INTO banned (namekey) VALUES (?1)').bind(key), db.prepare('DELETE FROM names WHERE namekey = ?1').bind(key)];
  if (had) out.push(db.prepare('DELETE FROM scores WHERE owner = ?1').bind(had.owner));
  out.push(db.prepare('DELETE FROM scores WHERE name = ?1').bind(got.name));
  await db.batch(out);
  return json(200, { ok: true, message: 'Removed and banned.' });
}

// Blanks what shouldn't go on a public page, and stops @mentions pinging anyone.
export function scrub(text) {
  return String(text)
    .replace(/\r\n?/g, '\n')
    .replace(/[\u0000-\u0008\u000b-\u001f\u007f\u200b-\u200f\u202a-\u202e\u2066-\u2069]/g, '')
    .replace(/\b(?:gh[pousr]_|github_pat_|sk-|xox[abp]-|AKIA)[A-Za-z0-9_-]{8,}/g, '[key removed]')
    .replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, '[email removed]')
    .replace(/\+?\d[\d \-().]{7,}\d/g, (m) => (m.replace(/\D/g, '').length >= 9 ? '[number removed]' : m))
    .replace(/(^|[^\w`])@(?=[A-Za-z0-9])/g, '$1@\u200b')
    .replace(/\n{4,}/g, '\n\n\n')
    .trim();
}

async function postFeedback(db, got, who) {
  // A whole school or family can share one network, so that limit is loose; each copy of Capri Browser has a tight one.
  if (await over(db, 'fb:' + who, 15, 3600) || await over(db, 'fbday:' + who, 40, 86400)) return no(429, SLOW);
  const owner = await ownerOf(got.key);
  if (owner && (await over(db, 'fbby:' + owner, 3, 3600) || await over(db, 'fbbyday:' + owner, 10, 86400))) return no(429, SLOW);
  // Capri Browser offers GitHub instead when it sees "full": true.
  if (await over(db, 'fball', 150, 86400)) return json(429, { ok: false, full: true, why: 'The bug and idea box is full for today.' });
  const bug = got.kind === 'bug';
  if (!bug && got.kind !== 'idea') return no(400, 'Pick bug or idea.');
  const title = scrub(got.title || '').replace(/\s+/g, ' ');
  const text = scrub(got.text || '');
  if (title.length < 3 || title.length > 100) return no(400, 'Give it a short title (3 to 100 letters).');
  if (text.length < 10 || text.length > 4000) return no(400, 'Write a bit more about it (up to 4000 letters).');
  const windows = typeof got.windows === 'string' && /^Windows(?: 1[01] \(build \d{4,6}\))?$/.test(got.windows) ? got.windows : 'Windows';
  const version = typeof got.version === 'string' && /^\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(got.version) ? got.version : '?';
  // Kept privately in the database (read it in the Cloudflare dashboard: D1 > capri-browser > feedback).
  await db.prepare('INSERT INTO feedback (at, kind, title, text, version, windows) VALUES (?1, ?2, ?3, ?4, ?5, ?6)')
    .bind(new Date().toISOString().slice(0, 16).replace('T', ' '), bug ? 'bug' : 'idea', title, text, version, windows).run();
  return json(200, { ok: true, message: 'Sent, choom. Thanks!' });
}

// The top 100 of each board, all time (LEADERBOARD.md shows the top 10). Everyone who has sent their stats is on every board, even with 0.
async function boards(db) {
  const out = { rows: {} };
  for (const b of BOARDS) {
    out.rows[b[0]] = (await db.prepare('SELECT name, ' + b[0] + ' AS v FROM scores WHERE wk = ?1 AND owner NOT IN (SELECT owner FROM hidden) ORDER BY ' + b[0] + ' DESC, at ASC LIMIT 100').bind(ALL).all()).results;
  }
  return out;
}

const num = (v, b) => (b[0] === 'hours' ? Number(v).toFixed(1) : String(v));

export function boardTxt(d) {
  let txt = '# Capri Browser leaderboards, made by the Capri Browser worker. Only leaderboard names and numbers.\n'
    + 'updated\t' + new Date().toISOString().slice(0, 16) + 'Z\n';
  for (const b of BOARDS) for (const p of d.rows[b[0]]) txt += 'row\t' + b[0] + '\t' + p.name + '\t' + num(p.v, b) + '\n';
  return txt;
}

export function boardMd(d) {
  const show = (v, b) => num(v, b) + b[3];
  let md = "# Capri Browser leaderboards\n\nTop 10s from [Capri Browser](README.md), all time. Everyone's stats update by themselves every week, or when they press **Send my stats**.\n\n"
    + 'To join, open **Games** in Capri Browser, add a leaderboard name and press **Send my stats**. No account needed. Only your leaderboard name and your numbers show here.\n';
  for (const b of BOARDS) {
    const rows = d.rows[b[0]].slice(0, 10);
    md += '\n## ' + b[1] + '\n\n';
    if (!rows.length) { md += '_Nobody yet. Be the first!_\n'; continue; }
    md += '| # | Name | ' + b[2] + ' |\n| ---: | --- | ---: |\n';
    rows.forEach((p, i) => { md += '| ' + (i + 1) + ' | ' + p.name + ' | ' + show(p.v, b) + ' |\n'; });
  }
  return md;
}

// Keeps as little as possible, for players and for us: run once a day by Cloudflare (the cron in wrangler.toml).
// Weekly rows from before the boards were all time once they're a year old (never the all-time ones), bugs and ideas older than 6 months, names unused for a year and old spam counters are deleted.
export async function tidy(db) {
  await setUp(db);
  const now = Date.now();
  const yearAgo = wkNum(weekOf(new Date(now - 365 * 86400000)));
  await db.batch([
    db.prepare('DELETE FROM scores WHERE wk > 0 AND wk < ?1').bind(yearAgo),
    db.prepare('DELETE FROM feedback WHERE at < ?1').bind(new Date(now - 182 * 86400000).toISOString().slice(0, 16).replace('T', ' ')),
    db.prepare('DELETE FROM names WHERE used < ?1').bind(now - 365 * 86400000),
    db.prepare('DELETE FROM hits WHERE until < ?1').bind(Math.floor(now / 1000)),
  ]);
}

export default {
  async scheduled(event, env, ctx) {
    if (env.DB) ctx.waitUntil(tidy(env.DB));
  },

  async fetch(request, env) {
    try {
      if (!env.DB) return no(503, 'The database is not connected yet (add a D1 binding called DB).');
      const db = env.DB;
      await setUp(db);
      const path = new URL(request.url).pathname;
      if (request.method === 'GET' || request.method === 'HEAD') {
        const text = path === '/board.txt' ? boardTxt(await boards(db)) : path === '/board.md' ? boardMd(await boards(db)) : path === '/' ? 'Capri Browser worker. Nothing to see here, choom.\n' : null;
        if (text === null) return new Response('Not here.\n', { status: 404 });
        return new Response(request.method === 'HEAD' ? null : text, { headers: { 'Content-Type': (path.endsWith('.md') ? 'text/markdown' : 'text/plain') + '; charset=utf-8', 'Cache-Control': 'public, max-age=60', 'X-Content-Type-Options': 'nosniff' } });
      }
      if (request.method !== 'POST') return no(405, 'Not here.');
      const got = await body(request);
      if (!got) return no(400, 'That was not something Capri Browser sends.');
      // Who's asking, for rate limits only: a salted hash of the address that changes daily, never the address itself.
      const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
      const who = (await sha((await salt(db)) + new Date().toISOString().slice(0, 10) + ip)).slice(0, 32);
      if (path === '/name') return await postName(db, got, who);
      if (path === '/stats' || path === '/week') return await postStats(db, got, who);
      if (path === '/rank') return await postRank(db, got, who);
      if (path === '/feedback') return await postFeedback(db, got, who);
      if (path === '/admin/feedback') return await adminFeedback(env, db, got, who);
      if (path === '/admin/delete') return await adminDelete(env, db, got, who);
      if (path === '/admin/names') return await adminNames(env, db, got, who);
      if (path === '/admin/ban') return await adminBan(env, db, got, who);
      return no(404, 'Not here.');
    } catch (e) {
      // Only the error's own message, never anything the player sent.
      console.log('worker error', e && e.message);
      return no(500, 'Something went wrong on the leaderboard server. Try again in a bit, choom.');
    }
  },
};
