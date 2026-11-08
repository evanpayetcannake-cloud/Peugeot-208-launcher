'use strict';
/* Apparence : mode sombre / clair + fonds d'écran (dossier assets/wallpapers ou dossier Android, images ajoutées) */
(() => {
const M = window.M6, S = M.S, root = document.documentElement, $ = (s, r = document) => r.querySelector(s);
let sig = '', urls = {}, folder = null;
async function list() {
  if (folder) return folder;
  let a = [];
  try { if (window.Android?.listWallpapers) a = JSON.parse(window.Android.listWallpapers()); } catch (e) {}
  if (!a.length) { try { const r = await fetch('assets/wallpapers/list.json'); if (r.ok) a = (await r.json()).map(n => /^(https?:|file:|content:|assets\/)/.test(n) ? n : 'assets/wallpapers/' + n); } catch (e) {} }
  return folder = a;
}
async function resolve(id) {
  if (!id) return '';
  if (id.startsWith('u:')) { if (urls[id]) return urls[id]; const b = await M.idb.get('wp' + id); return b ? (urls[id] = URL.createObjectURL(b)) : ''; }
  return id.replace(/^f:/, '');
}
async function apply() {
  const lk = M.lookNow ? M.lookNow() : (S.look === 'light' ? 'light' : 'dark');
  const s = lk + '|' + S.wallpaper; if (s === sig) return; sig = s;
  root.dataset.look = lk;
  const u = await resolve(S.wallpaper);
  if (u) { root.style.setProperty('--wp', `url("${/^(data:|blob:|https?:|file:|content:)/.test(u) ? u : new URL(u, document.baseURI).href}")`); root.dataset.wp = 'on'; } else { root.style.removeProperty('--wp'); delete root.dataset.wp; }
}
const sync = () => { apply(); const f = document.querySelector('#lgRefract feDisplacementMap'); if (f) f.setAttribute('scale', S.lgRef ?? 46); };
addEventListener('m6settings', sync); sync();   // réagit aux changements de réglages (avant : contrôle toutes les 400 ms)
/* sélecteur */
async function open() {
  let sh = $('#wpsheet'); if (!sh) { sh = document.createElement('div'); sh.id = 'wpsheet'; $('#app').appendChild(sh); }
  const ids = (await M.idb.get('wplist')) || [], f = await list();
  const hid = S.wpHidden || [];
  const cell = (id, u, label) => `<button class="wpc ${S.wallpaper === id ? 'on' : ''}" data-wp="${id}" style="${u ? `background-image:url('${u}')` : ''}"><span>${label || ''}</span>${id ? `<i class="wpx" data-wpdel="${id}" aria-label="Supprimer">×</i>` : ''}</button>`;
  let html = cell('', '', 'Aucun');
  for (const n of f) if (!hid.includes('f:' + n)) html += cell('f:' + n, n, '');
  for (const id of ids) html += cell(id, await resolve(id), '');
  sh.innerHTML = `<div class="fs-card wpcard"><h3>Fond d’écran</h3><p class="pw-t">Dépose tes images dans le dossier <b>assets/wallpapers</b> (ou le dossier Wallpapers du poste), ou ajoute-les ici.</p><div class="wpg">${html}<button class="wpc add" data-wp="+"><span>+ Ajouter</span></button></div><div class="fs-b"><button class="pill" data-wp="x">Fermer</button></div></div>`;
  sh.hidden = false; requestAnimationFrame(() => sh.classList.add('on'));
}
const close = () => { const sh = $('#wpsheet'); if (!sh) return; sh.classList.remove('on'); setTimeout(() => { sh.hidden = true; }, 220); };
document.addEventListener('click', async e => {
  if (!e.target || !e.target.closest) return;
  if (e.target.closest('[data-act="wp:open"]')) return open();
  const sh = $('#wpsheet'); if (!sh || sh.hidden) return;
  const dl = e.target.closest('[data-wpdel]');
  if (dl) {
    e.stopPropagation(); const id = dl.dataset.wpdel;
    if (id.startsWith('u:')) { const ids = ((await M.idb.get('wplist')) || []).filter(x => x !== id); await M.idb.put('wplist', ids); try { await M.idb.del?.('wp' + id); } catch (x) {} if (urls[id]) { URL.revokeObjectURL(urls[id]); delete urls[id]; } }
    else { try { window.Android?.deleteWallpaper?.(id.slice(2)); } catch (x) {} S.wpHidden = [...(S.wpHidden || []), id]; }
    if (S.wallpaper === id) S.wallpaper = '';
    M.saveS(); sig = ''; apply(); return open();
  }
  const b = e.target.closest('[data-wp]'); if (!b) { if (e.target === sh) close(); return; }
  const v = b.dataset.wp;
  if (v === 'x') return close();
  if (v === '+') {
    const i = document.createElement('input'); i.type = 'file'; i.accept = 'image/*'; i.multiple = true;
    i.onchange = async () => { const ids = (await M.idb.get('wplist')) || []; for (const f of i.files) { const id = 'u:' + Date.now() + Math.random().toString(36).slice(2, 5); await M.idb.put('wp' + id, f); ids.push(id); } await M.idb.put('wplist', ids); open(); };
    return i.click();
  }
  S.wallpaper = v; M.saveS(); apply(); open();
});

/* Liquid Glass : filtre SVG de réfraction (carte de déplacement générée une fois, bords qui « tirent » le fond) */
(() => {
  try {
    const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d'), im = g.createImageData(256, 256);
    for (let y = 0; y < 256; y++) for (let x = 0; x < 256; x++) {
      const u = x / 127.5 - 1, v = y / 127.5 - 1, f = t => Math.sign(t) * Math.pow(Math.abs(t), 5), i = (y * 256 + x) * 4;
      im.data[i] = 128 - 127 * f(u); im.data[i + 1] = 128 - 127 * f(v); im.data[i + 2] = 128; im.data[i + 3] = 255;
    }
    g.putImageData(im, 0, 0);
    const ns = 'http://www.w3.org/2000/svg', svg = document.createElementNS(ns, 'svg'); svg.id = 'lgSvg'; svg.setAttribute('aria-hidden', 'true');
    svg.innerHTML = `<defs><filter id="lgRefract" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB"><feImage href="${c.toDataURL()}" x="0" y="0" width="100%" height="100%" preserveAspectRatio="none" result="map"/><feDisplacementMap in="SourceGraphic" in2="map" scale="46" xChannelSelector="R" yChannelSelector="G"/></filter></defs>`;
    document.body.appendChild(svg);
  } catch (e) {}
})();

/* Centre de l'accueil : appui long (voiture ou widget) pour choisir ce qui s'affiche */
(() => {
  const OPTS = [['car', 'Voiture'], ['media', 'Son'], ['speed', 'Vitesse'], ['engine', 'Moteur'], ['weather', 'Météo'], ['clock', 'Heure'], ['none', 'Rien']].filter(o => !(window.LITE && o[0] === 'car'));
  const cur = () => S.showCar !== 'off' ? 'car' : (S.centerW || 'media');
  function open() {
    let sh = $('#ctrsheet'); if (!sh) { sh = document.createElement('div'); sh.id = 'ctrsheet'; $('#app').appendChild(sh); sh.addEventListener('click', e => { if (e.target === sh) return close(); const b = e.target.closest('[data-ctr]'); if (!b) return; choose(b.dataset.ctr); }); }
    sh.innerHTML = `<div class="fs-card wpcard ctrcard"><h3>Au centre de l’accueil</h3><p class="pw-t">La musique reste en bas à gauche si tu choisis autre chose que « Son ».</p><div class="ctrg">${OPTS.map(([k, l]) => `<button class="ctrb ${cur() === k ? 'on' : ''}" data-ctr="${k}">${l}</button>`).join('')}</div></div>`;
    sh.hidden = false; requestAnimationFrame(() => sh.classList.add('on'));
  }
  const close = () => { const sh = $('#ctrsheet'); if (!sh) return; sh.classList.remove('on'); setTimeout(() => { sh.hidden = true; }, 220); };
  function choose(k) {
    if (k === 'car') S.showCar = 'on'; else { S.showCar = 'off'; S.centerW = k; }
    M.saveS(); M.applySettings(); close();
  }
  let t = 0, x0 = 0, y0 = 0;
  document.addEventListener('pointerdown', e => {
    if (!e.target.closest || M.view !== 'home' && document.querySelector('#app').dataset.view !== 'home') return;
    if (!e.target.closest('#homeNp, #hero, .scene') || e.target.closest('button, .ctl, .prog, input')) return;
    x0 = e.clientX; y0 = e.clientY; clearTimeout(t); t = setTimeout(open, 650);
  });
  document.addEventListener('pointermove', e => { if (t && Math.hypot(e.clientX - x0, e.clientY - y0) > 12) { clearTimeout(t); t = 0; } });
  ['pointerup', 'pointercancel'].forEach(n => document.addEventListener(n, () => { clearTimeout(t); t = 0; }));
  window.M6.centerPicker = open;
})();
})();
