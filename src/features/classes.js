// src/features/classes.js

import { db, save } from '../core/state.js';
import { $, el, toast } from '../core/dom.js';
import { uid, collator } from '../core/format.js';
import { exportExcel } from '../core/excel.js';

export function renderClassSelect() {
  const sel = $('classSelect');
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

export function addClass() {
  const input = $('newClass');
  const nom = input.value.trim().replace(/\s+/g, ' ');
  if (!nom) { alert('اكتب اسم الفصل أولاً.'); return; }
  if (db.classes.includes(nom)) { alert('هذا الفصل موجود مسبقاً.'); return; }
  db.classes.push(nom);
  save();
  input.value = '';
  renderClassSelect();
  renderStudentList();
  toast('✅ تمت إضافة الفصل: ' + nom);
}

export function addStudent() {
  const classe = $('classSelect').value;
  const input = $('newStudent');
  const nom = input.value.trim().replace(/\s+/g, ' ');
  if (!classe) { alert('اختر فصلاً أولاً.'); return; }
  if (!nom || nom.length < 2) { alert('اكتب اسم التلميذ كاملاً.'); return; }
  const doublon = db.students.find(s => s.class === classe && s.name === nom);
  if (doublon) { alert('يوجد تلميذ بنفس الاسم في هذا الفصل.'); return; }
  db.students.push({ id: uid(), name: nom, class: classe });
  save();
  input.value = '';
  renderStudentList();
  toast('✅ تمت إضافة: ' + nom);
}

export function deleteStudent(id) {
  const eleve = db.students.find(s => s.id === id);
  if (!eleve) return;
  if (!confirm('حذف التلميذ "' + eleve.name + '" نهائياً؟')) return;
  db.students = db.students.filter(s => s.id !== id);
  Object.keys(db.records).forEach(k => {
    if (k.split('|')[1] === id) delete db.records[k];
  });
  save();
  renderStudentList();
  toast('🗑️ تم حذف التلميذ');
}

export function renderStudentList() {
  const conteneur = $('studentList');
  const compteur = $('studentCount');
  if (!conteneur) return;
  const classe = $('classSelect').value;
  conteneur.replaceChildren();
  if (!classe) {
    compteur.textContent = '';
    conteneur.append(el('div', { class: 'empty-list', textContent: 'اختر فصلاً لعرض تلاميذه.' }));
    return;
  }
  const eleves = db.students.filter(s => s.class === classe).sort((a, b) => collator.compare(a.name, b.name));
  compteur.textContent = 'عدد التلاميذ في الفصل «' + classe + '»: ' + eleves.length;
  
  // Bouton d'export Excel
  const btnExport = el('button', {
    class: 'btn',
    textContent: '📥 تصدير Excel',
    style: 'background:#1f7a4d;margin-bottom:10px',
  });
  btnExport.onclick = () => {
    const rows = eleves.map((s, i) => ({
      'N°': i + 1,
      'اسم التلميذ': s.name,
      'الفصل': s.class,
    }));
    exportExcel(rows, 'تلاميذ ' + classe, 'تلاميذ_' + classe);
  };
  conteneur.append(btnExport);
  if (eleves.length === 0) {
    conteneur.append(el('div', { class: 'empty-list', textContent: 'لا يوجد تلاميذ في هذا الفصل بعد. أضف الأول!' }));
    return;
  }
  eleves.forEach((s, i) => {
    const btnDel = el('button', {
      class: 'btn',
      textContent: '🗑️ حذف',
      style: 'background:#b3261e;padding:6px 12px;font-size:14px',
      onclick: () => deleteStudent(s.id),
    });
    conteneur.append(el('div', { class: 'student-item' },
      el('div', {},
        el('span', { class: 'student-num', textContent: (i + 1) + '.' }),
        el('span', { class: 'student-name', textContent: s.name }),
      ),
      btnDel,
    ));
  });
}

export function bindClasses() {
  const btnAddClass = $('addClass');
  const btnAddStudent = $('addStudent');
  const sel = $('classSelect');
  if (btnAddClass) btnAddClass.onclick = addClass;
  if (btnAddStudent) btnAddStudent.onclick = addStudent;
  if (sel) sel.onchange = renderStudentList;
  const inputClass = $('newClass');
  const inputStudent = $('newStudent');
  if (inputClass) inputClass.onkeydown = (e) => { if (e.key === 'Enter') addClass(); };
  if (inputStudent) inputStudent.onkeydown = (e) => { if (e.key === 'Enter') addStudent(); };
}