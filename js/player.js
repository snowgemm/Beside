(function () {
  var G = window.Game = window.Game || {};
  var HW = 0.3, HH = 1.8, E = 1e-4;
  var P = G.player = { pos: { x: 0, y: 0, z: 0 }, vel: { x: 0, y: 0, z: 0 }, yaw: 0, pitch: 0, onGround: false, inWater: false, third: true, camDist: 6.5, stepOff: 0,
    health: 100, maxHealth: 100, weapon: { damage: 10, reach: 2.2, cooldown: 0.4 }, dead: false, rollT: 0, rollDir: { x: 0, z: 0 }, kb: { x: 0, z: 0 }, shake: 0, swingT: 0, iframes: 0,
    equip: { weapon: null, armor: null, trinket: null }, dr: 0, crit: 0.05, speedMult: 1 };
  var W, cam, scn, rig, curW, spawn, wasGround = false, lastSwing = 0, lastHp = -1, wasDead = false;
  function weaponKind(w) {
    var n = (w && w.name) || '';
    return n.indexOf('Rìu') === 0 ? 'axe' : n.indexOf('Dao') === 0 ? 'dagger' : n.indexOf('Giáo') === 0 ? 'spear' : 'sword';
  }
  P.makeSpec = function (w) {
    var S = G.rig.part, R = w && G.items && G.items.RARITIES[w.rarity], hx = R ? R.hex : 0xb8b8b8, tn = 0x3a6fd8, k = weaponKind(w);
    var parts = [
      S('legL', null, [.2,.5,.2], [0,-.25,0], [-.13,.5,0], 0x35406a, {color2:0x3b2a20}), S('legR', null, [.2,.5,.2], [0,-.25,0], [.13,.5,0], 0x35406a, {color2:0x3b2a20}),
      S('torso', null, [.5,.5,.3], [0,.25,0], [0,.5,0], tn), S('head','torso',[.7,.7,.7],[0,.35,0],[0,.5,0],0xf0c09a),
      S('hair','head',[.76,.28,.76],[0,0,0],[0,.6,0],0x5a3a22),
      S('eyeL','head',[.1,.14,.04],[0,0,0],[-.17,.36,-.355],0x1a1a2a,{flat:true}), S('eyeR','head',[.1,.14,.04],[0,0,0],[.17,.36,-.355],0x1a1a2a,{flat:true}),
      S('armL','torso',[.15,.45,.15],[0,-.2,0],[-.33,.45,0],tn), S('armR','torso',[.15,.45,.15],[0,-.2,0],[.33,.45,0],tn)];
    if (w) {
      parts.push(S('hand','armR',null,null,[0,-.4,0],0,{rot:[.8,0,0]}));
      if (k==='axe') parts.push(S('wShaft','hand',[.07,.7,.07],[0,-.25,0],[0,0,0],0x6a4a22),S('wHead','hand',[.3,.24,.07],[.15,-.55,0],[0,0,0],hx));
      else if (k==='dagger') parts.push(S('wHilt','hand',[.06,.14,.06],[0,-.03,0],[0,0,0],0x6a4a22),S('wBlade','hand',[.07,.32,.03],[0,-.27,0],[0,0,0],hx));
      else if (k==='spear') parts.push(S('wShaft','hand',[.05,1,.05],[0,-.35,0],[0,0,0],0x6a4a22),S('wTip','hand',[.1,.22,.1],[0,-.95,0],[0,0,0],hx));
      else parts.push(S('wHilt','hand',[.06,.2,.06],[0,-.05,0],[0,0,0],0x6a4a22),S('wGuard','hand',[.22,.05,.09],[0,-.16,0],[0,0,0],0xd8b84a),S('wBlade','hand',[.09,.6,.04],[0,-.48,0],[0,0,0],hx));
    }
    return {height:1.7,parts:parts};
  };
  function mkRig() {
    if (rig) rig.dispose();
    curW=P.equip.weapon; rig=G.rig.build(P.makeSpec(curW)); scn.add(rig.group); rig.group.visible=false;
    if (P.dead) rig.play('death',{keep:true});
  }
  function collides(x,y,z) {
    var x0=Math.floor(x-HW+E),x1=Math.floor(x+HW-E),y0=Math.floor(y+E),y1=Math.floor(y+HH-E),z0=Math.floor(z-HW+E),z1=Math.floor(z+HW-E);
    for(var ix=x0;ix<=x1;ix++)for(var iz=z0;iz<=z1;iz++)for(var iy=y0;iy<=y1;iy++)if(W.solid(ix,iy,iz))return true;
    return false;
  }
  function moveH(ax,d) {
    var p=P.pos,n=Math.max(1,Math.ceil(Math.abs(d)/.3)),s=d/n;
    for(var i=0;i<n;i++){var o=p[ax];p[ax]=o+s;if(collides(p.x,p.y,p.z)){if(wasGround&&!collides(p.x,p.y+1,p.z)){p.y+=1;P.stepOff-=1;}else{p[ax]=o;P.vel[ax]=0;return;}}}
  }
  function moveV(d) {
    var p=P.pos,n=Math.max(1,Math.ceil(Math.abs(d)/.3)),s=d/n;
    for(var i=0;i<n;i++){var o=p.y,ny=o+s;p.y=ny;if(collides(p.x,p.y,p.z)){if(d<0){p.y=Math.floor(ny+E)+1;P.onGround=true;}else p.y=Math.floor(ny+HH-E)-HH;P.vel.y=0;return;}}
  }
  function clamp(v,a,b){return v<a?a:v>b?b:v;}
  P.init=function(scene,camera,sp){W=G.world;cam=camera;spawn=sp;P.spawnPos=sp;cam.rotation.order='YXZ';scn=scene;mkRig();P.respawn();};
  P.respawn=function(){var s=(G.dungeon&&G.dungeon.respawnPoint&&G.dungeon.respawnPoint())||spawn;P.pos.x=s.x;P.pos.y=s.y+.001;P.pos.z=s.z;P.vel.x=P.vel.y=P.vel.z=0;P.kb.x=P.kb.z=0;P.rollT=0;P.swingT=0;};
  P.recalc=function(){var e=P.equip,w=e.weapon&&e.weapon.stats,a=e.armor&&e.armor.stats,t=e.trinket&&e.trinket.stats;P.weapon.damage=w?w.damage:10;P.weapon.reach=w?w.reach:2.2;P.weapon.cooldown=.4*(w?w.cdMult:1);P.maxHealth=100+((a&&a.hp)||0)+((t&&t.hp)||0);P.dr=Math.min(.6,(a&&a.dr)||0);P.speedMult=1+((t&&t.speed)||0);P.crit=.05+((t&&t.crit)||0);if(P.health>P.maxHealth)P.health=P.maxHealth;};
  P.update=function(dt){
    var I=G.input,p=P.pos,v=P.vel;I.poll();if(P.dead){I.moveX=I.moveZ=0;I.jump=false;}
    P.yaw-=I.lookDX;P.pitch=clamp(P.pitch-I.lookDY,-1.45,1.45);I.lookDX=I.lookDY=0;if(I.viewToggle){P.third=!P.third;I.viewToggle=false;}
    wasGround=P.onGround;P.inWater=W.getBlock(p.x,p.y+.4,p.z)===W.WATER;
    var sy=Math.sin(P.yaw),cy=Math.cos(P.yaw),wx=-sy*I.moveZ+cy*I.moveX,wz=-cy*I.moveZ-sy*I.moveX,l=Math.hypot(wx,wz);
    if(l>1){wx/=l;wz/=l;}var sp=(P.inWater?2.6:5.4)*P.speedMult,k=Math.min(1,(P.onGround||P.inWater?12:4)*dt);
    if(P.rollT>0){P.rollT-=dt;v.x=P.rollDir.x*11;v.z=P.rollDir.z*11;}else{v.x+=(wx*sp-v.x)*k;v.z+=(wz*sp-v.z)*k;}
    if(P.inWater){v.y-=8*dt;if(I.jump)v.y+=20*dt;v.y-=v.y*Math.min(1,3*dt);}else{v.y=Math.max(-35,v.y-28*dt);if(I.jump&&P.onGround)v.y=9;}
    P.onGround=false;moveH('x',(v.x+P.kb.x)*dt);moveH('z',(v.z+P.kb.z)*dt);moveV(v.y*dt);
    var kd=Math.exp(-9*dt);P.kb.x*=kd;P.kb.z*=kd;if(p.y<-30)P.respawn();P.stepOff-=P.stepOff*Math.min(1,10*dt);
    var cp=Math.cos(P.pitch),dx=-sy*cp,dy=Math.sin(P.pitch),dz=-cy*cp;cam.rotation.set(P.pitch,P.yaw,0);
    if(!P.third)cam.position.set(p.x,p.y+1.62+P.stepOff,p.z);
    else {var hx=p.x,hy=p.y+1.6+P.stepOff,hz=p.z,dist=clamp(P.camDist||6.5,2.5,12);for(var t=.25;t<=dist+.25;t+=.1){if(W.solid(hx-dx*t,hy-dy*t,hz-dz*t)){dist=Math.max(.3,t-.25);break;}}cam.position.set(hx-dx*dist,hy-dy*dist,hz-dz*dist);}
    if(P.shake>.001){cam.position.x+=(Math.random()-.5)*P.shake;cam.position.y+=(Math.random()-.5)*P.shake;P.shake*=Math.max(0,1-12*dt);}
    var hs=Math.hypot(v.x,v.z);if(P.equip.weapon!==curW)mkRig();
    if(P.dead&&!wasDead)rig.play('death',{keep:true});else if(!P.dead&&wasDead)rig.play('idle');wasDead=P.dead;
    if(!P.dead&&P.health<lastHp)rig.play('hurt');lastHp=P.health;
    if(P.swingT>lastSwing)rig.play('attack',{dur:.32,windup:.15});if(P.swingT>0)P.swingT-=dt;lastSwing=P.swingT;
    rig.tiltX=P.rollT>0?-6.283*(1-P.rollT/.35):0;rig.group.visible=P.third;
    if(P.third){rig.group.position.set(p.x,p.y+P.stepOff,p.z);rig.group.rotation.y=P.yaw;rig.update(dt,P.onGround||P.inWater?hs:0);}
  };
})();