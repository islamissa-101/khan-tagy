// «Қазақ хандығы: Хан тағы» — интерфейс, карта, кеңес, сұрақтар, сервермен байланыс
(function () {
  'use strict';
  const D = window.KHAN_DATA, C = window.KHAN_CORE, TT = window.TR_TRACKS, TR = window.TR;
  if (!TR || !D || !C) return;
  const $ = (s) => document.querySelector(s);
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const shuffle = (a) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const shuffleDiff = (a) => { if (a.length < 2) return a.slice(); let s; do s = shuffle(a); while (s.every((v, i) => v === a[i])); return s; };
  const TYPE_LABEL = { single: 'Бір дұрыс жауап', fill: 'Бос орынды толтыру', order: 'Хронологиялық рет', match: 'Сәйкестендіру', map: 'Карта бойынша', image: 'Сурет / артефакт' };
  const store = { get(k, d) { try { const v = JSON.parse(localStorage.getItem(k)); return v ?? d; } catch (_) { return d; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (_) { /* жеке режим */ } } };

  /* ================= БАПТАУЛАР + ДЫБЫС ================= */
  const SET = Object.assign({ sfx: true, music: false, help: true }, store.get('khanSet', {}));
  let AC = null, musicT = null;
  function ac() { if (!AC) { try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch (_) { AC = null; } } if (AC && AC.state === 'suspended') AC.resume(); return AC; }
  function tone(f, dur, type = 'triangle', vol = 0.12, slide = 0, when = 0) {
    const a = ac(); if (!a) return;
    const t = a.currentTime + when, o = a.createOscillator(), g = a.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t); if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, f + slide), t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(a.destination); o.start(t); o.stop(t + dur + 0.02);
  }
  function noise(dur, vol = 0.08, hp = 800) {
    const a = ac(); if (!a) return;
    const b = a.createBuffer(1, Math.floor(a.sampleRate * dur), a.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
    const s = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain();
    f.type = 'highpass'; f.frequency.value = hp; g.gain.value = vol; s.buffer = b; s.connect(f).connect(g).connect(a.destination); s.start();
  }
  const SFX = {
    click() { if (SET.sfx) tone(320, 0.06, 'square', 0.05); },
    paper() { if (SET.sfx) noise(0.22, 0.07, 1800); },
    sword() { if (SET.sfx) { noise(0.12, 0.06, 3000); tone(1400, 0.18, 'sawtooth', 0.03, 900); } },
    ok() { if (SET.sfx) [523, 659, 784].forEach((f, i) => tone(f, 0.18, 'triangle', 0.1, 0, i * 0.08)); },
    bad() { if (SET.sfx) [330, 247].forEach((f, i) => tone(f, 0.25, 'sawtooth', 0.06, 0, i * 0.12)); },
    arrow() { if (SET.sfx && Math.random() < 0.35) tone(900, 0.04, 'square', 0.015, -300); },
    boom() { if (SET.sfx) { noise(0.25, 0.08, 200); tone(90, 0.25, 'sine', 0.12, -40); } },
    build() { if (SET.sfx) { tone(180, 0.08, 'square', 0.06); tone(240, 0.08, 'square', 0.05, 0, 0.07); } },
    alarm() { if (SET.sfx) [440, 330, 440].forEach((f, i) => tone(f, 0.16, 'square', 0.05, 0, i * 0.15)); },
    win() { if (SET.sfx) [392, 523, 659, 784, 1046].forEach((f, i) => tone(f, 0.3, 'triangle', 0.1, 0, i * 0.12)); },
  };
  // Домбыра сарыны: пентатоника, екі ішекті «шертпе»
  const PENTA = [146.8, 174.6, 196, 220, 261.6, 293.7, 349.2, 392];
  function musicTick() {
    let i = 3, step = 0;
    musicT = setInterval(() => {
      if (!SET.music) return;
      step++; if (step % 8 === 0) i = 2 + Math.floor(Math.random() * 3);
      i = Math.max(0, Math.min(PENTA.length - 1, i + [-1, 0, 1, 1, -1, 2, -2][Math.floor(Math.random() * 7)]));
      const f = PENTA[i];
      tone(f, 0.5, 'triangle', 0.035); if (step % 2 === 0) tone(f * 1.5, 0.35, 'triangle', 0.02, 0, 0.01);
      if (step % 4 === 0) tone(73.4, 0.9, 'sine', 0.03);
    }, 280);
  }
  function setMusic(on) { if (on && !musicT) { ac(); musicTick(); } if (!on && musicT) { clearInterval(musicT); musicT = null; } }

  /* ================= ЭКРАНДАР ================= */
  const SCREENS = ['menu', 'khan', 'stage', 'loading', 'intro', 'question', 'death', 'nohelp', 'pause', 'result', 'shez', 'set'];
  function show(name) {
    $('#overlay').classList.remove('hidden');
    SCREENS.forEach((s) => $('#scr-' + s).classList.toggle('hidden', s !== name));
  }
  function hideOverlay() { $('#overlay').classList.add('hidden'); }
  function toast(msg, bad) {
    const t = el('div', bad ? 'bad' : null, msg); $('#toast').appendChild(t);
    setTimeout(() => t.remove(), 2700);
  }
  let centerT = null;
  function center(big, small, ms = 1600) {
    const c = $('#center'); c.textContent = big;
    if (small) { const s = el('small', null, small); c.appendChild(s); }
    c.classList.remove('hidden'); clearTimeout(centerT); centerT = setTimeout(() => c.classList.add('hidden'), ms);
  }
  document.querySelectorAll('[data-back]').forEach((b) => b.addEventListener('click', () => { SFX.click(); show(b.dataset.back); }));

  /* ================= КҮЙ ================= */
  let S = null, P = null;
  const G = { khan: store.get('khanIdx', 0), stage: store.get('khanStage', 1), won: new Set(), admin: false };
  let RUN = null; // ағымдағы кезең
  let MODE = 'menu'; // menu | council | battle

  async function boot() {
    S = await TR.session();
    if (!S) { location.href = TR.hubUrl(); return; }
    P = await TR.profile();
    G.admin = !!P?.is_admin;
    $('#who').textContent = 'Ойыншы: ' + TR.displayName(P, S) + (G.admin ? ' · админ (барлық кезең ашық)' : '');
    await loadProgress();
    buildBars(); renderKhans(); renderStages();
    $('#setSfx').checked = SET.sfx; $('#setMusic').checked = SET.music; $('#setHelp').checked = SET.help;
    show('menu');
  }
  async function loadProgress() {
    const { data } = await TR.sb.from('khan_games').select('stage').eq('user_id', S.user.id).eq('status', 'won');
    G.won = new Set((data || []).map((r) => r.stage));
  }
  const unlocked = (n) => G.admin || n === 1 || G.won.has(n - 1);

  /* ---- мәзір ---- */
  $('#mPlay').onclick = () => { SFX.click(); ac(); setMusic(SET.music); show('khan'); };
  $('#mShez').onclick = () => { SFX.paper(); renderShez(); show('shez'); };
  $('#mSet').onclick = () => { SFX.click(); show('set'); };
  $('#setSfx').onchange = (e) => { SET.sfx = e.target.checked; store.set('khanSet', SET); };
  $('#setMusic').onchange = (e) => { SET.music = e.target.checked; store.set('khanSet', SET); setMusic(SET.music); };
  $('#setHelp').onchange = (e) => { SET.help = e.target.checked; store.set('khanSet', SET); };

  function renderKhans() {
    const box = $('#khans'); box.innerHTML = '';
    D.KHANS.forEach((k, i) => {
      const b = el('button', 'khan' + (i === G.khan ? ' sel' : ''));
      const h = el('div', 'kh'); const cr = el('div', 'crest', k.name[0]); cr.style.background = `linear-gradient(135deg,${k.col[0]},${k.col[1]})`;
      const nm = el('div'); nm.appendChild(el('div', 'kn', k.name)); nm.appendChild(el('div', 'kl', k.life)); h.appendChild(cr); h.appendChild(nm); b.appendChild(h);
      b.appendChild(el('div', 'kl', 'Дәуірі: ' + k.era));
      b.appendChild(el('div', 'kb', k.bio));
      const mini = el('div', 'mini');
      D.BARS.forEach((bar) => { const v = 50 + (k.st[bar.k] || 0); const i2 = el('i'); i2.title = bar.name + ': ' + v; const u = el('u'); u.style.width = v + '%'; u.style.background = bar.col; i2.appendChild(u); mini.appendChild(i2); });
      b.appendChild(mini);
      b.appendChild(el('div', 'ka', '⚡ ' + k.act.n + ': ' + k.act.d));
      b.appendChild(el('div', 'kp', '✦ ' + k.pas));
      b.onclick = () => { SFX.click(); G.khan = i; store.set('khanIdx', i); renderKhans(); };
      box.appendChild(b);
    });
  }
  $('#khanNext').onclick = () => { SFX.click(); renderStages(); show('stage'); };

  function renderStages() {
    $('#selKhan').textContent = D.KHANS[G.khan].name;
    if (!unlocked(G.stage)) G.stage = 1;
    const box = $('#stages'); box.innerHTML = '';
    D.STAGES.forEach((s) => {
      const lock = !unlocked(s.n);
      const b = el('button', 'stg' + (s.n === G.stage ? ' sel' : '') + (lock ? ' locked' : '') + (G.won.has(s.n) ? ' done' : '') + (s.boss ? ' boss' : ''));
      b.appendChild(el('div', 'sn', (lock ? '🔒 ' : '') + s.n + (G.won.has(s.n) ? ' ✓' : '')));
      b.appendChild(el('div', 'st1', s.t));
      b.appendChild(el('div', 'sy', s.y));
      b.appendChild(el('div', 'ss', s.boss ? 'BOSS' : '⭐'.repeat(s.diff)));
      b.onclick = () => { if (lock) { toast('Алдымен ' + (s.n - 1) + '-кезеңді жеңіп өтіңіз', true); return; } SFX.click(); G.stage = s.n; store.set('khanStage', s.n); renderStages(); };
      box.appendChild(b);
    });
  }
  $('#stageGo').onclick = () => startStage();

  function renderShez() {
    const box = $('#shezList'); box.innerHTML = '';
    D.STAGES.forEach((s) => {
      const open = G.won.has(s.n) || G.admin;
      const a = el('article', open ? null : 'locked');
      a.appendChild(el('h3', null, s.n + '. ' + s.t + ' · ' + s.y));
      a.appendChild(el('p', null, open ? s.hist : '🔒 Бұл кезеңді жеңгенде ашылады.'));
      box.appendChild(a);
    });
  }

  /* ================= КӨРСЕТКІШТЕР ================= */
  const barEls = {};
  function buildBars() {
    const box = $('#bars'); box.innerHTML = '';
    D.BARS.forEach((b) => {
      const d = el('div', 'bar'); const sm = el('small'); sm.appendChild(document.createTextNode(b.ico + ' ' + b.name + ' ')); const v = el('b', null, '50'); sm.appendChild(v);
      const i = el('i'); const u = el('u'); u.style.background = b.col; i.appendChild(u);
      const pv = el('span', 'pv'); d.appendChild(sm); d.appendChild(i); d.appendChild(pv); box.appendChild(d);
      barEls[b.k] = { d, v, u, pv, last: null };
    });
  }
  function hud() {
    const B = RUN?.B; if (!B) return;
    for (const k of ['h', 'a', 'g', 'b']) {
      const e = barEls[k], v = B.bars[k];
      if (e.last !== v) {
        if (e.last != null) { e.d.classList.remove('flash-up', 'flash-dn'); void e.d.offsetWidth; e.d.classList.add(v > e.last ? 'flash-up' : 'flash-dn'); setTimeout(() => e.d.classList.remove('flash-up', 'flash-dn'), 600); }
        e.last = v; e.v.textContent = v; e.u.style.width = v + '%'; e.d.classList.toggle('low', v <= 15);
      }
    }
    const hl = '♥'.repeat(B.lives) + '♡'.repeat(Math.max(0, B.maxLives - B.lives));
    if ($('#hLives').textContent !== hl) $('#hLives').textContent = hl;
    const g = String(B.gold); if ($('#hGold').textContent !== g) $('#hGold').textContent = g;
    $('#hWave').textContent = B.wave + '/' + B.n;
    if (MODE === 'battle') dock();
  }
  function preview(e) {
    for (const k of ['h', 'a', 'g', 'b']) {
      const v = e ? e[k] || 0 : 0, pv = barEls[k].pv;
      pv.className = 'pv' + (v > 0 ? ' up' : v < 0 ? ' dn' : '');
      pv.textContent = v === 0 ? '' : (v > 0 ? '▲' : '▼').repeat(Math.abs(v) >= 15 ? 2 : 1);
    }
  }

  /* ================= КЕЗЕҢДІ БАСТАУ (сервер) ================= */
  let starting = false;
  async function startStage() {
    if (starting) return; starting = true;
    show('loading'); $('#loadMsg').textContent = 'Сервер кезеңді дайындауда…'; $('#loadBtns').classList.add('hidden');
    let data;
    try { data = await TR.fn('khan-start', { stage: G.stage, khan_idx: G.khan }); }
    catch (e) {
      starting = false;
      if (e.code === 'unauthorized') { location.href = TR.hubUrl(); return; }
      $('#loadMsg').textContent = e.code === 'stage_locked' ? 'Бұл кезең әлі жабық: алдымен алдыңғы кезеңді жеңіп өтіңіз.' : e.code === 'rate_limit' ? 'Жаңа кезеңді 15 секундта бір рет бастауға болады. Сәл күтіп, қайталаңыз.' : e.message;
      $('#loadBtns').classList.remove('hidden'); return;
    }
    starting = false;
    const K = D.KHANS[G.khan], bars = { h: 50, a: 50, g: 50, b: 50 };
    for (const k in K.st) bars[k] += K.st[k];
    RUN = { id: data.game_id, dq: data.decisions, mq: data.med, dn: 0, meds: 0, asked: new Set(), ev: 0, t0: performance.now(), stage: G.stage, S: D.STAGES[G.stage - 1], K, correct: 0, wrong: 0, finished: false, sel: null };
    RUN.B = C.createBattle({ stage: G.stage, khan: G.khan, bars });
    setView(); for (const k in barEls) barEls[k].last = null;
    const s = RUN.S;
    $('#iEy').textContent = s.n + '-КЕЗЕҢ · ' + s.y + ' · ' + K.name;
    $('#iTitle').textContent = s.t;
    $('#iHist').textContent = s.hist;
    $('#iGoal').textContent = s.goal; $('#iEnemy').textContent = s.enemy; $('#iDiff').textContent = s.boss ? 'BOSS' : '⭐'.repeat(s.diff);
    SFX.paper(); show('intro');
  }
  $('#loadRetry').onclick = () => startStage();
  $('#introGo').onclick = () => { SFX.click(); hideOverlay(); MODE = 'council'; setView(); $('#top').classList.remove('hidden'); $('#council').classList.remove('hidden'); showCard(); };

  /* ================= КЕҢЕС (карточкалар) ================= */
  const card = $('#card');
  function evMul() { return D.evMul(RUN.stage) * (G.khan === 7 ? 0.7 : 1); }
  function showCard() {
    const ev = RUN.S.events[RUN.ev];
    $('#cStep').textContent = 'КЕҢЕС · ' + (RUN.ev + 1) + '/' + RUN.S.events.length;
    $('#cAva').textContent = ev.who[0]; $('#cWho').textContent = ev.who; $('#cText').textContent = ev.text;
    $('#cImp').classList.toggle('hidden', !ev.imp);
    $('#cLt').textContent = ev.L.t; $('#cRt').textContent = ev.R.t;
    $('#hintL').textContent = ev.L.t; $('#hintR').textContent = ev.R.t;
    card.className = ''; card.style.transform = ''; card.style.opacity = 1; setHints(0);
    hud(); preview(null);
  }
  function setHints(dx) { $('#hintL').style.opacity = Math.min(1, Math.max(0, -dx / 90)); $('#hintR').style.opacity = Math.min(1, Math.max(0, dx / 90)); }
  function choose(side) {
    if (MODE !== 'council' || card.classList.contains('out')) return;
    const ev = RUN.S.events[RUN.ev], ch = ev[side];
    card.classList.add('out'); card.style.transform = `translateX(${side === 'R' ? 140 : -140}%) rotate(${side === 'R' ? 22 : -22}deg)`; card.style.opacity = 0;
    SFX.paper(); preview(null);
    setTimeout(() => {
      RUN.B.adjust(ch.e, evMul()); hud(); readEvents();
      afterDeath(() => {
        if (ev.imp) decision(nextCard); else nextCard();
      });
    }, 330);
  }
  function nextCard() {
    RUN.ev++;
    if (RUN.ev < RUN.S.events.length) showCard();
    else startBattle();
  }
  // карточканы сырғыту
  let drag = null;
  card.addEventListener('pointerdown', (e) => { if (MODE !== 'council') return; drag = { x: e.clientX, dx: 0 }; card.classList.add('drag'); card.setPointerCapture(e.pointerId); });
  card.addEventListener('pointermove', (e) => {
    if (!drag) return; drag.dx = e.clientX - drag.x;
    card.style.transform = `translateX(${drag.dx}px) rotate(${drag.dx / 18}deg)`; setHints(drag.dx);
    const ev = RUN.S.events[RUN.ev]; preview(Math.abs(drag.dx) > 30 ? (drag.dx > 0 ? ev.R.e : ev.L.e) : null);
  });
  const endDrag = () => { if (!drag) return; const dx = drag.dx; drag = null; card.classList.remove('drag'); if (Math.abs(dx) > 95) choose(dx > 0 ? 'R' : 'L'); else { card.style.transform = ''; setHints(0); preview(null); } };
  card.addEventListener('pointerup', endDrag); card.addEventListener('pointercancel', endDrag);
  for (const side of ['L', 'R']) {
    const b = $('#c' + side);
    b.onclick = () => choose(side);
    b.onmouseenter = () => { if (MODE === 'council') preview(RUN.S.events[RUN.ev][side].e); };
    b.onmouseleave = () => preview(null);
    b.onfocus = b.onmouseenter; b.onblur = b.onmouseleave;
  }

  /* ================= «ТАРИХИ ШЕШІМ» ================= */
  function decision(done) {
    const q = RUN.dq[RUN.dn]; RUN.dn++;
    if (!q) { done(); return; }
    const slot = RUN.dn;
    question(q, 'decision', slot, (ok) => {
      const B = RUN.B;
      if (ok) { B.adjust({ g: 20 }); B.gold += 20; RUN.bonusGold = (RUN.bonusGold || 0) + 20; toast('Тарихи шешім дұрыс: Қазына +20, алтын +20'); }
      else { const pen = G.khan === 5 ? 5 : 10; B.adjust({ a: -pen }); toast('Қате шешім: Әскер −' + pen + '%', true); }
      hud(); readEvents();
      afterDeath(done);
    });
  }

  /* ================= СҰРАҚ (6 түр) ================= */
  let Q = null; // ашық сұрақ
  function question(q, kind, slot, done) {
    RUN.asked.add(q.id);
    const prevMode = MODE; MODE = 'question';
    const tmax = D.qTime(RUN.stage); Q = { t: tmax, max: tmax, active: true, timeout: null };
    $('#qTag').textContent = kind === 'med' ? 'МЕДИЦИНАЛЫҚ КӨМЕК' : 'ТАРИХИ ШЕШІМ · ' + slot + '/3';
    $('#qRule').textContent = kind === 'med' ? 'Дұрыс → +1 жан · Қате → медициналық көмек көрсетілмейді' : 'Дұрыс → ресурс +20 (Қазына) · Қате → әскер −' + (G.khan === 5 ? 5 : 10) + '%';
    $('#qType').textContent = TYPE_LABEL[q.type] || q.type;
    $('#qText').textContent = q.prompt;
    const body = $('#qBody'); body.innerHTML = '';
    const fb = $('#qFb'); fb.className = 'fb hidden'; fb.textContent = '';
    const next = $('#qNext'); next.classList.add('hidden');
    const wait = $('#qWait'); wait.classList.add('hidden');
    let sent = false; const optBtns = [];
    const lock = () => body.querySelectorAll('button,input').forEach((b) => { b.disabled = true; });
    const submit = async (answer, timeout) => {
      if (sent) return; sent = true; Q.active = false; lock();
      wait.textContent = 'Сервер тексеруде…'; wait.classList.remove('hidden');
      let res;
      try { res = await TR.fn('khan-answer', { game_id: RUN.id, question_id: q.id, kind, slot: kind === 'decision' ? slot : undefined, answer }); }
      catch (e) {
        if (e.code === 'unauthorized') { location.href = TR.hubUrl(); return; }
        wait.textContent = e.message + ' ';
        const r = el('button', 'btn', 'Қайталау'); r.onclick = () => { r.remove(); sent = false; submit(answer, timeout); }; wait.appendChild(r); return;
      }
      wait.classList.add('hidden');
      const ok = !!res.correct;
      if (ok) RUN.correct++; else RUN.wrong++;
      if (['single', 'image', 'map'].includes(q.type)) optBtns.forEach((b) => { const ca = String(res.correct_answer).split(' — ')[0]; const hit = q.type === 'map' ? b.textContent.startsWith(ca + ' ') : b.textContent.endsWith(ca); if (hit) b.classList.add('ok'); else if (b._picked) b.classList.add('bad'); });
      (ok ? SFX.ok : SFX.bad)();
      fb.className = 'fb ' + (ok ? 'ok' : 'bad');
      fb.appendChild(el('b', null, ok ? 'Дұрыс!' : timeout ? 'Уақыт бітті!' : 'Қате!'));
      const msg = ok ? (kind === 'med' ? '+1 жан. Хандық қайта аяққа тұрды.' : 'Ресурс +20.') : 'Дұрыс жауап: ' + res.correct_answer + (kind === 'med' ? '' : '. Әскер −' + (G.khan === 5 ? 5 : 10) + '%.');
      fb.appendChild(el('span', null, msg));
      next.classList.remove('hidden'); next.focus();
      next.onclick = () => { SFX.click(); Q = null; MODE = prevMode; hideOverlay(); done(ok, q); };
    };
    Q.timeout = () => submit({ timeout: true }, true);
    Q.key = null;
    if (q.type === 'map' || q.type === 'image') {
      const fig = el('div', 'qfig'); fig.innerHTML = q.type === 'map' ? TT.mapSVG(q.data.points || []) : artSVG(q.data.img); body.appendChild(fig);
    }
    if (['single', 'map', 'image'].includes(q.type)) {
      const wrap = el('div', 'opts' + (q.type === 'map' ? ' opts4' : '')); const base = (q.data.options || []).map((t, i) => ({ t, i }));
      const opts = q.type === 'map' ? base : shuffle(base);
      opts.forEach((o, k) => { const b = el('button', 'opt', q.type === 'map' ? o.t + ' нүктесі' : 'ABCD'[k] + ')  ' + o.t); b.onclick = () => { b._picked = true; submit({ index: o.i }); }; optBtns.push(b); wrap.appendChild(b); });
      body.appendChild(wrap);
      Q.key = (e) => { let i = ['1', '2', '3', '4'].indexOf(e.key); if (i < 0) i = ['a', 'b', 'c', 'd'].indexOf(String(e.key).toLowerCase()); if (i >= 0 && optBtns[i] && !optBtns[i].disabled) optBtns[i].click(); };
    } else if (q.type === 'fill') {
      const f = el('form', 'row'); const inp = el('input', 'txt'); inp.maxLength = 40; inp.placeholder = 'Жауапты жазыңыз'; inp.autocomplete = 'off';
      const b = el('button', 'btn', 'Тексеру'); b.type = 'submit'; f.appendChild(inp); f.appendChild(b);
      f.onsubmit = (e) => { e.preventDefault(); const v = inp.value.slice(0, 40); if (!v.trim()) { inp.focus(); return; } submit({ text: v }); };
      body.appendChild(f); setTimeout(() => { if (!matchMedia('(pointer:coarse)').matches) inp.focus(); }, 60);
    } else if (q.type === 'order') {
      const slots = el('div', 'slots'), chips = el('div', 'chips'); const picked = []; const items = shuffleDiff(q.data.items || []); const n = items.length; let chk;
      const draw = () => { slots.innerHTML = ''; for (let i = 0; i < n; i++) slots.appendChild(el('div', 'slot' + (picked[i] ? ' f' : ''), (i + 1) + '. ' + (picked[i] || '…'))); chk.disabled = picked.length < n; };
      items.forEach((t) => { const b = el('button', 'chipb', t); b.onclick = () => { if (picked.length >= n) return; picked.push(t); b.disabled = true; SFX.click(); draw(); }; chips.appendChild(b); });
      const row = el('div', 'row'); const clr = el('button', 'btn ghost', 'Тазалау'); chk = el('button', 'btn', 'Тексеру');
      clr.onclick = () => { picked.length = 0; chips.querySelectorAll('button').forEach((b) => { b.disabled = false; }); draw(); };
      chk.onclick = () => submit({ items: picked.slice() });
      row.appendChild(clr); row.appendChild(chk); body.appendChild(slots); body.appendChild(chips); body.appendChild(row); draw();
    } else if (q.type === 'match') {
      const COLS = ['#D4AF37', '#3FA9D6', '#E2574C', '#59C795'];
      const cols = el('div', 'mcols'), L = el('div'), R = el('div'); cols.appendChild(L); cols.appendChild(R);
      const lefts = (q.data.left || []).slice(), rights = shuffleDiff(q.data.right || []); const map = new Map(); let sel = null; const lb = {}, rb = {}; let chk;
      const draw = () => {
        lefts.forEach((l, i) => { const b = lb[l]; b.classList.toggle('sel', sel === l); b.style.borderColor = map.has(l) ? COLS[i % 4] : 'transparent'; });
        rights.forEach((r) => { let ci = -1; map.forEach((v, k) => { if (v === r) ci = lefts.indexOf(k); }); rb[r].style.borderColor = ci >= 0 ? COLS[ci % 4] : 'transparent'; });
        chk.disabled = map.size < lefts.length;
      };
      lefts.forEach((l) => { const b = el('button', 'mb', l); b.onclick = () => { if (map.has(l)) { map.delete(l); sel = null; } else sel = sel === l ? null : l; draw(); }; lb[l] = b; L.appendChild(b); });
      rights.forEach((r) => { const b = el('button', 'mb', r); b.onclick = () => { map.forEach((v, k) => { if (v === r) map.delete(k); }); if (sel) { map.set(sel, r); sel = null; } draw(); }; rb[r] = b; R.appendChild(b); });
      const row = el('div', 'row'); chk = el('button', 'btn', 'Тексеру'); chk.onclick = () => submit({ pairs: [...map.entries()] }); row.appendChild(chk);
      body.appendChild(el('p', 'note', 'Алдымен сол жақтағыны, сосын оған сәйкес оң жақтағыны басыңыз.')); body.appendChild(cols); body.appendChild(row); draw();
    }
    show('question');
  }
  function artSVG(id) {
    if (D.ART[id]) return '<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Артефакт">' + D.ART[id] + '</svg>';
    return TT.artSVG(id);
  }

  /* ================= ЖАН БІТКЕНДЕ ================= */
  let resumeAfterDeath = null;
  function afterDeath(cont) {
    if (RUN.B.state !== 'dead') { cont(); return; }
    resumeAfterDeath = cont; onDeath();
  }
  function onDeath() {
    const B = RUN.B; const prev = MODE; RUN.modeBeforeDeath = prev === 'question' ? RUN.modeBeforeDeath : prev; MODE = 'dead';
    closePop(); SFX.alarm();
    const k = B.deathCause;
    $('#dCause').textContent = k && D.CRISIS[k] ? '«' + D.CRISIS[k][0] + '» — ' + D.CRISIS[k][1] : 'Жау ордаға жетіп, шаңырақ шайқалды.';
    const left = Math.min(2 - RUN.meds, RUN.mq.filter((q) => !RUN.asked.has(q.id)).length);
    $('#dYes').classList.toggle('hidden', left <= 0);
    $('#dNo').textContent = left > 0 ? 'Жоқ' : 'Нәтижені сақтау';
    $('#dLeft').textContent = left > 0 ? 'Қалған көмек: ' + left + ' / 2' : 'Көмек лимиті бітті: бір кезеңде екі реттен артық көмек берілмейді.';
    show('death');
  }
  $('#dYes').onclick = () => {
    const q = RUN.mq.find((x) => !RUN.asked.has(x.id)); if (!q) { onDeath(); return; }
    SFX.click();
    question(q, 'med', 0, (ok) => {
      RUN.meds++;
      if (ok) {
        RUN.B.addLife(); MODE = RUN.modeBeforeDeath === 'council' || RUN.modeBeforeDeath === 'battle' ? RUN.modeBeforeDeath : (RUN.B.wave ? 'battle' : 'council');
        toast('+1 жан!'); hud();
        const c = resumeAfterDeath; resumeAfterDeath = null; if (c) c();
      } else { MODE = 'dead'; show('nohelp'); }
    });
  };
  $('#dNo').onclick = () => finish(false);
  $('#nhRestart').onclick = async () => { await finish(false, true); startStage(); };
  $('#nhSave').onclick = () => finish(false);

  /* ================= ШАЙҚАС ================= */
  function startBattle() {
    const B = RUN.B;
    $('#council').classList.add('hidden');
    B.gold = D.startGold(RUN.stage, B.bars.g) + (RUN.bonusGold || 0); // Қазына көрсеткіші бастапқы алтынды анықтайды
    MODE = 'battle'; setView();
    $('#dock').classList.remove('hidden');
    $('#abName').textContent = '⚡ ' + RUN.K.act.n; $('#abSub').textContent = RUN.K.act.d;
    $('#helpTip').classList.toggle('hidden', !SET.help);
    center(RUN.S.t, 'Әскер орналастырып, «Шабуыл ▶» басыңыз', 2200);
    hud();
  }
  function dock() {
    const B = RUN.B;
    const wb = $('#waveBtn');
    const building = B.state === 'build';
    wb.disabled = !building;
    wb.firstChild.textContent = building ? (B.wave + 1 === B.n ? 'Соңғы шабуыл ▶' : 'Шабуыл ▶') : 'Шайқас…';
    $('#waveSub').textContent = building ? (B.wave + 1) + '-толқын / ' + B.n : B.queue.length + B.enemies.length + ' жау қалды';
    $('#envoyBtn').disabled = !B.canEnvoy();
    const ab = $('#abBtn'), ready = B.abilityReady();
    ab.disabled = !ready; ab.classList.toggle('ready', ready);
    $('#abSub').textContent = ready ? RUN.K.act.d : (RUN.K.act.id === 'heal' && B.healUsed ? 'Қолданылды' : 'Дайын болады: ' + Math.ceil(B.abCd) + ' с');
  }
  $('#waveBtn').onclick = () => {
    const B = RUN.B; if (MODE !== 'battle' || B.state !== 'build') return;
    closePop(); $('#helpTip').classList.add('hidden');
    const go = () => { if (B.startWave()) { SFX.sword(); center(B.wave + '-ТОЛҚЫН', RUN.S.enemy, 1300); } };
    if (B.wave + 1 === B.n && RUN.dn < 3) { center('ТАРИХИ ШЕШІМ', 'Шешуші шайқас алдында', 1200); setTimeout(() => decision(() => { if (RUN.B.state === 'build') go(); }), 900); }
    else go();
  };
  $('#envoyBtn').onclick = () => { if (RUN.B.envoy()) { SFX.paper(); toast('Елші аттанды: келесі толқын 35% аз болады'); hud(); readEvents(); afterDeath(() => {}); } };
  $('#abBtn').onclick = () => { if (MODE === 'battle' && RUN.B.ability()) { SFX.boom(); center(RUN.K.act.n, RUN.K.act.d, 1200); readEvents(); } };

  function readEvents() {
    const B = RUN?.B; if (!B) return;
    for (const ev of B.events) {
      if (ev.type === 'leak') { SFX.alarm(); toast('Жау ордаға жетті! Жан −1', true); }
      else if (ev.type === 'crisis') { SFX.alarm(); toast('Дағдарыс: «' + D.CRISIS[ev.k][0] + '» · Жан −1', true); }
      else if (ev.type === 'waveEnd') { toast('Толқын тойтарылды! Табыс: +' + ev.income + ' алтын'); }
      else if (ev.type === 'won') { SFX.win(); }
    }
    B.events.length = 0;
  }

  /* ---- құрылыс мәзірі ---- */
  const pop = $('#pop');
  function closePop() { pop.classList.add('hidden'); if (RUN) RUN.sel = null; }
  function openPop(x, y, build) {
    pop.innerHTML = ''; build(pop);
    const x2 = el('button', 'x', 'Жабу'); x2.onclick = () => { SFX.click(); closePop(); }; pop.appendChild(x2);
    pop.classList.remove('hidden');
    const r = pop.getBoundingClientRect();
    pop.style.left = Math.max(6, Math.min(innerWidth - r.width - 6, x - r.width / 2)) + 'px';
    pop.style.top = Math.max(70, Math.min(innerHeight - r.height - 80, y + 18)) + 'px';
  }
  function slotPop(i, x, y) {
    const B = RUN.B, s = B.slots[i]; RUN.sel = { kind: 'slot', i };
    openPop(x, y, (p) => {
      if (!s.t) {
        p.appendChild(el('h4', null, 'Әскер орналастыру'));
        for (const type of ['archer', 'spear', 'siege']) {
          const T = D.TOWERS[type], c = B.cost(type), b = el('button');
          const l = el('span'); l.appendChild(document.createTextNode(T.ico + ' ' + T.n)); l.appendChild(el('small', null, T.d));
          b.appendChild(l); b.appendChild(el('b', null, c + ' 💰')); b.disabled = B.gold < c;
          b.onclick = () => { if (B.build(i, type)) { SFX.build(); closePop(); hud(); } };
          p.appendChild(b);
        }
      } else {
        const T = D.TOWERS[s.t.type];
        p.appendChild(el('h4', null, T.ico + ' ' + T.n + ' · ' + s.t.lvl + '-деңгей'));
        if (s.t.lvl < 3) {
          const c = B.upCost(s.t), b = el('button'); const l = el('span'); l.appendChild(document.createTextNode('⬆ Жақсарту')); l.appendChild(el('small', null, 'Зақым ×' + D.UPG_MUL[s.t.lvl].toFixed(2).replace('.', ',') + ', қашықтық +8%'));
          b.appendChild(l); b.appendChild(el('b', null, c + ' 💰')); b.disabled = B.gold < c; b.onclick = () => { if (B.upgrade(i)) { SFX.build(); closePop(); hud(); } }; p.appendChild(b);
        }
        const sb = el('button'); sb.appendChild(el('span', null, '↩ Сату')); sb.appendChild(el('b', null, '+' + Math.floor(s.t.paid * 0.5) + ' 💰')); sb.onclick = () => { B.sell(i); SFX.click(); closePop(); hud(); }; p.appendChild(sb);
      }
    });
  }
  function cityPop(i, x, y) {
    const B = RUN.B, c = B.cities[i]; RUN.sel = { kind: 'city', i };
    openPop(x, y, (p) => {
      p.appendChild(el('h4', null, '🏰 ' + c.name + ' · ' + c.lvl + '/3'));
      const inc = Math.round(D.CITY_INCOME * (G.khan === 2 ? 1.3 : 1));
      if (c.lvl < 3) {
        const cost = B.cityCost(c), b = el('button'); const l = el('span'); l.appendChild(document.createTextNode('Қаланы дамыту')); l.appendChild(el('small', null, '+' + inc + ' алтын әр толқыннан кейін · Халық +4'));
        b.appendChild(l); b.appendChild(el('b', null, cost + ' 💰')); b.disabled = B.gold < cost; b.onclick = () => { if (B.upgradeCity(i)) { SFX.build(); toast(c.name + ' дамыды: ' + c.lvl + '/3'); closePop(); hud(); } }; p.appendChild(b);
      } else p.appendChild(el('p', 'note', 'Қала толық дамыған.'));
      p.appendChild(el('p', 'note', 'Қазіргі табыс: ' + B.income() + ' алтын / толқын'));
    });
  }

  /* ================= КАРТА (canvas) ================= */
  const cv = $('#map'), ctx = cv.getContext('2d');
  let DPR = 1, VW = 0, VH = 0, view = { sc: 1, ox: 0, oy: 0 };
  const KZp = D.GEO.KZ.map(([a, b]) => C.proj(a, b));
  const CASp = D.GEO.CASPIAN.map(([a, b]) => C.proj(a, b));
  const BALp = D.GEO.BALKHASH.map(([a, b]) => C.proj(a, b));
  const ARAL = [[58.4, 46.6], [59.8, 46.4], [61.4, 46.1], [61.6, 45.0], [60.6, 44.1], [59.0, 44.4], [58.3, 45.5]].map(([a, b]) => C.proj(a, b));
  const RIVERS = [
    [[68.9, 41.4], [68.3, 42.6], [67.4, 43.6], [66.0, 44.4], [64.5, 45.0], [62.5, 45.8], [61.3, 46.1]],
    [[80.3, 43.9], [78.5, 43.9], [77.0, 44.3], [75.5, 45.2], [74.6, 45.7]],
    [[84.5, 49.0], [82.5, 49.8], [80.3, 50.4], [78.5, 51.6], [77.0, 52.3], [75.5, 53.6], [74.6, 54.6]],
    [[59.0, 51.6], [56.5, 51.7], [54.5, 51.4], [51.4, 51.2], [51.6, 49.5], [51.8, 47.5], [51.9, 47.0]],
    [[73.3, 43.0], [72.0, 43.9], [70.5, 44.8], [69.0, 45.4]],
  ].map((r) => r.map(([a, b]) => C.proj(a, b)));
  const STARS = Array.from({ length: 140 }, () => [Math.random(), Math.random(), Math.random() * 1.4 + 0.3, Math.random() * 6]);

  function resize() { DPR = Math.min(2, window.devicePixelRatio || 1); VW = innerWidth; VH = innerHeight; cv.width = VW * DPR; cv.height = VH * DPR; setView(); }
  function setView() {
    let x0 = 8, y0 = 6, x1 = 474, y1 = 254;
    let top = 0, bot = 0;
    if (RUN && (MODE === 'battle' || MODE === 'council' || MODE === 'question' || MODE === 'dead')) {
      const B = RUN.B, pts = [B.cap, ...B.cities.map((c) => c.p), ...B.slots.map((s) => s.p)];
      B.paths.forEach((p) => pts.push(...p.pts));
      x0 = Math.min(...pts.map((p) => p[0])) - 26; x1 = Math.max(...pts.map((p) => p[0])) + 26;
      y0 = Math.min(...pts.map((p) => p[1])) - 22; y1 = Math.max(...pts.map((p) => p[1])) + 22;
      top = VW < 760 ? 112 : 64; bot = 78;
    }
    const w = x1 - x0, h = y1 - y0, aw = VW - 16, ah = VH - top - bot - 8;
    const sc = Math.min(aw / w, ah / h);
    view = { sc, ox: (VW - w * sc) / 2 - x0 * sc, oy: top + (ah - h * sc) / 2 - y0 * sc + 4 };
  }
  const X = (p) => view.ox + p[0] * view.sc, Y = (p) => view.oy + p[1] * view.sc;
  const sz = (mu, lo, hi) => Math.max(lo, Math.min(hi, mu * view.sc));
  function poly(pts, fill, stroke, lw) {
    if (!pts.length) return; ctx.beginPath(); ctx.moveTo(X(pts[0]), Y(pts[0])); for (let i = 1; i < pts.length; i++) ctx.lineTo(X(pts[i]), Y(pts[i])); ctx.closePath();
    if (fill) { ctx.fillStyle = fill; ctx.fill(); } if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw || 1; ctx.stroke(); }
  }
  function line(pts, col, lw, dash) { ctx.beginPath(); ctx.moveTo(X(pts[0]), Y(pts[0])); for (let i = 1; i < pts.length; i++) ctx.lineTo(X(pts[i]), Y(pts[i])); ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.setLineDash(dash || []); ctx.stroke(); ctx.setLineDash([]); }
  function circ(x, y, r, fill, stroke, lw) { ctx.beginPath(); ctx.arc(x, y, Math.max(0.5, r), 0, Math.PI * 2); if (fill) { ctx.fillStyle = fill; ctx.fill(); } if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw || 1; ctx.stroke(); } }
  function label(t, x, y, col, size, bold) { ctx.font = (bold ? '700 ' : '500 ') + size + 'px Rubik, Arial'; ctx.textAlign = 'center'; ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,.7)'; ctx.strokeText(t, x, y); ctx.fillStyle = col; ctx.fillText(t, x, y); }

  function drawMap(time) {
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    const g = ctx.createLinearGradient(0, 0, 0, VH); g.addColorStop(0, '#070A12'); g.addColorStop(1, '#141019'); ctx.fillStyle = g; ctx.fillRect(0, 0, VW, VH);
    for (const [sx, sy, r, ph] of STARS) { ctx.globalAlpha = 0.35 + 0.35 * Math.sin(time * 0.0012 + ph); circ(sx * VW, sy * VH, r, '#F5F5DC'); }
    ctx.globalAlpha = 1;
    // дала
    const steppe = ctx.createLinearGradient(0, view.oy, 0, view.oy + 260 * view.sc); steppe.addColorStop(0, '#4A4024'); steppe.addColorStop(1, '#5E4A26');
    ctx.shadowColor = 'rgba(212,175,55,.35)'; ctx.shadowBlur = 18; poly(KZp, steppe, '#D4AF37', 2); ctx.shadowBlur = 0;
    poly(CASp, '#1E4E6B', '#2C6E91', 1); poly(BALp, '#1E4E6B'); poly(ARAL, '#1E4E6B');
    RIVERS.forEach((r) => line(r, 'rgba(63,169,214,.55)', sz(1.2, 1, 3)));
    if (!RUN || MODE === 'menu') {
      // мәзірде: барлық кезеңнің орталықтары
      D.STAGES.forEach((s, i) => { const p = C.proj(s.cap[1], s.cap[2]); const a = 0.5 + 0.5 * Math.sin(time * 0.002 + i); circ(X(p), Y(p), sz(3, 3, 7) + a * 3, `rgba(212,175,55,${0.25 + a * 0.3})`); circ(X(p), Y(p), sz(1.6, 2, 4), '#D4AF37'); });
    }
  }
  function drawBattle(time) {
    const B = RUN.B, sc = view.sc;
    // жолдар
    B.paths.forEach((p) => {
      line(p.pts, 'rgba(60,35,18,.85)', sz(7, 8, 26));
      line(p.pts, 'rgba(139,0,0,.75)', sz(1.2, 1.5, 3), [sz(3, 5, 10), sz(3, 5, 10)]);
      const s0 = p.pts[0]; const fx = X(s0), fy = Y(s0);
      ctx.fillStyle = RUN.S.ecol; ctx.fillRect(fx - 1, fy - sz(9, 14, 26), 2, sz(9, 14, 26));
      ctx.beginPath(); ctx.moveTo(fx + 1, fy - sz(9, 14, 26)); ctx.lineTo(fx + sz(6, 10, 18), fy - sz(7, 11, 20)); ctx.lineTo(fx + 1, fy - sz(5, 8, 14)); ctx.fill();
    });
    // қалалар
    B.cities.forEach((c, i) => {
      const x = X(c.p), y = Y(c.p), r = sz(5, 10, 18);
      const sel = RUN.sel && RUN.sel.kind === 'city' && RUN.sel.i === i;
      ctx.fillStyle = sel ? '#F3D77F' : '#B07D3A'; ctx.fillRect(x - r, y - r * 0.6, r * 2, r * 1.2);
      ctx.fillStyle = '#5E3F18'; for (let k = 0; k < 3; k++) ctx.fillRect(x - r + k * r * 0.8, y - r, r * 0.45, r * 0.45);
      ctx.fillStyle = '#2B1B10'; ctx.fillRect(x - r * 0.2, y, r * 0.4, r * 0.6);
      for (let k = 0; k < 3; k++) circ(x - r * 0.6 + k * r * 0.6, y + r * 0.95, r * 0.18, k < c.lvl ? '#D4AF37' : 'rgba(255,255,255,.2)');
      label(c.name, x, y - r - 5, '#F5F5DC', Math.round(sz(4, 11, 14)));
    });
    // орда (астана)
    { const x = X(B.cap), y = Y(B.cap), r = sz(8, 16, 30);
      ctx.shadowColor = 'rgba(212,175,55,.8)'; ctx.shadowBlur = 16 + 6 * Math.sin(time * 0.004);
      ctx.fillStyle = '#F1E3C2'; ctx.beginPath(); ctx.moveTo(x - r, y + r * 0.5); ctx.lineTo(x - r, y - r * 0.1); ctx.quadraticCurveTo(x, y - r * 1.1, x + r, y - r * 0.1); ctx.lineTo(x + r, y + r * 0.5); ctx.closePath(); ctx.fill(); ctx.shadowBlur = 0;
      ctx.strokeStyle = '#B07D3A'; ctx.lineWidth = 2; ctx.stroke();
      circ(x, y - r * 0.62, r * 0.2, null, '#8B5A12', 2);
      ctx.fillStyle = '#8B0000'; ctx.fillRect(x - r * 0.18, y + r * 0.05, r * 0.36, r * 0.45);
      label('Орда · ' + RUN.S.cap[0], x, y + r + 12, '#D4AF37', Math.round(sz(4.5, 12, 15)), true);
    }
    // мұнара орындары мен мұнаралар
    const cheapest = Math.min(B.cost('archer'), B.cost('spear'));
    B.slots.forEach((s, i) => {
      const x = X(s.p), y = Y(s.p), r = sz(4.6, 11, 20);
      const sel = RUN.sel && RUN.sel.kind === 'slot' && RUN.sel.i === i;
      if (sel && s.t) circ(x, y, B.range(s.t) * sc, 'rgba(212,175,55,.08)', 'rgba(212,175,55,.6)', 1.5);
      if (!s.t) {
        const can = B.gold >= cheapest && B.state === 'build';
        ctx.setLineDash([4, 4]); circ(x, y, r * (can ? 1 + 0.08 * Math.sin(time * 0.006) : 1), sel ? 'rgba(212,175,55,.25)' : 'rgba(0,0,0,.25)', can ? 'rgba(212,175,55,.9)' : 'rgba(205,191,158,.4)', 2); ctx.setLineDash([]);
        if (sel) circ(x, y, D.TOWERS.archer.range * sc, null, 'rgba(212,175,55,.35)', 1);
        return;
      }
      const T = D.TOWERS[s.t.type];
      circ(x, y, r, '#1F1A13', T.col, 3);
      ctx.save(); ctx.translate(x, y); ctx.strokeStyle = '#F5F5DC'; ctx.fillStyle = '#F5F5DC'; ctx.lineWidth = Math.max(1.5, r * 0.14);
      if (s.t.type === 'archer') { ctx.rotate(s.t.ang); ctx.beginPath(); ctx.arc(-r * 0.15, 0, r * 0.55, -1.1, 1.1); ctx.stroke(); ctx.beginPath(); ctx.moveTo(-r * 0.5, 0); ctx.lineTo(r * 0.6, 0); ctx.stroke(); }
      else if (s.t.type === 'spear') { ctx.rotate(s.t.ang); ctx.beginPath(); ctx.moveTo(-r * 0.6, 0); ctx.lineTo(r * 0.45, 0); ctx.stroke(); ctx.beginPath(); ctx.moveTo(r * 0.7, 0); ctx.lineTo(r * 0.35, -r * 0.22); ctx.lineTo(r * 0.35, r * 0.22); ctx.fill(); }
      else { ctx.fillRect(-r * 0.5, -r * 0.1, r, r * 0.45); ctx.beginPath(); ctx.moveTo(-r * 0.3, -r * 0.1); ctx.lineTo(r * 0.4, -r * 0.6); ctx.stroke(); circ(r * 0.45, -r * 0.62, r * 0.16, '#998C70'); }
      ctx.restore();
      for (let k = 0; k < s.t.lvl; k++) circ(x - r * 0.5 + k * r * 0.5, y + r + 4, Math.max(2, r * 0.14), '#D4AF37');
    });
    // жаулар
    for (const e of B.enemies) {
      const x = X([e.x, e.y]), y = Y([e.x, e.y]);
      const base = { foot: 2.6, horse: 3, heavy: 3.6, chief: 5, boss: 6.5 }[e.type];
      const r = sz(base, base * 2.2, base * 4.2);
      ctx.save(); ctx.translate(x, y); ctx.rotate(e.ang || 0);
      ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.beginPath(); ctx.ellipse(0, r * 0.5, r, r * 0.4, 0, 0, Math.PI * 2); ctx.fill();
      if (e.type === 'horse' || e.type === 'chief' || e.type === 'boss') { ctx.fillStyle = '#5A3A22'; ctx.beginPath(); ctx.ellipse(0, 0, r * 1.25, r * 0.6, 0, 0, Math.PI * 2); ctx.fill(); }
      ctx.rotate(-(e.ang || 0));
      circ(0, -r * 0.2, r * 0.7, e.hit > 0 ? '#FFFFFF' : RUN.S.ecol, '#120D09', 1.5);
      circ(0, -r * 0.95, r * 0.35, '#D9A877');
      if (e.type === 'heavy') { ctx.strokeStyle = '#C9D3E0'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, -r * 0.2, r * 0.75, 0, Math.PI * 2); ctx.stroke(); }
      if (e.type === 'chief' || e.type === 'boss') { ctx.fillStyle = '#D4AF37'; ctx.beginPath(); ctx.moveTo(-r * 0.4, -r * 1.2); ctx.lineTo(-r * 0.2, -r * 1.6); ctx.lineTo(0, -r * 1.25); ctx.lineTo(r * 0.2, -r * 1.6); ctx.lineTo(r * 0.4, -r * 1.2); ctx.fill(); }
      ctx.fillStyle = RUN.S.ecol; ctx.fillRect(r * 0.5, -r * 2, 1.5, r * 1.6); ctx.fillRect(r * 0.5, -r * 2, r * 0.7, r * 0.45);
      ctx.restore();
      if (e.hp < e.max) { const w = Math.max(16, r * 2.4); ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillRect(x - w / 2, y - r * 2.4, w, 4); ctx.fillStyle = e.hp / e.max > 0.4 ? '#59C795' : '#E2574C'; ctx.fillRect(x - w / 2, y - r * 2.4, w * Math.max(0, e.hp / e.max), 4); }
    }
    // тастар мен әсерлер
    for (const sh of B.shots) { const k = 1 - sh.t / sh.T; const px = sh.x + (sh.tx - sh.x) * k, py = sh.y + (sh.ty - sh.y) * k - Math.sin(k * Math.PI) * 18; circ(X([px, py]), Y([px, py]), sz(1.4, 3, 6), '#998C70', '#3E3426', 1); }
    for (const f of B.fx) {
      if (f.k === 'archer') line([[f.x1, f.y1], [f.x2, f.y2]], 'rgba(243,215,127,.85)', 1.4);
      else if (f.k === 'spear') line([[f.x1 + (f.x2 - f.x1) * 0.5, f.y1 + (f.y2 - f.y1) * 0.5], [f.x2, f.y2]], 'rgba(255,138,122,.95)', 3);
      else if (f.k === 'boom') circ(X([f.x, f.y]), Y([f.x, f.y]), f.r * sc * (1.2 - f.t * 2), 'rgba(212,175,55,.25)', 'rgba(255,200,90,.8)', 2);
      else if (f.k === 'pop') circ(X([f.x, f.y]), Y([f.x, f.y]), sz(4, 6, 14) * (1 - f.t * 2), 'rgba(245,245,220,.5)');
      else if (f.k === 'flash') { ctx.fillStyle = `rgba(255,240,200,${f.t})`; ctx.fillRect(0, 0, VW, VH); }
    }
    if (B.stunT > 0 || B.slowT > 0) { ctx.fillStyle = 'rgba(63,169,214,.08)'; ctx.fillRect(0, 0, VW, VH); }
    if (B.dmgT > 0 || B.rateT > 0) { ctx.fillStyle = 'rgba(212,175,55,.06)'; ctx.fillRect(0, 0, VW, VH); }
  }

  // басу → мұнара орны / қала
  cv.addEventListener('pointerdown', (e) => {
    if (MODE !== 'battle' || !RUN) return;
    const B = RUN.B, mx = (e.clientX - view.ox) / view.sc, my = (e.clientY - view.oy) / view.sc;
    const hitR = Math.max(9, 24 / view.sc);
    let best = -1, bd = 1e9;
    B.slots.forEach((s, i) => { const d = Math.hypot(s.p[0] - mx, s.p[1] - my); if (d < hitR && d < bd) { bd = d; best = i; } });
    if (best >= 0) { SFX.click(); slotPop(best, e.clientX, e.clientY); return; }
    const ci = B.cities.findIndex((c) => Math.hypot(c.p[0] - mx, c.p[1] - my) < Math.max(10, 26 / view.sc));
    if (ci >= 0) { SFX.click(); cityPop(ci, e.clientX, e.clientY); return; }
    closePop();
  });

  /* ================= ЦИКЛ ================= */
  let last = performance.now(), paused = false, lastSfx = 0;
  function loop(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (Q && Q.active) {
      Q.t -= dt; $('#qBar').style.width = Math.max(0, (Q.t / Q.max) * 100) + '%';
      if (Q.t <= 0 && Q.timeout) { const f = Q.timeout; Q.timeout = null; f(); }
    }
    if (RUN && MODE === 'battle' && !paused) {
      const B = RUN.B, kills = B.kills;
      B.update(dt);
      if (B.fx.some((f) => f.k === 'boom' && f.t > 0.28)) SFX.boom();
      if (now - lastSfx > 90 && B.fx.some((f) => f.k === 'archer' && f.t > 0.1)) { SFX.arrow(); lastSfx = now; }
      if (B.kills > kills && SET.sfx && Math.random() < 0.3) tone(660, 0.05, 'triangle', 0.03);
      const won = B.events.some((x) => x.type === 'won'), dead = B.events.some((x) => x.type === 'dead');
      readEvents(); hud();
      if (dead) onDeath();
      else if (won) finish(true);
    }
    drawMap(now);
    if (RUN && MODE !== 'menu' && RUN.B && !RUN.finished) drawBattle(now);
    requestAnimationFrame(loop);
  }

  /* ================= АЯҚТАУ (сервер санайды) ================= */
  async function finish(won, silent) {
    if (!RUN || RUN.finished) return; RUN.finished = true;
    const B = RUN.B; MODE = 'menu'; closePop(); paused = false;
    $('#dock').classList.add('hidden'); $('#council').classList.add('hidden'); $('#top').classList.add('hidden'); $('#helpTip').classList.add('hidden');
    if (!silent) { show('loading'); $('#loadMsg').textContent = 'Нәтиже серверде есептелуде…'; $('#loadBtns').classList.add('hidden'); }
    let res = null, err = null;
    try {
      res = await TR.fn('khan-finish', { game_id: RUN.id, won, kills: B.kills, lives: B.lives, waves: won ? B.n : Math.max(0, B.wave - (B.state === 'wave' || B.state === 'dead' ? 1 : 0)), bars: B.bars, time_ms: Math.round(performance.now() - RUN.t0) });
    } catch (e) { err = e; }
    if (silent) return;
    if (won && res) G.won.add(RUN.stage);
    const s = RUN.S, boss = s.boss && won;
    $('#rEy').textContent = s.n + '-КЕЗЕҢ · ' + s.t + ' · ' + RUN.K.name;
    $('#rTitle').textContent = boss ? '🏆 Қазақ хандығы мәңгілік жасасын!' : won ? 'Кезең сәтті өтті!' : 'Кезең өтілмеді';
    $('#rText').textContent = boss ? 'Сіз барлық тарихи сынақтан сүрінбей өтіп, хандықтың шаңырағын шайқалтпай сақтап қалдыңыз. Берілетін атақ: 🌟 «Қазақтың Алтын Қалқаны» / «Данышпан Бас Уәзір».'
      : won ? 'Хандық шекарасы сақталды. ' + (s.n < 10 ? (s.n + 1) + '-кезең ашылды. Тарихи шежіреге жаңа мәлімет қосылды.' : '')
      : 'Тарихты қайта қарап, тағы байқап көріңіз: дұрыс «Тарихи шешім» ресурс береді.';
    const box = $('#rStats'); box.innerHTML = '';
    const stat = (a, b) => { const d = el('div', 'st'); d.appendChild(el('small', null, a)); d.appendChild(el('b', null, String(b))); box.appendChild(d); };
    if (res) {
      stat('Ұпай', res.score); stat('Дұрыс жауап', res.correct); stat('Қате жауап', res.wrong); stat('Жеңілген жау', res.kills);
      stat('Қалған жан', res.lives); stat('Толқын', res.waves + '/' + B.n); stat('Рейтингтегі орын', res.rank);
      $('#rNote').textContent = (res.new_best ? '🏅 Жаңа рекорд! ' : '') + 'Ұпайды сервер есептеді: дұрыс жауап ×100, жау ×3, жеңіс бонусы, жан ×100 және көрсеткіштер. Браузердегі сандар тек алдын ала көрініс.';
    } else {
      stat('Дұрыс', RUN.correct); stat('Қате', RUN.wrong); stat('Жау', B.kills);
      $('#rNote').textContent = 'Нәтижені сақтау мүмкін болмады: ' + (err ? err.message : '') ;
    }
    $('#rNext').classList.toggle('hidden', !(won && res && s.n < 10));
    if (won) SFX.win(); else SFX.bad();
    renderStages(); show('result');
  }
  $('#rNext').onclick = () => { G.stage = Math.min(10, RUN.stage + 1); store.set('khanStage', G.stage); renderStages(); RUN = null; startStage(); };
  $('#rAgain').onclick = () => { RUN = null; startStage(); };
  $('#rMenu').onclick = () => { RUN = null; MODE = 'menu'; setView(); show('menu'); };

  /* ---- пауза ---- */
  function pause() { if (!RUN || (MODE !== 'battle' && MODE !== 'council')) return; paused = true; RUN.pausedMode = MODE; MODE = 'paused'; show('pause'); }
  $('#pauseBtn').onclick = pause;
  $('#resumeBtn').onclick = () => { MODE = RUN.pausedMode; paused = false; hideOverlay(); last = performance.now(); };
  $('#quitBtn').onclick = () => { paused = false; finish(false); };
  document.addEventListener('visibilitychange', () => { if (document.hidden && MODE === 'battle') pause(); });

  /* ---- пернетақта ---- */
  document.addEventListener('keydown', (e) => {
    if (Q && Q.active && Q.key && e.target.tagName !== 'INPUT') { Q.key(e); return; }
    if (e.key === 'Escape' && !pop.classList.contains('hidden')) { closePop(); return; }
    if (MODE === 'council') { if (e.key === 'ArrowLeft') choose('L'); else if (e.key === 'ArrowRight') choose('R'); }
    if (MODE === 'battle') {
      if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); $('#waveBtn').click(); }
      else if (e.key === 'e' || e.key === 'E') $('#abBtn').click();
    }
    if ((e.key === 'p' || e.key === 'P' || e.key === 'Escape') && (MODE === 'battle' || MODE === 'council') && pop.classList.contains('hidden')) pause();
  });

  window.addEventListener('resize', resize);
  resize(); requestAnimationFrame(loop);
  // Тек жергілікті тестте (localhost): ішкі күйді автотестке көрсету. Сайтта жоқ.
  if (/^(localhost|127\.0\.0\.1)$/.test(location.hostname)) Object.defineProperty(window, '__khan', { get: () => ({ RUN, MODE, G, scr: (p) => [X(p), Y(p)] }) });
  boot();
})();
