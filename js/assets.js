(function () {
  var G = window.Game = window.Game || {};
  // Immutable upstream commits for remote GLB mirrors. legacyUrl is used only to
  // migrate an old IndexedDB entry after its bytes pass Git blob SHA-1 verification.
  var QUATERNIUS_REV = '0c41526d8d4130c37c15e219c2c3737fa8cb4ad8';
  var KENNEY_MIRROR_REV = 'ea2f2aa1ca8da0898330c97df8a5489976b051d0';
  var QUATERNIUS_MODEL_BASE = 'https://raw.githubusercontent.com/anshaneja5/skyline-run/' + QUATERNIUS_REV + '/public/assets/models/';
  var KENNEY_PACK_BASE = 'https://raw.githubusercontent.com/Hidencod/tge-assets/' + KENNEY_MIRROR_REV + '/packs/';
  var QUATERNIUS_LEGACY_BASE = 'https://raw.githubusercontent.com/anshaneja5/skyline-run/main/public/assets/models/';
  var KENNEY_LEGACY_BASE = 'https://raw.githubusercontent.com/Hidencod/tge-assets/main/packs/';

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
      // Quaternius Stylized Nature MegaKit (CC0 1.0); source blobs are recorded in ASSETS.md.
      // All three broadleaf variants use byte-identical WebP payloads with matching texture/material JSON.
      // Hashes are indexed by glTF texture index, not image index.
      tree: { url: QUATERNIUS_MODEL_BASE + 'tree1.glb', legacyUrl: QUATERNIUS_LEGACY_BASE + 'tree1.glb', blobSha: '80bd662cc51f983986f4e201463dc3a729a6cd4a', blobBytes: 516044, textureShareGroup: 'quaternius-broadleaf-v1', textureShareSha256: ['d306b69fcf72198270e6d6d57af6e77533003d515748db7deae3cf719b88eeb6', '5f5a3b076667c254b44ea49a183c768da0f0b2b39b5f203b5e584b2321952c94', 'b84891a51b70278ac9c2345736d18aa22f124bdeac1a6c76b413a3b29e4bea29'], height: 4.8 },
      tree2: { url: QUATERNIUS_MODEL_BASE + 'tree2.glb', legacyUrl: QUATERNIUS_LEGACY_BASE + 'tree2.glb', blobSha: '0197de65879eb650247c8d56ac52da34489938cb', blobBytes: 446732, textureShareGroup: 'quaternius-broadleaf-v1', textureShareSha256: ['d306b69fcf72198270e6d6d57af6e77533003d515748db7deae3cf719b88eeb6', '5f5a3b076667c254b44ea49a183c768da0f0b2b39b5f203b5e584b2321952c94', 'b84891a51b70278ac9c2345736d18aa22f124bdeac1a6c76b413a3b29e4bea29'], height: 4.55 },
      tree3: { url: QUATERNIUS_MODEL_BASE + 'tree3.glb', legacyUrl: QUATERNIUS_LEGACY_BASE + 'tree3.glb', blobSha: '828786b4bdb5224a8b3672f5e5d6cebe1c65bd93', blobBytes: 332440, textureShareGroup: 'quaternius-broadleaf-v1', textureShareSha256: ['d306b69fcf72198270e6d6d57af6e77533003d515748db7deae3cf719b88eeb6', '5f5a3b076667c254b44ea49a183c768da0f0b2b39b5f203b5e584b2321952c94', 'b84891a51b70278ac9c2345736d18aa22f124bdeac1a6c76b413a3b29e4bea29'], height: 4.7 },
      bush: { url: QUATERNIUS_MODEL_BASE + 'bush.glb', legacyUrl: QUATERNIUS_LEGACY_BASE + 'bush.glb', blobSha: '84b4153c17e988a658e56d4093b0028d1b034c3f', blobBytes: 108520, height: 0.95 },
      // Kenney Nature Kit / Mini Dungeon models (CC0 1.0).
      pine: { url: KENNEY_PACK_BASE + 'nature-kit/tree-pinetalla.glb', legacyUrl: KENNEY_LEGACY_BASE + 'nature-kit/tree-pinetalla.glb', blobSha: 'b064580b04a93cea7cbb76f83dd880a55f530fed', blobBytes: 7200, height: 4.9 },
      rock: { url: KENNEY_PACK_BASE + 'nature-kit/rock-smalla.glb', legacyUrl: KENNEY_LEGACY_BASE + 'nature-kit/rock-smalla.glb', blobSha: 'b23471253cfafcca5916ffddb79853eca7433195', blobBytes: 3044, height: 0.8 },
      mushroomProp: { url: KENNEY_PACK_BASE + 'nature-kit/mushroom-red.glb', legacyUrl: KENNEY_LEGACY_BASE + 'nature-kit/mushroom-red.glb', blobSha: '3420847cd67ed2403a40c78fcacf8b57f8e6c20c', blobBytes: 6364, height: 0.65 },
      coin: { url: KENNEY_PACK_BASE + 'mini-dungeon/coin.glb', legacyUrl: KENNEY_LEGACY_BASE + 'mini-dungeon/coin.glb', blobSha: '5d0ff9df2d53956151b1adefc0d0a99ce549fdd6', blobBytes: 32988, height: 0.42 }
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
  var modelQueue = [], modelStates = Object.create(null), activeModelLoads = 0, MAX_MODEL_LOADS = 2;
  var soundQueue = [], soundStates = Object.create(null), activeSoundLoad = false, decorRefreshTimer = null;

  // Use rough, lit materials instead of unlit plastic-looking colours. Preserve GLTF colour/texture data;
  // external GLB maps are already configured by GLTFLoader and should not be forced into another encoding.
  function keepPBR(src) {
    if (Array.isArray(src)) return src.map(keepPBR);
    // Keep the GLTF PBR material and embedded texture intact. Replacing it with
    // MeshBasicMaterial was washing out lighting and making foliage look plastic.
    if (src && src.isMeshStandardMaterial) {
      src.roughness = Math.max(0.82, src.roughness == null ? 1 : src.roughness);
      src.metalness = 0;
      src.envMapIntensity = 0.25;
      src.needsUpdate = true;
    }
    return src;
  }
  function fit(scene, def) {
    var box, size, c, s, wrap = new THREE.Group(), inner = new THREE.Group();
    scene.traverse(function (o) { if (o.isMesh) o.material = keepPBR(o.material); });
    inner.add(scene); inner.updateMatrixWorld(true);
    box = new THREE.Box3().setFromObject(inner); size = box.getSize(new THREE.Vector3()); c = box.getCenter(new THREE.Vector3());
    s = size.y > 1e-6 ? def.height / size.y : 1;
    inner.scale.setScalar(s); inner.position.set(-c.x * s, -box.min.y * s, -c.z * s);
    wrap.add(inner); wrap.rotation.y = def.rotY || 0;
    return wrap;
  }

  // Share only audited GLB texture payloads whose glTF definition, sampler and material slot match.
  // Geometry and Material objects remain per-template; only THREE.Texture references are pooled.
  var sharedModelTextures = Object.create(null);
  function shareModelTextures(gltf, def, root) {
    var parser = gltf && gltf.parser, json = parser && parser.json, associations = parser && parser.associations;
    if (!def || !def.textureShareGroup || !Array.isArray(def.textureShareSha256) ||
        !json || !associations || typeof associations.get !== 'function') return 0;
    var oldTextures = [], replaced = 0;
    function visitMaterial(material) {
      if (!material || typeof material !== 'object') return;
      Object.keys(material).forEach(function (slot) {
        var texture = material[slot], association, index, expected, textureDef, imageIndex, imageDef, samplerDef, signature, key, cached;
        if (!texture || !texture.isTexture) return;
        association = associations.get(texture);
        if (!association || association.type !== 'textures') return;
        index = association.index;
        expected = def.textureShareSha256[index];
        if (typeof expected !== 'string' || !/^[0-9a-f]{64}$/i.test(expected)) return;
        textureDef = json.textures && json.textures[index];
        if (!textureDef) return;
        imageIndex = textureDef.source;
        if (textureDef.extensions && textureDef.extensions.EXT_texture_webp) imageIndex = textureDef.extensions.EXT_texture_webp.source;
        if (textureDef.extensions && textureDef.extensions.KHR_texture_basisu) imageIndex = textureDef.extensions.KHR_texture_basisu.source;
        imageDef = json.images && json.images[imageIndex];
        if (imageIndex === undefined || !imageDef || !imageDef.mimeType) return;
        samplerDef = textureDef.sampler === undefined ? {} : ((json.samplers || [])[textureDef.sampler] || {});
        signature = JSON.stringify({
          sha256: expected.toLowerCase(),
          texture: textureDef,
          sampler: samplerDef,
          image: { mimeType: imageDef.mimeType, name: imageDef.name || '' },
          slot: slot
        });
        key = def.textureShareGroup + ':' + index + ':' + slot;
        cached = sharedModelTextures[key];
        if (!cached) {
          sharedModelTextures[key] = { signature: signature, texture: texture };
          return;
        }
        if (cached.signature !== signature || cached.texture === texture || cached.disposed) return;
        material[slot] = cached.texture;
        oldTextures.push(texture);
        replaced++;
      });
    }
    root.traverse(function (object) {
      if (!object.isMesh || !object.material) return;
      if (Array.isArray(object.material)) object.material.forEach(visitMaterial);
      else visitMaterial(object.material);
    });
    if (!oldTextures.length) return replaced;
    var liveTextures = [];
    function markLive(material) {
      if (!material || typeof material !== 'object') return;
      Object.keys(material).forEach(function (slot) {
        var texture = material[slot];
        if (texture && texture.isTexture && liveTextures.indexOf(texture) < 0) liveTextures.push(texture);
      });
    }
    root.traverse(function (object) {
      if (!object.isMesh || !object.material) return;
      if (Array.isArray(object.material)) object.material.forEach(markLive);
      else markLive(object.material);
    });
    oldTextures.forEach(function (texture) {
      if (liveTextures.indexOf(texture) >= 0 || texture.userData && texture.userData.assetTextureDisposed) return;
      texture.userData = texture.userData || {};
      texture.userData.assetTextureDisposed = true;
      if (texture.dispose) texture.dispose();
    });
    return replaced;
  }
  A.has = function (name) { return !!tpl[name]; };
  function requestModel(name) {
    if (!MANIFEST.models[name] || tpl[name] || modelStates[name]) return false;
    modelStates[name] = 'queued';
    modelQueue.push(name);
    pumpModelQueue();
    return true;
  }
  function pumpModelQueue() {
    while (activeModelLoads < MAX_MODEL_LOADS && modelQueue.length) {
      var name = modelQueue.shift();
      if (modelStates[name] !== 'queued') continue;
      modelStates[name] = 'loading';
      activeModelLoads++;
      (function (modelName) {
        Promise.resolve().then(function () {
          return loadModel(modelName, MANIFEST.models[modelName]);
        }).then(function () {
          modelStates[modelName] = tpl[modelName] ? 'ready' : 'failed';
        }, function () {
          modelStates[modelName] = 'failed';
        }).then(function () {
          activeModelLoads--;
          pumpModelQueue();
        });
      })(name);
    }
  }
  function requestSound(name) {
    if (!MANIFEST.sounds[name] || bufs[name] || raw[name] || soundStates[name]) return false;
    soundStates[name] = 'queued';
    soundQueue.push(name);
    pumpSoundQueue();
    return true;
  }
  function pumpSoundQueue() {
    if (activeSoundLoad) return;
    while (soundQueue.length) {
      var name = soundQueue.shift();
      if (soundStates[name] !== 'queued') continue;
      activeSoundLoad = true;
      soundStates[name] = 'loading';
      (function (soundName) {
        loadSound(soundName, MANIFEST.sounds[soundName]).then(function (loaded) {
          soundStates[soundName] = loaded ? 'ready' : 'failed';
        }, function () {
          soundStates[soundName] = 'failed';
        }).then(function () {
          activeSoundLoad = false;
          if (pending && G.audio && G.audio.ctx) decodeAll();
          pumpSoundQueue();
        });
      })(name);
      return;
    }
  }
  var ENVIRONMENT_MODELS = ['tree', 'tree2', 'tree3', 'pine', 'bush', 'rock', 'mushroomProp'];
  function scheduleDecorRefresh(name) {
    if (ENVIRONMENT_MODELS.indexOf(name) < 0 || !G.world || !G.world.refreshDecor) return;
    if (decorRefreshTimer) clearTimeout(decorRefreshTimer);
    // Coalesce nearby model completions into one chunk rebuild instead of rebuilding for every GLB.
    decorRefreshTimer = setTimeout(function () {
      decorRefreshTimer = null;
      if (G.world && G.world.refreshDecor) G.world.refreshDecor();
    }, 650);
  }
  A.requestModel = requestModel;
  A.requestSound = requestSound;
  A.modelStatus = function (name) { return modelStates[name] || (tpl[name] ? 'ready' : 'idle'); };
  A.model = function (name) {
    var t = tpl[name];
    if (!t) { requestModel(name); return null; }
    var c = t.clone(true);
    c.userData = {};
    // Mesh.copy() shares geometry/material with the cached template; mark these refs as borrowed.
    c.traverse(function (o) {
      if (o.isMesh) {
        o.userData = o.userData || {};
        o.userData.sharedAssetResources = true;
      }
    });
    return c;
  };
  A.disposeInstance = function (root) {
    if (!root || typeof root.traverse !== 'function') return;
    root.userData = root.userData || {};
    if (root.userData.assetInstanceDisposed) return;
    root.userData.assetInstanceDisposed = true;
    var geometries = [], materials = [];
    root.traverse(function (o) {
      if (!o.isMesh || (o.userData && o.userData.sharedAssetResources)) return;
      var g = o.geometry;
      if (g && geometries.indexOf(g) < 0) {
        geometries.push(g);
        if (g.dispose) g.dispose();
      }
      var list = Array.isArray(o.material) ? o.material : [o.material];
      list.forEach(function (m) {
        if (!m || materials.indexOf(m) >= 0) return;
        materials.push(m);
        if (m.dispose) m.dispose();
      });
    });
  };
  A.sound = function (name) {
    var b = bufs[name], ctx = G.audio && G.audio.ctx;
    if (!b) { requestSound(name); return false; }
    if (!ctx || ctx.state !== 'running') return false;
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
  // Persist downloaded GLB buffers in IndexedDB. A first-ever offline launch still uses the
  // procedural fallback, but any model successfully loaded once is reusable with no network.
  var modelDBPromise = null;
  function openModelDB() {
    if (!window.indexedDB) return Promise.resolve(null);
    if (!modelDBPromise) modelDBPromise = new Promise(function (resolve) {
      try {
        var req = window.indexedDB.open('besidevalley-model-cache', 1);
        req.onupgradeneeded = function () {
          var db = req.result;
          if (!db.objectStoreNames.contains('models')) db.createObjectStore('models');
        };
        req.onsuccess = function () { resolve(req.result); };
        req.onerror = function () { resolve(null); };
        req.onblocked = function () { resolve(null); };
      } catch (e) { resolve(null); }
    });
    return modelDBPromise;
  }
  function readModelBuffer(url) {
    return openModelDB().then(function (db) {
      return new Promise(function (resolve) {
        if (!db) return resolve(null);
        try {
          var req = db.transaction('models', 'readonly').objectStore('models').get(url);
          req.onsuccess = function () { resolve(req.result instanceof ArrayBuffer ? req.result : null); };
          req.onerror = function () { resolve(null); };
        } catch (e) { resolve(null); }
      });
    });
  }
  function writeModelBuffer(url, buffer) {
    return openModelDB().then(function (db) {
      return new Promise(function (resolve) {
        if (!db) return resolve(false);
        try {
          var tx = db.transaction('models', 'readwrite');
          tx.objectStore('models').put(buffer.slice(0), url);
          tx.oncomplete = function () { resolve(true); };
          tx.onerror = function () { resolve(false); };
          tx.onabort = function () { resolve(false); };
        } catch (e) { resolve(false); }
      });
    });
  }
  function verifyGitBlob(buffer, expectedSha) {
    var subtle = window.crypto && window.crypto.subtle;
    if (!(buffer instanceof ArrayBuffer) || !expectedSha || !subtle || !subtle.digest) return Promise.resolve(false);
    // Git hashes bytes with the "blob <size>" header followed by one NUL byte.
    var header = 'blob ' + buffer.byteLength + String.fromCharCode(0), bytes = new Uint8Array(header.length + buffer.byteLength), i;
    for (i = 0; i < header.length; i++) bytes[i] = header.charCodeAt(i);
    bytes.set(new Uint8Array(buffer), header.length);
    return subtle.digest('SHA-1', bytes).then(function (digest) {
      var view = new Uint8Array(digest), hex = '';
      for (i = 0; i < view.length; i++) { var part = view[i].toString(16); hex += part.length === 1 ? '0' + part : part; }
      return hex === expectedSha;
    }).catch(function () { return false; });
  }
  function getModelBuffer(def) {
    return readModelBuffer(def.url).then(function (cached) {
      if (cached) return cached;
      // Reuse a pre-pin IndexedDB entry only when its exact bytes match the pinned Git blob.
      if (!def.legacyUrl || !def.blobSha) return null;
      return readModelBuffer(def.legacyUrl).then(function (legacy) {
        if (!legacy) return null;
        return verifyGitBlob(legacy, def.blobSha).then(function (valid) {
          if (!valid) return null;
          return writeModelBuffer(def.url, legacy).then(function () { return legacy; });
        });
      });
    }).then(function (cached) {
      if (cached) return cached;
      if (!window.fetch) return null;
      return fetch(def.url, { mode: 'cors', cache: 'force-cache' }).then(function (response) {
        if (!response.ok) throw new Error('GLB request failed: ' + response.status);
        return response.arrayBuffer();
      }).then(function (buffer) {
        return writeModelBuffer(def.url, buffer).then(function () { return buffer; });
      });
    }).catch(function () { return null; });
  }
  function loadModel(name, def) {
    return new Promise(function (done) {
      var finished = false;
      function finish() { if (finished) return; finished = true; done(); }
      function loaded(g) {
        try {
          tpl[name] = fit(g.scene, def);
          shareModelTextures(g, def, tpl[name]);
        } catch (e) {}
        scheduleDecorRefresh(name);
        finish();
      }
      function fallbackLoad() {
        try {
          new THREE.GLTFLoader().load(def.url || ('assets/models/' + def.file), loaded, undefined, finish);
        } catch (e) { finish(); }
      }
      if (!def.url || !window.fetch || !THREE.GLTFLoader || !THREE.GLTFLoader.prototype.parse) {
        fallbackLoad(); return;
      }
      getModelBuffer(def).then(function (buffer) {
        if (!buffer) { fallbackLoad(); return; }
        try {
          new THREE.GLTFLoader().parse(buffer, '', loaded, function () { fallbackLoad(); });
        } catch (e) { fallbackLoad(); }
      }).catch(fallbackLoad);
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
    // Startup installs request hooks only. Models and sounds enter bounded queues when first used.
    return Promise.resolve();
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
      out.push({ id: n, cat: 'prop', name: n, make: function () { var o = f(); return { obj: o, rig: null, dispose: function () { A.disposeInstance(o); } }; } });
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
