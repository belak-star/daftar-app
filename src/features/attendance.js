// src/features/attendance.js
import { db, save } from '../core/state.js';
import { $, el, toast } from '../core/dom.js';
import { collator } from '../core/format.js';
import { exportToExcel } from '../core/excel.js';

const T = {
  present: { label: 'حاضر', color: '#1f7a4d', bg: '#dcf2e5', icon: '🟢' },
  excused: { label: 'غائب مبرر', color: '#2563a8', bg: '#dce9f8', icon: '🔵' },
  unexcused: { label: 'غائب غير مبرر', color: '#b3261e', bg: '#fbe0dd', icon: '🔴' },
  late: { label: 'تأخير', color: '#9a5b00', bg: '#fdebc8', icon: '🟠' },
  expelled: { label: 'مطرود من الحصة', color: '#7a3fb5', bg: '#ece4f7', icon: '🟣' }
};

const R = { temp: 'مفصول مؤقتاً', perm: 'مفصول نهائياً' };

function todayStr() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

function curDate() { return $('attDate')?.value || todayStr(); }
function curClass() { return $('attClass')?.value || ''; }

function effStatus(s, date) {
  if (!s.status) return '';
  if (s.from && date < s.from) return '';
  if (s.status === 'temp' && s.to && date > s.to) return '';
  return s.status;
}

function getRec(id, date) {
  return Object.assign({ type: 'present', reason: '', time: '', lateMinutes: '' }, db.records[date + '|' + id]);
}

function setRec(id, date, patch) {
  const k = date + '|' + id;
  const r = Object.assign(getRec(id, date), patch);
  if (r.type === 'present') {
    delete db.records[k];
  } else {
    db.records[k] = r;
  }
  save();
}

function classStudents() {
  return db.students.filter(s => s.class === curClass()).sort((a, b) => collator.compare(a.name, b.name));
}

function schoolYear(dateStr) {
  const y = +dateStr.slice(0, 4), m = +dateStr.slice(5, 7);
  return m >= 9 ? y + '-' + (y + 1) : (y - 1) + '-' + y;
}

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

function renderStats() {
  const box = $('attStats');
  if (!box) return;
  box.replaceChildren();
  box.className = 'att-stats';
  const list = classStudents();
  if (list.length === 0) return;
  
  const date = curDate();
  const counts = { present: 0, excused: 0, unexcused: 0, late: 0, expelled: 0 };
  
  list.forEach(s => {
    if (effStatus(s, date)) return;
    const type = getRec(s.id, date).type;
    if (counts[type] !== undefined) counts[type]++;
  });
  
  const total = list.length;
  const cards = [
    { label: 'المجموع', value: total, color: '#5d6b69', bg: '#e6ece9', icon: '👥' },
    { label: 'حاضر', value: counts.present, color: '#1f7a4d', bg: '#dcf2e5', icon: '🟢' },
    { label: 'مبرر', value: counts.excused, color: '#2563a8', bg: '#dce9f8', icon: '🔵' },
    { label: 'غير مبرر', value: counts.unexcused, color: '#b3261e', bg: '#fbe0dd', icon: '🔴' },
    { label: 'تأخير', value: counts.late, color: '#9a5b00', bg: '#fdebc8', icon: '🟠' },
    { label: 'مطرود', value: counts.expelled, color: '#7a3fb5', bg: '#ece4f7', icon: '🟣' }
  ];
  
  cards.forEach(c => {
    box.append(el('div', { class: 'att-stat-card', style: 'background:' + c.bg + ';border-color:' + c.color },
      el('span', { class: 'att-stat-label', style: 'color:' + c.color }, c.icon + ' ' + c.label),
      el('b', { class: 'att-stat-value', style: 'color:' + c.color, textContent: c.value })
    ));
  });
}

export function renderAttList() {
  const tb = $('tbody');
  if (!tb) return;
  tb.replaceChildren();
  
  const date = curDate();
  const title = $('dailyTitle');
  if (title) {
    title.textContent = '📋 القسم: ' + (curClass() || '—') + ' | السنة الدراسية ' + schoolYear(date) + ' | ' + date;
  }
  
  if (!curClass()) {
    tb.append(el('tr', {}, el('td', { colSpan: 6, class: 'empty-list', textContent: 'اختر قسماً لعرض التلاميذ.' })));
    return;
  }
  
  const q = ($('search')?.value || '').trim().toLowerCase();
  const list = classStudents().filter(s => !q || s.name.toLowerCase().includes(q));
  
  if (list.length === 0) {
    tb.append(el('tr', {}, el('td', { colSpan: 6, class: 'empty-list', textContent: 'لا يوجد تلاميذ.' })));
    return;
  }
  
  list.forEach((s, i) => {
    const ef = effStatus(s, date);
    const rec = getRec(s.id, date);
    const info = T[rec.type] || T.present;
    
    const tr = el('tr', { class: ef ? 'out' : '' });
    tr.append(el('td', { class: 'col-n', textContent: i + 1 }));
    tr.append(el('td', { class: 'col-name', textContent: s.name }));
    
    const statusBtn = el('button', {
      type: 'button', class: 'status-btn',
      style: 'background:' + info.bg + ';color:' + info.color + ';border-color:' + info.color,
      textContent: info.label + ' ▾', disabled: !!ef,
    });
    
    statusBtn.onclick = () => openStatusModal(s, date, () => {
      renderAttList();
      renderStats();
    });
    
    tr.append(el('td', { class: 'col-status' }, statusBtn));
    
    const reasonInput = el('input', {
      type: 'text', class: 'reason-input', placeholder: 'السبب...', value: rec.reason || '',
      disabled: rec.type === 'present' || !!ef,
    });
    reasonInput.oninput = () => setRec(s.id, date, { reason: reasonInput.value });
    tr.append(el('td', { class: 'col-reason' }, reasonInput));
    
    const select = el('select', { class: 'situation-select', disabled: !!ef });
    [['', 'عادي'], ['temp', R.temp], ['perm', R.perm]].forEach(([v, label]) => {
      const opt = el('option', { value: v, textContent: label });
      if ((s.status || '') === v) opt.selected = true;
      select.append(opt);
    });
    
    select.onchange = () => {
      const L = db.students.find(x => x.id === s.id);
      if (!L) return;
      const v = select.value;
      if (v === 'perm' && !confirm('تأكيد الفصل النهائي للتلميذ «' + s.name + '»؟')) {
        select.value = s.status || '';
        return;
      }
      if (v) { L.status = v; L.from = L.from || date; if (v === 'perm') delete L.to; }
      else { delete L.status; delete L.from; delete L.to; }
      save();
      renderAttList();
    };
    
    tr.append(el('td', { class: 'col-situation' }, select));
    
    tr.append(el('td', { class: 'col-del' },
      el('button', { 
        class: 'btn-icon-sm', type: 'button', textContent: '👁', title: 'عرض الحالة',
        onclick: () => {
          let msg = 'التلميذ: ' + s.name + '\n';
          msg += 'الحالة: ' + (s.status ? (s.status === 'perm' ? 'مفصول نهائياً' : 'مفصول مؤقتاً') : 'عادي') + '\n';
          if (s.from) msg += 'من تاريخ: ' + s.from + '\n';
          if (s.to) msg += 'إلى تاريخ: ' + s.to + '\n';
          if (rec.reason) msg += 'سبب اليوم: ' + rec.reason + '\n';
          alert(msg);
        }
      })
    ));
    
    tb.append(tr);
  });
  
  renderStats();
}

function openStatusModal(student, date, onUpdate) {
  document.querySelectorAll('.ov').forEach(o => o.remove());
  const currentRec = getRec(student.id, date);
  const currentType = currentRec.type;
  
  const ov = el('div', { class: 'ov' });
  const box = el('div', { class: 'ovbox status-dialog' });
  box.append(el('h3', { textContent: 'حالة التلميذ: ' + student.name, style: 'margin-top:0' }));
  
  Object.entries(T).forEach(([type, info]) => {
    const btn = el('button', {
      type: 'button', class: 'status-option' + (currentType === type ? ' selected' : ''),
      style: 'background:' + info.bg + ';color:' + info.color + ';border-color:' + info.color,
      textContent: info.icon + ' ' + info.label,
    });
    
    btn.onclick = () => {
      setRec(student.id, date, { type, reason: type === 'present' ? '' : currentRec.reason });
      ov.remove();
      onUpdate();
    };
    box.append(btn);
  });
  
  const cancel = el('button', { class: 'btn alt', type: 'button', textContent: 'إلغاء', style: 'margin-top:10px;width:100%' });
  cancel.onclick = () => ov.remove();
  box.append(cancel);
  
  ov.append(box);
  ov.onclick = (e) => { if (e.target === ov) ov.remove(); };
  document.body.append(ov);
}

function markAllPresent() {
  const date = curDate();
  if (!curClass()) return;
  if (!confirm('هل تريد تحديد جميع التلاميذ حاضرين في ' + date + '؟')) return;
  classStudents().forEach(s => setRec(s.id, date, { type: 'present' }));
  renderAttList();
  toast('✅ تم تحديد الجميع حاضرين');
}

export function bindAttendance() {
  const dateInput = $('attDate');
  const classSelect = $('attClass');
  
  if (dateInput) dateInput.value = todayStr();
  if (dateInput) dateInput.onchange = () => renderAttList();
  if (classSelect) classSelect.onchange = () => renderAttList();
  
  const searchInput = $('search');
  if (searchInput) searchInput.oninput = () => renderAttList();
  
  const allPresent = $('allPresent');
  if (allPresent) allPresent.onclick = markAllPresent;
  
  const expDay = $('expDay');
  if (expDay) expDay.onclick = () => {
    const date = curDate();
    const classe = curClass();
    if (!classe) { alert('اختر قسماً أولاً.'); return; }
    const students = classStudents();
    const data = students.map(s => {
      const rec = getRec(s.id, date);
      return {
        'الاسم': s.name,
        'الحالة': T[rec.type] ? T[rec.type].label : 'حاضر',
        'السبب': rec.reason || '',
        'الوضعية': s.status === 'perm' ? 'مفصول نهائياً' : (s.status === 'temp' ? 'مفصول مؤقتاً' : 'عادي')
      };
    });
    exportToExcel(data, 'حضور_' + classe + '_' + date, 'الحضور');
  };
  
  const prevDay = $('prevDay');
  if (prevDay) prevDay.onclick = () => {
    const d = new Date(curDate() + 'T12:00:00'); d.setDate(d.getDate() - 1);
    dateInput.value = d.toISOString().slice(0, 10); renderAttList();
  };
  
  const nextDay = $('nextDay');
  if (nextDay) nextDay.onclick = () => {
    const d = new Date(curDate() + 'T12:00:00'); d.setDate(d.getDate() + 1);
    dateInput.value = d.toISOString().slice(0, 10); renderAttList();
  };
  
  const todayBtn = $('todayBtn');
  if (todayBtn) todayBtn.onclick = () => {
    dateInput.value = todayStr(); renderAttList();
  };
  
  renderAttClassSelect();
}