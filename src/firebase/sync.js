// src/firebase/sync.js
// Synchronise les données entre l'app et Firestore.

import {
  initializeFirestore,
  persistentLocalCache,
  doc,
  setDoc,
  onSnapshot,
  collection,
  deleteField,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { auth, onAuthStateChanged } from './auth.js';
import { db, save } from '../core/state.js';

// Initialise Firestore avec cache persistant
const fs = initializeFirestore(auth.app, { localCache: persistentLocalCache() });

let currentUid = null;
let unsubMeta = null;
let unsubMonths = null;
let syncTimer = null;
let shadowMeta = '';
let shadowRecords = {};

function canon(obj) {
  return JSON.stringify(obj, (key, val) => {
    if (val && typeof val === 'object' && !Array.isArray(val)) {
      return Object.keys(val).sort().reduce((acc, k) => {
        acc[k] = val[k];
        return acc;
      }, {});
    }
    return val;
  });
}

function doSync() {
  syncTimer = null;
  if (!currentUid) return;

  // 1) Métadonnées
  const metaVal = {
    classes: db.classes,
    students: db.students,
    log: db.log || [],
    examHeld: db.examHeld || {},
    gradeHistory: db.gradeHistory || [],
    attendanceHistory: db.attendanceHistory || [],
    disciplineRecords: db.disciplineRecords || [],
    classAgenda: db.classAgenda || [],
    examAnalyses: db.examAnalyses || [],
  };
  const metaStr = canon(metaVal);

  if (metaStr !== shadowMeta) {
    shadowMeta = metaStr;
    setDoc(doc(fs, 'users', currentUid, 'meta', 'main'), metaVal)
      .catch(err => console.error('[sync] meta:', err));
  }

  // 2) Records (absences) par mois
  const updatesByMonth = {};
  const currentRecords = {};

  for (const key in db.records) {
    const recStr = canon(db.records[key]);
    currentRecords[key] = recStr;
    if (shadowRecords[key] !== recStr) {
      const month = key.slice(0, 7);
      if (!updatesByMonth[month]) updatesByMonth[month] = {};
      updatesByMonth[month][key] = db.records[key];
    }
  }

  for (const key in shadowRecords) {
    if (!(key in currentRecords)) {
      const month = key.slice(0, 7);
      if (!updatesByMonth[month]) updatesByMonth[month] = {};
      updatesByMonth[month][key] = deleteField();
    }
  }

  shadowRecords = currentRecords;

  for (const month in updatesByMonth) {
    setDoc(doc(fs, 'users', currentUid, 'months', month),
      { records: updatesByMonth[month] },
      { merge: true }
    ).catch(err => console.error('[sync] month ' + month + ':', err));
  }
}

export function initSync() {
  window.cloud = {
    sync() {
      if (!currentUid) return;
      clearTimeout(syncTimer);
      syncTimer = setTimeout(doSync, 500);
    },
    now() {
      if (!currentUid) return;
      clearTimeout(syncTimer);
      doSync();
    },
  };

  onAuthStateChanged(auth, (user) => {
    if (unsubMeta) { unsubMeta(); unsubMeta = null; }
    if (unsubMonths) { unsubMonths(); unsubMonths = null; }

    if (!user) {
      currentUid = null;
      shadowMeta = '';
      shadowRecords = {};
      return;
    }

    currentUid = user.uid;
    shadowMeta = '';
    shadowRecords = {};

    // Écoute des métadonnées
    unsubMeta = onSnapshot(
      doc(fs, 'users', currentUid, 'meta', 'main'),
      (snap) => {
        if (!snap.exists()) {
          if (db.classes.length || db.students.length) doSync();
          return;
        }
        const data = snap.data();
        const incoming = canon({
          classes: data.classes || [],
          students: data.students || [],
          log: data.log || [],
          examHeld: data.examHeld || {},
          gradeHistory: data.gradeHistory || [],
          attendanceHistory: data.attendanceHistory || [],
          disciplineRecords: data.disciplineRecords || [],
          classAgenda: data.classAgenda || [],
          examAnalyses: data.examAnalyses || [],
        });

        if (incoming === shadowMeta) return;
        if (syncTimer) return;

        db.classes = data.classes || [];
        db.students = data.students || [];
        db.log = data.log || [];
        db.examHeld = data.examHeld || {};
        db.gradeHistory = data.gradeHistory || [];
        db.attendanceHistory = data.attendanceHistory || [];
        db.disciplineRecords = data.disciplineRecords || [];
        db.classAgenda = data.classAgenda || [];
        db.examAnalyses = data.examAnalyses || [];

        shadowMeta = incoming;
        localStorage.setItem('schoolDataV2', JSON.stringify(db));
        document.dispatchEvent(new CustomEvent('cloud-update'));
      },
      (err) => console.error('[sync] meta snapshot:', err)
    );

    // Écoute des records (absences)
    unsubMonths = onSnapshot(
      collection(fs, 'users', currentUid, 'months'),
      (snap) => {
        if (syncTimer) return;
        const records = {};
        snap.forEach(d => {
          const monthData = d.data();
          if (monthData.records) {
            for (const key in monthData.records) {
              records[key] = monthData.records[key];
            }
          }
        });
        db.records = records;
        shadowRecords = Object.fromEntries(
          Object.entries(records).map(([k, v]) => [k, canon(v)])
        );
        localStorage.setItem('schoolDataV2', JSON.stringify(db));
        document.dispatchEvent(new CustomEvent('cloud-update'));
      },
      (err) => console.error('[sync] months snapshot:', err)
    );
  });
}