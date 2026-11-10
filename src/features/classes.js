// src/features/classes.js
// Gère les classes et les élèves avec un design moderne et le transfert.
import { db, save } from '../core/state.js';
import { $, el, toast } from '../core/dom.js';
import { uid, collator } from '../core/format.js';

/** Rafraîchit le menu déroulant des classes. */
export function renderClassSelect() {
  const sel = $('classSelect');
  if (!sel) return;
  const ancienne = sel.value;
  sel.replaceChildren();
  sel.append(el('option', { value: '', textContent: '— اختر —' }));
  
  db.classes
    .slice()
    .sort((a, b) => collator.compare(a, b))
    .forEach(c => {
      const opt = el('option', { value: c, textContent: c });
      if (c === ancienne) opt.selected = true;
      sel.append(opt);
    });
}

/** Ajoute une classe. */
export function addClass() {
  const input = $('newClass');
  const nom = input.value.trim().replace(/\s+/g, ' ');
  if (!nom) {
    alert('اكتب اسم القسم أولاً.');
    return;
  }
  if (db.classes.includes(nom)) {
    alert('القسم موجود مسبقاً.');
    return;
  }
  db.classes.push(nom);
  save();
  input.value = '';
  renderClassSelect();
  renderStudentList();
  toast('✅ تمت إضافة القسم: ' + nom);
}

/** Ajoute un élève à la classe sélectionnée. */
export function addStudent() {
  const classe = $('classSelect').value;
  const input = $('newStudent');
  const nom = input.value.trim().replace(/\s+/g, ' ');
  
  if (!classe) {
    alert('اختر قسماً أولاً.');
    return;
  }
  if (!nom || nom.length < 2) {
    alert('اكتب الاسم الكامل للتلميذ.');
    return;
  }
  
  const doublon = db.students.find(s => s.class === classe && s.name === nom);
  if (doublon) {
    alert('يوجد تلميذ بنفس الاسم في هذا القسم.');
    return;
  }
  
  db.students.push({
    id: uid(),
    name: nom,
    class: classe,
  });
  
  save();
  input.value = '';
  renderStudentList();
  toast('✅ تمت إضافة التلميذ: ' + nom);
}

/** Supprime un élève. */
export function deleteStudent(id) {
  const eleve = db.students.find(s => s.id === id);
  if (!eleve) return;
  if (!confirm('حذف التلميذ «' + eleve.name + '» نهائياً؟')) return;
  
  db.students = db.students.filter(s => s.id !== id);
  
  // Supprimer aussi ses présences dans 'records'
  Object.keys(db.records).forEach(k => {
    if (k.split('|')[1] === id) delete db.records[k];
  });
  
  save();
  renderStudentList();
  toast('🗑 تم حذف التلميذ');
}

/** Transfère un élève vers une autre classe. */
function moveStudent(id, currentClass) {
  const eleve = db.students.find(s => s.id === id);
  if (!eleve) return;

  const autresClasses = db.classes.filter(c => c !== currentClass).sort((a, b) => collator.compare(a, b));
  
  if (autresClasses.length === 0) {
    alert('لا توجد أقسام أخرى لنقل التلميذ إليها. أضف قسماً جديداً أولاً.');
    return;
  }

  const message = 'إلى أي قسم تريد نقل التلميذ «' + eleve.name + '» ؟\n\nالأقسام المتاحة:\n' + autresClasses.join(' | ');
  const nouvelleClasse = prompt(message, autresClasses[0]);

  if (nouvelleClasse === null) return; // L'utilisateur a annulé

  const dest = nouvelleClasse.trim();
  if (!dest) return;

  if (!db.classes.includes(dest)) {
    alert('هذا القسم غير موجود! يرجى كتابة اسم القسم بالضبط كما هو في القائمة.');
    return;
  }

  if (dest === currentClass) {
    alert('التلميذ موجود بالفعل في هذا القسم.');
    return;
  }

  if (confirm('هل أنت متأكد من نقل «' + eleve.name + '» إلى قسم «' + dest + '» ؟')) {
    eleve.class = dest;
    save();
    renderStudentList();
    toast('✅ تم نقل التلميذ إلى ' + dest);
  }
}

/** Affiche la liste des élèves de la classe sélectionnée. */
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
  
  const eleves = db.students
    .filter(s => s.class === classe)
    .sort((a, b) => collator.compare(a.name, b.name));
    
  compteur.textContent = 'عدد التلاميذ في القسم «' + classe + '»: ' + eleves.length;
  
  if (eleves.length === 0) {
    conteneur.append(el('div', { class: 'empty-list', textContent: 'لا يوجد تلاميذ في هذا القسم. أضف الأول بعد.' }));
    return;
  }
  
  eleves.forEach((s, i) => {
    // Bouton de transfert
    const btnMove = el('button', {
      class: 'btn-delete',
      style: 'background:#dce9f8; color:#2563a8; margin-inline-end: 8px;',
      textContent: '↔ نقل',
      onclick: () => moveStudent(s.id, classe),
    });

    // Bouton de suppression
    const btnDel = el('button', {
      class: 'btn-delete',
      textContent: '🗑 حذف',
      onclick: () => deleteStudent(s.id),
    });
    
    conteneur.append(el('div', { class: 'student-item' },
      el('span', { class: 'student-num', textContent: (i + 1) + '.' }),
      el('span', { class: 'student-name', textContent: s.name }),
      el('div', {}, btnMove, btnDel)
    ));
  });
}

/** Branche tous les événements de cette page. */
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