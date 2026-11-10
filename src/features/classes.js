// src/features/classes.js
// Gère les classes et les élèves avec un design moderne.
import { db, save } from '../core/state.js';
import { $, el, toast } from '../core/dom.js';
import { uid, collator } from '../core/format.js';
import { exportExcel } from '../core/excel.js';

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
        alert('أكتب اسم الفصل أولاً.');
        return;
    }
    if (db.classes.includes(nom)) {
        alert('الفصل موجود مسبقاً.');
        return;
    }
    db.classes.push(nom);
    save();
    input.value = '';
    renderClassSelect();
    renderStudentList();
    toast('✅ تمت إضافة الفصل: ' + nom);
}

/** Ajoute un élève à la classe sélectionnée. */
export function addStudent() {
    const classe = $('classSelect').value;
    const input = $('newStudent');
    const nom = input.value.trim().replace(/\s+/g, ' ');

    if (!classe) {
        alert('اختر فصلاً أولاً.');
        return;
    }
    if (!nom || nom.length < 2) {
        alert('اكتب اسم التلميذ كاملاً.');
        return;
    }

    const doublon = db.students.find(s => s.class === classe && s.name === nom);
    if (doublon) {
        alert('يوجد تلميذ بنفس الاسم في هذا الفصل.');
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

    if (!confirm('حذف التلميذ «' + eleve.name + '» نهائيًا؟')) return;

    db.students = db.students.filter(s => s.id !== id);

    // Supprimer aussi ses présences dans 'records'
    Object.keys(db.records).forEach(k => {
        if (k.split('|')[1] === id) delete db.records[k];
    });

    save();
    renderStudentList();
    toast('🗑️ تم حذف التلميذ');
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
        conteneur.append(el('div', { class: 'empty-list', textContent: 'اختر فصلاً لعرض التلاميذ.' }));
        return;
    }

    const eleves = db.students
        .filter(s => s.class === classe)
        .sort((a, b) => collator.compare(a.name, b.name));

    compteur.textContent = 'عدد التلاميذ في الفصل «' + classe + '»: ' + eleves.length;

    if (eleves.length === 0) {
        conteneur.append(el('div', { class: 'empty-list', textContent: 'لا يوجد تلاميذ في هذا الفصل بعد. أضف الأول.' }));
        return;
    }

    eleves.forEach((s, i) => {
        const btnDel = el('button', {
            class: 'btn-delete',
            textContent: '🗑️ حذف',
            onclick: () => deleteStudent(s.id),
        });

        conteneur.append(el('div', { class: 'student-item' },
            el('span', { class: 'student-num', textContent: (i + 1) + '.' }),
            el('span', { class: 'student-name', textContent: s.name }),
            btnDel,
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