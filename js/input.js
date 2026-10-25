(function () {
  var G = window.Game = window.Game || {};
  var isTouch = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
  var I = G.input = { isTouch: isTouch, moveX: 0, moveZ: 0, jump: false, lookDX: 0, lookDY: 0, viewToggle: false, attackQ: false, dodgeQ: false };
  var k = {}, joy = { x: 0, z: 0 }, jumpT = false;
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  I.poll = function () {
    I.moveX = clamp((k.r ? 1 : 0) - (k.l ? 1 : 0) + joy.x, -1, 1);
    I.moveZ = clamp((k.f ? 1 : 0) - (k.b ? 1 : 0) + joy.z, -1, 1);
    I.jump = !!(k.j || jumpT);
  };
  I.init = function (canvas) {
    var hint = document.getElementById('hint');
    if (isTouch) document.body.classList.add('touch');
    var map = { KeyW: 'f', ArrowUp: 'f', KeyS: 'b', ArrowDown: 'b', KeyA: 'l', ArrowLeft: 'l', KeyD: 'r', ArrowRight: 'r', Space: 'j' };
    window.addEventListener('keydown', function (e) {
      if (map[e.code]) { k[map[e.code]] = true; e.preventDefault(); }
      else if (e.code === 'KeyV' && !e.repeat) I.viewToggle = true;
      else if (e.code === 'KeyJ' && !e.repeat) I.attackQ = true;
      else if ((e.code === 'ShiftLeft' || e.code === 'ShiftRight') && !e.repeat) I.dodgeQ = true;
    });
    window.addEventListener('keyup', function (e) { if (map[e.code]) k[map[e.code]] = false; });
    window.addEventListener('blur', function () { k = {}; });
    canvas.addEventListener('click', function () {
      if (!isTouch && document.pointerLockElement !== canvas && canvas.requestPointerLock) canvas.requestPointerLock();
    });
    document.addEventListener('pointerlockchange', function () {
      hint.style.display = (document.pointerLockElement === canvas || isTouch) ? 'none' : 'block';
    });
    document.addEventListener('mousemove', function (e) {
      if (document.pointerLockElement === canvas) { I.lookDX += e.movementX * 0.0022; I.lookDY += e.movementY * 0.0022; }
    });
    document.addEventListener('mousedown', function (e) { if (e.button === 0 && document.pointerLockElement === canvas) I.attackQ = true; });
    var bv = document.getElementById('btn-view'), bj = document.getElementById('btn-jump');
    bv.addEventListener('click', function () { I.viewToggle = true; });
    bv.addEventListener('touchstart', function (e) { e.preventDefault(); e.stopPropagation(); I.viewToggle = true; }, { passive: false });
    bj.addEventListener('touchstart', function (e) { e.preventDefault(); e.stopPropagation(); jumpT = true; }, { passive: false });
    function jEnd(e) { e.preventDefault(); jumpT = false; }
    bj.addEventListener('touchend', jEnd, { passive: false });
    bj.addEventListener('touchcancel', jEnd, { passive: false });
    function tb(id, flag) {
      document.getElementById(id).addEventListener('touchstart', function (e) { e.preventDefault(); e.stopPropagation(); I[flag] = true; }, { passive: false });
    }
    tb('btn-attack', 'attackQ'); tb('btn-dodge', 'dodgeQ');
    var layer = document.getElementById('touch'), jb = document.getElementById('joy'), kn = document.getElementById('joy-knob');
    var joyId = null, jcx = 0, jcy = 0, lookId = null, lx = 0, ly = 0, R = 56;
    function setJoy(x, y) {
      var dx = x - jcx, dy = y - jcy, l = Math.hypot(dx, dy);
      if (l > R) { dx *= R / l; dy *= R / l; }
      kn.style.transform = 'translate(' + dx + 'px,' + dy + 'px)';
      var nx = dx / R, nz = -dy / R;
      joy.x = Math.abs(nx) < 0.12 ? 0 : nx; joy.z = Math.abs(nz) < 0.12 ? 0 : nz;
    }
    layer.addEventListener('touchstart', function (e) {
      e.preventDefault();
      for (var i = 0; i < e.changedTouches.length; i++) {
        var t = e.changedTouches[i];
        if (t.clientX < window.innerWidth / 2 && joyId === null) {
          joyId = t.identifier; jcx = t.clientX; jcy = t.clientY;
          jb.style.left = jcx + 'px'; jb.style.top = jcy + 'px'; jb.style.display = 'block'; setJoy(jcx, jcy);
        } else if (t.clientX >= window.innerWidth / 2 && lookId === null) {
          lookId = t.identifier; lx = t.clientX; ly = t.clientY;
        }
      }
    }, { passive: false });
    layer.addEventListener('touchmove', function (e) {
      e.preventDefault();
      for (var i = 0; i < e.changedTouches.length; i++) {
        var t = e.changedTouches[i];
        if (t.identifier === joyId) setJoy(t.clientX, t.clientY);
        else if (t.identifier === lookId) {
          I.lookDX += (t.clientX - lx) * 0.005; I.lookDY += (t.clientY - ly) * 0.005; lx = t.clientX; ly = t.clientY;
        }
      }
    }, { passive: false });
    function end(e) {
      e.preventDefault();
      for (var i = 0; i < e.changedTouches.length; i++) {
        var id = e.changedTouches[i].identifier;
        if (id === joyId) { joyId = null; joy.x = joy.z = 0; jb.style.display = 'none'; kn.style.transform = 'translate(0px,0px)'; }
        else if (id === lookId) lookId = null;
      }
    }
    layer.addEventListener('touchend', end, { passive: false });
    layer.addEventListener('touchcancel', end, { passive: false });
  };
})();
