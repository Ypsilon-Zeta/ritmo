"""Sync Mac↔iPhone simulata: due browser separati + API GitHub finta. Uso: python3 tests/sync_e2e.py"""
import json, os, subprocess, sys, time, pathlib, re, itertools
from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
# Chrome di sistema se c'è (Linux o Mac), altrimenti il Chromium di Playwright (`python3 -m playwright install chromium`)
CHROME = os.environ.get('CHROME') or next((c for c in ['/usr/bin/google-chrome', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'] if os.path.exists(c)), None)
PORT = 8766; URL = f'http://localhost:{PORT}/'
srv = subprocess.Popen([sys.executable, '-m', 'http.server', str(PORT), '-d', str(ROOT / 'docs')], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(0.8)
TOKEN = 'ghp_TEST_segreto_123'
GISTS, calls, errors, results = {}, [], [], []
ids = itertools.count(1)
CORS = {'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': 'GET,POST,PATCH,OPTIONS', 'Content-Type': 'application/json'}

def check(name, cond, detail=''):
    results.append((name, bool(cond))); print(('ok  ' if cond else 'FAIL'), name, '' if cond else detail)

def github(route, request):
    url, method = request.url, request.method
    if method == 'OPTIONS': return route.fulfill(status=204, headers=CORS)
    calls.append((method, url))
    if request.headers.get('authorization') != 'Bearer ' + TOKEN: return route.fulfill(status=401, headers=CORS, body='{"message":"Bad credentials"}')
    path = re.sub(r'^https://api\.github\.com', '', url).split('?')[0]
    if path == '/gists' and method == 'GET':
        return route.fulfill(status=200, headers=CORS, body=json.dumps([{'id': k, 'description': g['description'], 'files': {f: {'filename': f} for f in g['files']}} for k, g in GISTS.items()]))
    if path == '/gists' and method == 'POST':
        body = json.loads(request.post_data); gid = 'g%d' % next(ids)
        GISTS[gid] = {'description': body['description'], 'public': body['public'], 'files': {k: v['content'] for k, v in body['files'].items()}}
        return route.fulfill(status=201, headers=CORS, body=json.dumps({'id': gid}))
    m = re.match(r'^/gists/(\w+)$', path)
    if m and m.group(1) in GISTS:
        g = GISTS[m.group(1)]
        if method == 'PATCH':
            for k, v in json.loads(request.post_data)['files'].items(): g['files'][k] = v['content']
        return route.fulfill(status=200, headers=CORS, body=json.dumps({'id': m.group(1), 'files': {k: {'content': v, 'truncated': False} for k, v in g['files'].items()}}))
    return route.fulfill(status=404, headers=CORS, body='{}')

def device(browser, tag):
    ctx = browser.new_context(viewport={'width': 1280, 'height': 860}, locale='it-IT', timezone_id='Europe/Rome')
    ctx.route('https://api.github.com/**', github)
    page = ctx.new_page()
    page.on('pageerror', lambda e: errors.append(f'[{tag}] {e}'))
    page.on('console', lambda m: errors.append(f'[{tag}] {m.text}') if m.type == 'error' else None)
    return ctx, page

st = lambda page: page.evaluate('() => JSON.parse(JSON.stringify(window.Ritmo.state))')
water = lambda s: sum(w['ml'] for w in s['water'] if not w.get('d'))
def sync_now(page):
    page.evaluate("() => { const b = document.createElement('button'); b.dataset.act = 'sync-now'; document.body.appendChild(b); b.click(); b.remove(); }")
    page.wait_for_function("() => !document.querySelector('#sync-mini') || !/Sincronizzo/.test(document.querySelector('#sync-mini').textContent)", timeout=5000)
    page.wait_for_timeout(300)

try:
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path=CHROME, args=['--no-sandbox'])
        # Mac
        ca, A = device(browser, 'mac'); A.goto(URL); A.wait_for_selector('#onb-form')
        A.fill('#onb-form input[name=name]', 'Micheal'); A.click('#onb-form button.key'); A.wait_for_selector('.pads')
        A.click('.now .btn.key'); A.wait_for_timeout(150)  # +250 ml
        A.goto(URL + '#impostazioni'); A.wait_for_selector('#sync-token')
        A.fill('#sync-token', 'sbagliato'); A.click('#sync-form button.key'); A.wait_for_timeout(800)
        check('token sbagliato: errore chiaro, nessun gist', not GISTS and A.locator('text=Token non valido').count() >= 1)
        A.fill('#sync-token', TOKEN); A.click('#sync-form button.key')
        A.wait_for_selector('text=Sincronizzazione Mac', timeout=5000); A.wait_for_timeout(800)
        check('gist segreto creato al primo collegamento', len(GISTS) == 1 and not list(GISTS.values())[0]['public'])
        content = list(GISTS.values())[0]['files']['ritmo-data.json']
        check('il token NON finisce nel gist', TOKEN not in content)
        check('i dati del Mac sono nel gist', water(json.loads(content)) == 250 and len(json.loads(content)['projects']) == 4)

        # iPhone
        cb, B = device(browser, 'iphone'); B.goto(URL); B.wait_for_selector('#onb-form')
        B.click('[data-act=onb-skip]'); B.wait_for_timeout(150)
        B.goto(URL + '#impostazioni'); B.wait_for_selector('#sync-token')
        B.fill('#sync-token', TOKEN); B.click('#sync-form button.key'); B.wait_for_timeout(1200)
        sb = st(B)
        check('iPhone trova lo stesso gist (nessun duplicato)', len(GISTS) == 1)
        check('iPhone riceve i dati del Mac', water(sb) == 250 and sb['settings']['name'] == 'Micheal' and len(sb['projects']) == 4, f"{water(sb)} {sb['settings']['name']}")

        # modifiche su entrambi, poi sync
        B.goto(URL + '#oggi'); B.wait_for_selector('.pads')
        B.evaluate("() => { const b = document.createElement('button'); b.dataset.act = 'water'; b.dataset.ml = '500'; document.body.appendChild(b); b.click(); b.remove(); }")
        A.goto(URL + '#todo'); A.wait_for_selector('#qa'); A.fill('#qa', 'Comprare le batterie domani'); A.press('#qa', 'Enter'); A.wait_for_timeout(150)
        sync_now(B); sync_now(A); sync_now(B)
        sa, sb = st(A), st(B)
        check('acqua unita su entrambi (250 + 500)', water(sa) == 750 and water(sb) == 750, f'{water(sa)} {water(sb)}')
        check('attività del Mac arriva su iPhone', any(t['title'] == 'Comprare le batterie' for t in sb['tasks']))

        # cancellazione propagata (tombstone)
        wid = next(w['id'] for w in sa['water'] if w['ml'] == 500 and not w.get('d'))
        A.evaluate(f"() => {{ const b = document.createElement('button'); b.dataset.act = 'water-del'; b.dataset.id = '{wid}'; document.body.appendChild(b); b.click(); b.remove(); }}")
        sync_now(A); sync_now(B)
        check('eliminazione propagata', water(st(B)) == 250, str(water(st(B))))

        # timer avviato sul Mac visibile su iPhone
        A.goto(URL + '#lavoro'); A.wait_for_selector('[data-act=focus-start]'); A.click('[data-act=focus-start]'); A.wait_for_timeout(200)
        sync_now(A); sync_now(B); B.goto(URL + '#lavoro'); B.wait_for_timeout(1200)
        check('timer condiviso tra dispositivi', st(B)['timer']['status'] == 'run' and re.match(r'1[45]:\d\d', B.inner_text('.timer-face .tt')) is not None)

        # convergenza: stesso contenuto canonico
        same = A.evaluate('() => window.RitmoCore.canon(window.Ritmo.state)') == B.evaluate('() => window.RitmoCore.canon(window.Ritmo.state)')
        check('i due dispositivi convergono allo stesso stato', same)
        patches = len([c for c in calls if c[0] == 'PATCH'])
        sync_now(A); sync_now(B)
        check('nessuna scrittura inutile se nulla cambia', len([c for c in calls if c[0] == 'PATCH']) == patches)
        browser.close()
finally:
    srv.terminate()
print('\n' + '\n'.join(errors) if errors else '\nnessun errore in console')
failed = [r for r in results if not r[1]]
print(f'{len(results) - len(failed)}/{len(results)} controlli superati')
sys.exit(1 if failed or errors else 0)
