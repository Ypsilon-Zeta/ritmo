/* Ritmo · logica pura (nessun accesso al DOM): date, modello dati, merge per la sync,
   punteggio del giorno, serie, XP, traguardi, parser rapido delle attività, export .ics.
   Funziona sia nel browser sia in Node (per i test). */
(function (root) {
  'use strict';

  const DAY = 86400000;
  const pad2 = n => String(n).padStart(2, '0');
  const uid = (p = '') => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

  /* ───────────── date (giorno "logico": inizia all'ora dayStart, es. 04:00) ───────────── */
  const dkOf = d => d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  function parseDK(dk) { const [y, m, d] = String(dk).split('-').map(Number); return new Date(y, m - 1, d); }
  const dayKey = (ts, startHour) => dkOf(new Date(ts - (startHour || 0) * 3600000));
  function addDays(dk, n) { const d = parseDK(dk); d.setDate(d.getDate() + n); return dkOf(d); }
  const diffDays = (a, b) => Math.round((parseDK(a) - parseDK(b)) / DAY);
  const weekdayOf = dk => parseDK(dk).getDay(); // 0 = domenica
  function mondayOf(dk) { const d = parseDK(dk); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return dkOf(d); }
  function weekKey(dk) {
    const t = parseDK(dk); t.setDate(t.getDate() - ((t.getDay() + 6) % 7) + 3); // giovedì della settimana ISO
    const y = t.getFullYear(); const f = new Date(y, 0, 4); f.setDate(f.getDate() - ((f.getDay() + 6) % 7) + 3);
    return y + '-W' + pad2(1 + Math.round((t - f) / (7 * DAY)));
  }
  function hm(s) { const [h, m] = String(s || '0:0').split(':').map(Number); return (h || 0) * 60 + (m || 0); }
  const minOfDay = ts => { const d = new Date(ts); return d.getHours() * 60 + d.getMinutes(); };
  function dayStartTs(dk, startHour) { const d = parseDK(dk); d.setHours(startHour || 0, 0, 0, 0); return d.getTime(); }
  const dayEndTs = (dk, startHour) => dayStartTs(addDays(dk, 1), startHour) - 1;
  function nextWeekday(todayDK, wd) { const diff = ((wd - weekdayOf(todayDK) + 7) % 7) || 7; return addDays(todayDK, diff); }

  /* ───────────── costanti di dominio ───────────── */
  const AREAS = [
    { id: 'oggi', name: 'Oggi', emoji: '☀️', color: 'progressi' },
    { id: 'acqua', name: 'Acqua', emoji: '💧', color: 'acqua' },
    { id: 'workout', name: 'Workout', emoji: '🏋️', color: 'workout' },
    { id: 'lavoro', name: 'Lavoro', emoji: '⏱️', color: 'lavoro' },
    { id: 'todo', name: 'Da fare', emoji: '✅', color: 'todo' },
    { id: 'progetti', name: 'Progetti', emoji: '🧭', color: 'progetti' },
    { id: 'casa', name: 'Casa', emoji: '🏠', color: 'casa' },
    { id: 'progressi', name: 'Progressi', emoji: '📈', color: 'progressi' },
  ];
  const MUSCLES = ['Petto', 'Schiena', 'Spalle', 'Braccia', 'Core', 'Gambe', 'Glutei', 'Cardio'];
  const WORKOUT_TYPES = [
    { id: 'circuito', name: 'Circuito casa', emoji: '♾️', groups: ['Petto', 'Braccia', 'Core', 'Gambe', 'Glutei'], min: 20, rpe: 7 },
    { id: 'forza', name: 'Forza', emoji: '🏋️', groups: [], min: 45, rpe: 7 },
    { id: 'corsa', name: 'Corsa', emoji: '🏃', groups: ['Cardio', 'Gambe'], min: 30, rpe: 6 },
    { id: 'camminata', name: 'Camminata', emoji: '🚶', groups: ['Cardio'], min: 40, rpe: 3 },
    { id: 'sport', name: 'Sport', emoji: '⚽', groups: ['Cardio', 'Gambe'], min: 60, rpe: 6 },
    { id: 'mobilita', name: 'Mobilità', emoji: '🧘', groups: [], min: 15, rpe: 3 },
  ];
  const FOCUS_MODES = {
    block: { name: 'Blocco 15′', work: 15, brk: 3 },
    pomodoro: { name: 'Pomodoro 25/5', work: 25, brk: 5 },
    deep: { name: 'Deep 50/10', work: 50, brk: 10 },
    free: { name: 'Libero', work: 0, brk: 0 },
  };
  const OS_TYPES = {
    water: { name: 'Acqua', area: 'acqua' }, plan: { name: 'Priorità', area: 'todo' },
    focus: { name: 'Blocco di lavoro', area: 'lavoro' }, chore: { name: 'Faccenda', area: 'casa' },
    workout: { name: 'Workout', area: 'workout' }, review: { name: 'Revisione', area: 'progressi' },
    custom: { name: 'Personalizzato', area: 'progetti' },
  };
  const CHORE_AREAS = ['Cucina', 'Bagno', 'Camera', 'Generale'];

  function defaultOS() {
    return [
      { id: 'os1', type: 'water', label: 'Acqua al risveglio', emoji: '💧', time: '08:30' },
      { id: 'os2', type: 'plan', label: 'Le 3 priorità', emoji: '🎯', time: '09:00' },
      { id: 'os3', type: 'focus', label: 'Blocco sul progetto', emoji: '⏱️', time: '09:30' },
      { id: 'os4', type: 'chore', label: 'Una faccenda', emoji: '🧽', time: '15:00' },
      { id: 'os5', type: 'workout', label: 'Workout', emoji: '🏋️', time: '18:00', workoutDaysOnly: true },
      { id: 'os6', type: 'focus', label: 'Secondo blocco', emoji: '🌆', time: '21:00' },
      { id: 'os7', type: 'review', label: 'Revisione serale', emoji: '🌙', time: '23:00' },
    ];
  }
  function defaultSettings() {
    return {
      name: '',
      dayStart: 4,
      wake: '08:30',
      water: { goal: 2000, bonus: 500, glass: 250, sizes: [150, 250, 330, 500], start: '09:00', end: '23:00', every: 90, plan: '' },
      workout: { perWeek: 3, days: [1, 3, 5], time: '18:00', plan: '' },
      work: { target: 120, days: [1, 2, 3, 4, 5], start: '09:30', mode: 'block', plan: '' },
      chores: { time: '15:00' },
      review: { time: '23:00', weeklyTime: '10:00' },
      remind: { water: true, workout: true, work: true, chores: true, review: true, weekly: true },
      os: defaultOS(),
      trackers: [],
      threshold: 60,
      weights: { water: 1, workout: 1, focus: 1.5, tasks: 1, chores: 0.75, os: 1 },
      u: 0,
    };
  }
  function seedChores(now) {
    const list = [
      ['Piatti / lavastoviglie', 'Cucina', 1, 10], ['Pulire il piano cucina', 'Cucina', 3, 5],
      ['Spazzatura e differenziata', 'Cucina', 3, 5], ['Rifare il letto', 'Camera', 1, 2],
      ['Riordinare la scrivania', 'Camera', 7, 10], ['Cambiare le lenzuola', 'Camera', 14, 15],
      ['Lavandino e specchio', 'Bagno', 7, 10], ['Bagno a fondo', 'Bagno', 14, 30],
      ['Lavatrice', 'Generale', 5, 10], ['Stendere e piegare', 'Generale', 5, 15],
      ['Aspirapolvere', 'Generale', 7, 20], ['Spesa', 'Generale', 7, 45],
    ];
    // partono "a metà", così non scadono tutte il primo giorno
    return list.map(([name, area, every, min], i) => ({
      id: 'c' + now.toString(36) + i, name, area, every, min, created: now,
      base: now - every * DAY * (0.35 + 0.4 * ((i * 7) % 10) / 10), u: now,
    }));
  }

  /* ───────────── stato, normalizzazione ───────────── */
  const COLLECTIONS = ['water', 'workouts', 'focus', 'tasks', 'projects', 'chores', 'choreLogs', 'goals', 'logs', 'widgets'];
  const MAPS = ['days', 'weeks'];
  function emptyState(now) {
    return {
      v: 1, settings: defaultSettings(),
      water: [], workouts: [], focus: [], tasks: [], projects: [], chores: [], choreLogs: [], goals: [], logs: [], widgets: [],
      days: {}, weeks: {}, timer: { status: 'idle', u: 0 }, meta: { created: now, onboarded: false },
    };
  }
  const isObj = x => !!x && typeof x === 'object' && !Array.isArray(x);
  function deepDefaults(obj, def) {
    if (Array.isArray(def)) return Array.isArray(obj) ? obj : def.slice();
    if (isObj(def)) {
      const out = isObj(obj) ? { ...obj } : {};
      for (const k in def) out[k] = deepDefaults(out[k], def[k]);
      return out;
    }
    return obj === undefined || obj === null ? def : obj;
  }
  function normalize(s, now) {
    const base = emptyState(now || Date.now());
    if (!isObj(s)) return base;
    const out = { v: 1 };
    out.settings = deepDefaults(s.settings, base.settings);
    for (const c of COLLECTIONS) out[c] = Array.isArray(s[c]) ? s[c].filter(r => isObj(r) && r.id) : [];
    for (const m of MAPS) out[m] = isObj(s[m]) ? s[m] : {};
    out.timer = isObj(s.timer) ? s.timer : base.timer;
    out.meta = { ...base.meta, ...(isObj(s.meta) ? s.meta : {}) };
    return out;
  }

  /* ───────────── merge per la sync (last-write-wins per record, tombstone d:1) ───────────── */
  function canon(x) { // JSON con chiavi ordinate: confronti stabili tra dispositivi
    if (Array.isArray(x)) return '[' + x.map(canon).join(',') + ']';
    if (isObj(x)) return '{' + Object.keys(x).sort().filter(k => x[k] !== undefined).map(k => JSON.stringify(k) + ':' + canon(x[k])).join(',') + '}';
    return JSON.stringify(x === undefined ? null : x);
  }
  function newer(a, b) {
    if (a === undefined || a === null) return b;
    if (b === undefined || b === null) return a;
    const ua = +a.u || 0, ub = +b.u || 0;
    if (ua !== ub) return ua > ub ? a : b;
    return canon(a) >= canon(b) ? a : b; // pareggio deterministico
  }
  function mergeArr(a, b) {
    const map = new Map();
    for (const r of a || []) map.set(r.id, r);
    for (const r of b || []) { const x = map.get(r.id); map.set(r.id, x ? newer(x, r) : r); }
    return [...map.values()];
  }
  const isRec = x => isObj(x) && 'u' in x;
  function mergeDeep(a, b) { // per days/weeks: i "fogli" sono {v,u}
    if (a === undefined) return b;
    if (b === undefined) return a;
    if (isRec(a) || isRec(b)) return newer(a, b);
    if (isObj(a) && isObj(b)) {
      const out = {};
      for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) out[k] = mergeDeep(a[k], b[k]);
      return out;
    }
    return a;
  }
  function merge(local, remote) {
    if (!isObj(remote)) return normalize(local);
    const L = normalize(local), R = normalize(remote);
    const out = { v: 1 };
    out.settings = newer(L.settings, R.settings);
    for (const c of COLLECTIONS) out[c] = mergeArr(L[c], R[c]);
    for (const m of MAPS) out[m] = mergeDeep(L[m], R[m]) || {};
    out.timer = newer(L.timer, R.timer);
    const created = Math.min(+L.meta.created || Infinity, +R.meta.created || Infinity);
    out.meta = { created: isFinite(created) ? created : Date.now(), onboarded: !!(L.meta.onboarded || R.meta.onboarded) };
    return out;
  }
  function prune(s, now, keepDays = 90) {
    const lim = now - keepDays * DAY;
    for (const c of COLLECTIONS) s[c] = s[c].filter(r => !(r.d && (+r.u || 0) < lim));
    return s;
  }

  /* ───────────── indice per giorno (ricalcolato solo quando i dati cambiano) ───────────── */
  function buildIndex(s, now) {
    const sh = s.settings.dayStart;
    const dk = ts => dayKey(ts, sh);
    const live = {};
    for (const c of COLLECTIONS) live[c] = s[c].filter(r => !r.d);
    const choreIds = new Set(live.chores.map(c => c.id));
    live.choreLogs = live.choreLogs.filter(l => choreIds.has(l.choreId));
    const I = {
      live, today: dk(now), firstDay: dk(+s.meta.created || now), sh,
      waterByDay: {}, waterLast: {}, workoutsByDay: {}, focusByDay: {}, focusSessionsByDay: {},
      tasksDoneByDay: {}, choreDoneByDay: {}, choreLogsBy: {}, milestonesByDay: {}, logsByDay: {},
    };
    for (const l of live.logs) (I.logsByDay[dk(l.ts)] ||= []).push(l);
    for (const w of live.water) { const k = dk(w.ts); I.waterByDay[k] = (I.waterByDay[k] || 0) + (+w.ml || 0); I.waterLast[k] = Math.max(I.waterLast[k] || 0, w.ts); }
    for (const w of live.workouts) (I.workoutsByDay[dk(w.ts)] ||= []).push(w);
    for (const f of live.focus) { const k = dk(f.start); I.focusByDay[k] = (I.focusByDay[k] || 0) + (+f.min || 0); (I.focusSessionsByDay[k] ||= []).push(f); }
    for (const t of live.tasks) if (t.done) (I.tasksDoneByDay[dk(t.done)] ||= []).push(t);
    for (const l of live.choreLogs) { (I.choreLogsBy[l.choreId] ||= []).push(l.ts); (I.choreDoneByDay[dk(l.ts)] ||= []).push(l); }
    for (const id in I.choreLogsBy) I.choreLogsBy[id].sort((a, b) => a - b);
    for (const p of live.projects) for (const m of p.milestones || []) if (m.done) (I.milestonesByDay[dk(m.done)] ||= []).push({ p, m });
    if (I.firstDay > I.today) I.firstDay = I.today;
    return I;
  }

  /* ───────────── aree ───────────── */
  const waterGoal = (s, I, dkey) => (+s.settings.water.goal || 2000) + ((I.workoutsByDay[dkey] || []).length ? (+s.settings.water.bonus || 0) : 0);
  function waterPace(s, I, now) {
    const st = s.settings.water; const goal = waterGoal(s, I, I.today); const ml = I.waterByDay[I.today] || 0;
    let t = minOfDay(now); if (t < (s.settings.dayStart || 0) * 60) t += 1440;
    const a = hm(st.start), b = hm(st.end);
    const frac = b > a ? clamp((t - a) / (b - a), 0, 1) : 1;
    const expected = Math.round((goal * frac) / 50) * 50;
    return { goal, ml, expected, delta: ml - expected, frac };
  }
  function choreLast(I, c, T) {
    const logs = I.choreLogsBy[c.id] || [];
    for (let i = logs.length - 1; i >= 0; i--) if (logs[i] <= T) return logs[i];
    return +c.base || +c.created || T;
  }
  function freshness(I, c, T) { return 1 - (T - choreLast(I, c, T)) / (Math.max(1, +c.every || 7) * DAY); }
  function choreDueIn(I, c, T) { return Math.ceil((choreLast(I, c, T) + Math.max(1, +c.every || 7) * DAY - T) / DAY); }

  function osSteps(s, I, dkey) {
    const wd = weekdayOf(dkey);
    const wday = s.settings.workout.days.includes(wd) || (I.workoutsByDay[dkey] || []).length > 0;
    return (s.settings.os || []).filter(st => !(st.workoutDaysOnly && !wday));
  }
  function osStatus(s, I, dkey) {
    const day = s.days[dkey] || {}; const os = day.os || {};
    const water = I.waterByDay[dkey] || 0;
    const focusN = (I.focusSessionsByDay[dkey] || []).filter(f => (+f.min || 0) >= 10).length;
    const choreN = (I.choreDoneByDay[dkey] || []).length;
    const workoutN = (I.workoutsByDay[dkey] || []).length;
    const topN = I.live.tasks.filter(t => t.star === dkey).length;
    const reviewed = !!(day.review && day.review.v);
    const used = { focus: 0, chore: 0, workout: 0 };
    const avail = { focus: focusN, chore: choreN, workout: workoutN };
    return osSteps(s, I, dkey).map(st => {
      const m = os[st.id] && os[st.id].v;
      if (m === 'done') return { ...st, state: 'done', auto: false };
      let auto = false;
      if (st.type === 'water') auto = water > 0;
      else if (st.type === 'plan') auto = topN > 0;
      else if (st.type === 'review') auto = reviewed;
      else if (st.type in used && used[st.type] < avail[st.type]) { auto = true; used[st.type]++; }
      return { ...st, state: auto ? 'done' : m === 'skip' ? 'skip' : 'todo', auto };
    });
  }

  function projectOfDay(s, I, dkey) {
    const active = I.live.projects.filter(p => p.status === 'active');
    if (!active.length) return null;
    const manual = s.days[dkey] && s.days[dkey].potd && s.days[dkey].potd.v;
    const m = manual && active.find(p => p.id === manual);
    if (m) return m;
    const start = dayStartTs(dkey, s.settings.dayStart);
    const last = p => { let t = 0; for (const f of I.live.focus) if (f.projectId === p.id && f.start < start && f.start > t) t = f.start; return t || +p.created || 0; };
    const pri = active.filter(p => p.priority);
    return (pri.length ? pri : active).slice().sort((a, b) => last(a) - last(b) || String(a.id).localeCompare(String(b.id)))[0];
  }

  /* ───────────── punteggio, serie, XP, traguardi ───────────── */
  function dayScore(s, I, dkey, now) {
    if (dkey < I.firstDay || dkey > I.today) return null;
    const st = s.settings, W = st.weights || {}, wd = weekdayOf(dkey), parts = {};
    parts.water = clamp((I.waterByDay[dkey] || 0) / waterGoal(s, I, dkey), 0, 1);
    const wo = (I.workoutsByDay[dkey] || []).length;
    if (st.workout.days.includes(wd) || wo) parts.workout = wo ? 1 : 0;
    if (st.work.days.includes(wd)) parts.focus = clamp((I.focusByDay[dkey] || 0) / Math.max(1, +st.work.target || 60), 0, 1);
    const end = dayEndTs(dkey, st.dayStart);
    const doneN = (I.tasksDoneByDay[dkey] || []).length;
    const openDue = I.live.tasks.filter(t => t.due && t.due <= dkey && (!t.done || t.done > end) && (+t.created || 0) <= end).length;
    if (doneN + openDue > 0) parts.tasks = doneN / (doneN + openDue);
    const T = Math.min(end, now);
    const ch = I.live.chores.filter(c => (+c.created || 0) <= T);
    if (ch.length) parts.chores = ch.filter(c => freshness(I, c, T) > 0).length / ch.length;
    const os = osStatus(s, I, dkey).filter(x => x.state !== 'skip');
    if (os.length) parts.os = os.filter(x => x.state === 'done').length / os.length;
    let num = 0, den = 0;
    for (const k in parts) { const w = W[k] === undefined ? 1 : +W[k]; num += w * parts[k]; den += w; }
    return { score: den ? Math.round((100 * num) / den) : null, parts };
  }
  function streakInfo(s, I, now) {
    const thr = +s.settings.threshold || 60;
    let run = 0, best = 0, lastFreeze = -99, i = 0;
    const scores = {}, freezes = [];
    for (let d = I.firstDay; d <= I.today; d = addDays(d, 1), i++) {
      const r = dayScore(s, I, d, now); scores[d] = r;
      const sc = r && r.score;
      if (sc !== null && sc >= thr) run++;
      else if (d === I.today) { /* giornata in corso: non rompe la serie */ }
      else if (run > 0 && i - lastFreeze >= 7) { lastFreeze = i; freezes.push(d); } // giorno jolly
      else run = 0;
      best = Math.max(best, run);
    }
    return { current: run, best, freezes, scores, jollyReady: i - 1 - lastFreeze >= 7, threshold: thr };
  }
  function levelOf(xp) {
    let level = 1, need = 100, rest = xp;
    while (rest >= need) { rest -= need; level++; need = 100 + 50 * (level - 1); }
    return { level, into: rest, need };
  }
  function xpInfo(s, I, now, scores) {
    let xp = 0; const byDay = {}; const sh = s.settings.dayStart;
    const add = (dk, n) => { xp += n; byDay[dk] = (byDay[dk] || 0) + n; };
    for (const dk in I.waterByDay) { const g = waterGoal(s, I, dk); add(dk, Math.floor(Math.min(I.waterByDay[dk], g) / 250)); if (I.waterByDay[dk] >= g) add(dk, 10); }
    for (const w of I.live.workouts) add(dayKey(w.ts, sh), 25);
    for (const f of I.live.focus) add(dayKey(f.start, sh), Math.round(((+f.min || 0) * 2) / 3));
    for (const t of I.live.tasks) if (t.done) add(dayKey(t.done, sh), t.prio === 1 ? 10 : 5);
    for (const l of I.live.choreLogs) add(dayKey(l.ts, sh), 8);
    for (const dk in I.milestonesByDay) add(dk, 30 * I.milestonesByDay[dk].length);
    for (const dk in scores || {}) { const sc = scores[dk] && scores[dk].score; if (sc >= 100) add(dk, 40); else if (sc >= 80) add(dk, 20); }
    for (const dk in s.days) if (s.days[dk] && s.days[dk].review && s.days[dk].review.v) add(dk, 15);
    for (const wk in s.weeks) if (s.weeks[wk] && s.weeks[wk].review && s.weeks[wk].review.v) xp += 30;
    return { xp, today: byDay[I.today] || 0, byDay, ...levelOf(xp) };
  }
  function achievements(s, I, streak, xp) {
    const L = I.live;
    const totalFocus = L.focus.reduce((a, f) => a + (+f.min || 0), 0);
    let wrun = 0, wbest = 0;
    for (let d = I.firstDay; d <= I.today; d = addDays(d, 1)) {
      if ((I.waterByDay[d] || 0) >= waterGoal(s, I, d)) { wrun++; wbest = Math.max(wbest, wrun); } else if (d !== I.today) wrun = 0;
    }
    const weeks = {};
    for (const w of L.workouts) { const k = weekKey(dayKey(w.ts, s.settings.dayStart)); weeks[k] = (weeks[k] || 0) + 1; }
    const perfect = Object.values(streak.scores).some(r => r && r.score === 100);
    const reviews = Object.values(s.weeks).filter(w => w && w.review && w.review.v).length;
    const any = L.water.length + L.tasks.length + L.focus.length + L.workouts.length + L.choreLogs.length > 0;
    return [
      ['first', 'Primo passo', 'La prima azione registrata', any],
      ['water7', 'Sette giorni idratato', 'Obiettivo acqua per 7 giorni di fila', wbest >= 7],
      ['week', 'Settimana piena', 'Obiettivo workout settimanale raggiunto', Object.values(weeks).some(n => n >= s.settings.workout.perWeek)],
      ['focus10', '10 ore di focus', 'Totale del lavoro concentrato', totalFocus >= 600],
      ['focus100', '100 blocchi', 'Sessioni di lavoro completate', L.focus.length >= 100],
      ['streak7', '7 giorni di ritmo', 'Serie di 7 giorni sopra soglia', streak.best >= 7],
      ['streak30', '30 giorni di ritmo', 'Serie di 30 giorni sopra soglia', streak.best >= 30],
      ['streak66', '66 giorni', 'Il tempo mediano per un’abitudine (Lally 2010)', streak.best >= 66],
      ['chores50', 'Casa curata', '50 faccende fatte', L.choreLogs.length >= 50],
      ['tasks100', 'Cento cose fatte', '100 attività completate', L.tasks.filter(t => t.done).length >= 100],
      ['project', 'Progetto chiuso', 'Hai completato un progetto', L.projects.some(p => p.status === 'done')],
      ['perfect', 'Giornata perfetta', 'Punteggio 100 in un giorno', perfect],
      ['review4', 'Quattro revisioni', '4 revisioni settimanali', reviews >= 4],
      ['level5', 'Livello 5', 'Hai raggiunto il livello 5', xp.level >= 5],
    ].map(([id, name, desc, ok]) => ({ id, name, desc, ok: !!ok }));
  }
  function weekStats(s, I, monday, now) {
    const days = [...Array(7)].map((_, i) => addDays(monday, i));
    const r = { days, waterHit: 0, workouts: 0, focus: 0, tasks: 0, chores: 0, avg: null };
    let sum = 0, n = 0;
    for (const d of days) {
      if ((I.waterByDay[d] || 0) >= waterGoal(s, I, d)) r.waterHit++;
      r.workouts += (I.workoutsByDay[d] || []).length; r.focus += I.focusByDay[d] || 0;
      r.tasks += (I.tasksDoneByDay[d] || []).length; r.chores += (I.choreDoneByDay[d] || []).length;
      const sc = dayScore(s, I, d, now); if (sc && sc.score !== null) { sum += sc.score; n++; }
    }
    r.avg = n ? Math.round(sum / n) : null;
    return r;
  }
  function muscleCoverage(I, now) {
    const last = {};
    for (const w of I.live.workouts) for (const g of w.groups || []) last[g] = Math.max(last[g] || 0, w.ts);
    return MUSCLES.map(g => ({ g, last: last[g] || null, days: last[g] ? Math.floor((now - last[g]) / DAY) : null }));
  }
  function nextDue(dk, rep) {
    const n = Math.max(1, +rep.n || 1);
    if (rep.unit === 'd') return addDays(dk, n);
    if (rep.unit === 'w') return addDays(dk, 7 * n);
    const d = parseDK(dk); const day = d.getDate(); d.setDate(1); d.setMonth(d.getMonth() + n);
    d.setDate(Math.min(day, new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()));
    return dkOf(d);
  }

  /* ───────────── parser rapido: "Chiamare commercialista domani #srl !alta" ───────────── */
  const WD = { domenica: 0, dom: 0, lunedì: 1, lunedi: 1, lun: 1, martedì: 2, martedi: 2, mar: 2, mercoledì: 3, mercoledi: 3, mer: 3, giovedì: 4, giovedi: 4, gio: 4, venerdì: 5, venerdi: 5, ven: 5, sabato: 6, sab: 6 };
  const norm = x => String(x || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');
  function matchProject(projects, name) {
    const q = norm(name); if (!q) return null;
    const ps = (projects || []).filter(p => !p.d && p.status !== 'done');
    return ps.find(p => norm(p.name) === q) || ps.find(p => norm(p.name).startsWith(q)) || ps.find(p => norm(p.name).includes(q)) || null;
  }
  function dateFrom(today, d, m, y) {
    if (!(d >= 1 && d <= 31 && m >= 1 && m <= 12)) return null;
    const t = parseDK(today);
    let year = y ? (+y < 100 ? 2000 + +y : +y) : t.getFullYear();
    let dt = new Date(year, m - 1, d);
    if (dt.getMonth() !== m - 1) return null;
    if (!y && dkOf(dt) < today) dt = new Date(year + 1, m - 1, d);
    return dkOf(dt);
  }
  function parseQuick(text, today, projects) {
    const out = { title: '', due: null, prio: null, projectId: null, projectName: null, quick: false, repeat: null, star: false };
    let t = ' ' + String(text || '').trim() + ' ';
    const take = (re, fn) => { t = t.replace(re, (...m) => (fn(...m) === false ? m[0] : ' ')); };
    take(/\s(?:ogni|every)\s+(\d+\s+)?(giorni|giorno|settimane|settimana|mesi|mese)(?=\s)/i, (m, n, u) => {
      out.repeat = { n: parseInt(n, 10) || 1, unit: /^g/i.test(u) ? 'd' : /^s/i.test(u) ? 'w' : 'm' };
    });
    take(/\s!(1|2|3|alta|media|bassa)(?=\s)/i, (m, p) => { out.prio = { 1: 1, alta: 1, 2: 2, media: 2, 3: 3, bassa: 3 }[p.toLowerCase()]; });
    take(/\s(?:⚡|!q|!2min)(?=\s)/i, () => { out.quick = true; });
    take(/\s\*(?=\s)/, () => { out.star = true; });
    take(/\s#([^\s#]+)(?=\s)/, (m, name) => { const p = matchProject(projects, name); if (!p) return false; out.projectId = p.id; out.projectName = p.name; });
    take(/\s@?(oggi|stasera)(?=\s)/i, () => { out.due = today; });
    take(/\s@?(dopodomani)(?=\s)/i, () => { out.due = addDays(today, 2); });
    take(/\s@?(domani)(?=\s)/i, () => { out.due = addDays(today, 1); });
    take(/\s(?:entro il |il |@)?(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?(?=\s)/i, (m, d, mo, y) => { const v = dateFrom(today, +d, +mo, y); if (!v) return false; out.due = v; });
    take(/\s(?:entro |per )?@?(lunedì|lunedi|martedì|martedi|mercoledì|mercoledi|giovedì|giovedi|venerdì|venerdi|sabato|domenica)(?=\s)/i, (m, w) => { out.due = nextWeekday(today, WD[w.toLowerCase()]); });
    take(/\s@(lun|mar|mer|gio|ven|sab|dom)(?=\s)/i, (m, w) => { out.due = nextWeekday(today, WD[w.toLowerCase()]); });
    out.title = t.replace(/\s+/g, ' ').trim();
    return out;
  }

  /* ───────────── export calendario (.ics) con allarmi: notifiche native su Mac e iPhone ───────────── */
  function icsEsc(x) { return String(x).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n'); }
  function icsFold(line) {
    const enc = typeof TextEncoder !== 'undefined' ? new TextEncoder() : null;
    const len = ch => (enc ? enc.encode(ch).length : ch.length);
    if ((enc ? enc.encode(line).length : line.length) <= 75) return line;
    const out = []; let cur = '', n = 0, limit = 75;
    for (const ch of line) {
      const l = len(ch);
      if (n + l > limit) { out.push(cur); cur = ' '; n = 1; limit = 75; }
      cur += ch; n += l;
    }
    out.push(cur);
    return out.join('\r\n');
  }
  function buildICS(s, now) {
    const st = s.settings, r = st.remind || {};
    const L = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Ritmo//Promemoria//IT', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'X-WR-CALNAME:Ritmo'];
    const d = new Date(now); const ymd = d.getFullYear() + pad2(d.getMonth() + 1) + pad2(d.getDate());
    const stamp = new Date(now).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
    const BY = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
    let count = 0;
    const ev = (id, title, min, rrule, desc) => {
      count++;
      L.push('BEGIN:VEVENT', 'UID:ritmo-' + id + '@ritmo.app', 'DTSTAMP:' + stamp,
        'DTSTART:' + ymd + 'T' + pad2(Math.floor(min / 60) % 24) + pad2(min % 60) + '00', 'DURATION:PT5M',
        'RRULE:' + rrule, 'SUMMARY:' + icsEsc(title), 'DESCRIPTION:' + icsEsc(desc || 'Apri Ritmo'), 'TRANSP:TRANSPARENT',
        'BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:' + icsEsc(title), 'TRIGGER:-PT0M', 'END:VALARM', 'END:VEVENT');
    };
    const days = arr => (arr || []).slice().sort().map(x => BY[x]).join(',');
    if (r.water) {
      const every = Math.max(60, +st.water.every || 90);
      for (let m = hm(st.water.start); m <= hm(st.water.end); m += every) ev('acqua-' + m, '💧 Bevi un bicchiere d’acqua', m, 'FREQ=DAILY', 'Registra in Ritmo: +' + st.water.glass + ' ml');
    }
    if (r.workout && st.workout.days.length) ev('workout', '🏋️ Workout di oggi', hm(st.workout.time), 'FREQ=WEEKLY;BYDAY=' + days(st.workout.days), st.workout.plan || 'Apri Ritmo e registra il workout');
    if (r.work && st.work.days.length) ev('lavoro', '⏱️ Primo blocco di lavoro (15′)', hm(st.work.start), 'FREQ=WEEKLY;BYDAY=' + days(st.work.days), st.work.plan || 'Progetto del giorno: un blocco da 15 minuti');
    if (r.chores) ev('casa', '🧽 Una faccenda di casa', hm(st.chores.time), 'FREQ=DAILY', 'La più urgente è in Ritmo → Casa');
    if (r.review) ev('revisione', '🌙 Revisione serale (2 minuti)', hm(st.review.time), 'FREQ=DAILY', 'Com’è andata? Prima cosa di domani?');
    if (r.weekly) ev('settimana', '📅 Revisione settimanale', hm(st.review.weeklyTime), 'FREQ=WEEKLY;BYDAY=MO', 'Nuova settimana: rivedi e scegli 3 obiettivi');
    L.push('END:VCALENDAR');
    return { text: L.map(icsFold).join('\r\n') + '\r\n', count };
  }


  /* ───────────── tracker personalizzati ───────────── */
  function trackerValue(I, tr, dk) {
    const ls = (I.logsByDay[dk] || []).filter(l => l.t === tr.id).sort((a, b) => a.ts - b.ts);
    if (!ls.length) return null;
    return tr.mode === 'last' ? +ls[ls.length - 1].v : ls.reduce((a, l) => a + (+l.v || 0), 0);
  }

  /* ───────────── inbox: file lasciati da altre app/AI nella cartella ───────────── */
  const ACT = { acqua: 'water', water: 'water', attivita: 'task', 'attività': 'task', task: 'task', todo: 'task', nota: 'note', note: 'note',
    workout: 'workout', allenamento: 'workout', faccenda: 'chore', chore: 'chore', lavoro: 'focus', focus: 'focus', tracker: 'log', log: 'log', valore: 'log' };
  function parseInbox(name, text) {
    const out = { actions: [], errors: [] };
    const low = String(name).toLowerCase();
    if (low.endsWith('.json')) {
      let data; try { data = JSON.parse(text); } catch (e) { out.errors.push(name + ': JSON non valido (' + e.message + ')'); return out; }
      const list = Array.isArray(data) ? data : Array.isArray(data.azioni) ? data.azioni : Array.isArray(data.actions) ? data.actions : [data];
      for (const o of list) {
        if (!isObj(o)) { out.errors.push(name + ': voce non valida'); continue; }
        const kind = ACT[String(o.tipo || o.azione || o.type || o.action || '').toLowerCase()];
        if (!kind) { out.errors.push(name + ': tipo sconosciuto "' + (o.tipo || o.azione || o.type || '') + '"'); continue; }
        const when = o.quando || o.ts || o.when; const ts = when ? new Date(when).getTime() : null;
        out.actions.push({ kind, ts: isFinite(ts) ? ts : null, ml: +o.ml || +o.valore || 0, text: o.testo || o.titolo || o.title || o.text || '',
          type: o.sport || o.workout || o.kind || (kind === 'workout' ? o.tipo_workout : ''), min: +(o.minuti || o.min || o.minutes) || 0, rpe: +o.rpe || 0,
          groups: o.gruppi || o.groups || [], note: o.note || '', name: o.nome || o.name || o.faccenda || o.tracker || o.id || '',
          value: o.valore !== undefined ? +o.valore : +o.value, project: o.progetto || o.project || '', label: o.etichetta || o.label || '' });
      }
    } else if (/\.(md|txt)$/.test(low)) {
      for (let line of String(text).split(/\r?\n/)) {
        line = line.trim();
        if (!line || line.startsWith('#') || /^[-*]\s*\[x\]/i.test(line)) continue;
        line = line.replace(/^[-*•]\s*(\[\s?\]\s*)?/, '').trim();
        if (line) out.actions.push({ kind: 'task', text: line });
      }
    } else out.errors.push(name + ': formato non supportato (usa .json, .md o .txt)');
    return out;
  }

  /* ───────────── cartella: file leggibili da persone, AI, Excel, Python ───────────── */
  const FOLDER_README = `# Cartella dati di Ritmo

Questa cartella è scritta da Ritmo (app installata con Chrome sul Mac) dopo ogni modifica.
È pensata per essere letta da altre AI, script ed Excel.

## dati/  (sola lettura: Ritmo la riscrive ogni volta)
| File | Contenuto |
|---|---|
| giorni.csv | Una riga per giorno: punteggio, acqua, lavoro, workout, attività, faccende, energia, umore, tracker |
| acqua.csv | Ogni bicchiere: data, ora, ml |
| workout.csv | data, ora, tipo, minuti, rpe, gruppi, note |
| lavoro.csv | Blocchi di lavoro: data, inizio, fine, minuti, progetto, etichetta, modalità |
| attivita.csv | Tutte le attività (aperte e fatte) |
| progetti.json | Progetti con milestone e prossima azione |
| faccende.csv / faccende-storico.csv | Faccende e quando sono state fatte |
| tracker.csv | Valori dei tracker personalizzati |
| obiettivi.csv | Obiettivi a lungo termine |
| ritmo.json | Tutto lo stato dell'app (formato completo, importabile) |
Date in formato AAAA-MM-GG, ore HH:MM locali, decimali col punto. Il giorno inizia alle ore indicate in impostazioni (predefinito 04:00).

## diario.md
Revisioni serali e settimanali in testo semplice.

## inbox/  (scrittura: qui le altre app/AI aggiungono dati)
Ritmo legge i file ogni 20 secondi mentre è aperto, li applica e li sposta in inbox/elaborati/.
- File .md o .txt: ogni riga diventa un'attività. Capisce "domani", "lunedì", "25/12", "#progetto", "!alta".
- File .json: un oggetto, una lista, oppure {"azioni": [...]}. Tipi supportati:
\`\`\`json
[
  {"tipo": "acqua", "ml": 250},
  {"tipo": "attivita", "testo": "Chiamare il commercialista domani #srl !alta"},
  {"tipo": "workout", "sport": "corsa", "minuti": 30, "rpe": 6},
  {"tipo": "faccenda", "nome": "Lavatrice"},
  {"tipo": "lavoro", "minuti": 25, "progetto": "Canale YouTube", "etichetta": "Script"},
  {"tipo": "tracker", "nome": "sonno", "valore": 7.5},
  {"tipo": "nota", "testo": "Idea per un video"}
]
\`\`\`
Campo opzionale "quando": data/ora ISO (es. "2026-11-24T08:30").

## widgets/
File .js con widget personalizzati per la schermata Oggi (vedi esempio). Si sincronizzano anche su iPhone.

## log/ritmo.log
Gli ultimi messaggi del terminale di Ritmo, errori compresi: utile per fare debug con un'AI.
`;
  function buildFolder(s, now) {
    const I = buildIndex(s, now); const k = streakInfo(s, I, now); const sh = s.settings.dayStart;
    const cell = v => { if (v === null || v === undefined) return ''; const x = String(v); return /[",\n\r]/.test(x) ? '"' + x.replace(/"/g, '""') + '"' : x; };
    const csv = (head, rows) => [head, ...rows].map(r => r.map(cell).join(',')).join('\n') + '\n';
    const hhmm = t => { const d = new Date(t); return pad2(d.getHours()) + ':' + pad2(d.getMinutes()); };
    const full = t => (t ? dkOf(new Date(t)) + ' ' + hhmm(t) : '');
    const dk = t => dayKey(t, sh);
    const pname = id => ((I.live.projects.find(p => p.id === id) || {}).name || '');
    const byTs = f => (a, b) => (a[f] || 0) - (b[f] || 0);
    const trs = s.settings.trackers || [];
    const slug = x => String(x).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
    const F = {};
    F['LEGGIMI.md'] = FOLDER_README;
    F['dati/acqua.csv'] = csv(['data', 'ora', 'ml'], I.live.water.slice().sort(byTs('ts')).map(w => [dk(w.ts), hhmm(w.ts), w.ml]));
    F['dati/workout.csv'] = csv(['data', 'ora', 'tipo', 'minuti', 'rpe', 'gruppi', 'note'], I.live.workouts.slice().sort(byTs('ts')).map(w => [dk(w.ts), hhmm(w.ts), w.type, w.min, w.rpe, (w.groups || []).join('; '), w.note]));
    F['dati/lavoro.csv'] = csv(['data', 'inizio', 'fine', 'minuti', 'progetto', 'etichetta', 'modalita'], I.live.focus.slice().sort(byTs('start')).map(f => [dk(f.start), hhmm(f.start), f.end ? hhmm(f.end) : '', f.min, pname(f.projectId), f.label, f.mode]));
    F['dati/attivita.csv'] = csv(['titolo', 'scadenza', 'priorita', 'progetto', 'fatta_il', 'creata_il', 'ricorrenza', 'priorita_del_giorno', 'note', 'id'], I.live.tasks.slice().sort(byTs('created')).map(t => [t.title, t.due, t.prio === 1 ? 'alta' : t.prio === 3 ? 'bassa' : 'media', pname(t.projectId), full(t.done), full(t.created), t.repeat ? 'ogni ' + t.repeat.n + ' ' + { d: 'giorni', w: 'settimane', m: 'mesi' }[t.repeat.unit] : '', t.star, t.note, t.id]));
    F['dati/progetti.json'] = JSON.stringify(I.live.projects.map(p => ({ nome: p.name, emoji: p.emoji, stato: p.status, precedenza: !!p.priority, scadenza: p.deadline || null, prossima_azione: p.nextAction || '', link: p.link || '', note: p.notes || '', milestone: (p.milestones || []).map(m => ({ titolo: m.t, fatta_il: full(m.done) || null })), minuti_lavoro_totali: I.live.focus.filter(f => f.projectId === p.id).reduce((a, f) => a + (+f.min || 0), 0) })), null, 2) + '\n';
    F['dati/faccende.csv'] = csv(['nome', 'stanza', 'ogni_giorni', 'minuti', 'ultima_volta', 'freschezza'], I.live.chores.map(c => [c.name, c.area, c.every, c.min, (I.choreLogsBy[c.id] || []).length ? full(choreLast(I, c, now)) : '', Math.round(freshness(I, c, now) * 100) / 100]));
    F['dati/faccende-storico.csv'] = csv(['data', 'ora', 'faccenda'], I.live.choreLogs.slice().sort(byTs('ts')).map(l => [dk(l.ts), hhmm(l.ts), (I.live.chores.find(c => c.id === l.choreId) || {}).name]));
    F['dati/tracker.csv'] = csv(['data', 'ora', 'tracker', 'valore', 'unita'], I.live.logs.slice().sort(byTs('ts')).map(l => { const t = trs.find(x => x.id === l.t) || {}; return [dk(l.ts), hhmm(l.ts), t.name || l.t, l.v, t.unit || '']; }));
    F['dati/obiettivi.csv'] = csv(['titolo', 'partenza', 'attuale', 'traguardo', 'unita', 'entro'], I.live.goals.map(g => [g.title, g.start, g.current, g.target, g.unit, g.deadline]));
    const rows = [];
    for (let d = I.firstDay; d <= I.today; d = addDays(d, 1)) {
      const r = k.scores[d]; const day = s.days[d] || {}; const os = osStatus(s, I, d);
      rows.push([d, r && r.score !== null ? r.score : '', I.waterByDay[d] || 0, waterGoal(s, I, d), (I.workoutsByDay[d] || []).length, I.focusByDay[d] || 0,
        (I.tasksDoneByDay[d] || []).length, (I.choreDoneByDay[d] || []).length, os.filter(x => x.state === 'done').length, os.length,
        day.energy ? day.energy.v : '', day.mood ? day.mood.v : '', ...trs.map(t => { const v = trackerValue(I, t, d); return v === null ? '' : v; })]);
    }
    F['dati/giorni.csv'] = csv(['data', 'punteggio', 'acqua_ml', 'obiettivo_acqua_ml', 'workout', 'lavoro_min', 'attivita_fatte', 'faccende_fatte', 'passi_fatti', 'passi_totali', 'energia', 'umore', ...trs.map(t => slug(t.name) + (t.unit ? '_' + slug(t.unit) : ''))], rows);
    const diary = ['# Diario di Ritmo', ''];
    const wk = Object.keys(s.weeks).sort().reverse();
    for (const w of wk) { const r = s.weeks[w] && s.weeks[w].review && s.weeks[w].review.v; const g = s.weeks[w] && s.weeks[w].goals && s.weeks[w].goals.v; if (!r && !g) continue; diary.push('## Settimana ' + w); if (r) { if (r.big) diary.push('- Vittoria più grande: ' + r.big); if (r.fix) diary.push('- Da cambiare: ' + r.fix); } (g || []).forEach(x => diary.push('- [' + (x.done ? 'x' : ' ') + '] ' + x.t)); diary.push(''); }
    for (const d of Object.keys(s.days).sort().reverse()) { const r = s.days[d] && s.days[d].review && s.days[d].review.v; if (!r) continue; diary.push('### ' + d); if (r.good) diary.push('- Bene: ' + r.good); if (r.better) diary.push('- Da migliorare: ' + r.better); diary.push(''); }
    F['diario.md'] = diary.join('\n') + '\n';
    F['dati/ritmo.json'] = JSON.stringify(s) + '\n';
    return F;
  }

  root.RitmoCore = {
    DAY, pad2, uid, clamp, dkOf, parseDK, dayKey, addDays, diffDays, weekdayOf, mondayOf, weekKey, hm, minOfDay,
    dayStartTs, dayEndTs, nextWeekday, AREAS, MUSCLES, WORKOUT_TYPES, FOCUS_MODES, OS_TYPES, CHORE_AREAS,
    defaultOS, defaultSettings, seedChores, emptyState, normalize, deepDefaults, canon, newer, merge, prune, COLLECTIONS,
    buildIndex, waterGoal, waterPace, choreLast, freshness, choreDueIn, osSteps, osStatus, projectOfDay,
    dayScore, streakInfo, levelOf, xpInfo, achievements, weekStats, muscleCoverage, nextDue,
    parseQuick, matchProject, buildICS, icsFold, trackerValue, parseInbox, buildFolder, FOLDER_README,
  };
})(typeof window !== 'undefined' ? window : globalThis);
