// src/features/attendance.js
// Gère les présences quotidiennes.

import { db, save } from '../core/state.js';
import { $, el, toast } from '../core/dom.js';
import { collator } from '../core/format.js';
import { exportExcel } from '../core/excel.js';

const TYPES = {
  present:   'حاضر',
  excused:   'غياب مبرر',
  unexcused: 'غياب غير مبرر',
  late:      'تأخير',
};

const STATUTS = ['present', 'excused', 'unexcused', 'late'];

/** Aujourd'hui au format YYYY-MM-DD. */
function today() {
  const d = new Date();
  return d.getFullYear() + '-' +
    String(d.getMonth() + 1).padStart(2, '0') + '-' +
    String(d.getDate()).padStart(2, '0');
}

/** Récupère la présence d'un élève à une date. */
function getPresence(studentId, date) {
  const key = date + '|' + studentId;
  return db.records[key] || { type: 'present', reason: '' };
}

/** Enregistre (ou efface si "présent") la présence. */
function setPresence(studentId, date, type, reason = '') {
  const key = date + '|' + studentId;
  if (type === 'present') {
    delete db.records[key];
  } else {
    db.records[key] = { type, reason };
  }
  save();
}

/** Remplit le sélecteur de classes. */
export function renderAttClassSelect() {
  const sel = $('attClass');
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

/** Met à jour les statistiques du jour. */
function renderAttStats() {
  const box = $('attStats');
  if (!box) return;
  const classe = $('attClass').value;
  const date = $('attDate').value;
  box.replaceChildren();
  if (!classe) return;

  const eleves = db.students.filter(s => s.class === classe);
  if (eleves.length === 0) return;

  const counts = { present: 0, excused: 0, unexcused: 0, late: 0 };
  eleves.forEach(s => {
    const p = getPresence(s.id, date);
    if (counts[p.type] !== undefined) counts[p.type]++;
  });

  const total = eleves.length;
  const cards = [
    ['all', 'المجموع', total],
    ['present', 'حاضر', counts.present],
    ['excused', 'غياب مبرر', counts.excused],
    ['unexcused', 'غياب غير مبرر', counts.unexcused],
    ['late', 'تأخير', counts.late],
  ];

  cards.forEach(([cls, label, value]) => {
    box.append(el('div', { class: 'stat s-' + cls },
      el('span', { textContent: label }),
      el('b', { textContent: value }),
    ));
  });
}

/** Affiche la liste des élèves avec leurs boutons de statut. */
export function renderAttList() {
  const conteneur = $('attList');
  if (!conteneur) return;
  conteneur.replaceChildren();

  const classe = $('attClass').value;
  const date = $('attDate').value;

  if (!classe) {
    conteneur.append(el('div', { class: 'empty-list', textContent: 'اختر فصلاً لعرض التلاميذ.' }));
    renderAttStats();
    return;
  }

  const eleves = db.students
    .filter(s => s.class === classe)
    .sort((a, b) => collator.compare(a.name, b.name));

  if (eleves.length === 0) {
    conteneur.append(el('div', { class: 'empty-list', textContent: 'لا يوجد تلاميذ في هذا الفصل.' }));
    renderAttStats();
    return;
  }

  eleves.forEach((s, i) => {
    const p = getPresence(s.id, date);
    const row = el('div', { class: 'att-row' });

    row.append(
      el('span', { class: 'att-num', textContent: (i + 1) + '.' }),
      el('span', { class: 'att-name', textContent: s.name }),
    );

    const actions = el('div', { class: 'att-actions' });
    STATUTS.forEach(type => {
      const btn = el('button', {
        type: 'button',
        class: 'status-btn ' + type + (p.type === type ? ' active' : ''),
        textContent: TYPES[type],
      });
      btn.onclick = () => {
        setPresence(s.id, date, type, type === 'present' ? '' : getPresence(s.id, date).reason || '');
        renderAttList();
        renderAttStats();
      };
      actions.append(btn);
    });
    row.append(actions);

    // Champ raison (seulement si absent)
    if (p.type === 'excused' || p.type === 'unexcused') {
      const inp = el('input', {
        type: 'text',
        class: 'att-reason',
        placeholder: 'السبب (اختياري): مرض، موعد طبي…',
        value: p.reason || '',
      });
      inp.oninput = () => {
        setPresence(s.id, date, p.type, inp.value);
      };
      row.append(inp);
    }

    conteneur.append(row);
  });

  renderAttStats();
}

/** Bouton "Tous présents". */
function markAllPresent() {
  const classe = $('attClass').value;
  const date = $('attDate').value;
  if (!classe) { alert('اختر فصلاً أولاً.'); return; }
  if (!confirm('هل تريد تحديد جميع التلاميذ حاضرين في هذا اليوم؟')) return;
  db.students.filter(s => s.class === classe).forEach(s => {
    setPresence(s.id, date, 'present');
  });
  renderAttList();
  toast('✅ تم تحديد الجميع حاضرين');
}

/** Branche tous les événements. */
export function bindAttendance() {
  const dateInput = $('attDate');
  const classSelect = $('attClass');
  const allPresent = $('attAllPresent');

  if (dateInput) dateInput.value = today();
  if (dateInput) dateInput.onchange = () => { renderAttList(); };
  if (classSelect) classSelect.onchange = () => { renderAttList(); };
  if (allPresent) allPresent.onclick = markAllPresent;
  const btnExport = $('attExport');
if (btnExport) btnExport.onclick = exportAttendance;

  renderAttClassSelect();
}

/** Exporte les présences du jour en Excel. */
export function exportAttendance() {
  const classe = $('attClass').value;
  const date = $('attDate').value;

  if (!classe) { alert('اختر فصلاً أولاً.'); return; }

  const eleves = db.students
    .filter(s => s.class === classe)
    .sort((a, b) => collator.compare(a.name, b.name));

  if (eleves.length === 0) { alert('لا يوجد تلاميذ في هذا الفصل.'); return; }

  const rows = eleves.map((s, i) => {
    const p = getPresence(s.id, date);
    return {
      'N°': i + 1,
      'اسم التلميذ': s.name,
      'الحالة': TYPES[p.type] || p.type,
      'السبب': p.reason || '',
      'التاريخ': date,
    };
  });

  exportExcel(rows, 'غيابات ' + classe + ' ' + date, 'غيابات_' + classe + '_' + date);
}