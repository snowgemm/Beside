/* farm.js - the 12x8 plot (tiles x 24..35, z 24..31): soil -> tilled -> watered -> planted, growth per day, InstancedMesh rendering, sleeping.
   Rules: crops grow one stage per day only if watered that day; every tile dries at day start ('day:new').
   Actions are driven by ui.js through Farm.act(tx, tz, itemId); Farm never reads input or the hotbar itself. */
(function (G) {
  'use strict';
  const W = G.World, TS = W.TS, Inv = G.Inventory, St = G.State;
  const X0 = 24, Z0 = 24, FW = 12, FH = 8, CELLS = FW * FH;
  const CROP_IDS = ['rau', 'cachua', 'lua'];              // crop byte 1..3
  const COST = { hoe: 4, can: 2 };
  const POP = 0.4;                                         // seconds of pop-scale animation

  const st = new Uint8Array(CELLS);    // 0 soil, 1 tilled, 2 planted
  const wet = new Uint8Array(CELLS);   // watered today
  const crop = new Uint8Array(CELLS);  // 0 none, 1..3
  const age = new Uint8Array(CELLS);   // days grown (watered days)
  const pop = new Float32Array(CELLS).fill(99);
  let dirty = true, sleeping = false;
  const fx = [];                       // harvest "pop-out" ghosts

  const idx = function (tx, tz) { return (tx < X0 || tz < Z0 || tx >= X0 + FW || tz >= Z0 + FH) ? -1 : (tz - Z0) * FW + (tx - X0); };
  const days = function (i) { return Inv.CROPS[CROP_IDS[crop[i] - 1]].days; };
  const ripe = function (i) { return st[i] === 2 && age[i] >= days(i); };
  const stageOf = function (i) { return Math.min(3, Math.floor(age[i] * 3 / days(i))); };   // 0 sprout .. 3 ripe

  const Farm = G.Farm = { X0: X0, Z0: Z0, W: FW, H: FH, ready: null };
  Farm.inPlot = function (tx, tz) { return idx(tx, tz) >= 0; };
  Farm.sleeping = function () { return sleeping; };
  Farm.stateAt = function (tx, tz) {
    const i = idx(tx, tz); if (i < 0) return null;
    const planted = st[i] === 2;
    return { state: planted ? 'planted' : st[i] === 1 ? (wet[i] ? 'watered' : 'tilled') : 'soil', wet: !!wet[i],
      crop: planted ? CROP_IDS[crop[i] - 1] : null, age: age[i], stage: planted ? stageOf(i) : -1, ripe: ripe(i) };
  };

  // Context label for the facing tile with the selected item, or null when nothing would happen.
  Farm.preview = function (tx, tz, item) {
    const i = idx(tx, tz); if (i < 0) return null;
    if (ripe(i)) return 'Thu hoạch';
    const it = Inv.item(item);
    if (item === 'hoe' && st[i] === 0) return 'Cuốc';
    if (item === 'can' && st[i] >= 1 && !wet[i]) return 'Tưới';
    if (it && it.kind === 'seed' && st[i] === 1) return 'Gieo';
    return null;
  };

  function deny(reason, text, tx, tz) { G.Events.emit('farm:denied', { reason: reason, text: text, tx: tx, tz: tz }); return false; }
  function spend(n, tx, tz) { return St.useEnergy(n) || deny('energy', 'Không đủ năng lượng', tx, tz); }

  // Performs the action for the facing tile. Returns true if something happened.
  Farm.act = function (tx, tz, item) {
    const i = idx(tx, tz); if (i < 0) return false;
    const by = G.Net.playerId;
    if (ripe(i)) {                                           // bare hand (any selected item) harvests
      const c = CROP_IDS[crop[i] - 1], pid = 'crop_' + c;
      if (!Inv.add(pid, 1)) return deny('bag_full', 'Túi đồ đã đầy', tx, tz);
      fx.push({ x: (tx + 0.5) * TS, z: (tz + 0.5) * TS, crop: c, t: 0, seed: i });
      st[i] = 1; crop[i] = 0; age[i] = 0; dirty = true;
      G.Events.emit('crop:harvested', { tx: tx, tz: tz, crop: c, item: pid, by: by });
      return true;
    }
    const it = Inv.item(item);
    if (item === 'hoe') {
      if (st[i] !== 0) return deny('tilled', st[i] === 1 ? 'Đất đã được cuốc' : 'Ở đây đã có cây', tx, tz);
      if (!spend(COST.hoe, tx, tz)) return false;
      st[i] = 1; pop[i] = 0; dirty = true;
      G.Events.emit('soil:tilled', { tx: tx, tz: tz, by: by });
      return true;
    }
    if (item === 'can') {
      if (st[i] === 0) return deny('need_till', 'Cần cuốc đất trước', tx, tz);
      if (wet[i]) return deny('wet', 'Đất đã ướt rồi', tx, tz);
      if (!spend(COST.can, tx, tz)) return false;
      wet[i] = 1; dirty = true;
      G.Events.emit('soil:watered', { tx: tx, tz: tz, by: by });
      return true;
    }
    if (it && it.kind === 'seed') {
      if (st[i] === 0) return deny('need_till', 'Cần cuốc đất trước', tx, tz);
      if (st[i] === 2) return deny('occupied', 'Ở đây đã có cây', tx, tz);
      if (!Inv.remove(item, 1)) return deny('no_seed', 'Hết hạt giống', tx, tz);
      st[i] = 2; crop[i] = CROP_IDS.indexOf(it.crop) + 1; age[i] = 0; pop[i] = 0; dirty = true;
      G.Events.emit('crop:planted', { tx: tx, tz: tz, crop: it.crop, by: by });
      return true;
    }
    return false;
  };

  // New day: watered crops grow one day, then everything dries.
  G.Events.on('day:new', function () {
    let grown = 0;
    for (let i = 0; i < CELLS; i++) {
      if (st[i] === 2 && wet[i] && age[i] < days(i)) { age[i]++; grown++; }
      wet[i] = 0;
    }
    dirty = true;
    G.Events.emit('farm:newday', { grown: grown });
  });

  // ---------- sleeping (house door): fade out, skip to morning, energy 100, fade in ----------
  const fade = document.createElement('div');
  fade.style.cssText = 'position:fixed;inset:0;background:#0b122b;opacity:0;pointer-events:none;transition:opacity .6s ease;z-index:30';
  document.body.appendChild(fade);
  Farm.sleep = function () {
    if (sleeping) return false;
    sleeping = true; fade.style.pointerEvents = 'auto'; fade.style.opacity = '1';
    G.Events.emit('player:sleep', {});
    setTimeout(function () {
      G.Time.skipToMorning();            // emits day:new (crops grow, tiles dry) and day:started
      St.setEnergy(100);
      G.Events.emit('player:slept', { day: G.Time.day });
      G.Save.save();
      setTimeout(function () {
        fade.style.opacity = '0';
        setTimeout(function () { fade.style.pointerEvents = 'none'; sleeping = false; }, 650);
      }, 500);
    }, 700);
    return true;
  };

  // ---------- rendering ----------
  const tmp = new THREE.Object3D(), cWet = new THREE.Color(0x4a2f20), cDry = new THREE.Color(0xa87147);
  function merge(list) {
    const p = [], c = [];
    list.forEach(function (e) {
      const g = e.g.index ? e.g.toNonIndexed() : e.g; g.applyMatrix4(e.m);
      const a = g.attributes.position.array, k = new THREE.Color(e.c);
      for (let i = 0; i < a.length; i += 3) { p.push(a[i], a[i + 1], a[i + 2]); c.push(k.r, k.g, k.b); }
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(c, 3));
    g.computeVertexNormals(); return g;
  }
  const M4 = function (x, y, z, sx, sy, sz) { return new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion(), new THREE.Vector3(sx || 1, sy || 1, sz || 1)); };

  // furrow tile: darker slab + three ridges
  const furrowGeo = merge([{ g: new THREE.BoxGeometry(1.84, 0.05, 1.84), m: M4(0, 0.035, 0), c: 0xb09078 },
    { g: new THREE.BoxGeometry(0.46, 0.17, 1.8), m: M4(-0.62, 0.085, 0), c: 0xffffff },
    { g: new THREE.BoxGeometry(0.46, 0.17, 1.8), m: M4(0, 0.085, 0), c: 0xffffff },
    { g: new THREE.BoxGeometry(0.46, 0.17, 1.8), m: M4(0.62, 0.085, 0), c: 0xffffff }]);
  const furrow = new THREE.InstancedMesh(furrowGeo, new THREE.MeshLambertMaterial({ vertexColors: true }), CELLS);
  furrow.frustumCulled = false; furrow.receiveShadow = true; furrow.count = 0; W.add(furrow);

  // growth visuals: [file, scale] per stage. Kenney crops: leafs -> rau muống, corn -> cà chua (fruit tinted red), wheat -> lúa
  const STAGE = {
    rau:    ['crops_leafsStageA', 'crops_leafsStageA', 'crops_leafsStageB', 'crops_leafsStageB'],
    cachua: ['crops_cornStageA', 'crops_cornStageB', 'crops_cornStageC', 'crops_cornStageD'],
    lua:    ['crops_wheatStageA', 'crops_wheatStageA', 'crops_wheatStageA', 'crops_wheatStageB']
  };
  const SCALE = {
    rau:    [1.1, 1.8, 1.4, 1.9],
    cachua: [1.2, 1.0, 1.1, 1.2],
    lua:    [1.0, 1.5, 2.0, 2.0]
  };
  const PLANTS = [[-0.62, -0.5], [0, -0.5], [0.62, -0.5], [-0.62, 0.5], [0, 0.5], [0.62, 0.5]];
  const PCAP = CELLS * PLANTS.length;
  const vis = {};   // key -> InstancedMesh[]
  function addVis(key, parts) {
    vis[key] = parts.map(function (p) {
      const m = new THREE.InstancedMesh(p.geo, p.mat, PCAP);
      m.frustumCulled = false; m.count = 0; m.castShadow = false; W.add(m); return m;
    });
  }
  // STAGE entries are keys; entry scale is looked up by crop+stage
  function bake(scene) {
    scene.updateMatrixWorld(true);
    const parts = [];
    scene.traverse(function (o) {
      if (!o.isMesh) return;
      const g = o.geometry.clone(); g.applyMatrix4(o.matrixWorld);
      const m = o.material, col = m.color ? m.color.clone() : new THREE.Color(0xffffff);
      if (m.name === 'corn') col.setHex(0xd9382b);
      parts.push({ geo: g, mat: new THREE.MeshLambertMaterial({ color: col, map: m.map || null, vertexColors: !!m.vertexColors, side: THREE.DoubleSide }) });
    });
    return parts;
  }
  function procGeo(c, s) {
    const h = [0.3, 0.55, 0.85, 1.15][s] * (c === 'lua' ? 1.1 : 1), L = [];
    const green = c === 'lua' && s === 3 ? 0xd9b857 : 0x6aa84f;
    L.push({ g: new THREE.CylinderGeometry(0.03, 0.04, h, 5), m: M4(0, h / 2, 0), c: green });
    if (c === 'rau') [0, 1, 2].forEach(function (k) { L.push({ g: new THREE.IcosahedronGeometry(0.16 + s * 0.03, 0), m: M4(Math.sin(k * 2.1) * 0.12, h * (0.5 + k * 0.2), Math.cos(k * 2.1) * 0.12, 1, 0.6, 1), c: 0x7fbf5a }); });
    else if (c === 'cachua') { L.push({ g: new THREE.IcosahedronGeometry(0.2, 0), m: M4(0, h * 0.8, 0, 1, 0.7, 1), c: 0x5fae62 }); if (s === 3) [0, 1, 2].forEach(function (k) { L.push({ g: new THREE.IcosahedronGeometry(0.1, 0), m: M4(Math.sin(k * 2.1) * 0.2, h * 0.55, Math.cos(k * 2.1) * 0.2), c: 0xd9382b }); }); }
    else if (s > 1) L.push({ g: new THREE.ConeGeometry(0.07, 0.35, 5), m: M4(0, h + 0.1, 0), c: s === 3 ? 0xe8c75a : 0x8fc766 });
    return merge(L);
  }
  let useProc = false;
  function visKey(c, s) { return useProc ? 'p_' + c + s : STAGE[c][s]; }
  function visScale(c, s) { return useProc ? 1 : SCALE[c][s]; }

  Farm.ready = new Promise(function (res) {
    const files = {};
    Object.keys(STAGE).forEach(function (c) { STAGE[c].forEach(function (f) { files[f] = 1; }); });
    const names = Object.keys(files);
    Promise.all(names.map(function (f) {
      return new Promise(function (r) {
        if (!THREE.GLTFLoader) return r(null);
        new THREE.GLTFLoader().load('assets/models/' + f + '.glb', function (g) { r(g.scene); }, undefined, function () { r(null); });
      });
    })).then(function (scenes) {
      if (scenes.every(Boolean)) names.forEach(function (f, k) { addVis(f, bake(scenes[k])); });
      else {
        useProc = true;
        console.info('[farm] Kenney crop models unavailable, using procedural plants');
        CROP_IDS.forEach(function (c) { for (let s = 0; s < 4; s++) addVis('p_' + c + s, [{ geo: procGeo(c, s), mat: new THREE.MeshLambertMaterial({ vertexColors: true }) }]); });
      }
      dirty = true; res();
    });
  });

  const easeBack = function (p) { if (p >= 1) return 1; const q = p - 1; return 1 + 2.70158 * q * q * q + 1.70158 * q * q; };
  const jit = function (i, k) { let h = Math.imul(i * 7919 + k * 104729 + 13, 2654435761); h ^= h >>> 15; return ((h >>> 0) % 1000) / 1000; };
  function plants(i, cx, cz, key, scale, mult) {
    const meshes = vis[key]; if (!meshes) return;
    for (let k = 0; k < PLANTS.length; k++) {
      const s = scale * mult * (0.92 + jit(i, k) * 0.2);
      tmp.position.set(cx + PLANTS[k][0] + (jit(i, k + 9) - 0.5) * 0.14, 0.17, cz + PLANTS[k][1] + (jit(i, k + 19) - 0.5) * 0.14);
      tmp.rotation.set(0, jit(i, k + 29) * 6.28, 0); tmp.scale.setScalar(Math.max(s, 0.0001)); tmp.updateMatrix();
      for (const m of meshes) { m.setMatrixAt(m.count, tmp.matrix); m.count++; }
    }
  }
  function rebuild() {
    for (const k in vis) for (const m of vis[k]) m.count = 0;
    let n = 0;
    for (let i = 0; i < CELLS; i++) {
      if (st[i] < 1) continue;
      const cx = (X0 + (i % FW) + 0.5) * TS, cz = (Z0 + Math.floor(i / FW) + 0.5) * TS;
      const f = easeBack(pop[i] / POP);
      tmp.position.set(cx, 0.005, cz); tmp.rotation.set(0, 0, 0); tmp.scale.set(1, st[i] === 1 ? Math.max(f, 0.05) : 1, 1); tmp.updateMatrix();
      furrow.setMatrixAt(n, tmp.matrix); furrow.setColorAt(n, wet[i] ? cWet : cDry); n++;
      if (st[i] === 2) { const c = CROP_IDS[crop[i] - 1], s = stageOf(i); plants(i, cx, cz, visKey(c, s), visScale(c, s), f); }
    }
    furrow.count = n; furrow.instanceMatrix.needsUpdate = true; if (furrow.instanceColor) furrow.instanceColor.needsUpdate = true;
    for (const g of fx) {                       // harvested plants swell, then vanish
      const p = g.t / POP, mult = p < 0.35 ? 1 + p / 0.35 * 0.35 : 1.35 * (1 - (p - 0.35) / 0.65);
      plants(g.seed, g.x, g.z, visKey(g.crop, 3), visScale(g.crop, 3), Math.max(mult, 0.0001));
    }
    for (const k in vis) for (const m of vis[k]) m.instanceMatrix.needsUpdate = true;
    dirty = false;
  }
  G.Loop.onRender(function (a, dt) {
    let anim = fx.length > 0;
    for (let i = 0; i < CELLS; i++) if (pop[i] < POP) { pop[i] += dt; anim = true; }
    for (let k = fx.length - 1; k >= 0; k--) { fx[k].t += dt; if (fx[k].t >= POP) fx.splice(k, 1); }
    if (dirty || anim) rebuild();
  }, 60);

  // ---------- save ----------
  Farm.save = function () { return { st: Array.from(st), wet: Array.from(wet), crop: Array.from(crop), age: Array.from(age) }; };
  Farm.load = function (d) {
    Farm.reset();
    if (!d || !d.st || d.st.length !== CELLS) return;
    for (let i = 0; i < CELLS; i++) {
      st[i] = d.st[i] > 0 ? Math.min(2, d.st[i] | 0) : 0; wet[i] = d.wet[i] ? 1 : 0;
      crop[i] = st[i] === 2 ? Math.max(1, Math.min(3, d.crop[i] | 0)) : 0; age[i] = st[i] === 2 ? Math.max(0, d.age[i] | 0) : 0;
      if (st[i] === 2) age[i] = Math.min(age[i], days(i));
    }
    dirty = true;
  };
  Farm.reset = function () { st.fill(0); wet.fill(0); crop.fill(0); age.fill(0); pop.fill(99); fx.length = 0; dirty = true; };
  G.Save.register('farm', Farm, 'world');
})(window.Game);
