// NEON PALMS — hand-in program for the gta6-01 bounty (Node 22, standard library only).
// The game itself lives in game/ as plain static files (index.html + ES modules + a vendored
// three.js) that a desktop browser loads fully offline. This program copies game/ and
// screenshots/ from beside itself into the output directory (MAKEFUN_OUTPUT_DIR, defaulting
// to /output) and writes dossier.json there with the vendored make.fun library, using the
// scorer's own caps so an entry the scorer would refuse is refused here first.

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) {
  cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });
}

writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);
