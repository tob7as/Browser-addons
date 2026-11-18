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

## Updating it later
From this folder, with Node installed: `npx wrangler login` (approve in the browser), then `npx wrangler deploy`.
`wrangler.toml` already names the worker and its database. Run `npx wrangler logout` when you're done.

## What it keeps
- Leaderboard names, the six numbers, and a hash of each install's random key (so only that install can use its name).
- Short-lived spam counters keyed by a salted hash of the internet address. The address itself is never stored.
- Bugs and ideas (kind, title, text, Capri Browser version and Windows version), with emails, phone numbers and
  anything that looks like a key blanked out. Only you can read them.
