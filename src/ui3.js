  /* ═════════════ Ritmo · interfaccia (parte 3: Progressi, Impostazioni, revisioni, sync, promemoria, avvio) ═════════════ */

  /* ═════════════ PROGRESSI ═════════════ */
  const bucket = sc => (sc >= 80 ? 5 : sc >= 60 ? 4 : sc >= 40 ? 3 : sc >= 20 ? 2 : 1);
  function heatmap(scores, I) {
    const weeks = 26, cs = 14, gap = 3, pl = 24, pt = 18;
    const start = addDays(mondayOf(I.today), -7 * (weeks - 1));
    const w = pl + weeks * (cs + gap), h = pt + 7 * (cs + gap);
    let s = `<svg class="chart heat" viewBox="0 0 ${w} ${h}" role="img" aria-label="Punteggio giornaliero nelle ultime 26 settimane">`;
    ['L', '', 'M', '', 'V', '', 'D'].forEach((l, r) => { if (l) s += `<text class="tick" x="0" y="${pt + r * (cs + gap) + cs - 3}">${l}</text>`; });
    let lastM = -1;
    for (let c = 0; c < weeks; c++) {
      const m = parseDK(addDays(start, c * 7)).getMonth();
      if (m !== lastM && c < weeks - 1) { s += `<text class="tick" x="${pl + c * (cs + gap)}" y="11">${MON_SHORT[m]}</text>`; lastM = m; }
      for (let r = 0; r < 7; r++) {
        const d = addDays(start, c * 7 + r); if (d > I.today) continue;
        const sc = scores[d] ? scores[d].score : null;
        const has = sc !== null && sc !== undefined;
        s += `<rect class="c" x="${pl + c * (cs + gap)}" y="${pt + r * (cs + gap)}" width="${cs}" height="${cs}" rx="3" ${has ? `style="fill:var(--h${bucket(sc)})"` : 'style="fill:none;stroke:var(--line)"'} data-tip="${esc(fmtDateLong(d))}: ${has ? sc + ' punti' : 'nessun dato'}"/>`;
      }
    }
    return s + '</svg>';
  }
  function lineChart(pts, thr) {
    const w = chartW(), h = 170, pl = 32, pr = 10, pt = 14, pb = 24, iw = w - pl - pr, ih = h - pt - pb;
    const x = i => pl + (iw * i) / Math.max(1, pts.length - 1), y = v => pt + ih - (v / 100) * ih;
    let s = `<svg class="chart" viewBox="0 0 ${w} ${h}" role="img" aria-label="Punteggio degli ultimi 30 giorni">`;
    for (const t of [0, 50, 100]) s += `<line class="grid${t === 0 ? ' base' : ''}" x1="${pl}" x2="${w - pr}" y1="${y(t)}" y2="${y(t)}"/><text class="tick" x="${pl - 8}" y="${y(t) + 4}" text-anchor="end">${t}</text>`;
    s += `<line class="goal" x1="${pl}" x2="${w - pr}" y1="${y(thr)}" y2="${y(thr)}"/><text class="tick" x="${w - pr}" y="${y(thr) - 5}" text-anchor="end">soglia serie</text>`;
    const segs = []; let cur = [];
    pts.forEach((p, i) => { if (p.v === null) { if (cur.length) segs.push(cur); cur = []; } else cur.push([x(i), y(p.v)]); });
    if (cur.length) segs.push(cur);
    for (const sg of segs) {
      if (sg.length > 1) s += `<path d="M${sg[0][0]},${y(0)}L${sg.map(p => p.join(',')).join('L')}L${sg[sg.length - 1][0]},${y(0)}Z" style="fill:var(--progressi);opacity:.1"/>`;
      s += `<path d="M${sg.map(p => p.join(',')).join('L')}" fill="none" style="stroke:var(--progressi)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`;
    }
    let lastIdx = -1; pts.forEach((p, i) => { if (p.v !== null) lastIdx = i; });
    if (lastIdx >= 0) s += `<circle cx="${x(lastIdx)}" cy="${y(pts[lastIdx].v)}" r="5" style="fill:var(--progressi);stroke:var(--panel)" stroke-width="2"/><text class="lbl" x="${x(lastIdx) - 8}" y="${y(pts[lastIdx].v) - 10}" text-anchor="end">${pts[lastIdx].v}</text>`;
    const band = iw / Math.max(1, pts.length - 1);
    pts.forEach((p, i) => {
      s += `<rect class="hit" x="${x(i) - band / 2}" y="${pt}" width="${band}" height="${ih}" data-tip="${esc(p.tip)}"/>`;
      if (p.label) s += `<text class="tick" x="${x(i)}" y="${h - 6}" text-anchor="${i === 0 ? 'start' : 'middle'}">${esc(p.label)}</text>`;
    });
    return s + '</svg>';
  }
  VIEWS.progressi = () => {
    const { I, streak, xp, score } = X(); const n = now();
    const sc = score && score.score !== null ? score.score : 0;
    const days30 = [...Array(30)].map((_, i) => addDays(I.today, i - 29));
    const pts = days30.map((d, i) => { const r = streak.scores[d]; const v = r && r.score !== null ? r.score : null; return { v, label: i % 7 === 2 ? parseDK(d).getDate() + ' ' + MON_SHORT[parseDK(d).getMonth()] : '', tip: `${cap(fmtRel(d))}: ${v === null ? 'nessun dato' : v + ' punti'}` }; });
    const last7 = [...Array(7)].map((_, i) => addDays(I.today, -i));
    const keys = [['water', 'acqua', 'Acqua'], ['workout', 'workout', 'Workout'], ['focus', 'lavoro', 'Lavoro'], ['tasks', 'todo', 'Da fare'], ['chores', 'casa', 'Casa'], ['os', 'progressi', 'Daily OS']];
    const avgs = keys.map(([k, a, l]) => { const v = last7.map(d => streak.scores[d] && streak.scores[d].parts[k]).filter(x => x !== undefined && x !== null); return { a, l, v: v.length ? v.reduce((s, x) => s + x, 0) / v.length : null }; });
    const wk = weekKey(I.today); const W = S.weeks[wk] || {};
    const goalsW = W.goals && Array.isArray(W.goals.v) ? W.goals.v : [];
    const lastWeek = C.weekStats(S, I, addDays(mondayOf(I.today), -7), n);
    const ach = C.achievements(S, I, streak, xp);
    const goals = I.live.goals || [];
    return `<div class="view-head"><h1 class="h1"><span class="dot" style="${cv('progressi')}"></span>Progressi</h1><button type="button" class="btn" data-act="weekly">📅 Revisione settimanale</button></div>
    <div class="stack">
      <section class="panel"><div class="stats">
        <div class="stat"><span class="label"><span class="dot" style="${cv('progressi')}"></span>Punteggio di oggi</span><span class="value">${sc} <small>/ 100</small></span></div>
        <div class="stat"><span class="label">Serie attuale</span><span class="value">🔥 ${streak.current} <small>${streak.current === 1 ? 'giorno' : 'giorni'}</small></span><span class="small muted">${streak.jollyReady ? 'Giorno jolly disponibile' : 'Jolly già usato questa settimana'}</span></div>
        <div class="stat"><span class="label">Serie migliore</span><span class="value">${streak.best} <small>${streak.best === 1 ? 'giorno' : 'giorni'}</small></span></div>
        <div class="stat"><span class="label">Livello ${xp.level}</span><span class="value">${fmtN(xp.xp)} <small>XP</small></span>${bar(xp.into / xp.need, 'progressi', '', 'thin')}<span class="small muted">${fmtN(xp.need - xp.into)} XP al livello ${xp.level + 1}</span></div></div>
        <p class="small muted" style="margin-top:12px">La serie conta i giorni con almeno ${streak.threshold} punti. Un giorno storto a settimana è coperto da un jolly: saltare una volta non rovina un’abitudine (Lally et al., 2010).</p></section>
      <section class="panel"><div class="panel-head"><h2>Ultime 26 settimane</h2><div class="legend"><span>meno</span>${[1, 2, 3, 4, 5].map(b => `<i style="background:var(--h${b})"></i>`).join('')}<span>più</span><i style="border:1px solid var(--line);margin-left:8px"></i><span>nessun dato</span></div></div>
        <div class="hscroll">${heatmap(streak.scores, I)}</div>
        ${dataTable(['Giorno', 'Punteggio'], days30.slice().reverse().map(d => [fmtRel(d), streak.scores[d] && streak.scores[d].score !== null ? String(streak.scores[d].score) : '–']))}</section>
      <div class="cols">
        <section class="panel"><div class="panel-head"><h2>Ultimi 30 giorni</h2></div>${lineChart(pts, streak.threshold)}</section>
        <section class="panel"><div class="panel-head"><h2>Media per area, 7 giorni</h2></div>
          ${avgs.map(x => `<div class="hbar"><span class="row" style="gap:8px;flex-wrap:nowrap"><span class="dot" style="${cv(x.a)}"></span>${x.l}</span>${bar(x.v || 0, x.a)}<span class="v">${x.v === null ? '–' : Math.round(x.v * 100) + '%'}</span></div>`).join('')}
          <p class="small muted" style="margin-top:10px">Il punteggio del giorno è la media pesata di queste aree. Workout e lavoro contano solo nei giorni previsti.</p></section>
      </div>
      <div class="cols">
        <section class="panel"><div class="panel-head"><h2>Questa settimana</h2>${W.review && W.review.v ? '<span class="chip st-good">revisione fatta</span>' : ''}</div>
          ${goalsW.length ? `<ul class="list">${goalsW.map((g, i) => `<li style="${cv('progressi')}"><button type="button" class="check ${g.done ? 'on' : ''}" data-act="wgoal" data-i="${i}" aria-label="${esc(g.t)}">${ICON_CHECK}</button><span class="grow" style="${g.done ? 'text-decoration:line-through;color:var(--muted)' : ''}">${esc(g.t)}</span></li>`).join('')}</ul>` : `<p class="empty">Nessun obiettivo per questa settimana. La revisione del lunedì ti aiuta a sceglierne 3.</p>`}
          <hr class="sep"><h3 style="margin-bottom:8px">Settimana scorsa</h3>
          <div class="stats" style="grid-template-columns:repeat(3,minmax(0,1fr))"><div class="stat"><span class="label">Media</span><span class="value" style="font-size:22px">${lastWeek.avg === null ? '–' : lastWeek.avg}</span></div><div class="stat"><span class="label">Workout</span><span class="value" style="font-size:22px">${lastWeek.workouts}</span></div><div class="stat"><span class="label">Lavoro</span><span class="value" style="font-size:22px">${fmtMin(lastWeek.focus)}</span></div><div class="stat"><span class="label">Acqua ok</span><span class="value" style="font-size:22px">${lastWeek.waterHit}/7</span></div><div class="stat"><span class="label">Attività</span><span class="value" style="font-size:22px">${lastWeek.tasks}</span></div><div class="stat"><span class="label">Faccende</span><span class="value" style="font-size:22px">${lastWeek.chores}</span></div></div></section>
        <section class="panel"><div class="panel-head"><h2>Obiettivi a lungo termine</h2><button type="button" class="btn sm" data-act="goal-new">Nuovo</button></div>
          ${goals.length ? goals.map(g => { const span = (+g.target || 0) - (+g.start || 0); const pct = span ? ((+g.current || 0) - (+g.start || 0)) / span : 0; return `<div style="padding:10px 0;border-top:1px solid var(--line)"><div class="row between"><button type="button" class="rowbtn" data-act="goal-edit" data-id="${g.id}"><b>${esc(g.title)}</b><span class="small muted" style="display:block">${fmtN(g.current)} ${esc(g.unit || '')} su ${fmtN(g.target)}${g.deadline ? ', entro ' + esc(fmtRel(g.deadline)) : ''}</span></button><div class="btns"><button type="button" class="btn sm icon" data-act="goal-step" data-id="${g.id}" data-d="-1" aria-label="Diminuisci">−</button><button type="button" class="btn sm icon" data-act="goal-step" data-id="${g.id}" data-d="1" aria-label="Aumenta">+</button></div></div><div style="margin-top:8px">${bar(pct, 'progressi')}</div></div>`; }).join('') : '<p class="empty">Un numero da far crescere nel tempo: iscritti al canale, chilometri corsi, libri letti.</p>'}</section>
      </div>
      <section class="panel"><div class="panel-head"><h2>Traguardi</h2><span class="muted small">${ach.filter(a => a.ok).length} di ${ach.length}</span></div>
        <div class="badges">${ach.map(a => `<div class="badge ${a.ok ? 'on' : 'off'}"><b>${esc(a.name)}</b><span>${esc(a.desc)}</span></div>`).join('')}</div></section>
      <details class="panel"><summary class="h2" style="cursor:pointer">Su cosa si basa Ritmo</summary>
        <ul class="list small" style="margin-top:10px">
          <li><span><b>Registrare i progressi aiuta a raggiungere gli obiettivi.</b> Meta-analisi di 138 studi (19.951 persone): l’effetto è maggiore quando i progressi vengono annotati fisicamente. Harkin et al., Psychological Bulletin 2016.</span></li>
          <li><span><b>I piani “se… allora” funzionano.</b> 94 test indipendenti, effetto medio-grande (d = 0,65). Gollwitzer e Sheeran, 2006.</span></li>
          <li><span><b>Un’abitudine richiede in media 66 giorni</b> (da 18 a 254), e saltare una volta non compromette il processo. Lally et al., 2010.</span></li>
          <li><span><b>Le serie motivano, ma una serie spezzata demotiva.</b> L’effetto si attenua se la serie si può “riparare”: da qui il giorno jolly. Silverman e Barasch, Journal of Consumer Research 2023.</span></li>
          <li><span><b>Gli inizi “puliti” (lunedì, inizio mese) aumentano la motivazione</b>: per questo la revisione è il lunedì. Dai, Milkman e Riis, 2014.</span></li>
          <li><span><b>I piccoli progressi sono il motore più forte della motivazione sul lavoro</b> (circa 12.000 diari). Amabile e Kramer, The Progress Principle, 2011.</span></li>
          <li><span><b>Gamification:</b> effetto piccolo-medio sull’attività fisica in una meta-analisi di 16 RCT; l’effetto a lungo termine è più fragile. Mazeas et al., JMIR 2022. Per questo i punti sono un aiuto, non lo scopo.</span></li>
          <li><span><b>Pause fisse (tipo Pomodoro):</b> evidenza mista. Uno studio le associa a umore migliore e stessa resa in meno tempo (Biwer et al., 2023), un altro a più fatica (Smits et al., 2025). Il timer qui parte da blocchi da 15 minuti e puoi scegliere.</span></li>
        </ul></details>
    </div>`;
  };
  A.wgoal = el => {
    const wk = weekKey(X().I.today); const W = S.weeks[wk]; if (!W || !W.goals) return;
    const arr = W.goals.v.map((g, i) => (i === +el.dataset.i ? { ...g, done: !g.done } : g));
    commit(() => { S.weeks[wk].goals = { v: arr, u: now() }; }, { xp: arr[+el.dataset.i].done ? 5 : 0 });
  };
  A['goal-new'] = () => openGoal(null);
  A['goal-edit'] = el => openGoal(el.dataset.id);
  function openGoal(id) {
    const g = id ? S.goals.find(x => x.id === id) : { title: '', unit: '', start: 0, target: 100, current: 0, deadline: '' };
    if (!g) return;
    openModal(`<form id="goal-form" class="form" data-id="${id || ''}">${sheetHead(id ? 'Obiettivo' : 'Nuovo obiettivo')}
      ${field('Titolo', `<input class="inp" name="title" value="${esc(g.title)}" required ${id ? '' : 'autofocus'} placeholder="Es. Iscritti al canale">`)}
      <div class="form-2">${field('Partenza', `<input class="inp" name="start" type="number" step="any" value="${esc(g.start)}">`)}${field('Traguardo', `<input class="inp" name="target" type="number" step="any" value="${esc(g.target)}">`)}</div>
      <div class="form-2">${field('Valore attuale', `<input class="inp" name="current" type="number" step="any" value="${esc(g.current)}">`)}${field('Unità', `<input class="inp" name="unit" value="${esc(g.unit || '')}" placeholder="kg, km, iscritti">`)}</div>
      ${field('Entro (opzionale)', `<input class="inp" name="deadline" type="date" value="${esc(g.deadline || '')}">`)}
      <div class="sheet-foot">${id ? `<button type="button" class="btn ghost danger spacer" data-act="goal-del" data-id="${id}">Elimina</button>` : ''}<button type="button" class="btn ghost" data-act="modal-close">Annulla</button><button class="btn key">Salva</button></div></form>`);
  }
  FORMS['goal-form'] = (f, fd) => {
    const id = f.dataset.id; const n = now();
    const v = { title: String(fd.get('title') || '').trim(), unit: String(fd.get('unit') || '').trim(), start: +fd.get('start') || 0, target: +fd.get('target') || 0, current: +fd.get('current') || 0, deadline: fd.get('deadline') || null };
    if (!v.title) return;
    commit(() => { if (id) Object.assign(S.goals.find(x => x.id === id) || {}, v, { u: n }); else S.goals.push({ id: uid('g'), ...v, created: n, u: n }); });
    closeModal();
  };
  A['goal-step'] = el => { const g = S.goals.find(x => x.id === el.dataset.id); if (g) commit(() => { g.current = Math.round(((+g.current || 0) + +el.dataset.d) * 100) / 100; g.u = now(); }); };
  A['goal-del'] = async el => { const id = el.dataset.id; if (await ask('Eliminare l’obiettivo?', 'Elimina', true)) commit(() => tomb(S.goals, id)); };

  /* ───────────── revisioni ───────────── */
  function scaleHTML(name, emojis, val) {
    return `<div class="scale" data-scale="${name}">${emojis.map((e, i) => `<button type="button" data-act="scale" data-v="${i + 1}" aria-pressed="${val === i + 1}" aria-label="${i + 1} su 5">${e}</button>`).join('')}</div>`;
  }
  A.scale = el => { const box = el.closest('[data-scale]'); $$('button', box).forEach(b => b.setAttribute('aria-pressed', b === el && b.getAttribute('aria-pressed') !== 'true')); };
  const scaleVal = name => { const b = $(`[data-scale="${name}"] [aria-pressed="true"]`); return b ? +b.dataset.v : null; };
  function openReview() {
    const { I, score } = X(); const rv = dayVal(I.today, 'review') || {};
    const wins = winsToday();
    openModal(`<form id="review-form" class="form">${sheetHead('Revisione serale')}
      <div class="banner" style="${cv('progressi')}"><span style="font-size:24px" aria-hidden="true">🏁</span><p><b>${score && score.score !== null ? score.score : 0} punti oggi, ${wins.length} ${wins.length === 1 ? 'vittoria' : 'vittorie'}.</b> ${wins.slice(0, 3).map(w => esc(w[1])).join(', ')}</p></div>
      <div class="field"><span>Energia di oggi</span>${scaleHTML('energy', ['😴', '😕', '😐', '🙂', '⚡'], dayVal(I.today, 'energy'))}</div>
      <div class="field"><span>Umore</span>${scaleHTML('mood', ['😞', '🙁', '😐', '🙂', '😄'], dayVal(I.today, 'mood'))}</div>
      ${field('Cosa è andato bene?', `<textarea class="inp" name="good" placeholder="Anche una cosa piccola">${esc(rv.good || '')}</textarea>`)}
      ${field('Cosa miglioro domani?', `<input class="inp" name="better" value="${esc(rv.better || '')}" placeholder="Una sola cosa">`)}
      ${field('La prima cosa di domani', `<input class="inp" name="first" placeholder="Es. 15 minuti sullo script del video">`, 'Diventa la prima priorità di domani: al risveglio sai già da dove partire.')}
      <div class="sheet-foot"><button type="button" class="btn ghost" data-act="modal-close">Annulla</button><button class="btn key">Chiudi la giornata</button></div></form>`);
  }
  FORMS['review-form'] = (f, fd) => {
    const { I } = X(); const first = String(fd.get('first') || '').trim(); const tomorrow = addDays(I.today, 1); const n = now();
    commit(() => {
      setDay(I.today, 'review', { good: String(fd.get('good') || '').trim(), better: String(fd.get('better') || '').trim() });
      const e = scaleVal('energy'), m = scaleVal('mood'); if (e) setDay(I.today, 'energy', e); if (m) setDay(I.today, 'mood', m);
      if (first) S.tasks.push({ id: uid('t'), title: first, due: tomorrow, star: tomorrow, prio: 1, created: n, u: n });
    }, { xp: 15 });
    closeModal(); beep('goal'); toast('Giornata chiusa. Buon riposo.');
  };
  function openWeekly() {
    const { I } = X(); const n = now(); const lastMon = addDays(mondayOf(I.today), -7);
    const ws = C.weekStats(S, I, lastMon, n); const wk = weekKey(I.today); const W = S.weeks[wk] || {};
    const rv = (W.review && W.review.v) || {}; const gs = (W.goals && W.goals.v) || [];
    openModal(`<form id="weekly-form" class="form">${sheetHead('Revisione settimanale')}
      <p class="sub">Settimana dal ${parseDK(lastMon).getDate()} ${MON_SHORT[parseDK(lastMon).getMonth()]}. Guarda i numeri, poi scegli solo 3 obiettivi.</p>
      <div class="stats" style="grid-template-columns:repeat(3,minmax(0,1fr))">${[['Punteggio medio', ws.avg === null ? '–' : ws.avg], ['Acqua ok', ws.waterHit + '/7'], ['Workout', ws.workouts + '/' + S.settings.workout.perWeek], ['Lavoro', fmtMin(ws.focus)], ['Attività fatte', ws.tasks], ['Faccende', ws.chores]].map(([l, v]) => `<div class="stat"><span class="label">${l}</span><span class="value" style="font-size:24px">${v}</span></div>`).join('')}</div>
      ${field('La vittoria più grande', `<textarea class="inp" name="big" placeholder="Di cosa sei soddisfatto?">${esc(rv.big || '')}</textarea>`)}
      ${field('Cosa cambio questa settimana?', `<input class="inp" name="fix" value="${esc(rv.fix || '')}" placeholder="Una regola, un orario, un ostacolo da togliere">`)}
      <div class="field"><span>3 obiettivi per questa settimana</span>${[0, 1, 2].map(i => `<input class="inp" name="g${i}" value="${esc((gs[i] || {}).t || '')}" placeholder="Obiettivo ${i + 1}" style="margin-top:${i ? 8 : 0}px">`).join('')}</div>
      <div class="sheet-foot"><button type="button" class="btn ghost" data-act="modal-close">Annulla</button><button class="btn key">Salva la revisione</button></div></form>`, { wide: true });
  }
  A.weekly = () => openWeekly();
  FORMS['weekly-form'] = (f, fd) => {
    const { I } = X(); const wk = weekKey(I.today); const n = now();
    const old = (S.weeks[wk] && S.weeks[wk].goals && S.weeks[wk].goals.v) || [];
    const goals = [0, 1, 2].map(i => String(fd.get('g' + i) || '').trim()).filter(Boolean).map(t => ({ t, done: !!(old.find(g => g.t === t) || {}).done }));
    const was = S.weeks[wk] && S.weeks[wk].review && S.weeks[wk].review.v;
    commit(() => {
      S.weeks[wk] = S.weeks[wk] && typeof S.weeks[wk] === 'object' ? S.weeks[wk] : {};
      S.weeks[wk].review = { v: { big: String(fd.get('big') || '').trim(), fix: String(fd.get('fix') || '').trim(), of: weekKey(addDays(I.today, -7)) }, u: n };
      S.weeks[wk].goals = { v: goals, u: n };
    }, { xp: was ? 0 : 30 });
    closeModal(); toast('Revisione salvata. Buona settimana.'); if (!was) confetti();
  };
  A.top3 = () => openTop3();
  A.review = () => openReview();

  /* ═════════════ IMPOSTAZIONI ═════════════ */
  const fNum = (path, label, o = {}) => field(label, `<input class="inp" type="number" inputmode="decimal" data-set="${path}" data-kind="num" value="${esc(getPath(S.settings, path))}" min="${o.min == null ? 0 : o.min}" max="${o.max == null ? 99999 : o.max}" step="${o.step || 1}">`, o.hint || '');
  const fTime = (path, label, hint = '') => field(label, `<input class="inp" type="time" data-set="${path}" value="${esc(getPath(S.settings, path))}">`, hint);
  const fText = (path, label, ph = '', hint = '') => field(label, `<input class="inp" data-set="${path}" value="${esc(getPath(S.settings, path) || '')}" placeholder="${esc(ph)}">`, hint);
  const fDays = (path, label, area) => `<div class="field"><span>${label}</span><div class="wd" style="${cv(area)}" role="group" aria-label="${esc(label)}">${[1, 2, 3, 4, 5, 6, 0].map(d => `<button type="button" data-act="set-day" data-path="${path}" data-d="${d}" aria-pressed="${(getPath(S.settings, path) || []).includes(d)}" aria-label="${WD_SHORT[d]}">${WD_LETTER[d]}</button>`).join('')}</div></div>`;
  const sw = (label, checked, attrs) => `<div class="toggle"><span>${label}</span><label class="switch"><input type="checkbox" ${attrs} ${checked ? 'checked' : ''}><i></i></label></div>`;
  function notifState() {
    if (!('Notification' in window)) return 'non supportate su questo browser';
    if (Notification.permission === 'granted') return D.notify ? 'attive' : 'permesso dato, disattivate';
    if (Notification.permission === 'denied') return 'bloccate nelle impostazioni del browser';
    return 'non ancora attivate';
  }
  const baseURL = () => location.origin + location.pathname;
  VIEWS.impostazioni = () => {
    const st = S.settings; const tok = store.get(LS.token, ''); const last = store.get(LS.lastSync, 0);
    const backup = store.get(LS.backup, null);
    return `<div class="view-head"><h1 class="h1">Impostazioni</h1></div>
    <div class="stack">
      <section class="panel"><div class="panel-head"><h2>Tu e la giornata</h2></div><div class="form">
        <div class="form-2">${fText('name', 'Nome', 'Come vuoi essere salutato')}${fTime('wake', 'Sveglia')}</div>
        <div class="form-2">${fNum('dayStart', 'La giornata finisce alle (ora)', { min: 0, max: 8, hint: 'Con 4, quello che fai fino alle 4 di notte conta per il giorno prima.' })}${fNum('threshold', 'Soglia della serie (punti)', { min: 10, max: 100, hint: 'Giorni sopra questa soglia allungano la serie.' })}</div>
        <div class="form-2">${field('Tema', `<select class="inp" data-dev="theme">${[['auto', 'Automatico'], ['light', 'Chiaro'], ['dark', 'Scuro']].map(([k, l]) => `<option value="${k}" ${D.theme === k ? 'selected' : ''}>${l}</option>`).join('')}</select>`)}<div>${sw('Suoni di conferma', D.sound, 'data-dev="sound"')}</div></div>
      </div></section>

      <section class="panel" id="sec-os"><div class="panel-head"><h2>Il ritmo di oggi</h2><button type="button" class="btn sm ghost" data-act="os-reset">Ripristina predefiniti</button></div>
        <p class="sub small" style="margin-bottom:10px">La sequenza che vedi in Oggi, un passo dopo l’altro. I passi collegati (acqua, priorità, lavoro, casa, workout, revisione) si accendono da soli quando registri l’azione.</p>
        <ol class="list">${st.os.map((o, i) => `<li class="row" style="flex-wrap:wrap;gap:8px"><input class="inp sm" style="width:54px;text-align:center" data-os="${i}" data-k="emoji" value="${esc(o.emoji || '')}" aria-label="Emoji"><input class="inp sm" style="flex:1;min-width:180px" data-os="${i}" data-k="label" value="${esc(o.label)}" aria-label="Nome del passo"><select class="inp sm" style="width:auto" data-os="${i}" data-k="type" aria-label="Tipo">${Object.entries(C.OS_TYPES).map(([k, v]) => `<option value="${k}" ${o.type === k ? 'selected' : ''}>${v.name}</option>`).join('')}</select><input class="inp sm" style="width:auto" type="time" data-os="${i}" data-k="time" value="${esc(o.time || '')}" aria-label="Orario"><label class="small row" style="gap:6px"><input type="checkbox" data-os="${i}" data-k="workoutDaysOnly" ${o.workoutDaysOnly ? 'checked' : ''}>solo giorni workout</label><span class="row" style="gap:2px"><button type="button" class="btn sm icon ghost" data-act="os-move" data-i="${i}" data-d="-1" aria-label="Sposta su">↑</button><button type="button" class="btn sm icon ghost" data-act="os-move" data-i="${i}" data-d="1" aria-label="Sposta giù">↓</button><button type="button" class="btn sm icon ghost danger" data-act="os-del" data-i="${i}" aria-label="Elimina passo">✕</button></span></li>`).join('')}</ol>
        <div class="btns" style="margin-top:10px"><button type="button" class="btn" data-act="os-add">Aggiungi passo</button></div></section>

      <div class="cols">
        <section class="panel" style="${cv('acqua')}"><div class="panel-head"><h2>Acqua</h2></div><div class="form">
          <div class="form-2">${fNum('water.goal', 'Obiettivo (ml)', { step: 50 })}${fNum('water.bonus', 'In più nei giorni di workout', { step: 50 })}</div>
          <div class="form-2">${fNum('water.glass', 'Bicchiere standard (ml)', { step: 10 })}${field('Pulsanti rapidi (ml)', `<input class="inp" data-set="water.sizes" data-kind="list" value="${esc(st.water.sizes.join(', '))}">`)}</div>
          <div class="form-2">${fTime('water.start', 'Dalle')}${fTime('water.end', 'Alle')}</div>
          ${fNum('water.every', 'Promemoria se non bevi da (minuti)', { min: 20, max: 300, step: 5 })}</div></section>
        <section class="panel" style="${cv('workout')}"><div class="panel-head"><h2>Workout</h2></div><div class="form">
          ${fNum('workout.perWeek', 'Sessioni a settimana', { min: 1, max: 14 })}${fDays('workout.days', 'Giorni previsti', 'workout')}${fTime('workout.time', 'Orario')}</div></section>
        <section class="panel" style="${cv('lavoro')}"><div class="panel-head"><h2>Lavoro</h2></div><div class="form">
          ${fNum('work.target', 'Obiettivo al giorno (minuti)', { min: 15, max: 720, step: 15 })}${fDays('work.days', 'Giorni di lavoro', 'lavoro')}${fTime('work.start', 'Primo blocco alle')}
          ${field('Modalità predefinita', `<select class="inp" data-set="work.mode">${Object.entries(C.FOCUS_MODES).map(([k, v]) => `<option value="${k}" ${st.work.mode === k ? 'selected' : ''}>${v.name}</option>`).join('')}</select>`)}</div></section>
        <section class="panel"><div class="panel-head"><h2>Promemoria</h2></div>
          <p class="sub small">Notifiche: <b>${notifState()}</b>. Sul Mac arrivano mentre Ritmo è aperto (anche ridotto a icona nel Dock).</p>
          <div class="btns" style="margin:10px 0 6px"><button type="button" class="btn key sm" data-act="notif-on">Attiva notifiche</button><button type="button" class="btn sm" data-act="notif-test">Prova</button></div>
          ${sw('💧 Acqua, quando sei indietro', st.remind.water, 'data-set="remind.water"')}${sw('🏋️ Workout nei giorni previsti', st.remind.workout, 'data-set="remind.workout"')}${sw('⏱️ Primo blocco di lavoro', st.remind.work, 'data-set="remind.work"')}${sw('🧽 Faccende in ritardo', st.remind.chores, 'data-set="remind.chores"')}${sw('🌙 Revisione serale', st.remind.review, 'data-set="remind.review"')}${sw('📅 Revisione del lunedì', st.remind.weekly, 'data-set="remind.weekly"')}
          <div class="form-2" style="margin-top:10px">${fTime('chores.time', 'Faccende alle')}${fTime('review.time', 'Revisione serale alle')}</div>
          <hr class="sep"><h3>Su iPhone (e sul Mac ad app chiusa)</h3><p class="sub small" style="margin:6px 0 10px">Una web app non può programmare notifiche da sola senza un server. La soluzione gratuita: esporta questi promemoria come calendario. Aprilo sul Mac, importalo in un calendario iCloud chiamato “Ritmo” e arriveranno come notifiche native anche su iPhone.</p>
          <button type="button" class="btn" data-act="ics">Esporta promemoria (.ics)</button></section>
      </div>

      <section class="panel" id="sec-sync"><div class="panel-head"><h2>Sincronizzazione Mac ↔ iPhone</h2>${tok ? '<span class="chip st-good">attiva</span>' : ''}</div>
        ${tok ? `<p class="sub">${esc(syncMini())}${last ? '' : ''}</p><p class="small muted" style="margin-top:6px">I dati viaggiano in un tuo Gist segreto su GitHub. Il token resta solo su questo dispositivo e non finisce nei backup.</p>
          <div class="btns" style="margin-top:12px"><button type="button" class="btn key" data-act="sync-now">Sincronizza ora</button><button type="button" class="btn ghost danger" data-act="sync-off">Scollega</button></div>`
        : `<p class="sub">Gratis, senza account nuovi se hai già GitHub. Funziona così:</p>
          <ol class="small" style="padding-left:20px;line-height:1.7;margin:8px 0 12px"><li><a href="https://github.com/settings/tokens/new?scopes=gist&description=Ritmo%20sync" target="_blank" rel="noopener">Crea un token su GitHub</a> con il solo permesso <b>gist</b> (il link lo preimposta).</li><li>Incollalo qui sotto e premi Collega: Ritmo crea un Gist segreto con i tuoi dati.</li><li>Sull’altro dispositivo incolla lo stesso token: trova il Gist e unisce i dati.</li></ol>
          <form id="sync-form" class="row" autocomplete="off"><label class="sr" for="sync-token">Token GitHub</label><input class="inp grow" id="sync-token" type="password" placeholder="ghp_…" autocomplete="off" spellcheck="false"><button class="btn key">Collega</button></form>
          <p class="small muted" style="margin-top:8px">Un Gist segreto non compare in pubblico, ma chi ha il link può leggerlo: non scrivere qui dati sensibili. Puoi revocare il token quando vuoi.</p>`}
        ${Sync.err ? `<p class="chip st-crit" style="margin-top:10px">${esc(Sync.err)}</p>` : ''}</section>

      ${extraSettings()}
      <div class="cols">
        <section class="panel"><div class="panel-head"><h2>Dati e backup</h2></div>
          <p class="sub small">Tutto resta su questo dispositivo${tok ? ' e nel tuo Gist' : ''}. Esporta un backup ogni tanto.</p>
          <div class="btns" style="margin-top:12px"><button type="button" class="btn" data-act="export">Esporta backup</button><label class="btn">Importa backup<input type="file" accept="application/json,.json" id="import-file" class="sr"></label>${backup ? '<button type="button" class="btn ghost" data-act="restore">Ripristina prima dell’ultima sync</button>' : ''}</div>
          <hr class="sep"><button type="button" class="btn ghost danger" data-act="reset">Cancella tutti i dati</button></section>
        <section class="panel"><div class="panel-head"><h2>Installa e scorciatoie</h2></div>
          <ul class="list small">
            <li><span><b>Mac:</b> apri Ritmo in Safari, poi File → Aggiungi al Dock. Diventa un’app con finestra e icona sue (macOS Sonoma o successivo).</span></li>
            <li><span><b>iPhone:</b> in Safari tocca Condividi → Aggiungi alla schermata Home. Da iOS 26 si apre come app; serve iOS 16.4+ per le notifiche web.</span></li>
            <li><span><b>Comandi Rapidi e Back Tap:</b> crea un comando “Apri URL” con il link qui sotto e assegnalo a Impostazioni → Accessibilità → Tocco → Tocca il retro. Doppio tocco sul retro dell’iPhone = un bicchiere registrato. Su iPhone l’app sulla Home ha dati separati da Safari: per questo serve la sync attiva.</span></li>
          </ul>
          ${[['Bevi un bicchiere', '?add=water&ml=' + st.water.glass], ['Avvia un blocco da 15′', '?focus=start'], ['Apri Da fare', '#todo']].map(([l, q]) => `<div class="row" style="margin-top:8px;flex-wrap:nowrap"><span class="small grow ellip"><b>${l}:</b> <span class="muted">${esc(baseURL() + q)}</span></span><button type="button" class="btn sm" data-act="copy" data-text="${esc(baseURL() + q)}">Copia</button></div>`).join('')}
          <p class="small muted" style="margin-top:12px">Tastiera sul Mac: ⌘K comandi, 1–8 sezioni, W acqua, N nuova attività, F timer, ? aiuto. Versione ${VERSION}.</p></section>
      </div>
    </div>`;
  };
  A['set-day'] = el => {
    const path = el.dataset.path, d = +el.dataset.d;
    commit(() => { const arr = (getPath(S.settings, path) || []).slice(); const i = arr.indexOf(d); if (i >= 0) arr.splice(i, 1); else arr.push(d); setPath(S.settings, path, arr.sort()); S.settings.u = now(); });
  };
  A['os-add'] = () => commit(() => { S.settings.os.push({ id: uid('os'), type: 'custom', label: 'Nuovo passo', emoji: '✨', time: '' }); S.settings.u = now(); });
  A['os-del'] = el => commit(() => { S.settings.os.splice(+el.dataset.i, 1); S.settings.u = now(); });
  A['os-move'] = el => {
    const i = +el.dataset.i, j = i + +el.dataset.d, os = S.settings.os; if (j < 0 || j >= os.length) return;
    commit(() => { [os[i], os[j]] = [os[j], os[i]]; S.settings.u = now(); });
  };
  A['os-reset'] = async () => { if (await ask('Ripristinare i passi predefiniti?', 'Ripristina')) commit(() => { S.settings.os = C.defaultOS(); S.settings.u = now(); }); };
  document.addEventListener('change', e => {
    const el = e.target; if (!el.dataset) return;
    if (el.dataset.set) {
      let v = el.type === 'checkbox' ? el.checked : el.value;
      if (el.dataset.kind === 'num') { v = Number(v); if (!isFinite(v) || el.value === '') return render(); }
      if (el.dataset.kind === 'list') { v = String(v).split(/[^0-9]+/).map(Number).filter(x => x > 0 && x < 5000).slice(0, 6); if (!v.length) return render(); }
      commit(() => { setPath(S.settings, el.dataset.set, v); S.settings.u = now(); });
    } else if (el.dataset.os !== undefined) {
      const o = S.settings.os[+el.dataset.os]; if (!o) return;
      commit(() => { o[el.dataset.k] = el.type === 'checkbox' ? el.checked : el.value; S.settings.u = now(); });
    } else if (el.dataset.dev) {
      D[el.dataset.dev] = el.type === 'checkbox' ? el.checked : el.value; saveDevice(); applyTheme(); render();
    } else if (el.id === 'import-file' && el.files && el.files[0]) importJSON(el.files[0]);
  });
  A.copy = async el => { try { await navigator.clipboard.writeText(el.dataset.text); toast('Copiato'); } catch (e) { toast('Copia non riuscita: seleziona il testo a mano.', 'warn'); } };

  /* ───────────── dati: export, import, reset ───────────── */
  function download(name, text, type) {
    const blob = new Blob([text], { type }); const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }
  function exportJSON() { download('ritmo-backup-' + X().I.today + '.json', JSON.stringify(S), 'application/json'); toast('Backup esportato'); }
  A.export = exportJSON;
  async function importJSON(file) {
    let data; try { data = JSON.parse(await file.text()); } catch (e) { return toast('Il file non è un backup valido.', 'warn'); }
    if (!data || typeof data !== 'object' || !data.settings) return toast('Il file non sembra un backup di Ritmo.', 'warn');
    const ok = await ask('Importare il backup?', 'Unisci ai dati attuali', false, 'Unire è sicuro: per ogni elemento vince la versione più recente.');
    if (!ok) return;
    store.set(LS.backup, { at: now(), data: S });
    S = C.normalize(C.merge(S, data), now()); ver++; save(); render(); scheduleSync(); toast('Backup importato e unito.');
  }
  A.restore = async () => {
    const b = store.get(LS.backup, null); if (!b) return;
    if (!(await ask('Ripristinare i dati com’erano prima dell’ultima sincronizzazione?', 'Ripristina', true, 'Salvato alle ' + fmtTime(b.at) + '. Le modifiche successive andranno perse su questo dispositivo.'))) return;
    S = C.normalize(b.data, now()); S.settings.u = now(); ver++; save(); render(); toast('Dati ripristinati.');
  };
  A.reset = async () => {
    if (!(await ask('Cancellare tutti i dati di Ritmo su questo dispositivo?', 'Cancella tutto', true, 'Esporta prima un backup se vuoi conservarli. Con la sync attiva, scollegala prima: altrimenti i dati tornano dal Gist.'))) return;
    store.set(LS.backup, { at: now(), data: S });
    S = C.emptyState(now()); ver++; save(); render(); openOnboarding();
  };
  A.ics = () => { const { text, count } = C.buildICS(S, now()); download('ritmo-promemoria.ics', text, 'text/calendar'); toast(count + ' promemoria esportati. Aprili con Calendario.'); };

  /* ═════════════ SYNC (GitHub Gist segreto) ═════════════ */
  const GIST_FILE = 'ritmo-data.json', GIST_DESC = 'Ritmo · dati sincronizzati (non modificare)';
  const Sync = {
    busy: false, again: false, err: '', last: 0,
    token() { return store.get(LS.token, ''); },
    async api(path, opt = {}) {
      const res = await fetch('https://api.github.com' + path, {
        method: opt.method || 'GET', cache: 'no-store', body: opt.body,
        headers: Object.assign({ Accept: 'application/vnd.github+json', Authorization: 'Bearer ' + this.token(), 'X-GitHub-Api-Version': '2022-11-28' }, opt.body ? { 'Content-Type': 'application/json' } : {}),
      });
      if (!res.ok) { const e = new Error('HTTP ' + res.status); e.status = res.status; throw e; }
      return res.status === 204 ? null : res.json();
    },
    async gistId() {
      let id = store.get(LS.gist, ''); if (id) return id;
      for (let page = 1; page <= 10 && !id; page++) {
        const list = await this.api('/gists?per_page=100&page=' + page);
        const g = (list || []).find(x => x.files && x.files[GIST_FILE] && x.description === GIST_DESC);
        if (g) id = g.id; if (!list || list.length < 100) break;
      }
      if (!id) {
        const g = await this.api('/gists', { method: 'POST', body: JSON.stringify({ description: GIST_DESC, public: false, files: { [GIST_FILE]: { content: JSON.stringify(S) } } }) });
        id = g.id;
      }
      store.set(LS.gist, id); return id;
    },
    async run() {
      if (!this.token()) return;
      if (this.busy) { this.again = true; return; }
      this.busy = true; this.err = ''; updateSyncUI();
      try {
        const id = await this.gistId();
        const g = await this.api('/gists/' + id);
        const f = g.files && g.files[GIST_FILE];
        let remote = null;
        if (f) {
          let content = f.content;
          if (f.truncated && f.raw_url) content = await (await fetch(f.raw_url, { cache: 'no-store' })).text();
          try { remote = JSON.parse(content); } catch (e) { remote = null; }
        }
        const n = now();
        const merged = C.prune(C.normalize(C.merge(S, remote), n), n);
        const mergedC = C.canon(merged);
        if (mergedC !== C.canon(S)) {
          store.set(LS.backup, { at: n, data: S });
          S = merged;
          ver++; save(); if (!$('#modal')) render();
          log('info', 'sync', 'dati aggiornati dal Gist');
        }
        if (!remote || mergedC !== C.canon(C.normalize(remote, n))) await this.api('/gists/' + id, { method: 'PATCH', body: JSON.stringify({ files: { [GIST_FILE]: { content: JSON.stringify(merged) } } }) });
        this.last = now(); store.set(LS.lastSync, this.last);
      } catch (e) {
        this.err = e.status === 401 ? 'Token non valido o scaduto: creane uno nuovo' : e.status === 404 ? 'Gist non trovato: lo ricreo al prossimo tentativo' : e.status === 403 || e.status === 429 ? 'GitHub rifiuta: controlla che il token abbia il permesso gist' : 'Offline: riprovo più tardi';
        if (e.status === 404) store.del(LS.gist);
        log('error', 'sync', this.err + (e.status ? ' (HTTP ' + e.status + ')' : ' (' + e.message + ')'));
      } finally {
        this.busy = false; updateSyncUI();
        if (this.again) { this.again = false; setTimeout(() => this.run(), 400); }
      }
    },
  };
  function syncMini() {
    if (!store.get(LS.token, '')) return 'Sync non attiva';
    if (Sync.busy) return 'Sincronizzo…';
    if (Sync.err) return '⚠️ ' + Sync.err;
    const last = store.get(LS.lastSync, 0);
    return last ? 'Sincronizzato alle ' + fmtTime(last) : 'Sync attiva';
  }
  function updateSyncUI() { const m = $('#sync-mini'); if (m) m.textContent = syncMini(); if (view === 'impostazioni' && !$('#modal') && !(document.activeElement && document.activeElement.closest && document.activeElement.closest('#main input, #main select, #main textarea'))) render(); }
  let syncTimer = null;
  function scheduleSync() { if (!store.get(LS.token, '')) return; clearTimeout(syncTimer); syncTimer = setTimeout(() => Sync.run(), 6000); }
  FORMS['sync-form'] = async () => {
    const tok = ($('#sync-token').value || '').trim(); if (!tok) return;
    store.set(LS.token, tok); store.del(LS.gist); Sync.err = '';
    toast('Collego GitHub…'); await Sync.run();
    if (Sync.err) { toast(Sync.err, 'warn'); store.del(LS.token); } else toast('Sync attiva. Ora incolla lo stesso token sull’altro dispositivo.');
    render();
  };
  A['sync-now'] = async () => { await Sync.run(); toast(Sync.err ? Sync.err : 'Sincronizzato', Sync.err ? 'warn' : ''); };
  A['sync-off'] = async () => { if (await ask('Scollegare la sincronizzazione su questo dispositivo?', 'Scollega', true, 'I dati restano qui e nel Gist; il token viene rimosso da questo dispositivo.')) { store.del(LS.token); store.del(LS.gist); store.del(LS.lastSync); Sync.err = ''; render(); } };

  /* ═════════════ NOTIFICHE E PROMEMORIA ═════════════ */
  let swReg = null;
  function notify(title, body, tag) {
    toast(title + (body ? '. ' + body : ''));
    if (tag === 'focus') beep('end');
    if (!D.notify || !('Notification' in window) || Notification.permission !== 'granted') return;
    if (document.visibilityState === 'visible' && document.hasFocus()) return;
    try {
      if (swReg && swReg.showNotification) swReg.showNotification(title, { body, tag: tag || 'ritmo', icon: 'icons/icon-192.png', badge: 'icons/icon-192.png' });
      else new Notification(title, { body, tag: tag || 'ritmo', icon: 'icons/icon-192.png' });
    } catch (e) { /* nulla */ }
  }
  A['notif-on'] = async () => {
    if (!('Notification' in window)) return toast('Questo browser non supporta le notifiche. Su iPhone aggiungi prima Ritmo alla schermata Home.', 'warn');
    let p = Notification.permission; if (p === 'default') p = await Notification.requestPermission();
    D.notify = p === 'granted'; saveDevice(); render();
    toast(D.notify ? 'Notifiche attive' : 'Permesso negato: puoi cambiarlo nelle impostazioni del browser.', D.notify ? '' : 'warn');
  };
  A['notif-test'] = () => {
    if (D.notify && 'Notification' in window && Notification.permission === 'granted') {
      try { if (swReg && swReg.showNotification) swReg.showNotification('💧 Prova di Ritmo', { body: 'Le notifiche funzionano.', icon: 'icons/icon-192.png' }); else new Notification('💧 Prova di Ritmo', { body: 'Le notifiche funzionano.' }); } catch (e) { /* nulla */ }
    }
    toast('💧 Prova: se le notifiche sono attive, ne vedi una anche dal sistema.');
  };
  function checkReminders() {
    const { I } = X(); const n = now(); const st = S.settings; const r = st.remind || {};
    const fired = store.get(LS.fired, {}) || {}; const today = I.today;
    let t = C.minOfDay(n); if (t < st.dayStart * 60) t += 1440;
    let changed = false;
    const once = (key, from, cond, fn) => {
      const k = today + ':' + key; if (fired[k] || t < from || t > from + 120) return;
      if (cond()) { fired[k] = n; changed = true; fn(); }
    };
    const wd = weekdayOf(today);
    if (r.water) {
      const pc = C.waterPace(S, I, n); const gap = Math.max(20, +st.water.every || 90) * 60000;
      const lastAct = Math.max(I.waterLast[today] || 0, fired[today + ':water'] || 0, C.dayStartTs(today, 0) + hm(st.water.start) * 60000);
      if (t >= hm(st.water.start) && t <= hm(st.water.end) && pc.ml < pc.goal && pc.delta < 0 && n - lastAct >= gap) {
        fired[today + ':water'] = n; changed = true;
        notify('💧 Bevi un bicchiere', `Sei a ${fmtMl(pc.ml)} su ${fmtMl(pc.goal)}.`, 'water');
      }
    }
    if (r.workout && st.workout.days.includes(wd)) once('workout', hm(st.workout.time), () => !(I.workoutsByDay[today] || []).length, () => notify('🏋️ Oggi è giorno di workout', st.workout.plan || 'Anche il circuito da 20 minuti conta.', 'workout'));
    if (r.work && st.work.days.includes(wd)) once('work', hm(st.work.start), () => !(I.focusByDay[today] || 0) && S.timer.status === 'idle', () => { const p = C.projectOfDay(S, I, today); notify('⏱️ Primo blocco: 15 minuti', p ? p.name + (p.nextAction ? ': ' + p.nextAction : '') : 'Solo il primo passo.', 'work'); });
    if (r.chores) once('chores', hm(st.chores.time), () => I.live.chores.some(c => C.freshness(I, c, n) <= 0), () => { const c = topChore(); notify('🧽 Una faccenda di casa', c ? c.name : '', 'chores'); });
    if (r.review) once('review', hm(st.review.time), () => !dayVal(today, 'review'), () => notify('🌙 Revisione serale', 'Due minuti per chiudere la giornata.', 'review'));
    if (r.weekly && wd === 1) once('weekly', hm(st.review.weeklyTime), () => { const W = S.weeks[weekKey(today)]; return !(W && W.review && W.review.v); }, () => notify('📅 Nuova settimana', 'Revisione e 3 obiettivi: 5 minuti.', 'weekly'));
    if (changed) { for (const k of Object.keys(fired)) if (!k.startsWith(today) && !k.startsWith(addDays(today, -1))) delete fired[k]; store.set(LS.fired, fired); }
  }

  /* ═════════════ COMANDI (⌘K), MENU ALTRO, AIUTO ═════════════ */
  const normQ = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  function commands(q) {
    const { I } = X(); const L = [];
    S.settings.water.sizes.forEach(ml => L.push({ e: '💧', t: `Acqua +${ml} ml`, k: 'bevi bicchiere', run: () => A.water(null, ml) }));
    L.push({ e: '⏱️', t: S.timer.status === 'idle' ? 'Avvia un blocco da 15′' : 'Vai al timer', k: 'focus lavoro timer', run: () => { if (S.timer.status === 'idle') startFocus({ mode: 'block' }); go('lavoro'); } });
    L.push({ e: '🍅', t: 'Avvia un Pomodoro 25′', k: 'focus lavoro timer', run: () => { startFocus({ mode: 'pomodoro' }); go('lavoro'); } });
    L.push({ e: '♾️', t: 'Registra circuito casa 20′', k: 'workout allenamento', run: () => A['workout-quick']({ dataset: { id: 'circuito' } }) });
    L.push({ e: '🏋️', t: 'Registra workout', k: 'allenamento palestra corsa', run: () => openWorkout() });
    L.push({ e: '🎯', t: 'Scegli le 3 priorità', k: 'top tre stella', run: openTop3 });
    L.push({ e: '🌙', t: 'Revisione serale', k: 'chiudi giornata', run: openReview });
    L.push({ e: '📅', t: 'Revisione settimanale', k: 'lunedi obiettivi', run: openWeekly });
    I.live.chores.forEach(c => L.push({ e: '🧽', t: 'Fatta: ' + c.name, k: 'casa faccenda ' + (c.area || ''), run: () => doneChore(c.id) }));
    I.live.projects.filter(p => p.status === 'active').forEach(p => L.push({ e: p.emoji || '🧭', t: 'Blocco su ' + p.name, k: 'progetto lavoro', run: () => { startFocus({ projectId: p.id }); go('lavoro'); } }));
    C.AREAS.forEach(a => L.push({ e: a.emoji, t: 'Vai a ' + a.name, k: 'apri sezione', run: () => go(a.id) }));
    L.push({ e: '⚙️', t: 'Vai a Impostazioni', k: 'opzioni', run: () => go('impostazioni') });
    if (store.get(LS.token, '')) L.push({ e: '🔄', t: 'Sincronizza ora', k: 'sync gist', run: () => A['sync-now']() });
    L.push({ e: '💾', t: 'Esporta backup', k: 'salva json', run: exportJSON });
    L.push({ e: '🖥️', t: 'Apri il terminale', k: 'console errori log debug', run: () => openTerminal() });
    L.push({ e: '📁', t: Folder.state === 'on' ? 'Aggiorna la cartella dati' : 'Collega la cartella dati', k: 'file csv ai inbox', run: () => (Folder.state === 'on' ? A['folder-now']() : go('impostazioni')) });
    trackers().forEach(t => L.push({ e: t.emoji || '•', t: (t.mode === 'sum' ? '+' + (t.step || 1) + ' ' : 'Inserisci ') + t.name, k: 'tracker ' + (t.unit || ''), run: () => (t.mode === 'sum' ? logTracker(t.id, +t.step || 1) : A['tr-set']({ dataset: { id: t.id } })) }));
    L.push({ e: '📆', t: 'Esporta promemoria nel Calendario', k: 'ics notifiche', run: A.ics });
    const words = normQ(q).split(/\s+/).filter(Boolean);
    const res = words.length ? L.filter(c => { const hay = normQ(c.t + ' ' + (c.k || '')); return words.every(w => hay.includes(w)); }) : L.slice(0, 14);
    if (q.trim()) res.push({ e: '➕', t: 'Nuova attività: ' + q.trim(), k: '', run: () => { const t = addTaskFromText(q.trim()); if (t) toast('Aggiunta: ' + t.title); } });
    return res.slice(0, 40);
  }
  function openPalette() {
    openModal(`<label class="sr" for="pal-q">Comando</label><input class="inp" id="pal-q" placeholder="Cerca un comando o scrivi una nuova attività" autocomplete="off" autofocus><ul class="cmds" id="pal-list" role="listbox"></ul>`, { cls: 'palette' });
    const q = $('#pal-q'); let sel = 0, list = [];
    const draw = () => {
      list = commands(q.value); sel = Math.min(sel, Math.max(0, list.length - 1));
      $('#pal-list').innerHTML = list.map((c, i) => `<li role="option" data-i="${i}" aria-selected="${i === sel}"><span class="ce" aria-hidden="true">${esc(c.e)}</span><span>${esc(c.t)}</span>${i === sel ? '<span class="muted">Invio</span>' : ''}</li>`).join('');
      const s = $('#pal-list [aria-selected="true"]'); if (s && s.scrollIntoView) s.scrollIntoView({ block: 'nearest' });
    };
    const run = i => { const c = list[i]; if (!c) return; closeModal(true); c.run(); };
    q.addEventListener('input', () => { sel = 0; draw(); });
    q.addEventListener('keydown', e => {
      if (e.key === 'ArrowDown') { sel = Math.min(list.length - 1, sel + 1); draw(); e.preventDefault(); }
      else if (e.key === 'ArrowUp') { sel = Math.max(0, sel - 1); draw(); e.preventDefault(); }
      else if (e.key === 'Enter') { e.preventDefault(); run(sel); }
    });
    $('#pal-list').addEventListener('click', e => { const li = e.target.closest('li'); if (li) run(+li.dataset.i); });
    draw(); q.focus();
  }
  A.palette = () => openPalette();
  A.more = () => {
    const items = [['acqua', 'Acqua'], ['workout', 'Workout'], ['progetti', 'Progetti'], ['progressi', 'Progressi']];
    const m = navMeta();
    openModal(`${sheetHead('Altre sezioni')}<ul class="list">${items.map(([v, l]) => `<li><button type="button" class="rowbtn row" style="gap:12px;padding:6px 0" data-act="go" data-v="${v}"><span class="dot" style="${cv(v)}"></span><b class="grow">${l}</b><span class="muted">${m[v]}</span></button></li>`).join('')}<li><button type="button" class="rowbtn row" style="gap:12px;padding:6px 0" data-act="go" data-v="impostazioni"><span class="dot" style="--c:var(--muted)"></span><b class="grow">Impostazioni</b></button></li></ul>
      <div class="btns" style="margin-top:14px"><button type="button" class="btn" data-act="palette">🔎 Comandi rapidi</button><button type="button" class="btn" data-act="review">🌙 Revisione serale</button></div>`);
  };
  A.help = () => openHelp();
  function openHelp() {
    openModal(`${sheetHead('Scorciatoie da tastiera')}<ul class="list">${[['⌘K', 'Comandi rapidi'], ['1–8', 'Vai alle sezioni (Oggi … Progressi)'], ['W', 'Un bicchiere d’acqua'], ['N', 'Nuova attività'], ['F', 'Avvia o apri il timer'], ['Esc', 'Chiudi finestre'], ['?', 'Questo aiuto']].map(([k, l]) => `<li><span class="kbd">${k}</span><span>${l}</span></li>`).join('')}</ul>`);
  }

  /* ═════════════ PRIMO AVVIO ═════════════ */
  function openOnboarding() {
    openModal(`<form id="onb-form" class="form">
      <div class="sheet-head"><h2>Benvenuto in Ritmo</h2></div>
      <p class="sub">Un minuto di impostazioni, poi parti. Tutto si cambia dopo.</p>
      <div class="form-2">${field('Il tuo nome', '<input class="inp" name="name" placeholder="Come ti saluto?" autocomplete="given-name">')}${field('Di solito ti svegli alle', '<input class="inp" name="wake" type="time" value="08:30">')}</div>
      <div class="form-2">${field('Acqua al giorno (ml)', '<input class="inp" name="water" type="number" inputmode="numeric" value="2000" step="50" min="500" max="6000">')}${field('Lavoro concentrato al giorno', '<select class="inp" name="work"><option value="60">1 ora</option><option value="90">1 ora e mezza</option><option value="120" selected>2 ore</option><option value="180">3 ore</option><option value="240">4 ore</option></select>')}</div>
      <div class="field"><span>Giorni di workout</span><div class="wd" style="${cv('workout')}" id="onb-days">${[1, 2, 3, 4, 5, 6, 0].map(d => `<button type="button" data-act="onb-day" data-d="${d}" aria-pressed="${[1, 3, 5].includes(d)}" aria-label="${WD_SHORT[d]}">${WD_LETTER[d]}</button>`).join('')}</div></div>
      ${field('I tuoi progetti (uno per riga, emoji all’inizio)', '<textarea class="inp" name="projects" rows="4">📈 Ricerca trading\n🌐 Siti web\n🎬 Canale YouTube\n🧩 Organizzazione sistema</textarea>', 'Ogni giorno Ritmo ne propone uno a rotazione. Lascia vuoto per aggiungerli dopo.')}
      <div class="toggle"><span>Aggiungi una lista base di faccende di casa</span><label class="switch"><input type="checkbox" name="chores" checked><i></i></label></div>
      <div class="sheet-foot"><button type="button" class="btn ghost" data-act="onb-skip">Salta</button><button class="btn key">Inizia</button></div></form>`, { onClose: () => { if (!S.meta.onboarded) commit(() => { S.meta.onboarded = true; }); } });
  }
  A['onb-day'] = el => el.setAttribute('aria-pressed', el.getAttribute('aria-pressed') !== 'true');
  A['onb-skip'] = () => { commit(() => { S.meta.onboarded = true; }); closeModal(true); };
  FORMS['onb-form'] = (f, fd) => {
    const n = now(); const days = $$('#onb-days [aria-pressed="true"]').map(b => +b.dataset.d).sort();
    commit(() => {
      const st = S.settings;
      st.name = String(fd.get('name') || '').trim(); st.wake = fd.get('wake') || '08:30';
      st.water.goal = clamp(+fd.get('water') || 2000, 500, 6000); st.work.target = +fd.get('work') || 120;
      st.workout.days = days; st.workout.perWeek = Math.max(1, days.length || 3);
      if (st.os[0] && st.os[0].type === 'water') st.os[0].time = st.wake;
      st.u = n;
      String(fd.get('projects') || '').split('\n').map(s => s.trim()).filter(Boolean).slice(0, 12).forEach((line, i) => {
        const m = line.match(/^(\p{Extended_Pictographic}(?:️|‍\p{Extended_Pictographic})*)\s*(.+)$/u);
        S.projects.push({ id: uid('p') + i, name: (m ? m[2] : line).trim(), emoji: m ? m[1] : '🧭', status: 'active', priority: false, deadline: null, link: '', nextAction: '', notes: '', milestones: [], created: n + i, u: n });
      });
      if (fd.get('chores')) S.chores.push(...C.seedChores(n));
      S.meta.onboarded = true; S.meta.created = Math.min(S.meta.created || n, n);
    });
    closeModal(true); toast('Pronto. Il primo passo è già lì: un bicchiere d’acqua.');
  };

  /* ═════════════ EVENTI GLOBALI E AVVIO ═════════════ */
  A.go = el => { closeModal(true); go(el.dataset.v); };
  A['modal-close'] = () => closeModal();
  document.addEventListener('click', e => {
    const el = e.target.closest && e.target.closest('[data-act]'); if (!el) return;
    const fn = A[el.dataset.act]; if (!fn) return;
    if (el.tagName === 'A') return;
    e.preventDefault(); ensureAudio();
    try { const r = fn(el, e); if (r && r.catch) r.catch(err => { console.error(err); toast('Errore: ' + err.message, 'warn'); }); }
    catch (err) { console.error(err); toast('Errore: ' + err.message, 'warn'); }
  });
  document.addEventListener('submit', e => {
    const f = e.target; const fn = FORMS[f.id]; if (!fn) return;
    e.preventDefault();
    try { const r = fn(f, new FormData(f)); if (r && r.catch) r.catch(err => { console.error(err); toast('Errore: ' + err.message, 'warn'); }); }
    catch (err) { console.error(err); toast('Errore: ' + err.message, 'warn'); }
  });
  document.addEventListener('keydown', e => {
    const tag = (e.target.tagName || '').toLowerCase();
    const typing = ['input', 'textarea', 'select'].includes(tag) || e.target.isContentEditable;
    if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) { e.preventDefault(); openPalette(); return; }
    if (e.key === 'Escape') { if ($('#modal')) { e.preventDefault(); closeModal(); } return; }
    if (typing || e.metaKey || e.ctrlKey || e.altKey || $('#modal')) return;
    const nav = ['oggi', 'acqua', 'workout', 'lavoro', 'todo', 'progetti', 'casa', 'progressi'];
    if (/^[1-8]$/.test(e.key)) { e.preventDefault(); go(nav[+e.key - 1]); }
    else if (e.key === 'w' || e.key === 'W') A.water(null, S.settings.water.glass);
    else if (e.key === 'n' || e.key === 'N') { e.preventDefault(); go('todo'); const q = $('#qa'); if (q) q.focus(); }
    else if (e.key === 'f' || e.key === 'F') { if (S.timer.status === 'idle') startFocus({}); go('lavoro'); }
    else if (e.key === '?') openHelp();
  });
  function applyTheme() {
    const r = document.documentElement;
    if (D.theme === 'light' || D.theme === 'dark') r.setAttribute('data-theme', D.theme); else r.removeAttribute('data-theme');
    const dark = D.theme === 'dark' || (D.theme !== 'light' && matchMedia('(prefers-color-scheme: dark)').matches);
    $$('meta[name="theme-color"]').forEach(m => m.remove());
    const m = document.createElement('meta'); m.name = 'theme-color'; m.content = dark ? '#101215' : '#e3e5e8'; document.head.appendChild(m);
  }
  function handleURL() {
    const q = new URLSearchParams(location.search); if (![...q.keys()].length) return;
    const add = q.get('add');
    if (add === 'water' || add === 'acqua') setTimeout(() => A.water(null, +q.get('ml') || S.settings.water.glass), 250);
    if (q.get('task')) setTimeout(() => { const t = addTaskFromText(q.get('task')); if (t) toast('Aggiunta: ' + t.title); }, 250);
    if (q.get('chore')) { const name = normQ(q.get('chore')); const c = S.chores.find(x => !x.d && normQ(x.name).includes(name)); if (c) setTimeout(() => doneChore(c.id), 250); }
    if (q.get('focus') === 'start') { setTimeout(() => { if (S.timer.status === 'idle') startFocus({}); go('lavoro'); }, 250); }
    if (q.get('go') && VIEWS[q.get('go')]) view = q.get('go');
    history.replaceState(null, '', location.pathname + '#' + view);
  }
  function minuteRefresh() {
    checkReminders();
    const busy = $('#modal') || (document.activeElement && document.activeElement.closest && document.activeElement.closest('#main input, #main textarea, #main select'));
    if (!busy && document.visibilityState === 'visible') render();
  }
  function init() {
    applyTheme();
    try { matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyTheme); } catch (e) { /* Safari vecchi */ }
    const h = location.hash.slice(1); if (VIEWS[h]) view = h;
    handleURL();
    render();
    if (!S.meta.onboarded) openOnboarding();
    setInterval(tick, 1000);
    setInterval(minuteRefresh, 30000);
    let wide = innerWidth >= 720;
    window.addEventListener('resize', () => { const w = innerWidth >= 720; if (w !== wide) { wide = w; render(); } });
    window.addEventListener('hashchange', () => { const v = location.hash.slice(1); if (VIEWS[v] && v !== view) go(v); });
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') { cache.v = -1; render(); checkReminders(); if (now() - Sync.last > 30000) Sync.run(); } });
    window.addEventListener('storage', e => { if (e.key === LS.data && e.newValue) { try { S = C.normalize(JSON.parse(e.newValue), now()); ver++; render(); } catch (err) { /* nulla */ } } });
    if (store.get(LS.token, '')) setTimeout(() => Sync.run(), 1200);
    setInterval(() => { if (document.visibilityState === 'visible') Sync.run(); }, 180000);
    setTimeout(checkReminders, 2000);
    if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol) && window.top === window) {
      navigator.serviceWorker.register('sw.js').then(r => { swReg = r; }).catch(() => {});
    }
    try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (e) { /* nulla */ }
    window.Ritmo = { get state() { return S; }, X, version: VERSION };
  }
