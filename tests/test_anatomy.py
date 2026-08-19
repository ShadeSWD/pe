# -*- coding: utf-8 -*-
"""Проверка анатомии фигур: отдельный тест поверх tools/check_anatomy.js.

Скрипт прогоняет каждый кадр каждой анимации и каждую статическую схему через
параметрическую модель фигуры и падает, если:
  * угол в суставе вышел за анатомический диапазон;
  * длина звена разошлась с эталоном больше чем на 3 %;
  * тело, объявленное «у поверхности», оказалось глубже 0,05 роста;
  * таз провален ниже линии «плечи — колени» там, где это не заявлено как
    показанная ошибка.

Тест один на весь раздел намеренно: проверка сама печатает, где именно и что
нашла, и разбивать её на параметризованные случаи значило бы дублировать
разбор вывода на стороне pytest.
"""
import os
import shutil
import subprocess

import pytest

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CHECK = os.path.join(ROOT, 'tools', 'check_anatomy.js')


@pytest.mark.skipif(not shutil.which('node'), reason='node не установлен')
@pytest.mark.skipif(not os.path.isfile(CHECK), reason='нет tools/check_anatomy.js')
def test_anatomy():
    r = subprocess.run(['node', CHECK], capture_output=True, text=True, cwd=ROOT)
    out = (r.stdout or '') + (r.stderr or '')
    assert r.returncode == 0, 'нарушения анатомии:\n' + out
    assert 'нарушений анатомии: 0' in out, 'проверка не отчиталась:\n' + out
