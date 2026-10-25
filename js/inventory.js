(function () {
  var G = window.Game = window.Game || {};
  var N = 24;
  var Inv = G.inventory = { slots: [], open: false };
  for (var q = 0; q < N; q++) Inv.slots.push(null);
  var root, grid, eqRow, detail, newBtn, selKey = null, newTimer = null;
  function h(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function P() { return G.player; }
  G.toast = function (text, color) {
    var box = document.getElementById('toasts'), t = h('div', 'toast', text);
    t.style.color = color || '#fff'; box.appendChild(t);
    while (box.children.length > 4) box.removeChild(box.firstChild);
    setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, 2600);
  };
  Inv.iconEl = function (it) { return h('span', 'ico', it.icon); };
  function mkSlot(it, key, label) {
    var d = h('div', 'slot' + (selKey === key ? ' sel' : '')); d.setAttribute('data-k', key);
    if (it) { d.style.borderColor = G.items.RARITIES[it.rarity].color; d.appendChild(Inv.iconEl(it)); d.appendChild(h('i', '', it.level)); }
    else if (label) d.appendChild(h('em', '', label));
    return d;
  }
  function getSel() { if (!selKey) return null; var a = selKey.split(':'); return a[0] === 'b' ? Inv.slots[+a[1]] : P().equip[a[1]]; }
  function render() {
    if (!root) return;
    var I = G.items, i; eqRow.textContent = ''; grid.textContent = '';
    I.SLOTS.forEach(function (s) { var w = h('div', 'eqwrap'); w.appendChild(mkSlot(P().equip[s], 'e:' + s, I.SLOT_NAME[s])); eqRow.appendChild(w); });
    for (i = 0; i < N; i++) grid.appendChild(mkSlot(Inv.slots[i], 'b:' + i));
    renderDetail();
  }
  function renderDetail() {
    var I = G.items, it = getSel(); detail.textContent = '';
    if (!it) { detail.textContent = 'Chạm vào vật phẩm để xem chi tiết'; return; }
    var R = I.RARITIES[it.rarity], bag = selKey.charAt(0) === 'b', eq = P().equip[it.slot];
    var t = h('div', 'iname', it.name); t.style.color = R.color; detail.appendChild(t);
    detail.appendChild(h('div', 'sub', R.name + ' · ' + I.SLOT_NAME[it.slot] + ' · Cấp ' + it.level));
    var cmp = bag ? (eq ? eq.stats : I.DEFAULT[it.slot]) : null;
    I.ORDER.forEach(function (k) {
      var v = it.stats[k], c = cmp ? cmp[k] : undefined; if (v === undefined && !c) return;
      v = v || 0; c = c || 0; var meta = I.STAT[k], row = h('div', 'stat', meta.label + ': ' + meta.fmt(v)), dl = v - c;
      if (cmp && Math.abs(dl) > 1e-9) { var good = meta.lower ? dl < 0 : dl > 0; row.appendChild(h('span', good ? 'good' : 'bad', ' (' + (dl > 0 ? '+' : '−') + meta.fmt(Math.abs(dl)) + ')')); }
      detail.appendChild(row);
    });
    var b = h('div', 'inv-btns');
    if (bag) {
      var e1 = h('button', '', 'Trang bị'); e1.onclick = function () { Inv.equip(+selKey.split(':')[1]); }; b.appendChild(e1);
      var e2 = h('button', '', 'Vứt bỏ'); e2.onclick = function () { Inv.drop(+selKey.split(':')[1]); }; b.appendChild(e2);
    } else { var e3 = h('button', '', 'Tháo'); e3.onclick = function () { Inv.unequip(it.slot); }; b.appendChild(e3); }
    detail.appendChild(b);
  }
  Inv.add = function (item) { for (var i = 0; i < N; i++) if (!Inv.slots[i]) { Inv.slots[i] = item; if (Inv.open) render(); G.save.request(); return true; } return false; };
  Inv.equip = function (i) {
    var it = Inv.slots[i]; if (!it) return; var old = P().equip[it.slot];
    P().equip[it.slot] = it; Inv.slots[i] = old || null; P().recalc(); selKey = 'e:' + it.slot; G.audio.play('equip'); render(); G.save.request();
  };
  Inv.unequip = function (slot) {
    var it = P().equip[slot], i = Inv.slots.indexOf(null); if (!it) return;
    if (i < 0) { G.toast('Hành trang đầy', '#ff8080'); return; }
    Inv.slots[i] = it; P().equip[slot] = null; P().recalc(); selKey = 'b:' + i; render(); G.save.request();
  };
  Inv.drop = function (i) {
    var it = Inv.slots[i], p = P(); if (!it) return;
    Inv.slots[i] = null; selKey = null; G.loot.spawnDrop(it, p.pos.x - Math.sin(p.yaw) * 1.6, p.pos.z - Math.cos(p.yaw) * 1.6, 2);
    render(); G.save.request();
  };
  function setOpen(o) {
    Inv.open = o; G.paused = o; root.classList.toggle('open', o);
    if (o) { if (document.exitPointerLock) document.exitPointerLock(); render(); }
    else { newBtn.textContent = 'Chơi mới'; clearTimeout(newTimer); newTimer = null; }
  }
  Inv.update = function () { var I = G.input; if (I.invToggle) { I.invToggle = false; if (Inv.open) setOpen(false); else if (!P().dead) setOpen(true); } };
  Inv.init = function () {
    root = document.getElementById('inv');
    root.innerHTML = '<div class="inv-panel"><div class="inv-head"><b>Hành trang</b><button id="inv-close" type="button">✕</button></div><div id="inv-eq"></div><div id="inv-grid"></div><div id="inv-detail"></div><div class="inv-foot"><button id="inv-new" type="button">Chơi mới</button></div></div>';
    eqRow = document.getElementById('inv-eq'); grid = document.getElementById('inv-grid'); detail = document.getElementById('inv-detail'); newBtn = document.getElementById('inv-new');
    document.getElementById('inv-close').onclick = function () { setOpen(false); };
    root.addEventListener('click', function (e) { if (e.target === root) { setOpen(false); return; } var s = e.target.closest ? e.target.closest('.slot') : null; if (s) { selKey = s.getAttribute('data-k'); render(); } });
    newBtn.onclick = function () { if (newTimer) { G.save.newGame(); return; } newBtn.textContent = 'Chắc chắn? Nhấn lần nữa'; newTimer = setTimeout(function () { newTimer = null; newBtn.textContent = 'Chơi mới'; }, 4000); };
    G.save.register('inventory', function () { return { slots: Inv.slots, equip: P().equip }; }, function (d) {
      var I = G.items, i; for (i = 0; i < N; i++) Inv.slots[i] = (d.slots && I.valid(d.slots[i])) ? d.slots[i] : null;
      I.SLOTS.forEach(function (s) { var it = d.equip && d.equip[s]; P().equip[s] = (I.valid(it) && it.slot === s) ? it : null; });
    });
    P().recalc();
  };
})();