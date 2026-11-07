// src/features/agenda.js
// Gère les devoirs et échéances.

import { db, save } from '../core/state.js';
import { $, el, toast } from '../core/dom.js';
import { collator, uid } from '../core/format.js';
import { exportExcel } from '../core/excel.js';

/** Renvoie la date du jour YYYY-MM-DD. */
function today() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

/** Ajoute n jours à une date YYYY-MM-DD. */
function addDays(dateStr, n) {
  const d = new Date(dateStr + 'T12:00:00');
  d.setDate(d.getDate() + n);
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

const TYPE_LABELS = {
  devoir: 'واجب',
  controle: 'فرض',
  autre: 'آخر',
};

/** Remplit le menu des classes (formulaire + filtre). */
export function renderAgendaClassSelects() {
  const formSel = $('agClass');
  const filterSel = $('agFilterClass');
  if (!formSel || !filterSel) return;

  const formVal = formSel.value;
  const filterVal = filterSel.value;

  formSel.replaceChildren();
  formSel.append(el('option', { value: '', textContent: '— اختر —' }));

  filterSel.replaceChildren();
  filterSel.append(el('option', { value: '', textContent: 'كل الفصول' }));

  db.classes.slice().sort((a, b) => collator.compare(a, b)).forEach(c => {
    const o1 = el('option', { value: c, textContent: c });
    if (c === formVal) o1.selected = true;
    formSel.append(o1);

    const o2 = el('option', { value: c, textContent: c });
    if (c === filterVal) o2.selected = true;
    filterSel.append(o2);
  });
}

/** Ajoute un nouvel élément à l'agenda. */
export function saveAgendaItem() {
  const classe = $('agClass').value;
  const type = $('agType').value;
  const date = $('agDate').value;
  const title = $('agTitle').value.trim();
  const desc = $('agDesc').value.trim();

  if (!classe) { alert('اختر فصلاً أولاً.'); return; }
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

  // Réinitialiser
  $('agTitle').value = '';
  $('agDesc').value = '';

  renderAgendaList();
  toast('✅ تمت إضافة الموعد');
}

/** Marque un élément comme fait / non fait. */
function toggleDone(id) {
  const item = (db.classAgenda || []).find(x => x.id === id);
  if (!item) return;
  item.done = !item.done;
  save();
  renderAgendaList();
  toast(item.done ? '✅ تم تحديده كمنجز' : '↩️ تم إعادة فتحه');
}

/** Supprime un élément. */
function deleteAgendaItem(id) {
  if (!confirm('حذف هذا الموعد نهائياً؟')) return;
  db.classAgenda = (db.classAgenda || []).filter(x => x.id !== id);
  save();
  renderAgendaList();
  toast('🗑️ تم حذف الموعد');
}

/** Renvoie le statut d'un élément (soon, overdue, done, normal). */
function getStatus(item) {
  if (item.done) return 'done';
  const todayStr = today();
  if (item.date < todayStr) return 'overdue';
  if (item.date <= addDays(todayStr, 7)) return 'soon';
  return 'normal';
}

/** Affiche la liste des éléments de l'agenda. */
export function renderAgendaList() {
  const box = $('agList');
  const count = $('agCount');
  if (!box) return;

  box.replaceChildren();

  const filterClass = $('agFilterClass').value;
  let items = (db.classAgenda || []).slice();

  if (filterClass) items = items.filter(x => x.class === filterClass);

  // Trier : non-faits d'abord, puis par date croissante
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

  const table = el('table', { class: 'ag-table' });
  const thead = el('thead');
  thead.append(el('tr', {},
    el('th', { textContent: 'التاريخ' }),
    el('th', { textContent: 'الفصل' }),
    el('th', { textContent: 'العنوان' }),
    el('th', { textContent: 'النوع' }),
    el('th', { textContent: 'الحالة' }),
    el('th', { textContent: 'إجراء' }),
  ));
  table.append(thead);

  const tbody = el('tbody');
  items.forEach(item => {
    const status = getStatus(item);
    const statusLabels = {
      done: '✅ منجز',
      overdue: '⚠️ متأخر',
      soon: '🔔 قريب',
      normal: '—',
    };
    const statusClasses = {
      done: 'done',
      overdue: 'overdue',
      soon: 'soon',
      normal: 'normal',
    };

    const rowClass = status === 'soon' ? 'ag-soon'
                   : status === 'overdue' ? 'ag-overdue'
                   : status === 'done' ? 'ag-done'
                   : '';

    const titleCell = el('td', {},
      el('div', { class: 'ag-title', textContent: item.title }),
      item.desc ? el('div', { class: 'ag-desc', textContent: item.desc }) : null,
    );

    const btnDone = el('button', {
      class: 'btn',
      textContent: item.done ? '↩️' : '✓',
      style: 'background:#1f7a4d',
      title: item.done ? 'إعادة فتح' : 'تم',
    });
    btnDone.onclick = () => toggleDone(item.id);

    const btnDel = el('button', {
      class: 'btn',
      textContent: '🗑️',
      style: 'background:#b3261e',
      title: 'حذف',
    });
    btnDel.onclick = () => deleteAgendaItem(item.id);

    const tr = el('tr', { class: rowClass },
      el('td', { textContent: item.date }),
      el('td', { textContent: item.class }),
      titleCell,
      el('td', {},
        el('span', { class: 'ag-type-badge ' + item.type, textContent: TYPE_LABELS[item.type] }),
      ),
      el('td', {},
        el('span', { class: 'ag-status ' + statusClasses[status], textContent: statusLabels[status] }),
      ),
      el('td', {}, btnDone, btnDel),
    );
    tbody.append(tr);
  });
  table.append(tbody);

  box.append(table);
}

/** Réinitialise le formulaire. */
export function resetAgendaForm() {
  $('agClass').value = '';
  $('agType').value = 'devoir';
  $('agDate').value = today();
  $('agTitle').value = '';
  $('agDesc').value = '';
}

/** Branche tous les événements. */
export function bindAgenda() {
  const saveBtn = $('agSave');
  const resetBtn = $('agReset');
  const filterSel = $('agFilterClass');
  const dateInput = $('agDate');

  if (dateInput) dateInput.value = today();
  if (saveBtn) saveBtn.onclick = saveAgendaItem;
  if (resetBtn) resetBtn.onclick = resetAgendaForm;
  if (filterSel) filterSel.onchange = renderAgendaList;
    const btnExport = $('agExport');
  if (btnExport) btnExport.onclick = exportAgenda;

  renderAgendaClassSelects();
  renderAgendaList();
}

/** Exporte les devoirs et échéances en Excel. */
export function exportAgenda() {
  const filterClass = $('agFilterClass').value;
  let items = (db.classAgenda || []).slice();

  if (filterClass) items = items.filter(x => x.class === filterClass);

  if (items.length === 0) { alert('لا توجد مواعيد للتصدير.'); return; }

  items.sort((a, b) => a.date.localeCompare(b.date));

  const rows = items.map((item, i) => {
    const status = getStatus(item);
    const statusLabel = status === 'done' ? 'منجز'
                      : status === 'overdue' ? 'متأخر'
                      : status === 'soon' ? 'قريب'
                      : '—';
    return {
      'N°': i + 1,
      'التاريخ': item.date,
      'الفصل': item.class,
      'العنوان': item.title,
      'النوع': TYPE_LABELS[item.type] || item.type,
      'الحالة': statusLabel,
      'التفاصيل': item.desc || '',
    };
  });

  exportExcel(rows, 'أجندة', 'أجندة_' + (filterClass || 'كل_الفصول'));
}