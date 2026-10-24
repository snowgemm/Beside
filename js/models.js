/* models.js - Kenney Nature Kit props (CC0, assets/models/*.glb).
   Loads each GLB once (cache), bakes it to a target height, tints its materials toward the village palette,
   shares one material per colour, and places every repeat as an InstancedMesh.
   Any model that fails to load falls back to the old procedural props (coconut palms, grass tufts, flowers)
   or to a simple procedural stand-in (trees, bushes, rocks, ...). Placement is seeded, so it is identical on every load. */
(function (G) {
  'use strict';
  const W = G.World, T = W.T, N = W.N, TS = W.TS, EXT = W.EXT, P = W.parts;
  const M = G.Models = { loaded: [], failed: [], cache: {}, ready: null, counts: {} };
  const BASE = 'assets/models/';

  // id, file, target height (world units; 1 tile = 2), kind, size (s = walk-through, m/l = blocks its tile)
  const CAT = [
    ['tree1', 'tree_default', 4.4, 'tree', 'l'], ['tree2', 'tree_oak', 3.8, 'tree', 'l'], ['tree3', 'tree_detailed', 4.2, 'tree', 'l'],
    ['tree4', 'tree_fat', 3.6, 'tree', 'l'], ['tree5', 'tree_small', 3.0, 'tree', 'l'], ['tree6', 'tree_tall', 5.4, 'tree', 'l'],
    ['tree7', 'tree_oak_fall', 3.8, 'tree', 'l'],
    ['palm1', 'tree_palm', 4.8, 'palm', 'l'], ['palm2', 'tree_palmTall', 6.0, 'palm', 'l'], ['palm3', 'tree_palmBend', 4.8, 'palm', 'l'],
    ['palm4', 'tree_palmShort', 3.8, 'palm', 'l'], ['palm5', 'tree_palmDetailedShort', 3.6, 'palm', 'l'], ['palm6', 'tree_palmDetailedTall', 5.6, 'palm', 'l'],
    ['bush1', 'plant_bush', 0.8, 'bush', 'm'], ['bush2', 'plant_bushDetailed', 1.0, 'bush', 'm'], ['bush3', 'plant_bushLarge', 0.9, 'bush', 'm'],
    ['bush4', 'plant_bushSmall', 0.55, 'bush', 's'], ['bush5', 'plant_bushTriangle', 1.0, 'bush', 'm'],
    ['rock1', 'rock_largeA', 0.7, 'rock', 'm'], ['rock2', 'rock_largeC', 0.7, 'rock', 'm'], ['rock3', 'rock_smallA', 0.45, 'rock', 's'],
    ['rock4', 'rock_smallD', 0.5, 'rock', 's'], ['rock5', 'stone_smallFlatA', 0.12, 'rock', 's'],
    ['fl1', 'flower_redA', 0.5, 'flower', 's'], ['fl2', 'flower_redB', 0.5, 'flower', 's'], ['fl3', 'flower_yellowA', 0.45, 'flower', 's'],
    ['fl4', 'flower_yellowC', 0.35, 'flower', 's'], ['fl5', 'flower_purpleA', 0.45, 'flower', 's'], ['fl6', 'flower_purpleC', 0.4, 'flower', 's'],
    ['gr1', 'grass', 0.5, 'grass', 's'], ['gr2', 'grass_large', 0.65, 'grass', 's'],
    ['fence1', 'fence_simple', 0.7, 'fence', 'm'], ['fence2', 'fence_planks', 0.7, 'fence', 'm'],
    ['stump1', 'stump_old', 0.6, 'stump', 'm'], ['stump2', 'stump_round', 0.55, 'stump', 'm'], ['log1', 'log', 0.45, 'log', 'm'],
    ['mush1', 'mushroom_redGroup', 0.45, 'mushroom', 's'], ['mush2', 'mushroom_tan', 0.3, 'mushroom', 's'], ['mush3', 'mushroom_tanGroup', 0.45, 'mushroom', 's']
  ].map(function (a) { return { id: a[0], file: a[1], h: a[2], kind: a[3], size: a[4] }; });

  // Kenney material name -> [palette colour, strength]. The pack's raw colours are cooler/minty; this pulls them to the game's warm greens and clay browns.
  const TINT = {
    leafsGreen: [0x72b152, 0.8], grass: [0x8dc563, 0.8], leafsFall: [0xe8a33d, 0.35], woodBirch: [0xf2e6c0, 0.3],
    woodBark: [0x94643f, 0.6], wood: [0xb5834f, 0.5], woodDark: [0x8a5a36, 0.5], woodInner: [0xe8d2b0, 0.25],
    dirt: [0x9a7550, 0.55], stone: [0xc9c3b0, 0.5],
    colorRed: [0xd9382b, 0.3], colorYellow: [0xf0b030, 0.25], colorPurple: [0xb08ad8, 0.3], colorTan: [0xe0a870, 0.2], _defaultMat: [0xf6ead0, 0.6]
  };
  const mats = {};
  function matFor(key, raw) {
    if (mats[key]) return mats[key];
    const t = TINT[key], c = (raw ? raw.clone() : new THREE.Color(t ? t[0] : 0xffffff));
    if (t) c.lerp(new THREE.Color(t[0]), t[1]);
    return (mats[key] = new THREE.MeshLambertMaterial({ color: c }));
  }

  // ---------- geometry helpers ----------
  function merge(gs) {
    let nv = 0, ni = 0;
    gs.forEach(function (g) { nv += g.attributes.position.count; ni += g.index ? g.index.count : g.attributes.position.count; });
    const pos = new Float32Array(nv * 3), nor = new Float32Array(nv * 3), idx = new Uint32Array(ni);
    let vo = 0, io = 0;
    gs.forEach(function (g) {
      const p = g.attributes.position, n = g.attributes.normal, c = p.count;
      for (let i = 0; i < c; i++) {
        pos[(vo + i) * 3] = p.getX(i); pos[(vo + i) * 3 + 1] = p.getY(i); pos[(vo + i) * 3 + 2] = p.getZ(i);
        nor[(vo + i) * 3] = n.getX(i); nor[(vo + i) * 3 + 1] = n.getY(i); nor[(vo + i) * 3 + 2] = n.getZ(i);
      }
      if (g.index) for (let i = 0; i < g.index.count; i++) idx[io + i] = g.index.getX(i) + vo;
      else for (let i = 0; i < c; i++) idx[io + i] = vo + i;
      vo += c; io += g.index ? g.index.count : c;
    });
    const out = new THREE.BufferGeometry();
    out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    out.setIndex(new THREE.BufferAttribute(idx, 1));
    return out;
  }
  // parts: [{key, color, geo}] in model units -> scaled so the whole model is h tall, feet on y = 0, merged per material.
  function fit(parts, h) {
    const box = new THREE.Box3();
    parts.forEach(function (p) { p.geo.computeBoundingBox(); box.union(p.geo.boundingBox); });
    const s = h / Math.max(box.max.y - box.min.y, 1e-4), m = new THREE.Matrix4().makeScale(s, s, s).multiply(new THREE.Matrix4().makeTranslation(0, -box.min.y, 0));
    const by = {};
    parts.forEach(function (p) {
      p.geo.applyMatrix4(m);
      (by[p.key] || (by[p.key] = { key: p.key, color: p.color, gs: [] })).gs.push(p.geo);
    });
    return Object.keys(by).map(function (k) { return { key: k, color: by[k].color, geo: merge(by[k].gs) }; });
  }
  function parse(scene) {
    scene.updateMatrixWorld(true);
    const out = [];
    scene.traverse(function (o) {
      if (!o.isMesh) return;
      const g = o.geometry.clone();
      Object.keys(g.attributes).forEach(function (a) { if (a !== 'position' && a !== 'normal') g.deleteAttribute(a); });
      g.applyMatrix4(o.matrixWorld);
      if (!g.attributes.normal) g.computeVertexNormals();
      out.push({ key: o.material.name || 'mat', color: o.material.color, geo: g });
    });
    return out;
  }

  // ---------- loader with cache ----------
  function loadFile(file) {
    if (M.cache[file]) return M.cache[file];
    return (M.cache[file] = new Promise(function (res) {
      if (!THREE.GLTFLoader) return res(null);
      try {
        new THREE.GLTFLoader().load(BASE + file + '.glb', function (g) { res(g.scene); }, undefined, function () { res(null); });
      } catch (e) { res(null); }
    }));
  }

  // ---------- procedural stand-ins (used only when a whole kind failed to load) ----------
  function standIn(kind) {
    const F = G.Util.flat, parts = [];
    const add = function (key, g, x, y, z, sx, sy, sz) {
      g.scale(sx || 1, sy || 1, sz || 1); g.translate(x || 0, y || 0, z || 0); parts.push({ key: key, color: null, geo: F(g) });
    };
    const ico = function (r, d) { return new THREE.IcosahedronGeometry(r, d || 0); };
    if (kind === 'tree') { add('woodBark', new THREE.CylinderGeometry(0.06, 0.09, 0.6, 6), 0, 0.3, 0); add('leafsGreen', ico(0.4, 1), 0, 0.85, 0, 1, 1.15, 1); }
    else if (kind === 'palm') {
      add('woodBark', new THREE.CylinderGeometry(0.05, 0.08, 1.4, 6), 0, 0.7, 0);
      for (let k = 0; k < 6; k++) { const g = new THREE.ConeGeometry(0.12, 0.9, 4); g.rotateZ(-Math.PI / 2 + 0.35); g.translate(0.4, 0, 0); g.rotateY(k * 1.047); add('leafsGreen', g, 0, 1.4, 0, 1, 0.3, 1); }
    }
    else if (kind === 'bush') add('grass', ico(0.5, 1), 0, 0.3, 0, 1, 0.7, 1);
    else if (kind === 'rock') add('dirt', ico(0.5, 0), 0, 0.2, 0, 1, 0.55, 0.9);
    else if (kind === 'fence') {
      [-0.45, 0.45].forEach(function (x) { add('woodDark', new THREE.BoxGeometry(0.08, 0.8, 0.08), x, 0.4, 0); });
      [0.3, 0.6].forEach(function (y) { add('wood', new THREE.BoxGeometry(1, 0.08, 0.05), 0, y, 0); });
    }
    else if (kind === 'stump') add('woodBark', new THREE.CylinderGeometry(0.3, 0.34, 0.5, 7), 0, 0.25, 0);
    else if (kind === 'log') { const g = new THREE.CylinderGeometry(0.16, 0.16, 1.1, 7); g.rotateZ(Math.PI / 2); add('woodBark', g, 0, 0.16, 0); }
    else if (kind === 'mushroom') { add('_defaultMat', new THREE.CylinderGeometry(0.05, 0.07, 0.3, 5), 0, 0.15, 0); add('colorRed', new THREE.ConeGeometry(0.2, 0.2, 6), 0, 0.38, 0); }
    return parts;
  }

  // ---------- main ----------
  const rnd = G.Rand.make(4242);
  const rr = function (a, b) { return a + rnd() * (b - a); };
  const ri = function (a, b) { return a + Math.floor(rnd() * (b - a + 1)); };
  const pick = function (a) { return a[Math.floor(rnd() * a.length)]; };

  function build(results) {
    const ent = {}, pools = {}, real = {}, stood = {};
    results.forEach(function (r) {
      if (r.scene) {
        let parts;
        try { parts = fit(parse(r.scene), r.c.h); } catch (e) { parts = null; }
        if (parts) { ent[r.c.id] = { c: r.c, parts: parts, list: [] }; real[r.c.kind] = true; M.loaded.push(r.c.file); return; }
      }
      M.failed.push(r.c.file);
    });
    // Kinds with nothing loaded get one stand-in each. palm / grass / flower instead keep the old procedural props.
    const OLD = { palm: 1, grass: 1, flower: 1 };
    CAT.forEach(function (c) {
      if (real[c.kind] || OLD[c.kind] || stood[c.kind]) return;
      stood[c.kind] = 1; ent[c.id] = { c: c, parts: fit(standIn(c.kind), c.h), list: [] };
    });
    CAT.forEach(function (c) { if (ent[c.id]) (pools[c.kind] || (pools[c.kind] = [])).push(c.id); });
    if (M.failed.length) console.warn('[models] failed to load (fallbacks in use): ' + M.failed.join(', '));

    // ----- placement grid -----
    const D = N + 2 * EXT, rs = new Uint8Array(D * D), occ = new Uint8Array(D * D);
    const gi = function (tx, tz) { return (tz + EXT) * D + (tx + EXT); };
    const within = function (tx, tz) { return tx >= -EXT && tz >= -EXT && tx < N + EXT && tz < N + EXT; };
    const playable = function (tx, tz) { return tx >= 2 && tz >= 2 && tx < N - 2 && tz < N - 2; };
    function reserved(tx, tz) {
      if (!within(tx, tz)) return true;
      if (tz >= 34 && tx >= 19 && tx <= 21) return true; // the road out through the village gate
      if (!(tx >= 0 && tz >= 0 && tx < N && tz < N) || !playable(tx, tz)) return false; // outside / border ring = open ground
      return W.tileAt(tx, tz) !== T.GRASS || W.isBlocked(tx, tz);
    }
    for (let tz = -EXT; tz < N + EXT; tz++) for (let tx = -EXT; tx < N + EXT; tx++) rs[gi(tx, tz)] = reserved(tx, tz) ? 1 : 0;
    function near(tx, tz, r, arr, min) {
      for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
        if (!within(tx + dx, tz + dz)) return true;
        const i = gi(tx + dx, tz + dz);
        if (arr ? arr[i] >= min : rs[i]) return true;
      }
      return false;
    }
    // reachable path/soil tiles from the spawn, used to prove the props never cut anything off
    function reach() {
      const seen = new Uint8Array(N * N), q = [[20, 34]]; let n = 0; seen[34 * N + 20] = 1;
      while (q.length) {
        const c = q.pop(), t = W.tileAt(c[0], c[1]); if (t === T.PATH || t === T.SOIL) n++;
        [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (d) {
          const x = c[0] + d[0], z = c[1] + d[1];
          if (x < 0 || z < 0 || x >= N || z >= N || seen[z * N + x] || W.isBlocked(x, z)) return;
          seen[z * N + x] = 1; q.push([x, z]);
        });
      }
      return n;
    }
    const reachBefore = reach(), blocked = [];
    function okTile(tx, tz, size) {
      if (!within(tx, tz) || rs[gi(tx, tz)]) return false;
      const o = occ[gi(tx, tz)];
      if (size === 's') return o < 2;
      if (o || near(tx, tz, 1)) return false;              // one free tile between solid props and paths / farm / buildings / water
      if (size === 'l' && near(tx, tz, 1, occ, 2)) return false;
      return true;
    }
    function mark(tx, tz, size) {
      const i = gi(tx, tz), cls = size === 's' ? 1 : size === 'm' ? 2 : 3;
      if (occ[i] < cls) occ[i] = cls;
      if (size !== 's' && playable(tx, tz) && W.block(tx, tz)) blocked.push([tx, tz]);
    }
    function put(e, x, z, ry, s, extra) {
      const tilt = (e.c.kind === 'tree' || e.c.kind === 'palm') ? 0.035 : e.c.kind === 'grass' ? 0.12 : 0;
      const b = rr(0.9, 1.1);
      e.list.push({ x: x, y: W.heightAt(x, z) - 0.04, z: z, ry: ry, s: s, rx: rr(-tilt, tilt), rz: rr(-tilt, tilt), b: b, w: extra || 0 });
    }
    const SC = { tree: [0.85, 1.2], palm: [0.9, 1.15], bush: [0.8, 1.3], rock: [0.8, 1.5], flower: [0.8, 1.3], grass: [0.8, 1.4], fence: [1, 1], stump: [0.9, 1.2], log: [0.9, 1.2], mushroom: [0.8, 1.3] };
    function scaleFor(kind, outer) { const r = SC[kind]; return rr(r[0], r[1]) * (outer && (kind === 'tree' || kind === 'palm') ? 1.15 : 1); }
    function single(kind, tx, tz, outer) {
      const e = ent[pick(pools[kind])];
      if (!okTile(tx, tz, e.c.size)) return false;
      const big = e.c.size !== 's', j = big ? 0.3 : 0.45;
      put(e, (tx + 0.5 + rr(-j, j)) * TS, (tz + 0.5 + rr(-j, j)) * TS, rr(0, 6.283), scaleFor(kind, outer));
      mark(tx, tz, e.c.size);
      return true;
    }
    function cluster(tx, tz) { // wild flowers
      if (!pools.flower || !okTile(tx, tz, 's')) return false;
      for (let k = ri(3, 6); k > 0; k--) put(ent[pick(pools.flower)], (tx + 0.5) * TS + rr(-0.8, 0.8), (tz + 0.5) * TS + rr(-0.8, 0.8), rr(0, 6.283), rr(0.8, 1.3));
      mark(tx, tz, 's'); return true;
    }
    function fenceRun(tx, tz) {
      if (!pools.fence) return false;
      const horiz = rnd() < 0.5, e = ent[pick(pools.fence)], n = 3;
      for (let k = 0; k < n; k++) if (!okTile(tx + (horiz ? k : 0), tz + (horiz ? 0 : k), 'm')) return false;
      for (let k = 0; k < n; k++) {
        const x = tx + (horiz ? k : 0), z = tz + (horiz ? 0 : k);
        put(e, (x + 0.5) * TS, (z + 0.5) * TS, horiz ? 0 : Math.PI / 2, 1); mark(x, z, 'm');
      }
      return true;
    }
    const WIN = [['tree', 13], ['palm', 13], ['bush', 22], ['rock', 12], ['flower', 20], ['stump', 5], ['log', 4], ['mushroom', 5], ['fence', 6]];
    const WOUT = [['tree', 46], ['palm', 8], ['bush', 24], ['rock', 14], ['mushroom', 3], ['stump', 3], ['log', 2]];
    function pickKind(outer) {
      const w = (outer ? WOUT : WIN).filter(function (a) { return pools[a[0]]; });
      let t = 0; w.forEach(function (a) { t += a[1]; });
      if (!t) return null;
      let r = rnd() * t;
      for (const a of w) { r -= a[1]; if (r <= 0) return a[0]; }
      return w[0][0];
    }
    function anchor(cx, cz) { // one prop per ~3x3 tile cell
      for (let a = 0; a < 8; a++) {
        const tx = cx + ri(0, 2), tz = cz + ri(0, 2), outer = !playable(tx, tz), kind = pickKind(outer);
        if (!kind) continue;
        if (kind === 'fence') { if (fenceRun(tx, tz)) return; continue; }
        if (kind === 'flower') { if (cluster(tx, tz)) return; continue; }
        if (single(kind, tx, tz, outer)) {
          if (kind === 'stump' && pools.mushroom && rnd() < 0.6) { const m = ent[pick(pools.mushroom)], x = (tx + 0.5) * TS + rr(0.45, 0.75) * (rnd() < 0.5 ? -1 : 1), z = (tz + 0.5) * TS + rr(-0.3, 0.3); put(m, x, z, rr(0, 6.283), rr(0.8, 1.2)); }
          return;
        }
      }
      for (let a = 0; a < 4; a++) { if (cluster(cx + ri(0, 2), cz + ri(0, 2))) return; } // never leave a cell bare
    }
    for (let cz = -EXT + 2; cz < N + EXT - 2; cz += 3) for (let cx = -EXT + 2; cx < N + EXT - 2; cx += 3) anchor(cx, cz);

    // Coconut palms on the existing palm spots (those tiles are already solid)
    if (pools.palm) P.coconuts.forEach(function (p) { put(ent[pick(pools.palm)], p.x, p.z, rr(0, 6.283), rr(0.95, 1.15)); });
    // Grass tufts everywhere there is open ground (including right beside paths)
    if (pools.grass) {
      let n = 0;
      for (let tz = -EXT + 1; tz < N + EXT - 1 && n < 1100; tz++) for (let tx = -EXT + 1; tx < N + EXT - 1 && n < 1100; tx++) {
        if (rs[gi(tx, tz)] || occ[gi(tx, tz)] >= 2 || rnd() > (playable(tx, tz) ? 0.5 : 0.18)) continue;
        for (let k = ri(1, 2); k > 0; k--, n++) put(ent[pick(pools.grass)], (tx + rnd()) * TS, (tz + rnd()) * TS, rr(0, 6.283), rr(0.8, 1.4));
      }
    }

    if (reach() < reachBefore) { console.warn('[models] props would cut off a path; releasing their collision'); blocked.forEach(function (b) { W.unblock(b[0], b[1]); }); }

    // ----- instanced meshes -----
    const dummy = new THREE.Object3D(), col = new THREE.Color();
    Object.keys(ent).forEach(function (id) {
      const e = ent[id], n = e.list.length; if (!n) return;
      M.counts[id] = n;
      const shadow = e.c.size !== 's';
      e.parts.forEach(function (p) {
        const mesh = new THREE.InstancedMesh(p.geo, matFor(p.key, p.color), n);
        mesh.frustumCulled = false; mesh.castShadow = shadow; mesh.receiveShadow = true;
        e.list.forEach(function (o, i) {
          dummy.position.set(o.x, o.y, o.z); dummy.rotation.set(o.rx, o.ry, o.rz, 'YXZ'); dummy.scale.setScalar(o.s); dummy.updateMatrix();
          mesh.setMatrixAt(i, dummy.matrix); mesh.setColorAt(i, col.setRGB(o.b, o.b, o.b));
        });
        mesh.instanceMatrix.needsUpdate = true; if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
        W.add(mesh);
      });
    });

    // Hide the old procedural props only for the kinds that really loaded
    if (real.palm) { P.cocT.visible = P.cocL.visible = P.cocN.visible = false; }
    if (real.grass) P.tufts.visible = false;
    if (real.flower) P.flowers.visible = false;
    console.info('[models] loaded ' + M.loaded.length + '/' + CAT.length + ' Kenney models; ' + Object.keys(M.counts).reduce(function (a, k) { return a + M.counts[k]; }, 0) + ' props placed');
  }

  M.ready = Promise.all(CAT.map(function (c) { return loadFile(c.file).then(function (scene) { return { c: c, scene: scene }; }); }))
    .then(build)
    .catch(function (err) { console.warn('[models] build failed, old procedural props stay', err); });
})(window.Game);
