# Browser addons

Languages and games for **Capri Browser**, the web browser mod for [Capri](https://capriai.app/).
They live here instead of inside the mod, so the mod stays small. Capri Browser downloads them from this repo.

## How to use them

- **Languages:** in Capri Browser, open Settings, go to Language and select **Download languages**.
- **Games:** open the Games page and select **Get games**. Pick a game to download it; after that it plays straight away.
- **Updates:** select **Update all** in the Updates section at the bottom of the Games page or Settings. It downloads every game, language, page and list from the exact commit your version of Capri Browser is pinned to, and checks each file against the SHA-256 fingerprint built into the mod. There are no automatic updates: new or changed files reach players in a new version of the mod.

## What's here

| File | What it is |
| --- | --- |
| `languages.txt` | 22 languages. One per line: code, name, Wikipedia subdomain and the browser's words, separated by tabs. |
| `games.txt` | The game list. One game per line: id, title, description and type, separated by tabs. |
| `games/<id>.html` | A game that's a page of its own (type `page`). |
| `games/<id>.txt` | A built-in game's lists, such as the sites for Guess the Site (type `data`). |
| `settings.css` | The look of Capri Browser's Settings page, including the setting tips' hover box. Style rules only, with %C0% to %C6% for Capri's colours. |
| `help.txt` | The "What Capri can do" and shortcuts text in Settings. |
| `pages/home.css` | The look of the Speed Dial (new tab) page. Style rules only, with %C0% to %C6% for Capri's colours and %P<n>% for sizes. |
| `pages/pages.css` | The look of the results, Games and History pages, in that order, split by `%%` lines. Style rules only, same tokens as home.css. |
| `data/lists.txt` | Video sites, sites Capri can open by name, search engines, achievements, things Capri says, the hover tips on settings (`tip`), places for "what time is it in" (`zone`), and words left out of searches. One per line, fields split by tabs. |
| `pages/welcome.html` | Capri Browser's Welcome page: its styling, a `%%` line, then the page. Shown with scripts and outside loads blocked, and only its own buttons work. Put %DL% where the download progress should show. |
| `data/adblock.txt` | The ad blocker's lists: ad servers (`ad`), trackers (`track`) and page parts to hide (`hide`, a CSS selector and optionally the sites it's for). Made from [EasyList and EasyPrivacy](https://easylist.to) (dual licensed CC BY-SA 3.0 and GPLv3, so this file keeps that licence) and [Peter Lowe's ad server list](https://pgl.yoyo.org/adservers/). Capri Browser keeps it as a file in its own folder. |
| `data/commands.txt` | Voice commands in other languages (`cmd`: language, what they say, the English command) and the Custom jobs guide in each language (`guide`). |
| `whats-new.txt` | The update notes. Shown under "What's new" in the Updates section, and Capri reads them when asked what's new. Plain text, newest first. |

Games of type `none` (Quiz, Minecraft with Capri) need no files; downloading them just switches them on.

## Leaderboards

[LEADERBOARD.md](LEADERBOARD.md) has weekly top 10s for hours watched, videos finished, sites visited, survival, Guess the Site and typing speed. They start fresh every Monday at 00:00 UTC.

- In Capri Browser, open **Games**, add a leaderboard name, then press **Send my week**. Only your leaderboard name and six numbers are sent, straight to Capri Browser's own server on Cloudflare. No account needed.
- The server ([worker/](worker)) checks each one: the name has to be clean and not someone else's (a name belongs to the copy of Capri Browser that first used it, through a random key only that copy has), and the numbers have to be believable and from this week.
- Only leaderboard names and numbers are kept. A GitHub Action copies the boards into LEADERBOARD.md every few hours. The numbers are what players send, so treat the board as for fun.
- The bug and idea form on Getting started goes to the same server, privately, with no account. If it can't be reached, it opens GitHub instead.

## Safety

- Language files are words only. Capri Browser removes anything that could be code or page markup before using them.
- Page games open in a tab of their own, which has no access to the browser's settings, notes or history. They can only report a score.
- Lists only hold names and `https://` addresses.
- Ad blocker lists are only host names and plain CSS selectors. Anything else in them is ignored.
- Command lines only turn other languages' words into Capri Browser's own English commands.

## Adding a game

1. Add `games/<id>.html` (lowercase letters, numbers and dashes in the id).
2. Add a line to `games.txt`: the id, the title, a one-line description and `page`, separated by tabs.
3. Put the new commit and the file's SHA-256 in the mod (`AddonsCommit` and `AddonHashes`), and release a new mod version. Files that don't match are thrown away.

Made by tob7as, a contributor to the Capri app. Discord: `.tob1s`
