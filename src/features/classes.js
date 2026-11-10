// src/features/classes.js
// Gère les classes et les élèves avec un design moderne et le transfert via popup.
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
  
  db.classes.slice().sort((a, b) => collator.compare(a, b)).forEach(c => {
    const opt = el('option', { value: c, textContent: c });
    if (c === ancienne) opt.selected = true;
    sel.append(opt);
  });

  // Afficher ou cacher le bouton de suppression selon si une classe est sélectionnée
  const deleteBtn = $('deleteClassBtn');
  if (deleteBtn) {
    deleteBtn.style.display = sel.value ? 'block' : 'none';
  }
}

/** Ajoute une classe. */
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

/** Supprime une classe et ses élèves. */
export function deleteClass() {
  const classe = $('classSelect').value;
  if (!classe) return;

  const eleves = db.students.filter(s => s.class === classe);
  const nbEleves = eleves.length;

  let message = 'هل أنت متأكد من حذف القسم «' + classe + '» نهائياً؟';
  if (nbEleves > 0) {
    message += '\n\n⚠ تحذير: سيتم حذف ' + nbEleves + ' تلميذاً موجوداً في هذا القسم، بالإضافة إلى جميع نقاطهم وغياباتهم!';
  }

  if (!confirm(message)) return;

  // 1. Supprimer la classe
  db.classes = db.classes.filter(c => c !== classe);

  // 2. Récupérer les IDs des élèves à supprimer
  const idsToDelete = eleves.map(e => e.id);

  // 3. Supprimer les élèves
  db.students = db.students.filter(s => s.class !== classe);

  // 4. Supprimer toutes leurs données (absences, notes dans records, discipline, agenda)
  Object.keys(db.records).forEach(k => {
    if (idsToDelete.includes(k.split('|')[1])) delete db.records[k];
  });
  
  if (db.disciplineRecords) {
    db.disciplineRecords = db.disciplineRecords.filter(r => !idsToDelete.includes(r.studentId));
  }
  
  if (db.classAgenda) {
    db.classAgenda = db.classAgenda.filter(a => a.class !== classe);
  }

  // 5. Sauvegarder et rafraîchir
  save();
  renderClassSelect();
  renderStudentList();
  toast('🗑 تم حذف القسم والتلاميذ المرتبطين به.');
}

/** Ajoute un élève à la classe sélectionnée. */
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

/** Supprime un élève. */
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

/** Ouvre une fenêtre pour transférer un élève vers une autre classe. */
function moveStudent(id, currentClass) {
  const eleve = db.students.find(s => s.id === id);
  if (!eleve) return;

  const autresClasses = db.classes.filter(c => c !== currentClass).sort((a, b) => collator.compare(a, b));
  
  if (autresClasses.length === 0) {
    alert('لا توجد أقسام أخرى لنقل التلميذ إليها. أضف قسماً جديداً أولاً.');
    return;
  }

  // Création de la fenêtre modale
  const ov = el('div', { class: 'ov' });
  const box = el('div', { class: 'ovbox' });
  
  box.append(el('h3', { textContent: 'نقل التلميذ: ' + eleve.name, style: 'margin-top:0;color:#2563a8' }));
  box.append(el('p', { class: 'hint', textContent: 'القسم الحالي: ' + currentClass }));

  // Liste déroulante
  const select = el('select', { class: 'dail-class-select', style: 'width:100%;margin:15px 0;font-size:18px' });
  autresClasses.forEach(c => {
    select.append(el('option', { value: c, textContent: c }));
  });
  box.append(select);

  // Boutons d'action
  const btnCancel = el('button', { class: 'btn alt', type: 'button', textContent: 'إلغاء', style: 'flex:1' });
  btnCancel.onclick = () => ov.remove();

  const btnConfirm = el('button', { class: 'btn', type: 'button', textContent: 'تأكيد النقل', style: 'flex:1;background:#2563a8' });
  btnConfirm.onclick = () => {
    const dest = select.value;
    eleve.class = dest;
    save();
    ov.remove();
    renderStudentList();
    toast('✅ تم نقل التلميذ إلى ' + dest);
  };

  box.append(el('div', { style: 'display:flex; gap:10px; margin-top:10px' }, btnCancel, btnConfirm));
  
  ov.append(box);
  ov.onclick = (e) => { if (e.target === ov) ov.remove(); };
  document.body.append(ov);
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
  
  const eleves = db.students.filter(s => s.class === classe).sort((a, b) => collator.compare(a.name, b.name));
  compteur.textContent = 'عدد التلاميذ في القسم «' + classe + '»: ' + eleves.length;
  
  if (eleves.length === 0) {
    conteneur.append(el('div', { class: 'empty-list', textContent: 'لا يوجد تلاميذ في هذا القسم.' }));
    return;
  }
  
  eleves.forEach((s, i) => {
    const btnMove = el('button', {
      class: 'btn-delete',
      style: 'background:#dce9f8; color:#2563a8; margin-inline-end: 8px; border: 1px solid #2563a8;',
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
      el('div', { style: 'display:flex; gap:5px; align-items:center;' }, btnMove, btnDel)
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
  
  if (sel) {
    sel.onchange = () => {
      renderStudentList();
      renderClassSelect(); // Pour rafraîchir l'affichage du bouton supprimer
    };
  }
  
  const deleteClassBtn = $('deleteClassBtn');
  if (deleteClassBtn) deleteClassBtn.onclick = deleteClass;

  const inputClass = $('newClass');
  const inputStudent = $('newStudent');
  
  if (inputClass) inputClass.onkeydown = (e) => { if (e.key === 'Enter') addClass(); };
  if (inputStudent) inputStudent.onkeydown = (e) => { if (e.key === 'Enter') addStudent(); };

  // GESTION DE L'IMPORT EXCEL
  const importBtn = $('importExcelBtn');
  const importFile = $('importExcelFile');

  if (importBtn && importFile) {
    importBtn.onclick = () => importFile.click();

    importFile.onchange = (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const data = new Uint8Array(event.target.result);
          const workbook = XLSX.read(data, { type: 'array' });
          const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
          const rows = XLSX.utils.sheet_to_json(firstSheet);

          if (rows.length === 0) {
            alert('الملف فارغ أو غير صالح.');
            return;
          }

          let count = 0;
          let newClasses = 0;

          rows.forEach(row => {
            const nomClasse = String(row['القسم'] || row['Classe'] || row['Class'] || '').trim();
            const nomEleve = String(row['اسم التلميذ'] || row['Nom'] || row['Name'] || row['التلميذ'] || '').trim();

            if (!nomClasse || !nomEleve) return;

            if (!db.classes.includes(nomClasse)) {
              db.classes.push(nomClasse);
              newClasses++;
            }

            const existe = db.students.find(s => s.class === nomClasse && s.name === nomEleve);
            if (!existe) {
              db.students.push({
                id: uid(),
                name: nomEleve,
                class: nomClasse
              });
              count++;
            }
          });

          save();
          renderClassSelect();
          renderStudentList();
          importFile.value = '';
          
          let msg = '✅ تم الاستيراد بنجاح!\n';
          msg += 'تلاميذ جدد: ' + count + '\n';
          if (newClasses > 0) msg += 'أقسام جديدة: ' + newClasses;
          alert(msg);

        } catch (err) {
          console.error(err);
          alert('حدث خطأ أثناء قراءة الملف. تأكد من أنه ملف Excel صالح.');
        }
      };
      reader.readAsArrayBuffer(file);
    };
  }
}