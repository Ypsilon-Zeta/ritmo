from PIL import Image, ImageDraw
import pathlib
OUT = pathlib.Path(__file__).parent / 'docs' / 'icons'; OUT.mkdir(parents=True, exist_ok=True)
BG = (38, 42, 49); OFF = (58, 63, 71); EDGE_OFF = (30, 33, 38)
LIT = {'a': (42, 120, 214), 'w': (235, 104, 52), 'l': (27, 175, 122), 't': (237, 161, 0), 'p': (232, 123, 164), 'c': (0, 131, 0)}
PATTERN = ['a', None, 'w', None, 'l', 't', 'p', None, 'c']
def darker(c, k=0.72): return tuple(int(x * k) for x in c)
def draw(size, rounded=True, safe=0.0):
    S = size * 4
    im = Image.new('RGBA', (S, S), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    if rounded: d.rounded_rectangle([0, 0, S - 1, S - 1], radius=int(S * 0.225), fill=BG)
    else: d.rectangle([0, 0, S, S], fill=BG)
    inset = S * (0.2 + safe * 0.5); grid = S - 2 * inset; gap = grid * 0.075; cell = (grid - 2 * gap) / 3
    for i, k in enumerate(PATTERN):
        r, c = divmod(i, 3); x = inset + c * (cell + gap); y = inset + r * (cell + gap)
        col = LIT[k] if k else OFF; edge = darker(col) if k else EDGE_OFF
        rad = int(cell * 0.22)
        d.rounded_rectangle([x, y, x + cell, y + cell], radius=rad, fill=edge)
        d.rounded_rectangle([x, y, x + cell, y + cell - cell * 0.09], radius=rad, fill=col)
    return im.resize((size, size), Image.LANCZOS)
draw(180, rounded=False).convert('RGB').save(OUT / 'apple-touch-icon.png')
draw(192).save(OUT / 'icon-192.png'); draw(512).save(OUT / 'icon-512.png')
draw(512, rounded=False, safe=0.18).convert('RGB').save(OUT / 'icon-maskable-512.png')
# SVG (favicon)
cells = []
inset, grid = 20, 60; gap = grid * 0.075; cell = (grid - 2 * gap) / 3
hexes = {'a': '#2a78d6', 'w': '#eb6834', 'l': '#1baf7a', 't': '#eda100', 'p': '#e87ba4', 'c': '#008300'}
for i, k in enumerate(PATTERN):
    r, c = divmod(i, 3); x = inset + c * (cell + gap); y = inset + r * (cell + gap)
    cells.append(f'<rect x="{x:.2f}" y="{y:.2f}" width="{cell:.2f}" height="{cell:.2f}" rx="{cell*0.22:.2f}" fill="{hexes[k] if k else "#3a3f47"}"/>')
svg = f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" rx="22.5" fill="#262a31"/>{"".join(cells)}</svg>'
(OUT / 'icon.svg').write_text(svg)
print('icone ok')
