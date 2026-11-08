'use strict';
/* =========================================================
   Peugeot 208 · Launcher — logique
   - Car      : état de la voiture (null = « Indisponible », jamais de faux chiffres)
   - Thème    : jour/nuit auto selon les phares (ou l'horaire en secours)
   - Native   : pont vers l'app Android (WebView). Mock dans le navigateur.
   Contrat de données : voir CLAUDE.md
   ========================================================= */
(() => {

/* ---------------------------------------------------------
   CONFIG — à adapter
--------------------------------------------------------- */
const CONFIG = {
  vehicle: { name: 'Peugeot 208 Performance', sub: '1.6 BlueHDi 75' },
  weather: { lat: -21.3789, lon: 55.6186 }, cities: { joseph: { n: 'Saint-Joseph', lat: -21.3789, lon: 55.6186 }, pierre: { n: 'Saint-Pierre', lat: -21.3393, lon: 55.4781 } },
  dev: true,                               // simulateur visible (false en prod)
  demo: true,                              // données de démo au démarrage (false en prod)
  lightsDebounceMs: 900                    // évite le flicker des appels de phares
};

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const root = document.documentElement;
const app = $('#app');
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
/* Texte venant de l'extérieur (titre, artiste, RDS, nom d'appareil, nom d'appli) : affiché comme texte, jamais comme du code */
const esc = t => String(t ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const n1 = v => v.toFixed(1).replace('.', ',');

/* ---------------------------------------------------------
   Réglages (localStorage)
--------------------------------------------------------- */
const DEFAULTS = {
  brightness: 100, theme: 'auto', nightSource: 'lights', nightStart: 20, dayStart: 7,
  cardOpacity: 62, lightsImage: 'auto', accent: 'auto', carColor: 'silver',
  anim: 'full', wxCity: 'joseph', fuelMode: 'range', showSpeed: 'on', platter: 'on', autoRot: 'on', monView: 'bars', prefSrc: 'last', radioAuto: 'off', notifSound: 'on', mediaHome: 'keep', startView: 'home', autoHome: 'off', consoAvg: 4.6, tankL: 50, glass: 'off', showCar: window.LITE ? 'off' : 'on', bigNp: 'on', centerW: 'media', showLogo: 'on', lgOp: 14, lgBlur: 10, lgSat: 170, lgRef: 46, lgEdge: 55, bootAnim: 'on', look: 'dark', wallpaper: 'f:assets/wallpapers/208-eq323qw.webp', hpPeak: 75, nmPeak: 230, navApp: 'gmaps', wifi: 'on', bt: 'on', dnd: 'off', src: 'radio', favs: [88.1, 95.3, 98.5], perf: 'off', massKg: 1140, alerts: 'on', doorAnim: 'on', radarBeep: 'off', mon: null, dataSource: 'can', showRadars: 'on', shortcut: 'android_auto', npVol: 'on', npAdv: 'on', appIcons: 'color', optim: 'auto', bootLook: 'auto', tlW: 'clock',
  splitLayout: 'both', splitL: 'music', splitR: 'maps', splitAuto: 'on', photoY: 50, photoZoom: 100
};
let S = { ...DEFAULTS };
try { Object.assign(S, JSON.parse(localStorage.getItem('p208.settings') || '{}')); } catch (e) {}
// fond intégré (aperçu) : jamais figé dans les réglages, sinon une ancienne version de l'image resterait affichée
if (/^f:data:|^f:assets\/wallpapers\/208\.webp$/.test(String(S.wallpaper || ''))) S.wallpaper = DEFAULTS.wallpaper;
// une seule fois : bascule sur le nouveau fond 208 (plaque EQ-323-QW), même si une ancienne photo avait été choisie
if (S.wpRev !== 3) { S.wallpaper = DEFAULTS.wallpaper; S.wpRev = 3; try { localStorage.setItem('p208.settings', JSON.stringify(S)); } catch (e) {} }
const saveS = () => { try { localStorage.setItem('p208.settings', JSON.stringify(S)); } catch (e) {} };

/* ---------------------------------------------------------
   Pont natif (Android WebView ↔ JS). Voir CLAUDE.md
--------------------------------------------------------- */
const APP_FR = { android_auto:'Android Auto', carplay:'CarPlay', maps:'Plans', waze:'Waze', spotify:'Spotify', youtube:'YouTube', radio:'Radio', bluetooth:'Bluetooth', phone:'Téléphone', camera:'Caméra', settings:'Réglages' };
const Native = {
  launch(id)        { window.Android?.launch ? window.Android.launch(id) : toast(`${APP_FR[id] || 'Application'} : s’ouvre sur le poste Android`); },
  openSettings(w)   { window.Android?.openSettings ? window.Android.openSettings(w) : toast(`Réglages ${w === 'wifi' ? 'Wi-Fi' : w === 'bluetooth' ? 'Bluetooth' : 'système'} : s’ouvrent sur le poste Android`); },
  setBrightness(p)  { window.Android?.setBrightness?.(p); },
  radio(cmd)        { window.Android?.radio?.(cmd); },
  mediaInfo()       { return window.Android?.mediaInfo ? window.Android.mediaInfo() : 'Disponible uniquement sur le poste.'; },
  ram()             { try { return window.Android?.ram ? JSON.parse(window.Android.ram()) : { total: 4 * 2 ** 30, free: (1.3 + Math.random() * .3) * 2 ** 30 }; } catch (e) { return {}; } },
  source(s)         { window.Android?.source?.(s); },
  media(cmd)        { window.Android?.media?.(cmd); },
  volume(v)         { window.Android?.setVolume?.(v); },
  power(cmd)        { window.Android?.power ? window.Android.power(cmd) : toast(cmd === 'off' ? 'Extinction (disponible sur le poste Android)' : 'Redémarrage (disponible sur le poste Android)'); },
  copy(text)        { if (window.Android?.copy) return window.Android.copy(text); navigator.clipboard?.writeText(text).catch(() => {}); }
};

/* ---------------------------------------------------------
   Car : état + événements
--------------------------------------------------------- */
const KEYS = ['headlights', 'doors.fl', 'doors.fr', 'doors.rl', 'doors.rr', 'doors.trunk', 'doors.hood',
  'handbrake', 'reverse', 'speedKmh', 'rpm', 'coolantC', 'fuelPct', 'batteryV', 'outsideC', 'radars',
  'radarRear', 'radarFront', 'phone', 'phoneName', 'throttlePct', 'gLat', 'mapKpa', 'baroKpa', 'iatC', 'loadPct', 'railBar', 'egtC', 'oilC', 'oilBar', 'phoneBatt'];

const Car = {
  s: Object.fromEntries(KEYS.map(k => [k, null])),
  t: {},          // horodatage de la dernière réception par signal
  L: {},
  on(ev, fn) { (this.L[ev] = this.L[ev] || []).push(fn); },
  emit(ev, ...a) { (this.L[ev] || []).forEach(f => f(...a)); },
  update(patch, src = 'bus') {
    const flat = {};
    (function f(o, p) { for (const k in o) { const v = o[k], key = p ? p + '.' + k : k; (v && typeof v === 'object') ? f(v, key) : flat[key] = v; } })(patch, '');
    const changed = [], now = Date.now();
    for (const k in flat) {
      const v = flat[k] === undefined ? null : flat[k];
      if (!(k in this.s)) { this.raw(k, v, src); continue; }
      this.t[k] = now;
      if (this.s[k] !== v) { this.s[k] = v; changed.push(k); this.emit('raw', k, v, src); }
    }
    if (changed.length) this.emit('change', changed);
  },
  raw(name, val, src = 'bus') { this.emit('raw', name, val, src); },   // signal non mappé (utile au diag)
  reset() { KEYS.forEach(k => this.s[k] = null); this.t = {}; this.emit('change', KEYS.slice()); }
};
// Points d'entrée pour le code natif :
window.onCarState = json => { const p = typeof json === 'string' ? JSON.parse(json) : json; Car.update(p, 'native'); if ('phoneName' in p) { Src.bt.name = p.phoneName || (window.Android ? 'Téléphone' : ''); Src.bt.on = window.Android ? true : !!p.phoneName; renderMediaAll(); } };
window.onRawEvent = (name, value, source) => Car.raw(name, value, source || 'native');
window.Car = Car;

/* ---------------------------------------------------------
   Thème jour/nuit + phares
--------------------------------------------------------- */
let nightNow = null, lightsT = null;
function computeNight() {
  if (S.theme === 'night') return true;
  if (S.theme === 'day') return false;
  if (S.nightSource === 'lights' && Car.s.headlights !== null) return Car.s.headlights === true;
  const h = new Date().getHours();
  return S.nightStart > S.dayStart ? (h >= S.nightStart || h < S.dayStart) : (h >= S.nightStart && h < S.dayStart);
}
function applyTheme() {
  const n = computeNight();
  if (n !== nightNow) { nightNow = n; root.dataset.theme = n ? 'night' : 'day'; applyPhotos(); if (S.look === 'auto') dispatchEvent(new Event('m6settings')); }
}
// Apparence réellement affichée : « Auto » suit le mode nuit (phares allumés, sinon horaires)
function lookNow() {
  if (S.look !== 'auto') return S.look === 'light' ? 'light' : 'dark';
  return (nightNow === null ? computeNight() : nightNow) ? 'dark' : 'light';
}
const lightsOnImage = () => S.lightsImage === 'auto' ? Car.s.headlights === true : S.lightsImage === 'on';
function applyLights() {
  const on = lightsOnImage();
  root.dataset.lights = on ? 'on' : 'off';
  applyPhotos();
}

/* ---------------------------------------------------------
   Mode Optimisation : Auto / Activé / Désactivé
   Activé = pas d'effet verre, animations réduites, pas d'ombres ni de halos, pas de rayonnement au démarrage.
   Auto   = activé tout seul si le poste est faible (≤ 4 cœurs et ≤ 2 Go) ou s'il saccade :
            on mesure la fluidité pendant ~0,6 s après chaque changement de page (moment le plus chargé)
            et on compte les blocages longs (> 50 ms). Aucune mesure en continu.
--------------------------------------------------------- */
const Optim = { auto: false, why: '', slow: 0, samples: 0, long: 0 };
function optimOn() { return S.optim === 'on' || (S.optim !== 'off' && Optim.auto); }
function optimTrip(why) {
  if (Optim.auto || S.optim !== 'auto') return;
  Optim.auto = true; Optim.why = why; applySettings();
  toast('Mode optimisation activé : le poste avait du mal');
  if (view === 'settings') renderSettings();
}
(() => {
  const cores = navigator.hardwareConcurrency || 8, mem = navigator.deviceMemory || 8;
  if (cores <= 4 && mem <= 2) { Optim.auto = true; Optim.why = 'poste peu puissant'; }
  try { new PerformanceObserver(l => { if (S.optim !== 'auto' || Optim.auto) return; for (const e of l.getEntries()) if (e.duration > 120) Optim.long++; if (Optim.long >= 6) optimTrip('blocages longs'); }).observe({ type: 'longtask', buffered: false }); } catch (e) {}
})();
function optimSample() {
  if (S.optim !== 'auto' || Optim.auto || document.hidden) return;
  let n = 0, t0 = 0, worst = 0, last = 0;
  const f = t => { if (!t0) t0 = last = t; else { worst = Math.max(worst, t - last); last = t; n++; } if (t - t0 < 600) requestAnimationFrame(f); else done(t); };
  const done = t => { const fps = n / ((t - t0) / 1000); Optim.samples++; if (fps < 32 || worst > 120) Optim.slow++; else Optim.slow = Math.max(0, Optim.slow - 1);
    if (Optim.slow >= 3) optimTrip(Math.round(fps) + ' images/s'); };
  requestAnimationFrame(f);
}

function applySettings() {
  queueMicrotask(() => { renderTL(); dispatchEvent(new Event('m6settings')); });
  root.dataset.platter = S.autoRot === 'on' ? 'on' : S.platter; root.dataset.anim = S.anim; root.dataset.glass = S.glass; root.dataset.accent = S.accent; root.dataset.car = S.carColor; root.dataset.nocar = S.showCar === 'off' ? '1' : '0'; root.dataset.centre = S.showCar === 'off' ? (S.centerW || 'media') : 'car'; root.dataset.bignp = (S.showCar === 'off' && (S.centerW || 'media') === 'media') ? '1' : '0'; root.dataset.logo = S.showLogo === 'off' ? '0' : '1'; root.style.setProperty('--lg-a', (S.lgOp / 100).toFixed(2)); root.style.setProperty('--lg-blur', S.lgBlur + 'px'); root.style.setProperty('--lg-sat', (S.lgSat / 100).toFixed(2)); root.style.setProperty('--lg-edge', (S.lgEdge / 100).toFixed(2)); if (window.renderHomeNp) renderHomeNp();
  if (optimOn()) { root.dataset.anim = 'reduced'; root.dataset.glass = 'off'; root.dataset.lite = '1'; } else delete root.dataset.lite;
  root.style.setProperty('--card-op', S.cardOpacity / 100);
  root.style.setProperty('--py', S.photoY + '%'); root.style.setProperty('--pz', S.photoZoom / 100);
  root.style.setProperty('--dimmer', ((100 - S.brightness) / 100 * 0.75).toFixed(3));
  Native.setBrightness(S.brightness);
  applyTheme(); applyLights(); renderCar();
}

/* ---------------------------------------------------------
   Rendu des données voiture (coalescé dans un rAF)
--------------------------------------------------------- */
const el = id => document.getElementById(id);
const E = { fuelL: el('lFuel'), fuel: el('vFuel'), batt: el('vBatt'), out: el('vOut'), eng: el('vEng'), top: el('outTop'), tag: el('tagMeteo') };
document.getElementById('wxCities')?.addEventListener('click', e => { const b = e.target.closest('button[data-city]'); if (!b || S.wxCity === b.dataset.city) return; S.wxCity = b.dataset.city; saveS(); WX.data = null; WX.render(); WX.load(); });
$('#fuelRow')?.addEventListener('click', () => { S.fuelMode = S.fuelMode === 'range' ? 'inst' : S.fuelMode === 'inst' ? 'avg' : 'range'; saveS(); renderCar(); });
function setV(node, txt, ok) { if (node.textContent !== txt) node.textContent = txt; node.classList.toggle('ok', !!ok); }
const DOORS = { fl: 'd-fl', fr: 'd-fr', rl: 'd-rl', rr: 'd-rr', trunk: 'd-trunk', hood: 'd-hood' };
const GMAP = { fl: 'g-fl', fr: 'g-fr', rl: 'g-rl', rr: 'g-rr', trunk: 'g-trunk', hood: 'g-hood' };

/* Consommation : débit estimé (ralenti + charge × régime) si le calculateur ne fournit pas fuelLph ; moyenne glissante sur la distance. */
const FU = { dist: 0, used: 0, t: 0 };
function fuelFlow(s) { if (s.fuelLph != null) return s.fuelLph; if (s.rpm == null) return null; const l = (s.loadPct ?? 20) / 100; return 0.9 + Math.pow(l, 1.2) * (s.rpm / 4000) * 52; }
function fuelInfo(s) {
  const q = fuelFlow(s), v = s.speedKmh ?? 0, avg = S.consoAvg || 4.6, o = {};
  const inst = s.consoInst ?? (q == null ? null : (v > 8 ? q / v * 100 : null));
  o.instN = inst != null ? n1(Math.min(inst, 30)).replace('.', ',') : null;
  o.inst = q == null && inst == null ? null : (o.instN != null ? o.instN + ' L/100' : '– – L/100');
  o.avg = n1(avg).replace('.', ',') + ' L/100';
  o.range = s.fuelPct == null ? null : Math.round(s.fuelPct / 100 * (S.tankL || 50) / avg * 100) + ' km';
  return o;
}
setInterval(() => {   // intègre la conso réelle sur le trajet (1 Hz)
  const s = Car.s, q = fuelFlow(s), v = s.speedKmh ?? 0; if (q == null) return;
  FU.dist += v / 3600; FU.used += q / 3600;
  if (FU.dist > 1) { S.consoAvg = Math.round(((S.consoAvg || 4.6) * .98 + FU.used / FU.dist * 100 * .02) * 100) / 100; FU.dist = FU.used = 0; saveS(); }
  if (!document.hidden) { renderHud(); if (S.fuelMode === 'inst') renderCar(); }
}, 1000);
function renderHud() {
  const el = $('#hud'); if (!el) return; const s = Car.s, F = fuelInfo(s);
  el.hidden = S.showSpeed === 'off' || view !== 'home';
  $('#hudV').textContent = Math.round(s.speedKmh || 0);
  $('#hudC').textContent = F.instN != null ? F.instN : '– –';
  const g = (i, v, d = 0) => { const e = $('#' + i); if (e) e.textContent = v == null ? '–' : Number(v).toFixed(d).replace('.', ','); };
  g('hnE1', s.rpm); g('hnE2', s.coolantC); g('hnE3', s.iatC); g('hnE4', s.batteryV, 1);
  if ($('#hnW1')) { $('#hnW1').textContent = $('#wxT')?.textContent || '–'; $('#hnW2').textContent = $('#wxC')?.textContent || ''; $('#hnW3').textContent = $('#wxM')?.textContent || ''; }
  const a = $('#hnpV'); if (a) { a.textContent = Math.round(s.speedKmh || 0); $('#hnpC').textContent = F.instN != null ? F.instN : '– –'; }
  renderTL();
}
function renderCar() {
  renderHud();
  const s = Car.s;
  const F = fuelInfo(s), m = S.fuelMode === 'inst' || S.fuelMode === 'avg' ? S.fuelMode : 'range';
  E.fuelL.textContent = m === 'range' ? 'Autonomie' : m === 'inst' ? 'Conso instantanée' : 'Conso moyenne';
  setV(E.fuel, F[m] ?? 'Indisponible', F[m] != null);
  setV(E.batt, s.batteryV == null ? 'Indisponible' : n1(s.batteryV) + ' V', s.batteryV != null);
  const out = s.outsideC ?? (WX.data ? WX.data.temp : null);
  setV(E.out, out == null ? 'Indisponible' : n1(out) + ' °C', out != null);
  E.tag.hidden = !(s.outsideC == null && WX.data);
  setV(E.top, out == null ? '' : n1(out) + '°C');
  setV(E.eng, s.coolantC == null ? 'Indisponible' : Math.round(s.coolantC) + ' °C', s.coolantC != null);

  for (const k in DOORS) {
    const o = s['doors.' + k], b = el(DOORS[k]);
    const txt = o == null ? 'Indisponible' : o ? 'Ouvert' : 'Fermé';
    if (b.textContent !== txt) b.textContent = txt;
    b.className = o == null ? '' : o ? 'open' : 'ok';
    el(GMAP[k]).classList.toggle('open', o === true);
  }
  const r = el('d-radars');
  r.textContent = s.radars == null ? 'Indisponible' : s.radars ? 'Actifs' : 'Inactifs';
  r.className = s.radars == null ? '' : 'ok';
  el('liRadar').hidden = S.showRadars !== 'on';
  if (view === 'diag') renderDiag();
}
let rq = false;
const sched = () => { if (!rq) { rq = true; requestAnimationFrame(() => { rq = false; renderCar(); }); } };
Car.on('change', keys => {
  sched();
  if (keys.includes('headlights')) { applyLights(); clearTimeout(lightsT); lightsT = setTimeout(applyTheme, CONFIG.lightsDebounceMs); }
});

/* ---------------------------------------------------------
   Horloge (1 tick / minute, aligné)
--------------------------------------------------------- */
function tickClock() {
  const d = new Date();
  $('#clock').textContent = d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  $('#date').textContent = cap(d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'long' }));
  applyTheme();
  setTimeout(tickClock, 60000 - d.getSeconds() * 1000 - d.getMilliseconds() + 40);
}

/* ---------------------------------------------------------
   Météo (Open-Meteo, sans clé). Indisponible hors ligne.
--------------------------------------------------------- */
const WMO = c => c === 0 ? ['Dégagé', 'i-sun'] : c <= 2 ? ['Éclaircies', 'i-partly'] : c === 3 ? ['Couvert', 'i-cloud']
  : c <= 48 ? ['Brouillard', 'i-fog'] : c <= 67 || (c >= 80 && c <= 82) ? ['Pluie', 'i-rain']
  : c <= 77 || c === 85 || c === 86 ? ['Neige', 'i-rain'] : ['Orage', 'i-storm'];
const WX = {
  data: null,
  async load() {
    try {
      const ctl = new AbortController(), to = setTimeout(() => ctl.abort(), 6000);
      const { lat, lon } = CONFIG.cities[S.wxCity] || CONFIG.cities.joseph;
      const u = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,weather_code&hourly=temperature_2m,weather_code&daily=temperature_2m_max,temperature_2m_min&timezone=auto&forecast_days=2`;
      const j = await (await fetch(u, { signal: ctl.signal })).json(); clearTimeout(to);
      const now = new Date(j.current.time), idx = j.hourly.time.findIndex(t => new Date(t) >= now);
      this.data = {
        temp: j.current.temperature_2m, feels: j.current.apparent_temperature, hum: j.current.relative_humidity_2m,
        wind: j.current.wind_speed_10m, code: j.current.weather_code,
        min: j.daily.temperature_2m_min[0], max: j.daily.temperature_2m_max[0],
        next: [2, 4, 6].map(o => ({ h: new Date(j.hourly.time[idx + o]).getHours(), t: j.hourly.temperature_2m[idx + o], c: j.hourly.weather_code[idx + o] }))
      };
    } catch (e) {
      this.data = CONFIG.demo ? { temp: 27.4, feels: 29, hum: 68, wind: 14, code: 1, min: 21, max: 29,
        next: [{ h: 19, t: 25, c: 0 }, { h: 21, t: 24, c: 1 }, { h: 23, t: 23, c: 3 }], demo: true } : null;
    }
    this.render(); renderCar();
  },
  render() {
    document.querySelectorAll('#wxCities button').forEach(b => b.classList.toggle('on', b.dataset.city === (S.wxCity || 'joseph')));
    const d = this.data, ic = (h, c) => (c === 0 && (h < 6 || h >= 19)) ? 'i-moon' : WMO(c)[1];
    if (!d) { $('#wxT').textContent = '—'; $('#wxC').textContent = 'Indisponible'; $('#wxM').innerHTML = ''; $('#wxH').innerHTML = ''; return; }
    $('#wxT').textContent = Math.round(d.temp) + '°';
    $('#wxC').textContent = WMO(d.code)[0];
    document.querySelectorAll('#wxCities button').forEach(b => b.classList.toggle('on', b.dataset.city === (S.wxCity || 'joseph')));
    $('#wxI').innerHTML = `<use href="#${WMO(d.code)[1]}"/>`;
    $('#wxM').innerHTML = `Ressenti ${Math.round(d.feels)}° · Vent ${Math.round(d.wind)} km/h · Humidité ${Math.round(d.hum)}%<br>Min ${Math.round(d.min)}° · Max ${Math.round(d.max)}°`;
    $('#wxH').innerHTML = d.next.map(x => `<div class="chip"><small>${x.h} h</small><svg class="ic"><use href="#${ic(x.h, x.c)}"/></svg><b>${Math.round(x.t)}°</b></div>`).join('');
  }
};

/* ---------------------------------------------------------
   Navigation
--------------------------------------------------------- */
const panels = { apps: $('#view-apps'), settings: $('#view-settings'), diag: $('#view-diag'), split: $('#view-split'), monitor: $('#view-monitor'), media: $('#view-media'), maint: $('#view-maint') };
let view = 'home', pickMode = false, pickFrom = 'split', section = 'screen';
function go(v) {
  setTimeout(optimSample, 0);
  if (v === view) return;
  view = v; app.dataset.view = v;
  for (const k in panels) { const on = k === v; panels[k].classList.toggle('on', on); panels[k].setAttribute('aria-hidden', String(!on)); }
  $$('.dbtn[data-go]').forEach(b => b.setAttribute('aria-selected', String(b.dataset.go === 'vehicle' && v === 'vehicle')));
  if (v === 'settings') renderSettings();
  if (v === 'apps') renderApps();
  if (v !== 'split') window.M6.miniDetach?.();
  if (v === 'split') renderSplit();
  if (v === 'media') { if (S.prefSrc !== 'last' && srcAvail(S.prefSrc)) S.src = S.prefSrc; if (S.src === 'radio' && S.radioAuto === 'on' && !Radio.on) { Radio.on = true; Native.radio('unmute'); } renderMedia(); }
  if (v === 'home' && S.mediaHome === 'pause') { if (Media.playing) { Native.media('pause'); setMedia({ playing: false }); } if (Radio.on) { Radio.on = false; Native.radio('mute'); } }
  window.dispatchEvent(new CustomEvent('m6view', { detail: v }));
  if (v === 'maint') window.M6?.maintRender?.();
  splitTick(v === 'split'); renderTL(); renderHud();   // le compteur de l'accueil disparaît tout de suite des autres pages
  if (v !== 'apps') { pickMode = false; $('#pickBar').hidden = true; }
  diagTimer(v === 'diag');
  if (v === 'diag') renderDiag();
  renderNP(); renderIsland();
  window.M6?.onView?.(v);
}
document.addEventListener('click', e => {
  const b = e.target.closest('[data-go]'); if (b) go(b.dataset.go);
});
$('#homeBtn').addEventListener('click', () => go('home'));

/* ---------------------------------------------------------
   Apps + raccourci (appui long = changer l'appli)
--------------------------------------------------------- */
const APPS = [
  { id: 'android_auto', n: 'Android Auto', i: 'i-aa', c: ['#34d399', '#059669'] },
  { id: 'carplay', n: 'CarPlay', i: 'i-apple', c: ['#4b5563', '#111827'] },
  { id: 'rsmonitor', n: 'Moniteur moteur', i: 'i-gauge', c: ['#60a5fa', '#1e40af'] },
  { id: 'waze', n: 'Waze', i: 'i-waze', c: ['#5fd0ff', '#1e88c7'] },
  { id: 'gmaps', n: 'Google Maps', i: 'i-gmaps', c: ['#7ee0a0', '#2a9d5c'] },
  { id: 'spotify', n: 'Spotify', i: 'i-spotify', c: ['#4ade80', '#15803d'] },
  { id: 'ytmusic', n: 'YT Music', i: 'i-ytmusic', c: ['#fb7185', '#be123c'] },
  { id: 'youtube', n: 'YouTube', i: 'i-youtube', c: ['#f87171', '#b91c1c'] },
  { id: 'com.android.vending', n: 'Play Store', i: 'i-gplay', c: ['#38bdf8', '#16a34a'] },
  { id: 'com.android.chrome', n: 'Chrome', i: 'i-chrome', c: ['#fbbf24', '#ef4444'] },
  { id: 'maps', n: 'Navigation', i: 'i-map', c: ['#60a5fa', '#2563eb'] },
  { id: 'music', n: 'Média', i: 'i-music', c: ['#f472b6', '#c026d3'] },
  { id: 'phone', n: 'Téléphone', i: 'i-phone', c: ['#4ade80', '#16a34a'] },
  { id: 'messages', n: 'Messages', i: 'i-msg', c: ['#60a5fa', '#2563eb'] },
  { id: 'camera', n: 'Caméra', i: 'i-camera', c: ['#94a3b8', '#475569'] },
  { id: 'files', n: 'Fichiers', i: 'i-folder', c: ['#fbbf24', '#d97706'] },
  { id: 'gallery', n: 'Galerie', i: 'i-image', c: ['#a78bfa', '#7c3aed'] },
  { id: 'clock', n: 'Horloge', i: 'i-clock', c: ['#cbd5e1', '#64748b'] },
  { id: 'settings', n: 'Réglages', i: 'i-gear', c: ['#9ca3af', '#4b5563'] },
  { id: 'entretien', n: 'Entretien', i: 'i-wrench', c: ['#fbbf24', '#d97706'] },
  { id: 'diag', n: 'Diagnostic', i: 'i-engine', c: ['#f87171', '#b91c1c'] },
  { id: 'vehicle', n: 'Véhicule', i: 'i-car', c: ['#94a3b8', '#475569'] },
  { id: 'radio', n: 'Radio FM', i: 'i-radio', c: ['#fb923c', '#ea580c'] },
  { id: 'bluetooth', n: 'Bluetooth', i: 'i-bt', c: ['#60a5fa', '#1d4ed8'] },
  { id: 'contacts', n: 'Contacts', i: 'i-user', c: ['#2dd4bf', '#0f766e'] },
  { id: 'calendar', n: 'Agenda', i: 'i-cal', c: ['#f87171', '#dc2626'] },
  { id: 'weather', n: 'Météo', i: 'i-partly', c: ['#7dd3fc', '#0284c7'] },
  { id: 'calculator', n: 'Calculatrice', i: 'i-calc', c: ['#fdba74', '#c2410c'] }
];
/* Rubriques de la page Applis (les applis Android en plus arrivent dans « Autres applications ») */
const APP_SECTIONS = [['Projection', ['android_auto', 'carplay']], ['Ma 208', ['rsmonitor', 'entretien', 'diag', 'vehicle', 'settings']],
  ['Navigation', ['gmaps', 'waze', 'maps']], ['Musique et vidéo', ['music', 'radio', 'spotify', 'ytmusic', 'youtube']],
  ['Téléphone et outils', ['phone', 'messages', 'contacts', 'calendar', 'weather', 'clock', 'calculator', 'camera', 'gallery', 'files', 'bluetooth']],
  ['Internet', ['com.android.chrome', 'com.android.vending']]];
// L'appli Android envoie la vraie liste des applis installées (Play Store, Chrome, etc.) :
// window.onApps([{ id: 'com.package', n: 'Nom', icon: 'data:image/png;base64,…' }, …])
window.onApps = j => {
  const list = typeof j === 'string' ? JSON.parse(j) : j;
  list.forEach(a => {
    const i = APPS.findIndex(x => x.id === a.id);
    const rec = { id: a.id, n: a.n, i: 'i-grid', c: ['#64748b', '#334155'], icon: a.icon };
    if (i >= 0) { APPS[i].n = a.n || APPS[i].n; if (a.icon) APPS[i].icon = a.icon; } else APPS.push(rec);
  });
  if (view === 'apps') renderApps();
};
const appById = id => APPS.find(a => a.id === id) || APPS[0];
const appBtn = (a, tag) => `<button class="app ${tag ? 'cur' : ''}" data-app="${esc(a.id)}"><i style="--c1:${a.c[0]};--c2:${a.c[1]}">${a.icon ? `<img src="${esc(a.icon)}" alt="" loading="lazy" decoding="async">` : `<svg class="ic"><use href="#${a.i}"/></svg>`}</i><span>${esc(a.n)}</span>${tag ? `<em class="pk-tag">${tag}</em>` : ''}</button>`;
const PK_GROUPS = [['Navigation', ['gmaps', 'waze', 'maps']], ['Musique et vidéo', ['music', 'spotify', 'ytmusic', 'youtube']], ['Voiture', ['rsmonitor', 'entretien', 'vehicle', 'diag']], ['Téléphone', ['phone']]];
const NO_SPLIT = ['android_auto', 'carplay'];   // s’ouvrent en plein écran Android : impossible dans un volet
function renderApps() {
  const bar = $('#pickBar'); bar.hidden = !pickMode;
  $('#appGrid').classList.toggle('pk', !!pickMode);
  $('#view-apps').dataset.ic = S.appIcons || 'color';
  if (!pickMode) {   // grille simple, 7 par ligne, centrée (ordre de la liste APPS ; les applis Android en plus arrivent à la fin)
    const html = APPS.map(x => appBtn(x)).join('');
    if ($('#appGrid').innerHTML.length !== html.length) $('#appGrid').innerHTML = html;
    return;
  }
  const side = pickMode === 'splitL' ? 'de gauche' : 'de droite';
  bar.innerHTML = `<button class="pk-back" data-pk="back"><svg class="ic" viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg>Retour</button><div class="pk-t"><b>Choisis l’application ${side}</b><small>Elle s’affichera dans l’écran partagé</small></div>`;
  const used = new Set([...PK_GROUPS.flatMap(g => g[1]), ...NO_SPLIT]), tag = id => (S.splitL === id ? 'Gauche' : '') + (S.splitL === id && S.splitR === id ? ' · ' : '') + (S.splitR === id ? 'Droite' : '');
  const groups = [...PK_GROUPS.map(([t, ids]) => [t, ids.map(appById).filter(Boolean)]), ['Autres', APPS.filter(a => !used.has(a.id))]];
  $('#appGrid').innerHTML = groups.filter(g => g[1].length).map(([t, l]) => `<h4 class="pk-h">${t}</h4><div class="pk-grid">${l.map(a => appBtn(a, tag(a.id))).join('')}</div>`).join('');
}
$('#pickBar').addEventListener('click', e => { if (e.target.closest('[data-pk=back]')) { pickMode = false; go(pickFrom); } });
$('#appGrid').addEventListener('click', e => {
  const b = e.target.closest('[data-app]'); if (!b) return;
  const id = b.dataset.app;
  if (pickMode) {
    const key = pickMode; pickMode = false;
    S[key] = id; saveS();
    toast('Écran partagé : ' + appById(id).n);
    go('split'); return;
  }
  if (id === 'rsmonitor') return go('monitor');
  if (id === 'music') return go('media');
  if (id === 'diag') return go('diag');
  if (id === 'vehicle') return go('vehicle');
  if (id === 'entretien') return go('maint');
  if (id === 'settings') return go('settings');
  if (id === 'radio') { S.src = 'radio'; saveS(); return go('media'); }
  if (id === 'bluetooth') return Native.launch('btapp');
  Native.launch(id);
});
/* ---------------------------------------------------------
   Réglages
--------------------------------------------------------- */
const SECTIONS = [
  ['prefs', 'Préférences', 'i-gear'], ['screen', 'Écran', 'i-screen'], ['audio', 'Audio', 'i-music'], ['bluetooth', 'Bluetooth', 'i-bt'],
  ['navigation', 'Navigation', 'i-nav'], ['vehicle', 'Véhicule', 'i-car'], ['apps', 'Applications', 'i-grid'], ['rsmon', 'Moniteur moteur', 'i-gauge'], ['system', 'Système', 'i-gear']
];
const row = (t, sub, ctrl) => `<div class="srow"><div class="st"><b>${t}</b>${sub ? `<small>${sub}</small>` : ''}</div><div class="sc">${ctrl}</div></div>`;
const seg = (k, opts) => `<div class="seg" data-key="${k}">${opts.map(([v, l]) => `<button data-v="${v}" class="${String(S[k]) === String(v) ? 'on' : ''}">${l}</button>`).join('')}</div>`;
const slider = (k, min, max) => `<input type="range" class="rng" data-key="${k}" min="${min}" max="${max}" value="${S[k]}" style="--p:${(S[k] - min) / (max - min) * 100}%">`;
const stepper = (k, min, max, suf, st = 1) => `<div class="step" data-key="${k}" data-min="${min}" data-max="${max}"><button data-d="-${st}">−</button><span>${S[k]} ${suf}</span><button data-d="${st}">+</button></div>`;
const btn = (a, l) => `<button class="pill" data-act="${a}">${l}</button>`;
const info = t => `<span class="info-t">${t}</span>`;
const SWATCH = { silver: ['#eef2f6', '#8e98a5'], graphite: ['#aab1bb', '#383e47'], black: ['#4b525d', '#0a0c10'], white: ['#ffffff', '#a9b1bc'], red: ['#e8505a', '#5a0710'] };
const swatches = () => `<div class="sw" data-key="carColor">${Object.entries(SWATCH).map(([v, c]) => `<button data-v="${v}" class="${S.carColor === v ? 'on' : ''}" style="--c1:${c[0]};--c2:${c[1]}" aria-label="${v}"></button>`).join('')}</div>`;

const SECTION_HTML = {
  screen: () => [
    row('Luminosité', 'Réglage de l’écran du launcher', slider('brightness', 20, 100)),
    row('Thème', 'Auto : suit les phares (ou l’horaire si le poste ne les transmet pas)', seg('theme', [['auto', 'Automatique'], ['day', 'Jour'], ['night', 'Nuit']])),
    S.theme === 'auto' ? row('Source du mode nuit', 'Phares : le thème bascule quand tu allumes les feux', seg('nightSource', [['lights', 'Phares'], ['schedule', 'Horaires']])) : '',
    row('Début de la nuit', 'Utilisé si les phares ne sont pas transmis', stepper('nightStart', 17, 23, 'h')),
    row('Début du jour', '', stepper('dayStart', 4, 10, 'h')),
    row('Opacité des cartes', 'Plus opaque = plus lisible en plein soleil', slider('cardOpacity', 30, 95)),
    row('Phares sur l’image', 'Auto : l’image suit les vrais phares de la voiture', seg('lightsImage', [['auto', 'Auto'], ['off', 'Éteints'], ['on', 'Allumés']])),
    row('Photos de la voiture', 'Jour, nuit, phares allumés. Une seule suffit pour tester', `<div class="pbtns">${['day', 'night', 'lights'].map(k => `<button class="pill ${Photos[k] ? 'has' : ''}" data-act="photo:${k}">${SLOT_LABEL[k]}${Photos[k] ? ' ✓' : ''}</button>`).join('')}<button class="pill" data-act="photo:clear">Effacer</button></div>`),
    row('Cadrage vertical de la photo', 'Descend ou monte la voiture dans l’écran', slider('photoY', 0, 100)),
    row('Zoom de la photo', '', slider('photoZoom', 100, 160)),
    row('Couleur de la voiture (dessin)', 'Sans photo uniquement', swatches()),
  ].join(''),
  audio: () => [
    row('Réglages audio Android', 'Sortie, égaliseur et volumes : gérés par Android et le poste', btn('os:sound', 'Ouvrir'))
  ].join(''),
  prefs: () => [
    row('Mode optimisation', S.optim === 'auto' ? (Optim.auto ? `Actif automatiquement (${Optim.why}). Effets légers désactivés pour garder la fluidité` : 'Auto : s’active tout seul si le poste a du mal (saccades)') : S.optim === 'on' ? 'Actif : pas d’effet verre, animations réduites, pas d’ombres ni de halos' : 'Désactivé : tous les effets, même si le poste a du mal', seg('optim', [['auto', 'Auto'], ['on', 'Activé'], ['off', 'Désactivé']])),
    row('Apparence', S.look === 'auto' ? `Auto : ${lookNow() === 'dark' ? 'sombre' : 'clair'} en ce moment. Sombre quand les phares sont allumés, ou la nuit (réglable dans Écran)` : 'Mode sombre, mode clair ou automatique', seg('look', [['auto', 'Auto'], ['dark', 'Sombre'], ['light', 'Clair']])),
    row('Fond d’écran', 'Une image de ton dossier, ou aucune', btn('wp:open', 'Choisir')),
    row('Source à l’ouverture de Média', 'Quelle source s’affiche quand tu ouvres Média', seg('prefSrc', [['last', 'Dernière'], ['radio', 'Radio'], ['bt', 'Bluetooth'], ['usb', 'USB']])),
    row('Radio FM automatique', 'Lance la radio dès que tu ouvres Média sur la source Radio', seg('radioAuto', [['on', 'Oui'], ['off', 'Non']])),
    row('Volume sur le lecteur de l’accueil', 'Barre de volume sous le lecteur central', seg('npVol', [['on', 'Afficher'], ['off', 'Masquer']])),
    row('Commandes avancées du lecteur', 'Aléatoire, répétition, source et « À suivre » sur le lecteur central', seg('npAdv', [['on', 'Afficher'], ['off', 'Masquer']])),
    row('Icônes de la page Applis', 'En couleur (plus facile à reconnaître) ou unies grises', seg('appIcons', [['color', 'Couleur'], ['mono', 'Unies']])),
    row('En haut à gauche de l’accueil', 'Astuce : appui long dessus pour changer vite', seg('tlW', [['clock', 'Heure'], ['speed', 'Vitesse'], ['range', 'Autonomie'], ['weather', 'Météo'], ['none', 'Rien']])),
    row('Retour à l’accueil', 'La musique continue ou se met en pause quand tu reviens à l’accueil', seg('mediaHome', [['keep', 'Continue'], ['pause', 'Pause']])),
    row('Son des notifications', 'Petit bip simple (coupé en mode Ne pas déranger)', seg('notifSound', [['on', 'Activé'], ['off', 'Désactivé']])),
    row('Ne pas déranger', 'Coupe les bannières et les sons de notification', seg('dnd', [['on', 'Activé'], ['off', 'Désactivé']])),
    row('Vue au démarrage', 'Page affichée après l’animation de démarrage', seg('startView', [['home', 'Accueil'], ['media', 'Média'], ['monitor', 'Moniteur moteur']])),
    row('Retour automatique à l’accueil', 'Revient seul à l’accueil quand tu n’y touches plus', seg('autoHome', [['off', 'Jamais'], ['60', '1 min'], ['180', '3 min']])),
    row('Logo de la marque en haut', 'Masque ou affiche le logo au centre de la barre du haut', seg('showLogo', [['on', 'Afficher'], ['off', 'Masquer']])),
    window.LITE ? '' : row('Voiture sur l’accueil', 'Désactivé = voiture et plateau retirés. Astuce : appui long au centre de l’accueil pour changer vite', seg('showCar', [['on', 'Afficher'], ['off', 'Cacher']])),
    S.showCar === 'off' ? row('Au centre de l’accueil', 'Ce qui remplace la voiture. Le son n’apparaît que s’il y a quelque chose à écouter', seg('centerW', [['media', 'Son'], ['speed', 'Vitesse'], ['engine', 'Moteur'], ['weather', 'Météo'], ['clock', 'Heure'], ['none', 'Rien']])) : '',
    S.showCar === 'off' ? '' : row('Rotation automatique', 'La voiture fait un tour complet lentement sur son plateau', seg('autoRot', [['on', 'Activée'], ['off', 'Désactivée']])),
    S.showCar === 'off' ? '' : S.autoRot === 'on' ? row('Plateau sous la voiture', 'Toujours affiché tant que la rotation est activée', info('Affiché')) : row('Plateau sous la voiture', 'Disque rond sous la voiture', seg('platter', [['on', 'Oui'], ['off', 'Non']])),
    row('Couleur d’accent', 'Auto : bleu', seg('accent', [['auto', 'Auto'], ['blue', 'Bleu'], ['red', 'Rouge']])),
    row('Animations', '', seg('anim', [['full', 'Complètes'], ['reduced', 'Réduites']])),
    row('Effet verre', 'Flou simple ou Liquid Glass (réfraction type Apple, plus gourmand). Désactivé = zéro lag', seg('glass', [['off', 'Désactivé'], ['on', 'Flou'], ['liquid', 'Liquid Glass']])),
    S.glass === 'liquid' ? row('Liquid Glass : opacité', 'Teinte blanche du verre', slider('lgOp', 0, 45)) : '',
    S.glass === 'liquid' ? row('Liquid Glass : flou', 'Flou du fond derrière le verre', slider('lgBlur', 0, 30)) : '',
    S.glass === 'liquid' ? row('Liquid Glass : réfraction', 'Déformation du fond sur les bords (0 = aucune)', slider('lgRef', 0, 90)) : '',
    S.glass === 'liquid' ? row('Liquid Glass : saturation', 'Intensité des couleurs derrière', slider('lgSat', 100, 260)) : '',
    S.glass === 'liquid' ? row('Liquid Glass : reflets', 'Liseré lumineux sur les bords', slider('lgEdge', 0, 100)) : '',
    row('Animation de démarrage', 'S’affiche à l’allumage, avant l’accueil', seg('bootAnim', [['on', 'Activée'], ['off', 'Désactivée']])),
    row('Style de l’animation de démarrage', 'Auto : suit le mode clair ou sombre. Ne change pas ta vidéo perso', seg('bootLook', [['auto', 'Auto'], ['dark', 'Sombre'], ['light', 'Clair']])),
    row('Vidéo de démarrage', Photos.boot ? 'Vidéo ajoutée. Elle remplace l’animation de base' : 'Ajoute ta vidéo (mp4) ou dépose assets/boot.mp4', `<div class="pbtns">${btn('boot:pick', Photos.boot ? 'Changer' : 'Choisir')}${Photos.boot ? btn('boot:clear', 'Retirer') : ''}${btn('boot:play', 'Voir')}</div>`),
    row('Vitesse sur l’accueil', 'Compteur + conso instantanée incrustés sous la voiture', seg('showSpeed', [['on', 'Afficher'], ['off', 'Masquer']])),
    row('Animation des portes', 'Petite animation sur l’accueil quand une porte s’ouvre', seg('doorAnim', [['on', 'Activée'], ['off', 'Désactivée']])),
    row('Radars de recul', 'Masque la ligne si ton poste n’en a pas', seg('showRadars', [['on', 'Afficher'], ['off', 'Masquer']])),
    row('Alerte radars à l’écran', 'Arcs animés selon la distance (le poste bipe déjà)', seg('radarBeep', [['off', 'Visuel'], ['on', 'Visuel + bip']])),
    row('Alertes moteur', 'Surchauffe, surpression, batterie, carburant bas', seg('alerts', [['on', 'Activées'], ['off', 'Désactivées']])),
    row('Multi-écran : ouverture auto', 'Ouvre l’écran partagé dès qu’une musique démarre', seg('splitAuto', [['on', 'Activée'], ['off', 'Désactivée']])),
    row('Multi-écran : disposition', 'Les deux, ou une seule application en grand', seg('splitLayout', [['both', 'Les deux'], ['left', 'Gauche'], ['right', 'Droite']]))
  ].join(''),
  bluetooth: () => row('Appareils Bluetooth', 'Appairage du téléphone', btn('os:bluetooth', 'Ouvrir')),
  navigation: () => [
    row('Application de navigation', 'Ouverte par le bouton Navigation de l’écran Média', seg('navApp', [['gmaps', 'Google Maps'], ['waze', 'Waze'], ['maps', 'Plans']])),
    row('Sans téléphone connecté', 'Le poste utilise sa propre connexion : carte SIM, ou partage de connexion du téléphone en Wi-Fi. Les cartes hors-ligne (Google Maps ou Waze) marchent sans réseau.', btn('os:wifi', 'Wi-Fi')),
    row('Applications par défaut', 'Choix dans les applications par défaut d’Android', btn('os:defaults', 'Ouvrir'))
  ].join(''),
  vehicle: () => [
    row('Modèle', '', info('Peugeot 208 phase 2 · 2017 · 5 portes')),
    row('Autoradio', 'Écran QLED 1280×720, Wi-Fi, CarPlay / Android Auto sans fil, caméra AHD, commandes au volant', info('TS10 · 8 cœurs · 8 Go / 128 Go')),
    row('Motorisation', 'Origine : 75 ch à 3500 tr/min · 230 Nm à 1750 tr/min · BVM5', info('1.6 BlueHDi 75 · gazole · Euro 6b')),
    row('Puissance estimée', 'Puissance maxi de ta voiture (origine 75 ch). Le Moniteur moteur et la simulation s’y calent', stepper('hpPeak', 50, 200, 'ch', 5)),
    row('Couple estimé', 'Couple maxi (origine 230 Nm)', stepper('nmPeak', 100, 600, 'Nm', 5)),
    row('Masse du véhicule', 'Sert au chrono et à la simulation (conducteur compris)', stepper('massKg', 900, 1800, 'kg', 25)),
    row('Source des données', 'D’où viennent phares, portes, températures…', seg('dataSource', [['can', 'Boîtier CAN'], ['obd', 'OBD2 Bluetooth'], ['none', 'Aucune']])),
  ].join(''),
  apps: () => [
    row('Applications installées', 'Liste, droits et applis par défaut', btn('os:apps', 'Ouvrir')),
  ].join(''),
  rsmon: () => [
    row('Mode performance', 'Active le chrono et la force G dans le Moniteur moteur. Route fermée uniquement.', seg('perf', [['off', 'Désactivé'], ['on', 'Activé']])),
    window.M6?.rsRows?.() || ''
  ].join(''),
  system: () => [
    row('Éteindre le poste', 'Arrête Android. Il se rallume avec le contact', btn('power:off', 'Éteindre')),
    row('Mémoire (RAM)', 'RAM utilisée / totale, mise à jour toutes les 2 secondes', '<b id="ramT" class="ramt">…</b>'),
    row('Diagnostic musique', 'Montre ce que le poste voit : sessions de musique et dernières commandes', btn('mediadiag', 'Analyser')),
    row('Redémarrer le poste', 'Relance Android et le launcher', btn('power:reboot', 'Redémarrer')),
    row('Résolution de l’écran', 'Ce que voit réellement Android et l’interface', btn('res', 'Afficher')),
    row('Diagnostic CAN (lecture seule)', 'Cherche comment le poste connaît les portes et les phares. N’envoie rien à la voiture.', btn('diag', 'Analyser')),
    row('Observer 60 secondes', 'Appuie, puis ouvre une porte et allume les phares', btn('observe', 'Observer')),
    row('Codes défaut (OBD2)', 'Lecture des codes défaut moteur et FAP via un adaptateur OBD2', btn('dtc', 'Lire')),
    row('Réglages Android', 'Ouvre les vrais paramètres du poste', btn('os:main', 'Ouvrir')),
    row('Accueil par défaut', 'Réglages Android > Applis > Applis par défaut > Application d’accueil', ''),
    row('Appui long sur un raccourci', 'Change l’application qu’il ouvre', '')
  ].join('')
};
function renderSettings() {
  const sm = $('#smain'), top = sm.scrollTop;
  $('#side').innerHTML = SECTIONS.map(([id, l, i]) => `<button class="sitem ${id === section ? 'on' : ''}" data-sec="${id}"><svg class="ic"><use href="#${i}"/></svg>${l}</button>`).join('') + `<button class="sitem sos" data-act="os:main"><svg class="ic"><use href="#i-gear"/></svg>Réglages Android</button>`;
  sm.innerHTML = SECTION_HTML[section]();
  sm.scrollTop = top;
}
$('#side').addEventListener('click', e => { const o = e.target.closest('[data-act^="os:"]'); if (o) { Native.openSettings(o.dataset.act.slice(3)); return; } const b = e.target.closest('[data-sec]'); if (b) { section = b.dataset.sec; $('#smain').scrollTop = 0; renderSettings(); } });
function setKey(k, v) { S[k] = typeof DEFAULTS[k] === 'number' ? +v : v; saveS(); applySettings(); renderSettings(); }
$('#smain').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  const box = b.closest('[data-key]');
  if (box && b.dataset.v !== undefined) return setKey(box.dataset.key, b.dataset.v);
  if (box && b.dataset.d) return setKey(box.dataset.key, clamp(+S[box.dataset.key] + +b.dataset.d, +box.dataset.min, +box.dataset.max));
  if (b.dataset.act) act(b.dataset.act);
});
$('#smain').addEventListener('input', e => {
  const r = e.target; if (!r.matches('.rng')) return;
  S[r.dataset.key] = +r.value; saveS();
  r.style.setProperty('--p', ((r.value - r.min) / (r.max - r.min) * 100) + '%');
  applySettings();
});
function act(a) {
  if (a === 'intro') { go('home'); setTimeout(playIntro, 250); }
  else if (a === 'mediadiag') showText('Diagnostic musique', Native.mediaInfo());
  else if (a === 'res') toast(`${innerWidth}×${innerHeight} px · densité ${devicePixelRatio} · 1 rem = ${Math.round(parseFloat(getComputedStyle(root).fontSize) * 10) / 10} px`);
  else if (a === 'diag') go('diag');
  else if (a === 'observe') { go('diag'); observeStart(); }
  else if (a === 'dtc') toast('Indisponible : aucun adaptateur OBD2 connecté');
  else if (a === 'photo:clear') clearPhotos();
  else if (a.startsWith('power:')) confirmPower(a.slice(6));
  else if (a === 'boot:pick') pickBoot(); else if (a === 'boot:clear') { Photos.boot = null; idb.del('boot'); renderSettings(); toast('Vidéo retirée'); } else if (a === 'boot:play') window.M6.bootPlay?.();
  else if (a.startsWith('photo:')) pickFiles(a.slice(6));
  else if (a.startsWith('os:')) Native.openSettings(a.slice(3));
}

/* ---------------------------------------------------------
   Diagnostic : signaux + « Observer 60 s »
--------------------------------------------------------- */
const yn = (a, b) => v => v ? a : b;
const SIG = [
  ['Phares', 'headlights', yn('Allumés', 'Éteints')],
  ['Porte conducteur', 'doors.fl', yn('Ouverte', 'Fermée')], ['Porte passager', 'doors.fr', yn('Ouverte', 'Fermée')],
  ['Porte arrière gauche', 'doors.rl', yn('Ouverte', 'Fermée')], ['Porte arrière droite', 'doors.rr', yn('Ouverte', 'Fermée')],
  ['Coffre', 'doors.trunk', yn('Ouvert', 'Fermé')], ['Capot', 'doors.hood', yn('Ouvert', 'Fermé')],
  ['Frein à main', 'handbrake', yn('Serré', 'Desserré')], ['Marche arrière', 'reverse', yn('Engagée', 'Non')],
  ['Vitesse', 'speedKmh', v => Math.round(v) + ' km/h'], ['Régime moteur', 'rpm', v => Math.round(v) + ' tr/min'],
  ['Liquide de refroidissement', 'coolantC', v => Math.round(v) + ' °C'], ['Niveau carburant', 'fuelPct', v => Math.round(v) + ' %'],
  ['Tension batterie', 'batteryV', v => n1(v) + ' V'], ['Température extérieure', 'outsideC', v => n1(v) + ' °C'],
  ['Radars de recul', 'radars', yn('Actifs', 'Inactifs')],
  ['Radar arrière (niveau)', 'radarRear', v => v + ' / 4'], ['Téléphone', 'phone', v => v === 'ios' ? 'iPhone' : 'Android'],
  ['Pression admission (MAP)', 'mapKpa', v => Math.round(v) + ' kPa'], ['Pression baro', 'baroKpa', v => Math.round(v) + ' kPa'],
  ['Température admission', 'iatC', v => Math.round(v) + ' °C'], ['Charge moteur', 'loadPct', v => Math.round(v) + ' %'],
  ['Pression rail', 'railBar', v => Math.round(v) + ' bar'], ['Température échappement', 'egtC', v => Math.round(v) + ' °C'],
  ['Température huile', 'oilC', v => Math.round(v) + ' °C'], ['Pression huile', 'oilBar', v => n1(v) + ' bar']
];
$('#dsig').innerHTML = SIG.map(([l], i) => `<div class="drow" id="sg${i}"><i class="dot"></i><span>${l}</span><span class="dv">Indisponible</span><span class="da"></span></div>`).join('');
function renderDiag() {
  const now = Date.now();
  SIG.forEach(([, k, f], i) => {
    const r = el('sg' + i), v = Car.s[k];
    const age = Car.t[k] ? Math.round((now - Car.t[k]) / 1000) : null;
    r.className = 'drow' + (v == null ? '' : age > 30 ? ' stale' : ' ok');
    const dv = r.children[2], da = r.children[3];
    const t = v == null ? 'Indisponible' : f(v); if (dv.textContent !== t) dv.textContent = t;
    const a = v == null ? '' : age < 2 ? 'à l’instant' : 'il y a ' + (age < 90 ? age + ' s' : Math.round(age / 60) + ' min'); if (da.textContent !== a) da.textContent = a;
  });
}
const Obs = { on: false, t0: 0, log: [], timers: [] };
const RING = 119.38;
let diagInt = null;
function diagTimer(on) {
  clearInterval(diagInt);
  if (on) diagInt = setInterval(() => { renderDiag(); tickObs(); }, 1000);
}
function tickObs() {
  if (!Obs.on) return;
  const left = Math.max(0, 60 - Math.floor((performance.now() - Obs.t0) / 1000));
  $('#ringT').textContent = left;
  $('#ringF').style.strokeDashoffset = RING * (1 - left / 60);
  if (left <= 0) observeStop();
}
function logLine(html) {
  const L = $('#obsLog'); if (L.firstChild?.className === 'l-empty') L.innerHTML = '';
  L.insertAdjacentHTML('beforeend', `<div>${html}</div>`);
  while (L.childElementCount > 120) L.firstChild.remove();
  L.scrollTop = L.scrollHeight;
}
Car.on('raw', (k, v, src) => {
  if (!Obs.on) return;
  const t = ((performance.now() - Obs.t0) / 1000).toFixed(1).padStart(4, ' ');
  const known = k in Car.s;
  Obs.log.push(`+${t}s  ${k} = ${JSON.stringify(v)}  [${src}]${known ? '' : '  (non mappé)'}`);
  logLine(`<span>+${t}s</span> ${known ? `<b>${k}</b>` : `<b class="l-raw">${k}</b>`} → ${JSON.stringify(v)} <span style="opacity:.5">[${src}]</span>`);
});
function observeStart() {
  observeStop(true);
  Obs.on = true; Obs.t0 = performance.now(); Obs.log = [];
  $('#obsLog').innerHTML = '<div class="l-empty">Observation en cours… fais bouger les signaux (phares, portes, marche arrière).</div>';
  $('#obsGo').textContent = 'Arrêter';
  tickObs();
  if (Sim.demoOn) {   // scénario de démo pour voir à quoi ça ressemble
    [[3, { 'doors.fl': true }], [6, { 'doors.fl': false }], [9, { headlights: true }], [12, 'raw'], [15, { reverse: true }], [18, { reverse: false }], [22, { headlights: false }]]
      .forEach(([s, p]) => Obs.timers.push(setTimeout(() => p === 'raw' ? Car.raw('0x2F8', '00 4C 01 7A', 'can0') : Car.update(p, 'sim'), s * 1000)));
  }
}
function observeStop(silent) {
  Obs.timers.forEach(clearTimeout); Obs.timers = [];
  if (Obs.on && !silent) { logLine('<span style="opacity:.6">— fin de l’observation —</span>'); }
  Obs.on = false; $('#obsGo').textContent = 'Lancer';
  $('#ringT').textContent = '60'; $('#ringF').style.strokeDashoffset = 0;
}
$('#obsGo').addEventListener('click', () => Obs.on ? observeStop() : observeStart());
$('#obsCopy').addEventListener('click', () => {
  const head = `Peugeot 208 — rapport d’observation (${new Date().toLocaleString('fr-FR')})\nÉcran ${innerWidth}x${innerHeight}`;
  Native.copy(head + '\n' + (Obs.log.join('\n') || '(aucun événement)'));
  toast('Rapport copié');
});

/* ---------------------------------------------------------
   Animation de démarrage
--------------------------------------------------------- */
function playIntro() {
  if (S.anim === 'reduced') return;
  app.classList.remove('intro'); void app.offsetWidth; app.classList.add('intro');
  const hero = $('#hero'); hero.style.animation = 'none'; void hero.offsetWidth; hero.style.animation = '';
  setTimeout(() => app.classList.remove('intro'), 2500);
}

/* ---------------------------------------------------------
   Média façon constructeur : UNE entrée « Source » (Radio · Bluetooth · USB · AUX).
   Radio : favoris, liste des stations, recherche. Android n'a pas d'API radio standard :
   le natif relaie le tuner du poste via onRadio / Android.radio(cmd).
   Multi-écran : l'écran média + n'importe quelle appli à côté (Waze, Maps…).
--------------------------------------------------------- */
const Media = { playing: false, title: 'Aucune lecture', artist: '', pos: 0, dur: 0, next: '', cover: '' };
// Sur le poste, le Bluetooth est géré par l'appli du poste : la source Bluetooth reste toujours disponible
const Src = { bt: { on: true, name: window.Android ? 'Téléphone' : 'Pixel 8' }, usb: { on: false }, aux: { on: false } };
const Radio = { on: false, freq: 98.5, rds: '', rdsText: '', st: true, sig: 4, ta: false, af: true, stations: [{ f: 88.1, n: 'Station 88,1' }, { f: 91.5, n: 'Station 91,5' }, { f: 95.3, n: 'Station 95,3' }, { f: 98.5, n: 'Station 98,5' }, { f: 102.7, n: 'Station 102,7' }, { f: 106.0, n: 'Station 106,0' }] };
const SRCS = [['radio', 'Radio', 'i-radio'], ['bt', 'Bluetooth', 'i-bt'], ['usb', 'USB', 'i-usb'], ['aux', 'AUX', 'i-aux']];
const fq = f => f.toFixed(1).replace('.', ',');
const favName = f => (S.favNames || {})[f.toFixed(1)] || stName(f);
const stName = f => (Radio.stations.find(x => Math.abs(x.f - f) < .05) || {}).n || 'FM ' + fq(f);
/* Pochette : l'image du morceau si l'appli de musique en fournit une, sinon l'icône */
const cov = cls => Media.cover ? `<div class="${cls} hascov" style="background-image:url('${Media.cover}')"></div>` : `<div class="${cls}"><svg class="ic"><use href="#i-music"/></svg></div>`;
function setMedia(p) {
  const was = Media.playing; Object.assign(Media, p);
  if (Media.playing && !was) radioOff();   // une seule source : la lecture coupe la radio if (Media.playing) Media.touched = true; if (!hasTrack()) Media.touched = false; if (Media.playing && !was) { npOff = false; islOff = false; }
  renderMediaAll();
  if (!was && Media.playing && S.splitAuto === 'on' && view === 'home' && S.src !== 'radio' && Date.now() - (Media.userAct || 0) > 5000) go('split');
}
window.onMedia = j => setMedia(typeof j === 'string' ? JSON.parse(j) : j);
window.onRadio = j => { const o = typeof j === 'string' ? JSON.parse(j) : j; if (o.stations) Radio.stations = o.stations; ['freq', 'on', 'rds', 'rdsText', 'st', 'sig', 'ta', 'af'].forEach(k => { if (o[k] !== undefined) Radio[k] = o[k]; }); renderMediaAll(); };
window.onSources = j => { const o = typeof j === 'string' ? JSON.parse(j) : j; for (const k in o) Src[k] = o[k]; renderMediaAll(); };
/* Une seule source audio à la fois : la radio coupe le lecteur, le lecteur coupe la radio */
function radioOff() { if (!Radio.on) return; Radio.on = false; Native.radio('mute'); if (S.src === 'radio') S.src = Src.bt.on ? 'bt' : Src.usb.on ? 'usb' : S.src; }
function mediaOff() { if (!Media.playing) return; Native.media('pause'); Media.playing = false; S.src = 'radio'; }
const fmtT = t => Math.floor(t / 60) + ':' + String(Math.floor(t % 60)).padStart(2, '0');

const SRC_C = { radio: ['#fb923c', '#ea580c'], bt: ['#60a5fa', '#2563eb'], usb: ['#a78bfa', '#7c3aed'], aux: ['#94a3b8', '#475569'] };
const hasTrack = () => Media.title && Media.title !== 'Aucune lecture';
function srcInfo(id) {
  if (id === 'radio') return { sub: `FM ${fq(Radio.freq)} MHz`, det: Radio.rds || favName(Radio.freq), st: Radio.on ? 'En écoute' : 'Disponible', ok: Radio.on };
  if (id === 'bt') return Src.bt.on ? { sub: Src.bt.name, det: hasTrack() ? Media.title + (Media.artist ? ' · ' + Media.artist : '') : 'Prêt à lire', st: Media.playing ? 'En lecture' : 'Connecté', ok: Media.playing } : { sub: window.Android ? 'Appli du poste' : 'Aucun appareil', det: window.Android ? 'Ouvre l’appli Bluetooth' : 'Associe ton téléphone en Bluetooth', st: window.Android ? 'À ouvrir' : 'Non connecté', ok: false, off: true };
  if (id === 'usb') return Src.usb.on ? { sub: 'Clé détectée', det: 'Prêt à lire', st: 'Disponible', ok: false } : { sub: 'Aucune clé', det: 'Branche une clé USB avec de la musique', st: 'Non connecté', ok: false, off: true };
  return Src.aux.on ? { sub: 'Entrée active', det: 'Signal détecté', st: 'Actif', ok: true } : { sub: 'Aucun signal', det: 'Branche une source sur l’entrée AUX', st: 'Non connecté', ok: false, off: true };
}
const srcAvail = id => id === 'radio' || (Src[id] && Src[id].on);
const srcSub = id => id === 'radio' ? 'FM' : id === 'bt' ? (Src.bt.on ? Src.bt.name : (window.Android ? 'Appli du poste' : 'Aucun appareil')) : id === 'usb' ? (Src.usb.on ? 'Clé détectée' : 'Aucune clé') : (Src.aux.on ? 'Entrée active' : 'Aucun signal');

/* --- Carte « En lecture » sur l'accueil : la musique continue, on peut la piloter ou la fermer --- */
let npOff = false, npShown = false, npT = 0;
function renderNP() {
  const el = $('#np'); if (!el) return;
  const radio = S.src === 'radio';
  const live = radio ? Radio.on : Media.playing;
  const want = view === 'home' && live && !npOff;
  if (!want) {
    if (npShown) { npShown = false; el.classList.remove('in'); el.classList.add('out'); clearTimeout(npT); npT = setTimeout(() => { el.hidden = true; el.classList.remove('out'); }, 380); }
    return;
  }
  const c = SRCS.find(x => x[0] === S.src) || SRCS[0], playing = radio ? true : Media.playing;
  const title = radio ? favName(Radio.freq) : Media.title, sub = radio ? 'FM ' + fq(Radio.freq) + ' MHz' + (Radio.rds ? ' · ' + Radio.rds : '') : (Media.artist || c[1]);
  const pct = !radio && Media.dur ? Media.pos / Media.dur : 0;
  const ctl = radio
    ? `<button data-r="prev" aria-label="Station précédente"><svg class="ic"><use href="#i-prev"/></svg></button><button data-r="next" aria-label="Station suivante"><svg class="ic"><use href="#i-next"/></svg></button>`
    : `<button data-m="prev" aria-label="Précédent"><svg class="ic"><use href="#i-prev"/></svg></button><button class="big" data-m="toggle" aria-label="Lecture / pause"><svg class="ic"><use href="#${playing ? 'i-pause' : 'i-play'}"/></svg></button><button data-m="next" aria-label="Suivant"><svg class="ic"><use href="#i-next"/></svg></button>`;
  el.innerHTML = `<button class="np-src" data-act="src" aria-label="Changer de source"><svg class="ic"><use href="#${c[2]}"/></svg></button>
    <div class="np-meta" data-go="media"><b>${esc(title)}</b><span>${esc(sub)}</span></div>
    <button class="np-x" data-np="close" aria-label="Fermer"><svg class="ic"><use href="#i-x"/></svg></button>
    ${radio ? '' : `<div class="np-prog"><i style="--p:${pct}"></i></div>`}
    <div class="np-ctl">${ctl}</div>
    ${radio ? '' : `<div class="np-next"><em>À suivre</em><span>${esc(Media.next || 'Piste suivante')}</span></div>`}`;
  el.dataset.eq = playing ? '1' : '0';
  if (!npShown) { npShown = true; clearTimeout(npT); el.hidden = false; el.classList.remove('out'); void el.offsetWidth; el.classList.add('in'); }
}
document.addEventListener('click', e => {
  const x = e.target.closest('[data-np=close]'); if (x) { npOff = true; if (S.src !== 'radio' && Media.playing) { Native.media('pause'); if (!window.Android) setMedia({ playing: false }); } renderNP(); return; }
  const g = e.target.closest('#np [data-go]'); if (g) go(g.dataset.go);
});

/* ---------- Îlot multimédia (barre du haut, hors accueil) : reste affiché en pause, fermable ---------- */
let islOff = false, islShown = false, islT = 0;
function renderIsland() {
  const el = $('#island'); if (!el) return;
  const radio = S.src === 'radio';
  const live = radio ? Radio.on : (Media.playing || (Media.touched && hasTrack()));
  const want = view !== 'home' && view !== 'media' && view !== 'split' && live && !islOff;
  if (!want) {
    if (islShown) { islShown = false; el.classList.remove('in'); el.classList.add('out'); clearTimeout(islT); islT = setTimeout(() => { el.hidden = true; el.classList.remove('out'); }, 320); }
    return;
  }
  const c = SRCS.find(x => x[0] === S.src) || SRCS[0], playing = radio ? true : Media.playing;
  const title = radio ? favName(Radio.freq) : Media.title, sub = radio ? 'FM ' + fq(Radio.freq) + ' MHz' : (Media.artist || c[1]);
  const pct = !radio && Media.dur ? Media.pos / Media.dur : 0;
  const ctl = radio
    ? `<button data-r="prev" aria-label="Station précédente"><svg class="ic"><use href="#i-prev"/></svg></button><button data-r="next" aria-label="Station suivante"><svg class="ic"><use href="#i-next"/></svg></button>`
    : `<button data-m="prev" aria-label="Précédent"><svg class="ic"><use href="#i-prev"/></svg></button><button class="big" data-m="toggle" aria-label="Lecture / pause"><svg class="ic"><use href="#${playing ? 'i-pause' : 'i-play'}"/></svg></button><button data-m="next" aria-label="Suivant"><svg class="ic"><use href="#i-next"/></svg></button>`;
  el.innerHTML = `<button class="isl-src" data-go="media" aria-label="Ouvrir Média"><svg class="ic"><use href="#${c[2]}"/></svg></button>
    <div class="isl-meta" data-go="media"><b>${esc(title)}</b><span>${esc(sub)}</span>${radio ? '' : `<i class="isl-bar" style="--p:${pct}"></i>`}</div><div class="isl-ctl">${ctl}</div>
    <button class="isl-x" data-isl="close" aria-label="Fermer"><svg class="ic"><use href="#i-x"/></svg></button>`;
  el.dataset.eq = playing ? '1' : '0';
  if (!islShown) { islShown = true; clearTimeout(islT); el.hidden = false; el.classList.remove('out'); void el.offsetWidth; el.classList.add('in'); }
}
document.addEventListener('click', e => { if (e.target.closest('[data-isl=close]')) { islOff = true; renderIsland(); } });

const srcBtn = () => { const c = SRCS.find(x => x[0] === S.src); return `<button class="srcbtn" data-act="src"><svg class="ic"><use href="#${c[2]}"/></svg><span><small>Source</small>${c[1]}</span><svg class="ic chev"><use href="#i-next"/></svg></button>`; };

function radioHTML(full) {
  const isFav = S.favs.some(f => Math.abs(f - Radio.freq) < .05), pc = (Radio.freq - 87.5) / 20.5 * 100;
  const favs = [0, 1, 2, 3, 4, 5].map(i => { const f = S.favs[i]; return f ? `<button class="fv ${Math.abs(f - Radio.freq) < .05 ? 'on' : ''}${favEdit ? ' ed' : ''}" data-r="fav:${i}"><b>${fq(f)}</b><small>${esc(favName(f))}</small></button>` : `<button class="fv empty" data-r="fav:${i}"><b>+</b><small>Favori ${i + 1}</small></button>`; }).join('');
  const list = Radio.stations.map(x => `<button class="stn ${Math.abs(x.f - Radio.freq) < .05 ? 'on' : ''}" data-r="tune:${x.f}"><b>${fq(x.f)}</b><span>${esc(x.n)}</span>${S.favs.some(f => Math.abs(f - x.f) < .05) ? '<svg class="ic"><use href="#i-star"/></svg>' : ''}</button>`).join('');
  const bars = [1, 2, 3, 4].map(n => `<i class="${n <= Radio.sig ? 'on' : ''}"></i>`).join('');
  const ruler = [88, 92, 96, 100, 104, 108].map(f => `<span style="left:${(f - 87.5) / 20.5 * 100}%">${f}</span>`).join('');
  const chips = `<div class="rchips"><span class="rband">FM</span>${Radio.st ? '<span class="rchip">ST</span>' : ''}<button class="rchip rtg ${Radio.af ? 'on' : ''}" data-r="af">AF</button><button class="rchip rtg ${Radio.ta ? 'on' : ''}" data-r="ta">TA</button><span class="rsig">${bars}</span></div>`;
  const main = `<div class="rmain">${chips}
    <div class="rfreq"><b id="rF">${fq(Radio.freq)}</b><small>MHz</small></div>
    <div class="rname" id="rN">${esc(Radio.rds || favName(Radio.freq))}</div><div class="rrds">${esc(Radio.rdsText || (Radio.on ? '' : 'Sourdine'))}</div>
    <div class="dialw"><button class="fine" data-r="step:-1" aria-label="−0,1 MHz">−</button>
      <div class="dial"><div class="ruler">${ruler}</div><i class="needle" id="rNeedle" style="left:${pc}%"></i><input type="range" class="tune" id="tuneRng" min="87.5" max="108" step="0.1" value="${Radio.freq}" aria-label="Fréquence"></div>
      <button class="fine" data-r="step:1" aria-label="+0,1 MHz">+</button></div>
    <div class="ctl"><button data-r="seek:prev" aria-label="Station précédente"><svg class="ic"><use href="#i-prev"/></svg></button>
      <button class="big" data-r="mute" aria-label="${Radio.on ? 'Couper le son' : 'Remettre le son'}"><svg class="ic"><use href="#${Radio.on ? 'i-pause' : 'i-play'}"/></svg></button>
      <button data-r="seek:next" aria-label="Station suivante"><svg class="ic"><use href="#i-next"/></svg></button></div>
    <button class="favbtn ${isFav ? 'on' : ''}" data-r="togglefav"><svg class="ic"><use href="#i-star"/></svg>${isFav ? 'Retirer des favoris' : 'Ajouter aux favoris'}</button></div>`;
  return `<div class="rad ${full ? 'full' : ''}">${main}<div class="rside"><div class="fav-h"><h4>Favoris</h4><button class="pill sm ${favEdit ? 'on' : ''}" data-r="favedit">${favEdit ? 'Terminé' : 'Modifier'}</button></div><div class="favs">${favs}</div>${full ? `<div class="stl-h"><h4>Stations</h4><button class="pill sm" data-r="scan"><svg class="ic"><use href="#i-search"/></svg>Rechercher</button></div><div class="stl">${list}</div>` : ''}</div></div>`;
}
const EMPTY = {
  bt: window.Android
    ? { ic: 'i-bt', t: 'Musique Bluetooth', d: 'Le Bluetooth est géré par l’appli du poste. Ouvre-la pour lire la musique de ton téléphone.', steps: ['Appuie sur « Ouvrir Bluetooth »', 'Va dans l’onglet musique', 'Lance la lecture sur ton téléphone'], btn: '<button class="pill pri" data-act="pair">Ouvrir Bluetooth</button>' }
    : { ic: 'i-bt', t: 'Aucun appareil connecté', d: 'Associe ton téléphone pour écouter sa musique dans la voiture.', steps: ['Active le Bluetooth du téléphone', 'Cherche « Peugeot 208 » dans la liste', 'Valide le code d’association'], btn: '<button class="pill pri" data-act="pair">Associer un téléphone</button>' },
  usb: { ic: 'i-usb', t: 'Aucune clé USB', d: 'Branche une clé contenant de la musique pour la lire ici.', steps: ['Formats courants : MP3, AAC, FLAC', 'Une clé en FAT32 ou exFAT', 'La lecture démarre à la détection'], btn: '' },
  aux: { ic: 'i-aux', t: 'Aucun signal AUX', d: 'Branche une source sur l’entrée AUX du poste.', steps: ['Câble jack 3,5 mm', 'Monte le volume de la source', 'Le signal est détecté automatiquement'], btn: '' }
};
function emptyHTML(id) {
  const e = EMPTY[id], c = SRC_C[id];
  return `<div class="emp"><div class="emp-ic" style="--c1:${c[0]};--c2:${c[1]}"><svg class="ic"><use href="#${e.ic}"/></svg></div><div class="emp-t"><h2>${e.t}</h2><p>${e.d}</p><ol>${e.steps.map(x => `<li>${x}</li>`).join('')}</ol><div class="emp-b">${e.btn}<button class="pill" data-act="src">Changer de source</button></div></div></div>`;
}
const shufBtn = () => `<button class="sm ${Media.shuffle ? 'on' : ''}" data-m="shuffle" aria-label="Aléatoire"><svg class="ic" viewBox="0 0 24 24"><path d="M14.8 4H20v5.2l-1.9-1.9-12 12L5 18.2l12-12zM5 6.2 6.1 5l4.6 4.6-1.1 1.1zm12.9 10.6L20 14.8V20h-5.2l2-2-3.2-3.2 1.1-1.1z"/></svg></button>`;
const repBtn = () => `<button class="sm ${Media.repeat ? 'on' : ''}" data-m="repeat" aria-label="Répétition"><svg class="ic" viewBox="0 0 24 24"><path d="M7 7h10v3l4-4-4-4v3H5v6h2zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2z"/></svg>${Media.repeat === 2 ? '<em>1</em>' : ''}</button>`;
function playerHTML(full) {
  const id = S.src, name = id === 'bt' ? 'Bluetooth' : 'USB';
  if (!srcAvail(id)) return emptyHTML(id);
  if (id === 'aux') return `<div class="emp"><div class="emp-ic eq-ic"><div class="eq"><i></i><i></i><i></i><i></i><i></i></div></div><div class="emp-t"><h2>Entrée AUX</h2><p>Le signal est détecté. Le volume se règle avec la molette du poste et sur la source branchée.</p><div class="emp-b"><button class="pill" data-act="src">Changer de source</button></div></div></div>`;
  const pct = Media.dur ? Media.pos / Media.dur : 0, dev = id === 'bt' ? Src.bt.name : 'Clé USB';
  return `<div class="pfull" data-src="${id}">${cov('cover xl ' + (Media.playing ? 'live' : ''))}
    <div class="pinfo"><span class="pchip">${name}${id === 'bt' ? ' · ' + esc(Src.bt.name) : ''}</span>
      <h2>${esc(Media.title)}</h2><p>${esc(Media.artist || 'Artiste inconnu')}</p>
      <div class="prog"><i style="--p:${pct}"></i></div><div class="times"><span>${fmtT(Media.pos)}</span><span>${fmtT(Media.dur)}</span></div>
      <div class="ctl">${shufBtn()}<button data-m="prev" aria-label="Précédent"><svg class="ic"><use href="#i-prev"/></svg></button><button class="big" data-m="toggle" aria-label="Lecture / pause"><svg class="ic"><use href="#${Media.playing ? 'i-pause' : 'i-play'}"/></svg></button><button data-m="next" aria-label="Suivant"><svg class="ic"><use href="#i-next"/></svg></button>${repBtn()}</div>
      ${Media.next ? `<div class="upnext"><span class="cover sm"><svg class="ic"><use href="#i-music"/></svg></span><div><em>À suivre</em><b>${esc(Media.next)}</b></div></div>` : ''}
      <div class="pstats"><div><em>Appareil</em><b>${esc(dev)}</b></div><div><em>Lecture</em><b>${Media.playing ? 'En cours' : 'En pause'}</b></div><div><em>Source</em><b>${id === 'bt' ? 'Audio Bluetooth' : 'Fichiers USB'}</b></div></div></div></div>`;
}
/* Version compacte pour le volet de l'écran partagé */
function miniMediaHTML() {
  const c = SRCS.find(x => x[0] === S.src), n = srcInfo(S.src);
  const chip = `<button class="srcchip" data-act="src"><svg class="ic"><use href="#${c[2]}"/></svg><span>${c[1]}<small>${n.sub}</small></span><svg class="ic chev"><use href="#i-next"/></svg></button>`;
  if (S.src === 'radio') {
    const favs = [0, 1, 2, 3, 4, 5].map(i => { const f = S.favs[i]; return f ? `<button class="fv ${Math.abs(f - Radio.freq) < .05 ? 'on' : ''}" data-r="fav:${i}"><b>${fq(f)}</b></button>` : `<button class="fv empty" data-r="fav:${i}"><b>+</b></button>`; }).join('');
    return `<div class="mm">${chip}<div class="mm-main"><div class="mm-f"><b id="rF">${fq(Radio.freq)}</b><small>MHz</small></div><div class="mm-n" id="rN">${esc(Radio.rds || favName(Radio.freq))}</div><div class="mm-s">${esc(Radio.rdsText || ' ')}</div></div>
      <div class="ctl"><button data-r="seek:prev" aria-label="Station précédente"><svg class="ic"><use href="#i-prev"/></svg></button><button class="big" data-r="mute" aria-label="Sourdine"><svg class="ic"><use href="#${Radio.on ? 'i-pause' : 'i-play'}"/></svg></button><button data-r="seek:next" aria-label="Station suivante"><svg class="ic"><use href="#i-next"/></svg></button></div>
      <div class="mm-favs">${favs}</div></div>`;
  }
  if (!srcAvail(S.src)) { const e = EMPTY[S.src]; return `<div class="mm">${chip}<div class="mm-empty"><svg class="ic"><use href="#${e.ic}"/></svg><b>${e.t}</b><span>${e.d}</span>${e.btn}</div></div>`; }
  if (S.src === 'aux') return `<div class="mm">${chip}<div class="mm-empty"><div class="eq"><i></i><i></i><i></i><i></i><i></i></div><b>Entrée AUX</b><span>Signal détecté</span></div></div>`;
  const pct = Media.dur ? Media.pos / Media.dur : 0;
  return `<div class="mm">${chip}<div class="mm-pl">${cov('cover sm')}<div class="pmeta"><b>${esc(Media.title)}</b><span>${esc(Media.artist || ' ')}</span></div></div>
    <div class="mm-pg"><div class="prog"><i style="--p:${pct}"></i></div><div class="times"><span>${fmtT(Media.pos)}</span><span>${fmtT(Media.dur)}</span></div></div>
    <div class="ctl"><button data-m="prev"><svg class="ic"><use href="#i-prev"/></svg></button><button class="big" data-m="toggle"><svg class="ic"><use href="#${Media.playing ? 'i-pause' : 'i-play'}"/></svg></button><button data-m="next"><svg class="ic"><use href="#i-next"/></svg></button></div></div>`;
}
const mediaHTML = full => `<div class="mhead">${srcBtn()}${full ? `<div class="mact">${Car.s.phone ? '' : `<button class="pill sm" data-act="pair"><svg class="ic"><use href="#i-bt"/></svg>${window.Android ? 'Ouvrir Bluetooth' : 'Associer un téléphone'}</button>`}<button class="pill sm" data-open="${S.navApp}"><svg class="ic"><use href="#i-nav"/></svg>Navigation</button><button class="pill sm" data-go="split"><svg class="ic"><use href="#i-split"/></svg>Écran partagé</button></div>` : ''}</div><div class="mbody">${S.src === 'radio' ? radioHTML(full) : playerHTML(full)}</div>`;
function renderMedia() { $('#mediaBox').innerHTML = mediaHTML(true); }
function homeNpActive() {
  if (S.src === 'radio') return !!Radio.on;
  return srcAvail(S.src) && (Media.playing || hasTrack());
}
function renderHomeNp() {
  const el = $('#homeNp'); if (!el) return;
  const w = S.centerW || 'media', on = S.showCar === 'off' && w !== 'none' && (w !== 'media' || homeNpActive());
  el.hidden = !on; root.dataset.bignp = (S.showCar === 'off' && w === 'media' && on) ? '1' : '0'; if (!on) { el.innerHTML = ''; return; }
  if (w === 'media') el.innerHTML = homePlayerHTML();
  else if (w === 'speed') el.innerHTML = `<div class="bigspd"><div><b id="hnpV">0</b><small>km/h</small></div><div class="bs2"><b id="hnpC">– –</b><small>L/100 km</small></div></div>`;
  else if (w === 'engine') el.innerHTML = `<div class="bigeng">${[['hnE1', 'Régime', 'tr/min'], ['hnE2', 'Eau', '°C'], ['hnE3', 'Admission', '°C'], ['hnE4', 'Batterie', 'V']].map(([i, l, u]) => `<div><small>${l}</small><b id="${i}">–</b><em>${u}</em></div>`).join('')}</div>`;
  else if (w === 'weather') el.innerHTML = `<div class="bigwx"><b id="hnW1">–</b><span id="hnW2"></span><small id="hnW3"></small></div>`;
  else { el.innerHTML = `<div class="bigclk"><b id="hnpT"></b><small id="hnpD"></small></div>`; tickHomeClock(); }
  renderHud();
}
/* Lecteur central de l'accueil : compact, centré ; volume et commandes avancées masquables (Préférences) */
const volRow = () => S.npVol === 'off' ? '' : `<div class="hp-vol"><svg class="ic" viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L7 9z"/></svg><input type="range" class="hp-volr" id="hpVol" min="0" max="100" value="${Media.vol ?? 60}" aria-label="Volume"><b id="hpVolT">${Media.vol ?? 60}</b></div>`;
function homePlayerHTML() {
  const c = SRCS.find(x => x[0] === S.src) || SRCS[0], adv = S.npAdv !== 'off';
  if (S.src === 'radio') return `<div class="hp hp-radio"><div class="hp-top"><div class="cover hp-cv" style="--c1:#fb923c;--c2:#ea580c"><svg class="ic"><use href="#i-radio"/></svg></div><div class="hp-meta"><b>${esc(favName(Radio.freq))}</b><span>FM ${fq(Radio.freq)} MHz${Radio.rds ? ' · ' + esc(Radio.rds) : ''}</span></div></div>
    <div class="ctl"><button data-r="seek:prev" aria-label="Station précédente"><svg class="ic"><use href="#i-prev"/></svg></button><button class="big" data-r="mute" aria-label="Sourdine"><svg class="ic"><use href="#${Radio.on ? 'i-pause' : 'i-play'}"/></svg></button><button data-r="seek:next" aria-label="Station suivante"><svg class="ic"><use href="#i-next"/></svg></button></div>
    ${adv ? `<div class="hp-adv"><button class="hp-chip" data-act="src"><svg class="ic"><use href="#${c[2]}"/></svg>${c[1]}</button></div>` : ''}${volRow()}</div>`;
  const pct = Media.dur ? Media.pos / Media.dur : 0, rp = Media.repeat || 0;
  return `<div class="hp"><div class="hp-top">${cov('cover hp-cv')}<div class="hp-meta"><b>${esc(Media.title)}</b><span>${esc(Media.artist || 'Artiste inconnu')}</span></div></div>
    <div class="hp-pg"><div class="prog"><i style="--p:${pct}"></i></div><div class="times"><span>${fmtT(Media.pos)}</span><span>${fmtT(Media.dur)}</span></div></div>
    <div class="ctl">${adv ? `<button class="sm ${Media.shuffle ? 'on' : ''}" data-m="shuffle" aria-label="Aléatoire"><svg class="ic" viewBox="0 0 24 24"><path d="M14.8 4H20v5.2l-1.9-1.9-12 12L5 18.2l12-12zM5 6.2 6.1 5l4.6 4.6-1.1 1.1zm12.9 10.6L20 14.8V20h-5.2l2-2-3.2-3.2 1.1-1.1z"/></svg></button>` : ''}<button data-m="prev" aria-label="Précédent"><svg class="ic"><use href="#i-prev"/></svg></button><button class="big" data-m="toggle" aria-label="Lecture / pause"><svg class="ic"><use href="#${Media.playing ? 'i-pause' : 'i-play'}"/></svg></button><button data-m="next" aria-label="Suivant"><svg class="ic"><use href="#i-next"/></svg></button>${adv ? `<button class="sm ${rp ? 'on' : ''}" data-m="repeat" aria-label="Répétition"><svg class="ic" viewBox="0 0 24 24"><path d="M7 7h10v3l4-4-4-4v3H5v6h2zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2z"/></svg>${rp === 2 ? '<em>1</em>' : ''}</button>` : ''}</div>
    ${adv ? `<div class="hp-adv"><button class="hp-chip" data-act="src"><svg class="ic"><use href="#${c[2]}"/></svg>${c[1]}</button><span class="hp-next"><em>À suivre</em>${esc(Media.next || 'Piste suivante')}</span></div>` : ''}${volRow()}</div>`;
}
document.addEventListener('input', e => { if (e.target.id !== 'hpVol') return; Media.vol = +e.target.value; const t = $('#hpVolT'); if (t) t.textContent = Media.vol; Native.volume(Media.vol); });

/* En haut à gauche de l'accueil : Heure, Vitesse, Autonomie, Météo ou Rien (appui long pour changer) */
const TLW = [['clock', 'Heure'], ['speed', 'Vitesse'], ['range', 'Autonomie'], ['weather', 'Météo'], ['none', 'Rien']];
function renderTL() {
  const w = S.tlW || 'clock', box = $('#tlw'); root.dataset.tlw = w;
  root.dataset.bigclk = (S.showCar === 'off' && S.centerW === 'clock') ? '1' : '0';
  if (!box || w === 'clock' || w === 'none') return;
  const s = Car.s, F = fuelInfo(s);
  const [v, u, l] = w === 'speed' ? [Math.round(s.speedKmh || 0), 'km/h', 'Vitesse'] : w === 'range' ? [F.range ? F.range.replace(' km', '') : '—', 'km', 'Autonomie']
    : [($('#wxT')?.textContent || '—').replace('°', ''), '°C', $('#wxC')?.textContent || 'Météo'];
  const h = `<b>${v}</b><small>${u}</small><span>${l}</span>`; if (box.innerHTML !== h) box.innerHTML = h;
}
function tlPicker() {
  let sh = $('#tlsheet'); if (!sh) { sh = document.createElement('div'); sh.id = 'tlsheet'; sh.className = 'ctrsheet-like'; $('#app').appendChild(sh);
    sh.addEventListener('click', e => { const b = e.target.closest('[data-tl]'); if (b) { S.tlW = b.dataset.tl; saveS(); renderTL(); } if (b || e.target === sh) { sh.classList.remove('on'); setTimeout(() => { sh.hidden = true; }, 220); } }); }
  sh.innerHTML = `<div class="fs-card wpcard ctrcard"><h3>En haut à gauche</h3><p class="pw-t">Ce qui s’affiche à la place de l’heure sur l’accueil.</p><div class="ctrg">${TLW.map(([k, l]) => `<button class="ctrb ${(S.tlW || 'clock') === k ? 'on' : ''}" data-tl="${k}">${l}</button>`).join('')}</div></div>`;
  sh.hidden = false; requestAnimationFrame(() => sh.classList.add('on'));
}
{ let t = 0, x0 = 0, y0 = 0;
  document.addEventListener('pointerdown', e => { if (view !== 'home' || !e.target.closest?.('.clockbox')) return; x0 = e.clientX; y0 = e.clientY; clearTimeout(t); t = setTimeout(tlPicker, 650); });
  document.addEventListener('pointermove', e => { if (t && Math.hypot(e.clientX - x0, e.clientY - y0) > 12) { clearTimeout(t); t = 0; } });
  ['pointerup', 'pointercancel'].forEach(n => document.addEventListener(n, () => { clearTimeout(t); t = 0; })); }
setInterval(renderTL, 5000);

function tickHomeClock() { const t = $('#hnpT'); if (!t) return; const d = new Date(); t.textContent = d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }); $('#hnpD').textContent = d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }); }
setInterval(tickHomeClock, 5000);
window.renderHomeNp = renderHomeNp;
function renderMediaAll() { if (view === 'media') renderMedia(); else if (view === 'split') renderSplit(); renderNP(); renderIsland(); renderHomeNp(); }

/* Source (feuille de choix) */
function openSources() {
  $('#srcList').innerHTML = SRCS.map(([id, l, ic]) => { const n = srcInfo(id), c = SRC_C[id];
    return `<button class="srow3 ${S.src === id ? 'on' : ''} ${n.off ? 'off' : ''}" data-pick="${id}"><i class="sq" style="--c1:${c[0]};--c2:${c[1]}"><svg class="ic"><use href="#${ic}"/></svg></i><span class="si"><b>${l}</b><span>${esc(n.sub)}</span><small>${esc(n.det)}</small></span><em class="stt ${n.ok ? 'ok' : ''}">${n.st}</em><span class="ck">${S.src === id ? '<svg class="ic"><use href="#i-check"/></svg>' : ''}</span></button>`; }).join('');
  $('#srcSheet').hidden = false;
}
$('#srcSheet').addEventListener('click', e => {
  if (e.target.closest('[data-close]')) return $('#srcSheet').hidden = true;
  const b = e.target.closest('[data-pick]'); if (!b) return;
  S.src = b.dataset.pick; saveS(); Native.source(S.src); $('#srcSheet').hidden = true; renderMediaAll();
});

/* Actions radio / lecteur (écran Média et volet du multi-écran) */
function tune(f, send = true) { Radio.freq = clamp(Math.round(f * 10) / 10, 87.5, 108); if (!Radio.on) mediaOff(); Radio.on = true; if (send) Native.radio('tune:' + Radio.freq); }
function seek(dir) {
  const st = Radio.stations.map(x => x.f).sort((a, b) => a - b); if (!st.length) return;
  const n = dir > 0 ? (st.find(f => f > Radio.freq + .05) ?? st[0]) : ([...st].reverse().find(f => f < Radio.freq - .05) ?? st[st.length - 1]);
  tune(n, false); Native.radio('seek:' + (dir > 0 ? 'next' : 'prev'));
}
function confirmPower(kind) {
  let sh = $('#pwsheet'); if (!sh) { sh = document.createElement('div'); sh.id = 'pwsheet'; $('#app').appendChild(sh); }
  const off = kind === 'off';
  sh.innerHTML = `<div class="fs-card"><h3>${off ? 'Éteindre le poste ?' : 'Redémarrer le poste ?'}</h3><p class="pw-t">${off ? 'Android va s’arrêter. Le poste se rallumera au prochain contact.' : 'Android et le launcher vont redémarrer (environ 30 secondes).'}</p><div class="fs-b"><button class="pill danger" data-pw="${kind}">${off ? 'Éteindre' : 'Redémarrer'}</button><button class="pill" data-pw="x">Annuler</button></div></div>`;
  sh.hidden = false; requestAnimationFrame(() => sh.classList.add('on'));
}
document.addEventListener('click', e => {
  const b = e.target.closest('#pwsheet [data-pw]'), sh = $('#pwsheet'); if (!sh || (!b && e.target !== sh)) return;
  sh.classList.remove('on'); setTimeout(() => { sh.hidden = true; }, 220);
  if (b && b.dataset.pw !== 'x') Native.power(b.dataset.pw);
});
let favT = null, favLong = false, favEdit = false;
function favSheet(i) {
  const f = S.favs[i]; if (!f) return; let sh = $('#favsheet');
  if (!sh) { sh = document.createElement('div'); sh.id = 'favsheet'; $('#app').appendChild(sh); }
  sh.innerHTML = `<div class="fs-card"><h3>Favori · ${fq(f)} MHz</h3><label>Nom<input id="fsName" maxlength="24" placeholder="${stName(f)}" value="${(S.favNames || {})[f.toFixed(1)] || ''}"></label><div class="fs-b"><button class="pill" data-fs="save">Enregistrer</button><button class="pill" data-fs="swap">Mettre la station actuelle</button><button class="pill danger" data-fs="del">Retirer</button><button class="pill" data-fs="x">Annuler</button></div></div>`;
  sh.hidden = false; sh.dataset.i = i; requestAnimationFrame(() => { sh.classList.add('on'); $('#fsName').focus(); });
}
function favClose() { const sh = $('#favsheet'); if (!sh) return; sh.classList.remove('on'); setTimeout(() => { sh.hidden = true; }, 220); }
document.addEventListener('click', e => {
  const b = e.target.closest('#favsheet [data-fs]'), sh = $('#favsheet'); if (!sh || (!b && e.target !== sh)) return;
  const i = +sh.dataset.i, f = S.favs[i], k = b && b.dataset.fs;
  S.favNames = S.favNames || {};
  if (k === 'save') { const v = $('#fsName').value.trim(); if (v) S.favNames[f.toFixed(1)] = v; else delete S.favNames[f.toFixed(1)]; }
  else if (k === 'swap') { const n = S.favNames[f.toFixed(1)]; delete S.favNames[f.toFixed(1)]; S.favs[i] = Radio.freq; if (n) S.favNames[Radio.freq.toFixed(1)] = n; }
  else if (k === 'del') { delete S.favNames[f.toFixed(1)]; S.favs.splice(i, 1); toast('Favori retiré'); }
  saveS(); favClose(); renderMediaAll();
});
function radioAct(c) {
  if (c.startsWith('tune:')) tune(+c.slice(5));
  else if (c === 'seek:next') seek(1); else if (c === 'seek:prev') seek(-1);
  else if (c === 'step:1') { tune(Radio.freq + .1); } else if (c === 'step:-1') { tune(Radio.freq - .1); }
  else if (c === 'af') { Radio.af = !Radio.af; Native.radio(Radio.af ? 'af:on' : 'af:off'); } else if (c === 'ta') { Radio.ta = !Radio.ta; Native.radio(Radio.ta ? 'ta:on' : 'ta:off'); }
  else if (c === 'mute') { Radio.on = !Radio.on; if (Radio.on) mediaOff(); Native.radio(Radio.on ? 'unmute' : 'mute'); }
  else if (c === 'scan') { Native.radio('scan'); toast('Recherche des stations…'); }
  else if (c === 'togglefav') {
    const i = S.favs.findIndex(f => Math.abs(f - Radio.freq) < .05);
    if (i >= 0) S.favs.splice(i, 1); else if (S.favs.length < 6) S.favs.push(Radio.freq); else toast('6 favoris maximum : appui long sur un favori pour le remplacer');
    saveS();
  } else if (c === 'favedit') { favEdit = !favEdit;
  } else if (c.startsWith('fav:')) {
    const i = +c.slice(4);
    if ((favLong || favEdit) && S.favs[i]) return favSheet(i);
    if (S.favs[i]) tune(S.favs[i]);
    else { S.favs[i] = Radio.freq; S.favs = S.favs.filter(Boolean); saveS(); toast('Ajouté aux favoris'); }
  }
  renderMediaAll();
}
document.addEventListener('pointerdown', e => { const b = e.target.closest('.fv'); if (!b) return; favLong = false; clearTimeout(favT); favT = setTimeout(() => { favLong = true; b.dispatchEvent(new MouseEvent('click', { bubbles: true })); favLong = false; }, 650); });
['pointerup', 'pointerleave', 'pointercancel'].forEach(t => document.addEventListener(t, () => clearTimeout(favT)));
document.addEventListener('click', e => {
  const r = e.target.closest('[data-r]'); if (r && r.closest('#app')) return radioAct(r.dataset.r);
  const m = e.target.closest('[data-m]');
  if (m) { Media.userAct = Date.now(); const c = m.dataset.m;
    if (c === 'shuffle' || c === 'repeat') { Media[c] = c === 'repeat' ? ((Media.repeat || 0) + 1) % 3 : !Media[c]; Native.media(c + ':' + (+Media[c])); return renderMediaAll(); }
    if (c === 'toggle' && !Media.playing) radioOff();
    Native.media(c); if (!window.Android) c === 'toggle' ? setMedia({ playing: !Media.playing }) : setMedia({ pos: 0 }); return; }
  const op = e.target.closest('[data-open]'); if (op && !op.closest('#view-split')) return Native.launch(op.dataset.open);
  const a = e.target.closest('[data-act]');
  if (a?.dataset.act === 'src') openSources();
  if (a?.dataset.act === 'pair') Native.launch('btapp');
});
document.addEventListener('input', e => {
  if (e.target.id !== 'tuneRng') return;
  Radio.freq = +e.target.value; const f = $('#rF'), n = $('#rN'), nd = $('#rNeedle'); if (f) f.textContent = fq(Radio.freq); if (n) n.textContent = favName(Radio.freq); if (nd) nd.style.left = ((Radio.freq - 87.5) / 20.5 * 100) + '%';
});
document.addEventListener('change', e => { if (e.target.id === 'tuneRng') { tune(+e.target.value); renderMediaAll(); } });

/* Multi-écran */
const MAP_FULL = `<svg class="map" viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice"><rect class="m-bg" width="400" height="300"/><path class="m-park" d="M20 200h70v70H20zM300 30h80v60h-80z"/><g class="m-road"><path d="M-10 90L410 70M-10 215L410 240M110-10L90 310M280-10L310 310M-10 150L410 160"/></g><path class="m-route" d="M91 300L98 222L103 158L292 160L296 90L300 20"/><path class="m-car" d="M103 150l9 22-9-5-9 5z"/></svg>`;
const MAP = MAP_FULL;
const soloMediaHTML = () => `<div class="mhead">${srcBtn()}</div><div class="mbody">${S.src === 'radio' ? radioHTML(true) : playerHTML(true)}</div>`;
function paneBody(id, solo) {
  if (id === 'music') return solo ? soloMediaHTML() : miniMediaHTML();
  if (id === 'rsmonitor') return window.M6?.mini?.() || '';
  if (['maps', 'waze', 'gmaps'].includes(id)) return `<div class="mapwrap">${MAP}<div class="mapbar"><div><b>${appById(id).n}</b><span>Aperçu de démonstration</span></div><button class="pill pri" data-open="${id}">Ouvrir</button></div></div>`;
  const a = appById(id);
  return `<div class="pgeneric"><i style="--c1:${a.c[0]};--c2:${a.c[1]}">${a.icon ? `<img src="${a.icon}" alt="">` : `<svg class="ic"><use href="#${a.i}"/></svg>`}</i><b>${a.n}</b><span>S’ouvre dans ce volet</span><button class="pill pri" data-open="${id}">Ouvrir</button></div>`;
}
function renderSplit() {
  if (NO_SPLIT.includes(S.splitL)) S.splitL = 'music'; if (NO_SPLIT.includes(S.splitR)) S.splitR = 'rsmonitor';
  window.M6.miniDetach?.();
  $('#view-split').dataset.split = S.splitLayout; $('#view-split').classList.toggle('solo', S.splitLayout !== 'both');
  $('#splitSeg').innerHTML = [['both', 'Les deux'], ['left', 'Gauche'], ['right', 'Droite']].map(([v, l]) => `<button data-sl="${v}" class="${S.splitLayout === v ? 'on' : ''}">${l}</button>`).join('');
  [['L', S.splitL], ['R', S.splitR]].forEach(([k, id]) => {
    const a = appById(id);
    el('pane' + k).innerHTML = `<div class="sph"><i class="sic" style="--c1:${a.c[0]};--c2:${a.c[1]}">${a.icon ? `<img src="${a.icon}" alt="">` : `<svg class="ic"><use href="#${a.i}"/></svg>`}</i><b>${a.n}</b><button class="sph-b" data-pane="${k}" aria-label="Changer l’application"><svg class="ic"><use href="#i-swap"/></svg>Changer</button></div><div class="pb">${paneBody(id, S.splitLayout !== 'both')}</div>`;
  });
  if ($('#miniMon')) window.M6.miniAttach?.();
}
$('#view-split').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  if (b.dataset.sl) { S.splitLayout = b.dataset.sl; saveS(); return renderSplit(); }
  if (b.id === 'swapBtn') { [S.splitL, S.splitR] = [S.splitR, S.splitL]; saveS(); return renderSplit(); }
  if (b.dataset.pane) { pickMode = 'split' + b.dataset.pane; pickFrom = 'split'; go('apps'); return; }
  if (b.dataset.open) return Native.launch(b.dataset.open);
});
let splitInt = null;
function splitTick(on) {
  clearInterval(splitInt);
  if (!on && view !== 'media' && view !== 'home' && view !== 'split') return;
  splitInt = setInterval(() => {   // démo : avance la barre (en vrai, le natif envoie la position)
    if (!Media.playing || !Media.dur || window.Android || S.src === 'radio') return;
    Media.pos = Math.min(Media.dur, Media.pos + 1);
    $$('.prog i').forEach(p => p.style.setProperty('--p', Media.pos / Media.dur));
    const nb = $('#np .np-prog i'); if (nb) nb.style.setProperty('--p', Media.pos / Media.dur);
    const ib = $('#island .isl-bar'); if (ib) ib.style.setProperty('--p', Media.pos / Media.dur);
    $$('.times span:first-child').forEach(t => { t.textContent = fmtT(Media.pos); });
  }, 1000);
}


/* ---------------------------------------------------------
   Photos réelles de la voiture (jour / nuit / phares allumés)
   - glisser-déposer ou sélecteur ; réduites en webp 1920 px (perf)
   - conservées dans IndexedDB ; repli sur assets/car-day|night|lights.(webp|jpg|png)
   - pas de photo nuit ? on assombrit la photo de jour
--------------------------------------------------------- */
const Photos = { day: null, night: null, lights: null, boot: null };
const SLOT_LABEL = { day: 'Jour', night: 'Nuit', lights: 'Phares' };
const idb = {
  open() { return new Promise((res, rej) => { const r = indexedDB.open('m6', 1); r.onupgradeneeded = () => r.result.createObjectStore('p'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }); },
  async put(k, v) { try { const d = await this.open(); d.transaction('p', 'readwrite').objectStore('p').put(v, k); } catch (e) {} },
  async del(k) { try { const d = await this.open(); d.transaction('p', 'readwrite').objectStore('p').delete(k); } catch (e) {} },
  async get(k) { try { const d = await this.open(); return await new Promise(r => { const q = d.transaction('p').objectStore('p').get(k); q.onsuccess = () => r(q.result); q.onerror = () => r(null); }); } catch (e) { return null; } }
};
function applyPhotos() {
  const has = Photos.day || Photos.night || Photos.lights;
  root.dataset.photo = has ? 'on' : 'off';
  if (!has) return;
  const want = lightsOnImage() ? 'lights' : nightNow ? 'night' : 'day';
  const use = { lights: ['lights', 'night', 'day'], night: ['night', 'day', 'lights'], day: ['day', 'night', 'lights'] }[want].find(k => Photos[k]);
  ['day', 'night', 'lights'].forEach(k => {
    const n = el('ph-' + k), u = Photos[k] || '';
    if (n.dataset.src !== u) { n.dataset.src = u; n.style.backgroundImage = u ? `url("${u}")` : ''; }
    n.style.opacity = k === use ? 1 : 0; n.style.setProperty('--lo', k === use ? 1 : 0);
  });
  el('phTint').style.opacity = (use === 'day' && want !== 'day') ? .5 : 0;
}
async function optimize(file) {
  try {
    const b = await createImageBitmap(file), sc = Math.min(1, 1920 / b.width);
    const c = document.createElement('canvas'); c.width = Math.round(b.width * sc); c.height = Math.round(b.height * sc);
    c.getContext('2d').drawImage(b, 0, 0, c.width, c.height);
    return await new Promise(r => c.toBlob(x => r(x || file), 'image/webp', .85));
  } catch (e) { return file; }
}
function useBlob(slot, blob) { if (Photos[slot] && Photos[slot].startsWith('blob:')) URL.revokeObjectURL(Photos[slot]); Photos[slot] = URL.createObjectURL(blob); applyPhotos(); }
async function setPhoto(slot, file) { const blob = await optimize(file); useBlob(slot, blob); idb.put(slot, blob); }
async function assignFiles(files) {
  const list = [...files].filter(f => f.type.startsWith('image/')), used = new Set(), rest = [];
  const byName = f => { const n = f.name.toLowerCase(); return /night|nuit|soir/.test(n) ? 'night' : /light|phare|lamp|allum/.test(n) ? 'lights' : /day|jour/.test(n) ? 'day' : null; };
  for (const f of list) { const s = byName(f); if (s && !used.has(s)) { used.add(s); await setPhoto(s, f); } else rest.push(f); }
  for (const f of rest) { const s = ['day', 'night', 'lights'].find(x => !used.has(x) && !Photos[x]) || ['day', 'night', 'lights'].find(x => !used.has(x)); if (s) { used.add(s); await setPhoto(s, f); } }
  toast('Photos chargées : ' + [...used].map(k => SLOT_LABEL[k]).join(', '));
}
function afterPhotos() { applyPhotos(); if (view === 'settings' && section === 'screen') renderSettings(); }
function pickFiles(slot) {
  const i = document.createElement('input'); i.type = 'file'; i.accept = 'image/*'; i.multiple = !slot;
  i.onchange = async () => { if (!i.files.length) return; if (slot) { await setPhoto(slot, i.files[0]); toast('Photo « ' + SLOT_LABEL[slot] + ' » chargée'); } else await assignFiles(i.files); afterPhotos(); };
  i.click();
}
function pickBoot() { const i = document.createElement('input'); i.type = 'file'; i.accept = 'video/*'; i.onchange = async () => { const f = i.files[0]; if (!f) return; Photos.boot = true; await idb.put('boot', f); renderSettings(); toast('Vidéo de démarrage ajoutée'); }; i.click(); }
function clearPhotos() { ['day', 'night', 'lights'].forEach(k => { Photos[k] = null; idb.del(k); }); afterPhotos(); toast('Photos effacées'); }
addEventListener('dragover', e => e.preventDefault());
addEventListener('drop', async e => { e.preventDefault(); if (e.dataTransfer?.files.length) { await assignFiles(e.dataTransfer.files); afterPhotos(); } });
async function initPhotos() {
  if (await idb.get('boot')) Photos.boot = true;
  for (const k of ['day', 'night', 'lights']) {
    const b = await idb.get(k);
    if (b) useBlob(k, b);   // photos ajoutées par l'utilisateur seulement : plus de recherche de assets/car-*.webp au démarrage
  }
  afterPhotos();
}

/* ---------------------------------------------------------
   Toast
--------------------------------------------------------- */
let toastT = null;
function toast(msg) { if (window.M6?.banner) return window.M6.banner({ title: msg, compact: true }); const t = $('#toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), 2200); }

/* ---------------------------------------------------------
   Simulateur (dev) — remplace le boîtier CAN pendant le design
--------------------------------------------------------- */
const DEMO = { headlights: false, doors: { fl: false, fr: false, rl: false, rr: false, trunk: false, hood: false },
  handbrake: false, reverse: false, speedKmh: 0, rpm: 0, coolantC: 88, fuelPct: 62, batteryV: 12.6, outsideC: 28.5, radars: false, phone: window.Android ? null : 'android', phoneName: window.Android ? null : 'Pixel 8' };
const Sim = {
  demoOn: false,
  setDemo(on) { this.demoOn = on;
    setMedia(on ? { title: 'Morceau démo', artist: 'Artiste', dur: 225, pos: 72 } : { playing: false, title: 'Aucune lecture', artist: '', dur: 0, pos: 0 }); if (on) Car.update(DEMO, 'sim'); else Car.reset(); this.build(); },
  build() {
    const s = Car.s, chip = (k, l) => `<button data-sk="${k}" class="${s[k] ? 'on' : ''}">${l}</button>`;
    const rng = (k, l, min, max, step) => `<label>${l}<input type="range" data-rk="${k}" min="${min}" max="${max}" step="${step}" value="${s[k] ?? min}"></label>`;
    $('#simBody').innerHTML = `
      <h4>Données</h4><div class="chips"><button data-demo="1" class="${this.demoOn ? 'on' : ''}">Démo</button><button data-demo="0" class="${this.demoOn ? '' : 'on'}">Aucune (Indisponible)</button></div>
      <h4>Phares & état</h4><div class="chips">${chip('headlights', 'Phares')}${chip('handbrake', 'Frein à main')}${chip('reverse', 'Marche arrière')}${chip('radars', 'Radars')}<button data-ph="ios" class="${s.phone === 'ios' ? 'on' : ''}">iPhone</button><button data-ph="android" class="${s.phone === 'android' ? 'on' : ''}">Android</button><button data-ph="none">Déconnecter</button><button data-media="1" class="${Media.playing ? 'on' : ''}">Musique</button></div>
      <h4>Média</h4><div class="chips"><button data-md="next">Piste suivante (démo)</button><button data-md="radio">Radio on/off</button><button data-md="nonext">Sans « À suivre »</button>${SRCS.map(x => `<button data-src="${x[0]}" class="${S.src === x[0] ? 'on' : ''}">${x[1]}</button>`).join('')}</div>
      <h4>Interface</h4><div class="chips"><button data-ui="day">Jour</button><button data-ui="night">Nuit</button><button data-ui="auto">Auto</button><button data-ui="speed" class="${S.showSpeed !== 'off' ? 'on' : ''}">Compteur accueil</button><button data-ui="boot">Rejouer le démarrage</button><button data-ui="notif">Notification</button><button data-ui="warn">Alerte moteur</button><button data-ui="reset">Réinitialiser</button></div>
      <h4>Aller à</h4><div class="chips">${['home', 'media', 'monitor', 'maint', 'settings'].map(v => `<button data-go="${v}">${v === 'home' ? 'Accueil' : v === 'media' ? 'Média' : v === 'monitor' ? 'Moniteur moteur' : v === 'maint' ? 'Entretien' : 'Réglages'}</button>`).join('')}</div>
      <h4>Ouvrants</h4><div class="chips">${chip('doors.fl', 'Conducteur')}${chip('doors.fr', 'Passager')}${chip('doors.rl', 'Arr. G')}${chip('doors.rr', 'Arr. D')}${chip('doors.trunk', 'Coffre')}${chip('doors.hood', 'Capot')}</div>
      <h4>Mesures</h4>
      ${rng('speedKmh', 'Vitesse km/h', 0, 220, 1)}${rng('rpm', 'Régime tr/min', 0, 5500, 50)}${rng('loadPct', 'Charge moteur %', 0, 100, 1)}${rng('radarRear', 'Radar arrière 0-4', 0, 4, 1)}${rng('phoneBatt', 'Batterie téléphone %', 0, 100, 1)}${rng('fuelPct', 'Carburant %', 0, 100, 1)}${rng('batteryV', 'Batterie V', 11, 14.8, .1)}${rng('coolantC', 'Liquide °C', 20, 115, 1)}${rng('outsideC', 'Extérieur °C', -5, 45, .5)}`;
  }
};
function initSim() {
  if (!CONFIG.dev) return;
  $('#sim').hidden = false;
  $('#simTab').addEventListener('click', () => { const b = $('#simBody'); b.hidden = !b.hidden; if (!b.hidden) Sim.build(); });
  $('#simBody').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.ph) { const t = b.dataset.ph; Car.update(t === 'none' ? { phone: null, phoneName: null } : { phone: t, phoneName: t === 'ios' ? 'iPhone de Raph' : 'Pixel 8' }, 'sim'); return Sim.build(); }
    if (b.dataset.media) { setMedia({ playing: !Media.playing }); b.classList.toggle('on', Media.playing); return; }
    if (b.dataset.ph) { const t = b.dataset.ph; Car.update(t === 'none' ? { phone: null, phoneName: null } : { phone: t, phoneName: t === 'ios' ? 'iPhone de Raph' : 'Pixel 8' }, 'sim'); return Sim.build(); }
    if (b.dataset.md) { if (b.dataset.md === 'next') setMedia({ next: ['Blinding Lights · The Weeknd', 'Midnight City · M83', 'Genesis · Justice', 'Nightcall · Kavinsky'][Math.floor(Math.random() * 4)] }); else if (b.dataset.md === 'nonext') setMedia({ next: '' }); else { if (Radio.on) radioOff(); else { mediaOff(); Radio.on = true; S.src = 'radio'; } renderMediaAll(); } return; }
    if (b.dataset.src) { S.src = b.dataset.src; if (S.src === 'radio') Radio.on = true; saveS(); renderMediaAll(); return Sim.build(); }
    if (b.dataset.ui) { const u = b.dataset.ui;
      if (['day', 'night', 'auto'].includes(u)) { S.theme = u; saveS(); applySettings(); }
      else if (u === 'speed') { S.showSpeed = S.showSpeed === 'off' ? 'on' : 'off'; saveS(); renderHud(); b.classList.toggle('on', S.showSpeed !== 'off'); }
      else if (u === 'boot') window.M6.bootPlay?.(() => {});
      else if (u === 'notif') window.M6.notify?.({ title: 'Message de test', text: 'Notification envoyée depuis le menu de test.', lvl: 'info', src: 'Test' });
      else if (u === 'warn') window.M6.notify?.({ title: 'Batterie faible', text: '11,2 V : vérifie l’alternateur.', lvl: 'warn', src: 'Voiture' });
      else if (u === 'reset') { Sim.setDemo(Sim.demoOn); npOff = islOff = false; renderNP(); renderIsland(); }
      return; }
    if (b.dataset.go) return go(b.dataset.go);
    if (b.dataset.demo) return Sim.setDemo(b.dataset.demo === '1');
    if (b.dataset.sk) { Car.update({ [b.dataset.sk]: !Car.s[b.dataset.sk] }, 'sim'); b.classList.toggle('on', !!Car.s[b.dataset.sk]); }
  });
  $('#simBody').addEventListener('input', e => { const r = e.target; if (r.dataset.rk) Car.update({ [r.dataset.rk]: +r.value }, 'sim'); });
}

/* ---------------------------------------------------------
   Démarrage
--------------------------------------------------------- */
function boot() {
  $('#vname').setAttribute('aria-label', CONFIG.vehicle.name); 
  initSim();
  applySettings();
  tickClock();
  Sim.setDemo(CONFIG.demo); splitTick(false);
  WX.load(); setInterval(() => WX.load(), 20 * 60 * 1000);
  const q = new URLSearchParams(location.search);
  if (q.get('view')) go(q.get('view'));
  if (q.get('theme')) { S.theme = q.get('theme'); applySettings(); }
  if (q.get('lights')) { Car.update({ headlights: q.get('lights') === 'on' }, 'url'); }
  initPhotos();
  window.Android?.listApps?.();
  const after = f => document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', f) : setTimeout(f, 0);
  after(() => { if (S.startView && S.startView !== 'home' && !q.get('noboot')) setTimeout(() => go(S.startView), 3200); window.M6.onView?.(view); if (window.M6.bootPlay && S.bootAnim === 'on' && !q.get('noboot')) window.M6.bootPlay(playIntro); else { const b = $('#boot'); if (b) b.hidden = true; playIntro(); } });
}
function showText(title, text) {
  const d = document.createElement('div');
  d.style.cssText = 'position:fixed;inset:0;left:0;top:0;right:0;bottom:0;z-index:9999;background:rgba(0,0,0,.92);color:#fff;padding:2rem 3rem;overflow:auto;font-size:1.05rem;line-height:1.5';
  const h = document.createElement('div'); h.style.cssText = 'font-weight:700;font-size:1.3rem;margin-bottom:1rem'; h.textContent = title + ' (touche pour fermer)';
  const pre = document.createElement('pre'); pre.style.cssText = 'white-space:pre-wrap;font:inherit'; pre.textContent = text;
  d.append(h, pre); d.onclick = () => d.remove(); document.body.appendChild(d);
}
const gb = n => (n / 2 ** 30).toFixed(1).replace('.', ',');
function ramTick() {
  const t = $('#ramT'); if (!t) return;
  const r = Native.ram(); if (!r.total) { t.textContent = 'Indisponible'; return; }
  const used = r.total - r.free, p = Math.round(used / r.total * 100);
  t.textContent = `${gb(used)} / ${gb(r.total)} Go`;
}
setInterval(ramTick, 2000); setTimeout(ramTick, 400);
window.M6 = { lookNow, Optim, optimOn, setMedia, ui: { row, seg, stepper, btn, slider }, openSection(id) { section = id; go('settings'); }, idb, Photos, playIntro, renderSettings, Car, S, saveS, go, toast, Native, $, $$, el, clamp, n1, CONFIG, Sim, get view() { return view; }, get night() { return nightNow; }, applySettings };
boot();

})();

/* retour auto à l'accueil après inactivité (préférence) */
(() => { const M = window.M6, S = M.S, Car = M.Car; let last = Date.now(); ['pointerdown', 'keydown'].forEach(ev => document.addEventListener(ev, () => { last = Date.now(); }, true));
  setInterval(() => { const n = +S.autoHome; if (!n || M.view === 'home') return; if (Date.now() - last > n * 1000 && !(Car.s.speedKmh > 0 && M.view === 'monitor')) M.go('home'); }, 5000); })();
