(function () {
  var G = window.Game = window.Game || {};
  var touch = G.input.isTouch;
  var renderer = new THREE.WebGLRenderer({ antialias: !touch, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, touch ? 1.5 : 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  document.getElementById('game').appendChild(renderer.domElement);
  var scene = new THREE.Scene();
  var camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 500);
  window.addEventListener('resize', function () { renderer.setSize(window.innerWidth, window.innerHeight); camera.aspect = window.innerWidth / window.innerHeight; camera.updateProjectionMatrix(); });
  G.world.drawDistance = touch ? 3 : 5;
  G.world.init(scene);
  var spawn = G.world.findSpawn();
  G.player.init(scene, camera, spawn);
  G.input.init(renderer.domElement);
  G.combat.init(camera);
  G.enemies.init(scene, camera);
  G.loot.init(scene);
  G.inventory.init();
  G.save.init();
  G.save.load();
  G.world.preload(G.player.pos.x, G.player.pos.z, 2);
  var hud = document.getElementById('hud');
  var last = performance.now(), accT = 0, accN = 0, cool = 3, hudT = 0, fps = 0;
  function frame(now) {
    requestAnimationFrame(frame);
    var raw = (now-last)/1000; last=now; var dt=Math.min(raw,0.05);
    G.inventory.update();
    var inp=G.input;
    if(!G.paused)G.player.update(dt);else{inp.attackQ=inp.dodgeQ=false;inp.lookDX=inp.lookDY=0;inp.viewToggle=false;}
    var p=G.player.pos;
    if(!G.paused){G.combat.update(dt);G.enemies.update(dt,p.x,p.y,p.z);G.loot.update(dt);}
    G.world.update(p.x,p.z,4);renderer.render(scene,camera);
    if(raw<0.25){accT+=raw;accN++;hudT+=raw;cool-=raw;}
    if(accT>=1.5){var avg=accT/accN*1000;fps=Math.round(1000/avg);if(avg>34&&cool<=0&&G.world.drawDistance>2){G.world.setDrawDistance(G.world.drawDistance-1);cool=3;}accT=0;accN=0;}
    if(hudT>=0.4){hudT=0;hud.textContent='FPS '+fps+' · Tầm nhìn '+G.world.drawDistance+' · Vùng '+G.world.chunkCount();}
  }
  requestAnimationFrame(frame);
})();