/* fishing.js - Stage 2B: fishing. Rod handler (Game.Actions), cast -> wait -> bite -> reel minigame -> catch, fish log (save key 'fishlog').
   Logic + 3D (bobber, line, ripples, "!") live here; the overlay DOM and the log panel are in ui.js and read Game.Fishing.view().
   Events (all carry `by`): 'fish:cast' {tx,tz}, 'fish:bite' {tx,tz}, 'fish:caught' {id,length[,junk]}, 'fish:escaped' {reason}.
   Loaded after ui.js (needs Game.Actions). */
(function (G) {
  'use strict';
  const W = G.World, P = G.Player, Inv = G.Inventory, St = G.State, E = G.Events, T = W.T, TS = W.TS;
  const TAU = Math.PI * 2;
  const COST = 2, WAIT = [2, 6], FLIGHT = 0.4, BITE_WINDOW = 1.2, REEL_TIME = 3.2, RESULT_AUTO = 4.5, RESULT_LOCK = 0.6, END_TIME = 1.3;
  const WATER_Y = -0.1;

  // ---------- species ----------
  // len = cm range; zone = reel difficulty: h zone height (0-1 of the bar), f zone speed (cycles/s), a sway amplitude, need = seconds in zone to land it
  const ORDER = ['fish_ro', 'fish_chep', 'fish_tre', 'fish_loc', 'fish_dieu'];
  const JUNK = ['junk_shoe', 'junk_weed'];
  const FISH = {
    fish_ro:   { len: [8, 16],  zone: { h: 0.34, f: 0.26, a: 0.25, need: 0.9 } },
    fish_chep: { len: [25, 55], zone: { h: 0.32, f: 0.28, a: 0.26, need: 1.0 } },
    fish_tre:  { len: [25, 45], zone: { h: 0.28, f: 0.32, a: 0.27, need: 1.0 } },
    fish_loc:  { len: [35, 80], zone: { h: 0.24, f: 0.36, a: 0.28, need: 1.1 } },
    fish_dieu: { len: [30, 60], zone: { h: 0.20, f: 0.42, a: 0.28, need: 1.2 } }
  };
  const JUNK_ZONE = { h: 0.5, f: 0.15, a: 0.15, need: 0.6 };

  // Odds: junk 12%, cá diêu hồng 4% (flat), the rest weighted by time of day.
  function weights(h) {
    const w = { fish_ro: 35, fish_chep: 28, fish_tre: 22, fish_loc: 15 };
    if (h >= 5 && h < 11) w.fish_chep *= 2;                                   // morning: more cá chép
    if (h >= 17 || h < 5) { w.fish_loc *= 2.4; w.fish_ro *= 0.85; }          // dusk and night: more cá lóc
    else if (h >= 11) w.fish_loc *= 0.7;
    return w;
  }
  function roll(rng, hour) {
    const r = rng();
    if (r < 0.12) return rng() < 0.55 ? 'junk_weed' : 'junk_shoe';
    if (r < 0.16) return 'fish_dieu';
    const w = weights(hour), ks = Object.keys(w); let sum = 0;
    ks.forEach(function (k) { sum += w[k]; });
    let x = rng() * sum;
    for (const k of ks) { x -= w[k]; if (x < 0) return k; }
    return ks[0];
  }
  function rollLength(rng, id) {
    const L = FISH[id].len; return Math.round(L[0] + (L[1] - L[0]) * (rng() + rng()) / 2);
  }

  // ---------- fish log (save key 'fishlog', scope 'player') ----------
  const log = {}; let casts = 0;
  const Log = {
    save: function () {
      const f = {}; Object.keys(log).forEach(function (k) { f[k] = [log[k].n, log[k].best]; });
      return { c: casts, f: f };
    },
    load: function (d) {
      Log.reset(); d = d || {};
      casts = isFinite(d.c) ? Math.max(0, d.c | 0) : 0;
      ORDER.forEach(function (id) {
        const s = d.f && d.f[id];
        if (s && s[0] > 0) log[id] = { n: s[0] | 0, best: Math.max(0, +s[1] || 0) };
      });
    },
    reset: function () { Object.keys(log).forEach(function (k) { delete log[k]; }); casts = 0; }
  };
  G.Save.register('fishlog', Log, 'player');

  // ---------- state ----------
  let phase = 'idle', t = 0, rng = null, plan = null, cast = null, reel = null, result = null, endMsg = '', clock = 0, landed = false;
  let btnDown = false, keyDown = false;
  const isHeld = function () { return btnDown || keyDown; };
  const isWater = function (tx, tz) { return W.isPond(tx, tz) && W.tileAt(tx, tz) === T.WATER; };
  const deny = function (reason, text) { E.emit('farm:denied', { reason: reason, text: text }); return false; };
  const sfx = function (n) { if (G.Sfx) G.Sfx.play(n); };
  const me = function () { return G.Net.playerId; };

  function bagOk() {
    for (const id of ORDER.concat(JUNK)) if (Inv.room(id) > 0) return true;
    return false;
  }

  function startCast(tx, tz) {
    if (!isWater(tx, tz)) return false;
    if (!bagOk()) return deny('bag_full', 'Túi đồ đã đầy');
    if (!St.useEnergy(COST)) return deny('energy', 'Không đủ năng lượng');
    casts++;
    rng = G.Rand.make(((G.Time.day * 2654435761) + Math.imul(casts, 0x9E3779B1) + 4242) >>> 0);
    cast = { tx: tx, tz: tz, ptx: P.tx, ptz: P.tz, fdx: P.facing.dx, fdz: P.facing.dz,
      x: (tx + 0.5) * TS + (rng() - 0.5) * 0.8, z: (tz + 0.5) * TS + (rng() - 0.5) * 0.8,
      wait: WAIT[0] + rng() * (WAIT[1] - WAIT[0]) };
    phase = 'cast'; t = 0; landed = false; plan = null; reel = null; result = null;
    document.body.classList.add('fishing');
    E.emit('fish:cast', { tx: tx, tz: tz, by: me() });
    G.Save.save();
    return true;
  }

  function idle() {
    phase = 'idle'; t = 0; cast = null; reel = null; plan = null; result = null;
    document.body.classList.remove('fishing');
  }
  // Cancel before anything was caught: no penalty (energy is given back).
  function cancel() {
    if (phase === 'idle') return;
    if (phase === 'cast' || phase === 'wait' || phase === 'bite' || phase === 'reel') St.setEnergy(St.energy + COST);
    idle();
  }
  function escaped(reason) {
    E.emit('fish:escaped', { reason: reason, by: me() });
    phase = 'end'; t = 0; reel = null;
    endMsg = reason === 'late' ? 'Chậm quá, cá chạy mất rồi!' : 'Cá thoát mất rồi!';
  }

  function hook() {
    const junk = JUNK.indexOf(plan) >= 0;
    const z = junk ? JUNK_ZONE : FISH[plan].zone;
    phase = 'reel'; t = 0;
    reel = { cfg: z, m: 0.5, v: 0, p: 0, ph: (rng() - 0.5), ph2: rng() * TAU, tick: 0, c: 0.5, inZone: false };
    reel.c = zoneAt(reel, 0);
  }
  function zoneAt(r, time) {
    const z = r.cfg;
    const c = 0.5 + z.a * Math.sin(TAU * z.f * time + r.ph) + z.a * 0.35 * Math.sin(TAU * z.f * 1.9 * time + r.ph2);
    return Math.max(z.h / 2, Math.min(1 - z.h / 2, c));
  }

  function land() {
    const junk = JUNK.indexOf(plan) >= 0, length = junk ? 0 : rollLength(rng, plan);
    if (Inv.add(plan, 1) < 1) { deny('bag_full', 'Túi đồ đã đầy'); escaped('bag'); return; }
    let first = false, record = false;
    if (!junk) {
      const o = log[plan] || (log[plan] = { n: 0, best: 0 });
      first = o.n === 0; record = !first && length > o.best;
      o.n++; if (length > o.best) o.best = length;
    }
    result = { id: plan, length: length, junk: junk, first: first, record: record };
    phase = 'result'; t = 0; reel = null;
    const ev = { id: plan, length: length, by: me() }; if (junk) ev.junk = true;
    E.emit('fish:caught', ev);
    G.Save.save();
  }

  // Press on the action button / Space / E while the overlay is up
  function press() {
    if (phase === 'bite') hook();
    else if (phase === 'result' && t > RESULT_LOCK) idle();
  }

  G.Loop.onUpdate(function (dt) {
    clock += dt;
    if (phase === 'idle') return;
    // moving away (or turning to another tile), sleeping: cancel
    if (P.tx !== cast.ptx || P.tz !== cast.ptz || P.facing.dx !== cast.fdx || P.facing.dz !== cast.fdz || (G.Farm && G.Farm.sleeping())) { cancel(); return; }
    t += dt;
    if (phase === 'cast') {
      if (!landed && t >= FLIGHT) { landed = true; sfx('splash'); }
      if (t >= FLIGHT) { phase = 'wait'; t = 0; }
    } else if (phase === 'wait') {
      if (t >= cast.wait) {
        plan = roll(rng, G.Time.hour);
        phase = 'bite'; t = 0;
        E.emit('fish:bite', { tx: cast.tx, tz: cast.tz, by: me() });
      }
    } else if (phase === 'bite') {
      if (t >= BITE_WINDOW) escaped('late');
    } else if (phase === 'reel') {
      const r = reel, held = isHeld();
      r.v += (held ? 7 : -6) * dt;
      r.v = Math.max(-1.8, Math.min(1.8, r.v));
      r.m += r.v * dt;
      if (r.m <= 0) { r.m = 0; if (r.v < 0) r.v = 0; }
      if (r.m >= 1) { r.m = 1; if (r.v > 0) r.v = 0; }
      r.c = zoneAt(r, t);
      r.inZone = Math.abs(r.m - r.c) <= r.cfg.h / 2;
      r.p = r.inZone ? r.p + dt / r.cfg.need : Math.max(0, r.p - dt / r.cfg.need * 0.5);
      r.tick -= dt;
      if (held && r.tick <= 0) { r.tick = 0.22; sfx('reel'); }
      if (r.p >= 1) land();
      else if (t >= REEL_TIME) escaped('reel');
    } else if (phase === 'end') {
      if (t >= END_TIME) idle();
    } else if (phase === 'result') {
      if (t >= RESULT_AUTO) idle();
    }
  });

  // ---------- input while the overlay is up (capture phase: runs before player.js / ui.js) ----------
  const MOVE = { KeyW: 1, KeyA: 1, KeyS: 1, KeyD: 1, ArrowUp: 1, ArrowDown: 1, ArrowLeft: 1, ArrowRight: 1, KeyI: 1, KeyB: 1, KeyF: 1 };
  const swallow = function (e) { e.stopPropagation(); e.preventDefault(); };
  document.addEventListener('pointerdown', function (e) {
    if (!(e.target && e.target.closest && e.target.closest('#act'))) return;
    btnDown = true;
    if (phase !== 'idle') { swallow(e); press(); }
  }, true);
  ['pointerup', 'pointercancel'].forEach(function (n) { window.addEventListener(n, function () { btnDown = false; }, true); });
  window.addEventListener('keydown', function (e) {
    const act = e.code === 'Space' || e.code === 'KeyE';
    if (act && !e.repeat) keyDown = true;
    if (phase === 'idle') return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.code === 'Escape') { swallow(e); cancel(); return; }
    if (act) { swallow(e); if (!e.repeat) press(); return; }
    if (MOVE[e.code] || /^(?:Digit|Numpad)[0-9]$/.test(e.code)) swallow(e);
  }, true);
  window.addEventListener('keyup', function (e) { if (e.code === 'Space' || e.code === 'KeyE') keyDown = false; }, true);
  window.addEventListener('blur', function () { btnDown = keyDown = false; });

  // ---------- rod handler ----------
  const LABEL = { cast: 'Chờ cá…', wait: 'Chờ cá…', bite: 'Giật!', reel: 'Kéo!', result: 'Xong', end: 'Chờ…' };
  G.Actions.register('rod', {
    label: function (tx, tz) {
      if (phase !== 'idle') return LABEL[phase];
      return isWater(tx, tz) ? 'Câu cá' : null;
    },
    act: function (tx, tz) {
      if (phase !== 'idle') return true;
      return startCast(tx, tz);
    }
  });

  // ---------- 3D: rod, line, bobber, ripples, "!" ----------
  const L = function (c) { return new THREE.MeshLambertMaterial({ color: c }); };
  const rod = new THREE.Group();
  (function () {
    const g = new THREE.CylinderGeometry(0.02, 0.045, 2.3, 5); g.translate(0, 1.15, 0);
    const m = new THREE.Mesh(g, L(0x8a5a36)); rod.add(m);
    const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.4, 6).translate(0, 0.2, 0), L(0x4a3326)); rod.add(grip);
    rod.position.set(0.38, 1.05, 0.35); rod.rotation.x = 1.0; rod.visible = false;
    P.model.add(rod);
  })();
  const tipLocal = new THREE.Vector3(0.38, 1.05 + 2.3 * Math.cos(1.0), 0.35 + 2.3 * Math.sin(1.0));
  const tip = new THREE.Vector3();

  const bob = new THREE.Group();
  (function () {
    const red = new THREE.Mesh(G.Util.flat(new THREE.IcosahedronGeometry(0.17, 1)), L(0xd9382b)); red.position.y = 0.1; red.scale.y = 0.9; bob.add(red);
    const wht = new THREE.Mesh(G.Util.flat(new THREE.IcosahedronGeometry(0.13, 1)), L(0xfff3d6)); wht.position.y = -0.02; bob.add(wht);
    const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.3, 4).translate(0, 0.38, 0), L(0xfff3d6)); bob.add(stick);
    bob.visible = false; W.add(bob);
  })();
  const lineGeo = new THREE.BufferGeometry(); lineGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
  const line = new THREE.Line(lineGeo, new THREE.LineBasicMaterial({ color: 0xfff3d6 })); line.frustumCulled = false; line.visible = false; W.add(line);

  const rings = [];
  for (let i = 0; i < 3; i++) {
    const m = new THREE.Mesh(new THREE.RingGeometry(0.22, 0.3, 28).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false }));
    m.visible = false; m.renderOrder = 3; W.add(m); rings.push(m);
  }
  const bang = (function () {
    const cv = document.createElement('canvas'); cv.width = cv.height = 96;
    const c = cv.getContext('2d');
    c.fillStyle = '#d9382b'; c.beginPath(); c.arc(48, 48, 42, 0, TAU); c.fill();
    c.lineWidth = 6; c.strokeStyle = '#fff3d6'; c.stroke();
    c.fillStyle = '#fff'; c.font = '900 64px system-ui,"Segoe UI",sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('!', 48, 52);
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(cv), transparent: true, depthTest: false }));
    s.scale.set(1.0, 1.0, 1); s.renderOrder = 11; s.visible = false; W.add(s); return s;
  })();

  G.Loop.onRender(function () {
    const on = phase === 'cast' || phase === 'wait' || phase === 'bite' || phase === 'reel';
    rod.visible = phase !== 'idle';
    bob.visible = line.visible = on;
    if (!on) { bang.visible = false; rings.forEach(function (r) { r.visible = false; }); return; }
    P.model.updateMatrixWorld(true);
    tip.copy(tipLocal); P.model.localToWorld(tip);
    let x = cast.x, z = cast.z, y = WATER_Y + 0.02 + Math.sin(clock * 2.2) * 0.012;
    if (phase === 'cast') {                                  // flight: arc from the rod tip to the water
      const k = Math.min(1, t / FLIGHT);
      x = tip.x + (cast.x - tip.x) * k; z = tip.z + (cast.z - tip.z) * k;
      y = tip.y + (WATER_Y - tip.y) * k + Math.sin(k * Math.PI) * 1.4;
    } else if (phase === 'bite') {
      y -= 0.1 * (0.5 + 0.5 * Math.sin(clock * 26));         // the bobber dips
    } else if (phase === 'reel') {
      x += Math.sin(clock * 9) * 0.12; z += Math.cos(clock * 11) * 0.12; y -= 0.05;
    }
    bob.position.set(x, y, z);
    const a = lineGeo.attributes.position.array;
    a[0] = tip.x; a[1] = tip.y; a[2] = tip.z; a[3] = x; a[4] = y + 0.15; a[5] = z;
    lineGeo.attributes.position.needsUpdate = true;
    // ripples around the bobber once it has landed (faster while something bites)
    const fast = phase === 'bite' || phase === 'reel', period = fast ? 0.7 : 1.9;
    for (let i = 0; i < rings.length; i++) {
      const r = rings[i];
      if (phase === 'cast') { r.visible = false; continue; }
      const life = ((clock / period) + i / rings.length) % 1;
      r.visible = true; r.position.set(cast.x, WATER_Y + 0.04, cast.z);
      r.scale.setScalar(1 + life * (fast ? 4.5 : 3.5)); r.material.opacity = (1 - life) * (fast ? 0.75 : 0.5);
    }
    bang.visible = phase === 'bite';
    if (bang.visible) bang.position.set(x, y + 1.6 + Math.abs(Math.sin(clock * 10)) * 0.25, z);
  }, 80);

  // ---------- procedural low-poly fish art (canvas 2D, shared by the popup and the log) ----------
  const ART = {
    fish_ro:   { H: 0.30, prof: [0, 0.75, 1, 0.8, 0.35], top: '#6b7f4a', bot: '#cdb86f', fin: '#4a5e36', tail: 0.15, finH: 0.10, spots: true },
    fish_chep: { H: 0.42, prof: [0, 0.7, 1, 0.85, 0.4], top: '#c28a35', bot: '#f1dc9c', fin: '#a8672a', tail: 0.2, finH: 0.14, whisk: 0.5 },
    fish_tre:  { H: 0.26, prof: [0, 0.65, 0.95, 0.9, 0.55], top: '#4c4c56', bot: '#9a9aa2', fin: '#34343c', tail: 0.14, finH: 0.12, whisk: 1 },
    fish_loc:  { H: 0.22, prof: [0, 0.6, 0.9, 0.95, 0.65], top: '#4d6a3a', bot: '#cdd3a4', fin: '#394f2a', tail: 0.14, finH: 0.07, stripes: true },
    fish_dieu: { H: 0.44, prof: [0, 0.7, 1, 0.85, 0.4], top: '#e2554d', bot: '#f8c0ae', fin: '#c13d3c', tail: 0.21, finH: 0.15 }
  };
  const SIL = '#3b3029';
  function shade(hex, f) {
    const n = parseInt(hex.slice(1), 16);
    const c = function (v) { return Math.max(0, Math.min(255, Math.round(v * f))); };
    return 'rgb(' + c((n >> 16) & 255) + ',' + c((n >> 8) & 255) + ',' + c(n & 255) + ')';
  }
  function poly(ctx, pts, fill) {
    ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.closePath(); ctx.fillStyle = fill; ctx.fill();
  }
  // Draws species `id` facing right inside w x h (sil = flat dark silhouette for undiscovered fish). Junk ids draw a boot / weed.
  function draw(ctx, id, w, h, sil) {
    ctx.save(); ctx.translate(w * 0.03, h / 2); ctx.scale(w * 0.94, w * 0.94);
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    const col = function (c, f) { return sil ? SIL : shade(c, f); };
    const a = ART[id];
    if (a) {
      const X = [0.97, 0.82, 0.58, 0.36, 0.22], hh = a.H / 2, top = [], bot = [];
      for (let i = 0; i < 5; i++) { top.push([X[i], -hh * a.prof[i]]); bot.push([X[i], hh * a.prof[i] * 0.92]); }
      poly(ctx, [[0.24, -hh * a.prof[4] * 0.6], [0.0, -a.tail], [0.07, 0], [0.0, a.tail], [0.24, hh * a.prof[4] * 0.6]], col(a.fin, 1));     // tail
      poly(ctx, [[X[2] + 0.08, top[2][1] + 0.01], [X[2] - 0.05, top[2][1] - a.finH], [X[3] - 0.02, top[3][1] + 0.01]], col(a.fin, 0.95));       // dorsal fin
      poly(ctx, [[X[2] - 0.02, bot[2][1] - 0.01], [X[3] + 0.04, bot[3][1] + 0.09], [X[3] - 0.06, bot[3][1] - 0.01]], col(a.fin, 0.9));          // belly fin
      const F1 = [1.1, 0.94, 1.04, 0.9], F2 = [0.96, 1.06, 0.92, 1.02], F3 = [1.04, 0.92, 1.06, 0.95];
      for (let i = 0; i < 4; i++) {                                                                                                              // body facets
        const s0 = [X[i], 0], s1 = [X[i + 1], 0];
        poly(ctx, [s0, s1, top[i + 1]], col(a.top, F1[i])); poly(ctx, [s0, top[i + 1], top[i]], col(a.top, F2[i]));
        poly(ctx, [s0, s1, bot[i + 1]], col(a.bot, F3[i])); poly(ctx, [s0, bot[i + 1], bot[i]], col(a.bot, F2[i]));
      }
      if (!sil) {
        if (a.spots) { ctx.fillStyle = 'rgba(40,50,25,.55)'; [[0.62, -0.04], [0.5, 0.0], [0.4, -0.05], [0.55, 0.05]].forEach(function (p) { ctx.beginPath(); ctx.arc(p[0], p[1], 0.017, 0, TAU); ctx.fill(); }); }
        if (a.stripes) { ctx.strokeStyle = 'rgba(25,40,20,.6)'; ctx.lineWidth = 0.018; [0.7, 0.58, 0.46, 0.34].forEach(function (x) { ctx.beginPath(); ctx.moveTo(x, -hh * 0.8); ctx.lineTo(x - 0.05, hh * 0.1); ctx.stroke(); }); }
        ctx.strokeStyle = 'rgba(0,0,0,.28)'; ctx.lineWidth = 0.012; ctx.beginPath(); ctx.moveTo(X[1] - 0.03, -hh * a.prof[1] * 0.7); ctx.quadraticCurveTo(X[1] - 0.06, 0, X[1] - 0.03, hh * a.prof[1] * 0.6); ctx.stroke();
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(X[1] + 0.08, -hh * a.prof[1] * 0.3, 0.032, 0, TAU); ctx.fill();
        ctx.fillStyle = '#1d1a18'; ctx.beginPath(); ctx.arc(X[1] + 0.088, -hh * a.prof[1] * 0.3, 0.016, 0, TAU); ctx.fill();
      }
      if (a.whisk) {                                                                                                                             // râu
        ctx.strokeStyle = sil ? SIL : '#2c2c33'; ctx.lineWidth = 0.014;
        for (let k = 0; k < 2; k++) { const s = k ? 1 : -1; ctx.beginPath(); ctx.moveTo(0.95, s * 0.02); ctx.quadraticCurveTo(1.0 + 0.02 * a.whisk, s * 0.06, 0.99 + 0.04 * a.whisk, s * 0.1 * a.whisk + s * 0.03); ctx.stroke(); }
      }
    } else if (id === 'junk_shoe') {
      const brown = '#7a5a3e';
      poly(ctx, [[0.22, -0.2], [0.46, -0.2], [0.5, 0.0], [0.82, 0.04], [0.92, 0.14], [0.9, 0.22], [0.2, 0.22]], col(brown, 1));
      poly(ctx, [[0.2, 0.2], [0.9, 0.2], [0.9, 0.28], [0.2, 0.28]], col('#3b2b1f', 1));
      poly(ctx, [[0.22, -0.2], [0.46, -0.2], [0.47, -0.12], [0.22, -0.12]], col('#9a7a5a', 1));
      if (!sil) { ctx.strokeStyle = '#d8c8a8'; ctx.lineWidth = 0.012; for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.moveTo(0.5 + k * 0.08, 0.0 + k * 0.01); ctx.lineTo(0.55 + k * 0.08, 0.1); ctx.stroke(); } }
    } else if (id === 'junk_weed') {
      [[0.3, 0.26, -0.28, '#3f8a4a'], [0.45, 0.28, -0.36, '#4f9a5a'], [0.6, 0.26, -0.3, '#3a7d44'], [0.74, 0.27, -0.22, '#5aa864']].forEach(function (b, i) {
        const s = i % 2 ? 1 : -1;
        poly(ctx, [[b[0] - 0.045, b[1]], [b[0] + 0.03 * s, b[1] + b[2] * 0.55], [b[0] + 0.06 * s, b[1] + b[2]], [b[0] + 0.045, b[1]]], col(b[3], 1));
      });
    }
    ctx.restore();
  }

  // ---------- public API ----------
  G.Fishing = {
    ORDER: ORDER, JUNK: JUNK, FISH: FISH, COST: COST,
    active: function () { return phase !== 'idle'; },
    phase: function () { return phase; },
    cancel: cancel,
    dismiss: function () { if (phase === 'result') idle(); },
    entry: function (id) { const o = log[id]; return o ? { n: o.n, best: o.best } : null; },
    total: function () { let n = 0; ORDER.forEach(function (id) { if (log[id]) n += log[id].n; }); return n; },
    weights: weights,
    draw: draw,
    // Snapshot for the overlay (ui.js polls this every frame)
    view: function () {
      const v = { phase: phase, active: phase !== 'idle', held: isHeld() };
      if (phase === 'bite') v.biteLeft = Math.max(0, 1 - t / BITE_WINDOW);
      if (phase === 'reel' && reel) { v.c = reel.c; v.h = reel.cfg.h; v.m = reel.m; v.p = Math.min(1, reel.p); v.timeLeft = Math.max(0, 1 - t / REEL_TIME); v.inZone = reel.inZone; }
      if (phase === 'end') v.msg = endMsg;
      if (phase === 'result') v.result = result;
      return v;
    }
  };
})(window.Game);
