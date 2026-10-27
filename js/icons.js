(function () {
  var G = window.Game = window.Game || {};
  var I = G.icons = {};
  var COL = I.COL = ['#b8b8b8', '#4ccf4c', '#4c8dff', '#b24cff', '#ff9a1f'];
  var cache = {};
  function hex(c) { return [parseInt(c.substr(1, 2), 16), parseInt(c.substr(3, 2), 16), parseInt(c.substr(5, 2), 16)]; }
  function mix(c, t, a) {
    var p = hex(c), q = hex(t);
    return 'rgb(' + Math.round(p[0] + (q[0] - p[0]) * a) + ',' + Math.round(p[1] + (q[1] - p[1]) * a) + ',' + Math.round(p[2] + (q[2] - p[2]) * a) + ')';
  }
  // letters: l/m/d = tint light/mid/dark, h/H wood, g/G gold, s/S steel, e gem, w white, k dark, r red, y yellow
  var GRID = {
    sword: ['.........ll.', '........lmml', '.......lmmd.', '......lmmd..', '.....lmmd...', '..g.lmmd....', '..gglmd.....', '...ggd......', '..hGgg......', '.hH.G.......', 'hH..........', 'H...........'],
    axe: ['......ddmm..', '.....dmmlll.', '.....dmmmll.', '......hmmd..', '.....hH.d...', '....hH......', '...hH.......', '..hH........', '.hH.........', 'hH..........', 'H...........', '............'],
    dagger: ['..........ll', '.........lmd', '........lmd.', '.......lmd..', '......lmd...', '.....lmd....', '....gGd.....', '...gG.......', '..hG........', '.hH.........', 'hH..........', '............'],
    spear: ['..........l.', '.........lml', '........lmmd', '........hdd.', '.......hH...', '......hH....', '.....hH.....', '....hH......', '...hH.......', '..hH........', '.hH.........', 'hH..........'],
    leather: ['............', '..HH....HH..', '.HmmHHHHmmH.', '.HmhhhhhhmH.', '.HhhhhhhhhH.', '..HhhmmhhH..', '..HhhmmhhH..', '..HhhhhhhH..', '..HhhhhhhH..', '..HHHHHHHH..', '............', '............'],
    chain: ['............', '..SS....SS..', '.SssSSSSssS.', '.SsSsSsSsSS.', '.SSsSsSsSsS.', '..SsmmmmsS..', '..SSsSsSSS..', '..SsSsSsSS..', '..SSsSsSSS..', '..SSSSSSSS..', '............', '............'],
    plate: ['..mm....mm..', '.mllmmmmllm.', '.mlsssssslm.', '.msssllsssm.', '.mssslmsssm.', '..msssmssm..', '..mssssssm..', '..msssssSm..', '..mSSSSSSm..', '..mmmmmmmm..', '............', '............'],
    ring: ['....eeee....', '....elle....', '...gggggg...', '..gG....Gg..', '..g......g..', '..g......G..', '..gG....Gg..', '...gGGGGg...', '............', '............', '............', '............'],
    amulet: ['..g......g..', '...g....g...', '...g....g...', '....g..g....', '.....gg.....', '....gGGg....', '...gmmmmG...', '...gmeemG...', '...gmeemG...', '....gmmG....', '.....GG.....', '............'],
    medal: ['..mm....mm..', '..mmm..mmm..', '...mm..mm...', '....mmmm....', '....gggg....', '...gGGGGg...', '..gGggggGg..', '..gGgeegGg..', '..gGgeegGg..', '..gGggggGg..', '...gGGGGg...', '....gggg....'],
    cube: ['............', '....llll....', '..llllllll..', '.llllllllll.', '.mmmmmmmmdd.', '.mmmmmmmmdd.', '.mmmmmmmmdd.', '.mmmmmmmmdd.', '..dddddddd..', '............', '............', '............'],
    // interface icons (drawn pale)
    roll: ['............', '...wwwww....', '..ww...ww...', '.ww.....ww..', '.w.......w..', '.w.......w..', '.ww.....www.', '..ww...wwwww', '...www..www.', '........ww..', '............', '............'],
    bag: ['....HHHH....', '...H....H...', '..hhhhhhhh..', '.hhhhhhhhhh.', '.hmmmmmmmmh.', '.hhhhggghhh.', '.hmmmmmmmmh.', '.hhhhhhhhhh.', '.hhhhhhhhhH.', '..HHHHHHHH..', '............', '............'],
    jump: ['............', '.....ww.....', '....wwww....', '...wwwwww...', '..wwwwwwww..', '.....ww.....', '.....ww.....', '.....ww.....', '.....ww.....', '............', '............', '............'],
    view: ['............', '............', '...wwwwww...', '..w.kkkk.w..', '.w.kkwwkk.w.', '.w.kkwwkk.w.', '..w.kkkk.w..', '...wwwwww...', '............', '............', '............', '............'],
    build: ['...ssssss...', '...sSSSSS...', '...ssssss...', '.....hH.....', '.....hH.....', '.....hH.....', '.....hH.....', '.....hH.....', '.....hH.....', '............', '............', '............'],
    pick: ['..ssssss....', '.sS....sS...', 'sS......sS..', 'S....hH..S..', '.....hH.....', '.....hH.....', '.....hH.....', '.....hH.....', '.....hH.....', '............', '............', '............'],
    gear: ['............', '.....ww.....', '..w.wwww.w..', '...wwwwww...', '..wwk..kww..', '.wwwk..kwww.', '.wwwk..kwww.', '..wwk..kww..', '...wwwwww...', '..w.wwww.w..', '.....ww.....', '............']
  };
  var UIMAP = { sword: 'sword', roll: 'roll', bag: 'bag', jump: 'jump', view: 'view', build: 'build', pick: 'pick', block: 'cube', gear: 'gear' };
  var BYNAME = [['Kiếm', 'sword'], ['Rìu', 'axe'], ['Dao', 'dagger'], ['Giáo', 'spear'], ['Áo da', 'leather'], ['Giáp xích', 'chain'], ['Giáp thép', 'plate'], ['Nhẫn', 'ring'], ['Bùa', 'amulet'], ['Mề đay', 'medal']];
  var BYSLOT = { weapon: 'sword', armor: 'chain', trinket: 'ring' };

  I.kindOf = function (it) {
    if (!it) return 'cube';
    if (it.kind && GRID[it.kind]) return it.kind;
    var n = it.name || '', i;
    for (i = 0; i < BYNAME.length; i++) if (n.indexOf(BYNAME[i][0]) === 0) return BYNAME[i][1];
    return BYSLOT[it.slot] || 'cube';
  };
  function pal(tint) {
    return { l: mix(tint, '#ffffff', 0.45), m: tint, d: mix(tint, '#000000', 0.4), h: '#8a5a2a', H: '#4a2e14', g: '#e8c040', G: '#a07a20', s: '#c8d0dc', S: '#7a8494',
      e: mix(tint, '#ffffff', 0.25), w: '#f2f2f2', k: '#222', r: '#e0503a', y: '#ffd34d' };
  }
  function draw(grid, tint, size, glow) {
    var cv = document.createElement('canvas'), c, n = grid.length, cell = Math.max(1, Math.floor(size / n)), ox = Math.floor((size - cell * n) / 2), P = pal(tint), x, y, ch, g;
    cv.width = cv.height = size; c = cv.getContext('2d');
    if (glow) {
      g = c.createRadialGradient(size / 2, size / 2, size * 0.1, size / 2, size / 2, size * 0.52);
      g.addColorStop(0, tint); g.addColorStop(1, 'rgba(0,0,0,0)');
      c.globalAlpha = glow; c.fillStyle = g; c.fillRect(0, 0, size, size); c.globalAlpha = 1;
    }
    function at(xx, yy) { var r = grid[yy]; return r && r.charAt(xx) && r.charAt(xx) !== '.' && r.charAt(xx) !== ' '; }
    c.fillStyle = '#14100c';
    for (y = 0; y < n; y++) for (x = 0; x < n; x++) {
      if (at(x, y)) continue;
      if (at(x - 1, y) || at(x + 1, y) || at(x, y - 1) || at(x, y + 1)) c.fillRect(ox + x * cell, ox + y * cell, cell, cell);
    }
    for (y = 0; y < n; y++) for (x = 0; x < n; x++) {
      ch = grid[y].charAt(x);
      if (!at(x, y) || !P[ch]) continue;
      c.fillStyle = P[ch]; c.fillRect(ox + x * cell, ox + y * cell, cell, cell);
      if (cell >= 3) {
        c.fillStyle = 'rgba(255,255,255,.22)'; c.fillRect(ox + x * cell, ox + y * cell, cell, 1);
        c.fillStyle = 'rgba(0,0,0,.25)'; c.fillRect(ox + x * cell, ox + (y + 1) * cell - 1, cell, 1);
      }
    }
    return cv;
  }
  function copy(src, size) {
    var out = document.createElement('canvas'); out.width = out.height = size; out.className = 'icon';
    out.getContext('2d').drawImage(src, 0, 0); return out;
  }
  // item icon: new canvas each call (blitted from the cached bitmap, cache key = kind + rarity + size)
  I.get = function (item, size) {
    size = size || 32;
    var kind = I.kindOf(item), r = item && item.rarity | 0, key;
    if (r < 0 || r > 4) r = 0;
    key = kind + '|' + r + '|' + size;
    if (!cache[key]) cache[key] = draw(GRID[kind] || GRID.cube, COL[r], size, r >= 2 ? (r >= 3 ? 0.6 : 0.45) : 0);
    return copy(cache[key], size);
  };
  // interface icon (buttons)
  I.ui = function (name, size) {
    size = size || 28;
    var key = 'ui|' + name + '|' + size, k = UIMAP[name] || name;
    if (!cache[key]) cache[key] = draw(GRID[k] || GRID.cube, '#e8e8e8', size, 0);
    return copy(cache[key], size);
  };
  I.GRID = GRID;
})();