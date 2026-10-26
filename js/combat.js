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
  var EV = ['keydown', 'mousedown', 'touchstart', 'touchend', 'click'];
  function detach() { if (A.ctx && A.ctx.state === 'running') EV.forEach(function (e) { window.removeEventListener(e, unlock, true); }); }
  function unlock() {
    if (!A.ctx) {
      var C = window.AudioContext || window.webkitAudioContext;
      if (!C) return;
      A.ctx = new C(); A.master = A.ctx.createGain(); A.master.gain.value = 0.35 * (A.volume == null ? 1 : A.volume); A.master.connect(A.ctx.destination);
      var sr = A.ctx.sampleRate, b = A.ctx.createBuffer(1, sr >> 1, sr), d = b.getChannelData(0);
      for (var i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      A.noise = b;
    }
    if (A.ctx.state !== 'running') { var p = A.ctx.resume(); if (p && p.then) p.then(detach); } else detach();
  }
  EV.forEach(function (e) { window.addEventListener(e, unlock, true); });
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
    else if (n === 'break') { noise(0.16, 0.5, 1800, 300); tone('square', 140, 60, 0.1, 0.25); }
  };

  /* ---------- Combat ---------- */
  var C = G.combat = {};
  var COS_HALF_ARC = Math.cos(50 * Math.PI / 180);
  var cam, hpFill, hpText, fade, lastHp = -1, lastMax = -1, attackCd = 0, dodgeCd = 0, deadT = 0, nums = [];
  var pv = null;

  C.init = function (camera) {
    cam = camera; pv = new THREE.Vector3();
    hpFill = document.getElementById('hp-fill'); hpText = document.getElementById('hp-text'); fade = document.getElementById('fade');
  };

  C.number = function (x, y, z, v, color) {
    var el = document.createElement('div');
    el.className = 'dmg'; el.textContent = Math.round(v) + (C.critHit ? '!' : ''); el.style.color = C.critHit ? '#ffd34d' : (color || '#fff');
    document.body.appendChild(el);
    nums.push({ el: el, x: x, y: y, z: z, t: 0 });
    if (nums.length > 16) { var o = nums.shift(); o.el.remove(); }
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
    P.kb.x += dx / d * 9; P.kb.z += dz / d * 9; P.shake = 0.3;
    A.play('hurt'); C.number(P.pos.x, P.pos.y + 2, P.pos.z, dmg, '#ff6666');
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
      if (deadT > 1.6) { P.respawn(); P.health = P.maxHealth; P.dead = false; P.iframes = 1.5; fade.style.opacity = 0; }
    } else {
      if (I.attackQ) C.attack();
      if (I.dodgeQ) C.dodge();
    }
    I.attackQ = I.dodgeQ = false;
    if (P.health !== lastHp || P.maxHealth !== lastMax) {
      lastHp = P.health; lastMax = P.maxHealth;
      hpFill.style.width = (P.health / P.maxHealth * 100) + '%';
      hpText.textContent = Math.ceil(P.health) + '/' + P.maxHealth;
    }
    if (nums.length) {
      cam.updateMatrixWorld();
      for (var i = nums.length - 1; i >= 0; i--) {
        var n = nums[i]; n.t += dt; n.y += 1.3 * dt;
        if (n.t > 0.8) { n.el.remove(); nums.splice(i, 1); continue; }
        pv.set(n.x, n.y, n.z).project(cam);
        if (pv.z > 1) { n.el.style.display = 'none'; continue; }
        n.el.style.display = 'block';
        n.el.style.opacity = 1 - (n.t / 0.8) * (n.t / 0.8);
        n.el.style.transform = 'translate(' + ((pv.x * 0.5 + 0.5) * window.innerWidth) + 'px,' + ((-pv.y * 0.5 + 0.5) * window.innerHeight) + 'px) translate(-50%,-50%)';
      }
    }
  };
})();
