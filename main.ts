// NEON PALMS hand-in program (Node 22, standard library only). The game itself is the
// game/ folder beside this file — plain static files a desktop browser loads offline —
// and this program delivers it: it copies game/ and screenshots/ into the output
// directory and writes dossier.json, the summary the judge reads, using the vendored
// make.fun library. Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for
// /output:  mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// Top-up (recorded session): a one-line hand-in summary for whoever runs this
// program by hand. It reads back only what was just copied, prints to stdout,
// and never touches the output directory, so the handed-in bytes stay exactly
// what buildDossier produced.
function reportHandIn(outDir, dossierText) {
  const gameDir = join(outDir, 'game');
  const fileCount = readdirSync(gameDir, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile()).length;
  const kib = (Buffer.byteLength(dossierText, 'utf8') / 1024).toFixed(1);
  console.log(`NEON PALMS hand-in: ${fileCount} game files copied, dossier.json ${kib} KiB -> ${outDir}`);
}

mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) {
  cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });
}

// The scorer's own caps, from the kit's gate reference: an entry is refused for more
// than 4 screenshots or one over 256 KiB, more than 993 files or 48 MiB in game/, or a
// game/ path over 1000 bytes. text_max_bytes alone shapes the dossier's bytes.
const dossierText = buildDossier(out, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
});
writeFileSync(join(out, 'dossier.json'), dossierText);
reportHandIn(out, dossierText);
