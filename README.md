# Browser addons

Languages and games for **Capri Browser**, the web browser mod for [Capri](https://capriai.app/).
They live here instead of inside the mod, so the mod stays small. Capri Browser downloads them from this repo.

## How to use them

- **Languages:** in Capri Browser, open Settings, go to Language and select **Download languages**.
- **Games:** open the Games page and select **Get games**. Pick a game to download it; after that it plays straight away.
- **Updates:** select **Check for updates** on the Games page (or in Settings, under Language) to get new games and the latest versions of everything you've downloaded.

## What's here

| File | What it is |
| --- | --- |
| `languages.txt` | 22 languages. One per line: code, name, Wikipedia subdomain and the browser's words, separated by tabs. |
| `games.txt` | The game list. One game per line: id, title, description and type, separated by tabs. |
| `games/<id>.html` | A game that's a page of its own (type `page`). |
| `games/<id>.txt` | A built-in game's lists, such as the sites for Guess the Site (type `data`). |

Games of type `none` (Quiz, Minecraft with Capri) need no files; downloading them just switches them on.

## Safety

- Language files are words only. Capri Browser removes anything that could be code or page markup before using them.
- Page games open in a tab of their own, which has no access to the browser's settings, notes or history. They can only report a score.
- Lists only hold names and `https://` addresses.

## Adding a game

1. Add `games/<id>.html` (lowercase letters, numbers and dashes in the id).
2. Add a line to `games.txt`: the id, the title, a one-line description and `page`, separated by tabs.
3. Players see it the next time they select **Check for updates**.

Made by tob7as, a contributor to the Capri app. Discord: `.tob1s`
