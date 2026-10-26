(function () {
  var G = window.Game = window.Game || {};
  var S = G.sky = { t: 0.3, night: 0 }; // t: 0 midnight, .25 sunrise, .5 noon, .75 sunset; one cycle = 600 s
  var DAY = 600, scene, cam, dome, domeA, domeK, sun, moon, stars, starMat, clouds, cloudMat, off = false, acc = 9, drift = 0;
  function hx(c) { return [((c >> 16) & 255) / 255, ((c >> 8) & 255) / 255, (c & 255) / 255]; }
  var K = [ // tint is the terrain multiplier (never below ~.5)
    { t: 0, top: hx(0x0a1030), hor: hx(0x1c2850), fog: hx(0x1c2850), tint: [.5, .55, .78] },
    { t: .19, top: hx(0x0a1030), hor: hx(0x1c2850), fog: hx(0x1c2850), tint: [.5, .55, .78] },
    { t: .25, top: hx(0x5a7fc0), hor: hx(0xffa070), fog: hx(0xf0b898), tint: [1, .86, .78] },
    { t: .33, top: hx(0x3f8fe8), hor: hx(0xa8d4ff), fog: hx(0xa8d4ff), tint: [1, 1, 1] },
    { t: .67, top: hx(0x3f8fe8), hor: hx(0xa8d4ff), fog: hx(0xa8d4ff), tint: [1, 1, 1] },
    { t: .75, top: hx(0x3d4a8c), hor: hx(0xff7a48), fog: hx(0xe89068), tint: [1, .8, .7] },
    { t: .82, top: hx(0x0a1030), hor: hx(0x1c2850), fog: hx(0x1c2850), tint: [.5, .55, .78] },
    { t: 1, top: hx(0x0a1030), hor: hx(0x1c2850), fog: hx(0x1c2850), tint: [.5, .55, .78] }
  ];
  var cTop = [0, 0, 0], cHor = [0, 0, 0], cFog = [0, 0, 0], cTint = [0, 0, 0];
  function mix(o, a, b, s) { o[0] = a[0] + (b[0] - a[0]) * s; o[1] = a[1] + (b[1] - a[1]) * s; o[2] = a[2] + (b[2] - a[2]) * s; }
  function sample(t) {
    var i = 0, a, b, s;
    while (i < K.length - 2 && t >= K[i + 1].t) i++;
    a = K[i]; b = K[i + 1]; s = (t - a.t) / (b.t - a.t); s = s * s * (3 - 2 * s);
    mix(cTop, a.top, b.top, s); mix(cHor, a.hor, b.hor, s); mix(cFog, a.fog, b.fog, s); mix(cTint, a.tint, b.tint, s);
  }
  function box6(P, C, I, cx, cy, cz, sx, sy, sz, sh) { // cloud box, all 6 faces
    var x0 = cx - sx / 2, x1 = cx + sx / 2, y0 = cy - sy / 2, y1 = cy + sy / 2, z0 = cz - sz / 2, z1 = cz + sz / 2, b = P.length / 3, k, q;
    var F = [
      [x0, y1, z0, x0, y1, z1, x1, y1, z1, x1, y1, z0, 1],
      [x1, y0, z1, x1, y0, z0, x1, y1, z0, x1, y1, z1, .88],
      [x0, y0, z0, x0, y0, z1, x0, y1, z1, x0, y1, z0, .8],
      [x0, y0, z1, x1, y0, z1, x1, y1, z1, x0, y1, z1, .92],
      [x1, y0, z0, x0, y0, z0, x0, y1, z0, x1, y1, z0, .84],
      [x0, y0, z0, x1, y0, z0, x1, y0, z1, x0, y0, z1, .74]
    ];
    for (k = 0; k < 6; k++) {
      for (q = 0; q < 4; q++) { P.push(F[k][q * 3], F[k][q * 3 + 1], F[k][q * 3 + 2]); C.push(F[k][12], F[k][12], F[k][12]); }
      I.push(b + k * 4, b + k * 4 + 1, b + k * 4 + 2, b + k * 4, b + k * 4 + 2, b + k * 4 + 3);
    }
  }

  S.init = function (sc, camera) {
    scene = sc; cam = camera;
    var i, j, g, dm;
    // dome with vertex-colour gradient (fog off, never writes depth)
    g = new THREE.SphereGeometry(400, 16, 12);
    var pa = g.attributes.position, n = pa.count;
    domeK = new Float32Array(n);
    for (i = 0; i < n; i++) { var ny = pa.getY(i) / 400; domeK[i] = ny > 0 ? Math.pow(ny, 0.55) : 0; }
    domeA = new THREE.BufferAttribute(new Float32Array(n * 3), 3);
    g.setAttribute('color', domeA);
    dome = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false }));
    dome.renderOrder = -10; dome.frustumCulled = false; scene.add(dome);
    // sun and moon (chunky boxes)
    sun = new THREE.Mesh(new THREE.BoxGeometry(36, 36, 8), new THREE.MeshBasicMaterial({ color: 0xfff2a0, fog: false, depthTest: false, depthWrite: false }));
    moon = new THREE.Mesh(new THREE.BoxGeometry(24, 24, 6), new THREE.MeshBasicMaterial({ color: 0xdfe8ff, fog: false, depthTest: false, depthWrite: false }));
    sun.renderOrder = moon.renderOrder = -9; sun.frustumCulled = moon.frustumCulled = false;
    sun.rotation.set(0.5, 0.7, 0.3); moon.rotation.set(0.3, 0.5, 0.2);
    scene.add(sun); scene.add(moon);
    // stars (deterministic)
    var sp = new Float32Array(160 * 3);
    for (i = 0; i < 160; i++) {
      var u = Math.sin(i * 12.9898) * 43758.5453, v = Math.sin(i * 78.233 + 1.7) * 12345.678;
      u -= Math.floor(u); v -= Math.floor(v);
      var y = 0.08 + v * 0.92, r = Math.sqrt(1 - y * y), a = u * 6.2832;
      sp[i * 3] = Math.cos(a) * r * 380; sp[i * 3 + 1] = y * 380; sp[i * 3 + 2] = Math.sin(a) * r * 380;
    }
    var sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(sp, 3));
    starMat = new THREE.PointsMaterial({ color: 0xffffff, size: 2, sizeAttenuation: false, transparent: true, opacity: 0, fog: false, depthWrite: false });
    stars = new THREE.Points(sg, starMat); stars.frustumCulled = false; stars.renderOrder = -8; scene.add(stars);
    // voxel clouds: 4 base clouds repeated on a 5x5 grid of 400-block tiles, one merged mesh
    var P = [], C = [], I = [], seed = 7, rd = function () { seed = (Math.imul(seed, 1103515245) + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
    var base = [];
    for (i = 0; i < 4; i++) base.push({ x: rd() * 340 - 170, z: rd() * 340 - 170, y: 82 + rd() * 14, w: 22 + rd() * 14, d: 14 + rd() * 8 });
    for (i = -2; i <= 2; i++) for (j = -2; j <= 2; j++) base.forEach(function (c) {
      var x = c.x + i * 400, z = c.z + j * 400;
      box6(P, C, I, x, c.y, z, c.w, 5, c.d, 1);
      box6(P, C, I, x - c.w * 0.18, c.y + 4, z + 1, c.w * 0.5, 4, c.d * 0.6, 1);
      box6(P, C, I, x + c.w * 0.4, c.y - 0.8, z - c.d * 0.2, c.w * 0.4, 3.5, c.d * 0.7, 1);
    });
    var cg = new THREE.BufferGeometry();
    cg.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); cg.setAttribute('color', new THREE.Float32BufferAttribute(C, 3)); cg.setIndex(I);
    cloudMat = new THREE.MeshBasicMaterial({ vertexColors: true, fog: false });
    clouds = new THREE.Mesh(cg, cloudMat); clouds.frustumCulled = false; scene.add(clouds);
    acc = 9;
  };
  function vis(on) { dome.visible = stars.visible = clouds.visible = on; if (!on) sun.visible = moon.visible = false; }
  S.update = function (dt) {
    if (!dome) return;
    var D = G.dungeon;
    if (D && D.active) { if (!off) { off = true; vis(false); } return; } // dungeons keep their own look
    if (off) { off = false; vis(true); acc = 9; }
    S.t = (S.t + dt / DAY) % 1; if (!(S.t >= 0)) S.t = 0.3;
    sample(S.t);
    var a = (S.t - 0.25) * 6.2831853, sy = Math.sin(a), sx = Math.cos(a), c = cam.position, i, k, W = G.world;
    S.night = Math.max(0, Math.min(1, 0.5 - sy * 2.5));
    W.tint(cTint[0], cTint[1], cTint[2]);
    if (scene.fog) scene.fog.color.setRGB(cFog[0], cFog[1], cFog[2]);
    if (scene.background && scene.background.setRGB) scene.background.setRGB(cFog[0], cFog[1], cFog[2]);
    dome.position.copy(c); stars.position.copy(c); stars.rotation.z = S.t * 6.2832;
    var l = Math.sqrt(sx * sx + sy * sy + 0.05) / 350;
    sun.position.set(c.x + sx / l, c.y + sy / l, c.z + 0.22 / l);
    moon.position.set(c.x - sx / l, c.y - sy / l, c.z - 0.22 / l);
    sun.visible = sy > -0.15; moon.visible = sy < 0.15;
    k = Math.max(0, Math.min(1, sy * 3));
    sun.material.color.setRGB(1, 0.6 + 0.35 * k, 0.25 + 0.5 * k);
    starMat.opacity = S.night * 0.9; stars.visible = S.night > 0.02;
    cloudMat.color.setRGB(Math.min(1, cTint[0] * 1.08), Math.min(1, cTint[1] * 1.08), Math.min(1, cTint[2] * 1.08));
    drift += dt * 2;
    clouds.position.set(Math.round(c.x / 400) * 400 + (((drift + 200) % 400) - 200), 0, Math.round(c.z / 400) * 400);
    acc += dt;
    if (acc >= 0.2) { // recolour dome gradient (throttled)
      acc = 0;
      var arr = domeA.array, n = domeK.length, kk;
      for (i = 0; i < n; i++) {
        kk = domeK[i];
        arr[i * 3] = cHor[0] + (cTop[0] - cHor[0]) * kk; arr[i * 3 + 1] = cHor[1] + (cTop[1] - cHor[1]) * kk; arr[i * 3 + 2] = cHor[2] + (cTop[2] - cHor[2]) * kk;
      }
      domeA.needsUpdate = true;
    }
  };
  G.save.register('daytime', function () { return Math.round(S.t * 100000) / 100000; }, function (v) { if (typeof v === 'number' && isFinite(v)) S.t = ((v % 1) + 1) % 1; });
})();
