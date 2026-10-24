/* sfx.js - Game.Sfx.play(name). Kenney Interface/Impact sounds (CC0, .ogg) in assets/sfx/.
   Audio unlocks on the first tap/key; load failures are ignored silently; mute is stored in Game.State.muted (saved). */
(function (G) {
  'use strict';
  const BASE = 'assets/sfx/', POOL = 3;
  // name -> [file, volume]
  const MAP = {
    click: ['click', 0.5], open: ['open', 0.5], till: ['till', 0.8], water: ['water', 0.6], plant: ['plant', 0.7],
    harvest: ['harvest', 0.7], coin: ['coin', 0.6], sleep: ['sleep', 0.6], error: ['error', 0.45],
    chop: ['chop', 0.8], mine: ['mine', 0.8], pickup: ['pickup', 0.6], craft: ['craft', 0.7]
  };
  const pool = {}, lastAt = {};
  let unlocked = false;

  function make(name) {
    const d = MAP[name], list = [];
    for (let i = 0; i < POOL; i++) {
      try {
        const a = new Audio(); a.preload = 'auto'; a.volume = d[1]; a.src = BASE + d[0] + '.ogg';
        a.addEventListener('error', function () { a._bad = true; });
        list.push(a);
      } catch (e) { /* no audio support */ }
    }
    return { list: list, i: 0 };
  }
  Object.keys(MAP).forEach(function (n) { pool[n] = make(n); });

  const S = G.Sfx = {
    names: Object.keys(MAP),
    play: function (name) {
      if (!unlocked || (G.State && G.State.muted)) return;
      const p = pool[name]; if (!p || !p.list.length) return;
      const now = performance.now();
      if (now - (lastAt[name] || 0) < 50) return;           // collapse double triggers
      lastAt[name] = now;
      const a = p.list[p.i++ % p.list.length];
      if (a._bad) return;
      try { a.currentTime = 0; const r = a.play(); if (r && r.catch) r.catch(function () { /* blocked or unsupported */ }); } catch (e) { /* ignore */ }
    },
    isMuted: function () { return !!G.State.muted; },
    setMuted: function (m) { G.State.muted = !!m; G.Events.emit('sfx:mute', { muted: !!m }); },
    toggleMute: function () { this.setMuted(!G.State.muted); return G.State.muted; }
  };

  function unlock() {
    if (unlocked) return;
    unlocked = true;
    // Gameplay sounds are triggered synchronously from the tap/key handler, so playback is already inside the user gesture.
    ['pointerdown', 'keydown', 'touchstart'].forEach(function (ev) { window.removeEventListener(ev, unlock, true); });
  }
  ['pointerdown', 'keydown', 'touchstart'].forEach(function (ev) { window.addEventListener(ev, unlock, true); });

  // Gameplay events -> sounds (local player only)
  const mine = function (e) { return e.by === G.Net.playerId; };
  [['soil:tilled', 'till'], ['soil:watered', 'water'], ['crop:planted', 'plant'], ['crop:harvested', 'harvest'],
    ['shop:transaction', 'coin'], ['farm:denied', 'error'], ['player:sleep', 'sleep'],
    ['item:picked', 'pickup'], ['item:crafted', 'craft']].forEach(function (m) {
    G.Events.on(m[0], function (e) { if (mine(e)) S.play(m[1]); });
  });
  // wood nodes (tree, bamboo) chop, stone nodes (rock, copper) mine
  G.Events.on('node:hit', function (e) { if (mine(e)) S.play(e.kind === 'tree' || e.kind === 'bamboo' ? 'chop' : 'mine'); });
})(window.Game);
