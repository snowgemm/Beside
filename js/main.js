(function () {
  var G = window.Game = window.Game || {};
  var BUILD_ID = '20261116-devtools-profile-v33';
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
  // Profiling is opt-in; normal gameplay does not pay for per-frame timing calls.
  var profileTools = document.getElementById('profile-tools');
  var profileQueryEnabled = !!(profileTools && new URLSearchParams(window.location.search).get('profile') === '1');
  var profilingEnabled = profileQueryEnabled;
  var FRAME_SAMPLE_LIMIT = 120;
  var frameTiming = {
    interval: new Float32Array(FRAME_SAMPLE_LIMIT),
    simulation: new Float32Array(FRAME_SAMPLE_LIMIT),
    environment: new Float32Array(FRAME_SAMPLE_LIMIT),
    world: new Float32Array(FRAME_SAMPLE_LIMIT),
    renderSubmit: new Float32Array(FRAME_SAMPLE_LIMIT)
  };
  var frameTimingCount = 0, frameTimingCursor = 0;
  function recordFrameTimings(intervalMs, simulationMs, environmentMs, worldMs, renderSubmitMs) {
    if (!profilingEnabled) return;
    var i = frameTimingCursor;
    frameTiming.interval[i] = intervalMs;
    frameTiming.simulation[i] = simulationMs;
    frameTiming.environment[i] = environmentMs;
    frameTiming.world[i] = worldMs;
    frameTiming.renderSubmit[i] = renderSubmitMs;
    frameTimingCursor = (i + 1) % FRAME_SAMPLE_LIMIT;
    frameTimingCount = Math.min(FRAME_SAMPLE_LIMIT, frameTimingCount + 1);
  }
  function summarizeFrameTiming(samples) {
    if (!frameTimingCount) return { p50Ms: null, p95Ms: null };
    var values = new Array(frameTimingCount), i;
    for (i = 0; i < frameTimingCount; i++) values[i] = samples[i];
    values.sort(function (a, b) { return a - b; });
    return {
      p50Ms: Math.round(values[Math.floor((frameTimingCount - 1) * 0.5)] * 100) / 100,
      p95Ms: Math.round(values[Math.ceil(frameTimingCount * 0.95) - 1] * 100) / 100
    };
  }
  // Manual, bounded diagnostics: no HUD, polling timer, or per-frame history allocation.
  var rendererHistory = [], RENDERER_HISTORY_LIMIT = 120;
  G.debug = G.debug || {};
  G.debug.rendererSnapshot = function (label) {
    var info = renderer.info || {}, render = info.render || {}, memory = info.memory || {};
    return {
      label: label == null ? '' : String(label),
      build: BUILD_ID,
      timeMs: Math.round(performance.now()),
      fps: fps,
      pixelRatio: renderer.getPixelRatio ? renderer.getPixelRatio() : null,
      quality: G.quality ? G.quality.value : null,
      adaptiveScale: adaptiveScale,
      drawDistance: G.world && G.world.drawDistance != null ? G.world.drawDistance : null,
      chunks: G.world && typeof G.world.chunkCount === 'function' ? G.world.chunkCount() : null,
      dungeonActive: !!(G.dungeon && G.dungeon.active),
      player: G.player && G.player.pos ? {
        x: Math.round(G.player.pos.x * 10) / 10,
        y: Math.round(G.player.pos.y * 10) / 10,
        z: Math.round(G.player.pos.z * 10) / 10
      } : null,
      render: {
        frame: render.frame == null ? null : render.frame,
        calls: render.calls || 0,
        triangles: render.triangles || 0,
        points: render.points || 0,
        lines: render.lines || 0
      },
      memory: {
        geometries: memory.geometries || 0,
        textures: memory.textures || 0
      },
      programs: info.programs ? info.programs.length : 0,
      timings: {
        sampleCount: frameTimingCount,
        frameIntervalMs: summarizeFrameTiming(frameTiming.interval),
        simulationCpuMs: summarizeFrameTiming(frameTiming.simulation),
        environmentCpuMs: summarizeFrameTiming(frameTiming.environment),
        worldCpuMs: summarizeFrameTiming(frameTiming.world),
        renderSubmitCpuMs: summarizeFrameTiming(frameTiming.renderSubmit)
      }
    };
  };
  G.debug.captureRendererSnapshot = function (label) {
    var snapshot = G.debug.rendererSnapshot(label);
    // Snapshots contain primitives only; JSON cloning prevents callers mutating stored history.
    rendererHistory.push(JSON.parse(JSON.stringify(snapshot)));
    if (rendererHistory.length > RENDERER_HISTORY_LIMIT) rendererHistory.splice(0, rendererHistory.length - RENDERER_HISTORY_LIMIT);
    return JSON.parse(JSON.stringify(snapshot));
  };
  G.debug.getRendererHistory = function () {
    return JSON.parse(JSON.stringify(rendererHistory));
  };
  G.debug.clearRendererHistory = function () {
    rendererHistory.length = 0;
    return true;
  };
  G.debug.setProfilingEnabled = function (enabled) {
    var next = !!enabled;
    if (profilingEnabled === next) return profilingEnabled;
    profilingEnabled = next;
    frameTimingCount = 0; frameTimingCursor = 0; rendererHistory.length = 0;
    frameTiming.interval.fill(0); frameTiming.simulation.fill(0); frameTiming.environment.fill(0);
    frameTiming.world.fill(0); frameTiming.renderSubmit.fill(0);
    return profilingEnabled;
  };
  G.debug.isProfilingEnabled = function () { return profilingEnabled; };

  // The on-device capture panel is opt-in; normal gameplay has no frame-loop timing calls.
  var profileStatus = document.getElementById('profile-status');
  function updateProfileStatus(message, isError) {
    if (!profileStatus) return;
    profileStatus.textContent = message;
    profileStatus.setAttribute('data-state', isError ? 'error' : 'normal');
  }
  function buildProfilePayload() {
    return {
      schemaVersion: 2,
      build: BUILD_ID,
      exportedAt: new Date().toISOString(),
      environment: {
        viewport: { width: window.innerWidth, height: window.innerHeight },
        screen: { width: window.screen ? window.screen.width : null, height: window.screen ? window.screen.height : null },
        devicePixelRatio: window.devicePixelRatio || 1,
        touch: !!(navigator.maxTouchPoints > 0),
        profilingEnabled: profilingEnabled
      },
      interpretation: {
        fps: 'Observed main-loop frame cadence; not isolated GPU render time.',
        cpuTimings: 'p50/p95 over the latest 120 rendered frames. Phase timings measure synchronous JavaScript time; renderSubmitCpuMs does not measure asynchronous GPU completion.',
        rendererMemory: 'Three.js geometry and texture object counts, not byte totals or authoritative VRAM.'
      },
      snapshots: G.debug.getRendererHistory()
    };
  }
  function makeProfileJson() { return JSON.stringify(buildProfilePayload(), null, 2); }
  function downloadProfileJson() {
    var objectUrl = null, link = null;
    try {
      var blob = new Blob([makeProfileJson()], { type: 'application/json' });
      if (!window.URL || !URL.createObjectURL) throw new Error('Trình duyệt không hỗ trợ tạo tệp JSON.');
      objectUrl = URL.createObjectURL(blob);
      link = document.createElement('a');
      link.href = objectUrl;
      link.download = 'besidevalley-profile-' + new Date().toISOString().replace(/[:.]/g, '-') + '.json';
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      link = null;
      window.setTimeout(function () { try { URL.revokeObjectURL(objectUrl); } catch (_) {} }, 1500);
      updateProfileStatus('Đã yêu cầu xuất JSON · ' + G.debug.getRendererHistory().length + ' mẫu');
      return true;
    } catch (error) {
      if (link && link.parentNode) link.parentNode.removeChild(link);
      updateProfileStatus('Lỗi xuất JSON: ' + String(error && error.message || error).slice(0, 180), true);
      return false;
    }
  }
  function reportProfileError(message) {
    if (!profileQueryEnabled || !profileTools || profileTools.hidden) return;
    updateProfileStatus('Lỗi runtime: ' + String(message || 'Không rõ nguyên nhân').slice(0, 180), true);
  }
  window.addEventListener('error', function (event) {
    reportProfileError(event && (event.message || (event.error && event.error.message)));
  });
  window.addEventListener('unhandledrejection', function (event) {
    var reason = event && event.reason;
    reportProfileError(reason && reason.message ? reason.message : reason);
  });
  if (profileQueryEnabled && profileTools) {
    var profileCapture = document.getElementById('profile-capture');
    var profileExport = document.getElementById('profile-export');
    var profileCopy = document.getElementById('profile-copy');
    var profileClear = document.getElementById('profile-clear');
    profileTools.hidden = false;
    if (profileCapture) profileCapture.addEventListener('click', function () {
      try {
        if (!G.debug || typeof G.debug.captureRendererSnapshot !== 'function') throw new Error('Profiler chưa khởi tạo.');
        var next = rendererHistory.length + 1;
        var snap = G.debug.captureRendererSnapshot('manual-' + String(next).padStart(2, '0'));
        updateProfileStatus('Mẫu ' + next + ' · ' + snap.timings.sampleCount + '/120 frame · ' + (snap.fps || '--') + ' FPS');
      } catch (error) {
        updateProfileStatus('Lỗi chụp mẫu: ' + String(error && error.message || error).slice(0, 180), true);
      }
    });
    if (profileClear) profileClear.addEventListener('click', function () {
      try { G.debug.clearRendererHistory(); updateProfileStatus('Đã xóa toàn bộ mẫu.'); }
      catch (error) { updateProfileStatus('Lỗi xóa mẫu: ' + String(error && error.message || error).slice(0, 180), true); }
    });
    if (profileExport) profileExport.addEventListener('click', function () {
      if (!rendererHistory.length) { updateProfileStatus('Chưa có mẫu để xuất.', true); return; }
      downloadProfileJson();
    });
    if (profileCopy) profileCopy.addEventListener('click', function () {
      if (!rendererHistory.length) { updateProfileStatus('Chưa có mẫu để sao chép.', true); return; }
      if (!navigator.clipboard || typeof navigator.clipboard.writeText !== 'function') {
        updateProfileStatus('Clipboard không khả dụng. Hãy dùng nút Xuất JSON.', true);
        return;
      }
      navigator.clipboard.writeText(makeProfileJson()).then(function () {
        updateProfileStatus('Đã sao chép JSON vào clipboard.');
      }).catch(function (error) {
        updateProfileStatus('Không thể sao chép: ' + String(error && error.message || error).slice(0, 140) + ' · Hãy Xuất JSON.', true);
      });
    });
    updateProfileStatus('Profiler sẵn sàng · chờ đủ 120 frame để đọc p95.');
  }

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
    var simulationCpuMs = 0, environmentCpuMs = 0, worldCpuMs = 0, renderSubmitCpuMs = 0;
    var stageStart = profilingEnabled ? performance.now() : 0;
    G.inventory.update();
    var inp = G.input;
    if (!G.paused) G.player.update(dt);
    else { inp.attackQ = inp.dodgeQ = inp.interactQ = false; inp.lookDX = inp.lookDY = 0; inp.viewToggle = false; }
    var p = G.player.pos;
    if (!G.paused) { G.combat.update(dt); G.enemies.update(dt, p.x, p.y, p.z); G.loot.update(dt); G.dungeon.update(dt); }
    if (profilingEnabled) { simulationCpuMs = performance.now() - stageStart; stageStart = performance.now(); }
    G.sky.update(G.paused ? 0 : dt);
    G.fx.update(G.paused ? 0 : dt, p.x, p.y, p.z);
    G.minimap.update(raw);
    if (profilingEnabled) { environmentCpuMs = performance.now() - stageStart; stageStart = performance.now(); }
    // Keep chunk generation within a small CPU budget; allow more work only after measured frame time shows spare headroom.
    var chunkBudget = touch ? 1.4 : 2.4;
    if (fps > 100 && !touch) chunkBudget = 3.4;
    else if (fps > 70) chunkBudget = touch ? 1.8 : 3.0;
    else if (fps > 0 && fps < 35) chunkBudget = 0.7;
    G.world.update(p.x, p.z, chunkBudget, dt);
    if (profilingEnabled) { worldCpuMs = performance.now() - stageStart; stageStart = performance.now(); }
    renderer.render(scene, camera);
    if (profilingEnabled) {
      renderSubmitCpuMs = performance.now() - stageStart;
      recordFrameTimings(raw * 1000, simulationCpuMs, environmentCpuMs, worldCpuMs, renderSubmitCpuMs);
    }

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
