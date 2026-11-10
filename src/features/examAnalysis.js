// src/features/examAnalysis.js
// Analyse un devoir question par question (design moderne).
import { db, save } from '../core/state.js';
import { $, el, toast } from '../core/dom.js';
import { collator } from '../core/format.js';

const ANALYSIS_KEY = 'examAnalyses';

function getKey() {
    return $('anClass').value + '|' + $('anTerm').value + '|' + $('anType').value;
}

function getAnalysis() {
    db[ANALYSIS_KEY] = db[ANALYSIS_KEY] || [];
    const key = getKey();
    let a = db[ANALYSIS_KEY].find(x => x.key === key);
    if (!a) {
        a = { key, class: $('anClass').value, term: $('anTerm').value, type: $('anType').value, questions: [], scores: {} };
        db[ANALYSIS_KEY].push(a);
    }
    return a;
}

export function renderAnalysisClassSelect() {
    const sel = $('anClass');
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

function renderQuestions() {
    const box = $('anQuestions');
    if (!box) return;
    box.replaceChildren();
    const a = getAnalysis();
    if (a.questions.length === 0) {
        box.append(el('p', { class: 'hint', textContent: 'لا توجد أسئلة بعد. أضف سؤالاً أعلاه.' }));
        return;
    }
    const table = el('table', { class: 'dail-table' });
    const thead = el('thead');
    thead.append(el('tr', {},
        el('th', { textContent: 'التمرين', style: 'text-align:center' }),
        el('th', { textContent: 'السؤال', class: 'col-name' }),
        el('th', { textContent: 'العدد الأقصى', style: 'text-align:center' }),
        el('th', { textContent: 'الكفاءة', style: 'text-align:center' }),
        el('th', { textContent: 'إجراء', class: 'col-del' })
    ));
    table.append(thead);
    const tbody = el('tbody');
    a.questions.forEach(q => {
        const btnDel = el('button', {
            class: 'btn-icon-sm',
            textContent: '🗑️',
            title: 'حذف',
            style: 'background:#fee2e2;color:#b3261e',
            onclick: () => {
                if (!confirm('حذف هذا السؤال؟')) return;
                a.questions = a.questions.filter(x => x.id !== q.id);
                for (const sid in a.scores) delete a.scores[sid][q.id];
                save();
                renderQuestions();
                renderScoresTable();
            }
        });
        tbody.append(el('tr', {},
            el('td', { textContent: q.ex, style: 'text-align:center' }),
            el('td', { textContent: q.name }),
            el('td', { textContent: q.max, style: 'text-align:center' }),
            el('td', { textContent: q.comp, style: 'text-align:center' }),
            el('td', { textContent: '' }, btnDel)
        ));
    });
    table.append(tbody);
    box.append(table);
}

export function addQuestion() {
    const ex = $('anExName').value.trim();
    const name = $('anQName').value.trim();
    const max = parseFloat($('anQMax').value);
    const comp = $('anQComp').value.trim();
    if (!ex) { alert('اكتب اسم التمرين.'); return; }
    if (!name) { alert('اكتب اسم السؤال.'); return; }
    if (isNaN(max) || max <= 0 || max > 20) { alert('يجب أن يكون العدد الأقصى بين 0.5 و 20.'); return; }
    if (!comp) { alert('اكتب الكفاءة.'); return; }
    const a = getAnalysis();
    a.questions.push({ id: 'q' + Date.now(), ex, name, max, comp });
    save();
    $('anQName').value = '';
    $('anQComp').value = '';
    renderQuestions();
    renderScoresTable();
    toast('✅ تمت إضافة السؤال');
}

function renderScoresTable() {
    const box = $('anScores');
    if (!box) return;
    box.replaceChildren();
    const classe = $('anClass').value;
    if (!classe) { box.append(el('p', { class: 'hint', textContent: 'اختر فصلاً أولاً.' })); return; }
    const a = getAnalysis();
    if (a.questions.length === 0) { box.append(el('p', { class: 'hint', textContent: 'أضف الأسئلة أولاً.' })); return; }
    const eleves = db.students.filter(s => s.class === classe).sort((x, y) => collator.compare(x.name, y.name));
    if (eleves.length === 0) { box.append(el('p', { class: 'hint', textContent: 'لا يوجد تلاميذ في هذا الفصل.' })); return; }
    
    const table = el('table', { class: 'dail-table' });
    const thead = el('thead');
    const headRow = el('tr', {});
    headRow.append(el('th', { textContent: 'التلميذ', class: 'col-name' }));
    a.questions.forEach(q => {
        headRow.append(el('th', { textContent: q.name + ' / ' + q.max, style: 'text-align:center' }));
    });
    headRow.append(el('th', { textContent: 'المجموع', style: 'text-align:center' }));
    thead.append(headRow);
    table.append(thead);

    const tbody = el('tbody');
    eleves.forEach(s => {
        a.scores[s.id] = a.scores[s.id] || {};
        const tr = el('tr', {});
        tr.append(el('td', { textContent: s.name }));
        let total = 0;
        a.questions.forEach(q => {
            const current = a.scores[s.id][q.id];
            const inp = el('input', {
                type: 'number', min: 0, max: q.max, step: 0.5,
                value: current !== undefined ? current : '',
                class: 'grade-input',
                style: 'width:60px'
            });
            inp.onchange = () => {
                const v = parseFloat(inp.value);
                if (inp.value === '') delete a.scores[s.id][q.id];
                else if (isNaN(v) || v < 0 || v > q.max) { alert('العدد يجب أن يكون بين 0 و ' + q.max); inp.value = current !== undefined ? current : ''; return; }
                else a.scores[s.id][q.id] = v;
                save();
                renderScoresTable();
            };
            if (current !== undefined) total += current;
            tr.append(el('td', { textContent: '', style: 'text-align:center' }, inp));
        });
        tr.append(el('td', { textContent: total.toFixed(2), style: 'text-align:center;font-weight:800' }));
        tbody.append(tr);
    });
    table.append(tbody);
    box.append(table);
}

export function analyze() {
    const box = $('anResults');
    if (!box) return;
    box.replaceChildren();
    const a = getAnalysis();
    if (a.questions.length === 0) { box.append(el('p', { class: 'hint', textContent: 'لا توجد أسئلة لتحليلها.' })); return; }
    const eleves = db.students.filter(s => s.class === a.class);
    if (eleves.length === 0) { box.append(el('p', { class: 'hint', textContent: 'لا يوجد تلاميذ.' })); return; }

    const qStats = a.questions.map(q => {
        let totalEarned = 0, count = 0;
        eleves.forEach(s => {
            const v = a.scores[s.id] ? a.scores[s.id][q.id] : undefined;
            if (v !== undefined) { totalEarned += v; count++; }
        });
        const avg = count > 0 ? totalEarned / count : 0;
        const rate = (avg / q.max) * 100;
        return { q, count, avg, rate };
    });

    box.append(el('h3', { textContent: '📊 تحليل حسب السؤال', style: 'margin-top:20px;color:#555db0' }));
    const qTable = el('table', { class: 'dail-table' });
    qTable.append(el('thead', {}, el('tr', {},
        el('th', { textContent: 'التمرين', style: 'text-align:center' }),
        el('th', { textContent: 'السؤال', class: 'col-name' }),
        el('th', { textContent: 'الكفاءة', style: 'text-align:center' }),
        el('th', { textContent: 'معدل النقاط', style: 'text-align:center' }),
        el('th', { textContent: 'نسبة النجاح', style: 'text-align:center' }),
    )));
    const qBody = el('tbody');
    qStats.forEach(s => {
        qBody.append(el('tr', {},
            el('td', { textContent: s.q.ex, style: 'text-align:center' }),
            el('td', { textContent: s.q.name }),
            el('td', { textContent: s.q.comp, style: 'text-align:center' }),
            el('td', { textContent: s.avg.toFixed(2) + ' / ' + s.q.max, style: 'text-align:center' }),
            el('td', { textContent: s.rate.toFixed(1) + '%', style: 'text-align:center;font-weight:800;color:' + (s.rate >= 50 ? '#1f7a4d' : '#b3261e') }),
        ));
    });
    qTable.append(qBody);
    box.append(qTable);
}

export function bindAnalysis() {
    const classSel = $('anClass');
    const termSel = $('anTerm');
    const typeSel = $('anType');
    const addBtn = $('anAddQ');
    const saveBtn = $('anSave');
    const loadBtn = $('anLoad');
    const analyzeBtn = $('anAnalyze');
    if (classSel) classSel.onchange = () => { renderQuestions(); renderScoresTable(); };
    if (termSel) termSel.onchange = () => { renderQuestions(); renderScoresTable(); };
    if (typeSel) typeSel.onchange = () => { renderQuestions(); renderScoresTable(); };
    if (addBtn) addBtn.onclick = addQuestion;
    if (saveBtn) saveBtn.onclick = () => { save(); toast('✅ تم الحفظ'); };
    if (loadBtn) loadBtn.onclick = () => { renderQuestions(); renderScoresTable(); };
    if (analyzeBtn) analyzeBtn.onclick = analyze;
    renderAnalysisClassSelect();
    renderQuestions();
    renderScoresTable();
}