// src/features/attendance.js
// Gère les présences avec un design moderne.
import { db, save } from '../core/state.js';
import { $, el, toast } from '../core/dom.js';
import { collator } from '../core/format.js';

const T = {
    present: { label: 'حاضر', color: '#1f7a4d', bg: '#dcf2e5', icon: '🟢' },
    excused: { label: 'غياب مبرر', color: '#2563a8', bg: '#dce9f8', icon: '🔵' },
    unexcused: { label: 'غياب غير مبرر', color: '#b3261e', bg: '#fbe0dd', icon: '🔴' },
    late: { label: 'تأخير', color: '#9a5b00', bg: '#fdebc8', icon: '🟠' },
    expelled: { label: 'مطرود من الحصة', color: '#7a3fb5', bg: '#ece4f7', icon: '🟣' }
};
const R = { temp: 'مفصول مؤقتًا', perm: 'مفصول نهائيًا' };

function todayStr() {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
function curDate() { return $('attDate')?.value || todayStr(); }
function curClass() { return $('attClass')?.value || ''; }

function effStatus(s, date) {
    if (!s.status) return '';
    if (s.from && date < s.from) return '';
    if (s.status === 'temp' && s.to && date > s.to) return '';
    return s.status;
}
function getRec(id, date) {
    return Object.assign({ type: 'present', reason: '', time: '', lateMinutes: '' }, db.records[date + '|' + id]);
}
function setRec(id, date, patch) {
    const k = date + '|' + id;
    const r = Object.assign(getRec(id, date), patch);
    if (r.type === 'present') {
        delete db.records[k];
    } else {
        db.records[k] = r;
    }
    save();
}
function classStudents() {
    return db.students.filter(s => s.class === curClass()).sort((a, b) => collator.compare(a.name, b.name));
}
function shade(hex, f) {
    const n = parseInt(hex.slice(1), 16);
    const c = x => Math.max(0, Math.min(255, Math.round(x * f)));
    return 'rgb(' + c(n >> 16) + ',' + c((n >> 8) & 255) + ',' + c(n & 255) + ')';
}
function schoolYear(dateStr) {
    const y = +dateStr.slice(0, 4), m = +dateStr.slice(5, 7);
    return m >= 9 ? y + '-' + (y + 1) : (y - 1) + '-' + y;
}

export function renderAttClassSelect() {
    const sel = $('attClass');
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

function renderStats() {
    const box = $('attStats');
    if (!box) return;
    box.replaceChildren();
    box.className = 'att-stats';
    const list = classStudents();
    if (list.length === 0) return;

    const date = curDate();
    const counts = { present: 0, excused: 0, unexcused: 0, late: 0, expelled: 0 };
    list.forEach(s => {
        if (effStatus(s, date)) return;
        const type = getRec(s.id, date).type;
        if (counts[type] !== undefined) counts[type]++;
    });
    const total = list.length;
    const cards = [
        { label: 'المجموع', value: total, color: '#5d6b69', bg: '#e6ece9', icon: '👥' },
        { label: 'حاضر', value: counts.present, color: '#1f7a4d', bg: '#dcf2e5', icon: '🟢' },
        { label: 'مبرر', value: counts.excused, color: '#2563a8', bg: '#dce9f8', icon: '🔵' },
        { label: 'غير مبرر', value: counts.unexcused, color: '#b3261e', bg: '#fbe0dd', icon: '🔴' },
        { label: 'تأخير', value: counts.late, color: '#9a5b00', bg: '#fdebc8', icon: '🟠' },
        { label: 'مطرود', value: counts.expelled, color: '#7a3fb5', bg: '#ece4f7', icon: '🟣' }
    ];
    cards.forEach(c => {
        box.append(el('div', { class: 'att-stat-card', style: 'background:' + c.bg + ';border-color:' + c.color },
            el('span', { class: 'att-stat-label', style: 'color:' + c.color }, c.icon + ' ' + c.label),
            el('b', { class: 'att-stat-value', style: 'color:' + c.color, textContent: c.value })
        ));
    });
    renderPie(counts, total);
}

function renderPie(counts, total) {
    const box = $('dayPies');
    if (!box) return;
    box.replaceChildren();
    if (total === 0) return;
    const items = [
        ['حاضر', counts.present, '#1f7a4d'], ['مبرر غياب', counts.excused, '#2563a8'],
        ['غير مبرر', counts.unexcused, '#b3261e'], ['تأخير', counts.late, '#9a5b00'],
        ['مطرود', counts.expelled, '#7a3fb5']
    ].filter(x => x[1] > 0);
    const tot = items.reduce((a, b) => a + b[1], 0);
    if (tot === 0) return;

    const NS = 'http://www.w3.org/2000/svg';
    const cx = 150, cy = 90, rx = 100, ry = 55, H = 20, TAU = Math.PI * 2;
    const fx = n => n.toFixed(2);
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '0 0 300 200');
    svg.setAttribute('width', '100%');
    svg.setAttribute('height', '220');
    svg.style.maxWidth = '340px';
    svg.style.display = 'block';
    svg.style.margin = '0 auto';

    const mk = (tag, at) => {
        const n = document.createElementNS(NS, tag);
        for (const k in at) n.setAttribute(k, at[k]);
        return n;
    };
    const P = a => [cx + rx * Math.cos(a), cy + ry * Math.sin(a)];

    svg.append(mk('ellipse', { cx, cy: cy + H + 6, rx: rx + 6, ry: ry + 6, fill: 'rgba(0,0,0,0.15)' }));

    const segs = [];
    let a = -Math.PI / 2;
    items.forEach(([label, value, color]) => {
        if (value <= 0) return;
        const f = value / tot;
        const a0 = a, a1 = a + f * TAU;
        a = a1;
        segs.push({ label, value, color, f, a0, a1 });
    });

    const norm = x => ((x % TAU) + TAU) % TAU;
    segs.forEach(s => {
        const A0 = norm(s.a0), A1 = A0 + (s.a1 - s.a0);
        [[0, Math.PI], [TAU, TAU + Math.PI]].forEach(([lo, hi]) => {
            const x0 = Math.max(A0, lo), x1 = Math.min(A1, hi);
            if (x1 - x0 < 1e-6) return;
            const [ax, ay] = P(x0), [bx, by] = P(x1);
            const lg = (x1 - x0) > Math.PI ? 1 : 0;
            svg.append(mk('path', {
                d: 'M' + fx(ax) + ' ' + fx(ay) + 'L' + fx(ax) + ' ' + fx(ay + H) + 'A' + rx + ' ' + ry + ' 0 ' + lg + ' 1 ' + fx(bx) + ' ' + fx(by + H) + 'L' + fx(bx) + ' ' + fx(by) + 'A' + rx + ' ' + ry + ' 0 ' + lg + ' 0 ' + fx(ax) + ' ' + fx(ay) + 'Z',
                fill: shade(s.color, 0.6)
            }));
        });
    });

    segs.forEach(s => {
        if (s.f >= 0.9999) {
            svg.append(mk('ellipse', { cx, cy, rx, ry, fill: s.color, stroke: '#fff', 'stroke-width': 1.5 }));
        } else {
            const [x0, y0] = P(s.a0), [x1, y1] = P(s.a1);
            const lg = (s.a1 - s.a0) > Math.PI ? 1 : 0;
            svg.append(mk('path', {
                d: 'M' + cx + ' ' + cy + 'L' + fx(x0) + ' ' + fx(y0) + 'A' + rx + ' ' + ry + ' 0 ' + lg + ' 1 ' + fx(x1) + ' ' + fx(y1) + 'Z',
                fill: s.color, stroke: '#fff', 'stroke-width': 1.5
            }));
        }
    });

    segs.forEach(s => {
        const pc = Math.round(100 * s.f);
        if (pc < 4) return;
        const m = (s.a0 + s.a1) / 2;
        const X = fx(cx + rx * 0.6 * Math.cos(m)), Y = fx(cy + ry * 0.6 * Math.sin(m) + 5);
        const t1 = mk('text', { x: X, y: Y, 'text-anchor': 'middle', 'font-size': '14', 'font-weight': '800', fill: 'none', stroke: 'rgba(0,0,0,0.7)', 'stroke-width': '3', 'stroke-linejoin': 'round', style: 'pointer-events:none' });
        t1.textContent = pc + '%'; svg.append(t1);
        const t2 = mk('text', { x: X, y: Y, 'text-anchor': 'middle', 'font-size': '14', 'font-weight': '800', fill: '#fff', style: 'pointer-events:none' });
        t2.textContent = pc + '%'; svg.append(t2);
    });
    
    const wrap = el('div', { style: 'text-align:center;padding:10px 0' }, svg);
    box.append(wrap);
}

export function renderAttList() {
    const tb = $('tbody');
    if (!tb) return;
    tb.replaceChildren();

    const date = curDate();
    const title = $('dailyTitle');
    if (title) {
        title.textContent = '📋 الفصل: ' + (curClass() || '—') + ' | السنة الدراسية ' + schoolYear(date) + ' | ' + date;
    }

    if (!curClass()) {
        tb.append(el('tr', {}, el('td', { colSpan: 6, class: 'empty-list', textContent: 'اختر فصلاً لعرض التلاميذ.' })));
        return;
    }

    const q = ($('search')?.value || '').trim().toLowerCase();
    const list = classStudents().filter(s => !q || s.name.toLowerCase().includes(q));

    if (list.length === 0) {
        tb.append(el('tr', {}, el('td', { colSpan: 6, class: 'empty-list', textContent: 'لا يوجد تلاميذ.' })));
        return;
    }

    list.forEach((s, i) => {
        const ef = effStatus(s, date);
        const rec = getRec(s.id, date);
        const info = T[rec.type] || T.present;
        const tr = el('tr', { class: ef ? 'out' : '' });

        tr.append(el('td', { class: 'col-n', textContent: i + 1 }));
        tr.append(el('td', { class: 'col-name', textContent: s.name }));

        const statusBtn = el('button', {
            type: 'button', class: 'status-btn',
            style: 'background:' + info.bg + ';color:' + info.color + ';border-color:' + info.color,
            textContent: info.label + ' ▾', disabled: !!ef,
        });
        statusBtn.onclick = () => openStatusModal(s, date, () => {
            renderAttList();
            renderStats();
        });
        tr.append(el('td', { class: 'col-status' }, statusBtn));

        const reasonInput = el('input', {
            type: 'text', class: 'reason-input', placeholder: 'السبب...', value: rec.reason || '',
            disabled: rec.type === 'present' || !!ef,
        });
        reasonInput.oninput = () => setRec(s.id, date, { reason: reasonInput.value });
        tr.append(el('td', { class: 'col-reason' }, reasonInput));

        const select = el('select', { class: 'situation-select', disabled: !!ef });
        [['', 'عادي'], ['temp', R.temp], ['perm', R.perm]].forEach(([v, label]) => {
            const opt = el('option', { value: v, textContent: label });
            if ((s.status || '') === v) opt.selected = true;
            select.append(opt);
        });
        select.onchange = () => {
            const L = db.students.find(x => x.id === s.id);
            if (!L) return;
            const v = select.value;
            if (v === 'perm' && !confirm('تأكيد الفصل النهائي للتلميذ «' + s.name + '»؟')) {
                select.value = s.status || '';
                return;
            }
            if (v) { L.status = v; L.from = L.from || date; if (v === 'perm') delete L.to; }
            else { delete L.status; delete L.from; delete L.to; }
            save();
            renderAttList();
        };
        tr.append(el('td', { class: 'col-situation' }, select));

        tr.append(el('td', { class: 'col-del' },
            el('button', { class: 'btn-icon-sm', type: 'button', textContent: '👁', title: 'الحالة الكاملة' })
        ));
        tb.append(tr);
    });
    renderStats();
}

function openStatusModal(student, date, onUpdate) {
        // Fermer les fenêtres précédentes s'il y en a
    document.querySelectorAll('.ov').forEach(o => o.remove());
    const currentRec = getRec(student.id, date);
    const currentType = currentRec.type;
    const ov = el('div', { class: 'ov' });
    const box = el('div', { class: 'ovbox status-dialog' });
    box.append(el('h3', { textContent: 'حالة التلميذ: ' + student.name, style: 'margin-top:0' }));

    Object.entries(T).forEach(([type, info]) => {
        const btn = el('button', {
            type: 'button', class: 'status-option' + (currentType === type ? ' selected' : ''),
            style: 'background:' + info.bg + ';color:' + info.color + ';border-color:' + info.color,
            textContent: info.icon + ' ' + info.label,
        });
        btn.onclick = () => {
            setRec(student.id, date, { type, reason: type === 'present' ? '' : currentRec.reason });
            ov.remove();
            onUpdate();
        };
        box.append(btn);
    });

    const cancel = el('button', { class: 'btn alt', type: 'button', textContent: 'إلغاء', style: 'margin-top:10px;width:100%' });
    cancel.onclick = () => ov.remove();
    box.append(cancel);
    ov.append(box);
    ov.onclick = (e) => { if (e.target === ov) ov.remove(); };
    document.body.append(ov);
}

function markAllPresent() {
    const date = curDate();
    if (!curClass()) return;
    if (!confirm('هل تريد تحديد جميع التلاميذ حاضرين في ' + date + '؟')) return;
    classStudents().forEach(s => setRec(s.id, date, { type: 'present' }));
    renderAttList();
    toast('✅ تم تحديد الجميع حاضرين');
}

function exportDay() {
    alert('تصدير Excel سيُضاف قريبًا.');
}

export function bindAttendance() {
    const dateInput = $('attDate');
    const classSelect = $('attClass');
    if (dateInput) dateInput.value = todayStr();
    if (dateInput) dateInput.onchange = () => renderAttList();
    if (classSelect) classSelect.onchange = () => renderAttList();
    const searchInput = $('search');
    if (searchInput) searchInput.oninput = () => renderAttList();
    const allPresent = $('allPresent');
    if (allPresent) allPresent.onclick = markAllPresent;
    const expDay = $('expDay');
    if (expDay) expDay.onclick = exportDay;
    const prevDay = $('prevDay');
    if (prevDay) prevDay.onclick = () => {
        const d = new Date(curDate() + 'T12:00:00'); d.setDate(d.getDate() - 1);
        dateInput.value = d.toISOString().slice(0, 10); renderAttList();
    };
    const nextDay = $('nextDay');
    if (nextDay) nextDay.onclick = () => {
        const d = new Date(curDate() + 'T12:00:00'); d.setDate(d.getDate() + 1);
        dateInput.value = d.toISOString().slice(0, 10); renderAttList();
    };
    const todayBtn = $('todayBtn');
    if (todayBtn) todayBtn.onclick = () => {
        dateInput.value = todayStr(); renderAttList();
    };
    renderAttClassSelect();
}