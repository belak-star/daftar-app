// src/features/discipline.js
// Gère les sanctions et convocations (design moderne et lisible).
import { db, save } from '../core/state.js';
import { $, el, toast } from '../core/dom.js';
import { collator, uid } from '../core/format.js';

function today() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

export function renderDisciplineClassSelects() {
  const formSel = $('discClass');
  const filterSel = $('discFilterClass');
  if (!formSel || !filterSel) return;

  const formVal = formSel.value;
  const filterVal = filterSel.value;

  formSel.replaceChildren();
  formSel.append(el('option', { value: '', textContent: '— اختر —' }));
  filterSel.replaceChildren();
  filterSel.append(el('option', { value: '', textContent: 'كل الأقسام' }));

  db.classes.slice().sort((a, b) => collator.compare(a, b)).forEach(c => {
    const o1 = el('option', { value: c, textContent: c });
    if (c === formVal) o1.selected = true;
    formSel.append(o1);
    const o2 = el('option', { value: c, textContent: c });
    if (c === filterVal) o2.selected = true;
    filterSel.append(o2);
  });
}

export function renderDisciplineStudentSelect() {
  const classSel = $('discClass');
  const studentSel = $('discStudent');
  if (!classSel || !studentSel) return;

  const classe = classSel.value;
  studentSel.replaceChildren();

  if (!classe) {
    studentSel.append(el('option', { value: '', textContent: '— اختر القسم أولاً —' }));
    return;
  }

  studentSel.append(el('option', { value: '', textContent: '— اختر —' }));
  db.students
    .filter(s => s.class === classe)
    .sort((a, b) => collator.compare(a.name, b.name))
    .forEach(s => {
      studentSel.append(el('option', { value: s.id, textContent: s.name }));
    });
}

export function toggleDisciplineFields() {
  const kind = $('discKind').value;
  const typeWrap = $('discTypeWrap');
  const meetWrap = $('discMeetDateWrap');
  if (!typeWrap || !meetWrap) return;

  if (kind === 'invitation') {
    typeWrap.classList.add('hidden');
    meetWrap.classList.remove('hidden');
  } else {
    typeWrap.classList.remove('hidden');
    meetWrap.classList.add('hidden');
  }
}

export function saveDisciplineRecord() {
  const classe = $('discClass').value;
  const studentId = $('discStudent').value;
  const date = $('discDate').value;
  const kind = $('discKind').value;
  const type = $('discType').value;
  const meetDate = $('discMeetDate').value;
  const meetTime = $('discMeetTime') ? $('discMeetTime').value : '';
  const reason = $('discReason').value.trim();

  if (!classe) { alert('اختر قسماً أولاً.'); return; }
  if (!studentId) { alert('اختر التلميذ.'); return; }
  if (!date) { alert('أدخل التاريخ.'); return; }
  if (!reason) { alert('أدخل الموضوع أو السبب.'); return; }
  if (kind === 'invitation' && !meetDate) { alert('أدخل تاريخ موعد الاستدعاء.'); return; }

  const student = db.students.find(s => s.id === studentId);
  if (!student) { alert('التلميذ غير موجود.'); return; }

  db.disciplineRecords = db.disciplineRecords || [];
  db.disciplineRecords.push({
    id: uid(),
    studentId,
    studentName: student.name,
    class: classe,
    date,
    kind,
    type: kind === 'sanction' ? type : null,
    meetDate: kind === 'invitation' ? meetDate : null,
    meetTime: kind === 'invitation' ? meetTime : null,
    reason,
    createdAt: new Date().toISOString(),
  });

  save();
  $('discReason').value = '';
  $('discMeetDate').value = '';
  if ($('discMeetTime')) $('discMeetTime').value = '';
  renderDisciplineList();
  toast('✅ تم حفظ السجل');
}

function deleteDisciplineRecord(id) {
  if (!confirm('حذف هذا السجل نهائياً؟')) return;
  db.disciplineRecords = (db.disciplineRecords || []).filter(r => r.id !== id);
  save();
  renderDisciplineList();
  toast('🗑 تم حذف السجل');
}

export function renderDisciplineList() {
  const box = $('discList');
  const count = $('discCount');
  if (!box) return;

  box.replaceChildren();
  const filterClass = $('discFilterClass').value;
  let records = (db.disciplineRecords || []).slice();
  if (filterClass) records = records.filter(r => r.class === filterClass);

  records.sort((a, b) => b.date.localeCompare(a.date));

  if (count) count.textContent = 'عدد السجلات: ' + records.length;

  if (records.length === 0) {
    box.append(el('div', { class: 'empty-list', textContent: 'لا توجد سجلات.' }));
    return;
  }

  const table = el('table', { class: 'dail-table' });
  const thead = el('thead');
  thead.append(el('tr', {},
    el('th', { textContent: 'التاريخ', class: 'col-n', style: 'width:100px' }),
    el('th', { textContent: 'القسم', style: 'text-align:center' }),
    el('th', { textContent: 'التلميذ', class: 'col-name' }),
    el('th', { textContent: 'النوع', style: 'text-align:center' }),
    el('th', { textContent: 'الموضوع / السبب', class: 'col-reason' }),
    el('th', { textContent: 'موعد الاستدعاء', style: 'text-align:center' }),
    el('th', { textContent: 'إجراء', class: 'col-del' })
  ));
  table.append(thead);

  const tbody = el('tbody');
  records.forEach(r => {
    const kindLabel = r.kind === 'invitation' ? 'استدعاء' : r.type;
    const btnDel = el('button', {
      class: 'btn-icon-sm',
      textContent: '🗑️',
      title: 'حذف',
      style: 'background:#fee2e2;color:#b3261e',
      onclick: () => deleteDisciplineRecord(r.id)
    });

    let meetDisplay = '—';
    if (r.meetDate) meetDisplay = r.meetDate + (r.meetTime ? ' ' + r.meetTime : '');

    // On force la couleur noire pour tous les textes du tableau ici
    const tr = el('tr', {},
      el('td', { textContent: r.date, style: 'direction:ltr;font-size:14px;color:#334155;font-weight:700' }),
      el('td', { textContent: r.class, style: 'text-align:center;color:#334155;font-weight:700' }),
      el('td', { textContent: r.studentName, style: 'color:#000000;font-weight:800;font-size:16px' }),
      el('td', { textContent: kindLabel, style: 'text-align:center;font-weight:700;color:#8a2a20' }),
      el('td', { textContent: r.reason, style: 'color:#0f172a;font-weight:600' }),
      el('td', { textContent: meetDisplay, style: 'direction:ltr;text-align:center;color:#334155;font-weight:700' }),
      el('td', { textContent: '', style: 'text-align:center' }, btnDel)
    );
    tbody.append(tr);
  });
  table.append(tbody);
  box.append(table);
}

export function resetDisciplineForm() {
  $('discClass').value = '';
  $('discStudent').replaceChildren();
  $('discStudent').append(el('option', { value: '', textContent: '— اختر القسم أولاً —' }));
  $('discDate').value = today();
  $('discKind').value = 'sanction';
  $('discType').value = 'تنبيه';
  $('discMeetDate').value = '';
  if ($('discMeetTime')) $('discMeetTime').value = '';
  $('discReason').value = '';
  toggleDisciplineFields();
}

export function bindDiscipline() {
  const classSel = $('discClass');
  const kindSel = $('discKind');
  const saveBtn = $('discSave');
  const resetBtn = $('discReset');
  const filterSel = $('discFilterClass');
  const dateInput = $('discDate');

  if (dateInput) dateInput.value = today();
  if (classSel) classSel.onchange = renderDisciplineStudentSelect;
  if (kindSel) kindSel.onchange = toggleDisciplineFields;
  if (saveBtn) saveBtn.onclick = saveDisciplineRecord;
  if (resetBtn) resetBtn.onclick = resetDisciplineForm;
  if (filterSel) filterSel.onchange = renderDisciplineList;

  toggleDisciplineFields();
  renderDisciplineClassSelects();
  renderDisciplineList();
}