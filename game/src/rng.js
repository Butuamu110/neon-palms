// Seeded randomness for NEON PALMS. One mulberry32 stream per system (city, traffic, crowds,
// missions), each seeded from the master seed, so a seed rebuilds the exact same city and the
// screenshot scenes are repeatable frame for frame. Game logic never touches Math.random.

export function createRng(seed) {
  let a = seed | 0;
  function next() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  return {
    next,
    /** Float in [min, max). */
    range(min, max) {
      return min + next() * (max - min);
    },
    /** Integer in [min, max], both ends included. */
    int(min, max) {
      return min + Math.floor(next() * (max - min + 1));
    },
    /** True with probability p. */
    chance(p) {
      return next() < p;
    },
    /** One element of a non-empty array. */
    pick(list) {
      return list[Math.floor(next() * list.length)];
    },
    /** A shuffled copy; the input is left alone. */
    shuffled(list) {
      const copy = list.slice();
      for (let i = copy.length - 1; i > 0; i -= 1) {
        const j = Math.floor(next() * (i + 1));
        const tmp = copy[i];
        copy[i] = copy[j];
        copy[j] = tmp;
      }
      return copy;
    },
    /** -1 or 1, coin flip. */
    sign() {
      return next() < 0.5 ? -1 : 1;
    },
  };
}

/** Derive an independent stream seed from the master seed and a short tag. */
export function deriveSeed(master, tag) {
  let h = master | 0;
  for (let i = 0; i < tag.length; i += 1) {
    h = Math.imul(h ^ tag.charCodeAt(i), 2654435761);
    h = (h << 13) | (h >>> 19);
  }
  return h | 0;
}

/**
 * Deterministic 2D value noise in [0, 1], used for film grain, water shimmer and rooftop
 * wear: hash the integer lattice, smoothstep between corners. No tables, no allocation.
 */
export function valueNoise(x, y, seed) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  const a = hash2(xi, yi, seed);
  const b = hash2(xi + 1, yi, seed);
  const c = hash2(xi, yi + 1, seed);
  const d = hash2(xi + 1, yi + 1, seed);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

function hash2(x, y, seed) {
  let h = Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(seed | 0, 974634211);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
