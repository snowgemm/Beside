/* Pure terrain geometry generation. THREE.js objects stay on the main thread. */
'use strict';

var CS = 16, SEA = 10;
var BC = [[.55,.5],[.5,.85],[.88,.15],[.12,.5],[.3,.2]];
var BTOP = [[.38,.72,.26],[.2,.5,.2],[.9,.78,.45],[.95,.97,1],[.8,.5,.18]];
var BSIDE = [[.5,.36,.22],[.4,.3,.18],[.8,.62,.36],[.62,.66,.74],[.48,.32,.18]];
var BSA = [[.52,.52,.55],[.44,.46,.44],[.74,.52,.34],[.52,.56,.64],[.52,.46,.42]];
var BSB = [[.43,.43,.47],[.37,.39,.38],[.62,.42,.28],[.43,.47,.56],[.43,.38,.36]];
var SNOWC = [.95,.97,1], SANDC = [.88,.8,.5];
var CT = [0,0,0], CSd = [0,0,0], CA = [0,0,0], CB = [0,0,0];
var BW = new Float32Array(5);

function hash(x, z, seed) {
  var h = (Math.imul(x, 374761393) + Math.imul(z, 668265263) + Math.imul(seed, 1442695041)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
function vnoise(x, z, seed) {
  var xi=Math.floor(x),zi=Math.floor(z),xf=x-xi,zf=z-zi;
  var u=xf*xf*(3-2*xf),v=zf*zf*(3-2*zf);
  var a=hash(xi,zi,seed),b=hash(xi+1,zi,seed),c=hash(xi,zi+1,seed),d=hash(xi+1,zi+1,seed);
  return a+(b-a)*u+(c-a)*v+(a-b-c+d)*u*v;
}
function fbm(x,z,octaves,seed) {
  var sum=0,amp=1,total=0,freq=1;
  for(var i=0;i<octaves;i++){sum+=vnoise(x*freq,z*freq,seed)*amp;total+=amp;amp*=.5;freq*=2;}
  return sum/total;
}
function clamp01(v){return v<0?0:v>1?1:v;}
function smoothstep(a,b,v){var k=clamp01((v-a)/(b-a));return k*k*(3-2*k);}
function biomeW(x,z,seed) {
  var t=clamp01((fbm(x*.004+200,z*.004+300,2,seed)-.5)*2.4+.5);
  var m=clamp01((fbm(x*.004-400,z*.004+100,2,seed)-.5)*2.4+.5);
  var sum=0,best=0;
  for(var i=0;i<5;i++){var dt=t-BC[i][0],dm=m-BC[i][1];BW[i]=Math.exp(-(dt*dt+dm*dm)/.04);sum+=BW[i];}
  for(var j=0;j<5;j++){BW[j]/=sum;if(BW[j]>BW[best])best=j;}
  return best;
}
function columnColors(x,z,h,seed) {
  var i,j,w,k,d;
  for(j=0;j<3;j++)CT[j]=CSd[j]=CA[j]=CB[j]=0;
  for(i=0;i<5;i++){
    w=BW[i];
    for(j=0;j<3;j++){
      CT[j]+=BTOP[i][j]*w;CSd[j]+=BSIDE[i][j]*w;
      CA[j]+=BSA[i][j]*w;CB[j]+=BSB[i][j]*w;
    }
  }
  var hj=h+(hash(x+313,z-171,seed)-.5)*1.6;
  k=smoothstep(19.5,22,hj);
  if(k>0)for(j=0;j<3;j++){CT[j]+=(CA[j]-CT[j])*k;CSd[j]+=(CA[j]-CSd[j])*k;}
  k=smoothstep(24.5,26.5,hj);
  if(k>0)for(j=0;j<3;j++)CT[j]+=(SNOWC[j]-CT[j])*k;
  if(h<=SEA+1)for(j=0;j<3;j++){CT[j]=SANDC[j];CSd[j]=SANDC[j]*.86;}
  if(h<SEA){
    d=SEA-h;k=Math.min(d*.08,.55);
    CT[0]+=(.2-CT[0])*k;CT[1]+=(.4-CT[1])*k;CT[2]+=(.56-CT[2])*k;
    CSd[0]+=(.2-CSd[0])*k;CSd[1]+=(.4-CSd[1])*k;CSd[2]+=(.56-CSd[2])*k;
  }
}
function vertexPaint(wx,wz,h,slope,seed,soil,stone) {
  biomeW(wx,wz,seed);columnColors(wx,wz,h,seed);
  var r=CT[0],g=CT[1],b=CT[2],snow=smoothstep(24.5,27,h),sand=h<=SEA+1;
  function ch(c,n){return((c>>n)&255)/255;}
  var dirt=smoothstep(.35,1.5,slope)*(1-snow),rock=smoothstep(1,2.8,slope)*(1-snow);
  if(!sand){
    r+=(ch(soil,16)-r)*dirt;g+=(ch(soil,8)-g)*dirt;b+=(ch(soil,0)-b)*dirt;
    r+=(ch(stone,16)-r)*rock;g+=(ch(stone,8)-g)*rock;b+=(ch(stone,0)-b)*rock;
  }
  var low=.94+fbm(wx*.012+17,wz*.012-23,2,seed)*.12;
  var fine=.985+hash(Math.floor(wx*3)+201,Math.floor(wz*3)-71,seed)*.03;
  var sr=sand?.87:.90,sg=sand?.83:.88,sb=sand?.78:.90;
  return [Math.max(0,Math.min(1,r*low*fine*sr)),Math.max(0,Math.min(1,g*low*fine*sg)),Math.max(0,Math.min(1,b*low*fine*sb))];
}
function generateChunk(message) {
  var cx=message.cx|0,cz=message.cz|0,seed=message.seed|0,lod=message.lod===1?1:0;
  var N=CS+3,ox=cx*CS,oz=cz*CS;
  var H=message.heights instanceof Float32Array?message.heights:new Float32Array(message.heights);
  if(H.length!==N*N)throw new Error('Invalid padded height grid');
  var BIO=new Uint8Array(CS*CS),positions=[],colors=[],normals=[],uvs=[],indices=[];
  var indexMap=new Int16Array((CS+1)*(CS+1));indexMap.fill(-1);
  function addVertex(x,z) {
    var mapIndex=z*(CS+1)+x;
    if(indexMap[mapIndex]>=0)return indexMap[mapIndex];
    var hi=(z+1)*N+x+1,h=H[hi],hl=H[hi-1],hr=H[hi+1],hb=H[hi-N],hf=H[hi+N];
    var dx=hr-hl,dz=hf-hb,nx=-dx,ny=2,nz=-dz,inv=1/Math.sqrt(nx*nx+ny*ny+nz*nz);
    var paint=vertexPaint(ox+x,oz+z,h,Math.sqrt(dx*dx+dz*dz)*.5,seed,message.soil|0,message.stone|0);
    var index=positions.length/3;
    positions.push(x,h,z);
    colors.push(paint[0],paint[1],paint[2]);
    normals.push(nx*inv,ny*inv,nz*inv);
    uvs.push((ox+x)*.16,(oz+z)*.16);
    indexMap[mapIndex]=index;
    return index;
  }
  for(var bz=0;bz<CS;bz++)for(var bx=0;bx<CS;bx++)BIO[bz*CS+bx]=biomeW(ox+bx+.5,oz+bz+.5,seed);

  if(lod===0) {
    for(var z=0;z<=CS;z++)for(var x=0;x<=CS;x++)addVertex(x,z);
    for(var cz0=0;cz0<CS;cz0++)for(var cx0=0;cx0<CS;cx0++){
      var wx=ox+cx0,wz=oz+cz0,a=cz0*(CS+1)+cx0,b=a+1,d=a+CS+1,c=d+1;
      if(hash(wx,wz,seed)>.5)indices.push(a,d,c,a,c,b);
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
      var ring=[[xc,zc],[xc,zc+2],[xc+2,zc+2],[xc+2,zc]];
      if(xc===0)ring.splice(1,0,[xc,zc+1]);
      if(zc+2===CS)ring.splice(ring.length-1,0,[xc+1,zc+2]);
      if(xc+2===CS)ring.splice(ring.length-1,0,[xc+2,zc+1]);
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
