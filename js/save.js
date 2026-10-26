(function () {
  var G = window.Game = window.Game || {};
  var KEY = 'besidevalley-dungeons/save', VER = 1, mods = {}, mem = null, timer = null, resetting = false;
  var S = G.save = {};

  function read() {
    try { var s = window.localStorage.getItem(KEY); if (s) return JSON.parse(s); } catch (e) {}
    return mem;
  }
  function write(obj) {
    mem = obj;
    try { window.localStorage.setItem(KEY, JSON.stringify(obj)); } catch (e) {}
  }
  var data = read();
  if (data && data.version !== VER) data = null;
  if (data && data.seed) G.seed = data.seed;

  S.register = function (key, serialize, deserialize) { mods[key] = { ser: serialize, des: deserialize }; };
  S.collect = function () {
    var P = G.player, o = { version: VER, seed: G.world ? G.world.seed : G.seed, mods: {},
      player: { x: P.pos.x, y: P.pos.y, z: P.pos.z, hp: P.health, yaw: P.yaw } };
    Object.keys(mods).forEach(function (k) { try { o.mods[k] = mods[k].ser(); } catch (e) {} });
    return o;
  };
  S.saveNow = function () {
    if (resetting || !G.player || !G.player.pos || G.player.dead) return;
    try { write(S.collect()); } catch (e) {}
  };
  S.request = function () {
    if (timer) return;
    timer = setTimeout(function () { timer = null; S.saveNow(); }, 400);
  };
  S.load = function () {
    var P = G.player;
    if (!data || !data.player || (G.world && data.seed !== G.world.seed)) return false;
    Object.keys(mods).forEach(function (k) {
      if (data.mods && data.mods[k] !== undefined) { try { mods[k].des(data.mods[k]); } catch (e) {} }
    });
    P.recalc();
    var d = data.player;
    if (isFinite(d.x) && isFinite(d.y) && isFinite(d.z)) { P.pos.x = d.x; P.pos.y = d.y + 0.01; P.pos.z = d.z; }
    if (isFinite(d.yaw)) P.yaw = d.yaw;
    if (isFinite(d.hp)) P.health = Math.min(P.maxHealth, Math.max(1, d.hp));
    return true;
  };
  S.init = function () {
    setInterval(S.saveNow, 30000);
    document.addEventListener('visibilitychange', function () { if (document.hidden) S.saveNow(); });
    window.addEventListener('pagehide', S.saveNow);
  };
  S.newGame = function () {
    resetting = true;
    write({ version: VER, seed: 1 + Math.floor(Math.random() * 2147483646) });
    window.location.reload();
  };
})();
