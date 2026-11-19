# Browser addons

Games, languages, themes and pages for **Capri Browser**, the web browser mod for [Capri](https://capriai.app/).
They live here instead of inside the mod, so the mod stays small.

## Getting them

- **Games:** open the Games page in Capri Browser and select **Get games**.
- **Languages:** open Settings, go to Language and select **Download languages**.
- **Updates:** select **Update all** at the bottom of the Games page or Settings.

Capri Browser only downloads files from the exact version of this repo it was built for, and checks every file against a fingerprint built into the mod. Anything that doesn't match is thrown away, so a change here never reaches players until a new version of the mod comes out.

## Leaderboards

[LEADERBOARD.md](LEADERBOARD.md) has the all-time top 10s for hours watched, videos finished, sites visited, survival, Guess the Site and typing speed. In Capri Browser you also see your own place on every board.

To join, open **Games**, add a leaderboard name and press **Send my stats**. Your stats then update by themselves every week. No account needed: only your leaderboard name and those six numbers are sent, to Capri Browser's own server ([worker/](worker)).

The bug and idea form in Capri Browser goes to the same server, privately.

## Safety

- Everything here is checked by Capri Browser before it's used. Language and list files are words and `https://` addresses only, and style files are style rules only.
- Games open in a tab of their own with no access to your settings, notes or history. They can only report a score.
- The server keeps only leaderboard names, numbers and bug reports. It never keeps internet addresses and holds no keys.

## What's here

| File | What it is |
| --- | --- |
| `games.txt`, `games/` | The games list and the games |
| `languages.txt` | Capri Browser's words in 22 languages |
| `help.txt`, `whats-new.txt` | The "What Capri can do" and "What's new" text |
| `settings.css`, `pages/` | The look of Settings, Speed Dial, Welcome and the other pages |
| `data/` | Site lists, voice commands in other languages, and the ad blocker's lists (from [EasyList and EasyPrivacy](https://easylist.to), CC BY-SA 3.0 / GPLv3, and [Peter Lowe's list](https://pgl.yoyo.org/adservers/)) |
| `worker/` | The leaderboard and bug report server |

Made by tob7as, a contributor to the Capri app. Discord: `.tob1s`
