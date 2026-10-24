/* inventory.js - item catalogue, Game.Inventory (30 slots, stacks of 99) and Game.State (money in đồng, energy 0-100, mute flag) */
(function (G) {
  'use strict';
  const SLOTS = 30, STACK = 99;

  // crops: days = growing days until ripe, seed = seed price, sell = produce price (đồng)
  const CROPS = {
    rau:   { id: 'rau',   name: 'Rau muống', days: 3, seed: 20, sell: 45 },
    cachua: { id: 'cachua', name: 'Cà chua',  days: 4, seed: 35, sell: 85 },
    lua:   { id: 'lua',   name: 'Lúa',       days: 6, seed: 60, sell: 170 }
  };
  const ITEMS = {
    hoe: { id: 'hoe', name: 'Cuốc', kind: 'tool', icon: '⛏️' },
    can: { id: 'can', name: 'Bình tưới', kind: 'tool', icon: '🚿' },
    // Stage 2A: gathered materials (sell = price in the shop, none = not sellable), tools (tool = axe|pick, tier 1 stone / 2 copper), crafted goods
    branch: { id: 'branch', name: 'Cành cây', kind: 'material', icon: '🌿' },
    pebble: { id: 'pebble', name: 'Đá nhỏ', kind: 'material', icon: '⚪' },
    wood:   { id: 'wood',   name: 'Gỗ',       kind: 'material', icon: '🪵', sell: 8 },
    stone:  { id: 'stone',  name: 'Đá',       kind: 'material', icon: '🪨', sell: 6 },
    bamboo: { id: 'bamboo', name: 'Tre',      kind: 'material', icon: '🎋', sell: 5 },
    ore:    { id: 'ore',    name: 'Quặng đồng', kind: 'material', icon: '🟠', sell: 30 },
    ingot:  { id: 'ingot',  name: 'Đồng thỏi', kind: 'material', icon: '🧱', sell: 70 },
    axe_stone:   { id: 'axe_stone',   name: 'Rìu đá',         kind: 'tool', tool: 'axe',  tier: 1, icon: '🪓' },
    pick_stone:  { id: 'pick_stone',  name: 'Cuốc chim đá',   kind: 'tool', tool: 'pick', tier: 1, icon: '⚒️' },
    axe_copper:  { id: 'axe_copper',  name: 'Rìu đồng',       kind: 'tool', tool: 'axe',  tier: 2, icon: '🪓' },
    pick_copper: { id: 'pick_copper', name: 'Cuốc chim đồng', kind: 'tool', tool: 'pick', tier: 2, icon: '⚒️' },
    plank:  { id: 'plank',  name: 'Ván gỗ',  kind: 'material', icon: '🟫', sell: 20 },
    fence:  { id: 'fence',  name: 'Hàng rào', kind: 'material', icon: '🚧' },
    chest:  { id: 'chest',  name: 'Rương',    kind: 'material', icon: '📦' },
    // Stage 2B: fishing (rod is a tool without .tool, so fishing.js registers its action; fish and junk sell in the shop)
    rod:        { id: 'rod',        name: 'Cần câu',     kind: 'tool', icon: '🎣' },
    fish_ro:    { id: 'fish_ro',    name: 'Cá rô đồng',  kind: 'fish', icon: '🐟', sell: 25 },
    fish_chep:  { id: 'fish_chep',  name: 'Cá chép',     kind: 'fish', icon: '🐟', sell: 40 },
    fish_tre:   { id: 'fish_tre',   name: 'Cá trê',      kind: 'fish', icon: '🐟', sell: 55 },
    fish_loc:   { id: 'fish_loc',   name: 'Cá lóc',      kind: 'fish', icon: '🐟', sell: 90 },
    fish_dieu:  { id: 'fish_dieu',  name: 'Cá diêu hồng', kind: 'fish', icon: '🐠', sell: 160 },
    junk_shoe:  { id: 'junk_shoe',  name: 'Giày cũ',     kind: 'junk', icon: '👟', sell: 2 },
    junk_weed:  { id: 'junk_weed',  name: 'Rong',        kind: 'junk', icon: '🍃', sell: 1 }
  };
  Object.keys(CROPS).forEach(function (k) {
    const c = CROPS[k];
    ITEMS['seed_' + k] = { id: 'seed_' + k, name: 'Hạt ' + c.name.toLowerCase(), kind: 'seed', crop: k, price: c.seed, icon: '🌱' };
    ITEMS['crop_' + k] = { id: 'crop_' + k, name: c.name, kind: 'produce', crop: k, sell: c.sell, icon: { rau: '🥬', cachua: '🍅', lua: '🌾' }[k] };
  });

  const Inv = G.Inventory = {
    SLOTS: SLOTS, STACK: STACK, ITEMS: ITEMS, CROPS: CROPS, slots: new Array(SLOTS).fill(null),
    item: function (id) { return ITEMS[id] || null; },
    count: function (id) { let n = 0; for (const s of this.slots) if (s && s.id === id) n += s.n; return n; },
    // Room left for this item (tools never stack: 1 per slot, still counted as slot space).
    room: function (id) {
      let r = 0;
      for (const s of this.slots) { if (!s) r += STACK; else if (s.id === id) r += STACK - s.n; }
      return r;
    },
    // Adds up to n; returns how many were actually added (less than n if the bag is full).
    add: function (id, n) {
      n = Math.floor(n === undefined ? 1 : n);
      if (!ITEMS[id] || !(n > 0)) return 0;
      let left = n;
      for (const s of this.slots) {
        if (left <= 0) break;
        if (s && s.id === id && s.n < STACK) { const a = Math.min(left, STACK - s.n); s.n += a; left -= a; }
      }
      for (let i = 0; i < SLOTS && left > 0; i++) {
        if (!this.slots[i]) { const a = Math.min(left, STACK); this.slots[i] = { id: id, n: a }; left -= a; }
      }
      const added = n - left;
      if (added) G.Events.emit('inventory:changed', { id: id, delta: added });
      return added;
    },
    // All-or-nothing: returns true only if n were available and removed.
    remove: function (id, n) {
      n = Math.floor(n === undefined ? 1 : n);
      if (!(n > 0) || this.count(id) < n) return false;
      let left = n;
      for (let i = SLOTS - 1; i >= 0 && left > 0; i--) {
        const s = this.slots[i];
        if (s && s.id === id) { const a = Math.min(left, s.n); s.n -= a; left -= a; if (s.n <= 0) this.slots[i] = null; }
      }
      G.Events.emit('inventory:changed', { id: id, delta: -n });
      return true;
    },
    save: function () { return { slots: this.slots.map(function (s) { return s ? [s.id, s.n] : 0; }) }; },
    load: function (d) {
      const src = (d && d.slots) || [];
      this.slots = new Array(SLOTS).fill(null);
      for (let i = 0; i < SLOTS; i++) {
        const s = src[i];
        if (s && ITEMS[s[0]] && s[1] > 0) this.slots[i] = { id: s[0], n: Math.min(STACK, s[1] | 0) };
      }
      G.Events.emit('inventory:changed', { id: null, delta: 0 });
    },
    reset: function () {
      this.slots = new Array(SLOTS).fill(null);
      this.slots[0] = { id: 'hoe', n: 1 }; this.slots[1] = { id: 'can', n: 1 }; this.slots[2] = { id: 'seed_rau', n: 5 };
      G.Events.emit('inventory:changed', { id: null, delta: 0 });
    }
  };

  const St = G.State = {
    money: 300, energy: 100, muted: false,
    addMoney: function (n) { this.money = Math.max(0, this.money + n); this._ch(); },
    // Spends n đồng; false (and no change) if the player can't afford it.
    spend: function (n) { if (this.money < n) return false; this.money -= n; this._ch(); return true; },
    // Spends energy; false if not enough (callers show the toast).
    useEnergy: function (n) { if (this.energy < n) return false; this.energy -= n; this._ch(); return true; },
    setEnergy: function (n) { this.energy = Math.max(0, Math.min(100, n)); this._ch(); },
    _ch: function () { G.Events.emit('state:changed', { money: this.money, energy: this.energy }); },
    save: function () { return { money: this.money, energy: this.energy, muted: this.muted }; },
    load: function (d) {
      d = d || {};
      this.money = isFinite(d.money) ? Math.max(0, d.money | 0) : 300;
      this.energy = isFinite(d.energy) ? Math.max(0, Math.min(100, d.energy)) : 100;
      this.muted = !!d.muted; this._ch();
    },
    reset: function () { this.money = 300; this.energy = 100; this.muted = false; this._ch(); }
  };

  Inv.reset();
  G.Save.register('inventory', Inv, 'player');
  G.Save.register('state', St, 'player');
})(window.Game);
