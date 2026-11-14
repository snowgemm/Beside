'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

class Vector3 {
  constructor() { this.x = 0; this.y = 0; this.z = 0; }
  set(x, y, z) { this.x = x; this.y = y; this.z = z; return this; }
}

class Mesh {
  constructor(geometry, material) {
    this.geometry = geometry;
    this.material = material;
    this.position = new Vector3();
    this.rotation = { x: 0, y: 0, z: 0 };
    this.userData = {};
    this.visible = true;
  }
  add(child) { child.parent = this; }
}

class Geometry {}
class Material {
  constructor(options) { this.options = options; }
}

const sceneObjects = new Set();
const scene = {
  add(object) { sceneObjects.add(object); },
  remove(object) { sceneObjects.delete(object); }
};
const registeredEvents = Object.create(null);
const receivedItems = [];
const toasts = [];
let inventoryCapacity = 1;

const game = {
  world: {
    seed: 1234,
    getHeight() { return 12.25; }
  },
  player: { spawnPos: { x: 0, z: 0 } },
  inventory: {
    add(item) {
      if (receivedItems.length >= inventoryCapacity) return false;
      receivedItems.push(item);
      return true;
    }
  },
  save: { register() {} },
  events: {
    on(name, callback) {
      (registeredEvents[name] ||= []).push(callback);
    }
  },
  audio: { play() {} },
  assets: { model() { return null; } },
  toast(message) { toasts.push(message); },
  loot: null
};
const window = { Game: game };
const THREE = {
  BoxGeometry: Geometry,
  TorusGeometry: Geometry,
  Mesh,
  MeshBasicMaterial: Material
};

const sourcePath = path.join(__dirname, '..', 'js', 'items.js');
vm.runInNewContext(fs.readFileSync(sourcePath, 'utf8'), {
  window,
  THREE,
  console,
  Math,
  isFinite,
  Object,
  Array
}, { filename: 'js/items.js' });

game.loot.init(scene);
const loot = game.loot;
const makeItem = (id) => ({
  id,
  name: 'Test item ' + id,
  slot: 'weapon',
  rarity: 0,
  stats: { damage: 10, cdMult: 1, reach: 2.2 }
});

// Simulate the maximum normal overworld drop set before entering a dungeon.
const originalWorldDrops = [];
for (let i = 0; i < 30; i++) {
  originalWorldDrops.push(loot.spawnDrop(makeItem('world-' + i), i, 0, 0));
}
assert.equal(loot.drops.length, 30, 'normal drops should remain bounded at MAXD');
const originalWorldMeshes = originalWorldDrops.map(drop => drop.mesh);

// Dungeon entry hides the saved overworld drops and starts a separate drop list.
const dungeonDrops = [
  loot.spawnDrop(makeItem('dungeon-accepted'), 5, 5, 0),
  loot.spawnDrop(makeItem('dungeon-overflow-1'), 6, 5, 0),
  loot.spawnDrop(makeItem('dungeon-overflow-2'), 7, 5, 0)
];
loot.drops = originalWorldDrops;
originalWorldDrops.forEach(drop => { drop.mesh.visible = true; });

// Only one item fits. The two rejected items must be re-created at the overworld gate.
const overflow = loot.returnDungeonDrops(dungeonDrops, 100, 200);
assert.equal(receivedItems.length, 1, 'the available inventory slot should be used');
assert.equal(receivedItems[0].id, 'dungeon-accepted', 'the first fitting dungeon item should be collected');
assert.equal(overflow, 2, 'both unaccepted dungeon items must be returned to the overworld');
assert.equal(loot.drops.length, 32, 'the old overworld drops and both overflow drops must coexist');
assert.ok(originalWorldDrops.every(drop => loot.drops.includes(drop)),
  'returning dungeon loot must not evict the saved overworld drops');
assert.ok(originalWorldMeshes.every(mesh => sceneObjects.has(mesh)),
  'saved overworld drop meshes must remain in the scene');
assert.ok(dungeonDrops.every(drop => !sceneObjects.has(drop.mesh)),
  'old dungeon drop meshes must be removed before rehoming');

const returned = loot.drops.slice(30);
assert.deepEqual(returned.map(drop => drop.item.id), ['dungeon-overflow-1', 'dungeon-overflow-2']);
assert.ok(returned.every(drop =>
  Math.abs(drop.x - 100) <= 1.65 &&
  Math.abs(drop.z - 200) <= 1.65 &&
  Math.abs(drop.b.y - 12.75) < 1e-9),
  'overflow drops must spawn near the exit using the restored overworld height');
assert.ok(toasts.some(message => message.includes('còn 2 vật phẩm')),
  'the player must be told that overflow loot remains at the dungeon entrance');

// A later regular drop must trim only one old drop, not purge the entire overflow batch.
loot.spawnDrop(makeItem('later-world-drop'), 0, 0, 0);
assert.equal(loot.drops.length, 32, 'a later drop should preserve the existing over-cap batch size');
assert.ok(returned.every(drop => loot.drops.includes(drop)),
  'later cap enforcement must not mass-delete the dungeon overflow batch');

process.stdout.write('Dungeon loot return checks: 8 assertions passed\\n');
