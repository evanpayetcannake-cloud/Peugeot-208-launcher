'use strict';
/* =========================================================
   Extras : animation d'ouverture de porte, radars de recul, caméra de recul, scénarios SIM
   ========================================================= */
(() => {
const M = window.M6, { Car, S, Native, toast } = M;
const $ = (s, r = document) => r.querySelector(s);
const L = $('#xlayer');

/* ---------- Ouvrants : tuile sous les infos (accueil), animation de la porte ---------- */
const NAMES = { fl: 'Porte conducteur', fr: 'Porte passager', rl: 'Porte arrière gauche', rr: 'Porte arrière droite', trunk: 'Hayon', hood: 'Capot' };
const tile = $('#doorTile'); let openPrev = '';
function doors() {
  const open = Object.keys(NAMES).filter(k => Car.s['doors.' + k] === true), sig = open.join(',');
  tile.querySelectorAll('[data-k]').forEach(n => n.classList.toggle('open', open.includes(n.dataset.k)));
  const moving = (Car.s.speedKmh || 0) > 5, show = (open.length && S.doorAnim === 'on' || M.doorTesting) && M.view === 'home';
  tile.classList.toggle('on', !!show); tile.classList.toggle('warn', !!(show && moving));
  if (!open.length) { openPrev = sig; if (M.doorTesting) { tile.querySelector('b').textContent = 'Test des ouvrants'; tile.querySelector('span').textContent = 'Fermé'; } return; }
  const [b, sp] = [tile.querySelector('b'), tile.querySelector('span')];
  b.textContent = open.length === 1 ? NAMES[open[0]] + (open[0] === 'trunk' || open[0] === 'hood' ? ' ouvert' : ' ouverte') : open.length + ' ouvrants ouverts';
  sp.textContent = moving ? 'Véhicule en mouvement' : open.length === 1 ? 'Ferme-la avant de partir' : open.map(k => NAMES[k]).join(' · ');
  openPrev = sig;
}
Car.on('change', k => { if (k.some(x => x.startsWith('doors.') || x === 'speedKmh')) doors(); });

/* ---------- Téléphone : iPhone → CarPlay, Android → Android Auto ---------- */
const card = $('#cardPhone'), phGo = $('#phGo'); let phPrev;
function phone() {
  const t = Car.s.phone, st = t || 'none';
  card.dataset.st = st;
  $('#phName').textContent = t ? (Car.s.phoneName || (t === 'ios' ? 'iPhone' : 'Android')) : (window.Android ? 'Téléphone' : 'Aucun téléphone');
  $('#phSub').textContent = t ? (Car.s.phoneBatt != null && Car.s.phoneBatt >= 0 ? '' : (t === 'ios' ? 'CarPlay disponible' : 'Android Auto disponible')) : (window.Android ? 'Lance CarPlay ou Android Auto' : 'Connecte-le en Bluetooth ou par USB');
  const pb = Car.s.phoneBatt, hasB = t && pb != null && pb >= 0; $('#phBat').hidden = !hasB;
  if (hasB) { $('#phBatF').style.width = Math.max(6, Math.min(100, pb)) + '%'; $('#phBatT').textContent = Math.round(pb) + ' %'; $('#phBat').classList.toggle('low', pb <= 20); }
  phGo.hidden = !t && !window.Android; phGo.textContent = t === 'android' ? 'Android Auto' : 'CarPlay';
  if (phPrev !== undefined && phPrev !== st) { card.classList.remove('fx-on', 'fx-off'); void card.offsetWidth; card.classList.add(t ? 'fx-on' : 'fx-off'); if (!t) toast('Téléphone déconnecté'); }
  phPrev = st;
}
phGo.addEventListener('click', () => Native.launch(Car.s.phone === 'android' ? 'android_auto' : 'carplay'));
Car.on('change', k => { if (k.includes('phone') || k.includes('phoneName') || k.includes('phoneBatt')) phone(); });
const _go = M.onView; M.onView = v => { _go?.(v); doors(); };
phone(); doors();

/* ---------- Radars + caméra de recul ---------- */
const arcs = (cy, dir, cls) => [1, 2, 3, 4].map(n => `<path class="rarc ${cls} l${n}" data-l="${n}" d="M${60 - 14 - n * 12} ${cy + dir * (6 + n * 11)} Q60 ${cy + dir * (20 + n * 17)} ${60 + 14 + n * 12} ${cy + dir * (6 + n * 11)}"/>`).join('');
L.insertAdjacentHTML('beforeend', `<div id="radarFx" data-lv="0"><div class="rcam"><span class="cl">Caméra de recul</span>
  <svg class="guides" viewBox="0 0 100 60" preserveAspectRatio="none"><path d="M18 58L38 8M82 58L62 8" stroke="#34d399" stroke-width="1.2" fill="none"/><path d="M26 40H74M30 28H70" stroke="#fbbf24" stroke-width="1" fill="none"/></svg>
  <p>Le flux vidéo est fourni par le poste (entrée caméra). Les lignes de guidage sont indicatives.</p></div>
  <div class="rrad"><svg viewBox="-12 -78 144 410"><g id="arcR" transform="translate(0 100)">${arcs(150, 1, 'r')}</g><g id="arcF" transform="translate(0 -104)">${arcs(100, -1, 'f')}</g>
  <g class="rcar" transform="translate(18.75 20) scale(.75)"><rect class="rc-wh" x="5" y="52" width="10" height="34" rx="4"/><rect class="rc-wh" x="95" y="52" width="10" height="34" rx="4"/><rect class="rc-wh" x="5" y="199" width="10" height="34" rx="4"/><rect class="rc-wh" x="95" y="199" width="10" height="34" rx="4"/><rect class="rc-mir" x="5" y="96" width="11" height="8" rx="3.5"/><rect class="rc-mir" x="94" y="96" width="11" height="8" rx="3.5"/><path class="rc-body" d="M55 23C74 23 86 31 90 50L94 78C96 92 97 105 97 122L97 190C97 214 96 232 92 244C88 256 74 260 55 260C36 260 22 256 18 244C14 232 13 214 13 190L13 122C13 105 14 92 16 78L20 50C24 31 36 23 55 23Z"/><path class="rc-hl" d="M17 56C18 46 24 40 34 37L33 47Z"/><path class="rc-hl" d="M93 56C92 46 86 40 76 37L77 47Z"/><path class="rc-ln" d="M55 42V86M41 48L37 86M69 48L73 86"/><path class="rc-gl" d="M26 92C40 86 70 86 84 92L80 120H30Z"/><path class="rc-roof" d="M30 124H80L81 191H29Z"/><path class="rc-gl" d="M29 195H81L84 214C72 218 38 218 26 214Z"/><path class="rc-tl" d="M19 240L32 250L30 238Z"/><path class="rc-tl" d="M91 240L78 250L80 238Z"/></g></svg>
  <div class="rlab" id="rlab"></div></div></div>`);
const rfx = $('#radarFx'); let beepT = null, ac = null;
const LAB = ['', 'Obstacle éloigné', 'Obstacle proche', 'Très proche', 'STOP'];
const BEEP = [0, 1100, 700, 380, 0];
function beep(lv) {
  clearTimeout(beepT);
  if (S.radarBeep !== 'on' || !lv) return;
  try { ac = ac || new (window.AudioContext || window.webkitAudioContext)(); const o = ac.createOscillator(), g = ac.createGain();
    o.frequency.value = 1000; g.gain.value = .08; o.connect(g); g.connect(ac.destination); o.start(); o.stop(ac.currentTime + (lv === 4 ? .5 : .09)); } catch (e) {}
  if (lv < 4) beepT = setTimeout(() => beep(+rfx.dataset.lv), BEEP[lv]);
}
let revPrev = false, flash = false, flashT = 0;
function radar() {
  const r = Car.s.radarRear || 0, f = Car.s.radarFront || 0, rev = Car.s.reverse === true, lv = Math.max(r, f);
  const show = rev || lv >= 1 || flash;
  if (rev && !revPrev && window.Android) Native.launch('rear_camera');
  revPrev = rev;
  rfx.classList.toggle('on', show); rfx.classList.toggle('idle', !lv && !rev); rfx.classList.toggle('compact', !rev);
  if (rfx.dataset.lv !== String(lv)) { rfx.dataset.lv = lv; beep(lv); }
  rfx.querySelectorAll('.rarc').forEach(p => p.classList.toggle('on', +p.dataset.l <= (p.classList.contains('r') ? r : f)));
  $('#rlab').textContent = rev && !lv ? 'Marche arrière' : !lv ? 'Radars actifs' : LAB[lv] + (f > r ? ' · avant' : r ? ' · arrière' : '');
}
Car.on('change', k => { if (k.some(x => ['reverse', 'radarRear', 'radarFront', 'radars'].includes(x))) radar(); });
/* activation des radars : la voiture animée apparaît au centre ~2,6 s */
let radPrev = false;
Car.on('change', k => {
  if (!k.some(x => ['radars', 'radarRear', 'radarFront', 'reverse'].includes(x))) return;
  const act = Car.s.radars === true || (Car.s.radarRear || 0) > 0 || (Car.s.radarFront || 0) > 0 || Car.s.reverse === true;
  if (act && !radPrev && S.showRadars !== 'off') { flash = true; clearTimeout(flashT); flashT = setTimeout(() => { flash = false; radar(); }, 2800); radar(); }
  radPrev = act;
});
/* tension basse -> notification (avec hystérésis) */
let lowV = false;
Car.on('change', k => {
  if (!k.includes('batteryV') && !k.includes('rpm')) return;
  const v = Car.s.batteryV, run = (Car.s.rpm || 0) > 700;
  if (v == null) return;
  const low = run ? v < 12.6 : v < 11.8;
  if (low && !lowV) { lowV = true; M.notify({ title: 'Tension batterie basse (' + v.toFixed(1).replace('.', ',') + ' V)', text: run ? 'Moteur tournant : contrôle l’alternateur.' : 'Contrôle la batterie ou l’alternateur.', lvl: 'warn', src: 'Voiture' }); }
  else if (lowV && v > (run ? 13.0 : 12.2)) lowV = false;
});

/* ---------- Scénarios de test (SIM) ---------- */
const sleep = ms => new Promise(r => setTimeout(r, ms));
const SCN = {
  porte: ['Porte conducteur', async () => { M.go('home'); Car.update({ doors: { fl: true } }, 'sim'); await sleep(5200); Car.update({ doors: { fl: false } }, 'sim'); }],
  deux: ['2 portes + coffre', async () => { M.go('home'); Car.update({ doors: { fr: true, rr: true } }, 'sim'); await sleep(1500); Car.update({ doors: { trunk: true } }, 'sim'); await sleep(4000); Car.update({ doors: { fr: false, rr: false, trunk: false } }, 'sim'); }],
  roulant: ['Porte ouverte en roulant', async () => { M.go('home'); Car.update({ speedKmh: 40, doors: { rl: true } }, 'sim'); await sleep(5000); Car.update({ speedKmh: 0, doors: { rl: false } }, 'sim'); }],
  recul: ['Recul + radars', async () => { Car.update({ reverse: true }, 'sim'); for (const l of [1, 2, 3, 4, 2, 0]) { Car.update({ radarRear: l }, 'sim'); await sleep(1400); } Car.update({ reverse: false }, 'sim'); }],
  avant: ['Radar avant', async () => { for (const l of [1, 3, 4, 0]) { Car.update({ radarFront: l }, 'sim'); await sleep(1200); } }],
  chaud: ['Surchauffe + surpression', async () => { M.go('monitor'); Car.update({ coolantC: 108, mapKpa: 101 + 175, baroKpa: 101 }, 'sim'); await sleep(6000); Car.update({ coolantC: 88, mapKpa: 101 }, 'sim'); }],
  musique: ['Lancer une musique', async () => { M.setMedia?.({ playing: true, title: 'Midnight City', artist: 'M83', dur: 243, pos: 40, next: 'Genesis · Justice' }); }],
  demar: ['Rejouer le démarrage', async () => { M.bootPlay?.(() => {}); }],
  notif: ['Notification test', async () => { M.notify?.({ title: 'Message de test', text: 'Notification de démonstration.', lvl: 'info', src: 'Test' }); }],
  ouvrants: ['Test des ouvrants', async () => {
    M.go('home'); const sb = $('#simBody'); if (sb) sb.hidden = true; M.doorTesting = true; tile.classList.add('big'); doors(); await sleep(900);
    for (const k of ['fl', 'fr', 'rl', 'rr', 'trunk', 'hood']) { Car.update({ doors: { [k]: true } }, 'sim'); await sleep(2200); Car.update({ doors: { [k]: false } }, 'sim'); await sleep(1300); }
    Car.update({ doors: { fl: true, fr: true, rl: true, rr: true, trunk: true, hood: true } }, 'sim'); await sleep(2600);
    Car.update({ doors: { fl: false, fr: false, rl: false, rr: false, trunk: false, hood: false } }, 'sim'); await sleep(1000);
    M.doorTesting = false; tile.classList.remove('big'); doors();
  }],
  tension: ['Tension basse (alternateur)', async () => { Car.update({ rpm: 1500, batteryV: 12.1 }, 'sim'); await sleep(4000); Car.update({ rpm: 0, batteryV: 12.6 }, 'sim'); }],
  radars: ['Activation des radars', async () => { Car.update({ radars: false, radarRear: 0, radarFront: 0 }, 'sim'); await sleep(400); Car.update({ radars: true, radarFront: 1 }, 'sim'); await sleep(3500); Car.update({ radars: false, radarFront: 0 }, 'sim'); }],
  batt: ['Batterie faible', async () => { Car.update({ batteryV: 11.3 }, 'sim'); await sleep(5000); Car.update({ batteryV: 12.6 }, 'sim'); }],
  vitesse: ['Test d’accélération', async () => { M.driveTest?.(130); }],
  tel: ['iPhone puis Android', async () => { Car.update({ phone: 'ios', phoneName: 'iPhone de Raph' }, 'sim'); await sleep(3500); Car.update({ phone: null, phoneName: null }, 'sim'); await sleep(2500); Car.update({ phone: 'android', phoneName: 'Pixel 8' }, 'sim'); }]
};
const sb = M.Sim.build.bind(M.Sim);
M.Sim.build = () => { sb(); $('#simBody').insertAdjacentHTML('beforeend', `<div class="simscn"><h4>Scénarios</h4><div class="chips">${Object.entries(SCN).map(([k, [l]]) => `<button data-scn="${k}">${l}</button>`).join('')}</div></div>`); };
$('#simBody').addEventListener('click', e => { const b = e.target.closest('[data-scn]'); if (b) SCN[b.dataset.scn][1](); });
window.M6.scenario = k => SCN[k][1]();
})();
