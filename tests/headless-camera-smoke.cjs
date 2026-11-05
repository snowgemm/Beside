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
  traverse(callback) {
    callback(this);
    for (const child of this.children) child.traverse(callback);
  }
}

const createdMaterials = [];
const createdCircleGeometries = [];
class Geometry {
  constructor() {
    this.disposeCount = 0;
    this.attributes = { normal: { count: 6, getY(i) { return i === 0 ? 1 : i === 1 ? -1 : 0; }, getX(i) { return i === 2 ? 1 : 0; } } };
  }
  setAttribute(name, value) { this.attributes[name] = value; }
  rotateX() { return this; }
  dispose() { this.disposeCount++; }
}
class CircleGeometry extends Geometry {
  constructor(...args) { super(); this.args = args; createdCircleGeometries.push(this); }
}
class BufferAttribute { constructor(array, itemSize) { this.array = array; this.itemSize = itemSize; } }
class Material {
  constructor(options = {}) { Object.assign(this, options); this.disposeCount = 0; createdMaterials.push(this); }
  dispose() { this.disposeCount++; }
}
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
  CircleGeometry,
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
load('assets.js');
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

let sharedGeometryDisposals = 0, sharedMaterialDisposals = 0;
let ownedGeometryDisposals = 0, ownedMaterialDisposals = 0;
const sharedMesh = {
  isMesh: true,
  userData: { sharedAssetResources: true },
  geometry: { dispose() { sharedGeometryDisposals++; } },
  material: { dispose() { sharedMaterialDisposals++; } }
};
const ownedGeometry = { dispose() { ownedGeometryDisposals++; } };
const ownedMaterialA = { dispose() { ownedMaterialDisposals++; } };
const ownedMaterialB = { dispose() { ownedMaterialDisposals++; } };
const ownedMesh = { isMesh: true, userData: {}, geometry: ownedGeometry, material: [ownedMaterialA, ownedMaterialB] };
const ownedMeshSharingResources = { isMesh: true, userData: {}, geometry: ownedGeometry, material: ownedMaterialA };
const instance = {
  userData: {},
  traverse(callback) {
    callback(this);
    callback(sharedMesh);
    callback(ownedMesh);
    callback(ownedMeshSharingResources);
  }
};
G.assets.disposeInstance(instance);
G.assets.disposeInstance(instance);
check('disposing an instance preserves borrowed GLB template resources',
  sharedGeometryDisposals === 0 && sharedMaterialDisposals === 0);
check('disposing an instance releases each owned geometry/material only once',
  ownedGeometryDisposals === 1 && ownedMaterialDisposals === 2);

function fire(list, event) {
  for (const callback of [...(list || [])]) callback(event);
}
const touchLayer = element('touch');
fire(listeners['win:keydown'], { code: 'KeyW', repeat: false, preventDefault() {} });
G.input.poll();
check('keyboard movement is registered before focus loss', G.input.moveZ === 1);
fire(touchLayer.listeners.touchstart, { changedTouches: [{ identifier: 7, clientX: 100, clientY: 100 }], preventDefault() {} });
fire(touchLayer.listeners.touchmove, { changedTouches: [{ identifier: 7, clientX: 156, clientY: 100 }], preventDefault() {} });
fire(element('btn-jump').listeners.touchstart, { preventDefault() {}, stopPropagation() {} });
G.input.poll();
check('touch joystick and jump are registered before focus loss', G.input.moveX > 0.99 && G.input.jump);
fire(listeners['win:blur'], {});
G.input.poll();
check('window blur clears keyboard, joystick and held jump input',
  G.input.moveX === 0 && G.input.moveZ === 0 && !G.input.jump &&
  element('joy').style.display === 'none' && element('joy-knob').style.transform === 'translate(0px,0px)');
fire(listeners['win:keydown'], { code: 'KeyD', repeat: false, preventDefault() {} });
fire(element('btn-attack').listeners.touchstart, { preventDefault() {}, stopPropagation() {} });
G.input.poll();
document.hidden = true;
fire(listeners['doc:visibilitychange'], {});
G.input.poll();
check('hidden page clears held controls and one-shot actions',
  G.input.moveX === 0 && G.input.moveZ === 0 && !G.input.jump &&
  !G.input.attackQ && !G.input.dodgeQ && !G.input.invToggle && !G.input.interactQ);
document.hidden = false;
fire(listeners['win:keydown'], { code: 'KeyA', repeat: false, preventDefault() {} });
G.input.poll();
fire(listeners['win:pagehide'], {});
G.input.poll();
check('pagehide also clears held keyboard movement', G.input.moveX === 0 && G.input.moveZ === 0);
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
check('GLB clones mark shared mesh resources and prop previews use the shared-safe disposer',
  assetSource.includes('o.userData.sharedAssetResources = true') &&
  assetSource.includes('dispose: function () { A.disposeInstance(o); }') &&
  fs.readFileSync(path.join(jsDir, 'dungeon.js'), 'utf8').includes('G.assets.disposeInstance(o)'));

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
check('grass instance colours use biome palettes and the shared material applies only sky tint',
  terrainSource.includes('grassColor.setHex(baseColor)') &&
  terrainSource.includes('grassMaterial.color.copy(grassTintColor)') &&
  terrainSource.includes('palette.grass.forest:palette.grass.plains'));
check('grass tufts use a stable two-sided material without wind shader distortion',
  terrainSource.includes('new THREE.MeshBasicMaterial({color:0xffffff,side:THREE.DoubleSide,toneMapped:false})') &&
  !terrainSource.includes('uWindTime + instanceMatrix'));
check('grass density stays within mobile-friendly low, medium and high budgets',
  terrainSource.includes("grassTarget = level === 'low' ? 24 : level === 'high' ? 68 : 44") &&
  terrainSource.includes("flowerTarget = level === 'low' ? 8 : level === 'high' ? 24 : 14"));
check('decor placement uses the same padded height-grid stride as terrain generation',
  terrainSource.includes('var N = CS + 3, gates = gatesFor(ox, oz)') &&
  !terrainSource.includes('var N = 18, gates = gatesFor(ox, oz)'));
check('grass is distributed across the full local radius with a deterministic spatial sample',
  terrainSource.includes('for(dz=-16.8;dz<=16.8;dz+=2.8)for(dx=-16.8;dx<=16.8;dx+=2.8)') &&
  terrainSource.includes('var palette=G.palette||{},sampleChance=Math.min(.95,grassTarget/80)') &&
  terrainSource.includes('if(n>sampleChance)continue;') &&
  terrainSource.includes('if(dist>17*17)continue;') &&
  !terrainSource.includes('dz<=25&&gn<grassTarget') &&
  !terrainSource.includes('dx<=25&&gn<grassTarget'));
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
  fs.readFileSync(path.join(jsDir, 'minimap.js'), 'utf8').includes('function terrainTile(cx, cz)') &&
  fs.readFileSync(path.join(jsDir, 'minimap.js'), 'utf8').includes('c.drawImage(tile, px, pz, 16 * s, 16 * s)') &&
  fs.readFileSync(path.join(jsDir, 'minimap.js'), 'utf8').includes('cache.clear(); tileCache.clear()'));
check('expanded minimap shows XYZ and its controls wrap on narrow screens',
  fs.readFileSync(path.join(jsDir, 'minimap.js'), 'utf8').includes("'  Y ' + p.y.toFixed(1)") &&
  fs.readFileSync(path.join(root, 'css', 'style.css'), 'utf8').includes('#map-legend{flex:1 1 260px;min-width:0;white-space:normal'));
check('grass uses a three-blade tuft instead of isolated cone spikes',
  terrainSource.includes('function grassGeometry()') &&
  terrainSource.includes('for (var blade = 0; blade < 3; blade++)') &&
  terrainSource.includes('new THREE.BufferGeometry()') &&
  !terrainSource.includes('new THREE.ConeGeometry(.085,.28,5,1)'));
check('flower accents use round low-poly buds instead of additional cone spikes',
  terrainSource.includes('function flowerGeometry()') &&
  terrainSource.includes('new THREE.SphereGeometry(.045, 6, 4)') &&
  terrainSource.includes('flowerGeometry(),flowerMaterial'));
check('round flower buds are positioned just above the ground instead of floating',
  terrainSource.includes('grassDummy.position.y=h+.055;') &&
  !terrainSource.includes('grassDummy.position.y=h+.16;'));
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
const styleSource = fs.readFileSync(path.join(root, 'css', 'style.css'), 'utf8');
const audioSource = fs.readFileSync(path.join(jsDir, 'combat.js'), 'utf8');
const combatSource = audioSource;
check('UI honors reduced-motion preferences while keeping timed feedback visible',
  styleSource.includes('@media (prefers-reduced-motion: reduce)') &&
  styleSource.includes('#hp.low, #hp.low #hp-fill') &&
  styleSource.includes('#banner.show { opacity: 1; transform: translateX(-50%); }'));
check('reduced-motion mode clears transition delays as well as durations',
  styleSource.includes('transition-duration: 0.01ms !important;') &&
  styleSource.includes('transition-delay: 0s !important;'));
check('delayed health damage trail animates transform rather than layout width',
  styleSource.includes('transform-origin:left center;transition:transform .55s ease-out .3s') &&
  combatSource.includes("hpGhost.style.transform = 'scaleX(' + (pc / 100) + ')'") &&
  !combatSource.includes("hpGhost.style.width = pc + '%'"));

check('hidden-page lifecycle freezes the game loop and resets frame timing on return',
  mainSource.includes('var pageHidden = !!document.hidden') &&
  mainSource.includes("document.addEventListener('visibilitychange'") &&
  mainSource.includes("window.addEventListener('pageshow'") &&
  mainSource.includes('if (contextLost || pageHidden) { last = now; return; }') &&
  mainSource.includes('adaptiveSlowT = adaptiveFastT = 0'));
check('audio reattaches its gesture unlock after BFCache pageshow',
  audioSource.includes("window.addEventListener('pageshow'") && audioSource.includes("if (A.ctx && A.ctx.state !== 'running') attach();"));
check('audio suspends in background and resumes only after a user gesture',
  audioSource.includes("document.addEventListener('visibilitychange'") &&
  audioSource.includes("A.ctx.suspend()") &&
  audioSource.includes("if (!document.hidden && A.ctx && A.ctx.state !== 'running') attach()") &&
  audioSource.includes('else if (A.ctx && A.ctx.state !== \'running\') attach()') &&
  audioSource.includes('A.ctx.resume()') &&
  audioSource.includes('function attach()'));

check('story-driven UI no longer exposes block-build/place controls',
  !/id="btn-(build|break|place)"/.test(indexSource) &&
  !indexSource.includes('js/build.js') &&
  !mainSource.includes('G.build.') &&
  !uiSource.includes("'btn-build'"));
check('renderer uses the native animation loop and offers refresh-aware FPS caps',
  mainSource.includes('renderer.setAnimationLoop(frame)') &&
  mainSource.includes('G.setFpsCap') &&
  mainSource.includes('144'));
check('developer renderer snapshots expose frame counters, resource counts and current world state',
  mainSource.includes('G.debug.rendererSnapshot = function (label)') &&
  mainSource.includes('render.calls') &&
  mainSource.includes('render.triangles') &&
  mainSource.includes('memory.geometries') &&
  mainSource.includes('memory.textures') &&
  mainSource.includes('renderer.getPixelRatio') &&
  mainSource.includes('G.world.chunkCount()'));
check('renderer snapshot history is manual, copy-safe and bounded without a polling timer',
  mainSource.includes('RENDERER_HISTORY_LIMIT = 120') &&
  mainSource.includes('G.debug.captureRendererSnapshot') &&
  mainSource.includes('G.debug.getRendererHistory') &&
  mainSource.includes('G.debug.clearRendererHistory') &&
  mainSource.includes('JSON.parse(JSON.stringify(snapshot))'));
check('WebGL context loss saves the current state and freezes gameplay simulation',
  mainSource.includes("renderer.domElement.addEventListener('webglcontextlost'") &&
  mainSource.includes('if (G.save && G.save.saveNow) G.save.saveNow();') &&
  mainSource.includes('if (contextLost || pageHidden) { last = now; return; }') &&
  mainSource.includes('showGraphicsRecovery(true)'));
check('WebGL context restoration resets frame timing and clears the recovery notice',
  mainSource.includes("renderer.domElement.addEventListener('webglcontextrestored'") &&
  mainSource.includes('last = performance.now();') &&
  mainSource.includes('accT = accN = hudT = 0;') &&
  mainSource.includes('showGraphicsRecovery(false)') &&
  fs.readFileSync(path.join(root, 'css', 'style.css'), 'utf8').includes('#graphics-recovery.open{display:flex}'));
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
check('ambient and burst particles use circular alpha sprites instead of square quads',
  fxSource.includes('function particleSpriteTexture()') &&
  fxSource.includes('createRadialGradient(16, 16, 0, 16, 16, 16)') &&
  fxSource.includes('new THREE.CanvasTexture(canvas)') &&
  fxSource.includes('map: sprite') &&
  fxSource.includes('transparent: true') &&
  fxSource.includes('alphaTest: 0.02') &&
  fxSource.includes('depthWrite: false'));
check('remote GLB cache supports repeat offline sessions with graceful fallback',
  assetSource.includes("indexedDB.open('besidevalley-model-cache'") &&
  assetSource.includes('function getModelBuffer(def)') &&
  assetSource.includes('function fallbackLoad()'));
check('remote model assets pin reviewed upstream commits and exact Git blob identities',
  assetSource.includes("var QUATERNIUS_REV = '0c41526d8d4130c37c15e219c2c3737fa8cb4ad8'") &&
  assetSource.includes("var KENNEY_MIRROR_REV = 'ea2f2aa1ca8da0898330c97df8a5489976b051d0'") &&
  assetSource.includes("blobSha: '80bd662cc51f983986f4e201463dc3a729a6cd4a'") &&
  assetSource.includes("blobSha: '5d0ff9df2d53956151b1adefc0d0a99ce549fdd6'"));
check('broadleaf templates opt into hash-verified shared WebP textures without sharing geometry/materials',
  assetSource.includes("textureShareGroup: 'quaternius-broadleaf-v1'") &&
  (assetSource.match(/textureShareSha256: \['d306b69/g) || []).length === 3 &&
  assetSource.includes('function shareModelTextures(gltf, def, root)') &&
  assetSource.includes('cached.signature !== signature') &&
  assetSource.includes('material[slot] = cached.texture') &&
  assetSource.includes('texture.dispose()'));
check('legacy IndexedDB model cache migrates only after Git blob SHA-1 verification',
  assetSource.includes('function verifyGitBlob(buffer, expectedSha)') &&
  assetSource.includes("subtle.digest('SHA-1', bytes)") &&
  assetSource.includes('String.fromCharCode(0)') &&
  assetSource.includes('verifyGitBlob(legacy, def.blobSha)') &&
  assetSource.includes('writeModelBuffer(def.url, legacy)'));
check('unused potion GLB is omitted from the runtime model manifest',
  !/^\s*potion:\s*\{\s*url:/m.test(assetSource) &&
  !assetSource.includes('mini-dungeon/potion.glb'));
check('offline service worker caches the app shell and external renderer scripts after first load',
  indexSource.includes("navigator.serviceWorker.register('./sw.js')") &&
  swSource.includes('const SHELL = [') &&
  swSource.includes("request.destination === 'script'"));
check('terrain grain texture uses periodic multi-scale noise and color texture encoding',
  terrainSource.includes('function tileNoise(x, y, size, cells, seed)') &&
  terrainSource.includes('mkTex(size, function (x,y)') &&
  terrainSource.includes('t.encoding = THREE.sRGBEncoding'));
check('streamed GLB decor staging references are scoped to each chunk build',
  terrainSource.includes('var dp, dc, di;') &&
  !terrainSource.includes('var dp, dc, di, modelDecor = [];') &&
  terrainSource.includes('function tree(bi, cx, h, cz, r2, j, ox, oz, modelDecor)') &&
  terrainSource.includes('gl = gates ? gates.length : 0, modelDecor = [];') &&
  terrainSource.includes('tree(bi, cx, h, cz, r2, j, ox, oz, modelDecor);'));
check('three distinct close-range tree models use merged procedural trees at distance',
  assetSource.includes("tree2: { url: QUATERNIUS_MODEL_BASE + 'tree2.glb'") &&
  assetSource.includes("tree3: { url: QUATERNIUS_MODEL_BASE + 'tree3.glb'") &&
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
const touchMapRule = styleSource.lastIndexOf('body.touch #minimap{top:calc(env(safe-area-inset-top,0px) + 152px)');
const expandedMapRule = styleSource.lastIndexOf('body.map-expanded #minimap{z-index:21;left:50%;top:50%');
check('expanded minimap overrides compact touch placement and remains centered on phones',
  touchMapRule >= 0 && expandedMapRule > touchMapRule &&
  styleSource.includes('top:calc(env(safe-area-inset-top,0px) + 68px)') &&
  styleSource.includes('height:min(92vw,78dvh)'));
check('map, menu and landscape settings controls keep touch-friendly hit areas',
  styleSource.includes('min-width:44px;min-height:44px') &&
  styleSource.includes('#menu .menu-head button{flex:0 0 44px') &&
  styleSource.includes('#menu .menu-btns button{min-height:44px') &&
  styleSource.includes('#map-label button{min-height:44px'));
check('keyboard focus is visible on map and button controls',
  styleSource.includes('button:focus-visible,#minimap:focus-visible{outline:2px solid var(--hi)') &&
  styleSource.includes('.menu-row select:focus-visible'));
check('offline cache is bumped and versioned local assets prevent stale code from loading',
  swSource.includes("CACHE_NAME = 'besidevalley-shell-v25'") &&
  swSource.includes("url.searchParams.get('v')") &&
  swSource.includes('function fallbackCacheKey(requestUrl)') &&
  swSource.includes('cache.match(fallbackKey)') &&
  indexSource.includes('20261105-chunk-decor-lifecycle-v25'));
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
check('camera shake is deterministic and smooth across refresh rates',
  playerSource.includes('var shakeAmp = P.shake') &&
  playerSource.includes('Math.sin(shakeTime * 42)') &&
  playerSource.includes('Math.sin(shakeTime * 53 + 0.8)') &&
  !playerSource.includes('(Math.random() - 0.5) * P.shake'));
check('distant idle mob animation is throttled while AI and physics remain full-rate',
  enemySource.includes('if (d > 18 && !rigBusy)') &&
  enemySource.includes('e.rigAnimAcc >= 1 / 15') &&
  enemySource.includes('P.move(e, dt);') &&
  enemySource.includes('e.rig.update(dt, rigSpeed)') &&
  enemySource.includes('e.rig.update(rigDt,'));
check('camera hit feedback only fires after a valid combat target is hit',
  fs.readFileSync(path.join(jsDir, 'combat.js'), 'utf8').includes('P.shake = Math.max(P.shake || 0, crit ? 0.11 : 0.045)') &&
  fs.readFileSync(path.join(jsDir, 'combat.js'), 'utf8').indexOf('P.shake = Math.max(P.shake || 0, crit ? 0.11 : 0.045)') > fs.readFileSync(path.join(jsDir, 'combat.js'), 'utf8').indexOf('C.attack = function ()'));

// Boss slam telegraphs use two child meshes that share one CircleGeometry.
const previousEnemies = G.enemies;
const previousAudio = G.audio;
let spawnedBoss = null;
G.audio = { play() {} };
G.enemies = {
  spawn(name, x, y, z, def) {
    spawnedBoss = { type: name, x, y, z, hp: def.hp, def, group: new Object3D(), rig: null };
    return spawnedBoss;
  }
};
load('boss.js');
G.boss.init(scene);
G.boss.spawn(0, 0, 0, 1);
spawnedBoss.update(spawnedBoss, 2.1, 0, 5, 5, 5, 0, 0);
const slamGeometry = createdCircleGeometries[createdCircleGeometries.length - 1];
const slamMaterials = createdMaterials.slice(-2);
G.boss.cleanup();
check('boss slam telegraph disposes its shared CircleGeometry once and both owned materials once',
  slamGeometry && slamGeometry.disposeCount === 1 &&
  slamMaterials.length === 2 && slamMaterials.every((material) => material.disposeCount === 1));
G.boss.cleanup();
check('repeated boss telegraph cleanup is idempotent',
  slamGeometry.disposeCount === 1 && slamMaterials.every((material) => material.disposeCount === 1));
G.enemies = previousEnemies;
G.audio = previousAudio;
const failures = results.filter((result) => !result.pass);
console.log('JavaScript syntax: ' + jsFiles.length + ' files passed');
console.log('Headless camera/input checks: ' + (results.length - failures.length) + '/' + results.length + ' passed');
for (const result of results) {
  console.log((result.pass ? 'PASS ' : 'FAIL ') + result.name + (result.detail ? ' (' + result.detail + ')' : ''));
}
if (failures.length) process.exitCode = 1;
