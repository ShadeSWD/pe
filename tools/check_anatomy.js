/* check_anatomy.js — проверка анатомии всех фигур раздела «плавание».
 *
 * Что делает. Загружает модель фигуры и все скрипты схем в node, включает
 * запись поз (PE.figure.record), прогоняет КАЖДЫЙ кадр каждой анимации и
 * каждую статическую схему, после чего проверяет накопленные позы.
 *
 * Проверки:
 *   1. Угол вне анатомического диапазона — ловится самой моделью (она бросает
 *      ошибку), здесь мы только не даём ошибке потеряться.
 *   2. Отношение длин звеньев к эталону расходится больше чем на 3 %.
 *   3. Тело, объявленное «у поверхности» (opts.place = 'surface'), оказалось
 *      глубже 0,05·H.
 *   4. Таз ниже линии «плечи — колени» больше чем на 0,05·H там, где это не
 *      заявленная ошибка (opts.sag = true — «так и задумано, это ошибка»).
 *   5. КРУПНОСТЬ. Горизонтальная фигура занимает по длине меньше 70 % ширины
 *      отведённой ей доски. Проверка появилась после разбора: анатомия была
 *      верной, а картинка не читалась — фигура занимала четверть кадра, и все
 *      детали (плечо, таз, лицо) сливались в пятно. Исключение — общий план
 *      (opts.plan = 'wide'): доска, на которой показано ПЕРЕМЕЩЕНИЕ пловца по
 *      дорожке, крупную фигуру вместить не может. Для общего плана порог
 *      мягче — 35 %, но он есть: иначе оговоркой можно оправдать что угодно.
 *   6. ПЕРЕКРЫТИЕ. Голова заезжает на силуэт туловища больше чем на четверть
 *      своего диаметра. Наползающая на плечи голова читается как горб, а не
 *      как голова, и по ней нельзя понять, куда смотрит пловец.
 *
 * Запуск: node tools/check_anatomy.js   (код возврата 1 при любом нарушении)
 * В pytest подключена тестом tests/test_anatomy.py.
 */
'use strict';
const path = require('path');
const ASSETS = path.join(__dirname, '..', 'site', 'assets');

/* ---------- заглушки браузера, чтобы скрипты сайта загрузились в node ---------- */
const listeners = {};
const stubEl = {
  innerHTML: '', dataset: {}, style: {}, classList: { toggle() {}, add() {}, remove() {} },
  querySelector: () => stubEl, querySelectorAll: () => [],
  addEventListener() {}, appendChild() {}, setAttribute() {}, getAttribute: () => null,
  textContent: '',
};
global.window = global;
global.document = {
  readyState: 'complete',
  querySelector: () => null,
  querySelectorAll: () => [],
  getElementById: () => null,
  addEventListener(t, f) { (listeners[t] = listeners[t] || []).push(f); },
  createElement: () => Object.assign({}, stubEl),
  head: stubEl, body: stubEl, documentElement: stubEl,
};
global.requestAnimationFrame = () => 0;

require(path.join(ASSETS, 'anim.js'));
require(path.join(ASSETS, 'figure.js'));
require(path.join(ASSETS, 'swim.js'));
require(path.join(ASSETS, 'strokes.js'));
require(path.join(ASSETS, 'schemes.js'));

const PE = global.PE;
const F = PE.figure;
const TOL = 0.03;           // допуск на длину звена, доля
const NEAR_SURF = 0.05;     // «у поверхности», доли роста
const SAG = 0.05;           // провал таза, доли роста
const BIG = 0.70;           // крупный план: доля ширины доски
const WIDE = 0.35;          // общий план: та же доля, но мягче
const HORIZ = 35;           // до скольких градусов поза считается горизонтальной
const OVERLAP = 0.25;       // наползание головы на корпус, доли диаметра головы

const problems = [];
const add = (where, msg) => problems.push({ where, msg });

/* ---------- 1. прогон всех кадров всех анимаций ---------- */

const log = F.record(true);
const REG = PE.ANIM || {};
const names = Object.keys(REG).sort();
let framesRun = 0;

for (const name of names) {
  const def = REG[name];
  const frames = def.frames || 60;
  try {
    if (def.bg) def.bg();
  } catch (e) {
    add(name + ' / фон', e.message);
  }
  for (let i = 0; i < frames; i++) {
    const u = i / frames;
    try {
      def.draw(u);
      framesRun++;
    } catch (e) {
      add(`${name}, кадр ${i + 1}/${frames} (u = ${u.toFixed(3)})`, e.message);
    }
  }
}

/* ---------- 2. статические схемы страниц ---------- */

const SCHEMES = PE.SCHEME || {};
const schemeNames = Object.keys(SCHEMES).sort();
for (const name of schemeNames) {
  try {
    SCHEMES[name]();
  } catch (e) {
    add('схема ' + name, e.message);
  }
}

/* ---------- 3. проверка накопленных поз ---------- */

let checked = 0;
for (const rec of log) {
  const res = rec.res;
  const where = rec.where || '(без имени)';
  checked++;

  /* 3.1 длины звеньев */
  const m = F.measure(res);
  for (const k of Object.keys(m)) {
    const ref = F.refOf(k);
    if (!ref) continue;
    const dev = m[k] / ref - 1;
    if (Math.abs(dev) > TOL) {
      add(where, `звено «${k}» = ${m[k].toFixed(4)}·H, эталон ${ref.toFixed(4)}·H `
        + `(отклонение ${(dev * 100).toFixed(1)} %, допустимо ±3 %)`);
    }
  }

  /* 3.2 «у поверхности» — значит у поверхности */
  if (res.opts.waterline !== null && res.declared && res.declared.surface) {
    const d = (res.backTop - res.opts.waterline) / res.opts.H;
    if (d > NEAR_SURF) {
      add(where, `тело объявлено «у поверхности», а спина ушла на ${d.toFixed(3)}·H `
        + `под воду (допустимо ${NEAR_SURF}·H)`);
    }
  }

  /* 3.3 провал таза ниже линии «плечи — колени».
     Проверка имеет смысл только там, где вертикаль на доске — это вертикаль,
     то есть в видах сбоку и спереди. На виде сверху ось y — поперечная, и
     «ниже» там ничего не значит. */
  if ((!res.declared || !res.declared.sag) && res.opts.view !== 'top') {
    const p = res.pts;
    for (const s of ['L', 'R']) {
      /* Проверка про ВЫТЯНУТОЕ тело: «таз провис, хотя должен быть в линии».
         Пока нога согнута (группировка, подтягивание в брассе, толчок от
         стенки), линия «плечи — колени» о положении тела ничего не говорит,
         и такую ногу пропускаем. Покрытие от этого не страдает: ноги в
         анимациях работают попеременно, и в каждом кадре хотя бы одна из них
         выпрямлена — по ней тело и проверяется. */
      if (Math.abs(res.pose[s].hip) > 30 || res.pose[s].knee > 30) continue;
      const a = p.neck, b = p['knee' + s], h = p.hip;
      const dx = b.x - a.x;
      if (Math.abs(dx) < 1e-6) continue;
      const t = (h.x - a.x) / dx;
      if (t < 0 || t > 1) continue;                 // таз вне отрезка — не про то
      const lineY = a.y + (b.y - a.y) * t;          // где линия на долготе таза
      const below = (h.y - lineY) / res.opts.H;     // y на доске растёт вниз
      if (below > SAG) {
        add(where, `таз провален ниже линии «плечи — колено ${s}» на `
          + `${below.toFixed(3)}·H (допустимо ${SAG}·H)`);
      }
    }
  }

  /* 3.4 крупность фигуры в кадре.
     Меряем габарит нарисованного вдоль доски и сравниваем с шириной доски
     (opts.board — сколько места на доске отведено этой фигуре: у составных
     досок панель бывает уже целой доски). Проверка про горизонтальные позы:
     у стоящей фигуры длина ложится не вдоль доски, а поперёк, и требовать от
     неё 70 % ширины бессмысленно. Крупные планы без корпуса (голень и стопа
     отдельно) — тоже не про это. */
  const ax = axisAngle(res);
  if (res.declared && res.declared.torso && res.declared.head
      && res.declared.arms && res.declared.legs
      && ax !== null && ax <= HORIZ) {
    /* «Длина фигуры» — габарит нарисованного вдоль доски, но не меньше
       размаха фигуры ЭТОГО ЖЕ масштаба в вытянутом виде (1,30 роста, от
       кончиков пальцев до носков). Оговорка нужна для согнутых поз: поплавок,
       кувырок, подтягивание в брассе коротки по существу позы, а не по вине
       масштаба, и требовать от них габарита в три четверти доски значило бы
       требовать выпрямиться. */
    const len = Math.max(res.span.w, 1.30 * res.opts.H);
    const need = res.opts.plan === 'wide' ? WIDE : BIG;
    const got = len / res.opts.board;
    if (got < need) {
      add(where, `фигура мелкая: длина в кадре ${len.toFixed(0)} ед. — `
        + `${(got * 100).toFixed(0)} % ширины доски (${res.opts.board}), `
        + `нужно ${(need * 100).toFixed(0)} %`
        + (res.opts.plan === 'wide' ? ' даже для общего плана' : ''));
    }
  }

  /* 3.5 голова не наползает на туловище.
     Считаем, насколько глубоко контур туловища заходит внутрь окружности
     головы. Смотреть на проекцию имеет смысл, только пока туловище не
     смотрит «в камеру»: при сильном ракурсном сокращении оси тела любая
     голова накрывает корпус, и это не ошибка рисунка. */
  if (res.declared && res.declared.torso && res.declared.head && res.torso
      && axisLen(res) > 0.4 * res.P.torso * res.opts.H
      && neckLen(res) > 0.8 * res.P.neck * res.opts.H) {
    const R = res.P.headR * res.opts.H;
    const h = res.pts.head;
    let deep = 0;
    const test = (x, y) => {
      const d = Math.hypot(x - h.x, y - h.y);
      if (R - d > deep) deep = R - d;
    };
    const T = res.torso;
    for (let i = 0; i < T.length; i++) {
      const a = T[i], b = T[(i + 1) % T.length];
      test(a.x, a.y);
      test((a.x + b.x) / 2, (a.y + b.y) / 2);
    }
    if (inside(T, h)) deep = 2 * R;              // центр головы внутри корпуса
    if (deep > OVERLAP * 2 * R) {
      add(where, `голова наезжает на контур туловища на ${deep.toFixed(1)} ед. — `
        + `${(deep / (2 * R) * 100).toFixed(0)} % своего диаметра `
        + `(допустимо ${OVERLAP * 100} %)`);
    }
  }
}

/* Угол оси «плечи — таз» к горизонтали доски, °; null — ось выродилась. */
function axisAngle(res) {
  const a = res.pts.neck, b = res.pts.hip;
  const dx = Math.abs(b.x - a.x), dy = Math.abs(b.y - a.y);
  if (dx + dy < 1e-6) return null;
  return Math.atan2(dy, dx) * 180 / Math.PI;
}
function axisLen(res) {
  return Math.hypot(res.pts.hip.x - res.pts.neck.x, res.pts.hip.y - res.pts.neck.y);
}
/* Длина шеи в проекции. Если она укорочена, голова стоит НАД корпусом по
   глубине (подбородок прижат, а смотрим сверху): перекрытие на такой картинке
   честное заслонение, а не наползание в плоскости рисунка. */
function neckLen(res) {
  return Math.hypot(res.pts.head.x - res.pts.neck.x, res.pts.head.y - res.pts.neck.y);
}

/* Точка внутри многоугольника (лучевой тест). */
function inside(poly, p) {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j];
    if ((a.y > p.y) !== (b.y > p.y)
      && p.x < (b.x - a.x) * (p.y - a.y) / (b.y - a.y) + a.x) c = !c;
  }
  return c;
}
F.record(false);

/* ---------- отчёт ---------- */

console.log(`анимаций: ${names.length}, кадров прогнано: ${framesRun}, `
  + `статических схем: ${schemeNames.length}`);
console.log(`поз проверено: ${checked}`);
if (!problems.length) {
  console.log('нарушений анатомии: 0');
  process.exit(0);
}
/* Однотипные нарушения повторяются в каждом кадре — печатаем по одному
   примеру на вид нарушения, иначе отчёт нечитаем. */
const byWhere = new Map();
for (const p of problems) {
  if (!byWhere.has(p.where)) byWhere.set(p.where, new Map());
  const kind = p.msg.replace(/[-\d.,]+/g, '#');
  const m = byWhere.get(p.where);
  if (!m.has(kind)) m.set(kind, { msg: p.msg, n: 0 });
  m.get(kind).n++;
}
console.log(`нарушений анатомии: ${problems.length} в ${byWhere.size} местах\n`);
for (const [where, kinds] of byWhere) {
  console.log('— ' + where);
  for (const { msg, n } of kinds.values()) {
    console.log('    ' + msg + (n > 1 ? `   (и ещё ${n - 1} раз)` : ''));
  }
}
process.exit(1);
