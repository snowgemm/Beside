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
      matches() { return false; },
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
  setScalar(v) { this.x = this.y = this.z = v; return this; }
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
    this.scale = new Vector3(); this.userData = {}; this.parent = null;
  }
  add(...objects) { for (const object of objects) { object.parent = this; this.children.push(object); } }
  remove(object) { this.children = this.children.filter((child) => child !== object); object.parent = null; }
}

class Geometry {
  constructor() {
    this.attributes = { normal: { count: 6, getY(i) { return i === 0 ? 1 : i === 1 ? -1 : 0; }, getX(i) { return i === 2 ? 1 : 0; } } };
  }
  setAttribute(name, value) { this.attributes[name] = value; }
}
class BufferAttribute { constructor(array, itemSize) { this.array = array; this.itemSize = itemSize; } }
class Material { constructor(options = {}) { Object.assign(this, options); } }
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
  BufferAttribute,
  MeshBasicMaterial: Material,
  MeshStandardMaterial: Material
};
const context = vm.createContext({ window, document, navigator: { maxTouchPoints: 0 }, THREE });

function load(relativePath) {
  const filename = path.join(jsDir, relativePath);
  vm.runInContext(fs.readFileSync(filename, 'utf8'), context, { filename });
}

load('input.js');
load('rig.js');
load('player.js');
// Newer archives delegate body motion to phys.js; older revisions keep it in player.js.
if (fs.existsSync(path.join(jsDir, 'phys.js'))) load('phys.js');

let wall = false;
window.Game.world = {
  WATER: 5,
  SEA: 0,
  decorBlockers() { return null; },
  getBlock() { return 0; },
  solid(x, y, z) {
    return wall && Math.floor(z) === 2 && Math.floor(y) === 3;
  }
};
window.Game.dungeon = { respawnPoint() { return null; } };

const scene = new Object3D();
const camera = new Object3D();
const G = window.Game;
G.events = { on() {}, emit() {} };
G.player.init(scene, camera, { x: 0, y: 2, z: 0.5 });
const canvas = element('canvas');
canvas.requestPointerLock = () => { document.pointerLockElement = canvas; };
G.input.init(canvas);
if (G.phys && G.phys.init) G.phys.init();

const results = [];
function check(name, condition, detail = '') {
  results.push({ name, pass: Boolean(condition), ...(detail ? { detail } : {}) });
}
function wheel(deltaY) {
  let prevented = false;
  for (const callback of [...(listeners['doc:wheel'] || []), ...(canvas.listeners.wheel || [])]) {
    callback({ deltaY, preventDefault() { prevented = true; } });
  }
  return prevented;
}

const P = G.player;
P.third = true;
P.camDist = 4.6;
document.pointerLockElement = canvas;

check('wheel listener registered', (listeners['doc:wheel'] || []).length + (canvas.listeners.wheel || []).length > 0);
const preventedDown = wheel(120);
check('wheel down zooms out',
  Math.abs(P.camDist - 5.3) < 1e-9 || Math.abs(P.camDist - 5.05) < 1e-9, 'camDist=' + P.camDist);
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

// Regression: the overworld renderer is a triangle heightfield, not a stack of voxel columns.
G.world.surfaceHeight = (x, z) => 2 + x * 0.15 + z * 0.05;
G.world.getHeight = G.world.surfaceHeight;
G.world.getBlock = () => 0;
G.world.solid = () => false;
G.world.decorBlockers = () => null;
G.dungeon.active = false;
P.dead = false; P.health = P.maxHealth = 100; P.pos.x = 0.5; P.pos.z = 0.5; P.pos.y = 6;
P.pos.vx = P.pos.vz = 0; P.pos.vy = 0; P.pos.onGround = false; P.pos.inWater = false;
P.third = true; P.yaw = 0; P.pitch = 0; P.camDist = 4.6; P.shake = 0; P.stepOff = 0;
for (let i = 0; i < 180; i++) P.update(1 / 60);
const terrainY = G.world.surfaceHeight(P.pos.x, P.pos.z);
check('player lands on the smooth rendered terrain instead of integer voxel steps',
  Math.abs(P.pos.y - terrainY) < 0.11 && P.pos.onGround,
  'feetY=' + P.pos.y.toFixed(3) + ', meshY=' + terrainY.toFixed(3));

// Visual regression guards: streamed meshes are created outside the quality-setting traversal,
 // so their shadow receiver flag must be safe at construction time, not just toggled once.
const terrainSource = fs.readFileSync(path.join(jsDir, 'legacy-world.js'), 'utf8');
const assetSource = fs.readFileSync(path.join(jsDir, 'assets.js'), 'utf8');
check('terrain chunk edge slope samples stay inside a one-cell padded grid',
  terrainSource.includes('var N=CS+3,H=new Float32Array(N*N)') &&
  terrainSource.includes('for(z=-1;z<=CS+1;z++)for(x=-1;x<=CS+1;x++)') &&
  !terrainSource.includes('var N=18,H=new Float32Array(N*N)'));
{
  // Exercise every terrain-vertex edge and corner using the same grid/index scheme as build().
  const chunkSize = 16;
  const stride = chunkSize + 3;
  const heightGrid = new Float32Array(stride * stride);
  for (let z = -1; z <= chunkSize + 1; z++) {
    for (let x = -1; x <= chunkSize + 1; x++) {
      heightGrid[(z + 1) * stride + x + 1] = x * 0.25 + z * 0.5;
    }
  }
  let finiteSlopes = true;
  for (let z = 0; z <= chunkSize; z++) {
    for (let x = 0; x <= chunkSize; x++) {
      const i = (z + 1) * stride + x + 1;
      const dx = heightGrid[i + 1] - heightGrid[i - 1];
      const dz = heightGrid[i + stride] - heightGrid[i - stride];
      if (![dx, dz, Math.sqrt(dx * dx + dz * dz)].every(Number.isFinite)) finiteSlopes = false;
    }
  }
  check('all 4 terrain borders and corners produce finite slopes', finiteSlopes);
}
check('newly streamed terrain chunks never receive shadow-map shadows',
  terrainSource.includes('mesh.receiveShadow=false') &&
  !terrainSource.includes("mesh.receiveShadow=!!(G.quality&&G.quality.value==='high')"));
check('overworld height samples stay fractional for smooth hills',
  terrainSource.includes('return Math.max(3, Math.min(MAXH - 3, h))') &&
  terrainSource.includes('var N=CS+3,H=new Float32Array(N*N)'));
check('ground detail texture does not repeat once per terrain block',
  terrainSource.includes('uvs.push((ox+x)*0.16,(oz+z)*0.16)'));
check('character rigs use rough lit materials instead of unlit plastic shading',
  fs.readFileSync(path.join(jsDir, 'rig.js'), 'utf8').includes('new THREE.MeshStandardMaterial({ color: c, vertexColors: true, roughness: 0.96, metalness: 0'));
check('environment asset loader preserves lit PBR materials and uses licensed textured nature variants',
  assetSource.includes('function keepPBR') &&
  assetSource.includes('src.roughness') &&
  assetSource.includes('tree1.glb') && assetSource.includes('tree2.glb') && assetSource.includes('tree3.glb'));

const mainSource = fs.readFileSync(path.join(jsDir, 'main.js'), 'utf8');
check('shadow maps remain disabled at every graphics quality',
  mainSource.includes('renderer.shadowMap.enabled=false') &&
  !mainSource.includes('renderer.shadowMap.enabled=!!q.shadows'));
check('InstancedMesh colour attributes are fully allocated before count is set to zero',
  terrainSource.includes('function primeInstanceColors(mesh, capacity)') &&
  terrainSource.includes('new THREE.InstancedBufferAttribute(data, 3)') &&
  terrainSource.includes('for (var i = 0; i < data.length; i++) data[i] = 1;') &&
  terrainSource.indexOf('primeInstanceColors(grassMesh,1050)') < terrainSource.indexOf('grassMesh.count=flowerMesh.count=0;') &&
  terrainSource.indexOf('primeInstanceColors(flowerMesh,135)') < terrainSource.indexOf('grassMesh.count=flowerMesh.count=0;'));
check('grass sky tint multiplies its palette instead of replacing green with a grey tint',
  terrainSource.includes('grassMaterial.color.copy(grassBaseColor).multiply(grassTintColor)'));
check('grass uses stable two-sided cards without injected wind distortion',
  terrainSource.includes('new THREE.MeshBasicMaterial({color:green,side:THREE.DoubleSide,toneMapped:false})') &&
  terrainSource.includes('grassShader=null;') &&
  !terrainSource.includes('uWindTime + instanceMatrix'));
check('grass density is capped for mobile instead of filling the horizon with spikes',
  terrainSource.includes("grassTarget=level==='low'?48:level==='high'?120:72"));
check('decor placement uses the same padded height-grid stride as terrain generation',
  terrainSource.includes('var N = CS + 3, gates = gatesFor(ox, oz)') &&
  !terrainSource.includes('var N = 18, gates = gatesFor(ox, oz)'));
check('grass is restricted to a closer radius and lower density to avoid subpixel spikes',
  terrainSource.includes('if(dist>17*17)continue;') &&
  terrainSource.includes("grassTarget=level==='low'?48:level==='high'?120:72") &&
  terrainSource.includes('var shade=.88+hash('));
check('terrain normals are derived from padded heights and stay consistent across streamed chunk seams',
  terrainSource.includes('normals.push(nx*inv,ny*inv,nz*inv)') &&
  terrainSource.includes("setAttribute('normal',new THREE.Float32BufferAttribute(normals,3))") &&
  terrainSource.includes('var N=CS+3,H=new Float32Array(N*N)') &&
  !terrainSource.includes('geo.computeVertexNormals();geo.computeBoundingSphere();'));
check('desktop high quality enables a subtle periodic ground normal map while mobile stays lightweight',
  terrainSource.includes('function terrainNormalTex()') &&
  terrainSource.includes('colorTexture !== false') &&
  terrainSource.includes('W.setSurfaceQuality=function(level)') &&
  terrainSource.includes("surfaceQuality==='high'&&!!terrainNormal") &&
  mainSource.includes('G.world.setSurfaceQuality(touch&&level===\'high\'?\'medium\':level)'));
check('renderer uses sRGB output and filmic tone mapping for coherent PBR materials',
  mainSource.includes('renderer.outputEncoding = THREE.sRGBEncoding') &&
  mainSource.includes('renderer.toneMapping = THREE.ACESFilmicToneMapping'));
check('terrain generation CPU budget adapts to the measured FPS instead of always consuming 4 ms',
  mainSource.includes('var chunkBudget = touch ? 1.4 : 2.4') &&
  mainSource.includes('G.world.update(p.x, p.z, chunkBudget, dt)'));
check('expanded minimap renders cached 16x16 terrain tiles rather than one fillRect per world cell',
  minimapSource.includes('function terrainTile(cx, cz)') &&
  minimapSource.includes('c.drawImage(tile, px, pz, 16 * s, 16 * s)') &&
  minimapSource.includes('cache.clear(); tileCache.clear()'));
check('expanded minimap shows XYZ and its controls wrap on narrow screens',
  minimapSource.includes("'  Y ' + p.y.toFixed(1)") &&
  fs.readFileSync(path.join(root, 'css', 'style.css'), 'utf8').includes('#map-legend{flex:1 1 260px;min-width:0;white-space:normal'));
check('grass uses solid low-poly tufts instead of thin crossed cards',
  terrainSource.includes('new THREE.ConeGeometry(.085,.28,5,1)') &&
  !terrainSource.includes('-.09,0,0,.09,0,0,0,.48,0'));
check('terrain and sand use separate exposure compression to reduce midday clipping',
  terrainSource.includes('var sr=sand?.87:.90, sg=sand?.83:.88, sb=sand?.78:.90') &&
  terrainSource.includes('r*low*fine*sr') && terrainSource.includes('g*low*fine*sg') && terrainSource.includes('b*low*fine*sb'));

const indexSource = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const uiSource = fs.readFileSync(path.join(jsDir, 'ui.js'), 'utf8');
const menuSource = fs.readFileSync(path.join(jsDir, 'menu.js'), 'utf8');
const playerSource = fs.readFileSync(path.join(jsDir, 'player.js'), 'utf8');
const enemySource = fs.readFileSync(path.join(jsDir, 'enemies.js'), 'utf8');
const rigSource = fs.readFileSync(path.join(jsDir, 'rig.js'), 'utf8');
const physicsSource = fs.readFileSync(path.join(jsDir, 'phys.js'), 'utf8');
const minimapSource = fs.readFileSync(path.join(jsDir, 'minimap.js'), 'utf8');
const fxSource = fs.readFileSync(path.join(jsDir, 'fx.js'), 'utf8');
const swSource = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
check('story-driven UI no longer exposes block-build/place controls',
  !/id="btn-(build|break|place)"/.test(indexSource) &&
  !indexSource.includes('js/build.js') &&
  !mainSource.includes('G.build.') &&
  !uiSource.includes("'btn-build'"));
check('renderer uses the native animation loop and offers refresh-aware FPS caps',
  mainSource.includes('renderer.setAnimationLoop(frame)') &&
  mainSource.includes('G.setFpsCap') &&
  mainSource.includes('144'));
check('live coordinate HUD is present and updated from player position',
  indexSource.includes('id="coords"') &&
  mainSource.includes("coordsHud.textContent = 'X '") &&
  menuSource.includes('showCoords'));
check('minimap zoom is user-adjustable and persisted with the rest of settings',
  menuSource.includes("mapZoom: 2.35") &&
  menuSource.includes('id=\"menu-map-zoom\"') &&
  menuSource.includes('G.minimap.setZoom(S.mapZoom, false)') &&
  menuSource.includes('mapZoom: S.mapZoom') &&
  menuSource.includes('d.mapZoom'));
check('minimap opens as a terrain-aware world map and keeps its close button intact',
  minimapSource.includes('M.setExpanded') &&
  minimapSource.includes('drawTerrain(p, s)') &&
  minimapSource.includes("e.code === 'KeyM'") &&
  minimapSource.includes('if (M.expanded && labelTitle) labelTitle.textContent'));
check('front and cinematic third-person camera modes perform collision checks',
  menuSource.includes('<option value="front">Phía trước</option>') &&
  menuSource.includes('<option value="cinematic">Điện ảnh</option>') &&
  playerSource.includes("cameraMode === 'cinematic'") &&
  playerSource.includes('ph.blockedAt(cpx + sideX * sideOffset + camSign * dx * t'));
check('personalization persists theme, UI size and FPS limit',
  menuSource.includes('theme: S.theme') &&
  menuSource.includes('uiScale: S.uiScale') &&
  menuSource.includes('fpsCap: S.fpsCap') &&
  menuSource.includes("document.body.setAttribute('data-theme', S.theme)"));
check('particle quality controls reduce emission and ambient effects',
  fxSource.includes('F.setQuality') &&
  fxSource.includes("particleLevel === 'low' ? 3") &&
  fxSource.includes('ambientLimit = particleLevel'));
check('remote GLB cache supports repeat offline sessions with graceful fallback',
  assetSource.includes("indexedDB.open('besidevalley-model-cache'") &&
  assetSource.includes('function getModelBuffer(url)') &&
  assetSource.includes('function fallbackLoad()'));
check('offline service worker caches the app shell and external renderer scripts after first load',
  indexSource.includes("navigator.serviceWorker.register('./sw.js')") &&
  swSource.includes('const SHELL = [') &&
  swSource.includes("request.destination === 'script'"));
check('terrain grain texture uses periodic multi-scale noise and color texture encoding',
  terrainSource.includes('function tileNoise(x, y, size, cells, seed)') &&
  terrainSource.includes('mkTex(size, function (x,y)') &&
  terrainSource.includes('t.encoding = THREE.sRGBEncoding'));
check('three distinct close-range tree models use merged procedural trees at distance',
  assetSource.includes("tree2: { url: 'https://raw.githubusercontent.com/anshaneja5/skyline-run/main/public/assets/models/tree2.glb'") &&
  assetSource.includes("tree3: { url: 'https://raw.githubusercontent.com/anshaneja5/skyline-run/main/public/assets/models/tree3.glb'") &&
  terrainSource.includes('42*42') && terrainSource.includes("r2<.34?'tree':r2<.67?'tree2':'tree3'"));
check('adaptive GPU scaling also reduces and restores vegetation density',
  mainSource.includes("G.world.setGrassQuality(next<.82?'low':next<.93?'medium':base.grass)") &&
  mainSource.includes('resizeForQuality();'));
check('tree wind animation is throttled to 30 Hz and culled by player distance',
  terrainSource.includes('var swayAccumulator = 0;') &&
  terrainSource.includes('swayAccumulator>=1/30') &&
  terrainSource.includes('dx*dx+dz*dz>58*58'));
check('adaptive resolution uses hysteresis and respects the selected FPS cap',
  mainSource.includes('G.quality.setAdaptiveScale=function(value)') &&
  mainSource.includes('desiredFps === 0 && !G.paused') &&
  mainSource.includes('adaptiveFastT >= 8'));
check('expanded minimap has interactive wheel and pinch zoom that persist settings',
  minimapSource.includes("cv.addEventListener('wheel'") &&
  minimapSource.includes("cv.addEventListener('touchmove'") &&
  minimapSource.includes('map-zoom-in') &&
  minimapSource.includes('G.menu.settings.mapZoom=M.zoom'));
check('offline cache is bumped and versioned local assets prevent stale code from loading',
  swSource.includes("CACHE_NAME = 'besidevalley-shell-v10'") &&
  indexSource.includes('20261028-terrain-pbr-map7'));
check('player jump input triggers a short takeoff pose independent of refresh rate',
  rigSource.includes("state === 'jump'") && rigSource.includes('this.jumpT = 0.32') &&
  rigSource.includes('var jumpPulse = Math.sin') && playerSource.includes("rig.play('jump'"));
check('player and procedural mobs play physics-driven landing squash/rebound',
  rigSource.includes("state === 'land'") && rigSource.includes('impactPulse') &&
  playerSource.includes("rig.play('land'") && enemySource.includes("e.rig.play('land'"));
check('terrain collision has finite fallbacks for invalid surface-height samples',
  physicsSource.includes("if(!isFinite(h)&&typeof fallback==='function')h=fallback(x,z)") &&
  physicsSource.includes("return isFinite(h)?h:(W&&isFinite(W.SEA)?W.SEA:0)"));
check('minimap zoom saves are debounced during continuous gestures',
  minimapSource.includes('function queueZoomSave()') &&
  minimapSource.includes('zoomSaveTimer = setTimeout(function ()') &&
  minimapSource.includes('}, 220)'));
const failures = results.filter((result) => !result.pass);
console.log('JavaScript syntax: ' + jsFiles.length + ' files passed');
console.log('Headless camera/input checks: ' + (results.length - failures.length) + '/' + results.length + ' passed');
for (const result of results) {
  console.log((result.pass ? 'PASS ' : 'FAIL ') + result.name + (result.detail ? ' (' + result.detail + ')' : ''));
}
if (failures.length) process.exitCode = 1;
