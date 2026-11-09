'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const assetSource = fs.readFileSync(path.join(__dirname, '..', 'js', 'assets.js'), 'utf8');
const pinnedUrl = 'https://raw.githubusercontent.com/example/models/0123456789abcdef0123456789abcdef01234567/tree.glb';
const legacyUrl = 'https://raw.githubusercontent.com/example/models/main/tree.glb';

function asArrayBuffer(bytes) {
  const copy = Uint8Array.from(bytes);
  return copy.buffer;
}

function gitBlobSha(buffer) {
  const header = Buffer.from('blob ' + buffer.byteLength + '\0', 'ascii');
  return crypto.createHash('sha1').update(Buffer.concat([header, Buffer.from(buffer)])).digest('hex');
}

function makeIndexedDb(seed) {
  const records = new Map(seed || []);
  const db = {
    transaction() {
      const tx = { oncomplete: null, onerror: null, onabort: null };
      const store = {
        get(key) {
          const request = {};
          queueMicrotask(() => {
            request.result = records.has(key) ? records.get(key) : undefined;
            if (request.onsuccess) request.onsuccess();
          });
          return request;
        },
        put(value, key) {
          records.set(key, value.slice(0));
          queueMicrotask(() => { if (tx.oncomplete) tx.oncomplete(); });
        }
      };
      tx.objectStore = () => store;
      return tx;
    }
  };
  return {
    records,
    open() {
      const request = {};
      queueMicrotask(() => {
        request.result = db;
        if (request.onsuccess) request.onsuccess();
      });
      return request;
    }
  };
}

async function runCacheCase(legacyBytes, expectedSha) {
  const indexedDB = makeIndexedDb([[legacyUrl, legacyBytes]]);
  const calls = { parse: [], fallback: [], modelFetch: [] };

  class GLTFLoader {
    parse(buffer, _path, _onLoad, onError) {
      calls.parse.push(Buffer.from(buffer));
      if (onError) onError(new Error('Intentional parser fallback in cache regression'));
    }
    load(url, _onLoad, _onProgress, onError) {
      calls.fallback.push(url);
      if (onError) onError(new Error('Network fallback disabled in cache regression'));
    }
  }

  const THREE = { GLTFLoader };
  const window = {
    Game: { audio: { play() {} } },
    indexedDB,
    crypto: crypto.webcrypto,
    THREE
  };
  function fetch(url) {
    if (String(url).startsWith('assets/sfx/')) return Promise.resolve({ ok: false });
    calls.modelFetch.push(String(url));
    return Promise.resolve({ ok: false, status: 503 });
  }
  window.fetch = fetch;

  const context = vm.createContext({
    window, THREE, fetch, Promise, ArrayBuffer, Uint8Array,
    setInterval, clearInterval, setTimeout, clearTimeout, console
  });
  vm.runInContext(assetSource, context, { filename: 'js/assets.js' });

  const assets = window.Game.assets;
  assets.manifest.models = {
    probe: { url: pinnedUrl, legacyUrl, blobSha: expectedSha, height: 1 }
  };
  await assets.load();
  assert.equal(assets.modelStatus('probe'), 'idle',
    'startup installs hooks but does not eagerly load optional models');
  assert.equal(assets.model('probe'), null,
    'first access should keep the procedural fallback while the requested model loads');
  for (let attempt = 0; attempt < 40 && ['queued', 'loading'].includes(assets.modelStatus('probe')); attempt++) {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  return { records: indexedDB.records, calls, status: assets.modelStatus('probe') };
}

async function main() {
  const originalBytes = asArrayBuffer(Buffer.from('verified cached GLB fixture'));
  const expectedSha = gitBlobSha(originalBytes);
  const valid = await runCacheCase(originalBytes, expectedSha);

  assert.deepEqual(valid.calls.parse[0], Buffer.from(originalBytes),
    'valid legacy cached bytes should reach GLTFLoader.parse');
  assert.deepEqual(Buffer.from(valid.records.get(pinnedUrl)), Buffer.from(originalBytes),
    'verified legacy bytes should be copied under the immutable URL key');
  assert.equal(valid.calls.modelFetch.length, 0,
    'verified legacy cache should avoid a network request');

  const tamperedBytes = asArrayBuffer(Buffer.from('different bytes from the mutable branch'));
  const invalid = await runCacheCase(tamperedBytes, expectedSha);
  assert.equal(invalid.calls.parse.length, 0,
    'mismatched legacy cache must not reach GLTFLoader.parse');
  assert.equal(invalid.records.has(pinnedUrl), false,
    'mismatched legacy cache must not be copied to the immutable URL key');
  assert.deepEqual(invalid.calls.modelFetch, [pinnedUrl],
    'mismatched cache should fall back to fetching the pinned immutable URL');

  console.log('PASS valid Git blob cache is migrated without network access');
  console.log('PASS mismatched legacy cache is rejected and pinned URL is fetched');
  console.log('Asset cache migration checks: 2/2 passed');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
