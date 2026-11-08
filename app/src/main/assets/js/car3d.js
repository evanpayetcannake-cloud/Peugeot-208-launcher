/* Voiture en 3D : plateau tournant. 72 vues (glisser) + vidéo de rotation interpolée (rotation auto fluide). */
(() => {
  const img = document.getElementById('carImg'), hero = document.getElementById('hero'); if (!img || !hero || window.LITE) return;
  const vid = document.getElementById('carVid');
  const N = 72, START = 6, SPD = 2, cache = {};            // SPD : vues/s → tour complet en 36 s (= durée de la vidéo)
  const theme = () => (document.querySelector('[data-theme=night]') ? 'n' : 'd');
  const key = (t, i) => t + String(i).padStart(2, '0');
  const url = k => (window.CARF && window.CARF[k]) || `assets/car/${k}.webp`;
  const get = k => cache[k] || (cache[k] = Object.assign(new Image(), { decoding: 'async', src: url(k) }));
  let idx = START, acc = START, th = theme(), drag = null, raf = 0, pause = 0, anim = 0;
  const show = () => { raf = 0; const k = key(th, idx); get(k); if (img.dataset.k !== k) { img.dataset.k = k; img.src = get(k).src; } };
  const ask = () => { if (!raf) raf = requestAnimationFrame(show); };
  img.onload = () => { document.documentElement.dataset.hero = 'img'; };
  show();
  let pl = 0, pth = th;
  const preload = () => { pl = 0; pth = th; const step = () => { if (pth !== th || pl >= N) return; get(key(th, pl++)); if (window.requestIdleCallback) requestIdleCallback(step, { timeout: 400 }); else setTimeout(step, 60); }; step(); };
  setTimeout(preload, 700);

  // --- vidéo ---
  let vTh = '', vReady = false, vOn = false, vWant = false;
  const vSrc = () => {
    if (!vid || vTh === th) return; vTh = th; vReady = false; vOn = false; hero.classList.remove('vid');
    vid.src = url('rot_' + th); vid.load();
  };
  if (vid) {
    vid.addEventListener('loadeddata', () => { vReady = true; });
    vid.addEventListener('error', () => { vReady = false; });
    vid.addEventListener('seeked', () => { if (vWant && !vOn && !vid.paused) { vOn = true; hero.classList.add('vid'); } });
  }
  const vStart = () => {
    if (vOn || !vReady) return;
    vWant = true;
    try { vid.currentTime = (((acc % N) + N) % N) / SPD; } catch (e) { return; }
    const p = vid.play(); if (p && p.catch) p.catch(() => { vWant = false; });
    // affichage dès que la première image est prête
    const go = () => { if (vWant && !vOn) { vOn = true; hero.classList.add('vid'); } };
    if (vid.requestVideoFrameCallback) vid.requestVideoFrameCallback(go); else setTimeout(go, 120);
  };
  const vStop = () => {
    if (!vid) return;
    if (vOn || vWant) { acc = ((vid.currentTime * SPD) % N + N) % N; idx = Math.round(acc) % N; show(); }
    vWant = false; if (vOn) { hero.classList.remove('vid'); vOn = false; }
    if (!vid.paused) vid.pause();
  };

  const upd = () => { const t = theme(); if (t !== th) { const was = vOn; if (was) vStop(); th = t; ask(); setTimeout(preload, 300); vSrc(); } };
  new MutationObserver(upd).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  const app = document.getElementById('app'); if (app) new MutationObserver(upd).observe(app, { attributes: true, attributeFilter: ['data-theme'] });
  setTimeout(vSrc, 400);

  hero.addEventListener('pointerdown', e => { anim = 0; vStop(); drag = { x: e.clientX, a: acc }; hero.setPointerCapture(e.pointerId); });
  hero.addEventListener('pointermove', e => { if (!drag) return; acc = drag.a - (e.clientX - drag.x) / (hero.clientWidth / N * 1.6); idx = ((Math.round(acc) % N) + N) % N; ask(); });
  const end = () => { if (!drag) return; acc = ((acc % N) + N) % N; drag = null; pause = performance.now() + 700; };
  hero.addEventListener('pointerup', end); hero.addEventListener('pointercancel', end);
  hero.addEventListener('dblclick', () => recentre());

  // --- retour à la pose de face (accueil) ---
  const recentre = () => {
    if (!vid) { acc = idx = START; ask(); return; }
    vStop(); let d = START - (((acc % N) + N) % N); if (d > N / 2) d -= N; if (d < -N / 2) d += N;
    if (Math.abs(d) < .3) { acc = idx = START; ask(); return; }
    anim = { t0: performance.now(), a0: acc, d, dur: Math.min(1100, 450 + Math.abs(d) * 22) };
  };
  window.addEventListener('m6view', e => {
    if (e.detail !== 'home') return;
    if (window.M6 && window.M6.S.autoRot === 'off') { if (idx !== START) recentre(); } else pause = 0;
  });

  const auto = t => {
    requestAnimationFrame(auto);
    if (anim) {
      const u = Math.min(1, (t - anim.t0) / anim.dur), e = u < .5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2;
      acc = anim.a0 + anim.d * e; idx = ((Math.round(acc) % N) + N) % N; show();
      if (u >= 1) { acc = ((anim.a0 + anim.d) % N + N) % N; idx = Math.round(acc) % N; anim = 0; pause = performance.now() + 1500; }
      return;
    }
    const rotOn = window.M6 && window.M6.S.autoRot !== 'off';
    const on = rotOn && !drag && performance.now() > pause && hero.offsetParent && !document.hidden;
    if (!on) { if (vOn || vWant) vStop(); return; }
    if (vReady) {
      if (!vOn && !vWant) vStart();
      else if (vOn) { acc = vid.currentTime * SPD; const i = Math.round(acc) % N; if (i !== idx) idx = i; }
    } else {                                   // repli : pas de vidéo → enchaînement des vues
      acc = (acc + SPD / 60 + N) % N; idx = Math.round(acc) % N; show();
    }
  };
  requestAnimationFrame(auto);
})();
