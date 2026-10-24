/* assets.js - loads the shipping-crate GLB (CC0) and swaps it in for the procedural stand-in; any failure keeps the fallback.
   Nature props (trees, palms, bushes, rocks...) live in models.js; the bridge, lotus pond and bamboo stay procedural. */
(function (G) {
  'use strict';
  const W = G.World, P = W.parts, A = G.Assets = { cache: {} };
  const FILES = { crate: 'box-large' };

  function lambert(root) {
    const cache = new Map();
    root.traverse(function (o) {
      if (!o.isMesh) return;
      const m = o.material;
      if (!cache.has(m)) cache.set(m, new THREE.MeshLambertMaterial({ map: m.map || null, color: m.color ? m.color.clone() : 0xffffff, vertexColors: !!m.vertexColors }));
      o.material = cache.get(m); o.castShadow = true; o.receiveShadow = true;
    });
  }
  function load(key) {
    return new Promise(function (res) {
      if (!THREE.GLTFLoader) return res(null);
      new THREE.GLTFLoader().load('assets/' + FILES[key] + '.glb', function (g) { lambert(g.scene); A.cache[key] = g.scene; res(g.scene); }, undefined, function () { res(null); });
    });
  }
  const size = function (o) { o.updateMatrixWorld(true); return new THREE.Box3().setFromObject(o).getSize(new THREE.Vector3()); };
  function place(o, cx, by, cz) {
    o.updateMatrixWorld(true);
    const b = new THREE.Box3().setFromObject(o);
    o.position.x += cx - (b.min.x + b.max.x) / 2; o.position.z += cz - (b.min.z + b.max.z) / 2; o.position.y += by - b.min.y;
  }

  Promise.all(Object.keys(FILES).map(load)).then(function () {
    if (!A.cache.crate) return;
    const cr = A.cache.crate.clone(true), cs = size(cr);
    cr.scale.setScalar(1.7 / Math.max(cs.x, cs.z)); place(cr, 27, 0, 23); W.add(cr);
    P.fallback.visible = false;
  });
})(window.Game);
