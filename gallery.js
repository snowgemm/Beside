// Gallery: reads Game.assets.registry() (no data copied), shows turntable, scale reference, palette and the validate() report.
(function () {
  var G = window.Game, A = G.assets, PL = G.palette, hold, refs, human, cube, grid, ground, cur = null, curRig = null, curDispose = null;
  function $(id) { return document.getElementById(id); }
  function hex(n) { return '#' + ('000000' + n.toString(16)).slice(-6); }
  function el(tag, cls, txt) { var e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; }
  var toastT = 0;
  function toast(t) { var e = $('toast'); e.textContent = t; e.className = 'on'; clearTimeout(toastT); toastT = setTimeout(function () { e.className = ''; }, 1400); }
  function copy(text) {
    function done() { toast('Đã chép: ' + text); }
    try { if (navigator.clipboard && window.isSecureContext) { navigator.clipboard.writeText(text).then(done, fb); return; } } catch (e) {}
    fb();
    function fb() {
      var t = el('textarea'); t.value = text; t.style.cssText = 'position:fixed;opacity:0;top:0'; document.body.appendChild(t); t.select();
      try { document.execCommand('copy'); } catch (e) {} document.body.removeChild(t); done();
    }
  }
  if (!window.THREE || !A || !A.registry || !PL) { document.body.textContent = 'Thiếu Three.js, assets.js hoặc palette.js'; return; }
  var cv = $('cv'), ren = new THREE.WebGLRenderer({ antialias: true }), scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(40, 1, 0.1, 400);
  ren.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2)); cv.appendChild(ren.domElement);
  var night = false, showRef = true, yaw = 0.6, pitch = 0.3, zoom = 1, dragging = false, resumeAt = 0, tgt = { x: 0, y: 1, d: 8 };
  ground = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), new THREE.MeshBasicMaterial({ color: 0x6cbf5a })); ground.rotation.x = -Math.PI / 2; ground.position.y = -0.01; scene.add(ground);
  grid = new THREE.GridHelper(40, 40, 0x000000, 0x000000); grid.material.transparent = true; grid.material.opacity = 0.22; scene.add(grid);
  hold = new THREE.Group(); scene.add(hold); refs = new THREE.Group(); scene.add(refs);
  human = G.rig.build(G.player.makeSpec(null), 0); refs.add(human.group);
  cube = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1)), new THREE.LineBasicMaterial({ color: 0xffffff })); cube.position.y = 0.5; refs.add(cube);
  function sky() { var c = night ? 0x0b1026 : 0x9fd3f5; scene.background = new THREE.Color(c); ground.material.color.setHex(night ? 0x2f5a3a : 0x6cbf5a); }
  function resize() { var w = cv.clientWidth || 300, h = cv.clientHeight || 200; ren.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix(); frame(); }
  function frame() {
    var h = cur ? Math.max(cur.h, 0.5) : 1.7, w = cur ? Math.max(cur.w, 0.5) : 1, top = Math.max(h, showRef ? 1.8 : 0), th = Math.tan(cam.fov * Math.PI / 360);
    var left = showRef ? -(w / 2 + 2.4) : -w / 2, right = w / 2, halfW = (right - left) / 2 * 1.12, halfH = top / 2 * 1.2;
    tgt.d = Math.max(halfH / th, halfW / (th * cam.aspect), 2.5); tgt.x = (left + right) / 2; tgt.y = top / 2;
    refs.visible = showRef; refs.position.x = -(w / 2 + 1.5); cube.position.x = 1.1; cube.position.y = 0.5; human.group.position.x = 0;
  }
  function loop(now) {
    requestAnimationFrame(loop); var dt = Math.min(0.05, (now - (loop.t || now)) / 1000); loop.t = now;
    if (!dragging && now > resumeAt) yaw += dt * 0.7;
    hold.rotation.y = yaw; var d = tgt.d * zoom, cp = Math.cos(pitch), sp = Math.sin(pitch);
    cam.position.set(tgt.x, tgt.y + d * sp, d * cp); cam.lookAt(tgt.x, tgt.y, 0);
    if (curRig) curRig.update(dt); human.update(dt); ren.render(scene, cam);
  }
  (function () {
    var px = 0, py = 0, id = null, c = ren.domElement;
    c.addEventListener('pointerdown', function (e) { id = e.pointerId; dragging = true; px = e.clientX; py = e.clientY; try { c.setPointerCapture(id); } catch (x) {} });
    c.addEventListener('pointermove', function (e) { if (!dragging || e.pointerId !== id) return; yaw += (e.clientX - px) * 0.012; pitch = Math.max(-0.1, Math.min(1.2, pitch + (e.clientY - py) * 0.006)); px = e.clientX; py = e.clientY; });
    function up(e) { if (e.pointerId === id) { dragging = false; id = null; resumeAt = performance.now() + 1500; } }
    c.addEventListener('pointerup', up); c.addEventListener('pointercancel', up);
    c.addEventListener('wheel', function (e) { e.preventDefault(); zoom = Math.max(0.4, Math.min(2, zoom * (e.deltaY > 0 ? 1.1 : 0.9))); }, { passive: false });
  })();
  $('bDay').onclick = function () { night = !night; $('tint').className = night ? 'night' : ''; $('bDay').textContent = night ? '🌙' : '☀'; sky(); };
  $('bRef').onclick = function () { showRef = !showRef; frame(); };
  window.addEventListener('resize', resize); window.addEventListener('orientationchange', function () { setTimeout(resize, 200); });
  if (window.ResizeObserver) new ResizeObserver(resize).observe(cv);
  sky(); human.play('idle');
  var reg = A.registry(), report = null, tab = 'model', rarity = 0, selected = null;
  var TABS = [['model', 'Mô hình'], ['mob', 'Mob'], ['prop', 'Prop'], ['item', 'Vật phẩm'], ['pal', 'Bảng màu'], ['val', 'Kiểm tra']];
  function stat(e) { try { return A.stats(e); } catch (x) { return { voxels: 0, tris: 0, height: 0, width: 1, cls: 'item', colors: [], err: x.message }; } }
  function over(e) { var s = stat(e), b = A.budgets[s.cls]; return !!(b && (s.voxels > b.voxels || s.tris > b.tris)); }
  function drawIcon() {
    var box = $('iconBox'); box.innerHTML = '';
    if (selected && selected.cat === 'item') { box.style.display = 'flex'; box.appendChild(G.icons.get({ name: selected.item.name, slot: selected.item.slot, rarity: rarity }, 120)); $('rar').style.display = 'flex'; }
    else { box.style.display = 'none'; $('rar').style.display = 'none'; }
  }
  function select(e) {
    if (curDispose) { curDispose(); curDispose = null; }
    if (cur && cur.obj) hold.remove(cur.obj);
    cur = null; curRig = null; selected = e;
    var s = stat(e), b = A.budgets[s.cls], bad = over(e);
    if (e.cat !== 'item') { var m = e.make(); hold.add(m.obj); curRig = m.rig; curDispose = m.dispose; cur = { obj: m.obj, h: s.height, w: s.width || 1 }; if (curRig) curRig.play('idle'); }
    else cur = { obj: null, h: 1.7, w: 1 };
    frame(); drawIcon();
    $('info').innerHTML = '<b>' + e.id + '</b> · ' + e.name + ' · ' + s.cls + ' · voxel ' + s.voxels + '/' + (b ? b.voxels : '-') + ' · tam giác ' + s.tris + '/' + (b ? b.tris : '-') + (s.height ? ' · cao ' + s.height : '') + (bad ? ' <span class="bad">⚠ vượt ngân sách</span>' : '');
  }
  var RN = ['common', 'uncommon', 'rare', 'epic', 'legendary'];
  RN.forEach(function (n, i) { var b = el('button', null, i + 1); b.style.borderBottom = '4px solid ' + hex(PL.rarity[n]); b.onclick = function () { rarity = i; drawIcon(); }; $('rar').appendChild(b); });
  var panel = $('panel');
  function tabs() { var t = $('tabs'); t.innerHTML = ''; TABS.forEach(function (x) { var b = el('button', tab === x[0] ? 'on' : '', x[1]); if (x[0] === 'val' && report && report.issues) b.appendChild(el('i', null, report.issues)); b.onclick = function () { tab = x[0]; tabs(); render(); }; t.appendChild(b); }); }
  function cards(cat) {
    var g = el('div', 'grid'), list = reg.filter(function (e) { return e.cat === cat; });
    if (!list.length) panel.appendChild(el('p', null, 'Không có mục nào.'));
    list.forEach(function (e) { var s = stat(e), c = el('div', 'card' + (over(e) ? ' over' : '') + (selected === e ? ' sel' : '')), b = A.budgets[s.cls];
      if (cat === 'item') c.appendChild(G.icons.get({ name: e.item.name, slot: e.item.slot, rarity: 0 }, 40));
      c.appendChild(el('b', null, e.id)); c.appendChild(el('small', null, e.name));
      var d = el('div'); d.appendChild(el('small', null, 'V ' + s.voxels + ' · T ' + s.tris + ' ')); if (over(e)) d.appendChild(el('span', 'w', '⚠')); c.appendChild(d);
      c.onclick = function () { select(e); copy(e.id); render(); }; g.appendChild(c);
    }); panel.appendChild(g);
  }
  function swatch(h, label) { var s = el('div', 'sw'); s.style.background = hex(h); s.title = hex(h); s.onclick = function () { copy(label || hex(h)); }; return s; }
  function palette() { var last = '', row, seenRamp = {};
    PL.list().forEach(function (c) { if (c.group !== last) { panel.appendChild(el('h3', null, c.group)); last = c.group; }
      if (!seenRamp[c.ramp]) { seenRamp[c.ramp] = row = el('div', 'rr'); row.appendChild(el('span', null, c.ramp)); panel.appendChild(row); }
      seenRamp[c.ramp].appendChild(swatch(c.hex, c.id + ' ' + hex(c.hex)));
    });
  }
  function validate() { try { report = A.validate(); } catch (x) { report = { missing: [], overBudget: [], offPalette: [], errors: [String(x.message)], issues: 1, counts: {}, total: 0 }; } tabs(); }
  function validation() {
    var r = report, b = el('button', 'btn', 'Chạy lại'); b.onclick = function () { validate(); render(); }; panel.appendChild(b);
    panel.appendChild(el('p', r.issues ? null : 'ok', r.total + ' tài sản (' + ['model', 'mob', 'prop', 'item'].map(function (k) { return k + ' ' + (r.counts[k] || 0); }).join(', ') + ') · ' + (r.issues ? r.issues + ' mục cần xem' : 'không có vấn đề')));
    panel.appendChild(el('h3', null, 'Thiếu id / lỗi tham chiếu (' + r.missing.length + ')')); r.missing.forEach(function (m) { panel.appendChild(el('div', null, '• ' + m.id + ': ' + m.why)); });
    panel.appendChild(el('h3', null, 'Vượt ngân sách (' + r.overBudget.length + ')')); r.overBudget.forEach(function (o) { panel.appendChild(el('div', null, '• ' + o.id + ' [' + o.cls + '] voxel ' + o.voxels + '/' + o.maxVoxels + ', tam giác ' + o.tris + '/' + o.maxTris)); });
    panel.appendChild(el('h3', null, 'Màu lệch bảng màu (' + r.offPalette.length + ' tài sản)'));
    r.offPalette.forEach(function (o) { var d = el('details'), s = el('summary', null, o.id + ' · ' + o.off.length + '/' + o.total + ' màu lệch'); d.appendChild(s);
      o.off.forEach(function (c) { var l = el('div'), sm = el('span', 'sm'); sm.style.background = hex(c.hex); l.appendChild(sm); l.appendChild(document.createTextNode(hex(c.hex) + ' → ' + c.nearest + ' (cách ' + c.dist + ')')); d.appendChild(l); }); panel.appendChild(d);
    });
    if (r.errors.length) { panel.appendChild(el('h3', null, 'Lỗi')); r.errors.forEach(function (m) { panel.appendChild(el('div', null, '• ' + m)); }); }
    panel.appendChild(el('p', null, 'Chỉ báo cáo, không tự sửa màu.'));
  }
  function render() { var top = panel.scrollTop; panel.innerHTML = ''; if (tab === 'pal') palette(); else if (tab === 'val') { if (!report) validate(); validation(); } else cards(tab); panel.scrollTop = top; }
  validate(); tabs(); render(); resize(); requestAnimationFrame(loop); if (reg[0]) select(reg[0]);
})();