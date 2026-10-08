// Armazón de la aplicación: inicio de sesión de demostración, layout (cabecera + menú lateral), campana y rutas.
import { api, sesion, app, navegar, toast, confirmar } from './contexto.js';
import { esc, fmtFechaLarga, fmtFechaHora, iniciales } from './util.js';
import { ico } from './iconos.js';
import { vistaMisCapacitaciones, vistaCurso, vistaAsistenciaQR } from './vistas/colaborador.js';
import { vistaDashboard, vistaListaCapacitaciones, vistaEditor, vistaColaboradores } from './vistas/admin.js';
import { vistaSeguimiento, vistaDetallePersona, vistaRegistro, vistaQR } from './vistas/seguimiento.js';

const raiz = document.getElementById('app');
const CLAVE_DESTINO = 'inva-destino';

const DESCRIPCION_DEMO = {
  u1: 'Propietaria de «Inducción INVA» y «Charla SST». No ve «Inducción HC».',
  u2: 'Editora de «Inducción INVA».',
  u3: 'Jefe de RR.HH. Propietario de «Inducción HC». No ve «Inducción INVA».',
  u4: 'Editora de «Inducción HC».',
  c7: 'Colaborador. Solo lectura del seguimiento de «Charla SST».',
};

const rutas = [
  [/^#\/mis-capacitaciones$/, () => vistaMisCapacitaciones()],
  [/^#\/mis-capacitaciones\/([^/]+)$/, (m, q) => vistaCurso(m[1], q)],
  [/^#\/asistencia\/([^/]+)$/, (m) => vistaAsistenciaQR(m[1])],
  [/^#\/dashboard$/, () => vistaDashboard(), { admin: true }],
  [/^#\/colaboradores$/, () => vistaColaboradores(), { admin: true }],
  [/^#\/capacitaciones$/, () => vistaListaCapacitaciones(), { admin: true }],
  [/^#\/capacitaciones\/nueva$/, () => vistaEditor(null), { admin: true }],
  [/^#\/capacitaciones\/([^/]+)\/editar$/, (m) => vistaEditor(m[1]), { admin: true }],
  [/^#\/capacitaciones\/([^/]+)\/seguimiento$/, (m) => vistaSeguimiento(m[1]), { admin: true }],
  [/^#\/capacitaciones\/([^/]+)\/persona\/([^/]+)$/, (m) => vistaDetallePersona(m[1], m[2]), { admin: true }],
  [/^#\/capacitaciones\/([^/]+)\/registro$/, (m) => vistaRegistro(m[1]), { admin: true }],
  [/^#\/capacitaciones\/([^/]+)\/qr\/([^/]+)$/, (m) => vistaQR(m[1], m[2]), { admin: true }],
];

function inicioPara(perfil) {
  return perfil.puedeAdministrar ? '#/dashboard' : '#/mis-capacitaciones';
}

function vistaLogin() {
  const usuarios = api.usuariosDemo();
  const boton = (u) => `<button class="btn-usuario" data-u="${esc(u.id)}">
      <span class="avatar">${esc(iniciales(u.nombre))}</span>
      <span class="txt"><b>${esc(u.nombre)}</b><span>${esc(u.cargo)} · ${esc(u.area)}</span>${DESCRIPCION_DEMO[u.id] ? `<span style="color:var(--naranja-tx)">${esc(DESCRIPCION_DEMO[u.id])}</span>` : ''}</span>
    </button>`;
  raiz.innerHTML = `<div class="login"><div class="caja">
    <div class="fila"><span class="logo" style="background:var(--oscuro);color:#fff">INVA</span><div><h1 style="font-size:24px">Portal INVA · Capacitaciones</h1><p class="muted small">Versión de demostración: elige con qué usuario entrar. En el portal real se usa el inicio de sesión existente.</p></div></div>
    <h2>Administradores RR.HH.</h2>
    <div class="lista-usuarios">${usuarios.filter((u) => u.rol === 'admin_rrhh').map(boton).join('')}</div>
    <h2>Colaboradores</h2>
    <div class="lista-usuarios">${usuarios.filter((u) => u.rol !== 'admin_rrhh').map(boton).join('')}</div>
  </div></div>`;
  raiz.querySelectorAll('[data-u]').forEach((b) =>
    b.addEventListener('click', () => {
      sesion.ingresar(b.dataset.u);
      let destino = null;
      try {
        destino = sessionStorage.getItem(CLAVE_DESTINO);
        sessionStorage.removeItem(CLAVE_DESTINO);
      } catch {}
      navegar(destino || inicioPara(api.perfil(b.dataset.u)));
    })
  );
  document.title = 'Ingresar · Portal INVA';
}

function layout(perfil, vista, hash) {
  const notifs = api.notificaciones(perfil.id);
  const sinLeer = notifs.filter((n) => !n.leida).length;
  const mias = api.misCapacitaciones(perfil.id);
  const pendientesMias = mias.filter((x) => x.resumen.estado !== 'completado').length;
  const pendientesAdmin = perfil.puedeAdministrar ? api.dashboard(perfil.id).pendientes : 0;
  const actual = (prefijo) => (hash === prefijo || hash.startsWith(prefijo + '/') ? 'aria-current="page"' : '');
  const enCapacitaciones = /^#\/capacitaciones/.test(hash) ? 'aria-current="page"' : '';

  return `
  <div class="demo-bar no-print" role="region" aria-label="Controles de demostración">
    <span><strong>DEMO</strong> · Fecha simulada: <b>${esc(fmtFechaLarga(api.hoy()))}</b></span>
    <button data-demo="dia" title="Simula que pasa un día y ejecuta los recordatorios automáticos">Avanzar 1 día ⏩</button>
    <span class="sep"></span>
    <button data-demo="cambiar">Cambiar de usuario</button>
    <button data-demo="reset">Restablecer datos de ejemplo</button>
  </div>
  <header class="top">
    <div class="top-izq">
      <button class="btn-icono menu-movil" id="btn-menu" aria-label="Abrir menú" aria-expanded="false">${ico.menu}</button>
      <a class="logo" href="${inicioPara(perfil)}">INVA</a>
      <span class="seccion">${perfil.puedeAdministrar ? 'Administración' : 'Mi cuenta'}</span>
      ${perfil.rol === 'admin_rrhh' ? '<span class="chip-rol">Administrador RR.HH.</span>' : '<span class="chip-rol">Colaborador</span>'}
    </div>
    <div class="top-der">
      <button class="btn-icono" id="btn-notif" aria-label="Notificaciones${sinLeer ? `, ${sinLeer} sin leer` : ''}" aria-expanded="false">${ico.campana}${sinLeer ? `<span class="badge">${sinLeer > 9 ? '9+' : sinLeer}</span>` : ''}</button>
      <span class="avatar">${esc(iniciales(perfil.nombre))}</span>
      <span class="usuario-top"><b>${esc(perfil.nombre)}</b><span>${esc(perfil.cargo)}</span></span>
      <button class="btn-icono" data-demo="cambiar" aria-label="Salir">${ico.salir}</button>
    </div>
    <div class="panel-notif" id="panel-notif" hidden>
      <header><b>Notificaciones</b><span class="small muted">${notifs.length} recientes</span></header>
      ${
        notifs.length
          ? notifs.map((n) => `<a class="notif ${n.leida ? '' : 'nueva'}" href="${esc(n.enlace || '#')}"><b>${esc(n.titulo)}</b><span>${esc(n.texto)}</span><small>${esc(fmtFechaHora(n.creado_en))}</small></a>`).join('')
          : '<div class="vacio small">Sin notificaciones.</div>'
      }
    </div>
  </header>
  <div class="cuerpo">
    <nav class="lateral" id="lateral" aria-label="Menú principal">
      ${
        perfil.puedeAdministrar
          ? `<span class="grupo">ADMINISTRACIÓN</span>
        <a href="#/dashboard" ${actual('#/dashboard')}>${ico.dashboard}Dashboard</a>
        ${perfil.rol === 'admin_rrhh' ? `<a href="#/colaboradores" ${actual('#/colaboradores')}>${ico.personas}Colaboradores</a>` : ''}
        <a href="#/capacitaciones" ${enCapacitaciones}>${ico.capacitaciones}Capacitaciones${pendientesAdmin ? `<span class="cnt" title="Personas pendientes">${pendientesAdmin}</span>` : '<span class="nuevo">NUEVO</span>'}</a>
        <div class="div"></div>`
          : ''
      }
      <span class="grupo">MI CUENTA</span>
      <a href="#/mis-capacitaciones" ${actual('#/mis-capacitaciones')}>${ico.birrete}Mis Capacitaciones${pendientesMias ? `<span class="cnt">${pendientesMias}</span>` : ''}</a>
    </nav>
    <main id="main" tabindex="-1"><div class="contenedor">${vista.html}</div></main>
  </div>`;
}

function enlazarLayout(perfil) {
  raiz.querySelectorAll('[data-demo]').forEach((b) =>
    b.addEventListener('click', async () => {
      const accion = b.dataset.demo;
      if (accion === 'cambiar') {
        sesion.salir();
        navegar('#/login');
      } else if (accion === 'dia') {
        const r = api.avanzarDia();
        toast(`Pasó un día. Tarea programada: ${r.enviados} recordatorio(s) automático(s) enviados.`, 'ok');
        app.refrescar();
      } else if (accion === 'reset') {
        if (await confirmar('Restablecer datos', 'Se borrarán los cambios hechos en esta demo y se volverán a cargar los datos de ejemplo.', 'Restablecer')) {
          api.restablecerDemo();
          api.ejecutarRecordatoriosAutomaticos();
          toast('Datos de ejemplo restablecidos.', 'ok');
          navegar(inicioPara(api.perfil(perfil.id)));
        }
      }
    })
  );
  const panel = raiz.querySelector('#panel-notif');
  const btnNotif = raiz.querySelector('#btn-notif');
  btnNotif.addEventListener('click', (e) => {
    e.stopPropagation();
    panel.hidden = !panel.hidden;
    btnNotif.setAttribute('aria-expanded', String(!panel.hidden));
    if (!panel.hidden) {
      api.marcarNotificacionesLeidas(perfil.id);
      btnNotif.querySelector('.badge')?.remove();
    }
  });
  const lateral = raiz.querySelector('#lateral');
  const btnMenu = raiz.querySelector('#btn-menu');
  btnMenu.addEventListener('click', () => {
    lateral.classList.toggle('abierto');
    btnMenu.setAttribute('aria-expanded', String(lateral.classList.contains('abierto')));
  });
}

function vistaError(e) {
  const denegado = e.status === 403;
  return {
    titulo: denegado ? 'Sin acceso' : 'Error',
    html: `<div class="tarjeta vacio" role="alert">
      <span style="font-size:42px;font-weight:800;color:${denegado ? 'var(--rojo)' : 'var(--naranja-tx)'}">${denegado ? '403' : '!'}</span>
      <h1 style="font-size:22px">${denegado ? 'No tienes acceso' : 'Algo salió mal'}</h1>
      <p>${esc(e.message)}</p>
      <a class="btn btn-oscuro" href="#/">Ir al inicio</a></div>`,
  };
}

function render() {
  for (const fn of app.limpiezas.splice(0)) {
    try {
      fn();
    } catch {}
  }
  api.cargar(); // por si otra pestaña cambió los datos
  const [hash, qs] = (location.hash || '#/').split('?');
  const query = new URLSearchParams(qs || '');
  const uid = sesion.uid;
  let perfil = null;
  try {
    perfil = uid ? api.perfil(uid) : null;
  } catch {
    sesion.salir();
  }

  if (hash === '#/login' || !perfil) {
    if (hash !== '#/login' && hash !== '#/') {
      try {
        sessionStorage.setItem(CLAVE_DESTINO, location.hash);
      } catch {}
    }
    if (hash !== '#/login') return navegar('#/login');
    return vistaLogin();
  }

  const ruta = rutas.find(([re]) => re.test(hash));
  if (!ruta) return navegar(inicioPara(perfil));
  const [re, fn, opciones = {}] = ruta;

  let vista;
  try {
    if (opciones.admin && !perfil.puedeAdministrar) {
      const err = new Error('Esta sección es solo para Administradores RR.HH. y responsables de capacitaciones.');
      err.status = 403;
      throw err;
    }
    vista = fn(hash.match(re), query);
  } catch (e) {
    if (!e.status) console.error(e);
    vista = vistaError(e);
  }

  document.title = `${vista.titulo} · Portal INVA`;
  if (vista.sinLayout) {
    raiz.innerHTML = vista.html;
  } else {
    raiz.innerHTML = layout(perfil, vista, hash);
    enlazarLayout(perfil);
  }
  try {
    vista.montar?.(raiz);
  } catch (e) {
    console.error(e);
    toast(e.message, 'error');
  }
}

app.refrescar = render;
document.addEventListener('click', (e) => {
  const panel = document.getElementById('panel-notif');
  if (panel && !panel.hidden && !panel.contains(e.target)) panel.hidden = true;
});
let hashAnterior = '';
window.addEventListener('hashchange', () => {
  const base = location.hash.split('?')[0];
  if (base !== hashAnterior) window.scrollTo(0, 0);
  hashAnterior = base;
  render();
});

// Tarea programada diaria (en producción: cron del servidor).
api.ejecutarRecordatoriosAutomaticos();
hashAnterior = location.hash.split('?')[0];
render();
