(function () {
  var G = window.Game = window.Game || {};
  G.config = G.config || {};
  if (typeof G.config.legacyTerrain !== 'boolean') G.config.legacyTerrain = true;
  var CS = 16, SEA = 10, MAXH = 32, SEED = G.seed || 1337;
  var AIR = 0, GRASS = 1, SAND = 2, STONE = 3, SNOW = 4, WATER = 5;

  /* ---------- biomes: palettes (index = meadow, forest, desert, snow, autumn) ---------- */
  var BN = ['meadow', 'forest', 'desert', 'snow', 'autumn'];
  var BC = [[.55, .5], [.5, .85], [.88, .15], [.12, .5], [.3, .2]]; // (temperature, moisture) centres
  var BTOP = [[.38, .72, .26], [.2, .5, .2], [.9, .78, .45], [.95, .97, 1], [.8, .5, .18]];
  var BSIDE = [[.5, .36, .22], [.4, .3, .18], [.8, .62, .36], [.62, .66, .74], [.48, .32, .18]];
  var BSA = [[.52, .52, .55], [.44, .46, .44], [.74, .52, .34], [.52, .56, .64], [.52, .46, .42]]; // strata A
  var BSB = [[.43, .43, .47], [.37, .39, .38], [.62, .42, .28], [.43, .47, .56], [.43, .38, .36]]; // strata B
  var SANDC = [.88, .8, .5], SNOWC = [.95, .97, 1];

  function hash(x, z) {
    var h = (Math.imul(x, 374761393) + Math.imul(z, 668265263) + Math.imul(SEED, 1442695041)) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  }
  function vnoise(x, z) {
    var xi = Math.floor(x), zi = Math.floor(z), xf = x - xi, zf = z - zi;
    var u = xf * xf * (3 - 2 * xf), v = zf * zf * (3 - 2 * zf);
    var a = hash(xi, zi), b = hash(xi + 1, zi), c = hash(xi, zi + 1), d = hash(xi + 1, zi + 1);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  }
  function fbm(x, z, o) {
    var s = 0, a = 1, t = 0, f = 1;
    for (var i = 0; i < o; i++) { s += vnoise(x * f, z * f) * a; t += a; a *= 0.5; f *= 2; }
    return s / t;
  }
  function baseHeight(x, z) {
    var px = Math.floor(x) + 0.5, pz = Math.floor(z) + 0.5;
    var n = fbm(px * 0.006, pz * 0.006, 3), m = fbm(px * 0.03 + 50, pz * 0.03 - 70, 4);
    var h = 13 + (n - 0.5) * 35 + (m - 0.5) * 6;
    return Math.max(3, Math.min(MAXH - 3, h));
  }
  /* ---------- edit layer: sparse column (x,z) -> height over the heightmap ---------- */
  var EMAX = 20000, EMIN_H = 1, EMAX_H = 48, edits = new Map();
  function ek(x, z) { return (x + 1048576) * 2097152 + (z + 1048576); }
  function getHeight(x, z) {
    x = Math.floor(x); z = Math.floor(z);
    if (edits.size) { var e = edits.get(ek(x, z)); if (e !== undefined) return e; }
    return baseHeight(x, z);
  }
  // Exact height on the same triangle split used by build(); this keeps collision and the visible surface aligned.
  function surfaceHeight(x,z) {
    var ix=Math.floor(x),iz=Math.floor(z),fx=x-ix,fz=z-iz;
    var h00=getHeight(ix,iz),h10=getHeight(ix+1,iz),h01=getHeight(ix,iz+1),h11=getHeight(ix+1,iz+1);
    if(hash(ix,iz)>.5){
      if(fz>=fx)return h00*(1-fz)+h01*(fz-fx)+h11*fx;
      return h00*(1-fx)+h10*(fx-fz)+h11*fz;
    }
    if(fx+fz<=1)return h00*(1-fx-fz)+h10*fx+h01*fz;
    return h10*(1-fz)+h01*(1-fx)+h11*(fx+fz-1);
  }
  function topType(h) { return h <= SEA + 1 ? SAND : h >= 26 ? SNOW : h >= 21 ? STONE : GRASS; }
  function getBlock(x, y, z) {
    x = Math.floor(x); y = Math.floor(y); z = Math.floor(z);
    if (y < 0) return STONE;
    var h = getHeight(x, z);
    if (y < h) return y === Math.floor(h) ? topType(h) : STONE;
    return y < SEA ? WATER : AIR;
  }
  function solid(x, y, z) { var b = getBlock(x, y, z); return b > 0 && b !== WATER; }

  /* ---------- biome weights + column colours (visual only) ---------- */
  var BW = new Float32Array(5);
  function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
  function ss(a, b, v) { var k = clamp01((v - a) / (b - a)); return k * k * (3 - 2 * k); }
  // fills BW with normalised weights, returns index of the dominant biome
  function biomeW(x, z) {
    var t = clamp01((fbm(x * 0.004 + 200, z * 0.004 + 300, 2) - 0.5) * 2.4 + 0.5);
    var m = clamp01((fbm(x * 0.004 - 400, z * 0.004 + 100, 2) - 0.5) * 2.4 + 0.5);
    var s = 0, i, dt, dm, best = 0;
    for (i = 0; i < 5; i++) { dt = t - BC[i][0]; dm = m - BC[i][1]; BW[i] = Math.exp(-(dt * dt + dm * dm) / 0.04); s += BW[i]; }
    for (i = 0; i < 5; i++) { BW[i] /= s; if (BW[i] > BW[best]) best = i; }
    return best;
  }
  var CT = [0, 0, 0], CSd = [0, 0, 0], CA = [0, 0, 0], CB = [0, 0, 0];
  function columnColors(x, z, h) { // uses BW from the last biomeW call
    var i, j, w, k, d;
    for (j = 0; j < 3; j++) CT[j] = CSd[j] = CA[j] = CB[j] = 0;
    for (i = 0; i < 5; i++) {
      w = BW[i];
      for (j = 0; j < 3; j++) { CT[j] += BTOP[i][j] * w; CSd[j] += BSIDE[i][j] * w; CA[j] += BSA[i][j] * w; CB[j] += BSB[i][j] * w; }
    }
    var hj = h + (hash(x + 313, z - 171) - 0.5) * 1.6;
    k = ss(19.5, 22, hj);
    if (k > 0) for (j = 0; j < 3; j++) { CT[j] += (CA[j] - CT[j]) * k; CSd[j] += (CA[j] - CSd[j]) * k; }
    k = ss(24.5, 26.5, hj);
    if (k > 0) for (j = 0; j < 3; j++) CT[j] += (SNOWC[j] - CT[j]) * k;
    if (h <= SEA + 1) for (j = 0; j < 3; j++) { CT[j] = SANDC[j]; CSd[j] = SANDC[j] * 0.86; }
    if (h < SEA) { // shallow floor stays light, deeper floor goes blue and dark
      d = SEA - h; k = Math.min(d * 0.08, 0.55);
      CT[0] += (.2 - CT[0]) * k; CT[1] += (.4 - CT[1]) * k; CT[2] += (.56 - CT[2]) * k;
      CSd[0] += (.2 - CSd[0]) * k; CSd[1] += (.4 - CSd[1]) * k; CSd[2] += (.56 - CSd[2]) * k;
    }
  }

  var W = G.world = { CS: CS, SEA: SEA, WATER: WATER, seed: SEED, drawDistance: 5, getHeight: getHeight, getBlock: getBlock, solid: solid, held: false };
  W.ow = { getHeight: getHeight, getBlock: getBlock, solid: solid };
  W.baseHeight = baseHeight; // unedited terrain (gate / spawn placement)
  W.biome = function (x, z) { return BN[biomeW(Math.floor(x) + 0.5, Math.floor(z) + 0.5)]; };
  W.topColor = function (x, z) { // overworld top colour of a column as 0xRRGGBB (particles)
    x = Math.floor(x); z = Math.floor(z);
    biomeW(x + 0.5, z + 0.5); columnColors(x, z, getHeight(x, z));
    return ((CT[0] * 255) << 16) | ((CT[1] * 255) << 8) | (CT[2] * 255);
  };
  W.surfaceHeight=surfaceHeight; W.isSolid=solid; W.setViewDistance=function(n){W.setDrawDistance(n);}; W.decorBlockers=function(){return null;};
  W.EDIT_MAX = EMAX;
  W.editCount = function () { return edits.size; };
  // swap collision/height provider (null = overworld); hold(true) hides the overworld and pauses chunk streaming
  W.useProvider = function (p) { p = p || W.ow; W.getHeight = p.getHeight; W.getBlock = p.getBlock; W.solid = p.solid; };
  W.hold = function (on) { W.held=!!on; chunks.forEach(function(m){m.visible=!on;}); if(water)water.visible=!on; if(grassMesh)grassMesh.visible=!on; if(flowerMesh)flowerMesh.visible=!on; if(!on)dirty=true; };
  var scene, material, decorMat, water, waterGeom, waterPos, waterCol, waterTime=0, waterAx=1e9, waterAz=1e9, wtex, grain, terrainNormal, surfaceQuality='medium', tr=1,tg=1,tb=1,chunks=new Map(),queue=[],qi=0,lcx=1e9,lcz=1e9,dirty=true;
  var grassMesh,flowerMesh,grassMaterial,flowerMaterial,grassTarget=44,flowerTarget=14,grassDirty=true,grassX=1e9,grassZ=1e9,grassDummy,flowerColor,grassColor,grassTintColor;

  function mkTex(size, fn, rep, colorTexture) {
    try {
      var cv = document.createElement('canvas'); cv.width = cv.height = size;
      var cx = cv.getContext('2d'), im = cx.createImageData(size, size), i, c;
      for (i = 0; i < size * size; i++) { c = fn(i % size, (i / size) | 0, i); im.data[i * 4] = c[0]; im.data[i * 4 + 1] = c[1]; im.data[i * 4 + 2] = c[2]; im.data[i * 4 + 3] = 255; }
      cx.putImageData(im, 0, 0);
      var t = new THREE.Texture(cv);
      t.wrapS = t.wrapT = THREE.RepeatWrapping; t.magFilter = THREE.LinearFilter;
      t.minFilter = THREE.LinearMipmapLinearFilter || THREE.LinearFilter; // smooth filtering + mipmaps reduce harsh pixel shimmer
      if (colorTexture !== false && THREE.sRGBEncoding !== undefined) t.encoding = THREE.sRGBEncoding;
      t.anisotropy = 2;
      t.needsUpdate = true;
      return t;
    } catch (e) { return null; }
  }
  var gs = 12345;
  function tileNoise(x, y, size, cells, seed) {
    var fx=x/size*cells, fy=y/size*cells, ix=Math.floor(fx), iy=Math.floor(fy), tx=fx-ix, ty=fy-iy;
    tx=tx*tx*(3-2*tx); ty=ty*ty*(3-2*ty);
    function at(ax,ay){return hash((ax%cells+cells)%cells+seed,(ay%cells+cells)%cells-seed);}
    var a=at(ix,iy), b=at(ix+1,iy), c=at(ix,iy+1), d=at(ix+1,iy+1);
    return (a+(b-a)*tx)*(1-ty)+(c+(d-c)*tx)*ty;
  }
  function grainTex() { // seamless 128px terrain microtexture: matte soil flecks with no hard tile boundary
    var size=128;
    return mkTex(size, function (x,y) {
      var coarse=tileNoise(x,y,size,8,31), medium=tileNoise(x,y,size,24,73), fine=tileNoise(x,y,size,64,117), fleck=tileNoise(x,y,size,128,181);
      var g=212+Math.floor(coarse*16+medium*12+fine*9)-18;
      if(fleck<.018) g-=30; else if(fleck>.988) g+=8;
      g=Math.max(160,Math.min(246,g));
      return [g,Math.min(255,g+(medium>.56?2:0)),Math.max(0,g-(coarse>.62?4:2))];
    });
  }
  function terrainNormalTex() { // periodic, subtle tangent-space detail for close-range ground only
    var size=128;
    return mkTex(size,function(x,y){
      function h(ax,ay){return tileNoise((ax+size)%size,(ay+size)%size,size,16,41)*.62+tileNoise((ax+size)%size,(ay+size)%size,size,32,89)*.28+tileNoise((ax+size)%size,(ay+size)%size,size,64,137)*.10;}
      var dx=(h(x+1,y)-h(x-1,y))*2.4,dy=(h(x,y+1)-h(x,y-1))*2.4,nx=-dx,ny=-dy,nz=1,inv=1/Math.sqrt(nx*nx+ny*ny+nz*nz);
      return [Math.round((nx*inv*.5+.5)*255),Math.round((ny*inv*.5+.5)*255),Math.round((nz*inv*.5+.5)*255)];
    },null,false);
  }
  function rippleTex() { // tileable 32x32 ripple lines
    return mkTex(32, function (x, y, i) {
      var a = Math.sin((x * 2 + y) * 0.19635) + Math.sin((y * 3 - x) * 0.19635), v = 0.78 + 0.1 * a, hl = hash(i, 4242) > 0.965 ? 0.2 : 0;
      v = Math.max(0.55, Math.min(1, v + hl));
      return [Math.floor(v * 235), Math.floor(v * 245), 255];
    });
  }

  function primeInstanceColors(mesh, capacity) {
    // Three.js r128 setColorAt() allocates from mesh.count. Since streamed vegetation starts at count=0,
    // allocate the full-capacity buffer first so colour writes never target a zero-length attribute.
    var data = new Float32Array(capacity * 3);
    for (var i = 0; i < data.length; i++) data[i] = 1;
    mesh.instanceColor = new THREE.InstancedBufferAttribute(data, 3);
    mesh.instanceColor.needsUpdate = true;
  }
  function grassGeometry() {
    // One small tuft is three broad, curved blades; avoid isolated cone-shaped spikes.
    var positions = [], indices = [];
    var heights = [.19, .23, .205], widths = [.046, .043, .047];
    for (var blade = 0; blade < 3; blade++) {
      var angle = blade * Math.PI * 2 / 3;
      var dx = Math.cos(angle), dz = Math.sin(angle);
      var sx = -dz, sz = dx;
      var base = positions.length / 3;
      var width = widths[blade], height = heights[blade];
      var midX = dx * .036, midZ = dz * .036;
      positions.push(
        dx * .012 + sx * width, 0, dz * .012 + sz * width,
        dx * .012 - sx * width, 0, dz * .012 - sz * width,
        midX + sx * width * .54, height * .58, midZ + sz * width * .54,
        midX - sx * width * .54, height * .58, midZ - sz * width * .54,
        dx * (.075 + blade * .006), height, dz * (.075 + blade * .006)
      );
      indices.push(base, base + 1, base + 3, base, base + 3, base + 2, base + 2, base + 3, base + 4);
    }
    var geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    return geometry;
  }
  function flowerGeometry() {
    // Flowers read as small round buds instead of a second set of tiny spikes.
    return new THREE.SphereGeometry(.045, 6, 4);
  }
  function setGrassQuality(level) {
    grassTarget = level === 'low' ? 24 : level === 'high' ? 68 : 44;
    flowerTarget = level === 'low' ? 8 : level === 'high' ? 24 : 14;
    grassDirty = true;
  }
  W.setGrassQuality=setGrassQuality;
  W.setSurfaceQuality=function(level){
    surfaceQuality=level==='high'?'high':level==='low'?'low':'medium';
    if(!material)return;
    // Normal mapping is reserved for desktop high quality; mobile stays on the lower-cost tiled albedo.
    var enabled=surfaceQuality==='high'&&!!terrainNormal;
    material.normalMap=enabled?terrainNormal:null;
    if(material.normalScale)material.normalScale.set(enabled?.16:0,enabled?.16:0);
    material.needsUpdate=true;
  };
  function initGrass(){
    if(grassMesh||!scene)return;
    grassTintColor=new THREE.Color(1,1,1);
    grassMaterial=new THREE.MeshBasicMaterial({color:0xffffff,side:THREE.DoubleSide,toneMapped:false});
    flowerMaterial=new THREE.MeshStandardMaterial({color:0xffffff,vertexColors:true,roughness:.9});
    grassMesh=new THREE.InstancedMesh(grassGeometry(),grassMaterial,1050);flowerMesh=new THREE.InstancedMesh(flowerGeometry(),flowerMaterial,135);
    primeInstanceColors(grassMesh,1050);primeInstanceColors(flowerMesh,135);
    grassMesh.count=flowerMesh.count=0;grassMesh.frustumCulled=flowerMesh.frustumCulled=false;grassMesh.userData.noShadow=flowerMesh.userData.noShadow=true;
    scene.add(grassMesh);scene.add(flowerMesh);grassDummy=new THREE.Object3D();flowerColor=new THREE.Color();grassColor=new THREE.Color();
    setGrassQuality(G.quality?G.quality.value:'medium');
  }
  function rebuildGrass(px,pz){
    if(!grassMesh)return;
    var ax=Math.floor(px/4)*4,az=Math.floor(pz/4)*4,gn=0,fn=0,dx,dz,wx,wz,h,sl,bi,n,dist,scale;
    var palette=G.palette||{},sampleChance=Math.min(.95,grassTarget/80);
    grassX=ax;grassZ=az;grassDirty=false;
    // Scan the complete local grid and use a stable spatial hash for even coverage.
    // Never stop after the first N plants: that made vegetation bunch up on one side of the player.
    for(dz=-16.8;dz<=16.8;dz+=2.8)for(dx=-16.8;dx<=16.8;dx+=2.8){
      n=hash(Math.floor(ax+dx+4096),Math.floor(az+dz-1703));
      if(n>sampleChance)continue;
      wx=ax+dx+(hash(Math.floor(ax+dx+17),Math.floor(az+dz+33))-.5)*1.4;
      wz=az+dz+(hash(Math.floor(ax+dx+29),Math.floor(az+dz+51))-.5)*1.4;
      dist=(wx-px)*(wx-px)+(wz-pz)*(wz-pz);if(dist>17*17)continue;
      h=getHeight(wx,wz);if(h<=SEA+1||h>=24)continue;
      sl=Math.max(Math.abs(getHeight(wx+1,wz)-getHeight(wx-1,wz)),Math.abs(getHeight(wx,wz+1)-getHeight(wx,wz-1)))*.5;if(sl>1.25)continue;
      bi=biomeW(wx,wz);if(bi===2||bi===3)continue;
      grassDummy.position.set(wx,h+.012,wz);grassDummy.rotation.set(0,n*6.283,0);
      scale=.82+hash(Math.floor(wx*3),Math.floor(wz*3))*.32;
      grassDummy.scale.set(scale*(.9+hash(Math.floor(wx+11),Math.floor(wz-7))*.18),scale*(.82+hash(Math.floor(wx-13),Math.floor(wz+17))*.2),scale*(.9+hash(Math.floor(wx+23),Math.floor(wz+5))*.18));
      grassDummy.updateMatrix();grassMesh.setMatrixAt(gn,grassDummy.matrix);
      var shade=.9+hash(Math.floor(wx*7+13),Math.floor(wz*7-31))*.1;
      var ramp=palette.grass&&(bi===1?palette.grass.forest:palette.grass.plains);
      var baseColor=Array.isArray(ramp)?ramp[2]:(bi===1?0x3f8a3a:0x8cc84a);
      grassColor.setHex(baseColor);grassColor.multiplyScalar(shade);
      if(grassMesh.setColorAt)grassMesh.setColorAt(gn,grassColor);gn++;
      if(fn<flowerTarget&&hash(Math.floor(wx+121),Math.floor(wz-91))<.09){
        flowerColor.setRGB(.95,.76+hash(Math.floor(wx),Math.floor(wz))*.22,.88);flowerMesh.setColorAt(fn,flowerColor);
        grassDummy.position.y=h+.055;grassDummy.scale.setScalar(.7+hash(Math.floor(wx+7),Math.floor(wz-9))*.35);
        grassDummy.updateMatrix();flowerMesh.setMatrixAt(fn++,grassDummy.matrix);
      }
    }
    grassMesh.count=gn;flowerMesh.count=fn;grassMesh.instanceMatrix.needsUpdate=true;flowerMesh.instanceMatrix.needsUpdate=true;
    if(grassMesh.instanceColor)grassMesh.instanceColor.needsUpdate=true;
    if(flowerMesh.instanceColor)flowerMesh.instanceColor.needsUpdate=true;
  }
  function paintWater(ax,az){
    var i,x,z,h,depth,foam,k;
    for(i=0;i<waterPos.count;i++){
      x=ax+waterPos.getX(i);z=az+waterPos.getZ(i);h=getHeight(x,z);depth=Math.max(0,Math.min(8,SEA-h))/8;
      foam=(h>=SEA-2&&h<=SEA+2)?1-Math.min(1,Math.abs(h-SEA)/3):0;k=depth;
      waterCol[i*3]=.16+(.035-.16)*k+(.88-.16)*foam*.5;
      waterCol[i*3+1]=.48+(.16-.48)*k+(.94-.48)*foam*.5;
      waterCol[i*3+2]=.55+(.36-.55)*k+(.88-.55)*foam*.5;
    }
    waterGeom.attributes.color.needsUpdate=true;
  }
  function updateWater(px,pz,dt){
    if(!waterGeom)return;var ax=Math.round(px/4)*4,az=Math.round(pz/4)*4,i,x,z;
    if(ax!==waterAx||az!==waterAz){waterAx=ax;waterAz=az;water.position.x=ax;water.position.z=az;paintWater(ax,az);}
    waterTime+=Math.max(0,dt);for(i=0;i<waterPos.count;i++){x=waterPos.getX(i);z=waterPos.getZ(i);waterPos.setY(i,Math.sin(waterTime*1.15+x*.12+z*.16)*.035+Math.sin(waterTime*.7-x*.08)*.02);}
    waterPos.needsUpdate=true;if(((waterTime*10)|0)!==(((waterTime-dt)*10)|0))waterGeom.computeVertexNormals();
    if(wtex)wtex.offset.set((px/12+waterTime*.02)%1,(-pz/12+waterTime*.015)%1);water.material.color.setRGB(tr,tg,tb);

    if(grassDirty||Math.abs(ax-grassX)>=4||Math.abs(az-grassZ)>=4)rebuildGrass(px,pz);
  }

  W.init = function(sc){
    scene=sc;grain=grainTex();terrainNormal=terrainNormalTex();
    material=new THREE.MeshStandardMaterial({vertexColors:true,fog:true,map:grain,normalMap:null,normalScale:new THREE.Vector2(0,0),roughness:1,metalness:0,side:THREE.DoubleSide});
    decorMat=new THREE.MeshStandardMaterial({vertexColors:true,fog:true,roughness:1,metalness:0,side:THREE.DoubleSide});
    wtex=rippleTex();if(wtex)wtex.repeat.set(28,28);
    waterGeom=new THREE.PlaneGeometry(112,112,48,48);waterGeom.rotateX(-Math.PI/2);waterPos=waterGeom.attributes.position;waterCol=new Float32Array(waterPos.count*3);
    for(var i=0;i<waterPos.count;i++){waterCol[i*3]=.16;waterCol[i*3+1]=.48;waterCol[i*3+2]=.55;}
    waterGeom.setAttribute('color',new THREE.BufferAttribute(waterCol,3));waterGeom.computeVertexNormals();
    water=new THREE.Mesh(waterGeom,new THREE.MeshStandardMaterial({color:0xffffff,map:wtex,vertexColors:true,transparent:true,opacity:.76,depthWrite:false,side:THREE.DoubleSide,roughness:.28,metalness:.02,fog:true}));
    water.renderOrder=1;water.position.y=SEA-.035;water.userData.noShadow=true;scene.add(water);initGrass();
    scene.fog=new THREE.Fog(0xa8c9d7,20,80);scene.background=new THREE.Color(0xa8c9d7);W.setSurfaceQuality(surfaceQuality);W.setDrawDistance(W.drawDistance);
  };
  // day cycle tint (sky.js): multiplies terrain, decor and water
  W.tint = function (r, g, b) {
    tr = r; tg = g; tb = b;
    if (material) { material.color.setRGB(r, g, b); decorMat.color.setRGB(r, g, b); }
    if (grassMaterial && grassTintColor) {
      // Instance colours carry biome greens; the shared material carries only the day/night tint.
      grassTintColor.setRGB(0.66+0.34*r,0.66+0.34*g,0.66+0.34*b);
      grassMaterial.color.copy(grassTintColor);
    }
  };
  W.setDrawDistance = function (n) {
    W.drawDistance = Math.max(3, Math.min(7, Math.round(n)));
    var far = (n - 0.3) * CS;
    if (scene && scene.fog && !W.held) { scene.fog.far = far; scene.fog.near = far * 0.45; }
    dirty = true;
  };
  // set column height (clamped 1..48). Returns 'ok' | 'same' | 'cap'. Rebuilds only the affected chunk(s).
  W.setViewDistance = function(n){W.setDrawDistance(n);};
  W.setColumn = function (x, z, h) {
    x = Math.floor(x); z = Math.floor(z);
    h = Math.max(EMIN_H, Math.min(EMAX_H, Math.floor(h)));
    var k = ek(x, z), cur = getHeight(x, z), b = baseHeight(x, z);
    if (h === cur) return 'same';
    if (h === Math.floor(b)) edits.delete(k);
    else { if (!edits.has(k) && edits.size >= EMAX) return 'cap'; edits.set(k, h); }
    rebuildAround(x, z);
    return 'ok';
  };
  W.serializeEdits = function () {
    var a = [];
    edits.forEach(function (h, k) { a.push(Math.floor(k / 2097152) - 1048576, k % 2097152 - 1048576, h); });
    return a;
  };
  // call before chunks are built (save load); no rebuild
  W.loadEdits = function (a) {
    edits.clear();
    if (!Array.isArray(a)) return;
    for (var i = 0; i + 2 < a.length && edits.size < EMAX; i += 3) {
      var x = a[i], z = a[i + 1], h = a[i + 2];
      if (!Number.isInteger(x) || !Number.isInteger(z) || !Number.isInteger(h) || Math.abs(x) > 1000000 || Math.abs(z) > 1000000) continue;
      h = Math.max(EMIN_H, Math.min(EMAX_H, h));
      if (h !== Math.floor(baseHeight(x, z))) edits.set(ek(x, z), h);
    }
    if (chunks.size) chunks.forEach(function (m) { rebuildChunk(m.cx, m.cz); });
  };
  W.clearEdits = function () {
    var seen = {}, list = [];
    edits.forEach(function (h, k) {
      var x = Math.floor(k / 2097152) - 1048576, z = k % 2097152 - 1048576;
      for (var dx = -1; dx <= 1; dx++) for (var dz = -1; dz <= 1; dz++) {
        var cx = Math.floor((x + dx) / CS), cz = Math.floor((z + dz) / CS), key = cx + ',' + cz;
        if (!seen[key]) { seen[key] = 1; list.push([cx, cz]); }
      }
    });
    edits.clear();
    list.forEach(function (c) { rebuildChunk(c[0], c[1]); });
  };
  function drop(m) { scene.remove(m); m.geometry.dispose(); if (m.decor) m.decor.geometry.dispose(); }
  function rebuildChunk(cx, cz) {
    var m = chunks.get(cx + ',' + cz);
    if (!m) return; // not loaded: it will be built from the edit layer when it streams in
    drop(m); chunks.delete(cx + ',' + cz);
    build(cx, cz);
    var n = chunks.get(cx + ',' + cz); if (n) n.visible = !W.held;
  }
  function rebuildAround(x, z) {
    var cx = Math.floor(x / CS), cz = Math.floor(z / CS), lx = x - cx * CS, lz = z - cz * CS;
    rebuildChunk(cx, cz);
    if (lx === 0) rebuildChunk(cx - 1, cz);
    if (lx === CS - 1) rebuildChunk(cx + 1, cz);
    if (lz === 0) rebuildChunk(cx, cz - 1);
    if (lz === CS - 1) rebuildChunk(cx, cz + 1);
  }
  W.chunkCount = function () { return chunks.size; };
  W.refreshDecor = function () {
    chunks.forEach(function (m) { drop(m); });
    chunks.clear(); bmap.clear(); queue = []; qi = 0; lcx = 1e9; lcz = 1e9; dirty = true;
  };
  W.decorBlockers = decorBlockers;
  W.chunkMesh = function (cx, cz) { return chunks.get(cx + ',' + cz) || null; };

  /* ---------- terrain mesh ---------- */
  var AOT = [0.58, 0.72, 0.86, 1], SF = [0.8, 0.62, 0.88, 0.7];
  var pos, col, uv, idx;
  function vtx(x, y, z, r, g, b, u, v) { pos.push(x, y, z); col.push(r, g, b); uv.push(u, v); }
  function ao(s1, s2, c) { return (s1 && s2) ? 0 : 3 - (s1 ? 1 : 0) - (s2 ? 1 : 0) - (c ? 1 : 0); }
  // vertical face f (0:+x 1:-x 2:+z 3:-z) from y0 (colour 0) to y1 (colour 1); UV: horizontal world coord, y
  function sideQ(f, x, z, y0, y1, r0, g0, b0, r1, g1, b1, ox, oz) {
    var ax, az, bx, bz, xf;
    if (f === 0) { ax = x + 1; az = z + 1; bx = x + 1; bz = z; xf = 0; }
    else if (f === 1) { ax = x; az = z; bx = x; bz = z + 1; xf = 0; }
    else if (f === 2) { ax = x; az = z + 1; bx = x + 1; bz = z + 1; xf = 1; }
    else { ax = x + 1; az = z; bx = x; bz = z; xf = 1; }
    var ua = xf ? ox + ax : oz + az, ub = xf ? ox + bx : oz + bz, base = pos.length / 3;
    vtx(ax, y0, az, r0, g0, b0, ua, y0); vtx(bx, y0, bz, r0, g0, b0, ub, y0);
    vtx(bx, y1, bz, r1, g1, b1, ub, y1); vtx(ax, y1, az, r1, g1, b1, ua, y1);
    idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }

  function vertexPaint(wx,wz,h,slope){
    biomeW(wx,wz);columnColors(wx,wz,h);
    var r=CT[0],g=CT[1],b=CT[2],snow=ss(24.5,27,h),sand=h<=SEA+1,pal=G.palette||{};
    var soil=pal.wood&&Array.isArray(pal.wood)?pal.wood[2]:0x8a5a30,stone=pal.stone&&Array.isArray(pal.stone)?pal.stone[2]:0x80838a;
    function ch(c,n){return((c>>n)&255)/255;}
    var dirt=ss(.35,1.5,slope)*(1-snow),rock=ss(1,2.8,slope)*(1-snow);
    if(!sand){r+=(ch(soil,16)-r)*dirt;g+=(ch(soil,8)-g)*dirt;b+=(ch(soil,0)-b)*dirt;r+=(ch(stone,16)-r)*rock;g+=(ch(stone,8)-g)*rock;b+=(ch(stone,0)-b)*rock;}
    var low=.94+fbm(wx*.012+17,wz*.012-23,2)*.12,fine=.985+hash(Math.floor(wx*3)+201,Math.floor(wz*3)-71)*.03;
    // Compress bright sand more than grass to stop midday exposure clipping while retaining biome variation.
    var sr=sand?.87:.90, sg=sand?.83:.88, sb=sand?.78:.90;
    return[Math.max(0,Math.min(1,r*low*fine*sr)),Math.max(0,Math.min(1,g*low*fine*sg)),Math.max(0,Math.min(1,b*low*fine*sb))];
  }
  function build(cx,cz){
    // One full sample ring is required beyond every terrain vertex so finite-difference slopes never read undefined.
    var N=CS+3,H=new Float32Array(N*N),ox=cx*CS,oz=cz*CS,x,z;
    for(z=-1;z<=CS+1;z++)for(x=-1;x<=CS+1;x++)H[(z+1)*N+x+1]=getHeight(ox+x,oz+z);
    var positions=[],colors=[],normals=[],uvs=[],indices=[],BIO=new Uint8Array(CS*CS);
    for(z=0;z<=CS;z++)for(x=0;x<=CS;x++){
      var hi=(z+1)*N+x+1,h=H[hi],hl=H[hi-1],hr=H[hi+1],hb=H[hi-N],hf=H[hi+N];
      var dx=hr-hl,dz=hf-hb,nx=-dx,ny=2,nz=-dz,inv=1/Math.sqrt(nx*nx+ny*ny+nz*nz),paint=vertexPaint(ox+x,oz+z,h,Math.sqrt(dx*dx+dz*dz)*.5);
      positions.push(x,h,z);colors.push(paint[0],paint[1],paint[2]);normals.push(nx*inv,ny*inv,nz*inv);uvs.push((ox+x)*0.16,(oz+z)*0.16);
    }
    for(z=0;z<CS;z++)for(x=0;x<CS;x++){
      var wx=ox+x,wz=oz+z;BIO[z*CS+x]=biomeW(wx+.5,wz+.5);
      var a=z*(CS+1)+x,b=a+1,d=a+CS+1,c=d+1;
      if(hash(wx,wz)>.5)indices.push(a,d,c,a,c,b);else indices.push(a,d,b,b,d,c);
    }
    var geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geo.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geo.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));geo.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));geo.setIndex(indices);
    // Normals use the padded height samples, so the same world-space vertex receives the same normal on both sides of a chunk seam.
    geo.computeBoundingSphere();
    var mesh=new THREE.Mesh(geo,material);mesh.position.set(ox,0,oz);mesh.matrixAutoUpdate=false;mesh.updateMatrix();mesh.cx=cx;mesh.cz=cz;mesh.userData.terrain=true;mesh.castShadow=false;
    // Never receive shadow-map shadows: streamed terrain chunks bypass scene.traverse(), and this caused the black triangular acne seen on Android.
    // The player and vegetation use soft contact shading instead.
    mesh.receiveShadow=false;
    var dm=decorMesh(ox,oz,H,BIO);if(dm){dm.matrixAutoUpdate=false;dm.updateMatrix();mesh.add(dm);mesh.decor=dm;}
    // The original code generated tree/rock blocker data but discarded it, so scenery had no physical collision.
    bmap.set(bk(cx,cz),dbl.length?dbl.slice():null);scene.add(mesh);chunks.set(cx+','+cz,mesh);if(W.onChunkLoad)W.onChunkLoad(cx,cz);
  }

  /* ---------- decor: one merged mesh per chunk, deterministic, visual only ---------- */
  var TP = [0.009, 0.035, 0.014, 0.02, 0.022];                     // tree / cactus / pine chance per biome
  var OT = [[.012, .035, .004], [.02, .01, .004], [0, 0, .006], [0, 0, .008], [.015, .005, .005]]; // bush, flower, rock
  var AUT = [[.9, .5, .12], [.8, .28, .12], [.92, .72, .16]];
  var FLW = [[.95, .25, .25], [.98, .85, .2], [.98, .98, .95], [.95, .5, .75], [.4, .5, .95]];
  var DMAX = 40, TMAX = 18;
  var dp, dc, di, modelDecor = [];
  function dv(x, y, z, r, g, b) { dp.push(x, y, z); dc.push(r, g, b); }
  function dbox(cx, y0, cz, sx, sy, sz, r, g, b) { // 5 faces (no bottom)
    var x0 = cx - sx / 2, x1 = cx + sx / 2, z0 = cz - sz / 2, z1 = cz + sz / 2, y1 = y0 + sy, base = dp.length / 3, k, q, s, sb;
    dv(x0, y1, z0, r, g, b); dv(x0, y1, z1, r, g, b); dv(x1, y1, z1, r, g, b); dv(x1, y1, z0, r, g, b);
    s = 0.8; sb = s * 0.82; // +x
    dv(x1, y0, z1, r * sb, g * sb, b * sb); dv(x1, y0, z0, r * sb, g * sb, b * sb); dv(x1, y1, z0, r * s, g * s, b * s); dv(x1, y1, z1, r * s, g * s, b * s);
    s = 0.62; sb = s * 0.82; // -x
    dv(x0, y0, z0, r * sb, g * sb, b * sb); dv(x0, y0, z1, r * sb, g * sb, b * sb); dv(x0, y1, z1, r * s, g * s, b * s); dv(x0, y1, z0, r * s, g * s, b * s);
    s = 0.88; sb = s * 0.82; // +z
    dv(x0, y0, z1, r * sb, g * sb, b * sb); dv(x1, y0, z1, r * sb, g * sb, b * sb); dv(x1, y1, z1, r * s, g * s, b * s); dv(x0, y1, z1, r * s, g * s, b * s);
    s = 0.7; sb = s * 0.82; // -z
    dv(x1, y0, z0, r * sb, g * sb, b * sb); dv(x0, y0, z0, r * sb, g * sb, b * sb); dv(x0, y1, z0, r * s, g * s, b * s); dv(x1, y1, z0, r * s, g * s, b * s);
    for (k = 0; k < 5; k++) { q = base + k * 4; di.push(q, q + 1, q + 2, q, q + 2, q + 3); }
  }
  function leafCol(bi, r) {
    return bi === 4 ? AUT[(r * 3) | 0] : bi === 1 ? [.15, .44, .2] : bi === 3 ? [.13, .36, .27] : bi === 2 ? [.3, .5, .2] : [.3, .64, .24];
  }
  function tree(bi, cx, h, cz, r2, j, ox, oz) {
    var th, L, tk = [.4 * j, .26 * j, .14 * j], k, ext = null;
    // Textured GLBs near the player; distant trees stay merged into chunk geometry to cap mobile draw calls.
    if (bi !== 2 && G.assets && G.assets.model) {
      var pp=G.player&&G.player.pos, wx=(ox||0)+cx, wz=(oz||0)+cz;
      var near=!pp||(wx-pp.x)*(wx-pp.x)+(wz-pp.z)*(wz-pp.z)<42*42;
      var variant=bi===3?'pine':r2<.34?'tree':r2<.67?'tree2':'tree3';
      if(near) ext=G.assets.model(variant);
    }
    if (ext) {
      ext.position.set(cx, h - 0.05, cz); ext.rotation.y = r2 * Math.PI * 2; ext.scale.multiplyScalar(j);
      ext.userData.windAmp = bi === 3 ? 0.008 : 0.018; ext.userData.windPhase = r2 * Math.PI * 2;
      ext.traverse(function (o) { if (o.isMesh) { o.castShadow = false; o.userData = o.userData || {}; o.userData.noShadow = true; } });
      modelDecor.push(ext); return;
    }
    if (bi === 2) {
      if (r2 < 0.25) { // dead tree
        th = 2.8 + r2 * 4; k = [.44 * j, .36 * j, .3 * j];
        dbox(cx, h - 0.05, cz, .4, th, .4, k[0], k[1], k[2]);
        dbox(cx + .6, h + th * .6, cz, 1.2, .26, .26, k[0], k[1], k[2]); dbox(cx + 1.1, h + th * .6, cz, .26, .9, .26, k[0], k[1], k[2]);
        dbox(cx - .5, h + th * .8, cz + .1, 1.0, .24, .24, k[0], k[1], k[2]);
      } else { // cactus
        th = 1.5 + r2 * 1.5; k = [.22 * j, .52 * j, .24 * j];
        dbox(cx, h - 0.05, cz, .65, th, .65, k[0], k[1], k[2]);
        dbox(cx + .5, h + th * .45, cz, .5, .34, .34, k[0], k[1], k[2]); dbox(cx + .68, h + th * .45, cz, .34, th * .4, .34, k[0], k[1], k[2]);
        if (r2 > 0.6) { dbox(cx - .5, h + th * .3, cz, .5, .34, .34, k[0], k[1], k[2]); dbox(cx - .68, h + th * .3, cz, .34, th * .35, .34, k[0], k[1], k[2]); }
      }
      return;
    }
    L = leafCol(bi, r2);
    if (bi === 3) { // pine
      dbox(cx, h - 0.05, cz, .5, 2.1, .5, tk[0], tk[1], tk[2]);
      for (k = 0; k < 4; k++) { var w = 3.2 - k * 0.8, sh = (0.92 + k * 0.05) * j; dbox(cx, h + 1.2 + k * 1.0, cz, w, 1.1, w, L[0] * sh, L[1] * sh, L[2] * sh); }
      dbox(cx, h + 5.0, cz, .9, .35, .9, .95, .97, 1);
      return;
    }
    th = 2.2 + r2 * 1.4;
    dbox(cx, h - 0.05, cz, .55, th, .55, tk[0], tk[1], tk[2]);
    dbox(cx, h + th - 0.5, cz, 3.0, 1.3, 3.0, L[0] * j, L[1] * j, L[2] * j);
    dbox(cx, h + th + 0.8, cz, 2.0, 1.1, 2.0, L[0] * j * 1.08, L[1] * j * 1.08, L[2] * j * 1.08);
    dbox(cx + 0.9 * (r2 < 0.5 ? 1 : -1), h + th - 0.1, cz - 0.7, 1.4, 1.1, 1.4, L[0] * j * 0.92, L[1] * j * 0.92, L[2] * j * 0.92);
    dbox(cx, h + th + 1.9, cz, 1.0, .7, 1.0, L[0] * j * 1.14, L[1] * j * 1.14, L[2] * j * 1.14);
  }
  function site(x, z, r) { // tree sites keep >= 3 blocks apart; pure function of (x,z,seed) so chunk borders agree
    for (var dx = -2; dx <= 2; dx++) for (var dz = -2; dz <= 2; dz++) {
      if (!dx && !dz) continue;
      if (hash(x + dx, z + dz) < r) return false;
    }
    return true;
  }
  function gatesFor(ox, oz) {
    var D = G.dungeon;
    if (!D || !D.gatesNear) return null;
    try { return D.gatesNear(ox - 10, oz - 10, ox + CS + 10, oz + CS + 10); } catch (e) { return null; }
  }
  var bmap = new Map(), dbl = [];
  function bk(cx, cz) { return (cx + 4096) * 8192 + (cz + 4096); }
  // tree trunks (r .32, 2.5 high) and rocks (r .5, .55 high) as short cylinders: Float32Array stride 5 = x, z, r, y0, y1; null when none
  function decorBlockers(cx, cz) { return bmap.get(bk(cx, cz)) || null; }
  function decorMesh(ox, oz, H, BIO) {
    var N = CS + 3, gates = gatesFor(ox, oz), sp = G.player && G.player.spawnPos, n = 0, trees = 0, lx, lz, g, gl = gates ? gates.length : 0;
    dp = []; dc = []; di = []; dbl = []; modelDecor = [];
    outer:
    for (lz = 0; lz < CS; lz++) for (lx = 0; lx < CS; lx++) {
      if (n >= DMAX) break outer;
      var i = (lz + 1) * N + lx + 1, h = H[i];
      if (h <= SEA + 1) continue;
      var wx = ox + lx, wz = oz + lz, bi = BIO[lz * CS + lx], r = hash(wx, wz), kind = 0;
      if (r < TP[bi] && h <= 24 && trees < TMAX && site(wx, wz, r)) kind = 1;
      else { var q = hash(wx + 7777, wz - 3131), o = OT[bi]; kind = q < o[0] ? 2 : q < o[0] + o[1] ? 3 : q < o[0] + o[1] + o[2] ? 4 : 0; }
      if (!kind) continue;
      if (edits.size && edits.has(ek(wx, wz))) continue;
      var sl = Math.max(Math.abs(H[i - 1] - h), Math.abs(H[i + 1] - h), Math.abs(H[i - N] - h), Math.abs(H[i + N] - h));
      if (sl > (kind === 1 ? 1 : 2)) continue;
      if (sp && (wx + .5 - sp.x) * (wx + .5 - sp.x) + (wz + .5 - sp.z) * (wz + .5 - sp.z) < 64) continue;
      var near = false;
      for (g = 0; g < gl; g++) { var dx = wx + .5 - gates[g].x, dz = wz + .5 - gates[g].z; if (dx * dx + dz * dz < 64) { near = true; break; } }
      if (near) continue;
      var cx = lx + .5 + (hash(wx + 1, wz + 2) - .5) * .5, cz = lz + .5 + (hash(wx + 2, wz + 1) - .5) * .5, j = .9 + .2 * hash(wx + 5, wz + 9), r2 = hash(wx + 3, wz + 4), L, c;
      if (kind === 1) { tree(bi, cx, h, cz, r2, j, ox, oz); trees++; dbl.push(ox + cx, oz + cz, bi===2?0.34:0.42, h, h + (bi===2?3.7:5.4)); }
      else if (kind === 2) {
        L = leafCol(bi, r2);
        var bushModel = G.assets && G.assets.model ? G.assets.model('bush') : null;
        if (bushModel) {
          bushModel.position.set(cx, h - 0.05, cz); bushModel.rotation.y = r2 * Math.PI * 2; bushModel.scale.multiplyScalar(j * 1.2);
          bushModel.traverse(function (o) { if (o.isMesh) { o.castShadow = false; o.userData = o.userData || {}; o.userData.noShadow = true; } }); modelDecor.push(bushModel);
        } else { dbox(cx, h - 0.05, cz, 1.1, .6, 1.1, L[0] * j * .9, L[1] * j * .9, L[2] * j * .9); dbox(cx + .15, h + .45, cz - .1, .7, .5, .7, L[0] * j * 1.05, L[1] * j * 1.05, L[2] * j * 1.05); }
      } else if (kind === 3) {
        c = FLW[(r2 * 5) | 0];
        var mushroomModel = G.assets && G.assets.model ? G.assets.model('mushroomProp') : null;
        if (mushroomModel) {
          mushroomModel.position.set(cx, h - 0.05, cz); mushroomModel.rotation.y = r2 * Math.PI * 2; mushroomModel.scale.multiplyScalar(j);
          mushroomModel.traverse(function (o) { if (o.isMesh) { o.castShadow = false; o.userData = o.userData || {}; o.userData.noShadow = true; } }); modelDecor.push(mushroomModel);
        } else {
          dbox(cx, h - 0.05, cz, .08, .38, .08, .2, .5, .2); dbox(cx, h + .33, cz, .26, .2, .26, c[0], c[1], c[2]);
          dbox(cx + .35, h - 0.05, cz + .2, .08, .3, .08, .2, .5, .2); dbox(cx + .35, h + .25, cz + .2, .24, .18, .24, c[0] * .95, c[1] * .95, c[2] * .95);
        }
      } else {
        c = bi === 3 ? [.82, .86, .92] : bi === 2 ? [.7, .55, .4] : [.55, .55, .58];
        var rockModel = G.assets && G.assets.model ? G.assets.model('rock') : null;
        if (rockModel) {
          rockModel.position.set(cx, h - 0.05, cz); rockModel.rotation.y = r2 * Math.PI * 2; rockModel.scale.multiplyScalar(j * 0.8);
          rockModel.traverse(function (o) { if (o.isMesh) { o.castShadow = false; o.userData = o.userData || {}; o.userData.noShadow = true; } }); modelDecor.push(rockModel);
        } else { dbox(cx, h - 0.05, cz, .9, .55, .8, c[0] * j, c[1] * j, c[2] * j); dbox(cx + .35, h - 0.05, cz + .25, .5, .35, .5, c[0] * j * 1.1, c[1] * j * 1.1, c[2] * j * 1.1); }
        dbl.push(ox + cx, oz + cz, 0.5, h, h + 0.55);
      }
      n++;
    }
    if (!n) return null;
    var geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(dp, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(dc, 3));
    geo.setIndex(di); geo.computeVertexNormals();
    var m = new THREE.Mesh(geo, decorMat);
    for (var mi = 0; mi < modelDecor.length; mi++) m.add(modelDecor[mi]);
    m.userData = { items: n, noShadow: true };
    return m;
  }

  function plan(pcx, pcz) {
    var R = W.drawDistance, r2 = R * R + 1, ur = (R + 1) * (R + 1) + 1, dx, dz;
    chunks.forEach(function (m, k) {
      var ax = m.cx - pcx, az = m.cz - pcz;
      if (ax * ax + az * az > ur) { drop(m); chunks.delete(k);
      bmap.delete(bk(m.cx, m.cz)); if (W.onChunkUnload) W.onChunkUnload(m.cx, m.cz); }
    });
    queue = []; qi = 0;
    for (dx = -R; dx <= R; dx++) for (dz = -R; dz <= R; dz++) {
      var d2 = dx * dx + dz * dz;
      if (d2 <= r2 && !chunks.has((pcx + dx) + ',' + (pcz + dz))) queue.push({ cx: pcx + dx, cz: pcz + dz, d: d2 });
    }
    queue.sort(function (a, b) { return a.d - b.d; });
  }
  function process(budget) {
    var t0 = performance.now();
    while (qi < queue.length) {
      var c = queue[qi++];
      if (!chunks.has(c.cx + ',' + c.cz)) build(c.cx, c.cz);
      if (performance.now() - t0 >= budget) break;
    }
  }
  W.preload = function (px, pz, r) {
    var old = W.drawDistance; W.drawDistance = r;
    plan(Math.floor(px / CS), Math.floor(pz / CS)); process(1e9);
    W.drawDistance = old; dirty = true;
  };
  var swayAccumulator = 0;
  W.update = function(px,pz,budgetMs,dt){
    if(W.held)return;var pcx=Math.floor(px/CS),pcz=Math.floor(pz/CS);
    if(dirty||pcx!==lcx||pcz!==lcz){lcx=pcx;lcz=pcz;dirty=false;plan(pcx,pcz);}
    dt=typeof dt==='number'&&isFinite(dt)?Math.max(0,Math.min(.05,dt)):.016;
    process(budgetMs);updateWater(px,pz,dt);
    // Animate only nearby model foliage at 30 Hz; avoid walking every streamed chunk on every render frame.
    swayAccumulator+=dt;
    if(swayAccumulator>=1/30){
      var swayDt=Math.min(.1,swayAccumulator);swayAccumulator=0;
      chunks.forEach(function(m){
        if(!m.visible||!m.decor)return;
        var dx=m.cx*CS+CS*.5-px,dz=m.cz*CS+CS*.5-pz;
        if(dx*dx+dz*dz>58*58)return;
        var a=m.decor.children;
        for(var i=0;i<a.length;i++){var o=a[i];if(o.userData&&o.userData.windAmp)o.rotation.z=Math.sin(waterTime*.55+o.userData.windPhase)*o.userData.windAmp;}
      });
    }
  };
  W.findSpawn = function () {
    for (var r = 0; r < 400; r += 6) {
      var n = r === 0 ? 1 : Math.ceil(r * 0.8);
      for (var k = 0; k < n; k++) {
        var a = k / n * Math.PI * 2, x = Math.round(Math.cos(a) * r), z = Math.round(Math.sin(a) * r), h = baseHeight(x, z);
        if (h < SEA + 2 || h > SEA + 6) continue;
        var ok = true, d = [[3, 0], [-3, 0], [0, 3], [0, -3]];
        for (var j = 0; j < 4; j++) { var h2 = baseHeight(x + d[j][0], z + d[j][1]); if (h2 < SEA + 1 || h2 > h + 3) ok = false; }
        if (ok) return { x: x + 0.5, y: h, z: z + 0.5 };
      }
    }
    return { x: 0.5, y: baseHeight(0, 0) + 1, z: 0.5 };
  };
  G.save.register('edits', function () { return W.serializeEdits(); }, function (a) { W.loadEdits(a); });
})();
