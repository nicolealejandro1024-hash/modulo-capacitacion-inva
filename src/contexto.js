// Estado compartido de la interfaz: instancia de la API, usuario actual y utilidades de pantalla.
import { Api } from './api.js';
import { esc } from './util.js';

export const api = new Api({ storage: window.localStorage });
window.__api = api; // útil para revisar datos desde la consola del navegador

const CLAVE_USUARIO = 'inva-usuario-actual';

export const sesion = {
  get uid() {
    try {
      return localStorage.getItem(CLAVE_USUARIO);
    } catch {
      return null;
    }
  },
  ingresar(uid) {
    try {
      localStorage.setItem(CLAVE_USUARIO, uid);
    } catch {}
  },
  salir() {
    try {
      localStorage.removeItem(CLAVE_USUARIO);
    } catch {}
  },
};

export const app = {
  refrescar: () => {},
  /** Funciones a ejecutar antes de cambiar de pantalla (detener timers, etc.). */
  limpiezas: [],
};

export function navegar(hash) {
  if (location.hash === hash) app.refrescar();
  else location.hash = hash;
}

export function toast(msg, tipo = '') {
  let cont = document.querySelector('.toasts');
  if (!cont) {
    cont = document.createElement('div');
    cont.className = 'toasts';
    cont.setAttribute('role', 'status');
    cont.setAttribute('aria-live', 'polite');
    document.body.appendChild(cont);
  }
  const t = document.createElement('div');
  t.className = `toast ${tipo}`;
  t.textContent = msg;
  cont.appendChild(t);
  setTimeout(() => t.remove(), 4200);
}

/** Ejecuta una acción de la API mostrando el error al usuario si falla. */
export function intentar(fn, ok) {
  try {
    const r = fn();
    if (ok) toast(typeof ok === 'function' ? ok(r) : ok, 'ok');
    return r;
  } catch (e) {
    toast(e.message || 'Ocurrió un error.', 'error');
    if (!e.status) console.error(e);
    return undefined;
  }
}

/** Modal simple. `contenido` es HTML; devuelve el elemento para enlazar eventos. */
export function modal(titulo, contenido, { onCerrar } = {}) {
  const fondo = document.createElement('div');
  fondo.className = 'modal-fondo';
  fondo.innerHTML = `<div class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-t"><h2 id="modal-t">${esc(titulo)}</h2>${contenido}</div>`;
  const cerrar = () => {
    fondo.remove();
    document.removeEventListener('keydown', tecla);
    onCerrar?.();
  };
  const tecla = (e) => e.key === 'Escape' && cerrar();
  fondo.addEventListener('click', (e) => {
    if (e.target === fondo || e.target.closest('[data-cerrar]')) cerrar();
  });
  document.addEventListener('keydown', tecla);
  document.body.appendChild(fondo);
  fondo.querySelector('input,select,textarea,button')?.focus();
  return { el: fondo.querySelector('.modal'), cerrar };
}

export function confirmar(titulo, texto, textoBoton = 'Confirmar') {
  return new Promise((resolve) => {
    let respondio = false;
    const m = modal(
      titulo,
      `<p>${esc(texto)}</p><div class="acciones" style="justify-content:flex-end"><button class="btn btn-sec" data-cerrar>Cancelar</button><button class="btn btn-primario" data-ok>${esc(textoBoton)}</button></div>`,
      { onCerrar: () => !respondio && resolve(false) }
    );
    m.el.querySelector('[data-ok]').addEventListener('click', () => {
      respondio = true;
      m.cerrar();
      resolve(true);
    });
  });
}
