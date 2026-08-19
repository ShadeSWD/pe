# -*- coding: utf-8 -*-
"""Контактный лист из снимков: одна анимация — одна строка из шести фаз.

    python3 tools/contact_sheet.py <каталог-снимков> <выходной.png> [фильтр]
"""
import os
import sys

from PIL import Image

CW = 430          # ширина ячейки


def main(src, dst, flt=None):
    names = sorted({f.rsplit('-', 1)[0] for f in os.listdir(src)
                    if f.endswith('.png') and f[-5].isdigit()})
    if flt:
        names = [n for n in names if flt in n]
    rows = []
    for n in names:
        cells = []
        for i in range(6):
            p = os.path.join(src, '%s-%d.png' % (n, i))
            if os.path.exists(p):
                im = Image.open(p)
                im = im.resize((CW, max(1, round(im.height * CW / im.width))))
                cells.append(im)
        if cells:
            rows.append((n, cells))
    if not rows:
        print('нечего собирать')
        return 1
    w = CW * 6
    h = sum(max(c.height for c in cs) + 18 for _, cs in rows)
    sheet = Image.new('RGB', (w, h), 'white')
    y = 0
    for n, cs in rows:
        x = 0
        for c in cs:
            sheet.paste(c, (x, y + 18))
            x += CW
        y += max(c.height for c in cs) + 18
    sheet.save(dst)
    print(dst, sheet.size, 'строк:', len(rows))
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1], sys.argv[2], sys.argv[3] if len(sys.argv) > 3 else None))
