/* crafting.js - Stage 2A: Game.Crafting recipe table + craft(id).
   where 'hand' = from the bag panel (no bench); where 'bench' = at the workbench beside the house.
   Emits 'item:crafted' { recipe, item, n, where, by }; failures emit 'farm:denied' (toast + error sound in ui.js / sfx.js). */
(function (G) {
  'use strict';
  const Inv = G.Inventory, E = G.Events;

  // in: { itemId: amount }, out: itemId (+ n). Recipe ids are the output ids (unique).
  const RECIPES = [
    { id: 'axe_stone',   where: 'hand',  out: 'axe_stone',   n: 1, in: { branch: 3, pebble: 2 } },
    { id: 'pick_stone',  where: 'hand',  out: 'pick_stone',  n: 1, in: { branch: 3, pebble: 3 } },
    { id: 'plank',       where: 'bench', out: 'plank',       n: 1, in: { wood: 2 } },
    { id: 'fence',       where: 'bench', out: 'fence',       n: 1, in: { plank: 2 } },
    { id: 'chest',       where: 'bench', out: 'chest',       n: 1, in: { plank: 4 } },
    { id: 'rod',         where: 'bench', out: 'rod',         n: 1, in: { bamboo: 3, plank: 1 } },
    { id: 'ingot',       where: 'bench', out: 'ingot',       n: 1, in: { ore: 2, bamboo: 1 }, note: 'tre làm nhiên liệu' },
    { id: 'axe_copper',  where: 'bench', out: 'axe_copper',  n: 1, in: { ingot: 2, plank: 2 } },
    { id: 'pick_copper', where: 'bench', out: 'pick_copper', n: 1, in: { ingot: 3, plank: 2 } }
  ];
  const byId = {}; RECIPES.forEach(function (r) { byId[r.id] = r; });

  const C = G.Crafting = {
    recipes: RECIPES,
    get: function (id) { return byId[id] || null; },
    list: function (where) { return RECIPES.filter(function (r) { return !where || r.where === where; }); },
    // Missing inputs as [{id, need, have}] (empty = craftable by materials).
    missing: function (id) {
      const r = byId[id], out = []; if (!r) return out;
      Object.keys(r.in).forEach(function (k) { const have = Inv.count(k); if (have < r.in[k]) out.push({ id: k, need: r.in[k], have: have }); });
      return out;
    },
    can: function (id) { return !!byId[id] && C.missing(id).length === 0; },
    craft: function (id, where) {
      const r = byId[id], deny = function (text, reason) { E.emit('farm:denied', { reason: reason || 'craft', text: text }); return false; };
      if (!r) return false;
      if (where && r.where !== where) return deny('Cần bàn chế tạo');
      if (C.missing(id).length) return deny('Chưa đủ nguyên liệu', 'need_items');
      const keys = Object.keys(r.in), taken = [];
      for (const k of keys) { if (!Inv.remove(k, r.in[k])) { taken.forEach(function (t) { Inv.add(t[0], t[1]); }); return deny('Chưa đủ nguyên liệu', 'need_items'); } taken.push([k, r.in[k]]); }
      if (Inv.add(r.out, r.n) < r.n) {                      // bag full: give everything back
        taken.forEach(function (t) { Inv.add(t[0], t[1]); });
        return deny('Túi đồ đã đầy', 'bag_full');
      }
      E.emit('item:crafted', { recipe: id, item: r.out, n: r.n, where: r.where, by: G.Net.playerId });
      return true;
    }
  };
})(window.Game);
