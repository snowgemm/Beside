/* resources.js - Stage 2A: trees, rocks, bamboo and copper ore (instanced, hit to break, regrow after 2 days),
   daily ground pickups (cành cây / đá nhỏ) and the fixed workbench beside the house.
   Game.Resources.act(tx, tz, itemId) is called through Game.Actions (ui.js); this file never reads input or the hotbar.
   Save key 'resources' (world): node layout + state + pickups. Events: node:hit, node:broken, item:picked (all with `by`). */
(function (G) {
  'use strict';
  const W = G.World, T = W.T, N = W.N, TS = W.TS, Inv = G.Inventory, St = G.State, E = G.Events;
  const BASE = 'assets/models/', CAP = 96, SHAKE = 0.28, REGROW_DAYS = 2, PER_DAY = 8, PICK_CAP = 40, GAP = 0.25;
  const BENCH = { tx: 12, tz: 8 };
  const COST = { chop: 3, mine: 4 };
  // hits = base hits to break (minus 1 per tool tier, min 1); drop = [item, min, max]
  const KINDS = {
    tree:   { idx: 0, hits: 4, tool: 'axe',  cost: 'chop', drop: ['wood', 2, 3],   minTier: 1, need: 'Cần rìu để chặt cây' },
    rock:   { idx: 1, hits: 4, tool: 'pick', cost: 'mine', drop: ['stone', 2, 3],  minTier: 1, need: 'Cần cuốc chim để đào đá' },
    bamboo: { idx: 2, hits: 2, tool: 'axe',  cost: 'chop', drop: ['bamboo', 2, 3], minTier: 1, need: 'Cần rìu để chặt tre' },
    copper: { idx: 3, hits: 5, tool: 'pick', cost: 'mine', drop: ['ore', 1, 2],    minTier: 1, need: 'Cần cuốc chim đá trở lên' }
  };
  const KEYS = ['tree', 'rock', 'bamboo', 'copper'];
  const BROKEN = { tree: 'stump', rock: 'rubble', bamboo: 'stub', copper: 'rubbleCu' };
  const PLAN = [['tree', 25], ['rock', 15], ['bamboo', 10], ['copper', 6]];
  const CU = 0xc9783c;
  // key -> [[file, height, tint?]]
  const VAR = {
    tree: [['tree_default', 4.4], ['tree_oak', 3.8], ['tree_detailed', 4.2]],
    rock: [['rock_largeA', 1.2], ['rock_largeC', 1.1]],
    copper: [['rock_largeC', 1.2, CU], ['rock_largeA', 1.2, CU]],
    bamboo: [['crops_bambooStageB', 3.0], ['crops_bambooStageA', 2.6]],
    stump: [['stump_old', 0.6], ['stump_round', 0.55]],
    rubble: [['rock_smallA', 0.45], ['rock_smallD', 0.5]],
    rubbleCu: [['rock_smallA', 0.45, CU], ['rock_smallD', 0.5, CU]],
    stub: [],
    branch: [['log', 0.3]],
    pebble: [['stone_smallFlatA', 0.18], ['rock_smallD', 0.26]]
  };
  const BAMBOO = [[-0.45, -0.3, 1, 0.3], [0.4, -0.2, 0.85, 2.1], [0.05, 0.45, 0.95, 4.0]];

  const nodes = [], nodeAt = new Map(), pickups = [], pickAt = new Map();
  const vis = {};
  let built = false, pending = null, dirty = true, lastDay = 0, lastAct = 0, benchObj = null;
  const key = function (tx, tz) { return tz * N + tx; };

  const Res = G.Resources = { KINDS: KINDS, nodes: nodes, pickups: pickups, bench: BENCH, ready: null };

  // ---------- workbench tile: blocked + interactable right away so scenery avoids it ----------
  W.block(BENCH.tx, BENCH.tz);
  W.interactables.push({ id: 'bench', tx: BENCH.tx, tz: BENCH.tz, facing: null });

  // ---------- models ----------
  function loadGLB(file) {
    return new Promise(function (res) {
      if (!THREE.GLTFLoader) return res(null);
      try { new THREE.GLTFLoader().load(BASE + file + '.glb', function (g) { res(g.scene); }, undefined, function () { res(null); }); } catch (e) { res(null); }
    });
  }
  const TINTS = { leafsGreen: [0x72b152, 0.8], grass: [0x8dc563, 0.8], woodBark: [0x94643f, 0.6], wood: [0xb5834f, 0.5], woodDark: [0x8a5a36, 0.5], dirt: [0x9a7550, 0.55], stone: [0xc9c3b0, 0.5] };
  function lam(m, tint) {
    const c = m.color ? m.color.clone() : new THREE.Color(0xffffff), t = TINTS[m.name];
    if (t && !m.map) c.lerp(new THREE.Color(t[0]), t[1]);
    if (tint) c.lerp(new THREE.Color(tint), 0.6);
    return new THREE.MeshLambertMaterial({ color: c, map: m.map || null });
  }
  // GLB scene -> [{geo, mat}] scaled to height h, centred on x/z, feet at y = 0
  function bake(scene, h, tint, ky) {
    scene.updateMatrixWorld(true);
    const list = [], box = new THREE.Box3();
    scene.traverse(function (o) { if (!o.isMesh) return; const g = o.geometry.clone(); g.applyMatrix4(o.matrixWorld); g.computeBoundingBox(); box.union(g.boundingBox); list.push({ g: g, m: o.material }); });
    if (!list.length) return null;
    const s = h / Math.max(box.max.y - box.min.y, 1e-4), cx = (box.min.x + box.max.x) / 2, cz = (box.min.z + box.max.z) / 2;
    const M = new THREE.Matrix4().makeScale(s, s, s).multiply(new THREE.Matrix4().makeTranslation(-cx, ky ? 0 : -box.min.y, -cz));
    return list.map(function (p) { p.g.applyMatrix4(M); return { geo: p.g, mat: lam(p.m, tint) }; });
  }
  // procedural stand-ins (missing model, or kinds that never had one)
  function proc(kind) {
    const F = G.Util.flat, out = [];
    const add = function (g, col, x, y, z, sx, sy, sz) { g.scale(sx || 1, sy || 1, sz || 1); g.translate(x || 0, y || 0, z || 0); out.push({ geo: F(g), mat: new THREE.MeshLambertMaterial({ color: col }) }); };
    const ico = function (r) { return new THREE.IcosahedronGeometry(r, 0); };
    if (kind === 'tree') { add(new THREE.CylinderGeometry(0.15, 0.22, 1.4, 6), 0x94643f, 0, 0.7, 0); add(new THREE.IcosahedronGeometry(1.1, 1), 0x5fae62, 0, 2.4, 0, 1, 1.2, 1); }
    else if (kind === 'rock' || kind === 'copper') add(ico(0.7), kind === 'rock' ? 0xa8a496 : CU, 0, 0.4, 0, 1, 0.7, 0.9);
    else if (kind === 'bamboo' || kind === 'stub') {
      const h = kind === 'bamboo' ? 2.8 : 0.35;
      add(new THREE.CylinderGeometry(0.09, 0.11, h, 5), 0x9bc46a, 0, h / 2, 0);
      if (kind === 'bamboo') add(ico(0.45), 0x79b85a, 0, h, 0, 1, 0.8, 1);
    }
    else if (kind === 'stump') add(new THREE.CylinderGeometry(0.3, 0.35, 0.5, 7), 0x94643f, 0, 0.25, 0);
    else if (kind === 'rubble' || kind === 'rubbleCu') add(ico(0.35), kind === 'rubble' ? 0xa8a496 : CU, 0, 0.14, 0, 1.3, 0.5, 1);
    else if (kind === 'branch') { const g = new THREE.CylinderGeometry(0.04, 0.05, 0.7, 5); g.rotateZ(Math.PI / 2); add(g, 0x94643f, 0, 0.06, 0); }
    else if (kind === 'pebble') add(ico(0.13), 0xb8b4a6, 0, 0.08, 0, 1, 0.7, 1);
    else if (kind === 'bench') { add(new THREE.BoxGeometry(1.7, 0.12, 1.0), 0x8a5a36, 0, 0.9, 0); [-0.7, 0.7].forEach(function (x) { add(new THREE.BoxGeometry(0.14, 0.9, 0.8), 0xb5834f, x, 0.45, 0); }); }
    return out;
  }
  function makeVariant(parts, big) {
    return {
      meshes: parts.map(function (p) {
        const m = new THREE.InstancedMesh(p.geo, p.mat, CAP);
        m.frustumCulled = false; m.count = 0; m.castShadow = big; m.receiveShadow = true; W.add(m); return m;
      })
    };
  }
  function loadAll() {
    const jobs = Object.keys(VAR).map(function (k) {
      return Promise.all(VAR[k].map(function (v) { return loadGLB(v[0]).then(function (sc) { try { return sc ? bake(sc, v[1], v[2]) : null; } catch (e) { return null; } }); }))
        .then(function (res) {
          let list = res.filter(Boolean);
          if (!list.length) { list = [proc(k)]; if (VAR[k].length) console.info('[resources] model missing for ' + k + ', using procedural stand-in'); }
          vis[k] = list.map(function (p) { return makeVariant(p, k !== 'branch' && k !== 'pebble'); });
        });
    });
    jobs.push(loadGLB('workbench').then(function (sc) {
      let parts = null; try { parts = sc ? bake(sc, 1.1) : null; } catch (e) { parts = null; }
      if (!parts) { parts = proc('bench'); console.info('[resources] workbench model missing, using procedural bench'); }
      const g = new THREE.Group();
      parts.forEach(function (p) { const m = new THREE.Mesh(p.geo, p.mat); m.castShadow = m.receiveShadow = true; g.add(m); });
      g.position.set((BENCH.tx + 0.5) * TS, W.heightAt((BENCH.tx + 0.5) * TS, (BENCH.tz + 0.5) * TS), (BENCH.tz + 0.5) * TS);
      g.scale.setScalar(1.25); benchObj = g; W.add(g);
    }));
    return Promise.all(jobs);
  }

  // ---------- layout ----------
  const grassFree = function (x, z) { return W.tileAt(x, z) === T.GRASS && !W.isBlocked(x, z); };
  function okNodeTile(x, z) {
    if (!grassFree(x, z) || (G.Farm && G.Farm.inPlot(x, z))) return false;
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dz) continue;
      const t = W.tileAt(x + dx, z + dz);
      if (t === T.PATH || t === T.SOIL || t === T.WATER || t === T.BLOCKED) return false;   // margin from paths, farm, pond, house, shop
    }
    let free = 0;
    [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (d) { if (!W.isBlocked(x + d[0], z + d[1])) free++; });
    return free >= 3;                                                                        // always reachable from a neighbouring tile
  }
  function addNode(k, tx, tz, v, st, rg, rot, s, ox, oz) {
    const n = { k: k, tx: tx, tz: tz, v: v, st: st, rg: rg, rot: rot, s: s, ox: ox, oz: oz, hit: 0, shake: 0 };
    nodes.push(n); nodeAt.set(key(tx, tz), n); return n;
  }
  function generate() {
    const rnd = G.Rand.make(20260607), cand = [];
    for (let z = 4; z < N - 4; z++) for (let x = 4; x < N - 4; x++) if (okNodeTile(x, z)) cand.push([x, z]);
    for (let i = cand.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)), t = cand[i]; cand[i] = cand[j]; cand[j] = t; }
    const rr = function (a, b) { return a + rnd() * (b - a); };
    let c = 0;
    PLAN.forEach(function (p) {
      for (let n = 0; n < p[1]; ) {
        let spot = null;
        while (c < cand.length) { const t = cand[c++]; if (okNodeTile(t[0], t[1])) { spot = t; break; } }   // re-check: earlier nodes change neighbours
        if (!spot) { console.warn('[resources] ran out of free tiles for ' + p[0]); return; }
        W.block(spot[0], spot[1]);
        addNode(p[0], spot[0], spot[1], Math.floor(rnd() * 3), 0, 0, rr(0, 6.28), p[0] === 'tree' ? rr(0.85, 1.15) : rr(0.85, 1.2), rr(-0.15, 0.15), rr(-0.15, 0.15));
        n++;
      }
    });
  }
  function freeForPickup(x, z) {
    return grassFree(x, z) && !nodeAt.has(key(x, z)) && !pickAt.has(key(x, z)) && !(G.Farm && G.Farm.inPlot(x, z)) && !(x === BENCH.tx && z === BENCH.tz);
  }
  function spawnPickups() {
    const day = G.Time.day; if (day === lastDay) return; lastDay = day;
    for (let tries = 0, made = 0; tries < 400 && made < PER_DAY; tries++) {
      const x = G.Rand.int(3, N - 4), z = G.Rand.int(3, N - 4);
      if (!freeForPickup(x, z)) continue;
      const p = { id: G.Rand.next() < 0.5 ? 'branch' : 'pebble', tx: x, tz: z, v: G.Rand.int(0, 1), ox: G.Rand.range(-0.4, 0.4), oz: G.Rand.range(-0.4, 0.4), rot: G.Rand.range(0, 6.28) };
      pickups.push(p); pickAt.set(key(x, z), p); made++;
    }
    while (pickups.length > PICK_CAP) { const o = pickups.shift(); pickAt.delete(key(o.tx, o.tz)); }
    dirty = true;
  }
  function regrow(day) { nodes.forEach(function (n) { if (n.st && day >= n.rg) { n.st = 0; n.hit = 0; dirty = true; } }); }
  function clearAll() {
    nodes.forEach(function (n) { W.unblock(n.tx, n.tz); });
    nodes.length = 0; nodeAt.clear(); pickups.length = 0; pickAt.clear(); lastDay = 0;
  }
  function apply(d) {
    clearAll();
    d.nodes.forEach(function (a) {
      const k = KEYS[a[0]]; if (!k || !(a[1] >= 0 && a[2] >= 0 && a[1] < N && a[2] < N) || nodeAt.has(key(a[1], a[2]))) return;
      W.block(a[1], a[2]);
      addNode(k, a[1] | 0, a[2] | 0, a[3] | 0, a[4] ? 1 : 0, a[5] | 0, +a[6] || 0, +a[7] || 1, +a[8] || 0, +a[9] || 0);
    });
    (d.pick || []).forEach(function (a) {
      if (a[0] !== 'branch' && a[0] !== 'pebble') return;
      const p = { id: a[0], tx: a[1] | 0, tz: a[2] | 0, v: a[3] | 0, ox: +a[4] || 0, oz: +a[5] || 0, rot: +a[6] || 0 };
      if (pickAt.has(key(p.tx, p.tz))) return; pickups.push(p); pickAt.set(key(p.tx, p.tz), p);
    });
    lastDay = d.day | 0; regrow(G.Time.day); dirty = true;
  }
  function fresh() { clearAll(); generate(); spawnPickups(); dirty = true; }

  // ---------- actions ----------
  const deny = function (reason, text, tx, tz) { E.emit('farm:denied', { reason: reason, text: text, tx: tx, tz: tz }); return false; };
  const tierOf = function (item, k) { const it = Inv.item(item); return it && it.tool === k.tool ? (it.tier | 0) : 0; };
  const nodeFor = function (tx, tz) { return built ? nodeAt.get(key(tx, tz)) || null : null; };

  // Label for the action button: 'Chặt' / 'Đào' when the selected tool can work the facing node, else null.
  Res.label = function (tx, tz, item) {
    const n = nodeFor(tx, tz); if (!n || n.st) return null;
    const k = KINDS[n.k]; return tierOf(item, k) >= k.minTier ? (k.tool === 'axe' ? 'Chặt' : 'Đào') : null;
  };
  Res.act = function (tx, tz, item) {
    const n = nodeFor(tx, tz); if (!n) return false;
    const k = KINDS[n.k];
    if (n.st) return deny('regrow', 'Sẽ mọc lại sau vài ngày', tx, tz);
    const tier = tierOf(item, k);
    if (tier < k.minTier) return deny('tool', k.need, tx, tz);
    const now = performance.now(); if (now - lastAct < GAP * 1000) return false; lastAct = now;
    const need = Math.max(1, k.hits - tier), last = n.hit + 1 >= need;
    if (last && Inv.room(k.drop[0]) < k.drop[2]) return deny('bag_full', 'Túi đồ đã đầy', tx, tz);
    if (!St.useEnergy(COST[k.cost])) return deny('energy', 'Không đủ năng lượng', tx, tz);
    n.hit++; n.shake = SHAKE; dirty = true;
    E.emit('node:hit', { tx: tx, tz: tz, kind: n.k, hits: n.hit, need: need, by: G.Net.playerId });
    if (last) {
      n.st = 1; n.hit = 0; n.rg = G.Time.day + REGROW_DAYS;
      const qty = G.Rand.int(k.drop[1], k.drop[2]); Inv.add(k.drop[0], qty);
      E.emit('node:broken', { tx: tx, tz: tz, kind: n.k, item: k.drop[0], n: qty, by: G.Net.playerId });
    }
    return true;
  };
  // Ground pickups: the facing tile first, then the tile the player stands on.
  Res.pickupAt = function (tx, tz) {
    if (!built) return null;
    const P = G.Player; return pickAt.get(key(tx, tz)) || (P ? pickAt.get(key(P.tx, P.tz)) : null) || null;
  };
  Res.pickup = function (tx, tz) {
    const p = Res.pickupAt(tx, tz); if (!p) return false;
    if (!Inv.add(p.id, 1)) return deny('bag_full', 'Túi đồ đã đầy', p.tx, p.tz);
    pickups.splice(pickups.indexOf(p), 1); pickAt.delete(key(p.tx, p.tz)); dirty = true;
    E.emit('item:picked', { item: p.id, n: 1, tx: p.tx, tz: p.tz, by: G.Net.playerId });
    return true;
  };

  // ---------- events ----------
  E.on('day:new', function (e) { if (!built) return; regrow(e.day); spawnPickups(); });

  // ---------- rendering ----------
  const dummy = new THREE.Object3D();
  function draw(k, vi, x, z, ry, sc, shk) {
    const vs = vis[k]; if (!vs || !vs.length) return;
    const v = vs[vi % vs.length], f = shk > 0 ? shk / SHAKE : 0;
    dummy.position.set(x + Math.sin(shk * 60) * 0.07 * f, W.heightAt(x, z) - 0.02, z);
    dummy.rotation.set(0, ry, Math.sin(shk * 45) * 0.06 * f); dummy.scale.setScalar(sc); dummy.updateMatrix();
    for (const m of v.meshes) if (m.count < CAP) m.setMatrixAt(m.count++, dummy.matrix);
  }
  function rebuild() {
    for (const k in vis) for (const v of vis[k]) for (const m of v.meshes) m.count = 0;
    nodes.forEach(function (n) {
      const cx = (n.tx + 0.5 + n.ox) * TS, cz = (n.tz + 0.5 + n.oz) * TS, k = n.st ? BROKEN[n.k] : n.k;
      if (n.k === 'bamboo') BAMBOO.forEach(function (b, i) { draw(k, n.v, cx + b[0], cz + b[1], b[3], b[2] * n.s, n.shake); });
      else draw(k, n.v, cx, cz, n.rot, n.st ? 1 : n.s, n.shake);
    });
    pickups.forEach(function (p) { draw(p.id, p.v, (p.tx + 0.5 + p.ox) * TS, (p.tz + 0.5 + p.oz) * TS, p.rot, 1, 0); });
    for (const k in vis) for (const v of vis[k]) for (const m of v.meshes) m.instanceMatrix.needsUpdate = true;
    dirty = false;
  }
  G.Loop.onRender(function (a, dt) {
    if (!built) return;
    let anim = false;
    for (const n of nodes) if (n.shake > 0) { n.shake = Math.max(0, n.shake - dt); anim = true; }
    if (dirty || anim) rebuild();
  }, 62);

  // ---------- save ----------
  Res.save = function () {
    if (!built) return pending || { nodes: [], pick: [], day: 0 };
    const r = function (v) { return +v.toFixed(2); };
    return {
      nodes: nodes.map(function (n) { return [KINDS[n.k].idx, n.tx, n.tz, n.v, n.st, n.rg, r(n.rot), r(n.s), r(n.ox), r(n.oz)]; }),
      pick: pickups.map(function (p) { return [p.id, p.tx, p.tz, p.v, r(p.ox), r(p.oz), r(p.rot)]; }),
      day: lastDay
    };
  };
  Res.load = function (d) {
    const ok = d && d.nodes && d.nodes.length;
    if (!built) { pending = ok ? d : null; return; }
    if (ok) apply(d); else fresh();
  };
  Res.reset = function () { pending = null; if (built) fresh(); };
  G.Save.register('resources', Res, 'world');

  Res.ready = Promise.all([loadAll(), G.Models && G.Models.ready]).then(function () {
    if (pending) apply(pending); else fresh();
    pending = null; built = true; dirty = true;
  }).catch(function (err) { console.warn('[resources] setup failed', err); });
})(window.Game);
