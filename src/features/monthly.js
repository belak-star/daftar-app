// src/features/monthly.js
// Rapport mensuel des absences.

import { db } from '../core/state.js';
import { $, el } from '../core/dom.js';
import { collator } from '../core/format.js';
import { exportExcel } from '../core/excel.js';

const THRESHOLD = 3; // seuil d'alerte

/** Renvoie le mois actuel au format YYYY-MM. */
function currentMonth() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
}

/** Remplit le sélecteur de classes. */
export function renderMonthlyClassSelect() {
  const sel = $('moClass');
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

/** Calcule les totaux pour chaque élève d'une classe sur un mois. */
function computeMonthly(students, month) {
  return students.map(s => {
    const totals = { excused: 0, unexcused: 0, late: 0 };
    Object.keys(db.records).forEach(key => {
      const [date, studentId] = key.split('|');
      if (studentId !== s.id) return;
      if (!date.startsWith(month)) return;
      const rec = db.records[key];
      if (rec.type in totals) totals[rec.type]++;
    });
    totals.total = totals.excused + totals.unexcused + totals.late;
    totals.alert = totals.unexcused >= THRESHOLD;
    return { student: s, totals };
  });
}

/** Affiche les stats globales du mois. */
function renderMonthlyStats(rows) {
  const box = $('moStats');
  if (!box) return;
  box.replaceChildren();

  if (rows.length === 0) {
    box.append(el('div', { class: 'stat s-all' },
      el('span', { textContent: 'لا توجد بيانات' }),
      el('b', { textContent: '—' }),
    ));
    return;
  }

  const total = (k) => rows.reduce((acc, r) => acc + r.totals[k], 0);
  const nbAlert = rows.filter(r => r.totals.alert).length;

  const cards = [
    ['s-all', 'إجمالي الغيابات', total('excused') + total('unexcused') + total('late')],
    ['s-excused', 'غياب مبرر', total('excused')],
    ['s-unexcused', 'غياب غير مبرر', total('unexcused')],
    ['s-late', 'تأخير', total('late')],
    ['s-unexcused', 'تلاميذ في حالة تنبيه', nbAlert],
  ];

  cards.forEach(([cls, label, value]) => {
    box.append(el('div', { class: 'stat ' + cls },
      el('span', { textContent: label }),
      el('b', { textContent: value }),
    ));
  });
}

/** Affiche le tableau mensuel. */
export function renderMonthlyList() {
  const conteneur = $('moList');
  if (!conteneur) return;
  conteneur.replaceChildren();

  const classe = $('moClass').value;
  const month = $('moMonth').value;

  if (!classe || !month) {
    conteneur.append(el('div', { class: 'empty-list', textContent: 'اختر فصلاً وشهراً.' }));
    const box = $('moStats');
    if (box) box.replaceChildren();
    return;
  }

  const students = db.students
    .filter(s => s.class === classe)
    .sort((a, b) => collator.compare(a.name, b.name));

  if (students.length === 0) {
    conteneur.append(el('div', { class: 'empty-list', textContent: 'لا يوجد تلاميذ في هذا الفصل.' }));
    const box = $('moStats');
    if (box) box.replaceChildren();
    return;
  }

  const rows = computeMonthly(students, month);
  rows.sort((a, b) => b.totals.total - a.totals.total);

  renderMonthlyStats(rows);

  const table = el('table', { class: 'monthly-table' });
  const thead = el('thead');
  thead.append(el('tr', {},
    el('th', { textContent: 'N°' }),
    el('th', { textContent: 'اسم التلميذ' }),
    el('th', { textContent: 'غياب مبرر' }),
    el('th', { textContent: 'غياب غير مبرر' }),
    el('th', { textContent: 'تأخير' }),
    el('th', { textContent: 'المجموع' }),
    el('th', { textContent: 'تنبيه' }),
  ));
  table.append(thead);

  const tbody = el('tbody');
  rows.forEach((r, i) => {
    const tr = el('tr', { class: r.totals.alert ? 'warn' : '' });
    tr.append(
      el('td', { textContent: (i + 1) + '' }),
      el('td', { textContent: r.student.name }),
      el('td', { class: 'cell-excused', textContent: r.totals.excused }),
      el('td', { class: 'cell-unexcused', textContent: r.totals.unexcused }),
      el('td', { class: 'cell-late', textContent: r.totals.late }),
      el('td', { class: 'cell-total', textContent: r.totals.total }),
      el('td', { class: 'cell-warning' },
        r.totals.alert ? el('span', { class: 'badge-alert', textContent: '⚠ تنبيه' }) : '—'
      ),
    );
    tbody.append(tr);
  });
  table.append(tbody);
  conteneur.append(table);
}

/** Branche les événements. */
export function bindMonthly() {
  const classSelect = $('moClass');
  const monthInput = $('moMonth');

  if (monthInput) monthInput.value = currentMonth();
  if (classSelect) classSelect.onchange = renderMonthlyList;
  if (monthInput) monthInput.onchange = renderMonthlyList;
    const btnExport = $('moExport');
  if (btnExport) btnExport.onclick = exportMonthly;

  renderMonthlyClassSelect();
}

/** Exporte le rapport mensuel en Excel. */
export function exportMonthly() {
  const classe = $('moClass').value;
  const month = $('moMonth').value;

  if (!classe || !month) { alert('اختر فصلاً وشهراً.'); return; }

  const students = db.students
    .filter(s => s.class === classe)
    .sort((a, b) => collator.compare(a.name, b.name));

  if (students.length === 0) { alert('لا يوجد تلاميذ في هذا الفصل.'); return; }

  const rows = computeMonthly(students, month).map((r, i) => ({
    'N°': i + 1,
    'اسم التلميذ': r.student.name,
    'غياب مبرر': r.totals.excused,
    'غياب غير مبرر': r.totals.unexcused,
    'تأخير': r.totals.late,
    'المجموع': r.totals.total,
    'تنبيه': r.totals.alert ? 'نعم' : 'لا',
  }));

  exportExcel(rows, 'تقرير ' + classe + ' ' + month, 'تقرير_' + classe + '_' + month);
}