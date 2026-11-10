// src/features/monthly.js
// Rapport mensuel des absences (avec design moderne).
import { db, save } from '../core/state.js';
import { $, el } from '../core/dom.js';
import { collator } from '../core/format.js';

const THRESHOLD = 3; // seuil d'alerte

function currentMonth() {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
}

export function renderMonthlyClassSelect() {
    const sel = $('moClass');
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

function computeMonthly(students, month) {
    return students.map(s => {
        const totals = { excused: 0, unexcused: 0, late: 0 };
        Object.keys(db.records).forEach(key => {
            const [date, studentId] = key.split('|');
            if (studentId !== s.id) return;
            if (!date.startsWith(month)) return;
            const rec = db.records[key];
            if (rec.type in totals) totals[rec.type]++;
        });
        totals.total = totals.excused + totals.unexcused + totals.late;
        totals.alert = totals.unexcused >= THRESHOLD;
        return { student: s, totals };
    });
}

function renderMonthlyStats(rows) {
    const box = $('moStats');
    if (!box) return;
    box.replaceChildren();
    box.className = 'att-stats';

    if (rows.length === 0) {
        box.append(el('div', { class: 'att-stat-card', style: 'background:#e6ece9;border-color:#5d6b69;color:#5d6b69' },
            el('span', { textContent: 'لا توجد بيانات' })
        ));
        return;
    }

    const total = (k) => rows.reduce((acc, r) => acc + r.totals[k], 0);
    const nbAlert = rows.filter(r => r.totals.alert).length;

    const cards = [
        { label: 'إجمالي الغيابات', value: total('excused') + total('unexcused') + total('late'), color: '#5d6b69', bg: '#e6ece9' },
        { label: 'غياب مبرر', value: total('excused'), color: '#2563a8', bg: '#dce9f8' },
        { label: 'غياب غير مبرر', value: total('unexcused'), color: '#b3261e', bg: '#fbe0dd' },
        { label: 'تأخير', value: total('late'), color: '#9a5b00', bg: '#fdebc8' },
        { label: 'تلاميذ في حالة تنبيه', value: nbAlert, color: '#7a3fb5', bg: '#ece4f7' },
    ];

    cards.forEach(c => {
        box.append(el('div', { class: 'att-stat-card', style: 'background:' + c.bg + ';border-color:' + c.color },
            el('span', { class: 'att-stat-label', style: 'color:' + c.color }, c.label),
            el('b', { class: 'att-stat-value', style: 'color:' + c.color, textContent: c.value })
        ));
    });
}

export function renderMonthlyList() {
    const conteneur = $('moList');
    if (!conteneur) return;
    conteneur.replaceChildren();

    const classe = $('moClass').value;
    const month = $('moMonth').value;

    if (!classe || !month) {
        conteneur.append(el('div', { class: 'empty-list', textContent: 'اختر فصلاً وشهراً.' }));
        const box = $('moStats'); if (box) box.replaceChildren();
        return;
    }

    const students = db.students
        .filter(s => s.class === classe)
        .sort((a, b) => collator.compare(a.name, b.name));

    if (students.length === 0) {
        conteneur.append(el('div', { class: 'empty-list', textContent: 'لا يوجد تلاميذ في هذا الفصل.' }));
        const box = $('moStats'); if (box) box.replaceChildren();
        return;
    }

    const rows = computeMonthly(students, month);
    rows.sort((a, b) => b.totals.total - a.totals.total);
    renderMonthlyStats(rows);

    // On utilise le même tableau stylé que les présences
    const table = el('table', { class: 'dail-table' });
    const thead = el('thead');
    thead.append(el('tr', {},
        el('th', { textContent: 'N°', class: 'col-n' }),
        el('th', { textContent: 'اسم التلميذ', class: 'col-name' }),
        el('th', { textContent: 'غياب مبرر', style: 'text-align:center;background:#2563a8;color:#fff' }),
        el('th', { textContent: 'غياب غير مبرر', style: 'text-align:center;background:#b3261e;color:#fff' }),
        el('th', { textContent: 'تأخير', style: 'text-align:center;background:#9a5b00;color:#fff' }),
        el('th', { textContent: 'المجموع', style: 'text-align:center;background:#1f5c55;color:#fff' }),
        el('th', { textContent: 'تنبيه', style: 'text-align:center;background:#7a3fb5;color:#fff' })
    ));
    table.append(thead);

    const tbody = el('tbody');
    rows.forEach((r, i) => {
        const tr = el('tr', { class: r.totals.alert ? 'warn' : '' },
            el('td', { class: 'col-n', textContent: i + 1 }),
            el('td', { class: 'col-name', textContent: r.student.name }),
            el('td', { textContent: r.totals.excused, style: 'text-align:center;color:#2563a8;font-weight:700' }),
            el('td', { textContent: r.totals.unexcused, style: 'text-align:center;color:#b3261e;font-weight:700' }),
            el('td', { textContent: r.totals.late, style: 'text-align:center;color:#9a5b00;font-weight:700' }),
            el('td', { textContent: r.totals.total, style: 'text-align:center;font-weight:800;font-size:17px' }),
            el('td', { textContent: r.totals.alert ? '⚠️ تنبيه' : '—', style: 'text-align:center;font-weight:700' })
        );
        tbody.append(tr);
    });
    table.append(tbody);
    conteneur.append(table);
}

export function bindMonthly() {
    const classSelect = $('moClass');
    const monthInput = $('moMonth');
    if (monthInput) monthInput.value = currentMonth();
    if (classSelect) classSelect.onchange = renderMonthlyList;
    if (monthInput) monthInput.onchange = renderMonthlyList;
    renderMonthlyClassSelect();
}