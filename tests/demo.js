// Genera 60 giorni di dati di esempio (solo per screenshot e test). Eseguito nella pagina.
(() => {
  const C = window.RitmoCore, S = window.Ritmo.state, DAY = 864e5;
  let seed = 42; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const pick = a => a[Math.floor(rnd() * a.length)];
  const now = Date.now(); const today = C.dayKey(now, 4);
  const at = (dk, h, m = 0) => { const d = C.parseDK(dk); d.setHours(h, m, 0, 0); return d.getTime(); };
  S.meta.created = now - 62 * DAY;
  const P = S.projects;
  const ms = [[['Screener base', 1], ['Dati fondamentali', 1], ['Alert su anomalie', 0], ['Report settimanale', 0]], [['Template Carrd', 1], ['Pagina servizi', 0], ['SEO base', 0]], [['Script episodio 12', 1], ['Thumbnail', 1], ['Voce', 0], ['Montaggio', 0], ['Upload', 0]], [['Inbox unica', 1], ['Revisione settimanale', 0]]];
  const next = ['Collegare i dati insider al punteggio', 'Scrivere i testi della pagina servizi', 'Registrare la voce dell’episodio 12', 'Spostare le note sparse nella Inbox'];
  P.forEach((p, i) => { p.milestones = (ms[i] || []).map(([t, d], j) => ({ id: 'm' + i + j, t, done: d ? now - (10 + j * 6) * DAY : null })); p.nextAction = next[i] || ''; p.created = now - 62 * DAY + i; p.u = now; });
  if (P[2]) { P[2].priority = true; P[2].deadline = C.addDays(today, 12); }
  const titles = ['Rispondere alle email', 'Pagare la bolletta', 'Prenotare il dentista', 'Aggiornare il foglio spese', 'Leggere il report trimestrale', 'Sistemare la scrivania', 'Chiamare la banca', 'Backup del Mac', 'Comprare le lampadine', 'Studiare git rebase', 'Ordinare le foto', 'Scrivere a Luca'];
  for (let i = 60; i >= 1; i--) {
    const dk = C.addDays(today, -i); const wd = C.weekdayOf(dk); const good = rnd() < 0.72 || i < 9;
    const glasses = good ? 6 + Math.floor(rnd() * 4) : 2 + Math.floor(rnd() * 4);
    for (let g = 0; g < glasses; g++) S.water.push({ id: 'dw' + i + '_' + g, ts: at(dk, 9 + Math.floor(g * 1.6), Math.floor(rnd() * 50)), ml: pick([250, 250, 330, 500]), u: now });
    if ([1, 3, 5].includes(wd) && (good ? rnd() < 0.85 : rnd() < 0.3)) {
      const t = rnd() < 0.7 ? C.WORKOUT_TYPES[0] : pick(C.WORKOUT_TYPES.slice(1, 4));
      S.workouts.push({ id: 'dk' + i, ts: at(dk, 18, 10), type: t.id, min: t.min + Math.floor(rnd() * 10), rpe: t.rpe, groups: t.groups.slice(), note: '', u: now });
    }
    if (wd >= 1 && wd <= 5) {
      const n = good ? 3 + Math.floor(rnd() * 5) : Math.floor(rnd() * 3);
      for (let k = 0; k < n; k++) { const p = P[(i + k) % P.length]; const st = at(dk, k < 3 ? 9 + k : 20 + (k - 3), 30); S.focus.push({ id: 'f' + st, start: st, end: st + 15 * 6e4, min: pick([15, 15, 25, 50]), projectId: p ? p.id : null, label: p ? p.nextAction : '', mode: 'block', u: now }); }
    }
    const nt = good ? 1 + Math.floor(rnd() * 3) : Math.floor(rnd() * 2);
    for (let k = 0; k < nt; k++) { const c = at(dk, 8); S.tasks.push({ id: 'dt' + i + k, title: pick(titles), due: dk, prio: pick([1, 2, 2, 3]), done: at(dk, 11 + k * 3), created: c - 2 * DAY, u: now }); }
    S.chores.forEach((c, j) => { if (rnd() < (good ? 1.1 : 0.4) / c.every) S.choreLogs.push({ id: 'dl' + i + j, choreId: c.id, ts: at(dk, 16, j), u: now }); });
    if (good && rnd() < 0.7) S.days[dk] = { review: { v: { good: 'Giornata ordinata', better: 'Andare a letto prima' }, u: now }, energy: { v: 3 + Math.floor(rnd() * 2), u: now } };
  }
  // oggi: mattina avviata
  for (const [h, ml] of [[8, 250], [10, 330], [12, 250], [14, 250]]) S.water.push({ id: 'tw' + h, ts: at(today, h, 40), ml, u: now });
  const st = at(today, 9, 35); S.focus.push({ id: 'f' + st, start: st, end: st + 15 * 6e4, min: 15, projectId: P[2] && P[2].id, label: 'Registrare la voce dell’episodio 12', mode: 'block', u: now });
  S.tasks.push({ id: 'tt1', title: 'Registrare la voce dell’episodio 12', star: today, prio: 1, projectId: P[2] && P[2].id, created: now - DAY, done: now - 3600e3, u: now });
  S.tasks.push({ id: 'tt2', title: 'Chiamare il commercialista per la SRL', star: today, prio: 1, due: today, created: now - DAY, u: now });
  S.tasks.push({ id: 'tt3', title: 'Allenamento: circuito casa', star: today, prio: 2, created: now - DAY, u: now });
  S.tasks.push({ id: 'tt4', title: 'Rinnovare il dominio del sito', due: C.addDays(today, -1), prio: 2, created: now - 3 * DAY, u: now });
  S.tasks.push({ id: 'tt5', title: 'Idea: video sui manhwa più sottovalutati', created: now - 3600e3, u: now });
  S.tasks.push({ id: 'tt6', title: 'Scaricare gli estratti conto', quick: true, created: now - 2 * DAY, u: now });
  S.tasks.push({ id: 'tt7', title: 'Revisione portafoglio', due: C.addDays(today, 2), repeat: { n: 1, unit: 'w' }, prio: 1, created: now - 9 * DAY, u: now });
  if (S.chores[2]) S.choreLogs.push({ id: 'tl1', choreId: S.chores[2].id, ts: at(today, 13), u: now });
  S.goals.push({ id: 'g1', title: 'Iscritti al canale', unit: 'iscritti', start: 0, target: 1000, current: 340, deadline: null, created: now, u: now });
  S.goals.push({ id: 'g2', title: 'Peso', unit: 'kg', start: 50, target: 60, current: 52.4, deadline: null, created: now, u: now });
  const wk = C.weekKey(today);
  S.weeks[wk] = { review: { v: { big: 'Due episodi pubblicati', fix: 'Primo blocco prima di aprire YouTube' }, u: now }, goals: { v: [{ t: 'Pubblicare l’episodio 12', done: false }, { t: '3 workout', done: false }, { t: 'Chiudere la pagina servizi', done: true }], u: now } };
  S.settings.u = now;
  localStorage.setItem('ritmo.v1', JSON.stringify(S));
})();
