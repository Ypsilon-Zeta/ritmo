// Test della logica pura: node tests/core.test.js
process.env.TZ = 'Europe/Rome';
const assert = require('node:assert/strict');
require('../src/core.js');
const C = globalThis.RitmoCore;
let passed = 0;
const t = (name, fn) => { try { fn(); passed++; console.log('ok  ', name); } catch (e) { console.error('FAIL', name, '\n', e); process.exitCode = 1; } };

const NOW = new Date(2026, 10, 23, 15, 0).getTime(); // lun 23 nov 2026, 15:00
const TODAY = '2026-11-23';

t('date: dayKey rispetta inizio giornata alle 04:00', () => {
  assert.equal(C.dayKey(new Date(2026, 10, 24, 1, 30).getTime(), 4), '2026-11-23');
  assert.equal(C.dayKey(new Date(2026, 10, 24, 4, 30).getTime(), 4), '2026-11-24');
  assert.equal(C.addDays('2026-03-28', 2), '2026-03-30'); // attraversa cambio ora legale
  assert.equal(C.diffDays('2026-03-30', '2026-03-28'), 2);
  assert.equal(C.weekKey('2026-11-23'), '2026-W48');
  assert.equal(C.weekKey('2027-01-01'), '2026-W53');
  assert.equal(C.mondayOf('2026-11-29'), '2026-11-23');
});

t('parser rapido: data, progetto, priorità, ripetizione', () => {
  const projects = [{ id: 'p1', name: 'Canale YouTube', status: 'active' }, { id: 'p2', name: 'SRL', status: 'active' }];
  let r = C.parseQuick('Chiamare commercialista domani #srl !alta', TODAY, projects);
  assert.equal(r.title, 'Chiamare commercialista'); assert.equal(r.due, '2026-11-24'); assert.equal(r.projectId, 'p2'); assert.equal(r.prio, 1);
  r = C.parseQuick('Montare video venerdì #canale ⚡', TODAY, projects);
  assert.equal(r.due, '2026-11-27'); assert.equal(r.projectId, 'p1'); assert.equal(r.quick, true); assert.equal(r.title, 'Montare video');
  r = C.parseQuick('Pagare bolletta 5/12 ogni mese', TODAY, projects);
  assert.equal(r.due, '2026-12-05'); assert.deepEqual(r.repeat, { n: 1, unit: 'm' }); assert.equal(r.title, 'Pagare bolletta');
  r = C.parseQuick('Backup ogni 2 settimane @lun #inesistente', TODAY, projects);
  assert.equal(r.due, '2026-11-30'); assert.deepEqual(r.repeat, { n: 2, unit: 'w' }); assert.equal(r.title, 'Backup #inesistente');
  r = C.parseQuick('Regalo 1/1', TODAY, projects);
  assert.equal(r.due, '2027-01-01');
  r = C.parseQuick('Leggere 32/13', TODAY, projects);
  assert.equal(r.due, null); assert.equal(r.title, 'Leggere 32/13');
});

t('merge: LWW per record, tombstone, campi dei giorni indipendenti', () => {
  const a = C.emptyState(1000), b = C.emptyState(2000);
  a.water.push({ id: 'w1', ts: 1, ml: 250, u: 10 });
  b.water.push({ id: 'w1', ts: 1, ml: 500, u: 20 }, { id: 'w2', ts: 2, ml: 250, u: 5 });
  a.tasks.push({ id: 't1', title: 'x', u: 30, d: 1 });
  b.tasks.push({ id: 't1', title: 'x', u: 25 });
  a.days[TODAY] = { os: { os1: { v: 'done', u: 100 } }, energy: { v: 4, u: 50 } };
  b.days[TODAY] = { os: { os2: { v: 'skip', u: 90 } }, energy: { v: 2, u: 60 }, review: { v: { good: 'ok' }, u: 70 } };
  const m = C.merge(a, b);
  assert.equal(m.water.find(w => w.id === 'w1').ml, 500);
  assert.equal(m.water.length, 2);
  assert.equal(m.tasks[0].d, 1);
  assert.equal(m.days[TODAY].os.os1.v, 'done');
  assert.equal(m.days[TODAY].os.os2.v, 'skip');
  assert.equal(m.days[TODAY].energy.v, 2);
  assert.equal(m.days[TODAY].review.v.good, 'ok');
  assert.equal(m.meta.created, 1000);
  // commutatività / convergenza
  assert.equal(C.canon(C.merge(a, b)), C.canon(C.merge(b, a)));
  // idempotenza
  assert.equal(C.canon(C.merge(m, m)), C.canon(m));
});

t('merge: pareggio deterministico su stesso timestamp', () => {
  const a = C.emptyState(1), b = C.emptyState(1);
  a.settings.u = 5; a.settings.name = 'A';
  b.settings.u = 5; b.settings.name = 'B';
  assert.equal(C.merge(a, b).settings.name, C.merge(b, a).settings.name);
});

function fixture() {
  const s = C.emptyState(new Date(2026, 10, 16, 9).getTime());
  s.meta.onboarded = true;
  s.projects.push({ id: 'p1', name: 'Trading', status: 'active', created: 1, milestones: [{ id: 'm1', t: 'A', done: NOW - 3600e3 }, { id: 'm2', t: 'B', done: null }], u: 1 });
  s.projects.push({ id: 'p2', name: 'YouTube', status: 'active', created: 2, milestones: [], u: 1 });
  s.water.push({ id: 'w1', ts: NOW - 3 * 3600e3, ml: 500, u: 1 }, { id: 'w2', ts: NOW - 3600e3, ml: 500, u: 1 });
  s.focus.push({ id: 'f1', start: NOW - 5 * 3600e3, end: NOW - 5 * 3600e3 + 15 * 60e3, min: 15, projectId: 'p1', u: 1 });
  s.tasks.push({ id: 't1', title: 'a', due: TODAY, done: NOW - 600e3, created: 1, u: 1 }, { id: 't2', title: 'b', due: '2026-11-20', done: null, created: 1, u: 1 }, { id: 't3', title: 'c', star: TODAY, created: 1, u: 1 });
  s.chores = C.seedChores(new Date(2026, 10, 16, 9).getTime());
  s.choreLogs.push({ id: 'l1', choreId: s.chores[0].id, ts: NOW - 1800e3, u: 1 });
  return s;
}

t('indice, punteggio e Daily OS automatico', () => {
  const s = fixture(); const I = C.buildIndex(s, NOW);
  assert.equal(I.waterByDay[TODAY], 1000);
  const os = C.osStatus(s, I, TODAY);
  const st = Object.fromEntries(os.map(x => [x.id, x.state]));
  assert.equal(st.os1, 'done'); // acqua registrata
  assert.equal(st.os2, 'done'); // una priorità scelta
  assert.equal(st.os3, 'done'); // un blocco da 15'
  assert.equal(st.os4, 'done'); // una faccenda
  assert.equal(st.os5, 'todo'); // lunedì = giorno workout
  assert.equal(st.os6, 'todo'); // secondo blocco non ancora
  const sc = C.dayScore(s, I, TODAY, NOW);
  assert.ok(sc.score > 0 && sc.score < 100, 'score ' + sc.score);
  assert.equal(sc.parts.water, 0.5);
  assert.equal(sc.parts.workout, 0);
  assert.equal(sc.parts.focus, 15 / 120);
  assert.equal(sc.parts.tasks, 0.5); // 1 fatta, 1 scaduta aperta
  assert.ok(sc.parts.chores >= 0 && sc.parts.chores <= 1); // seed creato 7 giorni fa: alcune scadute
  const fresh = C.seedChores(NOW); const I2 = C.buildIndex({ ...s, chores: fresh, choreLogs: [] }, NOW);
  assert.ok(fresh.every(c => C.freshness(I2, c, NOW) > 0.25 && C.freshness(I2, c, NOW) < 0.7), 'seed parte a metà');
  assert.equal(C.dayScore(s, I, '2026-11-01', NOW), null); // prima dell'installazione
});

t('progetto del giorno ruota e resta stabile durante la giornata', () => {
  const s = fixture(); let I = C.buildIndex(s, NOW);
  // p1 lavorato oggi (dopo l'inizio giornata) → non conta: rotazione basata sui giorni precedenti
  assert.equal(C.projectOfDay(s, I, TODAY).id, 'p1');
  s.focus.push({ id: 'f0', start: new Date(2026, 10, 20, 10).getTime(), min: 15, projectId: 'p1', u: 1 });
  I = C.buildIndex(s, NOW);
  assert.equal(C.projectOfDay(s, I, TODAY).id, 'p2');
  s.projects[0].priority = true; I = C.buildIndex(s, NOW);
  assert.equal(C.projectOfDay(s, I, TODAY).id, 'p1');
  s.days[TODAY] = { potd: { v: 'p2', u: 1 } };
  assert.equal(C.projectOfDay(s, I, TODAY).id, 'p2');
});

t('serie con giorno jolly e XP/livelli', () => {
  const s = fixture(); s.settings.threshold = 1; // qualunque attività conta
  const I = C.buildIndex(s, NOW);
  const k = C.streakInfo(s, I, NOW);
  assert.ok(k.current >= 1);
  assert.equal(C.levelOf(0).level, 1); assert.equal(C.levelOf(100).level, 2); assert.equal(C.levelOf(250).level, 3);
  const xp = C.xpInfo(s, I, NOW, k.scores);
  assert.ok(xp.xp > 0 && xp.today > 0);
  const ach = C.achievements(s, I, k, xp);
  assert.ok(ach.find(a => a.id === 'first').ok);
});

t('serie: un solo buco a settimana è coperto dal jolly', () => {
  const s = C.emptyState(new Date(2026, 10, 10, 9).getTime()); s.settings.threshold = 50;
  s.settings.workout.days = []; s.settings.work.days = []; s.settings.os = [];
  for (let d = 10; d <= 23; d++) if (d !== 15) s.water.push({ id: 'w' + d, ts: new Date(2026, 10, d, 12).getTime(), ml: 2000, u: 1 });
  const k = C.streakInfo(s, C.buildIndex(s, NOW), NOW);
  assert.equal(k.freezes.length, 1); assert.equal(k.current, 13);
  s.water = s.water.filter(w => w.id !== 'w17'); // secondo buco entro 7 giorni → la serie si rompe
  const k2 = C.streakInfo(s, C.buildIndex(s, NOW), NOW);
  assert.equal(k2.current, 6);
});

t('faccende: freschezza e scadenza', () => {
  const s = fixture(); const I = C.buildIndex(s, NOW);
  const c = s.chores[0]; // fatta 30 min fa, ogni 1 giorno
  assert.ok(C.freshness(I, c, NOW) > 0.95);
  assert.equal(C.choreDueIn(I, c, NOW), 1);
});

t('ricorrenze: fine mese', () => {
  assert.equal(C.nextDue('2026-01-31', { n: 1, unit: 'm' }), '2026-02-28');
  assert.equal(C.nextDue('2026-11-23', { n: 2, unit: 'w' }), '2026-12-07');
});

t('ICS valido con allarmi e righe ≤ 75 byte', () => {
  const s = C.emptyState(NOW);
  const { text, count } = C.buildICS(s, NOW);
  assert.ok(text.startsWith('BEGIN:VCALENDAR\r\n') && text.trim().endsWith('END:VCALENDAR'));
  assert.equal((text.match(/BEGIN:VEVENT/g) || []).length, count);
  assert.equal((text.match(/BEGIN:VALARM/g) || []).length, count);
  for (const line of text.split('\r\n')) assert.ok(Buffer.byteLength(line) <= 75, 'riga lunga: ' + line);
  assert.ok(/RRULE:FREQ=WEEKLY;BYDAY=MO,WE,FR/.test(text));
});

t('normalize: dati vecchi o corrotti non rompono l’app', () => {
  const n = C.normalize({ settings: { water: { goal: 3000 } }, tasks: [null, { id: 'x' }], days: 5 }, NOW);
  assert.equal(n.settings.water.goal, 3000); assert.equal(n.settings.water.glass, 250);
  assert.equal(n.tasks.length, 1); assert.deepEqual(n.days, {}); assert.ok(Array.isArray(n.settings.os));
});

t('inbox: JSON con azioni e Markdown con attività', () => {
  const j = C.parseInbox('ai.json', JSON.stringify({ azioni: [{ tipo: 'acqua', ml: 330 }, { tipo: 'attivita', testo: 'Chiamare domani' }, { tipo: 'tracker', nome: 'sonno', valore: 7.5 }, { tipo: 'boh' }] }));
  assert.equal(j.actions.length, 3); assert.equal(j.errors.length, 1);
  assert.equal(j.actions[0].ml, 330); assert.equal(j.actions[2].value, 7.5);
  const m = C.parseInbox('note.md', '# Titolo\n- [ ] Comprare il latte\n- [x] già fatto\n* Pagare 5/12\n\n');
  assert.deepEqual(m.actions.map(a => a.text), ['Comprare il latte', 'Pagare 5/12']);
  assert.equal(C.parseInbox('x.json', '{rotto').errors.length, 1);
  assert.equal(C.parseInbox('foto.png', '').errors.length, 1);
});

t('cartella: CSV corretti e tracker nel riepilogo', () => {
  const s = fixture(); s.settings.trackers = [{ id: 'sonno', name: 'Sonno', unit: 'ore', mode: 'last' }];
  s.logs.push({ id: 'v1', t: 'sonno', ts: NOW - 3600e3, v: 7, u: 1 }, { id: 'v2', t: 'sonno', ts: NOW - 60e3, v: 7.5, u: 1 });
  s.tasks.push({ id: 't9', title: 'Con, virgola e "virgolette"', created: 1, u: 1 });
  const F = C.buildFolder(s, NOW);
  for (const k of ['LEGGIMI.md', 'dati/giorni.csv', 'dati/acqua.csv', 'dati/attivita.csv', 'dati/tracker.csv', 'dati/progetti.json', 'dati/ritmo.json', 'diario.md']) assert.ok(F[k], 'manca ' + k);
  const g = F['dati/giorni.csv'].trim().split('\n');
  assert.ok(g[0].endsWith('sonno_ore')); assert.ok(g[g.length - 1].startsWith(TODAY) && g[g.length - 1].endsWith(',7.5'));
  assert.ok(F['dati/attivita.csv'].includes('"Con, virgola e ""virgolette"""'));
  assert.equal(F['dati/acqua.csv'].trim().split('\n').length, 3);
  assert.equal(JSON.parse(F['dati/ritmo.json']).settings.trackers[0].id, 'sonno');
  assert.equal(C.trackerValue(C.buildIndex(s, NOW), s.settings.trackers[0], TODAY), 7.5);
});

console.log(`\n${passed} test superati`);
