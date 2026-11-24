"""Test end-to-end di Ritmo con Chrome headless (Playwright). Uso: python3 tests/e2e.py"""
import json, os, subprocess, sys, time, pathlib, re
from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
# Chrome di sistema se c'è (Linux o Mac), altrimenti il Chromium di Playwright (`python3 -m playwright install chromium`)
CHROME = os.environ.get('CHROME') or next((c for c in ['/usr/bin/google-chrome', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'] if os.path.exists(c)), None)
SHOTS = ROOT / 'shots'; SHOTS.mkdir(exist_ok=True)
PORT = 8765
URL = f'http://localhost:{PORT}/'
srv = subprocess.Popen([sys.executable, '-m', 'http.server', str(PORT), '-d', str(ROOT / 'docs')], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(0.8)
errors, results = [], []

def check(name, cond, detail=''):
    results.append((name, bool(cond), detail))
    print(('ok  ' if cond else 'FAIL'), name, detail if not cond else '')

def attach(page, tag):
    page.on('pageerror', lambda e: errors.append(f'[{tag}] pageerror: {e}'))
    page.on('console', lambda m: errors.append(f'[{tag}] console.{m.type}: {m.text}') if m.type == 'error' else None)

def state(page):
    return page.evaluate('() => JSON.parse(JSON.stringify(window.Ritmo.state))')

try:
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path=CHROME, args=['--no-sandbox'])
        ctx = browser.new_context(viewport={'width': 1440, 'height': 900}, locale='it-IT', timezone_id='Europe/Rome', accept_downloads=True)
        page = ctx.new_page(); attach(page, 'desktop')
        page.goto(URL); page.wait_for_selector('#onb-form', timeout=5000)
        check('onboarding al primo avvio', page.is_visible('#onb-form'))
        page.fill('#onb-form input[name=name]', 'Micheal')
        page.click('#onb-form button.key')
        page.wait_for_selector('.pads .pad')
        s = state(page)
        check('onboarding salva nome e progetti', s['settings']['name'] == 'Micheal' and len(s['projects']) == 4, str(len(s['projects'])))
        check('faccende di base aggiunte', len(s['chores']) == 12)
        npads = page.locator('.pads .pad').count()
        check('sequencer con i passi del giorno', npads >= 6, str(npads))
        page.screenshot(path=str(SHOTS / 'd-oggi-vuoto.png'), full_page=True)

        # Acqua dal pad "Adesso"
        page.click('.now .btn.key')
        page.wait_for_timeout(200)
        s = state(page)
        check('Adesso: il passo acqua registra un bicchiere', sum(w['ml'] for w in s['water'] if not w.get('d')) == 250)
        check('il pad acqua si accende da solo', page.locator('.pad.is-done').count() >= 1)
        # Priorità dal pad successivo
        page.click('.now .btn.key')
        page.wait_for_selector('#top3-form')
        page.fill('#top3-new', 'Scrivere lo script del video')
        page.press('#top3-new', 'Enter'); page.wait_for_timeout(150)
        page.fill('#top3-new', 'Rispondere al commercialista')
        page.press('#top3-new', 'Enter'); page.wait_for_timeout(150)
        page.click('#modal .sheet-foot .btn.key')
        s = state(page)
        stars = [t for t in s['tasks'] if t.get('star')]
        check('priorità di oggi create dal modale', len(stars) == 2, str(len(stars)))

        # Da fare: parser rapido
        page.keyboard.press('5'); page.wait_for_selector('#qa')
        page.fill('#qa', 'Montare il video domani #canale !alta')
        page.wait_for_timeout(100)
        prev = page.inner_text('#qa-prev')
        check('anteprima del parser', 'domani' in prev and 'Canale YouTube' in prev and 'alta' in prev, prev)
        page.press('#qa', 'Enter'); page.wait_for_timeout(200)
        s = state(page)
        t = next((t for t in s['tasks'] if t['title'] == 'Montare il video'), None)
        check('attività creata con data, progetto e priorità', t and t['due'] and t['projectId'] and t['prio'] == 1, json.dumps(t))
        page.click('[data-act=todo-filter][data-id=prossimi]')
        check('compare in Prossimi', page.locator('text=Montare il video').count() >= 1)
        page.click('[data-act=todo-filter][data-id=matrice]')
        check('vista matrice', page.locator('text=Fai adesso').count() == 1)
        page.click('[data-act=todo-filter][data-id=oggi]')
        page.click('.list li .check >> nth=0'); page.wait_for_timeout(150)
        s = state(page)
        check('completare un’attività', any(t.get('done') for t in s['tasks']))
        page.screenshot(path=str(SHOTS / 'd-todo.png'), full_page=True)

        # Lavoro: avvio, completamento simulato, pausa
        page.keyboard.press('4'); page.wait_for_selector('[data-act=focus-start]')
        page.fill('#f-label', 'Bozza dello script')
        page.click('[data-act=focus-start]'); page.wait_for_timeout(1300)
        tt1 = page.inner_text('.timer-face .tt')
        check('timer in corso', re.match(r'1[45]:\d\d', tt1) is not None, tt1)
        page.screenshot(path=str(SHOTS / 'd-lavoro-run.png'), full_page=True)
        page.evaluate('() => { const T = window.Ritmo.state.timer; T.at -= 15 * 60 * 1000; }')
        page.wait_for_timeout(1600)
        s = state(page)
        check('blocco completato e salvato', len([f for f in s['focus'] if not f.get('d')]) == 1 and s['timer']['status'] == 'break', s['timer']['status'])
        check('il passo di lavoro si accende', any(x for x in page.evaluate("() => window.Ritmo.X().os.filter(o => o.type === 'focus' && o.state === 'done').map(o => o.id)")))
        page.click('[data-act=focus-skipbreak]'); page.wait_for_timeout(150)
        check('pausa saltata', state(page)['timer']['status'] == 'idle')

        # Mi sono bloccato
        page.click('[data-act=focus-start]'); page.wait_for_timeout(300)
        page.click('[data-act=focus-stuck]'); page.wait_for_selector('#stuck-form')
        page.fill('#stuck-form textarea[name=what]', 'Non so come aprire il video')
        page.fill('#stuck-form input[name=next]', 'Guardare 3 video simili')
        page.click('#stuck-form button.key'); page.wait_for_timeout(200)
        s = state(page)
        check('blocco annotato in Inbox e rinominato', any(t['title'].startswith('🐞') for t in s['tasks']) and s['timer']['label'] == 'Guardare 3 video simili')
        page.click('[data-act=focus-cancel]'); page.wait_for_timeout(200)
        if page.is_visible('#ask-ok'): page.click('#ask-ok')
        check('annulla blocco', state(page)['timer']['status'] == 'idle')

        # Casa
        page.keyboard.press('7'); page.wait_for_selector('[data-act=chore-done]')
        page.click('[data-act=chore-done] >> nth=0'); page.wait_for_timeout(200)
        check('faccenda fatta registrata', len(state(page)['choreLogs']) == 1)
        page.screenshot(path=str(SHOTS / 'd-casa.png'), full_page=True)

        # Workout rapido
        page.keyboard.press('3'); page.wait_for_selector('[data-act=workout-quick]')
        page.click('[data-act=workout-quick] >> nth=0'); page.wait_for_timeout(200)
        s = state(page)
        check('workout circuito registrato', len(s['workouts']) == 1 and 'Petto' in s['workouts'][0]['groups'])
        page.click('.view-head [data-act=workout-open]'); page.wait_for_selector('#wo-form')
        page.click('[data-act=wo-type][data-id=corsa]'); page.wait_for_timeout(100)
        check('cambio tipo nel modale workout', page.locator('[data-act=wo-type][data-id=corsa][aria-pressed=true]').count() == 1)
        page.keyboard.press('Escape')

        # Palette comandi
        page.keyboard.press('Control+k'); page.wait_for_selector('#pal-q')
        page.fill('#pal-q', '500'); page.wait_for_timeout(100)
        page.keyboard.press('Enter'); page.wait_for_timeout(250)
        s = state(page)
        check('palette: +500 ml', sum(w['ml'] for w in s['water'] if not w.get('d')) == 750, str(sum(w['ml'] for w in s['water'])))
        page.keyboard.press('Control+k'); page.fill('#pal-q', 'Comprare le lampadine'); page.keyboard.press('Enter'); page.wait_for_timeout(200)
        check('palette: nuova attività', any(t['title'] == 'Comprare le lampadine' for t in state(page)['tasks']))

        # Revisione serale
        page.evaluate("() => document.querySelector('[data-act=review]') || null")
        page.keyboard.press('1'); page.wait_for_timeout(150)
        page.evaluate("() => { const b = document.createElement('button'); b.dataset.act = 'review'; b.id = 'tmp-rev'; document.body.appendChild(b); }")
        page.click('#tmp-rev'); page.wait_for_selector('#review-form')
        page.click('[data-scale=energy] button >> nth=3')
        page.fill('#review-form textarea[name=good]', 'Ho fatto il primo blocco')
        page.fill('#review-form input[name=first]', 'Registrare la voce')
        page.click('#review-form button.key'); page.wait_for_timeout(200)
        s = state(page); today = page.evaluate('() => window.Ritmo.X().I.today')
        check('revisione salvata con energia', s['days'][today]['review']['v']['good'] and s['days'][today]['energy']['v'] == 4)
        check('prima cosa di domani diventa priorità', any(t['title'] == 'Registrare la voce' and t.get('star') for t in s['tasks']))

        # Progetti
        page.keyboard.press('6'); page.wait_for_selector('[data-act=proj-open]')
        page.click('[data-act=proj-open] >> nth=0'); page.wait_for_selector('#ms-form')
        page.fill('#ms-new', 'Prima versione online'); page.press('#ms-new', 'Enter'); page.wait_for_timeout(200)
        page.fill('#ms-new', 'Dati collegati'); page.press('#ms-new', 'Enter'); page.wait_for_timeout(200)
        page.click('[data-act=ms-toggle] >> nth=0'); page.wait_for_timeout(200)
        page.fill('[data-pf=nextAction]', 'Scrivere lo schema delle tabelle'); page.press('[data-pf=nextAction]', 'Tab'); page.wait_for_timeout(200)
        s = state(page); pr = s['projects'][0]
        check('milestone aggiunte e completate', len(pr['milestones']) == 2 and pr['milestones'][0]['done'])
        check('prossima azione salvata in automatico', pr['nextAction'] == 'Scrivere lo schema delle tabelle', pr.get('nextAction'))
        page.keyboard.press('Escape')

        # Progressi e impostazioni
        page.keyboard.press('8'); page.wait_for_selector('svg.heat')
        check('heatmap disegnata', page.locator('svg.heat rect.c').count() >= 150)
        page.goto(URL + '#impostazioni'); page.wait_for_selector('#sec-os')
        with page.expect_download() as dl:
            page.click('[data-act=ics]')
        ics = pathlib.Path(dl.value.path()).read_text()
        check('export .ics con eventi e allarmi', ics.count('BEGIN:VEVENT') >= 6 and ics.count('BEGIN:VALARM') == ics.count('BEGIN:VEVENT'))
        page.fill('[data-set="water.goal"]', '2500'); page.press('[data-set="water.goal"]', 'Tab'); page.wait_for_timeout(150)
        check('impostazione salvata', state(page)['settings']['water']['goal'] == 2500)
        page.click('[data-act=os-add]'); page.wait_for_timeout(150)
        check('passo aggiunto al Daily OS', len(state(page)['settings']['os']) == 8)

        # URL per Comandi Rapidi
        page.goto(URL + '?add=water&ml=330'); page.wait_for_timeout(700)
        check('URL ?add=water registra acqua', any(w['ml'] == 330 for w in state(page)['water']))
        page.reload(); page.wait_for_selector('.pads')
        check('i dati restano dopo il ricaricamento', state(page)['settings']['name'] == 'Micheal')
        sw = page.evaluate('() => navigator.serviceWorker.getRegistration().then(r => !!r)')
        check('service worker registrato (offline)', sw)
        page.screenshot(path=str(SHOTS / 'd-oggi-usato.png'), full_page=True)
        ctx.close()

        # ── Dati di esempio per gli screenshot (60 giorni) ──
        demo = page_state = None
        ctx = browser.new_context(viewport={'width': 1440, 'height': 900}, locale='it-IT', timezone_id='Europe/Rome')
        page = ctx.new_page(); attach(page, 'demo')
        page.goto(URL); page.wait_for_selector('#onb-form')
        page.fill('#onb-form input[name=name]', 'Micheal'); page.click('#onb-form button.key'); page.wait_for_selector('.pads')
        page.evaluate((ROOT / 'tests' / 'demo.js').read_text())
        page.reload(); page.wait_for_selector('.pads')
        for v in ['oggi', 'acqua', 'workout', 'lavoro', 'todo', 'progetti', 'casa', 'progressi', 'impostazioni']:
            page.goto(URL + '#' + v); page.wait_for_timeout(350)
            page.screenshot(path=str(SHOTS / f'd-{v}.png'), full_page=True)
        page.emulate_media(color_scheme='dark'); page.goto(URL + '#oggi'); page.wait_for_timeout(300)
        page.screenshot(path=str(SHOTS / 'd-oggi-dark.png'), full_page=True)
        page.goto(URL + '#progressi'); page.wait_for_timeout(300)
        page.screenshot(path=str(SHOTS / 'd-progressi-dark.png'), full_page=True)
        storage = page.evaluate('() => localStorage.getItem("ritmo.v1")')
        ctx.close()

        # ── iPhone ──
        iphone = dict(viewport={'width': 393, 'height': 852}, device_scale_factor=3, is_mobile=True, has_touch=True, locale='it-IT', timezone_id='Europe/Rome')
        for scheme in ['light', 'dark']:
            ctx = browser.new_context(color_scheme=scheme, **iphone)
            ctx.add_init_script(f'localStorage.setItem("ritmo.v1", {json.dumps(storage)})')
            page = ctx.new_page(); attach(page, 'iphone-' + scheme)
            for v in (['oggi', 'todo', 'lavoro', 'casa', 'progressi', 'acqua', 'workout', 'progetti'] if scheme == 'light' else ['oggi', 'lavoro']):
                page.goto(URL + '#' + v); page.wait_for_timeout(350)
                page.screenshot(path=str(SHOTS / f'm-{scheme}-{v}.png'), full_page=(v != 'oggi'))
                if v == 'oggi': page.screenshot(path=str(SHOTS / f'm-{scheme}-oggi-full.png'), full_page=True)
            if scheme == 'light':
                page.goto(URL + '#oggi'); page.wait_for_timeout(300)
                page.tap('[data-act=more]'); page.wait_for_timeout(300)
                page.screenshot(path=str(SHOTS / 'm-light-altro.png'))
                check('menu Altro su iPhone', page.is_visible('#modal'))
                overflow = page.evaluate('() => document.documentElement.scrollWidth > window.innerWidth + 1')
                check('nessuno scroll orizzontale su iPhone', not overflow)
            ctx.close()
        browser.close()
finally:
    srv.terminate()

print('\n' + '\n'.join(errors) if errors else '\nnessun errore in console')
failed = [r for r in results if not r[1]]
print(f'{len(results) - len(failed)}/{len(results)} controlli superati')
sys.exit(1 if failed or errors else 0)
