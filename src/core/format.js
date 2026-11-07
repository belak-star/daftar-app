// src/core/format.js
// Ce fichier range les "petits outils" : nombres, textes, constantes.

export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

export const collator = new Intl.Collator(['ar', 'fr'], { sensitivity: 'base', numeric: true });

export const norm = (x) =>
  String(x).toLowerCase()
    .replace(/[\u064B-\u065F\u0670]/g, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/\s+/g, ' ')
    .trim();

export const num = (v) => {
  if (v === '' || v == null) return null;
  const raw = String(v).trim().replace(',', '.');
  if (!/^(?:\d+(?:\.\d+)?|\.\d+)$/.test(raw)) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
};

export const fm = (n) => n.toFixed(2).padStart(5, '0');

export const f2 = (a) => (a ? fm(a.v) : '');

export const T = {
  present: 'حاضر',
  excused: 'غياب مبرر',
  unexcused: 'غياب غير مبرر',
  late: 'تأخير',
  expelled: 'مطرود من الحصة',
};

export const R = { temp: 'مفصول مؤقتًا', perm: 'مفصول نهائيًا' };

export const EXAMS = { tp: 'أشغال تطبيقية', dc: 'فرض مراقبة', ds: 'فرض تأليفي' };
export const W = { tp: 1, dc: 1, ds: 2 };