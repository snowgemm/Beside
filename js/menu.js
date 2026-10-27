(function () {
  var G = window.Game = window.Game || {};
  var M = G.menu = { open: false, settings: { vol: 100, dd: null, map: true, vib: true, quality: (G.input && G.input.isTouch) ? 'medium' : 'high' } }, root, vol, dd, ddv, map, vib, qual, head, home, S = M.settings;

  function apply() {
    if (G.audio.setVolume) G.audio.setVolume(S.vol / 100);
    if (S.dd != null) G.world.setDrawDistance(S.dd);
    G.minimap.setEnabled(S.map);
    if (G.quality && G.quality.set) G.quality.set(S.quality);
  }
  function sync() {
    vol.value = S.vol; dd.value = G.world.drawDistance; ddv.textContent = G.world.drawDistance; map.checked = S.map; vib.checked = S.vib !== false; qual.value = S.quality;
    var t = !!(G.ui && G.ui.titleOpen); head.textContent = t ? 'Cài đặt' : 'Tạm dừng'; home.style.display = t ? 'none' : '';
  }
  M.setOpen = function (o) {
    if (o === M.open) return;
    M.open = o; root.classList.toggle('open', o);
    if (o) { sync(); G.paused = true; if (document.exitPointerLock && document.pointerLockElement) document.exitPointerLock(); }
    else { G.paused = !!(G.inventory && G.inventory.open) || !!(G.ui && G.ui.titleOpen); G.save.request(); }
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
    root.innerHTML = '<div class="menu-panel"><div class="menu-head"><b id="menu-head">Tạm dừng</b><button id="menu-close" type="button">✕</button></div>' +
      '<div class="menu-btns"><button id="menu-resume" class="primary" type="button">Tiếp tục</button></div>' +
      '<div class="menu-row"><span>Âm lượng</span><input id="menu-vol" type="range" min="0" max="100" step="5"></div>' +
      '<div class="menu-row"><span>Tầm nhìn: <b id="menu-ddv"></b></span><input id="menu-dd" type="range" min="3" max="7" step="1"></div>' +
      '<div class="menu-row"><label for="menu-quality">Chất lượng đồ họa</label><select id="menu-quality"><option value="low">Thấp</option><option value="medium">Vừa</option><option value="high">Cao</option></select></div>' +
      '<div class="menu-row"><span>Bản đồ nhỏ</span><input id="menu-map" type="checkbox"></div>' +
      '<div class="menu-row"><span>Rung</span><input id="menu-vib" type="checkbox"></div>' +
      '<div class="menu-btns"><button id="menu-clear" type="button">Xóa chỉnh sửa</button><button id="menu-home" type="button">Về màn hình chính</button><button id="menu-new" type="button">Chơi mới</button></div></div>';
    vol = document.getElementById('menu-vol'); dd = document.getElementById('menu-dd'); ddv = document.getElementById('menu-ddv'); map = document.getElementById('menu-map');
    vib = document.getElementById('menu-vib'); qual = document.getElementById('menu-quality'); head = document.getElementById('menu-head'); home = document.getElementById('menu-home');
    document.getElementById('menu-close').onclick = function () { M.setOpen(false); };
    document.getElementById('menu-resume').onclick = function () { M.setOpen(false); };
    root.addEventListener('click', function (e) { if (e.target === root) M.setOpen(false); });
    vol.oninput = function () { S.vol = +vol.value; apply(); G.save.request(); };
    dd.oninput = function () { S.dd = +dd.value; ddv.textContent = S.dd; apply(); G.save.request(); };
    map.onchange = function () { S.map = map.checked; apply(); G.save.request(); };
    qual.onchange = function () { S.quality = qual.value; apply(); G.save.request(); };
    vib.onchange = function () { S.vib = vib.checked; G.save.request(); if (S.vib && navigator.vibrate) { try { navigator.vibrate(30); } catch (e) {} } };
    document.getElementById('menu-clear').onclick = function () {
      if (window.confirm('Xóa toàn bộ chỉnh sửa khối? Không thể hoàn tác.')) M.clearEdits();
    };
    home.onclick = function () { G.save.saveNow(); window.location.reload(); };
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
      if (document.pointerLockElement !== cv && !M.open && !(G.inventory && G.inventory.open) && !(G.ui && G.ui.titleOpen) && !G.player.dead) M.setOpen(true);
    });
    G.save.register('settings', function () { return { vol: S.vol, dd: S.dd, map: S.map, vib: S.vib, quality: S.quality }; }, function (d) {
      if (!d) return;
      if (typeof d.vol === 'number' && isFinite(d.vol)) S.vol = Math.max(0, Math.min(100, d.vol));
      if (typeof d.dd === 'number' && isFinite(d.dd)) S.dd = Math.max(3, Math.min(7, Math.round(d.dd)));
      if (typeof d.map === 'boolean') S.map = d.map;
      if (typeof d.vib === 'boolean') S.vib = d.vib;
      if (d.quality === 'low' || d.quality === 'medium' || d.quality === 'high') S.quality = d.quality;
    });
  };
  M.apply = apply;
})();
