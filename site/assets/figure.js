/* figure.js — параметрическая модель фигуры человека для всего сайта.
 *
 * Зачем. Раньше каждая схема пловца рисовалась отдельно, координатами точек
 * «на глаз». Пропорции у соседних картинок расходились, колени гнулись не в ту
 * сторону, тело оказывалось то над водой, то в метре под ней. Здесь этого не
 * может произойти по построению: длины звеньев ЗАДАНЫ долями роста и не
 * настраиваются, поза задаётся только углами в суставах, а углы проверяются на
 * анатомическую допустимость — при выходе за диапазон модель бросает ошибку и
 * схема просто не рисуется.
 *
 * ================== 1. Пропорции (доли роста H) ==================
 *
 * Приняты по классической антропометрии (доли роста, H = 1):
 *
 *   голова, диаметр             H/7,5 = 0,1333
 *   шея (центр плеч → центр головы)     0,113
 *   туловище (плечи → таз)              0,290
 *   плечо (плечевой сустав → локоть)    0,186
 *   предплечье с кистью                 0,225  (предплечье 0,146 + кисть 0,079)
 *   бедро (таз → колено)                0,245
 *   голень (колено → щиколотка)         0,246
 *   стопа (щиколотка → носок)           0,152
 *
 * Сумма по вертикали от пола до макушки даёт ровно единицу:
 *   0,039 (щиколотка над полом) + 0,246 + 0,245 + 0,290 + 0,113 + 0,0667 = 1,000
 *
 * ================== 2. Как задаётся поза ==================
 *
 * Собственная система координат тела (правая тройка):
 *   Lx — вдоль тела к голове;
 *   Ly — «вентральная», в сторону живота и лица;
 *   Lz — влево от самого человека.
 *
 * Плечевой сустав описан двумя углами (как принято в биомеханике: подъём и
 * плоскость подъёма) — одним углом шар нельзя описать без разрывов:
 *   shoulder      — подъём руки, 0…180. 0 — рука вдоль тела в сторону ног,
 *                   90 — поднята «вперёд» (к животу), 180 — за голову.
 *   shoulderPlane — плоскость подъёма, −30…200. 0 — подъём к животу,
 *                   90 — подъём в сторону (отведение), 180 — назад, к спине.
 *   Связанное ограничение: назад (plane > 135°) рука заводится не выше 65°.
 *
 * Локоть:
 *   elbow    — сгибание, 0…150. Только внутрь: отрицательных значений нет,
 *              значит переразгибание невозможно в принципе.
 *   elbowDir — куда направлен сгиб, °. 0 — нейтрально (сгиб в плоскости
 *              подъёма руки), 180 — плечо ротировано внутрь: именно так
 *              получается «высокий локоть» в кроле.
 *
 * Тазобедренный сустав и ниже:
 *   hip     — сгибание, −20…120. Плюс — нога идёт вперёд (к животу),
 *             минус — назад. Диапазон назад мал: он и в жизни мал.
 *   hipAbd  — отведение в сторону, 0…50 («звёздочка», брасс).
 *   knee    — сгибание, 0…140. Только назад: пятка идёт к ягодице.
 *             Отрицательные значения не принимаются — колено вперёд не гнётся.
 *   ankle   — −20…+50. Плюс — носок оттянут (плантарфлексия), минус — стопа
 *             взята «на себя». Полностью в линию с голенью стопа не встаёт
 *             никогда: предел ≈ 50°, и на схемах это видно.
 *
 * Шея (голова — тоже сустав, и в плавании он решает многое):
 *   headTilt — наклон головы к оси тела, −45…60. Плюс — подбородок к груди,
 *              минус — голова запрокинута («поднял голову» — та самая ошибка).
 *   headTurn — поворот головы вокруг оси тела, −90…90 (вдох в кроле).
 *
 * Общее положение тела:
 *   tilt — наклон продольной оси, °: 0 — горизонтально головой вперёд,
 *          +90 — стоя, −30 — головой вниз (вход в воду).
 *   roll — крен вокруг продольной оси, °: 0 — на груди, 180 — на спине,
 *          промежуточные — крен в кроле.
 *
 * ================== 3. Проекции ==================
 *
 * Скелет строится в трёхмерном виде и проецируется. Одна и та же поза даёт
 * согласованные вид сбоку, сверху и спереди — раньше это были три разных
 * рисунка, и они друг другу противоречили.
 *
 * ================== 4. Вода ==================
 *
 * waterline — уровень воды в координатах доски (ось y вниз). Модель считает
 * глубину каждой точки и умеет сама поставить тело так, чтобы спина и затылок
 * лежали на линии воды (opts.place = 'surface').
 *
 * ================== 5. Использование ==================
 *
 *   PE.figure(pose, opts) -> строка SVG-разметки
 *   PE.figure.solve(pose, opts) -> {pts, seg, depth, …} для проверок
 *
 * Модель работает и в браузере, и в node (tools/check_anatomy.js).
 */
'use strict';
(function (global) {
  const PE = global.PE || (global.PE = {});

  /* ---------- 1. пропорции ---------- */

  const P = {
    headR: 0.1333 / 2,     // радиус головы
    neck: 0.113,           // центр плеч → центр головы
    torso: 0.290,          // плечи → таз
    upperArm: 0.186,       // плечо → локоть
    foreArm: 0.146,        // локоть → запястье
    hand: 0.079,           // запястье → кончики пальцев
    thigh: 0.245,          // таз → колено
    shin: 0.246,           // колено → щиколотка
    foot: 0.152,           // щиколотка → носок
    shoulderHalf: 0.115,   // полуширина плеч
    hipHalf: 0.060,        // полуширина таза
    torsoThickSh: 0.068,   // полутолщина груди (спереди назад)
    torsoThickHip: 0.056,  // полутолщина таза
  };
  /* предплечье с кистью как единое звено — то, что задано в пропорциях */
  P.foreHand = P.foreArm + P.hand;

  /* ---------- 2. анатомические диапазоны ---------- */

  const RANGE = {
    shoulder: [0, 180],
    shoulderPlane: [-30, 200],
    elbow: [0, 150],
    elbowDir: [-200, 200],
    hip: [-20, 120],
    hipAbd: [0, 50],
    knee: [0, 140],
    ankle: [-20, 50],
  };
  const RANGE_BODY = {
    tilt: [-180, 180], roll: [-360, 360],
    headTilt: [-45, 60], headTurn: [-90, 90],
  };

  const SIDES = ['L', 'R'];
  const RU = {
    shoulder: 'подъём руки', shoulderPlane: 'плоскость подъёма руки',
    elbow: 'локоть', elbowDir: 'направление сгиба локтя',
    hip: 'тазобедренный сустав', hipAbd: 'отведение бедра',
    knee: 'колено', ankle: 'голеностоп',
  };
  const SIDE_RU = { L: 'слева', R: 'справа' };
  const RU_BODY = {
    tilt: 'наклон тела', roll: 'крен',
    headTilt: 'наклон головы', headTurn: 'поворот головы',
  };

  const DEF_JOINT = {
    shoulder: 0, shoulderPlane: 0, elbow: 0, elbowDir: 0,
    hip: 0, hipAbd: 0, knee: 0, ankle: 0,
  };

  class PoseError extends Error {}

  /* Приведение позы к полному виду. Допускаются сокращения:
     pose.arms / pose.legs / pose.both — общие углы для обеих сторон,
     pose.L / pose.R — уточнение для стороны. */
  function normalize(pose) {
    const p = pose || {};
    const out = {
      tilt: num(p.tilt, 0), roll: num(p.roll, 0),
      headTilt: num(p.headTilt, 0), headTurn: num(p.headTurn, 0),
      name: p.name || '', at: p.at,
    };
    for (const s of SIDES) {
      const j = Object.assign({}, DEF_JOINT, p.both || {}, p.arms || {}, p.legs || {}, p[s] || {});
      out[s] = j;
    }
    return out;
  }

  const num = (v, d) => (typeof v === 'number' && isFinite(v) ? v : d);

  /* Проверка позы. Ошибка, а не «поправим и нарисуем»: неанатомичная схема
     не должна попасть на страницу даже в виде «почти правильной». */
  function validate(pose, where) {
    const tag = where ? ' [' + where + ']' : '';
    for (const k of Object.keys(RANGE_BODY)) {
      const v = pose[k], r = RANGE_BODY[k];
      if (!isFinite(v)) throw new PoseError(`PE.figure${tag}: ${RU_BODY[k]} — не число`);
      if (v < r[0] || v > r[1]) {
        throw new PoseError(
          `PE.figure${tag}: ${RU_BODY[k]} = ${round(v, 1)}°, допустимо ${r[0]}…${r[1]}°`);
      }
    }
    for (const s of SIDES) {
      const j = pose[s], sd = SIDE_RU[s];
      for (const k of Object.keys(RANGE)) {
        const v = j[k], r = RANGE[k];
        if (!isFinite(v)) throw new PoseError(`PE.figure${tag}: ${RU[k]} ${sd} — не число`);
        if (v < r[0] - 1e-6 || v > r[1] + 1e-6) {
          throw new PoseError(
            `PE.figure${tag}: ${RU[k]} ${sd} = ${round(v, 1)}°, `
            + `анатомический предел ${r[0]}…${r[1]}°`);
        }
      }
      /* связанные ограничения: пара углов, каждый из которых по отдельности
         допустим, а вместе человеку недоступна */
      if (j.shoulderPlane > 150 && j.shoulder > 70 + 1e-6) {
        throw new PoseError(
          `PE.figure${tag}: рука ${sd} заведена назад `
          + `(плоскость ${round(j.shoulderPlane, 0)}°) и поднята на `
          + `${round(j.shoulder, 0)}° — назад плечо поднимается не выше 70°`);
      }
      if (j.hip < -5 && j.knee > 100 + 1e-6) {
        throw new PoseError(
          `PE.figure${tag}: колено ${sd} согнуто на ${round(j.knee, 0)}° `
          + `при бедре, отведённом назад на ${round(-j.hip, 0)}° — `
          + 'вместе эти два угла человеку недоступны');
      }
    }
    return pose;
  }

  /* ---------- 3. векторная мелочь ---------- */

  const V = {
    add: (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]],
    sub: (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]],
    mul: (a, k) => [a[0] * k, a[1] * k, a[2] * k],
    dot: (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2],
    cross: (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]],
    len: (a) => Math.hypot(a[0], a[1], a[2]),
    norm(a) { const d = V.len(a) || 1; return [a[0] / d, a[1] / d, a[2] / d]; },
  };
  const rad = (d) => d * Math.PI / 180;
  const round = (v, n) => Math.round(v * Math.pow(10, n)) / Math.pow(10, n);

  /* ---------- 4. построение скелета ---------- */

  /* Направление звена «плечо» (или «бедро») по подъёму θ и плоскости ψ:
     θ = 0 — вдоль тела к ногам, θ = 180 — за голову;
     ψ = 0 — подъём к животу, 90 — в сторону, 180 — к спине. */
  function limbDir(theta, psi, side) {
    const t = rad(theta), p = rad(psi);
    return [-Math.cos(t), Math.sin(t) * Math.cos(p), side * Math.sin(t) * Math.sin(p)];
  }

  /* Перпендикуляр к звену в плоскости подъёма — нейтральное направление
     сгиба следующего сустава. Определён всюду, разрывов нет. */
  function bendRef(theta, psi, side) {
    const t = rad(theta), p = rad(psi);
    return [Math.sin(t), Math.cos(t) * Math.cos(p), side * Math.cos(t) * Math.sin(p)];
  }

  /* Сгиб: поворот звена d на угол a в сторону p (p ⟂ d). */
  function bend(d, p, a) {
    const c = Math.cos(rad(a)), s = Math.sin(rad(a));
    return V.norm([d[0] * c + p[0] * s, d[1] * c + p[1] * s, d[2] * c + p[2] * s]);
  }

  /* Поворот направления сгиба вокруг оси звена (ротация плеча). */
  function twist(d, p, deg) {
    if (!deg) return p;
    const q = V.cross(d, p);
    const c = Math.cos(rad(deg)), s = Math.sin(rad(deg));
    return V.norm([p[0] * c + q[0] * s, p[1] * c + q[1] * s, p[2] * c + q[2] * s]);
  }

  /* Скелет в системе координат тела. Таз (центр) — начало координат. */
  function skeleton(pose) {
    const pts = {};
    const Lx = [1, 0, 0], Ly = [0, 1, 0], Lz = [0, 0, 1];
    pts.hip = [0, 0, 0];
    pts.neck = [P.torso, 0, 0];
    /* шея: наклон головы к оси тела (+ подбородок к груди) и поворот вокруг
       оси (вдох в кроле). Направление взгляда возвращаем точкой face —
       по ней сцена рисует лицо, и оно всегда согласовано с позой. */
    const dHead = bend([1, 0, 0], [0, 1, 0], pose.headTilt);
    pts.head = V.add(pts.neck, V.mul(dHead, P.neck));
    let fRef = V.sub([0, 1, 0], V.mul(dHead, V.dot([0, 1, 0], dHead)));
    if (V.len(fRef) < 1e-6) fRef = [0, 0, 1];
    const fDir = twist(dHead, V.norm(fRef), pose.headTurn);
    pts.face = V.add(pts.head, V.mul(fDir, P.headR * 0.98));
    pts.crown = V.add(pts.head, V.mul(dHead, P.headR));
    const sgn = { L: 1, R: -1 };
    for (const s of SIDES) {
      const j = pose[s], k = sgn[s];
      const sh = [P.torso, 0, k * P.shoulderHalf];
      pts['shoulder' + s] = sh;
      /* рука */
      const dU = limbDir(j.shoulder, j.shoulderPlane, k);
      const el = V.add(sh, V.mul(dU, P.upperArm));
      pts['elbow' + s] = el;
      const pRef = twist(dU, bendRef(j.shoulder, j.shoulderPlane, k), j.elbowDir);
      const dF = bend(dU, pRef, j.elbow);
      const wr = V.add(el, V.mul(dF, P.foreArm));
      pts['wrist' + s] = wr;
      pts['finger' + s] = V.add(wr, V.mul(dF, P.hand));
      /* нога: бедро описано сгибанием (знаковым) и отведением */
      const hp = [0, 0, k * P.hipHalf];
      pts['hipJoint' + s] = hp;
      const ca = Math.cos(rad(j.hipAbd)), sa = Math.sin(rad(j.hipAbd));
      const ch = Math.cos(rad(j.hip)), shn = Math.sin(rad(j.hip));
      const dT = V.norm([-ca * ch, ca * shn, k * sa]);
      const kn = V.add(hp, V.mul(dT, P.thigh));
      pts['knee' + s] = kn;
      /* колено гнётся только назад: сгиб идёт в дорсальную сторону */
      let pK = V.sub(V.mul(Ly, -1), V.mul(dT, V.dot(V.mul(Ly, -1), dT)));
      if (V.len(pK) < 1e-6) pK = V.norm(V.cross(dT, Lz));
      pK = V.norm(pK);
      const dS = bend(dT, pK, j.knee);
      const an = V.add(kn, V.mul(dS, P.shin));
      pts['ankle' + s] = an;
      /* стопа: нейтраль — поперёк голени в вентральную сторону; плюс —
         носок оттягивается к продолжению голени */
      let pF = V.sub(Ly, V.mul(dS, V.dot(Ly, dS)));
      if (V.len(pF) < 1e-6) pF = V.norm(V.cross(dS, Lz));
      pF = V.norm(pF);
      const dFoot = bend(pF, V.mul(dS, 1), j.ankle);
      pts['toe' + s] = V.add(an, V.mul(dFoot, P.foot));
    }
    return pts;
  }

  /* Крен вокруг продольной оси, затем наклон. */
  function place3d(pts, pose) {
    const cr = Math.cos(rad(pose.roll)), sr = Math.sin(rad(pose.roll));
    const ct = Math.cos(rad(pose.tilt)), st = Math.sin(rad(pose.tilt));
    const out = {};
    for (const k of Object.keys(pts)) {
      const v = pts[k];
      /* крен: вокруг Lx */
      const y1 = v[1] * cr - v[2] * sr;
      const z1 = v[1] * sr + v[2] * cr;
      /* наклон: вокруг Lz, + — голова вверх */
      const x2 = v[0] * ct + y1 * st;
      const y2 = -v[0] * st + y1 * ct;
      out[k] = [x2, y2, z1];
    }
    return out;
  }

  /* Проекция в координаты доски. Мир: x — вперёд по движению, y — вниз
     (как в SVG), z — влево от пловца. */
  const VIEWS = {
    /* смотрим с борта; пловец плывёт вправо при facing = +1 */
    side: (v, f) => [f * v[0], v[1]],
    /* смотрим сверху; левая сторона пловца — вверху доски */
    top: (v, f) => [f * v[0], -v[2]],
    /* смотрим навстречу пловцу: его левая рука — справа на доске */
    front: (v, f) => [f * v[2], v[1]],
  };

  /* ---------- 5. решение позы ---------- */

  const REC = { on: false, log: [] };

  function solve(pose, opts) {
    const o = opts || {};
    const p = validate(normalize(pose), o.where || (pose && pose.name));
    const H = o.H || 300;
    const view = o.view || 'side';
    const proj = VIEWS[view];
    if (!proj) throw new PoseError('PE.figure: неизвестная проекция ' + view);
    const facing = o.facing === -1 ? -1 : 1;

    const local = skeleton(p);
    const world = place3d(local, p);

    /* в единицы доски */
    const screen = {};
    for (const k of Object.keys(world)) {
      const q = proj(world[k], facing);
      screen[k] = { x: q[0] * H, y: q[1] * H };
    }

    /* привязка: в точку (o.x, o.y) ставится таз или указанная точка скелета
       (o.anchor) — так удобно строить крупные планы «колено — стопа». */
    const anchor = screen[o.anchor] ? screen[o.anchor] : screen.hip;
    let dx = num(o.x, 320) - anchor.x;
    let dy = num(o.y, 150) - anchor.y;
    const shift = () => {
      for (const k of Object.keys(screen)) { screen[k].x += dx; screen[k].y += dy; }
    };
    shift();

    /* «спина и затылок на линии воды»: поднимаем тело так, чтобы верх
       головы и спина легли ровно на поверхность */
    const backTop = () => Math.min(
      screen.head.y - P.headR * H,
      screen.neck.y - P.torsoThickSh * H,
      screen.hip.y - P.torsoThickHip * H);
    if (o.place === 'surface' && isFinite(o.waterline)) {
      dx = 0; dy = o.waterline - backTop(); shift();
    }

    const wl = isFinite(o.waterline) ? o.waterline : null;
    const depth = {};
    if (wl !== null) for (const k of Object.keys(screen)) depth[k] = (screen[k].y - wl) / H;

    const seg = segments(screen, view);
    /* что схема сама о себе утверждает — на это опирается check_anatomy.js:
       surface — «тело лежит у поверхности», проверяем глубину спины;
       sag     — «таз провален намеренно, это и есть показанная ошибка». */
    const declared = {
      surface: o.place === 'surface' || o.surface === true,
      sag: !!o.sag,
    };
    const res = {
      pose: p, opts: { H, view, facing, waterline: wl }, pts: screen,
      local, world, seg, depth, backTop: backTop(), declared, P,
    };
    if (REC.on) REC.log.push({ where: o.where || p.name || '', res });
    return res;
  }

  /* Длины звеньев в долях H — для проверки анатомии. В боковой и других
     проекциях звенья укорачиваются, поэтому эталон считаем по трёхмерным
     точкам, а не по экранным. */
  function segments(screen, view) {
    const d3 = (a, b) => V.len(V.sub(a, b));
    return { d3, view };
  }

  /* Эталонные длины: то, с чем сверяется проверка анатомии. */
  const REF = {
    'плечо (плечо→локоть)': P.upperArm,
    'предплечье с кистью': P.foreHand,
    'туловище (плечи→таз)': P.torso,
    'бедро': P.thigh,
    'голень': P.shin,
    'стопа': P.foot,
    'шея (плечи→голова)': P.neck,
  };

  /* Фактические длины звеньев решённой позы (доли H). */
  function measure(res) {
    const w = res.world;
    const d = (a, b) => V.len(V.sub(w[a], w[b]));
    const out = {};
    for (const s of SIDES) {
      out[`плечо (плечо→локоть) ${s}`] = d('shoulder' + s, 'elbow' + s);
      out[`предплечье с кистью ${s}`] = d('elbow' + s, 'finger' + s);
      out[`бедро ${s}`] = d('hipJoint' + s, 'knee' + s);
      out[`голень ${s}`] = d('knee' + s, 'ankle' + s);
      out[`стопа ${s}`] = d('ankle' + s, 'toe' + s);
    }
    out['туловище (плечи→таз)'] = d('neck', 'hip');
    out['шея (плечи→голова)'] = d('neck', 'head');
    return out;
  }

  const refOf = (name) => REF[name.replace(/ [LR]$/, '')];

  /* ---------- 6. отрисовка ---------- */

  const C = {
    ink: '#16161a', skin: '#e8eef2', far: '#a9b3ba', water: '#155e75',
    red: '#b3382e', green: '#1a7f37', gray: '#6b6b74',
  };

  const n1 = (v) => Math.round(v * 10) / 10;
  const ln = (a, b, st, w, extra) =>
    `<line x1="${n1(a.x)}" y1="${n1(a.y)}" x2="${n1(b.x)}" y2="${n1(b.y)}" stroke="${st}"`
    + ` stroke-width="${n1(w)}" stroke-linecap="round"${extra || ''}/>`;
  const ci = (c, r, fill, st, w) =>
    `<circle cx="${n1(c.x)}" cy="${n1(c.y)}" r="${n1(r)}" fill="${fill || 'none'}"`
    + (st ? ` stroke="${st}" stroke-width="${n1(w || 1.4)}"` : '') + '/>';

  /* Полуразмер сечения тела поперёк оси на экране. Сечение — эллипс с
     полуосями «вбок» и «вперёд-назад»; проецируем его честно, иначе вид
     сверху и вид сбоку дают разную толщину одного и того же туловища. */
  function halfExtent(res, latHalf, venHalf, nx, ny) {
    const p = VIEWS[res.opts.view], f = res.opts.facing, H = res.opts.H;
    const cr = Math.cos(rad(res.pose.roll)), sr = Math.sin(rad(res.pose.roll));
    const ct = Math.cos(rad(res.pose.tilt)), st = Math.sin(rad(res.pose.tilt));
    const tr = (v) => {
      const y1 = v[1] * cr - v[2] * sr, z1 = v[1] * sr + v[2] * cr;
      return p([v[0] * ct + y1 * st, -v[0] * st + y1 * ct, z1], f);
    };
    const a = tr([0, 0, latHalf]), b = tr([0, venHalf, 0]);
    const pa = (a[0] * nx + a[1] * ny) * H, pb = (b[0] * nx + b[1] * ny) * H;
    return Math.hypot(pa, pb);
  }

  /* Силуэт туловища: от плечевого пояса к тазу, с честной толщиной в этой
     проекции. Профиль ширины взят по человеку — самое широкое место у плеч,
     сужение на талии, небольшое расширение у таза — и продолжен закруглёнными
     «шапками» за плечи и за таз. Раньше здесь был прямоугольник со скруглённым
     боком, и тело читалось как доска. */
  const PROFILE = [
    [-0.05, 0.52], [0.02, 0.90], [0.12, 1.00], [0.30, 0.96],
    [0.50, 0.86], [0.66, 0.80], [0.82, 0.87], [0.98, 0.96],
    [1.12, 0.86], [1.22, 0.48],
  ];

  function torsoPath(res, fill, stroke, lw) {
    const a = res.pts.neck, b = res.pts.hip;
    let dx = b.x - a.x, dy = b.y - a.y;
    const d = Math.hypot(dx, dy);
    if (d < 1e-3) { dx = 1; dy = 0; }
    const ux = dx / (d || 1), uy = dy / (d || 1);      // от плеч к тазу
    const nx = -uy, ny = ux;
    const wSh = Math.max(3.2, halfExtent(res, P.shoulderHalf, P.torsoThickSh, nx, ny));
    const wHip = Math.max(2.6, halfExtent(res, P.hipHalf, P.torsoThickHip, nx, ny));
    const pt = (t, k) => {
      const cx = a.x + ux * d * t, cy = a.y + uy * d * t;
      const w = (wSh + (wHip - wSh) * Math.min(1, Math.max(0, t))) * k;
      return [cx + nx * w, cy + ny * w, cx - nx * w, cy - ny * w];
    };
    const right = [], left = [];
    for (const [t, k] of PROFILE) {
      const p = pt(t, k);
      right.push([p[0], p[1]]);
      left.unshift([p[2], p[3]]);
    }
    const seg = (arr) => arr.map((p, i) => (i ? ' L ' : '') + n1(p[0]) + ' ' + n1(p[1])).join('');
    const dpath = 'M ' + seg(right) + ' L ' + seg(left) + ' Z';
    return `<path d="${dpath}" fill="${fill}" stroke="${stroke}" stroke-width="${n1(lw)}"`
      + ' stroke-linejoin="round"/>';
  }

  /* Одна конечность. Каждое звено рисуется дважды: сначала светлой «обводкой»
     фона, потом цветом. Обводка нужна не для красоты: в проекции ближняя рука
     проходит поверх головы и корпуса, и без неё картинка читается как линия,
     ПЕРЕЧЁРКИВАЮЩАЯ тело, а не как рука перед телом. */
  function limbSvg(res, names, color, w, o) {
    const halo = o && o.halo === false ? null : ((o && o.halo) || '#fff');
    let body = '', edge = '';
    for (let i = 0; i < names.length - 1; i++) {
      const k = i === names.length - 2 ? 0.78 : 1;
      const A = res.pts[names[i]], B = res.pts[names[i + 1]];
      if (halo) edge += ln(A, B, halo, w * k + 2.6);
      body += ln(A, B, color, w * k);
    }
    if (!o || o.joints !== false) {
      for (let i = 1; i < names.length - 1; i++) {
        body += ci(res.pts[names[i]], w * 0.4 + 0.8, color);
      }
    }
    return edge + body;
  }

  /* Порядок отрисовки: дальние конечности — под телом, ближние — поверх. */
  function render(res, o) {
    const near = o.near === 'L' ? 'L' : o.near === 'R' ? 'R' : (o.near === false ? null : 'R');
    /* far = false — рисуем только ближнюю сторону (крупные планы одной ноги) */
    const far = o.far === false ? null : (near === 'R' ? 'L' : near === 'L' ? 'R' : null);
    const ink = o.color || C.ink;
    const farC = o.farColor || (near === null ? ink : C.far);
    const lw = o.lw || Math.max(3.5, res.opts.H * 0.023);
    const fill = o.fill || C.skin;
    const arm = (s) => ['shoulder' + s, 'elbow' + s, 'wrist' + s, 'finger' + s]
      .slice(o.armFrom === 'elbow' ? 1 : 0);
    /* legFrom = 'knee' — крупный план «колено — стопа» на схеме про голеностоп */
    const leg = (s) => ['hipJoint' + s, 'knee' + s, 'ankle' + s, 'toe' + s]
      .slice(o.legFrom === 'knee' ? 1 : 0);
    /* какие части рисовать: крупный план «колено — стопа» — это тоже фигура
       из модели, просто с выключенными корпусом, головой и руками */
    const showArms = o.arms !== false;
    const showLegs = o.legs !== false;
    let s = '';
    if (far) {
      if (showLegs) s += limbSvg(res, leg(far), farC, lw * 0.9, o);
      if (showArms) s += limbSvg(res, arm(far), farC, lw * 0.84, o);
    }
    if (o.torso !== false) s += torsoPath(res, fill, ink, o.lwTorso || 1.4);
    if (o.head !== false) {
      /* шея: короткое толстое звено от плечевого пояса к голове. Без неё
         голова «приклеена» к корпусу и поворот головы не читается. */
      s += ln(res.pts.neck, res.pts.head, ink, lw * 1.05);
      s += ci(res.pts.head, P.headR * res.opts.H, fill, ink, o.lwTorso || 1.4);
      /* точка лица: направление взгляда — часть позы, а не украшение.
         Именно по ней на схемах видно «лицо в воде» и «поворот на вдох». */
      if (o.face !== false) s += ci(res.pts.face, Math.max(1.8, lw * 0.32), ink);
    }
    const order = near ? [near] : SIDES;
    for (const sd of order) {
      if (showLegs) s += limbSvg(res, leg(sd), ink, lw, o);
      if (showArms) s += limbSvg(res, arm(sd), ink, lw * 0.92, o);
    }
    return s;
  }

  /* ---------- 7. открытый интерфейс ---------- */

  function figure(pose, opts) {
    const o = opts || {};
    const res = solve(pose, o);
    const body = render(res, o);
    return o.id ? `<g data-figure="${o.id}">${body}</g>` : body;
  }

  figure.solve = solve;
  figure.render = render;
  figure.measure = measure;
  figure.normalize = normalize;
  figure.validate = (pose, where) => validate(normalize(pose), where);
  figure.P = P;
  figure.REF = REF;
  figure.refOf = refOf;
  figure.RANGE = RANGE;
  figure.C = C;
  figure.PoseError = PoseError;
  /* запись всех решённых поз — на ней держится tools/check_anatomy.js */
  figure.record = (on) => { REC.on = !!on; if (on) REC.log = []; return REC.log; };
  figure.log = () => REC.log;

  PE.figure = figure;

  /* ---------- 8. статические схемы страниц ---------- */

  /* Схема — именованная функция, возвращающая разметку фигур для одного
     места на странице. В HTML остаётся только обвязка (вода, подписи,
     стрелки) и пустой <g data-figure-scheme="имя">, который заполняется при
     загрузке. Так у статических схем и анимаций одна и та же модель и один
     и тот же прогон проверки анатомии. */
  const SCHEME = PE.SCHEME || (PE.SCHEME = {});
  PE.scheme = function (name, fn) { SCHEME[name] = fn; };

  PE.mountSchemes = function (scope) {
    const root = scope || (typeof document !== 'undefined' ? document : null);
    if (!root || !root.querySelectorAll) return;
    root.querySelectorAll('[data-figure-scheme]').forEach((g) => {
      const fn = SCHEME[g.getAttribute('data-figure-scheme')];
      if (fn) g.innerHTML = fn();
    });
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = PE;
})(typeof window !== 'undefined' ? window : globalThis);
