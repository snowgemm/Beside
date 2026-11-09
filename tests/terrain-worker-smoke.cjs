'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const coreSource = fs.readFileSync(path.join(__dirname, '..', 'js', 'terrain-core.js'), 'utf8');
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
context.importScripts = function () { vm.runInContext(coreSource, context, { filename: 'js/terrain-core.js' }); };
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
function generate(id, cx, cz, lod = 0) {
  const before = messages.length;
  self.onmessage({ data: {
    type: 'generate', id, cx, cz, lod, seed: 1337,
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

// The renderer fallback and worker must share the exact same biome and colour implementation.
const core = self.TerrainCore.create(1337, 32, 10);
const sharedHeights = makeHeights(0, 0), stride = 19;
for (let z = 0; z <= 16; z++) {
  for (let x = 0; x <= 16; x++) {
    const heightIndex = (z + 1) * stride + x + 1;
    const height = sharedHeights[heightIndex];
    const slopeX = sharedHeights[heightIndex + 1] - sharedHeights[heightIndex - 1];
    const slopeZ = sharedHeights[heightIndex + stride] - sharedHeights[heightIndex - stride];
    const expected = core.vertexPaint(x, z, height, Math.sqrt(slopeX * slopeX + slopeZ * slopeZ) * .5, 0x8a5a30, 0x80838a);
    const vertex = (z * 17 + x) * 3;
    for (let channel = 0; channel < 3; channel++) {
      assert.equal(left.colors[vertex + channel], Math.fround(expected[channel]),
        'worker Float32 colour must match the shared main-thread terrain core');
    }
  }
}
for (let z = 0; z < 16; z++) {
  for (let x = 0; x < 16; x++) {
    assert.equal(left.biomes[z * 16 + x], core.biomeW(x + .5, z + .5),
      'worker biome assignments must match the shared terrain core');
  }
}

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
assert.ok(transfers.every((buffer) => Object.prototype.toString.call(buffer) === '[object ArrayBuffer]'));

const repeat = generate(3, 0, 0);
assert.deepEqual(Array.from(repeat.positions), Array.from(left.positions));
assert.deepEqual(Array.from(repeat.colors), Array.from(left.colors));
assert.deepEqual(Array.from(repeat.indices), Array.from(left.indices));
const far = generate(5, 1, 0, 1);
assert.equal(far.type, 'generated');
assert.equal(far.lod, 1);
assert.equal(far.positions.length / 3, 177,
  'far LOD should retain a 9x9 coarse grid, 8x8 patch centres and all 32 edge midpoints');
assert.equal(far.indices.length, 864,
  'boundary-stitched LOD should use fewer triangles than the full-resolution chunk');
assert.ok(far.indices.every((index) => index < far.positions.length / 3),
  'far LOD indices must address an existing vertex');

function findVertex(mesh, x, z) {
  for (let i = 0; i < mesh.positions.length; i += 3) {
    if (mesh.positions[i] === x && mesh.positions[i + 2] === z) return i / 3;
  }
  return -1;
}
function assertSharedEdge(full, coarse, fullPoint, coarsePoint, worldOffset) {
  const aIndex = findVertex(full, fullPoint[0], fullPoint[1]);
  const bIndex = findVertex(coarse, coarsePoint[0], coarsePoint[1]);
  assert.notEqual(aIndex, -1);
  assert.notEqual(bIndex, -1);
  const a = aIndex * 3, b = bIndex * 3;
  assert.equal(full.positions[a], coarse.positions[b] + worldOffset[0], 'world-space X must match at LOD seam');
  assert.equal(full.positions[a + 1], coarse.positions[b + 1], 'terrain heights must meet exactly at LOD seam');
  assert.equal(full.positions[a + 2], coarse.positions[b + 2] + worldOffset[1], 'world-space Z must match at LOD seam');
  for (let axis = 0; axis < 3; axis++) {
    assert.equal(full.normals[a + axis], coarse.normals[b + axis], 'normals must match at the LOD seam');
    assert.equal(full.colors[a + axis], coarse.colors[b + axis], 'vertex colours must match at the LOD seam');
  }
  const auv = aIndex * 2, buv = bIndex * 2;
  assert.equal(full.uvs[auv], coarse.uvs[buv], 'world-space U coordinates must match at the LOD seam');
  assert.equal(full.uvs[auv + 1], coarse.uvs[buv + 1], 'world-space V coordinates must match at the LOD seam');
}
const farWest = generate(7, -1, 0, 1);
const farSouth = generate(8, 0, -1, 1);
const farNorth = generate(9, 0, 1, 1);
for (let edge = 0; edge <= 16; edge++) {
  assertSharedEdge(left, far, [16, edge], [0, edge], [16, 0]);
  assertSharedEdge(left, farWest, [0, edge], [16, edge], [-16, 0]);
  assertSharedEdge(left, farNorth, [edge, 16], [edge, 0], [0, 16]);
  assertSharedEdge(left, farSouth, [edge, 0], [edge, 16], [0, -16]);
}
function edgeSet(mesh) {
  const edges = new Set();
  for (let i = 0; i < mesh.indices.length; i += 3) {
    const tri = [mesh.indices[i], mesh.indices[i + 1], mesh.indices[i + 2]];
    for (let e = 0; e < 3; e++) {
      const a = tri[e], b = tri[(e + 1) % 3];
      edges.add(Math.min(a, b) + ':' + Math.max(a, b));
    }
  }
  return edges;
}
const farEdges = edgeSet(far);
for (let edge = 0; edge < 16; edge++) {
  const boundarySegments = [
    [[0, edge], [0, edge + 1]],
    [[16, edge], [16, edge + 1]],
    [[edge, 0], [edge + 1, 0]],
    [[edge, 16], [edge + 1, 16]]
  ];
  for (const [a, b] of boundarySegments) {
    const ia = findVertex(far, a[0], a[1]), ib = findVertex(far, b[0], b[1]);
    assert.ok(farEdges.has(Math.min(ia, ib) + ':' + Math.max(ia, ib)),
      'every unit boundary segment must be represented by a triangle edge');
  }
}
for (const mesh of [left, far]) {
  for (let i = 0; i < mesh.indices.length; i += 3) {
    const a = mesh.indices[i] * 3, b = mesh.indices[i + 1] * 3, c = mesh.indices[i + 2] * 3;
    const windingY = (mesh.positions[b + 2] - mesh.positions[a + 2]) * (mesh.positions[c] - mesh.positions[a]) -
      (mesh.positions[b] - mesh.positions[a]) * (mesh.positions[c + 2] - mesh.positions[a + 2]);
    assert.ok(windingY > 0, 'terrain triangles must keep upward-facing winding');
  }
}

const farRepeat = generate(6, 1, 0, 1);
assert.deepEqual(Array.from(farRepeat.positions), Array.from(far.positions));
assert.deepEqual(Array.from(farRepeat.indices), Array.from(far.indices));


self.onmessage({ data: { type: 'generate', id: 4, cx: 0, cz: 0, seed: 1337, heights: new Float32Array(8) } });
assert.equal(messages[messages.length - 1].type, 'error',
  'invalid worker payloads should return a recoverable error instead of crashing silently');

console.log('PASS worker colours and biome assignments match the exact shared terrain core');
console.log('PASS terrain worker emits finite typed geometry, valid indices, matching chunk seams, deterministic output and transferable buffers');
console.log('PASS far LOD reduces vertices and triangles, stitches all four edges, preserves UV/normal/colour continuity and keeps upward-facing triangles');
console.log('Terrain worker checks: 6/6 passed');
