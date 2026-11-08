'use strict';
/* =========================================================
   Moniteur moteur : cadrans ronds ou barres.
   3 pages seulement : Moteur · Performance · Puissance. Tout le reste est dans Réglages > Moniteur moteur.
   - Performance (chrono, puissance) : désactivé par défaut, à activer explicitement.
   - Jamais de faux chiffres : signal absent = « — » (cadran grisé).
   - Courbe de puissance = ESTIMATION physique (vitesse + régime), pas un vrai banc.
   ========================================================= */
(() => {
const M = window.M6, { Car, S, saveS, toast, Native, clamp } = M;
const $ = (s, r = document) => r.querySelector(s);
const fmt = (v, d = 0) => v.toFixed(d).replace('.', ',');
const perfOn = () => S.perf === 'on';
const boost = () => Car.s.mapKpa == null ? null : (Car.s.mapKpa - (Car.s.baroKpa ?? 101.3)) / 100;
const s_ = k => () => Car.s[k];

/* ---------- Cadrans ---------- */
const DIALS = [
  { id: 'boost', l: 'Turbo', u: 'bar', min: -1, max: 2, dec: 2, get: boost, peak: 1, thr: 'boost', hint: 'MAP − pression atmosphérique', k: 'mapKpa' },
  { id: 'rpm', l: 'Régime', u: 'tr/min', min: 0, max: 5000, dec: 0, get: s_('rpm'), peak: 1, hint: 'PID 0C', k: 'rpm' },
  { id: 'speed', l: 'Vitesse', u: 'km/h', min: 0, max: 200, dec: 0, get: s_('speedKmh'), peak: 1, hint: 'PID 0D / CAN', k: 'speedKmh' },
  { id: 'thr', l: 'Pédale', u: '%', min: 0, max: 100, dec: 0, get: s_('throttlePct'), hint: 'PID 11 / 49', k: 'throttlePct' },
  { id: 'coolant', l: 'Eau', u: '°C', min: 40, max: 120, dec: 0, get: s_('coolantC'), thr: 'coolant', hint: 'PID 05', k: 'coolantC' },
  { id: 'iat', l: 'Admission', u: '°C', min: 0, max: 90, dec: 0, get: s_('iatC'), thr: 'iat', peak: 1, hint: 'PID 0F', k: 'iatC' },
  { id: 'rail', l: 'Rail', u: 'bar', min: 0, max: 2000, dec: 0, get: s_('railBar'), peak: 1, hint: 'PID 23', k: 'railBar' },
  { id: 'load', l: 'Charge', u: '%', min: 0, max: 100, dec: 0, get: s_('loadPct'), hint: 'PID 04', k: 'loadPct' },
  { id: 'egt', l: 'Échappement', u: '°C', min: 0, max: 900, dec: 0, get: s_('egtC'), thr: 'egt', peak: 1, hint: 'Sonde EGT externe', k: 'egtC' },
  { id: 'oilc', l: 'Huile', u: '°C', min: 40, max: 150, dec: 0, get: s_('oilC'), thr: 'oil', hint: 'Capteur externe', k: 'oilC' },
  { id: 'oilb', l: 'Pression huile', u: 'bar', min: 0, max: 6, dec: 1, get: s_('oilBar'), hint: 'Capteur externe', k: 'oilBar' },
  { id: 'batt', l: 'Batterie', u: 'V', min: 10, max: 15, dec: 1, get: s_('batteryV'), thr: 'batt', hint: 'Tension poste / PID 42', k: 'batteryV' }
];
const byId = id => DIALS.find(d => d.id === id);
const DEF_THR = { boost: 1.6, coolant: 105, iat: 65, egt: 750, oil: 130, batt: 11.8 };
const mon = S.mon = { thr: {}, best: {}, dyno: null, ...(S.mon || {}) };
mon.thr = { ...DEF_THR, ...(mon.thr || {}) }; mon.best = mon.best || {};
const save = () => saveS();
const peaks = {};

/* ---------- Accélération (pente de la vitesse sur ~0,8 s) ---------- */
const hist = [];   // [t(s), v(m/s)]
function accel() {
  const n = Math.min(hist.length, 8); if (n < 5) return null;
  const p = hist.slice(-n); let st = 0, sv = 0, stt = 0, stv = 0;
  p.forEach(([t, v]) => { st += t; sv += v; stt += t * t; stv += t * v; });
  const d = n * stt - st * st; return d ? (n * stv - st * sv) / d : null;
}

/* ---------- Chrono : une seule mesure, états explicites idle → armed → run → done ---------- */
const MODES = [['z100', '0 – 100', 0, 100], ['z200', '0 – 200', 0, 200], ['r80', '80 – 120', 80, 120]];
const CH = { id: 'z100', st: 'idle', t0: 0, t: 0, ready: false };
const cur = () => MODES.find(m => m[0] === CH.id);
function chSpeed(v, now) {
  if (v == null || (CH.st !== 'armed' && CH.st !== 'run')) return;
  const [, , a, b] = cur();
  if (CH.st === 'armed') {
    if (a === 0) { if (v < 2) CH.ready = true; if (CH.ready && v >= 3) { CH.st = 'run'; CH.t0 = now - 150; } }
    else { if (v < a - 2) CH.ready = true; if (CH.ready && v >= a) { CH.st = 'run'; CH.t0 = now; } }
  } else if (v >= b) {
    CH.t = (now - CH.t0) / 1000; CH.st = 'done';
    if (CH.t > .5) { mon.best[CH.id] = Math.min(mon.best[CH.id] || 99, CH.t); save(); }
  } else if (a === 0 ? (v < 1.5 && now - CH.t0 > 1500) : v < a - 3) { CH.st = 'armed'; CH.ready = false; }
  dirty = true, kick();
}
function chBtn() {
  if (CH.st === 'armed' || CH.st === 'run') CH.st = 'idle';
  else { CH.st = 'armed'; CH.ready = false; }
  Sim.want = null; page();
}

/* ---------- Courbe de puissance : modèle de la voiture (pas une mesure en roulant) ----------
   Base : courbe de couple estimée d'un 1.6 BlueHDi 75 (75 ch à 3500 tr/min, 230 Nm dès 1750), recalée sur les valeurs
   réglables (Réglages > Moniteur moteur). Référence : origine 75 ch / 230 Nm. */
const PHYS = { rho: 1.18, cda: .64, crr: .011, eta: .86 };   // simulation de démo uniquement
const STOCK = [[1000, 130], [1250, 170], [1500, 212], [1750, 230], [2000, 230], [2500, 205], [3000, 174], [3500, 150], [4000, 125], [4500, 100], [5000, 80]];
const lerp = (T, r) => { if (r <= T[0][0]) return T[0][1]; for (let i = 1; i < T.length; i++) if (r <= T[i][0]) { const [r0, a] = T[i - 1], [r1, b] = T[i]; return a + (b - a) * (r - r0) / (r1 - r0); } return T[T.length - 1][1]; };
const hpOf = (n, r) => n * r * 2 * Math.PI / 60 / 735.5;
const smooth = a => a.map((v, i) => i && i < a.length - 1 ? (a[i - 1] + 2 * v + a[i + 1]) / 4 : v);
function curve() {
  const rpms = []; for (let r = 1200; r <= 4800; r += 100) rpms.push(r);
  const raw = rpms.map(r => lerp(TQ, r));
  const hp0 = Math.max(...raw.map((n, i) => hpOf(n, rpms[i])));
  const kn = (+S.nmPeak || 230) / Math.max(...raw), kh = (+S.hpPeak || 75) / hp0;
  let nm = raw.map((n, i) => { const w = clamp((rpms[i] - 2000) / 1500, 0, 1); return n * (kn * (1 - w) + kh * w); });
  nm = smooth(smooth(nm));
  const rows = rpms.map((r, i) => [r, hpOf(nm[i], r), nm[i]]);
  const hp = rows.reduce((b, x) => x[1] > b[1] ? x : b), tq_ = rows.reduce((b, x) => x[2] > b[2] ? x : b);
  return { rows, hp: [hp[0], hp[1]], nm: [tq_[0], tq_[2]] };
}
const X0 = 56, X1 = 584, Y0 = 20, Y1 = 262, RMIN = 1000, RMAX = 5000; let HMAX = 100, NMAX = 300;
const up50 = v => Math.ceil(v / 50) * 50;
const gx = r => X0 + (r - RMIN) / (RMAX - RMIN) * (X1 - X0), gyh = h => Y1 - h / HMAX * (Y1 - Y0), gyn = n => Y1 - n / NMAX * (Y1 - Y0);
let CV = null;
function dynoSVG() {
  const R = getCV();
  const path = (pts, fy) => pts.map(([r, v], i) => (i ? 'L' : 'M') + gx(r).toFixed(1) + ' ' + fy(v).toFixed(1)).join('');
  const stk = []; for (let r = 1500; r <= 4800; r += 100) stk.push([r, lerp(STOCK, r)]);
  const grid = Array.from({ length: Math.floor(HMAX / 50) + 1 }, (_, i) => i * 50).map(h => `<line x1="${X0}" x2="${X1}" y1="${gyh(h)}" y2="${gyh(h)}" class="g"/><text x="${X0 - 8}" y="${gyh(h) + 4}" class="ax" text-anchor="end">${h}</text><text x="${X1 + 8}" y="${gyh(h) + 4}" class="ax n">${Math.round(h / HMAX * NMAX / 10) * 10}</text>`).join('')
    + [1000, 2000, 3000, 4000, 5000].map(r => `<text x="${gx(r)}" y="${Y1 + 18}" class="ax" text-anchor="middle">${r}</text>`).join('');
  const lab = (px, py, t, c) => `<g transform="translate(${px} ${py})"><rect x="-44" y="-18" width="88" height="22" rx="7" fill="rgba(20,22,30,.92)"/><text y="-3" text-anchor="middle" class="pk" fill="${c}">${t}</text></g>`;
  return `<svg viewBox="0 0 640 290" class="dynosvg" id="dySvg">${grid}
    <path d="${path(stk.map(([r, n]) => [r, hpOf(n, r)]), gyh)}" class="ref p"/><path d="${path(stk, gyn)}" class="ref n"/>
    <path d="${path(R.rows.map(r => [r[0], r[1]]), gyh)}" class="cv p"/><path d="${path(R.rows.map(r => [r[0], r[2]]), gyn)}" class="cv n"/>
    ${lab(gx(R.hp[0]), gyh(R.hp[1]) - 10, Math.round(R.hp[1]) + ' ch', '#e6e9ee')}${lab(gx(R.nm[0]), gyn(R.nm[1]) - 10, Math.round(R.nm[1]) + ' Nm', '#ff9f0a')}
    <g id="dyCur" opacity="0"><line y1="${Y0}" y2="${Y1}" class="cur"/><circle r="5" class="cd p"/><circle r="5" class="cd n"/></g>
    <rect x="${X0}" y="${Y0}" width="${X1 - X0}" height="${Y1 - Y0}" fill="transparent" id="dyHit"/>
    <text x="${X0}" y="12" class="ax">ch</text><text x="${X1 + 6}" y="12" class="ax n">Nm</text></svg>`;
}
function dyRead(r) {
  const R = CV || curve(), el = $('#dyRead'); if (!el) return;
  if (r == null) { el.textContent = `Maxi ${Math.round(R.hp[1])} ch à ${R.hp[0]} tr/min · ${Math.round(R.nm[1])} Nm à ${R.nm[0]} tr/min`; return; }
  const i = clamp(Math.round((r - 1200) / 100), 0, R.rows.length - 1), [rr, hp, nm] = R.rows[i], sn = lerp(STOCK, rr);
  el.textContent = `${rr} tr/min · ${Math.round(hp)} ch · ${Math.round(nm)} Nm · origine ${Math.round(hpOf(sn, rr))} ch · ${Math.round(sn)} Nm`;
  const g = $('#dyCur'); g.setAttribute('opacity', 1); g.querySelector('line').setAttribute('x1', gx(rr)); g.querySelector('line').setAttribute('x2', gx(rr));
  const [a, b] = g.querySelectorAll('circle'); a.setAttribute('cx', gx(rr)); a.setAttribute('cy', gyh(hp)); b.setAttribute('cx', gx(rr)); b.setAttribute('cy', gyn(nm));
}
function dyScrub(e) {
  const svg = $('#dySvg'); if (!svg) return; const pt = svg.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY;
  const q = pt.matrixTransform(svg.getScreenCTM().inverse()); dyRead(clamp(RMIN + (q.x - X0) / (X1 - X0) * (RMAX - RMIN), 1200, 4800));
}

/* ---------- Enregistrement (piloté depuis Réglages > Moniteur moteur) ---------- */
const Rec = { on: false, rows: [], t0: 0, timer: null };
const COLS = ['t_s', 'speed_kmh', 'rpm', 'boost_bar', 'throttle_pct', 'coolant_c', 'iat_c', 'load_pct', 'rail_bar', 'egt_c', 'oil_c', 'oil_bar', 'batt_v'];
function sample() {
  const s = Car.s, b = boost(), r = v => v == null ? '' : v;
  Rec.rows.push([((performance.now() - Rec.t0) / 1000).toFixed(1), r(s.speedKmh), r(s.rpm), b == null ? '' : b.toFixed(2), r(s.throttlePct), r(s.coolantC), r(s.iatC), r(s.loadPct), r(s.railBar), r(s.egtC), r(s.oilC), r(s.oilBar), r(s.batteryV)]);
  if (Rec.rows.length > 12000) Rec.rows.shift();
}
function recToggle() { Rec.on = !Rec.on; if (Rec.on) { Rec.rows = []; Rec.t0 = performance.now(); Rec.timer = setInterval(sample, 200); } else clearInterval(Rec.timer); M.renderSettings?.(); }
const csv = () => [COLS.join(';'), ...Rec.rows.map(r => r.join(';').replace(/\./g, ','))].join('\n');
function exportCsv() {
  if (!Rec.rows.length) return toast('Rien à exporter : lance un enregistrement');
  if (window.Android) { Native.copy(csv()); return toast('Journal copié'); }
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['﻿' + csv()], { type: 'text/csv' }));
  a.download = 'peugeot208-moniteur-moteur.csv'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

/* ---------- Alertes : affichées UNE fois (bannière + centre de notifications), puis silence ---------- */
const al = { since: {}, fired: {}, clearAt: {}, hotAt: 0, turbo: false };
function evalAlerts() {
  if (S.alerts !== 'on') return;
  const s = Car.s, t = mon.thr, now = Date.now(), b = boost();
  const chk = (k, cond, lvl, title, text) => {
    if (cond) { al.clearAt[k] = 0; al.since[k] = al.since[k] || now; if (!al.fired[k] && now - al.since[k] >= 1000) { al.fired[k] = 1; M.notify?.({ title, text: text(), lvl, src: 'Voiture' }); } }
    else { al.since[k] = 0; if (al.fired[k]) { al.clearAt[k] = al.clearAt[k] || now; if (now - al.clearAt[k] > 15000) { al.fired[k] = 0; } } }
  };
  chk('boost', b != null && b > t.boost, 'bad', 'Surpression turbo', () => `${fmt(b, 2)} bar : relâche l’accélérateur.`);
  chk('coolant', s.coolantC != null && s.coolantC > t.coolant, 'bad', 'Moteur chaud', () => `Eau à ${Math.round(s.coolantC)} °C.`);
  chk('iat', s.iatC != null && s.iatC > t.iat, 'warn', 'Air d’admission chaud', () => `${Math.round(s.iatC)} °C : la puissance baisse.`);
  chk('egt', s.egtC != null && s.egtC > t.egt, 'bad', 'Échappement trop chaud', () => `${Math.round(s.egtC)} °C.`);
  chk('oil', s.oilC != null && s.oilC > t.oil, 'bad', 'Huile chaude', () => `${Math.round(s.oilC)} °C.`);
  chk('batt', s.batteryV != null && s.rpm > 500 && s.batteryV < t.batt, 'warn', 'Batterie faible', () => `${fmt(s.batteryV, 1)} V moteur tournant.`);
  chk('fuel', s.fuelPct != null && s.fuelPct < 10, 'warn', 'Carburant bas', () => `${Math.round(s.fuelPct)} % restant.`);
  const hot = (b != null && b > .8) || (s.loadPct != null && s.loadPct > 75);
  if (hot) { al.hotAt = now; al.turbo = false; }
  if (s.speedKmh != null && s.speedKmh < 3 && al.hotAt && now - al.hotAt < 180000 && !al.turbo) { al.turbo = true; M.notify?.({ title: 'Turbo chaud', text: 'Laisse tourner le moteur environ 60 secondes avant de couper.', lvl: 'info', src: 'Voiture' }); }
}
setInterval(evalAlerts, 1000);

/* ---------- Suivi des signaux ---------- */
let dirty = true;
Car.on('change', ch => {
  const now = performance.now();
  DIALS.forEach(d => { if (d.peak) { const v = d.get(); if (v != null && (peaks[d.id] == null || v > peaks[d.id])) peaks[d.id] = v; } });
  if (ch.includes('speedKmh') && Car.s.speedKmh != null) {
    hist.push([now / 1000, Car.s.speedKmh / 3.6]); if (hist.length > 40) hist.shift();
    if (perfOn()) chSpeed(Car.s.speedKmh, now);
  }
  dirty = true, kick();
});

/* ---------- Interface ---------- */
let gp = 0;
let pg = 'engine', visible = false, nodes = {}, raf = 0, tickT = null, availSig = '';
const PAGES = [['engine', 'Moteur'], ['perf', 'Performance'], ['power', 'Puissance']];
const ring = (d, cls) => `<div class="rg ${cls}" data-d="${d.id}"><svg viewBox="0 0 100 100"><circle class="trk" cx="50" cy="50" r="42" pathLength="100"/><circle class="val" cx="50" cy="50" r="42" pathLength="100"/><circle class="pkm" cx="50" cy="50" r="42" pathLength="100"/></svg><div class="rv"><b>—</b><small>${d.u}</small></div><span class="rgl">${d.l}</span></div>`;
const gate = what => `<div class="gate"><svg class="ic"><use href="#i-gauge"/></svg><b>Mode performance désactivé</b><span>${what} À activer seulement à l’arrêt ou sur route fermée.</span><button class="pill pri" data-a="perfon">Activer</button></div>`;
const avail = () => (Car.s.egtC != null ? 'e' : '') + (Car.s.oilC != null ? 'o' : '');

const NAMES = ['1. Moteur', '2. Performance', '3. Puissance'];
const PGS = ['engine', 'perf', 'power'];
/* Couple / puissance estimés : courbe du moteur × charge moteur (le calculateur ne les donne pas) */
let CVk = '';
const getCV = () => { const k = (S.hpPeak || 75) + '|' + (S.nmPeak || 230); if (!CV || CVk !== k) { CV = curve(); CVk = k; HMAX = up50((+S.hpPeak || 75) * 1.18); NMAX = Math.max(HMAX * 2, up50((+S.nmPeak || 230) * 1.2)); } return CV; };
const tqAt = r => { const R = getCV(), rows = R.rows; if (r <= rows[0][0]) return rows[0][2]; if (r >= rows[rows.length - 1][0]) return rows[rows.length - 1][2]; const k = (r - rows[0][0]) / 100, a = Math.floor(k), f = k - a; return rows[a][2] + (rows[a + 1][2] - rows[a][2]) * f; };
const estNm = () => (Car.s.rpm == null || Car.s.loadPct == null) ? null : tqAt(Car.s.rpm) * clamp(Car.s.loadPct / 94, 0, 1);
const estHp = () => { const n = estNm(); return n == null ? null : hpOf(n, Car.s.rpm); };
const BARS = () => [
  { id: 'nm', l: 'Couple', u: 'N.m', min: 0, get max() { return +S.nmPeak || 230; }, dec: 0, get: estNm, peak: 1 },
  { id: 'hp', l: 'Puissance', u: 'ch', min: 0, get max() { return +S.hpPeak || 75; }, dec: 0, get: estHp, peak: 1 },
  { id: 'boost', l: 'Pression turbo', u: 'bar', min: -1, max: 2.2, dec: 2, get: boost, peak: 1, thr: 'boost' },
  Car.s.oilC != null ? { id: 'oilc', l: 'T° Huile', u: '°C', min: 40, max: 150, dec: 0, get: s_('oilC'), thr: 'oil' } : { id: 'coolant', l: 'T° Eau', u: '°C', min: 40, max: 120, dec: 0, get: s_('coolantC'), thr: 'coolant' },
  { id: 'iat', l: 'T° Admission', u: '°C', min: 0, max: 90, dec: 0, get: s_('iatC'), peak: 1, thr: 'iat' },
  { id: 'thr', l: 'Pédale', u: '%', min: 0, max: 100, dec: 0, get: s_('throttlePct') }
];
let bars = BARS();
function page() {
  const m = $('#mMain'); if (!m) return; nodes = {};
  const idx = PGS.indexOf(pg);
  let b = '', title = ['Bargraphes', 'Chrono', 'Courbe moteur'][idx];
  if (pg === 'engine') {
    availSig = avail(); bars = BARS();
    if (S.monView === 'gauges') {
      const pair = bars.slice(gp * 2, gp * 2 + 2);
      b = `<div class="gauges">${pair.map(d => ring(d, 'xl')).join('')}</div><div class="gdots">${[0, 1, 2].map(i => `<button data-gp="${i}" class="${i === gp ? 'on' : ''}" aria-label="Cadrans ${i + 1}"></button>`).join('')}</div>`;
    } else b = `<div class="brs">${bars.map(d => `<div class="br" data-d="${d.id}"><span class="bl">${d.l}</span><div class="bt"><i class="bf"></i><i class="bk"></i></div><span class="bv">—</span></div>`).join('')}</div>`;
  } else if (pg === 'perf') {
    if (!perfOn()) b = gate('Chrono 0-100, 0-200, 80-120 et force G.');
    else b = `<div class="eng"><div class="ecol">${ring({ id: 'g', l: 'Force G', u: 'g' }, 'md')}<div class="bestbox"><em>Meilleur</em><b id="chBest">—</b></div></div>
      <div class="ectr"><div class="rg xl chr" id="chRing"><svg viewBox="0 0 100 100"><circle class="trk" cx="50" cy="50" r="42" pathLength="100"/><circle class="val" cx="50" cy="50" r="42" pathLength="100"/></svg><div class="rv"><b id="chT">0,00</b><small>secondes</small></div><span class="rspd"><b id="chSpd">—</b> km/h</span><span class="rgl" id="chMsg"></span></div></div>
      <div class="ecol cc"><div class="seg vseg">${MODES.map(([id, l]) => `<button data-ch="${id}" class="${CH.id === id ? 'on' : ''}">${l}</button>`).join('')}</div><button class="pill pri big" id="chGo" data-a="chrono"></button></div></div>`;
    nodes.g = $('.rg[data-d=g]', m);
  } else {
    b = `<div class="dynohead"><div><small id="dyRead"></small></div><span class="tagp">Estimation · ${S.hpPeak || 75} ch / ${S.nmPeak || 230} Nm</span></div>
      <div class="dynobox" id="dyBox">${dynoSVG()}</div>
      <div class="dynoleg"><span><i class="p"></i>Puissance (ch)</span><span><i class="n"></i>Couple (Nm)</span><span><i class="r"></i>Origine 75 ch / 230 Nm</span><span>Touche la courbe pour lire une valeur</span></div>`;
  }
  m.innerHTML = `<div class="bgf"><div class="bgt">${title}</div><button class="bga l" data-pgn="-1" aria-label="Page précédente"><svg class="ic" viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg></button><div class="bgc">${b}</div><button class="bga r" data-pgn="1" aria-label="Page suivante"><svg class="ic" viewBox="0 0 24 24"><path d="M9 5l7 7-7 7"/></svg></button></div>
    <div class="bgbar"><button class="bgb" data-a="home" aria-label="Accueil"><svg class="ic" viewBox="0 0 24 24"><path d="M19 12H5M11 6l-6 6 6 6"/></svg></button><div class="bgpill">${NAMES[idx]}</div><button class="bgb" data-a="mview" aria-label="Changer de vue"><svg class="ic" viewBox="0 0 24 24"><circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 12l4-3" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></button><button class="bgb" data-a="settings" aria-label="Réglages du Moniteur moteur"><svg class="ic" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg></button></div>`;
  m.querySelectorAll('.rg[data-d]').forEach(n => { nodes[n.dataset.d] = { n, v: n.querySelector('b'), val: n.querySelector('.val'), pk: n.querySelector('.pkm') }; });
  m.querySelectorAll('.br').forEach(n => { nodes[n.dataset.d] = { br: n, v: n.querySelector('.bv'), f: n.querySelector('.bf'), k: n.querySelector('.bk') }; });
  chUI(); if (pg === 'power') { dyRead(null); const h = $('#dyBox'); h.addEventListener('pointermove', dyScrub); h.addEventListener('pointerdown', dyScrub); h.addEventListener('pointerleave', () => { dyRead(null); $('#dyCur')?.setAttribute('opacity', 0); }); } dirty = true, kick(); paint();
}
const setT = (n, t) => { if (n && n.textContent !== t) n.textContent = t; };
const setDash = (c, f) => { if (!c) return; c.style.strokeOpacity = f < .005 ? 0 : 1; const d = (75 * f).toFixed(1) + ' 100'; if (c.style.strokeDasharray !== d) c.style.strokeDasharray = d; };
function chUI() {
  const go = $('#chGo'), msg = $('#chMsg'), best = $('#chBest'); if (!go) return;
  const [, , a] = cur(), v = Car.s.speedKmh;
  setT(go, { idle: 'Armer', armed: 'Annuler', run: 'Annuler', done: 'Rejouer' }[CH.st]);
  let t = 'Prêt';
  if (CH.st === 'armed') t = v == null ? 'Vitesse indisponible' : a === 0 ? (v < 2 ? 'Accélère à fond' : 'Arrête-toi') : (v < a ? `Passe ${a} km/h puis accélère` : `Ralentis sous ${a} km/h`);
  else if (CH.st === 'run') t = 'Go';
  else if (CH.st === 'done') t = CH.t < mon.best[CH.id] + .001 ? 'Meilleur temps' : 'Terminé';
  setT(msg, t); setT(best, mon.best[CH.id] ? fmt(mon.best[CH.id], 2) + ' s' : '—');
  $('#chRing')?.classList.toggle('run', CH.st === 'run'); $('#chRing')?.classList.toggle('done', CH.st === 'done');
}
function paint() {
  const now = performance.now();
  if (pg === 'engine' && S.monView === 'gauges') {
    bars.slice(gp * 2, gp * 2 + 2).forEach(d => {
      const o = nodes[d.id]; if (!o || !o.val) return; const v = d.get();
      if (v == null) { o.n.dataset.s = 'na'; setT(o.v, '—'); setDash(o.val, 0); return; }
      const f = clamp((v - d.min) / (d.max - d.min), 0, 1), lim = d.thr && mon.thr[d.thr] != null ? mon.thr[d.thr] * (d.k || 1) : null;
      o.n.dataset.s = lim != null && v > lim ? 'bad' : ''; setT(o.v, fmt(v, d.dec)); setDash(o.val, f);
      if (d.peak && (peaks[d.id] == null || v > peaks[d.id])) peaks[d.id] = v;
    });
  } else if (pg === 'engine') {
    bars.forEach(d => {
      const o = nodes[d.id]; if (!o) return; const v = d.get(); let txt = '—', f = 0, st = '';
      if (v == null) st = 'na'; else {
        txt = fmt(v, d.dec) + ' ' + d.u; f = clamp((v - d.min) / (d.max - d.min), 0, 1);
        const lim = d.thr && mon.thr[d.thr] != null ? mon.thr[d.thr] * (d.k || 1) : null; if (lim != null && v > lim) st = 'bad';
        if (d.peak && (peaks[d.id] == null || v > peaks[d.id])) peaks[d.id] = v;
      }
      setT(o.v, txt); const clip = `inset(0 ${((1 - f) * 100).toFixed(1)}% 0 0)`; if (o.f.style.clipPath !== clip) o.f.style.clipPath = clip;
      if (o.br.dataset.s !== st) o.br.dataset.s = st;
      const p = peaks[d.id]; if (d.peak && p != null) { o.k.style.opacity = 1; const l = (clamp((p - d.min) / (d.max - d.min), 0, 1) * 100).toFixed(1) + '%'; if (o.k.style.left !== l) o.k.style.left = l; } else o.k.style.opacity = 0;
    });
  } else if (pg === 'perf' && perfOn()) {
    const [, , a, b] = cur(), v = Car.s.speedKmh;
    let t = CH.st === 'run' ? (now - CH.t0) / 1000 : CH.st === 'done' ? CH.t : 0;
    setT($('#chT'), fmt(t, 2)); setT($('#chSpd'), v == null ? '—' : String(Math.round(v)));
    const f = v == null ? 0 : clamp((v - a) / (b - a), 0, 1); setDash($('#chRing .val'), CH.st === 'done' ? 1 : (CH.st === 'run' ? f : 0));
    const g = nodes.g, ac = accel();
    if (g) { const gl = ac == null ? null : ac / 9.81; setT(g.v, gl == null ? '—' : (gl >= 0 ? '+' : '') + fmt(gl, 2)); setDash(g.val, gl == null ? 0 : clamp(Math.abs(gl) / 1, 0, 1)); g.n.dataset.s = gl == null ? 'na' : ''; }
    chUI();
  }
  const mi = null; if (mi) { const b = boost(), s = Car.s; setT($('#mm-b'), b == null ? '—' : fmt(b, 2)); setT($('#mm-c'), s.coolantC == null ? '—' : String(Math.round(s.coolantC))); setT($('#mm-r'), s.rpm == null ? '—' : String(Math.round(s.rpm))); }
  dirty = false;
}
let slow = 0;
/* Affichage à la demande : on ne redessine que quand une valeur arrive (ou pendant un chrono),
   au lieu de tourner à 60 images/s en permanence. Une donnée reçue s'affiche quand même à l'image suivante. */
function loop() {
  raf = 0; if (!visible) return;
  const live = M.view === 'monitor' && pg === 'perf' && CH.st === 'run';
  if (dirty || live) paint();
  if (live) raf = requestAnimationFrame(loop);
}
function kick() { if (visible && !raf) raf = requestAnimationFrame(loop); }
setInterval(() => { if (visible && M.view === 'monitor' && pg === 'engine' && avail() !== availSig) page(); }, 1500);
function setVisible(on) {
  visible = on; if (on) { dirty = true; kick(); }
  
}

$('#mMain').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  if (b.dataset.gp) { gp = +b.dataset.gp; return page(); }
  if (b.dataset.pg) { pg = b.dataset.pg; return page(); }
  if (b.dataset.pgn) { pg = PGS[(PGS.indexOf(pg) + +b.dataset.pgn + 3) % 3]; return page(); }
  if (b.dataset.ch) { if (CH.st === 'run' || CH.st === 'armed') return; CH.id = b.dataset.ch; CH.st = 'idle'; return page(); }
  const a = b.dataset.a;
  if (a === 'settings') return M.openSection?.('rsmon');
  if (a === 'mview') { S.monView = S.monView === 'gauges' ? 'bars' : 'gauges'; saveS(); pg = 'engine'; return page(); }
  if (a === 'home') return M.go('home');
  if (a === 'perfon') { S.perf = 'on'; saveS(); return page(); }
  if (a === 'chrono') { if (CH.st === 'done') { CH.st = 'armed'; CH.ready = false; Sim.want = null; return page(); } return chBtn(); }
});
$('#mMain').addEventListener('pointerdown', e => { const r = e.target.closest('.br'); if (r && pg === 'engine') { delete peaks[r.dataset.d]; dirty = true, kick(); } });

/* ---------- Réglages > Moniteur moteur ---------- */
const stepT = (k, min, max, step, u) => `<div class="step" data-th="${k}" data-min="${min}" data-max="${max}" data-step="${step}"><button data-d="-1">−</button><span>${fmt(mon.thr[k], step < 1 ? 1 : 0)} ${u}</span><button data-d="1">+</button></div>`;
M.rsRows = () => {
  const { row } = M.ui, btn = (a, l) => `<button class="pill" data-rs="${a}">${l}</button>`;
  const now = Date.now(), n = DIALS.filter(d => d.get() != null).length;
  return [
    row('Vue du Moniteur moteur', 'Barres (liste) ou cadrans ronds, 2 par page', M.ui.seg('monView', [['bars', 'Barres'], ['gauges', 'Cadrans']])),
    row('Alertes moteur', 'Une notification, une seule fois, quand une limite est dépassée', M.ui.seg('alerts', [['on', 'Activées'], ['off', 'Désactivées']])),
    row('Surpression', 'Alerte au-dessus', stepT('boost', 1.2, 2.2, .1, 'bar')), row('Eau', 'Alerte au-dessus', stepT('coolant', 95, 115, 1, '°C')),
    row('Air d’admission', 'Alerte au-dessus', stepT('iat', 45, 90, 1, '°C')), row('Échappement', 'Alerte au-dessus, si sonde', stepT('egt', 600, 850, 10, '°C')),
    row('Huile', 'Alerte au-dessus, si capteur', stepT('oil', 110, 150, 1, '°C')), row('Batterie moteur tournant', 'Alerte en dessous', stepT('batt', 11, 13, .1, 'V')),
    row('Enregistrement', `${Rec.rows.length} mesures${Rec.on ? ' · en cours' : ''}. 5 mesures par seconde, export CSV.`, `<div class="pbtns">${btn('rec', Rec.on ? 'Arrêter' : 'Enregistrer')}${btn('csv', 'Exporter')}</div>`),
    row('Pics et meilleurs temps', 'Remet à zéro les pics et les meilleurs temps', btn('reset', 'Remettre à zéro')),
    row('Capteurs reçus', `${n} sur ${DIALS.length}. « Indisponible » : le poste ne transmet pas ce capteur (huile et EGT demandent une sonde externe).`, ''),
    `<div class="sens">${DIALS.map(d => { const v = d.get(), t = Car.t[d.k], age = t ? Math.round((now - t) / 1000) : null; return `<div class="${v == null ? 'na' : ''}"><i></i><span>${d.l}</span><b>${v == null ? 'Indisponible' : fmt(v, d.dec) + ' ' + d.u + (age > 5 ? ' · ' + age + ' s' : '')}</b></div>`; }).join('')}</div>`
  ].join('');
};
$('#smain').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  const st = b.closest('[data-th]');
  if (st && b.dataset.d) { const k = st.dataset.th, step = +st.dataset.step; mon.thr[k] = +clamp(+(mon.thr[k] + step * +b.dataset.d).toFixed(2), +st.dataset.min, +st.dataset.max).toFixed(2); save(); st.querySelector('span').textContent = fmt(mon.thr[k], step < 1 ? 1 : 0) + ' ' + st.querySelector('span').textContent.split(' ').pop(); return; }
  const a = b.dataset.rs; if (!a) return;
  if (a === 'rec') recToggle(); else if (a === 'csv') exportCsv();
  else if (a === 'reset') { mon.best = {}; Object.keys(peaks).forEach(k => delete peaks[k]); save(); toast('Remis à zéro'); }
});

/* ---------- Mini Moniteur moteur (volet de l'écran partagé) ---------- */
M.mini = () => '<div class="mini-host" id="miniMon"></div>';
M.miniAttach = () => { const h = $('#miniMon'), mm = $('#mMain'); if (!h || !mm) return; h.appendChild(mm); mm.classList.add('inpane'); pg = 'engine'; page(); };
M.miniDetach = () => { const mm = $('#mMain'), vm = $('#view-monitor'); if (mm && vm && mm.parentNode !== vm) { vm.appendChild(mm); mm.classList.remove('inpane'); } };

/* ---------- Démo : simulation physique pilotée par les commandes ---------- */
const TQ = STOCK;   // forme de la courbe du 1.6 BlueHDi 75 (la simulation suit ensuite les valeurs réglées)
const tq = r => tqAt(r);   // la simulation suit la puissance / le couple réglés
const KRPM = [0, 118, 64, 41, 30.5, 24.5];   // tr/min par km/h, rapports 1-5 (BVM5, approximatif)
const Sim = { v: 0, g: 1, ph: 'idle', t: 0, tv: 40, b: 0, iat: 30, cool: 88, thr: 0, last: 0, timer: null, want: null };
const wantNow = () => {
  if (CH.st === 'armed' || CH.st === 'run') return cur()[2] === 0 ? 'stand' : 'roll';
  return null;
};
function demoStep() {
  if (!M.Sim.demoOn) return;
  const now = performance.now(), dt = Math.min(.25, (now - (Sim.last || now - 100)) / 1000); Sim.last = now; Sim.t += dt;
  const w = wantNow(), kmh = Sim.v * 3.6, end = w === 'dyno' ? 0 : w ? cur()[3] + 8 : 0;
  const go = (ph, tv) => { Sim.ph = ph; Sim.t = 0; if (tv) Sim.tv = tv; };
  if (Sim.ph !== 'pull') {
    if (w === 'stand') { if (kmh > 1.5) { if (Sim.ph !== 'brake') go('brake'); } else if (Sim.ph !== 'hold') go('hold'); else if (Sim.t > 1.2) go('pull'); }
    else if (w) { if (Sim.ph === 'prep' && Math.abs(kmh - Sim.tv) < 2.5 && Sim.t > 1.5) go('pull'); else if (Sim.ph !== 'prep') go('prep', w === 'dyno' ? 44 : cur()[2] - 10); }
    else if (Sim.ph === 'hold' || Sim.ph === 'prep') go(kmh > 1.5 ? 'brake' : 'idle');
  } else if (Sim.force ? kmh > Sim.force : (!w || (w === 'dyno' ? Car.s.rpm > 4500 : kmh > end))) go('brake');
  if (!w) {
    if (Sim.ph === 'idle' && Sim.t > 2.5) go('drive', 30 + Math.random() * 25);
    else if (Sim.ph === 'drive' && kmh > Sim.tv - 1 && Sim.t > 6) go('brake');
  }
  if (Sim.ph === 'brake' && kmh < 3) { Sim.v = 0; go(w === 'stand' ? 'hold' : 'idle'); if (Sim.force) { Sim.force = 0; if (!['monitor', 'split'].includes(M.view)) { demoOn(false); Car.update({ speedKmh: 0, rpm: 0, mapKpa: null, baroKpa: null, iatC: null, loadPct: null, railBar: null, throttlePct: null, gLat: null }, 'sim'); } } }
  let thr = 0;
  if (Sim.ph === 'pull') thr = 1; else if (Sim.ph === 'drive' || Sim.ph === 'prep') thr = kmh < Sim.tv - 1 ? .35 : kmh > Sim.tv + 3 ? 0 : .12;
  Sim.thr += (thr - Sim.thr) * .5;
  const dynoG = w === 'dyno';
  if (dynoG && (Sim.ph === 'pull' || kmh > 30)) Sim.g = 3;
  else if (Sim.ph === 'pull' && !dynoG) { if (Sim.v * 3.6 * KRPM[Sim.g] > 4300 && Sim.g < KRPM.length - 1) Sim.g++; }
  else { let g = 1; while (g < KRPM.length - 1 && kmh * KRPM[g] > 2000) g++; Sim.g = Sim.ph === 'idle' || Sim.ph === 'hold' ? 1 : g; }
  if (Sim.ph === 'pull' && !dynoG && Sim.v < .5) Sim.g = 1;
  const rpm = Sim.v < .5 ? 800 + Sim.thr * 600 : Math.max(800, kmh * KRPM[Sim.g]);
  const T = tq(rpm) * (Sim.v < .5 ? .5 : 1) * Sim.thr, P = T * rpm * 2 * Math.PI / 60, m = +S.massKg || 1500;
  let a;
  if (Sim.ph === 'brake') a = -3.8;
  else if (Sim.v < 3) a = Math.min(4.5, P * PHYS.eta / 5 / m) * (Sim.thr > .2 ? Math.min(1, Sim.thr * 1.6) : 0);
  else a = (P * PHYS.eta / Sim.v - (.5 * PHYS.rho * PHYS.cda * Sim.v * Sim.v + PHYS.crr * m * 9.81)) / m - (Sim.thr < .05 ? .4 : 0);
  Sim.v = Math.max(0, Sim.v + a * dt);
  const bT = Sim.thr > .5 ? 1.2 * clamp((rpm - 1300) / 600, 0, 1) * tq(rpm) / (+S.nmPeak || 230) : Sim.thr > .1 ? .25 : -.3;
  Sim.b += (bT - Sim.b) * .3; Sim.iat += ((30 + Math.max(0, Sim.b) * 14) - Sim.iat) * .02; Sim.cool += ((89 + Sim.thr * 4) - Sim.cool) * .02;
  const k2 = Sim.v * 3.6, lat = k2 > 15 && !w ? .32 * Math.sin(now / 1500) * Math.min(1, k2 / 80) : 0;
  Car.update({ speedKmh: Math.round(k2 * 10) / 10, rpm: Math.round(rpm), mapKpa: 101.3 + Sim.b * 100, baroKpa: 101, iatC: Sim.iat, coolantC: Sim.cool, throttlePct: Math.round(Sim.thr * 100),
    loadPct: Sim.thr > .3 ? clamp(Sim.thr * (88 + 12 * tq(rpm) / (+S.nmPeak || 230)), 0, 100) : 8 + Sim.thr * 20, railBar: 300 + Sim.thr * (rpm / 4500) * 1300, batteryV: 14.2, handbrake: false, gLat: +lat.toFixed(2) }, 'sim');
}
M.driveTest = (v = 130) => { if (!M.Sim.demoOn) M.Sim.setDemo(true); Sim.v = 0; Sim.ph = 'pull'; Sim.t = 0; Sim.g = 1; Sim.force = v; Sim.last = 0; demoOn(true); };
const demoOn = on => { clearInterval(Sim.timer); Sim.last = 0; if (on) Sim.timer = setInterval(demoStep, 100); };

/* ---------- Branchement sur la navigation ---------- */
M.onView = v => {
  const need = v === 'monitor' || v === 'split';
  setVisible(need);
  if (v !== 'monitor') { if (CH.st === 'armed' || CH.st === 'run') CH.st = 'idle'; }
  demoOn(need && M.Sim.demoOn);
  if (!need && M.Sim.demoOn) { Sim.v = 0; Sim.ph = 'idle'; Sim.thr = 0; Car.update({ speedKmh: 0, rpm: 0, mapKpa: null, baroKpa: null, iatC: null, loadPct: null, railBar: null, throttlePct: null, gLat: null }, 'sim'); }
  if (v === 'monitor') page();
};
page();
})();
