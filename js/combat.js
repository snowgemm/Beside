(function () {
  var G = window.Game = window.Game || {};
  G.events = G.events || (function () {
    var h = {};
    return {
      on: function (n, f) { (h[n] = h[n] || []).push(f); },
      off: function (n, f) { var a = h[n]; if (a) { var i = a.indexOf(f); if (i >= 0) a.splice(i, 1); } },
      emit: function (n, d) { var a = h[n]; if (a) for (var i = 0; i < a.length; i++) a[i](d); }
    };
  })();

  /* ---------- WebAudio (generated SFX) ---------- */
  var A = G.audio = { ctx: null, master: null, noise: null };
  var EV = ['keydown', 'mousedown', 'touchstart', 'touchend', 'click'], unlockBound = false;
  function attach() {
    if (unlockBound) return;
    unlockBound = true;
    EV.forEach(function (e) { window.addEventListener(e, unlock, true); });
  }
  function detach() {
    if (!A.ctx || A.ctx.state !== 'running' || !unlockBound) return;
    EV.forEach(function (e) { window.removeEventListener(e, unlock, true); });
    unlockBound = false;
  }
  function suspendHiddenAudio() {
    if (!A.ctx || A.ctx.state !== 'running' || !A.ctx.suspend) return;
    try {
      var p = A.ctx.suspend();
      if (p && p.catch) p.catch(function () {});
    } catch (e) {}
  }
  function unlock() {
    if (!A.ctx) {
      var C = window.AudioContext || window.webkitAudioContext;
      if (!C) return;
      A.ctx = new C(); A.master = A.ctx.createGain(); A.master.gain.value = 0.35 * (A.volume == null ? 1 : A.volume); A.master.connect(A.ctx.destination);
      var sr = A.ctx.sampleRate, b = A.ctx.createBuffer(1, sr >> 1, sr), d = b.getChannelData(0);
      for (var i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      A.noise = b;
    }
    if (A.ctx.state !== 'running') {
      try {
        var p = A.ctx.resume();
        if (p && p.then) p.then(detach, function () {});
        else detach();
      } catch (e) {}
    } else detach();
  }
  attach();
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) suspendHiddenAudio();
    else if (A.ctx && A.ctx.state !== 'running') attach();
  });
  window.addEventListener('pagehide', suspendHiddenAudio);
  function tone(type, f0, f1, dur, vol) {
    var c = A.ctx, t = c.currentTime, o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(A.master); o.start(t); o.stop(t + dur + 0.02);
  }
  function noise(dur, vol, f0, f1) {
    var c = A.ctx, t = c.currentTime, s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    s.buffer = A.noise; f.type = 'bandpass'; f.Q.value = 1.2;
    f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    s.connect(f); f.connect(g); g.connect(A.master); s.start(t); s.stop(t + dur);
  }
  A.setVolume = function (v) { A.volume = Math.max(0, Math.min(1, v)); if (A.master) A.master.gain.value = 0.35 * A.volume; };
  A.play = function (n) {
    if (!A.ctx || A.ctx.state !== 'running') return;
    if (n === 'swing') noise(0.14, 0.5, 700, 2600);
    else if (n === 'hit') { tone('square', 220, 70, 0.12, 0.35); noise(0.08, 0.4, 1500, 500); }
    else if (n === 'hurt') tone('sawtooth', 320, 110, 0.28, 0.4);
    else if (n === 'death') { tone('square', 420, 50, 0.4, 0.35); noise(0.3, 0.4, 1200, 200); }
    else if (n === 'pickup') tone('sine', 600, 1000, 0.12, 0.3);
    else if (n === 'equip') tone('triangle', 300, 520, 0.1, 0.3);
    else if (n === 'place') { tone('triangle', 180, 260, 0.08, 0.35); noise(0.05, 0.25, 900, 500); }
    else if (n === 'jump') { tone('triangle', 260, 480, 0.09, 0.22); noise(0.05, 0.12, 900, 1800); }
    else if (n === 'land') { tone('sine', 150, 70, 0.09, 0.3); noise(0.06, 0.2, 700, 300); }
    else if (n === 'landhard') { tone('sine', 110, 40, 0.18, 0.5); noise(0.14, 0.45, 900, 150); tone('square', 90, 45, 0.08, 0.2); }
    else if (n === 'splash') { noise(0.2, 0.3, 1800, 600); tone('sine', 500, 250, 0.1, 0.12); }
    else if (n === 'splashbig') { noise(0.4, 0.5, 1400, 300); tone('sine', 300, 90, 0.25, 0.3); }
    else if (n === 'bounce') { tone('triangle', 420, 240, 0.07, 0.2); }
    else if (n === 'hitwall') { tone('square', 120, 50, 0.08, 0.3); noise(0.06, 0.3, 600, 200); }
    else if (n === 'break') { noise(0.16, 0.5, 1800, 300); tone('square', 140, 60, 0.1, 0.25); }
  };

  /* ---------- Combat ---------- */
  var C = G.combat = {};
  var COS_HALF_ARC = Math.cos(50 * Math.PI / 180);
  var cam, hpFill, hpText, hpGhost, hpBox, dodgeBtn, fade, lastHp = -1, lastMax = -1, attackCd = 0, dodgeCd = 0, deadT = 0, deathShown = false, lastCd = -1, lastWpn;
  var pool = [], POOL = 12, activeN = 0, pv = null;

  C.init = function (camera) {
    cam = camera; pv = new THREE.Vector3();
    hpFill = document.getElementById('hp-fill'); hpText = document.getElementById('hp-text'); fade = document.getElementById('fade');
    hpGhost = document.getElementById('hp-ghost'); hpBox = document.getElementById('hp'); dodgeBtn = document.getElementById('btn-dodge');
    for (var i = 0; i < POOL; i++) {
      var el = document.createElement('div'), dn = document.createElement('span');
      el.className = 'dmg'; dn.className = 'dn'; el.appendChild(dn); document.body.appendChild(el);
      pool.push({ el: el, dn: dn, x: 0, y: 0, z: 0, t: 0, on: false, shown: false });
    }
  };

  // pool of 12 elements; kind: 'hit' (white) | 'crit' (large orange, '!') | 'hurt' (red) | 'heal' (green); CSS animates the fade
  C.number = function (x, y, z, v, color, kind) {
    var n = null, i, old = -1;
    kind = kind || (C.critHit ? 'crit' : 'hit');
    for (i = 0; i < POOL; i++) {
      if (!pool[i].on) { n = pool[i]; break; }
      if (pool[i].t > old) { old = pool[i].t; n = pool[i]; }
    }
    if (!n) n = pool[0];
    if (!n.on) activeN++;
    n.on = true; n.t = 0; n.x = x; n.y = y; n.z = z; n.shown = false;
    n.el.className = 'dmg k-' + kind; n.el.style.display = 'none';
    n.dn.textContent = (kind === 'heal' ? '+' : '') + Math.round(v) + (kind === 'crit' ? '!' : '');
  };
  C.haptic = function () {
    var s = G.menu && G.menu.settings;
    if (s && s.vib === false) return;
    if (navigator.vibrate) { try { navigator.vibrate(30); } catch (e) {} }
  };
  C.dodgeLeft = function () { return dodgeCd > 0 ? dodgeCd : 0; };
  C.respawn = function () {
    var P = G.player;
    if (!P.dead) return;
    P.respawn(); P.health = P.maxHealth; P.dead = false; P.iframes = 1.5; fade.style.opacity = 0; deadT = 0; deathShown = false;
    if (G.ui) G.ui.showDeath(false);
  };

  C.attack = function () {
    var P = G.player, w = P.weapon;
    if (attackCd > 0 || P.dead || P.rollT > 0) return;
    attackCd = w.cooldown; P.swingT = 0.25; A.play('swing');
    var fx = -Math.sin(P.yaw), fz = -Math.cos(P.yaw), list = G.enemies.list;
    for (var i = 0; i < list.length; i++) {
      var e = list[i];
      if (e.dead) continue;
      var dx = e.x - P.pos.x, dz = e.z - P.pos.z, d = Math.max(0.001, Math.sqrt(dx * dx + dz * dz));
      if (d > w.reach + e.def.radius || Math.abs(e.y - P.pos.y) > 2) continue;
      if ((dx * fx + dz * fz) / d < COS_HALF_ARC && d > e.def.radius + 0.3) continue;
      var crit = Math.random() < P.crit; C.critHit = crit;
      G.enemies.hurt(e, Math.round(w.damage * (crit ? 2 : 1)), dx / d * 6, dz / d * 6);
      // Small confirmed-hit feedback; only set after a target passes range and arc checks.
      P.shake = Math.max(P.shake || 0, crit ? 0.11 : 0.045);
      C.critHit = false;
    }
  };

  C.dodge = function () {
    var P = G.player, I = G.input;
    if (dodgeCd > 0 || P.dead || P.rollT > 0) return;
    var sy = Math.sin(P.yaw), cy = Math.cos(P.yaw), mx = I.moveX, mz = I.moveZ;
    var wx = -sy * mz + cy * mx, wz = -cy * mz - sy * mx, l = Math.sqrt(wx * wx + wz * wz);
    if (l < 0.1) { wx = -sy; wz = -cy; l = 1; }
    P.rollDir.x = wx / l; P.rollDir.z = wz / l; P.rollT = 0.35; dodgeCd = 1.0; A.play('swing');
  };

  C.hurtPlayer = function (dmg, fx, fz) {
    var P = G.player;
    if (P.dead || P.rollT > 0 || P.iframes > 0) return false;
    dmg = Math.max(1, Math.round(dmg * (1 - P.dr)));
    P.health = Math.max(0, P.health - dmg); P.iframes = 0.6;
    var dx = P.pos.x - fx, dz = P.pos.z - fz, d = Math.max(0.001, Math.sqrt(dx * dx + dz * dz));
    P.knock(dx / d * 7, 4, dz / d * 7); P.shake = 0.3;
    A.play('hurt'); C.number(P.pos.x, P.pos.y + 2, P.pos.z, dmg, '#ff6666', 'hurt'); C.haptic();
    if (P.health <= 0) { P.dead = true; deadT = 0; fade.style.opacity = 1; A.play('death'); }
    return true;
  };

  C.update = function (dt) {
    var P = G.player, I = G.input;
    if (attackCd > 0) attackCd -= dt;
    if (dodgeCd > 0) dodgeCd -= dt;
    if (P.iframes > 0) P.iframes -= dt;
    if (P.dead) {
      deadT += dt;
      if (G.ui && G.ui.hasDeath) { if (deadT > 0.9 && !deathShown) { deathShown = true; G.ui.showDeath(true); } }
      else if (deadT > 1.6) C.respawn();
    } else {
      if (I.attackQ) C.attack();
      if (I.dodgeQ) C.dodge();
    }
    I.attackQ = I.dodgeQ = false;
    if (P.health !== lastHp || P.maxHealth !== lastMax) {
      lastHp = P.health; lastMax = P.maxHealth;
      var pc = Math.max(0, P.health / P.maxHealth * 100);
      hpFill.style.width = pc + '%'; hpGhost.style.width = pc + '%';
      hpText.textContent = Math.ceil(P.health) + '/' + P.maxHealth;
      hpBox.classList.toggle('low', pc < 30 && P.health > 0);
    }
    if (P.equip.weapon !== lastWpn) { lastWpn = P.equip.weapon; if (G.ui) G.ui.setWeapon(lastWpn); }
    var cs = dodgeCd > 0 ? Math.ceil(dodgeCd * 36) : 0;
    if (cs !== lastCd) { lastCd = cs; dodgeBtn.style.setProperty('--cd', (cs * 10) + 'deg'); dodgeBtn.classList.toggle('cool', cs > 0); }
    if (activeN > 0) {
      cam.updateMatrixWorld();
      for (var i = 0; i < POOL; i++) {
        var n = pool[i];
        if (!n.on) continue;
        n.t += dt; n.y += 1.3 * dt;
        if (n.t > 0.9) { n.on = false; n.shown = false; n.el.style.display = 'none'; activeN--; continue; }
        pv.set(n.x, n.y, n.z).project(cam);
        if (pv.z > 1) { if (n.shown) { n.shown = false; n.el.style.display = 'none'; } continue; }
        if (!n.shown) { n.shown = true; n.el.style.display = 'block'; }
        n.el.style.transform = 'translate(' + ((pv.x * 0.5 + 0.5) * window.innerWidth) + 'px,' + ((-pv.y * 0.5 + 0.5) * window.innerHeight) + 'px) translate(-50%,-50%)';
      }
    }
  };
})();
