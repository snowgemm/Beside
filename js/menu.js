(function () {
  var G = window.Game = window.Game || {};
  var M = G.menu = { open: false, settings: { vol: 100, dd: null, map: true, vib: true, quality: (G.input && G.input.isTouch) ? 'medium' : 'high', sensitivity: 50, fov: 70, camera: 6.5, cameraMode: 'rear', mapZoom: 2.35, daySpeed: 1, showFps: true, showCoords: true, fpsCap: 0, uiScale: 1, theme: 'amber', particles: 'medium' } }, root, vol, dd, ddv, map, vib, qual, sens, sensv, fov, fovv, cameraDist, cameraVal, day, showFps, showCoords, cameraMode, fpsCap, uiScale, uiScaleVal, theme, particles, mapZoom, mapZoomVal, head, home, resume, S = M.settings;

  function apply() {
    if (G.audio.setVolume) G.audio.setVolume(S.vol / 100);
    if (S.dd != null) G.world.setDrawDistance(S.dd);
    if (G.minimap && G.minimap.setEnabled) { G.minimap.setEnabled(S.map); if (G.minimap.setZoom) G.minimap.setZoom(S.mapZoom, false); }
    if (G.quality && G.quality.set) G.quality.set(S.quality);
    if (G.camera) { G.camera.fov = S.fov; G.camera.updateProjectionMatrix(); }
    if (G.player && typeof G.player.camDist === 'number') G.player.camDist = S.camera;
    if (G.player) G.player.cameraMode = S.cameraMode;
    if (G.sky && G.sky.setSpeed) G.sky.setSpeed(S.daySpeed);
    if (G.fx && G.fx.setQuality) G.fx.setQuality(S.particles);
    if (G.setFpsCap) G.setFpsCap(S.fpsCap);
    document.documentElement.style.setProperty('--ui-scale', String(S.uiScale));
    document.body.setAttribute('data-theme', S.theme);
    var hud = document.getElementById('hud'); if (hud) hud.style.display = S.showFps ? '' : 'none';
    var coords = document.getElementById('coords'); if (coords) coords.style.display = S.showCoords ? '' : 'none';
  }
  function sync() {
    vol.value = S.vol; dd.value = G.world.drawDistance; ddv.textContent = G.world.drawDistance; map.checked = S.map; vib.checked = S.vib !== false; qual.value = S.quality;
    sens.value = S.sensitivity; sensv.textContent = S.sensitivity + '%'; fov.value = S.fov; fovv.textContent = S.fov + '°';
    cameraDist.value = S.camera; cameraVal.textContent = Number(S.camera).toFixed(1); day.value = String(S.daySpeed); showFps.checked = S.showFps !== false;
    showCoords.checked = S.showCoords !== false; cameraMode.value = S.cameraMode; fpsCap.value = String(S.fpsCap); uiScale.value = S.uiScale; uiScaleVal.textContent = Math.round(S.uiScale * 100) + '%'; theme.value = S.theme; particles.value = S.particles; mapZoom.value = S.mapZoom; mapZoomVal.textContent = Number(S.mapZoom).toFixed(1) + '×';
    var t = !!(G.ui && G.ui.titleOpen); head.textContent = t ? 'Cài đặt' : 'Tạm dừng'; home.style.display = t ? 'none' : ''; resume.textContent = t ? 'Quay lại' : 'Tiếp tục';
  }
  M.setOpen = function (o) {
    if (o === M.open) return;
    M.open = o; root.classList.toggle('open', o);
    var titleSettings = !!(o && G.ui && G.ui.titleOpen);
    root.classList.toggle('from-title', titleSettings);
    document.body.classList.toggle('title-settings', titleSettings);
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
    root.innerHTML = '<div class="menu-panel"><div class="menu-head"><div><b id="menu-head">Cài đặt</b><div class="menu-sub">Besidevalley · tuỳ chỉnh của bạn</div></div><button id="menu-close" type="button" aria-label="Đóng">✕</button></div>' +
      '<div class="menu-btns"><button id="menu-resume" class="primary" type="button">Tiếp tục</button></div>' +
      '<div class="menu-section">HÌNH ẢNH</div>' +
      '<div class="menu-row"><label for="menu-quality">Chất lượng đồ hoạ</label><select id="menu-quality"><option value="low">Tiết kiệm</option><option value="medium">Cân bằng</option><option value="high">Cao</option></select></div>' +
      '<div class="menu-row"><label for="menu-dd">Tầm nhìn <b id="menu-ddv"></b></label><input id="menu-dd" type="range" min="3" max="7" step="1"></div>' +
      '<div class="menu-row"><label for="menu-day">Chu kỳ ngày/đêm</label><select id="menu-day"><option value="0">Dừng thời gian</option><option value="0.5">Chậm</option><option value="1">Bình thường</option><option value="2">Nhanh</option></select></div>' +
      '<div class="menu-row"><label for="menu-fps">Hiện FPS và vùng</label><input id="menu-fps" type="checkbox"></div>' +
      '<div class="menu-row"><label for="menu-coords">Hiện tọa độ X/Y/Z</label><input id="menu-coords" type="checkbox"></div>' +
      '<div class="menu-section">GÓC NHÌN & ĐIỀU KHIỂN</div>' +
      '<div class="menu-row"><label for="menu-fov">Góc nhìn <b id="menu-fovv"></b></label><input id="menu-fov" type="range" min="55" max="90" step="1"></div>' +
      '<div class="menu-row"><label for="menu-camera">Khoảng cách camera <b id="menu-camerav"></b></label><input id="menu-camera" type="range" min="3" max="11" step="0.5"></div>' +
      '<div class="menu-row"><label for="menu-camera-mode">Góc nhìn thứ ba</label><select id="menu-camera-mode"><option value="rear">Phía sau</option><option value="front">Phía trước</option><option value="cinematic">Điện ảnh</option></select></div>' +
      '<div class="menu-row"><label for="menu-sens">Độ nhạy camera <b id="menu-sensv"></b></label><input id="menu-sens" type="range" min="20" max="100" step="5"></div>' +
      '<div class="menu-section">HIỆU NĂNG & CÁ NHÂN HÓA</div>' +
      '<div class="menu-row"><label for="menu-fpscap">Giới hạn FPS</label><select id="menu-fpscap"><option value="0">Theo màn hình</option><option value="30">30 FPS</option><option value="60">60 FPS</option><option value="90">90 FPS</option><option value="120">120 FPS</option><option value="144">144 FPS</option></select></div>' +
      '<div class="menu-row"><label for="menu-particles">Mật độ hiệu ứng</label><select id="menu-particles"><option value="low">Tiết kiệm</option><option value="medium">Cân bằng</option><option value="high">Nhiều hiệu ứng</option></select></div>' +
      '<div class="menu-row"><label for="menu-scale">Kích thước giao diện <b id="menu-scaleval"></b></label><input id="menu-scale" type="range" min="0.85" max="1.25" step="0.05"></div>' +
      '<div class="menu-row"><label for="menu-theme">Chủ đề giao diện</label><select id="menu-theme"><option value="amber">Hổ phách</option><option value="emerald">Ngọc lục bảo</option><option value="ocean">Đại dương</option><option value="violet">Tím</option></select></div>' +
      '<div class="menu-section">ÂM THANH & TIỆN ÍCH</div>' +
      '<div class="menu-row"><label for="menu-vol">Âm lượng</label><input id="menu-vol" type="range" min="0" max="100" step="5"></div>' +
      '<div class="menu-row"><label for="menu-map">Bản đồ nhỏ</label><input id="menu-map" type="checkbox"></div>' +
      '<div class="menu-row"><label for="menu-map-zoom">Thu phóng bản đồ <b id="menu-map-zoom-val"></b></label><input id="menu-map-zoom" type="range" min="1.4" max="3.2" step="0.1"></div>' +
      '<div class="menu-row"><label for="menu-vib">Rung phản hồi</label><input id="menu-vib" type="checkbox"></div>' +
      '<div class="menu-btns"><button id="menu-reset" type="button">Khôi phục cài đặt mặc định</button><button id="menu-home" type="button">Về màn hình chính</button><button id="menu-new" type="button">Chơi mới</button></div>' +
      '<div class="menu-foot">Cài đặt được lưu tự động trên thiết bị.</div></div>';
    vol = document.getElementById('menu-vol'); dd = document.getElementById('menu-dd'); ddv = document.getElementById('menu-ddv'); map = document.getElementById('menu-map');
    vib = document.getElementById('menu-vib'); qual = document.getElementById('menu-quality'); sens = document.getElementById('menu-sens'); sensv = document.getElementById('menu-sensv');
    fov = document.getElementById('menu-fov'); fovv = document.getElementById('menu-fovv'); cameraDist = document.getElementById('menu-camera'); cameraVal = document.getElementById('menu-camerav');
    day = document.getElementById('menu-day'); showFps = document.getElementById('menu-fps'); showCoords = document.getElementById('menu-coords');
    cameraMode = document.getElementById('menu-camera-mode'); fpsCap = document.getElementById('menu-fpscap'); uiScale = document.getElementById('menu-scale'); uiScaleVal = document.getElementById('menu-scaleval'); theme = document.getElementById('menu-theme'); particles = document.getElementById('menu-particles'); mapZoom = document.getElementById('menu-map-zoom'); mapZoomVal = document.getElementById('menu-map-zoom-val');
    head = document.getElementById('menu-head'); home = document.getElementById('menu-home'); resume = document.getElementById('menu-resume');
    document.getElementById('menu-close').onclick = function () { M.setOpen(false); };
    resume.onclick = function () { M.setOpen(false); };
    root.addEventListener('click', function (e) { if (e.target === root) M.setOpen(false); });
    vol.oninput = function () { S.vol = +vol.value; apply(); G.save.request(); };
    dd.oninput = function () { S.dd = +dd.value; ddv.textContent = S.dd; apply(); G.save.request(); };
    map.onchange = function () { S.map = map.checked; apply(); G.save.request(); };
    qual.onchange = function () { S.quality = qual.value; apply(); G.save.request(); };
    sens.oninput = function () { S.sensitivity = +sens.value; sensv.textContent = S.sensitivity + '%'; G.save.request(); };
    fov.oninput = function () { S.fov = +fov.value; fovv.textContent = S.fov + '°'; apply(); G.save.request(); };
    cameraDist.oninput = function () { S.camera = +cameraDist.value; cameraVal.textContent = Number(S.camera).toFixed(1); apply(); G.save.request(); };
    day.onchange = function () { S.daySpeed = +day.value; apply(); G.save.request(); };
    showFps.onchange = function () { S.showFps = showFps.checked; apply(); G.save.request(); };
    showCoords.onchange = function () { S.showCoords = showCoords.checked; apply(); G.save.request(); };
    cameraMode.onchange = function () { S.cameraMode = cameraMode.value; apply(); G.save.request(); };
    fpsCap.onchange = function () { S.fpsCap = +fpsCap.value; apply(); G.save.request(); };
    uiScale.oninput = function () { S.uiScale = +uiScale.value; uiScaleVal.textContent = Math.round(S.uiScale * 100) + '%'; apply(); G.save.request(); };
    theme.onchange = function () { S.theme = theme.value; apply(); G.save.request(); };
    particles.onchange = function () { S.particles = particles.value; apply(); G.save.request(); };
    mapZoom.oninput = function () { S.mapZoom = +mapZoom.value; mapZoomVal.textContent = S.mapZoom.toFixed(1) + '×'; if (G.minimap && G.minimap.setZoom) G.minimap.setZoom(S.mapZoom, true); else G.save.request(); };
    vib.onchange = function () { S.vib = vib.checked; G.save.request(); if (S.vib && navigator.vibrate) { try { navigator.vibrate(30); } catch (e) {} } };
    document.getElementById('menu-reset').onclick = function () {
      S.vol = 100; S.dd = G.input.isTouch ? 3 : 5; S.map = true; S.vib = true; S.quality = G.input.isTouch ? 'medium' : 'high';
      S.sensitivity = 50; S.fov = 70; S.camera = 6.5; S.mapZoom = 2.35; S.cameraMode = 'rear'; S.daySpeed = 1; S.showFps = true; S.showCoords = true; S.fpsCap = 0; S.uiScale = 1; S.theme = 'amber'; S.particles = 'medium'; apply(); sync(); G.save.request(); G.toast('Đã khôi phục cài đặt mặc định', '#8affb0');
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
    G.save.register('settings', function () { return { vol: S.vol, dd: S.dd, map: S.map, vib: S.vib, quality: S.quality, sensitivity: S.sensitivity, fov: S.fov, camera: S.camera, cameraMode: S.cameraMode, daySpeed: S.daySpeed, showFps: S.showFps, showCoords: S.showCoords, fpsCap: S.fpsCap, uiScale: S.uiScale, theme: S.theme, particles: S.particles, mapZoom: S.mapZoom }; }, function (d) {
      if (!d) return;
      if (typeof d.vol === 'number' && isFinite(d.vol)) S.vol = Math.max(0, Math.min(100, d.vol));
      if (typeof d.dd === 'number' && isFinite(d.dd)) S.dd = Math.max(3, Math.min(7, Math.round(d.dd)));
      if (typeof d.map === 'boolean') S.map = d.map;
      if (typeof d.vib === 'boolean') S.vib = d.vib;
      if (d.quality === 'low' || d.quality === 'medium' || d.quality === 'high') S.quality = d.quality;
      if (d.cameraMode === 'rear' || d.cameraMode === 'front' || d.cameraMode === 'cinematic') S.cameraMode = d.cameraMode;
      if ([0,30,60,90,120,144].indexOf(d.fpsCap) >= 0) S.fpsCap = d.fpsCap;
      if (typeof d.uiScale === 'number' && isFinite(d.uiScale)) S.uiScale = Math.max(.85, Math.min(1.25, d.uiScale));
      if (['amber','emerald','ocean','violet'].indexOf(d.theme) >= 0) S.theme = d.theme;
      if (['low','medium','high'].indexOf(d.particles) >= 0) S.particles = d.particles;
      if (typeof d.mapZoom === 'number' && isFinite(d.mapZoom)) S.mapZoom = Math.max(1.4, Math.min(3.2, d.mapZoom));
      if (typeof d.showCoords === 'boolean') S.showCoords = d.showCoords;
      if (typeof d.sensitivity === 'number' && isFinite(d.sensitivity)) S.sensitivity = Math.max(20, Math.min(100, d.sensitivity));
      if (typeof d.fov === 'number' && isFinite(d.fov)) S.fov = Math.max(55, Math.min(90, d.fov));
      if (typeof d.camera === 'number' && isFinite(d.camera)) S.camera = Math.max(3, Math.min(11, d.camera));
      if ([0, 0.5, 1, 2].indexOf(d.daySpeed) >= 0) S.daySpeed = d.daySpeed;
      if (typeof d.showFps === 'boolean') S.showFps = d.showFps;
    });
  };
  M.vibrate = function (ms) { if (!S.vib || !navigator.vibrate) return; try { navigator.vibrate(Math.max(10, Math.min(180, ms || 30))); } catch (e) {} };
  M.apply = apply;
})();
