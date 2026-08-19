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

  /* Правильное положение: тело вытянуто, спина и затылок на линии воды. */
  PE.scheme('glide-line', () => fig({
    headTilt: 8,
    both: Object.assign({}, ARMS_FRONT, { hip: 0, knee: 2, ankle: 44 }),
  }, {
    H: 200, x: 268, y: 74, waterline: 64, place: 'surface',
    color: C.ink, where: 'схема 3.2 / тело в одну линию',
  }));

  /* Ошибка ровно в одной детали: голова поднята. Всё остальное — следствие,
     и оно тоже описано углами: таз и ноги уходят вниз. */
  PE.scheme('glide-headup', () => fig({
    tilt: 3, headTilt: -40,
    both: Object.assign({}, ARMS_FRONT, {
      shoulder: 170, shoulderPlane: 10, hip: 22, knee: 26, ankle: 16,
    }),
  }, {
    H: 200, x: 268, y: 190, color: C.red, farColor: '#dda9a3',
    waterline: 180, sag: true, where: 'схема 3.2 / голова поднята',
  }));

  /* ---------- 4.2 «Положение стопы»: крупный план голени и стопы ---------- */

  /* Одна и та же нога в одной и той же фазе удара кролем (бедро пошло вниз,
     колено согнуто на 36°); отличается ровно один угол — голеностоп.
     Рисуется крупным планом только голень и стопа: корпус, голова и руки
     выключены, звено «таз — колено» отброшено. Пловец движется влево. */
  const footLeg = (ankle, x, color) => fig({
    R: { hip: 8, knee: 36, ankle },
  }, {
    H: 340, anchor: 'kneeR', x, y: 122, near: 'R', far: false, facing: -1,
    arms: false, torso: false, head: false, legFrom: 'knee',
    color, lw: 9, where: 'схема 4.2 / стопа ' + (ankle > 0 ? 'оттянута' : '«на себя»'),
  });

  PE.scheme('foot-pointed', () => footLeg(46, 120, C.ink));
  PE.scheme('foot-flexed', () => footLeg(-18, 440, C.ink));

  /* ---------- 1.1 Чаша бассейна: человек стоит на мелкой части ---------- */

  PE.scheme('pool-standing', () => fig({
    tilt: 90, headTilt: 4,
    both: { shoulder: 16, shoulderPlane: 12, elbow: 26, hip: 0, knee: 3, ankle: 0 },
  }, {
    H: 168, anchor: 'toeR', x: 210, y: 210, near: 'R',
    waterline: 110, where: 'схема 1.1 / стоя на мелкой части',
  }));

  /* ---------- 8.2 Положение тела на спине ---------- */

  /* На спине — та же модель, перевёрнутая: roll = 180. */
  PE.scheme('back-good', () => fig({
    roll: 180, headTilt: 14,
    both: { shoulder: 24, shoulderPlane: 4, elbow: 10, hip: 0, knee: 2, ankle: 44 },
  }, {
    H: 240, x: 330, y: 80, waterline: 62, place: 'surface',
    color: C.green, farColor: '#9ec6ab', where: 'схема 8.2 / тело у поверхности',
  }));

  /* «Сидячее» положение: подбородок прижат к груди и таз ушёл вниз. */
  PE.scheme('back-bad', () => fig({
    roll: 180, tilt: 4, headTilt: 40,
    both: { shoulder: 24, shoulderPlane: 4, elbow: 10, hip: 48, knee: 72, ankle: 18 },
  }, {
    H: 240, x: 330, y: 200, waterline: 166, sag: true,
    color: C.red, farColor: '#dda9a3', where: 'схема 8.2 / «сидячее» положение',
  }));

  /* ---------- 9.5 Симметрия толчка в брассе, вид сверху ---------- */

  /* Симметричный толчок: обе ноги в одной фазе. Пловец движется вверх по
     рисунку, поэтому вид сверху повёрнут: facing = 1 и поворот группы. */
  const kickTop = (L, R, color, where) => F({
    headTilt: 8,
    L: Object.assign({}, ARMS_FRONT, L),
    R: Object.assign({}, ARMS_FRONT, R),
  }, {
    H: 150, view: 'top', x: 0, y: 0, near: false, arms: false,
    color, where,
  });

  const SYM = { hip: 42, knee: 124, ankle: -18, hipAbd: 26 };
  const ASYM = { hip: 10, knee: 24, ankle: 42, hipAbd: 5 };

  PE.scheme('breast-symmetric', () => '<g transform="translate(150 92) rotate(-90)">'
    + kickTop(SYM, SYM, C.green, 'схема 9.5 / симметричный толчок') + '</g>');

  PE.scheme('breast-scissors', () => '<g transform="translate(460 92) rotate(-90)">'
    + kickTop(SYM, ASYM, C.red, 'схема 9.5 / «ножницы»') + '</g>');

  /* ---------- монтаж ---------- */

  const ready = (fn) => (document.readyState === 'loading'
    ? document.addEventListener('DOMContentLoaded', fn) : fn());
  ready(() => PE.mountSchemes());
})(window);
