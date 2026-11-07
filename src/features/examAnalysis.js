// src/features/examAnalysis.js
// Analyse un devoir question par question et par compétence.

import { db, save } from '../core/state.js';
import { $, el, toast } from '../core/dom.js';
import { collator } from '../core/format.js';

const ANALYSIS_KEY = 'examAnalyses';

// Structure de données :
// {
//   key: "7A|1|dc",  // classe|trimestre|type
//   class: "7A",
//   term: "1",
//   type: "dc",
//   questions: [
//     { id: "q1", ex: "Exercice 1", name: "Question 1a", max: 2, comp: "Restitution" },
//     ...
//   ],
//   scores: {
//     "studentId": { "q1": 1.5, "q2": 2, ... }
//   }
// }

/** Renvoie la clé unique pour une analyse. */
function getKey() {
  return $('anClass').value + '|' + $('anTerm').value + '|' + $('anType').value;
}

/** Récupère ou crée une analyse vide pour la sélection actuelle. */
function getAnalysis() {
  db[ANALYSIS_KEY] = db[ANALYSIS_KEY] || [];
  const key = getKey();
  let a = db[ANALYSIS_KEY].find(x => x.key === key);
  if (!a) {
    a = {
      key,
      class: $('anClass').value,
      term: $('anTerm').value,
      type: $('anType').value,
      questions: [],
      scores: {},
    };
    db[ANALYSIS_KEY].push(a);
  }
  return a;
}

/** Remplit le menu des classes. */
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

/** Affiche la liste des questions. */
function renderQuestions() {
  const box = $('anQuestions');
  if (!box) return;
  box.replaceChildren();

  const a = getAnalysis();
  if (a.questions.length === 0) {
    box.append(el('p', { class: 'hint', textContent: 'لا توجد أسئلة بعد. أضف سؤالاً أعلاه.' }));
    return;
  }

  const table = el('table', { class: 'an-table' });
  const thead = el('thead');
  thead.append(el('tr', {},
    el('th', { textContent: 'التمرين' }),
    el('th', { textContent: 'السؤال' }),
    el('th', { textContent: 'العدد الأقصى' }),
    el('th', { textContent: 'الكفاءة' }),
    el('th', { textContent: 'إجراء' }),
  ));
  table.append(thead);

  const tbody = el('tbody');
  a.questions.forEach(q => {
    const btnDel = el('button', {
      class: 'btn',
      textContent: '🗑️',
      style: 'background:#b3261e;padding:2px 8px;font-size:13px',
    });
    btnDel.onclick = () => {
      if (!confirm('حذف هذا السؤال؟')) return;
      a.questions = a.questions.filter(x => x.id !== q.id);
      // Nettoyer les scores associés
      for (const sid in a.scores) {
        delete a.scores[sid][q.id];
      }
      save();
      renderQuestions();
      renderScoresTable();
    };

    tbody.append(el('tr', {},
      el('td', { textContent: q.ex }),
      el('td', { textContent: q.name }),
      el('td', { textContent: q.max }),
      el('td', { textContent: q.comp }),
      el('td', {}, btnDel),
    ));
  });
  table.append(tbody);
  box.append(table);
}

/** Ajoute une question. */
export function addQuestion() {
  const ex = $('anExName').value.trim();
  const name = $('anQName').value.trim();
  const max = parseFloat($('anQMax').value);
  const comp = $('anQComp').value.trim();

  if (!ex) { alert('اكتب اسم التمرين.'); return; }
  if (!name) { alert('اكتب اسم السؤال.'); return; }
  if (isNaN(max) || max <= 0 || max > 20) { alert('العدد الأقصى يجب أن يكون بين 0.5 و 20.'); return; }
  if (!comp) { alert('اكتب الكفاءة.'); return; }

  const a = getAnalysis();
  a.questions.push({
    id: 'q' + Date.now(),
    ex,
    name,
    max,
    comp,
  });

  save();
  $('anQName').value = '';
  $('anQComp').value = '';
  renderQuestions();
  renderScoresTable();
  toast('✅ تمت إضافة السؤال');
}

/** Affiche le tableau de saisie des notes. */
function renderScoresTable() {
  const box = $('anScores');
  if (!box) return;
  box.replaceChildren();

  const classe = $('anClass').value;
  if (!classe) {
    box.append(el('p', { class: 'hint', textContent: 'اختر فصلاً أولاً.' }));
    return;
  }

  const a = getAnalysis();
  if (a.questions.length === 0) {
    box.append(el('p', { class: 'hint', textContent: 'أضف الأسئلة أولاً.' }));
    return;
  }

  const eleves = db.students
    .filter(s => s.class === classe)
    .sort((x, y) => collator.compare(x.name, y.name));

  if (eleves.length === 0) {
    box.append(el('p', { class: 'hint', textContent: 'لا يوجد تلاميذ في هذا الفصل.' }));
    return;
  }

  const table = el('table', { class: 'an-table' });
  const thead = el('thead');
  const headRow = el('tr', {});
  headRow.append(el('th', { textContent: 'التلميذ' }));
  a.questions.forEach(q => {
    headRow.append(el('th', { textContent: q.name + ' / ' + q.max }));
  });
  headRow.append(el('th', { textContent: 'المجموع' }));
  thead.append(headRow);
  table.append(thead);

  const tbody = el('tbody');
  eleves.forEach(s => {
    a.scores[s.id] = a.scores[s.id] || {};
    const tr = el('tr', {});
    tr.append(el('td', { textContent: s.name, style: 'font-weight:700' }));

    let total = 0;
    a.questions.forEach(q => {
      const current = a.scores[s.id][q.id];
      const inp = el('input', {
        type: 'number',
        min: 0,
        max: q.max,
        step: 0.5,
        value: current !== undefined ? current : '',
        style: 'width:70px;padding:4px;text-align:center',
      });
      inp.onchange = () => {
        const v = parseFloat(inp.value);
        if (inp.value === '') {
          delete a.scores[s.id][q.id];
        } else if (isNaN(v) || v < 0 || v > q.max) {
          alert('العدد يجب أن يكون بين 0 و ' + q.max);
          inp.value = current !== undefined ? current : '';
          return;
        } else {
          a.scores[s.id][q.id] = v;
        }
        save();
        renderScoresTable(); // Pour recalculer le total
      };
      if (current !== undefined) total += current;
      tr.append(el('td', {}, inp));
    });

    tr.append(el('td', { textContent: total.toFixed(2), style: 'font-weight:700;text-align:center' }));
    tbody.append(tr);
  });
  table.append(tbody);
  box.append(table);
}

/** Calcule et affiche l'analyse. */
export function analyze() {
  const box = $('anResults');
  if (!box) return;
  box.replaceChildren();

  const a = getAnalysis();
  if (a.questions.length === 0) {
    box.append(el('p', { class: 'hint', textContent: 'لا توجد أسئلة لتحليلها.' }));
    return;
  }

  const eleves = db.students.filter(s => s.class === a.class);
  if (eleves.length === 0) {
    box.append(el('p', { class: 'hint', textContent: 'لا يوجد تلاميذ.' }));
    return;
  }

  // --- Analyse par question ---
  const qStats = a.questions.map(q => {
    let totalEarned = 0;
    let count = 0;
    eleves.forEach(s => {
      const v = a.scores[s.id] ? a.scores[s.id][q.id] : undefined;
      if (v !== undefined) {
        totalEarned += v;
        count++;
      }
    });
    const avg = count > 0 ? totalEarned / count : 0;
    const rate = (avg / q.max) * 100;
    return { q, count, avg, rate };
  });

  // --- Analyse par compétence ---
  const compStats = {};
  qStats.forEach(stat => {
    const comp = stat.q.comp;
    if (!compStats[comp]) compStats[comp] = { totalEarned: 0, totalMax: 0, count: 0 };
    compStats[comp].totalEarned += stat.avg * stat.count;
    compStats[comp].totalMax += stat.q.max * stat.count;
    compStats[comp].count += stat.count;
  });

  // --- Affichage ---
  box.append(el('h3', { textContent: '📊 تحليل حسب السؤال', style: 'margin-top:20px' }));
  const qTable = el('table', { class: 'an-table' });
  qTable.append(el('thead', {}, el('tr', {},
    el('th', { textContent: 'التمرين' }),
    el('th', { textContent: 'السؤال' }),
    el('th', { textContent: 'الكفاءة' }),
    el('th', { textContent: 'معدل النقاط' }),
    el('th', { textContent: 'نسبة النجاح' }),
    el('th', { textContent: 'الحالة' }),
  )));
  const qBody = el('tbody');
  qStats.forEach(s => {
    const status = s.rate >= 75 ? '🟢 جيد' : s.rate >= 50 ? '🟡 متوسط' : '🔴 ضعيف';
    qBody.append(el('tr', {},
      el('td', { textContent: s.q.ex }),
      el('td', { textContent: s.q.name }),
      el('td', { textContent: s.q.comp }),
      el('td', { textContent: s.avg.toFixed(2) + ' / ' + s.q.max }),
      el('td', { textContent: s.rate.toFixed(1) + '%' }),
      el('td', { textContent: status }),
    ));
  });
  qTable.append(qBody);
  box.append(qTable);

  // --- Affichage par compétence ---
  box.append(el('h3', { textContent: '📊 تحليل حسب الكفاءة', style: 'margin-top:20px' }));
  const cTable = el('table', { class: 'an-table' });
  cTable.append(el('thead', {}, el('tr', {},
    el('th', { textContent: 'الكفاءة' }),
    el('th', { textContent: 'معدل النقاط' }),
    el('th', { textContent: 'نسبة النجاح' }),
    el('th', { textContent: 'الحالة' }),
  )));
  const cBody = el('tbody');
  Object.entries(compStats).forEach(([comp, stat]) => {
    const rate = stat.totalMax > 0 ? (stat.totalEarned / stat.totalMax) * 100 : 0;
    const status = rate >= 75 ? '🟢 جيد' : rate >= 50 ? '🟡 متوسط' : '🔴 ضعيف';
    cBody.append(el('tr', {},
      el('td', { textContent: comp }),
      el('td', { textContent: stat.totalEarned.toFixed(2) + ' / ' + stat.totalMax.toFixed(2) }),
      el('td', { textContent: rate.toFixed(1) + '%' }),
      el('td', { textContent: status }),
    ));
  });
  cTable.append(cBody);
  box.append(cTable);
}

/** Branche tous les événements. */
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