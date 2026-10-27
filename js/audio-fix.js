(function () {
  var G = window.Game = window.Game || {}, A = G.audio;
  if (!A) return;
  var oldPlay = A.play, lastWall = 0;
  function tone(type, f0, f1, dur, vol) {
    var c = A.ctx;
    if (!c || c.state !== 'running' || !A.master) return;
    var t = c.currentTime, o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(Math.max(1, f0), t);
    o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(A.master); o.start(t); o.stop(t + dur + 0.02);
  }
  function noise(dur, vol, f0, f1) {
    var c = A.ctx;
    if (!c || c.state !== 'running' || !A.master) return;
    var t = c.currentTime, s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    if (!A.noise) return;
    s.buffer = A.noise; f.type = 'bandpass'; f.Q.value = 1.2;
    f.frequency.setValueAtTime(Math.max(1, f0), t); f.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    s.connect(f); f.connect(g); g.connect(A.master); s.start(t); s.stop(t + dur);
  }
  A.play = function (name, data) {
    if (name === 'jump') { tone('triangle', 260, 480, 0.09, 0.22); noise(0.05, 0.12, 900, 1800); return; }
    if (name === 'land') { var v = data && data.speed || 8; if (v > 14) { tone('sine', 110, 40, 0.18, 0.5); noise(0.14, 0.45, 900, 150); tone('square', 90, 45, 0.08, 0.2); } else { tone('sine', 150, 70, 0.09, 0.3); noise(0.06, 0.2, 700, 300); } return; }
    if (name === 'landhard') { tone('sine', 110, 40, 0.18, 0.5); noise(0.14, 0.45, 900, 150); tone('square', 90, 45, 0.08, 0.2); return; }
    if (name === 'splash') { var speed = data && data.speed || 0; noise(speed > 12 ? 0.4 : 0.2, speed > 12 ? 0.5 : 0.3, 1800, 300); tone('sine', speed > 12 ? 300 : 500, speed > 12 ? 90 : 250, speed > 12 ? 0.25 : 0.1, speed > 12 ? 0.3 : 0.12); return; }
    if (name === 'bounce') { tone('triangle', 420, 240, 0.07, 0.2); return; }
    if (name === 'hitwall') { var now = performance.now(); if (now - lastWall < 300) return; lastWall = now; tone('square', 120, 50, 0.08, 0.3); noise(0.06, 0.3, 600, 200); return; }
    if (oldPlay) oldPlay.call(A, name, data);
  };
})();