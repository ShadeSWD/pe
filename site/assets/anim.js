/* Плеер учебных анимаций сайта «Физическая культура и спорт».
 *
 * Внешних библиотек нет: кадр — это строка SVG-разметки, которую рисует
 * функция draw(u), где u ∈ [0,1) — положение внутри цикла движения.
 * Плеер отвечает за время, паузу, скорость, покадровый шаг, подсветку
 * текущей фазы и подпись к ней.
 *
 * Регистрация анимации:
 *   PE.reg('crawl-side', {
 *     w, h,            — размеры viewBox (ширина всегда 640);
 *     frames,          — сколько дискретных кадров в цикле (шаг покадровый);
 *     period,          — длительность цикла, мс, при скорости ×1;
 *     phases: [{to, name, note}]  — границы фаз по u (нарастающие, последняя to=1);
 *     bg: () => '…',   — неподвижный слой (вода, стенка, разметка);
 *     draw: (u) => '…' — подвижный слой;
 *     caption: '…'     — подпись под доской.
 *   });
 *
 * Разметка страницы: <div class="anim-box" data-anim="crawl-side"></div>
 * Всё остальное плеер строит сам при загрузке документа.
 *
 * Анимация вне экрана останавливается (IntersectionObserver): на странице их
 * бывает по пять-шесть, и незачем крутить невидимые.
 */
'use strict';
(function (global) {
  const PE = global.PE || (global.PE = {});
  const REG = PE.ANIM || (PE.ANIM = {});

  PE.reg = function (name, def) { REG[name] = def; };

  /* ---------- математика ---------- */

  /* Циклическая интерполяция Катмулла — Рома по опорным точкам
     keys = [{u, x, y}, …] (u возрастает, цикл замыкается 0↔1).
     Нужна, чтобы кисть шла по гладкой траектории, а не по ломаной. */
  function cyclic(keys, u) {
    const n = keys.length;
    u = ((u % 1) + 1) % 1;
    let i = 0;
    while (i < n - 1 && keys[i + 1].u <= u) i++;
    const k1 = keys[i], k2 = keys[(i + 1) % n];
    const k0 = keys[(i - 1 + n) % n], k3 = keys[(i + 2) % n];
    let span = k2.u - k1.u;
    if (span <= 0) span += 1;
    const t = span ? (u - k1.u) / span : 0;
    const t2 = t * t, t3 = t2 * t;
    const cr = (p0, p1, p2, p3) => 0.5 * (
      2 * p1 + (-p0 + p2) * t
      + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2
      + (-p0 + 3 * p1 - 3 * p2 + p3) * t3);
    return { x: cr(k0.x, k1.x, k2.x, k3.x), y: cr(k0.y, k1.y, k2.y, k3.y) };
  }

  /* Линейная интерполяция скаляра по тем же правилам (углы, крены). */
  function cyclicVal(keys, u) {
    const n = keys.length;
    u = ((u % 1) + 1) % 1;
    let i = 0;
    while (i < n - 1 && keys[i + 1].u <= u) i++;
    const k1 = keys[i], k2 = keys[(i + 1) % n];
    const k0 = keys[(i - 1 + n) % n], k3 = keys[(i + 2) % n];
    let span = k2.u - k1.u;
    if (span <= 0) span += 1;
    const t = span ? (u - k1.u) / span : 0;
    const t2 = t * t, t3 = t2 * t;
    return 0.5 * (2 * k1.v + (-k0.v + k2.v) * t
      + (2 * k0.v - 5 * k1.v + 4 * k2.v - k3.v) * t2
      + (-k0.v + 3 * k1.v - 3 * k2.v + k3.v) * t3);
  }

  /* Кусочно-линейная интерполяция по тем же кадрам. Нужна там, где важно
     НЕ выходить за диапазон опорных значений: сплайн Катмулла — Рома на
     резких переходах (разворот тела у стенки) делает выброс, и фигура
     уезжает за край доски. */
  function lerpVal(keys, u) {
    const n = keys.length;
    u = ((u % 1) + 1) % 1;
    let i = 0;
    while (i < n - 1 && keys[i + 1].u <= u) i++;
    const k1 = keys[i], k2 = keys[(i + 1) % n];
    let span = k2.u - k1.u;
    if (span <= 0) span += 1;
    const t = span ? (u - k1.u) / span : 0;
    const e = t * t * (3 - 2 * t);              // сглаживание на концах
    return k1.v + (k2.v - k1.v) * e;
  }

  /* Обратная задача для двухзвенной конечности: по плечу S и кисти P
     находим локоть. sign задаёт, в какую сторону «смотрит» локоть
     (в плавании это принципиально: «высокий локоть» при гребке).
     Если точка недостижима, кисть подтягивается на предельную длину —
     рука не растягивается резиновой. */
  function ik(sx, sy, px, py, l1, l2, sign) {
    let dx = px - sx, dy = py - sy;
    let d = Math.hypot(dx, dy);
    const dmax = l1 + l2 - 0.01, dmin = Math.abs(l1 - l2) + 0.01;
    if (d < 1e-6) { dx = 1; dy = 0; d = 1; }
    const ux = dx / d, uy = dy / d;
    const dc = Math.min(Math.max(d, dmin), dmax);
    const hx = sx + ux * dc, hy = sy + uy * dc;      // исправленная кисть
    const a = (dc * dc + l1 * l1 - l2 * l2) / (2 * dc);
    const h = Math.sqrt(Math.max(0, l1 * l1 - a * a));
    return {
      ex: sx + ux * a - sign * uy * h,
      ey: sy + uy * a + sign * ux * h,
      hx, hy,
    };
  }

  const rot = (cx, cy, x, y, deg) => {
    const a = deg * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
    const dx = x - cx, dy = y - cy;
    return { x: cx + dx * c - dy * s, y: cy + dx * s + dy * c };
  };

  const num = (v) => Math.round(v * 10) / 10;

  /* ---------- примитивы разметки ---------- */

  const line = (x1, y1, x2, y2, stroke, w, extra) =>
    `<line x1="${num(x1)}" y1="${num(y1)}" x2="${num(x2)}" y2="${num(y2)}" stroke="${stroke}" stroke-width="${w || 1.6}" stroke-linecap="round"${extra || ''}/>`;

  const circle = (cx, cy, r, fill, stroke, w) =>
    `<circle cx="${num(cx)}" cy="${num(cy)}" r="${num(r)}" fill="${fill || 'none'}"${stroke ? ` stroke="${stroke}" stroke-width="${w || 1.6}"` : ''}/>`;

  const path = (d, stroke, w, fill, extra) =>
    `<path d="${d}" fill="${fill || 'none'}" stroke="${stroke || 'none'}" stroke-width="${w || 1.6}" stroke-linecap="round" stroke-linejoin="round"${extra || ''}/>`;

  const text = (x, y, s, fill, size, anchor) =>
    `<text x="${num(x)}" y="${num(y)}" ${anchor ? `text-anchor="${anchor}" ` : ''}style="font:${size || 11}px system-ui;fill:${fill || '#6b6b74'}">${s}</text>`;

  /* Звено конечности: толстая линия + сустав. */
  const limb = (a, b, stroke, w) =>
    line(a.x, a.y, b.x, b.y, stroke, w) + circle(b.x, b.y, 2.6, stroke);

  PE.m = { cyclic, cyclicVal, lerpVal, ik, rot, line, circle, path, text, limb, num };

  /* ---------- плеер ---------- */

  const SVG_HEAD = (w, h) =>
    `<svg viewBox="0 0 ${w} ${h}" class="anim" role="img">`;

  function mount(box, def, name) {
    const w = def.w || 640, h = def.h || 300;
    const frames = def.frames || 60;
    const period = def.period || 4000;
    const phases = def.phases || [{ to: 1, name: 'Цикл', note: '' }];

    box.innerHTML = `${SVG_HEAD(w, h)}
      <g class="anim-bg">${def.bg ? def.bg() : ''}</g>
      <g class="anim-fg"></g></svg>
    <div class="anim-bar">
      <button type="button" class="btn play" data-role="play">⏸ Пауза</button>
      <button type="button" class="btn" data-role="prev" title="предыдущий кадр">◀ кадр</button>
      <button type="button" class="btn" data-role="next" title="следующий кадр">кадр ▶</button>
      <label>скорость <input type="range" min="20" max="200" step="5" value="100" data-role="speed">
        <span class="readout" data-role="speedout">×1,0</span></label>
      <span class="anim-frame" data-role="frame">кадр 1 / ${frames}</span>
    </div>
    <div class="anim-phase" data-role="phases">${phases.map((p, i) =>
      `<button type="button" data-i="${i}">${i + 1}. ${p.name}</button>`).join('')}</div>
    <div class="anim-note" data-role="note"></div>
    ${def.caption ? `<div class="caption">${def.caption}</div>` : ''}`;

    const fg = box.querySelector('.anim-fg');
    const noteEl = box.querySelector('[data-role=note]');
    const frameEl = box.querySelector('[data-role=frame]');
    const chips = [...box.querySelectorAll('[data-role=phases] button')];
    const playBtn = box.querySelector('[data-role=play]');
    const speedEl = box.querySelector('[data-role=speed]');
    const speedOut = box.querySelector('[data-role=speedout]');

    const st = { u: 0, playing: true, speed: 1, visible: true, last: 0 };

    const phaseOf = (u) => {
      for (let i = 0; i < phases.length; i++) if (u < phases[i].to) return i;
      return phases.length - 1;
    };
    const phaseStart = (i) => (i === 0 ? 0 : phases[i - 1].to);

    function render() {
      fg.innerHTML = def.draw(st.u);
      const i = phaseOf(st.u);
      chips.forEach((c, k) => c.classList.toggle('on', k === i));
      noteEl.innerHTML = `<b>${i + 1}. ${phases[i].name}.</b> ${phases[i].note || ''}`;
      const k = Math.floor(st.u * frames) + 1;
      frameEl.textContent = `кадр ${Math.min(k, frames)} / ${frames}`;
    }

    function tick(ts) {
      if (st.playing && st.visible) {
        if (st.last) st.u = (st.u + (ts - st.last) / (period / st.speed)) % 1;
        st.last = ts;
        render();
      } else {
        st.last = 0;
      }
      requestAnimationFrame(tick);
    }

    function setPlaying(on) {
      st.playing = on; st.last = 0;
      playBtn.textContent = on ? '⏸ Пауза' : '▶ Пуск';
    }

    playBtn.addEventListener('click', () => setPlaying(!st.playing));
    box.querySelector('[data-role=prev]').addEventListener('click', () => {
      setPlaying(false);
      const k = Math.round(st.u * frames);
      st.u = (((k - 1) % frames) + frames) % frames / frames;
      render();
    });
    box.querySelector('[data-role=next]').addEventListener('click', () => {
      setPlaying(false);
      const k = Math.round(st.u * frames);
      st.u = ((k + 1) % frames) / frames;
      render();
    });
    speedEl.addEventListener('input', () => {
      st.speed = +speedEl.value / 100;
      speedOut.textContent = '×' + st.speed.toFixed(1).replace('.', ',');
    });
    chips.forEach((c, i) => c.addEventListener('click', () => {
      setPlaying(false);
      st.u = Math.min(phaseStart(i) + 1e-4, 0.999);
      render();
    }));

    if ('IntersectionObserver' in global) {
      new IntersectionObserver((es) => { st.visible = es[0].isIntersecting; },
        { threshold: 0.02 }).observe(box);
    }

    render();
    requestAnimationFrame(tick);
    box.dataset.animReady = name;
    /* доступ из автопроверок и с других скриптов страницы */
    box.peAnim = { st, render, setPlaying, phaseOf, phases, frames };
  }

  PE.mountAll = function (scope) {
    (scope || document).querySelectorAll('[data-anim]').forEach((box) => {
      if (box.dataset.animReady) return;
      const def = REG[box.dataset.anim];
      if (!def) { box.innerHTML = '<div class="small">анимация не найдена: ' + box.dataset.anim + '</div>'; return; }
      mount(box, def, box.dataset.anim);
    });
  };

  const ready = (fn) => (document.readyState === 'loading'
    ? document.addEventListener('DOMContentLoaded', fn) : fn());
  ready(() => PE.mountAll());
})(window);
