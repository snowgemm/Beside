(function () {
  var G = window.Game = window.Game || {};
  var E = 1e-4, SUB = 0.45, W = null;
  var P = G.phys = {
    GRAV: 28, TERM: 35, STEP: 1, FALL_V: 19, FALL_DMG: 3,   // fall damage starts at ~7 blocks (v = sqrt(2*28*7))
    DRAG_V: 3, DRAG_H: 1.5, BUOY: 1.4, SWIM_UP: 16, DT_MAX: 1 / 20, JUMP_V: 9, CELL: 2
  };
  // decor blocker candidates near the body being moved: stride 5 = x, z, r, y0, y1
  var cand = new Float32Array(5 * 64), nc = 0;

  function gather(x, z, R) {
    nc = 0;
    var D = G.dungeon;
    if (D && D.active) return;
    var w = G.world, c0 = Math.floor((x - R) / 16), c1 = Math.floor((x + R) / 16), d0 = Math.floor((z - R) / 16), d1 = Math.floor((z + R) / 16), cx, cz, a, i;
    for (cx = c0; cx <= c1; cx++) for (cz = d0; cz <= d1; cz++) {
      a = w.decorBlockers(cx, cz);
      if (!a) continue;
      for (i = 0; i < a.length; i += 5) {
        if (a[i] < x - R || a[i] > x + R || a[i + 1] < z - R || a[i + 1] > z + R) continue;
        if (nc >= 64) return;
        var k = nc * 5; cand[k] = a[i]; cand[k + 1] = a[i + 1]; cand[k + 2] = a[i + 2]; cand[k + 3] = a[i + 3]; cand[k + 4] = a[i + 4]; nc++;
      }
    }
  }
  function smoothWorld() { return !!(W && W.surfaceHeight && !(G.dungeon && G.dungeon.active)); }
  // Take the highest point under the body's footprint so feet do not sink into a hillside.
  function groundY(x,z,r) {
    var f=W.surfaceHeight, q=Math.max(0,r||0)*0.7, h=f(x,z);
    if(q>0){h=Math.max(h,f(x-q,z-q),f(x+q,z-q),f(x-q,z+q),f(x+q,z+q));}
    return h;
  }
  function collides(b, x, y, z) {
    // The overworld is a triangle-meshed heightfield, not a stack of invisible voxel columns.
    // Smooth ground contact is resolved in move(); voxel collision remains for dungeon rooms.
    if (smoothWorld()) return false;
    var r = b.r, x0 = Math.floor(x - r + E), x1 = Math.floor(x + r - E), y0 = Math.floor(y + E), y1 = Math.floor(y + b.h - E),
        z0 = Math.floor(z - r + E), z1 = Math.floor(z + r - E), ix, iy, iz, s = W.solid;
    for (ix = x0; ix <= x1; ix++) for (iz = z0; iz <= z1; iz++) for (iy = y0; iy <= y1; iy++) if (s(ix, iy, iz)) return true;
    return false;
  }
  // push the body out of tree trunks / rocks (short cylinders), revert if that would push it into terrain
  function blk(b) {
    var i, k, dx, dz, d, rr, ox = b.x, oz = b.z, hit = false;
    for (i = 0; i < nc; i++) {
      k = i * 5;
      if (b.y >= cand[k + 4] || b.y + b.h <= cand[k + 3]) continue;
      dx = b.x - cand[k]; dz = b.z - cand[k + 1]; rr = b.r + cand[k + 2];
      d = dx * dx + dz * dz;
      if (d >= rr * rr) continue;
      d = Math.sqrt(d);
      if (d < 1e-4) { dx = 1; dz = 0; d = 1; }
      b.x = cand[k] + dx / d * rr; b.z = cand[k + 1] + dz / d * rr; hit = true;
    }
    if (hit && collides(b, b.x, b.y, b.z)) { b.x = ox; b.z = oz; }
  }

  P.blockedAt = function (x, y, z) {
    W = G.world;
    if (smoothWorld()) { if (y < groundY(x,z,0) + 0.18) return true; }
    else if (W.solid(x, y, z)) return true;
    gather(x, z, 1);
    for (var i = 0; i < nc; i++) {
      var k = i * 5, dx = x - cand[k], dz = z - cand[k + 1];
      if (y >= cand[k + 3] && y < cand[k + 4] && dx * dx + dz * dz < cand[k + 2] * cand[k + 2]) return true;
    }
    return false;
  };

  // body: {x,y(feet),z,vx,vy,vz,r(half width),h,onGround,inWater,mass, autoStep?, fly?, swimUp?}
  // out: onGround, inWater, wet (0..1 submerged), landV (impact speed this call), wasGround, splash (entry speed), hitX/hitZ, stepOk, stepDy (sum of auto step-ups, negative)
  P.move = function (b, dt) {
    W = G.world;
    var smooth = smoothWorld();
    if (dt > P.DT_MAX) dt = P.DT_MAX;
    if (!(dt > 0)) return;
    var wasGround = b.onGround, wasWater = b.inWater, i, n, s, nx, ny, sp;
    b.wasGround = wasGround; b.landV = 0; b.splash = 0; b.hitX = b.hitZ = false; b.stepOk = false; b.bt = (b.bt || 0) + dt;
    b.inWater = W.getBlock(b.x, b.y + b.h * 0.22, b.z) === W.WATER;
    b.wet = 0;
    if (!smooth && !b.inWater && wasGround && !b.fly && b.vy <= 0 && b.vx * b.vx + b.vz * b.vz < 1e-4 && collides(b, b.x, b.y - 0.05, b.z)) { b.vy = 0; return; } // resting: one cheap support check
    if (b.fly) { /* hover: no gravity */ }
    else if (b.inWater) {
      var f = (W.SEA - b.y) / (b.h * 0.85); f = f < 0 ? 0 : f > 1 ? 1 : f; b.wet = f;
      var a = -P.GRAV + P.GRAV * P.BUOY * f + (f > 0.3 && f < 1 ? Math.sin(b.bt * 2.4) * 0.8 : 0);
      if (b.swimUp) a += P.SWIM_UP;
      b.vy += a * dt; b.vy -= b.vy * Math.min(1, P.DRAG_V * dt);
      var dh = Math.min(1, P.DRAG_H * dt); b.vx -= b.vx * dh; b.vz -= b.vz * dh;
    } else b.vy = Math.max(-P.TERM, b.vy - P.GRAV * dt);
    if (b.inWater && !wasWater) {
      sp = Math.sqrt(b.vx * b.vx + b.vy * b.vy + b.vz * b.vz);
      if (sp > 2.5) { b.splash = sp; if (G.events) G.events.emit('splash', { x: b.x, y: W.SEA, z: b.z, speed: sp }); }
    }
    sp = Math.max(Math.abs(b.vx), Math.abs(b.vy), Math.abs(b.vz)) * dt;
    n = sp < SUB ? 1 : Math.min(8, Math.ceil(sp / SUB)); s = dt / n;
    gather(b.x, b.z, b.r + 0.9 + Math.sqrt(b.vx * b.vx + b.vz * b.vz) * dt);
    if (!smooth && collides(b, b.x, b.y, b.z) && !collides(b, b.x, b.y + 1, b.z)) b.y += 1;   // unstick (one block)
    b.onGround = false;
    for (i = 0; i < n; i++) {
      var startX = b.x, startZ = b.z;
      if (b.vx !== 0) {
        nx = b.x + b.vx * s;
        if (!collides(b, nx, b.y, b.z)) b.x = nx;
        else if (b.autoStep && (wasGround || b.inWater) && !collides(b, nx, b.y + P.STEP, b.z)) { b.x = nx; b.y += P.STEP; b.stepDy -= P.STEP; }
        else { b.hitX = true; if (!b.fly && !collides(b, nx, b.y + P.STEP, b.z)) b.stepOk = true; b.vx = 0; }
      }
      if (b.vz !== 0) {
        nx = b.z + b.vz * s;
        if (!collides(b, b.x, b.y, nx)) b.z = nx;
        else if (b.autoStep && (wasGround || b.inWater) && !collides(b, b.x, b.y + P.STEP, nx)) { b.z = nx; b.y += P.STEP; b.stepDy -= P.STEP; }
        else { b.hitZ = true; if (!b.fly && !collides(b, b.x, b.y + P.STEP, nx)) b.stepOk = true; b.vz = 0; }
      }
      if (nc) blk(b);
      if (smooth) {
        var floor = groundY(b.x, b.z, b.r);
        // Do not allow a grounded actor to climb a cliff higher than one block in a substep.
        if ((wasGround || b.onGround) && floor > b.y + P.STEP + 0.025) {
          b.x = startX; b.z = startZ; b.vx = b.vz = 0; floor = groundY(b.x, b.z, b.r);
        }
        ny = b.y + b.vy * s;
        if (ny <= floor) {
          if (b.y > floor + E && b.vy < 0) b.landV = Math.max(b.landV, -b.vy);
          b.y = floor; b.vy = 0; b.onGround = true;
        } else if (b.y < floor) {
          b.y = floor;
          if (b.vy <= 0) { b.vy = 0; b.onGround = true; }
        } else b.y = ny;
      } else {
        ny = b.y + b.vy * s;
        if (collides(b, b.x, ny, b.z)) {
          if (b.vy < 0) { if (-b.vy > b.landV) b.landV = -b.vy; b.y = Math.floor(ny + E) + 1; b.onGround = true; }
          else b.y = Math.floor(ny + b.h - E) - b.h;
          b.vy = 0;
        } else b.y = ny;
      }
    }
  };

  // displace a body without velocity (soft collisions); respects walls
  P.nudge = function (b, dx, dz) {
    W = G.world;
    if (!collides(b, b.x + dx, b.y, b.z)) b.x += dx;
    if (!collides(b, b.x, b.y, b.z + dz)) b.z += dz;
  };

  /* ---------- soft collisions: spatial hash (cell 2), one rebuild + one pass per frame ---------- */
  var HS = 256, MAXB = 64, head = new Int16Array(HS), nxt = new Int16Array(MAXB), arr = new Array(MAXB), cnt = 0, keys = new Int32Array(9);
  function hk(cx, cz) { return ((Math.imul(cx, 73856093) ^ Math.imul(cz, 19349663)) >>> 0) & (HS - 1); }
  function add(b) {
    if (cnt >= MAXB) return;
    var h = hk(Math.floor(b.x / P.CELL), Math.floor(b.z / P.CELL));
    arr[cnt] = b; nxt[cnt] = head[h]; head[h] = cnt; cnt++;
  }
  // list: creatures (only `act` and not `dead` ones take part); pl: player body or null. Bodies need sr (separation radius) and imass (0 = only pushes).
  P.separate = function (list, pl) {
    W = G.world; cnt = 0; head.fill(-1);
    var i, j, k, q, dx, dz, d, rr, ov, bi, bj, wi, wj, cx, cz, nk, h, dup, ox, oz;
    for (i = 0; i < list.length; i++) if (list[i].act && !list[i].dead) add(list[i]);
    if (pl) add(pl);
    for (i = 0; i < cnt; i++) {
      bi = arr[i]; cx = Math.floor(bi.x / P.CELL); cz = Math.floor(bi.z / P.CELL); nk = 0;
      for (ox = -1; ox <= 1; ox++) for (oz = -1; oz <= 1; oz++) {
        h = hk(cx + ox, cz + oz); dup = false;
        for (q = 0; q < nk; q++) if (keys[q] === h) { dup = true; break; }
        if (dup) continue;
        keys[nk++] = h;
        for (j = head[h]; j >= 0; j = nxt[j]) {
          if (j <= i) continue;
          bj = arr[j]; dx = bj.x - bi.x; dz = bj.z - bi.z;
          if (bj.y - bi.y > 1.5 || bi.y - bj.y > 1.5) continue;
          rr = bi.sr + bj.sr; d = dx * dx + dz * dz;
          if (d >= rr * rr) continue;
          d = Math.sqrt(d);
          if (d < 1e-3) { dx = 1; dz = 0; d = 1; }
          k = bi.imass + bj.imass; if (k <= 0) continue;
          ov = (rr - d) * 0.5; wi = bi.imass / k; wj = bj.imass / k;
          dx /= d; dz /= d;
          if (wi > 0) P.nudge(bi, -dx * ov * wi * 2, -dz * ov * wi * 2);
          if (wj > 0) P.nudge(bj, dx * ov * wj * 2, dz * ov * wj * 2);
        }
      }
    }
  };

  // sound + particles for landing and water entry (events are emitted by the player / phys.move)
  P.init = function () {
    var ev = G.events;
    ev.on('landed', function (d) {
      var p = G.player.pos, D = G.dungeon;
      if (G.fx) G.fx.burst(p.x, p.y + 0.05, p.z, 'dust', D && D.active ? 0 : G.world.topColor(p.x, p.z));
      if (G.audio) G.audio.play(d.speed > 14 ? 'landhard' : 'land');
    });
    ev.on('splash', function (d) {
      if (G.fx) G.fx.burst(d.x, d.y, d.z, 'splash', 0, Math.min(2, d.speed / 8));
      if (G.audio && d.speed > 5) G.audio.play(d.speed > 12 ? 'splashbig' : 'splash');
    });
    ev.on('hitwall', function () { if (G.audio) G.audio.play('hitwall'); });
    ev.on('bounce', function (d) {
      var p = G.player.pos, dx = d.x - p.x, dz = d.z - p.z;
      if (G.audio && dx * dx + dz * dz < 400) G.audio.play('bounce');
    });
  };
})();
