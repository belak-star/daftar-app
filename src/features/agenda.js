// src/features/agenda.js
// Gère les devoirs et échéances avec un design moderne.
import { exportToExcel } from '../core/excel.js';
import { db, save } from '../core/state.js';
import { $, el, toast } from '../core/dom.js';
import { collator, uid } from '../core/format.js';

function today() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

function addDays(dateStr, n) {
  const d = new Date(dateStr + 'T12:00:00');
  d.setDate(d.getDate() + n);
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

const TYPE_LABELS = { devoir: 'واجب', controle: 'فرض', autre: 'آخر' };

export function renderAgendaClassSelects() {
  const formSel = $('agClass');
  const filterSel = $('agFilterClass');
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

export function saveAgendaItem() {
  const classe = $('agClass').value;
  const type = $('agType').value;
  const date = $('agDate').value;
  const title = $('agTitle').value.trim();
  const desc = $('agDesc').value.trim();

  if (!classe) { alert('اختر قسماً أولاً.'); return; }
  if (!date) { alert('أدخل التاريخ.'); return; }
  if (!title) { alert('أدخل العنوان.'); return; }

  db.classAgenda = db.classAgenda || [];
  db.classAgenda.push({
    id: uid(),
    class: classe,
    type,
    date,
    title,
    desc,
    done: false,
    createdAt: new Date().toISOString(),
  });

  save();
  $('agTitle').value = '';
  $('agDesc').value = '';
  renderAgendaList();
  toast('✅ تمت إضافة الموعد');
}

function toggleDone(id) {
  const item = (db.classAgenda || []).find(x => x.id === id);
  if (!item) return;
  item.done = !item.done;
  save();
  renderAgendaList();
  toast(item.done ? '✅ تم وضع علامة الإنجاز' : '↩ تمت إعادة الفتح');
}

function deleteAgendaItem(id) {
  if (!confirm('حذف هذا الموعد نهائياً؟')) return;
  db.classAgenda = (db.classAgenda || []).filter(x => x.id !== id);
  save();
  renderAgendaList();
  toast('🗑 تم حذف الموعد');
}

function getStatus(item) {
  if (item.done) return 'done';
  const todayStr = today();
  if (item.date < todayStr) return 'overdue';
  if (item.date <= addDays(todayStr, 7)) return 'soon';
  return 'normal';
}

export function renderAgendaList() {
  const box = $('agList');
  const count = $('agCount');
  if (!box) return;

  box.replaceChildren();
  const filterClass = $('agFilterClass').value;
  let items = (db.classAgenda || []).slice();
  if (filterClass) items = items.filter(x => x.class === filterClass);

  items.sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1;
    return a.date.localeCompare(b.date);
  });

  if (count) {
    const total = items.length;
    const done = items.filter(x => x.done).length;
    const pending = total - done;
    count.textContent = 'المواعيد: ' + total + ' (منجزة: ' + done + ' — قادمة: ' + pending + ')';
  }

  if (items.length === 0) {
    box.append(el('div', { class: 'empty-list', textContent: 'لا توجد مواعيد.' }));
    return;
  }

  const table = el('table', { class: 'dail-table' });
  const thead = el('thead');
  thead.append(el('tr', {},
    el('th', { textContent: 'التاريخ', class: 'col-n', style: 'width:120px' }),
    el('th', { textContent: 'القسم', style: 'text-align:center;width:100px' }),
    el('th', { textContent: 'العنوان', class: 'col-name' }),
    el('th', { textContent: 'النوع', style: 'text-align:center;width:100px' }),
    el('th', { textContent: 'الحالة', style: 'text-align:center;width:120px' }),
    el('th', { textContent: 'إجراء', class: 'col-del' })
  ));
  table.append(thead);

  const tbody = el('tbody');
  items.forEach(item => {
    const status = getStatus(item);
    const statusLabels = { done: '✅ منجز', overdue: '⚠ متأخر', soon: '🔔 قريب', normal: '—' };
    let rowClass = '';
    if (status === 'soon') rowClass = 'ag-soon';
    else if (status === 'overdue') rowClass = 'ag-overdue';
    else if (status === 'done') rowClass = 'ag-done';

    const titleCell = el('td', {},
      el('div', { style: 'font-weight:700;font-size:16px;color:#0f172a', textContent: item.title }),
      item.desc ? el('div', { style: 'font-size:13px;color:#64748b;margin-top:2px', textContent: item.desc }) : null
    );

    const btnDone = el('button', {
      class: 'btn-icon-sm',
      textContent: item.done ? '↩' : '✓',
      title: item.done ? 'إعادة فتح' : 'وضع علامة منجز',
      style: 'background:#dcf2e5;color:#1f7a4d;margin-inline-end:4px',
      onclick: () => toggleDone(item.id)
    });

    const btnDel = el('button', {
      class: 'btn-icon-sm',
      textContent: '🗑',
      title: 'حذف',
      style: 'background:#fee2e2;color:#b3261e',
      onclick: () => deleteAgendaItem(item.id)
    });

    const tr = el('tr', { class: rowClass },
      el('td', { textContent: item.date, style: 'direction:ltr;font-size:14px' }),
      el('td', { textContent: item.class, style: 'text-align:center' }),
      titleCell,
      el('td', { textContent: TYPE_LABELS[item.type], style: 'text-align:center;font-weight:700' }),
      el('td', { textContent: statusLabels[status], style: 'text-align:center;font-weight:700' }),
      el('td', { textContent: '' }, btnDone, btnDel)
    );
    tbody.append(tr);
  });
  table.append(tbody);
  box.append(table);
}

export function resetAgendaForm() {
  $('agClass').value = '';
  $('agType').value = 'devoir';
  $('agDate').value = today();
  $('agTitle').value = '';
  $('agDesc').value = '';
}

export function bindAgenda() {
  const saveBtn = $('agSave');
  const resetBtn = $('agReset');
  const filterSel = $('agFilterClass');
  const dateInput = $('agDate');

  if (dateInput) dateInput.value = today();
  if (saveBtn) saveBtn.onclick = saveAgendaItem;
  if (resetBtn) resetBtn.onclick = resetAgendaForm;
  if (filterSel) filterSel.onchange = renderAgendaList;

  renderAgendaClassSelects();
  renderAgendaList();
  const exportBtn = $('agExport');
if (exportBtn) {
  exportBtn.onclick = () => {
    const filterClass = $('agFilterClass').value;
    let items = (db.classAgenda || []).slice();
    if (filterClass) items = items.filter(x => x.class === filterClass);
    
    // On prépare les données propres pour Excel
    const data = items.map(item => ({
      'التاريخ': item.date,
      'القسم': item.class,
      'العنوان': item.title,
      'النوع': TYPE_LABELS[item.type] || item.type,
      'الحالة': item.done ? 'منجز' : 'قادم',
      'التفاصيل': item.desc || ''
    }));
    
    exportToExcel(data, 'جدول_المواعيد', 'المواعيد');
  };
}
}