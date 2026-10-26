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
      spider: { file: 'spider.glb', height: 0.8, rotY: Math.PI }, mushroom: { file: 'mushroom.glb', height: 1.3, rotY: Math.PI }
    },
    sounds: {
      door: ['door.ogg', 'door.mp3', 'door.wav'], chest: ['chest.ogg', 'chest.mp3', 'chest.wav'],
      boss: ['boss.ogg', 'boss.mp3', 'boss.wav'], hit: ['hit.ogg', 'hit.mp3', 'hit.wav'],
      swing: ['swing.ogg', 'swing.mp3', 'swing.wav'], death: ['death.ogg', 'death.mp3', 'death.wav'],
      pickup: ['pickup.ogg', 'pickup.mp3', 'pickup.wav'], equip: ['equip.ogg', 'equip.mp3', 'equip.wav'],
      place: ['place.ogg', 'place.mp3', 'place.wav'], break: ['break.ogg', 'break.mp3', 'break.wav']
    }
  };
  var A = G.assets = { manifest: MANIFEST }, tpl = {}, bufs = {}, raw = {}, pending = 0, timer = null, wrapped = false;

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
        new THREE.GLTFLoader().load('assets/models/' + def.file, function (g) {
          try { tpl[name] = fit(g.scene, def); } catch (e) {}
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
      if (pending && !timer) timer = setInterval(decodeAll, 500);
    }, function () {});
  };
})();
