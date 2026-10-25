(function () {
  var G = window.Game = window.Game || {};
  var MAX = 20, AI_RANGE = 40, SAFE = 20;
  var TYPES = {
    slime: { weight: 45, hp: 30, speed: 2.8, damage: 8, aggro: 12, attackRange: 1, radius: 0.5, height: 0.9,
      parts: [[.9,.8,.9,0,.4,0,0x4cc94c],[.14,.14,.05,-.2,.55,-.46,0x113311],[.14,.14,.05,.2,.55,-.46,0x113311]] },
    goblin: { weight: 35, hp: 45, speed: 3.6, damage: 14, aggro: 16, attackRange: 1.7, radius: 0.4, height: 1.5,
      parts: [[.5,.6,.3,0,.7,0,0x6a8f3a],[.4,.4,.4,0,1.2,0,0x7fa84a],[.2,.55,.2,-.35,.75,0,0x6a8f3a],[.2,.55,.2,.35,.75,0,0x6a8f3a,1],[.2,.4,.2,-.12,.2,0,0x4a3a22],[.2,.4,.2,.12,.2,0,0x4a3a22]] },
    archer: { weight: 20, hp: 30, speed: 3, damage: 10, aggro: 22, attackRange: 14, keep: 8, radius: 0.4, height: 1.6,
      parts: [[.5,.7,.3,0,.75,0,0x8a5a2a],[.4,.4,.4,0,1.3,0,0xd8a878],[.1,.9,.1,.4,.8,-.15,0x5a3a1a],[.2,.4,.2,-.12,.2,0,0x3a2a1a],[.2,.4,.2,.12,.2,0,0x3a2a1a]] }
  };
  var E = G.enemies = { list: [], types: TYPES };
  var W, scene, cam, byChunk = {}, projs = [], geoC = {}, matC = {};
  var flashMat, teleMat, barGeo, barBgMat, barFillMat, projGeo, projMat;
  function geo(w,h,d) { var k=w+','+h+','+d; return geoC[k] || (geoC[k]=new THREE.BoxGeometry(w,h,d)); }
  function mat(c) { return matC[c] || (matC[c]=new THREE.MeshBasicMaterial({color:c})); }
  function rng(seed) { return function(){ seed|=0; seed=seed+0x6D2B79F5|0; var t=Math.imul(seed^seed>>>15,1|seed); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }; }
  E.init = function(sc,camera) {
    W=G.world; scene=sc; cam=camera;
    flashMat=new THREE.MeshBasicMaterial({color:0xffffff}); teleMat=new THREE.MeshBasicMaterial({color:0xff5522});
    barGeo=new THREE.PlaneGeometry(1,.1); barGeo.translate(.5,0,0);
    barBgMat=new THREE.MeshBasicMaterial({color:0x222222,fog:false}); barFillMat=new THREE.MeshBasicMaterial({color:0xdd3333,fog:false});
    projGeo=new THREE.BoxGeometry(.22,.22,.22); projMat=new THREE.MeshBasicMaterial({color:0xffdd44});
    W.onChunkLoad=onLoad; W.onChunkUnload=onUnload;
  };
  function spawn(name,x,y,z,overrideDef) {
    var def=overrideDef||TYPES[name],g=new THREE.Group(),meshes=[];
    def.parts.forEach(function(p){ var m=new THREE.Mesh(geo(p[0],p[1],p[2]),mat(p[6])); m.position.set(p[3],p[4],p[5]); m.userData.base=m.material; if(p[7])m.userData.arm=true; g.add(m); meshes.push(m); });
    g.position.set(x,y,z); scene.add(g);
    var e={type:name,def:def,x:x,y:y,z:z,hp:def.hp,group:g,meshes:meshes,state:'idle',t:Math.random()*2,hop:0,hopY:0,dirx:0,dirz:0,walking:false,kx:0,kz:0,flash:0,alerted:false,dead:false,deathT:0,bar:null,cd:1+Math.random()};
    E.list.push(e); return e;
  }
  E.spawn = spawn;
  E.clear = function () { var a=E.list.slice(); for(var i=0;i<a.length;i++) removeEnemy(a[i]); E.list.length=0; };
  E.swap = function (next) {
    if(next===null){var old=E.list;old.forEach(function(e){e.group.visible=false;if(e.bar)e.bar.visible=false;});E.list.length=0;return old;}
    E.clear();E.list=Array.isArray(next)?next:[];E.list.forEach(function(e){e.group.visible=true;if(e.bar)e.bar.visible=true;});return E.list;
  };
  function removeEnemy(e) { scene.remove(e.group); if(e.bar)scene.remove(e.bar); var i=E.list.indexOf(e); if(i>=0)E.list.splice(i,1); }
  function onLoad(cx,cz) {
    var k=cx+','+cz; if(byChunk[k])return;
    var r=rng((Math.imul(cx,73856093)^Math.imul(cz,19349663)^0x5bd1e995)>>>0),n=Math.floor(r()*4);
    var ccx=cx*16+2+r()*12,ccz=cz*16+2+r()*12,names=Object.keys(TYPES),total=0,i,j;
    for(i=0;i<names.length;i++)total+=TYPES[names[i]].weight;
    var sp=G.player.spawnPos,arr=[];
    for(i=0;i<n;i++){
      var pick=r()*total,x=ccx+(r()-.5)*6,z=ccz+(r()-.5)*6,name=names[0];
      for(j=0;j<names.length;j++){pick-=TYPES[names[j]].weight;if(pick<=0){name=names[j];break;}}
      if(E.list.length>=MAX)continue;
      var h=W.getHeight(x,z);
      if(h<W.SEA+1)continue;
      if(sp&&Math.sqrt((x-sp.x)*(x-sp.x)+(z-sp.z)*(z-sp.z))<SAFE)continue;
      arr.push(spawn(name,x,h,z));
    }
    byChunk[k]=arr;
  }
  function onUnload(cx,cz){var k=cx+','+cz,arr=byChunk[k];if(!arr)return;for(var i=0;i<arr.length;i++)removeEnemy(arr[i]);delete byChunk[k];}
  function setMat(e,m){for(var i=0;i<e.meshes.length;i++)e.meshes[i].material=m;}
  function restore(e){if(e.state==='wind'){setMat(e,teleMat);return;}for(var i=0;i<e.meshes.length;i++)e.meshes[i].material=e.meshes[i].userData.base;}
  function tele(e){e.state='wind';setMat(e,teleMat);e.group.scale.setScalar(1.12);for(var i=0;i<e.meshes.length;i++)if(e.meshes[i].userData.arm)e.meshes[i].rotation.x=-2.4;}
  function endTele(e){e.group.scale.setScalar(1);for(var i=0;i<e.meshes.length;i++)if(e.meshes[i].userData.arm)e.meshes[i].rotation.x=0;restore(e);}
  function canStand(e,x,z){var h=W.getHeight(x,z);return h>=W.SEA&&h-e.y<=1.01;}
  function step(e,dx,dz){if(canStand(e,e.x+dx,e.z+dz)){e.x+=dx;e.z+=dz;return;}if(dx&&canStand(e,e.x+dx,e.z))e.x+=dx;else if(dz&&canStand(e,e.x,e.z+dz))e.z+=dz;}
  function face(e,dx,dz){e.group.rotation.y=Math.atan2(-dx,-dz);}
  function wander(e,dt,speed){e.t-=dt;if(e.t<=0){if(e.walking){e.walking=false;e.t=1+Math.random()*2;}else{e.walking=true;e.t=1+Math.random()*1.5;var a=Math.random()*6.283;e.dirx=Math.cos(a);e.dirz=Math.sin(a);}}if(e.walking){step(e,e.dirx*speed*dt,e.dirz*speed*dt);face(e,e.dirx,e.dirz);}}
  function ensureBar(e){if(e.bar)return;var b=new THREE.Group(),bg=new THREE.Mesh(barGeo,barBgMat),f=new THREE.Mesh(barGeo,barFillMat);bg.position.x=-.54;bg.scale.set(1.08,1.6,1);f.position.set(-.5,0,.01);b.add(bg,f);b.userData.fill=f;scene.add(b);e.bar=b;}
  function fire(e,px,py,pz){var ox=e.x,oy=e.y+1.2,oz=e.z,tx=px-ox,ty=py+1-oy,tz=pz-oz,l=Math.sqrt(tx*tx+ty*ty+tz*tz)||1,s=9/l,m=new THREE.Mesh(projGeo,projMat);m.position.set(ox,oy,oz);scene.add(m);projs.push({m:m,x:ox,y:oy,z:oz,vx:tx*s,vy:ty*s,vz:tz*s,t:0,dmg:e.def.damage});G.audio.play('swing');}
  E.hurt=function(e,dmg,kx,kz){
    if(e.dead)return;e.hp-=dmg;e.flash=.12;e.alerted=true;e.kx=kx;e.kz=kz;setMat(e,flashMat);
    G.combat.number(e.x,e.y+e.def.height+.4,e.z,dmg,'#ffffff');ensureBar(e);
    if(e.hp<=0){e.dead=true;e.deathT=0;e.bar.visible=false;G.audio.play('death');G.events.emit('enemyDied',{type:e.type,x:e.x,y:e.y,z:e.z});}else G.audio.play('hit');
  };
  function ai(e,dt,dx,dz,d,px,py,pz){
    var def=e.def,C=G.combat,ux=dx/(d||1),uz=dz/(d||1),agg;
    if(d>def.aggro*1.6)e.alerted=false;agg=e.alerted||d<def.aggro;
    if(e.type==='slime'){
      e.t-=dt;
      if(e.hop>0){e.hop-=dt;step(e,e.dirx*def.speed*1.6*dt,e.dirz*def.speed*1.6*dt);e.hopY=Math.sin(Math.PI*(1-e.hop/.5))*.9;if(e.hop<=0)e.hopY=0;}
      else if(e.t<=0){if(agg){e.dirx=ux;e.dirz=uz;e.hop=.5;e.t=.9;}else{var a=Math.random()*6.283;e.dirx=Math.cos(a);e.dirz=Math.sin(a);e.hop=.5;e.t=1.5+Math.random()*2;}face(e,e.dirx,e.dirz);}
      e.group.scale.y=e.hop>0?1.15:.9;
      if(d<.95&&Math.abs(py-(e.y+e.hopY))<1.4)C.hurtPlayer(def.damage,e.x,e.z);
    }else if(e.type==='goblin'){
      if(e.state==='wind'){face(e,dx,dz);e.t-=dt;if(e.t<=0){if(d<def.attackRange+.7&&Math.abs(py-e.y)<2)C.hurtPlayer(def.damage,e.x,e.z);G.audio.play('swing');e.state='recover';e.t=.7;endTele(e);}}
      else if(e.state==='recover'){e.t-=dt;if(e.t<=0)e.state='idle';}
      else if(agg){face(e,dx,dz);if(d>def.attackRange)step(e,ux*def.speed*dt,uz*def.speed*dt);else{e.t=.5;tele(e);}}
      else wander(e,dt,def.speed*.4);
    }else{
      if(e.state==='wind'){face(e,dx,dz);e.t-=dt;if(e.t<=0){fire(e,px,py,pz);e.state='idle';e.cd=2.4;endTele(e);}}
      else if(agg){face(e,dx,dz);e.cd-=dt;if(d<6)step(e,-ux*def.speed*dt,-uz*def.speed*dt);else if(d>def.keep+4)step(e,ux*def.speed*dt,uz*def.speed*dt);if(e.cd<=0&&d<=def.attackRange&&d>2){e.t=.6;tele(e);}}
      else wander(e,dt,def.speed*.4);
    }
  }
  E.update=function(dt,px,py,pz){
    var list=E.list,i;
    for(i=list.length-1;i>=0;i--){
      var e=list[i];
      if(e.dead){e.deathT+=dt;if(e.deathT>=.35){removeEnemy(e);continue;}var s=e.deathT<.1?1+e.deathT/.1*.25:1.25*(1-(e.deathT-.1)/.25);e.group.scale.setScalar(Math.max(0,s));continue;}
      var dx=px-e.x,dz=pz-e.z,d=Math.sqrt(dx*dx+dz*dz);if(typeof e.update==='function'){e.update(e,dt,dx,dz,d,px,py,pz);continue;}if(d>AI_RANGE)continue;
      if(e.flash>0){e.flash-=dt;if(e.flash<=0)restore(e);}
      if(e.kx||e.kz){step(e,e.kx*dt,e.kz*dt);var kd=Math.exp(-8*dt);e.kx*=kd;e.kz*=kd;if(Math.abs(e.kx)+Math.abs(e.kz)<.05)e.kx=e.kz=0;}
      ai(e,dt,dx,dz,d,px,py,pz);
      var gh=W.getHeight(e.x,e.z);e.y=gh>=e.y?gh:Math.max(gh,e.y-14*dt);e.group.position.set(e.x,e.y+e.hopY,e.z);
      if(e.bar){e.bar.position.set(e.x,e.y+e.def.height+.55,e.z);e.bar.quaternion.copy(cam.quaternion);e.bar.userData.fill.scale.x=Math.max(.001,e.hp/e.def.hp);}
    }
    for(i=projs.length-1;i>=0;i--){
      var q=projs[i];q.t+=dt;q.x+=q.vx*dt;q.y+=q.vy*dt;q.z+=q.vz*dt;q.m.position.set(q.x,q.y,q.z);
      var kill=q.t>3.5||W.solid(q.x,q.y,q.z);
      if(!kill){var ex=q.x-px,ez=q.z-pz;if(ex*ex+ez*ez<.36&&Math.abs(q.y-(py+.9))<1){if(G.combat.hurtPlayer(q.dmg,q.x-q.vx*.1,q.z-q.vz*.1))kill=true;}}
      if(kill){scene.remove(q.m);projs.splice(i,1);}
    }
  };
})();