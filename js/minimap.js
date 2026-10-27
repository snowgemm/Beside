(function () {
  var G = window.Game = window.Game || {};
  var M = G.minimap = {}, SZ = 256, H = SZ / 2, cv, c, acc = 0, shade, label, labelTitle, cache = new Map(), cacheSeed = null, cacheEditCount = -1;
  M.enabled = true; M.expanded = false; M.zoom = 2.35;

  function dot(x, y, r, col) { c.fillStyle = col; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill(); }
  function hexColor(value) { var out = (value >>> 0).toString(16); return '#' + ('000000'.slice(out.length) + out); }
  function terrainColor(x, z) {
    var key = x + ',' + z, col = cache.get(key);
    if (col === undefined) {
      col = G.world.topColor(x, z);
      cache.set(key, col);
    }
    return hexColor(col);
  }
  function drawTerrain(p, s) {
    var span = Math.ceil(H / s) + 1, x0 = Math.floor(p.x) - span, x1 = Math.floor(p.x) + span,
        z0 = Math.floor(p.z) - span, z1 = Math.floor(p.z) + span, x, z, px, pz;
    // Build a cached, local world map only while expanded. Cells are generated once per coordinate.
    for (z = z0; z <= z1; z++) {
      pz = H + (z + 0.5 - p.z) * s;
      for (x = x0; x <= x1; x++) {
        px = H + (x + 0.5 - p.x) * s;
        c.fillStyle = terrainColor(x, z);
        c.fillRect(px - s * 0.5, pz - s * 0.5, s + 0.35, s + 0.35);
      }
    }
    // A subtle coordinate grid helps read distance without making the map noisy.
    c.strokeStyle = 'rgba(255,255,255,.12)'; c.lineWidth = 1;
    for (x = -5; x <= 5; x++) {
      var gx = H + x * 10 * s - (p.x - Math.floor(p.x)) * s;
      var gz = H + x * 10 * s - (p.z - Math.floor(p.z)) * s;
      c.beginPath(); c.moveTo(gx, 0); c.lineTo(gx, SZ); c.stroke();
      c.beginPath(); c.moveTo(0, gz); c.lineTo(SZ, gz); c.stroke();
    }
  }
  function draw() {
    var P = G.player, p = P.pos, D = G.dungeon, run = D && D.active ? D.run() : null,
        s = M.expanded ? M.zoom : 1.25, i, j, e, list, r, a, b, d, x, y;
    c.clearRect(0, 0, SZ, SZ);
    c.fillStyle = '#10151b'; c.fillRect(0, 0, SZ, SZ);

    if (M.expanded && !run && G.world && G.world.topColor) drawTerrain(p, s);
    if (run) {
      var rooms = run.rooms;
      for (i = 0; i < rooms.length; i++) {
        r = rooms[i]; if (i === run.cur) r.seen = true;
        if (i < rooms.length - 1 && r.seen) {
          b = rooms[i + 1]; c.fillStyle = '#3a4256';
          c.fillRect(H + (r.x0 + r.w - p.x) * s, H + (r.z0 + r.t.outRows[0] - p.z) * s, (b.x0 - r.x0 - r.w) * s, Math.max(2, r.t.outRows.length * s));
        }
      }
      for (i = 0; i < rooms.length; i++) {
        r = rooms[i]; c.fillStyle = i === run.cur ? '#66789c' : r.seen ? '#3f4860' : '#1d2232';
        c.fillRect(H + (r.x0 - p.x) * s, H + (r.z0 - p.z) * s, r.w * s, r.h * s);
        if (r.kind === 'boss') { c.strokeStyle = '#ff5d7c'; c.lineWidth = 2; c.strokeRect(H + (r.x0 - p.x) * s, H + (r.z0 - p.z) * s, r.w * s, r.h * s); }
        for (j = 0; j < r.doors.length; j++) {
          d = r.doors[j];
          if (d.closed) { c.fillStyle = '#ff5a3a'; c.fillRect(H + (d.cells[0][0] - p.x) * s - 1, H + (d.cells[0][1] - p.z) * s, Math.max(3, 2 * s), d.cells.length * s); }
        }
      }
      list = run.inter;
      for (i = 0; i < list.length; i++) {
        a = list[i];
        if (a.room) { if (a.room.seen) dot(H + (a.x - p.x) * s, H + (a.z - p.z) * s, 3.5, '#ffe08b'); }
        else dot(H + (a.x - p.x) * s, H + (a.z - p.z) * s, 4, '#7affea');
      }
    } else {
      if (!M.expanded) { c.strokeStyle = 'rgba(255,255,255,0.22)'; c.lineWidth = 1; c.strokeRect(.5, .5, SZ - 1, SZ - 1); }
      list = D && D.gateItems ? D.gateItems() : [];
      for (i = 0; i < list.length; i++) {
        a = list[i]; x = H + (a.x - p.x) * s; y = H + (a.z - p.z) * s;
        if (x > 2 && x < SZ - 2 && y > 2 && y < SZ - 2) {
          dot(x, y, M.expanded ? 5 : 4, D.isCleared(a.key) ? '#80f0a9' : '#75c5ff');
          if (M.expanded) { c.strokeStyle = '#10151b'; c.lineWidth = 1; c.beginPath(); c.arc(x, y, 7, 0, Math.PI * 2); c.stroke(); }
        }
      }
      list = G.loot && G.loot.drops ? G.loot.drops : [];
      for (i = 0; i < list.length; i++) {
        a = list[i]; x = H + (a.x - p.x) * s; y = H + (a.z - p.z) * s;
        if (x > 2 && x < SZ - 2 && y > 2 && y < SZ - 2) dot(x, y, M.expanded ? 3 : 2, '#ffda6a');
      }
    }
    list = G.enemies && G.enemies.list ? G.enemies.list : [];
    for (i = 0; i < list.length; i++) {
      e = list[i]; if (e.dead) continue;
      x = H + (e.x - p.x) * s; y = H + (e.z - p.z) * s;
      if (x > 1 && x < SZ - 1 && y > 1 && y < SZ - 1) dot(x, y, e.type === 'boss' ? (M.expanded ? 5 : 4) : (M.expanded ? 3 : 2), e.type === 'boss' ? '#ff2a8a' : '#ff4a4a');
    }
    if (M.expanded) {
      c.strokeStyle = 'rgba(255,255,255,.7)'; c.lineWidth = 1;
      for (x = 0; x < SZ; x += 16) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, SZ); c.stroke(); c.beginPath(); c.moveTo(0, x); c.lineTo(SZ, x); c.stroke(); }
    }
    c.save(); c.translate(H, H); c.rotate(-P.yaw);
    c.fillStyle = '#fff'; c.beginPath(); c.moveTo(0, -9); c.lineTo(6, 7); c.lineTo(0, 4); c.lineTo(-6, 7); c.closePath(); c.fill(); c.restore();
    dot(H, H, 3, '#ffffff');
    if (M.expanded && labelTitle) labelTitle.textContent = 'BẢN ĐỒ THẾ GIỚI  ·  X ' + p.x.toFixed(1) + '  Z ' + p.z.toFixed(1);
    if (cache.size > 28000) {
      var removeN = cache.size - 20000, it = cache.keys();
      while (removeN-- > 0) { var n = it.next(); if (n.done) break; cache.delete(n.value); }
    }
  }
  M.setExpanded = function (on) {
    M.expanded = !!on && M.enabled;
    if (document.body) document.body.classList.toggle('map-expanded', M.expanded);
    if (shade) shade.style.display = M.expanded ? 'block' : 'none';
    if (label) label.style.display = M.expanded ? 'flex' : 'none';
    if (cv) cv.setAttribute('aria-label', M.expanded ? 'Đóng bản đồ toàn màn hình' : 'Mở bản đồ toàn màn hình');
    acc = 1;
  };
  M.toggleExpanded = function () { M.setExpanded(!M.expanded); };
  M.init = function () {
    shade = document.createElement('div'); shade.id = 'map-shade'; shade.style.display = 'none'; document.body.appendChild(shade);
    cv = document.createElement('canvas'); cv.id = 'minimap'; cv.width = cv.height = SZ;
    cv.setAttribute('role', 'button'); cv.setAttribute('tabindex', '0'); cv.setAttribute('aria-label', 'Mở bản đồ toàn màn hình');
    document.body.appendChild(cv); c = cv.getContext('2d');
    label = document.createElement('div'); label.id = 'map-label'; label.style.display = 'none';
    var title = document.createElement('span'); title.className='map-title'; title.textContent = 'BẢN ĐỒ THẾ GIỚI'; labelTitle = title; label.appendChild(title);
    var legend=document.createElement('div');legend.id='map-legend';legend.className='map-legend';legend.textContent='▲ Bạn  ·  ● Quái  ·  ● Đồ rơi  ·  ◆ Cổng';label.appendChild(legend);
    var controls=document.createElement('div');controls.className='map-zoom-controls';
    var zoomOut=document.createElement('button');zoomOut.type='button';zoomOut.id='map-zoom-out';zoomOut.textContent='−';zoomOut.setAttribute('aria-label','Thu nhỏ bản đồ');controls.appendChild(zoomOut);
    var zoomValue=document.createElement('span');zoomValue.id='map-zoom-value';zoomValue.textContent=M.zoom.toFixed(1)+'×';controls.appendChild(zoomValue);
    var zoomIn=document.createElement('button');zoomIn.type='button';zoomIn.id='map-zoom-in';zoomIn.textContent='+';zoomIn.setAttribute('aria-label','Phóng to bản đồ');controls.appendChild(zoomIn);
    var close = document.createElement('button'); close.type = 'button'; close.id = 'map-close'; close.textContent = 'Đóng ✕'; controls.appendChild(close);
    label.appendChild(controls); document.body.appendChild(label);
    cv.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); if (!M.expanded) M.setExpanded(true); });
    cv.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); M.toggleExpanded(); } });
    shade.addEventListener('click', function () { M.setExpanded(false); });
    close.addEventListener('click', function (e) { e.stopPropagation(); M.setExpanded(false); });
    zoomOut.addEventListener('click',function(e){e.preventDefault();e.stopPropagation();M.setZoom(M.zoom-.2);});
    zoomIn.addEventListener('click',function(e){e.preventDefault();e.stopPropagation();M.setZoom(M.zoom+.2);});
    cv.addEventListener('wheel',function(e){if(!M.expanded)return;e.preventDefault();e.stopPropagation();M.setZoom(M.zoom+(e.deltaY<0?.15:-.15));},{passive:false});
    var pinchStart=0,pinchZoom=M.zoom;
    cv.addEventListener('touchstart',function(e){if(!M.expanded||e.touches.length<2)return;var a=e.touches[0],b=e.touches[1];pinchStart=Math.hypot(a.clientX-b.clientX,a.clientY-b.clientY);pinchZoom=M.zoom;e.preventDefault();},{passive:false});
    cv.addEventListener('touchmove',function(e){if(!M.expanded||e.touches.length<2||pinchStart<=0)return;var a=e.touches[0],b=e.touches[1],d=Math.hypot(a.clientX-b.clientX,a.clientY-b.clientY);M.setZoom(pinchZoom*d/pinchStart);e.preventDefault();},{passive:false});
    cv.addEventListener('touchend',function(e){if(e.touches.length<2)pinchStart=0;},{passive:true});
    window.addEventListener('keydown', function (e) {
      if (e.code === 'KeyM' && !e.repeat) { M.toggleExpanded(); e.preventDefault(); }
      else if (e.code === 'Escape' && M.expanded) { M.setExpanded(false); e.stopImmediatePropagation(); }
    });
  };
  M.setEnabled = function (on) { M.enabled = !!on; if (cv) cv.style.display = on ? '' : 'none'; if (!on) M.setExpanded(false); };
  M.setZoom = function (zoom, persist) {
    M.zoom = Math.max(1.4, Math.min(3.2, +zoom || 2.35)); acc = 1;
    var z=document.getElementById('map-zoom-value'),inp=document.getElementById('menu-map-zoom'),val=document.getElementById('menu-map-zoom-val');
    if(z)z.textContent=M.zoom.toFixed(1)+'×';if(inp)inp.value=String(M.zoom);if(val)val.textContent=M.zoom.toFixed(1)+'×';
    if(G.menu&&G.menu.settings)G.menu.settings.mapZoom=M.zoom;
    if(persist!==false&&G.save&&G.save.request)G.save.request();
  };
  M.update = function (dt) {
    acc += Math.max(0, dt || 0);
    if (acc < (M.expanded ? 0.25 : 0.12) || !c || !M.enabled) return;
    acc = 0;
    if (cacheSeed !== G.world.seed || cacheEditCount !== G.world.editCount()) { cache.clear(); cacheSeed = G.world.seed; cacheEditCount = G.world.editCount(); }
    draw();
  };
})();