/* world.js - tile grid logic, procedural Vietnamese village, renderer, lighting */
(function (G) {
  'use strict';
  const T = { GRASS: 0, PATH: 1, WATER: 2, SOIL: 3, BLOCKED: 4 };
  const N = 40, TS = 2, EXT = 20, S1 = N + 2 * EXT, HS = S1 + 1;
  const grid = new Uint8Array(N * N), base = new Uint8Array(N * N);
  const obj = new Uint8Array(N * N), pond = new Uint8Array(N * N);
  const ix = function (x, z) { return z * N + x; };
  const inb = function (x, z) { return x >= 0 && z >= 0 && x < N && z < N; };
  const clamp = function (v, a, b) { return Math.max(a, Math.min(b, v)); };
  const hash = function (x, z) { let h = Math.imul(x * 374761393 + z * 668265263, 1274126177); h = (h ^ (h >>> 13)) >>> 0; return (h % 1000) / 1000; };
  const W = G.World = { T: T, N: N, TS: TS, interactables: [], focus: new THREE.Vector3(N * TS / 2, 0, N * TS / 2) };
  const tmpO = new THREE.Object3D(), cc = new THREE.Color(), rnd = G.Rand.make(20260601);
  const ri = function (a, b) { return a + Math.floor(rnd() * (b - a + 1)); };
  const rr = function (a, b) { return a + rnd() * (b - a); };
  const flat = G.Util.flat;

  // ---------- renderer / scene ----------
  const canvas = document.getElementById('game');
  const renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x9fd8f0);
  scene.fog = new THREE.Fog(0x9fd8f0, 45, 115);
  W.scene = scene; W.renderer = renderer; W.camera = null;
  function resize() {
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(window.innerWidth, window.innerHeight, false);
    G.Events.emit('resize', { w: window.innerWidth, h: window.innerHeight });
  }
  window.addEventListener('resize', resize);
  window.addEventListener('orientationchange', function () { setTimeout(resize, 250); });
  resize();

  const amb = new THREE.AmbientLight(0xffffff, 0.7); scene.add(amb);
  const sun = new THREE.DirectionalLight(0xffffff, 1);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -26, right: 26, top: 26, bottom: -26, near: 1, far: 170 });
  sun.shadow.camera.updateProjectionMatrix();
  sun.shadow.bias = -0.001;
  scene.add(sun); scene.add(sun.target);

  // ---------- grid layout ----------
  function rect(x0, z0, x1, z1, t) { for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) grid[ix(x, z)] = t; }
  for (let z = 0; z < N; z++) for (let x = 0; x < N; x++) {
    if (x < 2 || z < 2 || x >= N - 2 || z >= N - 2) grid[ix(x, z)] = T.BLOCKED;
    const dx = (x - 10) / 3.3, dz = (z - 26) / 2.7;
    if (dx * dx + dz * dz <= 1) { pond[ix(x, z)] = 1; grid[ix(x, z)] = T.WATER; }
  }
  rect(20, 12, 20, 37, T.PATH); rect(10, 10, 10, 12, T.PATH); rect(10, 12, 20, 12, T.PATH);
  rect(21, 14, 22, 14, T.PATH); rect(14, 26, 19, 26, T.PATH); rect(6, 26, 13, 26, T.PATH); rect(21, 27, 23, 27, T.PATH);
  rect(24, 24, 35, 31, T.SOIL);
  rect(8, 7, 11, 9, T.BLOCKED); rect(23, 13, 25, 14, T.BLOCKED); rect(13, 11, 13, 11, T.BLOCKED);
  rect(19, 37, 19, 37, T.BLOCKED); rect(21, 37, 21, 37, T.BLOCKED);
  base.set(grid);
  W.interactables.push(
    { id: 'door', tx: 10, tz: 9, facing: 's' }, { id: 'ship', tx: 13, tz: 11, facing: null },
    { id: 'shop', tx: 23, tz: 13, facing: 'w' }, { id: 'shop', tx: 23, tz: 14, facing: 'w' });

  // ---------- terrain ----------
  const hts = new Float32Array(HS * HS);
  const H = function (i, j) { return hts[(j + EXT) * HS + (i + EXT)]; };
  function noise(i, j) { return Math.sin(i * 0.37 + Math.sin(j * 0.21) * 2.1) * Math.cos(j * 0.43 + Math.cos(i * 0.17) * 1.7) * 0.5 + 0.5; }
  function pondCorner(i, j) {
    if (i < 1 || j < 1 || i >= N || j >= N) return false;
    return !!(pond[ix(i - 1, j - 1)] && pond[ix(i, j - 1)] && pond[ix(i - 1, j)] && pond[ix(i, j)]);
  }
  function cornerH(i, j) {
    if (pondCorner(i, j)) return -0.45;
    const e = Math.min(i, N - i, j, N - j);
    let t = clamp((2 - e) / 10, 0, 1); t = t * t * (3 - 2 * t);
    const fade = e < -10 ? Math.max(0, 1 + (e + 10) / 10) : 1;
    return t * fade * (7 + 3 * noise(i, j));
  }
  for (let j = -EXT; j <= N + EXT; j++) for (let i = -EXT; i <= N + EXT; i++) hts[(j + EXT) * HS + (i + EXT)] = cornerH(i, j);

  const C = function (h) { return new THREE.Color(h); };
  const PAL = { gA: C(0x9ccf68), gB: C(0x8dc563), hill: C(0x7ab55b), dry: C(0xb9c96a), path: C(0xe0c18f), path2: C(0xd3ae7a),
    soil: C(0x7b5438), soil2: C(0x6a4730), bed: C(0x7aa89c) };
  function tileColor(tx, tz, o) {
    const ins = inb(tx, tz), r = hash(tx, tz);
    let t = ins ? grid[ix(tx, tz)] : T.GRASS;
    if (ins && tx === 20 && tz >= 38) t = T.PATH;
    if (t === T.PATH && ins && pond[ix(tx, tz)]) o.copy(PAL.bed);
    else if (t === T.PATH) o.copy(r < 0.5 ? PAL.path : PAL.path2);
    else if (t === T.WATER) o.copy(PAL.bed);
    else if (t === T.SOIL) o.copy(tx & 1 ? PAL.soil : PAL.soil2);
    else {
      const h = (H(tx, tz) + H(tx + 1, tz) + H(tx, tz + 1) + H(tx + 1, tz + 1)) / 4;
      o.copy(r < 0.5 ? PAL.gA : PAL.gB).lerp(PAL.hill, clamp(h / 3, 0, 1)).lerp(PAL.dry, clamp((h - 3) / 6, 0, 0.8));
    }
    return o.multiplyScalar(0.95 + 0.1 * hash(tx + 91, tz + 17));
  }
  const tPos = new Float32Array(S1 * S1 * 18), tCol = new Float32Array(S1 * S1 * 18);
  const tOff = function (tx, tz) { return ((tz + EXT) * S1 + (tx + EXT)) * 18; };
  for (let tz = -EXT; tz < N + EXT; tz++) for (let tx = -EXT; tx < N + EXT; tx++) {
    const o = tOff(tx, tz);
    const v = [[tx, tz], [tx, tz + 1], [tx + 1, tz + 1], [tx, tz], [tx + 1, tz + 1], [tx + 1, tz]];
    for (let k = 0; k < 6; k++) { tPos[o + k * 3] = v[k][0] * TS; tPos[o + k * 3 + 1] = H(v[k][0], v[k][1]); tPos[o + k * 3 + 2] = v[k][1] * TS; }
    tileColor(tx, tz, cc);
    for (let k = 0; k < 6; k++) { tCol[o + k * 3] = cc.r; tCol[o + k * 3 + 1] = cc.g; tCol[o + k * 3 + 2] = cc.b; }
  }
  const tGeo = new THREE.BufferGeometry();
  tGeo.setAttribute('position', new THREE.BufferAttribute(tPos, 3));
  tGeo.setAttribute('color', new THREE.BufferAttribute(tCol, 3));
  tGeo.computeVertexNormals();
  const terrain = new THREE.Mesh(tGeo, new THREE.MeshLambertMaterial({ vertexColors: true }));
  terrain.receiveShadow = true; scene.add(terrain);
  function recolor(tx, tz) {
    const o = tOff(tx, tz); tileColor(tx, tz, cc);
    for (let k = 0; k < 6; k++) { tCol[o + k * 3] = cc.r; tCol[o + k * 3 + 1] = cc.g; tCol[o + k * 3 + 2] = cc.b; }
    tGeo.attributes.color.needsUpdate = true;
  }
  const skirt = new THREE.Mesh(new THREE.CircleGeometry(320, 24).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ color: 0x8ec468 }));
  skirt.position.set(N * TS / 2, -0.4, N * TS / 2); scene.add(skirt);

  // water surface (merged quads over pond tiles)
  (function () {
    const p = [], n = [], y = -0.1;
    for (let z = 0; z < N; z++) for (let x = 0; x < N; x++) if (pond[ix(x, z)]) {
      const x0 = x * TS, x1 = x0 + TS, z0 = z * TS, z1 = z0 + TS;
      p.push(x0, y, z0, x0, y, z1, x1, y, z1, x0, y, z0, x1, y, z1, x1, y, z0);
      for (let k = 0; k < 6; k++) n.push(0, 1, 0);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(n, 3));
    scene.add(new THREE.Mesh(g, new THREE.MeshLambertMaterial({ color: 0x62bfd6, transparent: true, opacity: 0.8, depthWrite: false })));
  })();

  // ---------- static geometry builder (merged, vertex colours) ----------
  function mat(x, y, z, r, s) {
    tmpO.position.set(x, y, z); tmpO.rotation.set(r ? r[0] : 0, r ? r[1] : 0, r ? r[2] : 0);
    tmpO.scale.set(s ? s[0] : 1, s ? s[1] : 1, s ? s[2] : 1); tmpO.updateMatrix();
    return tmpO.matrix.clone();
  }
  function Builder() { this.p = []; this.c = []; }
  Builder.prototype = {
    add: function (g, m, c) {
      g = g.index ? g.toNonIndexed() : g; g.applyMatrix4(m);
      const a = g.attributes.position.array, k = new THREE.Color(c);
      for (let i = 0; i < a.length; i += 3) { this.p.push(a[i], a[i + 1], a[i + 2]); this.c.push(k.r, k.g, k.b); }
      return this;
    },
    box: function (w, h, d, x, y, z, c, r) { const g = new THREE.BoxGeometry(w, h, d); g.translate(0, h / 2, 0); return this.add(g, mat(x, y, z, r), c); },
    cyl: function (rt, rb, h, s, x, y, z, c, r) { const g = new THREE.CylinderGeometry(rt, rb, h, s); g.translate(0, h / 2, 0); return this.add(g, mat(x, y, z, r), c); },
    sph: function (rad, x, y, z, c, s) { return this.add(new THREE.IcosahedronGeometry(rad, 1), mat(x, y, z, null, s), c); },
    // stepped hip roof made of stacked frustums (tile courses)
    roof: function (w, d, x, y, z, c1, c2, n, th) {
      for (let k = 0; k < n; k++) {
        const f0 = 1 - k / n * 0.92, f1 = f0 - 0.16;
        const g = new THREE.CylinderGeometry(f1, f0, th, 4); g.rotateY(Math.PI / 4); g.translate(0, th / 2, 0);
        this.add(g, mat(x, y + k * th, z, null, [w * 0.7071, 1, d * 0.7071]), k % 2 ? c2 : c1);
      }
      return this;
    },
    geo: function () {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
      g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3));
      g.computeVertexNormals(); return g;
    }
  };
  const vcMat = new THREE.MeshLambertMaterial({ vertexColors: true });
  function sign(text, w, h, bg, fg, x, y, z, ry) {
    const cv = document.createElement('canvas'); cv.width = 512; cv.height = Math.round(512 * h / w);
    const c = cv.getContext('2d');
    c.fillStyle = bg; c.fillRect(0, 0, cv.width, cv.height);
    c.strokeStyle = fg; c.lineWidth = 8; c.strokeRect(10, 10, cv.width - 20, cv.height - 20);
    c.fillStyle = fg; c.font = '700 ' + Math.round(cv.height * 0.42) + 'px "Segoe UI",system-ui,sans-serif';
    c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(text, cv.width / 2, cv.height / 2 + 3);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshLambertMaterial({ map: new THREE.CanvasTexture(cv) }));
    m.position.set(x, y, z); m.rotation.y = ry; scene.add(m);
  }

  const S = new Builder();
  // House (tiles 8..11 x 7..9): red clay hip roof, door on the south face
  S.box(8, 0.5, 6, 20, 0, 17, 0xbfae94).box(7.2, 3, 5.2, 20, 0.5, 17, 0xf4e7c6);
  S.roof(9.6, 7.4, 20, 3.45, 17, 0xb8452e, 0xc9573a, 4, 0.75);
  S.box(1.3, 2.2, 0.2, 21, 0.5, 19.65, 0x6b4026).box(1.8, 0.22, 0.3, 21, 2.75, 19.65, 0x4a2c1a);
  S.box(0.2, 2.4, 0.3, 20.2, 0.5, 19.65, 0x4a2c1a).box(0.2, 2.4, 0.3, 21.8, 0.5, 19.65, 0x4a2c1a).box(2.4, 0.3, 0.9, 21, 0, 20.2, 0xcbb99b);
  [[18.2, 19.62, 0], [20, 14.38, 0], [23.62, 17, 1], [16.38, 17, 1]].forEach(function (w) {
    const sd = w[2];
    S.box(sd ? 0.14 : 1.4, 1.4, sd ? 1.4 : 0.14, w[0], 1.1, w[1], 0x6b4026);
    S.box(sd ? 0.18 : 1.05, 1.05, sd ? 1.05 : 0.18, w[0], 1.28, w[1], 0x9fd2e0);
  });
  S.sph(0.24, 19.5, 2.3, 20, 0xd9382b).sph(0.24, 22.5, 2.3, 20, 0xd9382b);
  // Grocery stall "Quán tạp hóa" (tiles 23..25 x 13..14), counter faces west
  S.box(6, 0.2, 4, 49, 0, 28, 0xb89a6a).box(0.25, 3, 4, 51.8, 0.2, 28, 0xc79a62);
  [1, 1.8, 2.5].forEach(function (y) { S.box(0.5, 0.1, 3.6, 51.4, y, 28, 0x8a5a36); });
  [1, 1.8, 2.5].forEach(function (y) { for (let z = 26.4; z < 29.7; z += 0.55) S.box(0.34, 0.3 + rnd() * 0.2, 0.34, 51.4, y + 0.1, z, [0xe8a33d, 0x6aa84f, 0xd9534a, 0xf2e6c0, 0x8fc4d6][ri(0, 4)]); });
  S.box(1.1, 1.1, 4, 46.9, 0.2, 28, 0xa8703f).box(1.4, 0.1, 4.2, 46.9, 1.3, 28, 0xd9a566);
  [27, 27.6, 28.2].forEach(function (z) { S.sph(0.28, 46.9, 1.62, z, 0xf0a030); });
  S.sph(0.4, 46.9, 1.7, 29.2, 0x6aa84f).box(0.5, 0.4, 0.5, 46.9, 1.4, 29.8, 0xd9534a);
  [[46.2, 26.2, 2.6], [46.2, 29.8, 2.6], [51.5, 26.2, 3.2], [51.5, 29.8, 3.2]].forEach(function (p) { S.box(0.25, p[2], 0.25, p[0], 0.2, p[1], 0x8a5a36); });
  for (let k = 0; k < 8; k++) S.box(6.6, 0.12, 0.55, 49, 3.05, 26.175 + k * 0.55, k % 2 ? 0xf6ead0 : 0xd9534a, [0, 0, 0.09]);
  S.box(0.12, 1.0, 3.8, 45.62, 2.85, 28, 0x5a3a24);
  sign('Quán tạp hóa', 3.6, 0.9, '#6b3f26', '#fff3d6', 45.53, 3.35, 28, -Math.PI / 2);
  // Shipping crate at tile (13,11)
  S.box(1.6, 1.2, 1.6, 27, 0, 23, 0xc99a5b).box(1.72, 0.12, 1.72, 27, 1.2, 23, 0xa87b45).box(1.64, 0.22, 1.64, 27, 0.5, 23, 0xb3452e);
  [[-0.8, -0.8], [0.8, -0.8], [-0.8, 0.8], [0.8, 0.8]].forEach(function (o) { S.box(0.16, 1.2, 0.16, 27 + o[0], 0, 23 + o[1], 0x8a5a36); });
  // Village gate "cổng làng" at tile row 37
  [39, 43].forEach(function (x) { S.box(1.3, 0.7, 1.3, x, 0, 75, 0xbfae94).box(0.9, 3.3, 0.9, x, 0.7, 75, 0xe9d6aa); });
  S.box(5.6, 0.6, 0.9, 41, 4, 75, 0xa83f2c).roof(6.6, 2.2, 41, 4.6, 75, 0xb8452e, 0xc9573a, 3, 0.45);
  sign('CỔNG LÀNG', 2.9, 0.8, '#a83f2c', '#ffe6a8', 41, 3.45, 75.03, 0);
  sign('CỔNG LÀNG', 2.9, 0.8, '#a83f2c', '#ffe6a8', 41, 3.45, 74.97, Math.PI);
  // Plank bridge over the pond (tiles 7..13, row 26)
  for (let i = 0; i < 16; i++) S.box(0.84, 0.14, 2, 14.4375 + i * 0.875, 0.14, 53, i % 2 ? 0xa6743f : 0xb5834f);
  [52.3, 53.7].forEach(function (z) { S.box(14, 0.16, 0.22, 21, -0.02, z, 0x6d4a2c); });
  [52.1, 53.9].forEach(function (z) {
    for (let i = 0; i < 8; i++) S.box(0.2, 1, 0.2, 14.3 + i * 1.9, 0.2, z, 0x7a5232);
    S.box(14, 0.1, 0.12, 21, 1.05, z, 0x9a6b3f).box(14, 0.08, 0.1, 21, 0.65, z, 0x9a6b3f);
  });
  // Distant rice-paddy terraces on the hills (north, east, west)
  const RICE = [0xa6d06a, 0xc9e07e, 0xe2d273, 0x93c964, 0xb7d86f];
  for (let k = 0; k < 5; k++) {
    const off = 4.5 + 3.2 * k, mid = N * TS / 2;
    [[mid, -off, 76, 3], [N * TS + off, mid, 3, 76], [-off, mid, 3, 76]].forEach(function (t, q) {
      const y = cornerH(t[0] / TS, t[1] / TS);
      S.box(t[2], 2.2, t[3], t[0], y - 2.05, t[1], RICE[(k + q) % 5]);
    });
  }
  const statics = new THREE.Mesh(S.geo(), vcMat);
  statics.castShadow = true; statics.receiveShadow = true; scene.add(statics);

  // ---------- instanced scenery ----------
  function inst(geo, n, shadow, vc) {
    const m = new THREE.InstancedMesh(geo, new THREE.MeshLambertMaterial({ color: 0xffffff, vertexColors: !!vc }), n);
    m.frustumCulled = false; m.castShadow = !!shadow; m.userData.i = 0; scene.add(m); return m;
  }
  function put(m, x, y, z, ry, rz, sx, sy, sz, col) {
    tmpO.position.set(x, y, z); tmpO.rotation.order = 'YZX'; tmpO.rotation.set(0, ry || 0, rz || 0);
    tmpO.scale.set(sx, sy, sz); tmpO.updateMatrix();
    const i = m.userData.i++; m.setMatrixAt(i, tmpO.matrix);
    if (col !== undefined) m.setColorAt(i, cc.setHex(col));
    tmpO.rotation.order = 'XYZ'; m.count = m.userData.i;
  }
  function freeGrass(x, z) {
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
      const a = x + dx, b = z + dz;
      if (!inb(a, b) || grid[ix(a, b)] !== T.GRASS || obj[ix(a, b)]) return false;
    }
    return true;
  }
  function spots(n) {
    const out = []; let tries = 0;
    while (out.length < n && tries++ < 800) {
      const x = ri(3, 36), z = ri(3, 36);
      if (freeGrass(x, z)) { obj[ix(x, z)] = 1; out.push({ x: (x + rr(0.3, 0.7)) * TS, z: (z + rr(0.3, 0.7)) * TS }); }
    }
    return out;
  }
  const LEAF_B = [0x7fbf5a, 0x6aa84f, 0x95cc62], LEAF_C = [0x4f9a5a, 0x5fae62, 0x6bb866];
  // bamboo groves (blocked tile rectangles)
  const groves = [[3, 10, 5, 19], [30, 5, 35, 8]];
  const bStalk = inst(flat(new THREE.CylinderGeometry(0.06, 0.09, 1, 5).translate(0, 0.5, 0)), 220, true);
  const bPuff = inst(flat(new THREE.IcosahedronGeometry(0.8, 0)), 220, true);
  groves.forEach(function (g) {
    for (let z = g[1]; z <= g[3]; z++) for (let x = g[0]; x <= g[2]; x++) obj[ix(x, z)] = 1;
    const cnt = Math.round((g[2] - g[0] + 1) * (g[3] - g[1] + 1) * 3.2);
    for (let i = 0; i < cnt; i++) {
      const x = rr(g[0], g[2] + 1) * TS, z = rr(g[1], g[3] + 1) * TS, h = rr(4.5, 7.5), tilt = rr(-0.08, 0.08), ry = rr(0, 6.28);
      put(bStalk, x, 0, z, ry, tilt, 1, h, 1, [0x9bc46a, 0x7fb069, 0xb5d27a][ri(0, 2)]);
      const s = rr(0.8, 1.3);
      put(bPuff, x - Math.sin(tilt) * h * Math.cos(ry), h, z + Math.sin(tilt) * h * Math.sin(ry), ry, 0, s, s * 0.8, s, [0x79b85a, 0x8fc766, 0x6aa84f][ri(0, 2)]);
    }
  });
  // banana trees
  const bananas = spots(10);
  const banT = inst(flat(new THREE.CylinderGeometry(0.16, 0.26, 2.4, 6).translate(0, 1.2, 0)), 10, true);
  const banL = inst(flat(new THREE.ConeGeometry(0.42, 2.3, 4).rotateZ(-Math.PI / 2).translate(1.15, 0, 0).scale(1, 0.18, 1)), 70, true);
  bananas.forEach(function (p) {
    const s = rr(0.9, 1.3);
    put(banT, p.x, 0, p.z, rr(0, 6.28), 0, s, s, s, 0x9bb86a);
    for (let k = 0; k < 7; k++) put(banL, p.x, 2.4 * s, p.z, k * 0.9 + rr(-0.2, 0.2), rr(0.2, 0.55), s, s, s, LEAF_B[ri(0, 2)]);
  });
  // coconut trees
  const coconuts = spots(9);
  const cocT = inst(flat(new THREE.CylinderGeometry(0.14, 0.26, 5.4, 6).translate(0, 2.7, 0)), 9, true);
  const cocL = inst(flat(new THREE.ConeGeometry(0.3, 3, 4).rotateZ(-Math.PI / 2).translate(1.5, 0, 0).scale(1, 0.16, 1)), 63, true);
  const cocN = inst(flat(new THREE.IcosahedronGeometry(0.2, 0)), 27, true);
  coconuts.forEach(function (p) {
    const s = rr(0.9, 1.2), ry = rr(0, 6.28), tilt = rr(-0.18, 0.18), hh = 5.4 * s;
    put(cocT, p.x, 0, p.z, ry, tilt, s, s, s, 0xa8845a);
    const cx = p.x - Math.sin(tilt) * hh * Math.cos(ry), cz = p.z + Math.sin(tilt) * hh * Math.sin(ry), cy = Math.cos(tilt) * hh;
    for (let k = 0; k < 7; k++) put(cocL, cx, cy, cz, k * 0.9 + rr(-0.2, 0.2), rr(-0.1, 0.35), s, s, s, LEAF_C[ri(0, 2)]);
    for (let k = 0; k < 3; k++) put(cocN, cx + rr(-0.3, 0.3), cy - 0.3, cz + rr(-0.3, 0.3), 0, 0, 1, 1, 1, k ? 0x6b4a2b : 0x8a6a3a);
  });
  // lotus on the pond (pads + blossoms)
  const pads = inst(flat(new THREE.CylinderGeometry(0.5, 0.5, 0.05, 8)), 28, false);
  const blooms = inst(flat(new THREE.ConeGeometry(0.2, 0.35, 6).translate(0, 0.17, 0)), 12, false);
  for (let i = 0, n = 0; n < 28 && i < 200; i++) {
    const a = rr(0, 6.28), r = Math.sqrt(rnd()) * 0.8, x = 21 + Math.cos(a) * r * 6.6, z = 53 + Math.sin(a) * r * 5.4;
    if (Math.abs(z - 53) < 1.5) continue;
    const s = rr(0.7, 1.3); put(pads, x, -0.07, z, rr(0, 6.28), 0, s, 1, s, [0x5fa86a, 0x6fb872, 0x4f9a5a][ri(0, 2)]);
    if (n % 2 === 0 && blooms.userData.i < 12) put(blooms, x + 0.1, -0.06, z, 0, 0, 1, 1, 1, rnd() < 0.6 ? 0xf2a1c0 : 0xfff3f0);
    n++;
  }
  // grass tufts + wild flowers
  const tb = new Builder();
  tb.cyl(0, 0.09, 0.55, 3, 0, 0, 0, 0xffffff, [0.15, 0, 0.1]).cyl(0, 0.08, 0.42, 3, 0.12, 0, 0.05, 0xffffff, [-0.1, 0, -0.2]).cyl(0, 0.08, 0.48, 3, -0.1, 0, 0.08, 0xffffff, [0.2, 0, 0.05]);
  const tufts = inst(tb.geo(), 800, false, true);
  const flowers = inst(flat(new THREE.IcosahedronGeometry(0.1, 0)), 80, false);
  for (let i = 0; i < 1400 && (tufts.userData.i < 800 || flowers.userData.i < 80); i++) {
    const tx = ri(0, N - 1), tz = ri(0, N - 1);
    if (grid[ix(tx, tz)] !== T.GRASS || obj[ix(tx, tz)]) continue;
    const x = (tx + rnd()) * TS, z = (tz + rnd()) * TS;
    if (i % 8 === 0 && flowers.userData.i < 80) put(flowers, x, 0.3, z, 0, 0, 1, 1, 1, [0xfff3d6, 0xffd34e, 0xf49ac1][ri(0, 2)]);
    else if (tufts.userData.i < 800) { const s = rr(0.8, 1.4); put(tufts, x, 0, z, rr(0, 6.28), 0, s, s, s, [0x7fbf55, 0x93cf62, 0x6fb04e][ri(0, 2)]); }
  }

  // ---------- ducks (cosmetic) ----------
  const ducks = [];
  for (let i = 0; i < 4; i++) {
    const b = new Builder(), body = i % 2 ? 0xc9a56a : 0xfaf6e8;
    b.add(new THREE.IcosahedronGeometry(0.45, 1), mat(0, 0.35, 0, null, [0.9, 0.7, 1.3]), body).sph(0.22, 0, 0.85, 0.55, body).box(0.16, 0.08, 0.24, 0, 0.78, 0.7, 0xf3a33a);
    const m = new THREE.Mesh(b.geo(), vcMat); m.castShadow = true; scene.add(m);
    const north = i < 2;
    ducks.push({ m: m, x: 21 + rr(-3, 3), z: north ? 50 : 56, zr: north ? [49.2, 51] : [55, 56.8], tx: 21, tz: north ? 50 : 56, yaw: rr(0, 6.28), wait: rr(0, 3), ph: i });
  }
  G.Loop.onUpdate(function (dt) {
    for (const d of ducks) {
      if (d.wait > 0) d.wait -= dt;
      else {
        const dx = d.tx - d.x, dz = d.tz - d.z, dist = Math.hypot(dx, dz);
        if (dist < 0.2) { d.wait = G.Rand.range(1, 4); d.tx = G.Rand.range(17, 25); d.tz = G.Rand.range(d.zr[0], d.zr[1]); }
        else {
          let a = Math.atan2(dx, dz) - d.yaw; a = Math.atan2(Math.sin(a), Math.cos(a)); d.yaw += a * Math.min(1, dt * 4);
          d.x += Math.sin(d.yaw) * 0.9 * dt; d.z += Math.cos(d.yaw) * 0.9 * dt;
        }
      }
      d.ph += dt * 3;
      d.m.position.set(d.x, -0.1 + Math.sin(d.ph) * 0.02, d.z); d.m.rotation.y = d.yaw;
    }
  });

  // ---------- sky stars ----------
  const sp = [];
  for (let i = 0; i < 220; i++) { const a = rr(0, 6.283), e = rr(0.15, 1.35); sp.push(Math.cos(a) * Math.cos(e) * 300, Math.sin(e) * 300, Math.sin(a) * Math.cos(e) * 300); }
  const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
  const stars = new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xffffff, size: 2.2, sizeAttenuation: false, transparent: true, fog: false, depthWrite: false }));
  stars.frustumCulled = false; scene.add(stars);

  // ---------- public API ----------
  W.add = function (o) { scene.add(o); return o; };
  W.tileAt = function (tx, tz) { return inb(tx, tz) ? grid[ix(tx, tz)] : T.BLOCKED; };
  W.isBlocked = function (tx, tz) {
    if (!inb(tx, tz)) return true;
    const i = ix(tx, tz), t = grid[i];
    return t === T.WATER || t === T.BLOCKED || obj[i] === 1;
  };
  W.setTile = function (tx, tz, type, by) {
    if (!inb(tx, tz) || grid[ix(tx, tz)] === type) return;
    grid[ix(tx, tz)] = type; recolor(tx, tz);
    G.Events.emit('world:tile', { tx: tx, tz: tz, type: type, by: by || G.Net.playerId });
  };
  W.facingTile = function (p) { p = p || G.Players.local(); return { tx: p.tx + p.facing.dx, tz: p.tz + p.facing.dz }; };
  W.groundY = function (tx, tz) { return inb(tx, tz) && pond[ix(tx, tz)] && grid[ix(tx, tz)] === T.PATH ? 0.28 : 0; };
  W.tileToWorld = function (tx, tz) { return new THREE.Vector3((tx + 0.5) * TS, W.groundY(tx, tz), (tz + 0.5) * TS); };
  W.save = function () {
    const out = [];
    for (let z = 0; z < N; z++) for (let x = 0; x < N; x++) if (grid[ix(x, z)] !== base[ix(x, z)]) out.push([x, z, grid[ix(x, z)]]);
    return { tiles: out };
  };
  W.load = function (d) {
    W.reset();
    ((d && d.tiles) || []).forEach(function (t) { if (inb(t[0], t[1])) { grid[ix(t[0], t[1])] = t[2]; recolor(t[0], t[1]); } });
  };
  W.reset = function () {
    for (let z = 0; z < N; z++) for (let x = 0; x < N; x++) if (grid[ix(x, z)] !== base[ix(x, z)]) { grid[ix(x, z)] = base[ix(x, z)]; recolor(x, z); }
  };
  G.Save.register('world', W, 'world');

  // ---------- per-frame view updates (never mutate world state here) ----------
  const hud = document.getElementById('hud'), hDay = document.getElementById('hud-day'), hTime = document.getElementById('hud-time');
  let lastMin = -1;
  G.Loop.onRender(function () {
    const s = G.Time.state;
    amb.color.copy(s.ambColor); amb.intensity = s.ambient;
    sun.color.copy(s.lightColor); sun.intensity = s.lightIntensity;
    sun.target.position.copy(W.focus); sun.target.updateMatrixWorld();
    sun.position.copy(W.focus).addScaledVector(s.sunDir, 70);
    scene.background.copy(s.skyColor); scene.fog.color.copy(s.skyColor);
    stars.material.opacity = Math.max(0, (s.night - 0.5) * 2); stars.visible = stars.material.opacity > 0.01; stars.position.copy(W.focus);
    const m = Math.floor(G.Time.hour * 60);
    if (m !== lastMin) {
      lastMin = m; hDay.textContent = 'Ngày ' + G.Time.day; hTime.textContent = G.Time.format();
      hud.setAttribute('data-phase', s.night > 0.5 ? 'night' : 'day');
    }
  }, 90);
  G.Loop.onRender(function () { if (W.camera) renderer.render(scene, W.camera); }, 100);
})(window.Game);
