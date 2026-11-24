#!/usr/bin/env python3
"""Costruisce dist/: index.html autonomo (CSS e JS inline), service worker, manifest e icone."""
import json, pathlib, re

ROOT = pathlib.Path(__file__).parent
SRC, DIST = ROOT / 'src', ROOT / 'docs'
DIST.mkdir(exist_ok=True)
(DIST / 'icons').mkdir(exist_ok=True)

ui = ''.join((SRC / f).read_text() for f in ['ui1.js', 'ui2.js', 'ui3.js', 'ui4.js'])
version = re.search(r"const VERSION = '([^']+)'", ui).group(1)
html = (SRC / 'shell.html').read_text()
html = html.replace('/*__CSS__*/', (SRC / 'styles.css').read_text())
html = html.replace('/*__CORE__*/', (SRC / 'core.js').read_text())
html = html.replace('/*__UI__*/', ui)
(DIST / 'index.html').write_text(html)
(ROOT / 'tests' / '_ui_check.js').write_text(ui)  # solo per il controllo sintattico
(DIST / 'sw.js').write_text((SRC / 'sw.js').read_text().replace('__VERSION__', version))

manifest = {
    'name': 'Ritmo',
    'short_name': 'Ritmo',
    'description': 'Il tuo Daily OS: acqua, workout, lavoro, attività, progetti e casa.',
    'lang': 'it',
    'start_url': './',
    'scope': './',
    'display': 'standalone',
    'background_color': '#e3e5e8',
    'theme_color': '#e3e5e8',
    'icons': [
        {'src': 'icons/icon-192.png', 'sizes': '192x192', 'type': 'image/png'},
        {'src': 'icons/icon-512.png', 'sizes': '512x512', 'type': 'image/png'},
        {'src': 'icons/icon-maskable-512.png', 'sizes': '512x512', 'type': 'image/png', 'purpose': 'maskable'},
        {'src': 'icons/icon.svg', 'sizes': 'any', 'type': 'image/svg+xml'},
    ],
    'shortcuts': [
        {'name': 'Bevi un bicchiere', 'url': './?add=water'},
        {'name': 'Avvia un blocco da 15 minuti', 'url': './?focus=start'},
        {'name': 'Da fare', 'url': './#todo'},
    ],
}
(DIST / 'manifest.webmanifest').write_text(json.dumps(manifest, ensure_ascii=False, indent=2))
print(f'build ok: versione {version}, index.html {len(html)//1024} KB')
