// src/features/dashboard.js
// Vue d'ensemble de toutes les classes.

import { db } from '../core/state.js';
import { $, el } from '../core/dom.js';

/** Renvoie le mois actuel au format YYYY-MM. */
function currentMonth() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
}

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

/** Moyenne d'un élève pour un trimestre (formule tunisienne). */
function computeStudentAvg(student, term) {
  const g = student.g && student.g[term];
  if (!g) return null;
  const tp = Number(g.tp ?? 0);
  const dc = Number(g.dc ?? 0);
  const ds = Number(g.ds ?? 0);
  if (g.tp == null && g.dc == null && g.ds == null) return null;
  return (tp + dc + 2 * ds) / 4;
}

/** Compte les absences d'un élève sur un mois. */
function countAbsences(studentId, month) {
  let excused = 0, unexcused = 0, late = 0;
  Object.keys(db.records).forEach(key => {
    const [date, id] = key.split('|');
    if (id !== studentId) return;
    if (!date.startsWith(month)) return;
    const rec = db.records[key];
    if (rec.type === 'excused') excused++;
    if (rec.type === 'unexcused') unexcused++;
    if (rec.type === 'late') late++;
  });
  return { excused, unexcused, late, total: excused + unexcused + late };
}

/** Affiche les 5 cartes de stats. */
function renderCards() {
  const box = $('dashCards');
  if (!box) return;
  box.replaceChildren();

  const month = currentMonth();
  const date = today();
  const allStudents = db.students;
  const allClasses = db.classes;

  // Stats du jour
  let todayAbs = 0;
  allStudents.forEach(s => {
    const key = date + '|' + s.id;
    const rec = db.records[key];
    if (rec && (rec.type === 'unexcused' || rec.type === 'excused')) todayAbs++;
  });

  // Moyenne générale (toutes classes, trimestre 1)
  const allAvgs = allStudents
    .map(s => computeStudentAvg(s, '1'))
    .filter(v => v !== null);
  const globalAvg = allAvgs.length ? (allAvgs.reduce((a, b) => a + b, 0) / allAvgs.length) : 0;

  // Élèves en alerte
  const nbAlerts = allStudents.filter(s => countAbsences(s.id, month).unexcused >= 3).length;

  const cards = [
    ['blue',   '🏫', allClasses.length, 'فصول'],
    ['purple', '👥', allStudents.length, 'تلاميذ'],
    ['red',    '🚫', todayAbs, 'غياب اليوم'],
    ['green',  '🎯', globalAvg ? globalAvg.toFixed(2) : '—', 'معدل عام'],
    ['orange', '⚠️', nbAlerts, 'في حالة تنبيه'],
  ];

  cards.forEach(([cls, icon, value, label]) => {
    box.append(el('div', { class: 'dash-card ' + cls },
      el('span', { class: 'dash-icon', textContent: icon }),
      el('div', { class: 'dash-value', textContent: String(value) }),
      el('div', { class: 'dash-label', textContent: label }),
    ));
  });
}

/** Top 5 des élèves les plus absents ce mois. */
function renderTopAbsent() {
  const box = $('dashTopAbsent');
  if (!box) return;
  box.replaceChildren();

  const month = currentMonth();
  const rows = db.students.map(s => {
    const c = countAbsences(s.id, month);
    return { student: s, total: c.total };
  }).filter(r => r.total > 0).sort((a, b) => b.total - a.total).slice(0, 5);

  if (rows.length === 0) {
    box.append(el('div', { class: 'dash-empty', textContent: 'لا توجد غيابات هذا الشهر.' }));
    return;
  }

  const max = rows[0].total;
  const medals = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣'];

  rows.forEach((r, i) => {
    box.append(el('div', { class: 'dash-top-row' },
      el('span', { class: 'dash-rank', textContent: medals[i] }),
      el('span', { class: 'dash-name', textContent: r.student.name }),
      el('span', { class: 'dash-bar-mini' },
        el('i', { style: 'width:' + Math.round(r.total / max * 100) + '%' }),
      ),
      el('span', { class: 'dash-count', textContent: r.total }),
    ));
  });
}

/** Graphique des 7 derniers jours. */
function renderChart() {
  const box = $('dashChart');
  if (!box) return;
  box.replaceChildren();

  const date = today();
  const days = [];
  for (let i = 6; i >= 0; i--) {
    days.push(addDays(date, -i));
  }

  const counts = days.map(d => {
    let n = 0;
    Object.keys(db.records).forEach(key => {
      const [recDate] = key.split('|');
      if (recDate !== d) return;
      const rec = db.records[key];
      if (rec.type === 'excused' || rec.type === 'unexcused') n++;
    });
    return n;
  });

  const max = Math.max(1, ...counts);

  const bars = el('div', { class: 'dash-chart-bars' });
  days.forEach((d, i) => {
    const dayLabel = d.slice(5); // MM-DD
    const height = Math.max(2, Math.round(counts[i] / max * 100));
    bars.append(el('div', { class: 'dash-chart-bar' },
      el('div', { class: 'dash-bar-value', textContent: counts[i] }),
      el('div', { class: 'dash-bar-fill', style: 'height:' + height + 'px' }),
      el('div', { class: 'dash-bar-label', textContent: dayLabel }),
    ));
  });
  box.append(bars);
}

/** Moyennes par classe. */
function renderClassAvg() {
  const box = $('dashClassAvg');
  if (!box) return;
  box.replaceChildren();

  const rows = db.classes.map(c => {
    const students = db.students.filter(s => s.class === c);
    const avgs = students.map(s => computeStudentAvg(s, '1')).filter(v => v !== null);
    const moy = avgs.length ? (avgs.reduce((a, b) => a + b, 0) / avgs.length) : null;
    return { name: c, moy, count: students.length };
  });

  if (rows.length === 0) {
    box.append(el('div', { class: 'dash-empty', textContent: 'لا توجد فصول.' }));
    return;
  }

  rows.forEach(r => {
    const pct = r.moy === null ? 0 : Math.round(r.moy / 20 * 100);
    box.append(el('div', { class: 'dash-class-row' },
      el('span', { class: 'dash-class-name', textContent: r.name }),
      el('span', { class: 'dash-class-bar' },
        el('i', { style: 'width:' + pct + '%' }),
      ),
      el('span', { class: 'dash-class-value', textContent: r.moy === null ? '—' : r.moy.toFixed(2) }),
    ));
  });
}

/** Élèves en alerte. */
function renderAlerts() {
  const box = $('dashAlerts');
  if (!box) return;
  box.replaceChildren();

  const month = currentMonth();
  const alerts = db.students.map(s => {
    const c = countAbsences(s.id, month);
    return { student: s, unexcused: c.unexcused };
  }).filter(r => r.unexcused >= 3).sort((a, b) => b.unexcused - a.unexcused);

  if (alerts.length === 0) {
    box.append(el('div', { class: 'dash-empty', textContent: '✅ لا يوجد تلاميذ في حالة تنبيه.' }));
    return;
  }

  alerts.forEach(r => {
    box.append(el('div', { class: 'dash-alert-row' },
      el('span', { class: 'dash-alert-name', textContent: r.student.name + ' — ' + r.student.class }),
      el('span', { class: 'dash-alert-badge', textContent: r.unexcused + ' غياب غير مبرر' }),
    ));
  });
}

/** Fonction principale à appeler depuis main.js. */
export function renderDashboard() {
  renderCards();
  renderTopAbsent();
  renderChart();
  renderClassAvg();
  renderAlerts();
}