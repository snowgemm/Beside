(function () {
  var G = window.Game = window.Game || {};
  var MAX = 300, AMB = 36, F = G.fx = {};
  var P, C, pa, ca, pts, T = 0, next = AMB;
  var vx = new Float32Array(MAX), vy = new Float32Array(MAX), vz = new Float32Array(MAX), life = new Float32Array(MAX), grav = new Float32Array(MAX);
  var bx = new Float32Array(AMB), by = new Float32Array(AMB), bz = new Float32Array(AMB), ph = new Float32Array(AMB), sp = new Float32Array(AMB);
  function rnd(a, b) { return a + Math.random() * (b - a); }

  F.init = function (scene) {
    var i, geo = new THREE.BufferGeometry();
    P = new Float32Array(MAX * 3); C = new Float32Array(MAX * 3);
    for (i = 0; i < MAX; i++) P[i * 3 + 1] = -1000;
    for (i = 0; i < AMB; i++) { bx[i] = 1e9; bz[i] = 1e9; ph[i] = Math.random() * 6.283; sp[i] = rnd(0.6, 1.4); }
    pa = new THREE.BufferAttribute(P, 3); ca = new THREE.BufferAttribute(C, 3);
    geo.setAttribute('position', pa); geo.setAttribute('color', ca);
    pts = new THREE.Points(geo, new THREE.PointsMaterial({ size: 0.26, sizeAttenuation: true, vertexColors: true, fog: true }));
    pts.frustumCulled = false;
    scene.add(pts);
  };
  function emit(x, y, z, ax, ay, az, g, l, r, gg, b) {
    var i = next, k = i * 3; next = next + 1 >= MAX ? AMB : next + 1;
    P[k] = x; P[k + 1] = y; P[k + 2] = z; C[k] = r; C[k + 1] = gg; C[k + 2] = b;
    vx[i] = ax; vy[i] = ay; vz[i] = az; grav[i] = g; life[i] = l;
  }
  function clr(c) { return c > 0 ? [((c >> 16) & 255) / 255, ((c >> 8) & 255) / 255, (c & 255) / 255] : null; }
  // enemy body colour (first spec part) for the death puff
  F.colorOf = function (e) {
    var s = e && e.def && e.def.spec, p = s && s.parts && s.parts[0];
    return p && typeof p.color === 'number' ? p.color : 0xaaaaaa;
  };
  // kinds: hit, death, pickup, dust, blockbreak, blockplace. color = 0xRRGGBB (optional), scale = particle count factor (optional)
  F.burst = function (x, y, z, kind, color, scale) {
    if (!pts) return;
    var c = clr(color), n, i, a, s, e, j, r, g, b, sc = scale || 1;
    if (kind === 'hit') {
      for (i = 0; i < 8; i++) { a = rnd(0, 6.283); e = rnd(-0.2, 1); s = rnd(3, 6); emit(x, y, z, Math.cos(a) * s * (1 - e * 0.4), e * s, Math.sin(a) * s * (1 - e * 0.4), 9, rnd(0.25, 0.45), 1, rnd(0.85, 1), rnd(0.4, 0.8)); }
    } else if (kind === 'death') {
      n = Math.round(14 * sc); r = c ? c[0] : 0.7; g = c ? c[1] : 0.7; b = c ? c[2] : 0.7;
      for (i = 0; i < n; i++) { a = rnd(0, 6.283); s = rnd(1.2, 3.2) * (sc > 1 ? 1.4 : 1); j = rnd(0.8, 1.15); emit(x + rnd(-0.2, 0.2), y + rnd(-0.2, 0.3), z + rnd(-0.2, 0.2), Math.cos(a) * s, rnd(0.8, 3), Math.sin(a) * s, 3, rnd(0.5, 0.9), r * j, g * j, b * j); }
    } else if (kind === 'pickup') {
      for (i = 0; i < 10; i++) { j = rnd(0, 1); emit(x + rnd(-0.3, 0.3), y + rnd(-0.2, 0.2), z + rnd(-0.3, 0.3), rnd(-0.5, 0.5), rnd(1.5, 3), rnd(-0.5, 0.5), -1.5, rnd(0.7, 1.1), 1, 0.85 + j * 0.15, 0.35 + j * 0.6); }
    } else if (kind === 'dust') {
      r = c ? 0.65 * c[0] + 0.35 : 0.78; g = c ? 0.65 * c[1] + 0.35 : 0.74; b = c ? 0.65 * c[2] + 0.35 : 0.66;
      for (i = 0; i < 3; i++) { j = rnd(0.9, 1.1); emit(x + rnd(-0.2, 0.2), y, z + rnd(-0.2, 0.2), rnd(-0.9, 0.9), rnd(0.6, 1.2), rnd(-0.9, 0.9), 2.5, rnd(0.3, 0.5), r * j, g * j, b * j); }
    } else if (kind === 'blockbreak' || kind === 'blockplace') {
      var brk = kind === 'blockbreak'; n = brk ? 12 : 6; r = c ? c[0] : 0.5; g = c ? c[1] : 0.45; b = c ? c[2] : 0.4;
      for (i = 0; i < n; i++) { a = rnd(0, 6.283); s = brk ? rnd(1.5, 4) : rnd(0.8, 1.8); j = rnd(0.75, 1.1); emit(x + rnd(-0.4, 0.4), y + rnd(-0.3, 0.3), z + rnd(-0.4, 0.4), Math.cos(a) * s, brk ? rnd(2, 4) : rnd(1, 2), Math.sin(a) * s, brk ? 14 : 12, brk ? rnd(0.5, 0.9) : rnd(0.35, 0.55), r * j, g * j, b * j); }
    }
  };
  F.update = function (dt, px, py, pz) {
    if (!pts) return;
    T += dt;
    var D = G.dungeon, inD = D && D.active, W = G.world, night = G.sky ? G.sky.night : 0, i, k, h, dx, dz, bl;
    for (i = 0; i < AMB; i++) { // ambient: pollen by day, fireflies at night
      k = i * 3;
      if (inD || (night < 0.3 && (i & 1))) { P[k + 1] = -1000; continue; }
      dx = bx[i] - px; dz = bz[i] - pz;
      if (dx * dx + dz * dz > 196) {
        bx[i] = px + rnd(-12, 12); bz[i] = pz + rnd(-12, 12);
        h = W.ow.getHeight(bx[i], bz[i]); if (h < W.SEA) h = W.SEA;
        by[i] = h + 0.5 + rnd(0, 2.2);
      }
      P[k] = bx[i] + Math.sin(T * 0.5 * sp[i] + ph[i]) * 1.3;
      P[k + 1] = by[i] + Math.sin(T * 0.9 * sp[i] + ph[i] * 2) * 0.4;
      P[k + 2] = bz[i] + Math.cos(T * 0.45 * sp[i] + ph[i]) * 1.3;
      bl = 0.25 + 0.75 * Math.max(0, Math.sin(T * 2.2 * sp[i] + ph[i] * 3));
      C[k] = (1 - night) + night * 0.8 * bl; C[k + 1] = (1 - night) * 0.96 + night * bl; C[k + 2] = (1 - night) * 0.7 + night * 0.25 * bl;
    }
    if (dt > 0) for (i = AMB; i < MAX; i++) {
      if (life[i] <= 0) continue;
      life[i] -= dt; k = i * 3;
      if (life[i] <= 0) { P[k + 1] = -1000; continue; }
      vy[i] -= grav[i] * dt;
      P[k] += vx[i] * dt; P[k + 1] += vy[i] * dt; P[k + 2] += vz[i] * dt;
    }
    pa.needsUpdate = true; ca.needsUpdate = true;
  };
})();
