// src/features/dashboard.js
// Dashboard dynamique avec filtres, graphiques et alertes.

import { db } from '../core/state.js';
import { $, el } from '../core/dom.js';
import { collator } from '../core/format.js';

const DYN_TYPES = [
  ['excused', 'غياب مبرر', '#2563a8'],
  ['unexcused', 'غياب غير مبرر', '#b3261e'],
  ['late', 'تأخير', '#9a5b00'],
  ['expelled', 'مطرود', '#7a3fb5']
];

const DYN_PERIODS = { D: 'اليوم', W: 'آخر 7 أيام', M: 'هذا الشهر', Y: 'السنة الدراسية' };

let dynState = {
  scope: 'cur',
  period: 'M',
  activeTypes: { excused: true, unexcused: true, late: true, expelled: true }
};

/** Recharge db depuis localStorage si nécessaire. */
function ensureDb() {
  if (db.students && db.students.length > 0) return; // db est déjà rempli
  try {
    const stored = localStorage.getItem('schoolDataV2');
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed.classes) db.classes = parsed.classes;
      if (parsed.students) db.students = parsed.students;
      if (parsed.records) db.records = parsed.records;
      if (parsed.examHeld) db.examHeld = parsed.examHeld;
      if (parsed.disciplineRecords) db.disciplineRecords = parsed.disciplineRecords;
      if (parsed.classAgenda) db.classAgenda = parsed.classAgenda;
      if (parsed.examAnalyses) db.examAnalyses = parsed.examAnalyses;
    }
  } catch (e) {
    console.warn('Erreur rechargement db:', e);
  }
}

function todayStr() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

function addDays(dateStr, n) {
  const d = new Date(dateStr + 'T12:00:00');
  d.setDate(d.getDate() + n);
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

function schoolYear(dateStr) {
  const y = +dateStr.slice(0, 4), m = +dateStr.slice(5, 7);
  return m >= 9 ? y + '-' + (y + 1) : (y - 1) + '-' + y;
}

function dynRange(period, date, prev) {
  if (period === 'D') {
    const a = prev ? addDays(date, -1) : date;
    return [a, a];
  }
  if (period === 'W') {
    const e = prev ? addDays(date, -7) : date;
    return [addDays(e, -6), e];
  }
  if (period === 'M') {
    let y = +date.slice(0, 4), m = +date.slice(5, 7);
    if (prev) { m--; if (m < 1) { m = 12; y--; } }
    const ms = y + '-' + String(m).padStart(2, '0');
    return [ms + '-01', ms + '-31'];
  }
  const y1 = +schoolYear(date).slice(0, 4);
  return [y1 + '-09-01', (y1 + 1) + '-08-31'];
}

function dynBuckets(period, date) {
  if (period === 'D' || period === 'W') {
    return Array.from({ length: 7 }, (_, i) => {
      const d = addDays(date, i - 6);
      return { from: d, to: d, label: d.slice(5) };
    });
  }
  if (period === 'M') {
    const ms = date.slice(0, 7);
    const n = new Date(+ms.slice(0, 4), +ms.slice(5, 7), 0).getDate();
    return Array.from({ length: n }, (_, i) => {
      const d = ms + '-' + String(i + 1).padStart(2, '0');
      return { from: d, to: d, label: String(i + 1) };
    });
  }
  const y1 = +schoolYear(date).slice(0, 4);
  return Array.from({ length: 12 }, (_, i) => {
    const mo = ((8 + i) % 12) + 1;
    const ms = (mo >= 9 ? y1 : y1 + 1) + '-' + String(mo).padStart(2, '0');
    return { from: ms + '-01', to: ms + '-31', label: ms.slice(2) };
  });
}

function getScopeStudents() {
  const sc = dynState.scope;
  const currentClass = $('classSel')?.value || '';
  return db.students.filter(s => {
    if (sc === 'cur') return s.class === currentClass;
    if (sc === 'all') return true;
    return levelOf(s.class) === sc;
  });
}

function levelOf(c) {
  const t = String(c).replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d));
  const m = t.match(/\d+/);
  if (m) return (m[0] === '7' || m[0] === '8') ? m[0] : '';
  if (/السابع/.test(c)) return '7';
  if (/الثامن/.test(c)) return '8';
  return '';
}

function aggregateRecords(recs, range) {
  const o = { excused: 0, unexcused: 0, late: 0, expelled: 0, lm: 0, per: new Map() };
  recs.forEach(r => {
    if (r.d < range[0] || r.d > range[1]) return;
    if (!(r.t in { excused: 1, unexcused: 1, late: 1, expelled: 1 })) return;
    o[r.t]++;
    if (r.t === 'late') o.lm += r.lm;
    const q = o.per.get(r.id) || { excused: 0, unexcused: 0, late: 0, expelled: 0, lm: 0 };
    q[r.t]++;
    if (r.t === 'late') q.lm += r.lm;
    o.per.set(r.id, q);
  });
  return o;
}

function dynCount(q, types) {
  return types.reduce((a, k) => a + (q[k] || 0), 0);
}

function getActiveTypes() {
  return DYN_TYPES.map(x => x[0]).filter(k => dynState.activeTypes[k]);
}

function effStatus(s, date) {
  if (!s.status) return '';
  if (s.from && date < s.from) return '';
  if (s.status === 'temp' && s.to && date > s.to) return '';
  return s.status;
}

function animNum(el, to) {
  const from = +el.dataset.v || 0;
  el.dataset.v = to;
  if (from === to || !window.requestAnimationFrame) { el.textContent = to; return; }
  const t0 = performance.now();
  (function step(t) {
    const k = Math.min(1, (t - t0) / 450);
    el.textContent = Math.round(from + (to - from) * k);
    if (k < 1) requestAnimationFrame(step);
  })(t0);
}

function renderDynKpis(sts, cur, prev) {
  const box = $('dynKpis');
  if (!box) return;
  box.replaceChildren();

  const nOut = sts.filter(s => effStatus(s, todayStr())).length;
  const delta = (k) => {
    if (!prev) return ['', ''];
    const d = cur[k] - prev[k];
    return d > 0 ? ['▲ +' + d, 'dyn-up'] : d < 0 ? ['▼ ' + d, 'dyn-down'] : ['= ثابت', 'dyn-eq'];
  };

  const cards = [
    { key: 'n', icon: '👥', value: sts.length, label: 'تلاميذ', sub: nOut ? 'منهم ' + nOut + ' مفصول' : '', cls: 'dyn-eq' },
    { key: 'excused', icon: '🟦', value: cur.excused, label: 'غياب مبرر', sub: delta('excused')[0], cls: delta('excused')[1] },
    { key: 'unexcused', icon: '🟥', value: cur.unexcused, label: 'غير مبرر', sub: delta('unexcused')[0], cls: delta('unexcused')[1] },
    { key: 'late', icon: '🟨', value: cur.late, label: 'تأخيرات', sub: cur.lm + ' دقيقة', cls: delta('late')[1] },
    { key: 'expelled', icon: '🟪', value: cur.expelled, label: 'إقصاءات', sub: delta('expelled')[0], cls: delta('expelled')[1] },
    { key: 'avg', icon: '📊', value: sts.length ? (dynCount(cur, getActiveTypes()) / sts.length).toFixed(2) : '—', label: 'متوسط لكل تلميذ', sub: DYN_PERIODS[dynState.period], cls: 'dyn-eq' }
  ];

  cards.forEach(c => {
    const card = el('div', { class: 'dash-card' },
      el('span', { class: 'dash-icon', textContent: c.icon }),
      el('strong', { textContent: '0', 'data-k': c.key }),
      el('span', { textContent: c.label }),
      el('small', { textContent: c.sub, class: c.cls })
    );
    box.append(card);
    if (typeof c.value === 'number') animNum(card.querySelector('strong'), c.value);
    else card.querySelector('strong').textContent = c.value;
  });
}

function renderDynChart(recs, date) {
  const box = $('dynChart');
  if (!box) return;
  box.replaceChildren();

  const p = dynState.period;
  const on = getActiveTypes();
  const bk = dynBuckets(p, date);

  const cols = bk.map(b => {
    const c = { excused: 0, unexcused: 0, late: 0, expelled: 0 };
    recs.forEach(r => {
      if (r.d >= b.from && r.d <= b.to && r.t in c) c[r.t]++;
    });
    return c;
  });

  const mx = Math.max(1, ...cols.map(c => dynCount(c, on)));

  const chart = el('div', { class: 'dyn-trend' });
  bk.forEach((b, i) => {
    const c = cols[i];
    const segs = DYN_TYPES.filter(x => dynState.activeTypes[x[0]] && c[x[0]] > 0)
      .map(x => el('div', { style: 'height:' + Math.max(3, Math.round(c[x[0]] / mx * 120)) + 'px;background:' + x[2] }));
    chart.append(el('div', { class: 'dyn-col', title: b.label },
      el('div', { class: 'stk' }, ...segs),
      el('small', { textContent: b.label })
    ));
  });

  box.append(chart);
}

function renderDynPie(cur) {
  const box = $('dynPie');
  if (!box) return;
  box.replaceChildren();

  const items = DYN_TYPES.filter(x => dynState.activeTypes[x[0]]).map(x => [x[1], cur[x[0]], x[2]]);
  const tot = items.reduce((a, b) => a + b[1], 0);

  if (tot === 0) {
    box.append(el('div', { class: 'empty-list', textContent: 'لا توجد غيابات في هذه الفترة.' }));
    return;
  }

  const NS = 'http://www.w3.org/2000/svg';
  const cx = 100, cy = 70, rx = 80, ry = 40, H = 16, TAU = Math.PI * 2;
  const fx = n => n.toFixed(2);

  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 200 140');
  svg.setAttribute('width', '220');
  svg.setAttribute('height', '150');
  svg.style.maxWidth = '100%';

  const mk = (tag, at) => {
    const n = document.createElementNS(NS, tag);
    for (const k in at) n.setAttribute(k, at[k]);
    return n;
  };

  const P = a => [cx + rx * Math.cos(a), cy + ry * Math.sin(a)];

  svg.append(mk('ellipse', { cx, cy: cy + H + 4, rx: rx + 4, ry: ry + 4, fill: 'rgba(0,0,0,0.12)' }));

  let a = -Math.PI / 2;
  items.forEach(([label, value, color]) => {
    if (value <= 0) return;
    const f = value / tot;
    const a0 = a, a1 = a + f * TAU;
    a = a1;
    const face = mk('path', {
      d: 'M' + cx + ' ' + cy +
         'L' + fx(P(a0)[0]) + ' ' + fx(P(a0)[1]) +
         'A' + rx + ' ' + ry + ' 0 ' + (f > 0.5 ? 1 : 0) + ' 1 ' + fx(P(a1)[0]) + ' ' + fx(P(a1)[1]) + 'Z',
      fill: color,
      stroke: '#fff',
      'stroke-width': 1
    });
    svg.append(face);
  });

  const wrap = el('div', {}, svg);
  const legend = el('ul', { style: 'list-style:none;padding:0;margin:10px 0 0;font-size:13px' });
  items.forEach(([label, value, color]) => {
    if (value === 0) return;
    legend.append(el('li', { style: 'display:flex;align-items:center;gap:6px;margin:4px 0' },
      el('span', { style: 'width:12px;height:12px;border-radius:3px;background:' + color }),
      label + ' : ' + value + ' (' + Math.round(100 * value / tot) + '%)'
    ));
  });

  wrap.append(legend);
  box.append(wrap);
}

function renderDynTop(cur, byId) {
  const box = $('dynTop');
  if (!box) return;
  box.replaceChildren();

  const on = getActiveTypes();
  const top = [...cur.per]
    .map(([id, q]) => ({ id, n: dynCount(q, on) }))
    .filter(x => x.n > 0)
    .sort((a, b) => b.n - a.n)
    .slice(0, 8);

  if (top.length === 0) {
    box.append(el('div', { class: 'empty-list', textContent: 'لا توجد غيابات في هذه الفترة.' }));
    return;
  }

  const max = top[0].n;
  top.forEach(x => {
    box.append(el('div', { class: 'dyn-row', style: 'cursor:pointer' },
      el('span', { class: 'n', textContent: byId.get(x.id)?.name || '—' }),
      el('span', { class: 'b2' }, el('i', { style: 'width:' + Math.round(x.n / max * 100) + '%' })),
      el('b', { textContent: x.n })
    ));
  });
}

function renderDynClasses(cur, sts) {
  const box = $('dynClasses');
  if (!box) return;
  box.replaceChildren();

  const classes = [...new Set(sts.map(s => s.class))];
  if (classes.length < 2) {
    box.append(el('div', { class: 'empty-list', textContent: 'اختر "كل الفصول" للمقارنة.' }));
    return;
  }

  const on = getActiveTypes();
  const rows = classes.map(c => {
    const ss = sts.filter(s => s.class === c);
    const tot = ss.reduce((a, s) => a + dynCount(cur.per.get(s.id) || {}, on), 0);
    return { c, n: ss.length, tot, rate: ss.length ? tot / ss.length : 0 };
  }).sort((a, b) => b.rate - a.rate);

  const maxR = Math.max(0.0001, rows[0].rate);
  rows.forEach(r => {
    box.append(el('div', { class: 'dyn-row' },
      el('span', { class: 'n', textContent: r.c }),
      el('span', { class: 'b2' }, el('i', { style: 'width:' + Math.round(r.rate / maxR * 100) + '%' })),
      el('b', { textContent: r.rate.toFixed(2) })
    ));
  });
}

function renderDynAlerts(cur, byId) {
  const box = $('dynAlerts');
  if (!box) return;
  box.replaceChildren();

  const alerts = [...cur.per]
    .filter(([id, q]) => q.unexcused >= 3)
    .map(([id, q]) => ({ id, n: q.unexcused, name: byId.get(id)?.name || '—' }))
    .sort((a, b) => b.n - a.n);

  if (alerts.length === 0) {
    box.append(el('div', { class: 'empty-list', textContent: '✅ لا يوجد تلاميذ في حالة تنبيه.' }));
    return;
  }

  alerts.forEach(a => {
    box.append(el('div', { class: 'dyn-alert-row' },
      el('span', { class: 'name', textContent: a.name }),
      el('span', { class: 'badge', textContent: a.n + ' غياب غير مبرر' })
    ));
  });
}

export function renderDashboard() {
  ensureDb(); // ← On s'assure que db est rempli depuis localStorage

  const date = todayStr();
  const sts = getScopeStudents();
  const byId = new Map(sts.map(s => [s.id, s]));

  const recs = [];
  Object.keys(db.records || {}).forEach(k => {
    const c = k.indexOf('|');
    const id = k.slice(c + 1);
    if (!byId.has(id)) return;
    const r = db.records[k];
    recs.push({ d: k.slice(0, c), id, t: r.type, lm: Number(r.lateMinutes) || 0 });
  });

  const cur = aggregateRecords(recs, dynRange(dynState.period, date, false));
  const prev = dynState.period === 'Y' ? null : aggregateRecords(recs, dynRange(dynState.period, date, true));

  renderDynKpis(sts, cur, prev);
  renderDynChart(recs, date);
  renderDynPie(cur);
  renderDynTop(cur, byId);
  renderDynClasses(cur, sts);
  renderDynAlerts(cur, byId);
}

export function bindDashboard() {
  const scopeSelect = $('dynScope');
  const periodSelect = $('dynPeriod');
  const chipsContainer = $('dynChips');

  if (scopeSelect) {
    scopeSelect.value = dynState.scope;
    scopeSelect.onchange = () => {
      dynState.scope = scopeSelect.value;
      renderDashboard();
    };
  }

  if (periodSelect) {
    periodSelect.value = dynState.period;
    periodSelect.onchange = () => {
      dynState.period = periodSelect.value;
      renderDashboard();
    };
  }

  if (chipsContainer) {
    chipsContainer.replaceChildren();
    DYN_TYPES.forEach(([k, label, color]) => {
      const chip = el('label', { class: 'dyn-chip on', style: '--c:' + color },
        el('input', {
          type: 'checkbox',
          checked: true,
          style: 'display:none',
          onchange: (e) => {
            dynState.activeTypes[k] = e.target.checked;
            chip.classList.toggle('on', e.target.checked);
            renderDashboard();
          }
        }),
        label
      );
      chipsContainer.append(chip);
    });
  }
}