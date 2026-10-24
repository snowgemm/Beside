/* ui.js - HUD (money, energy; reuses the day/clock pill from world.js), 8-slot hotbar, context action button, toasts, shop + bag panels.
   Input: player.js already turns E / Space / the #act button into 'player:interact' (facing tile + interactable id); this file only reacts to it.
   All text uses system-ui so Vietnamese diacritics render. Art is plain CSS (no sprite assets). */
(function (G) {
  'use strict';
  const W = G.World, P = G.Player, Inv = G.Inventory, St = G.State, Farm = G.Farm, E = G.Events;
  const $ = function (id) { return document.getElementById(id); };
  const el = function (tag, cls, html) { const e = document.createElement(tag); if (cls) e.className = cls; if (html !== undefined) e.innerHTML = html; return e; };
  const money = function (n) { return Math.round(n).toLocaleString('vi-VN') + 'đ'; };
  const sfx = function (n) { if (G.Sfx) G.Sfx.play(n); };

  const UI = G.UI = { selected: 'hoe' };

  // ---------- HUD ----------
  const hud = $('hud'), wrap = el('div'), stats = el('div');
  wrap.id = 'hudwrap'; stats.id = 'stats';
  stats.innerHTML = '<span id="st-money"></span><span id="st-en"><span id="st-bar"><b id="st-fill"></b></span><em id="st-enum"></em></span>';
  hud.parentNode.insertBefore(wrap, hud); wrap.appendChild(hud); wrap.appendChild(stats);
  const stMoney = $('st-money'), stFill = $('st-fill'), stNum = $('st-enum'), stEn = $('st-en');
  function refreshStats() {
    stMoney.textContent = '💰 ' + money(St.money);
    stFill.style.width = St.energy + '%'; stNum.textContent = '⚡ ' + Math.round(St.energy);
    stEn.className = St.energy < 25 ? 'low' : '';
  }
  E.on('state:changed', refreshStats);

  // top-right buttons
  const tools = el('div'); tools.id = 'toolbtns';
  const bagBtn = el('button', 'tbtn', '🎒'), muteBtn = el('button', 'tbtn');
  bagBtn.type = muteBtn.type = 'button'; bagBtn.setAttribute('aria-label', 'Túi đồ'); muteBtn.setAttribute('aria-label', 'Âm thanh');
  tools.appendChild(bagBtn); tools.appendChild(muteBtn); document.body.appendChild(tools);
  function refreshMute() { muteBtn.textContent = St.muted ? '🔇' : '🔊'; }
  muteBtn.addEventListener('pointerdown', function (e) {
    e.preventDefault(); if (!G.Sfx) return;
    const m = G.Sfx.toggleMute(); refreshMute(); if (!m) sfx('click'); G.Save.save();
  });
  bagBtn.addEventListener('pointerdown', function (e) { e.preventDefault(); if (panel.kind === 'bag') UI.close(); else UI.openBag(); });
  E.on('sfx:mute', refreshMute);

  // ---------- toasts ----------
  const toasts = el('div'); toasts.id = 'toasts'; document.body.appendChild(toasts);
  UI.toast = function (text, kind) {
    const t = el('div', 'toast' + (kind ? ' ' + kind : '')); t.textContent = text; toasts.appendChild(t);
    while (toasts.children.length > 3) toasts.removeChild(toasts.firstChild);
    setTimeout(function () { t.classList.add('out'); setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, 400); }, 2000);
  };
  E.on('ui:toast', function (e) { UI.toast(e.text, e.kind); });
  E.on('farm:denied', function (e) { UI.toast(e.text, 'bad'); });
  E.on('crop:harvested', function (e) { UI.toast('+1 ' + Inv.item(e.item).name); });
  E.on('player:slept', function (e) { UI.toast('Ngày ' + e.day + ' — năng lượng đã đầy'); });

  // ---------- hotbar (8 slots; items are assigned from the bag; saved under 'hotbar') ----------
  const HOT = 8;
  const bar = el('div'); bar.id = 'hotbar'; document.body.appendChild(bar);
  const slots = [];
  for (let i = 0; i < HOT; i++) {
    const b = el('button', 'slot', '<i class="k">' + (i + 1) + '</i><span class="ic"></span><b class="n"></b>');
    b.type = 'button'; b.dataset.i = i;
    b.addEventListener('pointerdown', function (e) { e.preventDefault(); UI.selectSlot(i); });
    bar.appendChild(b); slots.push(b);
  }
  let hot = ['hoe', 'can'], hotLoaded = false;
  UI.bagSel = null;                       // item picked in the bag, waiting for a hotbar slot
  const autoKind = function (id) { const it = Inv.item(id); return it && (it.kind === 'seed' || it.kind === 'tool'); };
  function autoAdd(id) {                  // newly gained seeds / tools appear on the first free slot
    if (!autoKind(id) || hot.indexOf(id) >= 0) return;
    const f = hot.indexOf(null); if (f >= 0) hot[f] = id;
  }
  function buildHot() {
    hot = hot.slice(0, HOT); while (hot.length < HOT) hot.push(null);
    for (let i = 0; i < HOT; i++) if (hot[i] && (!Inv.item(hot[i]) || Inv.count(hot[i]) < 1)) hot[i] = null;   // used-up items leave the bar
    if (hot.indexOf(UI.selected) < 0) UI.selected = hot.find(function (x) { return x; }) || 'hoe';
    for (let i = 0; i < HOT; i++) {
      const id = hot[i], s = slots[i], it = id && Inv.item(id);
      s.className = 'slot' + (id === UI.selected ? ' sel' : '') + (it ? '' : ' empty') + (it && it.tier === 2 ? ' cu' : '');
      s.querySelector('.ic').textContent = it ? it.icon : '';
      s.querySelector('.n').textContent = it && it.kind !== 'tool' && Inv.count(id) > 1 || (it && it.kind === 'seed') ? Inv.count(id) : '';
      s.title = it ? it.name : ''; s.setAttribute('aria-label', it ? it.name : 'Ô trống');
    }
  }
  function assign(i, id) {
    const j = hot.indexOf(id), old = hot[i];
    if (j >= 0 && j !== i) hot[j] = old || null;       // already on the bar: swap places
    hot[i] = id; UI.selected = id; UI.bagSel = null; sfx('click'); buildHot(); if (panel.kind) panel.render();
  }
  UI.selectSlot = function (i) {
    if (panel.kind === 'bag' && UI.bagSel && Inv.count(UI.bagSel) > 0) { assign(i, UI.bagSel); return; }
    if (!hot[i]) return;
    if (UI.selected !== hot[i]) sfx('click');
    UI.selected = hot[i]; buildHot();
  };
  E.on('inventory:changed', function (e) { if (e.id && e.delta > 0) autoAdd(e.id); buildHot(); if (panel.kind) panel.render(); });
  function migrate() { Object.keys(Inv.ITEMS).forEach(function (id) { if (Inv.count(id) > 0) autoAdd(id); }); }   // owned seeds / tools onto the bar
  const HotSave = {
    save: function () { return { hot: hot.slice() }; },
    load: function (d) { if (d && Array.isArray(d.hot)) { hot = d.hot.slice(0, HOT).map(function (id) { return Inv.item(id) ? id : null; }); hotLoaded = true; } },
    reset: function () { hot = ['hoe', 'can']; hotLoaded = false; UI.selected = 'hoe'; migrate(); }
  };
  G.Save.register('hotbar', HotSave, 'player');

  window.addEventListener('keydown', function (e) {
    if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.code === 'Escape') { UI.close(); return; }
    const m = /^(?:Digit|Numpad)([1-8])$/.exec(e.code);
    if (m) { UI.selectSlot(+m[1] - 1); e.preventDefault(); }
    else if (e.code === 'KeyI' || e.code === 'KeyB') { if (panel.kind === 'bag') UI.close(); else UI.openBag(); e.preventDefault(); }
  });

  // ---------- panels (one at a time; tap outside or Esc closes) ----------
  const veil = el('div'); veil.id = 'veil'; veil.hidden = true;
  const box = el('div'); box.id = 'panel'; veil.appendChild(box); document.body.appendChild(veil);
  const panel = { kind: null, render: function () {} };
  veil.addEventListener('pointerdown', function (e) { if (e.target === veil) { e.preventDefault(); UI.close(); } });
  UI.close = function () { if (!panel.kind) return; panel.kind = null; UI.bagSel = null; veil.hidden = true; box.innerHTML = ''; document.body.classList.remove('bagopen'); sfx('click'); };
  function open(kind, render) { panel.kind = kind; panel.render = render; UI.bagSel = null; veil.hidden = false; document.body.classList.toggle('bagopen', kind === 'bag'); render(); sfx('open'); }
  function head(title) {
    const h = el('div', 'phead', '<h2></h2><span class="pmoney"></span><button type="button" class="px" aria-label="Đóng">✕</button>');
    h.querySelector('h2').textContent = title; h.querySelector('.pmoney').textContent = '💰 ' + money(St.money);
    h.querySelector('.px').addEventListener('pointerdown', function (e) { e.preventDefault(); UI.close(); });
    return h;
  }

  // Shop at the grocery stall
  let shopTab = 'buy';
  function buy(id, n) {
    const it = Inv.item(id), total = it.price * n;
    if (St.money < total) { UI.toast('Không đủ tiền', 'bad'); sfx('error'); return; }
    if (Inv.room(id) < n) { UI.toast('Túi đồ đã đầy', 'bad'); sfx('error'); return; }
    St.spend(total); Inv.add(id, n);
    E.emit('shop:transaction', { type: 'buy', item: id, n: n, total: total });
    UI.toast('Đã mua ' + n + ' ' + it.name.toLowerCase() + ' −' + money(total));
  }
  function sell(id, n) {
    const it = Inv.item(id); n = Math.min(n, Inv.count(id)); if (n < 1) return;
    const total = it.sell * n; Inv.remove(id, n); St.addMoney(total);
    E.emit('shop:transaction', { type: 'sell', item: id, n: n, total: total });
    UI.toast('Đã bán +' + money(total), 'good');
  }
  function row(icon, name, sub, btns) {
    const r = el('div', 'prow', '<span class="pi"></span><span class="pt"><b></b><small></small></span><span class="pb"></span>');
    r.querySelector('.pi').textContent = icon; r.querySelector('b').textContent = name; r.querySelector('small').textContent = sub;
    btns.forEach(function (b) {
      const x = el('button', 'pbtn' + (b.off ? ' off' : '')); x.type = 'button'; x.textContent = b.t;
      x.addEventListener('pointerdown', function (e) { e.preventDefault(); b.f(); }); r.querySelector('.pb').appendChild(x);
    });
    return r;
  }
  function renderShop() {
    box.innerHTML = ''; box.className = 'shop'; box.appendChild(head('Quán tạp hóa'));
    const tabs = el('div', 'tabs');
    [['buy', 'Mua hạt giống'], ['sell', 'Bán đồ']].forEach(function (t) {
      const b = el('button', 'tab' + (shopTab === t[0] ? ' on' : '')); b.type = 'button'; b.textContent = t[1];
      b.addEventListener('pointerdown', function (e) { e.preventDefault(); shopTab = t[0]; sfx('click'); renderShop(); }); tabs.appendChild(b);
    });
    box.appendChild(tabs);
    const list = el('div', 'plist');
    if (shopTab === 'buy') {
      Object.keys(Inv.CROPS).forEach(function (c) {
        const cr = Inv.CROPS[c], id = 'seed_' + c, it = Inv.item(id);
        list.appendChild(row(it.icon, it.name + ' — ' + money(it.price), 'Chín sau ' + cr.days + ' ngày · bán ' + money(cr.sell) + ' · có ' + Inv.count(id),
          [{ t: 'Mua 1', off: St.money < it.price, f: function () { buy(id, 1); } }, { t: 'Mua 5', off: St.money < it.price * 5, f: function () { buy(id, 5); } }]));
      });
    } else {
      const ids = sellables();
      ids.forEach(function (id) {
        const it = Inv.item(id), n = Inv.count(id);
        list.appendChild(row(it.icon, it.name + ' ×' + n, money(it.sell) + ' mỗi cái',
          [{ t: 'Bán 1', f: function () { sell(id, 1); } }, { t: 'Bán hết', f: function () { sell(id, n); } }]));
      });
      if (!ids.length) list.appendChild(el('p', 'pempty', 'Chưa có gì để bán. Hãy trồng trọt, chặt cây, đào đá nhé!'));
    }
    box.appendChild(list);
  }
  function sellables() { return Object.keys(Inv.ITEMS).filter(function (id) { return Inv.ITEMS[id].sell > 0 && Inv.count(id) > 0; }); }
  UI.openShop = function () {
    shopTab = sellables().length ? 'sell' : 'buy';
    open('shop', renderShop);
  };

  // Crafting rows (shared by the bag's hand recipes and the workbench panel)
  function recipeRow(r, where) {
    const C = G.Crafting, out = Inv.item(r.out), ok = C.can(r.id);
    const req = Object.keys(r.in).map(function (k) { const it = Inv.item(k); return it.icon + ' ' + it.name + ' ' + Math.min(Inv.count(k), r.in[k]) + '/' + r.in[k]; }).join(' · ');
    const rw = row(out.icon, out.name + (Inv.count(r.out) ? ' (có ' + Inv.count(r.out) + ')' : ''), req + (r.note ? ' (' + r.note + ')' : ''),
      [{ t: 'Chế tạo', off: !ok, f: function () { C.craft(r.id, where); } }]);
    if (ok) rw.classList.add('can');
    return rw;
  }
  function recipeList(where) {
    const list = el('div', 'plist');
    G.Crafting.list(where).forEach(function (r) { list.appendChild(recipeRow(r, where)); });
    return list;
  }

  // Bag: tap an item to select it, then tap a hotbar slot (or press 1-8) to assign it
  function renderBag() {
    box.innerHTML = ''; box.className = 'bag'; box.appendChild(head('Túi đồ'));
    if (UI.bagSel && !Inv.count(UI.bagSel)) UI.bagSel = null;
    const hint = el('p', 'phint'); box.appendChild(hint);
    hint.textContent = UI.bagSel ? 'Đã chọn ' + Inv.item(UI.bagSel).name + ' — chạm ô 1–8 bên dưới để gán' : 'Chạm một vật phẩm, rồi chạm ô thanh nhanh bên dưới để gán';
    const g = el('div', 'bgrid');
    for (let i = 0; i < Inv.SLOTS; i++) {
      const s = Inv.slots[i], it = s && Inv.item(s.id);
      const c = el('button', 'bslot' + (s ? '' : ' empty') + (s && s.id === UI.bagSel ? ' sel' : '') + (it && it.tier === 2 ? ' cu' : '')); c.type = 'button';
      if (it) {
        c.innerHTML = '<span class="ic"></span><small></small><b></b>'; c.querySelector('.ic').textContent = it.icon; c.querySelector('small').textContent = it.name; c.querySelector('b').textContent = s.n > 1 ? s.n : '';
        c.addEventListener('pointerdown', function (e) { e.preventDefault(); UI.bagSel = UI.bagSel === s.id ? null : s.id; sfx('click'); renderBag(); });
      }
      g.appendChild(c);
    }
    box.appendChild(g);
    box.appendChild(el('h3', 'psub', 'Chế tạo bằng tay'));
    box.appendChild(recipeList('hand'));
  }
  UI.openBag = function () { open('bag', renderBag); };

  // Workbench beside the house
  function renderBench() {
    box.innerHTML = ''; box.className = 'bench'; box.appendChild(head('Bàn chế tạo'));
    box.appendChild(recipeList('bench'));
  }
  UI.openBench = function () { open('bench', renderBench); };

  // ---------- action routing ----------
  const FD = { n: [0, -1], s: [0, 1], e: [1, 0], w: [-1, 0] };
  function hitAt(f) {
    for (const o of W.interactables) {
      if (o.tx !== f.tx || o.tz !== f.tz) continue;
      const d = o.facing && FD[o.facing];
      if (d && (P.facing.dx !== -d[0] || P.facing.dz !== -d[1])) continue;
      return o;
    }
    return null;
  }
  // Game.Actions.register(itemId, handler): handler = { label(tx, tz, item) -> string|null, act(tx, tz, item) -> bool }.
  // An item's handler runs when it has a label for the facing tile; otherwise the 'hand' handler does (harvest, pick up).
  const handlers = {};
  function pickHandler(tx, tz, item) {
    const h = handlers[item], hd = handlers.hand; let l;
    if (h && (l = h.label(tx, tz, item))) return { h: h, l: l };
    if (hd && (l = hd.label(tx, tz, item))) return { h: hd, l: l };
    return null;
  }
  const Actions = G.Actions = {
    register: function (id, h) { handlers[id] = h; },
    label: function (tx, tz, item) { const p = pickHandler(tx, tz, item); return p ? p.l : null; },
    act: function (tx, tz, item) {
      const p = pickHandler(tx, tz, item); if (p) return p.h.act(tx, tz, item);
      if (Farm.inPlot(tx, tz)) return Farm.act(tx, tz, item);          // 1B: farm explains why nothing happened
      return G.Resources ? G.Resources.act(tx, tz, item) : false;     // wrong tool on a tree / rock explains itself
    }
  };
  const Res = G.Resources;
  const farmH = { label: function (tx, tz, item) { return Farm.preview(tx, tz, item); }, act: function (tx, tz, item) { return Farm.act(tx, tz, item); } };
  const toolH = { label: function (tx, tz, item) { return Res.label(tx, tz, item); }, act: function (tx, tz, item) { return Res.act(tx, tz, item); } };
  Object.keys(Inv.ITEMS).forEach(function (id) {
    const it = Inv.ITEMS[id];
    if (id === 'hoe' || id === 'can' || it.kind === 'seed') Actions.register(id, farmH);
    else if (it.kind === 'tool' && it.tool) Actions.register(id, toolH);
  });
  Actions.register('hand', {
    label: function (tx, tz, item) { return Res.pickupAt(tx, tz) ? 'Nhặt' : Farm.preview(tx, tz, 'hand'); },
    act: function (tx, tz, item) { return Res.pickupAt(tx, tz) ? Res.pickup(tx, tz) : Farm.act(tx, tz, item); }
  });

  E.on('player:interact', function (e) {
    if (panel.kind || Farm.sleeping()) return;
    if (e.id === 'door') { Farm.sleep(); return; }
    if (e.id === 'shop') { UI.openShop(); return; }
    if (e.id === 'bench') { UI.openBench(); return; }
    if (e.id === 'ship') { UI.toast('Mang nông sản ra quán tạp hóa để bán'); return; }
    Actions.act(e.tx, e.tz, UI.selected);
  });
  E.on('node:broken', function (e) { UI.toast('+' + e.n + ' ' + Inv.item(e.item).name); });
  E.on('item:picked', function (e) { UI.toast('+1 ' + Inv.item(e.item).name); });
  E.on('item:crafted', function (e) { UI.toast('Đã chế tạo ' + Inv.item(e.item).name, 'good'); });

  // ---------- context label on the big action button ----------
  const act = $('act'); let lastLabel = '';
  G.Loop.onRender(function () {
    let label = null;
    if (!panel.kind && !Farm.sleeping()) {
      const f = W.facingTile(P), o = hitAt(f);
      if (o) label = o.id === 'door' ? 'Ngủ' : o.id === 'shop' ? 'Mua bán' : o.id === 'bench' ? 'Chế tạo' : null;
      else label = Actions.label(f.tx, f.tz, UI.selected);
    }
    const text = label || 'Dùng';
    if (text !== lastLabel) { lastLabel = text; act.textContent = text; act.classList.toggle('idle', !label); }
  }, 70);

  E.on('save:loaded', function () {
    if (!hotLoaded) migrate();                       // save from 1B (no hotbar key yet)
    buildHot(); refreshStats(); refreshMute(); });
  migrate(); buildHot(); refreshStats(); refreshMute();
})(window.Game);
