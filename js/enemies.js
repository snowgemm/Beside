(function () {
  var G = window.Game = window.Game || {};
  var MAX = 20, AI_RANGE = 40, SAFE = 20;
  var S = G.rig.part;
  function two(f) { return [f(-1, 'L'), f(1, 'R')]; }
  var TYPES = {
    slime: { weight: 45, hp: 30, speed: 2.8, damage: 8, aggro: 12, attackRange: 1, radius: 0.5, height: 0.9,
      spec: { height: 0.8, lunge: 0.3, gait: { hop: 1 }, parts: [
        S('body', null, [.9, .7, .9], [0, .35, 0], [0, 0, 0], 0x4cd64c), S('gloss', 'body', [.34, .1, .34], [0, 0, 0], [-.18, .72, .12], 0xa6f5a6),
        S('eyeL', 'body', [.16, .2, .05], [0, 0, 0], [-.22, .42, -.46], 0x112211, { flat: true }), S('eyeR', 'body', [.16, .2, .05], [0, 0, 0], [.22, .42, -.46], 0x112211, { flat: true }),
        S('mouth', 'body', [.24, .05, .05], [0, 0, 0], [0, .24, -.46], 0x112211, { flat: true })] } },
    goblin: { weight: 35, hp: 45, speed: 3.6, damage: 14, aggro: 16, attackRange: 1.7, radius: 0.4, height: 1.5,
      spec: { height: 1.5, parts: two(function (s, n) { return S('leg' + n, null, [.18, .4, .18], [0, -.2, 0], [s * .11, .4, 0], 0x5a4a2a, { color2: 0x3a2a18 }); }).concat([
        S('torso', null, [.44, .4, .3], [0, .2, 0], [0, .4, 0], 0x9a6a3a), S('head', 'torso', [.64, .54, .54], [0, .27, 0], [0, .4, 0], 0x7fc24a),
        S('earL', 'head', [.34, .1, .1], [-.15, 0, 0], [-.32, .3, 0], 0x7fc24a, { rot: [0, 0, -.45] }), S('earR', 'head', [.34, .1, .1], [.15, 0, 0], [.32, .3, 0], 0x7fc24a, { rot: [0, 0, .45] }),
        S('nose', 'head', [.12, .14, .12], [0, 0, 0], [0, .24, -.3], 0x6aa83a),
        S('eyeL', 'head', [.1, .1, .04], [0, 0, 0], [-.15, .34, -.275], 0xffe14a, { flat: true }), S('eyeR', 'head', [.1, .1, .04], [0, 0, 0], [.15, .34, -.275], 0xffe14a, { flat: true }),
        S('armL', 'torso', [.13, .38, .13], [0, -.17, 0], [-.28, .36, 0], 0x7fc24a), S('armR', 'torso', [.13, .38, .13], [0, -.17, 0], [.28, .36, 0], 0x7fc24a),
        S('hand', 'armR', null, null, [0, -.36, 0], 0, { rot: [.8, 0, 0] }),
        S('club', 'hand', [.1, .46, .1], [0, -.2, 0], [0, 0, 0], 0x6a4a22), S('knob', 'hand', [.2, .2, .2], [0, -.46, 0], [0, 0, 0], 0x7a5a2c)]) } },
    archer: { weight: 20, hp: 30, speed: 3, damage: 10, aggro: 22, attackRange: 14, keep: 8, radius: 0.4, height: 1.6,
      spec: { height: 1.6, parts: two(function (s, n) { return S('leg' + n, null, [.18, .45, .18], [0, -.22, 0], [s * .11, .45, 0], 0x3a3a2a, { color2: 0x2a2018 }); }).concat([
        S('torso', null, [.42, .4, .28], [0, .2, 0], [0, .45, 0], 0x3f8a3a), S('head', 'torso', [.6, .52, .52], [0, .26, 0], [0, .4, 0], 0xe0b088),
        S('hoodTop', 'head', [.68, .22, .62], [0, 0, 0], [0, .5, .02], 0x2f6a2c), S('hoodBack', 'head', [.68, .5, .12], [0, .25, 0], [0, .02, .3], 0x2f6a2c),
        S('eyeL', 'head', [.09, .1, .04], [0, 0, 0], [-.14, .3, -.265], 0x222222, { flat: true }), S('eyeR', 'head', [.09, .1, .04], [0, 0, 0], [.14, .3, -.265], 0x222222, { flat: true }),
        S('armL', 'torso', [.12, .38, .12], [0, -.17, 0], [-.27, .34, 0], 0x3f8a3a, { rot: [1.35, 0, 0] }), S('armR', 'torso', [.12, .38, .12], [0, -.17, 0], [.27, .34, 0], 0x3f8a3a),
        S('bow', 'armL', [.06, .06, .8], [0, 0, 0], [0, -.36, 0], 0x7a4a1a), S('string', 'armL', [.014, .014, .7], [0, .12, 0], [0, -.36, 0], 0xeeeeee, { flat: true })]) } },
    wolf: { weight: 18, hp: 38, speed: 5.4, damage: 12, aggro: 18, attackRange: 1.6, radius: 0.45, height: 1,
      spec: { height: 1, lunge: 0.5, gait: { quad: 1 }, parts: [
        S('torso', null, [.5, .46, .95], [0, .23, 0], [0, .5, 0], 0x8e939e, { color2: 0xcdd1d9 }),
        S('head', 'torso', [.52, .46, .46], [0, .08, -.16], [0, .36, -.5], 0x9aa0ac), S('snout', 'head', [.26, .2, .3], [0, 0, 0], [0, -.05, -.47], 0xb4b9c4),
        S('jaw', 'head', [.22, .06, .26], [0, 0, -.13], [0, -.2, -.34], 0x5a5e68),
        S('eyeL', 'head', [.08, .08, .04], [0, 0, 0], [-.15, .14, -.4], 0xffc23a, { flat: true }), S('eyeR', 'head', [.08, .08, .04], [0, 0, 0], [.15, .14, -.4], 0xffc23a, { flat: true }),
        S('earL', 'head', [.12, .2, .08], [0, .1, 0], [-.17, .3, -.06], 0x7a7f8a), S('earR', 'head', [.12, .2, .08], [0, .1, 0], [.17, .3, -.06], 0x7a7f8a),
        S('tail', 'torso', [.14, .14, .5], [0, 0, .25], [0, .2, .45], 0x8e939e, { rot: [-.7, 0, 0] }),
        S('legFL', null, [.14, .5, .14], [0, -.25, 0], [-.17, .5, -.33], 0x7a7f8a), S('legFR', null, [.14, .5, .14], [0, -.25, 0], [.17, .5, -.33], 0x7a7f8a),
        S('legBL', null, [.14, .5, .14], [0, -.25, 0], [-.17, .5, .33], 0x7a7f8a), S('legBR', null, [.14, .5, .14], [0, -.25, 0], [.17, .5, .33], 0x7a7f8a)] } },
    skeleton: { weight: 22, hp: 55, speed: 3.2, damage: 15, aggro: 16, attackRange: 1.8, radius: 0.4, height: 1.7, ai: 'goblin',
      spec: { height: 1.7, parts: two(function (s, n) { return S('leg' + n, null, [.13, .5, .13], [0, -.25, 0], [s * .1, .5, 0], 0xe6e0c8); }).concat([
        S('torso', null, [.38, .46, .2], [0, .23, 0], [0, .5, 0], 0xe6e0c8, { color2: 0xb8b098 }), S('head', 'torso', [.62, .58, .58], [0, .29, 0], [0, .46, 0], 0xf0ead6),
        S('eyeL', 'head', [.14, .16, .04], [0, 0, 0], [-.15, .34, -.29], 0x1a1a1a, { flat: true }), S('eyeR', 'head', [.14, .16, .04], [0, 0, 0], [.15, .34, -.29], 0x1a1a1a, { flat: true }),
        S('teeth', 'head', [.34, .07, .04], [0, 0, 0], [0, .13, -.29], 0x222222, { flat: true }),
        S('armL', 'torso', [.1, .44, .1], [0, -.2, 0], [-.27, .42, 0], 0xe6e0c8), S('armR', 'torso', [.1, .44, .1], [0, -.2, 0], [.27, .42, 0], 0xe6e0c8),
        S('hand', 'armR', null, null, [0, -.4, 0], 0, { rot: [.8, 0, 0] }),
        S('hilt', 'hand', [.05, .14, .05], [0, -.04, 0], [0, 0, 0], 0x6a4a22), S('guard', 'hand', [.2, .05, .07], [0, -.12, 0], [0, 0, 0], 0x8a8a8a), S('blade', 'hand', [.07, .58, .03], [0, -.43, 0], [0, 0, 0], 0xc8d2dc)]) } },
    bat: { weight: 15, hp: 18, speed: 4.8, damage: 7, aggro: 14, attackRange: 1.3, radius: 0.35, height: 1.4, ai: 'goblin',
      spec: { height: 0.9, lunge: 0.4, gait: { fly: { h: 0.8, amp: 0.22, rate: 18 } }, parts: [
        S('torso', null, [.42, .42, .36], [0, .21, 0], [0, .2, 0], 0x6a4a8a), S('head', 'torso', [.52, .46, .46], [0, .23, 0], [0, .4, 0], 0x7a5a9a),
        S('earL', 'head', [.12, .22, .08], [0, .11, 0], [-.2, .44, 0], 0x6a4a8a), S('earR', 'head', [.12, .22, .08], [0, .11, 0], [.2, .44, 0], 0x6a4a8a),
        S('eyeL', 'head', [.1, .1, .04], [0, 0, 0], [-.12, .28, -.235], 0xff3030, { flat: true }), S('eyeR', 'head', [.1, .1, .04], [0, 0, 0], [.12, .28, -.235], 0xff3030, { flat: true }),
        S('wingL', 'torso', [.62, .05, .46], [-.31, 0, 0], [-.2, .3, .05], 0x4a3068), S('wingR', 'torso', [.62, .05, .46], [.31, 0, 0], [.2, .3, .05], 0x4a3068),
        S('wingL2', 'wingL', [.5, .04, .36], [-.25, 0, 0], [-.62, 0, 0], 0x8a6aaa), S('wingR2', 'wingR', [.5, .04, .36], [.25, 0, 0], [.62, 0, 0], 0x8a6aaa)] } },
    spider: { weight: 16, hp: 32, speed: 4.4, damage: 10, aggro: 14, attackRange: 1.4, radius: 0.5, height: 0.8, ai: 'goblin',
      spec: { height: 0.8, lunge: 0.4, gait: { crawl: 1 }, parts: [
        S('torso', null, [.7, .4, .8], [0, .2, 0], [0, .5, 0], 0x2e2638), S('head', 'torso', [.46, .36, .36], [0, 0, -.18], [0, .2, -.4], 0x3a3048),
        S('abdomen', 'torso', [.8, .6, .9], [0, 0, .45], [0, .25, .35], 0x241c2e),
        S('eyeL', 'head', [.1, .1, .04], [0, 0, 0], [-.12, .08, -.37], 0xff2a2a, { flat: true }), S('eyeR', 'head', [.1, .1, .04], [0, 0, 0], [.12, .08, -.37], 0xff2a2a, { flat: true }),
        S('fangL', 'head', [.06, .2, .06], [0, -.1, 0], [-.1, -.12, -.3], 0xd8d0c0), S('fangR', 'head', [.06, .2, .06], [0, -.1, 0], [.1, -.12, -.3], 0xd8d0c0)]
        .concat([-.25, -.08, .08, .25].reduce(function (a, z, i) {
          var yaw = [.6, .2, -.2, -.6][i];
          a.push(S('legL' + i, 'torso', [.07, .85, .07], [0, -.42, 0], [-.35, .2, z], 0x3a3048, { role: 'leg', ph: i * 1.57 + 3.14, rot: [0, -yaw, -.75] }));
          a.push(S('legR' + i, 'torso', [.07, .85, .07], [0, -.42, 0], [.35, .2, z], 0x3a3048, { role: 'leg', ph: i * 1.57, rot: [0, yaw, .75] }));
          return a;
        }, [])) } },
    mushroom: { weight: 12, hp: 28, speed: 2.4, damage: 9, aggro: 20, attackRange: 12, keep: 7, radius: 0.45, height: 1.3, ai: 'archer', proj: 0xb06bff,
      spec: { height: 1.2, parts: two(function (s, n) { return S('leg' + n, null, [.14, .3, .14], [0, -.15, 0], [s * .1, .3, 0], 0xe8dcc0); }).concat([
        S('torso', null, [.5, .42, .4], [0, .21, 0], [0, .3, 0], 0xf2e8cc, { color2: 0xd8caa6 }), S('head', 'torso', [1, .5, 1], [0, .25, 0], [0, .38, 0], 0xd8403c, { color2: 0xeedcc0 }),
        S('spot1', 'head', [.22, .04, .22], [0, 0, 0], [-.25, .5, -.15], 0xfff4e6, { flat: true }), S('spot2', 'head', [.2, .04, .2], [0, 0, 0], [.22, .5, .2], 0xfff4e6, { flat: true }), S('spot3', 'head', [.16, .04, .16], [0, 0, 0], [.2, .5, -.25], 0xfff4e6, { flat: true }),
        S('eyeL', 'torso', [.08, .14, .04], [0, 0, 0], [-.11, .26, -.21], 0x222222, { flat: true }), S('eyeR', 'torso', [.08, .14, .04], [0, 0, 0], [.11, .26, -.21], 0x222222, { flat: true }),
        S('armL', 'torso', [.1, .28, .1], [0, -.12, 0], [-.3, .34, 0], 0xf2e8cc), S('armR', 'torso', [.1, .28, .1], [0, -.12, 0], [.3, .34, 0], 0xf2e8cc)]) } }
  };
  var E = G.enemies = { list: [], types: TYPES };
  var MASS = { slime: 0.6, goblin: 1, archer: 1, wolf: 1.2, skeleton: 1.1, bat: 0.4, spider: 0.8, mushroom: 0.9, boss: 8 };
  var ARROW_V = 16, ARROW_G = 12, STICK = 1, cdt = 0.016;
  var W, scene, cam, byChunk = {}, projs = [], geoC = {}, matC = {};
  var flashMat, teleMat, barGeo, barBgMat, barFillMat, projGeo, projMat;

  function geo(w, h, d) { var k = w + ',' + h + ',' + d; return geoC[k] || (geoC[k] = new THREE.BoxGeometry(w, h, d)); }
  function mat(c) { return matC[c] || (matC[c] = new THREE.MeshBasicMaterial({ color: c })); }
  function rng(seed) {
    return function () {
      seed |= 0; seed = seed + 0x6D2B79F5 | 0;
      var t = Math.imul(seed ^ seed >>> 15, 1 | seed);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  E.init = function (sc, camera) {
    W = G.world; scene = sc; cam = camera;
    flashMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    teleMat = new THREE.MeshBasicMaterial({ color: 0xff5522 });
    barGeo = new THREE.PlaneGeometry(1, 0.1); barGeo.translate(0.5, 0, 0);
    barBgMat = new THREE.MeshBasicMaterial({ color: 0x222222, fog: false });
    barFillMat = new THREE.MeshBasicMaterial({ color: 0xdd3333, fog: false });
    projGeo = new THREE.BoxGeometry(0.22, 0.22, 0.22); projMat = new THREE.MeshBasicMaterial({ color: 0xffdd44 });
    W.onChunkLoad = onLoad; W.onChunkUnload = onUnload;
  };

  function spawn(name, x, y, z, defO) {
    var def = defO || TYPES[name], g = new THREE.Group(), meshes = [], rig = null, mdl = G.assets && G.assets.model(name);
    if (mdl) { g.add(mdl); mdl.traverse(function (o) { if (o.isMesh) { o.userData.base = o.material; meshes.push(o); } }); }
    else if (def.spec) { rig = G.rig.build(def.spec, (Math.random() * 4) | 0); g.add(rig.group); }
    g.position.set(x, y, z); scene.add(g);
    var e = { type: name, def: def, x: x, y: y, z: z, hp: def.hp, group: g, meshes: meshes, rig: rig, rigDone: false, state: 'idle', t: Math.random() * 2,
      hop: 0, hopY: 0, vx: 0, vy: 0, vz: 0, wx: 0, wz: 0, r: name === 'boss' ? 0.9 : Math.max(0.25, def.radius * 0.75), sr: def.radius * 0.9, h: 0,
      mass: MASS[name] || 1, imass: name === 'boss' ? 0 : 1 / (MASS[name] || 1), onGround: false, inWater: false, autoStep: false, stepDy: 0, fly: false, act: false, jcd: 0, kbT: 0, hopper: (def.ai || name) === 'slime', dirx: 0, dirz: 0, walking: false, kx: 0, kz: 0, flash: 0, alerted: false, dead: false, deathT: 0, bar: null, cd: 1 + Math.random() };
    e.fly = !!(def.spec && def.spec.gait && def.spec.gait.fly); e.h = e.fly ? 0.8 : def.height;
    E.list.push(e);
    return e;
  }
  function removeEnemy(e) {
    scene.remove(e.group); if (e.rig) e.rig.dispose(); if (e.bar) scene.remove(e.bar);
    var i = E.list.indexOf(e); if (i >= 0) E.list.splice(i, 1);
  }
  E.spawn = spawn;
  E.clear = function () { while (E.list.length) removeEnemy(E.list[0]); projs.forEach(function (q) { scene.remove(q.m); }); projs.length = 0; };
  // swap the active enemy set (list + projectiles); returns the previous set, hidden
  E.swap = function (prev) {
    var old = { list: E.list, projs: projs };
    function vis(s, on) { s.list.forEach(function (e) { e.group.visible = on; if (e.bar) e.bar.visible = on && !e.dead; }); s.projs.forEach(function (q) { q.m.visible = on; }); }
    vis(old, false);
    E.list = prev ? prev.list : []; projs = prev ? prev.projs : [];
    if (prev) vis(prev, true);
    return old;
  };
  function onLoad(cx, cz) {
    var k = cx + ',' + cz;
    if (byChunk[k]) return;
    var r = rng((Math.imul(cx, 73856093) ^ Math.imul(cz, 19349663) ^ 0x5bd1e995) >>> 0);
    var n = Math.floor(r() * 4), ccx = cx * 16 + 2 + r() * 12, ccz = cz * 16 + 2 + r() * 12, names = Object.keys(TYPES), total = 0, i, j;
    for (i = 0; i < names.length; i++) total += TYPES[names[i]].weight;
    var sp = G.player.spawnPos, arr = [];
    for (i = 0; i < n; i++) {
      var pick = r() * total, x = ccx + (r() - 0.5) * 6, z = ccz + (r() - 0.5) * 6, name = names[0];
      for (j = 0; j < names.length; j++) { pick -= TYPES[names[j]].weight; if (pick <= 0) { name = names[j]; break; } }
      if (E.list.length >= MAX) continue;
      var h = W.getHeight(x, z);
      if (h < W.SEA + 1) continue;
      if (sp && Math.sqrt((x - sp.x) * (x - sp.x) + (z - sp.z) * (z - sp.z)) < SAFE) continue;
      arr.push(spawn(name, x, h, z));
    }
    byChunk[k] = arr;
  }
  function onUnload(cx, cz) {
    var k = cx + ',' + cz, arr = byChunk[k];
    if (!arr) return;
    for (var i = 0; i < arr.length; i++) removeEnemy(arr[i]);
    delete byChunk[k];
  }

  function setMat(e, m) { for (var i = 0; i < e.meshes.length; i++) e.meshes[i].material = m; }
  function restore(e) {
    if (e.state === 'wind') { setMat(e, teleMat); return; }
    for (var i = 0; i < e.meshes.length; i++) e.meshes[i].material = e.meshes[i].userData.base;
  }
  function tele(e, wind) {
    e.state = 'wind'; e.group.scale.setScalar(1.12);
    if (e.rig) { e.rig.tint(0xff5522); e.rig.play('attack', { dur: wind + 0.45, windup: wind / (wind + 0.45) }); }
    else setMat(e, teleMat);
  }
  function endTele(e) {
    e.group.scale.setScalar(1);
    if (e.rig) e.rig.tint(0); else restore(e);
  }
  // AI "step": sets the walking velocity for this frame (displacement / dt); never walks from land into deep water
  function step(e, dx, dz) {
    var l = Math.sqrt(dx * dx + dz * dz);
    if (l > 0 && !e.inWater && !e.fly && W.getHeight(e.x + dx / l * (e.r + 0.5), e.z + dz / l * (e.r + 0.5)) < W.SEA) return;
    e.wx = dx / cdt; e.wz = dz / cdt;
  }
  // wandering / idle hops avoid deep water and drops of more than 2 blocks
  function unsafe(e, ux, uz, dist) { if (e.fly) return false; var h = W.getHeight(e.x + ux * dist, e.z + uz * dist); return h < W.SEA || h < e.y - 2; }
  function face(e, dx, dz) { e.group.rotation.y = Math.atan2(-dx, -dz); }
  function wander(e, dt, speed) {
    e.t -= dt;
    if (e.t <= 0) {
      if (e.walking) { e.walking = false; e.t = 1 + Math.random() * 2; }
      else { e.walking = true; e.t = 1 + Math.random() * 1.5; var a = Math.random() * 6.283; e.dirx = Math.cos(a); e.dirz = Math.sin(a); }
    }
    if (e.walking && unsafe(e, e.dirx, e.dirz, e.r + 1)) { e.dirx = -e.dirx; e.dirz = -e.dirz; if (unsafe(e, e.dirx, e.dirz, e.r + 1)) { e.walking = false; e.t = 0.5; } }
    if (e.walking) { step(e, e.dirx * speed * dt, e.dirz * speed * dt); face(e, e.dirx, e.dirz); }
  }
  function ensureBar(e) {
    if (e.bar) return;
    var b = new THREE.Group(), bg = new THREE.Mesh(barGeo, barBgMat), f = new THREE.Mesh(barGeo, barFillMat);
    bg.position.x = -0.54; bg.scale.set(1.08, 1.6, 1); f.position.set(-0.5, 0, 0.01);
    b.add(bg, f); b.userData.fill = f; scene.add(b); e.bar = b;
  }
  // ballistic launch: low-arc solution for speed ARROW_V under ARROW_G, aimed slightly ahead of the player's velocity
  function fire(e, px, py, pz) {
    var ox = e.x, oy = e.y + 1.2, oz = e.z, pb = G.player.pos, t0 = Math.sqrt((px - ox) * (px - ox) + (pz - oz) * (pz - oz)) / ARROW_V;
    var hx = px + pb.vx * t0 * 0.55 - ox, hz = pz + pb.vz * t0 * 0.55 - oz, H = py + 1 - oy, D = Math.sqrt(hx * hx + hz * hz) || 0.1, s2 = ARROW_V * ARROW_V;
    var disc = s2 * s2 - ARROW_G * (ARROW_G * D * D + 2 * H * s2), tn = disc < 0 ? s2 / (ARROW_G * D) : (s2 - Math.sqrt(disc)) / (ARROW_G * D);
    var vh = ARROW_V / Math.sqrt(1 + tn * tn);
    var m = new THREE.Mesh(projGeo, e.def.proj ? mat(e.def.proj) : projMat); m.position.set(ox, oy, oz); scene.add(m);
    projs.push({ m: m, x: ox, y: oy, z: oz, vx: hx / D * vh, vy: vh * tn, vz: hz / D * vh, t: 0, st: -1, dmg: e.def.damage });
    G.audio.play('swing');
  }

  E.hurt = function (e, dmg, kx, kz) {
    if (e.dead) return;
    e.hp -= dmg; e.alerted = true;
    var kk = kx * kx + kz * kz, ks = (1 + Math.min(dmg, 40) * 0.012) * 0.9 / e.mass * (e.hp <= 0 ? 1.6 : 1);
    if (kk > 0) { e.vx += kx * ks; e.vz += kz * ks; e.kbT = e.hp <= 0 ? 0.6 : 0.3; if (!e.fly || e.hp <= 0) { e.vy = Math.max(e.vy, (e.hp <= 0 ? 5 : 3.2) / Math.sqrt(e.mass)); e.onGround = false; } }
    if (e.rig) e.rig.play('hurt'); else { e.flash = 0.12; setMat(e, flashMat); }
    G.combat.number(e.x, e.y + e.def.height + 0.4, e.z, dmg, '#ffffff');
    if (G.fx) G.fx.burst(e.x, e.y + e.def.height * 0.55, e.z, 'hit');
    ensureBar(e);
    if (e.hp <= 0) {
      e.dead = true; e.fly = false; e.deathT = 0; e.bar.visible = false; e.group.scale.setScalar(1);
      if (e.rig) e.rig.play('death', { onDone: function () { e.rigDone = true; } });
      G.audio.play('death');
      if (G.fx) G.fx.burst(e.x, e.y + e.def.height * 0.5, e.z, 'death', G.fx.colorOf(e), e.def.height > 2.5 ? 2.2 : 1);
    } else G.audio.play('hit');
  };

  function ai(e, dt, dx, dz, d, px, py, pz) {
    var def = e.def, kind = def.ai || e.type, C = G.combat, agg, ux = dx / (d || 1), uz = dz / (d || 1);
    if (d > def.aggro * 1.6) e.alerted = false;
    agg = e.alerted || d < def.aggro;
    if (kind === 'slime') {
      e.t -= dt;
      if (e.onGround && e.t <= 0 && e.kbT <= 0) { // real jump impulse
        var hx, hz, a;
        if (agg) { hx = ux; hz = uz; e.t = 0.9; }
        else { a = Math.random() * 6.283; hx = Math.cos(a); hz = Math.sin(a); e.t = 1.5 + Math.random() * 2; if (unsafe(e, hx, hz, 2.4)) { hx = -hx; hz = -hz; if (unsafe(e, hx, hz, 2.4)) { hx = hz = 0; e.t = 0.4; } } }
        if ((hx || hz) && !(agg && !e.inWater && W.getHeight(e.x + hx * 2.2, e.z + hz * 2.2) < W.SEA)) {
          e.vx = hx * def.speed * 1.6; e.vz = hz * def.speed * 1.6; e.vy = 7.1; e.onGround = false; e.dirx = hx; e.dirz = hz; face(e, hx, hz);
        } else if (agg) e.t = 0.3;
      }
      if (e.rig) e.rig.air = e.onGround ? -1 : Math.min(1, Math.max(0, 0.5 - e.vy / 14.2)); else e.group.scale.y = e.onGround ? 0.9 : 1.15;
      if (d < 0.95 && Math.abs(py - e.y) < 1.4) C.hurtPlayer(def.damage, e.x, e.z);
    } else if (kind === 'goblin') {
      if (e.state === 'wind') {
        face(e, dx, dz); e.t -= dt;
        if (e.t <= 0) {
          if (d < def.attackRange + 0.7 && Math.abs(py - e.y) < 2) C.hurtPlayer(def.damage, e.x, e.z);
          G.audio.play('swing'); e.state = 'recover'; e.t = 0.7; endTele(e);
        }
      } else if (e.state === 'recover') { e.t -= dt; if (e.t <= 0) e.state = 'idle'; }
      else if (agg) {
        face(e, dx, dz);
        if (d > def.attackRange) step(e, ux * def.speed * dt, uz * def.speed * dt);
        else { e.t = 0.5; tele(e, 0.5); }
      } else wander(e, dt, def.speed * 0.4);
    } else {
      if (e.state === 'wind') {
        face(e, dx, dz); e.t -= dt;
        if (e.t <= 0) { fire(e, px, py, pz); e.state = 'idle'; e.cd = 2.4; endTele(e); }
      } else if (agg) {
        face(e, dx, dz); e.cd -= dt;
        if (d < 6) step(e, -ux * def.speed * dt, -uz * def.speed * dt);
        else if (d > def.keep + 4) step(e, ux * def.speed * dt, uz * def.speed * dt);
        if (e.cd <= 0 && d <= def.attackRange && d > 2) { e.t = 0.6; tele(e, 0.6); }
      } else wander(e, dt, def.speed * 0.4);
    }
  }

  function finish(e) {
    var d = { type: e.type, x: e.x, y: e.y, z: e.z };
    removeEnemy(e); G.events.emit('enemyDied', d);
  }

  // velocity blend, step-up jumps, hover for flyers
  function drive(e, dt) {
    var acc, k, gh, h2;
    if (e.fly) {
      gh = W.getHeight(e.x, e.z); h2 = W.getHeight(e.x + e.wx * 0.3, e.z + e.wz * 0.3); if (h2 > gh) gh = h2; if (gh < W.SEA) gh = W.SEA;
      e.vy = Math.max(-8, Math.min(8, (gh + 0.1 - e.y) * 6)); acc = e.kbT > 0 ? 3 : 10;
    } else acc = (e.onGround || e.inWater) ? (e.kbT > 0 ? 7 : 12) : e.hopper ? 0 : (e.kbT > 0 ? 0.5 : 5);
    if (acc > 0) { k = Math.min(1, acc * dt); e.vx += (e.wx - e.vx) * k; e.vz += (e.wz - e.vz) * k; }
    if (!e.fly && (e.onGround || e.inWater) && e.jcd <= 0 && e.stepOk && (e.wx || e.wz) && e.kbT <= 0) { e.vy = 8.4; e.jcd = 0.45; e.onGround = false; } // jump up a 1-block step
  }

  E.update = function (dt, px, py, pz) {
    var list = E.list, i, P = G.phys;
    cdt = dt > 1e-3 ? dt : 1e-3;
    for (i = list.length - 1; i >= 0; i--) {
      var e = list[i];
      if (e.dead) { // corpse keeps falling / sliding with its last impulse
        e.act = false;
        if (e.onGround) { var fr = Math.min(1, 6 * dt); e.vx -= e.vx * fr; e.vz -= e.vz * fr; }
        P.move(e, dt); e.group.position.set(e.x, e.y, e.z);
        if (e.rig) { e.rig.update(dt, 0); if (e.rigDone) finish(e); continue; }
        e.deathT += dt;
        if (e.deathT >= 0.35) { finish(e); continue; }
        var s = e.deathT < 0.1 ? 1 + e.deathT / 0.1 * 0.25 : 1.25 * (1 - (e.deathT - 0.1) / 0.25);
        e.group.scale.setScalar(Math.max(0, s));
        continue;
      }
      var dx = px - e.x, dz = pz - e.z, d = Math.sqrt(dx * dx + dz * dz);
      if (d > AI_RANGE) { e.act = false; continue; }
      e.act = true;
      if (!e.rig && e.flash > 0) { e.flash -= dt; if (e.flash <= 0) restore(e); }
      if (e.kbT > 0) e.kbT -= dt;
      if (e.jcd > 0) e.jcd -= dt;
      var ox = e.x, oz = e.z;
      e.wx = e.wz = 0;
      if (e.update) e.update(e, dt, dx, dz, d, px, py, pz); else ai(e, dt, dx, dz, d, px, py, pz);
      drive(e, dt);
      P.move(e, dt);
      if (e.landV > P.FALL_V && !e.wasGround && !e.inWater && !e.fly) E.hurt(e, Math.round((e.landV - P.FALL_V) * P.FALL_DMG), 0, 0); // ledge fall
      e.group.position.set(e.x, e.y, e.z);
      if (e.rig) e.rig.update(dt, dt > 0 ? Math.sqrt((e.x - ox) * (e.x - ox) + (e.z - oz) * (e.z - oz)) / dt : 0);
      if (e.bar) {
        e.bar.position.set(e.x, e.y + e.def.height + 0.55, e.z); e.bar.quaternion.copy(cam.quaternion);
        e.bar.userData.fill.scale.x = Math.max(0.001, e.hp / e.def.hp);
      }
    }
    P.separate(list, G.player.dead ? null : G.player.pos);
    for (i = projs.length - 1; i >= 0; i--) {
      var q = projs[i], kill = false;
      if (q.st >= 0) { // stuck in terrain: 1 s, shrink away over the last 0.3 s
        q.st += dt;
        if (q.st > STICK) kill = true; else if (q.st > STICK - 0.3) q.m.scale.setScalar((STICK - q.st) / 0.3);
      } else {
        q.t += dt; q.vy -= ARROW_G * dt;
        var n = Math.max(1, Math.ceil(Math.sqrt(q.vx * q.vx + q.vy * q.vy + q.vz * q.vz) * dt / 0.4)), j, sd = dt / n;
        for (j = 0; j < n; j++) {
          var ppx = q.x, ppy = q.y, ppz = q.z;
          q.x += q.vx * sd; q.y += q.vy * sd; q.z += q.vz * sd;
          if (W.solid(q.x, q.y, q.z)) { q.x = ppx; q.y = ppy; q.z = ppz; q.st = 0; break; }
        }
        q.m.position.set(q.x, q.y, q.z);
        if (q.st < 0) {
          if (q.t > 3.5) kill = true;
          else {
            var ex = q.x - px, ez = q.z - pz;
            if (ex * ex + ez * ez < 0.36 && Math.abs(q.y - (py + 0.9)) < 1) {
              if (G.combat.hurtPlayer(q.dmg, q.x - q.vx * 0.1, q.z - q.vz * 0.1)) kill = true;
            }
          }
        }
      }
      if (kill) { scene.remove(q.m); projs.splice(i, 1); }
    }
  };
})();
