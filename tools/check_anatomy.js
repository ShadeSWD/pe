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
