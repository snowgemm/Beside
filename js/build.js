(function () {
  var G = window.Game = window.Game || {};
  var B = G.build = { reach: 6, target: null }, W, scene, box, lastToast = 0, REACH = 6, NOGO = 8;
  var bb, bk, bp;
  function say(t) { var n = performance.now(); if (n - lastToast > 1200) { lastToast = n; G.toast(t, '#ffb0b0'); } }
  function canEdit() { return G.input.buildMode && !G.dungeon.active && !G.paused && !G.player.dead; }
  B.raycast = function (ox, oy, oz, dx, dy, dz, reach) {
    var x = Math.floor(ox), y = Math.floor(oy), z = Math.floor(oz), px = x, py = y, pz = z;
    var sx = dx > 0 ? 1 : -1, sy = dy > 0 ? 1 : -1, sz = dz > 0 ? 1 : -1;
    var tdx = dx ? Math.abs(1 / dx) : Infinity, tdy = dy ? Math.abs(1 / dy) : Infinity, tdz = dz ? Math.abs(1 / dz) : Infinity;
    var tx = dx ? ((dx > 0 ? x + 1 - ox : ox - x) * tdx) : Infinity, ty = dy ? ((dy > 0 ? y + 1 - oy : oy - y) * tdy) : Infinity, tz = dz ? ((dz > 0 ? z + 1 - oz : oz - z) * tdz) : Infinity;
    var t = 0, i; if (W.solid(x, y, z)) return null;
    for (i = 0; i < 64; i++) { px=x; py=y; pz=z;
      if (tx <= ty && tx <= tz) { x += sx; t=tx; tx += tdx; }
      else if (ty <= tz) { y += sy; t=ty; ty += tdy; }
      else { z += sz; t=tz; tz += tdz; }
      if (t > reach) return null;
      if (W.solid(x,y,z)) return {x:x,y:y,z:z,px:px,py:py,pz:pz};
    } return null;
  };
  function forbidden(x,z) { var sp=G.player.spawnPos,d=G.dungeon.gateItems(),i,dx,dz; x+=.5; z+=.5;
    if(sp){dx=x-sp.x;dz=z-sp.z;if(dx*dx+dz*dz<NOGO*NOGO)return true;}
    for(i=0;i<d.length;i++){dx=x-d[i].x;dz=z-d[i].z;if(dx*dx+dz*dz<NOGO*NOGO)return true;} return false;
  }
  function aim(){var P=G.player,p=P.pos,cp=Math.cos(P.pitch);return B.raycast(p.x,p.y+1.62+P.stepOff,p.z,-Math.sin(P.yaw)*cp,Math.sin(P.pitch),-Math.cos(P.yaw)*cp,REACH);}
  function result(r,snd){if(r==='ok'){G.audio.play(snd);G.save.request();}else if(r==='cap')say('Đã đạt giới hạn chỉnh sửa');}
  B.breakBlock=function(){if(!canEdit())return;var h=aim();if(!h)return;if(forbidden(h.x,h.z)){say('Không thể chỉnh sửa gần cổng hoặc điểm xuất hiện');return;}result(W.setColumn(h.x,h.z,W.getHeight(h.x,h.z)-1),'break');};
  B.placeBlock=function(){if(!canEdit())return;var h=aim();if(!h)return;if(forbidden(h.px,h.pz)){say('Không thể chỉnh sửa gần cổng hoặc điểm xuất hiện');return;}
    var col=W.getHeight(h.px,h.pz),p=G.player.pos;
    if(p.x+.3>h.px&&p.x-.3<h.px+1&&p.z+.3>h.pz&&p.z-.3<h.pz+1&&p.y+1.8>col&&p.y<col+1){say('Vướng người chơi');return;}
    result(W.setColumn(h.px,h.pz,col+1),'place');};
  B.setMode=function(on){on=!!on&&!G.dungeon.active;G.input.buildMode=on;document.body.classList.toggle('building',on);bb.classList.toggle('on',on);if(!on&&box)box.visible=false;};
  B.update=function(){if(!box)return;if(G.input.buildMode&&G.dungeon.active)B.setMode(false);if(!canEdit()){box.visible=false;B.target=null;return;}var h=aim();B.target=h;if(!h){box.visible=false;return;}box.position.set(h.x+.5,W.getHeight(h.x,h.z)-.5,h.z+.5);box.visible=true;};
  B.init=function(sc){W=G.world;scene=sc;box=new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(1.01,1.01,1.01)),new THREE.LineBasicMaterial({color:0xffffff,fog:false}));box.visible=false;box.frustumCulled=false;scene.add(box);
    bb=document.getElementById('btn-build');bk=document.getElementById('btn-break');bp=document.getElementById('btn-place');
    function tap(el,fn){el.addEventListener('touchstart',function(e){e.preventDefault();e.stopPropagation();fn();},{passive:false});el.addEventListener('click',function(){if(!G.input.isTouch)fn();});}
    tap(bb,function(){B.setMode(!G.input.buildMode);});tap(bk,B.breakBlock);tap(bp,B.placeBlock);
    window.addEventListener('keydown',function(e){if(e.code==='KeyB'&&!e.repeat)B.setMode(!G.input.buildMode);});
    var cv=document.querySelector('#game canvas');document.addEventListener('mousedown',function(e){if(!G.input.buildMode||document.pointerLockElement!==cv)return;if(e.button===0)B.breakBlock();else if(e.button===2)B.placeBlock();});
    document.addEventListener('contextmenu',function(e){if(G.input.buildMode)e.preventDefault();});
  };
})();