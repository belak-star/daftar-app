// src/core/dom.js
// Boîte à outils pour fabriquer et manipuler la page web.

export const $ = (id) => document.getElementById(id);

export function el(tag, attrs = {}, ...children) {
  const e = document.createElement(tag);
  for (const k in attrs) {
    if (k === 'class') e.className = attrs[k];
    else if (k === 'textContent') e.textContent = attrs[k];
    else if (k.startsWith('data-')) e.setAttribute(k, attrs[k]);
    else e[k] = attrs[k];
  }
  children.forEach(c => c && e.append(c));
  return e;
}

export function toast(msg) {
  const t = $('toast');
  if (!t) { console.warn('toast: #toast introuvable'); return; }
  t.textContent = msg;
  t.classList.add('on');
  clearTimeout(toast._h);
  toast._h = setTimeout(() => t.classList.remove('on'), 3000);
}