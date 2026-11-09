/* Pure terrain geometry generation. THREE.js objects stay on the main thread. */
'use strict';

importScripts('terrain-core.js');
var CS = 16, SEA = 10;
function generateChunk(message) {
  var cx=message.cx|0,cz=message.cz|0,seed=message.seed|0,lod=message.lod===1?1:0;
  var N=CS+3,ox=cx*CS,oz=cz*CS;
  var core=self.TerrainCore.create(seed,32,SEA);
  var H=message.heights instanceof Float32Array?message.heights:new Float32Array(message.heights);
  if(H.length!==N*N)throw new Error('Invalid padded height grid');
  var BIO=new Uint8Array(CS*CS),positions=[],colors=[],normals=[],uvs=[],indices=[];
  var indexMap=new Int16Array((CS+1)*(CS+1));indexMap.fill(-1);
  function addVertex(x,z) {
    var mapIndex=z*(CS+1)+x;
    if(indexMap[mapIndex]>=0)return indexMap[mapIndex];
    var hi=(z+1)*N+x+1,h=H[hi],hl=H[hi-1],hr=H[hi+1],hb=H[hi-N],hf=H[hi+N];
    var dx=hr-hl,dz=hf-hb,nx=-dx,ny=2,nz=-dz,inv=1/Math.sqrt(nx*nx+ny*ny+nz*nz);
    var paint=core.vertexPaint(ox+x,oz+z,h,Math.sqrt(dx*dx+dz*dz)*.5,message.soil|0,message.stone|0);
    var index=positions.length/3;
    positions.push(x,h,z);
    colors.push(paint[0],paint[1],paint[2]);
    normals.push(nx*inv,ny*inv,nz*inv);
    uvs.push((ox+x)*.16,(oz+z)*.16);
    indexMap[mapIndex]=index;
    return index;
  }
  for(var bz=0;bz<CS;bz++)for(var bx=0;bx<CS;bx++)BIO[bz*CS+bx]=core.biomeW(ox+bx+.5,oz+bz+.5);

  if(lod===0) {
    for(var z=0;z<=CS;z++)for(var x=0;x<=CS;x++)addVertex(x,z);
    for(var cz0=0;cz0<CS;cz0++)for(var cx0=0;cx0<CS;cx0++){
      var wx=ox+cx0,wz=oz+cz0,a=cz0*(CS+1)+cx0,b=a+1,d=a+CS+1,c=d+1;
      if(core.hash(wx,wz)>.5)indices.push(a,d,c,a,c,b);
      else indices.push(a,d,b,b,d,c);
    }
  } else {
    // Retain every boundary vertex; each coarse 2x2 cell fans around its true centre.
    // The perimeter therefore stitches exactly to the full-resolution neighbouring chunk.
    for(var z0=0;z0<=CS;z0+=2)for(var x0=0;x0<=CS;x0+=2)addVertex(x0,z0);
    for(var zi=1;zi<CS;zi+=2)for(var xi=1;xi<CS;xi+=2)addVertex(xi,zi);
    for(var edge=1;edge<CS;edge+=2){
      addVertex(edge,0);addVertex(edge,CS);
      addVertex(0,edge);addVertex(CS,edge);
    }
    for(var zc=0;zc<CS;zc+=2)for(var xc=0;xc<CS;xc+=2){
      var ring=[[xc,zc]];
      if(xc===0)ring.push([xc,zc+1]);
      ring.push([xc,zc+2]);
      if(zc+2===CS)ring.push([xc+1,zc+2]);
      ring.push([xc+2,zc+2]);
      if(xc+2===CS)ring.push([xc+2,zc+1]);
      ring.push([xc+2,zc]);
      if(zc===0)ring.push([xc+1,zc]);
      var centre=addVertex(xc+1,zc+1);
      for(var ri=0;ri<ring.length;ri++){
        var current=ring[ri],next=ring[(ri+1)%ring.length];
        indices.push(centre,addVertex(current[0],current[1]),addVertex(next[0],next[1]));
      }
    }
  }
  return {
    cx:cx,cz:cz,lod:lod,
    positions:new Float32Array(positions),colors:new Float32Array(colors),
    normals:new Float32Array(normals),uvs:new Float32Array(uvs),
    indices:new Uint16Array(indices),biomes:BIO
  };
}

self.onmessage=function(event){
  var message=event.data||{};
  if(message.type!=='generate')return;
  try{
    var result=generateChunk(message);
    result.type='generated';result.id=message.id;
    self.postMessage(result,[
      result.positions.buffer,result.colors.buffer,result.normals.buffer,
      result.uvs.buffer,result.indices.buffer,result.biomes.buffer
    ]);
  }catch(error){
    self.postMessage({type:'error',id:message.id,cx:message.cx,cz:message.cz,message:error&&error.message?error.message:String(error)});
  }
};
