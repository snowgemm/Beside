(function () {
  var G = window.Game = window.Game || {};
  var SLOTS = ['weapon', 'armor', 'trinket'];
  var SLOT_NAME = { weapon: 'Vũ khí', armor: 'Giáp', trinket: 'Trang sức' };
  var RAR = [
    { id: 'common', name: 'Thường', color: '#b8b8b8', hex: 0xb8b8b8, weight: 60, affixes: 0 },
    { id: 'uncommon', name: 'Tốt', color: '#4ccf4c', hex: 0x4ccf4c, weight: 25, affixes: 1 },
    { id: 'rare', name: 'Hiếm', color: '#4c8dff', hex: 0x4c8dff, weight: 12, affixes: 2 },
    { id: 'epic', name: 'Sử thi', color: '#b24cff', hex: 0xb24cff, weight: 3, affixes: 3 }
  ];
  function pct(v) { return (Math.round(v * 1000) / 10) + '%'; }
  var STAT = {
    damage: { label: 'Sát thương', fmt: function (v) { return String(Math.round(v)); } },
    cdMult: { label: 'Hồi chiêu', fmt: function (v) { return '×' + v.toFixed(2); }, lower: true },
    reach: { label: 'Tầm đánh', fmt: function (v) { return v.toFixed(1); } },
    dr: { label: 'Giảm sát thương', fmt: pct },
    hp: { label: 'Máu tối đa', fmt: function (v) { return String(Math.round(v)); } },
    speed: { label: 'Tốc độ chạy', fmt: pct },
    crit: { label: 'Tỉ lệ chí mạng', fmt: pct }
  };
  var ORDER = Object.keys(STAT);
  var BASES = {
    weapon: [
      { name: 'Kiếm sắt', icon: '🗡️', dmg: 10, cd: 1, reach: 2.2 }, { name: 'Rìu chiến', icon: '🪓', dmg: 15, cd: 1.5, reach: 2 },
      { name: 'Dao găm', icon: '🔪', dmg: 6, cd: 0.65, reach: 1.8 }, { name: 'Giáo', icon: '🔱', dmg: 9, cd: 1.25, reach: 2.8 }],
    armor: [
      { name: 'Áo da', icon: '🧥', dr: 0.05, hp: 5 }, { name: 'Giáp xích', icon: '🛡️', dr: 0.09, hp: 10 }, { name: 'Giáp thép', icon: '🦺', dr: 0.13, hp: 0 }],
    trinket: [
      { name: 'Nhẫn', icon: '💍', speed: 0.04, hp: 0, crit: 0.01 }, { name: 'Bùa hộ mệnh', icon: '📿', speed: 0, hp: 15, crit: 0.01 },
      { name: 'Mề đay', icon: '🏅', speed: 0.01, hp: 5, crit: 0.04 }]
  };
  var AFF = {
    weapon: [
      { name: 'sắc bén', apply: function (s) { s.damage *= 1.15; } },
      { name: 'thần tốc', apply: function (s) { s.cdMult *= 0.88; } },
      { name: 'vươn xa', apply: function (s) { s.reach += 0.3; } }],
    armor: [
      { name: 'kiên cố', apply: function (s) { s.dr += 0.03; } },
      { name: 'sinh lực', apply: function (s, m) { s.hp += 12 * m; } },
      { name: 'bền bỉ', apply: function (s, m) { s.dr += 0.015; s.hp += 6 * m; } }],
    trinket: [
      { name: 'nhanh chân', apply: function (s) { s.speed += 0.05; } },
      { name: 'tráng kiện', apply: function (s, m) { s.hp += 12 * m; } },
      { name: 'chí mạng', apply: function (s) { s.crit += 0.05; } }]
  };
  function rng(seed) { return function () { seed |= 0; seed = seed + 0x6D2B79F5 | 0; var t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function hash32(a, b, c) { var h = Math.imul(a | 0, 374761393) ^ Math.imul(b | 0, 668265263) ^ Math.imul(c | 0, 2246822519); h = Math.imul(h ^ h >>> 15, 2246822519); h ^= h >>> 13; return h >>> 0; }
  function strHash(s) { var h = 7; for (var i = 0; i < s.length; i++) h = Math.imul(h, 31) + s.charCodeAt(i) | 0; return h; }
  function r1(v, n) { var p = Math.pow(10, n); return Math.round(v * p) / p; }
  function gen(slot, rarity, level, rand) {
    var pool = BASES[slot], b = pool[Math.floor(rand() * pool.length)], R = RAR[rarity];
    var m = (1 + 0.1 * (level - 1)) * (1 + 0.12 * rarity), dm = (1 + 0.02 * (level - 1)) * (1 + 0.1 * rarity), s = {};
    if (slot === 'weapon') { s.damage = b.dmg * m; s.cdMult = b.cd; s.reach = b.reach; }
    else if (slot === 'armor') { s.dr = b.dr * dm; s.hp = b.hp * m; }
    else { s.speed = b.speed; s.hp = b.hp * m; s.crit = b.crit; }
    var ap = AFF[slot].slice(), names = [];
    for (var i = 0; i < R.affixes && ap.length; i++) { var a = ap.splice(Math.floor(rand() * ap.length), 1)[0]; a.apply(s, m); names.push(a.name); }
    var st = {};
    if (slot === 'weapon') { st.damage = Math.max(1, Math.round(s.damage)); st.cdMult = r1(s.cdMult, 2); st.reach = r1(s.reach, 1); }
    else { if (s.dr) st.dr = r1(s.dr, 3); if (s.hp) st.hp = Math.round(s.hp); if (s.speed) st.speed = r1(s.speed, 3); if (s.crit) st.crit = r1(s.crit, 3); }
    return { slot: slot, rarity: rarity, level: level, name: b.name + (names.length ? ' ' + names.join(', ') : ''), icon: b.icon, stats: st };
  }
  function valid(it) {
    if (!it || typeof it !== 'object' || SLOTS.indexOf(it.slot) < 0 || !RAR[it.rarity] || typeof it.name !== 'string' || !it.stats || typeof it.stats !== 'object') return false;
    for (var k in it.stats) if (!STAT[k] || !isFinite(it.stats[k])) return false;
    if (it.slot === 'weapon' && !(isFinite(it.stats.damage) && isFinite(it.stats.cdMult) && isFinite(it.stats.reach))) return false;
    return true;
  }
  G.items = { SLOTS:SLOTS, SLOT_NAME:SLOT_NAME, RARITIES:RAR, STAT:STAT, ORDER:ORDER, rng:rng, hash32:hash32, generate:gen, valid:valid, DEFAULT:{weapon:{damage:10,cdMult:1,reach:2.2},armor:{},trinket:{}} };
  var MAXD=30,LIFE=120,scene,dropGeo,dropMats=[],lastFull=-9,clock=0;
  var L=G.loot={counter:0,drops:[],sources:{slime:{chance:.25,bonus:0},goblin:{chance:.4,bonus:.15},archer:{chance:.35,bonus:.15},chest:{chance:1,bonus:.5}}};
  L.levelAt=function(x,z){var sp=G.player.spawnPos||{x:0,z:0};return Math.min(50,1+Math.floor(Math.sqrt((x-sp.x)*(x-sp.x)+(z-sp.z)*(z-sp.z))/60));};
  function pickRarity(r,bonus){var w=RAR.map(function(q,i){return q.weight*(1+bonus*i*3);}),tot=0,i;for(i=0;i<w.length;i++)tot+=w[i];var p=r()*tot;for(i=0;i<w.length;i++){p-=w[i];if(p<=0)return i;}return 0;}
  L.roll=function(level,source,seed){var type=typeof source==='string'?source:(source&&source.type)||'misc',src=L.sources[type]||{bonus:0};if(seed==null){L.counter++;seed=hash32(G.world.seed,L.counter,strHash(type));}var r=rng(seed),rar=pickRarity(r,src.bonus||0),slot=SLOTS[Math.floor(r()*SLOTS.length)],it=gen(slot,rar,Math.max(1,level|0),r);it.seed=seed;it.id='i'+seed.toString(36);return it;};
  L.spawnDrop=function(item,x,z,delay){var y=G.world.getHeight(x,z),m=new THREE.Mesh(dropGeo,dropMats[item.rarity]||dropMats[0]);m.rotation.x=.6;m.position.set(x,y+.6,z);scene.add(m);L.drops.push({item:item,mesh:m,y:y,x:x,z:z,t:0,delay:delay||0,bob:Math.random()*6});while(L.drops.length>MAXD)removeDrop(L.drops[0]);};
  function removeDrop(d){scene.remove(d.mesh);var i=L.drops.indexOf(d);if(i>=0)L.drops.splice(i,1);}
  L.init=function(sc){scene=sc;dropGeo=new THREE.BoxGeometry(.35,.35,.35);dropMats=RAR.map(function(q){return new THREE.MeshBasicMaterial({color:q.hex});});G.save.register('loot',function(){return{counter:L.counter};},function(d){L.counter=d.counter|0;});G.events.on('enemyDied',function(e){var src=L.sources[e.type];if(!src)return;L.counter++;var seed=hash32(G.world.seed,L.counter,strHash(e.type));if(rng(seed^0x9e3779b9)()>src.chance)return;L.spawnDrop(L.roll(L.lootLevelAt?L.lootLevelAt(e.x,e.z):L.levelAt(e.x,e.z),e.type,seed),e.x,e.z,.4);});};
  L.update=function(dt){var P=G.player,p=P.pos;clock+=dt;for(var i=L.drops.length-1;i>=0;i--){var d=L.drops[i];d.t+=dt;d.delay-=dt;if(d.t>LIFE){removeDrop(d);continue;}d.mesh.rotation.y+=dt*2.5;d.mesh.position.y=d.y+.6+Math.sin(d.t*3+d.bob)*.12;if(d.delay>0||P.dead)continue;var dx=d.x-p.x,dz=d.z-p.z;if(dx*dx+dz*dz<2.25&&Math.abs(p.y+.9-d.mesh.position.y)<2.5){if(G.inventory.add(d.item)){G.toast('Nhặt được: '+d.item.name,RAR[d.item.rarity].color);G.audio.play('pickup');removeDrop(d);}else if(clock-lastFull>2.5){lastFull=clock;G.toast('Hành trang đầy','#ff8080');}}}};
})();