(function () {
  var G = window.Game = window.Game || {};
  var MANIFEST = {
    models: {
      gate:{file:'gate.glb',height:6}, door:{file:'door.glb',height:5,rotY:Math.PI/2},
      chest:{file:'chest.glb',height:.9}, portal:{file:'portal.glb',height:3},
      boss:{file:'boss.glb',height:3.4,rotY:Math.PI}, slime:{file:'slime.glb',height:.9,rotY:Math.PI},
      goblin:{file:'goblin.glb',height:1.5,rotY:Math.PI}, archer:{file:'archer.glb',height:1.6,rotY:Math.PI}
    },
    sounds:{
      door:['door.ogg','door.mp3','door.wav'],chest:['chest.ogg','chest.mp3','chest.wav'],boss:['boss.ogg','boss.mp3','boss.wav'],
      hit:['hit.ogg','hit.mp3','hit.wav'],swing:['swing.ogg','swing.mp3','swing.wav'],death:['death.ogg','death.mp3','death.wav'],
      pickup:['pickup.ogg','pickup.mp3','pickup.wav'],equip:['equip.ogg','equip.mp3','equip.wav'],
      place:['place.ogg','place.mp3','place.wav'],break:['break.ogg','break.mp3','break.wav']
    }
  };
  var A=G.assets={manifest:MANIFEST},tpl={},bufs={},raw={},pending=0,timer=null,wrapped=false;
  function toBasic(src,cache){
    if(Array.isArray(src))return src.map(function(m){return toBasic(m,cache);});
    if(cache[src.uuid])return cache[src.uuid];
    var m=new THREE.MeshBasicMaterial({color:0xffffff,map:src.map||null,vertexColors:!!src.vertexColors,transparent:!!src.transparent,opacity:src.opacity,alphaTest:src.alphaTest||0,side:src.side,fog:true});
    if(src.color){m.color.copy(src.color);if(m.color.convertLinearToSRGB)m.color.convertLinearToSRGB();}
    if(m.map)m.map.encoding=THREE.LinearEncoding;cache[src.uuid]=m;return m;
  }
  function fit(src,def){
    var cache={},box,size,center,scale,wrap=new THREE.Group(),inner=new THREE.Group();
    src.traverse(function(o){if(o.isMesh)o.material=toBasic(o.material,cache);});
    inner.add(src);inner.updateMatrixWorld(true);box=new THREE.Box3().setFromObject(inner);size=box.getSize(new THREE.Vector3());center=box.getCenter(new THREE.Vector3());
    scale=size.y>1e-6?def.height/size.y:1;inner.scale.setScalar(scale);inner.position.set(-center.x*scale,-box.min.y*scale,-center.z*scale);wrap.add(inner);wrap.rotation.y=def.rotY||0;return wrap;
  }
  A.has=function(n){return !!tpl[n];};
  A.model=function(n){var t=tpl[n];if(!t)return null;var c=t.clone(true);c.userData={};return c;};
  A.sound=function(n){var b=bufs[n],ctx=G.audio&&G.audio.ctx;if(!b||!ctx||ctx.state!=='running')return false;var s=ctx.createBufferSource();s.buffer=b;s.connect(G.audio.master);s.start(0);return true;};
  function decodeAll(){var ctx=G.audio&&G.audio.ctx;if(!ctx)return;Object.keys(raw).forEach(function(n){var ab=raw[n];delete raw[n];function ok(b){bufs[n]=b;pending--;}function bad(){pending--;}try{var p=ctx.decodeAudioData(ab,ok,bad);if(p&&p.catch)p.catch(function(){});}catch(e){pending--;}});if(!pending&&timer){clearInterval(timer);timer=null;}}
  function loadModel(n,d){return new Promise(function(done){try{new THREE.GLTFLoader().load('assets/models/'+d.file,function(g){try{tpl[n]=fit(g.scene,d);}catch(e){}done();},undefined,function(){done();});}catch(e){done();}});}
  function loadSound(n,files){return files.reduce(function(p,f){return p.then(function(got){if(got)return true;return fetch('assets/sfx/'+f).then(function(r){return r.ok?r.arrayBuffer():null;}).then(function(ab){if(ab&&ab.byteLength>64){raw[n]=ab;pending++;return true;}return false;}).catch(function(){return false;});});},Promise.resolve(false));}
  A.load=function(){
    if(!wrapped){wrapped=true;var base=G.audio.play;G.audio.play=function(n){if(pending&&G.audio.ctx)decodeAll();if(A.sound(n))return;base.call(G.audio,n);};}
    var jobs=[],k;if(window.THREE&&THREE.GLTFLoader)for(k in MANIFEST.models)jobs.push(loadModel(k,MANIFEST.models[k]));
    if(window.fetch)for(k in MANIFEST.sounds)jobs.push(loadSound(k,MANIFEST.sounds[k]));
    return Promise.all(jobs).then(function(){if(pending&&!timer)timer=setInterval(decodeAll,500);},function(){});
  };
})();