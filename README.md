# Browser addons

Extra languages and games for **Capri Browser**, the web browser mod for [Capri](https://capriai.app/).
They live here instead of inside the mod, so the mod stays small.

## How to use them

- **Languages:** in Capri Browser, open Settings, go to Language and select **Download languages**.
- **Games:** open the Games page and select **+ More games**. New games appear in the list.

## What's here

| File | What it is |
| --- | --- |
| `languages.txt` | Spanish, French, German and Portuguese. One language per line: code, name, Wikipedia subdomain and the browser's words, separated by tabs. |
| `games.txt` | The game list. One game per line: id, title and description, separated by tabs. |
| `games/<id>.html` | Each game, served by GitHub Pages. |

## Safety

- Language files are words only. Capri Browser removes anything that could be code or page markup before using them.
- Games are ordinary web pages. They open in a tab like any website and can't change the browser's settings, notes or history.

## Adding a game

1. Add `games/<id>.html` (lowercase letters, numbers and dashes in the id).
2. Add a line to `games.txt`: `<id>`, a tab, the title, a tab, a one-line description.
3. Players get it the next time they select **+ More games**.

Made by tob7as, a contributor to the Capri app. Discord: `.tob1s`
