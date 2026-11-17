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
| `settings.css` | The look of Capri Browser's Settings page. Style rules only. |
| `help.txt` | The "What Capri can do" and shortcuts text in Settings. |
| `pages/home.css` | The look of the Speed Dial (new tab) page. Style rules only, with %C0% to %C6% for Capri's colours and %P<n>% for sizes. |
| `pages/pages.css` | The look of the results, Games and History pages, in that order, split by `%%` lines. Style rules only, same tokens as home.css. |
| `data/lists.txt` | Video sites, sites Capri can open by name, search engines, achievements, a few things Capri says, and words left out of searches. One per line, fields split by tabs. |
| `pages/welcome.html` | Capri Browser's Welcome page: its styling, a `%%` line, then the page. Shown with scripts and outside loads blocked, and only its own buttons work. Put %DL% where the download progress should show. |
| `whats-new.txt` | The update notes. Shown under "What's new" in the Updates section, and Capri reads them when asked what's new. Plain text, newest first. |

Games of type `none` (Quiz, Minecraft with Capri) need no files; downloading them just switches them on.

## Safety

- Language files are words only. Capri Browser removes anything that could be code or page markup before using them.
- Page games open in a tab of their own, which has no access to the browser's settings, notes or history. They can only report a score.
- Lists only hold names and `https://` addresses.

## Adding a game

1. Add `games/<id>.html` (lowercase letters, numbers and dashes in the id).
2. Add a line to `games.txt`: the id, the title, a one-line description and `page`, separated by tabs.
3. Put the new commit and the file's SHA-256 in the mod (`AddonsCommit` and `AddonHashes`), and release a new mod version. Files that don't match are thrown away.

Made by tob7as, a contributor to the Capri app. Discord: `.tob1s`
