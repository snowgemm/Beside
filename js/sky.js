(function () {
  var G=window.Game=window.Game||{},S=G.sky={t:.3,night:0},DAY=600,scene,cam,dome,domeAttr,domeFactor,hemi,keylight,sun,moon,stars,starMat,cloudMat,clouds=[],cloudTex,acc=1,drift=0,off=false;
  var keys=[
    {t:0,top:[.018,.03,.09],hor:[.08,.10,.20],fog:[.06,.08,.15],tint:[.52,.58,.78]},
    {t:.18,top:[.15,.18,.34],hor:[.95,.40,.25],fog:[.52,.32,.30],tint:[.88,.78,.70]},
    {t:.28,top:[.30,.52,.78],hor:[.94,.70,.48],fog:[.61,.70,.79],tint:[1,.91,.82]},
    {t:.5,top:[.28,.58,.86],hor:[.68,.82,.88],fog:[.63,.77,.82],tint:[1,.98,.91]},
    {t:.72,top:[.88,.32,.20],hor:[.98,.57,.34],fog:[.58,.40,.36],tint:[1,.80,.68]},
    {t:.82,top:[.09,.10,.25],hor:[.24,.15,.25],fog:[.10,.11,.19],tint:[.62,.65,.82]},
    {t:1,top:[.018,.03,.09],hor:[.08,.10,.20],fog:[.06,.08,.15],tint:[.52,.58,.78]}
  ];
  var top=[0,0,0],hor=[0,0,0],fog=[0,0,0],tint=[1,1,1];
  function mix(o,a,b,t){o[0]=a[0]+(b[0]-a[0])*t;o[1]=a[1]+(b[1]-a[1])*t;o[2]=a[2]+(b[2]-a[2])*t;}
  function sample(t){var i=0;while(i<keys.length-2&&t>=keys[i+1].t)i++;var a=keys[i],b=keys[i+1],k=(t-a.t)/(b.t-a.t);k=k*k*(3-2*k);mix(top,a.top,b.top,k);mix(hor,a.hor,b.hor,k);mix(fog,a.fog,b.fog,k);mix(tint,a.tint,b.tint,k);}
  function cloudTexture(){
    var c=document.createElement('canvas');c.width=128;c.height=64;var x=c.getContext('2d');x.fillStyle='rgba(255,255,255,.9)';
    [[31,39,17],[54,28,23],[79,36,18],[99,41,12]].forEach(function(p){x.beginPath();x.arc(p[0],p[1],p[2],0,Math.PI*2);x.fill();});
    var g=x.createLinearGradient(0,20,0,60);g.addColorStop(0,'rgba(255,255,255,.95)');g.addColorStop(1,'rgba(255,255,255,.12)');
    x.globalCompositeOperation='source-in';x.fillStyle=g;x.fillRect(0,0,128,64);return new THREE.CanvasTexture(c);
  }
  S.init=function(sc,camera){
    scene=sc;cam=camera;hemi=new THREE.HemisphereLight(0xdbe9ff,0x474a48,.78);scene.add(hemi);
    keylight=new THREE.DirectionalLight(0xffd7b5,.9);keylight.position.set(40,100,25);scene.add(keylight);scene.add(keylight.target);keylight.castShadow=false;
    var geo=new THREE.SphereGeometry(400,32,20),p=geo.attributes.position;domeFactor=new Float32Array(p.count);
    for(var i=0;i<p.count;i++)domeFactor[i]=Math.pow(Math.max(0,p.getY(i)/400),.55);
    domeAttr=new THREE.BufferAttribute(new Float32Array(p.count*3),3);geo.setAttribute('color',domeAttr);
    dome=new THREE.Mesh(geo,new THREE.MeshBasicMaterial({vertexColors:true,side:THREE.BackSide,depthWrite:false,fog:false}));dome.renderOrder=-10;dome.frustumCulled=false;dome.userData.noShadow=true;scene.add(dome);
    sun=new THREE.Mesh(new THREE.CircleGeometry(1,32),new THREE.MeshBasicMaterial({color:0xffdfaa,depthWrite:false,depthTest:false,fog:false}));
    moon=new THREE.Mesh(new THREE.CircleGeometry(1,32),new THREE.MeshBasicMaterial({color:0xdbe5ff,depthWrite:false,depthTest:false,fog:false}));
    sun.scale.set(15,15,1);moon.scale.set(10,10,1);sun.renderOrder=moon.renderOrder=-9;sun.frustumCulled=moon.frustumCulled=false;sun.userData.noShadow=moon.userData.noShadow=true;scene.add(sun);scene.add(moon);
    var points=new Float32Array(150*3);
    for(var j=0;j<150;j++){var u=Math.abs((Math.sin(j*12.9898)*43758.5453)%1),v=Math.abs((Math.sin(j*78.233+1.7)*12345.678)%1),y=.08+v*.92,r=Math.sqrt(1-y*y),a=u*Math.PI*2;points[j*3]=Math.cos(a)*r*380;points[j*3+1]=y*380;points[j*3+2]=Math.sin(a)*r*380;}
    var sg=new THREE.BufferGeometry();sg.setAttribute('position',new THREE.BufferAttribute(points,3));starMat=new THREE.PointsMaterial({color:0xffffff,size:2,sizeAttenuation:false,transparent:true,opacity:0,fog:false,depthWrite:false});
    stars=new THREE.Points(sg,starMat);stars.frustumCulled=false;stars.renderOrder=-8;stars.userData.noShadow=true;scene.add(stars);
    cloudTex=cloudTexture();cloudMat=new THREE.SpriteMaterial({map:cloudTex,color:0xffffff,transparent:true,opacity:.65,depthWrite:false,fog:false});
    for(var k=0;k<4;k++){var sp=new THREE.Sprite(cloudMat);sp.scale.set(28+k*7,13+k*2,1);sp.renderOrder=-7;sp.userData.noShadow=true;scene.add(sp);clouds.push(sp);}
    scene.fog=new THREE.Fog(0x9bb3c0,20,80);scene.background=new THREE.Color(0x9bb3c0);sample(S.t);
  };
  function visible(on){if(dome)dome.visible=on;if(stars)stars.visible=on;for(var i=0;i<clouds.length;i++)clouds[i].visible=on;if(!on&&sun&&moon)sun.visible=moon.visible=false;}
  S.setShadows=function(on){
    if(!keylight)return;keylight.castShadow=!!on;
    if(on){keylight.shadow.mapSize.set(1024,1024);keylight.shadow.camera.left=-30;keylight.shadow.camera.right=30;keylight.shadow.camera.top=30;keylight.shadow.camera.bottom=-30;keylight.shadow.camera.near=1;keylight.shadow.camera.far=100;keylight.shadow.bias=-.00025;keylight.shadow.normalBias=.025;}
  };
  S.update=function(dt){
    if(!dome)return;var D=G.dungeon;if(D&&D.active){if(!off){off=true;visible(false);}return;}if(off){off=false;visible(true);acc=1;}
    S.t=(S.t+dt/DAY)%1;if(!(S.t>=0))S.t=.3;sample(S.t);
    var a=(S.t-.25)*Math.PI*2,sy=Math.sin(a),sx=Math.cos(a),c=cam.position,day=Math.max(0,Math.min(1,(sy+.12)/.8));
    S.night=Math.max(0,Math.min(1,.5-sy*2.5));if(G.world&&G.world.tint)G.world.tint(tint[0],tint[1],tint[2]);
    if(scene.fog)scene.fog.color.setRGB(fog[0],fog[1],fog[2]);if(scene.background&&scene.background.setRGB)scene.background.setRGB(fog[0],fog[1],fog[2]);
    dome.position.copy(c);stars.position.copy(c);stars.rotation.z=S.t*Math.PI*2;
    var d=340/Math.max(.45,Math.sqrt(sx*sx+sy*sy+.05));sun.position.set(c.x+sx*d,c.y+sy*d,c.z+.2*d);moon.position.set(c.x-sx*d,c.y-sy*d,c.z-.2*d);sun.lookAt(c);moon.lookAt(c);
    sun.visible=sy>-.15;moon.visible=sy<.15;sun.material.color.setRGB(1,.63+.32*day,.3+.55*day);starMat.opacity=S.night*.86;stars.visible=S.night>.02;
    hemi.intensity=.20+day*.75;hemi.color.setRGB(.48+.48*day,.56+.38*day,.77+.2*day);hemi.groundColor.setRGB(.18+.2*day,.2+.19*day,.24+.1*day);
    keylight.intensity=.12+Math.max(0,sy);keylight.color.setRGB(.8+.2*day,.67+.3*day,.61+.36*day);keylight.position.set(c.x+sx*70,c.y+90+Math.max(0,sy)*30,c.z+28);keylight.target.position.set(c.x,c.y,c.z);
    cloudMat.color.setRGB(Math.min(1,tint[0]*1.12),Math.min(1,tint[1]*1.1),Math.min(1,tint[2]*1.1));cloudMat.opacity=.32+day*.4;drift+=dt*1.8;
    for(var i=0;i<clouds.length;i++)clouds[i].position.set(c.x+((i*83+drift)%320)-160,c.y+65+(i%2)*8,c.z+((i*57+45)%240)-120);
    acc+=dt;if(acc>=.2){acc=0;var ar=domeAttr.array;for(var j=0;j<domeFactor.length;j++){var q=domeFactor[j];ar[j*3]=hor[0]+(top[0]-hor[0])*q;ar[j*3+1]=hor[1]+(top[1]-hor[1])*q;ar[j*3+2]=hor[2]+(top[2]-hor[2])*q;}domeAttr.needsUpdate=true;}
  };
  G.save.register('daytime',function(){return Math.round(S.t*100000)/100000;},function(v){if(typeof v==='number'&&isFinite(v))S.t=((v%1)+1)%1;});
})();