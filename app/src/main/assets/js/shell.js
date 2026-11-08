'use strict';
/* =========================================================
   Surcouche Android : bannière (une seule fois), centre de notifications, vidéo de démarrage.
   Natif -> JS : window.onNotifications(json)  [{id,title,text,app,time}]
   JS -> natif : Android.openNotification(id) / dismissNotification(id) / clearNotifications()
                 Android.toggle('wifi'|'bluetooth', on)
   ========================================================= */
(() => {
const M = window.M6, { S, saveS, Native } = M;
const $ = (s, r = document) => r.querySelector(s);
const esc = t => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const ago = t => { const m = Math.round((Date.now() - t) / 60000); return m < 1 ? 'À l’instant' : m < 60 ? `Il y a ${m} min` : `Il y a ${Math.round(m / 60)} h`; };

/* ---------- Bannière : une seule fois, 4,5 s, puis rangée dans le centre ---------- */
const bn = document.createElement('div'); bn.id = 'banner'; bn.setAttribute('role', 'status'); document.body.appendChild(bn);
let bt = 0, queue = [], showing = false;
function showNext() {
  const n = queue.shift(); if (!n) { showing = false; return; }
  showing = true;
  bn.className = 'lvl-' + (n.lvl || 'info') + (n.compact ? ' compact' : '');
  bn.innerHTML = `<i class="bic"></i><div><b>${esc(n.title)}</b>${n.text ? `<span>${esc(n.text)}</span>` : ''}</div>`;
  void bn.offsetWidth; bn.classList.add('on');
  clearTimeout(bt); bt = setTimeout(() => { bn.classList.remove('on'); setTimeout(showNext, 350); }, n.compact ? 2200 : 4500);
}
M.banner = n => { queue.push(n); if (queue.length > 3) queue.splice(0, queue.length - 3); if (!showing) showNext(); };
bn.addEventListener('click', () => { clearTimeout(bt); bn.classList.remove('on'); setTimeout(showNext, 350); });

/* ---------- Liste des notifications ---------- */
const List = []; let seq = 1;
const bell = $('#bellBtn'), bdg = $('#bellBdg'), panel = $('#notifPanel'), scrim = $('#nScrim');
let unread = 0;
function badge() { bdg.hidden = !unread; bdg.textContent = unread > 9 ? '9+' : unread; bell.classList.toggle('has', unread > 0); }
let ac;
M.chime = () => { if (S.notifSound === 'off' || S.dnd === 'on') return; try { ac = ac || new (window.AudioContext || window.webkitAudioContext)(); const t = ac.currentTime; [[880, 0], [1320, .11]].forEach(([f, d]) => { const o = ac.createOscillator(), g = ac.createGain(); o.type = 'sine'; o.frequency.value = f; g.gain.setValueAtTime(0, t + d); g.gain.linearRampToValueAtTime(.07, t + d + .015); g.gain.exponentialRampToValueAtTime(.0001, t + d + .22); o.connect(g); g.connect(ac.destination); o.start(t + d); o.stop(t + d + .25); }); } catch (e) {} };
M.notify = n => {
  const it = { id: 'm' + seq++, title: n.title, text: n.text || '', lvl: n.lvl || 'info', src: n.src || 'Voiture', t: Date.now(), local: true };
  List.unshift(it); unread++; badge(); if (open) draw();
  if (!n.silent && S.dnd !== 'on') { M.banner(it); M.chime(); }
};
window.onNotifications = json => {
  let a; try { a = typeof json === 'string' ? JSON.parse(json) : json; } catch (e) { return; }
  const fresh = a.filter(x => !List.some(l => l.id === String(x.id)));
  for (let i = List.length - 1; i >= 0; i--) if (!List[i].local) List.splice(i, 1);
  a.forEach(x => List.push({ id: String(x.id), title: x.title, text: x.text || '', lvl: 'app', src: x.app || 'Android', t: x.time || Date.now(), local: false }));
  List.sort((p, q) => q.t - p.t);
  unread += fresh.length; badge(); if (open) draw();
  if (S.dnd !== 'on' && fresh.length) { fresh.slice(0, 1).forEach(x => M.banner({ title: x.title, text: x.text, lvl: 'app' })); M.chime(); }
};

/* ---------- Panneau ---------- */
let open = false;
const TILES = [['wifi', 'Wi-Fi', 'i-wifi2'], ['bt', 'Bluetooth', 'i-bt'], ['dnd', 'Ne pas déranger', 'i-moon2'], ['set', 'Réglages', 'i-gear']];
function draw() {
  $('#qTiles').innerHTML = TILES.map(([k, l, i]) => `<button class="qt ${S[k === 'wifi' ? 'wifi' : k === 'bt' ? 'bt' : k] === 'on' ? 'on' : ''}" data-q="${k}"><svg class="ic"><use href="#${i}"/></svg><span>${l}</span></button>`).join('');
  $('#qBright').value = S.brightness;
  $('#nList').innerHTML = List.length ? List.map(n => `<div class="ni lvl-${n.lvl}" data-id="${n.id}"><i class="bic"></i><div class="nt"><b>${esc(n.title)}</b>${n.text ? `<span>${esc(n.text)}</span>` : ''}<small>${esc(n.src)} · ${ago(n.t)}</small></div><button class="nx" data-x="${n.id}" aria-label="Supprimer">×</button></div>`).join('') : '<div class="nempty"><svg class="ic"><use href="#i-bell"/></svg>Aucune notification</div>';
}
function toggle(on) {
  open = on ?? !open; panel.classList.toggle('on', open); panel.setAttribute('aria-hidden', String(!open)); scrim.hidden = !open;
  if (open) { unread = 0; badge(); draw(); }
}
bell.addEventListener('click', () => toggle());
scrim.addEventListener('click', () => toggle(false));
$('#nClear').addEventListener('click', () => { List.length = 0; Native.call?.('clearNotifications'); window.Android?.clearNotifications?.(); draw(); });
$('#qBright').addEventListener('input', e => { S.brightness = +e.target.value; saveS(); M.applySettings(); });
$('#qTiles').addEventListener('click', e => {
  const b = e.target.closest('[data-q]'); if (!b) return; const k = b.dataset.q;
  if (k === 'set') { toggle(false); return M.go('settings'); }
  const key = k === 'wifi' ? 'wifi' : k === 'bt' ? 'bt' : 'dnd'; S[key] = S[key] === 'on' ? 'off' : 'on'; saveS();
  if (key !== 'dnd') window.Android?.toggle?.(key === 'wifi' ? 'wifi' : 'bluetooth', S[key] === 'on');
  draw();
});
$('#nList').addEventListener('click', e => {
  const x = e.target.closest('[data-x]'); const id = (x || e.target.closest('[data-id]'))?.dataset[x ? 'x' : 'id']; if (!id) return;
  const i = List.findIndex(n => n.id === id); if (i < 0) return; const n = List[i];
  if (x) { List.splice(i, 1); if (!n.local) window.Android?.dismissNotification?.(n.id); }
  else if (!n.local) window.Android?.openNotification?.(n.id);
  draw();
});
document.addEventListener('keydown', e => { if (e.key === 'Escape' && open) toggle(false); });
const _ov = M.onView; M.onView = v => { _ov?.(v); if (open) toggle(false); };
setInterval(() => { if (open) draw(); }, 30000);

/* Notifications de démonstration (silencieuses, uniquement en démo) */
setTimeout(() => {
  if (!M.Sim.demoOn || List.length) return;
  const t = Date.now();
  List.push({ id: 'd1', title: 'Julie', text: 'Tu arrives vers quelle heure ?', lvl: 'app', src: 'Messages', t: t - 6 * 60000, local: false });
  List.push({ id: 'd2', title: 'Mise à jour disponible', text: 'Waze peut être mis à jour.', lvl: 'app', src: 'Play Store', t: t - 52 * 60000, local: false });
  unread = 2; badge();
}, 800);

/* ---------- Vidéo de démarrage ---------- */
const boot = $('#boot'), vid = $('#bootVid');
let bootDone = null, bootT = 0, bootUrl = null;
function bootEnd() {
  clearTimeout(bootT); vid.pause(); vid.classList.remove('rdy'); boot.classList.remove('on'); boot.classList.remove('fx');
  setTimeout(() => { boot.hidden = true; if (bootUrl) { URL.revokeObjectURL(bootUrl); bootUrl = null; } vid.removeAttribute('src'); vid.load(); }, 950);
  const d = bootDone; bootDone = null; d?.();
}
function fallback() { vid.hidden = true; clearTimeout(bootT); bootEnd(); }
M.bootPlay = async done => {
  bootDone = done || null; boot.hidden = false; boot.classList.add('on');
  const bl = M.S.bootLook || 'auto';   // style de l'animation de base : Auto (suit clair/sombre), Sombre, Clair
  boot.dataset.look = bl === 'auto' ? (document.documentElement.dataset.look === 'light' && !M.night ? 'light' : 'dark') : bl;
  let src = null;
  const pre = window.__bootPre; window.__bootPre = null;
  if (pre && pre.url) src = bootUrl = pre.url;   // déjà lancée par le script de démarrage rapide
  else try { const b = await M.idb.get('boot'); if (b) src = bootUrl = URL.createObjectURL(b); } catch (e) { /* pas de vidéo perso */ }
  if (!src) { vid.hidden = true; clearTimeout(bootT); bootEnd(); return; }   // pas de vidéo perso : aucune animation intégrée   // logo animé tout de suite, puis fondu sur le launcher
  boot.classList.remove('fx'); if (!(pre && pre.url)) vid.classList.remove('rdy'); vid.hidden = false;   // la vidéo reste invisible (fond noir) jusqu'à sa 1re image : pas d'écran gris
  vid.onended = bootEnd; vid.onerror = fallback;
  const started = !!(pre && pre.url);
  if (!started) vid.src = src;
  clearTimeout(bootT); bootT = setTimeout(fallback, started ? 6000 : 2500);
  const onPlay = () => { vid.classList.add('rdy'); clearTimeout(bootT); bootT = setTimeout(bootEnd, 20000); };
  vid.onplaying = onPlay;
  if (started && vid.ended) { bootEnd(); return; }
  if (started && !vid.paused && vid.readyState >= 3) onPlay();
  else if (!started) vid.play().catch(fallback);
};
boot.addEventListener('click', bootEnd);
})();
