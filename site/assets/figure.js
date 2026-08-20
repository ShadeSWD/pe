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
    heelBack: 0.042,       // вынос пятки назад от щиколотки
    heelDown: 0.022,       // вынос пятки к подошве
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
      /* пятка: выступ назад от щиколотки и вниз, к подошве. Отдельная точка
         нужна только для силуэта — на длины звеньев она не влияет, зато без
         неё стопа читается как палка, приклеенная к голени. */
      pts['heel' + s] = V.add(an,
        V.add(V.mul(dFoot, -P.heelBack), V.mul(dS, P.heelDown)));
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

    /* Проектор направлений: та же линейная часть преобразования, что и у
       точек скелета. По нему считается силуэт туловища — он должен жить в
       одной системе с костями, иначе тело «съедет» с плеч. */
    const dir = dirProj(p, { view, facing, H });
    const torso = torsoPoly(dir);

    /* привязка: в точку (o.x, o.y) ставится таз или указанная точка скелета
       (o.anchor) — так удобно строить крупные планы «колено — стопа». */
    const anchor = screen[o.anchor] ? screen[o.anchor] : screen.hip;
    let dx = num(o.x, 320) - anchor.x;
    let dy = num(o.y, 150) - anchor.y;
    const shift = () => {
      for (const k of Object.keys(screen)) { screen[k].x += dx; screen[k].y += dy; }
      for (const q of torso) { q.x += dx; q.y += dy; }
    };
    shift();

    /* «спина и затылок на линии воды»: поднимаем тело так, чтобы самая
       верхняя точка силуэта (спина или затылок) легла ровно на поверхность */
    const backTop = () => {
      let m = screen.head.y - P.headR * H;
      for (const q of torso) if (q.y < m) m = q.y;
      return m;
    };
    if (o.place === 'surface' && isFinite(o.waterline)) {
      dx = 0; dy = o.waterline - backTop(); shift();
    }

    const wl = isFinite(o.waterline) ? o.waterline : null;
    const depth = {};
    if (wl !== null) for (const k of Object.keys(screen)) depth[k] = (screen[k].y - wl) / H;

    const seg = segments(screen, view);
    /* что схема сама о себе утверждает — на это опирается check_anatomy.js:
       surface — «тело лежит у поверхности», проверяем глубину спины;
       sag     — «таз провален намеренно, это и есть показанная ошибка»;
       plan    — 'wide' значит «общий план»: фигура намеренно мелкая, потому
                 что на доске показано её перемещение по дорожке или это
                 врезка «та же поза сбоку». Для всего остального действует
                 требование к крупности (см. tools/check_anatomy.js). */
    const declared = {
      surface: o.place === 'surface' || o.surface === true,
      sag: !!o.sag,
      torso: o.torso !== false,
      head: o.head !== false,
      arms: o.arms !== false,
      legs: o.legs !== false,
    };
    const res = {
      pose: p,
      opts: {
        H, view, facing, waterline: wl,
        board: num(o.board, 640),
        plan: o.plan === 'wide' ? 'wide' : 'near',
      },
      pts: screen, local, world, seg, depth, torso, backTop: backTop(), declared, P,
    };
    res.parts = buildParts(res, o);
    res.span = spanOf(res.parts);
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
    ink: '#16161a', skin: '#e8eef2', far: '#a9b3ba', farSkin: '#dde4e9',
    water: '#155e75', red: '#b3382e', green: '#1a7f37', gray: '#6b6b74',
  };

  const n1 = (v) => Math.round(v * 10) / 10;

  /* ---------- 6.1 силуэт туловища ---------- */

  /* Сечения туловища вдоль оси «плечи → таз». Для каждого сечения задано,
     насколько тело выходит от продольной оси вбок (lat), вперёд, к животу
     (ven) и назад, к спине (dor). Всё в долях роста, t — доля отрезка
     «плечи → таз»: отрицательные значения — надплечья и основание шеи,
     больше единицы — переход в бёдра.
     Профиль НЕСИММЕТРИЧЕН, и это главное: вперёд выходит грудная клетка,
     назад — ягодицы, между ними талия. Симметричная «доска», стоявшая здесь
     раньше, ни сбоку, ни сверху на человека не походила. */
  const TORSO = [
    [-0.13, 0.036, 0.030, 0.028],   // основание шеи
    [-0.07, 0.070, 0.046, 0.042],   // надплечья
    [0.00, 0.112, 0.058, 0.054],    // плечевой пояс — самое широкое место
    [0.16, 0.104, 0.068, 0.052],    // грудь
    [0.38, 0.092, 0.064, 0.048],    // низ рёбер
    [0.58, 0.076, 0.052, 0.044],    // талия
    [0.78, 0.084, 0.050, 0.050],
    [1.00, 0.094, 0.048, 0.062],    // таз: назад выходит ягодица
    [1.13, 0.088, 0.040, 0.050],
    [1.23, 0.062, 0.028, 0.030],    // переход в бёдра
  ];

  /* Толщина конечностей: радиус «мяса» вокруг кости у каждого сустава, доли
     роста. У плеча вдвое толще, чем у запястья; бедро толще голени. Пока эти
     числа были одним stroke-width, все конечности читались как одинаковые
     палки, и на схеме нельзя было отличить руку от ноги. */
  const TH = {
    shoulder: 0.036, elbow: 0.027, wrist: 0.020, palm: 0.026, finger: 0.007,
    hipJoint: 0.050, knee: 0.036, ankle: 0.022, heel: 0.019, foot: 0.015,
    toe: 0.006, neckLow: 0.037, neckUp: 0.028,
  };

  /* Профиль головы в долях её радиуса: первая координата — по оси взгляда
     (вперёд), вторая — к макушке. Затылок и темя достраиваются дугой
     окружности, а здесь записано лицо: лоб, переносица, нос, губы,
     подбородок. Нос и подбородок выходят за окружность черепа — по ним и
     видно, куда смотрит пловец, без всякой подписи. */
  const FACE = [
    [0.00, 1.00], [0.46, 0.89], [0.80, 0.60],   // темя и лоб
    [0.94, 0.30], [0.90, 0.15],                 // надбровье и переносица
    [1.18, -0.02],                              // кончик носа
    [1.04, -0.18], [1.02, -0.36],               // под носом и губы
    [0.88, -0.56], [0.54, -0.82],               // подбородок и челюсть
    [0.16, -0.96], [0.00, -1.00],
  ];
  /* Затылочная половина: дуга от подчелюстного края к темени. */
  const SKULL = (() => {
    const a = [];
    for (let i = 1; i < 15; i++) {
      const t = -Math.PI / 2 - (i / 15) * Math.PI;
      a.push([Math.cos(t), Math.sin(t)]);
    }
    return a;
  })();

  /* Проектор направлений: линейная часть преобразования «локальные
     координаты → доска». Точки скелета проходят ровно через него же. */
  function dirProj(pose, o) {
    const p = VIEWS[o.view], f = o.facing, H = o.H;
    const cr = Math.cos(rad(pose.roll)), sr = Math.sin(rad(pose.roll));
    const ct = Math.cos(rad(pose.tilt)), st = Math.sin(rad(pose.tilt));
    return (v) => {
      const y1 = v[1] * cr - v[2] * sr, z1 = v[1] * sr + v[2] * cr;
      const q = p([v[0] * ct + y1 * st, -v[0] * st + y1 * ct, z1], f);
      return { x: q[0] * H, y: q[1] * H };
    };
  }

  /* Полуразмер сечения поперёк оси на доске. Сечение — эллипс с полуосями
     «вбок» и «вперёд-назад»; проецируем его честно, иначе вид сверху и вид
     сбоку дадут разную толщину одного и того же туловища. */
  function halfExtent(pr, latHalf, venHalf, nx, ny) {
    const a = pr([0, 0, latHalf]), b = pr([0, venHalf, 0]);
    return Math.hypot(a.x * nx + a.y * ny, b.x * nx + b.y * ny);
  }

  /* Сечения таблицы TORSO, разложенные с мелким шагом: контур строится
     сглаживанием по опорным точкам, и на редкой сетке углы срезались бы. */
  const TORSO_FINE = (() => {
    const out = [];
    const STEP = 24;
    for (let i = 0; i < TORSO.length - 1; i++) {
      const a = TORSO[i], b = TORSO[i + 1];
      const n = Math.max(1, Math.round((b[0] - a[0]) * STEP));
      for (let j = 0; j < n; j++) {
        const k = j / n;
        out.push([0, 1, 2, 3].map((m) => a[m] + (b[m] - a[m]) * k));
      }
    }
    out.push(TORSO[TORSO.length - 1]);
    return out;
  })();

  /* Замкнутый контур туловища в координатах доски (до привязки). */
  function torsoPoly(pr) {
    const ax = pr([-P.torso, 0, 0]);                  // ось: от плеч к тазу
    const d = Math.hypot(ax.x, ax.y);
    const ux = d > 1e-6 ? ax.x / d : 1, uy = d > 1e-6 ? ax.y / d : 0;
    const nx = -uy, ny = ux;
    const right = [], left = [];
    for (const [t, lat, ven, dor] of TORSO_FINE) {
      const c = pr([P.torso * (1 - t), (ven - dor) / 2, 0]);
      const w = halfExtent(pr, lat, (ven + dor) / 2, nx, ny);
      right.push({ x: c.x + nx * w, y: c.y + ny * w });
      left.unshift({ x: c.x - nx * w, y: c.y - ny * w });
    }
    return right.concat(left);
  }

  /* ---------- 6.2 сборка частей ---------- */

  /* Все части фигуры в координатах доски: контур туловища, цепочки «мяса»
     вокруг костей и голова. Считается в solve, а не в render, потому что по
     этим же данным tools/check_anatomy.js меряет крупность фигуры и
     наползание головы на корпус. */
  function buildParts(res, o) {
    const H = res.opts.H, p = res.pts, k = o.thick || 1;
    const r = (key) => TH[key] * H * k;
    const nd = (key, rr) => ({ x: p[key].x, y: p[key].y, r: rr });
    const mid = (a, b, t, rr) =>
      ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, r: rr });
    /* Единичный вектор оси тела на доске, от плеч к тазу. По нему корни
       конечностей уводятся ВНУТРЬ корпуса: иначе круглая «шапка» звена
       ложится по краю силуэта и на схеме появляется лишняя дуга поперёк
       плеча или таза. Направление самого звена от этого не меняется. */
    const adx = p.hip.x - p.neck.x, ady = p.hip.y - p.neck.y;
    const aL = Math.hypot(adx, ady) || 1;
    const root = (q, d, rr) =>
      ({ x: p[q].x + adx / aL * d, y: p[q].y + ady / aL * d, r: rr });

    const near = o.near === 'L' ? 'L' : o.near === 'R' ? 'R'
      : (o.near === false ? null : 'R');
    /* far = false — рисуем только ближнюю сторону (крупные планы одной ноги) */
    const far = o.far === false ? null
      : (near === 'R' ? 'L' : near === 'L' ? 'R' : null);
    const showArms = o.arms !== false, showLegs = o.legs !== false;

    const chains = [];
    const sides = [];
    if (far) sides.push({ s: far, near: false });
    for (const s of (near ? [near] : SIDES)) sides.push({ s, near: true });
    for (const it of sides) {
      const s = it.s;
      if (showLegs) {
        /* legFrom = 'knee' — крупный план «колено — стопа» */
        let leg = [root('hipJoint' + s, -0.055 * H, r('hipJoint') * 0.72),
          nd('hipJoint' + s, r('hipJoint')), nd('knee' + s, r('knee')),
          nd('ankle' + s, r('ankle'))];
        if (o.legFrom === 'knee') leg = leg.slice(2);
        const foot = [nd('heel' + s, r('heel')), nd('ankle' + s, r('ankle') * 0.9),
          mid(p['ankle' + s], p['toe' + s], 0.62, r('foot')), nd('toe' + s, r('toe'))];
        chains.push({ near: it.near, lines: [leg, foot] });
      }
      if (showArms) {
        let arm = [root('shoulder' + s, 0.045 * H, r('shoulder') * 0.72),
          nd('shoulder' + s, r('shoulder')), nd('elbow' + s, r('elbow')),
          nd('wrist' + s, r('wrist')),
          mid(p['wrist' + s], p['finger' + s], 0.55, r('palm')),
          nd('finger' + s, r('finger'))];
        if (o.armFrom === 'elbow') arm = arm.slice(2);
        chains.push({ near: it.near, lines: [arm] });
      }
    }

    let head = null;
    if (o.head !== false) {
      const R = P.headR * H;
      const hc = p.head;
      const neck = [mid(p.neck, hc, 0.02, r('neckLow')), mid(p.neck, hc, 0.72, r('neckUp'))];
      /* Направление взгляда и «к макушке» — обе оси приходят из позы, а не
         подбираются: лицо всегда согласовано с углами шеи. Когда пловец
         смотрит от нас (лицо в воде на виде сверху), проекция взгляда
         коротка, профиль сам съезжает в круг — и это правда: мы видим
         затылок. */
      const ex = p.face.x - hc.x, ey = p.face.y - hc.y;
      const el = Math.hypot(ex, ey);
      const kx = p.crown.x - hc.x, ky = p.crown.y - hc.y;
      const kl = Math.hypot(kx, ky);
      let face = null, eye = null;
      if (el > R * 0.08) {
        /* fu, ku — насколько оси «взгляд» и «к макушке» видны в этой
           проекции. Профиль плавно перетекает в окружность, когда голова
           отворачивается: чистый череп — шар, и с затылка он и должен
           выглядеть кругом. Поэтому каждая точка профиля смешивается с
           точкой окружности, лежащей на той же высоте. */
        const fu = Math.min(1, el / (R * 0.98));
        const ku = Math.min(1, kl / R);
        const ax = ex / el, ay = ey / el;               // ось взгляда
        let bx = -ay, by = ax;                          // ось «к макушке»
        if (bx * kx + by * ky < 0) { bx = -bx; by = -by; }
        const sg = (v) => (v < 0 ? -1 : 1);
        const rt = (v) => Math.sqrt(Math.max(0, 1 - Math.min(1, v * v)));
        const at = (fx, fy) => {
          const e = fu * fx + (1 - fu) * sg(fx) * rt(fy);
          const k = ku * fy + (1 - ku) * sg(fy) * rt(fx);
          return { x: hc.x + (ax * e + bx * k) * R, y: hc.y + (ay * e + by * k) * R };
        };
        face = FACE.concat(SKULL).map((q) => at(q[0], q[1]));
        /* глаз гаснет вместе с профилем: с затылка глаза не видно */
        const vis = Math.min(1, Math.max(0, (fu - 0.18) / 0.45));
        if (vis > 0.02) eye = { c: at(0.56, 0.26), r: Math.max(1, R * 0.10), o: vis };
      }
      head = { c: hc, r: R, neck, face, eye };
    }
    return {
      torso: o.torso !== false ? res.torso : null,
      chains, head,
    };
  }

  /* Габарит нарисованного — на нём держится проверка крупности фигуры. */
  function spanOf(parts) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    const put = (x, y, r) => {
      x0 = Math.min(x0, x - r); x1 = Math.max(x1, x + r);
      y0 = Math.min(y0, y - r); y1 = Math.max(y1, y + r);
    };
    if (parts.torso) for (const q of parts.torso) put(q.x, q.y, 0);
    for (const ch of parts.chains) {
      for (const line of ch.lines) for (const q of line) put(q.x, q.y, q.r);
    }
    if (parts.head) put(parts.head.c.x, parts.head.c.y, parts.head.r);
    if (!isFinite(x0)) return { x0: 0, y0: 0, x1: 0, y1: 0, w: 0, h: 0 };
    return { x0, y0, x1, y1, w: x1 - x0, h: y1 - y0 };
  }

  /* ---------- 6.3 отрисовка ---------- */

  /* Гладкий замкнутый контур по опорным точкам: через середины сторон
     квадратичными дугами, вершина ломаной — управляющая точка. Способ выбран
     не случайно: сплайн Катмулла — Рома на неравномерной сетке ВЫЛЕТАЕТ за
     опорные точки, и нос на профиле головы превращался в клюв, а лоб — в
     двойной горб. Здесь кривая не выходит за ломаную никогда. */
  function smooth(pts) {
    const n = pts.length;
    if (n < 3) return '';
    const at = (i) => pts[((i % n) + n) % n];
    const mid = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
    const m0 = mid(at(0), at(1));
    let d = `M ${n1(m0.x)} ${n1(m0.y)}`;
    for (let i = 1; i <= n; i++) {
      const c = at(i), m = mid(at(i), at(i + 1));
      d += ` Q ${n1(c.x)} ${n1(c.y)} ${n1(m.x)} ${n1(m.y)}`;
    }
    return d + ' Z';
  }

  /* Звено переменной толщины: трапеция между суставами плюс кружок в самом
     суставе. Вместе — капсула с плавным сужением. */
  function chainShapes(lines) {
    const out = [];
    for (const line of lines) {
      for (let i = 0; i < line.length - 1; i++) {
        const a = line[i], b = line[i + 1];
        const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy);
        if (d < 0.3) continue;
        const nx = -dy / d, ny = dx / d;
        out.push({ t: 'p', d: `M ${n1(a.x + nx * a.r)} ${n1(a.y + ny * a.r)}`
          + ` L ${n1(b.x + nx * b.r)} ${n1(b.y + ny * b.r)}`
          + ` L ${n1(b.x - nx * b.r)} ${n1(b.y - ny * b.r)}`
          + ` L ${n1(a.x - nx * a.r)} ${n1(a.y - ny * a.r)} Z` });
      }
      for (const q of line) if (q.r > 0.3) out.push({ t: 'c', x: q.x, y: q.y, r: q.r });
    }
    return out;
  }

  const shapeSvg = (sh, fill, stroke, w) => {
    const st = stroke
      ? ` stroke="${stroke}" stroke-width="${n1(w)}" stroke-linejoin="round"` : '';
    return sh.t === 'c'
      ? `<circle cx="${n1(sh.x)}" cy="${n1(sh.y)}" r="${n1(sh.r)}" fill="${fill}"${st}/>`
      : `<path d="${sh.d}" fill="${fill}"${st}/>`;
  };

  /* Группа форм рисуется дважды: сначала контуром (та же форма, раздутая
     обводкой на толщину контура и залитая цветом контура), потом заливкой.
     Внутренние швы пропадают сами — вторая заливка их закрывает. Поэтому
     рука с переменной толщиной остаётся ОДНОЙ фигурой, а не набором
     трапеций, и при этом обведена по внешнему краю. */
  function group(shapes, fill, stroke, grow) {
    let s = '';
    for (const sh of shapes) s += shapeSvg(sh, stroke, stroke, grow * 2);
    for (const sh of shapes) s += shapeSvg(sh, fill, null, 0);
    return s;
  }

  /* Порядок отрисовки задан перекрытием: дальние конечности — под телом,
     ближние — поверх корпуса, голова — поверх всего. Голова наверху не для
     красоты: в виде сбоку вытянутая вперёд рука проходит ровно по лицу, и
     если рисовать её поверх, схема перестаёт отвечать на главный вопрос —
     куда смотрит пловец. */
  function render(res, o) {
    const parts = res.parts || buildParts(res, o);
    const near = o.near === 'L' ? 'L' : o.near === 'R' ? 'R'
      : (o.near === false ? null : 'R');
    const ink = o.color || C.ink;
    const farC = o.farColor || (near === null ? ink : C.far);
    const fill = o.fill || C.skin;
    const farFill = o.farFill || (near === null ? fill : C.farSkin);
    const g = o.edge || Math.max(0.8, res.opts.H * 0.0046);

    let s = '';
    for (const ch of parts.chains) {
      if (!ch.near) s += group(chainShapes(ch.lines), farFill, farC, g);
    }
    const h = parts.head;
    /* Шея на виде СВЕРХУ смотрится вдоль себя и целиком лежит внутри силуэта
       корпуса: сверху между плечами и головой видны только плечи и голова.
       Нарисованная своей группой ПОВЕРХ корпуса, она давала внутри силуэта
       замкнутый контур-капсулу — и он читался как отдельный «блок плеча»,
       на который наползает круг головы. Поэтому сверху шея входит в ту же
       группу, что и корпус, и сливается с ним (внутренние швы закрывает
       вторая заливка группы), а голова ложится поверх.
       Сбоку шея видна вся и остаётся в группе головы: там их общий контур и
       делает переход к подбородку. */
    const neckInBody = !!(h && parts.torso && res.opts.view === 'top');
    if (parts.torso) {
      const body = [{ t: 'p', d: smooth(parts.torso) }];
      if (neckInBody) for (const q of chainShapes([h.neck])) body.push(q);
      s += group(body, fill, ink, g);
    }
    for (const ch of parts.chains) {
      if (ch.near) s += group(chainShapes(ch.lines), fill, ink, g);
    }
    if (h) {
      const shapes = neckInBody ? [] : chainShapes([h.neck]);
      /* Голова — либо профиль (в нём нос и подбородок выходят за череп, а
         челюсть, наоборот, поднутряет), либо просто круг, если лица в этой
         проекции не видно. Круг вместе с профилем рисовать нельзя: он
         закрасил бы поднутрение, и от лица остался бы один клюв. */
      if (h.face && o.face !== false) shapes.push({ t: 'p', d: smooth(h.face) });
      else shapes.push({ t: 'c', x: h.c.x, y: h.c.y, r: h.r });
      s += group(shapes, fill, ink, g);
      if (h.eye && o.face !== false) {
        s += `<circle cx="${n1(h.eye.c.x)}" cy="${n1(h.eye.c.y)}" r="${n1(h.eye.r)}"`
          + ` fill="${ink}" opacity="${n1(0.2 + 0.8 * h.eye.o)}"/>`;
      }
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
