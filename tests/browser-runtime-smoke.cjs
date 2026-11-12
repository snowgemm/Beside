'use strict';

const assert = require('node:assert/strict');
const { chromium } = require('playwright');

const baseURL = process.env.BESIDE_BASE_URL || 'http://127.0.0.1:4173';
const browserArgs = [
  '--enable-webgl',
  '--ignore-gpu-blocklist',
  '--use-gl=angle',
  '--use-angle=swiftshader',
  '--enable-unsafe-swiftshader'
];

async function openGame(browser, options, label) {
  const context = await browser.newContext(options);
  // Keep test-only pointer-lock handling isolated from the application runtime.
  // Headless Chromium does not provide a user-visible pointer-lock surface.
  await context.addInitScript((testLabel) => {
    // Avoid a user-visible pointer-lock dependency in the keyboard movement smoke test.
    // Keep real keyboard events while preventing the game's lock-failure pause handler.
    if (testLabel === 'desktop') {
      try {
        Object.defineProperty(HTMLCanvasElement.prototype, 'requestPointerLock', {
          configurable: true,
          value: function () { return Promise.resolve(); }
        });
      } catch (_) {}
    }
  }, label);

  const page = await context.newPage();
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.stack || error.message));

  const response = await page.goto(baseURL, {
    waitUntil: 'domcontentloaded',
    timeout: 45000
  });
  assert.ok(response && response.ok(), label + ': page did not return a successful HTTP response');

  await page.waitForFunction(() => {
    const game = window.Game;
    return !!(game && game.renderer && game.player && game.world && game.ui &&
      document.querySelector('#game canvas') && document.querySelector('#t-new'));
  }, null, { timeout: 45000 });

  await page.waitForFunction(() => {
    const game = window.Game;
    return !!(game.renderer && game.renderer.info && game.renderer.info.render &&
      game.renderer.info.render.frame > 0);
  }, null, { timeout: 15000 });

  const startup = await page.evaluate(() => {
    const game = window.Game;
    const canvas = game.renderer.domElement;
    const gl = game.renderer.getContext();
    return {
      titleOpen: game.ui.titleOpen,
      paused: game.paused,
      canvasWidth: canvas.width,
      canvasHeight: canvas.height,
      contextLost: gl.isContextLost(),
      glVersion: gl.getParameter(gl.VERSION),
      renderedFrames: game.renderer.info.render.frame,
      chunks: typeof game.world.chunkCount === 'function' ? game.world.chunkCount() : null,
      touchMode: game.input.isTouch
    };
  });

  assert.ok(startup.canvasWidth > 0 && startup.canvasHeight > 0, label + ': WebGL canvas has zero size');
  assert.equal(startup.contextLost, false, label + ': WebGL context is already lost');
  assert.ok(startup.renderedFrames > 0, label + ': no rendered frame observed');
  assert.equal(startup.titleOpen, true, label + ': expected the first-run title screen');
  assert.equal(startup.paused, true, label + ': game should remain paused on the title screen');

  return { context, page, pageErrors, startup };
}

async function runDesktop(browser) {
  const test = await openGame(browser, {
    viewport: { width: 1365, height: 820 },
    deviceScaleFactor: 1
  }, 'desktop');

  try {
    const { page } = test;

    // Verify settings while the title screen owns the pause state.
    await page.locator('#t-set').click();
    await page.locator('#menu.open').waitFor({ state: 'attached', timeout: 5000 });
    await page.locator('#menu-quality').selectOption('low');
    const selectedQuality = await page.evaluate(() => window.Game.quality.value);
    assert.equal(selectedQuality, 'low', 'desktop: graphics quality setting did not apply');

    await page.locator('#menu-close').click();
    await page.waitForFunction(() => !window.Game.menu.open);
    const stillPausedAtTitle = await page.evaluate(() => window.Game.paused);
    assert.equal(stillPausedAtTitle, true, 'desktop: closing title settings should return to the paused title screen');

    // Start the overworld and prove keyboard input advances the player simulation.
    await page.locator('#t-new').click();
    await page.waitForFunction(() => !window.Game.paused && !window.Game.ui.titleOpen, null, { timeout: 5000 });
    await page.evaluate(() => {
      const game = window.Game;
      const originalUpdate = game.player.update;
      game.__browserSmokePlayerUpdates = 0;
      game.player.update = function (dt) {
        game.__browserSmokePlayerUpdates++;
        return originalUpdate.call(this, dt);
      };
    });
    const before = await page.evaluate(() => ({
      x: window.Game.player.pos.x,
      z: window.Game.player.pos.z,
      updates: window.Game.__browserSmokePlayerUpdates
    }));
    await page.bringToFront();
    await page.keyboard.down('w');
    try {
      // Wait for real simulation steps rather than assuming a fixed render cadence on SwiftShader.
      await page.waitForFunction(({ updates }) =>
        window.Game.__browserSmokePlayerUpdates >= updates + 12, before, { timeout: 15000 });
    } catch (error) {
      const state = await page.evaluate(() => ({
        paused: window.Game.paused,
        titleOpen: window.Game.ui.titleOpen,
        menuOpen: window.Game.menu.open,
        moveX: window.Game.input.moveX,
        moveZ: window.Game.input.moveZ,
        playerUpdates: window.Game.__browserSmokePlayerUpdates,
        dead: window.Game.player.dead,
        onGround: window.Game.player.pos.onGround,
        position: {
          x: window.Game.player.pos.x,
          y: window.Game.player.pos.y,
          z: window.Game.player.pos.z
        }
      }));
      throw new Error('desktop: player update loop did not advance after keyboard input; before=' +
        JSON.stringify(before) + ', state=' + JSON.stringify(state) + '; ' + error.message);
    }
    const movementProbe = await page.evaluate(() => {
      const game = window.Game;
      game.input.poll();
      const p = game.player.pos;
      return {
        paused: game.paused,
        titleOpen: game.ui.titleOpen,
        menuOpen: game.menu.open,
        moveX: game.input.moveX,
        moveZ: game.input.moveZ,
        dead: game.player.dead,
        onGround: game.player.pos.onGround,
        position: { x: p.x, y: p.y, z: p.z },
        velocity: { x: p.vx, y: p.vy, z: p.vz },
        playerUpdates: game.__browserSmokePlayerUpdates
      };
    });
    await page.keyboard.up('w');
    const moved = Math.hypot(movementProbe.position.x - before.x, movementProbe.position.z - before.z);
    assert.ok(moved > 0.12,
      'desktop: keyboard input did not move the player; before=' + JSON.stringify(before) +
      ', probe=' + JSON.stringify(movementProbe));

    const result = await page.evaluate(() => ({
      paused: window.Game.paused,
      position: {
        x: window.Game.player.pos.x,
        y: window.Game.player.pos.y,
        z: window.Game.player.pos.z
      },
      frames: window.Game.renderer.info.render.frame,
      chunks: window.Game.world.chunkCount()
    }));

    assert.equal(result.paused, false, 'desktop: game unexpectedly paused after starting');
    assert.ok(result.chunks > 0, 'desktop: overworld did not stream any terrain chunks');
    assert.equal(test.pageErrors.length, 0, 'desktop: uncaught browser errors: ' + test.pageErrors.join('\n'));
    return { startup: test.startup, quality: selectedQuality, stillPausedAtTitle, gameplay: result, pageErrors: test.pageErrors };
  } finally {
    await test.context.close();
  }
}

async function runMobile(browser) {
  const test = await openGame(browser, {
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true
  }, 'mobile');

  try {
    const { page } = test;
    assert.equal(test.startup.touchMode, true, 'mobile: touch input mode was not detected');

    const layout = await page.evaluate(() => {
      const button = document.querySelector('#btn-attack');
      const rect = button.getBoundingClientRect();
      return {
        touchClass: document.body.classList.contains('touch'),
        viewportWidth: window.innerWidth,
        documentWidth: document.documentElement.scrollWidth,
        attackButtonVisible: rect.width > 0 && rect.height > 0,
        attackButtonWidth: rect.width,
        attackButtonHeight: rect.height
      };
    });
    assert.equal(layout.touchClass, true, 'mobile: touch layout class was not enabled');
    assert.ok(layout.documentWidth <= layout.viewportWidth + 1, 'mobile: page overflows horizontally');
    assert.equal(layout.attackButtonVisible, true, 'mobile: attack control is not visible');

    await page.locator('#t-set').tap();
    await page.locator('#menu.open').waitFor({ state: 'attached', timeout: 5000 });
    await page.locator('#menu-quality').selectOption('low');
    assert.equal(await page.evaluate(() => window.Game.quality.value), 'low',
      'mobile: graphics quality setting did not apply');
    await page.locator('#menu-close').tap();

    await page.locator('#t-new').tap();
    await page.waitForFunction(() => !window.Game.paused && !window.Game.ui.titleOpen, null, { timeout: 5000 });
    await page.locator('#btn-view').tap();
    await page.waitForFunction(() => window.Game.player.third === false, null, { timeout: 3000 });

    const result = await page.evaluate(() => ({
      paused: window.Game.paused,
      firstPerson: !window.Game.player.third,
      frames: window.Game.renderer.info.render.frame,
      chunks: window.Game.world.chunkCount()
    }));
    assert.equal(result.paused, false, 'mobile: game unexpectedly paused after starting');
    assert.equal(result.firstPerson, true, 'mobile: touch camera control did not switch view');
    assert.ok(result.chunks > 0, 'mobile: overworld did not stream any terrain chunks');
    assert.equal(test.pageErrors.length, 0, 'mobile: uncaught browser errors: ' + test.pageErrors.join('\n'));

    return { startup: test.startup, layout, gameplay: result, pageErrors: test.pageErrors };
  } finally {
    await test.context.close();
  }
}

(async () => {
  let browser;
  try {
    browser = await chromium.launch({ headless: true, args: browserArgs });
    const desktop = await runDesktop(browser);
    const mobile = await runMobile(browser);
    process.stdout.write(JSON.stringify({
      status: 'passed',
      browser: browser.version(),
      desktop,
      mobile
    }, null, 2) + '\n');
  } catch (error) {
    process.stderr.write((error && error.stack) || String(error) + '\n');
    process.exitCode = 1;
  } finally {
    if (browser) await browser.close();
  }
})();
