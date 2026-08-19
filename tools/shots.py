# -*- coding: utf-8 -*-
"""Снимки схем и анимаций раздела «плавание» — для сравнения «было — стало».

Каждая анимация снимается в шести фазах цикла (u = 0, 1/6, … 5/6): плеер
ставится на паузу, st.u выставляется вручную, вызывается render(). Каждая
статическая схема снимается целиком по своему <svg>.

    python3 tools/shots.py <каталог-назначения>
"""
import http.server
import os
import socketserver
import sys
import threading

from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SITE = os.path.join(ROOT, 'site')

# анимация → страница, на которой она смонтирована
ANIMS = [
    ('float', 's-water'), ('breath-cycle', 's-breath'), ('glide', 's-glide'),
    ('legs-crawl', 's-legs'), ('legs-crawl-bad', 's-legs'),
    ('legs-breast', 's-legs'), ('legs-breast-top', 's-breast'),
    ('crawl-side', 's-crawl'), ('hand-path', 's-arms'), ('crawl-top', 's-crawl'),
    ('back-side', 's-back'), ('breast-side', 's-breast'),
    ('breast-top', 's-breast'), ('turn-open', 's-turns'), ('start-dive', 's-turns'),
]

# статические схемы с фигурой человека: страница, номер geo-board на странице
STATIC = [
    ('s-glide', 0, 'glide-line-vs-headup'),
    ('s-legs', 0, 'foot-pointed-vs-flexed'),
    ('s-water', 0, 'pool-section-standing'),
    ('s-back', 0, 'back-position-good-bad'),
    ('s-breast', 1, 'breast-kick-symmetry'),
]

PHASES = 6


def serve():
    os.chdir(SITE)
    handler = http.server.SimpleHTTPRequestHandler
    httpd = socketserver.TCPServer(('127.0.0.1', 0), handler)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    return httpd, httpd.server_address[1]


def main(out):
    os.makedirs(out, exist_ok=True)
    httpd, port = serve()
    base = 'http://127.0.0.1:%d/' % port
    errors = []
    with sync_playwright() as pw:
        br = pw.chromium.launch()
        pg = br.new_page(viewport={'width': 900, 'height': 900},
                         device_scale_factor=2)
        pg.on('pageerror', lambda e: errors.append(str(e)))
        pages = sorted({p for _, p in ANIMS} | {p for p, _, _ in STATIC})
        for page in pages:
            pg.goto(base + page + '.html', wait_until='load')
            pg.wait_for_timeout(500)
            for name, host in ANIMS:
                if host != page:
                    continue
                box = pg.query_selector('[data-anim="%s"]' % name)
                if not box:
                    errors.append('нет анимации %s на %s' % (name, page))
                    continue
                for i in range(PHASES):
                    pg.evaluate(
                        '([sel,u])=>{const b=document.querySelector(sel);'
                        'b.peAnim.setPlaying(false);b.peAnim.st.u=u;b.peAnim.render();}',
                        ['[data-anim="%s"]' % name, i / PHASES])
                    pg.wait_for_timeout(60)
                    svg = box.query_selector('svg')
                    svg.screenshot(path=os.path.join(out, '%s-%d.png' % (name, i)))
            for spage, idx, label in STATIC:
                if spage != page:
                    continue
                svgs = pg.query_selector_all('svg.geo-board')
                if idx >= len(svgs):
                    errors.append('нет схемы %s (%s #%d)' % (label, page, idx))
                    continue
                svgs[idx].screenshot(path=os.path.join(out, 'static-%s.png' % label))
        br.close()
    httpd.shutdown()
    for e in errors:
        print('ОШИБКА:', e)
    print('снимков:', len([f for f in os.listdir(out) if f.endswith('.png')]))
    return 1 if errors else 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, 'shots')))
