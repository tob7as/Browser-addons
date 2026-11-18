// Weekly leaderboards for Capri Browser.
// Players send their week as a GitHub issue titled "[Leaderboard] <name>" (Capri Browser fills it in; they press Create).
// This checks the name and numbers, keeps the best of each per player for the week, rewrites LEADERBOARD.md, answers and
// closes the issue. On Mondays (and whenever a new week's first entry comes in) last week is archived and the boards restart.
// Nothing from the issue is ever run: it's only read with the patterns below. Only the name and six numbers are kept.
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DIR = path.join(ROOT, 'leaderboard');
const NAMES = path.join(DIR, 'names.json');
const SCORES = path.join(DIR, 'scores.json');
const BOARD = path.join(ROOT, 'LEADERBOARD.md');

// The six boards: key, title, line in the form, unit, highest believable value in a week.
const BOARDS = [
  ['hours', 'Most hours watched', 'Hours watched', 'h', 168],
  ['videos', 'Most videos finished', 'Videos finished', '', 3000],
  ['sites', 'Most sites visited', 'Sites visited', '', 30000],
  ['survival', 'Best survival run', 'Best survival run', ' words', 400],
  ['guess', 'Best Guess the Site run', 'Best guess the site run', '', 400],
  ['wpm', 'Best typing speed', 'Best typing speed', ' WPM', 250],
];

// Same lists as Capri Browser's BadName, so the mod and this agree.
const RUDE_BITS = ['fuck', 'fuk', 'fack', 'fcker', 'phuck', 'shit', 'cunt', 'bitch', 'nigg', 'niga', 'nigr', 'fag', 'retard', 'whore', 'slut', 'pussy', 'penis', 'vagina', 'porn', 'nazi', 'hitler', 'kkk', 'twat', 'wanker', 'jizz', 'killyourself', 'tranny', 'molest', 'pedo', 'bastard', 'asshole', 'dildo', 'boob', 'titty', 'horny', 'nude', 'naked', 'admin', 'moderator', 'official'];
const RUDE_WORDS = ['sex', 'rape', 'cock', 'dick', 'cum', 'anal', 'tits', 'spic', 'chink', 'kike', 'coon', 'paki', 'gook', 'dyke', 'isis', 'kys', 'rapist', 'wank', 'ass', 'arse', 'hoe', 'capri', 'tobtas', 'lachy', 'staff', 'system', 'null', 'everyone', 'anthropic'];

const nameKey = (n) => n.toLowerCase().replace(/[ _-]/g, '');

function badName(name) {
  if (!/^[A-Za-z0-9][A-Za-z0-9 _-]{1,14}[A-Za-z0-9]$/.test(name) || name.includes('  ')) return 'Names are 3 to 16 letters or numbers (spaces, - and _ in the middle are fine).';
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

// Capri Browser's week label ("2026w47"): weeks start on Monday and week 1 holds 1 January, as .NET's FirstDay rule counts them.
function weekOf(date) {
  const y = date.getUTCFullYear();
  const jan1 = Date.UTC(y, 0, 1);
  const day = Math.floor((Date.UTC(y, date.getUTCMonth(), date.getUTCDate()) - jan1) / 86400000);
  const jan1Monday = (new Date(jan1).getUTCDay() + 6) % 7;
  return y + 'w' + (Math.floor((day + jan1Monday) / 7) + 1);
}

const read = (file, empty) => { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { return empty; } };
const write = (file, data) => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, JSON.stringify(data, null, 1) + '\n'); };

// Starts a new week when the date has moved on, keeping the old one in leaderboard/weeks/.
function rollTo(scores, week) {
  if (scores.week === week) return scores;
  if (scores.week && Object.keys(scores.players || {}).length) {
    write(path.join(DIR, 'weeks', scores.week + '.json'), scores);
    scores.last = { week: scores.week, champions: BOARDS.map((b) => top(scores, b[0])[0]).map((p, i) => (p ? { board: BOARDS[i][1], name: p.name, value: p[BOARDS[i][0]] } : null)).filter(Boolean) };
  }
  scores.week = week;
  scores.players = {};
  return scores;
}

function top(scores, key) {
  return Object.values(scores.players || {}).filter((p) => p[key] > 0).sort((a, b) => b[key] - a[key] || a.at - b.at).slice(0, 10);
}

function render(scores) {
  const show = (v, b) => (b[0] === 'hours' ? v.toFixed(1) : String(v)) + b[3];
  let md = '# Capri Browser leaderboards\n\nWeekly top 10s from [Capri Browser](README.md). They start fresh every Monday at 00:00 UTC.\n\n'
    + 'To compete, open **Games** in Capri Browser, add a leaderboard name and press **Send my week**. Only your leaderboard name and your numbers show here.\n\n'
    + '**This week:** ' + scores.week + '\n';
  for (const b of BOARDS) {
    const rows = top(scores, b[0]);
    md += '\n## ' + b[1] + '\n\n';
    if (!rows.length) { md += '_Nobody yet this week. Be the first!_\n'; continue; }
    md += '| # | Name | ' + b[2] + ' |\n| ---: | --- | ---: |\n';
    rows.forEach((p, i) => { md += '| ' + (i + 1) + ' | ' + p.name + ' | ' + show(p[b[0]], b) + ' |\n'; });
  }
  if (scores.last && scores.last.champions.length) {
    md += '\n## Last week\'s champions (' + scores.last.week + ')\n\n';
    for (const c of scores.last.champions) md += '- **' + c.board + ':** ' + c.name + ' (' + show(c.value, BOARDS.find((b) => b[1] === c.board)) + ')\n';
  }
  fs.writeFileSync(BOARD, md);
}

async function github(method, url, body) {
  const r = await fetch('https://api.github.com/repos/' + process.env.GITHUB_REPOSITORY + url, {
    method, headers: { Authorization: 'Bearer ' + process.env.GITHUB_TOKEN, Accept: 'application/vnd.github+json', 'Content-Type': 'application/json', 'User-Agent': 'capri-leaderboard' },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!r.ok) console.log(method, url, r.status, await r.text());
}

async function answer(issue, text) {
  await github('POST', '/issues/' + issue.number + '/comments', { body: text });
  await github('PATCH', '/issues/' + issue.number, { state: 'closed', state_reason: 'completed' });
}

// What a player sent: their name and the six numbers, or why it can't be used.
function parse(issue, now) {
  const body = String(issue.body || '').replace(/\r/g, '');
  const field = (label) => { const m = new RegExp('^' + label + ':[ \\t]*([^\\n]*)$', 'mi').exec(body); return m ? m[1].trim() : null; };
  const name = field('Leaderboard name');
  if (!name) return { why: "I couldn't find a leaderboard name in this. Send it from the Games page in Capri Browser." };
  const bad = badName(name);
  if (bad) return { why: bad + ' Pick another name in Capri Browser and send your week again.' };
  // The week it was sent in, allowing for any time zone.
  const week = field('Week');
  const fits = [-12, -6, 0, 6, 14].map((h) => weekOf(new Date(now.getTime() + h * 3600000)));
  if (!week || !fits.includes(week)) return { why: 'These numbers are from an earlier week, so they can\'t go on this week\'s boards.' };
  const entry = { name };
  for (const b of BOARDS) {
    const raw = field(b[2]);
    const v = raw === null ? 0 : Number(raw);
    if (!/^\d{1,5}(\.\d)?$/.test(raw || '0') || !(v >= 0) || v > b[4]) return { why: 'The ' + b[2].toLowerCase() + ' number doesn\'t look right.' };
    entry[b[0]] = v;
  }
  return { entry };
}

async function main() {
  const event = read(process.env.GITHUB_EVENT_PATH || '', {});
  const now = new Date();
  const names = read(NAMES, {});
  const scores = rollTo(read(SCORES, { week: null, players: {} }), weekOf(now));
  const issue = event.issue;
  if (issue && event.action === 'opened' && /^\[Leaderboard\]/i.test(issue.title || '') && !issue.pull_request) {
    const got = parse(issue, new Date(issue.created_at || now));
    const who = String(issue.user && issue.user.id);
    if (got.why) await answer(issue, got.why);
    else {
      const key = nameKey(got.entry.name);
      const owner = names[key];
      if (owner && owner.by !== who) await answer(issue, 'Someone already has the name **' + owner.name + '**. Pick another in Capri Browser and send your week again.');
      else {
        // One name per GitHub account: picking a new one frees the old one.
        for (const k of Object.keys(names)) if (names[k].by === who && k !== key) delete names[k];
        names[key] = { name: got.entry.name, by: who };
        const was = scores.players[who] || { at: Date.now() };
        const p = { name: got.entry.name, at: was.at };
        for (const b of BOARDS) p[b[0]] = Math.max(was[b[0]] || 0, got.entry[b[0]]);
        scores.players[who] = p;
        await answer(issue, 'You\'re on this week\'s boards as **' + p.name + '**. [See the leaderboard](https://github.com/' + process.env.GITHUB_REPOSITORY + '/blob/main/LEADERBOARD.md). Send your week again any time to update your numbers.');
      }
    }
  }
  write(NAMES, names);
  write(SCORES, scores);
  render(scores);
}

if (require.main === module) main().catch((e) => { console.error(e); process.exit(1); });
module.exports = { badName, weekOf, parse, nameKey };
