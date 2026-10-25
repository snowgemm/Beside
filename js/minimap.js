(function () {
 var G=window.Game=window.Game||{},M=G.minimap={},SZ=110,H=55,cv,c,acc=0;
 function dot(x,y,r,col){c.fillStyle=col;c.fillRect(x-r,y-r,r*2,r*2);}
 function draw(){
  var P=G.player,p=P.pos,D=G.dungeon,run=D.active?D.run():null,s=run?1.7:1.2,i,j,e,list,r,a,b,d,x,y;
  c.clearRect(0,0,SZ,SZ);c.fillStyle='rgba(8,10,16,.55)';c.fillRect(0,0,SZ,SZ);
  if(run){var rooms=run.rooms;for(i=0;i<rooms.length;i++){r=rooms[i];if(i===run.cur)r.seen=true;if(i<rooms.length-1&&r.seen){b=rooms[i+1];c.fillStyle='#3a4256';c.fillRect(H+(r.x0+r.w-p.x)*s,H+(r.z0+r.t.outRows[0]-p.z)*s,(b.x0-r.x0-r.w)*s,Math.max(2,r.t.outRows.length*s));}}
   for(i=0;i<rooms.length;i++){r=rooms[i];c.fillStyle=i===run.cur?'#66789c':r.seen?'#3f4860':'#1d2232';c.fillRect(H+(r.x0-p.x)*s,H+(r.z0-p.z)*s,r.w*s,r.h*s);if(r.kind==='boss'){c.strokeStyle='#e04040';c.lineWidth=1.5;c.strokeRect(H+(r.x0-p.x)*s,H+(r.z0-p.z)*s,r.w*s,r.h*s);}for(j=0;j<r.doors.length;j++){d=r.doors[j];if(d.closed){c.fillStyle='#ff5a3a';c.fillRect(H+(d.cells[0][0]-p.x)*s-1,H+(d.cells[0][1]-p.z)*s,3,d.cells.length*s);}}}
   list=run.inter;for(i=0;i<list.length;i++){a=list[i];if(a.room){if(a.room.seen)dot(H+(a.x-p.x)*s,H+(a.z-p.z)*s,2.5,'#ffd34d');}else dot(H+(a.x-p.x)*s,H+(a.z-p.z)*s,3,'#7affea');}
  }else{c.strokeStyle='rgba(255,255,255,.25)';c.lineWidth=1;c.strokeRect(.5,.5,SZ-1,SZ-1);list=D.gateItems();for(i=0;i<list.length;i++){a=list[i];x=H+(a.x-p.x)*s;y=H+(a.z-p.z)*s;if(x>2&&x<SZ-2&&y>2&&y<SZ-2)dot(x,y,3.5,D.isCleared(a.key)?'#8affb0':'#7ac8ff');}list=G.loot.drops;for(i=0;i<list.length;i++){a=list[i];x=H+(a.x-p.x)*s;y=H+(a.z-p.z)*s;if(x>2&&x<SZ-2&&y>2&&y<SZ-2)dot(x,y,2,'#ffd34d');}}
  list=G.enemies.list;for(i=0;i<list.length;i++){e=list[i];if(e.dead)continue;x=H+(e.x-p.x)*s;y=H+(e.z-p.z)*s;if(x>1&&x<SZ-1&&y>1&&y<SZ-1)dot(x,y,e.type==='boss'?4:2,e.type==='boss'?'#ff2a8a':'#ff4a4a');}
  c.strokeStyle='#fff';c.lineWidth=2;c.beginPath();c.moveTo(H,H);c.lineTo(H-Math.sin(P.yaw)*9,H-Math.cos(P.yaw)*9);c.stroke();dot(H,H,3,'#fff');
 }
 M.init=function(){cv=document.createElement('canvas');cv.id='minimap';cv.width=cv.height=SZ;document.body.appendChild(cv);c=cv.getContext('2d');};
 M.enabled=true;M.setEnabled=function(on){M.enabled=!!on;if(cv)cv.style.display=on?'':'none';};
 M.update=function(dt){acc+=dt;if(acc<.1||!c||!M.enabled)return;acc=0;draw();};
})();