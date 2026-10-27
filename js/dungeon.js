(function () {
  var G = window.Game = window.Game || {};
  var D = G.dungeon = { active: false };
  var REG = 256, MINSP = 44, FLOOR = 20, WH = 5, CORR = 4, GATE_R = 3.4, CHEST_R = 1.45;
  var W, E, L, scene, ents = {}, gates = {}, gateItems = [], gateT = 0, near = null, busy = false, run = null;
  var runs = {}, cleared = {}, insideKey = null, origLevel, btn, roomHud, bossBar, fadeEl, hudTxt = '';

  function mul(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function h32(a, b, c) { var h = (Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263) + Math.imul(c | 0, 1274126177)) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return (h ^ (h >>> 16)) >>> 0; }
  function box(w, h, d, c, x, y, z) { var m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshBasicMaterial({ color: c })); m.position.set(x, y, z); return m; }
  function glow(geo, c, op) { return new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, side: THREE.DoubleSide })); }
  function dispose(o) { o.traverse(function (c) { if (c.geometry) c.geometry.dispose(); if (c.material) c.material.dispose(); }); }

  /* ---------- Visuals: every look lives here so stage 5 can replace the factories ---------- */
  var V = D.visuals = {
    palette: { floor: [.4, .38, .36], wall: [.34, .32, .31], top: [.52, .5, .47], pillar: [.46, .43, .4] },
    gate: function () {
      var g = new THREE.Group(), gm = G.assets.model('gate');
      if (gm) g.add(gm);
      else g.add(box(1.1, 7, 1.1, 0x6f6c68, -2.2, 1.5, 0), box(1.1, 7, 1.1, 0x6f6c68, 2.2, 1.5, 0), box(5.8, 1.1, 1.3, 0x57544f, 0, 5.4, 0), box(3.3, 4.8, 0.3, 0x0d0a14, 0, 2.4, 0));
      var beam = glow(new THREE.CylinderGeometry(0.7, 1.1, 140, 10, 1, true), 0xaee6ff, 0.45);
      beam.position.y = 70; g.add(beam); g.userData.beam = beam; return g;
    },
    setCleared: function (g, c) { g.userData.beam.material.color.setHex(c ? 0x8affb0 : 0xaee6ff); },
    door: function () {
      var g = new THREE.Group(), m = G.assets.model('door');
      if (m) { m.position.y = -WH / 2; g.add(m); return g; }
      g.add(box(1, WH, 3, 0x5a4630, 0, 0, 0), box(1.1, 0.4, 3.1, 0x2e2418, 0, 0.8, 0), box(1.1, 0.4, 3.1, 0x2e2418, 0, -0.8, 0)); return g;
    },
    chest: function () {
      var g = new THREE.Group(), lid = new THREE.Group(), cm = G.assets.model('chest');
      if (cm) { g.add(cm); g.userData.lid = cm.getObjectByName('lid') || null; return g; }
      g.add(box(1, 0.55, 0.7, 0x8a5a2a, 0, 0.275, 0));
      lid.position.set(0, 0.55, -0.35); lid.add(box(1, 0.25, 0.7, 0xc9a227, 0, 0.125, 0.35)); g.add(lid); g.userData.lid = lid; return g;
    },
    portal: function () {
      var g = new THREE.Group(), i, pm = G.assets.model('portal');
      if (pm) { g.add(pm); return g; }
      for (i = 0; i < 8; i++) g.add(box(0.5, 0.5, 0.5, 0x7a7f8c, Math.cos(i * Math.PI / 4) * 1.4, 0.25, Math.sin(i * Math.PI / 4) * 1.4));
      var c = glow(new THREE.CylinderGeometry(1.2, 1.2, 3.4, 16, 1, true), 0x7affea, 0.5); c.position.y = 1.7; g.add(c); return g;
    },
    level: function (K, GW, GH) {
      var P = V.palette, pos = [], col = [], idx = [], x, z;
      function hh(a, b, c) { return h32(a, b, c) / 4294967296; }
      function q(x0, y0, z0, x1, y1, z1, x2, y2, z2, x3, y3, z3, c, s) {
        var b = pos.length / 3; pos.push(x0, y0, z0, x1, y1, z1, x2, y2, z2, x3, y3, z3);
        for (var j = 0; j < 4; j++) col.push(c[0] * s, c[1] * s, c[2] * s);
        idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
      }
      function k(a, b) { return a < 0 || b < 0 || a >= GW || b >= GH ? 0 : K[b * GW + a]; }
      for (z = 0; z < GH; z++) for (x = 0; x < GW; x++) {
        var t = K[z * GW + x], a, b;
        if (t === 1) { q(x, FLOOR, z, x, FLOOR, z + 1, x + 1, FLOOR, z + 1, x + 1, FLOOR, z, P.floor, (0.86 + hh(x, z, 1) * 0.2) * ((x + z) & 1 ? 0.95 : 1)); continue; }
        var n8 = false;
        for (a = -1; a <= 1; a++) for (b = -1; b <= 1; b++) if (k(x + a, z + b) === 1) n8 = true;
        if (!n8) continue;
        var top = FLOOR + WH, c = t === 2 ? P.pillar : P.wall;
        q(x, top, z, x, top, z + 1, x + 1, top, z + 1, x + 1, top, z, P.top, 0.9 + hh(x, z, 2) * 0.12);
        for (var r = 0; r < WH; r++) {
          var y0 = FLOOR + r, y1 = y0 + 1, m = (r & 1 ? 0.88 : 1) * (0.9 + hh(x * 5 + r, z * 3 + r, 3) * 0.2);
          if (k(x + 1, z) === 1) q(x + 1, y0, z + 1, x + 1, y0, z, x + 1, y1, z, x + 1, y1, z + 1, c, 0.8 * m);
          if (k(x - 1, z) === 1) q(x, y0, z, x, y0, z + 1, x, y1, z + 1, x, y1, z, c, 0.62 * m);
          if (k(x, z + 1) === 1) q(x, y0, z + 1, x + 1, y0, z + 1, x + 1, y1, z + 1, x, y1, z + 1, c, 0.88 * m);
          if (k(x, z - 1) === 1) q(x + 1, y0, z, x, y0, z, x, y1, z, x + 1, y1, z, c, 0.7 * m);
        }
      }
      var geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
      geo.setIndex(idx);
      return new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, fog: true }));
    }
  };

  /* ---------- Placeholder sounds (Game.audio.play names: door, chest, boss) ---------- */
  function osc(type, f0, f1, dur, vol, delay) {
    var A = G.audio, c = A.ctx;
    if (!c || c.state !== 'running') return;
    var t = c.currentTime + (delay || 0), o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(A.master); o.start(t); o.stop(t + dur + 0.02);
  }
  function rumble(dur, vol) {
    var A = G.audio, c = A.ctx;
    if (!c || c.state !== 'running' || !A.noise) return;
    var t = c.currentTime, s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    s.buffer = A.noise; f.type = 'lowpass'; f.frequency.value = 260;
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    s.connect(f); f.connect(g); g.connect(A.master); s.start(t); s.stop(t + dur);
  }
  var SFX = {
    door: function () { osc('square', 120, 50, 0.35, 0.25); rumble(0.45, 0.6); },
    chest: function () { osc('triangle', 480, 880, 0.12, 0.3); osc('triangle', 720, 1320, 0.16, 0.3, 0.1); },
    boss: function () { osc('sawtooth', 110, 38, 0.9, 0.4); osc('square', 70, 30, 0.9, 0.3); }
  };

  /* ---------- Entrances ---------- */
  function entrance(rx, rz) {
    var key = rx + ',' + rz;
    if (key in ents) return ents[key];
    var r = mul(h32(W.seed, rx * 7919 + 13, rz * 104729 + 17)), sp = G.player.spawnPos || { x: 0, z: 0 }, ow = W.ow, res = null;
    for (var t = 0; t < 40 && !res; t++) {
      var x = rx * REG + 24 + Math.floor(r() * (REG - 48)), z = rz * REG + 24 + Math.floor(r() * (REG - 48));
      if (Math.sqrt((x - sp.x) * (x - sp.x) + (z - sp.z) * (z - sp.z)) < MINSP) continue;
      var h = W.baseHeight(x, z), ok = h >= W.SEA + 2 && h <= 26;
      for (var a = 0; a < 12 && ok; a++) {
        var h2 = W.baseHeight(x + Math.cos(a * 0.5236) * 4, z + Math.sin(a * 0.5236) * 4);
        if (h2 < W.SEA + 1 || Math.abs(h2 - h) > 2) ok = false;
      }
      if (ok) res = { key: key, rx: rx, rz: rz, x: x + 0.5, z: z + 0.5, y: h };
    }
    if (res) {
      res.level = origLevel(res.x, res.z);
      res.out = { x: res.x, y: ow.getHeight(res.x, res.z + 3.5), z: res.z + 3.5 };
      res.item = { key: key, x: res.x, y: res.y, z: res.z, r: GATE_R, label: 'Vào hầm ngục', act: function () { goIn(res); } };
    }
    ents[key] = res;
    return res;
  }
  function syncGates(px, pz) {
    var cx = Math.floor(px / REG), cz = Math.floor(pz / REG), dx, dz, keep = {}, k;
    gateItems = [];
    for (dx = -2; dx <= 2; dx++) for (dz = -2; dz <= 2; dz++) {
      var e = entrance(cx + dx, cz + dz);
      if (!e) continue;
      keep[e.key] = 1; gateItems.push(e.item);
      if (!gates[e.key]) {
        var g = V.gate(); g.position.set(e.x, e.y, e.z); scene.add(g); gates[e.key] = g; V.setCleared(g, !!cleared[e.key]);
      }
    }
    for (k in gates) if (!keep[k]) { scene.remove(gates[k]); dispose(gates[k]); delete gates[k]; }
  }

  /* ---------- Layout ---------- */
  function mkDoor(cells) {
    var d = { cells: cells, closed: false, a: 0, mesh: V.door() };
    d.mesh.position.set(cells[0][0] + 0.5, FLOOR - WH / 2, (cells[0][1] + cells[cells.length - 1][1] + 1) / 2); d.mesh.visible = false;
    return d;
  }
  function build(seed, ent) {
    var Rm = G.rooms, r = mul(seed), n = 5 + Math.floor(r() * 4), tIdx = 2 + Math.floor(r() * (n - 3)), rooms = [], last = {}, x = 2, prev = null, i, minZ = 1e9, maxZ = 0;
    for (i = 0; i < n; i++) {
      var kind = i === 0 ? 'start' : i === n - 1 ? 'boss' : i === tIdx ? 'treasure' : 'combat', pool = Rm.byKind[kind], t = pool[Math.floor(r() * pool.length)];
      if (pool.length > 1 && last[kind] === t) t = pool[(pool.indexOf(t) + 1) % pool.length];
      last[kind] = t;
      var rm = { idx: i, kind: kind, t: t, x0: x, z0: prev ? prev.z0 + prev.t.outRows[0] - t.inRows[0] : 0, w: t.w, h: t.h, state: 'idle', foes: [], doors: [] };
      rooms.push(rm); x += t.w + CORR; prev = rm;
      minZ = Math.min(minZ, rm.z0); maxZ = Math.max(maxZ, rm.z0 + t.h);
    }
    var sz = 2 - minZ, GW = x - CORR + 2, GH = maxZ + sz + 2, K = new Uint8Array(GW * GH), hgt = new Uint8Array(GW * GH), inter = [], grp = new THREE.Group();
    rooms.forEach(function (m) { m.z0 += sz; });
    rooms.forEach(function (m) {
      var t = m.t, rz, rx, ch, gx, gz;
      m.mk = { E: [], C: [], S: null, B: null };
      for (rz = 0; rz < t.h; rz++) for (rx = 0; rx < t.w; rx++) {
        ch = t.rows[rz][rx]; gx = m.x0 + rx; gz = m.z0 + rz;
        K[gz * GW + gx] = ch === '#' ? 0 : ch === 'P' ? 2 : 1;
        if (ch === 'E') m.mk.E.push([gx, gz]); else if (ch === 'C') m.mk.C.push([gx, gz]); else if (ch === 'S') m.mk.S = [gx, gz]; else if (ch === 'B') m.mk.B = [gx, gz];
      }
      if (m.kind === 'combat' || m.kind === 'boss') m.doors.push(mkDoor(t.inRows.map(function (z) { return [m.x0, m.z0 + z]; })));
      if (m.kind === 'combat') m.doors.push(mkDoor(t.outRows.map(function (z) { return [m.x0 + m.w - 1, m.z0 + z]; })));
    });
    for (i = 0; i < n - 1; i++) {
      var a = rooms[i], b = rooms[i + 1];
      for (var k = 0; k < a.t.outRows.length; k++) for (var gx = a.x0 + a.w; gx < b.x0; gx++) K[(a.z0 + a.t.outRows[k]) * GW + gx] = 1;
    }
    for (i = 0; i < K.length; i++) hgt[i] = (K[i] === 0 || K[i] === 2) ? FLOOR + WH : FLOOR;
    grp.add(V.level(K, GW, GH));
    rooms.forEach(function (m) {
      m.doors.forEach(function (d) { grp.add(d.mesh); });
      var rr = mul(h32(seed, m.idx, 77));
      m.mk.C.forEach(function (c, ci) {
        if (m.kind !== 'treasure' && rr() > 0.5) return;
        var o = V.chest(), it = { x: c[0] + 0.5, y: FLOOR, z: c[1] + 0.5, r: CHEST_R, label: 'Mở rương', o: o, room: m, ci: ci };
        o.position.set(it.x, FLOOR, it.z); grp.add(o); it.act = function () { openChest(it); }; inter.push(it);
      });
    });
    function gh(px, pz) { var ix = Math.floor(px), iz = Math.floor(pz); return (ix < 0 || iz < 0 || ix >= GW || iz >= GH) ? FLOOR + WH : hgt[iz * GW + ix]; }
    return { key: ent.key, ent: ent, seed: seed, level: ent.level, rooms: rooms, grp: grp, inter: inter, hgt: hgt, GW: GW, GH: GH, cur: -1, portal: null,
      provider: { getHeight: gh, getBlock: function (px, py, pz) { return Math.floor(py) < gh(px, pz) ? 3 : 0; }, solid: function (px, py, pz) { return Math.floor(py) < gh(px, pz); } } };
  }

  /* ---------- Rooms, chests, doors ---------- */
  function setDoor(d, closed) {
    d.closed = closed;
    for (var i = 0; i < d.cells.length; i++) run.hgt[d.cells[i][1] * run.GW + d.cells[i][0]] = closed ? FLOOR + WH : FLOOR;
  }
  function rollChest(level, seed, bonus) {
    var S = L.sources.chest, old = S.bonus;
    if (bonus != null) S.bonus = bonus;
    try { return L.roll(level, 'chest', seed); } finally { S.bonus = old; }
  }
  function openChest(it) {
    var i = run.inter.indexOf(it);
    if (i < 0) return;
    run.inter.splice(i, 1);
    if (it.o.userData.lid) it.o.userData.lid.rotation.x = -1.2;
    L.spawnDrop(rollChest(run.level, h32(run.seed, it.room.idx * 16 + it.ci, 0xC4E57), it.room.kind === 'treasure' ? 1.1 : null), it.x, it.z, 0.15, it.y + 0.9);
    G.audio.play('chest');
  }
  function activate(r) {
    r.state = 'active';
    r.doors.forEach(function (d) { setDoor(d, true); });
    G.audio.play('door');
    if (r.kind === 'boss') { G.boss.spawn(r.mk.B[0] + 0.5, FLOOR, r.mk.B[1] + 0.5, run.level); return; }
    var rr = mul(h32(run.seed, r.idx, 55)), mk = r.mk.E.slice(), names = Object.keys(E.types), tot = 0, j, k, tmp, lv = run.level;
    for (j = mk.length - 1; j > 0; j--) { k = Math.floor(rr() * (j + 1)); tmp = mk[j]; mk[j] = mk[k]; mk[k] = tmp; }
    names.forEach(function (n) { tot += E.types[n].weight; });
    var cnt = Math.min(mk.length, 2 + Math.floor(rr() * 5));
    for (j = 0; j < cnt; j++) {
      var pick = rr() * tot, name = names[0];
      for (k = 0; k < names.length; k++) { pick -= E.types[names[k]].weight; if (pick <= 0) { name = names[k]; break; } }
      var def = Object.create(E.types[name]);
      def.hp = Math.round(def.hp * 1.2 * (1 + 0.15 * (lv - 1))); def.damage = Math.round(def.damage * (1 + 0.1 * (lv - 1)));
      var e = E.spawn(name, mk[j][0] + 0.5, FLOOR, mk[j][1] + 0.5, def); e.alerted = true; r.foes.push(e);
    }
  }
  function clearRoom(r) {
    r.state = 'cleared';
    r.doors.forEach(function (d) { setDoor(d, false); });
    G.audio.play('door'); G.ui.banner('Phòng đã dọn sạch', '', 'clear');
  }
  function updateRun(dt, p) {
    var i, r, j, d, k;
    for (i = 0; i < run.rooms.length; i++) {
      r = run.rooms[i];
      if (p.x >= r.x0 && p.x < r.x0 + r.w && p.z >= r.z0 && p.z < r.z0 + r.h) run.cur = i;
      if (r.state === 'idle' && (r.kind === 'combat' || r.kind === 'boss') && p.x >= r.x0 + 1.6 && p.x <= r.x0 + r.w - 1.6 && p.z >= r.z0 + 0.6 && p.z <= r.z0 + r.h - 0.6) activate(r);
      else if (r.state === 'active' && r.kind === 'combat') {
        for (j = 0, k = true; j < r.foes.length; j++) if (!r.foes[j].dead) k = false;
        if (k) clearRoom(r);
      }
      for (j = 0; j < r.doors.length; j++) {
        d = r.doors[j]; d.a = d.closed ? Math.min(1, d.a + dt / 0.4) : Math.max(0, d.a - dt / 0.4);
         d.mesh.visible = d.a > 0.01; d.mesh.position.y = FLOOR + WH / 2 - (1 - d.a) * WH;
      }
    }
    if (run.portal) run.portal.rotation.y += dt;
    var txt = run.cur >= 0 ? 'Phòng ' + (run.cur + 1) + '/' + run.rooms.length : '', ft = '', cr = run.cur >= 0 ? run.rooms[run.cur] : null, nn = 0, hk;
    if (cr && cr.state === 'active' && cr.kind === 'combat') { for (j = 0; j < cr.foes.length; j++) if (!cr.foes[j].dead) nn++; if (nn > 0) ft = 'Còn ' + nn + ' kẻ địch'; }
    else if (cr && cr.kind === 'boss' && G.boss.active) ft = 'Trùm';
    hk = txt + '|' + ft;
    if (hk !== hudTxt) { hudTxt = hk; G.ui.setRoom(txt, ft); }
  }

  /* ---------- Enter / leave ---------- */
  function put(x, y, z, yaw) {
    var P = G.player;
    P.pos.x = x; P.pos.y = y; P.pos.z = z; P.vel.x = P.vel.y = P.vel.z = 0; P.kb.x = P.kb.z = 0; P.rollT = 0;
    if (yaw != null) { P.yaw = yaw; P.pitch = 0; }
  }
  function transition(fn) {
    if (busy) return;
    busy = true; G.paused = true; btn.classList.remove('show'); near = null; fadeEl.style.opacity = 1;
    setTimeout(function () {
      try { fn(); } catch (err) { if (window.console) console.error(err); }
      fadeEl.style.opacity = 0; G.input.interactQ = false;
      setTimeout(function () { busy = false; G.paused = !!G.inventory.open; }, 500);
    }, 850);
  }
  function enter(ent) {
    var n = runs[ent.key] | 0, s;
    runs[ent.key] = n + 1;
    run = build(h32(W.seed, h32(ent.rx, ent.rz, 5), n), ent);
    run.sEn = E.swap(null);
    run.sDrops = L.drops; L.drops = []; run.sDrops.forEach(function (d) { d.mesh.visible = false; });
    run.sFog = scene.fog; run.sBg = scene.background;
    scene.fog = new THREE.Fog(0x08070d, 7, 36); scene.background = new THREE.Color(0x08070d);
    L.levelAt = function () { return run.level; };
    scene.add(run.grp); W.hold(true); W.useProvider(run.provider);
    for (var k in gates) gates[k].visible = false;
    D.active = true; insideKey = ent.key; hudTxt = ''; roomHud.style.display = 'block';
    s = run.rooms[0].mk.S; put(s[0] + 0.5, FLOOR + 0.01, s[1] + 0.5, -Math.PI / 2);
    G.player.iframes = 1; G.save.request();
    G.ui.banner('Hầm ngục: ' + G.ui.dungeonName(run.seed), 'Cấp ' + run.level, 'entry');
  }
  function leave() {
    if (!run) return null;
    var r = run, out = r.ent.out;
    G.boss.cleanup();
    L.drops.forEach(function (d) {
      if (G.inventory.add(d.item)) G.toast('Nhặt được: ' + d.item.name, G.items.RARITIES[d.item.rarity].color, d.item);
      scene.remove(d.mesh);
    });
    L.drops = r.sDrops; L.drops.forEach(function (d) { d.mesh.visible = true; });
    E.clear(); E.swap(r.sEn);
    scene.remove(r.grp); dispose(r.grp);
    scene.fog = r.sFog; scene.background = r.sBg; L.levelAt = origLevel;
    W.useProvider(null); W.hold(false);
    for (var k in gates) gates[k].visible = true;
    D.active = false; insideKey = null; run = null; near = null;
    roomHud.style.display = 'none'; bossBar.style.display = 'none'; hudTxt = '';
    G.save.request();
    return out;
  }
  function goIn(ent) { transition(function () { enter(ent); }); }
  function exitRun() { transition(function () { var o = leave(); if (o) put(o.x, o.y + 0.01, o.z, 0); }); }

  D.respawnPoint = function () { return D.active ? leave() : null; };
  D.afterLoad = function () {
    if (!insideKey) return;
    var a = insideKey.split(','), ent = entrance(+a[0], +a[1]);
    insideKey = null;
    if (ent) put(ent.out.x, ent.out.y + 0.01, ent.out.z, 0);
    else { var sp = G.player.spawnPos; if (sp) put(sp.x, sp.y + 0.01, sp.z, 0); }
  };
  D.run = function () { return run; };
  D.gateItems = function () { return gateItems; };
  D.gatesNear = function (x0, z0, x1, z1) { // gate entrances whose region overlaps the box (decor exclusion)
    var out = [], rx, rz, e;
    for (rx = Math.floor(x0 / REG); rx <= Math.floor(x1 / REG); rx++) for (rz = Math.floor(z0 / REG); rz <= Math.floor(z1 / REG); rz++) { e = entrance(rx, rz); if (e) out.push(e); }
    return out;
  };
  D.isCleared = function (k) { return !!cleared[k]; };

  D.update = function (dt) {
    if (busy) return;
    var P = G.player, p = P.pos, I = G.input, list, i, it, dd, best = null, bd = 1e9;
    if (D.active) { updateRun(dt, p); list = run.inter; }
    else { gateT -= dt; if (gateT <= 0) { gateT = 0.6; syncGates(p.x, p.z); } list = gateItems; }
    if (!P.dead) for (i = 0; i < list.length; i++) {
      it = list[i]; dd = Math.sqrt((it.x - p.x) * (it.x - p.x) + (it.z - p.z) * (it.z - p.z));
      if (dd < it.r && Math.abs(it.y - p.y) < 3.5 && dd < bd) { bd = dd; best = it; }
    }
    if (best !== near) {
      near = best;
      if (near) { btn.textContent = (I.isTouch ? '' : '[E] ') + near.label; btn.classList.add('show'); } else btn.classList.remove('show');
    }
    if (I.interactQ) { I.interactQ = false; if (near && !P.dead) near.act(); }
  };

  D.init = function (sc) {
    scene = sc; W = G.world; E = G.enemies; L = G.loot; origLevel = L.levelAt;
    btn = document.getElementById('btn-interact'); roomHud = document.getElementById('room-hud'); bossBar = document.getElementById('boss-bar'); fadeEl = document.getElementById('fade');
    var base = G.audio.play;
    G.audio.play = function (n) { if (SFX[n]) SFX[n](); else base.call(G.audio, n); };
    G.events.on('bossDied', function (d) {
      if (!run) return;
      var room = run.rooms[run.rooms.length - 1], item, s;
      for (s = 0; s < 80; s++) { item = rollChest(run.level + 1, h32(run.seed, 9000 + s, 0xB055), 1.2); if (item.rarity >= 2) break; }
      L.spawnDrop(item, d.x, d.z, 0.5, d.y + 1);
      room.state = 'cleared'; room.doors.forEach(function (x) { setDoor(x, false); });
      cleared[run.key] = true; if (gates[run.key]) V.setCleared(gates[run.key], true);
      var o = V.portal(), bx = room.mk.B[0] + 0.5, bz = room.mk.B[1] + 0.5;
      o.position.set(bx, FLOOR, bz); run.grp.add(o); run.portal = o;
      run.inter.push({ x: bx, y: FLOOR, z: bz, r: 2.6, label: 'Rời hầm ngục', act: exitRun });
      G.ui.banner('Trùm đã bị hạ!', G.boss.name || '', 'boss'); G.save.request();
    });
    G.save.register('dungeon', function () { return { runs: runs, cleared: cleared, inside: insideKey }; },
      function (d) { runs = d.runs || {}; cleared = d.cleared || {}; insideKey = d.inside || null; });
  };
})();
