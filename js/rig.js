// Game.rig: tiny part-tree rig for chunky voxel creatures (shared geometry + materials, procedural animation).
// spec = { height, center?, scale?, lunge?, atk?:['armR'], gait?:{hop,quad,fly:{h,amp,rate},crawl}, parts:[part(...)] }
// part(name, parent|null, size[w,h,d], pivot[x,y,z] (box centre relative to its joint), pos[x,y,z] (joint relative to parent joint), color, extra)
// extra: color2 (trim band on the lower 30%), rot[x,y,z] rest rotation, flat (unshaded), role (anim role, default name), ph (phase), size=null -> joint only
(function () {
  var G = window.Game = window.Game || {};
  var R = G.rig = {}, geo = null, shadedC = {}, flatC = {};
  function unitGeo() {
    if (geo) return geo;
    geo = new THREE.BoxGeometry(1, 1, 1);
    var n = geo.attributes.normal, c = new Float32Array(n.count * 3), i, s, ny;
    for (i = 0; i < n.count; i++) {
      ny = n.getY(i);
      s = ny > 0.5 ? 1 : ny < -0.5 ? 0.5 : Math.abs(n.getX(i)) > 0.5 ? 0.74 : 0.87;
      c[i * 3] = c[i * 3 + 1] = c[i * 3 + 2] = s;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(c, 3));
    return geo;
  }
  function hash01(s) {
    var h = 2166136261, i;
    for (i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    h ^= h >>> 15; h = Math.imul(h, 2246822519); h ^= h >>> 13;
    return (h >>> 0) / 4294967296;
  }
  function vary(hex, key) {
    var f = 0.93 + Math.floor(hash01(key) * 5) * 0.035;
    var r = Math.min(255, Math.round(((hex >> 16) & 255) * f)), g = Math.min(255, Math.round(((hex >> 8) & 255) * f)), b = Math.min(255, Math.round((hex & 255) * f));
    return (r << 16) | (g << 8) | b;
  }
  function shaded(hex, key, seed) {
    var c = vary(hex, key + '|' + seed);
    return shadedC[c] || (shadedC[c] = new THREE.MeshBasicMaterial({ color: c, vertexColors: true }));
  }
  function flat(hex) { return flatC[hex] || (flatC[hex] = new THREE.MeshBasicMaterial({ color: hex })); }
  function ease(k) { return k * k * (3 - 2 * k); }

  R.part = function (name, parent, size, pivot, pos, color, x) {
    var p = { name: name, parent: parent, size: size, pivot: pivot, pos: pos, color: color };
    if (x) for (var k in x) p[k] = x[k];
    return p;
  };

  function Rig() {
    this.t = 0; this.phase = 0; this.sm = 0; this.speedV = 0; this.air = -1; this._pa = -1; this.landT = 0; this.autoHop = false; this.tiltX = 0;
    this.flashT = 0; this.tintHex = 0; this.mk = 0; this.atk = null; this.hurtT = 0; this.death = null; this.dead = false; this.disposed = false;
    this.off = Math.random() * 6.28; this.recs = []; this.role = {}; this.parts = {}; this.meshes = [];
  }
  var P = Rig.prototype;
  P.play = function (state, o) {
    o = o || {};
    if (state === 'idle' || state === 'walk') {
      this.speedV = state === 'walk' ? (o.speed || 3) : 0; this.autoHop = state === 'walk';
      if (this.death) { this.death = null; this.dead = false; }
    } else if (state === 'attack') this.atk = { t: 0, dur: Math.max(0.05, o.dur || 0.5), w: o.windup == null ? 0.35 : Math.min(0.9, o.windup) };
    else if (state === 'hurt') { this.hurtT = 0.28; this.flash(0.12); }
    else if (state === 'death' && !this.death) { this.death = { t: 0, dur: 0.6, cb: o.onDone || null, keep: !!o.keep, done: false }; this.atk = null; this.flash(0.1); }
  };
  P.flash = function (t) { this.flashT = Math.max(this.flashT, t || 0.12); this._m(); };
  P.tint = function (hex) { this.tintHex = hex || 0; this._m(); };
  P._m = function () {
    var want = this.flashT > 0 ? 2 : (this.tintHex ? 1 : 0), key = want === 2 ? 'f' : want === 1 ? this.tintHex : 0, i, m, ms = this.meshes;
    if (key === this.mk) return;
    this.mk = key; m = want === 2 ? flat(0xffffff) : want === 1 ? flat(this.tintHex) : null;
    for (i = 0; i < ms.length; i++) ms[i].material = m || ms[i].userData.base;
  };
  P._a = function (role, x, y, z) {
    var a = this.role[role], i;
    if (!a) return;
    for (i = 0; i < a.length; i++) { a[i].ax += x; a[i].ay += y; a[i].az += z; }
  };
  P.update = function (dt, speed) {
    var T = (this.t += dt), s = this.spec, g = s.gait || {}, d = this.death, sp = speed === undefined ? this.speedV : speed, off = this.off;
    var i, r, k, f, a, u, w, st, ang, lz, hd, jw, sq, e, sh, arr, al, ph;
    if (d) sp = 0;
    this.sm += (sp - this.sm) * Math.min(1, dt * 10); sp = this.sm;
    var walking = sp > 0.3, amt = Math.min(1.3, sp / 4), sw;
    if (walking) this.phase += dt * (4 + sp * 1.5) * (g.crawl ? 1.8 : 1);
    for (i = 0; i < this.recs.length; i++) { r = this.recs[i]; r.ax = r.ay = r.az = 0; }
    var rY = 0, rZ = 0, tX = this.tiltX, tZ = 0, sx = 1, sy = 1, bob = Math.sin(T * 2.4 + off);
    // idle: breathing bob, head sway
    rY += bob * 0.025;
    this._a('head', Math.sin(T * 2.4 + 1 + off) * 0.04, Math.sin(T * 1.3 + off) * 0.14, 0);
    this._a('tail', 0, Math.sin(T * 3 + off) * 0.25, 0);
    this._a('armL', 0, 0, -0.04 * bob); this._a('armR', 0, 0, 0.04 * bob);
    // walk
    if (walking) {
      sw = Math.sin(this.phase) * amt; k = g.quad ? 0.75 : 0.9;
      this._a('legL', sw * k, 0, 0); this._a('legR', -sw * k, 0, 0);
      this._a('legFL', sw * k, 0, 0); this._a('legBR', sw * k, 0, 0); this._a('legFR', -sw * k, 0, 0); this._a('legBL', -sw * k, 0, 0);
      this._a('armL', -sw * 0.7, 0, 0); this._a('armR', sw * 0.7, 0, 0);
      this._a('torso', g.quad ? Math.sin(this.phase * 2) * 0.05 : 0, sw * 0.06, 0); this._a('head', 0, -sw * 0.05, 0);
      this._a('tail', 0, Math.sin(this.phase) * 0.3, 0);
      rY += Math.abs(Math.sin(this.phase)) * (g.quad ? 0.08 : 0.06) * amt;
    }
    if (g.crawl && (arr = this.role.leg)) {
      for (i = 0; i < arr.length; i++) {
        r = arr[i]; ph = r.ph;
        if (walking) { r.az += Math.sin(this.phase * 2 + ph) * 0.25 * amt; r.ax += Math.cos(this.phase * 2 + ph) * 0.35 * amt; }
        else r.az += Math.sin(T * 4 + ph) * 0.04;
      }
    }
    if (g.fly) {
      al = g.fly.amp || 0.18;
      rY += (g.fly.h || 0.8) + Math.sin(T * 3.1 + off) * al + Math.sin(T * 7.7 + off * 2) * al * 0.5;
      f = Math.sin(T * (g.fly.rate || 18)); e = Math.sin(T * (g.fly.rate || 18) - 0.9);
      this._a('wingL', 0, 0, -f * 0.7); this._a('wingR', 0, 0, f * 0.7); this._a('wingL2', 0, 0, -e * 0.9); this._a('wingR2', 0, 0, e * 0.9);
      tX -= 0.2 * amt;
    }
    if (g.hop) {
      u = this.autoHop ? ((T * 1.8) % 1) * 1.4 - 0.4 : this.air;
      if (u >= 0) { k = Math.sin(Math.PI * Math.min(1, u)); sy = 1 + 0.25 * k; sx = 1 - 0.12 * k; this.landT = 0; }
      else {
        if (this._pa >= 0) this.landT = 0.2;
        if (this.landT > 0) { this.landT -= dt; k = Math.max(0, this.landT / 0.2); sy = 1 - 0.25 * k; sx = 1 + 0.12 * k; }
        else { sy = 1 + Math.sin(T * 2.6 + off) * 0.05; sx = 1 - Math.sin(T * 2.6 + off) * 0.03; }
      }
      this._pa = u; rY = 0;
    }
    // attack: wind-up, strike, recover
    a = this.atk;
    if (a) {
      a.t += dt; u = a.t / a.dur; w = a.w; st = (1 - w) * 0.3;
      if (u >= 1) this.atk = null;
      else {
        if (u < w) { k = ease(u / w); ang = -2.4 * k; lz = 0.1 * k; hd = 0.25 * k; jw = -0.7 * k; sq = -0.2 * k; }
        else if (u < w + st) { k = (u - w) / st; k = 1 - (1 - k) * (1 - k); ang = -2.4 + 3.3 * k; lz = 0.1 - (0.1 + (s.lunge == null ? 0.35 : s.lunge)) * k; hd = 0.25 - 0.7 * k; jw = -0.7 + k; sq = -0.2 + 0.45 * k; }
        else { k = (u - w - st) / (1 - w - st); ang = 0.9 * (1 - k); lz = -(s.lunge == null ? 0.35 : s.lunge) * (1 - k); hd = -0.45 * (1 - k); jw = 0.3 * (1 - k); sq = 0.25 * (1 - k); }
        arr = s.atk || ['armR'];
        for (i = 0; i < arr.length; i++) this._a(arr[i], ang, 0, 0);
        this._a('head', hd, 0, 0); this._a('jaw', jw, 0, 0); this._a('torso', -hd * 0.4, 0, 0);
        rZ += lz;
        if (!this.hasArm) sy *= 1 + sq;
      }
    }
    if (this.hurtT > 0) {
      this.hurtT -= dt; k = Math.max(0, this.hurtT / 0.28);
      tX += 0.4 * k; rZ += 0.12 * k; this._a('head', 0.3 * k, 0, 0);
    }
    if (d) {
      d.t += dt; k = Math.min(1, d.t / d.dur); e = ease(k);
      tZ = e * 1.45; tX *= 1 - e; rY -= this.cy * 0.6 * e;
      if (!d.keep && k > 0.5) { sh = Math.max(0.001, 1 - (k - 0.5) * 2); sx *= sh; sy *= sh; }
      if (k >= 1 && !d.done) { d.done = true; this.dead = true; if (d.cb) d.cb(); }
    }
    if (this.flashT > 0) { this.flashT -= dt; if (this.flashT <= 0) { this.flashT = 0; this._m(); } }
    for (i = 0; i < this.recs.length; i++) { r = this.recs[i]; r.j.rotation.set(r.rx + r.ax, r.ry + r.ay, r.rz + r.az); }
    this.root.position.set(0, rY, rZ); this.root.scale.set(sx, sy, sx); this.pitch.rotation.set(tX, 0, tZ);
  };
  P.dispose = function () { if (this.group.parent) this.group.parent.remove(this.group); this.disposed = true; };

  R.build = function (spec, seed) {
    seed = seed | 0;
    var rig = new Rig(), cy = spec.center != null ? spec.center : (spec.height || 1) * 0.5, ge = unitGeo(), by = {}, i, p, j, rec, m, mt, rest, pos, sz, pv, par, arr;
    rig.spec = spec; rig.cy = cy;
    rig.group = new THREE.Group(); rig.root = new THREE.Group(); rig.pitch = new THREE.Group(); rig.body = new THREE.Group();
    rig.pitch.position.y = cy; rig.body.position.y = -cy;
    rig.group.add(rig.root); rig.root.add(rig.pitch); rig.pitch.add(rig.body);
    if (spec.scale) rig.group.scale.setScalar(spec.scale);
    for (i = 0; i < spec.parts.length; i++) {
      p = spec.parts[i]; j = new THREE.Group(); pos = p.pos || [0, 0, 0]; rest = p.rot || [0, 0, 0];
      j.position.set(pos[0], pos[1], pos[2]); j.rotation.set(rest[0], rest[1], rest[2]);
      par = p.parent && by[p.parent] ? by[p.parent] : rig.body; par.add(j); by[p.name] = j;
      rec = { j: j, rx: rest[0], ry: rest[1], rz: rest[2], ax: 0, ay: 0, az: 0, ph: p.ph || 0 };
      rig.recs.push(rec); rig.parts[p.name] = j;
      arr = rig.role[p.role || p.name] || (rig.role[p.role || p.name] = []); arr.push(rec);
      if (p.size) {
        sz = p.size; pv = p.pivot || [0, 0, 0];
        mt = p.flat ? flat(p.color) : shaded(p.color, p.name, seed);
        m = new THREE.Mesh(ge, mt); m.scale.set(sz[0], sz[1], sz[2]); m.position.set(pv[0], pv[1], pv[2]); m.userData.base = mt;
        j.add(m); rig.meshes.push(m);
        if (p.color2) {
          mt = shaded(p.color2, p.name + 'b', seed);
          m = new THREE.Mesh(ge, mt); m.scale.set(sz[0] * 1.06, sz[1] * 0.3, sz[2] * 1.06); m.position.set(pv[0], pv[1] - sz[1] * 0.35, pv[2]); m.userData.base = mt;
          j.add(m); rig.meshes.push(m);
        }
      }
    }
    arr = spec.atk || ['armR'];
    for (i = 0; i < arr.length; i++) if (rig.role[arr[i]]) rig.hasArm = true;
    return rig;
  };
})();
