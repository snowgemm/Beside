(function () {
  var G = window.Game = window.Game || {};
  var U = G.ui = { titleOpen: false, hasDeath: false };
  var bq = [], bBusy = false, bEl, bT, bS, wpn, rhRoom, rhFoes, deathEl, titleEl;
  function $(id) { return document.getElementById(id); }
  function h(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }

  // toast(text, cssColor, item?) - at most 4 stacked; item adds its icon
  G.toast = function (text, color, item) {
    var box = $('toasts'); if (!box) return;
    var t = h('div', 'toast');
    t.style.setProperty('--tc', color || '#fff'); t.style.color = color || '#fff';
    if (item && G.icons) t.appendChild(G.icons.get(item, 28));
    t.appendChild(h('span', '', text)); box.appendChild(t);
    while (box.children.length > 4) box.removeChild(box.firstChild);
    setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, 2700);
  };

  // banner(title, sub?, kind) kind: 'entry' | 'clear' | 'boss' | 'level' | 'info'; queued (max 3 waiting), 2.6 s each
  U.banner = function (title, sub, kind) {
    if (!bEl) return;
    if (bq.length >= 3) bq.shift();
    bq.push([title, sub || '', kind || 'info']);
    if (!bBusy) next();
  };
  function next() {
    var b = bq.shift();
    if (!b) { bBusy = false; return; }
    bBusy = true; bT.textContent = b[0]; bS.textContent = b[1]; bS.style.display = b[1] ? 'block' : 'none';
    bEl.className = ''; bEl.offsetWidth; bEl.className = 'show k-' + b[2];
    setTimeout(function () { bEl.className = ''; setTimeout(next, 250); }, 2600);
  }
  U.levelUp = function (n) { U.banner('Lên cấp!', 'Cấp ' + n, 'level'); }; // no XP system exists yet: nothing calls this

  var N1 = ['Đá Xám', 'Sương Mù', 'Tro Tàn', 'Bóng Đêm', 'Rêu Phong', 'Băng Giá', 'Nanh Sói', 'Xương Khô'], N2 = ['Cổ Xưa', 'Lãng Quên', 'Câm Lặng', 'Sâu Thẳm', 'Bị Nguyền'];
  U.dungeonName = function (seed) { seed = seed >>> 0; return N1[seed % N1.length] + ' ' + N2[Math.floor(seed / 8) % N2.length]; };

  U.setRoom = function (room, foes) {
    if (!rhRoom) return;
    rhRoom.textContent = room; rhFoes.textContent = foes; rhFoes.style.display = foes ? 'inline' : 'none';
  };
  U.setWeapon = function (it) {
    if (!wpn) return;
    wpn.textContent = ''; wpn.className = it ? 'r' + (it.rarity | 0) : 'empty';
    if (it) { wpn.appendChild(G.icons.get(it, 32)); wpn.title = it.name; } else { wpn.textContent = 'Tay'; wpn.title = 'Tay không'; }
  };
  U.showDeath = function (on) { if (deathEl) deathEl.classList.toggle('open', !!on); };

  function startGame() {
    U.titleOpen = false; titleEl.classList.remove('open'); document.body.classList.remove('titling');
    G.paused = !!(G.inventory && G.inventory.open) || !!(G.menu && G.menu.open);
    var cv = document.querySelector('#game canvas');
    if (!G.input.isTouch && cv && cv.requestPointerLock) { try { cv.requestPointerLock(); } catch (e) {} }
  }

  U.init = function () {
    bEl = $('banner'); bT = $('bn-t'); bS = $('bn-s'); wpn = $('wpn'); rhRoom = $('rh-room'); rhFoes = $('rh-foes'); deathEl = $('death'); titleEl = $('title');
    var btns = [['btn-attack', 'sword', 'Đánh', 40], ['btn-dodge', 'roll', 'Lăn', 26], ['btn-bag', 'bag', 'Túi', 26], ['btn-jump', 'jump', 'Nhảy', 30], ['btn-view', 'view', 'Góc nhìn', 24], ['btn-menu', 'gear', '', 30]];
    btns.forEach(function (b) {
      var e = $(b[0]); if (!e) return;
      e.textContent = ''; e.setAttribute('aria-label', b[2] || 'Cài đặt');
      e.appendChild(G.icons.ui(b[1], b[3])); if (b[2]) e.appendChild(h('span', 'lbl', b[2]));
    });
    if (G.player && G.player.updateCameraButton) G.player.updateCameraButton();
    $('d-btn').onclick = function () { G.combat.respawn(); };
    window.addEventListener('keydown', function (e) { if (e.code === 'Enter' && deathEl.classList.contains('open')) G.combat.respawn(); });
    U.hasDeath = true;
    U.setWeapon(G.player.equip.weapon);

    var has = G.save.has(), skip = false;
    try { skip = window.sessionStorage.getItem('bvd-skip') === '1'; window.sessionStorage.removeItem('bvd-skip'); } catch (e) {}
    titleEl.innerHTML = '<div class="logo"><span class="l1">BESIDEVALLEY</span><span class="l2">DUNGEONS</span></div>' +
      '<div class="t-btns">' + (has ? '<button id="t-cont" class="primary" type="button">Tiếp tục</button>' : '') +
      '<button id="t-new" type="button"' + (has ? '' : ' class="primary"') + '>Chơi mới</button><button id="t-set" type="button">Cài đặt</button></div>' +
      '<div class="t-ver">Hầm ngục khối · phiêu lưu một mình</div>';
    if (has) $('t-cont').onclick = startGame;
    $('t-new').onclick = function () {
      if (!has) { startGame(); return; }
      if (!window.confirm('Chơi mới sẽ xóa toàn bộ tiến trình. Tiếp tục?')) return;
      try { window.sessionStorage.setItem('bvd-skip', '1'); } catch (e) {}
      G.save.newGame();
    };
    $('t-set').onclick = function () { G.menu.setOpen(true); };
    if (!skip) { U.titleOpen = true; G.paused = true; document.body.classList.add('titling'); titleEl.classList.add('open'); }
  };
})();
