'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function makeElement() {
  return {
    style: { setProperty() {} },
    classList: { toggle() {} },
    textContent: '',
    appendChild() {}
  };
}

function createFixture() {
  const elements = new Map();
  const document = {
    hidden: false,
    body: { appendChild() {} },
    getElementById(id) {
      if (!elements.has(id)) elements.set(id, makeElement());
      return elements.get(id);
    },
    createElement() { return makeElement(); },
    addEventListener() {}
  };
  const window = {
    innerWidth: 1280,
    innerHeight: 720,
    Game: {},
    addEventListener() {},
    removeEventListener() {}
  };
  class Vector3 {
    set(x, y, z) { this.x = x; this.y = y; this.z = z; return this; }
    project() { return this; }
  }
  const player = {
    pos: { x: 0, y: 0, z: 0 },
    yaw: 0,
    weapon: { damage: 10, reach: 2.2, cooldown: 0.4 },
    equip: { weapon: null },
    health: 100,
    maxHealth: 100,
    dr: 0,
    crit: 0,
    dead: false,
    rollT: 0,
    rollDir: { x: 0, z: 0 },
    iframes: 0,
    swingT: 0,
    shake: 0,
    cancelCalls: 0,
    cancelAttack() { this.cancelCalls++; this.swingT = 0; }
  };
  const game = {
    player,
    input: { attackQ: false, dodgeQ: false, moveX: 0, moveZ: 0 },
    enemies: {
      list: [],
      hits: [],
      hurt(enemy, damage, knockX, knockZ) {
        this.hits.push({ enemy: enemy.id, damage, knockX, knockZ });
      }
    },
    audio: { play() {} },
    ui: null,
    menu: { settings: { vib: false } }
  };
  window.Game = game;
  const context = vm.createContext({
    window, document, navigator: { vibrate() {} }, THREE: { Vector3 },
    console, Math, isFinite
  });
  const source = fs.readFileSync(path.join(__dirname, '..', 'js', 'combat.js'), 'utf8');
  vm.runInNewContext(source, context, { filename: 'js/combat.js' });
  game.combat.init({ updateMatrixWorld() {} });
  return { game, window, document };
}

function enemy(id, x, y, z) {
  return { id, x, y, z, dead: false, def: { radius: 0.4 } };
}

// Damage lands after wind-up and before the strike segment enters recovery.
{
  const { game } = createFixture();
  const C = game.combat, timing = C.attackTiming;
  assert.ok(timing.hitTime > timing.duration * timing.windup);
  assert.ok(timing.hitTime < timing.duration * (timing.windup + (1 - timing.windup) * timing.strike));
  game.enemies.list = [
    enemy('front', 0, 0, -1), enemy('behind', 0, 0, 1),
    enemy('out-of-range', 0, 0, -4), enemy('too-high', 0, 3, -1)
  ];
  assert.equal(C.attack(), true);
  assert.equal(game.enemies.hits.length, 0);
  assert.equal(game.player.swingT, timing.duration);
  C.update(0.05); C.update(0.05);
  assert.equal(game.enemies.hits.length, 0);
  C.update(0.01);
  assert.deepEqual(game.enemies.hits.map(hit => hit.enemy), ['front']);
  assert.equal(game.enemies.hits[0].damage, 10);
  assert.equal(C.attack(), false);
  C.update(0.5);
  assert.equal(game.enemies.hits.length, 1);
}

// Dodge during wind-up cancels the pending strike.
{
  const { game } = createFixture(), C = game.combat;
  game.enemies.list = [enemy('front', 0, 0, -1)];
  assert.equal(C.attack(), true);
  C.update(0.02);
  game.input.dodgeQ = true; C.update(0.016);
  assert.equal(game.player.rollT, 0.35);
  assert.equal(game.player.cancelCalls, 1);
  C.update(0.2);
  assert.equal(game.enemies.hits.length, 0);
}

// Death before impact cancels the pending strike.
{
  const { game } = createFixture(), C = game.combat;
  game.enemies.list = [enemy('front', 0, 0, -1)];
  assert.equal(C.attack(), true);
  game.player.dead = true; C.update(0.2);
  assert.equal(game.player.cancelCalls, 1);
  assert.equal(game.enemies.hits.length, 0);
}

// Queued input starts the attack without same-frame damage.
{
  const { game } = createFixture(), C = game.combat;
  game.enemies.list = [enemy('front', 0, 0, -1)];
  game.input.attackQ = true; C.update(0.016);
  assert.equal(game.enemies.hits.length, 0);
  C.update(0.05); C.update(0.05);
  assert.equal(game.enemies.hits.length, 0);
  C.update(0.01);
  assert.equal(game.enemies.hits.length, 1);
}

// Animation and gameplay use the same strike ratio.
{
  const playerSource = fs.readFileSync(path.join(__dirname, '..', 'js', 'player.js'), 'utf8');
  const rigSource = fs.readFileSync(path.join(__dirname, '..', 'js', 'rig.js'), 'utf8');
  assert.ok(playerSource.includes('strike: attackTiming.strike'));
  assert.ok(rigSource.includes('st = (1 - w) * a.strike'));
}

process.stdout.write('Combat timing regression checks passed\\n');
