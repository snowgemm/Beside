(function () {
  var G = window.Game = window.Game || {};
  var touch = G.input.isTouch;
  var renderer = new THREE.WebGLRenderer({ antialias: !touch, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, touch ? 1.5 : 2));
  renderer.shadowMap.enabled = false;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.setSize(window.innerWidth, window.innerHeight);
  document.getElementById('game').appendChild(renderer.domElement);
  var scene = new THREE.Scene();
  var qualityData={low:{pixel:1,grass:'low',shadows:false},medium:{pixel:1.5,grass:'medium',shadows:false},high:{pixel:2,grass:'high',shadows:true}};
  G.quality={value:touch?'medium':'high',set:function(level){
    if(!qualityData[level])level=touch?'medium':'high';this.value=level;var q=qualityData[level];
    renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,q.pixel));renderer.setSize(window.innerWidth,window.innerHeight);
    renderer.shadowMap.enabled=!!q.shadows;if(G.sky&&G.sky.setShadows)G.sky.setShadows(!!q.shadows);
    if(G.world&&G.world.setGrassQuality)G.world.setGrassQuality(q.grass);
    if(scene&&scene.traverse)scene.traverse(function(o){
      if((!o.isMesh&&!o.isInstancedMesh)||!o.geometry)return;
      if(o.userData&&o.userData.noShadow){o.castShadow=false;o.receiveShadow=false;return;}
      if(o.userData&&o.userData.terrain){o.castShadow=false;o.receiveShadow=!!q.shadows;return;}
      o.castShadow=!!q.shadows;o.receiveShadow=!!q.shadows;
    });
  }};

  var camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 500);
  G.camera = camera; G.renderer = renderer;
  window.addEventListener('resize', function () {
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, (G.quality && G.quality.value === "low") ? 1 : (G.quality && G.quality.value === "medium") ? 1.5 : 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
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
  G.build.init(scene);
  G.menu.init();
  G.assets.load();
  G.inventory.init();
  G.save.init();
  G.save.load();
  G.menu.apply();
  G.dungeon.afterLoad();
  G.world.preload(G.player.pos.x, G.player.pos.z, 2);
  G.ui.init();

  var hud = document.getElementById('hud');
  var last = performance.now(), accT = 0, accN = 0, hudT = 0, fps = 0, slowT = 0, lowered = 0;
  function frame(now) {
    requestAnimationFrame(frame);
    var raw = (now - last) / 1000; last = now;
    var dt = Math.min(raw, 0.05);
    G.inventory.update();
    var inp = G.input;
    if (!G.paused) G.player.update(dt);
    else { inp.attackQ = inp.dodgeQ = inp.interactQ = false; inp.lookDX = inp.lookDY = 0; inp.viewToggle = false; }
    var p = G.player.pos;
    if (!G.paused) { G.combat.update(dt); G.enemies.update(dt, p.x, p.y, p.z); G.loot.update(dt); G.dungeon.update(dt); }
    G.build.update();
    G.sky.update(G.paused ? 0 : dt);
    G.fx.update(G.paused ? 0 : dt, p.x, p.y, p.z);
    G.minimap.update(raw);
    G.world.update(p.x, p.z, 4, dt);
    renderer.render(scene, camera);

    if (raw < 0.25) { accT += raw; accN++; hudT += raw; }
    if (accT >= 1) {
      var avg = accT / accN * 1000;
      fps = Math.round(1000 / avg);
      // automatic quality: touch only, >28 ms average for 5 s, at most twice per session, min draw distance 3
      if (touch && avg > 28 && !G.paused && !G.dungeon.active) slowT += accT; else slowT = 0;
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
      hud.textContent = G.dungeon.active ? 'FPS ' + fps : 'FPS ' + fps + ' · Tầm nhìn ' + G.world.drawDistance + ' · Vùng ' + G.world.chunkCount();
    }
  }
  requestAnimationFrame(frame);
})();
