/* Shared deterministic terrain math for the main thread and terrain workers. */
(function (scope) {
  'use strict';

  var BC = [[.55,.5],[.5,.85],[.88,.15],[.12,.5],[.3,.2]];
  var BTOP = [[.38,.72,.26],[.2,.5,.2],[.9,.78,.45],[.95,.97,1],[.8,.5,.18]];
  var BSIDE = [[.5,.36,.22],[.4,.3,.18],[.8,.62,.36],[.62,.66,.74],[.48,.32,.18]];
  var BSA = [[.52,.52,.55],[.44,.46,.44],[.74,.52,.34],[.52,.56,.64],[.52,.46,.42]];
  var BSB = [[.43,.43,.47],[.37,.39,.38],[.62,.42,.28],[.43,.47,.56],[.43,.38,.36]];
  var SNOWC = [.95,.97,1], SANDC = [.88,.8,.5];

  function create(seed, maxHeight, seaLevel) {
    seed = seed | 0;
    maxHeight = maxHeight == null ? 32 : maxHeight;
    seaLevel = seaLevel == null ? 10 : seaLevel;
    var BW = new Float32Array(5);
    var CT = [0,0,0], CSd = [0,0,0], CA = [0,0,0], CB = [0,0,0];

    function hash(x,z) {
      var h=(Math.imul(x,374761393)+Math.imul(z,668265263)+Math.imul(seed,1442695041))|0;
      h=Math.imul(h^(h>>>13),1274126177);h^=h>>>16;
      return (h>>>0)/4294967296;
    }
    function vnoise(x,z) {
      var xi=Math.floor(x),zi=Math.floor(z),xf=x-xi,zf=z-zi;
      var u=xf*xf*(3-2*xf),v=zf*zf*(3-2*zf);
      var a=hash(xi,zi),b=hash(xi+1,zi),c=hash(xi,zi+1),d=hash(xi+1,zi+1);
      return a+(b-a)*u+(c-a)*v+(a-b-c+d)*u*v;
    }
    function fbm(x,z,octaves) {
      var sum=0,amp=1,total=0,freq=1;
      for(var i=0;i<octaves;i++){sum+=vnoise(x*freq,z*freq)*amp;total+=amp;amp*=.5;freq*=2;}
      return sum/total;
    }
    function clamp01(v){return v<0?0:v>1?1:v;}
    function ss(a,b,v){var k=clamp01((v-a)/(b-a));return k*k*(3-2*k);}
    function baseHeight(x,z) {
      var px=Math.floor(x)+.5,pz=Math.floor(z)+.5;
      var n=fbm(px*.006,pz*.006,3),m=fbm(px*.03+50,pz*.03-70,4);
      var h=13+(n-.5)*35+(m-.5)*6;
      return Math.max(3,Math.min(maxHeight-3,h));
    }
    function biomeW(x,z) {
      var t=clamp01((fbm(x*.004+200,z*.004+300,2)-.5)*2.4+.5);
      var m=clamp01((fbm(x*.004-400,z*.004+100,2)-.5)*2.4+.5);
      var sum=0,best=0;
      for(var i=0;i<5;i++){var dt=t-BC[i][0],dm=m-BC[i][1];BW[i]=Math.exp(-(dt*dt+dm*dm)/.04);sum+=BW[i];}
      for(var j=0;j<5;j++){BW[j]/=sum;if(BW[j]>BW[best])best=j;}
      return best;
    }
    function columnColors(x,z,h) {
      var i,j,w,k,d;
      for(j=0;j<3;j++)CT[j]=CSd[j]=CA[j]=CB[j]=0;
      for(i=0;i<5;i++){
        w=BW[i];
        for(j=0;j<3;j++){CT[j]+=BTOP[i][j]*w;CSd[j]+=BSIDE[i][j]*w;CA[j]+=BSA[i][j]*w;CB[j]+=BSB[i][j]*w;}
      }
      var hj=h+(hash(x+313,z-171)-.5)*1.6;
      k=ss(19.5,22,hj);
      if(k>0)for(j=0;j<3;j++){CT[j]+=(CA[j]-CT[j])*k;CSd[j]+=(CA[j]-CSd[j])*k;}
      k=ss(24.5,26.5,hj);
      if(k>0)for(j=0;j<3;j++)CT[j]+=(SNOWC[j]-CT[j])*k;
      if(h<=seaLevel+1)for(j=0;j<3;j++){CT[j]=SANDC[j];CSd[j]=SANDC[j]*.86;}
      if(h<seaLevel){
        d=seaLevel-h;k=Math.min(d*.08,.55);
        CT[0]+=(.2-CT[0])*k;CT[1]+=(.4-CT[1])*k;CT[2]+=(.56-CT[2])*k;
        CSd[0]+=(.2-CSd[0])*k;CSd[1]+=(.4-CSd[1])*k;CSd[2]+=(.56-CSd[2])*k;
      }
    }
    function vertexPaint(wx,wz,h,slope,soil,stone) {
      biomeW(wx,wz);columnColors(wx,wz,h);
      var r=CT[0],g=CT[1],b=CT[2],snow=ss(24.5,27,h),sand=h<=seaLevel+1;
      function ch(c,n){return((c>>n)&255)/255;}
      var dirt=ss(.35,1.5,slope)*(1-snow),rock=ss(1,2.8,slope)*(1-snow);
      if(!sand){
        r+=(ch(soil,16)-r)*dirt;g+=(ch(soil,8)-g)*dirt;b+=(ch(soil,0)-b)*dirt;
        r+=(ch(stone,16)-r)*rock;g+=(ch(stone,8)-g)*rock;b+=(ch(stone,0)-b)*rock;
      }
      var low=.94+fbm(wx*.012+17,wz*.012-23,2)*.12;
      var fine=.985+hash(Math.floor(wx*3)+201,Math.floor(wz*3)-71)*.03;
      var sr=sand?.87:.90,sg=sand?.83:.88,sb=sand?.78:.90;
      return [Math.max(0,Math.min(1,r*low*fine*sr)),Math.max(0,Math.min(1,g*low*fine*sg)),Math.max(0,Math.min(1,b*low*fine*sb))];
    }
    return {
      hash:hash,vnoise:vnoise,fbm:fbm,baseHeight:baseHeight,biomeW:biomeW,
      columnColors:columnColors,vertexPaint:vertexPaint,
      BW:BW,CT:CT,CSd:CSd,CA:CA,CB:CB
    };
  }

  scope.TerrainCore = { create:create };
})(typeof self !== 'undefined' ? self : this);
