# NEON PALMS

[![badge](https://make.fun/api/badge/Butuamu110/gta6)](https://make.fun/bounty/gta6-01)
[![badge](https://make.fun/api/badge/Butuamu110/gta6)](https://make.fun/bounty/gta6-01)
[![badge](https://make.fun/api/badge/Butuamu110/gta6)](https://make.fun/bounty/gta6-01)

**Win the Strip by day. Own the neon by night.**

NEON PALMS is a 3D open-world crime game set in San Verde, a neon-drenched coastal city built around an underground street-racing crew. You start as a nobody running groceries for crew boss **Valentina 'Válvula' Ríos** and climb the RESPECT ladder — NOBODY → CURB CRAWLER → STREET NAME → BLOCK BURNER → CREW REGULAR → PALMS ROYALTY → MIDNIGHT ROYALTY → PALMS LEGEND — through 8 story missions, 6 structured street races and pink-slip duels, while the San Verde PD Interdiction unit (VIPER-3, MAMBA-2, GECKO-9, the CONDOR air unit…) tries to shut the scene down before the Midnight Grand Prix.

## The city

Five named districts — **Palms Strip**, **Club Mile**, **The Underpass**, **Puerto Alba** (the Marina Del Rey of San Verde) and the **Heights of San Verde** — plus the Old Town Grid: instanced towers with lit windows, neon club fronts (Club Válvula, Neón Palace, La Bomba…), palm trees, traffic AI, pedestrians who flee gunfire and phone in crimes, and a full day cycle: golden hour (low sun, long shadows, warm fog, orange→pink→purple sky, ACES grade) melts into a neon night lit by additive glow.

## Features (all real, all in-game)

- **8 staged story missions** for Valentina 'Válvula' Ríos with portrait dialogue that names each mechanic, STAGE x/y objective panels with a NEXT line, and MISSION PASSED banners paying cash + RESPECT + named unlocks.
- **6 structured street races** — 3-2-1 countdown, checkpoint rings, live position tracker (e.g. 2/6) against 5 AI rivals, prize tables ($900–$9,000 for the Midnight Grand Prix).
- **Pink-slip duels** against Kenji 'Kingslip' Aoki — winner takes the car.
- **Wanted system 0–5 stars** with a live dispatch panel: named Interdiction units with roles (PURSUIT / RAMMING / ROADBLOCK / SPOTLIGHT / FIRING), live distances in metres, an event feed, and the CONDOR helicopter with a spotlight cone at 4+ stars.
- **On foot + drivable, stealable cars** ("E — STEAL" prompt, witnesses call crimes in), on-foot shooting with muzzle glow, tracers, floating damage numbers, health + armor.
- **Crew cards that work**: Dario — NITRO CACHE [Z], Paz — QUICK FIX [X], Ivo — EYES OUT [C], each with cooldowns.
- **Four-sided HUD**: mission panel + dispatch (top-left); clock, big cash, wanted stars with IN SIGHT / SEARCHING, 6-slot weapon wheel with ammo, prices and locked slots (top-right); round textured minimap with blips and search zone + district name + RESPECT bar (bottom-left); radio + vehicle panel with model, CONDITION, big speed and gear (bottom-right); portrait dialogue bottom-centre.
- **Full map (M)** with textured districts, per-district standing, POI legend and a GPS route; **stats/save screen (P)** with % COMPLETE, checklist, per-mission medals, career stats, the rank ladder with next unlock, and 3 working localStorage save slots (L + 1/2/3 loads).
- **Radio**: Neón 99.9 and Palms Classics 88.1 (R switches), WebAudio synth engine/siren/gunfire/countdown sounds.
- **12 hidden neon palm collectibles**, deterministic seeded world, fixed-timestep simulation, and an autopilot that finishes mission 1 by itself (`?autopilot=1`).

## Controls

| Input | Action |
|---|---|
| W A S D / arrows | Walk / drive (camera-relative on foot) |
| Shift | Sprint |
| E | Talk · enter car · STEAL · enter race / duel |
| F | Fire weapon |
| Space | Handbrake |
| 1–6 | Weapon wheel (buy locked slots by pressing their number with cash) |
| Z / X / C | Crew: Dario nitro · Paz quick fix · Ivo eyes out |
| R | Switch radio station |
| M | Full map + GPS |
| P / Esc | Stats, ladder & save slots |
| L then 1/2/3 | Load a save slot |

## Running

Open `game/index.html` from any static file server (ES modules need http, not file://):

```
python3 -m http.server 8000 --directory game
# then visit http://localhost:8000/
```

Deterministic verification: `?autopilot=1` plays mission 1 to a WIN and writes the result string to the page title; `?shot=1..4` stages the four screenshot scenes.
