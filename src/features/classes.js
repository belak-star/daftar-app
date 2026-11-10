// src/features/classes.js
// Gère les classes et les élèves avec un design moderne et le transfert.
import { db, save } from '../core/state.js';
import { $, el, toast } from '../core/dom.js';
import { uid, collator } from '../core/format.js';

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
  if (!input) return;
  const nom = input.value.trim();
  if (!nom) { alert('اكتب اسم القسم أولاً.'); return; }
  if (db.classes.includes(nom)) { alert('القسم موجود مسبقاً.'); return; }
  
  db.classes.push(nom);
  save();
  input.value = '';
  renderClassSelect();
  renderStudentList();
  toast('✅ تمت إضافة القسم: ' + nom);
}

export function addStudent() {
  const classe = $('classSelect').value;
  const input = $('newStudent');
  if (!input) return;
  const nom = input.value.trim();
  
  if (!classe) { alert('اختر قسماً أولاً.'); return; }
  if (!nom) { alert('اكتب اسم التلميذ.'); return; }
  
  if (db.students.find(s => s.class === classe && s.name === nom)) {
    alert('يوجد تلميذ بنفس الاسم في هذا القسم.');
    return;
  }
  
  db.students.push({ id: uid(), name: nom, class: classe });
  save();
  input.value = '';
  renderStudentList();
  toast('✅ تمت إضافة التلميذ: ' + nom);
}

export function deleteStudent(id) {
  const eleve = db.students.find(s => s.id === id);
  if (!eleve) return;
  if (!confirm('حذف التلميذ «' + eleve.name + '» نهائياً؟')) return;
  
  db.students = db.students.filter(s => s.id !== id);
  Object.keys(db.records).forEach(k => {
    if (k.split('|')[1] === id) delete db.records[k];
  });
  save();
  renderStudentList();
  toast('🗑 تم حذف التلميذ');
}

function moveStudent(id, currentClass) {
  const eleve = db.students.find(s => s.id === id);
  if (!eleve) return;

  const autresClasses = db.classes.filter(c => c !== currentClass).sort();
  if (autresClasses.length === 0) {
    alert('لا توجد أقسام أخرى لنقل التلميذ إليها.');
    return;
  }

  const message = 'إلى أي قسم تريد نقل التلميذ «' + eleve.name + '» ؟\n\nالأقسام المتاحة:\n' + autresClasses.join(' | ');
  const nouvelleClasse = prompt(message, autresClasses[0]);

  if (!nouvelleClasse) return;
  const dest = nouvelleClasse.trim();

  if (!db.classes.includes(dest)) {
    alert('هذا القسم غير موجود!');
    return;
  }
  if (dest === currentClass) {
    alert('التلميذ في هذا القسم بالفعل.');
    return;
  }

  eleve.class = dest;
  save();
  renderStudentList();
  toast('✅ تم نقل التلميذ إلى ' + dest);
}

export function renderStudentList() {
  const conteneur = $('studentList');
  const compteur = $('studentCount');
  if (!conteneur) return;
  
  const classe = $('classSelect').value;
  conteneur.replaceChildren();
  
  if (!classe) {
    compteur.textContent = '';
    conteneur.append(el('div', { class: 'empty-list', textContent: 'اختر قسماً لعرض التلاميذ.' }));
    return;
  }
  
  const eleves = db.students.filter(s => s.class === classe).sort((a, b) => collator.compare(a.name, b.name));
  compteur.textContent = 'عدد التلاميذ في القسم «' + classe + '»: ' + eleves.length;
  
  if (eleves.length === 0) {
    conteneur.append(el('div', { class: 'empty-list', textContent: 'لا يوجد تلاميذ في هذا القسم.' }));
    return;
  }
  
  eleves.forEach((s, i) => {
    const btnMove = el('button', {
      class: 'btn-delete',
      style: 'background:#dce9f8; color:#2563a8; margin-inline-end: 8px;',
      textContent: '↔ نقل',
      onclick: () => moveStudent(s.id, classe)
    });

    const btnDel = el('button', {
      class: 'btn-delete',
      textContent: '🗑 حذف',
      onclick: () => deleteStudent(s.id)
    });
    
    conteneur.append(el('div', { class: 'student-item' },
      el('span', { class: 'student-num', textContent: (i + 1) + '.' }),
      el('span', { class: 'student-name', textContent: s.name }),
      el('div', {}, btnMove, btnDel)
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