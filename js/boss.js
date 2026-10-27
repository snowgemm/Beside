(function () {
  var G = window.Game = window.Game || {};
  var B = G.boss = { active: false }, PT = G.rig.part;
  var DEF = { hp: 380, speed: 2.4, damage: 18, aggro: 99, attackRange: 99, radius: 1.1, height: 3.4, name: 'Quản Ngục Đá',
    spec: { height: 3.4, lunge: 0.5, atk: ['armL', 'armR'], parts: [
      PT('legL', null, [.6, 1.1, .6], [0, -.55, 0], [-.5, 1.1, 0], 0x555965), PT('legR', null, [.6, 1.1, .6], [0, -.55, 0], [.5, 1.1, 0], 0x555965),
      PT('torso', null, [1.5, 1.1, 1], [0, .55, 0], [0, 1.1, 0], 0x777c88, { color2: 0x5c7a4a }),
      PT('head', 'torso', [1.3, 1.1, 1.1], [0, .55, 0], [0, 1.1, 0], 0x9096a4),
      PT('eyeL', 'head', [.28, .2, .08], [0, 0, 0], [-.3, .62, -.56], 0xff9a1a, { flat: true }), PT('eyeR', 'head', [.28, .2, .08], [0, 0, 0], [.3, .62, -.56], 0xff9a1a, { flat: true }),
      PT('hornL', 'head', [.18, .45, .18], [0, .22, 0], [-.5, 1.1, 0], 0xd8d2b8, { rot: [0, 0, .3] }), PT('hornR', 'head', [.18, .45, .18], [0, .22, 0], [.5, 1.1, 0], 0xd8d2b8, { rot: [0, 0, -.3] }),
      PT('shoulderL', 'torso', [.7, .45, .8], [0, 0, 0], [-.95, .95, 0], 0x8d93a0), PT('shoulderR', 'torso', [.7, .45, .8], [0, 0, 0], [.95, .95, 0], 0x8d93a0),
      PT('armL', 'torso', [.5, 1.2, .5], [0, -.55, 0], [-1, .9, 0], 0x6a6f7c), PT('armR', 'torso', [.5, 1.2, .5], [0, -.55, 0], [1, .9, 0], 0x6a6f7c),
      PT('fistL', 'armL', [.8, .7, .8], [0, -.3, 0], [0, -1.15, 0], 0x555965), PT('fistR', 'armR', [.8, .7, .8], [0, -.3, 0], [0, -1.15, 0], 0x555965)] } };
  B.spec = DEF.spec; B.name = DEF.name;
  var scene, e = null, S = null, tele = null, projs = [], bar, fill, nameEl, pGeo, pMat;

  function killTele() {
    if (!tele) return;
    scene.remove(tele);
    tele.traverse(function (c) { if (c.geometry) c.geometry.dispose(); if (c.material) c.material.dispose(); });
    tele = null;
  }
  function mkTele(geo, op) {
    var g = new THREE.Group(), m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0xff3322, transparent: true, opacity: op, depthWrite: false, fog: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
    g.add(m); return g;
  }
  function swing(w) { if (e && e.rig) e.rig.play('attack', { dur: w + 0.55, windup: w / (w + 0.55) }); }
  function free(x, z, y) {
    var r = 0.9, W = G.world;
    return W.getHeight(x - r, z - r) - y <= 1.01 && W.getHeight(x + r, z - r) - y <= 1.01 && W.getHeight(x - r, z + r) - y <= 1.01 && W.getHeight(x + r, z + r) - y <= 1.01;
  }
  function slam(enr) {
    S.state = 'slam'; S.t = 0; S.dur = enr ? 0.9 : 1.2; S.R = enr ? 6.5 : 5;
    var g = new THREE.CircleGeometry(S.R, 40); g.rotateX(-Math.PI / 2);
    tele = new THREE.Group(); tele.add(mkTele(g, 0.25)); S.fillG = mkTele(g, 0.55); tele.add(S.fillG);
    tele.position.set(e.x, e.y + 0.06, e.z); scene.add(tele); swing(S.dur);
  }
  function fan(enr, dx, dz) {
    S.state = 'fan'; S.t = 0; S.dur = enr ? 0.6 : 0.85; S.ang = Math.atan2(dz, dx); S.spread = enr ? 1.5 : 1.2; S.cnt = enr ? 9 : 7;
    var g = new THREE.CircleGeometry(14, 24, -S.ang - S.spread / 2, S.spread); g.rotateX(-Math.PI / 2);
    tele = mkTele(g, 0.3); tele.position.set(e.x, e.y + 0.06, e.z); scene.add(tele); swing(S.dur);
  }
  var lastPw = -1, lastEnr = false;
  function projectiles(dt, px, py, pz) {
    for (var i = projs.length - 1; i >= 0; i--) {
      var q = projs[i];
      q.t += dt; q.x += q.vx * dt; q.z += q.vz * dt; q.m.position.set(q.x, q.y, q.z);
      var kill = q.t > 4 || G.world.solid(q.x, q.y, q.z);
      if (!kill) {
        var ex = q.x - px, ez = q.z - pz;
        if (ex * ex + ez * ez < 0.49 && Math.abs(q.y - (py + 0.9)) < 1.1 && G.combat.hurtPlayer(q.dmg, q.x - q.vx * 0.1, q.z - q.vz * 0.1)) kill = true;
      }
      if (kill) { scene.remove(q.m); projs.splice(i, 1); }
    }
  }
  function update(en, dt, dx, dz, d, px, py, pz) {
    var def = en.def, P = G.player, enr = en.hp < def.hp * 0.5, ux = dx / (d || 1), uz = dz / (d || 1), k;
    en.kx = en.kz = 0;
    if (en.bar) en.bar.visible = false;
    var pw = Math.max(0, Math.round(en.hp / def.hp * 100));
    if (pw !== lastPw) { lastPw = pw; fill.style.width = pw + '%'; }
    if (enr !== lastEnr) { lastEnr = enr; bar.classList.toggle('enr', enr); }
    projectiles(dt, px, py, pz);
    S.t += dt;
    if (S.state === 'idle') {
      en.group.rotation.y = Math.atan2(-dx, -dz);
      if (d > 5.5 && !P.dead) { // walking velocity (the body does the moving); free() keeps it off cliffs
        if (free(en.x + ux * 0.4, en.z, en.y)) en.wx = ux * def.speed;
        if (free(en.x, en.z + uz * 0.4, en.y)) en.wz = uz * def.speed;
      }
      S.cd -= dt;
      if (S.cd <= 0 && !P.dead) { S.n++; if (S.n % 2 === 1 && d < 9) slam(enr); else fan(enr, dx, dz); }
    } else if (S.state === 'slam') {
      k = Math.min(1, S.t / S.dur);
      S.fillG.scale.set(k, 1, k); en.group.scale.y = 1 + 0.15 * k;
      if (S.t >= S.dur) {
        en.group.scale.y = 1;
        if (Math.sqrt(dx * dx + dz * dz) < S.R && Math.abs(py - en.y) < 2.5) G.combat.hurtPlayer(Math.round(def.damage * 1.6), en.x, en.z);
        P.shake = 0.6; G.audio.play('hit'); S.fillG.children[0].material.color.setHex(0xffffff); S.fillG.children[0].material.opacity = 0.8;
        S.state = 'recover'; S.t = 0; S.dur = 0.8;
      }
    } else if (S.state === 'fan') {
      en.group.rotation.y = Math.atan2(-Math.cos(S.ang), -Math.sin(S.ang)) + Math.PI;
      if (S.t >= S.dur) {
        for (k = 0; k < S.cnt; k++) {
          var a = S.ang - S.spread / 2 + S.spread * k / (S.cnt - 1), cx = Math.cos(a), cz = Math.sin(a), m = new THREE.Mesh(pGeo, pMat);
          m.position.set(en.x + cx * 1.2, en.y + 1.5, en.z + cz * 1.2); scene.add(m);
          projs.push({ m: m, x: en.x + cx * 1.2, y: en.y + 1.5, z: en.z + cz * 1.2, vx: cx * 9, vz: cz * 9, t: 0, dmg: Math.round(def.damage * 0.7) });
        }
        G.audio.play('swing'); killTele(); S.state = 'recover'; S.t = 0; S.dur = 0.7;
      }
    } else if (S.state === 'recover') {
      if (tele && S.t > 0.15) killTele();
      if (S.t >= S.dur) { S.state = 'idle'; S.cd = enr ? 1.2 : 2; }
    }
    if (tele && S.state === 'slam') tele.position.set(en.x, en.y + 0.06, en.z);
  }

  B.init = function (sc) {
    scene = sc; bar = document.getElementById('boss-bar'); fill = document.getElementById('boss-fill'); nameEl = document.getElementById('boss-name');
    pGeo = new THREE.BoxGeometry(0.34, 0.34, 0.34); pMat = new THREE.MeshBasicMaterial({ color: 0xff7a1a });
    G.events.on('enemyDied', function (d) {
      if (d.type !== 'boss' || !B.active) return;
      B.cleanup(); G.events.emit('bossDied', { x: d.x, y: d.y, z: d.z });
    });
  };
  B.spawn = function (x, y, z, level) {
    var def = Object.create(DEF);
    def.hp = Math.round(DEF.hp * (1 + 0.2 * (level - 1))); def.damage = Math.round(DEF.damage * (1 + 0.1 * (level - 1)));
    e = G.enemies.spawn('boss', x, y, z, def); e.update = update; e.alerted = true;
    S = { state: 'idle', t: 0, cd: 2, n: 0 }; B.active = true;
    lastPw = -1; lastEnr = false; bar.classList.remove('enr'); nameEl.textContent = DEF.name; fill.style.width = '100%'; bar.style.display = 'block';
    G.audio.play('boss');
  };
  B.cleanup = function () {
    killTele();
    projs.forEach(function (q) { scene.remove(q.m); }); projs.length = 0;
    if (bar) bar.style.display = 'none';
    B.active = false; e = null;
  };
})();
