/* Анимации техники способов плавания: кроль на груди (сбоку и сверху),
 * траектория кисти, кроль на спине, брасс (сбоку и сверху), поворот и старт.
 * Сцена и общие циклы — assets/swim.js, плеер — assets/anim.js,
 * фигура — assets/figure.js.
 *
 * Как это устроено. Для каждого способа записан ОДИН набор опорных углов на
 * цикл движения; все проекции (сбоку, сверху) и все производные картинки
 * (след кисти, две системы отсчёта) считаются из него же. Раньше вид сбоку и
 * вид сверху были двумя независимыми наборами координат и расходились между
 * собой; теперь разойтись им негде — это одна поза, показанная с двух сторон.
 *
 * Все виды сбоку: пловец движется ВПРАВО.
 */
'use strict';
(function (global) {
  const PE = global.PE;
  const M = PE.m;
  const S = PE.swim;
  const C = PE.C;
  const H = PE.H;
  const { line, circle, path, text } = M;
  const { angAt, joints, kickCrawl, kickBreast, fig, ARMS_FRONT } = S;

  /* ================= кроль на груди ================= */

  /* Цикл руки в углах. Читать сверху вниз как раскадровку гребка:
     плечо (подъём) падает со 174° до 14° — рука проходит от положения «за
     головой» до бедра; плоскость подъёма на гребке около 25° (рука идёт под
     телом), на проносе 120–140° (рука идёт сбоку и над спиной);
     локоть на захвате и подтягивании согнут до 90–100° и развёрнут
     (elbowDir = 180) — это и есть «высокий локоть». */
  const CRAWL_ARM = [
    { u: 0.00, shoulder: 168, shoulderPlane: 30, elbow: 12, elbowDir: 180 },  // вход кисти в воду
    { u: 0.08, shoulder: 174, shoulderPlane: 22, elbow: 6, elbowDir: 180 },   // вытягивание вперёд
    { u: 0.16, shoulder: 158, shoulderPlane: 26, elbow: 44, elbowDir: 180 },  // захват, локоть высоко
    { u: 0.26, shoulder: 128, shoulderPlane: 30, elbow: 94, elbowDir: 180 },  // подтягивание
    { u: 0.36, shoulder: 92, shoulderPlane: 26, elbow: 100, elbowDir: 180 },  // кисть под плечом
    { u: 0.46, shoulder: 55, shoulderPlane: 22, elbow: 64, elbowDir: 180 },   // отталкивание
    { u: 0.56, shoulder: 14, shoulderPlane: 26, elbow: 10, elbowDir: 180 },   // завершение у бедра
    { u: 0.64, shoulder: 40, shoulderPlane: 140, elbow: 58, elbowDir: 0 },    // выход: первым локоть
    { u: 0.72, shoulder: 78, shoulderPlane: 128, elbow: 76, elbowDir: 0 },    // пронос над водой
    { u: 0.82, shoulder: 118, shoulderPlane: 134, elbow: 48, elbowDir: 0 },   // рука над плечом
    { u: 0.92, shoulder: 152, shoulderPlane: 118, elbow: 22, elbowDir: 0 },   // вынос вперёд
  ];
  /* Крен корпуса: тело проворачивается в сторону гребущей руки. Именно крен
     делает возможным пронос — без него руку было бы не перенести. */
  const crawlRoll = (u) => 34 * Math.sin(2 * Math.PI * (u - 0.05));

  /* Поза кроля целиком: ближняя рука — правая. */
  function crawlPose(u, opt) {
    const o = opt || {};
    const near = angAt(CRAWL_ARM, u);
    const far = angAt(CRAWL_ARM, (u + 0.5) % 1);
    return {
      roll: o.roll === false ? 0 : crawlRoll(u),
      headTilt: 8,
      headTurn: o.headTurn || 0,
      R: Object.assign({}, joints(near), kickCrawl(u * 3)),
      L: Object.assign({}, joints(far), kickCrawl(u * 3 + 0.5)),
    };
  }

  const CR = { x: 262, y: 148, ws: 104, H: H };

  /* След кисти. Считается из той же модели: точка запястья ближней руки на
     каждом шаге цикла. Раньше след был отдельным списком координат и не
     совпадал с рукой; теперь он не может не совпадать. */
  function traceCrawl(view, opt) {
    const o = opt || {};
    let under = '', over = '', wasUnder = null;
    const pts = [];
    for (let i = 0; i <= 120; i++) {
      const u = i / 120;
      const r = PE.figure.solve(crawlPose(u), {
        H: o.H || CR.H, view: view || 'side', x: o.x || CR.x, y: o.y || CR.y,
        plan: o.plan, where: o.where || 'crawl / след кисти',
      });
      const p = r.pts.wristR;
      pts.push(p);
      const isUnder = p.y > (o.ws === undefined ? CR.ws : o.ws);
      const cmd = ` ${isUnder === wasUnder ? 'L' : 'M'} ${M.num(p.x)} ${M.num(p.y)}`;
      if (isUnder) under += cmd; else over += cmd;
      wasUnder = isUnder;
    }
    return { under: under.trim(), over: over.trim(), pts };
  }

  PE.reg('crawl-side', {
    w: 640, h: 300, frames: 60, period: 4200,
    phases: [
      { to: 0.16, name: 'Вход и захват', note: 'Кисть входит в воду впереди плеча, пальцами вперёд, и вытягивается. Затем кисть разворачивается ладонью назад и начинает давить на воду — это захват. Локоть в это время остаётся выше кисти.' },
      { to: 0.36, name: 'Подтягивание', note: 'Кисть идёт под тело, локоть согнут примерно на 90° и держится высоко. Гребёт не ладонь, а вся плоскость «предплечье + кисть».' },
      { to: 0.56, name: 'Отталкивание', note: 'Самая мощная часть гребка: рука разгибается, кисть ускоряется назад и заканчивает движение у бедра выпрямленной рукой.' },
      { to: 0.66, name: 'Выход руки', note: 'Из воды первым выходит локоть, за ним предплечье и кисть. Рука расслабляется.' },
      { to: 1.00, name: 'Пронос над водой', note: 'Расслабленная рука проносится вперёд. В этой фазе она не гребёт и не должна тормозить: чем спокойнее пронос, тем ровнее ход.' },
    ],
    bg() {
      const t = traceCrawl('side');
      return S.water(640, 300, CR.ws)
        + path(t.under, C.water, 1.2, 'none', ' stroke-dasharray="5 4" opacity=".75"')
        + path(t.over, C.gray, 1.2, 'none', ' stroke-dasharray="5 4" opacity=".6"')
        + text(20, 250, 'след кисти под водой', C.water)
        + text(20, 56, 'след кисти над водой (пронос)', C.gray)
        + S.moveArrow(520, 40, 'движение')
        + text(8, 288, 'шесть ударов ногами на один цикл рук; тёмным — ближние рука и нога, светлым — дальние', C.gray);
    },
    draw(u) {
      const pose = crawlPose(u);
      let s = S.drift(u, CR.ws, 10, 130, 280, 0.25);
      s += fig(pose, {
        x: CR.x, y: CR.y, waterline: CR.ws, near: 'R',
        where: 'crawl-side', H: CR.H,
      });
      /* направление усилия кисти в рабочей части гребка — берём из самой
         модели: куда кисть сместится за следующий кусочек цикла */
      if (u > 0.12 && u < 0.56) {
        const o = { H: CR.H, x: CR.x, y: CR.y, where: 'crawl-side / усилие' };
        const a = PE.figure.solve(crawlPose(u), o).pts.wristR;
        const b = PE.figure.solve(crawlPose(Math.min(0.56, u + 0.03)), o).pts.wristR;
        const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1;
        s += line(a.x, a.y, a.x + dx / d * 34, a.y + dy / d * 34, C.red, 2.2,
          ' marker-end="url(#arrR)"');
        s += text(a.x - 44, a.y + 4, 'кисть давит на воду назад', C.red, 11, 'end');
      }
      s += text(20, 74, 'крен корпуса ' + Math.round(Math.abs(crawlRoll(u))) + '°', C.gray);
      return s;
    },
    caption: 'Кроль на груди, вид сбоку. Пунктир — след кисти: он посчитан из той же позы, что и рука, поэтому рука по нему идёт точно. Остановите анимацию в фазе подтягивания и посмотрите, что локоть выше кисти.',
  });

  /* ---------- траектория кисти в двух системах отсчёта ---------- */

  const ADV = 210;             // продвижение тела за цикл рук, ед. доски

  PE.reg('hand-path', {
    w: 640, h: 368, frames: 60, period: 5200,
    phases: [
      { to: 0.56, name: 'Опорная часть: кисть «держится» за воду', note: 'В системе отсчёта тела (вверху) кисть уходит далеко назад. В системе отсчёта воды (внизу) она смещается назад совсем немного: пловец подтягивает тело к почти неподвижной кисти. Если кисть проскальзывает назад, гребок пустой.' },
      { to: 1.00, name: 'Пронос: кисть возвращается вперёд', note: 'Над водой кисть быстро идёт вперёд в обеих системах отсчёта. Именно поэтому её путь в системе отсчёта воды — вытянутая петля, а не круг.' },
    ],
    bg() {
      const A = {
        H: H * 0.62, x: 296, y: 98, ws: 74,
        plan: 'wide', where: 'hand-path / след кисти',
      };
      const B = {
        H: H * 0.62, x: 150, y: 266, ws: 262,
        plan: 'wide', where: 'hand-path / след кисти',
      };
      const a = traceCrawl('side', A);
      let rel = '', abs = '';
      for (let i = 0; i < a.pts.length; i++) {
        rel += `${i === 0 ? 'M' : 'L'} ${M.num(a.pts[i].x)} ${M.num(a.pts[i].y)}`;
      }
      const b = traceCrawl('side', B);
      for (let i = 0; i < b.pts.length; i++) {
        const dx = ADV * (i / (b.pts.length - 1));
        abs += `${i === 0 ? 'M' : 'L'} ${M.num(b.pts[i].x + dx)} ${M.num(b.pts[i].y)}`;
      }
      /* У каждой панели своя поверхность воды. Раньше воды здесь не было
         вовсе: обе фигуры висели на белом фоне, хотя весь смысл доски — что
         кисть часть цикла идёт ПОД водой, а часть проносится НАД ней, и
         пунктир этих двух участков ничем не подпирался. */
      return S.water(640, 178, A.ws, { labelX: 470 })
        + S.water(640, 368, B.ws, { labelX: 470 })
        + line(0, 178, 640, 178, C.gray, 1)
        + text(10, 20, 'Система отсчёта тела: тело неподвижно, кисть уходит назад', C.ink)
        + text(10, 212, 'Система отсчёта воды: кисть почти на месте, вперёд едет тело', C.ink)
        + path(rel, C.water, 1.4, 'none', ' stroke-dasharray="5 4"')
        + path(abs, C.green, 1.6, 'none', ' stroke-dasharray="5 4"');
    },
    draw(u) {
      const pose = crawlPose(u, { roll: false });
      let s = '';
      /* верхняя панель: тело на месте */
      /* Общий план: на доске два поля отсчёта, и в нижнем тело ЕДЕТ вправо на
         целое продвижение за цикл. Крупная фигура вместе с этим ходом на
         640 единиц не встаёт — масштаб объявлен как plan: 'wide'. Масштаб у
         полей общий: иначе их нельзя сравнивать глазом. */
      s += fig(pose, {
        H: H * 0.62, x: 296, y: 98, near: 'R', plan: 'wide',
        where: 'hand-path / система тела',
      });
      const a = PE.figure.solve(pose, {
        H: H * 0.62, x: 296, y: 98, plan: 'wide', where: 'hand-path / кисть',
      }).pts.wristR;
      s += circle(a.x, a.y, 4, C.water);
      s += text(a.x + 10, a.y + 16, 'кисть', C.water);
      /* нижняя панель: тело едет вправо */
      const dx = ADV * u;
      s += fig(pose, {
        H: H * 0.62, x: 150 + dx, y: 266, near: 'R', plan: 'wide',
        where: 'hand-path / система воды',
      });
      const b = PE.figure.solve(pose, {
        H: H * 0.62, x: 150 + dx, y: 266, plan: 'wide', where: 'hand-path / кисть',
      }).pts.wristR;
      s += circle(b.x, b.y, 4, C.green);
      s += line(150 + dx, 350, 210 + dx, 350, C.green, 2, ' marker-end="url(#arrG)"');
      s += text(150 + dx - 20, 364, 'тело движется вперёд', C.green);
      return s;
    },
    caption: 'Одно и то же движение кисти в двух системах отсчёта. Вверху тело условно стоит, внизу — движется. Опорная часть гребка тем лучше, чем меньше кисть смещается назад относительно воды.',
  });

  /* ---------- кроль на груди, вид сверху ---------- */

  PE.reg('crawl-top', {
    w: 640, h: 300, frames: 60, period: 4200,
    phases: [
      { to: 0.36, name: 'Правая гребёт, левая проносится', note: 'Сверху хорошо видно главное: руки работают попеременно и почти всегда одна из них опирается о воду. Кисть гребущей руки идёт не строго назад, а сначала немного внутрь, под тело.' },
      { to: 0.50, name: 'Крен корпуса', note: 'Тело проворачивается вокруг продольной оси на 30–45° в сторону гребущей руки. Крен — не украшение: он удлиняет гребок и подставляет под воду более сильные мышцы спины.' },
      { to: 0.70, name: 'Поворот головы и вдох', note: 'Голова поворачивается вместе с корпусом в конце гребка, рот выходит в «воздушную ямку» у самой поверхности. Вдох короткий.' },
      { to: 1.00, name: 'Лицо в воду, выдох', note: 'Голова возвращается раньше, чем рука войдёт в воду. Дальше — непрерывный выдох до следующего вдоха.' },
    ],
    bg() {
      /* Вода заливкой и рябью: на виде сверху линии поверхности не бывает, а
         без воды панель читается как вид сбоку — фигура висит на белом. */
      return S.waterTop(640, 300, { label: false })
        + line(0, 158, 640, 158, C.gray, 0.9, ' stroke-dasharray="6 6"')
        + text(528, 152, 'ось движения', C.gray)
        + S.moveArrow(516, 22, 'движение')
        + text(8, 20, 'вид сверху: смотрим на пловца с бортика, сквозь воду', C.water)
        + text(8, 292, 'вид сверху — та же поза, что на схеме сбоку; тёмным — правая рука, светлым — левая', C.gray);
    },
    draw(u) {
      /* голова доворачивается к правому плечу в конце гребка правой руки */
      let turn = 0;
      if (u >= 0.46 && u < 0.58) turn = 88 * (u - 0.46) / 0.12;
      else if (u >= 0.58 && u < 0.70) turn = 88;
      else if (u >= 0.70 && u < 0.82) turn = 88 * (1 - (u - 0.70) / 0.12);
      const inhale = u >= 0.56 && u < 0.72;
      /* Минус: вдох делается в сторону ПРАВОГО плеча — того, которое в этой
         фазе идёт вверх вместе с проносом правой руки (crawlRoll в это время
         отрицателен, то есть правый бок поднимается). С плюсом голова
         поворачивалась в противоположную сторону, к плечу, уходящему под
         воду, — и подпись «вдох к правому плечу» противоречила рисунку. */
      const pose = crawlPose(u, { headTurn: -turn });
      /* голова — с макушки: профиль с глазом в этой проекции превращал вид
         сверху в вид сбоку (см. PE.swim.headTop) */
      const o = {
        H, view: 'top', x: 258, y: 158, near: 'R', face: false,
        where: 'crawl-top',
      };
      const r = PE.figure.solve(pose, o);
      let s = PE.figure.render(r, o);
      s += S.headTop(r, { color: inhale ? C.green : C.ink });
      if (inhale) {
        s += line(r.pts.face.x + 54, r.pts.face.y + 40, r.pts.face.x + 14,
          r.pts.face.y + 8, C.green, 2, ' marker-end="url(#arrG)"');
        s += text(r.pts.face.x + 58, r.pts.face.y + 44, 'вдох к правому плечу', C.green);
      } else {
        for (let i = 0; i < 5; i++) {
          const t = (u * 3 + i * 0.2) % 1;
          s += circle(r.pts.face.x + 12 + t * 26, r.pts.face.y + i * 2 - 4,
            1.5 + (i % 2), 'rgba(21,94,117,.4)');
        }
        s += text(430, 272, 'выдох в воду', C.water);
      }
      const roll = pose.roll;
      /* Сторону крена называем плечом, а не «вправо/влево»: слово «крен
         вправо» значит поворот в правую сторону, то есть ВВЕРХ идёт левое
         плечо, и на схеме это каждый раз читается наоборот. */
      s += text(8, 38, 'крен корпуса ' + Math.round(Math.abs(roll)) + '°'
        + (roll > 6 ? ': левое плечо вверх'
          : roll < -6 ? ': правое плечо вверх' : ''), C.water);
      return s;
    },
    caption: 'Кроль сверху: попеременная работа рук, крен корпуса и поворот головы на вдох. Это та же поза, что и на виде сбоку, — другая проекция. Проверьте по кадрам, что вдох приходится на конец гребка той же руки, а не на её пронос.',
  });

  /* ================= кроль на спине ================= */

  /* На спине тело перевёрнуто (крен около 180°), и всё остальное модель
     доделывает сама: колено само гнётся в другую сторону относительно воды,
     а рабочей становится другая половина удара ногами. Отдельной «ноги на
     спине» больше нет — это тот же цикл, что и на груди. */
  const BACK_ARM = [
    { u: 0.00, shoulder: 174, shoulderPlane: 40, elbow: 8, elbowDir: 0 },     // вход мизинцем за головой
    { u: 0.10, shoulder: 162, shoulderPlane: 78, elbow: 22, elbowDir: 180 },  // захват
    { u: 0.24, shoulder: 124, shoulderPlane: 96, elbow: 88, elbowDir: 180 },  // подтягивание, локоть ко дну
    { u: 0.40, shoulder: 74, shoulderPlane: 92, elbow: 72, elbowDir: 180 },   // отталкивание
    { u: 0.52, shoulder: 16, shoulderPlane: 52, elbow: 10, elbowDir: 180 },   // завершение у бедра
    { u: 0.60, shoulder: 34, shoulderPlane: 26, elbow: 8, elbowDir: 0 },      // выход большим пальцем вверх
    { u: 0.74, shoulder: 92, shoulderPlane: 14, elbow: 6, elbowDir: 0 },      // пронос через вертикаль
    { u: 0.88, shoulder: 146, shoulderPlane: 18, elbow: 6, elbowDir: 0 },     // рука над плечом
    { u: 0.95, shoulder: 166, shoulderPlane: 30, elbow: 6, elbowDir: 0 },     // рука идёт к воде
  ];

  function backPose(u) {
    const near = angAt(BACK_ARM, u);
    const far = angAt(BACK_ARM, (u + 0.5) % 1);
    return {
      roll: 180 + 32 * Math.sin(2 * Math.PI * (u - 0.05)),
      headTilt: 12,
      R: Object.assign({}, joints(near), kickCrawl(u * 3)),
      L: Object.assign({}, joints(far), kickCrawl(u * 3 + 0.5)),
    };
  }

  PE.reg('back-side', {
    w: 640, h: 300, frames: 60, period: 4400,
    phases: [
      { to: 0.10, name: 'Вход руки', note: 'Прямая рука входит в воду за головой, мизинцем вперёд, точно на ширине плеча. Плечо в этот момент уходит вниз, корпус кренится.' },
      { to: 0.40, name: 'Захват и подтягивание', note: 'Кисть уходит вглубь и назад, локоть сгибается примерно до 90° и смотрит ко дну. Кисть остаётся ближе к поверхности, чем локоть.' },
      { to: 0.58, name: 'Отталкивание', note: 'Рука разгибается, кисть ускоряется к бедру и заканчивает движение ладонью вниз у самого бедра.' },
      { to: 0.66, name: 'Выход руки', note: 'Из воды рука выходит большим пальцем вверх, прямая и расслабленная.' },
      { to: 1.00, name: 'Пронос', note: 'Прямая рука проносится над телом через вертикаль. В верхней точке ладонь разворачивается наружу, чтобы войти в воду мизинцем.' },
    ],
    bg() {
      return S.water(640, 300, 120, { labelX: 528 })
        + S.moveArrow(516, 40, 'движение')
        + text(8, 292, 'лицо всё время над водой; уши в воде, взгляд вверх — на потолок или на флажки', C.gray);
    },
    draw(u) {
      const pose = backPose(u);
      let s = S.drift(u, 120, 10, 140, 280, 0.35);
      s += fig(pose, {
        x: 268, y: 148, waterline: 120, place: 'surface', near: 'R',
        where: 'back-side', H: H,
      });
      if (u > 0.10 && u < 0.58) {
        const r = PE.figure.solve(pose, {
          H, x: 268, y: 148, waterline: 120, place: 'surface',
        });
        s += line(r.pts.wristR.x, r.pts.wristR.y, r.pts.wristR.x - 30,
          r.pts.wristR.y + 6, C.red, 2.2, ' marker-end="url(#arrR)"');
        s += text(20, 254, 'кисть выше локтя — опора не теряется', C.water);
      }
      return s;
    },
    caption: 'Кроль на спине — та же модель, перевёрнутая на 180°. Проверьте по кадрам: вход руки за головой, выход большим пальцем вверх; лицо ни в одной фазе не уходит под воду.',
  });

  /* ================= брасс ================= */

  const BREAST_ARM = [
    { u: 0.00, shoulder: 174, shoulderPlane: 16, elbow: 6, elbowDir: 180 },   // вытянуты, скольжение
    { u: 0.12, shoulder: 170, shoulderPlane: 34, elbow: 16, elbowDir: 180 },  // разведение и захват
    { u: 0.24, shoulder: 150, shoulderPlane: 66, elbow: 52, elbowDir: 180 },  // гребок вниз-наружу
    { u: 0.36, shoulder: 118, shoulderPlane: 72, elbow: 104, elbowDir: 180 }, // подтягивание под грудь
    { u: 0.46, shoulder: 96, shoulderPlane: 44, elbow: 128, elbowDir: 180 },  // локти к телу
    { u: 0.56, shoulder: 112, shoulderPlane: 20, elbow: 132, elbowDir: 180 }, // кисти под подбородком
    { u: 0.68, shoulder: 146, shoulderPlane: 16, elbow: 72, elbowDir: 180 },  // выведение вперёд
    { u: 0.80, shoulder: 168, shoulderPlane: 14, elbow: 20, elbowDir: 180 },  // руки почти прямые
    { u: 0.92, shoulder: 174, shoulderPlane: 14, elbow: 8, elbowDir: 180 },   // вытянуты
  ];

  /* Согласование: ноги ждут, пока гребут руки, подтягиваются к концу гребка
     и толкают ровно тогда, когда руки идут вперёд. */
  function breastLegPhase(u) {
    if (u < 0.30) return 0.86 + (u / 0.30) * 0.14;
    if (u < 0.52) return (u - 0.30) / 0.22 * 0.35;
    if (u < 0.58) return 0.35 + (u - 0.52) / 0.06 * 0.15;
    if (u < 0.78) return 0.50 + (u - 0.58) / 0.20 * 0.30;
    return 0.80 + (u - 0.78) / 0.22 * 0.06;
  }

  /* Волна корпуса: плечи и голова поднимаются к вдоху. Здесь это НАКЛОН
     тела, а не сдвиг точек: тело поворачивается вокруг таза, как в жизни. */
  const breastLift = (u) => 13 * Math.max(0,
    Math.sin(Math.PI * Math.min(1, Math.max(0, (u - 0.18) / 0.44))));

  function breastPose(u) {
    const a = angAt(BREAST_ARM, u);
    const leg = kickBreast(breastLegPhase(u));
    const lift = breastLift(u);
    return {
      tilt: lift, headTilt: 10 - lift * 0.9,
      both: Object.assign({}, joints(a), leg),
    };
  }

  PE.reg('breast-side', {
    w: 640, h: 300, frames: 60, period: 5000,
    phases: [
      { to: 0.14, name: 'Скольжение', note: 'Тело вытянуто, руки впереди, ноги вместе. В брассе это полноценная фаза: именно здесь набранная скорость превращается в пройденное расстояние.' },
      { to: 0.38, name: 'Гребок руками', note: 'Кисти разводятся наружу и давят вниз-назад. Руки не заходят за линию плеч — иначе выведение вперёд станет долгим и затормозит. Ноги в это время неподвижны и вытянуты.' },
      { to: 0.55, name: 'Вдох', note: 'Плечи и голова поднимаются как продолжение гребка, рот выходит над водой, происходит короткий вдох. Ноги начинают подтягиваться.' },
      { to: 0.78, name: 'Выведение рук и толчок ногами', note: 'Руки идут вперёд, голова опускается лицом в воду, и ровно в этот момент ноги отталкиваются. Главное правило согласования: руки гребут — ноги ждут, руки идут вперёд — ноги толкают.' },
      { to: 1.00, name: 'Возврат в скольжение', note: 'Тело снова вытянуто в линию, начинается выдох в воду. Цикл повторяется.' },
    ],
    bg() {
      return S.water(640, 300, 112)
        + S.moveArrow(516, 40, 'движение')
        + text(8, 288, 'один цикл брасса: гребок руками → вдох → выведение рук с толчком ногами → скольжение', C.gray);
    },
    draw(u) {
      const pose = breastPose(u);
      const breath = u >= 0.38 && u < 0.55;
      let s = S.drift(u, 112, 9, 150, 280, 0.2);
      s += fig(pose, {
        x: 274, y: 158, waterline: 112, near: 'R',
        where: 'breast-side', H: H,
      });
      const r = PE.figure.solve(pose, { H, x: 274, y: 158 });
      if (breath) {
        s += line(r.pts.head.x + 54, r.pts.head.y - 34, r.pts.head.x + 18,
          r.pts.head.y - 10, C.green, 2, ' marker-end="url(#arrG)"');
        s += text(r.pts.head.x + 58, r.pts.head.y - 36, 'вдох', C.green);
      } else if (u >= 0.62) {
        for (let i = 0; i < 5; i++) {
          const t = (u * 4 + i * 0.2) % 1;
          s += circle(r.pts.head.x + 12 + i * 3, r.pts.head.y + 12 - t * 22,
            1.5 + (i % 2), 'rgba(21,94,117,.4)');
        }
        s += text(r.pts.head.x + 30, r.pts.head.y + 22, 'выдох в воду', C.water);
      }
      if (u >= 0.55 && u < 0.78) {
        s += line(216, 232, 168, 222, C.green, 2.2, ' marker-end="url(#arrG)"');
        s += text(20, 254, 'толчок ногами', C.green);
        s += text(320, 268, 'руки идут вперёд — ноги толкают', C.water);
      }
      return s;
    },
    caption: 'Полный цикл брасса сбоку. Ключ к способу — согласование: руки и ноги никогда не работают одновременно. Остановите анимацию на фазе вдоха и посмотрите, где в этот момент находятся ноги.',
  });

  PE.reg('breast-top', {
    w: 640, h: 330, frames: 60, period: 5000,
    phases: [
      { to: 0.14, name: 'Вытянуты вперёд', note: 'Кисти вместе, ладони вниз, руки на ширине плеч или уже. Тело максимально узкое.' },
      { to: 0.38, name: 'Разведение и гребок', note: 'Кисти расходятся наружу чуть шире плеч и разворачиваются ладонями назад-наружу. Сверху путь кистей похож на верхнюю половину сердца.' },
      { to: 0.55, name: 'Сведение под грудью', note: 'Локти прижимаются к телу, кисти сходятся под подбородком. Это нижняя, «острая» часть сердца.' },
      { to: 1.00, name: 'Выведение вперёд', note: 'Кисти выстреливают вперёд по кратчайшему пути, почти касаясь друг друга, и тело снова становится узким.' },
    ],
    bg() {
      /* след кистей — «сердечко»; считается из той же позы */
      const o = { H, view: 'top', x: 266, y: 166 };
      let dR = '', dL = '';
      for (let i = 0; i <= 100; i++) {
        const r = PE.figure.solve(breastPose(i / 100),
          Object.assign({ where: 'breast-top / след кистей' }, o));
        dR += `${i === 0 ? 'M' : 'L'} ${M.num(r.pts.wristR.x)} ${M.num(r.pts.wristR.y)}`;
        dL += `${i === 0 ? 'M' : 'L'} ${M.num(r.pts.wristL.x)} ${M.num(r.pts.wristL.y)}`;
      }
      return S.waterTop(640, 330, { label: false })
        + line(0, 166, 640, 166, C.gray, 0.9, ' stroke-dasharray="6 6"')
        + path(dR, C.water, 1.3, 'none', ' stroke-dasharray="5 4"')
        + path(dL, C.water, 1.3, 'none', ' stroke-dasharray="5 4"')
        + text(8, 20, 'вид сверху: смотрим на пловца с бортика, сквозь воду', C.water)
        + text(180, 40, 'след кистей: «сердечко»', C.water)
        + S.moveArrow(516, 316, 'движение');
    },
    draw(u) {
      const o = {
        H, view: 'top', x: 266, y: 166, near: false, face: false,
        where: 'breast-top',
      };
      const r = PE.figure.solve(breastPose(u), o);
      return PE.figure.render(r, o) + S.headTop(r);
    },
    caption: 'Брасс сверху. Пунктир — путь кистей, посчитанный из той же позы, что и руки: они расходятся наружу, сводятся под грудью и выстреливают вперёд. Руки не заходят за линию плеч.',
  });

  /* ================= поворот и старт ================= */

  /* Позы поворота и старта заданы теми же углами, что и всё остальное; по
     доске двигается только точка таза (o.x, o.y). */
  function poseAt(keys, u) {
    const a = angAt(keys, u);
    return {
      pose: {
        tilt: a.tilt, headTilt: a.headTilt,
        both: joints(a),
      },
      x: a.x, y: a.y,
    };
  }

  const TURN_KEYS = [
    { u: 0.00, x: 250, y: 152, tilt: 0, headTilt: 8, shoulder: 176, shoulderPlane: 14, elbow: 6, hip: 0, knee: 6, ankle: 44 },
    { u: 0.20, x: 396, y: 152, tilt: 0, headTilt: 4, shoulder: 176, shoulderPlane: 14, elbow: 10, hip: 4, knee: 12, ankle: 40 },
    { u: 0.32, x: 424, y: 168, tilt: -40, headTilt: 30, shoulder: 86, shoulderPlane: 50, elbow: 76, hip: 96, knee: 118, ankle: 10 },
    { u: 0.46, x: 442, y: 182, tilt: -118, headTilt: 34, shoulder: 60, shoulderPlane: 70, elbow: 96, hip: 110, knee: 130, ankle: 0 },
    { u: 0.60, x: 446, y: 178, tilt: -176, headTilt: 20, shoulder: 120, shoulderPlane: 40, elbow: 54, hip: 88, knee: 112, ankle: 4 },
    /* отталкивание: ноги разгибаются быстро и целиком — это и есть толчок,
       а не медленное распрямление, при котором тело идёт «уголком» */
    { u: 0.68, x: 434, y: 174, tilt: -179, headTilt: 12, shoulder: 154, shoulderPlane: 20, elbow: 30, hip: 62, knee: 84, ankle: 8 },
    { u: 0.73, x: 418, y: 168, tilt: -180, headTilt: 8, shoulder: 172, shoulderPlane: 16, elbow: 12, hip: 6, knee: 12, ankle: 34 },
    { u: 0.86, x: 346, y: 160, tilt: -180, headTilt: 8, shoulder: 176, shoulderPlane: 14, elbow: 6, hip: 2, knee: 8, ankle: 44 },
    { u: 0.96, x: 234, y: 154, tilt: -180, headTilt: 8, shoulder: 176, shoulderPlane: 14, elbow: 6, hip: 0, knee: 6, ankle: 44 },
  ];

  PE.reg('turn-open', {
    w: 640, h: 350, frames: 60, period: 6000,
    phases: [
      { to: 0.20, name: 'Подплывание и касание', note: 'К стенке подходят на ходу, не сбавляя скорости, и касаются её рукой на уровне поверхности. Взгляд — на стенку, чтобы не промахнуться и не удариться.' },
      { to: 0.42, name: 'Группировка и разворот', note: 'Ноги подтягиваются под себя, тело сворачивается и разворачивается. Рука отталкивается от стенки и уходит назад, за голову.' },
      { to: 0.62, name: 'Постановка стоп', note: 'Стопы ставятся на стенку на глубине 30–40 см, руки соединяются впереди, голова между руками. Тело уже смотрит в обратную сторону.' },
      { to: 0.80, name: 'Отталкивание', note: 'Резкое разгибание ног. Толчок направлен вдоль дорожки и чуть вниз, чтобы уйти под воду на 30–50 см — там меньше волнового сопротивления.' },
      { to: 1.00, name: 'Скольжение и первый гребок', note: 'Скольжение в вытянутом положении, затем работа ногами и первый гребок. Всплывать нужно до того, как скорость упадёт ниже скорости плавания.' },
    ],
    bg() {
      let s = S.water(640, 350, 62);
      s += `<rect x="586" y="62" width="54" height="288" fill="rgba(21,94,117,.14)" stroke="${C.water}" stroke-width="1.6"/>`;
      s += text(468, 54, 'стенка бассейна', C.water);
      s += line(586, 128, 640, 128, C.water, 1.2, ' stroke-dasharray="4 4"');
      s += text(8, 342, 'глубина постановки стоп 30–40 см; толчок направлен вдоль дорожки', C.gray);
      return s;
    },
    draw(u) {
      const p = poseAt(TURN_KEYS, u);
      let s = S.drift(u, 62, 8, 100, 326, 0.5);
      /* Общий план: на доске показан ПУТЬ пловца от стенки и обратно —
         фигура едет по ней от края до края (см. plan в figure.js). */
      s += fig(p.pose, {
        x: p.x, y: p.y, waterline: 62, near: 'R', where: 'turn-open',
        H: H * 0.78, plan: 'wide',
      });
      if (u >= 0.62 && u < 0.80) {
        s += line(536, 210, 470, 206, C.green, 2.4, ' marker-end="url(#arrG)"');
        s += text(414, 228, 'толчок', C.green);
      }
      if (u < 0.20) {
        s += line(320, 88, 380, 88, C.water, 2, ' marker-end="url(#arrW)"');
        s += text(200, 84, 'подход к стенке', C.water);
      }
      if (u >= 0.86) {
        s += line(300, 88, 240, 88, C.green, 2, ' marker-end="url(#arrG)"');
        s += text(306, 84, 'уход от стенки', C.green);
      }
      return s;
    },
    caption: 'Простой (открытый) поворот — тот, с которого начинают все. Кувырок в кроле осваивают позже; на зачёте он не требуется.',
  });

  const DIVE_KEYS = [
    { u: 0.00, x: 136, y: 100, tilt: 44, headTilt: 26, shoulder: 26, shoulderPlane: 22, elbow: 24, hip: 74, knee: 94, ankle: -8 },
    { u: 0.22, x: 138, y: 102, tilt: 38, headTilt: 28, shoulder: 22, shoulderPlane: 20, elbow: 28, hip: 82, knee: 102, ankle: -12 },
    { u: 0.34, x: 168, y: 102, tilt: 16, headTilt: 12, shoulder: 140, shoulderPlane: 16, elbow: 16, hip: 16, knee: 34, ankle: 24 },
    { u: 0.48, x: 214, y: 102, tilt: 8, headTilt: 8, shoulder: 174, shoulderPlane: 14, elbow: 6, hip: 2, knee: 6, ankle: 46 },
    { u: 0.62, x: 240, y: 132, tilt: -26, headTilt: 8, shoulder: 176, shoulderPlane: 14, elbow: 5, hip: 0, knee: 4, ankle: 48 },
    { u: 0.74, x: 288, y: 178, tilt: -34, headTilt: 8, shoulder: 176, shoulderPlane: 14, elbow: 5, hip: 0, knee: 4, ankle: 48 },
    { u: 0.84, x: 340, y: 222, tilt: -12, headTilt: 8, shoulder: 176, shoulderPlane: 14, elbow: 6, hip: 0, knee: 6, ankle: 46 },
    { u: 0.94, x: 396, y: 230, tilt: -2, headTilt: 8, shoulder: 176, shoulderPlane: 14, elbow: 6, hip: 0, knee: 8, ankle: 44 },
  ];

  PE.reg('start-dive', {
    w: 640, h: 360, frames: 60, period: 6000,
    phases: [
      { to: 0.22, name: 'Исходное положение', note: 'Стопы у края бортика, пальцы захватывают край, колени согнуты, корпус наклонён, взгляд вниз-вперёд. Руки внизу или на бортике.' },
      { to: 0.38, name: 'Отталкивание', note: 'Ноги разгибаются, тело вытягивается вперёд-вверх, руки выносятся вперёд и соединяются над головой. Голова между руками.' },
      { to: 0.58, name: 'Полёт', note: 'Тело вытянуто в линию, кисти сложены, голова прижата. В полёте уже ничего не исправить: всё решает исходное положение и толчок.' },
      { to: 0.74, name: 'Вход в воду', note: 'Тело входит «в одну точку»: сначала кисти, затем голова, плечи, таз и стопы проходят через одно место. Угол входа около 30–40°.' },
      { to: 1.00, name: 'Скольжение и выход', note: 'Скольжение под водой в вытянутом положении, затем работа ногами и первый гребок. Всплывать нужно плавно, не задирая голову.' },
    ],
    bg() {
      let s = S.water(640, 360, 174, { labelX: 452 });
      s += '<rect x="0" y="174" width="150" height="186" fill="rgba(21,94,117,.14)"'
        + ` stroke="${C.water}" stroke-width="1.6"/>`;
      s += `<rect x="0" y="150" width="164" height="24" fill="#dfe7ec" stroke="${C.ink}" stroke-width="1.4"/>`;
      s += text(104, 168, 'бортик', C.ink);
      /* створ входа стоит там, где кисть действительно пересекает воду */
      s += line(428, 176, 428, 330, C.gray, 0.9, ' stroke-dasharray="4 6"');
      s += text(300, 344, 'вход в воду «в одну точку»', C.gray);
      s += text(8, 354, 'угол входа около 30–40°; голова между руками, кисти сложены', C.gray);
      return s;
    },
    draw(u) {
      const p = poseAt(DIVE_KEYS, u);
      let s = '';
      if (u >= 0.74) s += S.drift(u, 174, 8, 280, 344, 0.6);
      /* Общий план: тумбочка, полёт и вход в воду — это путь через всю
         доску, фигура на ней перемещается (см. plan в figure.js). */
      s += fig(p.pose, {
        x: p.x, y: p.y, waterline: 174, near: 'R', where: 'start-dive',
        H: H * 0.82, plan: 'wide',
      });
      if (u >= 0.22 && u < 0.38) {
        s += line(180, 300, 240, 276, C.green, 2.4, ' marker-end="url(#arrG)"');
        s += text(180, 320, 'толчок вперёд, а не вверх', C.green);
      }
      if (u >= 0.58 && u < 0.80) {
        s += line(444, 142, 390, 180, C.red, 2, ' marker-end="url(#arrR)"');
        s += text(450, 138, 'кисти входят первыми', C.red);
      }
      return s;
    },
    caption: 'Стартовый прыжок с бортика. Начинающим его разучивают только после того, как освоены вход в воду с бортика ногами, скольжение и уверенное дыхание.',
  });
})(window);
