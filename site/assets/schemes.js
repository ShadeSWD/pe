/* Статические схемы раздела «плавание», построенные той же моделью фигуры,
 * что и анимации (assets/figure.js).
 *
 * На странице от схемы остаётся только обвязка — линия воды, размерные
 * стрелки, подписи — и пустой <g data-figure-scheme="имя">. Сама фигура
 * приходит отсюда, из позы, записанной углами в суставах. Раньше эти схемы
 * были списками координат в HTML, и пропорции на них не совпадали ни между
 * собой, ни с анимациями; теперь совпадать они обязаны по построению, а
 * tools/check_anatomy.js прогоняет их вместе с кадрами анимаций.
 */
'use strict';
(function (global) {
  const PE = global.PE;
  const F = PE.figure;
  const C = F.C;

  /* Умолчания: рост фигуры задаётся каждой схемой отдельно — схемы разного
     масштаба, но пропорции внутри фигуры одни и те же всегда. */
  const fig = (pose, opts) => F(pose, Object.assign({ view: 'side', near: 'R' }, opts));

  /* Руки, вытянутые вперёд — то же положение, что в анимациях. */
  const ARMS_FRONT = { shoulder: 176, shoulderPlane: 14, elbow: 6, elbowDir: 180 };

  /* ---------- 3.2 «Положение тела»: линия против поднятой головы ---------- */

  /* Рост фигуры на статических схемах — тот же, что в анимациях раздела.
     Пловец на соседних картинках должен быть одного размера и одной
     крупности: три четверти ширины доски. Пока здесь стояло 200, фигура
     занимала треть кадра, и от неё оставалось пятно. */
  const HS = 360;

  /* Правильное положение: тело вытянуто, спина и затылок на линии воды. */
  PE.scheme('glide-line', () => fig({
    headTilt: 8,
    both: Object.assign({}, ARMS_FRONT, { hip: 0, knee: 2, ankle: 44 }),
  }, {
    H: HS, x: 226, y: 86, waterline: 64, place: 'surface',
    color: C.ink, where: 'схема 3.2 / тело в одну линию',
  }));

  /* Ошибка ровно в одной детали: голова поднята. Всё остальное — следствие,
     и оно тоже описано углами: таз и ноги уходят вниз.
     Привязка идёт за ГОЛОВУ, а не за таз: на этой схеме важно ровно одно —
     что лицо и подбородок оказались выше линии воды, и держать надо именно
     это расстояние, а не положение таза, которое как раз плавает. */
  PE.scheme('glide-headup', () => fig({
    tilt: 3, headTilt: -40,
    both: Object.assign({}, ARMS_FRONT, {
      shoulder: 170, shoulderPlane: 10, hip: 22, knee: 26, ankle: 16,
    }),
  }, {
    H: HS, anchor: 'head', x: 330, y: 222, color: C.red, farColor: '#dda9a3',
    waterline: 268, sag: true, where: 'схема 3.2 / голова поднята',
  }));

  /* ---------- 4.2 «Положение стопы»: крупный план голени и стопы ---------- */

  /* Одна и та же нога в одной и той же фазе удара кролем (бедро пошло вниз,
     колено согнуто на 36°); отличается ровно один угол — голеностоп.
     Рисуется крупным планом только голень и стопа: корпус, голова и руки
     выключены, звено «таз — колено» отброшено. Пловец движется влево. */
  const footLeg = (ankle, x, color) => fig({
    R: { hip: 8, knee: 36, ankle },
  }, {
    H: 360, anchor: 'kneeR', x, y: 132, near: 'R', far: false, facing: -1,
    arms: false, torso: false, head: false, legFrom: 'knee',
    color, where: 'схема 4.2 / стопа ' + (ankle > 0 ? 'оттянута' : '«на себя»'),
  });

  PE.scheme('foot-pointed', () => footLeg(46, 120, C.ink));
  PE.scheme('foot-flexed', () => footLeg(-18, 440, C.ink));

  /* ---------- 1.1 Чаша бассейна: человек стоит на мелкой части ---------- */

  PE.scheme('pool-standing', () => fig({
    tilt: 90, headTilt: 4,
    both: { shoulder: 16, shoulderPlane: 12, elbow: 26, hip: 0, knee: 3, ankle: 0 },
  }, {
    H: 180, anchor: 'toeR', x: 214, y: 245, near: 'R',
    waterline: 110, where: 'схема 1.1 / стоя на мелкой части',
  }));

  /* ---------- 8.2 Положение тела на спине ---------- */

  /* На спине — та же модель, перевёрнутая: roll = 180. */
  PE.scheme('back-good', () => fig({
    roll: 180, headTilt: 14,
    /* руки вдоль тела: подъём мал, и почти весь он уходит в сторону
       (плоскость 40°), поэтому сбоку рука лежит по телу, а не задрана */
    both: { shoulder: 12, shoulderPlane: 40, elbow: 8, hip: 0, knee: 2, ankle: 44 },
  }, {
    H: HS, x: 300, y: 96, waterline: 74, place: 'surface',
    color: C.green, farColor: '#9ec6ab', where: 'схема 8.2 / тело у поверхности',
  }));

  /* «Сидячее» положение: подбородок прижат к груди и таз ушёл вниз. */
  PE.scheme('back-bad', () => fig({
    roll: 180, tilt: 4, headTilt: 40,
    both: { shoulder: 12, shoulderPlane: 40, elbow: 8, hip: 48, knee: 72, ankle: 18 },
  }, {
    H: HS, x: 320, y: 300, waterline: 258, sag: true,
    color: C.red, farColor: '#dda9a3', where: 'схема 8.2 / «сидячее» положение',
  }));

  /* ---------- 9.5 Симметрия толчка в брассе, вид сверху ---------- */

  /* Симметричный толчок: обе ноги в одной фазе. Пловец движется вверх по
     рисунку, поэтому вид сверху повёрнут: facing = 1 и поворот группы. */
  /* board — сколько места на доске отведено фигуре ВДОЛЬ ЕЁ ДЛИНЫ. Здесь
     фигура повёрнута на 90° (пловец плывёт вверх по рисунку), поэтому её
     длина ложится на высоту доски, а не на ширину. */
  const kickTop = (L, R, color, where) => F({
    headTilt: 8,
    L: Object.assign({}, ARMS_FRONT, L),
    R: Object.assign({}, ARMS_FRONT, R),
  }, {
    H: 176, view: 'top', x: 0, y: 0, near: false, arms: false,
    board: 210, color, where,
  });

  const SYM = { hip: 42, knee: 124, ankle: -18, hipAbd: 26 };
  const ASYM = { hip: 10, knee: 24, ankle: 42, hipAbd: 5 };

  PE.scheme('breast-symmetric', () => '<g transform="translate(150 104) rotate(-90)">'
    + kickTop(SYM, SYM, C.green, 'схема 9.5 / симметричный толчок') + '</g>');

  PE.scheme('breast-scissors', () => '<g transform="translate(460 104) rotate(-90)">'
    + kickTop(SYM, ASYM, C.red, 'схема 9.5 / «ножницы»') + '</g>');

  /* ---------- монтаж ---------- */

  const ready = (fn) => (document.readyState === 'loading'
    ? document.addEventListener('DOMContentLoaded', fn) : fn());
  ready(() => PE.mountSchemes());
})(window);
