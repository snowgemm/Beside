(function () {
  var G = window.Game = window.Game || {};
  var N = 24;
  var Inv = G.inventory = { slots: [], open: false };
  for (var q = 0; q < N; q++) Inv.slots.push(null);
  var root, grid, doll, detail, newBtn, selKey = null, hoverKey = null, newTimer = null;

  function h(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function P() { return G.player; }
  Inv.iconEl = function (it, size) { return G.icons.get(it, size || 40); };
  function itemAt(key) {
    if (!key) return null;
    var a = key.split(':');
    return a[0] === 'b' ? Inv.slots[+a[1]] : P().equip[a[1]];
  }
  function mkSlot(it, key, label) {
    var d = h('div', 'slot' + (it ? ' r' + it.rarity + (it.rarity >= 2 ? ' glow' : '') : ' empty') + (selKey === key ? ' sel' : ''));
    d.setAttribute('data-k', key);
    if (it) { d.appendChild(Inv.iconEl(it, 40)); d.appendChild(h('i', '', it.level)); }
    else if (label) d.appendChild(h('em', '', label));
    return d;
  }
  function drawHero(cv, armor) {
    var c = cv.getContext('2d'), u = 4, body = armor ? G.icons.COL[armor.rarity] || '#b8b8b8' : '#7a5a3a';
    function r(x, y, w, hh, col) { c.fillStyle = col; c.fillRect(x * u, y * u, w * u, hh * u); }
    c.clearRect(0, 0, cv.width, cv.height);
    r(4, 7, 8, 8, '#14100c'); r(5, 8, 6, 6, body);
    r(2, 7, 2, 7, '#e8b58a'); r(12, 7, 2, 7, '#e8b58a');
    r(4, 15, 3, 8, '#3a3a5a'); r(9, 15, 3, 8, '#3a3a5a'); r(4, 21, 3, 2, '#2a1a0a'); r(9, 21, 3, 2, '#2a1a0a');
    r(5, 1, 6, 6, '#e8b58a'); r(5, 1, 6, 2, '#4a2e16'); r(6, 3, 1, 1, '#222'); r(9, 3, 1, 1, '#222');
    if (armor) { r(4, 7, 8, 1, '#ffffff'); c.globalAlpha = 0.25; r(4, 7, 8, 1, '#ffffff'); c.globalAlpha = 1; }
  }
  function render() {
    if (!root) return;
    var I = G.items, i, w, cls = { weapon: 'dw', armor: 'da', trinket: 'dt' }, hc;
    doll.textContent = ''; grid.textContent = '';
    I.SLOTS.forEach(function (s) {
      w = h('div', 'dslot ' + cls[s]); w.appendChild(mkSlot(P().equip[s], 'e:' + s, I.SLOT_NAME[s])); doll.appendChild(w);
    });
    hc = h('canvas', 'hero'); hc.width = 64; hc.height = 96; drawHero(hc, P().equip.armor); doll.appendChild(hc);
    for (i = 0; i < N; i++) grid.appendChild(mkSlot(Inv.slots[i], 'b:' + i));
    renderDetail();
  }
  function renderDetail() {
    var I = G.items, key = hoverKey || selKey, it = itemAt(key), isSel = key === selKey;
    detail.textContent = '';
    if (!it) { detail.appendChild(h('div', 'sub', 'Chạm vào vật phẩm để xem chi tiết')); return; }
    var R = I.RARITIES[it.rarity], bag = key.charAt(0) === 'b', eq = P().equip[it.slot];
    var top = h('div', 'dtop'), tx = h('div', 'dtx'), t = h('div', 'iname', it.name);
    t.style.color = R.color; tx.appendChild(t);
    tx.appendChild(h('div', 'sub', R.name + ' · ' + I.SLOT_NAME[it.slot] + ' · Cấp ' + it.level));
    top.appendChild(Inv.iconEl(it, 48)); top.appendChild(tx); detail.appendChild(top);
    var cmp = bag ? (eq ? eq.stats : I.DEFAULT[it.slot]) : null;
    I.ORDER.forEach(function (k) {
      var v = it.stats[k], c = cmp ? cmp[k] : undefined;
      if (v === undefined && !c) return;
      v = v || 0; c = c || 0;
      var meta = I.STAT[k], row = h('div', 'stat', meta.label + ': ' + meta.fmt(v)), dl = v - c;
      if (cmp && Math.abs(dl) > 1e-9) {
        var good = meta.lower ? dl < 0 : dl > 0;
        row.appendChild(h('span', good ? 'good' : 'bad', ' (' + (dl > 0 ? '+' : '−') + meta.fmt(Math.abs(dl)) + ')'));
      }
      detail.appendChild(row);
    });
    if (!isSel) return;
    var b = h('div', 'inv-btns');
    if (bag) {
      var e1 = h('button', 'primary', 'Trang bị'); e1.onclick = function () { Inv.equip(+selKey.split(':')[1]); }; b.appendChild(e1);
      var e2 = h('button', '', 'Vứt bỏ'); e2.onclick = function () { Inv.drop(+selKey.split(':')[1]); }; b.appendChild(e2);
    } else {
      var e3 = h('button', '', 'Tháo'); e3.onclick = function () { Inv.unequip(it.slot); }; b.appendChild(e3);
    }
    detail.appendChild(b);
  }

  Inv.add = function (item) {
    for (var i = 0; i < N; i++) if (!Inv.slots[i]) { Inv.slots[i] = item; if (Inv.open) render(); G.save.request(); return true; }
    return false;
  };
  Inv.equip = function (i) {
    var it = Inv.slots[i]; if (!it) return;
    var old = P().equip[it.slot];
    P().equip[it.slot] = it; Inv.slots[i] = old || null;
    P().recalc(); selKey = 'e:' + it.slot; G.audio.play('equip'); render(); G.save.request();
  };
  Inv.unequip = function (slot) {
    var it = P().equip[slot], i = Inv.slots.indexOf(null);
    if (!it) return;
    if (i < 0) { G.toast('Hành trang đầy', '#ff8080'); return; }
    Inv.slots[i] = it; P().equip[slot] = null; P().recalc(); selKey = 'b:' + i; render(); G.save.request();
  };
  Inv.drop = function (i) {
    var it = Inv.slots[i], p = P(); if (!it) return;
    Inv.slots[i] = null; selKey = null;
    G.loot.spawnDrop(it, p.pos.x - Math.sin(p.yaw) * 1.6, p.pos.z - Math.cos(p.yaw) * 1.6, 2);
    render(); G.save.request();
  };
  function setOpen(o) {
    Inv.open = o; G.paused = o || !!(G.ui && G.ui.titleOpen) || !!(G.menu && G.menu.open); root.classList.toggle('open', o);
    if (o) { if (document.exitPointerLock) document.exitPointerLock(); render(); }
    else { hoverKey = null; newBtn.textContent = 'Chơi mới'; clearTimeout(newTimer); newTimer = null; }
  }
  Inv.update = function () {
    var I = G.input;
    if (I.invToggle) {
      I.invToggle = false;
      if (G.ui && G.ui.titleOpen) return;
      if (Inv.open) setOpen(false); else if (!P().dead) setOpen(true);
    }
  };

  Inv.init = function () {
    root = document.getElementById('inv');
    root.innerHTML = '<div class="inv-panel"><div class="inv-head"><b>Hành trang</b><button id="inv-close" type="button">✕</button></div>' +
      '<div class="inv-body"><div id="inv-doll"></div><div id="inv-grid"></div><div id="inv-detail"></div></div>' +
      '<div class="inv-foot"><button id="inv-new" type="button">Chơi mới</button></div></div>';
    doll = document.getElementById('inv-doll'); grid = document.getElementById('inv-grid'); detail = document.getElementById('inv-detail');
    newBtn = document.getElementById('inv-new');
    document.getElementById('inv-close').onclick = function () { setOpen(false); };
    root.addEventListener('click', function (e) {
      if (e.target === root) { setOpen(false); return; }
      var s = e.target.closest ? e.target.closest('.slot') : null;
      if (s) { selKey = s.getAttribute('data-k'); hoverKey = null; render(); }
    });
    root.addEventListener('mouseover', function (e) {
      if (G.input && G.input.isTouch) return;
      var s = e.target.closest ? e.target.closest('.slot') : null, k = s ? s.getAttribute('data-k') : null;
      if (k !== hoverKey) { hoverKey = k; renderDetail(); }
    });
    window.addEventListener('keydown', function (e) { if (e.code === 'Escape' && Inv.open) { e.preventDefault(); setOpen(false); } });
    newBtn.onclick = function () {
      if (newTimer) { G.save.newGame(); return; }
      newBtn.textContent = 'Chắc chắn? Nhấn lần nữa';
      newTimer = setTimeout(function () { newTimer = null; newBtn.textContent = 'Chơi mới'; }, 4000);
    };
    G.save.register('inventory',
      function () { return { slots: Inv.slots, equip: P().equip }; },
      function (d) {
        var I = G.items, i;
        for (i = 0; i < N; i++) Inv.slots[i] = (d.slots && I.valid(d.slots[i])) ? d.slots[i] : null;
        I.SLOTS.forEach(function (s) { var it = d.equip && d.equip[s]; P().equip[s] = (I.valid(it) && it.slot === s) ? it : null; });
      });
    P().recalc();
  };
})();
