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

function shade(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  const c = x => Math.max(0, Math.min(255, Math.round(x * f)));
  return 'rgb(' + c(n >> 16) + ',' + c((n >> 8) & 255) + ',' + c(n & 255) + ')';
}

function ensureDb() {
  if (db.students && db.students.length > 0) return;
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
  const currentClass = $('dynClassSel')?.value || $('classSel')?.value || '';
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

  const activeTypes = getActiveTypes();
  const showExcused = activeTypes.includes('excused');
  const showUnexcused = activeTypes.includes('unexcused');
  const showLate = activeTypes.includes('late');
  const showExpelled = activeTypes.includes('expelled');

  const cards = [
    { key: 'n', icon: '👥', value: sts.length, label: 'تلاميذ', sub: nOut ? 'منهم ' + nOut + ' مفصول' : '', cls: 'dyn-eq' },
    { key: 'excused', icon: '🟦', value: showExcused ? cur.excused : '—', label: 'غياب مبرر', sub: showExcused ? delta('excused')[0] : '(معطل)', cls: showExcused ? delta('excused')[1] : 'dyn-eq' },
    { key: 'unexcused', icon: '🟥', value: showUnexcused ? cur.unexcused : '—', label: 'غير مبرر', sub: showUnexcused ? delta('unexcused')[0] : '(معطل)', cls: showUnexcused ? delta('unexcused')[1] : 'dyn-eq' },
    { key: 'late', icon: '🟨', value: showLate ? cur.late : '—', label: 'تأخيرات', sub: showLate ? cur.lm + ' دقيقة' : '(معطل)', cls: showLate ? delta('late')[1] : 'dyn-eq' },
    { key: 'expelled', icon: '🟪', value: showExpelled ? cur.expelled : '—', label: 'إقصاءات', sub: showExpelled ? delta('expelled')[0] : '(معطل)', cls: showExpelled ? delta('expelled')[1] : 'dyn-eq' },
    { key: 'avg', icon: '📊', value: sts.length ? (dynCount(cur, activeTypes) / sts.length).toFixed(2) : '—', label: 'متوسط لكل تلميذ', sub: DYN_PERIODS[dynState.period], cls: 'dyn-eq' }
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
  const cx = 150, cy = 90, rx = 100, ry = 55, H = 20, TAU = Math.PI * 2;
  const fx = n => n.toFixed(2);

  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 300 200');
  svg.setAttribute('width', '100%');
  svg.setAttribute('height', '200');
  svg.style.maxWidth = '300px';
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
        d: 'M' + fx(ax) + ' ' + fx(ay) +
           'L' + fx(ax) + ' ' + fx(ay + H) +
           'A' + rx + ' ' + ry + ' 0 ' + lg + ' 1 ' + fx(bx) + ' ' + fx(by + H) +
           'L' + fx(bx) + ' ' + fx(by) +
           'A' + rx + ' ' + ry + ' 0 ' + lg + ' 0 ' + fx(ax) + ' ' + fx(ay) + 'Z',
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
      const face = mk('path', {
        d: 'M' + cx + ' ' + cy +
           'L' + fx(x0) + ' ' + fx(y0) +
           'A' + rx + ' ' + ry + ' 0 ' + lg + ' 1 ' + fx(x1) + ' ' + fx(y1) + 'Z',
        fill: s.color,
        stroke: '#fff',
        'stroke-width': 1.5,
        style: 'cursor:pointer'
      });
      // Clic sur le secteur : afficher la liste des élèves
      face.onclick = () => showPieStudents(s.label, cur);
      face.onmouseenter = () => { face.setAttribute('opacity', '0.85'); };
      face.onmouseleave = () => { face.setAttribute('opacity', '1'); };
      svg.append(face);
    }
  });

  segs.forEach(s => {
    const pc = Math.round(100 * s.f);
    if (pc < 3) return;
    const m = (s.a0 + s.a1) / 2;
    const X = fx(cx + rx * 0.65 * Math.cos(m));
    const Y = fx(cy + ry * 0.65 * Math.sin(m) + 5);
    const t1 = mk('text', {
      x: X, y: Y,
      'text-anchor': 'middle',
      'font-size': '14',
      'font-weight': '800',
      fill: 'none',
      stroke: 'rgba(0,0,0,0.7)',
      'stroke-width': '3',
      'stroke-linejoin': 'round',
      style: 'pointer-events:none'
    });
    t1.textContent = pc + '%';
    svg.append(t1);
    const t2 = mk('text', {
      x: X, y: Y,
      'text-anchor': 'middle',
      'font-size': '14',
      'font-weight': '800',
      fill: '#fff',
      style: 'pointer-events:none'
    });
    t2.textContent = pc + '%';
    svg.append(t2);
  });

  const wrap = el('div', { style: 'text-align:center' }, svg);

  const legend = el('ul', { style: 'list-style:none;padding:0;margin:12px 0 0;font-size:13px;display:flex;flex-direction:column;gap:4px' });
  items.forEach(([label, value, color]) => {
    if (value === 0) return;
    const li = el('li', {
      style: 'display:flex;align-items:center;gap:6px;padding:6px 8px;border-radius:6px;cursor:pointer;transition:background .15s'
    });
    li.append(
      el('span', { style: 'width:14px;height:14px;border-radius:3px;background:' + color }),
      el('span', { style: 'flex:1;text-align:right' }, label),
      el('strong', { textContent: value + ' (' + Math.round(100 * value / tot) + '%)' })
    );
    li.onmouseenter = () => { li.style.background = '#f1f8f5'; };
    li.onmouseleave = () => { li.style.background = 'transparent'; };
    // Clic sur la légende : afficher la liste des élèves
    li.onclick = () => showPieStudents(label, cur);
    legend.append(li);
  });

  wrap.append(legend);
  box.append(wrap);
}

/** Affiche la liste des élèves pour un type d'absence donné. */
function showPieStudents(label, cur) {
  // Trouver le type correspondant
  const typeEntry = DYN_TYPES.find(x => x[1] === label);
  if (!typeEntry) return;
  const typeKey = typeEntry[0];

  // Récupérer les élèves concernés
  const date = todayStr();
  const sts = getScopeStudents();
  const byId = new Map(sts.map(s => [s.id, s]));
  const range = dynRange(dynState.period, date, false);

  const affected = [];
  Object.keys(db.records || {}).forEach(k => {
    const c = k.indexOf('|');
    const id = k.slice(c + 1);
    if (!byId.has(id)) return;
    const d = k.slice(0, c);
    if (d < range[0] || d > range[1]) return;
    const r = db.records[k];
    if (r.type === typeKey) {
      affected.push({ student: byId.get(id), record: r, date: d });
    }
  });

  // Créer la fenêtre modale
  const ov = el('div', { class: 'ov' });
  const box = el('div', { class: 'ovbox', role: 'dialog', ariaModal: 'true' });

  box.append(
    el('h3', { textContent: label + ' — قائمة التلاميذ', style: 'margin-top:0' }),
    el('p', { class: 'hint', textContent: 'عدد التلاميذ: ' + affected.length + ' | الفترة: ' + DYN_PERIODS[dynState.period] })
  );

  if (affected.length === 0) {
    box.append(el('p', { class: 'empty-list', textContent: 'لا يوجد تلاميذ في هذه الفئة.' }));
  } else {
    const table = el('table', { style: 'width:100%;border-collapse:collapse' });
    const thead = el('thead');
    thead.append(el('tr', {},
      el('th', { textContent: 'اسم التلميذ', style: 'text-align:right' }),
      el('th', { textContent: 'الفصل', style: 'text-align:center' }),
      el('th', { textContent: 'التاريخ', style: 'text-align:center' }),
      el('th', { textContent: 'السبب', style: 'text-align:center' })
    ));
    table.append(thead);
    const tbody = el('tbody');
    affected.sort((a, b) => collator.compare(a.student.name, b.student.name)).forEach(x => {
      tbody.append(el('tr', {},
        el('td', { textContent: x.student.name, style: 'text-align:right;font-weight:700' }),
        el('td', { textContent: x.student.class, style: 'text-align:center' }),
        el('td', { textContent: x.date, style: 'text-align:center;direction:ltr' }),
        el('td', { textContent: x.record.reason || '—', style: 'text-align:center' })
      ));
    });
    table.append(tbody);
    box.append(el('div', { class: 'scroll', style: 'max-height:400px;overflow:auto' }, table));
  }

  const close = el('button', { class: 'btn', type: 'button', textContent: 'إغلاق', style: 'margin-top:14px' });
  close.onclick = () => ov.remove();
  box.append(close);

  ov.append(box);
  ov.onclick = (e) => { if (e.target === ov) ov.remove(); };
  document.body.append(ov);
}

  const NS = 'http://www.w3.org/2000/svg';
  const cx = 150, cy = 90, rx = 100, ry = 55, H = 20, TAU = Math.PI * 2;
  const fx = n => n.toFixed(2);

  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 300 200');
  svg.setAttribute('width', '100%');
  svg.setAttribute('height', '200');
  svg.style.maxWidth = '300px';
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
        d: 'M' + fx(ax) + ' ' + fx(ay) +
           'L' + fx(ax) + ' ' + fx(ay + H) +
           'A' + rx + ' ' + ry + ' 0 ' + lg + ' 1 ' + fx(bx) + ' ' + fx(by + H) +
           'L' + fx(bx) + ' ' + fx(by) +
           'A' + rx + ' ' + ry + ' 0 ' + lg + ' 0 ' + fx(ax) + ' ' + fx(ay) + 'Z',
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
        d: 'M' + cx + ' ' + cy +
           'L' + fx(x0) + ' ' + fx(y0) +
           'A' + rx + ' ' + ry + ' 0 ' + lg + ' 1 ' + fx(x1) + ' ' + fx(y1) + 'Z',
        fill: s.color,
        stroke: '#fff',
        'stroke-width': 1.5
      }));
    }
  });

  segs.forEach(s => {
    const pc = Math.round(100 * s.f);
    if (pc < 3) return;
    const m = (s.a0 + s.a1) / 2;
    const X = fx(cx + rx * 0.65 * Math.cos(m));
    const Y = fx(cy + ry * 0.65 * Math.sin(m) + 5);
    const t1 = mk('text', {
      x: X, y: Y,
      'text-anchor': 'middle',
      'font-size': '14',
      'font-weight': '800',
      fill: 'none',
      stroke: 'rgba(0,0,0,0.7)',
      'stroke-width': '3',
      'stroke-linejoin': 'round'
    });
    t1.textContent = pc + '%';
    svg.append(t1);
    const t2 = mk('text', {
      x: X, y: Y,
      'text-anchor': 'middle',
      'font-size': '14',
      'font-weight': '800',
      fill: '#fff'
    });
    t2.textContent = pc + '%';
    svg.append(t2);
  });

  const wrap = el('div', { style: 'text-align:center' }, svg);

  const legend = el('ul', { style: 'list-style:none;padding:0;margin:12px 0 0;font-size:13px;display:flex;flex-direction:column;gap:4px' });
  items.forEach(([label, value, color]) => {
    if (value === 0) return;
    const li = el('li', {
      style: 'display:flex;align-items:center;gap:6px;padding:6px 8px;border-radius:6px;cursor:pointer;transition:background .15s'
    });
    li.append(
      el('span', { style: 'width:14px;height:14px;border-radius:3px;background:' + color }),
      el('span', { style: 'flex:1;text-align:right' }, label),
      el('strong', { textContent: value + ' (' + Math.round(100 * value / tot) + '%)' })
    );
    li.onmouseenter = () => { li.style.background = '#f1f8f5'; };
    li.onmouseleave = () => { li.style.background = 'transparent'; };
    li.onclick = () => {
      const key = DYN_TYPES.find(x => x[1] === label)?.[0];
      if (key) {
        dynState.activeTypes[key] = !dynState.activeTypes[key];
        renderDashboard();
      }
    };
    legend.append(li);
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
  ensureDb();

  const liveTime = $('dynLiveTime');
  if (liveTime) {
    liveTime.textContent = new Date().toLocaleTimeString('fr-FR');
  }

  const classSel = $('dynClassSel');
  if (classSel) {
    if (dynState.scope === 'cur') {
      classSel.style.display = 'inline-block';
      if (classSel.options.length <= 1) {
        const classes = [...new Set(db.students.map(s => s.class))].sort((a, b) => collator.compare(a, b));
        classes.forEach(c => {
          const opt = el('option', { value: c, textContent: c });
          classSel.append(opt);
        });
      }
      const activeClass = $('classSel')?.value || classSel.value || '';
      if (activeClass) classSel.value = activeClass;
    } else {
      classSel.style.display = 'none';
    }
  }

  const currentClassSpan = $('dynCurrentClass');
  if (currentClassSpan) {
    const currentClass = $('dynClassSel')?.value || $('classSel')?.value || '';
    if (dynState.scope === 'cur') {
      currentClassSpan.textContent = currentClass ? ': ' + currentClass : ': (غير محددة)';
      currentClassSpan.style.display = 'inline-block';
    } else {
      currentClassSpan.textContent = '';
      currentClassSpan.style.display = 'none';
    }
  }

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

  const dynClassSel = $('dynClassSel');
  if (dynClassSel) {
    dynClassSel.onchange = () => {
      const chosen = dynClassSel.value;
      if (chosen) {
        const mainClassSel = $('classSel');
        if (mainClassSel) mainClassSel.value = chosen;
        renderDashboard();
      }
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
      const chip = el('button', {
        type: 'button',
        class: 'dyn-chip on',
        style: '--c:' + color,
        textContent: label,
      });
      chip.onclick = () => {
        dynState.activeTypes[k] = !dynState.activeTypes[k];
        chip.classList.toggle('on', dynState.activeTypes[k]);
        renderDashboard();
      };
      chipsContainer.append(chip);
    });
  }
}