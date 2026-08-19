/* Данные каркаса страниц. Машинерия — assets/shell.js. */
'use strict';
(function () {
  const me = document.currentScript;
  const root = (me && me.dataset.root) || './';
  buildSiteShell({
    root,
    page: (me && me.dataset.page) || '',
    brand: 'Физическая культура и спорт',
    logo: `
  <svg width="30" height="30" viewBox="0 0 30 30" aria-hidden="true">
    <rect x="1" y="1" width="28" height="28" rx="6" fill="#155e75"/>
    <text x="15" y="22" text-anchor="middle" font-size="17">🏊</text>
  </svg>`,
    nav: [
      { h: '', k: 'index', t: 'Обзор' },
      { t: 'Теория', h: 'theory', drop: [
        { h: 'theory', k: 'theory', t: 'Оглавление курса' },
        { h: 't1', k: 't1', t: '1. Физическая культура в вузе' },
        { h: 't2', k: 't2', t: '2. Организм и адаптация' },
        { h: 't3', k: 't3', t: '3. Работоспособность и здоровье' },
        { h: 't4', k: 't4', t: '4. Образ жизни' },
        { h: 't5', k: 't5', t: '5. Принципы, средства, методы' },
        { h: 't6', k: 't6', t: '6. Нагрузка и занятие' },
        { h: 't7', k: 't7', t: '7. Самостоятельные занятия' },
        { h: 't8', k: 't8', t: '8. Избранный вид спорта' },
        { h: 't9', k: 't9', t: '9. ППФП' },
        { h: 't10', k: 't10', t: '10. Производственная ФК' },
      ] },
      { t: 'Плавание', h: 'swim', drop: [
        { h: 'swim', k: 'swim', t: 'Как устроен раздел' },
        { h: 's-water', k: 's-water', t: '1. Освоение с водой' },
        { h: 's-breath', k: 's-breath', t: '2. Дыхание и выдох в воду' },
        { h: 's-glide', k: 's-glide', t: '3. Всплывание и скольжение' },
        { h: 's-legs', k: 's-legs', t: '4. Работа ног' },
        { h: 's-arms', k: 's-arms', t: '5. Работа рук' },
        { h: 's-first25', k: 's-first25', t: '6. Первые 25 метров' },
        { h: 's-crawl', k: 's-crawl', t: '7. Кроль на груди' },
        { h: 's-back', k: 's-back', t: '8. Кроль на спине' },
        { h: 's-breast', k: 's-breast', t: '9. Брасс' },
        { h: 's-turns', k: 's-turns', t: '10. Старт, поворот, ныряние' },
        { h: 's-safety', k: 's-safety', t: '11. Безопасность на воде' },
        { h: 's-gear', k: 's-gear', t: '12. Гигиена и снаряжение' },
      ] },
      { t: 'Практикум', h: 'tasks', drop: [
        { h: 'tasks', k: 'tasks', t: 'Задания по технике' },
        { h: 'test', k: 'test', t: 'Тест по курсу лекций' },
        { h: 'calc', k: 'calc', t: 'Расчёты и оценки' },
        { h: 'diary', k: 'diary', t: 'Дневник самоконтроля' },
        { h: 'anketa', k: 'anketa', t: 'Анкета кафедры' },
      ] },
      { h: 'sources', k: 'sources', t: 'Источники' },
    ],
    footer: `<div>Учебный сайт по дисциплине «Физическая культура и спорт» ·
      курс теории по лекциям кафедры физического воспитания СПбГМТУ и раздел
      обучения плаванию с нуля</div>`,
    markers: `<marker id="arrE" markerWidth="10" markerHeight="8" refX="9" refY="4" orient="auto">
      <path d="M0,0 L10,4 L0,8 z" fill="#16161a"/></marker>
    <marker id="arrS" markerWidth="10" markerHeight="8" refX="1" refY="4" orient="auto">
      <path d="M10,0 L0,4 L10,8 z" fill="#16161a"/></marker>
    <marker id="arrW" markerWidth="9" markerHeight="7" refX="8" refY="3.5" orient="auto">
      <path d="M0,0 L9,3.5 L0,7 z" fill="#155e75"/></marker>
    <marker id="arrR" markerWidth="9" markerHeight="7" refX="8" refY="3.5" orient="auto">
      <path d="M0,0 L9,3.5 L0,7 z" fill="#b3382e"/></marker>
    <marker id="arrG" markerWidth="9" markerHeight="7" refX="8" refY="3.5" orient="auto">
      <path d="M0,0 L9,3.5 L0,7 z" fill="#1a7f37"/></marker>`,
    favicon: '🏊',
  });
})();
