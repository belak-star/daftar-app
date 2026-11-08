// src/features/grades.js
// Gère les notes et les moyennes.

import { db, save } from '../core/state.js';
import { $, el } from '../core/dom.js';
import { collator } from '../core/format.js';
import { exportExcel } from '../core/excel.js';

const POIDS = { tp: 1, dc: 1, ds: 2 };
const NOTES_MAX = 20;

function fmt(n) {
  if (n === null || n === undefined) return '';
  return n.toFixed(2);
}

function parseNote(value) {
  if (value === '' || value === null || value === undefined) return null;
  const raw = String(value).trim().replace(',', '.');
  if (!/^\d+(\.\d+)?$/.test(raw)) return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0 || n > NOTES_MAX) return null;
  return n;
}

function getNote(student, term, type) {
  return (student.g && student.g[term] && student.g[term][type]) ?? null;
}

function computeAverage(student, term) {
  const tp = parseNote(getNote(student, term, 'tp'));
  const dc = parseNote(getNote(student, term, 'dc'));
  const ds = parseNote(getNote(student, term, 'ds'));
  if (tp === null && dc === null && ds === null) return null;
  const t = tp ?? 0;
  const d = dc ?? 0;
  const s = ds ?? 0;
  return (t * POIDS.tp + d * POIDS.dc + s * POIDS.ds) / (POIDS.tp + POIDS.dc + POIDS.ds);
}

/** Calcule la moyenne annuelle d'un élève. */
function computeAnnualAverage(student) {
  const m1 = computeAverage(student, '1');
  const m2 = computeAverage(student, '2');
  const m3 = computeAverage(student, '3');
  
  if (m1 === null || m2 === null || m3 === null) return null;
  
  return (m1 + 2 * m2 + 2 * m3) / 5;
}

function setNote(studentId, term, type, value) {
  const s = db.students.find(x => x.id === studentId);
  if (!s) return;
  const note = parseNote(value);
  if (!s.g) s.g = {};
  if (!s.g[term]) s.g[term] = {};
  if (note === null) {
    delete s.g[term][type];
  } else {
    s.g[term][type] = note;
  }
  save();
}

export function renderGradesClassSelect() {
  const sel = $('gClass');
  if (!sel) return;
  const ancienne = sel.value;
  sel.replaceChildren();
  sel.append(el('option', { value: '', textContent: '— اختر —' }));
  db.classes.slice().sort((a, b) => collator.compare(a, b)).forEach(c => {
    const opt = el('option', { value: c, textContent: c });
    if (c === ancienne) opt.selected = true;
    sel.append(opt);
  });
}

function renderGradesStats(students, term, isAnnual) {
  const box = $('gStats');
  if (!box) return;
  box.replaceChildren();

  const averages = students.map(s => {
    if (isAnnual) return computeAnnualAverage(s);
    return computeAverage(s, term);
  }).filter(v => v !== null);

  if (averages.length === 0) {
    box.append(el('div', { class: 'stat s-all' },
      el('span', { textContent: 'لا توجد معدلات بعد' }),
      el('b', { textContent: '—' }),
    ));
    return;
  }

  const sum = averages.reduce((a, b) => a + b, 0);
  const moy = sum / averages.length;
  const max = Math.max(...averages);
  const min = Math.min(...averages);
  const reussite = averages.filter(v => v >= 10).length;
  const pct = Math.round((reussite / averages.length) * 100);

  const cards = [
    ['s-present', 'معدل القسم', fmt(moy)],
    ['s-excused', 'أعلى معدل', fmt(max)],
    ['s-unexcused', 'أدنى معدل', fmt(min)],
    ['s-late', 'نسبة النجاح', pct + '%'],
    ['s-all', 'عدد المعدلات', averages.length + ' / ' + students.length],
  ];

  cards.forEach(([cls, label, value]) => {
    box.append(el('div', { class: 'stat ' + cls },
      el('span', { textContent: label }),
      el('b', { textContent: value }),
    ));
  });
}

export function renderGradesList() {
  const conteneur = $('gList');
  if (!conteneur) return;
  conteneur.replaceChildren();

  const classe = $('gClass').value;
  const term = $('gTerm').value;
  const isAnnual = term === 'A';

  if (!classe) {
    conteneur.append(el('div', { class: 'empty-list', textContent: 'اختر فصلاً لعرض التلاميذ.' }));
    const box = $('gStats');
    if (box) box.replaceChildren();
    return;
  }

  const students = db.students
    .filter(s => s.class === classe)
    .sort((a, b) => collator.compare(a.name, b.name));

  if (students.length === 0) {
    conteneur.append(el('div', { class: 'empty-list', textContent: 'لا يوجد تلاميذ في هذا الفصل.' }));
    const box = $('gStats');
    if (box) box.replaceChildren();
    return;
  }

  // Calcul des moyennes
  const averages = students.map(s => {
    if (isAnnual) return computeAnnualAverage(s);
    return computeAverage(s, term);
  });

  const sorted = averages
    .map((v, i) => ({ i, v }))
    .filter(x => x.v !== null)
    .sort((a, b) => b.v - a.v);

  const ranks = {};
  sorted.forEach((x, idx) => {
    ranks[x.i] = idx + 1;
  });

  // Construction du tableau
  const table = el('table', { class: 'grades-table' });
  const thead = el('thead');
  
  if (isAnnual) {
    // Mode annuel : colonnes M1, M2, M3, Moyenne annuelle, Rang
    thead.append(el('tr', {},
      el('th', { textContent: 'N°' }),
      el('th', { textContent: 'اسم التلميذ' }),
      el('th', { textContent: 'م1' }),
      el('th', { textContent: 'م2' }),
      el('th', { textContent: 'م3' }),
      el('th', { textContent: 'المعدل السنوي' }),
      el('th', { textContent: 'الرتبة' }),
    ));
  } else {
    // Mode trimestre : colonnes TP, DC, DS, Moyenne, Rang
    thead.append(el('tr', {},
      el('th', { textContent: 'N°' }),
      el('th', { textContent: 'اسم التلميذ' }),
      el('th', {}, el('span', { textContent: 'TP' }), el('span', { class: 'exam-header', textContent: 'أشغال تطبيقية' })),
      el('th', {}, el('span', { textContent: 'DC' }), el('span', { class: 'exam-header', textContent: 'فرض مراقبة' })),
      el('th', {}, el('span', { textContent: 'DS' }), el('span', { class: 'exam-header', textContent: 'فرض تأليفي' })),
      el('th', { textContent: 'المعدل' }),
      el('th', { textContent: 'الرتبة' }),
    ));
  }
  table.append(thead);

  const tbody = el('tbody');

  students.forEach((s, i) => {
    const avg = averages[i];
    const rank = ranks[i];
    const tr = el('tr', { class: rank === 1 ? 'top-1' : rank === 2 ? 'top-2' : rank === 3 ? 'top-3' : '' });

    tr.append(
      el('td', { textContent: (i + 1) + '' }),
      el('td', { textContent: s.name }),
    );

    if (isAnnual) {
      // Mode annuel
      const m1 = computeAverage(s, '1');
      const m2 = computeAverage(s, '2');
      const m3 = computeAverage(s, '3');
      tr.append(
        el('td', { textContent: m1 === null ? '—' : fmt(m1), style: 'text-align:center' }),
        el('td', { textContent: m2 === null ? '—' : fmt(m2), style: 'text-align:center' }),
        el('td', { textContent: m3 === null ? '—' : fmt(m3), style: 'text-align:center' }),
      );
    } else {
      // Mode trimestre
      ['tp', 'dc', 'ds'].forEach(type => {
        const val = getNote(s, term, type);
        const inp = el('input', {
          type: 'text',
          inputMode: 'decimal',
          class: 'grade-input' + (val === null ? ' empty' : ''),
          placeholder: '—',
          value: val === null ? '' : String(val),
          'data-student': s.id,
          'data-type': type,
        });
        inp.onchange = () => {
          const v = inp.value.trim();
          const note = parseNote(v);
          if (v !== '' && note === null) {
            alert('العدد يجب أن يكون بين 0 و 20.');
            inp.value = val === null ? '' : String(val);
            return;
          }
          setNote(s.id, term, type, v);
          renderGradesList();
        };
        tr.append(el('td', {}, inp));
      });
    }

    // Cellule de moyenne
    const avgCell = el('td', {
      class: 'avg-cell' + (avg !== null && avg < 10 ? ' low' : ''),
      textContent: avg === null ? '—' : fmt(avg),
    });
    tr.append(avgCell);

    // Cellule de rang
    const medal = rank === 1 ? '🥇 ' : rank === 2 ? '🥈 ' : rank === 3 ? '🥉 ' : '';
    const rankCell = el('td', {
      class: 'rank-cell' + (rank && rank <= 3 ? ' medal' : ''),
      textContent: rank ? medal + rank : '—',
    });
    tr.append(rankCell);

    tbody.append(tr);
  });

  table.append(tbody);
  conteneur.append(table);

  renderGradesStats(students, term, isAnnual);
}

export function bindGrades() {
  const classSelect = $('gClass');
  const termSelect = $('gTerm');
  if (classSelect) classSelect.onchange = renderGradesList;
  if (termSelect) termSelect.onchange = renderGradesList;

  const btnExport = $('gExport');
  if (btnExport) btnExport.onclick = exportGrades;

  renderGradesClassSelect();
}

export function exportGrades() {
  const classe = $('gClass').value;
  const term = $('gTerm').value;
  const isAnnual = term === 'A';

  if (!classe) { alert('اختر فصلاً أولاً.'); return; }

  const students = db.students
    .filter(s => s.class === classe)
    .sort((a, b) => collator.compare(a.name, b.name));

  if (students.length === 0) { alert('لا يوجد تلاميذ في هذا الفصل.'); return; }

  const averages = students.map(s => {
    if (isAnnual) return computeAnnualAverage(s);
    return computeAverage(s, term);
  });

  const sorted = averages.map((v, i) => ({ i, v })).filter(x => x.v !== null).sort((a, b) => b.v - a.v);
  const ranks = {};
  sorted.forEach((x, idx) => { ranks[x.i] = idx + 1; });

  let rows;
  if (isAnnual) {
    rows = students.map((s, i) => ({
      'N°': i + 1,
      'اسم التلميذ': s.name,
      'م1': computeAverage(s, '1') === null ? '' : fmt(computeAverage(s, '1')),
      'م2': computeAverage(s, '2') === null ? '' : fmt(computeAverage(s, '2')),
      'م3': computeAverage(s, '3') === null ? '' : fmt(computeAverage(s, '3')),
      'المعدل السنوي': averages[i] === null ? '' : fmt(averages[i]),
      'الرتبة': ranks[i] || '',
    }));
  } else {
    rows = students.map((s, i) => ({
      'N°': i + 1,
      'اسم التلميذ': s.name,
      'TP': getNote(s, term, 'tp') ?? '',
      'DC': getNote(s, term, 'dc') ?? '',
      'DS': getNote(s, term, 'ds') ?? '',
      'المعدل': averages[i] === null ? '' : fmt(averages[i]),
      'الرتبة': ranks[i] || '',
    }));
  }

  exportExcel(rows, 'نقاط ' + classe + (isAnnual ? ' سنوي' : ' ثلاثي ' + term), 'نقاط_' + classe + (isAnnual ? '_سنوي' : '_ثلاثي' + term));
}
