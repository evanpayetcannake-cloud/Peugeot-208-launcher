/* Entretien : kilométrage + échéances (vidange, filtres, freins, pneus, contrôle technique).
   Tout est saisi / validé à la main ; le kilométrage est lu sur la voiture dès que le poste l'envoie (Car.s.odoKm). */
(() => {
  const M = window.M6, { S, saveS, Car, $ } = M, CONFIG = M.CONFIG;
  const DEFS = [
    { id: 'vidange', n: 'Vidange + filtre à huile', s: 'Vidange', i: 'i-oil', ik: 20000, im: 12 },
    { id: 'gazole', n: 'Filtre à gazole', s: 'Filtre gazole', i: 'i-filter', ik: 60000, im: 48 },
    { id: 'courroie', n: 'Courroie de distribution', s: 'Courroie distrib.', i: 'i-wrench', ik: 180000, im: 120 },
    { id: 'air', n: 'Filtre à air', s: 'Filtre à air', i: 'i-air', ik: 60000, im: 48 },
    { id: 'habitacle', n: 'Filtre d’habitacle', s: 'Filtre habitacle', i: 'i-car', ik: 15000, im: 12 },
    { id: 'freins', n: 'Plaquettes et disques', s: 'Freins', i: 'i-brake', ik: 40000, im: 0 },
    { id: 'lfrein', n: 'Liquide de frein', s: 'Liquide de frein', i: 'i-brakefl', ik: 0, im: 24 },
    { id: 'pneus', n: 'Pneus (contrôle / permutation)', s: 'Pneus', i: 'i-tire', ik: 10000, im: 0 },
    { id: 'ct', n: 'Contrôle technique', s: 'Contrôle technique', i: 'i-shield', ik: 0, im: 24 }
  ];
  const iso = (y, m, d) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  const fmt = n => Math.round(n).toLocaleString('fr-FR');
  const dfr = s => { try { return new Date(s).toLocaleDateString('fr-FR'); } catch (e) { return ''; } };

  const esc = t => String(t ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  /* Liste affichée = entretiens de base (renommables, supprimables) + entretiens ajoutés */
  function list() {
    const m = S.maint;
    return DEFS.filter(d => !m.hidden.includes(d.id)).map(d => m.names[d.id] ? { ...d, n: m.names[d.id], s: m.names[d.id] } : d)
      .concat(m.custom.map(c => ({ ...c, s: c.n, i: c.i || 'i-wrench' })));
  }
  function migrate() {   // anciens réglages : on ajoute les nouveaux champs sans rien perdre
    const m = S.maint; m.custom = m.custom || []; m.names = m.names || {}; m.hidden = m.hidden || []; if (m.notes == null) m.notes = ''; if (m.watch === undefined) m.watch = null;
    DEFS.forEach(d => { m.items[d.id] = m.items[d.id] || { km: null, d: null, ik: d.ik, im: d.im }; });
    m.custom.forEach(c => { m.items[c.id] = m.items[c.id] || { km: null, d: null, ik: 10000, im: 12 }; });
  }
  function init() {
    if (S.maint) return migrate();
    const it = {}; DEFS.forEach(d => it[d.id] = { km: null, d: null, ik: d.ik, im: d.im });
    S.maint = { odo: null, demo: false, items: it };
    if (CONFIG.demo) {   // valeurs d'exemple pour voir l'écran vivant
      S.maint.odo = 118450; S.maint.demo = true;
      Object.assign(it.vidange, { km: 103600, d: iso(2026, 3, 12) }); Object.assign(it.gazole, { km: 80000, d: iso(2024, 6, 10) });
      Object.assign(it.air, { km: 80000, d: iso(2024, 6, 10) }); Object.assign(it.habitacle, { km: 98000, d: iso(2025, 5, 2) });
      Object.assign(it.freins, { km: 92000, d: iso(2024, 11, 8) }); Object.assign(it.lfrein, { km: 90000, d: iso(2024, 10, 20) });
      Object.assign(it.pneus, { km: 112000, d: iso(2026, 8, 14) }); Object.assign(it.ct, { km: 102000, d: iso(2025, 4, 8) });
      saveS();
    }
    migrate();
  }
  init();
  const odo = () => Car.s.odoKm != null ? Car.s.odoKm : S.maint.odo;
  const fromCar = () => Car.s.odoKm != null;

  function calc(it) {
    const o = odo(), r = [];
    if (it.ik && it.km != null && o != null) r.push({ u: 'km', rem: it.km + it.ik - o, ratio: (it.km + it.ik - o) / it.ik });
    if (it.im && it.d) { const due = new Date(it.d); due.setMonth(due.getMonth() + it.im); const days = Math.round((due - new Date()) / 864e5); r.push({ u: 'd', rem: days, ratio: days / (it.im * 30.4) }); }
    if (!r.length) return { st: 'na', txt: 'À renseigner', short: 'à renseigner', p: 0 };
    const w = r.reduce((a, b) => a.ratio <= b.ratio ? a : b);
    const st = w.ratio < 0 ? 'late' : w.ratio < .12 ? 'soon' : 'ok';
    const txt = w.u === 'km' ? (w.rem >= 0 ? `Dans ${fmt(w.rem)} km` : `En retard de ${fmt(-w.rem)} km`)
      : w.rem >= 60 ? `Dans ${Math.round(w.rem / 30.4)} mois` : w.rem >= 0 ? `Dans ${w.rem} j` : `En retard de ${-w.rem} j`;
    return { st, txt, short: txt.replace('Dans ', '').replace('En retard de ', '+'), p: 1 - Math.min(1, Math.max(0, w.ratio)), rank: w.ratio };
  }
  const every = it => [it.ik ? `${fmt(it.ik)} km` : '', it.im ? `${it.im} mois` : ''].filter(Boolean).join(' · ');
  const last = it => it.km == null && !it.d ? 'Dernier : non renseigné' : 'Dernier : ' + [it.km != null ? fmt(it.km) + ' km' : '', it.d ? dfr(it.d) : ''].filter(Boolean).join(' · ');

  function render() {
    const box = $('#mtBox'); if (!box) return;
    const rows = list().map(d => ({ d, it: S.maint.items[d.id], c: calc(S.maint.items[d.id]) }));
    const next = rows.filter(r => r.c.st !== 'na').sort((a, b) => a.c.rank - b.c.rank)[0];
    const o = odo();
    box.innerHTML = `<div class="mt-wrap">
      <aside class="mt-odo">
        <small>Kilométrage</small>
        <div class="odo"><b>${o == null ? '—' : fmt(o)}</b><span>km</span></div>
        <em>${fromCar() ? 'Lu sur la voiture' : 'Saisi à la main'}</em>
        ${fromCar() ? '' : '<button class="pill pri" data-mt="odo">Modifier</button>'}
        ${S.maint.watch ? `<button class="mt-next manual" data-mt="watch"><small>À surveiller · écrit à la main</small><b>${esc(S.maint.watch)}</b><span>Touche pour modifier</span></button>`
          : next ? `<button class="mt-next ${next.c.st}" data-mt="watch"><small>À surveiller</small><b>${esc(next.d.s)}</b><span>${next.c.txt}</span></button>` : `<button class="mt-next" data-mt="watch"><small>À surveiller</small><b>Rien à signaler</b><span>Touche pour écrire</span></button>`}
        <button class="mt-notes" data-mt="notes"><small>Mes notes</small><span>${S.maint.notes ? esc(S.maint.notes) : 'Ajouter une note…'}</span></button>
        ${S.maint.hidden.length ? `<button class="mt-restore" data-mt="restore">Rétablir les entretiens supprimés (${S.maint.hidden.length})</button>` : ''}
        ${S.maint.demo ? '<p class="mt-note">Valeurs d’exemple : touche ✎ pour mettre les tiennes. Intervalles indicatifs, vérifie ton carnet d’entretien.</p>' : '<p class="mt-note">Intervalles indicatifs : vérifie ton carnet d’entretien.</p>'}
      </aside>
      <div class="mt-grid">${rows.map(({ d, it, c }) => `<div class="mt-it ${c.st}" data-id="${d.id}">
        <i class="mt-ic"><svg class="ic"><use href="#${d.i}"/></svg></i>
        <div class="mt-tx"><b>${esc(d.n)}</b><span>${it.note ? `<em class="mt-nt">${esc(it.note)}</em>` : 'Tous les ' + (every(it) || '—')}</span><div class="mt-bar"><u style="width:${(c.p * 100).toFixed(0)}%"></u></div></div>
        <div class="mt-st"><strong>${c.txt}</strong><small>${last(it)}</small></div>
        <div class="mt-ac"><button class="mt-edit" data-mt="edit" aria-label="Modifier"><svg class="ic"><use href="#i-edit"/></svg></button><button class="pill" data-mt="done">Fait</button></div>
      </div>`).join('')}<button class="mt-add" data-mt="add"><svg class="ic" viewBox="0 0 24 24"><path d="M11 5h2v6h6v2h-6v6h-2v-6H5v-2h6z"/></svg>Ajouter un entretien</button></div></div>`;
    updateRow();
  }

  function updateRow() {
    const L = $('#lMt'), V = $('#vMt'); if (!L || !V) return;
    if (S.maint.watch) { L.textContent = 'À surveiller'; V.textContent = S.maint.watch; V.className = 'v'; return; }
    const rows = list().map(d => ({ d, c: calc(S.maint.items[d.id]) })).filter(r => r.c.st !== 'na').sort((a, b) => a.c.rank - b.c.rank);
    if (!rows.length) { L.textContent = 'Entretien'; V.textContent = 'À renseigner'; V.className = 'v'; return; }
    L.textContent = rows[0].d.s; V.textContent = rows[0].c.short; V.className = 'v mt-' + rows[0].c.st;
  }

  /* --- pavé numérique --- */
  function keypad(title, val, unit) {
    return new Promise(res => {
      let v = val == null ? '' : String(Math.round(val));
      const ov = document.createElement('div'); ov.className = 'kp-ov';
      ov.innerHTML = `<div class="kp"><small>${title}</small><div class="kp-d"><b></b><span>${unit || ''}</span></div>
        <div class="kp-k">${[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => `<button data-k="${n}">${n}</button>`).join('')}<button data-k="b" aria-label="Effacer">⌫</button><button data-k="0">0</button><button class="ok" data-k="ok">OK</button></div>
        <button class="kp-x" data-k="x">Annuler</button></div>`;
      const show = () => ov.querySelector('.kp-d b').textContent = v ? fmt(+v) : '0';
      ov.addEventListener('click', e => {
        const b = e.target.closest('[data-k]'); if (!b) { if (e.target === ov) { ov.remove(); res(null); } return; }
        const k = b.dataset.k;
        if (k === 'ok') { ov.remove(); res(v === '' ? null : +v); } else if (k === 'x') { ov.remove(); res(null); }
        else if (k === 'b') { v = v.slice(0, -1); show(); } else if (v.length < 7) { v = (v + k).replace(/^0+(?=\d)/, ''); show(); }
      });
      document.getElementById('app').appendChild(ov); show();
    });
  }

  /* --- fenêtre de saisie de texte --- */
  function textSheet(title, val, { multi = false, ph = '', extra = '' } = {}) {
    return new Promise(res => {
      const ov = document.createElement('div'); ov.className = 'kp-ov';
      ov.innerHTML = `<div class="kp mt-sheet mt-txt"><small>${title}</small>${multi ? `<textarea rows="6" placeholder="${esc(ph)}">${esc(val)}</textarea>` : `<input type="text" maxlength="40" value="${esc(val)}" placeholder="${esc(ph)}">`}
        <div class="mt-sb">${extra}<button class="pill" data-t="x">Annuler</button><button class="pill pri" data-t="ok">Enregistrer</button></div></div>`;
      const inp = ov.querySelector('textarea, input');
      ov.addEventListener('click', e => {
        if (e.target === ov) { ov.remove(); return res(null); }
        const b = e.target.closest('[data-t]'); if (!b) return;
        ov.remove(); res(b.dataset.t === 'ok' ? inp.value.trim() : b.dataset.t === 'x' ? null : { act: b.dataset.t });
      });
      document.getElementById('app').appendChild(ov); setTimeout(() => inp.focus(), 50);
    });
  }

  /* --- fenêtre de modification d'un entretien --- */
  function editSheet(id) {
    const it = S.maint.items[id], custom = S.maint.custom.find(x => x.id === id);
    const name = () => (list().find(x => x.id === id) || {}).n || '';
    const ov = document.createElement('div'); ov.className = 'kp-ov'; let delAsk = false;
    const draw = () => {
      ov.innerHTML = `<div class="kp mt-sheet"><small>Modifier l’entretien</small>
        <button class="mt-f" data-f="name"><span>Nom</span><b>${esc(name())}</b></button>
        <button class="mt-f" data-f="km"><span>Dernier entretien (km)</span><b>${it.km == null ? '—' : fmt(it.km) + ' km'}</b></button>
        <label class="mt-f"><span>Dernier entretien (date)</span><input type="date" value="${it.d || ''}" data-f="d"></label>
        <button class="mt-f" data-f="ik"><span>Tous les (km)</span><b>${it.ik ? fmt(it.ik) + ' km' : 'sans'}</b></button>
        <button class="mt-f" data-f="im"><span>Tous les (mois)</span><b>${it.im ? it.im + ' mois' : 'sans'}</b></button>
        <button class="mt-f" data-f="note"><span>Note</span><b>${it.note ? esc(it.note) : 'Ajouter'}</b></button>
        <div class="mt-sb"><button class="pill danger" data-f="del">${delAsk ? 'Confirmer la suppression' : 'Supprimer'}</button><button class="pill pri" data-f="close">Terminé</button></div></div>`;
    };
    ov.addEventListener('change', e => { if (e.target.dataset.f === 'd') { it.d = e.target.value || null; saveS(); } });
    ov.addEventListener('click', async e => {
      if (e.target === ov) { ov.remove(); render(); return; }
      const b = e.target.closest('button[data-f]'); if (!b) return; const f = b.dataset.f;
      if (f === 'close') { ov.remove(); render(); return; }
      if (f === 'del') {
        if (!delAsk) { delAsk = true; return draw(); }
        if (custom) { S.maint.custom = S.maint.custom.filter(x => x.id !== id); delete S.maint.items[id]; } else S.maint.hidden.push(id);
        saveS(); ov.remove(); render(); M.toast?.('Entretien supprimé'); return;
      }
      if (f === 'name') { const v = await textSheet('Nom de l’entretien', name(), { ph: 'Ex. : Vidange boîte' }); if (v) { if (custom) custom.n = v; else S.maint.names[id] = v; saveS(); } return draw(); }
      if (f === 'note') { const v = await textSheet('Note : ' + name(), it.note || '', { multi: true, ph: 'Ex. : huile 5W30, garage Dupont, réf. filtre…' }); if (v != null) { it.note = v; saveS(); } return draw(); }
      const lab = { km: ['Dernier entretien', 'km'], ik: ['Intervalle', 'km'], im: ['Intervalle', 'mois'] }[f];
      const v = await keypad(lab[0], it[f], lab[1]); if (v == null) return;
      it[f] = f === 'km' ? v : v; S.maint.demo = false; saveS(); draw();
    });
    draw(); document.getElementById('app').appendChild(ov);
  }

  document.addEventListener('click', async e => {
    const b = e.target.closest('[data-mt]'); if (!b || !$('#view-maint').contains(b)) return;
    const k = b.dataset.mt, id = b.closest('.mt-it')?.dataset.id;
    if (k === 'odo') { const v = await keypad('Kilométrage', odo(), 'km'); if (v != null) { S.maint.odo = v; S.maint.demo = false; saveS(); render(); } }
    else if (k === 'done') { const it = S.maint.items[id], o = odo(); it.km = o; it.d = new Date().toISOString().slice(0, 10); S.maint.demo = false; saveS(); render(); M.toast?.((list().find(x => x.id === id) || {}).s + ' : fait'); }
    else if (k === 'edit') editSheet(id);
    else if (k === 'add') {
      const n = await textSheet('Nouvel entretien', '', { ph: 'Ex. : Vidange boîte, AdBlue, Batterie…' }); if (!n) return;
      const nid = 'c' + Date.now().toString(36); S.maint.custom.push({ id: nid, n, i: 'i-wrench' }); S.maint.items[nid] = { km: null, d: null, ik: 10000, im: 12, note: '' }; S.maint.demo = false; saveS(); render(); editSheet(nid);
    }
    else if (k === 'watch') {
      const v = await textSheet('À surveiller', S.maint.watch || '', { multi: true, ph: 'Écris ce qui est à surveiller (ex. : bruit au freinage)', extra: '<button class="pill" data-t="auto">Automatique</button>' });
      if (v && v.act === 'auto') S.maint.watch = null; else if (typeof v === 'string') S.maint.watch = v || null; else return;
      saveS(); render();
    }
    else if (k === 'notes') { const v = await textSheet('Mes notes', S.maint.notes || '', { multi: true, ph: 'Notes libres : garage, références, rappels…' }); if (v != null) { S.maint.notes = v; saveS(); render(); } }
    else if (k === 'restore') { S.maint.hidden = []; saveS(); render(); M.toast?.('Entretiens rétablis'); }
  });
  M.maintRender = render;
  render(); setInterval(updateRow, 60000);
})();
