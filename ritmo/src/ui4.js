  /* ═════════════ Ritmo · parte 4: terminale, cartella dati, tracker personalizzati, widget ═════════════ */

  /* ───────────── TERMINALE: cattura log ed errori ───────────── */
  const TERM = { lines: (store.get('ritmo.log', []) || []).slice(-200), unread: 0, hist: [], hi: 0 };
  function log(lv, src, ...parts) {
    const msg = parts.map(p => (typeof p === 'string' ? p : p instanceof Error ? (p.stack || p.message) : (() => { try { return JSON.stringify(p); } catch (e) { return String(p); } })())).join(' ');
    const line = { t: Date.now(), lv, src, msg: msg.slice(0, 4000) };
    TERM.lines.push(line); if (TERM.lines.length > 500) TERM.lines.splice(0, TERM.lines.length - 500);
    if (lv === 'error') TERM.unread++;
    clearTimeout(TERM.save); TERM.save = setTimeout(() => { store.set('ritmo.log', TERM.lines.slice(-200)); Folder.writeLog(); }, 1500);
    const box = $('#term-out'); if (box) { box.insertAdjacentHTML('beforeend', termLine(line)); box.scrollTop = box.scrollHeight; }
  }
  ['log', 'info', 'warn', 'error'].forEach(k => {
    const orig = console[k].bind(console);
    console[k] = (...a) => { orig(...a); try { log(k === 'log' ? 'info' : k, 'console', ...a); } catch (e) { /* nulla */ } };
  });
  window.addEventListener('error', e => log('error', 'js', (e.message || 'Errore') + (e.filename ? ` (${e.filename.split('/').pop()}:${e.lineno}:${e.colno})` : ''), e.error && e.error.stack ? '\n' + e.error.stack : ''));
  window.addEventListener('unhandledrejection', e => log('error', 'promise', e.reason || 'Promise rifiutata'));
  const termBadge = () => (TERM.unread ? '⚠ ' + TERM.unread : '');
  function termLine(l) {
    const d = new Date(l.t);
    return `<div class="tl ${l.lv}"><span class="tt">${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}</span><span class="ts">${esc(l.src)}</span><span class="tm">${esc(l.msg)}</span></div>`;
  }
  function openTerminal() {
    TERM.unread = 0; renderChrome();
    openModal(`<div class="term" role="dialog" aria-label="Terminale">
      <div class="term-head"><b>Terminale</b><span class="muted small">scrivi <code>aiuto</code></span><span class="grow"></span>
        <button type="button" class="btn sm ghost" data-act="term-copy">Copia</button><button type="button" class="btn sm ghost" data-act="term-clear">Pulisci</button><button type="button" class="btn sm ghost" data-act="modal-close" aria-label="Chiudi">✕</button></div>
      <div class="term-out" id="term-out">${TERM.lines.map(termLine).join('')}</div>
      <form id="term-form" class="term-in" autocomplete="off"><span aria-hidden="true">ritmo ›</span><input id="term-cmd" spellcheck="false" autocapitalize="off" aria-label="Comando" autofocus></form></div>`, { wide: true, cls: 'term-ov' });
    const out = $('#term-out'); out.scrollTop = out.scrollHeight;
    const inp = $('#term-cmd'); inp.focus();
    inp.addEventListener('keydown', e => {
      if (e.key === 'ArrowUp' && TERM.hist.length) { TERM.hi = Math.max(0, TERM.hi - 1); inp.value = TERM.hist[TERM.hi] || ''; e.preventDefault(); }
      if (e.key === 'ArrowDown' && TERM.hist.length) { TERM.hi = Math.min(TERM.hist.length, TERM.hi + 1); inp.value = TERM.hist[TERM.hi] || ''; e.preventDefault(); }
    });
  }
  A.terminal = () => openTerminal();
  A['term-clear'] = () => { TERM.lines = []; store.set('ritmo.log', []); const o = $('#term-out'); if (o) o.innerHTML = ''; };
  A['term-copy'] = async () => { const txt = TERM.lines.map(l => `${new Date(l.t).toISOString()} [${l.lv}] ${l.src}: ${l.msg}`).join('\n'); try { await navigator.clipboard.writeText(txt); toast('Log copiato'); } catch (e) { toast('Copia non riuscita', 'warn'); } };
  const TERM_HELP = `Comandi:
  aiuto            questo elenco
  stato            versione, dati, sync, cartella, widget
  errori           solo gli errori
  sync             sincronizza ora
  cartella         scrive i file e legge inbox e widget
  widget           elenca i widget e i loro errori
  dati <nome>      ultimi elementi (water, tasks, focus, logs…)
  esporta          scarica il backup JSON
  pulisci          svuota il terminale
Qualsiasi altra cosa viene eseguita come JavaScript.
Esempi: Ritmo.state.settings · Ritmo.api.series(7) · Ritmo.api.add.water(250)`;
  FORMS['term-form'] = async f => {
    const inp = $('#term-cmd', f); const cmd = inp.value.trim(); inp.value = ''; if (!cmd) return;
    TERM.hist.push(cmd); TERM.hi = TERM.hist.length;
    log('cmd', '›', cmd);
    const [c0, ...rest] = cmd.split(/\s+/); const c = c0.toLowerCase();
    try {
      if (c === 'aiuto' || c === 'help') log('info', 'aiuto', TERM_HELP);
      else if (c === 'pulisci' || c === 'clear') A['term-clear']();
      else if (c === 'errori') TERM.lines.filter(l => l.lv === 'error').slice(-30).forEach(l => log('info', 'errore', new Date(l.t).toLocaleString('it-IT') + ' ' + l.src + ': ' + l.msg));
      else if (c === 'stato') {
        const { I } = X(); const size = (localStorage.getItem(LS.data) || '').length;
        log('info', 'stato', `Ritmo ${VERSION}\nDati: ${C.COLLECTIONS.map(k => k + ' ' + I.live[k].length).join(', ')}\nSpazio usato: ${Math.round(size / 1024)} KB\nSync: ${syncMini()}\nCartella: ${Folder.label()}\nWidget: ${I.live.widgets.length} (${Object.values(WIDGETS.err).filter(Boolean).length} con errori)\nBrowser: ${navigator.userAgent}`);
      } else if (c === 'sync') { await Sync.run(); log(Sync.err ? 'error' : 'ok', 'sync', Sync.err || 'sincronizzato'); }
      else if (c === 'cartella') { await Folder.cycle(true); log('ok', 'cartella', Folder.label()); }
      else if (c === 'widget' || c === 'widgets') { const ws = X().I.live.widgets; if (!ws.length) log('info', 'widget', 'Nessun widget.'); ws.forEach(w => log(WIDGETS.err[w.id] ? 'error' : 'info', 'widget', `${w.name} [${w.src || 'editor'}${w.enabled === false ? ', spento' : ''}]${WIDGETS.err[w.id] ? ': ' + WIDGETS.err[w.id] : ''}`)); }
      else if (c === 'dati') { const k = rest[0]; if (!k || !X().I.live[k]) log('info', 'dati', 'Collezioni: ' + C.COLLECTIONS.join(', ')); else log('info', 'dati', X().I.live[k].slice(-5)); }
      else if (c === 'esporta') exportJSON();
      else { const r = await (0, eval)(cmd); log('ok', '=', r === undefined ? 'undefined' : r); }
    } catch (e) { log('error', 'eval', e && e.message ? e.message : String(e)); }
  };

  /* ───────────── CARTELLA DATI (File System Access, Chrome/Edge sul Mac) ───────────── */
  const idb = {
    open() { return new Promise((res, rej) => { const r = indexedDB.open('ritmo', 1); r.onupgradeneeded = () => r.result.createObjectStore('kv'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }); },
    async get(k) { const db = await this.open(); return new Promise(res => { const q = db.transaction('kv').objectStore('kv').get(k); q.onsuccess = () => res(q.result); q.onerror = () => res(null); }); },
    async set(k, v) { const db = await this.open(); return new Promise(res => { const t = db.transaction('kv', 'readwrite'); t.objectStore('kv').put(v, k); t.oncomplete = () => res(true); t.onerror = () => res(false); }); },
    async del(k) { const db = await this.open(); return new Promise(res => { const t = db.transaction('kv', 'readwrite'); t.objectStore('kv').delete(k); t.oncomplete = () => res(true); }); },
  };
  const EXAMPLE_WIDGET = `// Widget di esempio. Modificalo o copialo: ogni file .js in questa cartella diventa un riquadro in Oggi.
// Ritmo.widget({ title, area, size, render(api) => HTML, azioni: { nome(api) {} } })
// area: acqua, workout, lavoro, todo, progetti, casa, progressi · size: 1 o 2 colonne
Ritmo.widget({
  title: 'Acqua, ultimi 7 giorni',
  area: 'acqua',
  render(api) {
    const giorni = api.series(7);
    const media = giorni.reduce((a, g) => a + g.acqua, 0) / giorni.length;
    const ok = giorni.filter(g => g.acqua >= g.obiettivoAcqua).length;
    return \`<div class="val">\${api.ui.fmtMl(media)} <small>di media, obiettivo \${ok}/7</small></div>\`
      + api.ui.chart(giorni.map(g => ({ v: g.acqua, label: g.label, tip: g.data + ': ' + g.acqua + ' ml' })), 'var(--acqua)', api.settings.water.goal)
      + '<div class="btns"><button class="btn tint sm" data-wact="bevi">+250 ml</button></div>';
  },
  azioni: { bevi(api) { api.add.water(250); } },
});
`;
  const Folder = {
    dir: null, state: 'off', last: 0, lastScan: 0, written: {}, timer: null, busy: false,
    supported: () => typeof window.showDirectoryPicker === 'function',
    label() { return this.state === 'on' ? `collegata a “${this.dir.name}”${this.last ? ', scritta alle ' + fmtTime(this.last) : ''}` : this.state === 'perm' ? 'serve riattivare il permesso' : this.supported() ? 'non collegata' : 'non disponibile in questo browser (serve Chrome o Edge)'; },
    async sub(path, create = true) { let d = this.dir; for (const p of path.split('/').filter(Boolean)) d = await d.getDirectoryHandle(p, { create }); return d; },
    async writeFile(path, text) {
      const parts = path.split('/'); const name = parts.pop(); const d = await this.sub(parts.join('/'));
      const fh = await d.getFileHandle(name, { create: true }); const w = await fh.createWritable(); await w.write(text); await w.close();
    },
    async attach(handle, isNew) {
      this.dir = handle; this.state = 'on'; this.written = {};
      await idb.set('folder', handle);
      for (const p of ['dati', 'inbox/elaborati', 'widgets', 'log']) await this.sub(p);
      if (isNew) {
        const wd = await this.sub('widgets'); let empty = true;
        for await (const e of wd.values()) { if (e.kind === 'file') { empty = false; break; } }
        if (empty) await this.writeFile('widgets/esempio-acqua-7-giorni.js', EXAMPLE_WIDGET);
        const ib = await this.sub('inbox'); let has = false; for await (const e of ib.values()) { if (e.name === 'LEGGIMI.txt') has = true; }
        if (!has) await this.writeFile('inbox/LEGGIMI.txt', 'Lascia qui file .md, .txt o .json: Ritmo li legge e li sposta in elaborati/. Formati in ../LEGGIMI.md\n');
      }
      log('ok', 'cartella', 'collegata: ' + handle.name);
      await this.cycle(true);
    },
    async restore() {
      if (!this.supported()) return;
      try {
        const h = window.__RITMO_TEST_DIR || await idb.get('folder'); if (!h) return;
        const p = h.queryPermission ? await h.queryPermission({ mode: 'readwrite' }) : 'granted';
        if (p === 'granted') await this.attach(h, false); else { this.dir = h; this.state = 'perm'; log('warn', 'cartella', 'permesso da riattivare in Impostazioni'); }
      } catch (e) { log('error', 'cartella', e); }
    },
    schedule() { if (this.state !== 'on') return; clearTimeout(this.timer); this.timer = setTimeout(() => this.write(), 1500); },
    async write() {
      if (this.state !== 'on' || this.busy) return; this.busy = true;
      try {
        const files = C.buildFolder(S, now()); let n = 0;
        for (const [path, text] of Object.entries(files)) { if (this.written[path] === text) continue; await this.writeFile(path, text); this.written[path] = text; n++; }
        this.last = now(); if (n) log('info', 'cartella', n + (n === 1 ? ' file aggiornato' : ' file aggiornati'));
      } catch (e) { this.fail(e); } finally { this.busy = false; }
    },
    async writeLog() {
      if (this.state !== 'on') return;
      try { await this.writeFile('log/ritmo.log', TERM.lines.map(l => `${new Date(l.t).toISOString()} [${l.lv}] ${l.src}: ${l.msg}`).join('\n') + '\n'); } catch (e) { /* evita ricorsione */ }
    },
    fail(e) {
      if (e && (e.name === 'NotAllowedError' || e.name === 'SecurityError')) { this.state = 'perm'; log('warn', 'cartella', 'permesso perso: riattivalo in Impostazioni'); }
      else if (e && e.name === 'NotFoundError') { this.state = 'off'; log('error', 'cartella', 'cartella non trovata: è stata spostata o cancellata?'); }
      else log('error', 'cartella', e);
      if (view === 'impostazioni') render();
    },
    async scanInbox() {
      const ib = await this.sub('inbox'); const done = await this.sub('inbox/elaborati'); const files = [];
      for await (const e of ib.values()) if (e.kind === 'file' && !e.name.startsWith('.') && e.name !== 'LEGGIMI.txt') files.push(e);
      for (const fh of files) {
        const text = await (await fh.getFile()).text();
        const r = C.parseInbox(fh.name, text);
        r.errors.forEach(er => log('error', 'inbox', er));
        if (r.actions.length) { applyActions(r.actions, fh.name); log('ok', 'inbox', `${fh.name}: ${r.actions.length} ${r.actions.length === 1 ? 'azione applicata' : 'azioni applicate'}`); }
        const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        const out = await done.getFileHandle(stamp + '_' + fh.name, { create: true }); const w = await out.createWritable(); await w.write(text); await w.close();
        await ib.removeEntry(fh.name);
      }
    },
    async scanWidgets() {
      const wd = await this.sub('widgets'); const seen = new Set(); const n = now(); let changed = false;
      for await (const e of wd.values()) {
        if (e.kind !== 'file' || !e.name.endsWith('.js')) continue;
        const id = 'file:' + e.name; seen.add(id);
        const code = await (await e.getFile()).text();
        const cur = S.widgets.find(w => w.id === id);
        if (!cur || cur.d || cur.code !== code) { if (cur) Object.assign(cur, { code, name: e.name, src: 'cartella', d: undefined, enabled: cur.enabled !== false, u: n }); else S.widgets.push({ id, name: e.name, code, src: 'cartella', enabled: true, u: n }); changed = true; log('info', 'widget', 'caricato ' + e.name); }
      }
      for (const w of S.widgets) if (w.src === 'cartella' && !w.d && !seen.has(w.id)) { tomb(S.widgets, w.id); changed = true; log('info', 'widget', 'rimosso (file cancellato)'); }
      if (changed) commit(() => {});
    },
    async cycle(force) {
      if (this.state !== 'on') return;
      try { await this.scanInbox(); await this.scanWidgets(); this.lastScan = now(); if (force) { this.written = {}; } await this.write(); }
      catch (e) { this.fail(e); }
    },
  };
  function onSaved() { Folder.schedule(); }
  A['folder-pick'] = async () => {
    if (!Folder.supported()) return toast('Serve Chrome o Edge sul Mac: Safari non permette alle web app di scrivere in una cartella.', 'warn');
    try { const h = await window.showDirectoryPicker({ id: 'ritmo', mode: 'readwrite', startIn: 'documents' }); await Folder.attach(h, true); toast('Cartella collegata: ' + h.name); render(); }
    catch (e) { if (e.name !== 'AbortError') { log('error', 'cartella', e); toast('Non sono riuscito a collegare la cartella.', 'warn'); } }
  };
  A['folder-perm'] = async () => {
    try { const p = await Folder.dir.requestPermission({ mode: 'readwrite' }); if (p === 'granted') { await Folder.attach(Folder.dir, false); toast('Accesso alla cartella riattivato'); } render(); }
    catch (e) { log('error', 'cartella', e); }
  };
  A['folder-now'] = async () => { await Folder.cycle(true); toast('Cartella aggiornata'); render(); };
  A['folder-off'] = async () => { await idb.del('folder'); Folder.dir = null; Folder.state = 'off'; log('info', 'cartella', 'scollegata'); render(); };

  /** Applica azioni arrivate da inbox (o da API dei widget) in un'unica modifica. */
  function applyActions(acts, origin) {
    const { I } = X(); const n = now();
    commit(() => {
      for (const a of acts) {
        const ts = a.ts || n;
        if (a.kind === 'water' && a.ml > 0 && a.ml < 5000) S.water.push({ id: uid('w'), ts, ml: Math.round(a.ml), u: n });
        else if (a.kind === 'task' || a.kind === 'note') {
          const q = C.parseQuick((a.kind === 'note' ? '📝 ' : '') + a.text, I.today, I.live.projects);
          if (q.title) S.tasks.push({ id: uid('t'), title: q.title, due: q.due, prio: q.prio || 2, projectId: q.projectId, quick: q.quick, repeat: q.repeat, star: q.star ? I.today : null, done: null, created: ts, u: n, from: origin });
        } else if (a.kind === 'workout') {
          const t = C.WORKOUT_TYPES.find(x => x.id === String(a.type).toLowerCase() || x.name.toLowerCase() === String(a.type).toLowerCase()) || C.WORKOUT_TYPES[1];
          S.workouts.push({ id: uid('k'), ts, type: t.id, min: a.min || t.min, rpe: a.rpe || t.rpe, groups: a.groups && a.groups.length ? a.groups : t.groups.slice(), note: a.note || '', u: n });
        } else if (a.kind === 'chore') {
          const q = String(a.name).toLowerCase(); const c = I.live.chores.find(x => x.name.toLowerCase().includes(q));
          if (c) S.choreLogs.push({ id: uid('l'), choreId: c.id, ts, u: n }); else log('error', 'inbox', 'faccenda non trovata: ' + a.name);
        } else if (a.kind === 'focus' && a.min > 0) {
          const p = a.project && C.matchProject(I.live.projects, a.project);
          S.focus.push({ id: uid('f'), start: ts - a.min * 60000, end: ts, min: Math.round(a.min), projectId: p ? p.id : null, label: a.label || '', mode: 'free', u: n });
        } else if (a.kind === 'log') {
          const q = String(a.name).toLowerCase(); const tr = (S.settings.trackers || []).find(t => t.id === q || t.name.toLowerCase() === q);
          if (tr && isFinite(a.value)) S.logs.push({ id: uid('v'), t: tr.id, ts, v: a.value, u: n }); else log('error', 'inbox', 'tracker non trovato o valore mancante: ' + a.name);
        }
      }
    });
  }

  /* ───────────── TRACKER PERSONALIZZATI ───────────── */
  const TRACKER_PRESETS = [
    { name: 'Sonno', emoji: '😴', unit: 'ore', mode: 'last', goal: 8, step: 0.5 },
    { name: 'Passi', emoji: '👣', unit: 'passi', mode: 'last', goal: 8000, step: 1000 },
    { name: 'Telefono', emoji: '📱', unit: 'ore', mode: 'last', goal: 3, step: 0.5, limit: true },
    { name: 'Lettura', emoji: '📖', unit: 'min', mode: 'sum', goal: 20, step: 10 },
    { name: 'Caffè', emoji: '☕', unit: 'tazze', mode: 'sum', goal: 3, step: 1, limit: true },
  ];
  const trackers = () => (S.settings.trackers || []);
  function logTracker(id, v) {
    const tr = trackers().find(t => t.id === id); if (!tr || !isFinite(v)) return log('error', 'tracker', 'tracker o valore non valido: ' + id);
    commit(() => S.logs.push({ id: uid('v'), t: id, ts: now(), v: +v, u: now() }), { xp: 2 }); beep();
  }
  function trackerTile(tr) {
    const { I } = X(); const v = C.trackerValue(I, tr, I.today); const goal = +tr.goal || 0;
    const over = tr.limit && goal && v > goal;
    const note = !goal ? '' : tr.limit ? (v === null ? `Limite: ${goal} ${esc(tr.unit)}.` : over ? `Oltre il limite di ${goal} ${esc(tr.unit)}.` : `Sotto il limite di ${goal} ${esc(tr.unit)}.`) : `Obiettivo: ${goal} ${esc(tr.unit)}.`;
    return `<section class="panel tile" style="--c:var(--${over ? 'crit' : 'progressi'})"><div class="tile-head"><span class="dot"></span><h2>${esc(tr.emoji || '•')} ${esc(tr.name)}</h2><span class="muted small">${tr.mode === 'last' ? 'ultimo valore' : 'totale di oggi'}</span></div>
      <div class="val">${v === null ? '–' : fmtNum(v)} <small>${esc(tr.unit || '')}</small></div>${goal ? bar((v || 0) / goal, over ? 'crit' : 'progressi') : ''}<p class="note">${note}</p>
      <div class="btns">${tr.mode === 'sum' ? `<button type="button" class="btn tint sm" data-act="tr-add" data-id="${tr.id}" data-v="${tr.step || 1}">+${fmtNum(tr.step || 1)}</button>` : ''}<button type="button" class="btn tint sm" data-act="tr-set" data-id="${tr.id}">${tr.mode === 'sum' ? 'Altro valore' : 'Inserisci'}</button></div></section>`;
  }
  const fmtNum = v => new Intl.NumberFormat('it-IT', { maximumFractionDigits: 2 }).format(v);
  A['tr-add'] = el => logTracker(el.dataset.id, +el.dataset.v);
  A['tr-set'] = el => {
    const tr = trackers().find(t => t.id === el.dataset.id); if (!tr) return;
    openModal(`<form id="tr-form" class="form" data-id="${tr.id}">${sheetHead(esc((tr.emoji || '') + ' ' + tr.name))}${field('Valore (' + esc(tr.unit || 'numero') + ')', `<input class="inp" name="v" type="text" inputmode="decimal" autocomplete="off" autofocus value="${tr.mode === 'last' ? esc(C.trackerValue(X().I, tr, X().I.today) ?? '') : ''}">`, tr.mode === 'last' ? 'Conta l’ultimo valore inserito oggi.' : 'Si somma agli altri di oggi.')}<div class="sheet-foot"><button type="button" class="btn ghost" data-act="modal-close">Annulla</button><button class="btn key">Salva</button></div></form>`);
  };
  FORMS['tr-form'] = (f, fd) => { const v = parseFloat(String(fd.get('v')).replace(',', '.')); if (!isFinite(v)) return toast('Inserisci un numero.'); closeModal(); logTracker(f.dataset.id, v); };
  A['tr-new'] = el => {
    const p = el.dataset.preset !== undefined ? TRACKER_PRESETS[+el.dataset.preset] : { name: 'Nuovo tracker', emoji: '✨', unit: '', mode: 'sum', goal: 0, step: 1 };
    const base = String(p.name).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-'); let id = base; let i = 2;
    while (trackers().some(t => t.id === id)) id = base + '-' + i++;
    commit(() => { S.settings.trackers = [...trackers(), { id, ...p }]; S.settings.u = now(); });
  };
  A['tr-del'] = async el => { if (await ask('Eliminare il tracker? I valori registrati restano nel file tracker.csv.', 'Elimina', true)) commit(() => { S.settings.trackers = trackers().filter(t => t.id !== el.dataset.id); S.settings.u = now(); }); };
  document.addEventListener('change', e => {
    const el = e.target; if (!el.dataset || el.dataset.tr === undefined) return;
    const tr = trackers()[+el.dataset.tr]; if (!tr) return; const k = el.dataset.k;
    const v = el.type === 'checkbox' ? el.checked : ['goal', 'step'].includes(k) ? parseFloat(String(el.value).replace(',', '.')) || 0 : el.value;
    commit(() => { tr[k] = v; S.settings.u = now(); });
  });

  /* ───────────── WIDGET PERSONALIZZATI ───────────── */
  const WIDGETS = { defs: {}, codes: {}, err: {} };
  function dayInfo(dk) {
    const { I, streak } = X(); const r = streak.scores[dk];
    const tr = {}; for (const t of trackers()) tr[t.id] = C.trackerValue(I, t, dk);
    return { data: dk, label: WD_LETTER[weekdayOf(dk)], acqua: I.waterByDay[dk] || 0, obiettivoAcqua: C.waterGoal(S, I, dk), lavoro: I.focusByDay[dk] || 0, workout: (I.workoutsByDay[dk] || []).length, attivita: (I.tasksDoneByDay[dk] || []).length, faccende: (I.choreDoneByDay[dk] || []).length, punteggio: r && r.score !== null ? r.score : null, energia: dayVal(dk, 'energy'), tracker: tr };
  }
  function widgetAPI() {
    const { I } = X();
    return {
      state: S, settings: S.settings, oggi: I.today, today: I.today, version: VERSION, X,
      day: dk => dayInfo(dk || I.today), series: (n = 7) => [...Array(Math.max(1, n))].map((_, i) => dayInfo(addDays(I.today, i - n + 1))),
      tracker: id => { const t = trackers().find(x => x.id === id); return t ? C.trackerValue(I, t, I.today) : null; },
      add: { water: ml => A.water(null, ml), task: t => addTaskFromText(t), log: (id, v) => logTracker(id, v), chore: name => applyActions([{ kind: 'chore', name }], 'widget'), workout: o => applyActions([{ kind: 'workout', type: o.tipo || o.type, min: o.minuti || o.min, rpe: o.rpe, groups: o.gruppi || [] }], 'widget') },
      ui: { esc, bar, ring, chart: (data, color, goal) => barChart({ data, color, goal: goal || 0 }), fmtMin, fmtMl, fmtN },
      toast: m => toast(String(m)), go, log: (...a) => log('info', 'widget', ...a),
    };
  }
  function loadWidget(w) {
    if (WIDGETS.codes[w.id] === w.code) return WIDGETS.defs[w.id];
    WIDGETS.codes[w.id] = w.code; WIDGETS.defs[w.id] = null; WIDGETS.err[w.id] = '';
    try {
      const reg = { widget: def => { WIDGETS.defs[w.id] = def; } };
      new Function('Ritmo', '"use strict";\n' + w.code)(reg);
      if (!WIDGETS.defs[w.id]) throw new Error('il file non chiama Ritmo.widget({...})');
    } catch (e) { WIDGETS.err[w.id] = e.message; log('error', 'widget', w.name + ': ' + e.message); }
    return WIDGETS.defs[w.id];
  }
  function widgetTile(w) {
    const def = loadWidget(w); let body;
    if (def) {
      try { body = String(def.render ? def.render(widgetAPI()) : ''); WIDGETS.err[w.id] = ''; }
      catch (e) { if (WIDGETS.err[w.id] !== e.message) log('error', 'widget', w.name + ': ' + e.message); WIDGETS.err[w.id] = e.message; body = null; }
    }
    const title = def && def.title ? def.title : w.name;
    const area = def && def.area && AREA[def.area] ? def.area : 'progressi';
    if (body == null) body = `<p class="note">⚠ Errore nel widget: ${esc(WIDGETS.err[w.id] || 'sconosciuto')}</p><div class="btns"><button type="button" class="btn sm" data-act="terminal">Apri terminale</button></div>`;
    return `<section class="panel tile${def && def.size === 2 ? ' span2' : ''}" style="${cv(area)}" data-widget="${esc(w.id)}"><div class="tile-head"><span class="dot"></span><h2>${esc(title)}</h2><span class="muted small">widget</span></div>${body}</section>`;
  }
  document.addEventListener('click', e => {
    const b = e.target.closest && e.target.closest('[data-wact]'); if (!b) return;
    const box = b.closest('[data-widget]'); const def = box && WIDGETS.defs[box.dataset.widget]; if (!def) return;
    const fn = (def.azioni || def.actions || {})[b.dataset.wact]; if (!fn) return log('error', 'widget', 'azione mancante: ' + b.dataset.wact);
    e.preventDefault();
    try { const r = fn(widgetAPI(), b); if (r && r.catch) r.catch(err => log('error', 'widget', err)); } catch (err) { log('error', 'widget', err); toast('Errore nel widget: ' + err.message, 'warn'); }
  });
  function customTiles() {
    const { I } = X();
    return trackers().map(trackerTile).join('') + I.live.widgets.filter(w => w.enabled !== false).map(widgetTile).join('');
  }
  function openWidgetEditor(id) {
    const w = id ? S.widgets.find(x => x.id === id) : { name: 'mio-widget.js', code: EXAMPLE_WIDGET.replace('Acqua, ultimi 7 giorni', 'Il mio widget') };
    if (!w) return;
    const ro = w.src === 'cartella';
    openModal(`<form id="wid-form" class="form" data-id="${id || ''}">${sheetHead(id ? 'Widget' : 'Nuovo widget')}
      ${ro ? '<p class="sub small">Questo widget arriva dalla cartella: modifica il file in widgets/, Ritmo lo ricarica da solo.</p>' : ''}
      ${field('Nome', `<input class="inp" name="name" value="${esc(w.name)}" ${ro ? 'readonly' : ''}>`)}
      ${field('Codice', `<textarea class="inp code" name="code" rows="16" spellcheck="false" ${ro ? 'readonly' : ''}>${esc(w.code)}</textarea>`, 'API: api.series(n), api.day(), api.tracker(id), api.add.water/task/log/chore/workout, api.ui.bar/ring/chart, api.toast, api.go. Bottoni: data-wact="nome" + azioni: { nome(api) {} }.')}
      <div class="sheet-foot">${id ? `<button type="button" class="btn ghost danger spacer" data-act="wid-del" data-id="${esc(id)}">Elimina</button>` : ''}<button type="button" class="btn ghost" data-act="modal-close">Chiudi</button>${ro ? '' : '<button class="btn key">Salva</button>'}</div></form>`, { wide: true });
  }
  A['wid-new'] = () => openWidgetEditor(null);
  A['wid-edit'] = el => openWidgetEditor(el.dataset.id);
  A['wid-toggle'] = el => { const w = S.widgets.find(x => x.id === el.dataset.id); if (w) commit(() => { w.enabled = w.enabled === false; w.u = now(); }); };
  A['wid-del'] = async el => { const id = el.dataset.id; if (await ask('Eliminare il widget?', 'Elimina', true, id.startsWith('file:') ? 'Cancella anche il file nella cartella widgets/, altrimenti torna.' : '')) commit(() => tomb(S.widgets, id)); };
  FORMS['wid-form'] = (f, fd) => {
    const id = f.dataset.id; const n = now(); const code = String(fd.get('code') || ''); const name = String(fd.get('name') || 'widget.js').trim();
    commit(() => { if (id) Object.assign(S.widgets.find(x => x.id === id), { code, name, u: n }); else S.widgets.push({ id: uid('wg'), name, code, src: 'editor', enabled: true, u: n }); });
    closeModal(); const nid = id || S.widgets[S.widgets.length - 1].id;
    toast(WIDGETS.err[nid] ? 'Salvato, ma con un errore: apri il terminale' : 'Widget salvato: lo trovi in Oggi', WIDGETS.err[nid] ? 'warn' : '');
  };

  /* ───────────── sezioni aggiunte alle Impostazioni ───────────── */
  function extraSettings() {
    const { I } = X(); const errs = TERM.lines.filter(l => l.lv === 'error').length;
    const fold = Folder.state === 'on'
      ? `<p class="sub">Collegata a <b>${esc(Folder.dir.name)}</b>${Folder.last ? ', ultima scrittura alle ' + fmtTime(Folder.last) : ''}.</p><div class="btns" style="margin-top:10px"><button type="button" class="btn key sm" data-act="folder-now">Aggiorna adesso</button><button type="button" class="btn sm ghost danger" data-act="folder-off">Scollega</button></div>`
      : Folder.state === 'perm' ? `<p class="sub">Chrome chiede di confermare di nuovo l’accesso a <b>${esc(Folder.dir.name)}</b>.</p><div class="btns" style="margin-top:10px"><button type="button" class="btn key sm" data-act="folder-perm">Riattiva accesso</button><button type="button" class="btn sm ghost" data-act="folder-off">Scollega</button></div>`
      : Folder.supported() ? `<p class="sub">Scegli una cartella, ad esempio Documenti/Ritmo o una cartella in iCloud Drive. Ritmo ci scrive i dati in CSV, JSON e Markdown dopo ogni modifica.</p><div class="btns" style="margin-top:10px"><button type="button" class="btn key sm" data-act="folder-pick">Scegli cartella</button></div>`
      : `<p class="sub">Questo browser non permette alle web app di scrivere in una cartella (succede con Safari, su Mac e su iPhone). Sul Mac apri Ritmo in <b>Chrome</b> o <b>Edge</b> e installalo con l’icona “Installa” nella barra degli indirizzi. I dati arrivano lo stesso anche qui tramite la sync.</p>`;
    return `<div class="cols">
      <section class="panel" id="sec-folder"><div class="panel-head"><h2>Cartella dati</h2>${Folder.state === 'on' ? '<span class="chip st-good">collegata</span>' : ''}</div>${fold}
        <p class="small muted" style="margin-top:12px"><b>dati/</b> CSV e JSON da leggere e analizzare (sola lettura). <b>inbox/</b> qui altre app o AI lasciano file .json/.md per aggiungere dati. <b>widgets/</b> file .js con i tuoi riquadri. <b>log/</b> gli errori del terminale. Le istruzioni complete sono in LEGGIMI.md dentro la cartella.</p></section>
      <section class="panel"><div class="panel-head"><h2>Terminale</h2>${errs ? `<span class="chip st-crit">${errs} ${errs === 1 ? 'errore' : 'errori'}</span>` : '<span class="chip st-good">nessun errore</span>'}</div>
        <p class="sub small">Messaggi, errori di app, sync, cartella e widget, con un prompt per comandi e JavaScript. Si apre anche con il tasto <span class="kbd">\`</span> o da ⌘K.</p>
        <div class="btns" style="margin-top:12px"><button type="button" class="btn key" data-act="terminal">Apri il terminale</button></div></section>
    </div>
    <section class="panel"><div class="panel-head"><h2>Tracker personalizzati</h2><button type="button" class="btn sm" data-act="tr-new">Nuovo</button></div>
      <p class="sub small" style="margin-bottom:10px">Qualsiasi numero da seguire ogni giorno: compare in Oggi, nei file e nell’API dei widget. “Somma” somma i valori del giorno, “ultimo” tiene l’ultimo valore inserito. “Limite” vuol dire che meno è meglio.</p>
      ${trackers().length ? `<ol class="list">${trackers().map((t, i) => `<li class="row" style="flex-wrap:wrap;gap:8px"><input class="inp sm" style="width:54px;text-align:center" data-tr="${i}" data-k="emoji" value="${esc(t.emoji || '')}" aria-label="Emoji"><input class="inp sm" style="flex:1;min-width:120px" data-tr="${i}" data-k="name" value="${esc(t.name)}" aria-label="Nome"><input class="inp sm" style="width:90px" data-tr="${i}" data-k="unit" value="${esc(t.unit || '')}" placeholder="unità" aria-label="Unità"><select class="inp sm" style="width:auto" data-tr="${i}" data-k="mode" aria-label="Tipo"><option value="sum" ${t.mode !== 'last' ? 'selected' : ''}>somma</option><option value="last" ${t.mode === 'last' ? 'selected' : ''}>ultimo</option></select><input class="inp sm" style="width:90px" data-tr="${i}" data-k="goal" value="${esc(t.goal || '')}" placeholder="obiettivo" inputmode="decimal" aria-label="Obiettivo"><input class="inp sm" style="width:72px" data-tr="${i}" data-k="step" value="${esc(t.step || 1)}" inputmode="decimal" aria-label="Passo" title="Quanto aggiunge il tasto +"><label class="small row" style="gap:6px"><input type="checkbox" data-tr="${i}" data-k="limit" ${t.limit ? 'checked' : ''}>limite</label><span class="small muted">id: ${esc(t.id)}</span><button type="button" class="btn sm icon ghost danger" data-act="tr-del" data-id="${esc(t.id)}" aria-label="Elimina">✕</button></li>`).join('')}</ol>` : ''}
      <div class="btns" style="margin-top:10px">${TRACKER_PRESETS.filter(p => !trackers().some(t => t.name === p.name)).map(p => `<button type="button" class="btn sm tint" style="--c:var(--progressi)" data-act="tr-new" data-preset="${TRACKER_PRESETS.indexOf(p)}">${p.emoji} ${p.name}</button>`).join('')}</div></section>
    <section class="panel"><div class="panel-head"><h2>Widget</h2><button type="button" class="btn sm" data-act="wid-new">Nuovo widget</button></div>
      <p class="sub small" style="margin-bottom:10px">Riquadri tuoi in JavaScript, mostrati in Oggi. Puoi scriverli qui o come file .js nella cartella widgets/. Si sincronizzano anche su iPhone.</p>
      ${I.live.widgets.length ? `<ul class="list">${I.live.widgets.map(w => `<li><span class="dot" style="--c:var(--${WIDGETS.err[w.id] ? 'crit' : 'progressi'})"></span><button type="button" class="rowbtn" data-act="wid-edit" data-id="${esc(w.id)}"><b>${esc(w.name)}</b><span class="small muted" style="display:block">${w.src === 'cartella' ? 'dalla cartella' : 'creato qui'}${WIDGETS.err[w.id] ? '. Errore: ' + esc(WIDGETS.err[w.id]) : ''}</span></button><label class="switch" title="Mostra in Oggi"><input type="checkbox" data-act="wid-toggle" data-id="${esc(w.id)}" ${w.enabled !== false ? 'checked' : ''}><i></i></label></li>`).join('')}</ul>` : '<p class="empty">Nessun widget. “Nuovo widget” parte da un esempio funzionante.</p>'}</section>`;
  }

  /* ───────────── avvio della parte 4 ───────────── */
  document.addEventListener('keydown', e => {
    const tag = (e.target.tagName || '').toLowerCase();
    if (e.key === '`' && !['input', 'textarea', 'select'].includes(tag) && !$('#modal')) { e.preventDefault(); openTerminal(); }
  });
  setInterval(() => { if (document.visibilityState === 'visible') Folder.cycle(false); }, 20000);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') Folder.cycle(false); });
  const baseInit = init;
  init = function () {
    baseInit();
    log('info', 'avvio', `Ritmo ${VERSION} avviato`);
    Folder.restore().then(() => { if (view === 'impostazioni') render(); });
    Object.assign(window.Ritmo, { log: (...a) => log('info', 'utente', ...a), terminal: openTerminal, folder: Folder, applyActions });
    Object.defineProperty(window.Ritmo, 'api', { get: widgetAPI, configurable: true });
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => init()); else init();
})();
