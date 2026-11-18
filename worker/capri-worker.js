// Capri Browser's leaderboards and bug/idea box, run as a Cloudflare Worker, so nobody needs a GitHub account.
//
//   GET  /board.txt  this week's boards for the Leaderboards tab (only leaderboard names and numbers)
//   GET  /board.md   the same as LEADERBOARD.md, which a GitHub Action copies into the repo
//   POST /name       {name, key}                   claims a leaderboard name for this install
//   POST /week       {name, key, week, hours, ...} puts this install's week on the boards
//   POST /feedback   {kind, title, text, windows, version} saves a bug or idea privately for tob7as to read
//
// Safety:
// - There are no accounts. Each install makes a random key and keeps it; only its SHA-256 is stored, and only that key
//   can update its name. Nothing personal is sent or kept.
// - Internet addresses are never stored. Rate limits count a salted hash of the address that changes every day.
// - Names and numbers get the same checks as .github/leaderboard.js and Capri Browser's BadName.
// - Bugs and ideas are kept privately in the database, never put on a public page. Emails, phone numbers and anything
//   that looks like a key are still blanked first, so personal details aren't kept by accident.
// - There's no GitHub key or any other secret: nothing here could be leaked to get into anything.
// - Only JSON is accepted, so a web page can't quietly post here from someone's browser.
// - Bindings: DB (a D1 database). No secrets.

const BOARDS = [
  ['hours', 'Most hours watched', 'Hours watched', 'h', 168],
  ['videos', 'Most videos finished', 'Videos finished', '', 3000],
  ['sites', 'Most sites visited', 'Sites visited', '', 30000],
  ['survival', 'Best survival run', 'Best survival run', ' words', 400],
  ['guess', 'Best Guess the Site run', 'Best guess the site run', '', 400],
  ['wpm', 'Best typing speed', 'Best typing speed', ' WPM', 250],
];

// Same lists as Capri Browser's BadName and .github/leaderboard.js.
const RUDE_BITS = ['fuck', 'fuk', 'fack', 'fcker', 'phuck', 'shit', 'cunt', 'bitch', 'nigg', 'niga', 'nigr', 'fag', 'retard', 'whore', 'slut', 'pussy', 'penis', 'vagina', 'porn', 'nazi', 'hitler', 'kkk', 'twat', 'wanker', 'jizz', 'killyourself', 'tranny', 'molest', 'pedo', 'bastard', 'asshole', 'dildo', 'boob', 'titty', 'horny', 'nude', 'naked', 'admin', 'moderator', 'official'];
const RUDE_WORDS = ['sex', 'rape', 'cock', 'dick', 'cum', 'anal', 'tits', 'spic', 'chink', 'kike', 'coon', 'paki', 'gook', 'dyke', 'isis', 'kys', 'rapist', 'wank', 'ass', 'arse', 'hoe', 'capri', 'tobtas', 'lachy', 'staff', 'system', 'null', 'everyone', 'anthropic'];

export const nameKey = (n) => n.toLowerCase().replace(/[ _-]/g, '');

export function badName(name) {
  if (typeof name !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9 _-]{1,14}[A-Za-z0-9]$/.test(name) || name.includes('  ')) return 'Names are 3 to 16 letters or numbers (spaces, - and _ in the middle are fine).';
  const leet = { '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '8': 'b', '9': 'g' };
  const plain = name.replace(/[_-]/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase().split('').map((c) => leet[c] || c).filter((c) => /[a-z ]/.test(c)).join('');
  const joined = plain.replace(/ /g, '');
  const squash = (w) => w.replace(/(.)\1+/g, '$1');
  const squashed = squash(joined);
  if (RUDE_BITS.some((b) => squashed.includes(b) || joined.includes(b))) return "That name isn't allowed on the board.";
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
const wkLabel = (n) => Math.floor(n / 100) + 'w' + (n % 100);

const SCHEMA = [
  'CREATE TABLE IF NOT EXISTS meta (k TEXT PRIMARY KEY, v TEXT NOT NULL)',
  'CREATE TABLE IF NOT EXISTS names (namekey TEXT PRIMARY KEY, name TEXT NOT NULL, owner TEXT NOT NULL UNIQUE)',
  'CREATE TABLE IF NOT EXISTS scores (wk INTEGER NOT NULL, owner TEXT NOT NULL, name TEXT NOT NULL, hours REAL NOT NULL, videos INTEGER NOT NULL, sites INTEGER NOT NULL, survival INTEGER NOT NULL, guess INTEGER NOT NULL, wpm INTEGER NOT NULL, at INTEGER NOT NULL, PRIMARY KEY (wk, owner))',
  'CREATE TABLE IF NOT EXISTS hits (k TEXT PRIMARY KEY, n INTEGER NOT NULL, until INTEGER NOT NULL)',
  'CREATE TABLE IF NOT EXISTS feedback (id INTEGER PRIMARY KEY AUTOINCREMENT, at TEXT NOT NULL, kind TEXT NOT NULL, title TEXT NOT NULL, text TEXT NOT NULL, version TEXT NOT NULL, windows TEXT NOT NULL)',
];
let ready = false;
async function setUp(db) {
  if (ready) return;
  await db.batch(SCHEMA.map((s) => db.prepare(s)));
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

// Claims name for owner. Returns why not, or null.
async function claim(db, name, owner) {
  const key = nameKey(name);
  const had = await db.prepare('SELECT owner, name FROM names WHERE namekey = ?1').bind(key).first();
  if (had && had.owner !== owner) return 'Someone already has the name ' + had.name + '. Pick another, choom.';
  // One name per install: a new one frees the old one.
  await db.batch([
    db.prepare('DELETE FROM names WHERE owner = ?1 AND namekey != ?2').bind(owner, key),
    db.prepare('INSERT INTO names (namekey, name, owner) VALUES (?1, ?2, ?3) ON CONFLICT(namekey) DO UPDATE SET name = excluded.name').bind(key, name, owner),
  ]);
  return null;
}

async function postName(db, got, who) {
  if (await over(db, 'name:' + who, 20, 3600)) return no(429, SLOW);
  const owner = await ownerOf(got.key);
  if (!owner) return no(400, "Capri Browser's key is missing. Update Capri Browser and try again.");
  const bad = badName(got.name);
  if (bad) return no(400, bad);
  const why = await claim(db, got.name, owner);
  return why ? no(409, why) : json(200, { ok: true, name: got.name });
}

async function postWeek(db, got, who) {
  const owner = await ownerOf(got.key);
  if (!owner) return no(400, "Capri Browser's key is missing. Update Capri Browser and try again.");
  if (await over(db, 'week:' + who, 20, 3600)) return no(429, SLOW);
  const bad = badName(got.name);
  if (bad) return no(400, bad + ' Pick another name and send your week again.');
  const now = new Date();
  const fits = [-12, -6, 0, 6, 14].map((h) => weekOf(new Date(now.getTime() + h * 3600000)));
  if (typeof got.week !== 'string' || !fits.includes(got.week)) return no(400, "These numbers are from an earlier week, so they can't go on this week's boards.");
  const v = {};
  for (const b of BOARDS) {
    const raw = got[b[0]] === undefined ? '0' : String(got[b[0]]);
    const n = Number(raw);
    if (!/^\d{1,5}(\.\d)?$/.test(raw) || !(n >= 0) || n > b[4] || (b[0] !== 'hours' && !Number.isInteger(n))) return no(400, 'The ' + b[2].toLowerCase() + " number doesn't look right.");
    v[b[0]] = n;
  }
  // One good send every 2 minutes per install (refused ones don't count).
  if (await over(db, 'weekby:' + owner, 1, 120)) return no(429, SLOW);
  const why = await claim(db, got.name, owner);
  if (why) return no(409, why);
  const wk = wkNum(weekOf(now));
  // Keeps the best of each number for the week.
  await db.prepare('INSERT INTO scores (wk, owner, name, hours, videos, sites, survival, guess, wpm, at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10) '
    + 'ON CONFLICT(wk, owner) DO UPDATE SET name = excluded.name, hours = max(hours, excluded.hours), videos = max(videos, excluded.videos), sites = max(sites, excluded.sites), '
    + 'survival = max(survival, excluded.survival), guess = max(guess, excluded.guess), wpm = max(wpm, excluded.wpm)')
    .bind(wk, owner, got.name, v.hours, v.videos, v.sites, v.survival, v.guess, v.wpm, Date.now()).run();
  // Old weeks' names follow a rename too, so a freed name doesn't stay on an old board as someone else's.
  await db.prepare('UPDATE scores SET name = ?1 WHERE owner = ?2').bind(got.name, owner).run();
  return json(200, { ok: true, message: "You're on this week's boards as " + got.name + ', choom. Send your week again any time to update your numbers.' });
}

// Blanks what shouldn't go on a public page, and stops @mentions pinging anyone.
export function scrub(text) {
  return String(text)
    .replace(/\r\n?/g, '\n')
    .replace(/[\u0000-\u0008\u000b-\u001f\u007f​-‏‪-‮⁦-⁩]/g, '')
    .replace(/\b(?:gh[pousr]_|github_pat_|sk-|xox[abp]-|AKIA)[A-Za-z0-9_-]{8,}/g, '[key removed]')
    .replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, '[email removed]')
    .replace(/\+?\d[\d \-().]{7,}\d/g, (m) => (m.replace(/\D/g, '').length >= 9 ? '[number removed]' : m))
    .replace(/(^|[^\w`])@(?=[A-Za-z0-9])/g, '$1@​')
    .replace(/\n{4,}/g, '\n\n\n')
    .trim();
}

async function postFeedback(db, got, who) {
  if (await over(db, 'fb:' + who, 3, 3600) || await over(db, 'fbday:' + who, 10, 86400)) return no(429, SLOW);
  if (await over(db, 'fball', 60, 86400)) return no(429, 'The bug and idea box is full for today. Try again tomorrow, choom.');
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

// This week's top 10s and last week's champions.
async function boards(db) {
  const wk = wkNum(weekOf(new Date()));
  const out = { wk, rows: {}, last: null, champs: {} };
  for (const b of BOARDS) {
    out.rows[b[0]] = (await db.prepare('SELECT name, ' + b[0] + ' AS v FROM scores WHERE wk = ?1 AND ' + b[0] + ' > 0 ORDER BY ' + b[0] + ' DESC, at ASC LIMIT 10').bind(wk).all()).results;
  }
  const last = await db.prepare('SELECT MAX(wk) AS wk FROM scores WHERE wk < ?1').bind(wk).first();
  if (last && last.wk) {
    out.last = last.wk;
    for (const b of BOARDS) {
      const c = await db.prepare('SELECT name, ' + b[0] + ' AS v FROM scores WHERE wk = ?1 AND ' + b[0] + ' > 0 ORDER BY ' + b[0] + ' DESC, at ASC LIMIT 1').bind(last.wk).first();
      if (c) out.champs[b[0]] = c;
    }
  }
  return out;
}

const num = (v, b) => (b[0] === 'hours' ? Number(v).toFixed(1) : String(v));

export function boardTxt(d) {
  let txt = '# Capri Browser leaderboards, made by the Capri Browser worker. Only leaderboard names and numbers.\n'
    + 'week\t' + wkLabel(d.wk) + '\nupdated\t' + new Date().toISOString().slice(0, 16) + 'Z\n';
  for (const b of BOARDS) for (const p of d.rows[b[0]]) txt += 'row\t' + b[0] + '\t' + p.name + '\t' + num(p.v, b) + '\n';
  if (d.last && Object.keys(d.champs).length) {
    txt += 'lastweek\t' + wkLabel(d.last) + '\n';
    for (const b of BOARDS) if (d.champs[b[0]]) txt += 'last\t' + b[0] + '\t' + d.champs[b[0]].name + '\t' + num(d.champs[b[0]].v, b) + '\n';
  }
  return txt;
}

export function boardMd(d) {
  const show = (v, b) => num(v, b) + b[3];
  let md = '# Capri Browser leaderboards\n\nWeekly top 10s from [Capri Browser](README.md). They start fresh every Monday at 00:00 UTC.\n\n'
    + 'To compete, open **Games** in Capri Browser, add a leaderboard name and press **Send my week**. No account needed. Only your leaderboard name and your numbers show here.\n\n'
    + '**This week:** ' + wkLabel(d.wk) + '\n';
  for (const b of BOARDS) {
    const rows = d.rows[b[0]];
    md += '\n## ' + b[1] + '\n\n';
    if (!rows.length) { md += '_Nobody yet this week. Be the first!_\n'; continue; }
    md += '| # | Name | ' + b[2] + ' |\n| ---: | --- | ---: |\n';
    rows.forEach((p, i) => { md += '| ' + (i + 1) + ' | ' + p.name + ' | ' + show(p.v, b) + ' |\n'; });
  }
  if (d.last && Object.keys(d.champs).length) {
    md += "\n## Last week's champions (" + wkLabel(d.last) + ')\n\n';
    for (const b of BOARDS) if (d.champs[b[0]]) md += '- **' + b[1] + ':** ' + d.champs[b[0]].name + ' (' + show(d.champs[b[0]].v, b) + ')\n';
  }
  return md;
}

export default {
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
      if (path === '/week') return await postWeek(db, got, who);
      if (path === '/feedback') return await postFeedback(db, got, who);
      return no(404, 'Not here.');
    } catch (e) {
      console.log('worker error', e && e.message);
      return no(500, 'Something went wrong on the leaderboard server. Try again in a bit, choom.');
    }
  },
};
