(function () {
  var G = window.Game = window.Game || {};
  /* ---------- MANIFEST: drop files at these paths, no code changes needed ----------
     models: file under assets/models/, height = target height in world units (auto-fit: centred x/z, feet y=0),
             rotY = extra yaw in radians (glTF models face +Z, game "forward" is -Z, so characters use Math.PI).
     sounds: first existing file of the list wins (assets/sfx/). */
  var MANIFEST = {
    models: {
      gate:   { file: 'gate.glb',   height: 6 },
      door:   { file: 'door.glb',   height: 5, rotY: Math.PI / 2 },
      chest:  { file: 'chest.glb',  height: 0.9 },
      portal: { file: 'portal.glb', height: 3 },
      boss:   { file: 'boss.glb',   height: 3.4, rotY: Math.PI },
      slime:  { file: 'slime.glb',  height: 0.9, rotY: Math.PI },
      goblin: { file: 'goblin.glb', height: 1.5, rotY: Math.PI },
      archer: { file: 'archer.glb', height: 1.6, rotY: Math.PI },
      wolf: { file: 'wolf.glb', height: 1, rotY: Math.PI }, skeleton: { file: 'skeleton.glb', height: 1.7, rotY: Math.PI }, bat: { file: 'bat.glb', height: 0.9, rotY: Math.PI },
      spider: { file: 'spider.glb', height: 0.8, rotY: Math.PI }, mushroom: { file: 'mushroom.glb', height: 1.3, rotY: Math.PI },
      // Optional Kenney Nature Kit GLBs from a public mirror; procedural scenery is the offline fallback.
      tree: { url: 'https://raw.githubusercontent.com/Hidencod/tge-assets/main/packs/nature-kit/tree-default.glb', height: 5.2 },
      pine: { url: 'https://raw.githubusercontent.com/Hidencod/tge-assets/main/packs/nature-kit/tree-pinetalla.glb', height: 5.2 },
      bush: { url: 'https://raw.githubusercontent.com/Hidencod/tge-assets/main/packs/nature-kit/plant-bush.glb', height: 0.9 },
      rock: { url: 'https://raw.githubusercontent.com/Hidencod/tge-assets/main/packs/nature-kit/rock-smalla.glb', height: 0.8 },
      mushroomProp: { url: 'https://raw.githubusercontent.com/Hidencod/tge-assets/main/packs/nature-kit/mushroom-red.glb', height: 0.65 },
      coin: { url: 'https://raw.githubusercontent.com/Hidencod/tge-assets/main/packs/mini-dungeon/coin.glb', height: 0.42 },
      potion: { url: 'https://raw.githubusercontent.com/Hidencod/tge-assets/main/packs/mini-dungeon/potion.glb', height: 0.46 }
    },
    sounds: {
      door: ['door.ogg', 'door.mp3', 'door.wav'], chest: ['chest.ogg', 'chest.mp3', 'chest.wav'],
      boss: ['boss.ogg', 'boss.mp3', 'boss.wav'], hit: ['hit.ogg', 'hit.mp3', 'hit.wav'],
      swing: ['swing.ogg', 'swing.mp3', 'swing.wav'], death: ['death.ogg', 'death.mp3', 'death.wav'],
      pickup: ['pickup.ogg', 'pickup.mp3', 'pickup.wav'], equip: ['equip.ogg', 'equip.mp3', 'equip.wav'],
      place: ['place.ogg', 'place.mp3', 'place.wav'], break: ['break.ogg', 'break.mp3', 'break.wav']
    }
  };
  var A = G.assets = { manifest: MANIFEST }, tpl = {}, bufs = {}, raw = {}, pending = 0, timer = null, wrapped = false, envRefreshed = false;

  // glTF materials are PBR but the game has no lights: convert to unlit basic materials (colour space matched to linear output)
  function toBasic(src, cache) {
    if (Array.isArray(src)) return src.map(function (m) { return toBasic(m, cache); });
    if (cache[src.uuid]) return cache[src.uuid];
    var m = new THREE.MeshBasicMaterial({ color: 0xffffff, map: src.map || null, vertexColors: !!src.vertexColors, transparent: !!src.transparent, opacity: src.opacity,
      alphaTest: src.alphaTest || 0, side: src.side, fog: true });
    if (src.color) { m.color.copy(src.color); if (m.color.convertLinearToSRGB) m.color.convertLinearToSRGB(); }
    if (m.map) m.map.encoding = THREE.LinearEncoding;
    cache[src.uuid] = m; return m;
  }
  function fit(scene, def) {
    var cache = {}, box, size, c, s, wrap = new THREE.Group(), inner = new THREE.Group();
    scene.traverse(function (o) { if (o.isMesh) o.material = toBasic(o.material, cache); });
    inner.add(scene); inner.updateMatrixWorld(true);
    box = new THREE.Box3().setFromObject(inner); size = box.getSize(new THREE.Vector3()); c = box.getCenter(new THREE.Vector3());
    s = size.y > 1e-6 ? def.height / size.y : 1;
    inner.scale.setScalar(s); inner.position.set(-c.x * s, -box.min.y * s, -c.z * s);
    wrap.add(inner); wrap.rotation.y = def.rotY || 0;
    return wrap;
  }
  A.has = function (name) { return !!tpl[name]; };
  A.model = function (name) {
    var t = tpl[name];
    if (!t) return null;
    var c = t.clone(true);
    c.userData = {};
    return c;
  };
  A.sound = function (name) {
    var b = bufs[name], ctx = G.audio && G.audio.ctx;
    if (!b || !ctx || ctx.state !== 'running') return false;
    var s = ctx.createBufferSource(); s.buffer = b; s.connect(G.audio.master); s.start(0);
    return true;
  };
  // decoding needs an AudioContext, which only exists after the first user gesture
  function decodeAll() {
    var ctx = G.audio && G.audio.ctx;
    if (!ctx) return;
    Object.keys(raw).forEach(function (n) {
      var ab = raw[n]; delete raw[n];
      function ok(buf) { bufs[n] = buf; pending--; }
      function bad() { pending--; }
      try { var p = ctx.decodeAudioData(ab, ok, bad); if (p && p.catch) p.catch(function () {}); } catch (e) { pending--; }
    });
    if (!pending && timer) { clearInterval(timer); timer = null; }
  }
  function loadModel(name, def) {
    return new Promise(function (done) {
      try {
        new THREE.GLTFLoader().load(def.url || ('assets/models/' + def.file), function (g) {
          try { tpl[name] = fit(g.scene, def); } catch (e) {}
          if (!envRefreshed && A.has('tree') && A.has('pine') && A.has('bush') && A.has('rock') && G.world && G.world.refreshDecor) { envRefreshed = true; G.world.refreshDecor(); }
          done();
        }, undefined, function () { done(); });
      } catch (e) { done(); }
    });
  }
  function loadSound(name, files) {
    return files.reduce(function (p, f) {
      return p.then(function (got) {
        if (got) return true;
        return fetch('assets/sfx/' + f).then(function (r) { return r.ok ? r.arrayBuffer() : null; }).then(function (ab) {
          if (ab && ab.byteLength > 64) { raw[name] = ab; pending++; return true; }
          return false;
        }).catch(function () { return false; });
      });
    }, Promise.resolve(false));
  }
  A.load = function () {
    if (!wrapped) {
      wrapped = true;
      var base = G.audio.play;
      G.audio.play = function (n) {
        if (pending && G.audio.ctx) decodeAll();
        if (A.sound(n)) return;
        base.call(G.audio, n);
      };
    }
    var jobs = [], k;
    if (window.THREE && THREE.GLTFLoader) for (k in MANIFEST.models) jobs.push(loadModel(k, MANIFEST.models[k]));
    if (window.fetch) for (k in MANIFEST.sounds) jobs.push(loadSound(k, MANIFEST.sounds[k]));
    return Promise.all(jobs).then(function () {
      if (!envRefreshed && (A.has('tree') || A.has('pine') || A.has('bush') || A.has('rock')) && G.world && G.world.refreshDecor) { envRefreshed = true; G.world.refreshDecor(); }
      if (pending && !timer) timer = setInterval(decodeAll, 500);
    }, function () {});
  };
  /* ---------- REGISTRY + BUDGETS + VALIDATE (read-only views over existing data; see ART.md) ---------- */
  // voxel = one box (12 tris); item icons count filled grid cells
  A.budgets = {
    character: { voxels: 24, tris: 288 }, mob_s: { voxels: 16, tris: 192 }, mob_m: { voxels: 20, tris: 240 }, mob_l: { voxels: 28, tris: 336 },
    prop_s: { voxels: 40, tris: 480 }, prop_l: { voxels: 120, tris: 1440 }, item: { voxels: 96, tris: 0 }
  };
  var REQ_PROPS = ['gate', 'door', 'chest', 'portal'], statC = {};
  function rigEntry(id, cat, name, spec) {
    return { id: id, cat: cat, name: name, spec: spec, make: function () { var r = G.rig.build(spec, 0); return { obj: r.group, rig: r, dispose: function () {} }; } };
  }
  // all assets: [{id, cat:'model'|'mob'|'prop'|'item', name, make()->{obj,rig,dispose}|null, spec?, item?}]
  A.registry = function () {
    var out = [], T = G.enemies && G.enemies.types, V = G.dungeon && G.dungeon.visuals, B = G.items && G.items.BASES, k, slot, bl;
    if (G.player && G.player.makeSpec && G.rig) out.push(rigEntry('player', 'model', 'Người chơi', G.player.makeSpec({ name: 'Kiếm sắt', rarity: 0 })));
    if (T && G.rig) for (k in T) out.push(rigEntry(k, 'mob', k, T[k].spec || { height: T[k].height || 1, parts: [] }));
    if (G.boss && G.boss.spec && G.rig) out.push(rigEntry('boss', 'mob', G.boss.name || 'boss', G.boss.spec));
    if (V) Object.keys(V).forEach(function (n) {
      var f = V[n];
      if (typeof f !== 'function' || f.length !== 0) return;
      out.push({ id: n, cat: 'prop', name: n, make: function () { var o = f(); return { obj: o, rig: null, dispose: function () { o.traverse(function (c) { if (c.geometry) c.geometry.dispose(); }); } }; } });
    });
    if (B && G.icons) for (slot in B) B[slot].forEach(function (b) {
      var kind = G.icons.kindOf({ name: b.name, slot: slot });
      out.push({ id: kind, cat: 'item', name: b.name, slot: slot, make: null, item: { name: b.name, slot: slot, rarity: 0 } });
    });
    return out;
  };
  function cellCount(kind) {
    var g = G.icons && G.icons.GRID && G.icons.GRID[kind], n = 0, y, x;
    if (!g) return 0;
    for (y = 0; y < g.length; y++) for (x = 0; x < g[y].length; x++) if (g[y].charAt(x) !== '.' && g[y].charAt(x) !== ' ') n++;
    return n;
  }
  // stats(entry) -> {voxels, tris, height, cls, colors[]}  (cached per id+cat)
  A.stats = function (e) {
    var key = e.cat + ':' + e.id, st = statC[key], m, o, box, cols = {}, i, p;
    if (st) return st;
    st = { voxels: 0, tris: 0, height: 0, cls: 'item', colors: [] };
    if (e.cat === 'item') { st.voxels = cellCount(e.id); st.cls = 'item'; }
    else {
      m = e.make(); o = m.obj;
      o.traverse(function (c) {
        var g = c.geometry, mt = c.material;
        if (!c.isMesh || !g) return;
        if (g.type === 'BoxGeometry') st.voxels++;
        st.tris += g.index ? g.index.count / 3 : (g.attributes.position ? g.attributes.position.count / 3 : 0);
        if (e.cat === 'prop' && mt && mt.color && !mt.transparent) cols[mt.color.getHex()] = 1;
      });
      if (e.spec) for (i = 0; i < e.spec.parts.length; i++) { p = e.spec.parts[i]; if (p.size) { cols[p.color] = 1; if (p.color2) cols[p.color2] = 1; } }
      // size from box meshes only (ignores tall glow beams); GLB models fall back to the whole bounding box
      o.updateMatrixWorld(true); box = new THREE.Box3(); var bb = new THREE.Box3(), any = false;
      o.traverse(function (c) { if (c.isMesh && c.geometry && c.geometry.type === 'BoxGeometry') { c.geometry.computeBoundingBox(); bb.copy(c.geometry.boundingBox).applyMatrix4(c.matrixWorld); box.union(bb); any = true; } });
      if (!any) box.setFromObject(o);
      st.height = Math.round((box.max.y - box.min.y) * 100) / 100; st.width = Math.round(Math.max(box.max.x - box.min.x, box.max.z - box.min.z) * 100) / 100;
      st.colors = Object.keys(cols).map(Number);
      if (e.cat === 'model') st.cls = 'character';
      else if (e.cat === 'mob') { i = (e.spec && e.spec.height) || st.height; st.cls = i <= 1 ? 'mob_s' : i <= 2 ? 'mob_m' : 'mob_l'; }
      else st.cls = st.height <= 1.5 ? 'prop_s' : 'prop_l';
      m.dispose();
    }
    return (statC[key] = st);
  };
  // validate() -> {total, counts, missing[{id,why}], overBudget[{id,cat,cls,voxels,tris,maxVoxels,maxTris}], offPalette[{id,total,off[{hex,nearest,dist}]}], errors[], issues}
  A.validate = function () {
    var rep = { total: 0, counts: { model: 0, mob: 0, prop: 0, item: 0 }, missing: [], overBudget: [], offPalette: [], errors: [], issues: 0 };
    var reg = A.registry(), seen = {}, ids = {}, T = G.enemies && G.enemies.types, V = G.dungeon && G.dungeon.visuals, S = G.loot && G.loot.sources, k;
    function miss(id, why) { rep.missing.push({ id: id, why: why }); }
    rep.total = reg.length;
    reg.forEach(function (e) {
      var key = e.cat + ':' + e.id, st, b, off = [];
      rep.counts[e.cat]++; ids[e.id] = 1;
      if (seen[key]) miss(e.id, 'id trùng trong nhóm ' + e.cat); seen[key] = 1;
      if (e.cat === 'item' && !(G.icons && G.icons.GRID && G.icons.GRID[e.id])) miss(e.id, 'vật phẩm "' + e.name + '" chưa có icon (GRID)');
      if (e.cat === 'mob' && e.spec && !e.spec.parts.length) miss(e.id, 'mob chưa có spec');
      try { st = A.stats(e); } catch (err) { rep.errors.push(e.id + ': ' + err.message); return; }
      b = A.budgets[st.cls];
      if (b && (st.voxels > b.voxels || st.tris > b.tris)) rep.overBudget.push({ id: e.id, cat: e.cat, cls: st.cls, voxels: st.voxels, tris: st.tris, maxVoxels: b.voxels, maxTris: b.tris });
      if (G.palette) {
        st.colors.forEach(function (c) { var n = G.palette.nearest(c); if (n.dist > 30) off.push({ hex: c, nearest: n.id, dist: n.dist }); });
        if (off.length) rep.offPalette.push({ id: e.id, cat: e.cat, total: st.colors.length, off: off });
      } else if (!rep.paletteMissing) { rep.paletteMissing = true; miss('palette', 'Game.palette chưa được nạp'); }
    });
    for (k in MANIFEST.models) if (!ids[k]) miss(k, 'có trong manifest nhưng không có định nghĩa mob/prop/model');
    if (T) for (k in T) if (T[k].ai && !T[T[k].ai]) miss(k, 'ai "' + T[k].ai + '" không tồn tại');
    if (S && T) for (k in S) if (!T[k] && k !== 'boss' && k !== 'chest' && k !== 'misc') miss(k, 'loot.sources trỏ tới mob không tồn tại');
    if (V) REQ_PROPS.forEach(function (n) { if (typeof V[n] !== 'function') miss(n, 'dungeon.visuals thiếu prop'); });
    rep.issues = rep.missing.length + rep.overBudget.length + rep.offPalette.length + rep.errors.length;
    return rep;
  };
})();
