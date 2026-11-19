# Setting up the Capri Browser worker

The worker lets people send their leaderboard week, bugs and ideas from Capri Browser **without a GitHub account**.
It holds no secrets and no GitHub key.
It runs free on Cloudflare. About 15 minutes, all in the website.

## 1. The database
1. Go to https://dash.cloudflare.com and pick your account.
2. **Storage & Databases → D1 SQL Database → Create**.
3. Name it `capri-browser`, leave the rest as it is, and press **Create**.
   (No need to type any SQL: the worker makes its own tables the first time it runs.)

## 2. The worker
1. **Compute (Workers) → Workers & Pages → Create → Start with Hello World**.
2. Name it `capri-browser` and press **Deploy**.
3. Press **Edit code**. Delete everything in the editor.
4. Open `worker/capri-worker.js` from this folder, copy all of it, and paste it into the editor.
5. Press **Deploy** (top right).

## 3. Connect the database
1. Open the worker → **Settings → Bindings → Add binding → D1 database**.
2. **Variable name:** `DB` (capitals, exactly that). **Database:** `capri-browser`.
3. Press **Add binding** (it redeploys by itself).
4. Open `https://capri-browser.<your-subdomain>.workers.dev/board.txt`. You should see `week` and `updated` lines.
   That means it works.

## 4. Bugs and ideas
There's nothing to set up and no GitHub key. They're kept privately in the database: open
**D1 SQL Database → capri-browser → Explore Data → feedback** to read them.

## Cheaters
The server already refuses numbers that time makes impossible: more hours than the week has had, hours rising faster
than time between sends, or too many videos or sites for the time that's passed. For anyone who still cheats, open
**D1 SQL Database → capri-browser → Console** and run (with their leaderboard name):

```sql
INSERT INTO hidden SELECT owner FROM names WHERE name = 'TheirName';
```

They vanish from every board at once. Their copy still says "sent", so they don't know to make a new name.
To bring them back: `DELETE FROM hidden WHERE owner = (SELECT owner FROM names WHERE name = 'TheirName');`

## Keeping it safe for us
- **You can't be charged.** The worker and database are on Cloudflare's free plan, which just stops for the day at its
  limits. Keep it that way: under **Manage Account → Billing**, don't add a card or turn on *Workers Paid*.
- **Account:** two-factor is on. Don't share the login. Check **My Profile → API Tokens** now and then and delete any you
  don't recognise (Wrangler's own sign-in is removed by `npx wrangler logout`).
- **No secrets anywhere.** The worker has no keys, so there's nothing in the mod or this repo worth stealing. If a GitHub
  or Cloudflare key ever ends up in a file, delete the key at once and make a new one.
- **Little data, deleted on time.** Request logs are off. Every day at 03:30 UTC the worker deletes boards older than a
  year, bugs and ideas older than 6 months, names unused for a year, and old spam counters.
- **The GitHub copy can't be abused.** The Action only copies lines shaped like the board (`.github/board-lines.txt`). Any
  other line, even a link, and nothing is copied.
- **Undo a mistake:** D1 keeps 7 days of history. **D1 → capri-browser → Time Travel** restores the database to an
  earlier moment (or `npx wrangler d1 time-travel restore capri-browser --timestamp=<time>`).
- **Someone asks for their name or report to be removed:**
  `DELETE FROM scores WHERE owner = (SELECT owner FROM names WHERE name = 'TheirName'); DELETE FROM names WHERE name = 'TheirName';`
  or for a bug/idea: `DELETE FROM feedback WHERE id = 12;`
- **Reading bugs and ideas:** they're plain text from strangers. Don't open links in them unless you trust them, and never
  run anything they tell you to.
- **If it's ever attacked:** **Workers & Pages → capri-browser → Settings → Domains & Routes**, turn off *workers.dev*.
  Everything stops at once, and Capri Browser just says it couldn't reach the leaderboards (bugs fall back to GitHub).

## Updating it later
From this folder, with Node installed: `npx wrangler login` (approve in the browser), then `npx wrangler deploy`.
`wrangler.toml` already names the worker and its database. Run `npx wrangler logout` when you're done.

## What it keeps
- Leaderboard names, the six numbers, and a hash of each install's random key (so only that install can use its name).
- Short-lived spam counters keyed by a salted hash of the internet address. The address itself is never stored.
- Bugs and ideas (kind, title, text, Capri Browser version and Windows version), with emails, phone numbers and
  anything that looks like a key blanked out. Only you can read them.
