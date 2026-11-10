// src/features/grades.js
// Gère les notes, les moyennes et les copies manquantes.
import { db, save } from '../core/state.js';
import { $, el } from '../core/dom.js';
import { collator } from '../core/format.js';
import { exportToExcel } from '../core/excel.js';

const POIDS = { tp: 1, dc: 1, ds: 2 };
const NOTES_MAX = 20;

function fmt(n) {
    if (n === null || n === undefined) return '';
    return n.toFixed(2);
}
function parseNote(value) {
    if (value === '' || value === null || value === undefined) return null;
    const raw = String(value).trim().replace(',', '.');
    if (!/^\d+(\.\d+)?$/.test(raw)) return null;
    const n = Number(raw);
    if (!Number.isFinite(n) || n < 0 || n > NOTES_MAX) return null;
    return n;
}
function getNote(student, term, type) {
    return (student.g && student.g[term] && student.g[term][type]) ?? null;
}
function computeAverage(student, term) {
    const tp = parseNote(getNote(student, term, 'tp'));
    const dc = parseNote(getNote(student, term, 'dc'));
    const ds = parseNote(getNote(student, term, 'ds'));
    if (tp === null && dc === null && ds === null) return null;
    const t = tp ?? 0;
    const d = dc ?? 0;
    const s = ds ?? 0;
    return (t * POIDS.tp + d * POIDS.dc + s * POIDS.ds) / (POIDS.tp + POIDS.dc + POIDS.ds);
}
function computeAnnualAverage(student) {
    const m1 = computeAverage(student, '1');
    const m2 = computeAverage(student, '2');
    const m3 = computeAverage(student, '3');
    if (m1 === null || m2 === null || m3 === null) return null;
    return (m1 + 2 * m2 + 2 * m3) / 5;
}
function setNote(studentId, term, type, value) {
    const s = db.students.find(x => x.id === studentId);
    if (!s) return;
    const note = parseNote(value);
    if (!s.g) s.g = {};
    if (!s.g[term]) s.g[term] = {};
    if (note === null) {
        delete s.g[term][type];
    } else {
        s.g[term][type] = note;
    }
    save();
}

export function renderGradesClassSelect() {
    const sel = $('gClass');
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

function renderGradesStats(students, term, isAnnual) {
    const box = $('gStats');
    if (!box) return;
    box.replaceChildren();
    box.className = 'att-stats';

    const averages = students.map(s => {
        if (isAnnual) return computeAnnualAverage(s);
        return computeAverage(s, term);
    }).filter(v => v !== null);

    if (averages.length === 0) {
        box.append(el('div', { class: 'att-stat-card', style: 'background:#e6ece9;border-color:#5d6b69;color:#5d6b69' },
            el('span', { textContent: 'لا توجد معدلات' })
        ));
        return;
    }

    const sum = averages.reduce((a, b) => a + b, 0);
    const moy = sum / averages.length;
    const max = Math.max(...averages);
    const min = Math.min(...averages);
    const reussite = averages.filter(v => v >= 10).length;
    const pct = Math.round((reussite / averages.length) * 100);

    const cards = [
        { label: 'معدل القسم', value: fmt(moy), color: '#1f7a4d', bg: '#dcf2e5' },
        { label: 'أعلى معدل', value: fmt(max), color: '#2563a8', bg: '#dce9f8' },
        { label: 'أدنى معدل', value: fmt(min), color: '#b3261e', bg: '#fbe0dd' },
        { label: 'نسبة النجاح', value: pct + '%', color: '#9a5b00', bg: '#fdebc8' },
        { label: 'عدد المعدلات', value: averages.length + ' / ' + students.length, color: '#7a3fb5', bg: '#ece4f7' },
    ];

    cards.forEach(c => {
        box.append(el('div', { class: 'att-stat-card', style: 'background:' + c.bg + ';border-color:' + c.color },
            el('span', { class: 'att-stat-label', style: 'color:' + c.color }, c.label),
            el('b', { class: 'att-stat-value', style: 'color:' + c.color, textContent: c.value })
        ));
    });
}

export function renderGradesList() {
    const conteneur = $('gList');
    if (!conteneur) return;
    conteneur.replaceChildren();

    const classe = $('gClass').value;
    const term = $('gTerm').value;
    const isAnnual = term === 'A';

    const missingSection = $('examMissingSection');
    if (missingSection) {
        if (isAnnual || !classe) missingSection.classList.add('hidden');
        else missingSection.classList.remove('hidden');
    }

    if (!classe) {
        conteneur.append(el('div', { class: 'empty-list', textContent: 'اختر فصلاً لعرض التلاميذ.' }));
        const box = $('gStats'); if (box) box.replaceChildren();
        return;
    }

    const students = db.students
        .filter(s => s.class === classe)
        .sort((a, b) => collator.compare(a.name, b.name));

    if (students.length === 0) {
        conteneur.append(el('div', { class: 'empty-list', textContent: 'لا يوجد تلاميذ في هذا الفصل.' }));
        const box = $('gStats'); if (box) box.replaceChildren();
        return;
    }

    const averages = students.map(s => isAnnual ? computeAnnualAverage(s) : computeAverage(s, term));
    const sorted = averages.map((v, i) => ({ i, v })).filter(x => x.v !== null).sort((a, b) => b.v - a.v);
    const ranks = {};
    sorted.forEach((x, idx) => { ranks[x.i] = idx + 1; });

    const table = el('table', { class: 'dail-table' });
    const thead = el('thead');

    if (isAnnual) {
        thead.append(el('tr', {},
            el('th', { textContent: 'N°', class: 'col-n' }),
            el('th', { textContent: 'اسم التلميذ', class: 'col-name' }),
            el('th', { textContent: 'م1', style: 'background:#1f5c55;color:#fff;text-align:center' }),
            el('th', { textContent: 'م2', style: 'background:#1f5c55;color:#fff;text-align:center' }),
            el('th', { textContent: 'م3', style: 'background:#1f5c55;color:#fff;text-align:center' }),
            el('th', { textContent: 'المعدل السنوي', style: 'background:#7a3fb5;color:#fff;text-align:center' }),
            el('th', { textContent: 'الرتبة', style: 'background:#e0702b;color:#fff;text-align:center' }),
        ));
    } else {
        thead.append(el('tr', {},
            el('th', { textContent: 'N°', class: 'col-n' }),
            el('th', { textContent: 'اسم التلميذ', class: 'col-name' }),
            el('th', { textContent: 'TP', style: 'background:#1f5c55;color:#fff;text-align:center' }),
            el('th', { textContent: 'DC', style: 'background:#1f5c55;color:#fff;text-align:center' }),
            el('th', { textContent: 'DS', style: 'background:#1f5c55;color:#fff;text-align:center' }),
            el('th', { textContent: 'المعدل', style: 'background:#7a3fb5;color:#fff;text-align:center' }),
            el('th', { textContent: 'الرتبة', style: 'background:#e0702b;color:#fff;text-align:center' }),
        ));
    }
    table.append(thead);

    const tbody = el('tbody');
    students.forEach((s, i) => {
        const avg = averages[i];
        const rank = ranks[i];
        const tr = el('tr', {});

        tr.append(
            el('td', { class: 'col-n', textContent: (i + 1) }),
            el('td', { class: 'col-name', textContent: s.name })
        );

        if (isAnnual) {
            const m1 = computeAverage(s, '1');
            const m2 = computeAverage(s, '2');
            const m3 = computeAverage(s, '3');
            tr.append(
                el('td', { textContent: m1 === null ? '—' : fmt(m1) }),
                el('td', { textContent: m2 === null ? '—' : fmt(m2) }),
                el('td', { textContent: m3 === null ? '—' : fmt(m3) }),
            );
        } else {
            ['tp', 'dc', 'ds'].forEach(type => {
                const val = getNote(s, term, type);
                const inp = el('input', {
                    type: 'text', inputMode: 'decimal',
                    class: 'grade-input' + (val === null ? ' empty' : ''),
                    placeholder: '—',
                    value: val === null ? '' : String(val),
                });
                inp.onchange = () => {
                    const v = inp.value.trim();
                    const note = parseNote(v);
                    if (v !== '' && note === null) {
                        alert('يجب أن يكون العدد بين 0 و 20.');
                        inp.value = val === null ? '' : String(val);
                        return;
                    }
                    setNote(s.id, term, type, v);
                    renderGradesList();
                };
                tr.append(el('td', {}, inp));
            });
        }

        const avgCell = el('td', {
            class: 'avg-cell' + (avg !== null && avg < 10 ? ' low' : ''),
            textContent: avg === null ? '—' : fmt(avg),
        });
        tr.append(avgCell);

        const medal = rank === 1 ? '🥇 ' : rank === 2 ? '🥈 ' : rank === 3 ? '🥉 ' : '';
        const rankCell = el('td', {
            class: 'rank-cell' + (rank && rank <= 3 ? ' medal' : ''),
            textContent: rank ? medal + rank : '—',
        });
        tr.append(rankCell);
        tbody.append(tr);
    });

    table.append(tbody);
    conteneur.append(table);
    renderGradesStats(students, term, isAnnual);

    if (!isAnnual) renderMissingList();
}

// ============================================
// GESTION DES COPIES MANQUANTES
// ============================================
function isExamDone() {
    const classe = $('gClass').value;
    const term = $('gTerm').value;
    const exam = $('missingExam').value;
    if (!classe || !term || term === 'A') return false;
    const key = JSON.stringify([classe, term, exam]);
    return !!(db.examHeld && db.examHeld[key]);
}
function setExamDone(done) {
    const classe = $('gClass').value;
    const term = $('gTerm').value;
    const exam = $('missingExam').value;
    if (!classe || !term || term === 'A') return;
    const key = JSON.stringify([classe, term, exam]);
    if (!db.examHeld) db.examHeld = {};
    if (done) db.examHeld[key] = true;
    else delete db.examHeld[key];
    save();
}
export function renderMissingList() {
    const container = $('missingTables');
    const count = $('missingCount');
    const summary = $('missingSummary');
    if (!container) return;
    
    const classe = $('gClass').value;
    const term = $('gTerm').value;
    const exam = $('missingExam').value;
    container.replaceChildren();
    
    if (!classe || !term || term === 'A') {
        if (count) count.textContent = '';
        if (summary) summary.textContent = '';
        return;
    }
    
    const done = isExamDone();
    const examDoneCheckbox = $('examDone');
    if (examDoneCheckbox) examDoneCheckbox.checked = done;
    
    const students = db.students.filter(s => s.class === classe).sort((a, b) => collator.compare(a.name, b.name));
    const missing = students.filter(s => getNote(s, term, exam) === null);
    
    if (count) count.textContent = done ? 'عدد دون: ' + missing.length : 'الفرض لم ينجز بعد.';
    if (summary) {
        if (done) {
            const justified = missing.filter(s => s.gAbs && s.gAbs[term] && s.gAbs[term][exam] === 'excused').length;
            const unjustified = missing.filter(s => s.gAbs && s.gAbs[term] && s.gAbs[term][exam] === 'unexcused').length;
            const pending = missing.length - justified - unjustified;
            const graded = students.length - missing.length;
            summary.textContent = 'أعداد مسجلة: ' + graded + ' / ' + students.length + ' | مبرر: ' + justified + ' | غير مبرر: ' + unjustified + ' | غير محدد: ' + pending;
        } else {
            summary.textContent = '';
        }
    }
    
    if (!done) {
        container.append(el('p', { class: 'empty-list', textContent: 'ضع علامة »الفرض منجز« لإظهار القائمة.' }));
        return;
    }
    if (missing.length === 0) {
        container.append(el('p', { class: 'empty-list', textContent: 'جميع التلاميذ لديهم أعداد في هذا الفرض.' }));
        return;
    }
    
    const groups = { excused: [], unexcused: [], pending: [] };
    missing.forEach(s => {
        const status = s.gAbs && s.gAbs[term] && s.gAbs[term][exam] || 'pending';
        if (status === 'excused') groups.excused.push(s);
        else if (status === 'unexcused') groups.unexcused.push(s);
        else groups.pending.push(s);
    });
    
    const createGroupTable = (title, color, list, statusValue) => {
        if (list.length === 0) return;
        const section = el('div', { class: 'missing-group', style: 'border-inline-start-color:' + color });
        section.append(el('h4', { class: 'missing-group-title', style: 'color:' + color }, title + ' (' + list.length + ')'));
        
        const table = el('table', { class: 'missing-table' });
        const thead = el('thead');
        thead.append(el('tr', {},
            el('th', { textContent: 'N°' }),
            el('th', { textContent: 'اسم التلميذ' }),
            el('th', { textContent: 'تغيير الحالة' })
        ));
        table.append(thead);
        
        const tbody = el('tbody');
        list.forEach((s, i) => {
            const select = el('select', { class: 'situation-select' });
            [['pending', 'غير محدد'], ['excused', 'غياب مبرر'], ['unexcused', 'غياب غير مبرر']].forEach(([val, label]) => {
                const opt = el('option', { value: val, textContent: label });
                if (val === statusValue) opt.selected = true;
                select.append(opt);
            });
            select.onchange = () => {
                const student = db.students.find(x => x.id === s.id);
                if (!student) return;
                if (!student.gAbs) student.gAbs = {};
                if (!student.gAbs[term]) student.gAbs[term] = {};
                if (select.value === 'pending') delete student.gAbs[term][exam];
                else student.gAbs[term][exam] = select.value;
                save();
                renderMissingList();
            };
            tbody.append(el('tr', {},
                el('td', { textContent: (i + 1) }),
                el('td', { textContent: s.name, style: 'text-align:right;font-weight:700' }),
                el('td', {}, select),
            ));
        });
        table.append(tbody);
        section.append(table);
        container.append(section);
    };
    
    createGroupTable('🔵 غياب مبرر', '#2563a8', groups.excused, 'excused');
    createGroupTable('🔴 غياب غير مبرر', '#b3261e', groups.unexcused, 'unexcused');
    createGroupTable('🟡 غير محدد', '#9a5b00', groups.pending, 'pending');
}

export function exportMissing() {
    alert('تصدير Excel سيُضاف قريبًا.');
}
export function bindMissing() {
    const missingExamSelect = $('missingExam');
    const examDoneCheckbox = $('examDone');
    const expMissingBtn = $('expMissing');
    if (missingExamSelect) missingExamSelect.onchange = () => renderMissingList();
    if (examDoneCheckbox) {
        examDoneCheckbox.onchange = () => {
            setExamDone(examDoneCheckbox.checked);
            renderMissingList();
        };
    }
    if (expMissingBtn) expMissingBtn.onclick = exportMissing;
}
export function bindGrades() {
    const classSelect = $('gClass');
    const termSelect = $('gTerm');
    if (classSelect) classSelect.onchange = renderGradesList;
    if (termSelect) termSelect.onchange = renderGradesList;
    const btnExport = $('gExport');
    if (btnExport) btnExport.onclick = exportGrades;
    bindMissing();
    renderGradesClassSelect();
}
export function exportGrades() {
  const classe = $('gClass').value;
  if (!classe) { alert('اختر قسماً أولاً.'); return; }
  
  const term = $('gTerm').value;
  const isAnnual = term === 'A';
  const students = db.students.filter(s => s.class === classe).sort((a, b) => collator.compare(a.name, b.name));
  
  const data = students.map(s => {
    const row = { 'الاسم': s.name };
    if (isAnnual) {
      row['الثالثي الأول'] = computeAverage(s, '1')?.toFixed(2) || '—';
      row['الثالثي الثاني'] = computeAverage(s, '2')?.toFixed(2) || '—';
      row['الثالثي الثالث'] = computeAverage(s, '3')?.toFixed(2) || '—';
      row['المعدل السنوي'] = computeAnnualAverage(s)?.toFixed(2) || '—';
    } else {
      row['TP'] = getNote(s, term, 'tp') || '—';
      row['DC'] = getNote(s, term, 'dc') || '—';
      row['DS'] = getNote(s, term, 'ds') || '—';
      row['المعدل'] = computeAverage(s, term)?.toFixed(2) || '—';
    }
    return row;
  });
  
  exportToExcel(data, 'نقاط_' + classe + '_' + term, 'النقاط');
}