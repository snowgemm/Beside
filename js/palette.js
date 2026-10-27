// Game.palette: the shared colour set for all art (see ART.md). Ramps are [shadow, dark, base, light, highlight] as 0xRRGGBB numbers.
// Shadows lean cool (blue/violet), lights lean warm (yellow). Base (index 2) is the exact source colour.
(function () {
  var G = window.Game = window.Game || {};
  var P = G.palette = {}, flatCache = null;
  var COOL = [28, 38, 96], WARM = [255, 206, 128], HI = [255, 246, 222];
  function rgb(c) { if (typeof c === 'string') c = parseInt(c.replace('#', ''), 16); return [(c >> 16) & 255, (c >> 8) & 255, c & 255]; }
  function cl(v) { return Math.max(0, Math.min(255, Math.round(v))); }
  function pack(a) { return (cl(a[0]) << 16) | (cl(a[1]) << 8) | cl(a[2]); }
  function mix(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }
  function mul(a, k) { return [a[0] * k, a[1] * k, a[2] * k]; }
  function ramp(base) {
    var b = rgb(base);
    return [mix(mul(b, 0.48), COOL, 0.24), mix(mul(b, 0.72), COOL, 0.1), b, mix(mul(b, 1.1), WARM, 0.14), mix(mix(b, HI, 0.5), WARM, 0.08)].map(pack);
  }
  function map(o) { var r = {}, k; for (k in o) r[k] = ramp(o[k]); return r; }
  function arr(a) { return a.map(ramp); }
  function hash01(s) {
    s = String(s); var h = 2166136261, i;
    for (i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    h ^= h >>> 15; h = Math.imul(h, 2246822519); h ^= h >>> 13; h = Math.imul(h, 3266489917); h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  }
  P.STEP = { shadow: 0, dark: 1, base: 2, light: 3, highlight: 4 };
  P.skin = arr([0xf6d5b8, 0xe8b98f, 0xd29a6a, 0xb87a4e, 0x8d5a3a, 0x5e3a28]);                       // 6 tones, light -> deep
  P.hair = arr([0x2a2420, 0x4a3222, 0x6e4a2c, 0x8a4a2a, 0xd8b45a, 0xb8402a, 0x9a9a9e, 0xe8e4dc]);   // black, dark brown, brown, auburn, blond, red, gray, white
  P.cloth = map({ red: 0xc0392f, orange: 0xd9792b, yellow: 0xe0b830, lime: 0x8fc03a, green: 0x3f9a4a, teal: 0x2f9a8c, sky: 0x4aa6d8,
    blue: 0x3a62c8, purple: 0x7a4ab8, pink: 0xd8689a, brown: 0x8a5a38, gray: 0x7a7e8a });
  P.metal = map({ iron: 0x7a7e86, copper: 0xc0703a, gold: 0xe0b43a, steel: 0xb4bcc8, mythril: 0x5ad0c8 });
  P.wood = ramp(0x8a5a30);
  P.stone = ramp(0x80838a);
  P.grass = map({ forest: 0x3f8a3a, plains: 0x8cc84a, desert: 0xc8b060, snow: 0xcfe0e4, swamp: 0x5a7a3a, jungle: 0x2f9a3a });
  P.leaves = map({ forest: 0x2f7a32, plains: 0x5aa83a, desert: 0x8a9a48, snow: 0x4a7a5a, swamp: 0x4a6a3a, jungle: 0x1f8a3a });
  P.water = ramp(0x3a8ad8);
  P.fire = ramp(0xf0702a);
  P.magic = ramp(0xa05aff);
  P.rarity = { common: 0xf2f2f2, uncommon: 0x4ccf4c, rare: 0x4c8dff, epic: 0xb24cff, legendary: 0xff9a1f };

  // shade(color, step): color = 0xRRGGBB | '#rrggbb' | ramp array; step = 0..4 or 'shadow'|'dark'|'base'|'light'|'highlight'
  P.shade = function (color, step) {
    var r = Array.isArray(color) ? color : ramp(color), i = typeof step === 'string' ? P.STEP[step] : step | 0;
    return r[Math.max(0, Math.min(4, i == null ? 2 : i))];
  };
  // jitter(color, seed): deterministic lightness noise of 3-6% (sign and size from the seed), for per-voxel richness
  P.jitter = function (color, seed) {
    var c = rgb(color), f = 1 + (hash01(seed + 'a') < 0.5 ? -1 : 1) * (0.03 + 0.03 * hash01(seed + 'b'));
    return pack(mul(c, f));
  };
  // flat list of every palette colour: [{id:'cloth.red.base', group:'cloth', ramp:'cloth.red', hex}]
  P.list = function () {
    var out = [], g;
    function add(group, name, r) {
      var steps = ['shadow', 'dark', 'base', 'light', 'highlight'], i;
      for (i = 0; i < 5; i++) out.push({ id: name + '.' + steps[i], group: group, ramp: name, hex: r[i] });
    }
    ['skin', 'hair'].forEach(function (k) { P[k].forEach(function (r, i) { add(k, k + '.' + (i + 1), r); }); });
    ['cloth', 'metal', 'grass', 'leaves'].forEach(function (k) { for (g in P[k]) add(k, k + '.' + g, P[k][g]); });
    ['wood', 'stone', 'water', 'fire', 'magic'].forEach(function (k) { add(k, k, P[k]); });
    for (g in P.rarity) out.push({ id: 'rarity.' + g, group: 'rarity', ramp: 'rarity.' + g, hex: P.rarity[g] });
    return out;
  };
  // nearest(color) -> {id, hex, dist} (RGB distance 0..441); isOn(color, tol=30): within jitter range of some palette colour
  P.nearest = function (color) {
    var l = flatCache || (flatCache = P.list()), c = rgb(color), best = null, bd = 1e9, i, p, d;
    for (i = 0; i < l.length; i++) {
      p = rgb(l[i].hex); d = Math.sqrt((p[0] - c[0]) * (p[0] - c[0]) + (p[1] - c[1]) * (p[1] - c[1]) + (p[2] - c[2]) * (p[2] - c[2]));
      if (d < bd) { bd = d; best = l[i]; }
    }
    return { id: best.id, hex: best.hex, dist: Math.round(bd * 10) / 10 };
  };
  P.isOn = function (color, tol) { return P.nearest(color).dist <= (tol == null ? 30 : tol); };
})();
