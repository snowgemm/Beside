(function () {
  var G = window.Game = window.Game || {};
  var CS = 16, SEA = 10, MAXH = 32, SEED = G.seed || 1337;
  var AIR = 0, GRASS = 1, SAND = 2, STONE = 3, SNOW = 4, WATER = 5;
  var TOP = { 1: [.36, .65, .25], 2: [.86, .79, .52], 3: [.5, .5, .53], 4: [.95, .97, 1] };
  var SIDE = { 1: [.46, .33, .2], 2: [.76, .68, .44], 3: [.4, .4, .43], 4: [.72, .78, .88] };
  function hash(x,z){var h=(Math.imul(x,374761393)+Math.imul(z,668265263)+Math.imul(SEED,1442695041))|0;h=Math.imul(h^(h>>>13),1274126177);h^=h>>>16;return(h>>>0)/4294967296;}
  function vnoise(x,z){var xi=Math.floor(x),zi=Math.floor(z),xf=x-xi,zf=z-zi,u=xf*xf*(3-2*xf),v=zf*zf*(3-2*zf),a=hash(xi,zi),b=hash(xi+1,zi),c=hash(xi,zi+1),d=hash(xi+1,zi+1);return a+(b-a)*u+(c-a)*v+(a-b-c+d)*u*v;}
  function fbm(x,z,o){var s=0,a=1,t=0,f=1;for(var i=0;i<o;i++){s+=vnoise(x*f,z*f)*a;t+=a;a*=.5;f*=2;}return s/t;}
  function baseHeight(x,z){var px=Math.floor(x)+.5,pz=Math.floor(z)+.5,n=fbm(px*.006,pz*.006,3),m=fbm(px*.03+50,pz*.03-70,4),h=12+(n-.5)*70+(m-.5)*14;return Math.max(1,Math.min(MAXH-1,Math.floor(h)));}
  var EMAX=20000,EMIN_H=1,EMAX_H=48,edits=new Map();
  function ek(x,z){return(x+1048576)*2097152+(z+1048576);}
  function getHeight(x,z){x=Math.floor(x);z=Math.floor(z);if(edits.size){var e=edits.get(ek(x,z));if(e!==undefined)return e;}return baseHeight(x,z);}
  function topType(h){return h<=SEA+1?SAND:h>=26?SNOW:h>=21?STONE:GRASS;}
  function getBlock(x,y,z){x=Math.floor(x);y=Math.floor(y);z=Math.floor(z);if(y<0)return STONE;var h=getHeight(x,z);if(y<h)return y===h-1?topType(h):STONE;return y<SEA?WATER:AIR;}
  function solid(x,y,z){var b=getBlock(x,y,z);return b>0&&b!==WATER;}
  var W=G.world={CS:CS,SEA:SEA,WATER:WATER,seed:SEED,drawDistance:5,getHeight:getHeight,getBlock:getBlock,solid:solid,held:false};
  W.ow={getHeight:getHeight,getBlock:getBlock,solid:solid};W.baseHeight=baseHeight;W.EDIT_MAX=EMAX;W.editCount=function(){return edits.size;};
  W.useProvider=function(p){p=p||W.ow;W.getHeight=p.getHeight;W.getBlock=p.getBlock;W.solid=p.solid;};
  W.hold=function(on){W.held=!!on;chunks.forEach(function(m){m.visible=!on;});if(water)water.visible=!on;if(!on)dirty=true;};
  var scene,material,water,chunks=new Map(),queue=[],qi=0,lcx=1e9,lcz=1e9,dirty=true;
  W.init=function(sc){scene=sc;material=new THREE.MeshBasicMaterial({vertexColors:true,fog:true});var g=new THREE.PlaneGeometry(2000,2000);g.rotateX(-Math.PI/2);water=new THREE.Mesh(g,new THREE.MeshBasicMaterial({color:0x2f6fd0,transparent:true,opacity:.62,depthWrite:false,side:THREE.DoubleSide,fog:true}));water.renderOrder=1;water.position.y=SEA-.12;scene.add(water);scene.fog=new THREE.Fog(0xa8d4ff,20,80);scene.background=new THREE.Color(0xa8d4ff);W.setDrawDistance(W.drawDistance);};
  W.setDrawDistance=function(n){W.drawDistance=n;var far=(n-.3)*CS;if(scene&&scene.fog&&!W.held){scene.fog.far=far;scene.fog.near=far*.45;}dirty=true;};
  W.setColumn=function(x,z,h){x=Math.floor(x);z=Math.floor(z);h=Math.max(EMIN_H,Math.min(EMAX_H,Math.floor(h)));var k=ek(x,z),cur=getHeight(x,z),b=baseHeight(x,z);if(h===cur)return'same';if(h===b)edits.delete(k);else{if(!edits.has(k)&&edits.size>=EMAX)return'cap';edits.set(k,h);}rebuildAround(x,z);return'ok';};
  W.serializeEdits=function(){var a=[];edits.forEach(function(h,k){a.push(Math.floor(k/2097152)-1048576,k%2097152-1048576,h);});return a;};
  W.loadEdits=function(a){edits.clear();if(!Array.isArray(a))return;for(var i=0;i+2<a.length&&edits.size<EMAX;i+=3){var x=a[i],z=a[i+1],h=a[i+2];if(!Number.isInteger(x)||!Number.isInteger(z)||!Number.isInteger(h)||Math.abs(x)>1000000||Math.abs(z)>1000000)continue;h=Math.max(EMIN_H,Math.min(EMAX_H,h));if(h!==baseHeight(x,z))edits.set(ek(x,z),h);}if(chunks.size)chunks.forEach(function(m){rebuildChunk(m.cx,m.cz);});};
  W.clearEdits=function(){var seen={},list=[];edits.forEach(function(h,k){var x=Math.floor(k/2097152)-1048576,z=k%2097152-1048576;for(var dx=-1;dx<=1;dx++)for(var dz=-1;dz<=1;dz++){var cx=Math.floor((x+dx)/CS),cz=Math.floor((z+dz)/CS),key=cx+','+cz;if(!seen[key]){seen[key]=1;list.push([cx,cz]);}}});edits.clear();list.forEach(function(c){rebuildChunk(c[0],c[1]);});};
  function rebuildChunk(cx,cz){var m=chunks.get(cx+','+cz);if(!m)return;scene.remove(m);m.geometry.dispose();chunks.delete(cx+','+cz);build(cx,cz);var n=chunks.get(cx+','+cz);if(n)n.visible=!W.held;}
  function rebuildAround(x,z){var cx=Math.floor(x/CS),cz=Math.floor(z/CS),lx=x-cx*CS,lz=z-cz*CS;rebuildChunk(cx,cz);if(lx===0)rebuildChunk(cx-1,cz);if(lx===CS-1)rebuildChunk(cx+1,cz);if(lz===0)rebuildChunk(cx,cz-1);if(lz===CS-1)rebuildChunk(cx,cz+1);}
  W.chunkCount=function(){return chunks.size;};
  function build(cx,cz){var N=18,H=new Int16Array(N*N),ox=cx*CS,oz=cz*CS,lx,lz;for(lz=-1;lz<=CS;lz++)for(lx=-1;lx<=CS;lx++)H[(lz+1)*N+lx+1]=getHeight(ox+lx,oz+lz);var pos=[],col=[],idx=[];
   function q(x0,y0,z0,x1,y1,z1,x2,y2,z2,x3,y3,z3,r,g,b){var base=pos.length/3;pos.push(x0,y0,z0,x1,y1,z1,x2,y2,z2,x3,y3,z3);col.push(r,g,b,r,g,b,r,g,b,r,g,b);idx.push(base,base+1,base+2,base,base+2,base+3);}
   for(lz=0;lz<CS;lz++)for(lx=0;lx<CS;lx++){var i=(lz+1)*N+lx+1,h=H[i],t=topType(h),v=.94+hash(ox+lx+9001,oz+lz-777)*.12,tc=TOP[t],sc=SIDE[t],x=lx,z=lz,nh,s;q(x,h,z,x,h,z+1,x+1,h,z+1,x+1,h,z,tc[0]*v,tc[1]*v,tc[2]*v);
    if((nh=H[i+1])<h){s=.8*v;q(x+1,nh,z+1,x+1,nh,z,x+1,h,z,x+1,h,z+1,sc[0]*s,sc[1]*s,sc[2]*s);}
    if((nh=H[i-1])<h){s=.62*v;q(x,nh,z,x,nh,z+1,x,h,z+1,x,h,z,sc[0]*s,sc[1]*s,sc[2]*s);}
    if((nh=H[i+N])<h){s=.88*v;q(x,nh,z+1,x+1,nh,z+1,x+1,h,z+1,x,h,z+1,sc[0]*s,sc[1]*s,sc[2]*s);}
    if((nh=H[i-N])<h){s=.7*v;q(x+1,nh,z,x,nh,z,x,h,z,x+1,h,z,sc[0]*s,sc[1]*s,sc[2]*s);}}
   var geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));geo.setAttribute('color',new THREE.Float32BufferAttribute(col,3));geo.setIndex(idx);var mesh=new THREE.Mesh(geo,material);mesh.position.set(ox,0,oz);mesh.matrixAutoUpdate=false;mesh.updateMatrix();mesh.cx=cx;mesh.cz=cz;scene.add(mesh);chunks.set(cx+','+cz,mesh);if(W.onChunkLoad)W.onChunkLoad(cx,cz);}
  function plan(pcx,pcz){var R=W.drawDistance,r2=R*R+1,ur=(R+1)*(R+1)+1,dx,dz;chunks.forEach(function(m,k){var ax=m.cx-pcx,az=m.cz-pcz;if(ax*ax+az*az>ur){scene.remove(m);m.geometry.dispose();chunks.delete(k);if(W.onChunkUnload)W.onChunkUnload(m.cx,m.cz);}});queue=[];qi=0;for(dx=-R;dx<=R;dx++)for(dz=-R;dz<=R;dz++){var d2=dx*dx+dz*dz;if(d2<=r2&&!chunks.has((pcx+dx)+','+(pcz+dz)))queue.push({cx:pcx+dx,cz:pcz+dz,d:d2});}queue.sort(function(a,b){return a.d-b.d;});}
  function process(budget){var t0=performance.now();while(qi<queue.length){var c=queue[qi++];if(!chunks.has(c.cx+','+c.cz))build(c.cx,c.cz);if(performance.now()-t0>=budget)break;}}
  W.preload=function(px,pz,r){var old=W.drawDistance;W.drawDistance=r;plan(Math.floor(px/CS),Math.floor(pz/CS));process(1e9);W.drawDistance=old;dirty=true;};
  W.update=function(px,pz,budgetMs){if(W.held)return;var pcx=Math.floor(px/CS),pcz=Math.floor(pz/CS);if(dirty||pcx!==lcx||pcz!==lcz){lcx=pcx;lcz=pcz;dirty=false;plan(pcx,pcz);}process(budgetMs);water.position.x=px;water.position.z=pz;};
  W.findSpawn=function(){for(var r=0;r<400;r+=6){var n=r===0?1:Math.ceil(r*.8);for(var k=0;k<n;k++){var a=k/n*Math.PI*2,x=Math.round(Math.cos(a)*r),z=Math.round(Math.sin(a)*r),h=baseHeight(x,z);if(h<SEA+2||h>SEA+6)continue;var ok=true,d=[[3,0],[-3,0],[0,3],[0,-3]];for(var j=0;j<4;j++){var h2=baseHeight(x+d[j][0],z+d[j][1]);if(h2<SEA+1||h2>h+3)ok=false;}if(ok)return{x:x+.5,y:h,z:z+.5};}}return{x:.5,y:baseHeight(0,0)+1,z:.5};};
  G.save.register('edits',function(){return W.serializeEdits();},function(a){W.loadEdits(a);});
})();