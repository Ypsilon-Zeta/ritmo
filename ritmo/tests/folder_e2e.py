"""Cartella dati, inbox, widget, tracker e terminale (Chrome headless, cartella simulata con OPFS). Uso: python3 tests/folder_e2e.py"""
import json, os, subprocess, sys, time, pathlib
from playwright.sync_api import sync_playwright
ROOT = pathlib.Path(__file__).resolve().parent.parent
CHROME = os.environ.get('CHROME') or next((c for c in ['/usr/bin/google-chrome', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'] if os.path.exists(c)), None)
SHOTS = ROOT / 'shots'; SHOTS.mkdir(exist_ok=True)
PORT = 8767; URL = f'http://localhost:{PORT}/'
srv = subprocess.Popen([sys.executable, '-m', 'http.server', str(PORT), '-d', str(ROOT / 'docs')], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(0.8)
results, errors = [], []
def check(n, c, d=''): results.append(c); print(('ok  ' if c else 'FAIL'), n, '' if c else d)
READ = """async p => { let d = await navigator.storage.getDirectory(); const parts = p.split('/'); const f = parts.pop();
  for (const x of parts) d = await d.getDirectoryHandle(x); try { return await (await (await d.getFileHandle(f)).getFile()).text(); } catch (e) { return null; } }"""
WRITE = """async ([p, t]) => { let d = await navigator.storage.getDirectory(); const parts = p.split('/'); const f = parts.pop();
  for (const x of parts) d = await d.getDirectoryHandle(x, { create: true }); const w = await (await d.getFileHandle(f, { create: true })).createWritable(); await w.write(t); await w.close(); }"""
LIST = """async p => { let d = await navigator.storage.getDirectory(); for (const x of p.split('/')) d = await d.getDirectoryHandle(x); const n = []; for await (const e of d.values()) n.push(e.name); return n; }"""
st = lambda pg: pg.evaluate('() => JSON.parse(JSON.stringify(window.Ritmo.state))')
try:
    with sync_playwright() as p:
        b = p.chromium.launch(executable_path=CHROME, args=['--no-sandbox'])
        ctx = b.new_context(viewport={'width': 1440, 'height': 900}, locale='it-IT', timezone_id='Europe/Rome')
        pg = ctx.new_page()
        pg.on('pageerror', lambda e: errors.append(str(e)))
        pg.goto(URL); pg.wait_for_selector('#onb-form'); pg.fill('#onb-form input[name=name]', 'Micheal'); pg.click('#onb-form button.key'); pg.wait_for_selector('.pads')
        pg.evaluate('async () => { await window.Ritmo.folder.attach(await navigator.storage.getDirectory(), true); }')
        pg.wait_for_timeout(400)
        check('struttura creata', set(['dati', 'inbox', 'widgets', 'log', 'LEGGIMI.md']).issubset(set(pg.evaluate(LIST.replace("for (const x of p.split('/')) d = await d.getDirectoryHandle(x); ", ''), '')) or []))
        check('LEGGIMI.md spiega i formati', 'inbox/' in (pg.evaluate(READ, 'LEGGIMI.md') or ''))
        pg.click('.now .btn.key'); pg.wait_for_timeout(2200)
        acq = pg.evaluate(READ, 'dati/acqua.csv') or ''
        check('acqua.csv aggiornato dopo un bicchiere', acq.startswith('data,ora,ml') and ',250' in acq, acq)
        check('giorni.csv con il riepilogo di oggi', len((pg.evaluate(READ, 'dati/giorni.csv') or '').strip().split('\n')) >= 2)
        check('widget di esempio caricato e mostrato', pg.locator('[data-widget]').count() == 1)
        pg.click('[data-widget] [data-wact=bevi]'); pg.wait_for_timeout(200)
        check('il bottone del widget registra acqua', sum(w['ml'] for w in st(pg)['water'] if not w.get('d')) == 500)
        # inbox da un'altra AI
        pg.evaluate(WRITE, ['inbox/da-claude.json', json.dumps([{'tipo': 'acqua', 'ml': 330}, {'tipo': 'attivita', 'testo': 'Rivedere il bilancio domani !alta'}, {'tipo': 'workout', 'sport': 'corsa', 'minuti': 30}])])
        pg.evaluate(WRITE, ['inbox/idee.md', '- [ ] Video sui manhwa sottovalutati\n- [ ] Comprare il microfono\n'])
        pg.evaluate(WRITE, ['widgets/rotto.js', 'Ritmo.widget({ title: "Rotto", render(api) { return api.nonEsiste.x; } });'])
        pg.evaluate('() => window.Ritmo.folder.cycle(true)'); pg.wait_for_timeout(1200)
        s = st(pg)
        check('inbox JSON: acqua, attività con data e workout', sum(w['ml'] for w in s['water'] if not w.get('d')) == 830 and any(t['title'] == 'Rivedere il bilancio' and t['due'] and t['prio'] == 1 for t in s['tasks']) and len(s['workouts']) == 1)
        check('inbox Markdown: due attività', sum(1 for t in s['tasks'] if t['title'] in ('Video sui manhwa sottovalutati', 'Comprare il microfono')) == 2)
        rest = pg.evaluate(LIST, 'inbox'); done = pg.evaluate(LIST, 'inbox/elaborati')
        check('file spostati in inbox/elaborati', 'da-claude.json' not in rest and len([n for n in done if n.endswith('da-claude.json') or n.endswith('idee.md')]) == 2, str(rest) + str(done))
        pg.goto(URL + '#oggi'); pg.wait_for_timeout(300)
        check('widget rotto mostra l’errore senza bloccare l’app', pg.locator('[data-widget] >> text=Errore nel widget').count() == 1 and pg.locator('.pads').count() == 1)
        log = pg.evaluate(READ, 'log/ritmo.log') or ''
        pg.wait_for_timeout(1700); log = pg.evaluate(READ, 'log/ritmo.log') or ''
        check('errore del widget scritto in log/ritmo.log', 'Rotto' in log or 'rotto.js' in log, log[-300:])
        # tracker
        pg.goto(URL + '#impostazioni'); pg.wait_for_selector('#sec-folder')
        check('impostazioni: cartella collegata', pg.locator('#sec-folder >> text=collegata').count() >= 1)
        pg.click('[data-act=tr-new][data-preset="0"]'); pg.wait_for_timeout(200)
        pg.goto(URL + '#oggi'); pg.wait_for_timeout(200)
        pg.click('[data-act=tr-set][data-id=sonno]'); pg.fill('#tr-form input[name=v]', '7,5'); pg.click('#tr-form button.key'); pg.wait_for_timeout(2200)
        check('tracker Sonno registrato e nel CSV', any(l['t'] == 'sonno' and l['v'] == 7.5 for l in st(pg)['logs']) and ',7.5,' in (pg.evaluate(READ, 'dati/tracker.csv') or ''))
        pg.screenshot(path=str(SHOTS / 'f-oggi-widget.png'), full_page=True)
        # terminale
        pg.keyboard.press('`'); pg.wait_for_selector('#term-cmd')
        pg.fill('#term-cmd', '6*7'); pg.press('#term-cmd', 'Enter'); pg.wait_for_timeout(150)
        check('terminale esegue JavaScript', pg.locator('#term-out .tl.ok >> text=42').count() >= 1)
        pg.fill('#term-cmd', 'stato'); pg.press('#term-cmd', 'Enter'); pg.wait_for_timeout(150)
        check('terminale: comando stato', pg.locator('#term-out >> text=Ritmo 1.1.0').count() >= 1)
        pg.fill('#term-cmd', 'Ritmo.api.series(3).length'); pg.press('#term-cmd', 'Enter'); pg.wait_for_timeout(150)
        check('API dei widget raggiungibile dal terminale', pg.locator('#term-out .tl.ok >> text=3').count() >= 1)
        check('errori visibili nel terminale', pg.locator('#term-out .tl.error').count() >= 1)
        pg.screenshot(path=str(SHOTS / 'f-terminale.png'))
        pg.keyboard.press('Escape')
        pg.goto(URL + '#impostazioni'); pg.wait_for_timeout(300)
        pg.screenshot(path=str(SHOTS / 'f-impostazioni.png'), full_page=True)
        # editor widget (funziona anche senza cartella, es. iPhone)
        pg.click('[data-act=wid-new]'); pg.wait_for_selector('#wid-form'); pg.click('#wid-form button.key'); pg.wait_for_timeout(300)
        check('widget creato dall’editor', len([w for w in st(pg)['widgets'] if w.get('src') == 'editor']) == 1)
        ctx.close()
        m = b.new_context(viewport={'width': 393, 'height': 852}, device_scale_factor=3, is_mobile=True, has_touch=True, locale='it-IT')
        mp = m.new_page(); mp.goto(URL); mp.wait_for_selector('#onb-form'); mp.click('[data-act=onb-skip]')
        mp.goto(URL + '#impostazioni'); mp.wait_for_selector('#sec-folder')
        check('su iPhone/Safari spiega che la cartella richiede Chrome', mp.locator('#sec-folder >> text=Scegli cartella').count() == 1 or mp.locator('#sec-folder >> text=Chrome').count() >= 1)
        mp.evaluate("() => window.Ritmo.terminal()"); mp.wait_for_timeout(300); mp.screenshot(path=str(SHOTS / 'f-terminale-iphone.png'))
        b.close()
finally:
    srv.terminate()
print('errori pagina:', errors or 'nessuno')
print(f'{sum(results)}/{len(results)} controlli superati'); sys.exit(0 if all(results) and not errors else 1)
