/* core.js - Game namespace: Net, Util, Events, Players, Save, Loop, Rand, Time */
window.Game = window.Game || {};
(function (G) {
  'use strict';

  // Online seam: solo mode now, networking will live in js/net.js later.
  G.Net = { mode: 'solo', isHost: true, playerId: 'p1' };

  G.Util = {
    // Flat-shaded look: unshared vertices with per-face normals.
    flat: function (g) { g = g.index ? g.toNonIndexed() : g; g.computeVertexNormals(); return g; }
  };

  // Every emitted payload carries `by` (the acting player id).
  G.Events = {
    _h: {},
    on: function (e, f) { (this._h[e] || (this._h[e] = [])).push(f); },
    emit: function (e, d) {
      d = d || {};
      if (d.by === undefined) d.by = G.Net.playerId;
      const l = this._h[e];
      if (l) for (const f of l.slice()) f(d);
    }
  };

  G.Players = {
    _m: new Map(),
    local: function () { return this._m.get(G.Net.playerId); },
    get: function (id) { return this._m.get(id); },
    list: function () { return Array.from(this._m.values()); },
    add: function (id, o) { o.id = id; this._m.set(id, o); G.Events.emit('players:add', { id: id }); },
    remove: function (id) { this._m.delete(id); G.Events.emit('players:remove', { id: id }); }
  };

  // One localStorage slot. scope 'world' = shared, 'player' = per person.
  const SAVE_KEY = 'valley_save_v1';
  G.Save = {
    _r: [],
    register: function (key, obj, scope) {
      this._r.push({ key: key, obj: obj, scope: scope === 'world' ? 'world' : 'player' });
    },
    _read: function () { try { return JSON.parse(localStorage.getItem(SAVE_KEY)); } catch (e) { return null; } },
    save: function () {
      try {
        const old = this._read() || {};
        const s = { v: 1, world: {}, players: old.players || {} };
        const pid = G.Net.playerId;
        s.players[pid] = {};
        for (const r of this._r) {
          const d = r.obj.save();
          if (r.scope === 'world') s.world[r.key] = d; else s.players[pid][r.key] = d;
        }
        localStorage.setItem(SAVE_KEY, JSON.stringify(s));
      } catch (e) { /* storage unavailable */ }
    },
    load: function () {
      const s = this._read();
      if (!s) return false;
      const mine = (s.players && s.players[G.Net.playerId]) || {};
      for (const r of this._r) {
        const d = r.scope === 'world' ? (s.world || {})[r.key] : mine[r.key];
        if (d !== undefined) { try { r.obj.load(d); } catch (e) { r.obj.reset(); } }
      }
      G.Events.emit('save:loaded', {});
      return true;
    },
    reset: function () {
      try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* ignore */ }
      for (const r of this._r) r.obj.reset();
    },
    startAuto: function () {
      const self = this;
      setInterval(function () { self.save(); }, 20000);
      document.addEventListener('visibilitychange', function () { if (document.hidden) self.save(); });
      window.addEventListener('pagehide', function () { self.save(); });
    }
  };

  // Fixed-step loop. Update callbacks get STEP; render callbacks get (alpha, frameDt).
  G.Loop = {
    STEP: 1 / 60, _u: [], _r: [],
    onUpdate: function (fn) { this._u.push(fn); },
    onRender: function (fn, order) {
      this._r.push({ fn: fn, o: order || 0 });
      this._r.sort(function (a, b) { return a.o - b.o; });
    },
    run: function () {
      const L = this, STEP = this.STEP;
      let last = 0, acc = 0;
      function frame(ts) {
        requestAnimationFrame(frame);
        if (!last) last = ts;
        let dt = (ts - last) / 1000; last = ts;
        if (dt > 0.25) dt = 0.25;
        acc += dt;
        let n = 0;
        while (acc >= STEP && n < 5) {
          for (let i = 0; i < L._u.length; i++) L._u[i](STEP);
          acc -= STEP; n++;
        }
        if (n === 5) acc = 0;
        const a = acc / STEP;
        for (let i = 0; i < L._r.length; i++) L._r[i].fn(a, dt);
      }
      requestAnimationFrame(frame);
    }
  };

  // Seeded random (mulberry32). The shared stream is reseeded every game day.
  G.Rand = {
    make: function (seed) {
      let a = seed >>> 0;
      return function () {
        a = (a + 0x6D2B79F5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
    },
    _g: null,
    seedDay: function (extra) { this._g = this.make(((G.Time ? G.Time.day : 1) * 2654435761 + (extra | 0)) >>> 0); },
    next: function () { if (!this._g) this.seedDay(); return this._g(); },
    range: function (a, b) { return a + (b - a) * this.next(); },
    int: function (a, b) { return Math.floor(this.range(a, b + 1)); },
    pick: function (arr) { return arr[this.int(0, arr.length - 1)]; }
  };

  // Time of day. 1 game day = 480 real seconds; ?fast=1 runs 30x faster.
  const DAY = 480, FAST = /[?&]fast=1/.test(location.search), START = 7 / 24;
  const C = function (h) { return new THREE.Color(h); };
  // [hour, sky, light, lightI, ambient, ambientI, night]
  const K = [
    [0, 0x0b122b, 0x6a7fc4, 0.22, 0x3b4880, 0.5, 1], [5, 0x0b122b, 0x6a7fc4, 0.22, 0x3b4880, 0.5, 1],
    [6.5, 0xf2a97c, 0xffb98a, 0.8, 0x9a8ca8, 0.6, 0.35], [8.5, 0xa8dcee, 0xfff0d2, 1, 0xc4d8e8, 0.7, 0],
    [12, 0x8fd3f0, 0xfff6e0, 1.1, 0xdbe8f0, 0.75, 0], [16.5, 0xa8d8ea, 0xffe9c0, 1, 0xc9d8e2, 0.7, 0],
    [18.5, 0xf08a5c, 0xff9a62, 0.75, 0x9a80a0, 0.55, 0.3], [20, 0x2a2f5e, 0x7a86c8, 0.3, 0x44508a, 0.5, 0.8],
    [22, 0x0b122b, 0x6a7fc4, 0.22, 0x3b4880, 0.5, 1], [24, 0x0b122b, 0x6a7fc4, 0.22, 0x3b4880, 0.5, 1]
  ].map(function (k) { return { h: k[0], sky: C(k[1]), lc: C(k[2]), li: k[3], ac: C(k[4]), ai: k[5], n: k[6] }; });

  G.Time = {
    day: 1, t: START, hour: START * 24, scale: FAST ? 30 : 1, _h: -1,
    state: {
      sunDir: new THREE.Vector3(0, 1, 0), lightColor: C(0xffffff), lightIntensity: 1,
      skyColor: C(0x9fd8f0), ambColor: C(0xffffff), ambient: 0.7, night: 0
    },
    compute: function () {
      const s = this.state;
      this.hour = this.t * 24;
      let i = 0;
      while (i < K.length - 2 && this.hour >= K[i + 1].h) i++;
      const a = K[i], b = K[i + 1];
      let f = (this.hour - a.h) / (b.h - a.h); f = f * f * (3 - 2 * f);
      s.skyColor.copy(a.sky).lerp(b.sky, f);
      s.lightColor.copy(a.lc).lerp(b.lc, f);
      s.ambColor.copy(a.ac).lerp(b.ac, f);
      s.lightIntensity = a.li + (b.li - a.li) * f;
      s.ambient = a.ai + (b.ai - a.ai) * f;
      s.night = a.n + (b.n - a.n) * f;
      const ang = (this.t - 0.25) * Math.PI * 2;
      s.sunDir.set(Math.cos(ang), Math.max(Math.sin(ang), 0.25), 0.35).normalize();
    },
    update: function (dt) {
      this.t += dt * this.scale / DAY;
      if (this.t >= 1) {
        this.t -= 1; this.day++;
        G.Rand.seedDay();
        G.Events.emit('day:new', { day: this.day });
      }
      this.compute();
      const h = Math.floor(this.hour);
      if (h !== this._h) { this._h = h; G.Events.emit('time:hour', { hour: h, day: this.day }); }
    },
    format: function () {
      const m = Math.floor(this.hour * 60) % 1440, p = function (n) { return (n < 10 ? '0' : '') + n; };
      return p(Math.floor(m / 60)) + ':' + p(m % 60);
    },
    save: function () { return { day: this.day, t: +this.t.toFixed(5) }; },
    load: function (d) { this.day = (d.day | 0) || 1; this.t = Number(d.t); if (!(this.t >= 0 && this.t < 1)) this.t = START; this.compute(); G.Rand.seedDay(); },
    reset: function () { this.day = 1; this.t = START; this.compute(); G.Rand.seedDay(); }
  };
  G.Time.compute();
  G.Loop.onUpdate(function (dt) { G.Time.update(dt); });
  G.Save.register('time', G.Time, 'world');

  G.start = function () {
    G.Save.load();
    G.Time.compute();
    G.Save.startAuto();
    G.Loop.run();
    const l = document.getElementById('loading');
    if (l) { l.classList.add('hide'); setTimeout(function () { l.remove(); }, 700); }
  };
})(window.Game);
