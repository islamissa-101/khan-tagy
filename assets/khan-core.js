// «Хан тағы» — шайқас логикасы (Tower Defense). DOM жоқ: браузерде де, Node-тағы баланс тестінде де жұмыс істейді.
(function (root) {
  'use strict';
  const D = root.KHAN_DATA;

  // Бойлық/ендік → карта бірлігі (480 × 260)
  const proj = (lon, lat) => [10 + (lon - 45.5) * (460 / 42), 8 + (55.8 - lat) * (244 / 15.5)];
  const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
  function segDist(p, a, b) {
    const vx = b[0] - a[0], vy = b[1] - a[1], L = vx * vx + vy * vy || 1;
    const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * vx + (p[1] - a[1]) * vy) / L));
    return Math.hypot(p[0] - a[0] - t * vx, p[1] - a[1] - t * vy);
  }
  function buildPath(ll, cap) {
    const pts = ll.map(([lo, la]) => proj(lo, la)).concat([proj(cap[1], cap[2])]);
    const cum = [0];
    for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + dist(pts[i - 1], pts[i]));
    return { pts, cum, len: cum[cum.length - 1] };
  }
  function at(path, d) {
    const { pts, cum } = path;
    let i = 1; while (i < pts.length - 1 && cum[i] < d) i++;
    const t = Math.max(0, Math.min(1, (d - cum[i - 1]) / (cum[i] - cum[i - 1] || 1)));
    const a = pts[i - 1], b = pts[i];
    return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, Math.atan2(b[1] - a[1], b[0] - a[0])];
  }
  // Мұнара орындары жау жолының бойында автоматты есептеледі
  function makeSlots(paths, avoid) {
    const out = [];
    const ok = (p) => p[0] > 10 && p[0] < 470 && p[1] > 10 && p[1] < 250 &&
      out.every((s) => dist(s, p) > 19) && avoid.every((c) => dist(c, p) > 16) &&
      paths.every((pa) => pa.pts.every((q, i) => i === 0 || segDist(p, pa.pts[i - 1], q) > 9));
    paths.forEach((pa, pi) => {
      [0.2, 0.36, 0.52, 0.68, 0.84].forEach((t, k) => {
        const [x, y, ang] = at(pa, pa.len * t);
        for (const side of (k + pi) % 2 ? [1, -1] : [-1, 1]) {
          for (const off of [15, 21]) {
            const p = [x + Math.cos(ang + Math.PI / 2) * off * side, y + Math.sin(ang + Math.PI / 2) * off * side];
            if (ok(p)) { out.push(p); return; }
          }
        }
      });
    });
    return out.slice(0, 14);
  }

  function createBattle(opt) {
    const S = D.STAGES[opt.stage - 1];
    const K = D.KHANS[opt.khan];
    const kid = opt.khan;
    const cap = proj(S.cap[1], S.cap[2]);
    const paths = S.paths.map((p) => buildPath(p, S.cap));
    const cities = S.cities.map(([name, lo, la]) => ({ name, p: proj(lo, la), lvl: 0 }));
    const slots = makeSlots(paths, [cap, ...cities.map((c) => c.p)]).map((p) => ({ p, t: null }));
    const W = D.waves(opt.stage);
    const B = {
      stage: opt.stage, S, K, kid, cap, paths, cities, slots, W,
      bars: Object.assign({ h: 50, a: 50, g: 50, b: 50 }, opt.bars || {}),
      gold: 0, lives: 3 + (kid === 8 ? 1 : 0), maxLives: 3 + (kid === 8 ? 1 : 0),
      wave: 0, n: W.length, state: 'build', enemies: [], shots: [], fx: [], queue: [], spawnT: 0,
      kills: 0, leaks: 0, time: 0, abCd: 0, healUsed: false, envoyNext: false, envoyUsed: 0,
      slowT: 0, stunT: 0, dmgT: 0, rateT: 0, spent: 0, events: [],
    };
    B.gold = D.startGold(opt.stage, B.bars.g);
    const emit = (type, data) => B.events.push(Object.assign({ type }, data || {}));
    const clamp = (v) => Math.max(0, Math.min(100, Math.round(v)));

    B.adjust = function (e, mul = 1) {
      for (const k of ['h', 'a', 'g', 'b']) if (e[k]) B.bars[k] = clamp(B.bars[k] + e[k] * (e[k] < 0 ? mul : 1));
      checkCrisis();
    };
    function checkCrisis() {
      for (const k of ['h', 'a', 'g', 'b']) {
        if (B.bars[k] <= 0) {
          B.bars[k] = 20;
          loseLife(1, 'crisis', k);
        }
      }
    }
    function loseLife(n, cause, k) {
      if (B.state === 'dead' || B.state === 'won') return;
      B.lives = Math.max(0, B.lives - n);
      emit(cause, { k });
      if (B.lives <= 0) { B.state = 'dead'; B.deathCause = cause === 'crisis' ? k : 'leak'; emit('dead', { cause: B.deathCause }); }
    }
    B.addLife = function () { B.lives = Math.min(B.maxLives + 1, B.lives + 1); if (B.state === 'dead') B.state = B.queue.length || B.enemies.length ? 'wave' : 'build'; };

    /* ---- құрылыс ---- */
    B.cost = function (type) {
      let c = D.TOWERS[type].cost * D.costMul(B.stage);
      if (type === 'spear' && kid === 6) c *= 0.8;
      return Math.round(c);
    };
    B.upCost = (t) => Math.round(B.cost(t.type) * 0.75 * t.lvl);
    B.build = function (i, type) {
      const s = slots[i]; if (!s || s.t || !D.TOWERS[type]) return false;
      const c = B.cost(type); if (B.gold < c) return false;
      B.gold -= c; B.spent += c; s.t = { type, lvl: 1, cd: 0, paid: c, ang: 0 }; emit('build'); return true;
    };
    B.upgrade = function (i) {
      const t = slots[i]?.t; if (!t || t.lvl >= 3) return false;
      const c = B.upCost(t); if (B.gold < c) return false;
      B.gold -= c; B.spent += c; t.paid += c; t.lvl++; emit('build'); return true;
    };
    B.sell = function (i) {
      const t = slots[i]?.t; if (!t) return false;
      B.gold += Math.floor(t.paid * 0.5); slots[i].t = null; return true;
    };
    B.cityCost = (c) => (c.lvl >= 3 ? Infinity : Math.round(D.CITY_COST[c.lvl] * D.costMul(B.stage)));
    B.upgradeCity = function (i) {
      const c = cities[i]; if (!c) return false;
      const cost = B.cityCost(c); if (B.gold < cost) return false;
      B.gold -= cost; B.spent += cost; c.lvl++; B.adjust({ h: 4, g: 3 }); emit('city'); return true;
    };
    B.income = function () {
      const city = cities.reduce((a, c) => a + c.lvl * D.CITY_INCOME, 0) * (kid === 2 ? 1.3 : 1);
      return Math.round(22 + B.bars.g * 0.35 + city);
    };

    /* ---- дипломатия: елші жіберу ---- */
    B.canEnvoy = () => B.state === 'build' && B.wave < B.n && B.bars.b >= 25 && !B.envoyNext;
    B.envoy = function () {
      if (!B.canEnvoy()) return false;
      B.bars.b = clamp(B.bars.b - 20); B.envoyNext = true; B.envoyUsed++; checkCrisis(); emit('envoy'); return true;
    };

    /* ---- толқын ---- */
    B.startWave = function () {
      if (B.state !== 'build' || B.wave >= B.n) return false;
      const g = W[B.wave]; B.wave++;
      const list = [];
      g.forEach(([type, cnt]) => {
        let c = cnt;
        if (B.envoyNext && type !== 'boss' && type !== 'chief') c = Math.ceil(cnt * 0.65);
        for (let i = 0; i < c; i++) list.push(type);
      });
      // араластыру: ауыр жаулар ортадан соңға қарай
      const order = { foot: 0, horse: 1, heavy: 2, chief: 3, boss: 4 };
      list.sort((a, b) => order[a] - order[b]);
      const mixed = []; const light = list.filter((t) => order[t] < 2), heavy = list.filter((t) => order[t] >= 2);
      light.forEach((t, i) => { mixed.push(t); if (heavy.length && i % 4 === 3) mixed.push(heavy.shift()); });
      B.queue = mixed.concat(heavy).map((type, i) => ({ type, path: i % paths.length }));
      B.envoyNext = false; B.spawnT = 0; B.state = 'wave'; emit('wave', { n: B.wave });
      return true;
    };
    function spawn(q) {
      const E = D.ENEMIES[q.type];
      const hp = E.hp * D.hpMul(B.stage, B.wave);
            // жылдамдық жолдың ұзындығына байланысты: жаяу әскер жолды travelT секундта өтеді
      const L = paths[q.path].len, spd = L / (D.travelT(B.stage) * (0.55 + 0.45 * L / 140) * E.tm) * (0.93 + ((B.enemies.length * 37) % 15) / 100);
      B.enemies.push({ type: q.type, path: q.path, d: 0, hp, max: hp, spd, gold: E.gold, dmg: E.dmg, x: 0, y: 0, hit: 0 });
    }

    /* ---- қабілет ---- */
    B.abilityReady = () => B.abCd <= 0 && !(K.act.id === 'heal' && B.healUsed);
    B.ability = function () {
      if (!B.abilityReady() || (B.state !== 'wave' && B.state !== 'build')) return false;
      const id = K.act.id;
      if (id === 'gather') B.gold += 70;
      else if (id === 'slow') B.slowT = 5;
      else if (id === 'law') B.adjust({ b: 15, h: 5 });
      else if (id === 'ally') damageAll(90);
      else if (id === 'rapid') B.rateT = 6;
      else if (id === 'heal') { if (B.lives >= B.maxLives + 1) return false; B.lives++; B.healUsed = true; }
      else if (id === 'orbulak') B.dmgT = 6;
      else if (id === 'biys') B.adjust({ h: 8, a: 8, g: 8, b: 8 });
      else if (id === 'strike') damageAll(160);
      else if (id === 'stun') B.stunT = 3;
      B.abCd = K.act.cd; emit('ability', { id }); return true;
    };
    function damageAll(n) { B.enemies.forEach((e) => hurt(e, n)); B.fx.push({ k: 'flash', t: 0.4 }); }
    function hurt(e, n) {
      if (e.hp <= 0) return;
      e.hp -= n; e.hit = 0.12;
      if (e.hp <= 0) {
        B.kills++;
        B.gold += Math.round(e.gold * (0.8 + B.bars.h / 250));
        B.fx.push({ k: 'pop', x: e.x, y: e.y, t: 0.35, c: e.type });
      }
    }

    const dmgMul = () => (0.6 + B.bars.a / 125) * (B.dmgT > 0 ? 2 : 1);
    const rateMul = () => (kid === 9 ? 1.15 : 1) * (B.rateT > 0 ? 2 : 1);
    B.range = (t) => D.TOWERS[t.type].range * (t.type === 'archer' && kid === 4 ? 1.2 : 1) * (1 + (t.lvl - 1) * 0.08);

    B.update = function (dt) {
      B.events.length = 0;
      if (B.state === 'dead' || B.state === 'won') return;
      B.time += dt;
      B.abCd = Math.max(0, B.abCd - dt);
      B.slowT = Math.max(0, B.slowT - dt); B.stunT = Math.max(0, B.stunT - dt);
      B.dmgT = Math.max(0, B.dmgT - dt); B.rateT = Math.max(0, B.rateT - dt);
      B.fx = B.fx.filter((f) => (f.t -= dt) > 0);
      if (B.state !== 'wave') return;

      // шығару
      B.spawnT -= dt;
      if (B.queue.length && B.spawnT <= 0) { spawn(B.queue.shift()); B.spawnT = Math.max(0.42, 0.95 - B.stage * 0.045); }

      // қозғалыс
      const sm = B.stunT > 0 ? 0 : B.slowT > 0 ? 0.5 : 1;
      for (const e of B.enemies) {
        if (e.hp <= 0) continue;
        e.hit = Math.max(0, e.hit - dt);
        e.d += e.spd * sm * dt;
        const pa = paths[e.path];
        const [x, y, ang] = at(pa, e.d); e.x = x; e.y = y; e.ang = ang;
        if (e.d >= pa.len) { e.hp = 0; e.leaked = true; B.leaks++; B.adjust({ h: -5 }); loseLife(e.dmg, 'leak'); if (B.state === 'dead') break; }
      }
      if (B.state === 'dead') return;

      // мұнаралар
      for (const s of slots) {
        const t = s.t; if (!t) continue;
        t.cd -= dt * rateMul();
        if (t.cd > 0) continue;
        const T = D.TOWERS[t.type], r = B.range(t);
        let best = null;
        for (const e of B.enemies) if (e.hp > 0 && dist(s.p, [e.x, e.y]) <= r && (!best || e.d / paths[e.path].len > best.d / paths[best.path].len)) best = e;
        if (!best) continue;
        t.cd = 1 / T.rate;
        t.ang = Math.atan2(best.y - s.p[1], best.x - s.p[0]);
        const dmg = T.dmg * D.UPG_MUL[t.lvl - 1] * dmgMul();
        if (T.splash) B.shots.push({ x: s.p[0], y: s.p[1], tx: best.x, ty: best.y, t: 0.55, T: 0.55, dmg, r: T.splash });
        else { hurt(best, dmg); B.fx.push({ k: t.type, x1: s.p[0], y1: s.p[1], x2: best.x, y2: best.y, t: 0.12 }); }
      }
      // манжаниқ тастары
      B.shots = B.shots.filter((sh) => {
        sh.t -= dt;
        if (sh.t > 0) return true;
        for (const e of B.enemies) if (e.hp > 0 && dist([sh.tx, sh.ty], [e.x, e.y]) <= sh.r) hurt(e, sh.dmg);
        B.fx.push({ k: 'boom', x: sh.tx, y: sh.ty, t: 0.3, r: sh.r });
        return false;
      });
      B.enemies = B.enemies.filter((e) => e.hp > 0);

      // толқын бітті
      if (!B.queue.length && !B.enemies.length && !B.shots.length) {
        const inc = B.income();
        B.gold += inc; B.adjust({ b: 3 });
        if (B.wave >= B.n) { B.state = 'won'; emit('won'); }
        else { B.state = 'build'; emit('waveEnd', { income: inc }); }
      }
    };
    return B;
  }

  root.KHAN_CORE = { createBattle, proj };
})(typeof window !== 'undefined' ? window : globalThis);
