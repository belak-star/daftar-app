// src/core/state.js
// Gère l'état global de l'application et la sauvegarde locale.

export const db = {
  classes: [],
  students: [],
  records: {},
  examHeld: {},
  disciplineRecords: [],
  classAgenda: [],
  examAnalyses: [],
};

export function save(options = {}) {
  try {
    localStorage.setItem('schoolDataV2', JSON.stringify(db));
    // Si on est en mode cloud (sync.js), on prévient le cloud
    if (window.cloud && typeof window.cloud.sync === 'function' && !options.soft) {
      window.cloud.sync();
    }
  } catch (e) {
    console.error('Erreur de sauvegarde locale:', e);
  }
}

export async function load() {
  console.log('🔄 Recherche des données...');
  
  // 1. Priorité 1 : Le localStorage (données les plus récentes)
  const local = localStorage.getItem('schoolDataV2');
  if (local) {
    try {
      const parsed = JSON.parse(local);
      if (parsed && (parsed.students?.length > 0 || parsed.classes?.length > 0)) {
        Object.assign(db, parsed);
        console.log('✅ Données chargées depuis le localStorage.');
        return;
      }
    } catch (e) {
      console.warn('⚠ Erreur lecture localStorage:', e);
    }
  }

  // 2. Priorité 2 : Le fichier backup.json (sur le serveur)
  try {
    console.log('⏳ Tentative de chargement depuis backup.json...');
    const response = await fetch('./backup.json'); // Le ./ est important
    if (!response.ok) throw new Error('Fichier non trouvé');
    
    const data = await response.json();
    
    if (data && (data.students?.length > 0 || data.classes?.length > 0)) {
      // On remplit la base de données
      db.classes = data.classes || [];
      db.students = data.students || [];
      db.records = data.records || {};
      db.examHeld = data.examHeld || {};
      db.disciplineRecords = data.disciplineRecords || [];
      db.classAgenda = data.classAgenda || [];
      db.examAnalyses = data.examAnalyses || [];
      
      console.log('✅ Données chargées depuis backup.json !');
      console.log('📊 Classes:', db.classes.length, '| 👥 Élèves:', db.students.length);
      
      // On sauvegarde dans le localStorage pour les prochaines fois
      save();
      return;
    }
  } catch (e) {
    console.warn('⚠ Impossible de charger backup.json (fichier absent ou erreur réseau).');
  }

  console.log('⚠ Aucune donnée trouvée. Démarrage avec une base vide.');
}