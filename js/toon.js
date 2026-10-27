(function () {
  var G=window.Game=window.Game||{};G.config=G.config||{};
  G.safeMode=/(?:^|[?&])safe=1(?:&|$)/.test(window.location.search||'');
  var gradient=null,shadowTexture=null,shadowGeometry=null,shadowMaterial=null;
  function getGradient(){
    if(gradient)return gradient;
    gradient=new THREE.DataTexture(new Uint8Array([0,0,0,78,78,78,166,166,166,255,255,255]),4,1,THREE.RGBFormat);
    gradient.magFilter=THREE.NearestFilter;gradient.minFilter=THREE.NearestFilter;gradient.generateMipmaps=false;gradient.needsUpdate=true;return gradient;
  }
  function makeMaterial(color,opts){
    var p=Object.assign({color:color===undefined?0xffffff:color,gradientMap:getGradient()},opts||{});delete p.safeMode;
    return THREE.MeshToonMaterial?new THREE.MeshToonMaterial(p):new THREE.MeshStandardMaterial(p);
  }
  function addOutline(mesh,thickness,color){
    if(!mesh||!mesh.parent||!mesh.geometry)return null;
    var outline=new THREE.Mesh(mesh.geometry,new THREE.MeshBasicMaterial({color:color===undefined?0x202b2c:color,side:THREE.BackSide,depthWrite:true,depthTest:true}));
    outline.scale.setScalar(1+Math.max(.002,Math.min(.12,thickness===undefined?.035:thickness)));
    outline.renderOrder=(mesh.renderOrder||0)-1;outline.frustumCulled=mesh.frustumCulled;outline.userData.outlineFor=mesh.uuid;mesh.add(outline);return outline;
  }
  function getShadow(){
    if(shadowMaterial)return;
    var n=32,d=new Uint8Array(n*n*4);
    for(var y=0;y<n;y++)for(var x=0;x<n;x++){
      var dx=(x+.5)/n*2-1,dy=(y+.5)/n*2-1,r=Math.sqrt(dx*dx+dy*dy),a=Math.max(0,1-r);a=a*a*(3-2*a);
      var i=(y*n+x)*4;d[i]=d[i+1]=d[i+2]=24;d[i+3]=Math.round(a*180);
    }
    shadowTexture=new THREE.DataTexture(d,n,n,THREE.RGBAFormat);shadowTexture.magFilter=shadowTexture.minFilter=THREE.LinearFilter;shadowTexture.generateMipmaps=false;shadowTexture.needsUpdate=true;
    shadowGeometry=new THREE.PlaneGeometry(2,2);shadowMaterial=new THREE.MeshBasicMaterial({color:0x283126,map:shadowTexture,transparent:true,opacity:.55,depthWrite:false,side:THREE.DoubleSide,fog:true});
  }
  function blobShadow(radius){
    getShadow();var r=Math.max(.1,radius||.55),mesh=new THREE.Mesh(shadowGeometry,shadowMaterial);
    mesh.rotation.x=-Math.PI/2;mesh.position.y=.035;mesh.scale.set(r,r*.72,1);mesh.renderOrder=2;mesh.userData.blobShadow=true;mesh.userData.noShadow=true;return mesh;
  }
  G.toon={makeMaterial:makeMaterial,addOutline:addOutline,blobShadow:blobShadow,gradientMap:getGradient,safeMode:G.safeMode};
})();