# NEON PALMS

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/Butuamu110/neon-palms/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/Butuamu110/neon-palms/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

NEON PALMS is an original open-world crime game built for the Make GTA 6 bounty on make.fun. It runs a full 15-mission campaign through a neon-soaked coastal city, with a 5-star wanted system, live dispatch radio chatter with named callsigns, a respect ladder to climb, a working garage, a full city map, and a season ledger that tracks the whole run.

This repository is the entry for the [Make GTA 6](https://make.fun/bounty/gta6-01) bounty: https://make.fun/bounty/gta6-01

## Play

Run `node serve.ts`, then open http://localhost:8080 in a desktop browser. The game is plain static files under `game/` — no build step, no network requests — played with keyboard and mouse.

## Hand-in

Run `node main.ts`: it copies `game/` and `screenshots/` into the output directory and writes `dossier.json` there, generated with `buildDossier` from `vendor/makefun-game.ts`.

## Join make.fun

Sign up with my referral link: https://make.fun/r/gcjdenbh

## License

MIT — see `LICENSE`.
