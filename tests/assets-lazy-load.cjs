'use strict';

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');

const source = fs.readFileSync(path.join(__dirname, '..', 'js', 'assets.js'), 'utf8');
const fetchCalls = [];
const modelRequests = [];

function fetchStub(url) {
  const value = String(url);
  fetchCalls.push(value);
  return Promise.resolve({ ok: false, status: 404 });
}

class GLTFLoader {
  load(url, onLoad, onProgress, onError) {
    modelRequests.push(String(url));
    setTimeout(() => {
      if (typeof onError === 'function') onError(new Error('Expected offline fallback in this test'));
    }, 0);
  }
  parse() {
    throw new Error('No GLB should parse in the offline fallback test');
  }
}
GLTFLoader.prototype.parse = function () {};

const audio = { ctx: null, master: {}, play() {} };
const window = {
  Game: { audio },
  fetch: fetchStub,
  indexedDB: null,
  crypto: null
};
const context = vm.createContext({
  window,
  THREE: { GLTFLoader },
  fetch: fetchStub,
  setTimeout,
  clearTimeout,
  setInterval,
  clearInterval,
  Promise,
  console
});
vm.runInContext(source, context, { filename: 'js/assets.js' });

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
  const assets = window.Game.assets;

  await assets.load();
  assert.equal(fetchCalls.length, 0, 'startup must not fetch all remote models or sound files');
  assert.equal(modelRequests.length, 0, 'startup must not instantiate GLTFLoader requests');
  assert.equal(assets.modelStatus('tree'), 'idle');

  assert.equal(assets.model('tree'), null, 'first access returns the procedural fallback while loading');
  assert.equal(assets.model('tree'), null, 'repeated access remains safe while the model is pending');
  await wait(40);

  const modelFetches = fetchCalls.filter((url) => url.includes('/tree1.glb'));
  assert.equal(modelFetches.length, 1, 'one model name must create only one network request');
  assert.equal(modelRequests.length, 1, 'one failed fetch must fall back through one loader request');
  assert.equal(assets.modelStatus('tree'), 'failed', 'failed model requests should settle instead of remaining stuck');
  assert.equal(assets.model('tree'), null, 'failed optional assets must keep the procedural fallback');
  assert.equal(assets.requestModel('tree'), false, 'a failed model should not create an automatic retry loop');

  const beforeSound = fetchCalls.length;
  assert.equal(assets.sound('hit'), false, 'sound falls back until the sample is fetched and decoded');
  await wait(40);
  const soundFetches = fetchCalls.slice(beforeSound).filter((url) => url.startsWith('assets/sfx/hit.'));
  assert.deepEqual(soundFetches, ['assets/sfx/hit.ogg', 'assets/sfx/hit.mp3', 'assets/sfx/hit.wav']);
  assert.equal(fetchCalls.slice(beforeSound).some((url) => url.includes('boss.')), false, 'unused sound names must stay unloaded');

  process.stdout.write('PASS lazy asset integration: zero eager requests, one deduplicated GLB request, procedural fallback, and on-demand SFX\n');
}

main().catch((error) => {
  process.stderr.write((error && error.stack) || String(error));
  process.exitCode = 1;
});
