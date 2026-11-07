// src/core/dates.js
// Ce fichier range les "petits outils" pour les dates.

export const ymd = (d) =>
  d.getFullYear() + '-' +
  String(d.getMonth() + 1).padStart(2, '0') + '-' +
  String(d.getDate()).padStart(2, '0');

export function schoolYear(dateStr) {
  const y = +dateStr.slice(0, 4), m = +dateStr.slice(5, 7);
  return m >= 9 ? y + '-' + (y + 1) : (y - 1) + '-' + y;
}

export const addDays = (dateStr, n) => {
  const d = new Date(dateStr + 'T12:00:00');
  d.setDate(d.getDate() + n);
  return ymd(d);
};