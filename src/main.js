// src/main.js
// Le chef d'orchestre : démarre l'application.

import { load, save, db } from './core/state.js';
import { $, toast } from './core/dom.js';
import { bindClasses, renderClassSelect, renderStudentList } from './features/classes.js';
import { bindAttendance, renderAttList, renderAttClassSelect } from './features/attendance.js';
import { bindMonthly, renderMonthlyList, renderMonthlyClassSelect } from './features/monthly.js';
import { bindGrades, renderGradesList, renderGradesClassSelect } from './features/grades.js';
import { bindDiscipline } from './features/discipline.js';
import { bindAgenda } from './features/agenda.js';
import { bindAnalysis } from './features/examAnalysis.js';
import { renderDashboard } from './features/dashboard.js';

// Firebase (imports protégés)
let auth = null;
let onAuthStateChanged = null;
let signInWithEmailAndPassword = null;
let createUserWithEmailAndPassword = null;
let signOut = null;
let sendPasswordResetEmail = null;
let authErrorMessage = null;
let initSync = null;
let firebaseReady = false;

async function initFirebase() {
  try {
    const authMod = await import('./firebase/auth.js');
    const syncMod = await import('./firebase/sync.js');
    auth = authMod.auth;
    onAuthStateChanged = authMod.onAuthStateChanged;
    signInWithEmailAndPassword = authMod.signInWithEmailAndPassword;
    createUserWithEmailAndPassword = authMod.createUserWithEmailAndPassword;
    signOut = authMod.signOut;
    sendPasswordResetEmail = authMod.sendPasswordResetEmail;
    authErrorMessage = authMod.authErrorMessage;
    initSync = syncMod.initSync;
    firebaseReady = true;
    console.log('✅ Firebase chargé');
  } catch (err) {
    console.error('❌ Firebase non chargé :', err);
    firebaseReady = false;
  }
}

function afficherDateDuJour() {
  const d = new Date();
  const jours = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
  const mois = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin',
                'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
  const texte = 'اليوم: ' + jours[d.getDay()] + ' ' + d.getDate() + ' ' + mois[d.getMonth()] + ' ' + d.getFullYear();
  $('todayLine').textContent = texte;
}

function activerOnglet(numero) {
  const onglets = ['tabDashboard', 'tabDaily', 'tabMonthly', 'tabGrades', 'tabDiscipline', 'tabAgenda', 'tabAnalysis', 'tabClasses'];
  const panneaux = ['dashboard', 'daily', 'monthly', 'grades', 'discipline', 'agenda', 'analysis', 'classes'];

  onglets.forEach((id, i) => {
    const btn = $(id);
    if (btn) btn.setAttribute('aria-selected', i === numero);
  });

  panneaux.forEach((id, i) => {
    const panel = $(id);
    if (panel) panel.classList.toggle('hidden', i !== numero);
  });

  if (numero === 0) renderDashboard();
  if (numero === 1) { renderAttClassSelect(); renderAttList(); }
  if (numero === 2) { renderMonthlyClassSelect(); renderMonthlyList(); }
  if (numero === 3) { renderGradesClassSelect(); renderGradesList(); }
  if (numero === 7) { renderClassSelect(); renderStudentList(); }
}

function afficherErreurAuth(msg) {
  const el = $('authError');
  if (el) { el.textContent = msg; el.style.color = ''; }
}

function cacherErreurAuth() {
  afficherErreurAuth('');
}

async function connexion() {
  if (!firebaseReady) { alert('Firebase غير متاح.'); return; }
  const email = $('authEmail').value.trim();
  const password = $('authPassword').value;
  if (!email || !password) { afficherErreurAuth('املأ الحقول أولاً.'); return; }
  cacherErreurAuth();
  try {
    await signInWithEmailAndPassword(auth, email, password);
  } catch (err) {
    afficherErreurAuth(authErrorMessage(err.code));
  }
}

async function inscription() {
  if (!firebaseReady) { alert('Firebase غير متاح.'); return; }
  const email = $('authEmail').value.trim();
  const password = $('authPassword').value;
  if (!email || !password) { afficherErreurAuth('املأ الحقول أولاً.'); return; }
  if (password.length < 6) { afficherErreurAuth('كلمة المرور يجب أن تكون 6 أحرف على الأقل.'); return; }
  cacherErreurAuth();
  try {
    await createUserWithEmailAndPassword(auth, email, password);
  } catch (err) {
    afficherErreurAuth(authErrorMessage(err.code));
  }
}

async function motDePasseOublie() {
  if (!firebaseReady) { alert('Firebase غير متاح.'); return; }
  const email = $('authEmail').value.trim();
  if (!email) { afficherErreurAuth('اكتب بريدك الإلكتروني أولاً.'); return; }
  cacherErreurAuth();
  try {
    await sendPasswordResetEmail(auth, email);
    afficherErreurAuth('✅ تم إرسال رابط إعادة التعيين.');
    const el = $('authError');
    if (el) el.style.color = '#1f7a4d';
  } catch (err) {
    afficherErreurAuth(authErrorMessage(err.code));
  }
}

async function deconnexion() {
  if (!firebaseReady) return;
  try {
    await signOut(auth);
    location.reload();
  } catch (err) {
    alert('خطأ في الخروج: ' + err.message);
  }
}

function afficherAuth(visible) {
  const screen = $('authScreen');
  if (!screen) return;
  if (visible) {
    screen.classList.remove('hidden');
    document.body.classList.remove('logged-in');
  } else {
    screen.classList.add('hidden');
    document.body.classList.add('logged-in');
  }
}

function rafraichirEcran() {
  console.log('☁️ Mise à jour depuis le cloud !');
  try {
    renderDashboard();
    const active = document.querySelector('.tab[aria-selected="true"]');
    if (active) {
      const id = active.id;
      if (id === 'tabDaily') { renderAttClassSelect(); renderAttList(); }
      if (id === 'tabMonthly') { renderMonthlyClassSelect(); renderMonthlyList(); }
      if (id === 'tabGrades') { renderGradesClassSelect(); renderGradesList(); }
      if (id === 'tabClasses') { renderClassSelect(); renderStudentList(); }
      if (id === 'tabDashboard') { renderDashboard(); }
    }
  } catch (e) {
    console.error('[cloud-update]', e);
  }
}

function initialiserApp() {
  if (window.__daftarInit) return;
  window.__daftarInit = true;

  $('tabDashboard').addEventListener('click', () => activerOnglet(0));
  $('tabDaily').addEventListener('click', () => activerOnglet(1));
  $('tabMonthly').addEventListener('click', () => activerOnglet(2));
  $('tabGrades').addEventListener('click', () => activerOnglet(3));
  $('tabDiscipline').addEventListener('click', () => activerOnglet(4));
  $('tabAgenda').addEventListener('click', () => activerOnglet(5));
  $('tabAnalysis').addEventListener('click', () => activerOnglet(6));
  $('tabClasses').addEventListener('click', () => activerOnglet(7));

  bindClasses();
  bindAttendance();
  bindMonthly();
  bindGrades();
  bindDiscipline();
  bindAgenda();
  bindAnalysis();

  renderDashboard();

  // Mode sombre
  const btnTheme = $('btnTheme');
  if (btnTheme) {
    if (localStorage.getItem('theme') === 'dark') {
      document.body.classList.add('dark-mode');
      btnTheme.textContent = '☀️ وضع نهاري';
    }
    btnTheme.addEventListener('click', () => {
      document.body.classList.toggle('dark-mode');
      const isDark = document.body.classList.contains('dark-mode');
      btnTheme.textContent = isDark ? '☀️ وضع نهاري' : '🌙 وضع ليلي';
      localStorage.setItem('theme', isDark ? 'dark' : 'light');
    });
  }

  document.addEventListener('cloud-update', rafraichirEcran);

  // Bouton sauvegarde
  const btnBackup = $('btnBackup');
  if (btnBackup) {
    btnBackup.addEventListener('click', () => {
      try {
        const data = localStorage.getItem('schoolDataV2');
        if (!data) { alert('لا توجد بيانات للحفظ.'); return; }
        const blob = new Blob([data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const date = new Date().toISOString().slice(0, 10);
        a.download = 'daftar-sauvegarde-' + date + '.json';
        a.click();
        URL.revokeObjectURL(url);
        alert('✅ تم تنزيل النسخة الاحتياطية.');
      } catch (err) {
        alert('❌ خطأ: ' + err.message);
      }
    });
  }

  // Bouton restaurer
  const btnRestore = $('btnRestore');
  const restoreFile = $('restoreFile');
  if (btnRestore && restoreFile) {
    btnRestore.addEventListener('click', () => restoreFile.click());
    restoreFile.addEventListener('change', () => {
      const file = restoreFile.files[0];
      if (!file) return;
      if (!confirm('سيتم استبدال البيانات الحالية. هل تريد المتابعة؟')) {
        restoreFile.value = '';
        return;
      }
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = JSON.parse(e.target.result);
          if (!data.classes || !data.students || !data.records) {
            alert('❌ الملف غير صالح.');
            return;
          }
          localStorage.setItem('schoolDataV2', JSON.stringify(data));
          alert('✅ تم استرجاع البيانات. سيتم إعادة تحميل الصفحة.');
          location.reload();
        } catch (err) {
          alert('❌ خطأ: ' + err.message);
        }
      };
      reader.readAsText(file);
    });
  }

  setTimeout(() => toast('مرحباً بك في دفتر القسم ! 👋'), 300);
}

async function demarrer() {
  console.log('✅ demarrer() commence');

  // 1. Charger backup.json EN PREMIER (avant Firebase)
  try {
    const res = await fetch('./backup.json');
    if (res.ok) {
      const data = await res.json();
      localStorage.setItem('schoolDataV2', JSON.stringify(data));
      console.log('✅ Données chargées depuis backup.json (' + data.classes.length + ' classes, ' + data.students.length + ' élèves)');
    } else {
      console.log('⚠️ backup.json non trouvé (status ' + res.status + ')');
    }
  } catch (e) {
    console.log('⚠️ Erreur lecture backup.json :', e.message);
  }

  // 2. Charger les données locales
  load();
  afficherDateDuJour();

  // 3. Charger Firebase (APRÈS le chargement local)
  // await initFirebase();

  const btnLogin = $('btnLogin');
  const btnSignup = $('btnSignup');
  const btnForgot = $('btnForgot');
  const btnLogout = $('btnLogout');

  if (btnLogin) btnLogin.addEventListener('click', connexion);
  if (btnSignup) btnSignup.addEventListener('click', inscription);
  if (btnForgot) btnForgot.addEventListener('click', motDePasseOublie);
  if (btnLogout) btnLogout.addEventListener('click', deconnexion);

  const pwdInput = $('authPassword');
  if (pwdInput) {
    pwdInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') connexion();
    });
  }

  if (firebaseReady && onAuthStateChanged) {
    try {
      initSync();
    } catch (err) {
      console.error('initSync:', err);
    }

    onAuthStateChanged(auth, (user) => {
      console.log('🔐 Auth:', user ? user.email : 'non connecté');
      if (user) {
        afficherAuth(false);
        const userEmail = $('userEmail');
        const userBar = $('userBar');
        if (userEmail) userEmail.textContent = user.email || '';
        if (userBar) userBar.style.display = 'block';
        initialiserApp();
      } else {
        afficherAuth(true);
        const userBar = $('userBar');
        if (userBar) userBar.style.display = 'none';
      }
    });
  } else {
    console.warn('⚠️ Firebase non disponible, mode local');
    afficherAuth(false);
    initialiserApp();
  }

  console.log('✅ main.js a fini son exécution');
}

demarrer();
