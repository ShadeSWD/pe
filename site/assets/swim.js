/* Анимации раздела «Плавание с нуля»: общие построения фигуры пловца и
 * анимации начального обучения (всплывание, скольжение, дыхание, ноги).
 * Техника четырёх способов — в assets/strokes.js, плеер — в assets/anim.js.
 *
 * Как устроена фигура. Тело задано двумя точками — плечо и таз; голова
 * привязана к плечу. Рука и нога — двухзвенные цепочки с постоянными
 * длинами. Ключевые положения кисти заданы кадрами (u, x, y, сторона
 * локтя); локоть для каждого кадра считается обратной задачей ОДИН раз при
 * загрузке, а между кадрами интерполируются уже положения локтя и кисти.
 * Так сделано намеренно: интерполировать «сторону локтя» нельзя — в тот
 * момент, когда рука проходит через выпрямленное положение, сторона
 * меняется, и решение обратной задачи скачком перебрасывает локоть через
 * линию плечо—кисть. Интерполяция самих точек этого скачка не даёт.
 *
 * Пропорции взяты от условного роста 220 единиц изображения:
 * рука (плечо—кончики пальцев) 0,44·H, плечо—таз 0,29·H, нога 0,52·H,
 * диаметр головы 0,13·H. При viewBox шириной 640 это даёт фигуру около
 * 300 единиц в длину — она помещается на доску целиком.
 */
'use strict';
(function (global) {
  const PE = global.PE;
  const M = PE.m;
  const { cyclic, ik, line, circle, path, text } = M;

  /* ---------- палитра и общие размеры ---------- */
  const C = {
    ink: '#16161a',
    water: '#155e75',
    red: '#b3382e',
    green: '#1a7f37',
    gray: '#6b6b74',
    far: '#a9b3ba',          // дальняя (вторая) рука и нога
    skin: '#e8eef2',         // заливка тела
    surf: '#155e75',
  };
  const L = { arm1: 52, arm2: 45, hand: 13, thigh: 54, shin: 50, foot: 20 };

  PE.C = C; PE.L = L;

  /* ---------- вода ---------- */

  /* Поверхность воды: волнистая линия и лёгкая заливка ниже неё. */
  function water(w, h, ws, opt) {
    const o = opt || {};
    let d = `M 0 ${ws}`;
    /* ровно w/40 звеньев: каждое продвигает линию на 40 единиц, лишнее
       звено вылезло бы за правый край доски */
    for (let x = 0; x + 40 <= w; x += 40) d += ` q 10 -3 20 0 t 20 0`;
    const fill = `<path d="${d} L ${w} ${h} L 0 ${h} Z" fill="rgba(21,94,117,.06)" stroke="none"/>`;
    return fill + path(d, C.surf, 1.6)
      + (o.label === false ? '' : text(8, ws - 7, 'поверхность воды', C.water));
  }

  /* Стрелка «направление движения» в правом верхнем углу доски. */
  const moveArrow = (x, y, s) => line(x, y, x + 54, y, C.green, 2, ' marker-end="url(#arrG)"')
    + text(x + 60, y + 4, s || 'движение', C.green);

  /* Пузырьки и струйки, сносимые назад: показывают, что пловец движется
     вперёд, а не висит на месте. */
  function drift(u, ws, n, y0, y1, seed) {
    let s = '';
    for (let i = 0; i < n; i++) {
      const k = (i * 0.618 + (seed || 0)) % 1;
      const x = 626 - (((u * 0.9 + k) % 1) * 614);
      const y = y0 + ((i * 37) % (y1 - y0));
      const r = 1.4 + ((i * 13) % 5) * 0.35;
      s += circle(x, y, r, 'rgba(21,94,117,.30)');
    }
    return s;
  }

  /* ---------- фигура ---------- */

  /* Тело: силуэт от плеча к тазу плюс голова. dir = +1 (головой вправо). */
  function body(sh, hip, head, r, opt) {
    const o = opt || {};
    const dx = head.x - hip.x, dy = head.y - hip.y;
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len, ny = dx / len;           // нормаль к оси тела
    const wSh = o.wSh === undefined ? 15 : o.wSh;  // полуширина у плеч
    const wHip = o.wHip === undefined ? 10 : o.wHip;
    const mx = (sh.x + hip.x) / 2, my = (sh.y + hip.y) / 2;
    const d = `M ${M.num(sh.x + nx * wSh)} ${M.num(sh.y + ny * wSh)}`
      + ` Q ${M.num(mx + nx * (wSh + 2))} ${M.num(my + ny * (wSh + 2))}`
      + ` ${M.num(hip.x + nx * wHip)} ${M.num(hip.y + ny * wHip)}`
      + ` L ${M.num(hip.x - nx * wHip)} ${M.num(hip.y - ny * wHip)}`
      + ` Q ${M.num(mx - nx * (wSh + 2))} ${M.num(my - ny * (wSh + 2))}`
      + ` ${M.num(sh.x - nx * wSh)} ${M.num(sh.y - ny * wSh)} Z`;
    return path(d, o.stroke || C.ink, 1.4, o.fill || C.skin)
      + line(sh.x, sh.y, head.x, head.y, o.stroke || C.ink, 5)
      + circle(head.x, head.y, r, o.fill || C.skin, o.stroke || C.ink, 1.4);
  }

  /* Рука по заранее посчитанным кадрам {u, hx, hy, ex, ey}. */
  function armAt(keys, u) {
    const hk = keys.map((k) => ({ u: k.u, x: k.hx, y: k.hy }));
    const ek = keys.map((k) => ({ u: k.u, x: k.ex, y: k.ey }));
    return { h: cyclic(hk, u), e: cyclic(ek, u) };
  }

  /* Пересчёт кадров кисти в кадры «кисть + локоть». */
  function armKeys(sh, raw) {
    return raw.map((k) => {
      const j = ik(sh.x, sh.y, k.h[0], k.h[1], L.arm1, L.arm2, k.side);
      return { u: k.u, hx: k.h[0], hy: k.h[1], ex: j.ex, ey: j.ey };
    });
  }

  /* Отрисовка руки: плечо → локоть → запястье → кисть. */
  function drawArm(sh, st, color, w) {
    const dx = st.h.x - st.e.x, dy = st.h.y - st.e.y, d = Math.hypot(dx, dy) || 1;
    const fx = st.h.x + dx / d * L.hand, fy = st.h.y + dy / d * L.hand;
    return line(sh.x, sh.y, st.e.x, st.e.y, color, w)
      + line(st.e.x, st.e.y, st.h.x, st.h.y, color, w)
      + line(st.h.x, st.h.y, fx, fy, color, w * 0.8)
      + circle(st.e.x, st.e.y, 2.8, color)
      + circle(st.h.x, st.h.y, 2.2, color);
  }

  /* Нога кролем (попеременные движения от бедра). p — фаза удара:
     0 — верхняя точка, 0…0,5 — удар вниз, 0,5…1 — возврат вверх.
     Колено сгибается в начале удара и распрямляется к его концу (хлыст),
     на возврате нога идёт прямой — это и отличает правильный удар от
     «велосипеда». */
  function legCrawl(hip, p, color, w) {
    const at = -10 * Math.cos(2 * Math.PI * p);                    // бедро: − вверх
    const fl = 6 + 26 * Math.max(0, Math.sin(2 * Math.PI * (p + 0.1)));
    const At = (180 - at) * Math.PI / 180;
    const kx = hip.x + L.thigh * Math.cos(At), ky = hip.y + L.thigh * Math.sin(At);
    const As = At + fl * Math.PI / 180;
    const ax = kx + L.shin * Math.cos(As), ay = ky + L.shin * Math.sin(As);
    const Af = As - 15 * Math.PI / 180;
    const tx = ax + L.foot * Math.cos(Af), ty = ay + L.foot * Math.sin(Af);
    return line(hip.x, hip.y, kx, ky, color, w)
      + line(kx, ky, ax, ay, color, w)
      + line(ax, ay, tx, ty, color, w * 0.8)
      + circle(kx, ky, 2.8, color) + circle(ax, ay, 2.2, color);
  }

  /* Ошибочный вариант: удар «от колена», бедро почти неподвижно, голень
     ходит как педаль велосипеда. Нужен для сравнения. */
  function legBike(hip, p, color, w) {
    const at = -3 * Math.cos(2 * Math.PI * p);
    const fl = 30 + 30 * Math.cos(2 * Math.PI * p);
    const At = (180 - at) * Math.PI / 180;
    const kx = hip.x + L.thigh * Math.cos(At), ky = hip.y + L.thigh * Math.sin(At);
    const As = At + fl * Math.PI / 180;
    const ax = kx + L.shin * Math.cos(As), ay = ky + L.shin * Math.sin(As);
    const tx = ax + L.foot * Math.cos(As + 0.5), ty = ay + L.foot * Math.sin(As + 0.5);
    return line(hip.x, hip.y, kx, ky, color, w)
      + line(kx, ky, ax, ay, color, w)
      + line(ax, ay, tx, ty, color, w * 0.8)
      + circle(kx, ky, 2.8, color) + circle(ax, ay, 2.2, color);
  }

  PE.swim = { water, moveArrow, drift, body, armAt, armKeys, drawArm, legCrawl, legBike };

  /* ================= 1. Всплывание: поплавок и звёздочка ================= */

  PE.reg('float', {
    w: 640, h: 300, frames: 60, period: 7000,
    phases: [
      { to: 0.20, name: 'Вдох и группировка', note: 'Полный вдох, подбородок к груди, колени обхвачены руками. Воздух в лёгких — это тот самый объём, который делает тело легче воды.' },
      { to: 0.45, name: 'Поплавок', note: 'Тело всплывает спиной вверх и повисает у поверхности. Ноги ко дну не идут: центр тяжести ниже центра объёма, поэтому спина выходит наверх — это устойчивое положение.' },
      { to: 0.70, name: 'Раскрытие в звёздочку', note: 'Медленно разводим руки и ноги. Тело разворачивается лицом вниз и ложится на воду плашмя.' },
      { to: 1.00, name: 'Звёздочка на груди', note: 'Лежим на воде без движений. Лицо в воде, затылок на поверхности. Отсюда вырастает скольжение: достаточно свести руки вперёд.' },
    ],
    bg() {
      return water(640, 300, 96)
        + line(60, 268, 580, 268, C.gray, 1.2, ' stroke-dasharray="6 5"')
        + text(60, 284, 'дно бассейна (мелкая часть, глубина по грудь)', C.gray);
    },
    draw(u) {
      let s = drift(u, 96, 10, 120, 250, 0.2);
      const ws = 96;
      if (u < 0.45) {
        /* группировка и всплывание: шар из тела поднимается к поверхности */
        const t = u < 0.2 ? u / 0.2 : 1;
        const rise = u < 0.2 ? 0 : Math.min(1, (u - 0.2) / 0.18);
        const cy = 210 - rise * 92;
        const cx = 320;
        const r = 40;
        /* сгруппированное тело: спина дугой сверху, голова опущена к груди,
           колени подтянуты и обхвачены руками */
        s += path(`M ${cx - 40} ${cy + 6} Q ${cx - 6} ${cy - 46} ${cx + 34} ${cy - 4}`, C.ink, 7);
        s += circle(cx + 26, cy + 18, 14, C.skin, C.ink, 1.4);          // голова
        s += circle(cx + 30, cy + 22, 2.2, C.ink);                      // лицо вниз
        s += circle(cx - 18, cy + 20, 16, C.skin, C.ink, 1.4);          // колени
        s += line(cx - 34, cy + 4, cx - 4, cy + 24, C.ink, 5);          // руки обхватывают
        s += line(cx - 4, cy + 24, cx + 12, cy + 26, C.ink, 5);
        if (rise > 0.05) {
          for (let i = 0; i < 5; i++) {
            const bx = cx + 34 + i * 4, by = cy + 16 - ((u * 260 + i * 22) % 90);
            if (by > ws + 4) s += circle(bx, by, 2 + (i % 2), 'rgba(21,94,117,.35)');
          }
        }
        s += text(cx - 62, cy + 62, u < 0.2 ? 'вдох, колени к груди' : 'спина выходит на поверхность', C.water);
        /* пара сил в виде схемы: обе стрелки от одной точки в разные стороны */
        s += line(576, 172, 576, 122, C.green, 2, ' marker-end="url(#arrG)"');
        s += text(568, 146, 'выталкивающая сила', C.green, 11, 'end');
        s += line(576, 182, 576, 232, C.red, 2, ' marker-end="url(#arrR)"');
        s += text(568, 210, 'вес тела', C.red, 11, 'end');
        s += circle(576, 177, 2.6, C.ink);
      } else {
        /* раскрытие в звёздочку — вид сверху-сбоку: тело плашмя у поверхности */
        const t = u < 0.7 ? (u - 0.45) / 0.25 : 1;
        const spread = t;
        const cy = 118 + (1 - t) * 6;
        const cx = 320;
        s += line(cx - 78, cy, cx + 66, cy, C.ink, 15, ' stroke-linecap="round"');
        s += circle(cx + 84, cy - 2, 14, C.skin, C.ink, 1.4);
        const aA = (25 + spread * 45) * Math.PI / 180;
        for (const sgn of [-1, 1]) {
          const ax = cx + 58, ay = cy + sgn * 8;
          s += line(ax, ay, ax + 52 * Math.cos(aA) * 0.9, ay + sgn * 52 * Math.sin(aA), C.ink, 5);
          s += line(ax + 52 * Math.cos(aA) * 0.9, ay + sgn * 52 * Math.sin(aA),
            ax + 92 * Math.cos(aA) * 0.9, ay + sgn * 92 * Math.sin(aA), C.ink, 5);
          const lx = cx - 74, ly = cy + sgn * 6;
          const lA = (12 + spread * 32) * Math.PI / 180;
          s += line(lx, ly, lx - 54 * Math.cos(lA), ly + sgn * 54 * Math.sin(lA), C.ink, 5);
          s += line(lx - 54 * Math.cos(lA), ly + sgn * 54 * Math.sin(lA),
            lx - 100 * Math.cos(lA), ly + sgn * 100 * Math.sin(lA), C.ink, 5);
        }
        s += text(200, 200, spread < 0.9 ? 'разводим руки и ноги медленно' : 'лежим на воде, лицо в воде, затылок на поверхности', C.water);
        s += text(200, 220, 'вид сверху: тело лежит плашмя у самой поверхности', C.gray);
      }
      return s;
    },
    caption: 'Всплывание: из группировки («поплавок») тело само выходит спиной к поверхности, потом раскрывается в «звёздочку». Разберите по кадрам, куда смотрит лицо и где находится затылок.',
  });

  /* ================= 2. Дыхание: выдох в воду и вдох ================= */

  PE.reg('breath-cycle', {
    w: 640, h: 300, frames: 60, period: 5000,
    phases: [
      { to: 0.45, name: 'Выдох в воду', note: 'Лицо в воде, выдох непрерывный, через рот и нос. Выдох длиннее вдоха примерно вдвое — это главное отличие плавания от бега.' },
      { to: 0.58, name: 'Поворот к плечу', note: 'Голова поворачивается вместе с корпусом, а не поднимается. Одно ухо и одна щека остаются в воде.' },
      { to: 0.78, name: 'Вдох', note: 'Короткий вдох ртом из «воздушной ямки» — углубления, которое образует голова в набегающей воде. Вдох занимает меньше четверти цикла.' },
      { to: 1.00, name: 'Возврат лица в воду', note: 'Голова возвращается в исходное положение раньше, чем рука войдёт в воду, и выдох начинается сразу.' },
    ],
    bg() {
      return water(640, 300, 150)
        + text(360, 44, 'Объём воздуха в лёгких', C.gray)
        + line(360, 52, 360, 132, C.gray, 1.2)
        + line(360, 132, 600, 132, C.gray, 1.2)
        + text(300, 60, 'полные', C.gray)
        + text(300, 132, 'пустые', C.gray);
    },
    draw(u) {
      /* угол поворота головы: 0 — лицо в воде, 90 — лицо к плечу */
      let ang = 0;
      if (u >= 0.45 && u < 0.58) ang = 90 * (u - 0.45) / 0.13;
      else if (u >= 0.58 && u < 0.78) ang = 90;
      else if (u >= 0.78) ang = 90 * (1 - (u - 0.78) / 0.22);
      const inhale = u >= 0.58 && u < 0.78;

      /* объём воздуха: падает на выдохе, резко растёт на вдохе */
      let vol;
      if (u < 0.45) vol = 1 - 0.8 * (u / 0.45);
      else if (u < 0.58) vol = 0.2;
      else if (u < 0.78) vol = 0.2 + 0.8 * (u - 0.58) / 0.20;
      else vol = 1;

      const ws = 150, cx = 170, cy = 146;
      let s = drift(u, ws, 8, 190, 270, 0.1);

      /* голова спереди: круг, ухо, рот; поворот показываем смещением лица */
      const k = Math.sin(ang * Math.PI / 180);
      const hy = cy - 2 - k * 10;                       // при повороте рот выходит выше
      s += circle(cx, hy, 30, C.skin, C.ink, 1.6);
      s += path(`M ${cx - 30} ${hy} A 30 30 0 0 1 ${cx + 30} ${hy}`, C.ink, 1.6, 'rgba(21,94,117,.08)');
      /* глаза и рот смещаются в сторону поворота */
      s += circle(cx - 11 + k * 16, hy - 6, 2.6, C.ink);
      s += circle(cx + 5 + k * 16, hy - 6, 2.6, C.ink);
      const mx = cx - 3 + k * 20, my = hy + 12;
      s += `<ellipse cx="${M.num(mx)}" cy="${M.num(my)}" rx="${M.num(3 + k * 4)}" ry="${M.num(2 + (inhale ? 3 : 1))}" fill="#b3382e" opacity=".75"/>`;

      if (!inhale) {
        /* пузырьки выдоха идут вверх ото рта */
        for (let i = 0; i < 7; i++) {
          const t = ((u * 3 + i * 0.14) % 1);
          const bx = mx + 6 + i * 3 + Math.sin(t * 6 + i) * 4;
          const by = my - t * 46;
          if (by > ws - 40) s += circle(bx, by, 1.6 + (i % 3) * 0.7, 'rgba(21,94,117,.45)');
        }
        s += text(cx - 58, cy + 78, 'выдох непрерывный, в воду', C.water);
      } else {
        s += line(mx + 34, my - 22, mx + 8, my - 4, C.green, 2, ' marker-end="url(#arrG)"');
        s += text(mx + 40, my - 24, 'вдох ртом', C.green);
        s += text(cx - 58, cy + 78, 'одно ухо остаётся в воде', C.water);
      }
      s += text(cx - 58, cy + 96, 'голова поворачивается, а не поднимается', C.gray);

      /* столбик объёма воздуха */
      const top = 132 - vol * 76;
      s += `<rect x="392" y="${M.num(top)}" width="46" height="${M.num(132 - top)}" fill="${inhale ? '#1a7f37' : '#155e75'}" opacity=".35"/>`;
      s += `<rect x="392" y="52" width="46" height="80" fill="none" stroke="${C.gray}" stroke-width="1.1"/>`;
      s += text(446, top + 4, (inhale ? 'вдох: наполняются' : 'выдох: опустошаются'), inhale ? C.green : C.water);
      s += text(392, 168, 'полный выдох освобождает место', C.gray);
      s += text(392, 184, 'для следующего вдоха', C.gray);
      return s;
    },
    caption: 'Дыхательный цикл пловца: длинный выдох в воду и короткий вдох. Остановите анимацию на фазе вдоха и посмотрите, где находится ухо — оно не выходит из воды.',
  });

  /* ================= 3. Скольжение и торможение ================= */

  PE.reg('glide', {
    w: 640, h: 300, frames: 60, period: 6000,
    phases: [
      { to: 0.14, name: 'Отталкивание от стенки', note: 'Ноги упираются в стенку, руки уже вытянуты вперёд и соединены, голова между руками. Толчок направлен строго вдоль дорожки.' },
      { to: 0.45, name: 'Скольжение', note: 'Тело вытянуто в одну линию, ничего не двигается. На этом участке скорость выше, чем при плавании: сопротивление минимально.' },
      { to: 0.75, name: 'Торможение', note: 'Сопротивление воды гасит скорость. Чем хуже обтекаемое положение, тем быстрее. Верхний пловец держит линию, нижний поднял голову — и остановился заметно раньше.' },
      { to: 1.00, name: 'Начало гребка', note: 'Как только скольжение замедлилось до скорости плавания, начинают работать ноги, затем руки. Раньше начинать невыгодно, позже — тоже.' },
    ],
    bg() {
      let s = water(640, 300, 60, { label: false });
      s += `<rect x="0" y="60" width="34" height="240" fill="rgba(21,94,117,.14)" stroke="${C.water}" stroke-width="1.6"/>`;
      s += text(6, 52, 'стенка', C.water);
      s += text(240, 52, 'поверхность воды', C.water);
      for (let i = 1; i <= 5; i++) {
        const x = 34 + i * 108;
        s += line(x, 62, x, 292, C.gray, 0.9, ' stroke-dasharray="4 6"');
        s += text(x + 4, 292, i * 2 + ' м', C.gray);
      }
      s += text(60, 96, 'обтекаемое положение', C.green);
      s += text(430, 84, 'скорость скольжения:', C.gray);
      s += text(566, 100, 'линия', C.green);
      s += text(566, 116, 'голова', C.red);
      s += text(60, 214, 'голова поднята — сопротивление больше', C.red);
      return s;
    },
    draw(u) {
      /* путь: разгон 0…0,14, затем замедление по экспоненте */
      const push = Math.min(1, u / 0.14);
      const t = Math.max(0, u - 0.14);
      const s1 = 0.86, s2 = 0.5;                       // относительная дальность
      const dist = (a) => 1 - Math.exp(-t / (a * 0.5));
      /* фигура занимает 252 единицы (от носков до кончиков пальцев),
         поэтому ход ограничен так, чтобы она не выходила за края доски */
      const xg = 100 + push * 30 + 310 * dist(s1);
      const xb = 100 + push * 30 + 310 * dist(s2) * 0.62;
      const vg = Math.max(0, Math.exp(-t / (s1 * 0.5)));
      const vb = Math.max(0, Math.exp(-t / (s2 * 0.5)));

      let s = drift(u, 60, 9, 90, 280, 0.4);
      /* верхний: обтекаемое положение */
      s += swimmerLine(xg, 132, 0, C.ink, u > 0.75);
      s += swimmerLine(xb, 248, 13, C.red, false);
      /* указатели скорости стоят на месте: полоски одинаковой шкалы,
         иначе их пришлось бы возить вместе с пловцом и они выехали бы
         за край доски */
      s += line(430, 96, 430 + 130 * vg, 96, C.green, 5.5);
      s += line(430, 112, 430 + 130 * vb, 112, C.red, 5.5);
      return s;
    },
    caption: 'Скольжение после толчка от стенки. Вверху — вытянутое положение, внизу — та же скорость толчка, но поднятая голова. Разница в пройденном расстоянии видна к концу цикла.',
  });

  /* Пловец «в струнку» для анимации скольжения: голова между руками. */
  function swimmerLine(x, y, headUp, color, kicking) {
    const hy = y - headUp;
    let s = line(x + 6, y, x + 78, y, color, 14, ' stroke-linecap="round"');
    s += line(x + 78, y, x + 100, y - headUp * 0.8, color, 5);
    s += circle(x + 104, hy - 2, 12, C.skin, color, 1.4);
    s += line(x + 108, hy - 4, x + 150, hy - 6, color, 5);          // руки вперёд
    s += line(x + 150, hy - 6, x + 168, hy - 6, color, 4);
    s += line(x + 6, y, x - 44, y + (kicking ? 6 : 0), color, 5);   // ноги назад
    s += line(x - 44, y + (kicking ? 6 : 0), x - 84, y + (kicking ? 10 : 2), color, 4);
    return s;
  }

  /* ================= 4. Работа ног кролем ================= */

  PE.reg('legs-crawl', {
    w: 640, h: 300, frames: 48, period: 2600,
    phases: [
      { to: 0.25, name: 'Удар вниз: начало', note: 'Движение начинается от таза. Бедро идёт вниз, колено при этом слегка сгибается — голень отстаёт от бедра.' },
      { to: 0.50, name: 'Удар вниз: хлыст', note: 'Бедро уже тормозит, а голень и стопа продолжают движение и распрямляют колено. Именно здесь стопа отталкивает воду назад-вниз.' },
      { to: 0.75, name: 'Возврат вверх: начало', note: 'Прямая нога поднимается от таза. Сгибать колено на подъёме нельзя — это и есть «велосипед».' },
      { to: 1.00, name: 'Возврат вверх: пятка у поверхности', note: 'Пятка выходит к самой поверхности и слегка вспенивает воду. Стопа всё время оттянута, носки внутрь.' },
    ],
    bg() {
      let s = water(640, 300, 96);
      s += moveArrow(520, 44, 'движение');
      s += text(8, 286, 'амплитуда удара — примерно 30–40 см; работают таз и бедро, стопа расслаблена и оттянута', C.gray);
      return s;
    },
    draw(u) {
      const hip = { x: 430, y: 150 }, sh = { x: 494, y: 142 }, head = { x: 524, y: 136 };
      let s = drift(u, 96, 9, 110, 260, 0.3);
      s += PE.swim.legCrawl(hip, u + 0.5, C.far, 7);
      s += line(sh.x, sh.y, 566, 126, C.ink, 5) + line(566, 126, 598, 124, C.ink, 4);
      s += body(sh, hip, head, 14.5);
      s += PE.swim.legCrawl(hip, u, C.ink, 7);
      /* подсказка о направлении движения бедра */
      const up = u < 0.5;
      s += line(410, 176, 410, up ? 200 : 152, up ? C.red : C.green, 2,
        up ? ' marker-end="url(#arrR)"' : ' marker-end="url(#arrG)"');
      s += text(300, up ? 206 : 148, up ? 'бедро идёт вниз' : 'бедро идёт вверх', up ? C.red : C.green);
      return s;
    },
    caption: 'Удар ногами в кроле, вид сбоку. Тёмная нога — ближняя, светлая — дальняя: они работают попеременно. Проследите по кадрам, что колено сгибается только на ударе вниз.',
  });

  PE.reg('legs-crawl-bad', {
    w: 640, h: 300, frames: 48, period: 2600,
    phases: [
      { to: 0.5, name: 'Правильно: работа от таза', note: 'Бедро ведёт, колено сгибается лишь слегка и только на ударе вниз, стопа оттянута. Тело остаётся вытянутым.' },
      { to: 1.0, name: 'Ошибка: «велосипед»', note: 'Таз почти неподвижен, нога сгибается в колене на 60–90°, стопа на себя. Такое движение толкает воду вперёд и вниз, пловца тормозит и опускает ноги.' },
    ],
    bg() {
      return water(640, 300, 70, { label: false })
        + text(8, 62, 'вверху — движение от таза, внизу — типичная ошибка', C.gray)
        + line(0, 186, 640, 186, C.gray, 0.9, ' stroke-dasharray="5 6"');
    },
    draw(u) {
      const p = (u * 2) % 1;
      const good = u < 0.5;
      let s = '';
      const hipA = { x: 430, y: 132 }, shA = { x: 494, y: 126 }, headA = { x: 524, y: 120 };
      s += PE.swim.legCrawl(hipA, p + 0.5, C.far, 6.5);
      s += body(shA, hipA, headA, 13, { fill: good ? C.skin : '#eef2f4' });
      s += PE.swim.legCrawl(hipA, p, good ? C.green : C.far, 6.5);
      if (good) s += text(150, 112, 'работа от таза: колено сгибается только вниз', C.green);

      const hipB = { x: 430, y: 236 }, shB = { x: 494, y: 230 }, headB = { x: 524, y: 224 };
      s += PE.swim.legBike(hipB, p + 0.5, C.far, 6.5);
      s += body(shB, hipB, headB, 13);
      s += PE.swim.legBike(hipB, p, good ? C.far : C.red, 6.5);
      if (!good) s += text(150, 284, '«велосипед»: сгибание в колене 60–90°, стопа на себя', C.red);
      return s;
    },
    caption: 'Сравнение: сверху удар от таза, снизу — «велосипед». Переключите фазу, чтобы подсветить нужный вариант, и сравните угол в колене на возврате.',
  });

  /* ================= 5. Ноги брассом ================= */

  /* Нога брассом, вид сбоку. p: 0…0,35 — подтягивание пяток к тазу,
     0,35…0,5 — разворот стоп наружу, 0,5…0,8 — толчок, 0,8…1 — сведение
     и пауза в вытянутом положении. */
  function legBreastSide(hip, p, color, w) {
    let fl, at;
    if (p < 0.35) { const t = p / 0.35; fl = 10 + 115 * t; at = -4 + 22 * t; }
    else if (p < 0.5) { const t = (p - 0.35) / 0.15; fl = 125; at = 26; }
    else if (p < 0.8) { const t = (p - 0.5) / 0.3; fl = 125 - 115 * t; at = 26 - 26 * t; }
    else { const t = (p - 0.8) / 0.2; fl = 10 - 4 * t; at = 0 - 4 * t; }
    const At = (180 - at) * Math.PI / 180;
    const kx = hip.x + L.thigh * Math.cos(At), ky = hip.y + L.thigh * Math.sin(At);
    const As = At + fl * Math.PI / 180;
    const ax = kx + L.shin * Math.cos(As), ay = ky + L.shin * Math.sin(As);
    /* стопа: на подтягивании и толчке носок «на себя» (наружу), в конце оттянут */
    const flex = p > 0.3 && p < 0.78 ? -70 : -10;
    const Af = As + flex * Math.PI / 180;
    const tx = ax + L.foot * Math.cos(Af), ty = ay + L.foot * Math.sin(Af);
    return line(hip.x, hip.y, kx, ky, color, w)
      + line(kx, ky, ax, ay, color, w)
      + line(ax, ay, tx, ty, color, w * 0.85)
      + circle(kx, ky, 2.8, color) + circle(ax, ay, 2.2, color);
  }

  PE.swim.legBreastSide = legBreastSide;

  PE.reg('legs-breast', {
    w: 640, h: 300, frames: 48, period: 4200,
    phases: [
      { to: 0.35, name: 'Подтягивание', note: 'Пятки идут к тазу, колени разводятся не шире таза. Это самая «тормозящая» часть цикла, поэтому её делают медленно и расслабленно.' },
      { to: 0.50, name: 'Разворот стоп', note: 'Носки разворачиваются наружу и берутся «на себя». Без этого разворота отталкиваться нечем: толкает не подошва, а внутренняя поверхность стопы и голени.' },
      { to: 0.80, name: 'Толчок', note: 'Резкое разгибание в коленях и сведение ног по дуге. Стопы идут наружу-назад-внутрь, это главная движущая сила брасса.' },
      { to: 1.00, name: 'Сведение и пауза', note: 'Ноги смыкаются, носки оттягиваются, тело вытягивается. Пауза в вытянутом положении — часть техники, а не потеря времени.' },
    ],
    bg() {
      return water(640, 300, 96) + moveArrow(520, 44, 'движение')
        + text(8, 286, 'колени не разводятся шире таза; толкает внутренняя поверхность стопы и голени', C.gray);
    },
    draw(u) {
      const hip = { x: 400, y: 150 }, sh = { x: 464, y: 144 }, head = { x: 494, y: 138 };
      let s = drift(u, 96, 8, 110, 260, 0.15);
      s += legBreastSide(hip, u, C.far, 7);
      s += body(sh, hip, head, 14.5);
      s += line(sh.x, sh.y, 530, 132, C.ink, 5) + line(530, 132, 560, 130, C.ink, 4);
      s += legBreastSide(hip, u, C.ink, 7);
      if (u >= 0.5 && u < 0.8) {
        s += line(300, 214, 250, 200, C.green, 2.2, ' marker-end="url(#arrG)"');
        s += text(238, 232, 'вода отбрасывается назад', C.green);
      } else if (u < 0.35) {
        s += text(150, 232, 'подтягивание — медленно, ноги «прячутся» за телом', C.water);
      }
      return s;
    },
    caption: 'Ноги брассом, вид сбоку. Обратите внимание на положение стопы: на подтягивании и толчке носок взят «на себя» и развёрнут наружу, и только в конце оттягивается.',
  });

  /* Ноги брассом, вид сверху: видно разведение стоп и дугу сведения. */
  PE.reg('legs-breast-top', {
    w: 640, h: 260, frames: 48, period: 4200,
    phases: [
      { to: 0.35, name: 'Подтягивание', note: 'Сверху видно, что колени разводятся немного, а пятки идут к тазу почти по прямой — тело остаётся узким.' },
      { to: 0.50, name: 'Разворот стоп наружу', note: 'Стопы разворачиваются носками наружу и оказываются шире коленей. Это положение «захвата» воды.' },
      { to: 0.80, name: 'Толчок по дуге', note: 'Стопы описывают дугу наружу-назад-внутрь. Ноги не просто разгибаются, а сводятся — отсюда и название «толчок с сведением».' },
      { to: 1.00, name: 'Смыкание', note: 'Ноги смыкаются вместе, тело вытягивается в линию. Пауза.' },
    ],
    bg() {
      return `<rect x="0" y="0" width="640" height="260" fill="rgba(21,94,117,.04)"/>`
        + line(0, 130, 640, 130, C.gray, 0.9, ' stroke-dasharray="6 6"')
        + text(8, 124, 'ось тела', C.gray)
        + moveArrow(520, 30, 'движение');
    },
    draw(u) {
      const hipY = 130, hipX = 400, halfHip = 15;
      let s = '';
      /* корпус сверху */
      s += path(`M 470 ${hipY - 26} Q 420 ${hipY - 30} ${hipX} ${hipY - halfHip}
                 L ${hipX} ${hipY + halfHip} Q 420 ${hipY + 30} 470 ${hipY + 26} Z`, C.ink, 1.4, C.skin);
      s += circle(504, hipY, 15, C.skin, C.ink, 1.4);
      s += line(470, hipY - 16, 540, hipY - 30, C.ink, 5);
      s += line(470, hipY + 16, 540, hipY + 30, C.ink, 5);

      /* положение колена и стопы по фазам (в единицах вдоль и поперёк) */
      let kneeBack, kneeSide, footBack, footSide, toeOut;
      if (u < 0.35) {
        const t = u / 0.35;
        kneeBack = 54 - 12 * t; kneeSide = 10 + 14 * t;
        footBack = 104 - 68 * t; footSide = 8 + 12 * t; toeOut = 0.15 + 0.25 * t;
      } else if (u < 0.5) {
        const t = (u - 0.35) / 0.15;
        kneeBack = 42; kneeSide = 24;
        footBack = 36; footSide = 20 + 20 * t; toeOut = 0.4 + 0.6 * t;
      } else if (u < 0.8) {
        const t = (u - 0.5) / 0.3;
        kneeBack = 42 + 24 * t; kneeSide = 24 - 20 * t;
        footBack = 36 + 74 * t; footSide = 40 + 22 * t - 56 * t * t; toeOut = 1 - 0.8 * t;
      } else {
        const t = (u - 0.8) / 0.2;
        kneeBack = 66 - 12 * t; kneeSide = 4 - 2 * t;
        footBack = 110 - 6 * t; footSide = 6 - 4 * t; toeOut = 0.2 - 0.1 * t;
      }
      for (const sgn of [-1, 1]) {
        const kx = hipX - kneeBack, ky = hipY + sgn * (halfHip - 3 + kneeSide);
        const fx = hipX - footBack, fy = hipY + sgn * (6 + footSide);
        s += line(hipX, hipY + sgn * (halfHip - 4), kx, ky, C.ink, 6.5);
        s += line(kx, ky, fx, fy, C.ink, 6.5);
        s += circle(kx, ky, 2.8, C.ink);
        /* стопа: чем больше toeOut, тем сильнее развёрнута поперёк */
        const fl = 18;
        s += line(fx, fy, fx - fl * (1 - toeOut), fy + sgn * fl * toeOut * 1.2, C.ink, 5);
      }
      if (u >= 0.5 && u < 0.8) {
        s += path('M 300 76 Q 336 58 372 82', C.green, 2, 'none', ' marker-end="url(#arrG)"');
        s += text(246, 70, 'дуга сведения', C.green);
      }
      if (u >= 0.35 && u < 0.5) s += text(230, 220, 'стопы шире коленей, носки наружу', C.water);
      return s;
    },
    caption: 'Те же ноги сверху. Главное, что видно именно в этой проекции: стопы разворачиваются наружу и идут по дуге, а не просто разгибаются назад.',
  });
})(window);
