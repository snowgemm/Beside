'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const assetsSource = fs.readFileSync(path.join(__dirname, '..', 'js', 'assets.js'), 'utf8');

const TREE_HASHES = [
  'd306b69fcf72198270e6d6d57af6e77533003d515748db7deae3cf719b88eeb6',
  '5f5a3b076667c254b44ea49a183c768da0f0b2b39b5f203b5e584b2321952c94',
  'b84891a51b70278ac9c2345736d18aa22f124bdeac1a6c76b413a3b29e4bea29'
];

class Vector3 {
  constructor(x = 0, y = 0, z = 0) { this.set(x, y, z); }
  set(x, y, z) { this.x = x; this.y = y; this.z = z; return this; }
  setScalar(value) { return this.set(value, value, value); }
}

class Object3D {
  constructor() {
    this.children = [];
    this.position = new Vector3();
    this.scale = new Vector3(1, 1, 1);
    this.rotation = { x: 0, y: 0, z: 0 };
    this.userData = {};
    this.parent = null;
  }
  add(child) { child.parent = this; this.children.push(child); }
  traverse(callback) { callback(this); for (const child of this.children) child.traverse(callback); }
  updateMatrixWorld() {}
  clone(recursive = true) {
    const copy = this.isMesh ? new Mesh(this.geometry, this.material) : new Group();
    copy.position.set(this.position.x, this.position.y, this.position.z);
    copy.scale.set(this.scale.x, this.scale.y, this.scale.z);
    copy.rotation = { ...this.rotation };
    copy.userData = { ...this.userData };
    if (recursive) for (const child of this.children) copy.add(child.clone(true));
    return copy;
  }
}
class Group extends Object3D {}
class Geometry {
  constructor(id) { this.id = id; this.disposeCount = 0; }
  dispose() { this.disposeCount++; }
}
class Texture {
  constructor(id) { this.id = id; this.isTexture = true; this.userData = {}; this.disposeCount = 0; }
  dispose() { this.disposeCount++; }
}
class Material {
  constructor(name, slots) {
    this.name = name;
    this.isMeshStandardMaterial = true;
    this.roughness = 0.5;
    this.metalness = 0.2;
    this.envMapIntensity = 1;
    Object.assign(this, slots);
    this.needsUpdate = false;
    this.disposeCount = 0;
  }
  dispose() { this.disposeCount++; }
}
class Mesh extends Object3D {
  constructor(geometry, material) {
    super();
    this.isMesh = true;
    this.geometry = geometry;
    this.material = material;
  }
  clone() {
    const copy = new Mesh(this.geometry, this.material);
    copy.position.set(this.position.x, this.position.y, this.position.z);
    copy.scale.set(this.scale.x, this.scale.y, this.scale.z);
    copy.rotation = { ...this.rotation };
    copy.userData = { ...this.userData };
    for (const child of this.children) copy.add(child.clone(true));
    return copy;
  }
}
class Box3 {
  constructor() { this.min = new Vector3(0, 0, 0); this.max = new Vector3(1, 1, 1); }
  setFromObject() { return this; }
  getSize(out) { return out.set(1, 1, 1); }
  getCenter(out) { return out.set(0.5, 0.5, 0.5); }
}

function makeGltf(parseIndex, options, created) {
  const textures = [new Texture('tree-' + parseIndex + '-map'), new Texture('tree-' + parseIndex + '-normal'), new Texture('tree-' + parseIndex + '-leaves')];
  created.push(...textures);
  const bark = new Material('Bark_NormalTree', { map: textures[0], normalMap: textures[1] });
  const leaves = new Material('Leaves_NormalTree', { map: textures[2] });
  const geometryA = new Geometry('tree-' + parseIndex + '-bark-geometry');
  const geometryB = new Geometry('tree-' + parseIndex + '-leaves-geometry');
  const scene = new Group();
  scene.add(new Mesh(geometryA, bark));
  scene.add(new Mesh(geometryB, leaves));

  const sampler0 = { magFilter: 9729, minFilter: 9987, wrapS: 10497, wrapT: 10497 };
  const sampler1 = options.thirdSamplerMismatch && parseIndex === 2
    ? { magFilter: 9728, minFilter: 9728, wrapS: 33071, wrapT: 33071 }
    : sampler0;
  const json = {
    asset: { version: '2.0' },
    samplers: [sampler0, sampler1],
    textures: [
      { sampler: options.thirdSamplerMismatch && parseIndex === 2 ? 1 : 0, extensions: { EXT_texture_webp: { source: 1 } } },
      { sampler: 0, extensions: { EXT_texture_webp: { source: 0 } } },
      { sampler: 0, extensions: { EXT_texture_webp: { source: 2 } } }
    ],
    images: [
      { name: 'Bark_NormalTree_Normal', mimeType: 'image/webp', bufferView: 0 },
      { name: 'Bark_NormalTree', mimeType: 'image/webp', bufferView: 1 },
      { name: 'Leaves_NormalTree_C', mimeType: 'image/webp', bufferView: 2 }
    ]
  };
  const associations = new Map(textures.map((texture, index) => [texture, { type: 'textures', index }]));
  return { scene, parser: { json, associations } };
}

async function runScenario(options = {}) {
  const createdTextures = [];
  const parsedModels = [];
  const modelByUrl = {
    'https://assets.test/tree.glb': 0,
    'https://assets.test/tree2.glb': 1,
    'https://assets.test/tree3.glb': 2
  };

  class GLTFLoader {
    parse(buffer, _path, onLoad, onError) {
      try {
        const index = new Uint8Array(buffer)[0];
        const gltf = makeGltf(index, options, createdTextures);
        parsedModels[index] = gltf;
        onLoad(gltf);
      } catch (error) {
        if (onError) onError(error);
      }
    }
    load(_url, _onLoad, _onProgress, onError) {
      if (onError) onError(new Error('Unexpected fallback GLTF load in texture-sharing test'));
    }
  }

  const THREE = { Group, Box3, Vector3, GLTFLoader };
  const audio = { play() {} };
  const window = { Game: { audio }, THREE, fetch() {} };
  function fetch(url) {
    const index = modelByUrl[String(url)];
    if (index === undefined) return Promise.resolve({ ok: false, status: 404 });
    const data = new Uint8Array([index]).buffer;
    return Promise.resolve({ ok: true, arrayBuffer: () => Promise.resolve(data) });
  }
  window.fetch = fetch;
  const context = vm.createContext({ window, THREE, fetch, Promise, ArrayBuffer, Uint8Array, setTimeout, clearTimeout, setInterval, clearInterval, console });
  vm.runInContext(assetsSource, context, { filename: 'js/assets.js' });

  const G = window.Game;
  G.assets.manifest.models = {
    tree: { url: 'https://assets.test/tree.glb', height: 4.8, textureShareGroup: 'test-broadleaf-v1', textureShareSha256: TREE_HASHES },
    tree2: { url: 'https://assets.test/tree2.glb', height: 4.55, textureShareGroup: 'test-broadleaf-v1', textureShareSha256: options.thirdHashMismatch ? ['0'.repeat(64), TREE_HASHES[1], TREE_HASHES[2]] : TREE_HASHES },
    tree3: { url: 'https://assets.test/tree3.glb', height: 4.7, textureShareGroup: 'test-broadleaf-v1', textureShareSha256: TREE_HASHES }
  };
  G.assets.manifest.sounds = {};
  await G.assets.load();

  const names = ['tree', 'tree2', 'tree3'];
  names.forEach((name) => {
    assert.equal(G.assets.model(name), null,
      'first access should queue the model and keep the caller on its procedural fallback');
  });
  for (let attempt = 0; attempt < 40 && names.some((name) => ['queued', 'loading'].includes(G.assets.modelStatus(name))); attempt++) {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  assert.deepEqual(names.map((name) => G.assets.modelStatus(name)), ['ready', 'ready', 'ready'],
    'all requested models should finish loading before their templates are inspected');
  const instances = names.map((name) => G.assets.model(name));
  const modelResources = instances.map((instance) => {
    const materials = [];
    const geometries = [];
    instance.traverse((object) => {
      if (!object.isMesh) return;
      materials.push(object.material);
      geometries.push(object.geometry);
    });
    return { instance, materials, geometries };
  });
  return { G, createdTextures, parsedModels, modelResources };
}

async function main() {
  const valid = await runScenario();
  const validResources = valid.modelResources;
  const barkMaps = validResources.map(x => x.materials[0].map);
  const normalMaps = validResources.map(x => x.materials[0].normalMap);
  const leafMaps = validResources.map(x => x.materials[1].map);

  assert.equal(barkMaps[0], barkMaps[1]);
  assert.equal(barkMaps[1], barkMaps[2]);
  assert.equal(normalMaps[0], normalMaps[1]);
  assert.equal(normalMaps[1], normalMaps[2]);
  assert.equal(leafMaps[0], leafMaps[1]);
  assert.equal(leafMaps[1], leafMaps[2]);
  assert.notEqual(validResources[0].materials[0], validResources[1].materials[0],
    'tree materials remain independent across model templates');
  assert.notEqual(validResources[0].geometries[0], validResources[1].geometries[0],
    'tree geometry remains independent across model templates');
  assert.deepEqual(valid.createdTextures.map(x => x.disposeCount), [0, 0, 0, 1, 1, 1, 1, 1, 1],
    'six redundant decoded textures should be disposed once; canonical textures stay alive');

  for (const resource of validResources) valid.G.assets.disposeInstance(resource.instance);
  for (const resource of validResources) valid.G.assets.disposeInstance(resource.instance);
  assert.deepEqual(valid.createdTextures.map(x => x.disposeCount), [0, 0, 0, 1, 1, 1, 1, 1, 1],
    'disposing borrowed instances must not dispose canonical shared template textures');

  const samplerMismatch = await runScenario({ thirdSamplerMismatch: true });
  const mismatchedTexture = samplerMismatch.modelResources[2].materials[0].map;
  assert.notEqual(mismatchedTexture, samplerMismatch.modelResources[0].materials[0].map,
    'a different sampler must prevent texture sharing');
  assert.equal(samplerMismatch.createdTextures[6].disposeCount, 0,
    'texture retained because the sampler mismatch keeps it live');
  assert.equal(samplerMismatch.modelResources[2].materials[0].normalMap,
    samplerMismatch.modelResources[0].materials[0].normalMap,
    'matching texture indices still share when only another sampler differs');
  assert.equal(samplerMismatch.modelResources[2].materials[1].map,
    samplerMismatch.modelResources[0].materials[1].map);

  const hashMismatch = await runScenario({ thirdHashMismatch: true });
  assert.notEqual(hashMismatch.modelResources[1].materials[0].map, hashMismatch.modelResources[0].materials[0].map,
    'a mismatched audited image hash must prevent texture sharing');
  assert.equal(hashMismatch.createdTextures[3].disposeCount, 0,
    'the tree2 texture remains alive after the hash mismatch');
  assert.equal(hashMismatch.modelResources[1].materials[0].normalMap,
    hashMismatch.modelResources[0].materials[0].normalMap,
    'matching audited image hashes still share');

  console.log('PASS matching tree texture payloads share one Texture per sampler/material slot');
  console.log('PASS material and geometry instances remain independent');
  console.log('PASS replaced duplicate textures dispose exactly once and borrowed instances preserve the shared textures');
  console.log('PASS sampler differences prevent sharing without disposing still-live textures');
  console.log('PASS audited image hash differences prevent sharing');
  console.log('Model texture sharing checks: 5/5 passed');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
