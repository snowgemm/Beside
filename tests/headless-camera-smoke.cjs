'use strict';

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');

const root = path.resolve(__dirname, '..');
const jsDir = path.join(root, 'js');
const jsFiles = fs.readdirSync(jsDir).filter((name) => name.endsWith('.js')).sort();

for (const name of jsFiles) {
  const filename = path.join(jsDir, name);
  new vm.Script(fs.readFileSync(filename, 'utf8'), { filename });
}

const listeners = Object.create(null);
const elements = Object.create(null);

function element(id) {
  if (!elements[id]) {
    elements[id] = {
      id,
      style: {},
      textContent: '',
      innerHTML: '',
      listeners: Object.create(null),
      classList: { add() {}, remove() {} },
      addEventListener(type, callback) {
        (this.listeners[type] ||= []).push(callback);
      },
      appendChild() {},
      getContext() { return {}; }
    };
  }
  return elements[id];
}

const document = {
  pointerLockElement: null,
  hidden: false,
  body: element('body'),
  getElementById: element,
  addEventListener(type, callback) {
    (listeners['doc:' + type] ||= []).push(callback);
  },
  querySelector() { return null; }
};

const window = {
  Game: {},
  innerWidth: 1000,
  innerHeight: 800,
  devicePixelRatio: 1,
  addEventListener(type, callback) {
    (listeners['win:' + type] ||= []).push(callback);
  }
};

class Vector3 {
  constructor() { this.x = 0; this.y = 0; this.z = 0; }
  set(x, y, z) { this.x = x; this.y = y; this.z = z; return this; }
}

class Object3D {
  constructor() {
    this.position = new Vector3();
    this.rotation = {
      x: 0, y: 0, z: 0, order: '',
      set(x, y, z) { this.x = x; this.y = y; this.z = z; }
    };
    this.children = [];
    this.visible = true;
  }
  add(...objects) { this.children.push(...objects); }
}

class Geometry {}
class Material {}
class Mesh extends Object3D {
  constructor(geometry, material) {
    super();
    this.geometry = geometry;
    this.material = material;
  }
}

const THREE = {
  Group: Object3D,
  Mesh,
  BoxGeometry: Geometry,
  MeshBasicMaterial: Material
};
const context = vm.createContext({ window, document, navigator: { maxTouchPoints: 0 }, THREE });

function load(relativePath) {
  const filename = path.join(jsDir, relativePath);
  vm.runInContext(fs.readFileSync(filename, 'utf8'), context, { filename });
}

load('input.js');
load('player.js');

let wall = false;
window.Game.world = {
  WATER: 5,
  getBlock() { return 0; },
  solid(x, y, z) {
    return wall && Math.floor(z) === 2 && Math.floor(y) === 3;
  }
};
window.Game.dungeon = { respawnPoint() { return null; } };

const scene = new Object3D();
const camera = new Object3D();
const G = window.Game;
G.player.init(scene, camera, { x: 0, y: 2, z: 0.5 });
const canvas = element('canvas');
canvas.requestPointerLock = () => { document.pointerLockElement = canvas; };
G.input.init(canvas);

const results = [];
function check(name, condition, detail = '') {
  results.push({ name, pass: Boolean(condition), ...(detail ? { detail } : {}) });
}
function wheel(deltaY) {
  let prevented = false;
  for (const callback of (listeners['doc:wheel'] || [])) {
    callback({ deltaY, preventDefault() { prevented = true; } });
  }
  return prevented;
}

const P = G.player;
P.third = true;
P.camDist = 4.6;
document.pointerLockElement = canvas;

check('wheel listener registered', (listeners['doc:wheel'] || []).length > 0);
const preventedDown = wheel(120);
check('wheel down zooms out and prevents page scrolling',
  Math.abs(P.camDist - 5.3) < 1e-9 && preventedDown, 'camDist=' + P.camDist);
wheel(-120);
check('wheel up zooms in', Math.abs(P.camDist - 4.6) < 1e-9);
P.camDist = 11.8;
wheel(120);
check('zoom clamps at 12', P.camDist === 12);
P.camDist = 2.7;
wheel(-120);
check('zoom clamps at 2.5', P.camDist === 2.5);
P.camDist = 4.6;
P.third = false;
wheel(120);
check('wheel does not affect first-person mode', P.camDist === 4.6);
P.third = true;
document.pointerLockElement = null;
wheel(120);
check('wheel is ignored without pointer lock', P.camDist === 4.6);
document.pointerLockElement = canvas;

wall = true;
G.input.lookDX = 0;
G.input.lookDY = 0;
P.yaw = 0;
P.pitch = 0;
P.pos.x = 0;
P.pos.y = 2.001;
P.pos.z = 0.5;
P.vel.x = P.vel.y = P.vel.z = 0;
P.onGround = true;
P.update(1 / 60);
check('third-person camera shortens before a mock terrain wall',
  Math.floor(camera.position.z) !== 2 && camera.position.z - P.pos.z < 2,
  'cameraZ=' + camera.position.z.toFixed(3) + ', playerZ=' + P.pos.z.toFixed(3));

const failures = results.filter((result) => !result.pass);
console.log('JavaScript syntax: ' + jsFiles.length + ' files passed');
console.log('Headless camera/input checks: ' + (results.length - failures.length) + '/' + results.length + ' passed');
for (const result of results) {
  console.log((result.pass ? 'PASS ' : 'FAIL ') + result.name + (result.detail ? ' (' + result.detail + ')' : ''));
}
if (failures.length) process.exitCode = 1;
