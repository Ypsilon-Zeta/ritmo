(function () {
  'use strict';
  /* ═════════════ Ritmo · interfaccia (parte 1: infrastruttura, Oggi, Acqua, Workout) ═════════════ */
  const C = window.RitmoCore;
  const { DAY, pad2, uid, clamp, parseDK, dayKey, addDays, diffDays, weekdayOf, mondayOf, weekKey, hm } = C;
  const VERSION = '1.1.0';

  /* ───────────── memoria locale ───────────── */
  const LS = { data: 'ritmo.v1', device: 'ritmo.device', token: 'ritmo.sync.token', gist: 'ritmo.sync.gist', backup: 'ritmo.backup', fired: 'ritmo.fired', lastSync: 'ritmo.sync.last' };
  let storageOK = true;
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) {
      try { localStorage.setItem(k, JSON.stringify(v)); storageOK = true; return true; }
      catch (e) { if (storageOK) toast('Non riesco a salvare: spazio pieno o modalità privata. Esporta un backup.', 'warn'); storageOK = false; return false; }
    },
    del(k) { try { localStorage.removeItem(k); } catch (e) { /* nulla */ } },
  };

  let S;
  try { S = C.normalize(store.get(LS.data, null), Date.now()); }
  catch (e) { S = C.emptyState(Date.now()); }
  let D = Object.assign({ theme: 'auto', notify: false, sound: true }, store.get(LS.device, {}) || {});
  let ver = 0, cache = { v: -1 };
  const now = () => Date.now();
  const saveDevice = () => store.set(LS.device, D);
  const save = () => { store.set(LS.data, S); onSaved(); };

  /** Indice e derivati, ricalcolati solo se i dati cambiano o passa un minuto. */
  function X() {
    const n = now(), minute = Math.floor(n / 60000);
    if (cache.v !== ver || cache.minute !== minute) {
      const I = C.buildIndex(S, n);
      const streak = C.streakInfo(S, I, n);
      const xp = C.xpInfo(S, I, n, streak.scores);
      cache = { v: ver, minute, I, streak, xp, os: C.osStatus(S, I, I.today), score: streak.scores[I.today] };
    }
    return cache;
  }

  /* ───────────── formattazione ───────────── */
  const NF = new Intl.NumberFormat('it-IT');
  const NF2 = new Intl.NumberFormat('it-IT', { maximumFractionDigits: 2 });
  const fmtN = n => NF.format(Math.round(n || 0));
  const fmtMl = ml => (Math.abs(ml) >= 1000 ? NF2.format(ml / 1000) + ' L' : fmtN(ml) + ' ml');
  function fmtMin(m) { m = Math.round(m || 0); if (m < 60) return m + '′'; const h = Math.floor(m / 60), r = m % 60; return h + ' h' + (r ? ' ' + r + '′' : ''); }
  const WD_SHORT = ['dom', 'lun', 'mar', 'mer', 'gio', 'ven', 'sab'];
  const WD_LETTER = ['D', 'L', 'M', 'M', 'G', 'V', 'S'];
  const MON_SHORT = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'];
  const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
  const fmtDateLong = dk => cap(parseDK(dk).toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' }));
  function fmtRel(dk) {
    const today = X().I.today, n = diffDays(dk, today), d = parseDK(dk);
    if (n === 0) return 'oggi'; if (n === 1) return 'domani'; if (n === -1) return 'ieri';
    if (n > 1 && n < 7) return WD_SHORT[d.getDay()] + ' ' + d.getDate();
    return d.getDate() + ' ' + MON_SHORT[d.getMonth()] + (d.getFullYear() !== parseDK(today).getFullYear() ? ' ' + d.getFullYear() : '');
  }
  const fmtTime = ts => { const d = new Date(ts); return pad2(d.getHours()) + ':' + pad2(d.getMinutes()); };
  function ago(ts) { const days = Math.floor((now() - ts) / DAY); return days <= 0 ? 'oggi' : days === 1 ? 'ieri' : days + ' g fa'; }
  const localInput = ts => { const d = new Date(ts); return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()) + 'T' + pad2(d.getHours()) + ':' + pad2(d.getMinutes()); };

  /* ───────────── DOM ───────────── */
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const $ = (q, el = document) => el.querySelector(q);
  const $$ = (q, el = document) => [...el.querySelectorAll(q)];
  const AREA = Object.fromEntries(C.AREAS.map(a => [a.id, a]));
  const cv = id => `--c:var(--${AREA[id] ? AREA[id].color : id})`;
  const onInk = id => (id === 'todo' ? '--on:#0b0b0b' : '');
  const ICON_CHECK = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3.5 8.5l3 3 6-7"/></svg>';
  const typeOf = id => C.WORKOUT_TYPES.find(t => t.id === id) || { name: id || 'Workout', emoji: '🏋️' };

  /* ───────────── mutazioni (ogni record ha u = ultimo aggiornamento, per la sync) ───────────── */
  function tomb(arr, id) {
    const r = arr.find(x => x.id === id);
    if (r) { for (const k of Object.keys(r)) delete r[k]; Object.assign(r, { id, d: 1, u: now() }); }
  }
  const dayObj = dk => (S.days[dk] = S.days[dk] && typeof S.days[dk] === 'object' ? S.days[dk] : {});
  function setDay(dk, key, v) { dayObj(dk)[key] = { v, u: now() }; }
  function setOS(dk, stepId, v) { const d = dayObj(dk); d.os = d.os || {}; d.os[stepId] = { v, u: now() }; }
  const dayVal = (dk, key) => S.days[dk] && S.days[dk][key] ? S.days[dk][key].v : null;
  function getPath(obj, path) { return path.split('.').reduce((o, k) => (o == null ? o : o[k]), obj); }
  function setPath(obj, path, v) { const ks = path.split('.'); const last = ks.pop(); const o = ks.reduce((a, k) => (a[k] = a[k] || {}), obj); o[last] = v; }

  /** Applica una modifica, salva, sincronizza, ridisegna e festeggia i traguardi. */
  function commit(fn, o = {}) {
    const before = X();
    const sc0 = before.score ? before.score.score : null, lv0 = before.xp.level, thr = before.streak.threshold;
    try { fn(); } catch (e) { console.error(e); toast('Qualcosa non ha funzionato: ' + e.message, 'warn'); }
    ver++; save(); scheduleSync();
    if (o.render !== false) render(o);
    if (o.xp) floatXP(o.xp);
    const after = X(), sc1 = after.score ? after.score.score : null;
    if (after.xp.level > lv0) { confetti(); toast('Livello ' + after.xp.level + ' raggiunto!'); beep('goal'); }
    else if (sc0 !== null && sc0 < 100 && sc1 === 100) { confetti(); toast('Giornata perfetta: 100 punti!'); beep('goal'); }
    else if (sc0 !== null && sc0 < thr && sc1 >= thr) toast('🔥 Serie al sicuro per oggi (' + sc1 + ' punti)');
  }

  /* ───────────── feedback: toast, XP, suono, coriandoli, tooltip ───────────── */
  function toast(msg, kind = '', action = null, ms = 3000) {
    const box = $('#toasts'); if (!box) return;
    const el = document.createElement('div'); el.className = 'toast ' + kind;
    el.innerHTML = `<p>${esc(msg)}</p>` + (action ? `<button type="button">${esc(action.label)}</button>` : '');
    if (action) el.querySelector('button').onclick = () => { el.remove(); action.fn(); };
    box.appendChild(el); while (box.children.length > 3) box.firstChild.remove();
    setTimeout(() => el.remove(), action ? 6000 : ms);
  }
  let lastPointer = null;
  document.addEventListener('pointerdown', e => { lastPointer = { x: e.clientX, y: e.clientY, t: now() }; }, true);
  function floatXP(n) {
    if (!n) return;
    const p = lastPointer && now() - lastPointer.t < 3000 ? lastPointer : { x: innerWidth / 2, y: innerHeight / 2 };
    const el = document.createElement('div'); el.className = 'xpf'; el.textContent = '+' + n + ' XP';
    el.style.left = p.x + 'px'; el.style.top = p.y - 16 + 'px';
    document.body.appendChild(el); setTimeout(() => el.remove(), 950);
  }
  let actx = null;
  function ensureAudio() { try { actx = actx || new (window.AudioContext || window.webkitAudioContext)(); if (actx.state === 'suspended') actx.resume(); } catch (e) { /* nulla */ } }
  function beep(kind = 'ok') {
    if (!D.sound) return;
    try {
      ensureAudio(); if (!actx) return;
      const t0 = actx.currentTime;
      const notes = kind === 'end' ? [660, 880, 990] : kind === 'goal' ? [523, 659, 784, 1046] : [880];
      notes.forEach((f, i) => {
        const o = actx.createOscillator(), g = actx.createGain(), t = t0 + i * 0.11;
        o.type = 'sine'; o.frequency.value = f;
        g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.1, t + 0.015); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
        o.connect(g); g.connect(actx.destination); o.start(t); o.stop(t + 0.22);
      });
    } catch (e) { /* nulla */ }
  }
  function confetti() {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const cvs = document.createElement('canvas'); cvs.id = 'confetti'; document.body.appendChild(cvs);
    const dpr = window.devicePixelRatio || 1; cvs.width = innerWidth * dpr; cvs.height = innerHeight * dpr;
    const ctx = cvs.getContext('2d'); ctx.scale(dpr, dpr);
    const cs = getComputedStyle(document.documentElement);
    const cols = ['acqua', 'workout', 'lavoro', 'todo', 'progetti', 'casa', 'progressi'].map(k => cs.getPropertyValue('--' + k).trim());
    const P = [...Array(110)].map(() => ({ x: innerWidth / 2 + (Math.random() - 0.5) * 120, y: innerHeight * 0.35, vx: (Math.random() - 0.5) * 11, vy: -Math.random() * 11 - 3, r: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 0.3, w: 6 + Math.random() * 6, h: 4 + Math.random() * 4, c: cols[Math.floor(Math.random() * cols.length)] }));
    const t0 = performance.now();
    (function frame(t) {
      const k = (t - t0) / 1600; ctx.clearRect(0, 0, innerWidth, innerHeight);
      for (const p of P) { p.vy += 0.32; p.x += p.vx; p.y += p.vy; p.r += p.vr; ctx.save(); ctx.globalAlpha = Math.max(0, 1 - k); ctx.translate(p.x, p.y); ctx.rotate(p.r); ctx.fillStyle = p.c; ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h); ctx.restore(); }
      if (k < 1) requestAnimationFrame(frame); else cvs.remove();
    })(t0);
  }
  function showTip(el) {
    const t = el.getAttribute('data-tip'); const box = $('#tip'); if (!t || !box) return;
    box.textContent = t; box.classList.remove('hidden');
    const r = el.getBoundingClientRect(), bw = box.offsetWidth, bh = box.offsetHeight;
    box.style.left = clamp(r.left + r.width / 2 - bw / 2, 8, innerWidth - bw - 8) + 'px';
    box.style.top = (r.top - bh - 8 < 8 ? r.bottom + 8 : r.top - bh - 8) + 'px';
  }
  function hideTip() { const b = $('#tip'); if (b) b.classList.add('hidden'); }
  let tipTimer = null;
  document.addEventListener('pointerover', e => { if (e.pointerType === 'touch') return; const el = e.target.closest && e.target.closest('[data-tip]'); if (el) showTip(el); });
  document.addEventListener('pointerout', e => { if (e.pointerType === 'touch') return; const el = e.target.closest && e.target.closest('[data-tip]'); if (el) hideTip(); });
  document.addEventListener('pointerup', e => {
    if (e.pointerType !== 'touch') return; const el = e.target.closest && e.target.closest('[data-tip]');
    if (el) { showTip(el); clearTimeout(tipTimer); tipTimer = setTimeout(hideTip, 2400); }
  });
  document.addEventListener('focusin', e => { const el = e.target.closest && e.target.closest('[data-tip]'); if (el) showTip(el); });
  document.addEventListener('focusout', hideTip);
  window.addEventListener('scroll', hideTip, { passive: true });

  /* ───────────── componenti visivi ───────────── */
  const bar = (pct, area, extra = '', cls = '') =>
    `<div class="bar ${cls}" style="${cv(area)}" role="img" aria-label="${Math.round(clamp(pct, 0, 1) * 100)}%"><i style="width:${(clamp(pct, 0, 1) * 100).toFixed(1)}%"></i>${extra}</div>`;
  function ring(pct, { size = 64, stroke = 8, area = 'progressi', label = '', sub = '', id = '' } = {}) {
    const r = (size - stroke) / 2, c = 2 * Math.PI * r, p = clamp(pct, 0, 1), h = size / 2;
    return `<div class="ring-wrap" style="${cv(area)};width:${size}px;height:${size}px"><svg class="ring" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" aria-hidden="true"><circle class="trk" cx="${h}" cy="${h}" r="${r}" fill="none" stroke-width="${stroke}"/>${p > 0 ? `<circle class="val" ${id ? `id="${id}"` : ''} data-c="${c}" cx="${h}" cy="${h}" r="${r}" fill="none" stroke-width="${stroke}" stroke-linecap="round" stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - p)}" transform="rotate(-90 ${h} ${h})"/>` : ''}</svg>${label !== '' ? `<div class="ring-label"><b>${label}</b>${sub ? `<span>${sub}</span>` : ''}</div>` : ''}</div>`;
  }
  function niceMax(v) { if (v <= 0) return 1; const p = Math.pow(10, Math.floor(Math.log10(v))); const n = v / p; return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p; }
  function roundTop(x, y, w, h, r) { r = Math.min(r, h, w / 2); return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`; }
  /** Colonne: una serie, ≤24px, angoli arrotondati in alto, baseline unica, etichetta solo sull'ultima. */
  const chartW = () => (innerWidth < 720 ? 330 : 440);
  function barChart({ data, color, goal = 0, fmt = fmtN, h = 170, label = '', lastLabel = true }) {
    const w = chartW(), pl = 40, pr = 10, pt = 18, pb = 24, iw = w - pl - pr, ih = h - pt - pb;
    const max = niceMax(Math.max(goal, ...data.map(d => d.v), 1));
    const y = v => pt + ih - (v / max) * ih, band = iw / data.length, bw = Math.min(24, band * 0.62);
    let s = `<svg class="chart" viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(label)}">`;
    for (const t of [0, max / 2, max]) s += `<line class="grid${t === 0 ? ' base' : ''}" x1="${pl}" x2="${w - pr}" y1="${y(t)}" y2="${y(t)}"/><text class="tick" x="${pl - 8}" y="${y(t) + 4}" text-anchor="end">${esc(fmt(t))}</text>`;
    if (goal) s += `<line class="goal" x1="${pl}" x2="${w - pr}" y1="${y(goal)}" y2="${y(goal)}"/><text class="tick" x="${w - pr}" y="${y(goal) - 5}" text-anchor="end">obiettivo</text>`;
    data.forEach((d, i) => {
      const x = pl + band * i + (band - bw) / 2, top = y(d.v), hh = pt + ih - top;
      s += `<rect class="hit" x="${pl + band * i}" y="${pt}" width="${band}" height="${ih}" data-tip="${esc(d.tip)}" tabindex="0" aria-label="${esc(d.tip)}"/>`;
      if (hh > 0.5) s += `<path class="mark" d="${roundTop(x, top, bw, hh, 4)}" style="fill:${color}"/>`;
      if (d.label) s += `<text class="tick" x="${x + bw / 2}" y="${h - 8}" text-anchor="middle">${esc(d.label)}</text>`;
      if (lastLabel && i === data.length - 1 && d.v > 0) s += `<text class="lbl" x="${x + bw / 2}" y="${top - 6}" text-anchor="middle">${esc(fmt(d.v))}</text>`;
    });
    return s + '</svg>';
  }
  function dataTable(head, rows) {
    return `<details class="data"><summary>Vedi i numeri</summary><table><thead><tr>${head.map(h => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.map(r => `<tr>${r.map(c => `<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></details>`;
  }
  const field = (label, inner, hint = '') => `<label class="field"><span>${label}</span>${inner}${hint ? `<small>${hint}</small>` : ''}</label>`;
  const sheetHead = title => `<div class="sheet-head"><h2>${title}</h2><button type="button" class="btn ghost icon" data-act="modal-close" aria-label="Chiudi">✕</button></div>`;

  /* ───────────── modali ───────────── */
  let modalOnClose = null;
  function openModal(html, { wide = false, onClose = null, cls = '' } = {}) {
    closeModal(true);
    const ov = document.createElement('div'); ov.className = 'overlay ' + cls; ov.id = 'modal';
    ov.innerHTML = `<div class="sheet${wide ? ' wide' : ''}" role="dialog" aria-modal="true">${html}</div>`;
    ov.addEventListener('mousedown', e => { if (e.target === ov) closeModal(); });
    document.body.appendChild(ov);
    modalOnClose = onClose;
    const touch = matchMedia('(pointer: coarse)').matches;
    const first = ov.querySelector('[autofocus]');
    if (first && !touch) first.focus();
    return ov;
  }
  function closeModal(silent) {
    const m = $('#modal'); if (!m) return;
    m.remove(); hideTip();
    const f = modalOnClose; modalOnClose = null;
    if (f && !silent) f();
  }
  function ask(msg, okLabel = 'Conferma', danger = false, detail = '') {
    return new Promise(res => {
      openModal(`<div class="sheet-head"><h2>${esc(msg)}</h2></div>${detail ? `<p class="sub">${esc(detail)}</p>` : ''}<div class="sheet-foot"><button type="button" class="btn ghost" data-act="modal-close">Annulla</button><button type="button" class="btn ${danger ? 'danger' : 'key'}" id="ask-ok" autofocus>${esc(okLabel)}</button></div>`, { onClose: () => res(false) });
      $('#ask-ok').onclick = () => { modalOnClose = null; closeModal(); res(true); };
    });
  }

  /* ───────────── rendering ───────────── */
  const VIEWS = {}, A = {}, FORMS = {};
  let view = 'oggi';
  const sub = { todo: 'oggi', casa: 'Tutte', mode: null, label: '', proj: undefined };
  let prevDone = null;

  function render(o = {}) {
    const main = $('#main'); if (!main) return;
    const act = document.activeElement;
    const key = act && act !== document.body && main.contains(act)
      ? (act.id ? '#' + act.id : act.dataset && act.dataset.set ? `[data-set="${act.dataset.set}"]` : null) : null;
    hideTip();
    let html;
    try { html = (VIEWS[view] || VIEWS.oggi)(); }
    catch (e) { console.error(e); html = `<div class="empty">Errore nella vista: ${esc(e.message)}</div>`; }
    main.innerHTML = html;
    renderChrome();
    const np = $('.pad.is-now');
    if (np) { const row = np.closest('.pads'), a = row.getBoundingClientRect(), b = np.getBoundingClientRect(); row.scrollLeft += b.left - a.left - (a.width - b.width) / 2; }
    $$('.hscroll').forEach(el => { el.scrollLeft = el.scrollWidth; });
    const f = o.focus || key;
    if (f) { const el = $(f); if (el && el.focus) el.focus({ preventScroll: true }); }
    tick();
  }
  function go(v) {
    if (!VIEWS[v]) v = 'oggi';
    view = v; closeModal(true);
    if (location.hash !== '#' + v) history.replaceState(null, '', '#' + v);
    render(); window.scrollTo(0, 0);
  }
  function navMeta() {
    const { I, os, score } = X(); const n = now();
    const pc = C.waterPace(S, I, n);
    const ws = mondayOf(I.today); let wk = 0; for (let i = 0; i < 7; i++) wk += (I.workoutsByDay[addDays(ws, i)] || []).length;
    const open = I.live.tasks.filter(t => !t.done && ((t.due && t.due <= I.today) || t.star === I.today)).length;
    const due = I.live.chores.filter(c => C.freshness(I, c, n) <= 0).length;
    return {
      oggi: os.filter(x => x.state === 'done').length + '/' + os.length,
      acqua: Math.round((pc.ml / pc.goal) * 100) + '%', workout: wk + '/' + S.settings.workout.perWeek,
      lavoro: fmtMin(I.focusByDay[I.today] || 0), todo: open || '', progetti: I.live.projects.filter(p => p.status === 'active').length || '',
      casa: due || '', progressi: score && score.score !== null ? score.score : '',
    };
  }
  function renderChrome() {
    const { xp, score, streak } = X(); const meta = navMeta();
    const nav = $('#nav');
    if (nav) nav.innerHTML = C.AREAS.map(a => `<button type="button" class="nav-item" data-act="go" data-v="${a.id}" ${view === a.id ? 'aria-current="page"' : ''}><span class="dot" style="${cv(a.id)}"></span><span>${a.name}</span><span class="nav-meta">${meta[a.id]}</span></button>`).join('')
      + `<button type="button" class="nav-item" data-act="go" data-v="impostazioni" ${view === 'impostazioni' ? 'aria-current="page"' : ''}><span class="dot" style="--c:var(--muted)"></span><span>Impostazioni</span><span class="nav-meta">${termBadge()}</span></button>`;
    const foot = $('#side-foot');
    if (foot) foot.innerHTML = `<div class="level"><div class="row between"><span>Livello <b>${xp.level}</b></span><span class="num">${fmtN(xp.into)} / ${fmtN(xp.need)} XP</span></div>${bar(xp.into / xp.need, 'progressi', '', 'thin')}</div><div class="small muted" id="sync-mini">${esc(syncMini())}</div><div class="small muted">Comandi rapidi <span class="kbd">⌘K</span></div>`;
    const tabs = [['oggi', '☀️', 'Oggi'], ['todo', '✅', 'Da fare'], ['lavoro', '⏱️', 'Lavoro'], ['casa', '🏠', 'Casa'], ['altro', '☰', 'Altro']];
    const main4 = ['oggi', 'todo', 'lavoro', 'casa'];
    const tb = $('#tabbar');
    if (tb) tb.innerHTML = tabs.map(([v, i, l]) => `<button type="button" class="tab" data-act="${v === 'altro' ? 'more' : 'go'}" data-v="${v}" ${view === v || (v === 'altro' && !main4.includes(view)) ? 'aria-current="page"' : ''}><span class="ti" aria-hidden="true">${i}</span>${l}</button>`).join('');
    const tt = $('#top-title'); if (tt) tt.textContent = view === 'impostazioni' ? 'Impostazioni' : (AREA[view] || AREA.oggi).name;
    const ts = $('#top-score');
    if (ts) ts.innerHTML = (streak.current ? `<span class="chip" title="Giorni di fila sopra soglia">🔥 ${streak.current}</span> ` : '') + (score && score.score !== null ? `<span class="chip" title="Punteggio di oggi">${score.score} punti</span>` : '');
    const tg = $('#top-glass'); if (tg) tg.textContent = S.settings.water.glass;
  }

  /* ═════════════ OGGI ═════════════ */
  function topChore() {
    const { I } = X(); const n = now();
    return I.live.chores.slice().sort((a, b) => C.freshness(I, a, n) - C.freshness(I, b, n))[0] || null;
  }
  const stepArea = p => (C.OS_TYPES[p.type] || C.OS_TYPES.custom).area;
  function stepInfo(p) {
    const { I } = X(); const st = S.settings;
    switch (p.type) {
      case 'water': { const pc = C.waterPace(S, I, now()); return { detail: `Sei a ${fmtMl(pc.ml)} su ${fmtMl(pc.goal)}.`, btn: `+${st.water.glass} ml` }; }
      case 'plan': return { detail: 'Fino a 3 attività: la tua lista corta di oggi.', btn: 'Scegli le priorità' };
      case 'focus': {
        const p0 = C.projectOfDay(S, I, I.today);
        const running = S.timer.status !== 'idle';
        return { detail: p0 ? `Progetto del giorno: ${p0.emoji || ''} ${p0.name}.${p0.nextAction ? ' Prossima azione: ' + p0.nextAction : ''}` : 'Nessun progetto attivo: il blocco parte comunque.', btn: running ? 'Vai al timer' : 'Avvia 15 minuti' };
      }
      case 'chore': {
        const c = topChore(); if (!c) return { detail: 'Nessuna faccenda in lista.', btn: 'Apri Casa' };
        const due = C.choreDueIn(I, c, now());
        return { detail: `La più urgente: ${c.name}${due < 0 ? `, in ritardo di ${-due} g` : due === 0 ? ', da fare oggi' : ''}.`, btn: 'Fatta: ' + c.name };
      }
      case 'workout': return { detail: st.workout.plan ? 'Il tuo piano: ' + st.workout.plan : 'Anche 15 minuti contano. Registra cosa fai.', btn: 'Registra workout' };
      case 'review': return { detail: 'Energia, cosa è andato bene, e la prima cosa di domani.', btn: 'Fai la revisione' };
      default: return { detail: p.time ? 'Previsto alle ' + p.time + '.' : '', btn: 'Fatto' };
    }
  }
  function padHTML(p, cur, lit) {
    const area = stepArea(p);
    const cls = p.state === 'done' ? 'is-done' : p.state === 'skip' ? 'is-skip' : cur && cur.id === p.id ? 'is-now' : '';
    const title = p.state === 'done' ? (p.auto ? 'Fatto: registrato automaticamente' : 'Fatto: tocca per annullare') : p.state === 'skip' ? 'Saltato: tocca per ripristinare' : 'Tocca per farlo adesso';
    const stateTxt = p.state === 'done' ? 'fatto' : p.state === 'skip' ? 'saltato' : 'da fare';
    return `<li><button type="button" class="pad ${cls}${lit ? ' lit' : ''}" style="${cv(area)};${onInk(area)}" data-act="pad" data-id="${esc(p.id)}" title="${title}" aria-label="${esc(p.label)}, ${stateTxt}"><span class="led"></span><span class="pe" aria-hidden="true">${esc(p.emoji || '•')}</span><span class="pl">${esc(p.label)}</span><span class="pt">${esc(p.time || '')}</span></button></li>`;
  }
  function freshStartBanner() {
    const { I } = X(); const wk = weekKey(I.today);
    const reviewed = S.weeks[wk] && S.weeks[wk].review && S.weeks[wk].review.v;
    if (reviewed || I.today === I.firstDay) return '';
    const wd = weekdayOf(I.today), dom = parseDK(I.today).getDate();
    if (wd !== 1 && wd !== 2 && dom !== 1) return '';
    return `<div class="banner" style="margin-bottom:16px"><span style="font-size:26px" aria-hidden="true">📅</span><p><b>${dom === 1 ? 'Nuovo mese' : 'Nuova settimana'}: un buon momento per ripartire.</b> La revisione settimanale richiede 5 minuti.</p><button type="button" class="btn key sm" data-act="weekly">Fai la revisione</button></div>`;
  }
  function winsToday() {
    const { I } = X(); const d = I.today; const w = [];
    const ml = I.waterByDay[d] || 0;
    if (ml >= C.waterGoal(S, I, d)) w.push(['💧', 'Obiettivo acqua raggiunto (' + fmtMl(ml) + ')', 'acqua']);
    (I.workoutsByDay[d] || []).forEach(x => w.push([typeOf(x.type).emoji, `Workout: ${typeOf(x.type).name}, ${x.min}′`, 'workout']));
    const fs = I.focusSessionsByDay[d] || [];
    if (fs.length) w.push(['⏱️', `${fs.length} ${fs.length === 1 ? 'blocco' : 'blocchi'} di lavoro, ${fmtMin(I.focusByDay[d])}`, 'lavoro']);
    (I.tasksDoneByDay[d] || []).forEach(t => w.push(['✅', t.title, 'todo']));
    (I.choreDoneByDay[d] || []).forEach(l => { const c = I.live.chores.find(c => c.id === l.choreId); if (c) w.push(['🧽', c.name, 'casa']); });
    (I.milestonesByDay[d] || []).forEach(({ p, m }) => w.push(['🏁', `${m.t} (${p.name})`, 'progetti']));
    return w;
  }
  function tile(area, title, value, body, actions, target) {
    return `<section class="panel tile" style="${cv(area)}"><div class="tile-head"><span class="dot"></span><h2>${title}</h2><button type="button" class="linkbtn" data-act="go" data-v="${target || area}">Apri</button></div>${value}${body}${actions ? `<div class="btns">${actions}</div>` : ''}</section>`;
  }
  function paceText(pc) {
    if (pc.ml >= pc.goal) return 'Obiettivo raggiunto.';
    if (pc.delta >= 0) return pc.expected ? 'In linea con l’orario.' : 'La giornata d’acqua inizia alle ' + S.settings.water.start + '.';
    return `Indietro di ${fmtMl(-pc.delta)} rispetto all’orario.`;
  }
  function tileAcqua() {
    const { I } = X(); const pc = C.waterPace(S, I, now()); const g = S.settings.water.glass;
    return tile('acqua', 'Acqua', `<div class="val">${fmtMl(pc.ml)} <small>di ${fmtMl(pc.goal)}</small></div>`,
      bar(pc.ml / pc.goal, 'acqua', `<b class="pace" style="left:${clamp(pc.expected / pc.goal, 0, 1) * 100}%" title="Dove dovresti essere adesso"></b>`) + `<p class="note">${paceText(pc)}</p>`,
      `<button type="button" class="btn tint sm" data-act="water" data-ml="${g}">+${g} ml</button><button type="button" class="btn tint sm" data-act="water" data-ml="500">+500 ml</button>`);
  }
  function weekWorkouts(I, monday) { let n = 0; for (let i = 0; i < 7; i++) n += (I.workoutsByDay[addDays(monday, i)] || []).length; return n; }
  function tileWorkout() {
    const { I } = X(); const st = S.settings.workout; const n = weekWorkouts(I, mondayOf(I.today));
    const todayDone = (I.workoutsByDay[I.today] || []).length;
    const planned = st.days.includes(weekdayOf(I.today));
    let next = '';
    for (let i = 1; i <= 7; i++) { const d = addDays(I.today, i); if (st.days.includes(weekdayOf(d))) { next = fmtRel(d); break; } }
    const note = todayDone ? 'Fatto oggi. Ottimo.' : planned ? 'Oggi è giorno di workout.' : next ? 'Prossimo previsto: ' + next + '.' : 'Nessun giorno pianificato.';
    return tile('workout', 'Workout', `<div class="val">${n} <small>di ${st.perWeek} questa settimana</small></div>`, bar(n / Math.max(1, st.perWeek), 'workout') + `<p class="note">${note}</p>`,
      `<button type="button" class="btn tint sm" data-act="workout-open">Registra</button><button type="button" class="btn tint sm" data-act="workout-quick" data-id="circuito">♾️ Circuito 20′</button>`);
  }
  function tileLavoro() {
    const { I } = X(); const st = S.settings.work; const m = I.focusByDay[I.today] || 0; const T = S.timer;
    const running = T.status !== 'idle';
    const live = running ? `<p class="note">${T.status === 'break' ? '☕ Pausa' : T.status === 'pause' ? '⏸ In pausa' : '⏱ In corso'}: <b class="num" data-tt>--:--</b>${T.label ? ' · ' + esc(T.label) : ''}</p>` : `<p class="note">${st.days.includes(weekdayOf(I.today)) ? 'Obiettivo di oggi: ' + fmtMin(st.target) + '.' : 'Oggi non è un giorno di lavoro previsto.'}</p>`;
    return tile('lavoro', 'Lavoro', `<div class="val">${fmtMin(m)} <small>di ${fmtMin(st.target)}</small></div>`, bar(m / Math.max(1, st.target), 'lavoro') + live,
      running ? `<button type="button" class="btn tint sm" data-act="go" data-v="lavoro">Vai al timer</button>` : `<button type="button" class="btn tint sm" data-act="focus-quick">Avvia 15′</button>`);
  }
  function tileTodo() {
    const { I } = X();
    const top = I.live.tasks.filter(t => t.star === I.today).sort((a, b) => !!a.done - !!b.done);
    const open = I.live.tasks.filter(t => !t.done && t.due && t.due <= I.today).length;
    const list = top.length ? `<ul class="list">${top.map(t => `<li style="${cv('todo')};${onInk('todo')};padding:8px 0"><button type="button" class="check ${t.done ? 'on' : ''}" data-act="task-toggle" data-id="${t.id}" aria-label="${t.done ? 'Riapri' : 'Completa'}: ${esc(t.title)}">${ICON_CHECK}</button><span class="grow ellip" style="${t.done ? 'text-decoration:line-through;color:var(--muted)' : ''}">${esc(t.title)}</span></li>`).join('')}</ul>` : `<p class="note">Nessuna priorità scelta per oggi.</p>`;
    return tile('todo', 'Priorità di oggi', `<div class="val">${top.filter(t => t.done).length} <small>di ${top.length || 3} fatte</small></div>`,
      list + (open ? `<p class="note">${open} ${open === 1 ? 'attività in scadenza o scaduta' : 'attività in scadenza o scadute'}.</p>` : ''),
      `<button type="button" class="btn tint sm" data-act="top3">${top.length ? 'Cambia priorità' : 'Scegli le priorità'}</button>`, 'todo');
  }
  function tileProgetti() {
    const { I } = X(); const p = C.projectOfDay(S, I, I.today);
    if (!p) return tile('progetti', 'Progetto del giorno', '<div class="val">Nessuno <small>attivo</small></div>', '<p class="note">Aggiungi i tuoi progetti: Ritmo ne sceglie uno al giorno a rotazione.</p>', '<button type="button" class="btn tint sm" data-act="proj-new">Nuovo progetto</button>');
    const ms = p.milestones || [], dn = ms.filter(m => m.done).length;
    return tile('progetti', 'Progetto del giorno', `<div class="val" style="font-size:21px">${esc(p.emoji || '🧭')} ${esc(p.name)}</div>`,
      bar(ms.length ? dn / ms.length : 0, 'progetti') + `<p class="note">${ms.length ? `${dn} di ${ms.length} milestone. ` : ''}${p.nextAction ? 'Prossima azione: <b>' + esc(p.nextAction) + '</b>' : 'Manca la prossima azione.'}</p>`,
      `<button type="button" class="btn tint sm" data-act="proj-focus" data-id="${p.id}">Avvia blocco</button><button type="button" class="btn ghost sm" data-act="potd-pick">Cambia</button>`);
  }
  function tileCasa() {
    const { I } = X(); const n = now(); const ch = I.live.chores;
    if (!ch.length) return tile('casa', 'Casa', '<div class="val">0 <small>faccende</small></div>', '<p class="note">Aggiungi le faccende ricorrenti in Casa.</p>', '');
    const fresh = ch.filter(c => C.freshness(I, c, n) > 0).length; const c = topChore(); const due = C.choreDueIn(I, c, n);
    return tile('casa', 'Casa', `<div class="val">${Math.round((fresh / ch.length) * 100)}% <small>in ordine</small></div>`,
      bar(fresh / ch.length, 'casa') + `<p class="note">Più urgente: <b>${esc(c.name)}</b>${due < 0 ? `, in ritardo di ${-due} g` : due === 0 ? ', oggi' : due === 1 ? ', domani' : `, tra ${due} g`}.</p>`,
      `<button type="button" class="btn tint sm" data-act="chore-done" data-id="${c.id}">Fatta</button>`);
  }
  VIEWS.oggi = () => {
    const { I, os, score, streak, xp } = X(); const st = S.settings;
    const done = os.filter(x => x.state === 'done').length;
    const cur = os.find(x => x.state === 'todo');
    const doneSet = new Set(os.filter(x => x.state === 'done').map(x => x.id));
    const lit = prevDone && prevDone.day === I.today ? new Set([...doneSet].filter(id => !prevDone.set.has(id))) : new Set();
    prevDone = { day: I.today, set: doneSet };
    const hr = new Date().getHours();
    const greet = hr < 5 ? 'Buonanotte' : hr < 12 ? 'Buongiorno' : hr < 18 ? 'Buon pomeriggio' : 'Buonasera';
    const sc = score && score.score !== null ? score.score : 0;
    let h = `<div class="today-head"><div><h1 class="h1">${greet}${st.name ? ', ' + esc(st.name) : ''}</h1><p class="sub">${fmtDateLong(I.today)}. ${done} passi su ${os.length} completati.</p></div>
      <div class="head-stats"><div class="mini-stat"><b>🔥 ${streak.current}</b><span>giorni di fila</span></div><div class="mini-stat"><b>${xp.today}</b><span>XP oggi</span></div>${ring(sc / 100, { size: 78, stroke: 9, area: 'progressi', label: sc, sub: 'punti' })}</div></div>`;
    h += freshStartBanner();
    h += `<section class="panel seq" aria-label="Il ritmo di oggi"><div class="panel-head"><h2>Il ritmo di oggi</h2><button type="button" class="linkbtn small" data-act="go" data-v="impostazioni">Modifica i passi</button></div>`;
    h += os.length ? `<ol class="pads">${os.map(p => padHTML(p, cur, lit.has(p.id))).join('')}</ol>` : '<p class="empty">Nessun passo: aggiungili nelle impostazioni.</p>';
    if (cur) {
      const area = stepArea(cur), info = stepInfo(cur);
      h += `<div class="now" style="${cv(area)}"><span class="ne" aria-hidden="true">${esc(cur.emoji || '•')}</span><div class="grow"><h2>Adesso: ${esc(cur.label)}</h2><p>${esc(info.detail)}</p></div><div class="btns"><button type="button" class="btn ghost" data-act="pad-skip" data-id="${esc(cur.id)}">Salta</button><button type="button" class="btn key" data-act="pad" data-id="${esc(cur.id)}">${esc(info.btn)}</button></div></div>`;
    } else if (os.length) {
      h += `<div class="now" style="--c:var(--good)"><span class="ne" aria-hidden="true">🏁</span><div class="grow"><h2>Ritmo completato</h2><p>Tutti i passi di oggi sono chiusi. Punteggio attuale: ${sc}.</p></div></div>`;
    }
    h += '</section>';
    h += `<div class="tiles" style="margin-top:16px">${tileAcqua()}${tileWorkout()}${tileLavoro()}${tileTodo()}${tileProgetti()}${tileCasa()}${customTiles()}</div>`;
    const wins = winsToday();
    const energy = dayVal(I.today, 'energy');
    h += `<div class="cols" style="margin-top:16px">
      <section class="panel"><div class="panel-head"><h2>Vittorie di oggi</h2><span class="muted small">${wins.length}</span></div>${wins.length ? `<ul class="list">${wins.slice(0, 12).map(([e, t, a]) => `<li style="padding:8px 0"><span class="dot" style="${cv(a)}"></span><span aria-hidden="true">${e}</span><span class="grow ellip">${esc(t)}</span></li>`).join('')}</ul>` : '<p class="empty">Ancora niente: la prima vittoria è quella più piccola. Un bicchiere d’acqua vale.</p>'}</section>
      <section class="panel"><div class="panel-head"><h2>Scarica la testa</h2><span class="muted small">va nella Inbox</span></div>
        <form id="cap-form" class="row" autocomplete="off"><label class="sr" for="cap">Nuova nota o attività</label><input class="inp grow" id="cap" placeholder="Un pensiero, un’idea, una cosa da fare" enterkeyhint="done"><button class="btn key">Salva</button></form>
        <hr class="sep"><div class="field"><span>Energia adesso</span><div class="scale">${['😴', '😕', '😐', '🙂', '⚡'].map((e, i) => `<button type="button" data-act="energy" data-v="${i + 1}" aria-pressed="${energy === i + 1}" aria-label="Energia ${i + 1} su 5">${e}</button>`).join('')}</div></div>
      </section></div>`;
    return h;
  };
  A.pad = el => {
    const { os, I } = X(); const p = os.find(x => x.id === el.dataset.id); if (!p) return;
    if (p.state === 'done') {
      if (p.auto) { toast('Si è acceso da solo: hai già registrato ' + (C.OS_TYPES[p.type] || {}).name.toLowerCase() + '.'); return; }
      commit(() => setOS(I.today, p.id, null)); return;
    }
    if (p.state === 'skip') { commit(() => setOS(I.today, p.id, null)); return; }
    runStep(p);
  };
  A['pad-skip'] = el => commit(() => setOS(X().I.today, el.dataset.id, 'skip'));
  function runStep(p) {
    switch (p.type) {
      case 'water': return A.water(null, S.settings.water.glass);
      case 'plan': return openTop3();
      case 'focus': if (S.timer.status === 'idle') startFocus({}); return go('lavoro');
      case 'chore': { const c = topChore(); return c ? doneChore(c.id) : go('casa'); }
      case 'workout': return openWorkout();
      case 'review': return openReview();
      default: beep(); return commit(() => setOS(X().I.today, p.id, 'done'), { xp: 3 });
    }
  }
  A.energy = el => { const v = +el.dataset.v; commit(() => setDay(X().I.today, 'energy', dayVal(X().I.today, 'energy') === v ? null : v)); };
  FORMS['cap-form'] = f => {
    const inp = $('#cap', f); const text = inp.value.trim(); if (!text) return;
    const t = addTaskFromText(text, { render: false });
    if (t) toast('Salvato in Inbox: ' + t.title);
    render({ focus: '#cap' });
  };

  /* ═════════════ ACQUA ═════════════ */
  A.water = (el, mlArg) => {
    const ml = Math.round(+mlArg || +(el && el.dataset.ml) || S.settings.water.glass);
    if (!(ml > 0 && ml < 5000)) return;
    const { I } = X(); const before = I.waterByDay[I.today] || 0, goal = C.waterGoal(S, I, I.today);
    const rec = { id: uid('w'), ts: now(), ml, u: now() };
    commit(() => S.water.push(rec), { xp: Math.max(1, Math.floor(ml / 250)) });
    beep();
    if (before < goal && before + ml >= goal) { confetti(); beep('goal'); toast('💧 Obiettivo acqua raggiunto!'); }
    else toast(`+${ml} ml d’acqua`, '', { label: 'Annulla', fn: () => commit(() => tomb(S.water, rec.id)) });
  };
  A['water-del'] = el => commit(() => tomb(S.water, el.dataset.id));
  A['water-undo'] = () => {
    const { I } = X(); const last = I.live.water.filter(w => dayKey(w.ts, I.sh) === I.today).sort((a, b) => b.ts - a.ts)[0];
    if (last) commit(() => tomb(S.water, last.id)); else toast('Niente da annullare oggi.');
  };
  A['water-custom'] = () => openModal(`<form id="water-form" class="form">${sheetHead('Quantità personalizzata')}${field('Millilitri', '<input class="inp" name="ml" type="number" inputmode="numeric" min="10" max="3000" step="10" value="200" autofocus>')}<div class="sheet-foot"><button type="button" class="btn ghost" data-act="modal-close">Annulla</button><button class="btn key">Aggiungi</button></div></form>`);
  FORMS['water-form'] = (f, fd) => { closeModal(); A.water(null, +fd.get('ml')); };
  VIEWS.acqua = () => {
    const { I } = X(); const st = S.settings.water; const pc = C.waterPace(S, I, now());
    const logs = I.live.water.filter(w => dayKey(w.ts, I.sh) === I.today).sort((a, b) => b.ts - a.ts);
    const days = [...Array(14)].map((_, i) => addDays(I.today, i - 13));
    const data = days.map((d, i) => { const v = I.waterByDay[d] || 0, g = C.waterGoal(S, I, d); return { v, label: i % 2 === 1 ? String(parseDK(d).getDate()) : '', tip: `${cap(fmtRel(d))}: ${fmtMl(v)} su ${fmtMl(g)}`, d, g }; });
    const hit = data.filter(x => x.v >= x.g).length;
    return `<div class="view-head"><h1 class="h1"><span class="dot" style="${cv('acqua')}"></span>Acqua</h1></div>
    <div class="stack">
      <section class="panel" style="${cv('acqua')}">
        <div class="row between" style="align-items:flex-end"><div><div class="val" style="font-size:48px;font-weight:800;letter-spacing:-.03em;line-height:1">${fmtMl(pc.ml)} <small style="font-size:18px;color:var(--muted);font-weight:650;letter-spacing:0">di ${fmtMl(pc.goal)}</small></div><p class="sub" style="margin-top:8px">${paceText(pc)} ${pc.ml < pc.goal ? 'A quest’ora l’ideale è circa ' + fmtMl(pc.expected) + '.' : ''}</p></div>${ring(pc.ml / pc.goal, { size: 72, stroke: 9, area: 'acqua', label: Math.round((pc.ml / pc.goal) * 100) + '%' })}</div>
        <div style="margin:18px 0 18px">${bar(pc.ml / pc.goal, 'acqua', `<b class="pace" style="left:${clamp(pc.expected / pc.goal, 0, 1) * 100}%" title="Dove dovresti essere adesso"></b>`, 'big')}</div>
        <div class="btns">${st.sizes.map(ml => `<button type="button" class="btn tint" data-act="water" data-ml="${ml}">+${ml} ml</button>`).join('')}<button type="button" class="btn ghost" data-act="water-custom">Altra quantità</button></div>
        <p class="small muted" style="margin-top:14px">Obiettivo: ${fmtMl(st.goal)} da bere, +${fmtMl(st.bonus)} nei giorni di workout. Per riferimento, l’EFSA indica circa 2,5 L di acqua totale al giorno per un uomo adulto, inclusa quella dei cibi. La barretta nera segna dove dovresti essere a quest’ora (${st.start}–${st.end}).</p>
      </section>
      <div class="cols">
        <section class="panel"><div class="panel-head"><h2>Oggi</h2>${logs.length ? '<button type="button" class="btn sm ghost" data-act="water-undo">Annulla l’ultimo</button>' : ''}</div>
          ${logs.length ? `<ul class="list">${logs.map(w => `<li><span class="dot" style="${cv('acqua')}"></span><span class="num muted">${fmtTime(w.ts)}</span><span class="grow"><b>${fmtN(w.ml)} ml</b></span><button type="button" class="btn sm icon ghost" data-act="water-del" data-id="${w.id}" aria-label="Elimina ${w.ml} ml delle ${fmtTime(w.ts)}">✕</button></li>`).join('')}</ul>` : '<p class="empty">Nessun bicchiere registrato oggi. Il primo è il più facile.</p>'}
        </section>
        <section class="panel"><div class="panel-head"><h2>Ultimi 14 giorni</h2><span class="muted small">obiettivo raggiunto ${hit} volte</span></div>
          ${barChart({ data, color: 'var(--acqua)', goal: st.goal, fmt: v => (v >= 1000 ? NF2.format(v / 1000) + ' L' : fmtN(v)), label: 'Acqua bevuta negli ultimi 14 giorni' })}
          ${dataTable(['Giorno', 'Bevuta', 'Obiettivo'], data.slice().reverse().map(x => [fmtRel(x.d), fmtMl(x.v), fmtMl(x.g)]))}
        </section>
      </div>
      ${planPanel('water.plan', 'acqua', 'Quando prendo il caffè o mi siedo alla scrivania, allora bevo un bicchiere d’acqua.')}
    </div>`;
  };
  function planPanel(path, area, example) {
    return `<section class="panel" style="${cv(area)}"><div class="panel-head"><h2>Piano “se… allora”</h2></div>
      <p class="sub small" style="margin-bottom:10px">Collega l’azione a un momento preciso della giornata. È una delle tecniche con più prove a favore (meta-analisi Gollwitzer e Sheeran, 94 studi, effetto d = 0,65).</p>
      <label class="sr" for="plan-${area}">Piano se allora</label><input class="inp" id="plan-${area}" data-set="${path}" value="${esc(getPath(S.settings, path) || '')}" placeholder="Es. ${esc(example)}"></section>`;
  }

  /* ═════════════ WORKOUT ═════════════ */
  let woDraft = null;
  function openWorkout(typeId = 'circuito') {
    const t = typeOf(typeId);
    woDraft = { type: t.id, groups: (t.groups || []).slice() };
    renderWorkoutModal(t.min || 20, t.rpe || 6, now(), '');
  }
  function renderWorkoutModal(min, rpe, ts, note) {
    openModal(`<form id="wo-form" class="form">${sheetHead('Registra workout')}
      <div class="field"><span>Tipo</span><div class="seg" role="group" aria-label="Tipo di workout">${C.WORKOUT_TYPES.map(t => `<button type="button" data-act="wo-type" data-id="${t.id}" aria-pressed="${woDraft.type === t.id}">${t.emoji} ${t.name}</button>`).join('')}</div></div>
      <div class="form-2">${field('Durata in minuti', `<input class="inp" name="min" type="number" inputmode="numeric" min="1" max="600" value="${min}">`)}${field('Quando', `<input class="inp" name="when" type="datetime-local" value="${localInput(ts)}">`)}</div>
      ${field(`Intensità percepita (RPE): <b id="rpe-v">${rpe}</b> su 10`, `<input name="rpe" type="range" min="1" max="10" value="${rpe}" data-out="rpe-v" style="width:100%">`, '1 riposo, 5 moderato, 7-8 impegnativo, 10 massimo sforzo')}
      <div class="field"><span>Gruppi allenati</span><div class="wd" style="${cv('workout')}">${C.MUSCLES.map(g => `<button type="button" style="width:auto;padding:0 12px" data-act="wo-group" data-g="${g}" aria-pressed="${woDraft.groups.includes(g)}">${g}</button>`).join('')}</div></div>
      ${field('Note', `<input class="inp" name="note" value="${esc(note)}" placeholder="Es. 4 giri, flessioni lente">`)}
      <div class="sheet-foot"><button type="button" class="btn ghost" data-act="modal-close">Annulla</button><button class="btn key">Salva workout</button></div></form>`);
  }
  A['workout-open'] = el => openWorkout(el && el.dataset.id);
  A['wo-type'] = el => {
    const f = $('#wo-form'); const t = typeOf(el.dataset.id); const fd = new FormData(f);
    woDraft = { type: t.id, groups: (t.groups || []).slice() };
    renderWorkoutModal(t.min, t.rpe, new Date(fd.get('when')).getTime() || now(), fd.get('note') || '');
  };
  A['wo-group'] = el => {
    const g = el.dataset.g; const i = woDraft.groups.indexOf(g);
    if (i >= 0) woDraft.groups.splice(i, 1); else woDraft.groups.push(g);
    el.setAttribute('aria-pressed', i < 0);
  };
  FORMS['wo-form'] = (f, fd) => {
    const min = clamp(Math.round(+fd.get('min') || 0), 1, 600), ts = new Date(fd.get('when')).getTime() || now();
    logWorkout({ type: woDraft.type, min, rpe: +fd.get('rpe') || 6, groups: woDraft.groups.slice(), note: String(fd.get('note') || '').trim(), ts });
    closeModal();
  };
  function logWorkout(w) {
    const { I } = X(); const st = S.settings.workout;
    const before = weekWorkouts(I, mondayOf(I.today));
    const rec = { id: uid('k'), ...w, u: now() };
    commit(() => S.workouts.push(rec), { xp: 25 });
    beep();
    const after = weekWorkouts(X().I, mondayOf(X().I.today));
    if (before < st.perWeek && after >= st.perWeek) { confetti(); toast('🏋️ Obiettivo settimanale raggiunto!'); }
    else toast(`Workout salvato: ${typeOf(w.type).name}, ${w.min}′`, '', { label: 'Annulla', fn: () => commit(() => tomb(S.workouts, rec.id)) });
  }
  A['workout-quick'] = el => { const t = typeOf(el.dataset.id); logWorkout({ type: t.id, min: t.min, rpe: t.rpe, groups: t.groups.slice(), note: '', ts: now() }); };
  A['workout-del'] = async el => { if (await ask('Eliminare questo workout?', 'Elimina', true)) commit(() => tomb(S.workouts, el.dataset.id)); };
  VIEWS.workout = () => {
    const { I } = X(); const st = S.settings.workout; const n = now();
    const ws = mondayOf(I.today); const week = [...Array(7)].map((_, i) => addDays(ws, i));
    const count = weekWorkouts(I, ws);
    // serie di settimane con obiettivo raggiunto
    let wstreak = 0; let m = addDays(ws, -7);
    if (count >= st.perWeek) wstreak = 1;
    while (weekWorkouts(I, m) >= st.perWeek && m >= mondayOf(I.firstDay)) { wstreak++; m = addDays(m, -7); }
    const strip = week.map(d => { const done = (I.workoutsByDay[d] || []).length; const plan = st.days.includes(weekdayOf(d)); return `<div class="wk ${done ? 'done' : plan ? 'plan' : ''} ${d === I.today ? 'today' : ''}" title="${esc(fmtDateLong(d))}${done ? ': fatto' : plan ? ': previsto' : ''}"><span>${WD_LETTER[weekdayOf(d)]}</span><b>${parseDK(d).getDate()}</b></div>`; }).join('');
    const cov = C.muscleCoverage(I, n);
    const weeks = [...Array(12)].map((_, i) => addDays(ws, (i - 11) * 7));
    const wdata = weeks.map((w, i) => { const v = weekWorkouts(I, w); return { v, label: i % 3 === 2 ? parseDK(w).getDate() + ' ' + MON_SHORT[parseDK(w).getMonth()] : '', tip: `Settimana del ${parseDK(w).getDate()} ${MON_SHORT[parseDK(w).getMonth()]}: ${v} su ${st.perWeek}`, w }; });
    const hist = I.live.workouts.slice().sort((a, b) => b.ts - a.ts).slice(0, 12);
    return `<div class="view-head"><h1 class="h1"><span class="dot" style="${cv('workout')}"></span>Workout</h1><div class="btns"><button type="button" class="btn key" data-act="workout-open">Registra workout</button></div></div>
    <div class="stack">
      <section class="panel" style="${cv('workout')}">
        <div class="row between" style="margin-bottom:14px"><div><div class="val" style="font-size:40px;font-weight:800;letter-spacing:-.03em;line-height:1">${count} <small style="font-size:17px;color:var(--muted);font-weight:650;letter-spacing:0">di ${st.perWeek} questa settimana</small></div><p class="sub" style="margin-top:6px">${wstreak ? `${wstreak} ${wstreak === 1 ? 'settimana' : 'settimane'} di fila con l’obiettivo raggiunto.` : 'Riquadri con bordo: giorni previsti. Pieni: fatti.'}</p></div></div>
        <div class="week-strip">${strip}</div>
        <div class="btns" style="margin-top:16px">${C.WORKOUT_TYPES.slice(0, 4).map(t => `<button type="button" class="btn tint sm" data-act="${t.id === 'circuito' ? 'workout-quick' : 'workout-open'}" data-id="${t.id}">${t.emoji} ${t.name}${t.id === 'circuito' ? ' ' + t.min + '′' : ''}</button>`).join('')}</div>
      </section>
      <div class="cols">
        <section class="panel"><div class="panel-head"><h2>Copertura muscolare</h2><span class="muted small">ultimo allenamento</span></div>
          ${cov.map(c => { const pct = c.days === null ? 0 : clamp(1 - c.days / 10, 0, 1); const late = c.days === null || c.days > 7; return `<div class="hbar"><span>${c.g}</span>${bar(pct, 'workout')}<span class="v">${late ? `<span class="chip st-crit">${c.days === null ? 'mai' : c.days + ' g'}</span>` : c.days === 0 ? 'oggi' : c.days + ' g fa'}</span></div>`; }).join('')}
          <p class="small muted" style="margin-top:10px">Barra piena: allenato da poco. Il segno rosso indica più di 7 giorni senza stimolo.</p>
        </section>
        <section class="panel"><div class="panel-head"><h2>Ultime 12 settimane</h2></div>
          ${barChart({ data: wdata, color: 'var(--workout)', goal: st.perWeek, fmt: v => String(Math.round(v * 10) / 10).replace('.', ','), label: 'Workout per settimana' })}
          ${dataTable(['Settimana', 'Workout'], wdata.slice().reverse().map(x => [parseDK(x.w).getDate() + ' ' + MON_SHORT[parseDK(x.w).getMonth()], x.v + ' su ' + st.perWeek]))}
        </section>
      </div>
      <section class="panel"><div class="panel-head"><h2>Storico</h2></div>
        ${hist.length ? `<ul class="list">${hist.map(w => `<li><span aria-hidden="true" style="font-size:20px">${typeOf(w.type).emoji}</span><div class="grow"><div><b>${esc(typeOf(w.type).name)}</b> <span class="muted">${w.min}′, RPE ${w.rpe || '–'}</span></div><div class="small muted ellip">${esc(fmtRel(dayKey(w.ts, I.sh)))} alle ${fmtTime(w.ts)}${(w.groups || []).length ? '. ' + esc(w.groups.join(', ')) : ''}${w.note ? '. ' + esc(w.note) : ''}</div></div><button type="button" class="btn sm icon ghost" data-act="workout-del" data-id="${w.id}" aria-label="Elimina workout">✕</button></li>`).join('')}</ul>` : '<p class="empty">Nessun workout ancora. Il circuito da 20 minuti si registra con un tocco.</p>'}
      </section>
      ${planPanel('workout.plan', 'workout', 'Quando chiudo il portatile alle 18, allora faccio il circuito in camera.')}
    </div>`;
  };
