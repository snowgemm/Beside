(function () {
  var G = window.Game = window.Game || {};
  var touch = G.input.isTouch;
  var renderer = new THREE.WebGLRenderer({ antialias: !touch, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, touch ? 1.35 : 1.65));
  // Three.js r128 defaults to linear output. Explicit sRGB output plus ACES filmic tone mapping avoids washed-out sand and keeps PBR materials consistent.
  if (THREE.sRGBEncoding !== undefined) renderer.outputEncoding = THREE.sRGBEncoding;
  if (THREE.ACESFilmicToneMapping !== undefined) { renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0; }
  renderer.shadowMap.enabled = false;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.setSize(window.innerWidth, window.innerHeight);
  document.getElementById('game').appendChild(renderer.domElement);
  var scene = new THREE.Scene();
  var desiredFps = 0;
  G.setFpsCap = function (value) { var n = Number(value); desiredFps = [30,60,90,120,144].indexOf(n) >= 0 ? n : 0; };
  var qualityData={low:{pixel:1,grass:'low',shadows:false},medium:{pixel:1.35,grass:'medium',shadows:false},high:{pixel:1.65,grass:'high',shadows:false}}, adaptiveScale=1;
  function resizeForQuality(){var q=qualityData[G.quality&&G.quality.value]||qualityData[touch?'medium':'high'];renderer.setPixelRatio(Math.max(.72,Math.min(window.devicePixelRatio||1,q.pixel)*adaptiveScale));renderer.setSize(window.innerWidth,window.innerHeight);}
  G.quality={value:touch?'medium':'high',set:function(level){
    if(!qualityData[level])level=touch?'medium':'high';this.value=level;var q=qualityData[level];
    resizeForQuality();
    // Real-time shadow maps caused black terrain wedges on some mobile GPUs. Use contact shading instead.
    renderer.shadowMap.enabled=false;if(G.sky&&G.sky.setShadows)G.sky.setShadows(false);
    if(G.world&&G.world.setGrassQuality)G.world.setGrassQuality(q.grass);
    if(G.world&&G.world.setSurfaceQuality)G.world.setSurfaceQuality(touch&&level==='high'?'medium':level);
    if(scene&&scene.traverse)scene.traverse(function(o){
      if((!o.isMesh&&!o.isInstancedMesh)||!o.geometry)return;
      if(o.userData&&o.userData.noShadow){o.castShadow=false;o.receiveShadow=false;return;}
      // Heightfield terrain is double-sided; shadow-map acne used to create giant black triangles across the hills.
      // Contact shadows are rendered separately, so keep the terrain out of the real-time shadow receiver pass.
      if(o.userData&&o.userData.terrain){o.castShadow=false;o.receiveShadow=false;return;}
      o.castShadow=false;o.receiveShadow=false;
    });
  }};
  G.quality.setAdaptiveScale=function(value){
    var next=Math.max(.72,Math.min(1,+value||1));if(Math.abs(next-adaptiveScale)<.035)return false;adaptiveScale=next;resizeForQuality();
    // A sustained GPU slowdown lowers vegetation density as well as render resolution; restore the chosen preset when headroom returns.
    var base=qualityData[this.value]||qualityData[touch?'medium':'high'];
    if(G.world&&G.world.setGrassQuality)G.world.setGrassQuality(next<.82?'low':next<.93?'medium':base.grass);
    if(G.world&&G.world.setSurfaceQuality)G.world.setSurfaceQuality(touch||next<.88?'medium':this.value);
    return true;
  };

  var camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 500);
  G.camera = camera; G.renderer = renderer;
  window.addEventListener('resize', function () {
    resizeForQuality();
    camera.aspect = window.innerWidth / window.innerHeight; camera.updateProjectionMatrix();
  });

  G.world.drawDistance = touch ? 3 : 5;
  G.world.init(scene);
  G.sky.init(scene, camera);
  G.fx.init(scene);
  var spawn = G.world.findSpawn();
  G.player.init(scene, camera, spawn);
  G.input.init(renderer.domElement);
  G.combat.init(camera);
  G.phys.init();
  G.enemies.init(scene, camera);
  G.loot.init(scene);
  G.dungeon.init(scene);
  G.boss.init(scene);
  G.minimap.init();
  G.menu.init();
  G.assets.load();
  G.inventory.init();
  G.save.init();
  G.save.load();
  G.menu.apply();
  G.dungeon.afterLoad();
  G.world.preload(G.player.pos.x, G.player.pos.z, 2);
  G.ui.init();

  var hud = document.getElementById('hud'), coordsHud = document.getElementById('coords');
  var last = performance.now(), accT = 0, accN = 0, hudT = 0, fps = 0, slowT = 0, lowered = 0, adaptiveSlowT = 0, adaptiveFastT = 0;
  var contextLost = false, recoveryNotice = null;
  var pageHidden = !!document.hidden;
  function resetFrameClock(now) {
    last = typeof now === 'number' ? now : performance.now();
    accT = accN = hudT = 0;
    fps = slowT = adaptiveSlowT = adaptiveFastT = 0;
  }
  // Browsers throttle or stop animation callbacks for hidden pages; keep the simulation clock from catching up later.
  document.addEventListener('visibilitychange', function () {
    pageHidden = !!document.hidden;
    resetFrameClock();
  });
  window.addEventListener('pagehide', function () {
    pageHidden = true;
    resetFrameClock();
  });
  window.addEventListener('pageshow', function () {
    pageHidden = !!document.hidden;
    resetFrameClock();
  });

  function showGraphicsRecovery(show) {
    if (!recoveryNotice) {
      recoveryNotice = document.createElement('div');
      recoveryNotice.id = 'graphics-recovery';
      recoveryNotice.setAttribute('role', 'status');
      recoveryNotice.setAttribute('aria-live', 'polite');
      recoveryNotice.textContent = 'Đang khôi phục đồ họa… Vui lòng giữ trang mở.';
      document.body.appendChild(recoveryNotice);
    }
    if (show) recoveryNotice.classList.add('open');
    else recoveryNotice.classList.remove('open');
  }

  // Three.js r128 rebuilds its WebGL internals on restore; stop gameplay while no frame can be drawn.
  renderer.domElement.addEventListener('webglcontextlost', function (event) {
    event.preventDefault();
    if (contextLost) return;
    contextLost = true;
    if (G.save && G.save.saveNow) G.save.saveNow();
    showGraphicsRecovery(true);
  }, false);

  renderer.domElement.addEventListener('webglcontextrestored', function () {
    if (!contextLost) return;
    contextLost = false;
    last = performance.now();
    accT = accN = hudT = 0;
    showGraphicsRecovery(false);
    if (G.toast) G.toast('Đồ họa đã khôi phục', '#8affb0');
  }, false);

  function frame(now) {
    if (contextLost || pageHidden) { last = now; return; }
    var elapsedMs = now - last;
    if (desiredFps > 0 && elapsedMs + 0.05 < 1000 / desiredFps) return;
    var raw = elapsedMs / 1000; last = now;
    var dt = Math.min(raw, 0.05);
    G.inventory.update();
    var inp = G.input;
    if (!G.paused) G.player.update(dt);
    else { inp.attackQ = inp.dodgeQ = inp.interactQ = false; inp.lookDX = inp.lookDY = 0; inp.viewToggle = false; }
    var p = G.player.pos;
    if (!G.paused) { G.combat.update(dt); G.enemies.update(dt, p.x, p.y, p.z); G.loot.update(dt); G.dungeon.update(dt); }
    G.sky.update(G.paused ? 0 : dt);
    G.fx.update(G.paused ? 0 : dt, p.x, p.y, p.z);
    G.minimap.update(raw);
    // Keep chunk generation within a small CPU budget; allow more work only after measured frame time shows spare headroom.
    var chunkBudget = touch ? 1.4 : 2.4;
    if (fps > 100 && !touch) chunkBudget = 3.4;
    else if (fps > 70) chunkBudget = touch ? 1.8 : 3.0;
    else if (fps > 0 && fps < 35) chunkBudget = 0.7;
    G.world.update(p.x, p.z, chunkBudget, dt);
    renderer.render(scene, camera);

    if (raw < 0.25) { accT += raw; accN++; hudT += raw; }
    if (accT >= 1) {
      var sampleWindow = accT, avg = accT / accN * 1000;
      fps = Math.round(1000 / avg);
      // Hysteresis avoids flapping; never interpret an intentional 30/60 FPS cap as a slow GPU.
      if (desiredFps === 0 && !G.paused && !G.dungeon.active) {
        if (avg > (touch ? 25 : 22)) { adaptiveSlowT += sampleWindow; adaptiveFastT = 0; }
        else if (avg < (touch ? 17 : 14.5)) { adaptiveFastT += sampleWindow; adaptiveSlowT = 0; }
        else { adaptiveSlowT = Math.max(0, adaptiveSlowT - sampleWindow); adaptiveFastT = 0; }
        if (adaptiveSlowT >= 2 && adaptiveScale > .72) { adaptiveSlowT = 0; if (G.quality.setAdaptiveScale(adaptiveScale - .08)) G.toast('Đã hạ độ phân giải render để giữ FPS', '#ffd34d'); }
        if (adaptiveFastT >= 8 && adaptiveScale < 1) { adaptiveFastT = 0; G.quality.setAdaptiveScale(Math.min(1, adaptiveScale + .04)); }
      } else { adaptiveSlowT = 0; adaptiveFastT = 0; }
      // Last resort: lower streamed range only after sustained overload.
      if (touch && desiredFps === 0 && avg > 28 && !G.paused && !G.dungeon.active) slowT += sampleWindow; else slowT = 0;
      if (slowT >= 5) {
        slowT = 0;
        if (lowered < 2 && G.world.drawDistance > 3) {
          lowered++; G.world.setDrawDistance(G.world.drawDistance - 1); G.menu.noteDrawDistance(G.world.drawDistance);
          G.toast('Đã giảm tầm nhìn để chơi mượt hơn', '#ffd34d');
        }
      }
      accT = 0; accN = 0;
    }
    if (hudT >= 0.4) {
      hudT = 0;
      hud.textContent = 'FPS ' + fps + (G.dungeon.active ? '' : ' · Tầm nhìn ' + G.world.drawDistance + ' · Vùng ' + G.world.chunkCount());
      if (coordsHud) coordsHud.textContent = 'X ' + p.x.toFixed(1) + ' · Y ' + p.y.toFixed(1) + ' · Z ' + p.z.toFixed(1);
    }
  }
  // WebGLRenderer's animation loop follows the display refresh schedule (including high-refresh displays).
  renderer.setAnimationLoop(frame);
})();
