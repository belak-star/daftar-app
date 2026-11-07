// src/firebase/auth.js
// Gère l'authentification Firebase.

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { firebaseConfig } from './config.js';

// Initialise Firebase (une seule fois)
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

// Exporte les fonctions utiles
export {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
};

/** Messages d'erreur en français/arabe. */
export function authErrorMessage(code) {
  const messages = {
    'auth/invalid-credential': 'البريد أو كلمة المرور غير صحيحة.',
    'auth/invalid-email': 'البريد الإلكتروني غير صالح.',
    'auth/email-already-in-use': 'هذا البريد مسجل مسبقاً.',
    'auth/weak-password': 'كلمة المرور قصيرة (6 أحرف على الأقل).',
    'auth/network-request-failed': 'لا يوجد اتصال بالإنترنت.',
    'auth/too-many-requests': 'محاولات كثيرة. حاول لاحقاً.',
    'auth/user-not-found': 'لا يوجد حساب بهذا البريد.',
    'auth/wrong-password': 'كلمة المرور غير صحيحة.',
  };
  return messages[code] || 'خطأ: ' + code;
}