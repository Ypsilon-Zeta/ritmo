  /* ═════════════ Ritmo · interfaccia (parte 2: Lavoro, Da fare, Progetti, Casa) ═════════════ */

  /* ═════════════ LAVORO (timer a blocchi) ═════════════ */
  const timerElapsed = (T = S.timer, n = now()) => (+T.acc || 0) + (T.status === 'run' || T.status === 'break' ? Math.max(0, n - T.at) / 1000 : 0);
  const timerRemaining = (T = S.timer, n = now()) => (T.plan ? T.plan - timerElapsed(T, n) : null);
  function fmtClock(sec) { sec = Math.max(0, Math.round(sec)); const m = Math.floor(sec / 60), s = sec % 60; return (m >= 60 ? Math.floor(m / 60) + ':' + pad2(m % 60) : pad2(m)) + ':' + pad2(s); }
  let completing = false;
  function tick() {
    const T = S.timer, n = now();
    if ((T.status === 'run' || T.status === 'break') && T.plan && timerRemaining(T, n) <= 0 && !completing) {
      completing = true;
      try { completeTimer(T.at + (T.plan - (+T.acc || 0)) * 1000); } finally { completing = false; }
      return;
    }
    if (T.status === 'idle' || !T.status) { if (document.title !== 'Ritmo') document.title = 'Ritmo'; return; }
    const shown = T.plan ? timerRemaining(T, n) : timerElapsed(T, n);
    const txt = fmtClock(shown);
    $$('[data-tt]').forEach(e => { e.textContent = txt; });
    const r = $('#tring');
    if (r && T.plan) r.style.strokeDashoffset = +r.dataset.c * clamp(timerElapsed(T, n) / T.plan, 0, 1);
    document.title = (T.status === 'break' ? '☕ ' : T.status === 'pause' ? '⏸ ' : '⏱ ') + txt + ' · Ritmo';
  }
  function startFocus(o = {}) {
    const { I } = X(); const n = now();
    const mode = o.mode || sub.mode || S.settings.work.mode || 'block';
    const M = C.FOCUS_MODES[mode] || C.FOCUS_MODES.block;
    const potd = C.projectOfDay(S, I, I.today);
    const projectId = o.projectId !== undefined ? o.projectId : potd ? potd.id : null;
    const proj = projectId && I.live.projects.find(p => p.id === projectId);
    const label = o.label != null ? o.label : (proj && proj.nextAction) || '';
    ensureAudio();
    commit(() => { S.timer = { status: 'run', mode, plan: M.work * 60, acc: 0, at: n, first: n, label, projectId, u: n }; });
    sub.label = '';
  }
  function completeTimer(endTs) {
    const T = S.timer; const n = now();
    if (T.status === 'break') {
      commit(() => { S.timer = { status: 'idle', mode: T.mode, u: n }; });
      notify('☕ Pausa finita', 'Pronto per un altro blocco? Basta un tocco su Avvia.', 'focus');
      return;
    }
    const M = C.FOCUS_MODES[T.mode] || C.FOCUS_MODES.block;
    const min = Math.max(1, Math.round((T.plan || timerElapsed(T, endTs)) / 60));
    const id = 'f' + Math.round(T.first || endTs);
    commit(() => {
      if (!S.focus.some(f => f.id === id)) S.focus.push({ id, start: T.first || endTs - min * 60000, end: endTs, min, projectId: T.projectId || null, label: T.label || '', mode: T.mode, u: n });
      S.timer = M.brk && endTs + M.brk * 60000 > n
        ? { status: 'break', mode: T.mode, plan: M.brk * 60, acc: 0, at: endTs, first: endTs, label: '', projectId: T.projectId || null, u: n }
        : { status: 'idle', mode: T.mode, u: n };
    }, { xp: Math.round((min * 2) / 3) });
    notify('✅ Blocco completato', `${min}′ di lavoro${T.label ? ': ' + T.label : ''}.${M.brk ? ' Pausa di ' + M.brk + '′.' : ''}`, 'focus');
  }
  A['focus-start'] = () => {
    const label = ($('#f-label') || {}).value || '';
    const proj = ($('#f-proj') || {}).value;
    startFocus({ label: label.trim(), projectId: proj === undefined ? undefined : proj || null });
  };
  A['focus-quick'] = () => { startFocus({}); toast('Blocco da 15′ avviato. Solo il primo passo.'); };
  A['focus-mode'] = el => { sub.mode = el.dataset.id; render(); };
  A['focus-pause'] = () => { const n = now(); commit(() => { const T = S.timer; T.acc = timerElapsed(T, n); T.status = 'pause'; T.u = n; }); };
  A['focus-resume'] = () => { const n = now(); commit(() => { const T = S.timer; T.at = n; T.status = 'run'; T.u = n; }); };
  A['focus-plus'] = () => commit(() => { S.timer.plan = (S.timer.plan || 0) + 300; S.timer.u = now(); });
  A['focus-skipbreak'] = () => commit(() => { S.timer = { status: 'idle', mode: S.timer.mode, u: now() }; });
  A['focus-finish'] = () => {
    const T = S.timer, n = now(), el = timerElapsed(T, n);
    if (el < 60) { toast('Meno di un minuto: niente da salvare.'); return A['focus-skipbreak'](); }
    const min = Math.max(1, Math.round(el / 60)); const id = 'f' + Math.round(T.first);
    commit(() => {
      if (!S.focus.some(f => f.id === id)) S.focus.push({ id, start: T.first, end: n, min, projectId: T.projectId || null, label: T.label || '', mode: T.mode, u: n });
      S.timer = { status: 'idle', mode: T.mode, u: n };
    }, { xp: Math.round((min * 2) / 3) });
    toast(`Salvati ${min}′ di lavoro.`); beep();
  };
  A['focus-cancel'] = async () => {
    if (timerElapsed() > 120 && !(await ask('Annullare il blocco senza salvarlo?', 'Annulla il blocco', true))) return;
    commit(() => { S.timer = { status: 'idle', mode: S.timer.mode, u: now() }; });
  };
  A['focus-del'] = async el => { if (await ask('Eliminare questa sessione?', 'Elimina', true)) commit(() => tomb(S.focus, el.dataset.id)); };
  A['focus-stuck'] = () => openModal(`<form id="stuck-form" class="form">${sheetHead('Mi sono bloccato')}
      <p class="sub">Non chiudere la sessione: trasforma il blocco in un problema da risolvere. Il timer continua.</p>
      ${field('Cosa ti blocca?', '<textarea class="inp" name="what" autofocus placeholder="Es. non so come impostare la tabella dei dati"></textarea>', 'Finisce in Da fare come “🐞” collegato al progetto.')}
      ${field('Il prossimo micro-passo (2 minuti)', '<input class="inp" name="next" placeholder="Es. cercare un esempio di tabella e copiarlo">', 'Diventa il nuovo nome del blocco.')}
      <div class="sheet-foot"><button type="button" class="btn ghost" data-act="modal-close">Annulla</button><button class="btn key">Annota e continua</button></div></form>`);
  FORMS['stuck-form'] = (f, fd) => {
    const what = String(fd.get('what') || '').trim(), next = String(fd.get('next') || '').trim();
    commit(() => {
      if (what) S.tasks.push({ id: uid('t'), title: '🐞 ' + what, prio: 2, projectId: S.timer.projectId || null, due: null, created: now(), u: now() });
      if (next) { S.timer.label = next; S.timer.u = now(); }
    });
    closeModal(); toast(next ? 'Annotato. Adesso: ' + next : 'Annotato in Da fare.');
  };
  VIEWS.lavoro = () => {
    const { I } = X(); const T = S.timer; const st = S.settings.work; const n = now();
    const potd = C.projectOfDay(S, I, I.today);
    const active = I.live.projects.filter(p => p.status === 'active');
    const running = T.status && T.status !== 'idle';
    const modeId = running ? T.mode : sub.mode || st.mode || 'block';
    const M = C.FOCUS_MODES[modeId] || C.FOCUS_MODES.block;
    const plan = running ? T.plan : M.work * 60;
    const shown = running ? (T.plan ? timerRemaining(T, n) : timerElapsed(T, n)) : plan;
    const size = 236, stroke = 14, r = (size - stroke) / 2, c = 2 * Math.PI * r;
    const prog = running && T.plan ? clamp(timerElapsed(T, n) / T.plan, 0, 1) : 0;
    const area = T.status === 'break' ? 'acqua' : 'lavoro';
    const face = `<div class="timer-face" style="${cv(area)}"><svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" aria-hidden="true"><circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke-width="${stroke}" style="stroke:color-mix(in srgb,var(--c) 20%,var(--inset))"/><circle id="tring" data-c="${c}" cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke-width="${stroke}" stroke-linecap="round" stroke-dasharray="${c}" stroke-dashoffset="${c * prog}" transform="rotate(-90 ${size / 2} ${size / 2})" style="stroke:var(--c);transition:stroke-dashoffset 1s linear"/></svg><div class="inner"><div class="tt" data-tt role="timer">${fmtClock(shown)}</div><div class="tl">${T.status === 'break' ? 'Pausa: alzati, bevi, muoviti' : T.status === 'pause' ? 'In pausa' : running ? esc(M.name) : 'Pronto'}</div></div></div>`;
    const proj = running && T.projectId ? I.live.projects.find(p => p.id === T.projectId) : null;
    let ctrl;
    if (!running) {
      const selProj = sub.proj !== undefined ? sub.proj : potd ? potd.id : '';
      const p0 = selProj && active.find(p => p.id === selProj);
      ctrl = `<div class="form">
        <div class="seg" role="group" aria-label="Modalità">${Object.entries(C.FOCUS_MODES).map(([k, v]) => `<button type="button" data-act="focus-mode" data-id="${k}" aria-pressed="${k === modeId}">${v.name}</button>`).join('')}</div>
        ${field('Cosa fai in questo blocco?', `<input class="inp" id="f-label" value="${esc(sub.label || (p0 && p0.nextAction) || '')}" placeholder="Dai un nome al blocco: un verbo e un oggetto" autocomplete="off">`, 'Un blocco con un nome preciso è più facile da iniziare.')}
        ${field('Progetto', `<select class="inp" id="f-proj"><option value="">Nessun progetto</option>${active.map(p => `<option value="${p.id}" ${p.id === selProj ? 'selected' : ''}>${esc(p.emoji || '🧭')} ${esc(p.name)}${potd && p.id === potd.id ? ' (del giorno)' : ''}</option>`).join('')}</select>`)}
        <div class="btns"><button type="button" class="btn key" style="min-height:48px;padding:0 26px;font-size:17px" data-act="focus-start">Avvia ${M.work ? M.work + ' minuti' : 'il cronometro'}</button></div></div>`;
    } else if (T.status === 'break') {
      ctrl = `<div class="form"><h2>Pausa di ${Math.round(T.plan / 60)} minuti</h2><p class="sub">Staccare davvero aiuta a ripartire. Quando suona, riparti con un tocco.</p><div class="btns"><button type="button" class="btn key" data-act="focus-skipbreak">Salta la pausa</button></div></div>`;
    } else {
      ctrl = `<div class="form"><div><p class="muted small">In corso</p><h2 style="font-size:23px">${esc(T.label || 'Blocco senza nome')}</h2>${proj ? `<p class="sub">${esc(proj.emoji || '🧭')} ${esc(proj.name)}</p>` : ''}</div>
        <div class="btns">${T.status === 'pause' ? '<button type="button" class="btn key" data-act="focus-resume">Riprendi</button>' : '<button type="button" class="btn key" data-act="focus-pause">Pausa</button>'}${T.plan ? '<button type="button" class="btn" data-act="focus-plus">+5′</button>' : ''}<button type="button" class="btn" data-act="focus-finish">Termina e salva</button><button type="button" class="btn ghost" data-act="focus-cancel">Annulla</button></div>
        <button type="button" class="btn tint" style="${cv('todo')};justify-self:start" data-act="focus-stuck">🐞 Mi sono bloccato</button></div>`;
    }
    const todayMin = I.focusByDay[I.today] || 0;
    const sessions = (I.focusSessionsByDay[I.today] || []).slice().sort((a, b) => b.start - a.start);
    const days = [...Array(7)].map((_, i) => addDays(I.today, i - 6));
    const data = days.map(d => ({ v: I.focusByDay[d] || 0, label: WD_LETTER[weekdayOf(d)], tip: `${cap(fmtRel(d))}: ${fmtMin(I.focusByDay[d] || 0)}`, d }));
    const byProj = {};
    for (const d of days) for (const f of I.focusSessionsByDay[d] || []) byProj[f.projectId || ''] = (byProj[f.projectId || ''] || 0) + (+f.min || 0);
    const rows = Object.entries(byProj).sort((a, b) => b[1] - a[1]);
    const maxP = rows.length ? rows[0][1] : 1;
    const pname = id => { const p = I.live.projects.find(x => x.id === id); return p ? (p.emoji || '🧭') + ' ' + p.name : 'Senza progetto'; };
    return `<div class="view-head"><h1 class="h1"><span class="dot" style="${cv('lavoro')}"></span>Lavoro</h1></div>
    <div class="stack">
      <section class="panel timer">${face}${ctrl}</section>
      <div class="cols">
        <section class="panel" style="${cv('lavoro')}"><div class="panel-head"><h2>Oggi</h2><span class="muted small">${sessions.length} ${sessions.length === 1 ? 'sessione' : 'sessioni'}</span></div>
          <div class="val" style="font-size:30px;font-weight:800;margin-bottom:10px">${fmtMin(todayMin)} <small style="font-size:15px;color:var(--muted);font-weight:650">di ${fmtMin(st.target)}</small></div>
          ${bar(todayMin / Math.max(1, st.target), 'lavoro')}
          ${sessions.length ? `<ul class="list" style="margin-top:10px">${sessions.map(f => `<li><span class="num muted">${fmtTime(f.start)}</span><div class="grow"><div class="ellip"><b>${esc(f.label || 'Blocco')}</b></div><div class="small muted ellip">${esc(pname(f.projectId))}</div></div><span class="num">${f.min}′</span><button type="button" class="btn sm icon ghost" data-act="focus-del" data-id="${f.id}" aria-label="Elimina sessione">✕</button></li>`).join('')}</ul>` : '<p class="empty" style="margin-top:14px">Nessun blocco ancora. 15 minuti bastano per iniziare: la spinta arriva dopo.</p>'}
        </section>
        <section class="panel"><div class="panel-head"><h2>Ultimi 7 giorni</h2><span class="muted small">${fmtMin(data.reduce((a, x) => a + x.v, 0))}</span></div>
          ${barChart({ data, color: 'var(--lavoro)', goal: st.target, fmt: v => (v >= 60 ? NF2.format(v / 60) + ' h' : Math.round(v) + '′'), label: 'Minuti di lavoro negli ultimi 7 giorni' })}
          ${rows.length ? `<hr class="sep"><h3 style="margin-bottom:8px">Per progetto</h3>${rows.map(([id, m]) => `<div class="hbar"><span class="ellip">${esc(pname(id))}</span>${bar(m / maxP, 'lavoro')}<span class="v">${fmtMin(m)}</span></div>`).join('')}` : ''}
          ${dataTable(['Giorno', 'Lavoro'], data.slice().reverse().map(x => [fmtRel(x.d), fmtMin(x.v)]))}
        </section>
      </div>
      ${planPanel('work.plan', 'lavoro', 'Quando finisco la colazione, allora apro il progetto del giorno e avvio 15 minuti.')}
    </div>`;
  };

  /* ═════════════ DA FARE ═════════════ */
  const repText = r => (r.n === 1 ? { d: 'ogni giorno', w: 'ogni settimana', m: 'ogni mese' }[r.unit] : `ogni ${r.n} ${{ d: 'giorni', w: 'settimane', m: 'mesi' }[r.unit]}`);
  function addTaskFromText(text, o = {}) {
    const { I } = X(); const q = C.parseQuick(text, I.today, I.live.projects);
    if (!q.title) { toast('Scrivi almeno il titolo.'); return null; }
    const n = now();
    if (q.star && I.live.tasks.filter(t => t.star === I.today && !t.done).length >= 3) { q.star = false; toast('Hai già 3 priorità per oggi: aggiunta senza stella.'); }
    const t = { id: uid('t'), title: q.title, due: q.due, prio: q.prio || 2, projectId: q.projectId || o.projectId || null, quick: q.quick, repeat: q.repeat, star: q.star || o.star ? I.today : null, done: null, created: n, u: n };
    commit(() => S.tasks.push(t), { render: o.render });
    return t;
  }
  function previewChips(q) {
    const c = [];
    if (q.due) c.push(`<span class="chip">📅 ${esc(fmtRel(q.due))}</span>`);
    if (q.projectName) c.push(`<span class="chip">🧭 ${esc(q.projectName)}</span>`);
    if (q.prio === 1) c.push('<span class="chip">priorità alta</span>'); else if (q.prio === 3) c.push('<span class="chip">priorità bassa</span>');
    if (q.quick) c.push('<span class="chip">⚡ 2 minuti</span>');
    if (q.repeat) c.push(`<span class="chip">↻ ${repText(q.repeat)}</span>`);
    if (q.star) c.push('<span class="chip">⭐ priorità di oggi</span>');
    return c.join('');
  }
  document.addEventListener('input', e => {
    if (e.target.id === 'qa') {
      const { I } = X(); const box = $('#qa-prev');
      if (box) box.innerHTML = e.target.value.trim() ? previewChips(C.parseQuick(e.target.value, I.today, I.live.projects)) : '';
    }
    if (e.target.id === 'f-label') sub.label = e.target.value;
    if (e.target.dataset && e.target.dataset.out) { const o = document.getElementById(e.target.dataset.out); if (o) o.textContent = e.target.value; }
  });
  document.addEventListener('change', e => { if (e.target.id === 'f-proj') sub.proj = e.target.value; });
  FORMS['qa-form'] = f => {
    const inp = $('#qa', f); const text = inp.value.trim(); if (!text) return;
    const t = addTaskFromText(text, { render: false });
    if (t) { render({ focus: '#qa' }); toast('Aggiunta: ' + t.title + (t.due ? ' (' + fmtRel(t.due) + ')' : '')); }
  };
  function taskRow(t, I) {
    const p = t.projectId && I.live.projects.find(x => x.id === t.projectId);
    const ch = [];
    if (t.due && !t.done) { const n = diffDays(t.due, I.today); ch.push(`<span class="chip ${n < 0 ? 'st-crit' : n === 0 ? 'st-warn' : ''}">${n < 0 ? 'scaduta da ' + -n + ' g' : esc(fmtRel(t.due))}</span>`); }
    if (t.done) ch.push(`<span class="chip">fatta ${esc(fmtRel(dayKey(t.done, I.sh)))}</span>`);
    if (p) ch.push(`<span class="chip">${esc(p.emoji || '🧭')} ${esc(p.name)}</span>`);
    if (t.prio === 1) ch.push('<span class="chip">priorità alta</span>');
    if (t.quick) ch.push('<span class="chip">⚡ 2 min</span>');
    if (t.repeat) ch.push(`<span class="chip">↻ ${repText(t.repeat)}</span>`);
    return `<li style="${cv('todo')};${onInk('todo')}"><button type="button" class="check ${t.done ? 'on' : ''}" data-act="task-toggle" data-id="${t.id}" aria-label="${t.done ? 'Riapri' : 'Completa'}: ${esc(t.title)}">${ICON_CHECK}</button>
      <button type="button" class="rowbtn" data-act="task-edit" data-id="${t.id}"><span class="ellip" style="display:block;${t.done ? 'text-decoration:line-through;color:var(--muted)' : ''}">${esc(t.title)}</span>${ch.length ? `<span class="row" style="gap:6px;margin-top:5px">${ch.join('')}</span>` : ''}</button>
      ${t.done ? '' : `<button type="button" class="star ${t.star === I.today ? 'on' : ''}" data-act="task-star" data-id="${t.id}" aria-pressed="${t.star === I.today}" aria-label="Priorità di oggi" title="Priorità di oggi (massimo 3)">⭐</button>`}</li>`;
  }
  const sortTasks = (a, b) => (b.star === X().I.today) - (a.star === X().I.today) || (a.prio || 2) - (b.prio || 2) || String(a.due || '9999').localeCompare(String(b.due || '9999')) || (a.created || 0) - (b.created || 0);
  const taskList = (arr, I) => `<ul class="list">${arr.map(t => taskRow(t, I)).join('')}</ul>`;
  VIEWS.todo = () => {
    const { I } = X(); const f = sub.todo || 'oggi'; const today = I.today;
    const open = I.live.tasks.filter(t => !t.done);
    const isToday = t => (t.due && t.due <= today) || t.star === today;
    const isInbox = t => !t.due && !t.projectId && t.star !== today;
    const counts = { oggi: open.filter(isToday).length, inbox: open.filter(isInbox).length, prossimi: open.filter(t => t.due && t.due > today).length, tutte: open.length };
    const tabs = [['oggi', 'Oggi'], ['inbox', 'Inbox'], ['prossimi', 'Prossimi'], ['tutte', 'Tutte'], ['matrice', 'Matrice'], ['fatte', 'Fatte']];
    let body = '';
    const sec = (title, arr, extra = '') => (arr.length ? `<section class="panel"><div class="panel-head"><h2>${title}</h2><span class="muted small">${arr.length}${extra}</span></div>${taskList(arr.sort(sortTasks), I)}</section>` : '');
    if (f === 'oggi') {
      const late = open.filter(t => t.due && t.due < today), tod = open.filter(t => isToday(t) && !(t.due && t.due < today));
      const quick = open.filter(t => t.quick && !isToday(t));
      body = sec('In ritardo', late) + sec('Oggi', tod) + sec('⚡ Da 2 minuti: falle subito', quick);
      if (!late.length && !tod.length) body = `<p class="empty"><b>Niente in scadenza oggi.</b> Scegli fino a 3 priorità con la stella, o pesca dalla Inbox.</p>` + body;
    } else if (f === 'inbox') {
      const arr = open.filter(isInbox);
      body = arr.length ? `<section class="panel"><div class="panel-head"><h2>Inbox</h2><span class="muted small">Tutto quello che hai scaricato. Dagli una data, un progetto o una stella, oppure fallo.</span></div>${taskList(arr.sort((a, b) => (b.created || 0) - (a.created || 0)), I)}</section>` : '<p class="empty"><b>Inbox vuota.</b> Scrivi qui sopra o usa “Scarica la testa” in Oggi.</p>';
    } else if (f === 'prossimi') {
      const arr = open.filter(t => t.due && t.due > today).sort((a, b) => a.due.localeCompare(b.due));
      const groups = {}; arr.forEach(t => (groups[t.due] ||= []).push(t));
      body = arr.length ? Object.entries(groups).map(([d, ts]) => sec(cap(fmtRel(d)), ts)).join('') : '<p class="empty">Niente in programma nei prossimi giorni.</p>';
    } else if (f === 'tutte') {
      const groups = {}; open.forEach(t => (groups[t.projectId || ''] ||= []).push(t));
      body = open.length ? Object.entries(groups).map(([pid, ts]) => { const p = I.live.projects.find(x => x.id === pid); return sec(p ? esc((p.emoji || '🧭') + ' ' + p.name) : 'Senza progetto', ts); }).join('') : '<p class="empty">Nessuna attività aperta.</p>';
    } else if (f === 'fatte') {
      const arr = I.live.tasks.filter(t => t.done).sort((a, b) => b.done - a.done).slice(0, 60);
      body = arr.length ? `<section class="panel"><div class="panel-head"><h2>Completate</h2><span class="muted small">ultime ${arr.length}</span></div>${taskList(arr, I)}</section>` : '<p class="empty">Ancora nessuna attività completata.</p>';
    } else if (f === 'matrice') {
      const urgent = t => t.due && diffDays(t.due, today) <= 1;
      const important = t => t.prio === 1 || t.star === today || (t.projectId && (I.live.projects.find(p => p.id === t.projectId) || {}).priority);
      const q = [['Fai adesso', 'Importanti e urgenti', open.filter(t => important(t) && urgent(t))], ['Pianifica', 'Importanti, non urgenti: dagli un blocco', open.filter(t => important(t) && !urgent(t))], ['Sbriga in fretta', 'Urgenti, poco importanti', open.filter(t => !important(t) && urgent(t))], ['Più avanti o mai', 'Né urgenti né importanti', open.filter(t => !important(t) && !urgent(t))]];
      body = `<div class="cols">${q.map(([t, d, arr]) => `<section class="panel"><div class="panel-head"><h2>${t}</h2><span class="muted small">${arr.length}</span></div><p class="small muted" style="margin:-8px 0 8px">${d}</p>${arr.length ? taskList(arr.sort(sortTasks), I) : '<p class="small muted">Vuoto.</p>'}</section>`).join('')}</div><p class="small muted" style="margin-top:10px">Urgente: scade entro domani. Importante: priorità alta, stella di oggi o progetto con precedenza.</p>`;
    }
    return `<div class="view-head"><h1 class="h1"><span class="dot" style="${cv('todo')}"></span>Da fare</h1><button type="button" class="btn" data-act="top3">⭐ Priorità di oggi</button></div>
    <div class="stack">
      <form id="qa-form" class="panel" autocomplete="off"><label class="sr" for="qa">Nuova attività</label><div class="row"><input id="qa" class="inp grow" placeholder="Nuova attività: es. Chiamare il commercialista domani #srl !alta" enterkeyhint="done"><button class="btn key">Aggiungi</button></div>
        <div class="preview" id="qa-prev"></div><p class="small muted">Capisce: oggi, domani, lunedì, 25/12, #progetto, !alta, ⚡ (2 minuti), * (priorità di oggi), ogni settimana.</p></form>
      <div class="seg" role="tablist" aria-label="Filtro">${tabs.map(([k, l]) => `<button type="button" role="tab" data-act="todo-filter" data-id="${k}" aria-pressed="${f === k}" aria-selected="${f === k}">${l}${counts[k] ? ` <span class="muted">${counts[k]}</span>` : ''}</button>`).join('')}</div>
      ${body}
    </div>`;
  };
  A['todo-filter'] = el => { sub.todo = el.dataset.id; render(); };
  function refreshModal() { if ($('#top3-list')) renderTop3(); const pm = $('[data-proj]'); if (pm) openProject(pm.dataset.proj); }
  A['task-toggle'] = el => {
    const t = S.tasks.find(x => x.id === el.dataset.id); if (!t) return; const n = now(); const { I } = X();
    if (t.done) { commit(() => { t.done = null; t.u = n; }); refreshModal(); return; }
    let next = null;
    commit(() => {
      t.done = n; t.u = n;
      if (t.repeat) {
        let nd = C.nextDue(t.due || I.today, t.repeat); while (nd <= I.today) nd = C.nextDue(nd, t.repeat);
        next = { ...t, id: uid('t'), done: null, due: nd, star: null, created: n, u: n }; S.tasks.push(next);
      }
    }, { xp: t.prio === 1 ? 10 : 5 });
    beep(); refreshModal();
    toast(next ? `Fatto. Prossima: ${fmtRel(next.due)}` : 'Fatto: ' + t.title, '', { label: 'Annulla', fn: () => { commit(() => { t.done = null; t.u = now(); if (next) tomb(S.tasks, next.id); }); refreshModal(); } });
  };
  A['task-star'] = el => {
    const t = S.tasks.find(x => x.id === el.dataset.id); if (!t) return; const { I } = X();
    if (t.star !== I.today && I.live.tasks.filter(x => x.star === I.today && !x.done).length >= 3) { toast('Massimo 3 priorità: togline una prima.'); return; }
    commit(() => { t.star = t.star === I.today ? null : I.today; t.u = now(); });
    refreshModal();
  };
  A['task-edit'] = el => openTask(el.dataset.id);
  function projectOptions(sel) {
    return `<option value="">Nessun progetto</option>` + X().I.live.projects.filter(p => p.status !== 'done' || p.id === sel).map(p => `<option value="${p.id}" ${p.id === sel ? 'selected' : ''}>${esc(p.emoji || '🧭')} ${esc(p.name)}</option>`).join('');
  }
  function openTask(id) {
    const t = S.tasks.find(x => x.id === id); if (!t) return; const { I } = X();
    const rep = t.repeat ? t.repeat.unit + t.repeat.n : '';
    openModal(`<form id="task-form" class="form" data-id="${t.id}">${sheetHead('Attività')}
      ${field('Titolo', `<input class="inp" name="title" value="${esc(t.title)}" required>`)}
      <div class="form-2">${field('Scadenza', `<input class="inp" name="due" type="date" value="${esc(t.due || '')}">`)}${field('Progetto', `<select class="inp" name="projectId">${projectOptions(t.projectId)}</select>`)}</div>
      <div class="form-2">${field('Priorità', `<select class="inp" name="prio"><option value="1" ${t.prio === 1 ? 'selected' : ''}>Alta</option><option value="2" ${(t.prio || 2) === 2 ? 'selected' : ''}>Media</option><option value="3" ${t.prio === 3 ? 'selected' : ''}>Bassa</option></select>`)}${field('Ripeti', `<select class="inp" name="repeat"><option value="">Mai</option>${[['d1', 'Ogni giorno'], ['d2', 'Ogni 2 giorni'], ['w1', 'Ogni settimana'], ['w2', 'Ogni 2 settimane'], ['m1', 'Ogni mese'], ['m3', 'Ogni 3 mesi']].map(([v, l]) => `<option value="${v}" ${rep === v ? 'selected' : ''}>${l}</option>`).join('')}</select>`)}</div>
      <div><div class="toggle"><span>⚡ Richiede meno di 2 minuti</span><label class="switch"><input type="checkbox" name="quick" ${t.quick ? 'checked' : ''}><i></i></label></div><div class="toggle"><span>⭐ Priorità di oggi</span><label class="switch"><input type="checkbox" name="star" ${t.star === I.today ? 'checked' : ''}><i></i></label></div></div>
      ${field('Note', `<textarea class="inp" name="note" placeholder="Dettagli, link, il primo passo">${esc(t.note || '')}</textarea>`)}
      <div class="sheet-foot"><button type="button" class="btn ghost danger spacer" data-act="task-del" data-id="${t.id}">Elimina</button><button type="button" class="btn ghost" data-act="modal-close">Annulla</button><button class="btn key">Salva</button></div></form>`);
  }
  FORMS['task-form'] = (f, fd) => {
    const t = S.tasks.find(x => x.id === f.dataset.id); if (!t) return closeModal(); const { I } = X();
    const rep = String(fd.get('repeat') || '');
    const wantStar = !!fd.get('star');
    if (wantStar && t.star !== I.today && I.live.tasks.filter(x => x.star === I.today && !x.done && x.id !== t.id).length >= 3) { toast('Massimo 3 priorità per oggi.'); return; }
    commit(() => {
      t.title = String(fd.get('title') || '').trim() || t.title; t.due = fd.get('due') || null; t.projectId = fd.get('projectId') || null;
      t.prio = +fd.get('prio') || 2; t.repeat = rep ? { unit: rep[0], n: +rep.slice(1) } : null; t.quick = !!fd.get('quick');
      t.star = wantStar ? I.today : t.star === I.today ? null : t.star; t.note = String(fd.get('note') || '').trim(); t.u = now();
    });
    closeModal();
  };
  A['task-del'] = async el => { const id = el.dataset.id; if (await ask('Eliminare l’attività?', 'Elimina', true)) commit(() => tomb(S.tasks, id)); };
  function openTop3() {
    openModal(`${sheetHead('Le 3 priorità di oggi')}<p class="sub" style="margin-bottom:12px">Scegli al massimo tre cose. Se fai solo queste, la giornata è comunque buona.</p>
      <form id="top3-form" class="row" autocomplete="off"><label class="sr" for="top3-new">Nuova priorità</label><input class="inp grow" id="top3-new" placeholder="Aggiungi una nuova priorità" autofocus><button class="btn key">Aggiungi</button></form>
      <div id="top3-list" style="margin-top:12px"></div><div class="sheet-foot"><button type="button" class="btn key" data-act="modal-close">Fatto</button></div>`, { wide: true });
    renderTop3();
  }
  function renderTop3() {
    const box = $('#top3-list'); if (!box) return; const { I } = X();
    const open = I.live.tasks.filter(t => !t.done).sort((a, b) => (b.star === I.today) - (a.star === I.today) || String(a.due || '9999').localeCompare(String(b.due || '9999')) || (a.prio || 2) - (b.prio || 2));
    const n = open.filter(t => t.star === I.today).length;
    box.innerHTML = `<p class="small muted" style="margin-bottom:6px">${n} di 3 scelte</p>` + (open.length ? taskList(open.slice(0, 30), I) : '<p class="empty">Nessuna attività aperta: aggiungine una qui sopra.</p>');
  }
  FORMS['top3-form'] = f => {
    const inp = $('#top3-new', f); const text = inp.value.trim(); if (!text) return;
    addTaskFromText(text + ' *', { render: true }); inp.value = ''; renderTop3(); inp.focus();
  };

  /* ═════════════ PROGETTI ═════════════ */
  function projStats(p, I) {
    const ms = p.milestones || [], dn = ms.filter(m => m.done).length;
    const since = addDays(I.today, -6); let f7 = 0, tot = 0;
    for (const f of I.live.focus) if (f.projectId === p.id) { tot += +f.min || 0; if (dayKey(f.start, I.sh) >= since) f7 += +f.min || 0; }
    return { ms, dn, pct: ms.length ? dn / ms.length : 0, f7, tot, open: I.live.tasks.filter(t => !t.done && t.projectId === p.id).length };
  }
  function projCard(p, I, potd) {
    const s = projStats(p, I); const ch = [];
    if (potd && potd.id === p.id) ch.push('<span class="chip">☀️ del giorno</span>');
    if (p.priority) ch.push('<span class="chip">⭐ precedenza</span>');
    if (p.status === 'paused') ch.push('<span class="chip">in pausa</span>');
    if (p.status === 'done') ch.push('<span class="chip st-good">completato</span>');
    if (p.deadline && p.status !== 'done') { const n = diffDays(p.deadline, I.today); ch.push(`<span class="chip ${n < 0 ? 'st-crit' : n <= 7 ? 'st-warn' : ''}">${n < 0 ? 'scaduto da ' + -n + ' g' : n === 0 ? 'scade oggi' : 'scade tra ' + n + ' g'}</span>`); }
    return `<section class="panel proj" style="${cv('progetti')}">
      <div class="proj-top"><span class="proj-emoji" aria-hidden="true">${esc(p.emoji || '🧭')}</span><div class="grow"><div class="proj-name">${esc(p.name)}</div>${ch.length ? `<div class="row" style="gap:6px;margin-top:6px">${ch.join('')}</div>` : ''}</div></div>
      <div><div class="row between small" style="margin-bottom:6px"><span class="muted">${s.ms.length ? `${s.dn} di ${s.ms.length} milestone` : 'Nessuna milestone'}</span><b>${Math.round(s.pct * 100)}%</b></div>${bar(s.pct, 'progetti')}</div>
      <div class="next-act">${p.nextAction ? `Prossima azione: <b>${esc(p.nextAction)}</b>` : 'Manca la prossima azione: è la cosa più utile da scrivere.'}</div>
      <div class="row between small muted"><span>${fmtMin(s.f7)} negli ultimi 7 giorni</span><span>${s.open} ${s.open === 1 ? 'attività aperta' : 'attività aperte'}</span></div>
      <div class="btns">${p.status === 'active' ? `<button type="button" class="btn key sm" data-act="proj-focus" data-id="${p.id}">Avvia blocco</button>` : ''}<button type="button" class="btn sm" data-act="proj-open" data-id="${p.id}">Apri</button>${p.link ? `<a class="btn sm ghost" href="${esc(safeUrl(p.link))}" target="_blank" rel="noopener">Link</a>` : ''}</div>
    </section>`;
  }
  const safeUrl = u => (/^(https?:|mailto:|obsidian:|notion:|things:)/i.test(String(u).trim()) ? String(u).trim() : 'https://' + String(u).trim().replace(/^\/+/, ''));
  VIEWS.progetti = () => {
    const { I } = X(); const potd = C.projectOfDay(S, I, I.today); const ps = I.live.projects;
    const by = st => ps.filter(p => p.status === st).sort((a, b) => (b.priority ? 1 : 0) - (a.priority ? 1 : 0) || (a.created || 0) - (b.created || 0));
    const active = by('active'), paused = by('paused'), done = by('done');
    return `<div class="view-head"><h1 class="h1"><span class="dot" style="${cv('progetti')}"></span>Progetti</h1><button type="button" class="btn key" data-act="proj-new">Nuovo progetto</button></div>
    <div class="stack">
      ${potd ? `<div class="banner" style="${cv('progetti')};background:color-mix(in srgb,var(--progetti) 12%,var(--panel));box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--progetti) 40%,transparent)"><span style="font-size:26px" aria-hidden="true">${esc(potd.emoji || '🧭')}</span><p><b>Progetto del giorno: ${esc(potd.name)}.</b> Ruota da solo: tocca a quello lavorato meno di recente, ma i progetti con la stella hanno la precedenza.</p><button type="button" class="btn sm" data-act="potd-pick">Cambia</button></div>` : ''}
      ${active.length ? `<div class="tiles">${active.map(p => projCard(p, I, potd)).join('')}</div>` : `<div class="empty"><b>Nessun progetto attivo.</b> Aggiungi i 2-4 progetti su cui vuoi avanzare: ogni giorno Ritmo te ne propone uno, con la sua prossima azione.</div>`}
      ${paused.length ? `<details class="panel"><summary class="h2" style="cursor:pointer">In pausa (${paused.length})</summary><div class="tiles" style="margin-top:14px">${paused.map(p => projCard(p, I, potd)).join('')}</div></details>` : ''}
      ${done.length ? `<details class="panel"><summary class="h2" style="cursor:pointer">Completati (${done.length})</summary><div class="tiles" style="margin-top:14px">${done.map(p => projCard(p, I, potd)).join('')}</div></details>` : ''}
    </div>`;
  };
  A['proj-new'] = () => openModal(`<form id="projnew-form" class="form">${sheetHead('Nuovo progetto')}
      <div class="row" style="align-items:flex-end;flex-wrap:nowrap">${field('Emoji', '<input class="inp" name="emoji" value="🧭" style="width:72px;text-align:center" maxlength="4">')}<div class="grow">${field('Nome', '<input class="inp" name="name" required autofocus placeholder="Es. Canale YouTube">')}</div></div>
      ${field('Prossima azione', '<input class="inp" name="next" placeholder="La prossima cosa concreta da fare (un verbo)">', 'Rende facile iniziare: è quello che vedi in Oggi e nel timer.')}
      <div class="form-2">${field('Scadenza (opzionale)', '<input class="inp" name="deadline" type="date">')}${field('Link (opzionale)', '<input class="inp" name="link" placeholder="Notion, cartella, chat">')}</div>
      <div class="toggle"><span>⭐ Ha la precedenza nella rotazione</span><label class="switch"><input type="checkbox" name="priority"><i></i></label></div>
      <div class="sheet-foot"><button type="button" class="btn ghost" data-act="modal-close">Annulla</button><button class="btn key">Crea progetto</button></div></form>`);
  FORMS['projnew-form'] = (f, fd) => {
    const name = String(fd.get('name') || '').trim(); if (!name) return; const n = now();
    commit(() => S.projects.push({ id: uid('p'), name, emoji: String(fd.get('emoji') || '🧭').trim() || '🧭', status: 'active', priority: !!fd.get('priority'), deadline: fd.get('deadline') || null, link: String(fd.get('link') || '').trim(), nextAction: String(fd.get('next') || '').trim(), notes: '', milestones: [], created: n, u: n }));
    closeModal(); toast('Progetto creato: ' + name);
  };
  A['proj-open'] = el => openProject(el.dataset.id);
  A['proj-focus'] = el => { startFocus({ projectId: el.dataset.id }); go('lavoro'); };
  function openProject(id) {
    const p = S.projects.find(x => x.id === id && !x.d); if (!p) return closeModal();
    const { I } = X(); const s = projStats(p, I);
    const tasks = I.live.tasks.filter(t => t.projectId === p.id && !t.done).sort(sortTasks);
    const prevScroll = $('#modal .sheet') ? $('#modal .sheet').scrollTop : 0;
    openModal(`<div data-proj="${p.id}">${sheetHead(esc((p.emoji || '🧭') + ' ' + p.name))}
      <div class="form">
        <div class="row" style="align-items:flex-end;flex-wrap:nowrap">${field('Emoji', `<input class="inp" data-pf="emoji" value="${esc(p.emoji || '🧭')}" style="width:72px;text-align:center" maxlength="4">`)}<div class="grow">${field('Nome', `<input class="inp" data-pf="name" value="${esc(p.name)}">`)}</div></div>
        ${field('Prossima azione', `<input class="inp" data-pf="nextAction" value="${esc(p.nextAction || '')}" placeholder="Un verbo e un oggetto">`)}
        <div class="field"><span>Stato</span><div class="seg">${[['active', 'Attivo'], ['paused', 'In pausa'], ['done', 'Completato']].map(([k, l]) => `<button type="button" data-act="proj-status" data-id="${p.id}" data-v="${k}" aria-pressed="${p.status === k}">${l}</button>`).join('')}</div></div>
        <div class="form-2">${field('Scadenza', `<input class="inp" type="date" data-pf="deadline" value="${esc(p.deadline || '')}">`)}${field('Link', `<input class="inp" data-pf="link" value="${esc(p.link || '')}" placeholder="https://">`)}</div>
        <div class="toggle"><span>⭐ Ha la precedenza nella rotazione</span><label class="switch"><input type="checkbox" data-pf="priority" ${p.priority ? 'checked' : ''}><i></i></label></div>
        <div><div class="row between" style="margin-bottom:6px"><h3>Milestone</h3><span class="muted small">${s.dn} di ${s.ms.length}, ${Math.round(s.pct * 100)}%</span></div>${bar(s.pct, 'progetti')}
          <ul class="list ms" style="margin-top:6px">${s.ms.map(m => `<li style="${cv('progetti')}"><button type="button" class="check ${m.done ? 'on' : ''}" data-act="ms-toggle" data-p="${p.id}" data-id="${m.id}" aria-label="${m.done ? 'Riapri' : 'Completa'}: ${esc(m.t)}">${ICON_CHECK}</button><span class="grow" style="${m.done ? 'text-decoration:line-through;color:var(--muted)' : ''}">${esc(m.t)}</span><button type="button" class="btn sm icon ghost" data-act="ms-del" data-p="${p.id}" data-id="${m.id}" aria-label="Elimina milestone">✕</button></li>`).join('')}</ul>
          <form id="ms-form" data-p="${p.id}" class="row" autocomplete="off" style="margin-top:8px"><label class="sr" for="ms-new">Nuova milestone</label><input class="inp grow" id="ms-new" placeholder="Nuova milestone (un risultato verificabile)"><button class="btn">Aggiungi</button></form></div>
        <div><h3 style="margin-bottom:6px">Attività aperte</h3>${tasks.length ? taskList(tasks, I) : '<p class="small muted">Nessuna.</p>'}
          <form id="ptask-form" data-p="${p.id}" class="row" autocomplete="off" style="margin-top:8px"><label class="sr" for="ptask-new">Nuova attività del progetto</label><input class="inp grow" id="ptask-new" placeholder="Nuova attività (accetta domani, !alta…)"><button class="btn">Aggiungi</button></form></div>
        ${field('Note', `<textarea class="inp" data-pf="notes" placeholder="Obiettivo, idee, contesto">${esc(p.notes || '')}</textarea>`)}
        <p class="small muted">Tempo di lavoro: ${fmtMin(s.tot)} in totale, ${fmtMin(s.f7)} negli ultimi 7 giorni.</p>
      </div>
      <div class="sheet-foot"><button type="button" class="btn ghost danger spacer" data-act="proj-del" data-id="${p.id}">Elimina</button><button type="button" class="btn key" data-act="modal-close">Fatto</button></div></div>`, { wide: true });
    const sh = $('#modal .sheet'); if (sh) sh.scrollTop = prevScroll;
  }
  const reopenProject = id => { if ($('[data-proj]')) openProject(id); };
  document.addEventListener('change', e => {
    const el = e.target; if (!el.dataset || !el.dataset.pf) return;
    const box = el.closest('[data-proj]'); if (!box) return;
    const p = S.projects.find(x => x.id === box.dataset.proj); if (!p) return;
    const k = el.dataset.pf; const v = el.type === 'checkbox' ? el.checked : el.value.trim();
    if (k === 'name' && !v) return;
    commit(() => { p[k] = v || (k === 'deadline' ? null : v); p.u = now(); });
  });
  A['proj-status'] = el => {
    const p = S.projects.find(x => x.id === el.dataset.id); if (!p) return; const v = el.dataset.v;
    commit(() => { p.status = v; p.u = now(); });
    if (v === 'done') { confetti(); toast('Progetto completato: ' + p.name); }
    reopenProject(p.id);
  };
  A['ms-toggle'] = el => {
    const p = S.projects.find(x => x.id === el.dataset.p); const m = p && (p.milestones || []).find(x => x.id === el.dataset.id); if (!m) return;
    const was = !!m.done;
    commit(() => { m.done = was ? null : now(); p.u = now(); }, { xp: was ? 0 : 30 });
    if (!was) { beep('goal'); if ((p.milestones || []).every(x => x.done)) { confetti(); toast('Tutte le milestone fatte. Vuoi segnare il progetto come completato?'); } }
    reopenProject(p.id);
  };
  A['ms-del'] = el => { const p = S.projects.find(x => x.id === el.dataset.p); if (!p) return; commit(() => { p.milestones = (p.milestones || []).filter(m => m.id !== el.dataset.id); p.u = now(); }); reopenProject(p.id); };
  FORMS['ms-form'] = f => {
    const p = S.projects.find(x => x.id === f.dataset.p); const t = $('#ms-new').value.trim(); if (!p || !t) return;
    commit(() => { (p.milestones = p.milestones || []).push({ id: uid('m'), t, done: null }); p.u = now(); });
    reopenProject(p.id); const i = $('#ms-new'); if (i) i.focus();
  };
  FORMS['ptask-form'] = f => {
    const text = $('#ptask-new').value.trim(); if (!text) return;
    addTaskFromText(text, { projectId: f.dataset.p }); reopenProject(f.dataset.p); const i = $('#ptask-new'); if (i) i.focus();
  };
  A['proj-del'] = async el => {
    const p = S.projects.find(x => x.id === el.dataset.id); if (!p) return;
    if (await ask('Eliminare “' + p.name + '”?', 'Elimina', true, 'Le attività collegate restano, senza progetto.')) commit(() => tomb(S.projects, p.id));
  };
  A['potd-pick'] = () => {
    const { I } = X(); const potd = C.projectOfDay(S, I, I.today);
    const act = I.live.projects.filter(p => p.status === 'active');
    if (!act.length) return toast('Nessun progetto attivo.');
    openModal(`${sheetHead('Progetto del giorno')}<p class="sub" style="margin-bottom:10px">Vale solo per oggi. Domani la rotazione riparte da sola.</p><ul class="list">${act.map(p => `<li><span style="font-size:22px" aria-hidden="true">${esc(p.emoji || '🧭')}</span><span class="grow"><b>${esc(p.name)}</b>${p.nextAction ? `<br><span class="small muted">${esc(p.nextAction)}</span>` : ''}</span><button type="button" class="btn sm ${potd && potd.id === p.id ? 'key' : ''}" data-act="potd-set" data-id="${p.id}">${potd && potd.id === p.id ? 'Scelto' : 'Scegli'}</button></li>`).join('')}</ul>`);
  };
  A['potd-set'] = el => { commit(() => setDay(X().I.today, 'potd', el.dataset.id)); closeModal(); };

  /* ═════════════ CASA ═════════════ */
  function choreState(fr, due) {
    if (fr <= 0) return { cls: 'st-crit', txt: due < 0 ? `in ritardo di ${-due} g` : 'da fare oggi' };
    if (fr <= 0.35) return { cls: 'st-warn', txt: due <= 1 ? 'domani' : `tra ${due} g` };
    return { cls: '', txt: `tra ${due} g` };
  }
  function doneChore(id) {
    const c = S.chores.find(x => x.id === id && !x.d); if (!c) return;
    const rec = { id: uid('l'), choreId: id, ts: now(), u: now() };
    commit(() => S.choreLogs.push(rec), { xp: 8 });
    beep();
    const { I } = X(); const all = I.live.chores.every(x => C.freshness(I, x, now()) > 0);
    if (all && I.live.chores.length > 2) { confetti(); toast('🏠 Casa tutta in ordine!'); }
    else toast('Fatta: ' + c.name, '', { label: 'Annulla', fn: () => commit(() => tomb(S.choreLogs, rec.id)) });
  }
  A['chore-done'] = el => doneChore(el.dataset.id);
  A['casa-filter'] = el => { sub.casa = el.dataset.id; render(); };
  VIEWS.casa = () => {
    const { I } = X(); const n = now(); const f = sub.casa || 'Tutte';
    const ch = I.live.chores.map(c => ({ c, fr: C.freshness(I, c, n), due: C.choreDueIn(I, c, n) })).sort((a, b) => a.fr - b.fr);
    const areas = [...new Set(['Tutte', ...C.CHORE_AREAS, ...ch.map(x => x.c.area).filter(Boolean)])];
    const list = f === 'Tutte' ? ch : ch.filter(x => x.c.area === f);
    const dueN = ch.filter(x => x.fr <= 0).length;
    const pct = ch.length ? ch.filter(x => x.fr > 0).length / ch.length : 1;
    const ws = mondayOf(I.today); let doneWeek = 0; for (let i = 0; i < 7; i++) doneWeek += (I.choreDoneByDay[addDays(ws, i)] || []).length;
    const mins = ch.filter(x => x.fr <= 0).reduce((a, x) => a + (+x.c.min || 0), 0);
    return `<div class="view-head"><h1 class="h1"><span class="dot" style="${cv('casa')}"></span>Casa</h1><button type="button" class="btn key" data-act="chore-new">Nuova faccenda</button></div>
    <div class="stack">
      <section class="panel"><div class="stats">
        <div class="stat"><span class="label"><span class="dot" style="${cv('casa')}"></span>Casa in ordine</span><span class="value">${Math.round(pct * 100)}%</span></div>
        <div class="stat"><span class="label">Da fare adesso</span><span class="value">${dueN}</span></div>
        <div class="stat"><span class="label">Tempo stimato</span><span class="value">${mins ? fmtMin(mins) : '0′'}</span></div>
        <div class="stat"><span class="label">Fatte questa settimana</span><span class="value">${doneWeek}</span></div></div>
        <p class="small muted" style="margin-top:12px">Ogni barra si svuota col passare dei giorni, in base a quanto spesso va fatta quella faccenda. Fai la più vuota: anche una al giorno basta a tenere tutto sotto controllo.</p></section>
      <div class="seg" role="tablist" aria-label="Stanza">${areas.map(a => `<button type="button" role="tab" data-act="casa-filter" data-id="${esc(a)}" aria-pressed="${f === a}" aria-selected="${f === a}">${esc(a)}</button>`).join('')}</div>
      <section class="panel">${list.length ? `<ul class="list">${list.map(({ c, fr, due }) => { const s = choreState(fr, due); return `<li class="chore"><button type="button" class="rowbtn c-name" data-act="chore-edit" data-id="${c.id}"><span class="ellip" style="display:block"><b>${esc(c.name)}</b></span><span class="small muted ellip" style="display:block">${esc(c.area || 'Generale')}, ogni ${c.every} ${c.every === 1 ? 'giorno' : 'giorni'}${c.min ? ', circa ' + c.min + '′' : ''}</span></button><div class="chore-bar fresh ${s.cls}">${bar(fr, 'casa')}</div><span class="chip c-due ${s.cls}">${s.txt}</span><button type="button" class="btn tint sm c-done" style="${cv('casa')}" data-act="chore-done" data-id="${c.id}">Fatta</button></li>`; }).join('')}</ul>` : '<p class="empty">Nessuna faccenda qui. Aggiungine una con il tasto in alto.</p>'}</section>
    </div>`;
  };
  A['chore-new'] = () => openChore(null);
  A['chore-edit'] = el => openChore(el.dataset.id);
  function openChore(id) {
    const c = id ? S.chores.find(x => x.id === id) : { name: '', area: 'Generale', every: 7, min: 10 };
    if (!c) return; const { I } = X();
    const logs = id ? (I.choreLogsBy[id] || []).slice(-8).reverse() : [];
    const areas = [...new Set([...C.CHORE_AREAS, ...I.live.chores.map(x => x.area).filter(Boolean)])];
    openModal(`<form id="chore-form" class="form" data-id="${id || ''}">${sheetHead(id ? 'Faccenda' : 'Nuova faccenda')}
      ${field('Nome', `<input class="inp" name="name" value="${esc(c.name)}" required ${id ? '' : 'autofocus'} placeholder="Es. Pulire il forno">`)}
      <div class="form-2">${field('Stanza', `<input class="inp" name="area" list="areas" value="${esc(c.area || 'Generale')}"><datalist id="areas">${areas.map(a => `<option value="${esc(a)}">`).join('')}</datalist>`)}${field('Ogni quanti giorni', `<input class="inp" name="every" type="number" inputmode="numeric" min="1" max="365" value="${c.every}">`)}</div>
      ${field('Minuti stimati', `<input class="inp" name="min" type="number" inputmode="numeric" min="0" max="600" value="${c.min || 0}">`)}
      ${logs.length ? `<div><h3 style="margin-bottom:6px">Ultime volte</h3><p class="small muted">${logs.map(ts => esc(fmtRel(dayKey(ts, I.sh)))).join(', ')}</p></div>` : ''}
      <div class="sheet-foot">${id ? `<button type="button" class="btn ghost danger spacer" data-act="chore-del" data-id="${id}">Elimina</button>` : ''}<button type="button" class="btn ghost" data-act="modal-close">Annulla</button><button class="btn key">${id ? 'Salva' : 'Aggiungi'}</button></div></form>`);
  }
  FORMS['chore-form'] = (f, fd) => {
    const id = f.dataset.id; const n = now();
    const vals = { name: String(fd.get('name') || '').trim(), area: String(fd.get('area') || 'Generale').trim() || 'Generale', every: clamp(Math.round(+fd.get('every') || 7), 1, 365), min: clamp(Math.round(+fd.get('min') || 0), 0, 600) };
    if (!vals.name) return;
    commit(() => { if (id) { const c = S.chores.find(x => x.id === id); if (c) Object.assign(c, vals, { u: n }); } else S.chores.push({ id: uid('c'), ...vals, created: n, base: n, u: n }); });
    closeModal();
  };
  A['chore-del'] = async el => { const id = el.dataset.id; if (await ask('Eliminare la faccenda?', 'Elimina', true)) commit(() => tomb(S.chores, id)); };
