// src/core/state.js
// La mémoire de l'application : charge et sauvegarde toutes les données.

import { uid } from './format.js';

const KEY = 'schoolDataV2';

// L'objet qui contient TOUTES les données de l'application.
export const db = {
  classes: [],              // ex: ["7A", "7B", "8A"]
  students: [],             // ex: [{ id, name, class, g, ag, status }]
  records: {},              // ex: { "2026-11-06|abc123": { type: "excused", reason: "maladie" } }
  examHeld: {},             // ex: { '["7A","1","tp"]': true }
  gradeHistory: [],         // historique des notes modifiées
  attendanceHistory: [],    // historique des présences modifiées
  disciplineRecords: [],    // sanctions & convocations
  classAgenda: [],          // devoirs & échéances
  examAnalyses: [],         // analyses de devoirs
};

// Charger les données depuis le navigateur (localStorage).
export function load() {
  const raw = localStorage.getItem(KEY);
  try {
    if (raw) {
      const d = JSON.parse(raw);
      if (!validateBackup(d)) throw new Error('invalid');
      db.classes = d.classes || [];
      db.students = d.students || [];
      db.records = d.records || {};
      db.examHeld = d.examHeld || {};
      db.gradeHistory = d.gradeHistory || [];
      db.attendanceHistory = d.attendanceHistory || [];
      db.disciplineRecords = d.disciplineRecords || [];
      db.classAgenda = d.classAgenda || [];
      db.examAnalyses = d.examAnalyses || [];
    } else {
      migrateLegacy();
    }
  } catch (e) {
    if (raw) localStorage.setItem(KEY + '_corrupt', raw);
    console.error('[state] données corrompues, sauvegardées dans', KEY + '_corrupt');
  }
}

// Sauvegarder les données dans le navigateur.
export function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(db));
  } catch (e) {
    alert('تعذر حفظ البيانات: مساحة التخزين ممتلئة أو التخزين غير متاح.');
  }
  // Si Firebase est branché, on synchronise aussi
  if (window.cloud && window.cloud.sync) window.cloud.sync();
}

// Valider qu'un objet ressemble à des données valides.
export function validateBackup(d) {
  return !!d && typeof d === 'object' && !Array.isArray(d)
    && Array.isArray(d.classes)
    && Array.isArray(d.students)
    && d.records && typeof d.records === 'object' && !Array.isArray(d.records);
}

// Récupérer les données de l'ancienne application (au cas où).
function migrateLegacy() {
  const old = JSON.parse(localStorage.getItem('schoolData') || 'null');
  if (!old || !Array.isArray(old.students)) return;
  db.classes = [...(old.classes || [])];
  old.students.forEach(s => {
    const id = uid();
    db.students.push({ id, name: String(s.name || ''), class: s.class });
    if (!db.classes.includes(s.class)) db.classes.push(s.class);
    if (s.type && s.type !== 'present' && s.date) {
      db.records[s.date + '|' + id] = { type: s.type, reason: s.reason || '' };
    }
  });
}

export { KEY };