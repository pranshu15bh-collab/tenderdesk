// app.js — boot, hash router, and event delegation. Wires views to the store.
import { load, subscribe, getState, clearFlash } from './store.js';
import { render, setRerender, actions, forms, ui } from './views.js';

function parseHash() {
  const raw = location.hash || '#/';
  const parts = raw.replace(/^#\/?/, '').split('/').filter(Boolean);
  const head = parts[0] || 'landing';
  const params = parts.slice(1);
  let name = head;
  if (head === 'requirements' && params[0]) name = 'requirement';
  if (head === 'quotes' && params[0]) name = 'quote';
  if (head === 'orders' && params[0]) name = 'order';
  return { name, params, hash: '#/' + parts.join('/') };
}

let flashTimer = null;

// Copy each column header onto its cells so tables can become cards at 375px
// without horizontal scrolling (mobile rule in BUILD-BRIEF section 6).
function decorateTables(root) {
  root.querySelectorAll('table.table').forEach((t) => {
    const heads = [...t.querySelectorAll('thead th')].map((th) => th.textContent.trim());
    t.querySelectorAll('tbody tr').forEach((tr) => {
      [...tr.children].forEach((td, i) => { if (heads[i]) td.setAttribute('data-label', heads[i]); });
    });
  });
}

function draw() {
  const state = getState();
  const route = parseHash();
  const app = document.getElementById('app');
  app.innerHTML = render(state, route);
  decorateTables(app);

  if (ui.err) {
    const b = document.createElement('div');
    b.className = 'flash flash--danger';
    b.textContent = ui.err;
    app.querySelector('.content')?.prepend(b);
  }
  if (state.flash && !flashTimer) {
    flashTimer = setTimeout(() => { flashTimer = null; clearFlash(); }, 4200);
  }
  if (route.name === 'landing' || route.name === 'about') {
    document.documentElement.classList.add('is-site');
  } else {
    document.documentElement.classList.remove('is-site');
  }
  window.scrollTo(0, 0);
}

document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-action]');
  if (!el) return;
  const fn = actions[el.dataset.action];
  if (fn) { e.preventDefault(); fn(el, e); }
});

document.addEventListener('submit', (e) => {
  const form = e.target.closest('[data-form]');
  if (!form) return;
  e.preventDefault();
  const fn = forms[form.dataset.form];
  if (fn) fn(form, e);
});

document.addEventListener('change', (e) => {
  const el = e.target.closest('select[data-action="role"]');
  if (el) actions.role(el);
});

window.addEventListener('hashchange', () => {
  ui.err = null;
  document.documentElement.classList.remove('menu-open');
  draw();
});

load();
subscribe(draw);
setRerender(draw);
draw();
