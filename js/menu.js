(function () {
  var G = window.Game = window.Game || {};
  var M = G.menu = { open: false, settings: { vol: 100, dd: null, map: true } }, root, vol, dd, ddv, map, S = M.settings;

  function apply() {
    if (G.audio.setVolume) G.audio.setVolume(S.vol / 100);
    if (S.dd != null) G.world.setDrawDistance(S.dd);
    G.minimap.setEnabled(S.map);
  }
  function sync() {
    vol.value = S.vol; dd.value = G.world.drawDistance; ddv.textContent = G.world.drawDistance; map.checked = S.map;
  }
  M.setOpen = function (o) {
    if (o === M.open) return;
    M.open = o; root.classList.toggle('open', o);
    if (o) { sync(); G.paused = true; if (document.exitPointerLock && document.pointerLockElement) document.exitPointerLock(); }
    else { G.paused = !!(G.inventory && G.inventory.open); G.save.request(); }
  };
  M.clearEdits = function () {
    G.world.clearEdits();
    var P = G.player, p = P.pos;
    if (!G.dungeon.active) { var h = G.world.getHeight(p.x, p.z); if (p.y < h) { p.y = h + 0.01; P.vel.y = 0; } }
    G.save.request(); G.toast('Đã xóa chỉnh sửa', '#8affb0');
  };
  // settings are applied when the quality governor lowers draw distance too
  M.noteDrawDistance = function (n) { S.dd = n; G.save.request(); };

  M.init = function () {
    root = document.getElementById('menu');
    root.innerHTML = '<div class="menu-panel"><div class="menu-head"><b>Cài đặt</b><button id="menu-close" type="button">✕</button></div>' +
      '<div class="menu-row"><span>Âm lượng</span><input id="menu-vol" type="range" min="0" max="100" step="5"></div>' +
      '<div class="menu-row"><span>Tầm nhìn: <b id="menu-ddv"></b></span><input id="menu-dd" type="range" min="3" max="7" step="1"></div>' +
      '<div class="menu-row"><span>Bản đồ nhỏ</span><input id="menu-map" type="checkbox"></div>' +
      '<div class="menu-btns"><button id="menu-clear" type="button">Xóa chỉnh sửa</button><button id="menu-new" type="button">Chơi mới</button></div></div>';
    vol = document.getElementById('menu-vol'); dd = document.getElementById('menu-dd'); ddv = document.getElementById('menu-ddv'); map = document.getElementById('menu-map');
    document.getElementById('menu-close').onclick = function () { M.setOpen(false); };
    root.addEventListener('click', function (e) { if (e.target === root) M.setOpen(false); });
    vol.oninput = function () { S.vol = +vol.value; apply(); G.save.request(); };
    dd.oninput = function () { S.dd = +dd.value; ddv.textContent = S.dd; apply(); G.save.request(); };
    map.onchange = function () { S.map = map.checked; apply(); G.save.request(); };
    document.getElementById('menu-clear').onclick = function () {
      if (window.confirm('Xóa toàn bộ chỉnh sửa khối? Không thể hoàn tác.')) M.clearEdits();
    };
    document.getElementById('menu-new').onclick = function () {
      if (window.confirm('Chơi mới sẽ xóa toàn bộ tiến trình. Tiếp tục?')) G.save.newGame();
    };
    var btn = document.getElementById('btn-menu');
    btn.addEventListener('click', function () { M.setOpen(!M.open); });
    btn.addEventListener('touchstart', function (e) { e.preventDefault(); e.stopPropagation(); M.setOpen(!M.open); }, { passive: false });
    window.addEventListener('keydown', function (e) {
      if (e.code !== 'Escape' || e.repeat) return;
      if (G.inventory && G.inventory.open) return;
      M.setOpen(!M.open);
    });
    // Esc while pointer-locked only releases the lock (no keydown): open the menu then
    var cv = document.querySelector('#game canvas');
    document.addEventListener('pointerlockchange', function () {
      if (document.pointerLockElement !== cv && !M.open && !(G.inventory && G.inventory.open) && !G.player.dead) M.setOpen(true);
    });
    G.save.register('settings', function () { return { vol: S.vol, dd: S.dd, map: S.map }; }, function (d) {
      if (!d) return;
      if (typeof d.vol === 'number' && isFinite(d.vol)) S.vol = Math.max(0, Math.min(100, d.vol));
      if (typeof d.dd === 'number' && isFinite(d.dd)) S.dd = Math.max(3, Math.min(7, Math.round(d.dd)));
      if (typeof d.map === 'boolean') S.map = d.map;
    });
  };
  M.apply = apply;
})();
