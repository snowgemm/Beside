/* player.js - character model, input (touch + desktop), tile collision, follow camera, tile highlights */
(function (G) {
  'use strict';
  const W = G.World, TS = W.TS, SPEED = 5.4, RAD = 0.42;
  const clamp = function (v, a, b) { return Math.max(a, Math.min(b, v)); };
  const P = G.Player = { tx: 20, tz: 34, facing: { dx: 0, dz: -1 }, pos: new THREE.Vector3(), model: null, camera: null, moving: 0, hover: null };
  const SPAWN = { x: 20.5 * TS, z: 34.5 * TS };
  const prev = new THREE.Vector3(), vis = new THREE.Vector3(), camT = new THREE.Vector3();
  let yaw = 0, yawT = 0, modelY = 0, snap = true, zoom = 15, zoomC = 15;
  const ZMIN = 9, ZMAX = 28, PITCH = Math.PI / 4;

  // ---------- character model (reusable for remote players) ----------
  P.createModel = function (color, name) {
    const g = new THREE.Group(), rig = new THREE.Group(); g.add(rig);
    const L = function (c) { return new THREE.MeshLambertMaterial({ color: c }); };
    const skin = L(0xf2c9a0), shirt = L(color), pants = L(0x3b4f6b), hair = L(0x2b2118), straw = L(0xe8cf8a), dark = L(0x2b2118);
    const mesh = function (geo, m, x, y, z, parent) { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); (parent || rig).add(o); return o; };
    const box = function (w, h, d, dy) { const b = new THREE.BoxGeometry(w, h, d); b.translate(0, dy || 0, 0); return b; };
    mesh(box(0.62, 0.7, 0.4, 0), shirt, 0, 1.1, 0);
    const legs = [], arms = [];
    [-1, 1].forEach(function (s) {
      const lp = new THREE.Group(); lp.position.set(s * 0.16, 0.75, 0); rig.add(lp);
      mesh(box(0.22, 0.75, 0.24, -0.375), pants, 0, 0, 0, lp); legs.push(lp);
      const ap = new THREE.Group(); ap.position.set(s * 0.4, 1.4, 0); rig.add(ap);
      mesh(box(0.17, 0.6, 0.2, -0.3), shirt, 0, 0, 0, ap); mesh(box(0.15, 0.15, 0.18, -0.68), skin, 0, 0, 0, ap); arms.push(ap);
      mesh(box(0.06, 0.08, 0.04, 0), dark, s * 0.1, 1.72, 0.3);
    });
    mesh(G.Util.flat(new THREE.IcosahedronGeometry(0.3, 1)), skin, 0, 1.72, 0);
    mesh(G.Util.flat(new THREE.IcosahedronGeometry(0.31, 1)), hair, 0, 1.8, -0.07).scale.set(1, 0.7, 1);
    mesh(G.Util.flat(new THREE.ConeGeometry(0.8, 0.5, 14)), straw, 0, 2.1, 0);        // nón lá
    mesh(G.Util.flat(new THREE.IcosahedronGeometry(0.07, 0)), L(0xb8935a), 0, 2.36, 0);
    // name label
    const cv = document.createElement('canvas'); cv.width = 256; cv.height = 64;
    const c = cv.getContext('2d'), r = 32;
    c.fillStyle = 'rgba(255,243,214,.92)'; c.beginPath(); c.arc(r, r, r, Math.PI / 2, Math.PI * 1.5); c.arc(256 - r, r, r, Math.PI * 1.5, Math.PI / 2); c.closePath(); c.fill();
    c.fillStyle = '#4a3326'; c.font = '700 34px system-ui,"Segoe UI",sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(name || '', 128, 34);
    const label = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(cv), transparent: true, depthTest: false }));
    label.scale.set(2.2, 0.55, 1); label.position.set(0, 2.85, 0); label.renderOrder = 10; g.add(label);
    g.traverse(function (o) { if (o.isMesh) o.castShadow = true; });
    const u = g.userData; u.label = label; u.phase = 0; u.amp = 0;
    // speed 0..1; call every frame
    u.walk = function (speed, dt) {
      u.amp += (speed - u.amp) * Math.min(1, dt * 10);
      if (u.amp > 0.02) u.phase += dt * (9 + 4 * u.amp);
      const s = Math.sin(u.phase) * 0.8 * u.amp;
      legs[0].rotation.x = s; legs[1].rotation.x = -s; arms[0].rotation.x = -s * 0.9; arms[1].rotation.x = s * 0.9;
      rig.position.y = Math.abs(Math.sin(u.phase)) * 0.07 * u.amp;
    };
    return g;
  };

  P.model = P.createModel(0xe8745a, 'Bạn');
  P.model.userData.label.visible = false;
  P.model.scale.setScalar(0.95);
  W.add(P.model);

  // ---------- tile highlights ----------
  function hl(color, op) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(TS * 0.92, TS * 0.92).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: color, transparent: true, opacity: op, depthWrite: false }));
    m.renderOrder = 2; m.visible = false; W.add(m); return m;
  }
  const faceHL = hl(0xfff0b0, 0.45), hoverHL = hl(0xbfe9ff, 0.3);

  // ---------- camera ----------
  const cam = new THREE.PerspectiveCamera(38, window.innerWidth / window.innerHeight, 0.5, 400);
  P.camera = cam; W.camera = cam;
  G.Events.on('resize', function (e) { cam.aspect = e.w / e.h; cam.updateProjectionMatrix(); });

  // ---------- input ----------
  const keys = new Set(), joy = { id: null, x: 0, z: 0 }, hover = { on: false, x: 0, y: 0 }, pts = new Map();
  let pinch = 0;
  const joyEl = document.getElementById('joy'), knob = document.getElementById('joy-knob'), actEl = document.getElementById('act');
  const gameEl = document.getElementById('game');
  if ('ontouchstart' in window || navigator.maxTouchPoints > 0) document.body.classList.add('touch');

  const MOVE = { KeyW: 'u', ArrowUp: 'u', KeyS: 'd', ArrowDown: 'd', KeyA: 'l', ArrowLeft: 'l', KeyD: 'r', ArrowRight: 'r' };
  window.addEventListener('keydown', function (e) {
    if (MOVE[e.code]) { keys.add(MOVE[e.code]); e.preventDefault(); }
    else if ((e.code === 'KeyE' || e.code === 'Space') && !e.repeat) { interact(); e.preventDefault(); }
  });
  window.addEventListener('keyup', function (e) { if (MOVE[e.code]) keys.delete(MOVE[e.code]); });
  window.addEventListener('blur', function () { keys.clear(); });

  function pdist() { const a = Array.from(pts.values()); return Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y) || 1; }
  function joyEnd() {
    joy.id = null; joy.x = joy.z = 0; joyEl.classList.remove('on');
    joyEl.style.left = joyEl.style.top = joyEl.style.bottom = ''; knob.style.transform = '';
  }
  gameEl.addEventListener('pointerdown', function (e) {
    if (e.pointerType === 'mouse') { hover.on = true; hover.x = e.clientX; hover.y = e.clientY; return; }
    document.body.classList.add('touch'); hover.on = false;
    if (joy.id === null && e.clientX < window.innerWidth * 0.5) {
      const r = joyEl.offsetWidth / 2;
      joy.id = e.pointerId; joy.ox = e.clientX; joy.oy = e.clientY; joy.r = r;
      joyEl.style.left = (e.clientX - r) + 'px'; joyEl.style.top = (e.clientY - r) + 'px'; joyEl.style.bottom = 'auto';
      joyEl.classList.add('on');
    } else { pts.set(e.pointerId, { x: e.clientX, y: e.clientY }); if (pts.size === 2) pinch = pdist(); }
    try { gameEl.setPointerCapture(e.pointerId); } catch (_) { /* ignore */ }
  });
  gameEl.addEventListener('pointermove', function (e) {
    if (e.pointerType === 'mouse') { hover.on = true; hover.x = e.clientX; hover.y = e.clientY; return; }
    if (e.pointerId === joy.id) {
      let dx = e.clientX - joy.ox, dy = e.clientY - joy.oy; const len = Math.hypot(dx, dy), r = joy.r;
      if (len > r) { dx *= r / len; dy *= r / len; }
      knob.style.transform = 'translate(' + dx + 'px,' + dy + 'px)';
      const m = Math.min(1, len / r);
      if (m < 0.12) { joy.x = joy.z = 0; } else { const k = (m - 0.12) / 0.88 / (len || 1); joy.x = (e.clientX - joy.ox) * k; joy.z = (e.clientY - joy.oy) * k; }
    } else if (pts.has(e.pointerId)) {
      const p = pts.get(e.pointerId); p.x = e.clientX; p.y = e.clientY;
      if (pts.size === 2) { const d = pdist(); if (pinch > 0) zoom = clamp(zoom * pinch / d, ZMIN, ZMAX); pinch = d; }
    }
  });
  function up(e) { if (e.pointerId === joy.id) joyEnd(); pts.delete(e.pointerId); pinch = 0; }
  gameEl.addEventListener('pointerup', up); gameEl.addEventListener('pointercancel', up);
  gameEl.addEventListener('pointerleave', function (e) { if (e.pointerType === 'mouse') hover.on = false; });
  gameEl.addEventListener('wheel', function (e) {
    e.preventDefault(); zoom = clamp(zoom * Math.exp(e.deltaY * (e.deltaMode === 1 ? 16 : 1) * 0.0012), ZMIN, ZMAX);
  }, { passive: false });
  actEl.addEventListener('pointerdown', function (e) { e.preventDefault(); interact(); });

  // ---------- interaction ----------
  const FD = { n: [0, -1], s: [0, 1], e: [1, 0], w: [-1, 0] };
  function interact() {
    const f = W.facingTile(P); let hit = null;
    for (const o of W.interactables) {
      if (o.tx !== f.tx || o.tz !== f.tz) continue;
      const d = o.facing && FD[o.facing];
      if (d && (P.facing.dx !== -d[0] || P.facing.dz !== -d[1])) continue; // must face the object's front
      hit = o; break;
    }
    G.Events.emit('player:interact', { tx: f.tx, tz: f.tz, id: hit ? hit.id : null, target: hit });
  }

  // ---------- movement (fixed step, tile collision) ----------
  function blockedAt(x, z) {
    const x0 = Math.floor((x - RAD) / TS), x1 = Math.floor((x + RAD) / TS), z0 = Math.floor((z - RAD) / TS), z1 = Math.floor((z + RAD) / TS);
    for (let tz = z0; tz <= z1; tz++) for (let tx = x0; tx <= x1; tx++) if (W.isBlocked(tx, tz)) return true;
    return false;
  }
  G.Loop.onUpdate(function (dt) {
    prev.copy(P.pos);
    let ix = (keys.has('r') ? 1 : 0) - (keys.has('l') ? 1 : 0) + joy.x, iz = (keys.has('d') ? 1 : 0) - (keys.has('u') ? 1 : 0) + joy.z;
    let len = Math.hypot(ix, iz);
    if (len > 1) { ix /= len; iz /= len; len = 1; }
    P.moving = len > 0.05 ? len : 0;
    if (P.moving) {
      const vx = ix * SPEED * dt, vz = iz * SPEED * dt;
      if (!blockedAt(P.pos.x + vx, P.pos.z)) P.pos.x += vx;
      if (!blockedAt(P.pos.x, P.pos.z + vz)) P.pos.z += vz;
      yawT = Math.atan2(ix, iz);
      const ax = Math.abs(ix), az = Math.abs(iz);
      if (ax > az) P.facing = { dx: ix > 0 ? 1 : -1, dz: 0 }; else if (az > ax) P.facing = { dx: 0, dz: iz > 0 ? 1 : -1 };
    }
    P.tx = Math.floor(P.pos.x / TS); P.tz = Math.floor(P.pos.z / TS);
  });

  // ---------- render (view only) ----------
  const ndc = new THREE.Vector2(), ray = new THREE.Raycaster(), plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), hp = new THREE.Vector3();
  G.Loop.onRender(function (alpha, dt) {
    vis.lerpVectors(prev, P.pos, alpha);
    modelY += (W.groundY(P.tx, P.tz) - modelY) * Math.min(1, dt * 14);
    const m = P.model; m.position.set(vis.x, modelY, vis.z);
    let d = yawT - yaw; d = Math.atan2(Math.sin(d), Math.cos(d)); yaw += d * Math.min(1, dt * 14); m.rotation.y = yaw;
    m.userData.walk(P.moving, dt);

    if (snap) { camT.copy(vis); zoomC = zoom; snap = false; }
    const k = 1 - Math.exp(-dt * 7);
    camT.x += (vis.x - camT.x) * k; camT.z += (vis.z - camT.z) * k;
    zoomC += (zoom - zoomC) * (1 - Math.exp(-dt * 9));
    const dist = zoomC * (cam.aspect < 1.5 ? Math.min(1.9, 1.5 / cam.aspect) : 1);
    cam.position.set(camT.x, Math.sin(PITCH) * dist + 0.6, camT.z + Math.cos(PITCH) * dist);
    cam.lookAt(camT.x, 0.6, camT.z);
    W.focus.set(camT.x, 0, camT.z);

    const t = performance.now() / 1000, f = W.facingTile(P);
    if (f.tx >= 0 && f.tz >= 0 && f.tx < W.N && f.tz < W.N) {
      faceHL.position.set((f.tx + 0.5) * TS, 0.07 + W.groundY(f.tx, f.tz), (f.tz + 0.5) * TS);
      faceHL.material.opacity = 0.35 + 0.15 * Math.sin(t * 4); faceHL.visible = true;
    } else faceHL.visible = false;

    P.hover = null; hoverHL.visible = false;
    if (hover.on) {
      ndc.set(hover.x / window.innerWidth * 2 - 1, -(hover.y / window.innerHeight) * 2 + 1);
      ray.setFromCamera(ndc, cam);
      if (ray.ray.intersectPlane(plane, hp)) {
        const tx = Math.floor(hp.x / TS), tz = Math.floor(hp.z / TS);
        if (tx >= 0 && tz >= 0 && tx < W.N && tz < W.N) {
          P.hover = { tx: tx, tz: tz };
          hoverHL.position.set((tx + 0.5) * TS, 0.06 + W.groundY(tx, tz), (tz + 0.5) * TS); hoverHL.visible = true;
        }
      }
    }
  }, 50);

  // ---------- save / identity ----------
  function spawn() {
    P.pos.set(SPAWN.x, 0, SPAWN.z); prev.copy(P.pos); P.facing = { dx: 0, dz: -1 }; yawT = yaw = Math.PI;
    P.tx = Math.floor(P.pos.x / TS); P.tz = Math.floor(P.pos.z / TS); snap = true;
  }
  P.save = function () { return { x: +P.pos.x.toFixed(2), z: +P.pos.z.toFixed(2), f: [P.facing.dx, P.facing.dz] }; };
  P.load = function (d) {
    spawn();
    if (!d || !isFinite(d.x) || !isFinite(d.z) || blockedAt(d.x, d.z)) return;
    P.pos.set(d.x, 0, d.z); prev.copy(P.pos);
    if (d.f) P.facing = { dx: d.f[0] | 0, dz: d.f[1] | 0 };
    yawT = yaw = Math.atan2(P.facing.dx, P.facing.dz);
    P.tx = Math.floor(P.pos.x / TS); P.tz = Math.floor(P.pos.z / TS);
  };
  P.reset = spawn;
  spawn();
  G.Players.add(G.Net.playerId, P);
  G.Save.register('player', P, 'player');
})(window.Game);
