(function(){
'use strict';
var G=window.Game=window.Game||{};
if(!G.menu||!G.player||!G.world||!G.enemies)return;
// This hash is a local convenience gate, not server-side authentication.
var CODE_HASH='3587b7c6eab838b30d3a2f2e91fe9a3cc892dd99ded271f05f73288b9d49fca5';
var root=document.createElement('div'),snapshot=null,wasPaused=false,locked=true,qaActors=[];
root.id='dev-mode';root.hidden=true;root.setAttribute('role','dialog');root.setAttribute('aria-modal','true');
root.innerHTML=
'<div class="dev-shell"><header class="dev-head"><div><strong>BESIDE · DEVELOPER MODE</strong><small>QA local · temporary session · allowlisted controls only</small></div><button id="dev-close" type="button">Đóng ✕</button></header>'+
'<form id="dev-lock" class="dev-lock"><h2>Mở khóa Developer Mode</h2><p>Nhập mã truy cập. Mã không được lưu sau khi đóng.</p><input id="dev-code" type="password" autocomplete="off" autocapitalize="characters" placeholder="Mã truy cập" required><button type="submit">Mở khóa</button><p id="dev-lock-status" class="dev-status" role="status"></p><p>Khóa giao diện phía trình duyệt không thay thế xác thực máy chủ.</p></form>'+
'<div id="dev-workspace" hidden><nav class="dev-tabs">'+
'<button data-tab="overview" type="button" aria-selected="true">Tổng quan</button><button data-tab="world" type="button">World</button><button data-tab="player" type="button">Player</button>'+
'<button data-tab="actors" type="button">Enemies / Boss</button><button data-tab="items" type="button">Items</button><button data-tab="graphics" type="button">Graphics</button><button data-tab="ui" type="button">UI</button><button data-tab="qa" type="button">QA / Profiler</button></nav><main class="dev-content">'+
'<section data-panel="overview"><div class="dev-card"><h3>Runtime overview</h3><div id="dev-metrics" class="dev-metrics"></div><div class="dev-actions"><button id="dev-refresh" type="button">Làm mới</button><button id="dev-checks" type="button">System checks</button></div><div id="dev-check-list"></div></div></section>'+
'<section data-panel="world" hidden><div class="dev-grid">'+
'<div class="dev-card"><h3>World & environment</h3><label>Draw distance <select id="dev-dd"><option>3</option><option>4</option><option>5</option><option>6</option><option>7</option></select></label>'+
'<label>Time of day <input id="dev-time" type="range" min="0" max="1" step="0.01"></label><label>Day cycle <select id="dev-day-speed"><option value="0">Paused</option><option value="0.5">0.5×</option><option value="1">1×</option><option value="2">2×</option></select></label>'+
'<div class="dev-actions"><button id="dev-apply-world" type="button">Apply</button><button id="dev-nearest-gate" type="button">Tới dungeon gate gần nhất</button></div></div>'+
'<div class="dev-card"><h3>World teleport</h3><label>X <input id="dev-x" type="number" step="1"></label><label>Z <input id="dev-z" type="number" step="1"></label>'+
'<div class="dev-actions"><button id="dev-teleport" type="button">Teleport</button><button id="dev-return" type="button">Về vị trí ban đầu</button></div></div></div></section>'+
'<section data-panel="player" hidden><div class="dev-grid"><div class="dev-card"><h3>Camera</h3><label>Mode <select id="dev-camera-mode"><option value="rear">Rear</option><option value="front">Front</option><option value="cinematic">Cinematic</option></select></label>'+
'<label>Distance <input id="dev-camera-distance" type="number" min="3" max="11" step="0.5"></label><label>FOV <input id="dev-camera-fov" type="number" min="55" max="90"></label>'+
'<div class="dev-actions"><button id="dev-apply-camera" type="button">Apply camera</button><button id="dev-toggle-view" type="button">First / third person</button></div></div>'+
'<div class="dev-card"><h3>Player state</h3><p>HP và equipment sẽ được hoàn nguyên khi đóng Dev Mode.</p><div class="dev-actions"><button id="dev-heal" type="button">Restore HP</button><button id="dev-test-hit" type="button">Hit reaction test</button></div></div></div></section>'+
'<section data-panel="actors" hidden><div class="dev-grid"><div class="dev-card"><h3>Enemy test</h3><label>Type <select id="dev-enemy-type"></select></label><label>Count <select id="dev-enemy-count"><option>1</option><option>2</option><option>3</option></select></label>'+
'<div class="dev-actions"><button id="dev-spawn-enemy" type="button">Spawn enemy</button><button id="dev-spawn-boss" type="button">Spawn boss</button></div><div class="dev-actions"><button id="dev-clean-actors" type="button">Clear QA actors</button></div><p id="dev-actor-count">0 QA actors.</p></div>'+
'<div class="dev-card"><h3>Test lifecycle</h3><p>Đóng Dev Mode để cho AI/combat chạy thật. Mở lại để dọn đúng các actor do QA tạo, không xóa enemy tự nhiên.</p></div></div></section>'+
'<section data-panel="items" hidden><div class="dev-grid"><div class="dev-card"><h3>Loot generator</h3><label>Source <select id="dev-loot-source"><option value="misc">Generic</option><option value="slime">Slime</option><option value="goblin">Goblin</option><option value="wolf">Wolf</option><option value="chest">Chest</option></select></label>'+
'<label>Item level <input id="dev-loot-level" type="number" min="1" max="50" value="1"></label><div class="dev-actions"><button id="dev-roll-loot" type="button">Generate preview</button><button id="dev-check-item" type="button">Validate item</button></div><pre id="dev-loot-output" class="dev-output">Item preview appears here.</pre></div>'+
'<div class="dev-card"><h3>Inventory / equipment</h3><p>Preview does not insert items into the saved inventory. Normal inventory screen remains available from gameplay.</p></div></div></section>'+
'<section data-panel="graphics" hidden><div class="dev-grid"><div class="dev-card"><h3>Renderer</h3><label>Quality <select id="dev-quality"><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select></label>'+
'<label>FPS cap <select id="dev-fps"><option value="0">Display refresh</option><option>30</option><option>60</option><option>90</option><option>120</option><option>144</option></select></label>'+
'<label>Particles <select id="dev-particles"><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select></label><div class="dev-actions"><button id="dev-apply-graphics" type="button">Apply graphics</button><button id="dev-read-renderer" type="button">Read renderer.info</button></div><p id="dev-renderer-info"></p></div>'+
'<div class="dev-card"><h3>Visual effects</h3><label>Effect <select id="dev-fx"><option>dust</option><option>hit</option><option>death</option><option>pickup</option><option>splash</option><option>blockbreak</option><option>blockplace</option></select></label><button id="dev-play-fx" type="button">Play effect</button></div></div></section>'+
'<section data-panel="ui" hidden><div class="dev-card"><h3>UI & minimap</h3><div class="dev-actions"><button id="dev-toggle-map" type="button">Toggle minimap</button><button id="dev-world-map" type="button">Toggle full map</button><button id="dev-settings" type="button">Open settings</button><button id="dev-inventory" type="button">Open inventory</button></div></div></section>'+
'<section data-panel="qa" hidden><div class="dev-grid"><div class="dev-card"><h3>Profiler</h3><p>Wait 120 frames before reading p95. CPU timings are synchronous JS time, not GPU completion.</p><div class="dev-actions"><button id="dev-profiler-enable" type="button">Enable profiler</button><button id="dev-profiler-capture" type="button">Capture</button><button id="dev-profiler-export" type="button">Export JSON</button></div><p id="dev-profiler-status"></p></div>'+
'<div class="dev-card"><h3>Diagnostics</h3><div class="dev-actions"><button id="dev-run-checks-2" type="button">Run system checks</button><button id="dev-copy-diagnostics" type="button">Copy diagnostics</button></div></div></div></section>'+
'<p id="dev-status" class="dev-status" role="status" aria-live="polite">Developer Mode ready.</p></main></div></div>';
document.body.appendChild(root);
function $(id){return document.getElementById(id);}
var statusEl=$('dev-status'),lockStatus=$('dev-lock-status'),metrics=$('dev-metrics'),checksOut=$('dev-check-list');
function status(message,error){statusEl.textContent=message;statusEl.dataset.state=error?'error':'ok';}
function lockMessage(message,error){lockStatus.textContent=message;lockStatus.dataset.state=error?'error':'ok';}
function clone(v){return JSON.parse(JSON.stringify(v));}
function verify(code){
 if(!window.crypto||!crypto.subtle||!window.TextEncoder)return Promise.reject(new Error('Cần HTTPS và Web Crypto.'));
 return crypto.subtle.digest('SHA-256',new TextEncoder().encode(String(code||'').trim().toUpperCase())).then(function(b){
  return Array.from(new Uint8Array(b)).map(function(x){return x.toString(16).padStart(2,'0');}).join('')===CODE_HASH;
 });
}
function capture(){
 var P=G.player,p=P.pos,S=G.sky,M=G.minimap,U=G.menu.settings;
 return {paused:G.paused,dungeon:G.dungeon.active,player:{x:p.x,y:p.y,z:p.z,vx:p.vx,vy:p.vy,vz:p.vz,hp:P.health,dead:P.dead,
  yaw:P.yaw,pitch:P.pitch,third:P.third,camDist:P.camDist,cameraMode:P.cameraMode,equip:clone(P.equip)},
  inventory:clone(G.inventory.slots),lootCounter:G.loot.counter,drawDistance:G.world.drawDistance,quality:G.quality.value,
  fps:U.fpsCap,particles:U.particles,day:S.t,daySpeed:S.speed,fov:G.camera.fov,map:M.enabled,mapExpanded:M.expanded,mapZoom:M.zoom,
  profiling:G.debug.isProfilingEnabled()};
}
function clearActors(){
 if(G.boss.active&&qaActors.some(function(a){return a.type==='boss';}))G.boss.cleanup();
 for(var i=qaActors.length-1;i>=0;i--)G.enemies.remove(qaActors[i]);
 qaActors.length=0;$('dev-actor-count').textContent='0 QA actors.';
}
function restore(){
 if(!snapshot)return;
 var o=snapshot,P=G.player,p=P.pos;
 if(!!G.dungeon.active===o.dungeon){
  p.x=o.player.x;p.y=o.player.y;p.z=o.player.z;p.vx=o.player.vx;p.vy=o.player.vy;p.vz=o.player.vz;p.onGround=false;
  P.health=o.player.hp;P.dead=o.player.dead;P.yaw=o.player.yaw;P.pitch=o.player.pitch;P.third=o.player.third;
  P.equip=clone(o.player.equip);P.recalc();o.inventory.forEach(function(it,i){G.inventory.slots[i]=it;});
  G.inventory.refresh();G.ui.setWeapon(P.equip.weapon);G.loot.counter=o.lootCounter;
 }
 P.camDist=o.player.camDist;P.cameraMode=o.player.cameraMode;G.camera.fov=o.fov;G.camera.updateProjectionMatrix();
 G.world.setDrawDistance(o.drawDistance);G.menu.settings.dd=o.drawDistance;G.quality.set(o.quality);G.menu.settings.quality=o.quality;
 G.setFpsCap(o.fps);G.menu.settings.fpsCap=o.fps;G.fx.setQuality(o.particles);G.menu.settings.particles=o.particles;
 G.sky.t=o.day;G.sky.setSpeed(o.daySpeed);G.menu.settings.daySpeed=o.daySpeed;
 G.minimap.setEnabled(o.map);G.minimap.setZoom(o.mapZoom,false);G.minimap.setExpanded(o.mapExpanded);
 G.debug.setProfilingEnabled(o.profiling);
 G.paused=o.paused||G.ui.titleOpen||G.menu.open||G.inventory.open;snapshot=null;
}
function refresh(){
 var s=G.debug.rendererSnapshot('dev-overview'),a=[['FPS',s.fps||'--'],['Draw calls',s.render.calls],
 ['Triangles',s.render.triangles.toLocaleString('en-US')],['Chunks',s.chunks],['Geometry',s.memory.geometries],['Textures',s.memory.textures]];
 metrics.textContent='';a.forEach(function(x){var d=document.createElement('div');d.className='dev-metric';var b=document.createElement('b'),t=document.createElement('span');b.textContent=String(x[1]);t.textContent=x[0];d.appendChild(b);d.appendChild(t);metrics.appendChild(d);});
}
function checks(){
 var gl=G.renderer.getContext(),p=G.player.pos,list=[
 ['WebGL',!!(gl&&!gl.isContextLost())],['World chunks',G.world.chunkCount()>0],['Player state',isFinite(p.x)&&isFinite(p.y)&&isFinite(p.z)],
 ['Camera',!!G.camera.updateProjectionMatrix],['Enemy API',!!(G.enemies.spawn&&G.enemies.remove)],['Dungeon API',!!G.dungeon.gatesNear],
 ['Boss API',!!(G.boss.spawn&&G.boss.cleanup)],['Item generator',!!(G.loot.roll&&G.items.valid)],['Minimap',!!G.minimap.setEnabled],
 ['Day cycle',!!G.sky.setSpeed],['Visual effects',!!G.fx.burst],['Inventory refresh',!!G.inventory.refresh],
 ['Save sandbox',!!G.save.setDevSandbox],['Profiler API',!!G.debug.setProfilingEnabled]];
 checksOut.textContent='';var n=0;list.forEach(function(x){if(x[1])n++;var r=document.createElement('div'),t=document.createElement('span'),b=document.createElement('b');r.className='dev-check';t.textContent=x[0];b.textContent=x[1]?'READY':'MISSING';if(!x[1])b.className='fail';r.appendChild(t);r.appendChild(b);checksOut.appendChild(r);});
 status('System checks: '+n+'/'+list.length+' ready.',n!==list.length);
}
function teleport(x,z){
 if(G.dungeon.active){status('World teleport is disabled inside dungeon.',true);return;}
 if(!isFinite(x)||!isFinite(z)||Math.abs(x)>100000||Math.abs(z)>100000){status('Invalid world coordinates.',true);return;}
 var y=G.world.getHeight(x,z);if(!isFinite(y)){status('Cannot sample terrain height.',true);return;}
 var p=G.player.pos;p.x=x;p.y=y+.15;p.z=z;p.vx=p.vy=p.vz=0;p.onGround=false;
 $('dev-x').value=String(Math.round(x));$('dev-z').value=String(Math.round(z));status('Teleported for this QA session.');
}
function nearestGate(){
 if(G.dungeon.active){status('Already inside a dungeon.',true);return;}
 var p=G.player.pos,r=512,a=G.dungeon.gatesNear(p.x-r,p.z-r,p.x+r,p.z+r)||[];
 if(!a.length){status('No dungeon gate found in the search area.',true);return;}
 a.sort(function(x,y){return Math.hypot(x.x-p.x,x.z-p.z)-Math.hypot(y.x-p.x,y.z-p.z);});
 teleport(a[0].x,a[0].z);status('At nearest gate. Use the in-game interact control to enter.');
}
function spawnEnemies(){
 var type=$('dev-enemy-type').value,n=Math.max(1,Math.min(3,+$('dev-enemy-count').value|0));
 if(!G.enemies.types[type]||G.enemies.list.length+n>20){status('Enemy type invalid or 20-enemy cap reached.',true);return;}
 var p=G.player.pos,made=0;
 for(var i=0;i<n;i++){var a=i*6.283/n,x=p.x+Math.cos(a)*10,z=p.z+Math.sin(a)*10,y=G.dungeon.active?p.y:G.world.getHeight(x,z);if(!isFinite(y))continue;
  var e=G.enemies.spawn(type,x,y+.02,z);if(e){qaActors.push(e);made++;}}
 $('dev-actor-count').textContent=qaActors.length+' QA actors.';status('Spawned '+made+' test enemies. Close Dev Mode to run AI/combat.');
}
function spawnBoss(){
 if(G.boss.active){status('A boss is already active.',true);return;}
 var p=G.player.pos,x=p.x+14,z=p.z+2,y=G.dungeon.active?p.y:G.world.getHeight(x,z);if(!isFinite(y)){status('No terrain position for boss.',true);return;}
 var e=G.boss.spawn(x,y+.02,z,Math.max(1,G.loot.levelAt(x,z)));if(e){qaActors.push(e);$('dev-actor-count').textContent=qaActors.length+' QA actors.';status('Boss test spawned. Close Dev Mode to test combat.');}
}
function exportProfile(){
 var snapshots=G.debug.getRendererHistory();if(!snapshots.length){status('No profiler samples to export.',true);return;}
 try{var u=URL.createObjectURL(new Blob([JSON.stringify({schemaVersion:2,build:G.debug.rendererSnapshot('dev-export').build,exportedAt:new Date().toISOString(),snapshots:snapshots},null,2)],{type:'application/json'}));
  var a=document.createElement('a');a.href=u;a.download='beside-dev-profile-'+new Date().toISOString().replace(/[:.]/g,'-')+'.json';document.body.appendChild(a);a.click();document.body.removeChild(a);
  window.setTimeout(function(){try{URL.revokeObjectURL(u);}catch(_){}},1500);status('Export requested for '+snapshots.length+' samples.');
 }catch(e){status('Profile export failed: '+String(e&&e.message||e),true);}
}
function open(){
 root.hidden=false;locked=true;$('dev-lock').hidden=false;$('dev-workspace').hidden=true;$('dev-code').value='';
 lockMessage('Mã được kiểm tra cục bộ bằng SHA-256.',false);wasPaused=!!G.paused;G.paused=true;G.save.setDevSandbox(true);
 if(document.exitPointerLock&&document.pointerLockElement)document.exitPointerLock();
}
function close(){
 if(root.hidden)return;if(!locked)restore();root.hidden=true;locked=true;G.save.setDevSandbox(false);
 G.paused=wasPaused||G.ui.titleOpen||G.menu.open||G.inventory.open;
}
$('dev-lock').addEventListener('submit',function(e){
 e.preventDefault();lockMessage('Checking code…',false);
 verify($('dev-code').value).then(function(ok){
  if(!ok){lockMessage('Mã không đúng.',true);$('dev-code').select();return;}
  locked=false;$('dev-lock').hidden=true;$('dev-workspace').hidden=false;snapshot=capture();
  $('dev-dd').value=String(G.world.drawDistance);$('dev-time').value=String(G.sky.t);$('dev-day-speed').value=String(G.sky.speed);
  $('dev-x').value=String(Math.round(G.player.pos.x));$('dev-z').value=String(Math.round(G.player.pos.z));
  $('dev-camera-mode').value=G.player.cameraMode;$('dev-camera-distance').value=String(G.player.camDist);$('dev-camera-fov').value=String(G.camera.fov);
  $('dev-quality').value=G.quality.value;$('dev-fps').value=String(G.menu.settings.fpsCap);$('dev-particles').value=G.menu.settings.particles;
  $('dev-enemy-type').innerHTML=Object.keys(G.enemies.types).filter(function(n){return n!=='boss';}).map(function(n){return '<option value="'+n+'">'+n+'</option>';}).join('');
  refresh();checks();
 }).catch(function(err){lockMessage('Cannot verify: '+String(err&&err.message||err),true);});
});
root.addEventListener('click',function(e){
 var tab=e.target.closest&&e.target.closest('[data-tab]');if(tab){root.querySelectorAll('[data-tab]').forEach(function(b){b.setAttribute('aria-selected',b===tab?'true':'false');});root.querySelectorAll('[data-panel]').forEach(function(p){p.hidden=p.getAttribute('data-panel')!==tab.getAttribute('data-tab');});return;}
 var id=e.target.id;
 try{
  if(id==='dev-close'){close();return;}
  if(id==='dev-refresh'){refresh();status('Metrics refreshed.');}
  else if(id==='dev-checks'||id==='dev-run-checks-2')checks();
  else if(id==='dev-apply-world'){G.world.setDrawDistance(+$('dev-dd').value);G.menu.settings.dd=+$('dev-dd').value;G.sky.t=+$('dev-time').value;G.sky.setSpeed(+$('dev-day-speed').value);G.menu.settings.daySpeed=+$('dev-day-speed').value;status('World/time settings applied.');}
  else if(id==='dev-teleport')teleport(+$('dev-x').value,+$('dev-z').value);
  else if(id==='dev-return')teleport(snapshot.player.x,snapshot.player.z);
  else if(id==='dev-nearest-gate')nearestGate();
  else if(id==='dev-apply-camera'){var m=$('dev-camera-mode').value,d=+$('dev-camera-distance').value,f=+$('dev-camera-fov').value;
   if(['rear','front','cinematic'].indexOf(m)<0||!isFinite(d)||d<3||d>11||!isFinite(f)||f<55||f>90){status('Invalid camera values.',true);return;}
   G.player.cameraMode=m;G.player.camDist=d;G.camera.fov=f;G.camera.updateProjectionMatrix();status('Camera applied.');}
  else if(id==='dev-toggle-view'){G.player.third=!G.player.third;status('View mode toggled.');}
  else if(id==='dev-heal'){if(G.player.dead){status('Use the normal respawn flow first.',true);return;}G.player.health=G.player.maxHealth;status('HP restored temporarily.');}
  else if(id==='dev-test-hit'){if(G.player.dead||G.player.health<=5){status('Not enough HP for safe hit test.',true);return;}G.combat.hurtPlayer(3,G.player.pos.x+1,G.player.pos.z);status('Hit reaction test executed.');}
  else if(id==='dev-spawn-enemy')spawnEnemies();
  else if(id==='dev-spawn-boss')spawnBoss();
  else if(id==='dev-clean-actors'){clearActors();status('Removed only QA-created actors.');}
  else if(id==='dev-roll-loot'){var level=Math.max(1,Math.min(50,Math.round(+$('dev-loot-level').value||1))),it=G.loot.roll(level,$('dev-loot-source').value);$('dev-loot-output').textContent=JSON.stringify(it,null,2);status('Generated item preview only; inventory/save unchanged.');}
  else if(id==='dev-check-item'){var it=G.loot.roll(1,'misc');status(G.items.valid(it)?'Item validator: PASS':'Item validator: FAIL',!G.items.valid(it));}
  else if(id==='dev-apply-graphics'){var q=$('dev-quality').value,cap=+$('dev-fps').value,fx=$('dev-particles').value;
   if(['low','medium','high'].indexOf(q)<0||[0,30,60,90,120,144].indexOf(cap)<0||['low','medium','high'].indexOf(fx)<0){status('Invalid graphics options.',true);return;}
   G.quality.set(q);G.setFpsCap(cap);G.fx.setQuality(fx);G.menu.settings.quality=q;G.menu.settings.fpsCap=cap;G.menu.settings.particles=fx;status('Graphics settings applied.');}
  else if(id==='dev-read-renderer'){var s=G.debug.rendererSnapshot('dev-render');$('dev-renderer-info').textContent='FPS '+(s.fps||'--')+' · Calls '+s.render.calls+' · Triangles '+s.render.triangles+' · Geometry '+s.memory.geometries+' · Textures '+s.memory.textures+' · Timings '+s.timings.sampleCount+'/120';}
  else if(id==='dev-play-fx'){var p=G.player.pos;G.fx.burst(p.x,p.y+.4,p.z,$('dev-fx').value);status('Visual effect triggered.');}
  else if(id==='dev-toggle-map'){G.minimap.setEnabled(!G.minimap.enabled);status('Minimap toggled.');}
  else if(id==='dev-world-map'){G.minimap.toggleExpanded();status('World map toggled.');}
  else if(id==='dev-settings'){close();G.menu.setOpen(true);}
  else if(id==='dev-inventory'){close();G.input.invToggle=true;}
  else if(id==='dev-profiler-enable'){G.debug.setProfilingEnabled(true);$('dev-profiler-status').textContent='Enabled. Wait for 120 frames before reading p95.';status('Profiler enabled.');}
  else if(id==='dev-profiler-capture'){var snap=G.debug.captureRendererSnapshot('dev-manual-'+(G.debug.getRendererHistory().length+1));$('dev-profiler-status').textContent='Captured '+snap.timings.sampleCount+'/120 frames · '+(snap.fps||'--')+' FPS.';status('Profiler sample captured.');}
  else if(id==='dev-profiler-export')exportProfile();
  else if(id==='dev-copy-diagnostics'){if(!navigator.clipboard||!navigator.clipboard.writeText){status('Clipboard unavailable in this browser.',true);return;}
   var data=JSON.stringify({renderer:G.debug.rendererSnapshot('dev-copy'),checks:checksOut.textContent},null,2);
   navigator.clipboard.writeText(data).then(function(){status('Diagnostics copied.');}).catch(function(err){status('Clipboard denied: '+String(err&&err.message||err),true);});}
 }catch(err){status('QA action error: '+String(err&&err.message||err).slice(0,180),true);}
});
$('dev-close').addEventListener('click',close);
window.addEventListener('keydown',function(e){if(e.code==='Escape'&&!root.hidden){e.preventDefault();close();}});
$('menu-dev').addEventListener('click',function(){G.menu.setOpen(false);open();});
G.devMode={open:open,close:close,runChecks:checks,refresh:refresh,clearTestActors:clearActors,get isOpen(){return !root.hidden;}};
})();