'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'js', 'terrain-worker.js'), 'utf8');
const messages = [];
let transfers = [];
const self = {
  onmessage: null,
  postMessage(message, transfer) {
    messages.push(message);
    transfers = transfer || [];
  }
};
const context = vm.createContext({ self, Float32Array, Float64Array, Uint8Array, Uint16Array, Math, Number, Error });
vm.runInContext(source, context, { filename: 'js/terrain-worker.js' });

function makeHeights(cx, cz) {
  const cs = 16, n = cs + 3, values = new Float32Array(n * n);
  for (let z = -1; z <= cs + 1; z++) {
    for (let x = -1; x <= cs + 1; x++) {
      const wx = cx * cs + x, wz = cz * cs + z;
      values[(z + 1) * n + x + 1] = 13 + Math.sin(wx * 0.11) * 3.1 + Math.cos(wz * 0.09) * 2.4;
    }
  }
  return values;
}
function generate(id, cx, cz) {
  const before = messages.length;
  self.onmessage({ data: {
    type: 'generate', id, cx, cz, seed: 1337,
    heights: makeHeights(cx, cz), soil: 0x8a5a30, stone: 0x80838a
  } });
  assert.equal(messages.length, before + 1, 'worker must return one result for each request');
  return messages[messages.length - 1];
}
function finite(array) {
  return Array.from(array).every(Number.isFinite);
}

const left = generate(1, 0, 0);
const right = generate(2, 1, 0);
assert.equal(left.type, 'generated');
assert.equal(right.type, 'generated');
assert.equal(left.positions.length, 17 * 17 * 3);
assert.equal(left.colors.length, left.positions.length);
assert.equal(left.normals.length, left.positions.length);
assert.equal(left.uvs.length, 17 * 17 * 2);
assert.equal(left.indices.length, 16 * 16 * 6);
assert.equal(left.biomes.length, 16 * 16);
assert.ok(finite(left.positions) && finite(left.colors) && finite(left.normals) && finite(left.uvs));
assert.ok(left.indices.every((index) => index < 17 * 17), 'all indices must address an existing vertex');

for (let z = 0; z <= 16; z++) {
  const leftVertex = (z * 17 + 16) * 3;
  const rightVertex = (z * 17) * 3;
  for (let axis = 0; axis < 3; axis++) {
    assert.equal(left.normals[leftVertex + axis], right.normals[rightVertex + axis],
      'adjacent chunk normals must be identical at the shared border');
    assert.equal(left.colors[leftVertex + axis], right.colors[rightVertex + axis],
      'adjacent chunk colours must be identical at the shared border');
  }
  const leftUv = (z * 17 + 16) * 2;
  const rightUv = (z * 17) * 2;
  assert.equal(left.uvs[leftUv], right.uvs[rightUv]);
  assert.equal(left.uvs[leftUv + 1], right.uvs[rightUv + 1]);
}
assert.equal(transfers.length, 6, 'all returned typed-array buffers should be transferable');
assert.ok(transfers.every((buffer) => buffer instanceof ArrayBuffer));

const repeat = generate(3, 0, 0);
assert.deepEqual(Array.from(repeat.positions), Array.from(left.positions));
assert.deepEqual(Array.from(repeat.colors), Array.from(left.colors));
assert.deepEqual(Array.from(repeat.indices), Array.from(left.indices));

self.onmessage({ data: { type: 'generate', id: 4, cx: 0, cz: 0, seed: 1337, heights: new Float32Array(8) } });
assert.equal(messages[messages.length - 1].type, 'error',
  'invalid worker payloads should return a recoverable error instead of crashing silently');

console.log('PASS terrain worker emits finite typed geometry, valid indices, matching chunk seams, deterministic output and transferable buffers');
console.log('Terrain worker checks: 4/4 passed');
