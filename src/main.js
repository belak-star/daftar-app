// src/main.js
// Point d'entrée de l'application DAFTAR (Mode Local).

import { db, save } from './core/state.js';
import { $, el } from './core/dom.js';

// Importation des modules (onglets)
import { renderDashboard, bindDashboard } from './features/dashboard.js';
import { renderAttList, renderAttClassSelect, bindAttendance } from './features/attendance.js';
import { renderMonthlyList, renderMonthlyClassSelect, bindMonthly } from './features/monthly.js';
import { renderGradesList, renderGradesClassSelect, bindGrades } from './features/grades.js';
import { renderDisciplineList, renderDisciplineClassSelects, bindDiscipline } from './features/discipline.js';
import { renderAgendaList, renderAgendaClassSelects, bindAgenda } from './features/agenda.js';
import { renderAnalysisClassSelect, bindAnalysis } from './features/examAnalysis.js';
import { renderClassSelect, renderStudentList, bindClasses } from './features/classes.js';

// --- GESTION DES ONGLETS ---
function showTab(id) {
  document.querySelectorAll('.panel').forEach(p => p.classList.add('hidden'));
  document.querySelectorAll('.tab').forEach(t => t.setAttribute('aria-selected', 'false'));
  
  const panel = document.getElementById(id);
  const tab = document.getElementById('tab' + id.charAt(0).toUpperCase() + id.slice(1));
  
  if (panel) panel.classList.remove('hidden');
  if (tab) tab.setAttribute('aria-selected', 'true');

  // Rafraîchir les données de l'onglet à l'ouverture
  if (id === 'dashboard') renderDashboard();
  if (id === 'daily') { renderAttClassSelect(); renderAttList(); }
  if (id === 'monthly') { renderMonthlyClassSelect(); renderMonthlyList(); }
  if (id === 'grades') { renderGradesClassSelect(); renderGradesList(); }
  if (id === 'discipline') { renderDisciplineClassSelects(); renderDisciplineList(); }
  if (id === 'agenda') { renderAgendaClassSelects(); renderAgendaList(); }
  if (id === 'analysis') { renderAnalysisClassSelect(); }
  if (id === 'classes') { renderClassSelect(); renderStudentList(); }
}

// --- ÉCRAN DE CONNEXION (Désactivé en mode local) ---
function afficherAuth(show) {
  const authScreen = $('authScreen');
  if (authScreen) {
    if (show) {
      authScreen.classList.remove('hidden');
      document.body.classList.remove('logged-in');
    } else {
      authScreen.classList.add('hidden');
      document.body.classList.add('logged-in');
    }
  }
}

// --- DÉMARRAGE DE L'APP ---
function initialiserApp() {
  // Date du jour dans l'en-tête
  const today = new Date();
  const todayLine = $('todayLine');
  if (todayLine) {
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    todayLine.textContent = today.toLocaleDateString('ar-TN', options);
  }

  // Boutons de navigation (Tabs)
  const tabs = [
    { id: 'dashboard', btn: 'tabDashboard' },
    { id: 'daily', btn: 'tabDaily' },
    { id: 'monthly', btn: 'tabMonthly' },
    { id: 'grades', btn: 'tabGrades' },
    { id: 'discipline', btn: 'tabDiscipline' },
    { id: 'agenda', btn: 'tabAgenda' },
    { id: 'analysis', btn: 'tabAnalysis' },
    { id: 'classes', btn: 'tabClasses' }
  ];

  tabs.forEach(t => {
    const btn = $(t.btn);
    if (btn) btn.onclick = () => showTab(t.id);
  });

  // Initialisation des événements de chaque onglet
  bindDashboard();
  bindAttendance();
  bindMonthly();
  bindGrades();
  bindDiscipline();
  bindAgenda();
  bindAnalysis();
  bindClasses();

  // Thème sombre / clair
  const btnTheme = $('btnTheme');
  if (btnTheme) {
    btnTheme.onclick = () => {
      document.body.classList.toggle('dark-mode');
      const isDark = document.body.classList.contains('dark-mode');
      btnTheme.textContent = isDark ? '☀ وضع نهاري' : '🌙 وضع ليلي';
    };
  }

  // Afficher le premier onglet par défaut
  showTab('dashboard');
}

// --- DÉMARRAGE ---
async function demarrer() {
  try {
    // Charger les données locales (backup ou localStorage)
    const { load } = await import('./core/state.js');
    await load();
    console.log('✅ db rechargé depuis localStorage (', db.students?.length || 0, 'élèves)');
  } catch (e) {
    console.warn('⚠ Impossible de charger les données locales', e);
  }

  // ⚠️ MODE LOCAL : On n'appelle plus Firebase
  console.log('⚠ Mode local activé. L\'application démarre sans connexion.');
  afficherAuth(false);      // Cache l'écran de connexion
  initialiserApp();         // Lance l'application
}

document.addEventListener('DOMContentLoaded', demarrer);