// src/firebase/auth.js
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged, sendPasswordResetEmail } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { $ } from '../core/dom.js';

// ⚠️ REMPLACE CES VALEURS PAR CELLES DE TON PROJET FIREBASE ⚠️
const firebaseConfig = {
  apiKey: "TON_API_KEY",
  authDomain: "TON_PROJET.firebaseapp.com",
  projectId: "TON_PROJET",
  storageBucket: "TON_PROJET.appspot.com",
  messagingSenderId: "TON_SENDER_ID",
  appId: "TON_APP_ID"
};

export let app;
export let auth;

export async function initFirebase() {
  if (app) return; // Déjà initialisé
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
}

export function setupAuthUI() {
  const btnLogin = $('btnLogin');
  const btnSignup = $('btnSignup');
  const btnForgot = $('btnForgot');
  const btnLogout = $('btnLogout');
  const authError = $('authError');

  if (btnLogin) {
    btnLogin.onclick = async () => {
      const email = $('authEmail').value;
      const pass = $('authPassword').value;
      try {
        authError.textContent = '';
        await signInWithEmailAndPassword(auth, email, pass);
      } catch (e) {
        authError.textContent = "خطأ: " + (e.code === 'auth/user-not-found' ? 'المستخدم غير موجود' : e.code === 'auth/wrong-password' ? 'كلمة مرور خاطئة' : e.message);
      }
    };
  }

  if (btnSignup) {
    btnSignup.onclick = async () => {
      const email = $('authEmail').value;
      const pass = $('authPassword').value;
      try {
        authError.textContent = '';
        await createUserWithEmailAndPassword(auth, email, pass);
      } catch (e) {
        authError.textContent = "خطأ: " + e.message;
      }
    };
  }

  if (btnForgot) {
    btnForgot.onclick = async () => {
      const email = $('authEmail').value;
      if (!email) { authError.textContent = "أدخل بريدك الإلكتروني أولاً."; return; }
      try {
        authError.textContent = '';
        await sendPasswordResetEmail(auth, email);
        authError.textContent = "✅ تم إرسال رابط الاستعادة إلى بريدك.";
        authError.style.color = "#1f7a4d";
      } catch (e) {
        authError.textContent = "خطأ: " + e.message;
      }
    };
  }

  if (btnLogout) {
    btnLogout.onclick = () => signOut(auth);
  }
}