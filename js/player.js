(function () {
  var G = window.Game = window.Game || {};
    var P = G.player = { pos: { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, r: 0.3, h: 1.8, sr: 0.45, mass: 1.2, imass: 1 / 1.2, onGround: false, inWater: false, autoStep: true, stepDy: 0, wet: 0, swimUp: false }, stun: 0, yaw: 0, pitch: 0, onGround: false, inWater: false, third: true, camDist: 6.5, stepOff: 0,
    health: 100, maxHealth: 100, weapon: { damage: 10, reach: 2.2, cooldown: 0.4 }, dead: false, rollT: 0, rollDir: { x: 0, z: 0 }, kb: { x: 0, z: 0 }, shake: 0, swingT: 0, iframes: 0,
    equip: { weapon: null, armor: null, trinket: null }, dr: 0, crit: 0.05, speedMult: 1 };
  (function () { var b = P.pos; P.vel = Object.defineProperties({}, { x: { get: function () { return b.vx; }, set: function (v) { b.vx = v; }, enumerable: true }, y: { get: function () { return b.vy; }, set: function (v) { b.vy = v; }, enumerable: true }, z: { get: function () { return b.vz; }, set: function (v) { b.vz = v; }, enumerable: true } }); })();
  var W, cam, scn, rig, curW, spawn, shadow = null, wasGround = false, lastJump = false, wallCd = 0, jbuf = 0, coy = 0, camInit = false, cpx = 0, cpy = 0, cpz = 0, cvx = 0, cvy = 0, cvz = 0, camCur = 6.5, lastSwing = 0, lastHp = -1, wasDead = false, stepT = 0;

  function weaponKind(w) {
    var n = (w && w.name) || '';
    return n.indexOf('Rìu') === 0 ? 'axe' : n.indexOf('Dao') === 0 ? 'dagger' : n.indexOf('Giáo') === 0 ? 'spear' : 'sword';
  }
  // rig spec; weapon = equipped item or null (kind from the base name in items.js, blade colour from rarity)
  P.makeSpec = function (w) {
    var S = G.rig.part, R = w && G.items && G.items.RARITIES[w.rarity], hx = R ? R.hex : 0xb8b8b8, tn = 0x3a6fd8, k = weaponKind(w);
    var parts = [
      S('legL', null, [.2, .5, .2], [0, -.25, 0], [-.13, .5, 0], 0x35406a, { color2: 0x3b2a20 }), S('legR', null, [.2, .5, .2], [0, -.25, 0], [.13, .5, 0], 0x35406a, { color2: 0x3b2a20 }),
      S('torso', null, [.5, .5, .3], [0, .25, 0], [0, .5, 0], tn), S('head', 'torso', [.7, .7, .7], [0, .35, 0], [0, .5, 0], 0xf0c09a),
      S('hair', 'head', [.76, .28, .76], [0, 0, 0], [0, .6, 0], 0x5a3a22),
      S('eyeL', 'head', [.1, .14, .04], [0, 0, 0], [-.17, .36, -.355], 0x1a1a2a, { flat: true }), S('eyeR', 'head', [.1, .14, .04], [0, 0, 0], [.17, .36, -.355], 0x1a1a2a, { flat: true }),
      S('armL', 'torso', [.15, .45, .15], [0, -.2, 0], [-.33, .45, 0], tn), S('armR', 'torso', [.15, .45, .15], [0, -.2, 0], [.33, .45, 0], tn)];
    if (w) {
      parts.push(S('hand', 'armR', null, null, [0, -.4, 0], 0, { rot: [.8, 0, 0] }));
      if (k === 'axe') parts.push(S('wShaft', 'hand', [.07, .7, .07], [0, -.25, 0], [0, 0, 0], 0x6a4a22), S('wHead', 'hand', [.3, .24, .07], [.15, -.55, 0], [0, 0, 0], hx));
      else if (k === 'dagger') parts.push(S('wHilt', 'hand', [.06, .14, .06], [0, -.03, 0], [0, 0, 0], 0x6a4a22), S('wBlade', 'hand', [.07, .32, .03], [0, -.27, 0], [0, 0, 0], hx));
      else if (k === 'spear') parts.push(S('wShaft', 'hand', [.05, 1, .05], [0, -.35, 0], [0, 0, 0], 0x6a4a22), S('wTip', 'hand', [.1, .22, .1], [0, -.95, 0], [0, 0, 0], hx));
      else parts.push(S('wHilt', 'hand', [.06, .2, .06], [0, -.05, 0], [0, 0, 0], 0x6a4a22), S('wGuard', 'hand', [.22, .05, .09], [0, -.16, 0], [0, 0, 0], 0xd8b84a), S('wBlade', 'hand', [.09, .6, .04], [0, -.48, 0], [0, 0, 0], hx));
    }
    return { height: 1.7, parts: parts };
  };
  function mkRig() {
    if (rig) rig.dispose();
    curW = P.equip.weapon; rig = G.rig.build(P.makeSpec(curW)); scn.add(rig.group); rig.group.visible = false;
    if (P.dead) rig.play('death', { keep: true });
  }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

  P.init = function (scene, camera, sp) {
    W = G.world; cam = camera; spawn = sp; P.spawnPos = sp;
    cam.rotation.order = 'YXZ';
    scn = scene; mkRig();
    if (shadow && shadow.parent) shadow.parent.remove(shadow);
    shadow = G.toon && G.toon.blobShadow ? G.toon.blobShadow(0.58) : null;
    if (shadow) scene.add(shadow);
    P.respawn();
  };
  P.respawn = function () {
    var s = (G.dungeon && G.dungeon.respawnPoint && G.dungeon.respawnPoint()) || spawn;
    P.pos.x = s.x; P.pos.y = s.y + 0.001; P.pos.z = s.z;
    P.vel.x = P.vel.y = P.vel.z = 0;
    P.kb.x = P.kb.z = 0; P.rollT = 0; P.swingT = 0; P.stun = 0; P.pos.onGround = false; camInit = false;
  };
  // knockback impulse (blocks of velocity), briefly reduces ground control
  P.knock = function (ix, iy, iz) { var v = P.pos; v.vx += ix; v.vz += iz; if (iy > v.vy) v.vy = iy; v.onGround = false; P.stun = 0.22; };
  P.recalc = function () {
    var e = P.equip, w = e.weapon && e.weapon.stats, a = e.armor && e.armor.stats, t = e.trinket && e.trinket.stats;
    P.weapon.damage = w ? w.damage : 10; P.weapon.reach = w ? w.reach : 2.2; P.weapon.cooldown = 0.4 * (w ? w.cdMult : 1);
    P.maxHealth = 100 + ((a && a.hp) || 0) + ((t && t.hp) || 0);
    P.dr = Math.min(0.6, (a && a.dr) || 0);
    P.speedMult = 1 + ((t && t.speed) || 0);
    P.crit = 0.05 + ((t && t.crit) || 0);
    if (P.health > P.maxHealth) P.health = P.maxHealth;
  };
  P.update = function (dt) {
    var I = G.input, p = P.pos, b = p, v = P.vel;
    I.poll();
    if (P.dead) { I.moveX = I.moveZ = 0; I.jump = false; }
    P.yaw -= I.lookDX; P.pitch = clamp(P.pitch - I.lookDY, -1.45, 1.45); I.lookDX = I.lookDY = 0;
    if (I.viewToggle) { P.third = !P.third; I.viewToggle = false; }
    wasGround = b.onGround;
    var inW = b.inWater, ph = G.phys, A = G.audio;
    var sy = Math.sin(P.yaw), cy = Math.cos(P.yaw);
    var wx = -sy * I.moveZ + cy * I.moveX, wz = -cy * I.moveZ - sy * I.moveX, l = Math.hypot(wx, wz);
    if (l > 1) { wx /= l; wz /= l; }
    var sp = (inW ? 2.6 : 5.4) * P.speedMult, k = Math.min(1, (P.stun > 0 ? 5 : b.onGround || inW ? 12 : 4) * dt);
    if (P.stun > 0) P.stun -= dt;
    if (P.rollT > 0) { P.rollT -= dt; v.x = P.rollDir.x * 11; v.z = P.rollDir.z * 11; }
    else { v.x += (wx * sp - v.x) * k; v.z += (wz * sp - v.z) * k; }
    // jump: coyote 0.1 s + buffer 0.1 s; in water (more than ~half submerged) jump = swim up
    if (I.jump && !lastJump) jbuf = 0.1; else if (jbuf > 0) jbuf -= dt;
    lastJump = I.jump;
    if (b.onGround) coy = 0.1; else if (coy > 0) coy -= dt;
    b.swimUp = false;
    if (inW && b.wet > 0.45) b.swimUp = I.jump;
    else if ((I.jump && b.onGround) || (jbuf > 0 && coy > 0)) { b.vy = ph.JUMP_V; jbuf = 0; coy = 0; b.onGround = false; if (A) A.play('jump'); }
    var hs0 = Math.sqrt(b.vx * b.vx + b.vz * b.vz);
    ph.move(b, dt);
    if (wallCd > 0) wallCd -= dt;
    if ((b.hitX || b.hitZ) && hs0 > 6 && wallCd <= 0) { wallCd = 0.3; G.events.emit('hitwall', { speed: hs0 }); }
    P.onGround = b.onGround; P.inWater = b.inWater;
    P.stepOff += b.stepDy; b.stepDy = 0;
    if (b.landV > 3 && !wasGround && !P.dead) { // landing: event + fall damage (none in water, never lethal)
      var lv = b.landV;
      G.events.emit('landed', { speed: lv });
      if (lv > ph.FALL_V && !b.inWater && P.health > 1) {
        var fd = Math.min(Math.round((lv - ph.FALL_V) * ph.FALL_DMG), P.health - 1);
        if (fd > 0) { P.health -= fd; P.shake = 0.3; if (A) A.play('hurt'); if (G.combat) G.combat.number(p.x, p.y + 2, p.z, fd, '#ff6666', 'hurt'); }
      }
    }
    if (G.fx && !P.dead) { // running / rolling dust
      var dcol = G.dungeon && G.dungeon.active ? 0 : W.topColor(p.x, p.z);
      if (P.rollT > 0 || (b.onGround && !b.inWater && Math.hypot(v.x, v.z) > 3.5)) {
        stepT -= dt;
        if (stepT <= 0) { stepT = P.rollT > 0 ? 0.07 : 0.27; G.fx.burst(p.x, p.y + 0.05, p.z, 'dust', dcol); }
      }
    }
    if (p.y < -30) P.respawn();

    // Soft contact shadow: avoids hard shadow-map acne on the low-poly heightfield and grounds the avatar visually.
    if (shadow) {
      var floorY = (G.dungeon && G.dungeon.active) ? W.getHeight(p.x, p.z) : (W.surfaceHeight ? W.surfaceHeight(p.x, p.z) : W.getHeight(p.x, p.z));
      if (!isFinite(floorY)) floorY = W.getHeight(p.x, p.z);
      var air = Math.max(0, p.y - floorY), radius = 0.54 + Math.min(1.15, air * 0.12);
      shadow.position.set(p.x, floorY + 0.035, p.z); shadow.scale.set(radius, radius * 0.72, 1);
      shadow.visible = !P.dead && !b.inWater && air < 5;
    }

    P.stepOff -= P.stepOff * Math.min(1, 10 * dt);
    var cp = Math.cos(P.pitch), dx = -sy * cp, dy = Math.sin(P.pitch), dz = -cy * cp, camVis = true;
    cam.rotation.set(P.pitch, P.yaw, 0);
    var hx = p.x, hy = p.y + 1.6 + P.stepOff, hz = p.z;
    if (!P.third) {
      cam.position.set(p.x, p.y + 1.62 + P.stepOff, p.z); camInit = false;
    } else {
      // critically damped spring on the pivot (horizontal 20, vertical 14), instant pull-in / smooth restore on the distance
      if (!camInit || Math.abs(hx - cpx) + Math.abs(hz - cpz) + Math.abs(hy - cpy) > 6) { cpx = hx; cpy = hy; cpz = hz; cvx = cvy = cvz = 0; camCur = P.camDist; camInit = true; }
      var eh = Math.exp(-20 * dt), ev = Math.exp(-14 * dt), tx, tv;
      tx = (cvx + 20 * (cpx - hx)) * dt; cvx = (cvx - 20 * tx) * eh; cpx = hx + (cpx - hx + tx) * eh;
      tx = (cvz + 20 * (cpz - hz)) * dt; cvz = (cvz - 20 * tx) * eh; cpz = hz + (cpz - hz + tx) * eh;
      tv = (cvy + 14 * (cpy - hy)) * dt; cvy = (cvy - 14 * tv) * ev; cpy = hy + (cpy - hy + tv) * ev;
      var dist = P.camDist;
      for (var t = 0.4; t <= dist + 0.4; t += 0.2) {
        if (ph.blockedAt(cpx - dx * t, cpy - dy * t, cpz - dz * t)) { dist = Math.max(0.5, t - 0.4); break; }
      }
      if (dist < camCur) camCur = dist;
      else if (dist - camCur > 0.03) camCur += (dist - camCur) * (1 - Math.exp(-5 * dt)); else camCur = dist;
      cam.position.set(cpx - dx * camCur, cpy - dy * camCur, cpz - dz * camCur);
      camVis = camCur > 0.8;
    }
    if (P.shake > 0.001) { cam.position.x += (Math.random() - 0.5) * P.shake; cam.position.y += (Math.random() - 0.5) * P.shake; P.shake *= Math.max(0, 1 - 12 * dt); }
    var hs = Math.hypot(v.x, v.z);
    if (P.equip.weapon !== curW) mkRig();
    if (P.dead && !wasDead) rig.play('death', { keep: true }); else if (!P.dead && wasDead) rig.play('idle');
    wasDead = P.dead;
    if (!P.dead && P.health < lastHp) rig.play('hurt');
    lastHp = P.health;
    if (P.swingT > lastSwing) rig.play('attack', { dur: 0.32, windup: 0.15 });
    if (P.swingT > 0) P.swingT -= dt;
    lastSwing = P.swingT;
    rig.tiltX = P.rollT > 0 ? -6.283 * (1 - P.rollT / 0.35) : 0;
    rig.group.visible = P.third && camVis;
    if (P.third) {
      rig.group.position.set(p.x, p.y + P.stepOff, p.z); rig.group.rotation.y = P.yaw;
      rig.update(dt, b.onGround || b.inWater ? hs : 0);
    }
  };
})();
