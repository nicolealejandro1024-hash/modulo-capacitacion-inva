// Pantallas de administración: Dashboard, Capacitaciones (lista + crear/editar) y Colaboradores.
import { api, sesion, app, navegar, toast, intentar, modal, confirmar } from '../contexto.js';
import { AccesoDenegado } from '../api.js';
import { esc, fmtFecha, fmtFechaHora, sumarDias, iniciales, CATEGORIAS, MODALIDADES, ESTADOS_CAP, ROLES_RESP, MODOS_ASIGNACION } from '../util.js';
import { ico } from '../iconos.js';

const pillEstadoCap = (e) => `<span class="pill ${e === 'publicada' ? 'verde' : e === 'borrador' ? 'gris' : 'oscuro'}">${esc(ESTADOS_CAP[e])}</span>`;
const pillRol = (r) => `<span class="pill naranja">${esc(ROLES_RESP[r])}</span>`;

// ───────────────────────── Dashboard ─────────────────────────
export function vistaDashboard() {
  const p = api.perfil(sesion.uid);
  const d = api.dashboard(sesion.uid);
  const filas = d.capacitaciones
    .map(({ capacitacion: c, stats: s, rol }) => {
      const pct = s.asignados ? Math.round((s.completados / s.asignados) * 100) : 0;
      return `<tr>
        <td><span class="nombre">${esc(c.titulo)}</span><span class="det">${esc(CATEGORIAS[c.categoria])} · vence ${esc(fmtFecha(c.fecha_limite))}</span></td>
        <td>${pillRol(rol)}</td>
        <td style="min-width:160px"><div class="barra verde"><div style="width:${pct}%"></div></div><span class="det">${s.completados}/${s.asignados} completaron</span></td>
        <td><b style="color:var(--naranja-tx)">${s.faltan}</b></td>
        <td><b style="color:var(--rojo)">${s.vencidos}</b></td>
        <td><a class="btn btn-sec btn-sm" href="#/capacitaciones/${esc(c.id)}/seguimiento">Ver seguimiento</a></td>
      </tr>`;
    })
    .join('');
  return {
    titulo: 'Dashboard',
    html: `
    <div class="cab"><div><h1>Hola, ${esc(p.nombre.split(' ')[0])}</h1><p class="sub">Resumen de las capacitaciones a tu cargo.</p></div>
      ${p.rol === 'admin_rrhh' ? '<a class="btn btn-primario" href="#/capacitaciones/nueva">+ Nueva capacitación</a>' : ''}</div>
    <div class="kpis">
      <a class="kpi alerta" href="#/capacitaciones" style="text-decoration:none;color:inherit"><span class="et">Capacitaciones pendientes</span><span class="num">${d.pendientes}</span><span class="det">personas que faltan completar</span></a>
      <div class="kpi peligro"><span class="et">Vencidos</span><span class="num">${d.vencidos}</span><span class="det">pasaron la fecha límite</span></div>
      <div class="kpi ok"><span class="et">Completados</span><span class="num">${d.completados}</span><span class="det">de ${d.asignados} asignaciones</span></div>
      <div class="kpi"><span class="et">Capacitaciones activas</span><span class="num">${d.capacitaciones.length}</span><span class="det">donde eres responsable</span></div>
    </div>
    <div class="tarjeta sin-pad">
      <div class="filtros"><h2>Capacitaciones publicadas a tu cargo</h2></div>
      ${d.capacitaciones.length ? `<div class="tabla-wrap"><table><thead><tr><th>Capacitación</th><th>Tu rol</th><th>Avance</th><th>Faltan</th><th>Vencidos</th><th></th></tr></thead><tbody>${filas}</tbody></table></div>` : `<div class="vacio">No eres responsable de ninguna capacitación publicada.</div>`}
    </div>
    <p class="muted small">Solo se cuentan las capacitaciones en las que figuras como responsable. Las demás no aparecen aunque seas Administrador RR.HH.</p>`,
  };
}

// ───────────────────────── Lista de capacitaciones ─────────────────────────
export function vistaListaCapacitaciones() {
  const p = api.perfil(sesion.uid);
  const lista = api.listarCapacitacionesAdmin(sesion.uid);
  const filas = lista
    .map(({ capacitacion: c, rol, stats: s }) => {
      const puedeEditar = rol !== 'solo_lectura';
      return `<article class="fila-cap">
        <div class="t">
          <div class="fila" style="gap:6px">${pillEstadoCap(c.estado)}<span class="pill gris">${esc(CATEGORIAS[c.categoria])}</span><span class="pill gris">${esc(MODALIDADES[c.modalidad])}</span>${pillRol(rol)}</div>
          <h2>${esc(c.titulo)}</h2>
          <span class="small muted">${c.videos.length} video(s) · ${c.preguntas.length} pregunta(s) · fecha límite ${esc(fmtFecha(c.fecha_limite))}</span>
        </div>
        <div class="nums"><div><b>${s.asignados}</b>asignados</div><div><b style="color:var(--verde)">${s.completados}</b>completaron</div><div><b style="color:var(--naranja-tx)">${s.faltan}</b>faltan</div><div><b style="color:var(--rojo)">${s.vencidos}</b>vencidos</div></div>
        <div class="acciones">
          ${c.estado !== 'borrador' ? `<a class="btn btn-oscuro btn-sm" href="#/capacitaciones/${esc(c.id)}/seguimiento">Seguimiento</a>` : ''}
          ${puedeEditar ? `<a class="btn btn-sec btn-sm" href="#/capacitaciones/${esc(c.id)}/editar">Editar</a>` : `<a class="btn btn-sec btn-sm" href="#/capacitaciones/${esc(c.id)}/editar">Ver</a>`}
        </div>
      </article>`;
    })
    .join('');
  return {
    titulo: 'Capacitaciones',
    html: `
    <div class="cab"><div><h1>Capacitaciones</h1><p class="sub">Solo ves las capacitaciones en las que eres responsable.</p></div>
      ${p.rol === 'admin_rrhh' ? '<a class="btn btn-primario" href="#/capacitaciones/nueva">+ Nueva capacitación</a>' : ''}</div>
    ${lista.length ? `<div class="lista-caps">${filas}</div>` : `<div class="tarjeta vacio">${ico.capacitaciones}<b>Aún no eres responsable de ninguna capacitación.</b><span>Crea una nueva o pide a la persona propietaria que te agregue como responsable.</span></div>`}`,
  };
}

// ───────────────────────── Colaboradores (nuevos ingresos) ─────────────────────────
export function vistaColaboradores() {
  const p = api.perfil(sesion.uid);
  if (p.rol !== 'admin_rrhh') throw new AccesoDenegado('Esta sección es solo para Administradores RR.HH.');
  const usuarios = api.listarUsuarios(sesion.uid);
  const filas = usuarios
    .map(
      (u) => `<tr><td><span class="fila" style="gap:10px;flex-wrap:nowrap"><span class="avatar" style="background:var(--borde-suave);color:var(--texto)">${esc(iniciales(u.nombre))}</span><span><span class="nombre">${esc(u.nombre)}</span><span class="det">${esc(u.correo)}</span></span></span></td>
      <td>${esc(u.area)}</td><td>${esc(u.cargo)}</td><td>${esc(u.sede)}</td><td>${esc(fmtFecha(u.ingreso))}</td><td>${u.rol === 'admin_rrhh' ? '<span class="pill naranja">Admin RR.HH.</span>' : '<span class="pill gris">Colaborador</span>'}</td></tr>`
    )
    .join('');
  return {
    titulo: 'Colaboradores',
    html: `
    <div class="cab"><div><h1>Colaboradores</h1><p class="sub">En el portal real esta lista ya existe. Aquí sirve para probar la asignación automática a nuevos ingresos.</p></div>
      <button class="btn btn-primario" id="nuevo-ingreso">+ Registrar nuevo ingreso</button></div>
    <div class="tarjeta sin-pad"><div class="tabla-wrap"><table><thead><tr><th>Nombre</th><th>Área</th><th>Cargo</th><th>Sede</th><th>Ingreso</th><th>Rol</th></tr></thead><tbody>${filas}</tbody></table></div></div>`,
    montar: (root) => {
      root.querySelector('#nuevo-ingreso').addEventListener('click', () => {
        const areas = [...new Set(usuarios.map((u) => u.area))];
        const sedes = [...new Set(usuarios.map((u) => u.sede))];
        const m = modal(
          'Registrar nuevo ingreso',
          `<form class="pila" id="f-ingreso">
            <label class="campo"><span>Nombre completo</span><input type="text" name="nombre" required></label>
            <label class="campo"><span>Correo</span><input type="email" name="correo"></label>
            <div class="form-grid">
              <label class="campo"><span>Área</span><input type="text" name="area" list="dl-areas"></label>
              <label class="campo"><span>Cargo</span><input type="text" name="cargo"></label>
              <label class="campo"><span>Sede</span><input type="text" name="sede" list="dl-sedes"></label>
              <label class="campo"><span>DNI</span><input type="text" name="dni" inputmode="numeric"></label>
            </div>
            <datalist id="dl-areas">${areas.map((a) => `<option value="${esc(a)}">`).join('')}</datalist>
            <datalist id="dl-sedes">${sedes.map((a) => `<option value="${esc(a)}">`).join('')}</datalist>
            <p class="muted small">Se le asignarán automáticamente las capacitaciones publicadas que tengan activada la opción «asignar a nuevos ingresos».</p>
            <div class="acciones" style="justify-content:flex-end"><button type="button" class="btn btn-sec" data-cerrar>Cancelar</button><button class="btn btn-primario">Registrar</button></div>
          </form>`
        );
        m.el.querySelector('#f-ingreso').addEventListener('submit', (e) => {
          e.preventDefault();
          const datos = Object.fromEntries(new FormData(e.target));
          const r = intentar(() => api.registrarNuevoIngreso(sesion.uid, datos));
          if (r) {
            m.cerrar();
            toast(r.asignadas.length ? `${r.usuario.nombre} registrado. Se le asignó: ${r.asignadas.join(', ')}.` : `${r.usuario.nombre} registrado.`, 'ok');
            app.refrescar();
          }
        });
      });
    },
  };
}

// ───────────────────────── Crear / editar capacitación ─────────────────────────
function capacitacionVacia() {
  return {
    titulo: '',
    descripcion: '',
    categoria: 'induccion',
    obligatoria: true,
    modalidad: 'virtual',
    capacitador_nombre: '',
    capacitador_cargo: '',
    lugar: '',
    duracion_min: 30,
    fecha_limite: sumarDias(api.hoy(), 14),
    dias_para_completar: 7,
    nota_minima: 1,
    intentos_max: 3,
    mostrar_respuestas: true,
    asignar_nuevos_ingresos: false,
    estado: 'borrador',
    asignacion: { modo: 'todos', valores: [] },
    recordatorios: { automaticos: true, cada_dias: 3, aviso_dia_antes: true, copia_jefe_directo: false },
    videos: [],
    reuniones: [],
    preguntas: [],
    responsablesNuevos: [],
  };
}

export function vistaEditor(capId) {
  const uid = sesion.uid;
  const perfil = api.perfil(uid);
  let info = null;
  let f;
  if (capId) {
    info = api.obtenerCapacitacionAdmin(uid, capId);
    f = structuredClone(info.capacitacion);
  } else {
    if (perfil.rol !== 'admin_rrhh') throw new AccesoDenegado('Solo los Administradores RR.HH. pueden crear capacitaciones.');
    f = capacitacionVacia();
  }
  f.reuniones ||= [];
  const soloLectura = info && !info.permisos.editar;
  const cerrada = f.estado === 'cerrada';
  const bloqueado = soloLectura || cerrada;
  const usuarios = api.listarUsuarios(uid);
  const valoresPor = (campo) => [...new Set(usuarios.map((u) => u[campo]))].sort((a, b) => a.localeCompare(b, 'es'));
  let busquedaPersonas = '';

  const seccionVideos = () => `
    ${f.videos.length ? '' : `<p class="muted small">${f.modalidad === 'presencial' ? 'Las capacitaciones presenciales no necesitan videos (opcional).' : f.modalidad === 'en_vivo' ? 'Opcional: después de la reunión puedes subir la grabación para quienes no pudieron conectarse.' : 'Agrega al menos un video.'}</p>`}
    ${f.videos
      .map(
        (v, i) => `<div class="item-editor">
        <div class="cab-item"><b>Video ${i + 1}</b><div class="mini-btns">
          <button type="button" data-accion="subir-video" data-i="${i}" aria-label="Subir video ${i + 1}" ${i === 0 ? 'disabled' : ''}>↑</button>
          <button type="button" data-accion="bajar-video" data-i="${i}" aria-label="Bajar video ${i + 1}" ${i === f.videos.length - 1 ? 'disabled' : ''}>↓</button>
          <button type="button" data-accion="quitar-video" data-i="${i}" aria-label="Quitar video ${i + 1}">✕</button></div></div>
        <div class="form-grid">
          <label class="campo"><span>Título</span><input type="text" data-v="${i}:titulo" value="${esc(v.titulo)}"></label>
          <label class="campo"><span>Duración (minutos)</span><input type="number" min="0.1" step="0.1" data-v="${i}:min" value="${+(v.duracion_seg / 60).toFixed(2)}"></label>
          <label class="campo full"><span>Enlace del video</span><input type="url" data-v="${i}:url" value="${esc(v.url)}" placeholder="https://… (archivo .mp4, YouTube/Vimeo no listado, SharePoint/OneDrive)">
            <small>Los archivos .mp4/.webm se reproducen aquí impidiendo adelantar. Si lo dejas vacío se usa un video de demostración.</small></label>
        </div></div>`
      )
      .join('')}
    <button type="button" class="btn btn-sec" data-accion="agregar-video" style="align-self:flex-start">+ Agregar video</button>`;

  const seccionReuniones = () => `
    ${f.reuniones.length ? '' : '<p class="muted small">Agrega al menos una reunión. Puedes ofrecer varios horarios para que cada persona elija.</p>'}
    ${f.reuniones
      .map(
        (r, i) => `<div class="item-editor">
        <div class="cab-item"><b>Reunión ${i + 1}</b><div class="mini-btns"><button type="button" data-accion="quitar-reu" data-i="${i}" aria-label="Quitar reunión ${i + 1}">✕</button></div></div>
        <div class="form-grid">
          <label class="campo"><span>Fecha</span><input type="date" data-r="${i}:fecha" value="${esc(r.fecha)}"></label>
          <label class="campo"><span>Hora de inicio</span><input type="time" data-r="${i}:hora_inicio" value="${esc(r.hora_inicio)}"></label>
          <label class="campo"><span>Hora de fin</span><input type="time" data-r="${i}:hora_fin" value="${esc(r.hora_fin)}"></label>
          <label class="campo full"><span>Enlace de Teams (opcional)</span><input type="url" data-r="${i}:enlace" value="${esc(r.enlace)}" placeholder="https://teams.microsoft.com/l/meetup-join/…">
            <small>La invitación se envía desde Teams/Outlook como siempre. El enlace aquí es solo de referencia.</small></label>
        </div></div>`
      )
      .join('')}
    <button type="button" class="btn btn-sec" data-accion="agregar-reu" style="align-self:flex-start">+ Agregar reunión</button>
    <div class="aviso info" style="flex-direction:column;gap:4px">
      <b>¿Cómo se completa?</b>
      <span>• <b>Con cuestionario:</b> la persona lo responde en el portal después de la reunión y queda completada al aprobarlo.</span>
      <span>• <b>Sin cuestionario:</b> la persona no hace nada en el portal; tú registras la asistencia desde el Seguimiento (puedes marcar a varios a la vez).</span>
    </div>
    <label class="check"><input type="checkbox" data-f="pedir_firma" ${f.pedir_firma ? 'checked' : ''}> <span>Pedir además la firma de asistencia en el portal <span class="muted small">(opcional)</span></span></label>`;

  const seccionPreguntas = () => `
    <div class="form-grid">
      <label class="campo"><span>Nota mínima para aprobar</span><input type="number" min="0" data-f="nota_minima" value="${esc(f.nota_minima)}"><small>Respuestas correctas necesarias (de ${f.preguntas.length}).</small></label>
      <label class="campo"><span>Intentos permitidos</span><input type="number" min="0" data-f="intentos_max" value="${esc(f.intentos_max ?? 0)}"><small>0 = ilimitados.</small></label>
      <label class="check" style="align-self:end"><input type="checkbox" data-f="mostrar_respuestas" ${f.mostrar_respuestas ? 'checked' : ''}> <span>Mostrar las respuestas correctas al terminar</span></label>
    </div>
    ${f.preguntas.length ? '' : '<p class="muted small">Sin preguntas: la persona pasará directo a la firma después de ver el contenido.</p>'}
    ${f.preguntas
      .map((p, i) => {
        const correcta = p.opciones.findIndex((o) => o.correcta);
        return `<div class="item-editor">
        <div class="cab-item"><b>Pregunta ${i + 1}</b>
          <div class="fila" style="gap:6px"><select data-p="${i}:tipo" aria-label="Tipo de pregunta" style="width:auto;min-height:36px;padding:4px 8px"><option value="multiple" ${p.tipo === 'multiple' ? 'selected' : ''}>Opción múltiple</option><option value="vf" ${p.tipo === 'vf' ? 'selected' : ''}>Verdadero / Falso</option></select>
          <div class="mini-btns"><button type="button" data-accion="subir-preg" data-i="${i}" aria-label="Subir pregunta" ${i === 0 ? 'disabled' : ''}>↑</button><button type="button" data-accion="bajar-preg" data-i="${i}" aria-label="Bajar pregunta" ${i === f.preguntas.length - 1 ? 'disabled' : ''}>↓</button><button type="button" data-accion="quitar-preg" data-i="${i}" aria-label="Quitar pregunta">✕</button></div></div></div>
        <label class="campo"><span>Pregunta</span><input type="text" data-p="${i}:texto" value="${esc(p.texto)}"></label>
        <fieldset style="border:0;padding:0;margin:0" class="pila"><legend class="small muted" style="margin-bottom:6px">Opciones (marca la correcta)</legend>
        ${p.opciones
          .map(
            (o, j) => `<div class="fila" style="flex-wrap:nowrap;gap:8px">
            <input type="radio" name="correcta-${i}" data-correcta="${i}" value="${j}" ${j === correcta ? 'checked' : ''} aria-label="Marcar opción ${j + 1} como correcta" style="width:22px;height:22px;accent-color:var(--verde);flex-shrink:0">
            <input type="text" data-o="${i}:${j}" value="${esc(o.texto)}" ${p.tipo === 'vf' ? 'readonly' : ''} aria-label="Opción ${j + 1}">
            ${p.tipo === 'multiple' && p.opciones.length > 2 ? `<div class="mini-btns"><button type="button" data-accion="quitar-opc" data-i="${i}" data-j="${j}" aria-label="Quitar opción">✕</button></div>` : ''}
          </div>`
          )
          .join('')}
        </fieldset>
        ${p.tipo === 'multiple' ? `<button type="button" class="btn-link" data-accion="agregar-opc" data-i="${i}" style="align-self:flex-start">+ Agregar opción</button>` : ''}
      </div>`;
      })
      .join('')}
    <button type="button" class="btn btn-sec" data-accion="agregar-preg" style="align-self:flex-start">+ Agregar pregunta</button>`;

  const seccionAsignacion = () => {
    const modo = f.asignacion.modo;
    let opciones = '';
    if (['area', 'cargo', 'sede'].includes(modo))
      opciones = `<div class="checks-grid">${valoresPor(modo)
        .map((v) => `<label class="check"><input type="checkbox" data-asig="${esc(v)}" ${f.asignacion.valores.includes(v) ? 'checked' : ''}> <span>${esc(v)}</span></label>`)
        .join('')}</div>`;
    if (modo === 'personas') {
      const q = busquedaPersonas.toLowerCase();
      opciones = `<input type="search" id="buscar-personas" placeholder="Buscar persona…" value="${esc(busquedaPersonas)}" aria-label="Buscar persona">
        <div class="checks-grid">${usuarios
          .filter((u) => !q || u.nombre.toLowerCase().includes(q) || u.area.toLowerCase().includes(q))
          .map((u) => `<label class="check"><input type="checkbox" data-asig="${esc(u.id)}" ${f.asignacion.valores.includes(u.id) ? 'checked' : ''}> <span>${esc(u.nombre)} <span class="muted small">· ${esc(u.area)}</span></span></label>`)
          .join('')}</div>`;
    }
    const n = usuarios.filter((u) => modo === 'todos' || (modo === 'personas' ? f.asignacion.valores.includes(u.id) : f.asignacion.valores.includes(u[modo]))).length;
    return `<div class="form-grid">
        <label class="campo"><span>Asignar a</span><select data-f="asignacion.modo">${Object.entries(MODOS_ASIGNACION).map(([k, v]) => `<option value="${k}" ${k === modo ? 'selected' : ''}>${esc(v)}</option>`).join('')}</select></label>
        <label class="campo"><span>Fecha límite</span><input type="date" data-f="fecha_limite" value="${esc(f.fecha_limite)}"></label>
      </div>
      ${opciones}
      <div class="aviso info">Se asignará a <b>&nbsp;${n}&nbsp;</b> persona(s)${f.estado === 'publicada' ? '. Al guardar se asigna a quienes aún no la tengan (no se quita a nadie).' : ' al publicar.'}</div>
      <label class="check"><input type="checkbox" data-f="asignar_nuevos_ingresos" ${f.asignar_nuevos_ingresos ? 'checked' : ''}> <span><b>Asignar automáticamente a nuevos ingresos</b> (ideal para la Inducción)</span></label>
      <label class="campo" style="max-width:280px"><span>Días para completar (nuevos ingresos)</span><input type="number" min="1" data-f="dias_para_completar" value="${esc(f.dias_para_completar)}"></label>`;
  };

  const seccionRecordatorios = () => `
    <div class="fila" style="flex-wrap:nowrap"><button type="button" class="switch" role="switch" aria-checked="${f.recordatorios.automaticos}" data-accion="toggle-auto" aria-label="Recordatorios automáticos"></button>
      <div><b>Recordatorios automáticos</b><p class="muted small">Correo + notificación en el portal. Nunca a quien ya completó, máximo 1 aviso automático por día.</p></div></div>
    <div class="form-grid" ${f.recordatorios.automaticos ? '' : 'hidden'}>
      <label class="campo"><span>Recordar cada (días)</span><input type="number" min="1" data-f="recordatorios.cada_dias" value="${esc(f.recordatorios.cada_dias)}"></label>
      <label class="check" style="align-self:end"><input type="checkbox" data-f="recordatorios.aviso_dia_antes" ${f.recordatorios.aviso_dia_antes ? 'checked' : ''}> <span>Avisar 1 día antes de la fecha límite</span></label>
      <label class="check" style="align-self:end"><input type="checkbox" data-f="recordatorios.copia_jefe_directo" ${f.recordatorios.copia_jefe_directo ? 'checked' : ''}> <span>Copia al jefe directo (aviso del día antes)</span></label>
    </div>
    <p class="muted small">Siempre se avisa al asignar y, al vencer, a la persona y a los responsables.</p>`;

  const seccionResponsables = () => {
    const puedeGestionar = !info || info.permisos.responsables;
    const lista = info ? info.responsables : [{ usuario_id: uid, nombre: perfil.nombre, cargo: perfil.cargo, rol: 'propietario', fijo: true }, ...f.responsablesNuevos.map((r) => ({ ...r, nombre: usuarios.find((u) => u.id === r.usuario_id)?.nombre, cargo: usuarios.find((u) => u.id === r.usuario_id)?.cargo }))];
    const ids = new Set(lista.map((r) => r.usuario_id));
    return `<p class="muted small">Solo estas personas ven esta capacitación y su seguimiento. Ser Administrador RR.HH. no basta.</p>
      <div class="tabla-wrap"><table><thead><tr><th>Persona</th><th>Rol</th><th></th></tr></thead><tbody>
      ${lista
        .map(
          (r) => `<tr><td><span class="nombre">${esc(r.nombre)}${r.usuario_id === uid ? ' (tú)' : ''}</span><span class="det">${esc(r.cargo || '')}</span></td>
          <td>${
            puedeGestionar && !r.fijo
              ? `<select data-rol-resp="${esc(r.usuario_id)}" aria-label="Rol de ${esc(r.nombre)}" style="min-height:36px;padding:4px 8px">${Object.entries(ROLES_RESP).map(([k, v]) => `<option value="${k}" ${k === r.rol ? 'selected' : ''}>${v}</option>`).join('')}</select>`
              : pillRol(r.rol)
          }</td>
          <td>${puedeGestionar && !r.fijo ? `<button type="button" class="btn btn-peligro btn-sm" data-accion="quitar-resp" data-u="${esc(r.usuario_id)}">Quitar</button>` : ''}</td></tr>`
        )
        .join('')}
      </tbody></table></div>
      ${
        puedeGestionar
          ? `<div class="fila" style="align-items:flex-end">
          <label class="campo" style="flex:2 1 220px"><span>Agregar persona</span><select id="nuevo-resp"><option value="">Elegir…</option>${usuarios
            .filter((u) => !ids.has(u.id))
            .map((u) => `<option value="${esc(u.id)}">${esc(u.nombre)} · ${esc(u.cargo)}</option>`)
            .join('')}</select></label>
          <label class="campo" style="flex:1 1 150px"><span>Rol</span><select id="nuevo-resp-rol">${Object.entries(ROLES_RESP).map(([k, v]) => `<option value="${k}" ${k === 'editor' ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
          <button type="button" class="btn btn-sec" data-accion="agregar-resp">Agregar</button></div>
          <details class="small muted"><summary style="cursor:pointer">¿Qué puede hacer cada rol?</summary><p style="margin-top:6px"><b>Propietario:</b> todo, incluido gestionar responsables. <b>Editor:</b> ver seguimiento, enviar recordatorios, descargar registro y editar. <b>Solo lectura:</b> ver seguimiento y descargar registro.</p></details>`
          : '<p class="muted small">Solo un propietario puede cambiar los responsables.</p>'
      }`;
  };

  const seccionHistorial = () => {
    if (!info) return '';
    const h = api.historialCambios(uid, capId);
    return `<div class="tabla-wrap" style="max-height:320px;overflow:auto"><table><thead><tr><th>Fecha</th><th>Persona</th><th>Acción</th></tr></thead><tbody>${h
      .map((x) => `<tr><td class="small">${esc(fmtFechaHora(x.fecha))}</td><td>${esc(x.usuario)}</td><td>${esc(x.detalle)}</td></tr>`)
      .join('')}</tbody></table></div>`;
  };

  const tarjeta = (id, titulo, cuerpo, sub = '') => `<section class="tarjeta pila" id="${id}"><div><h2>${titulo}</h2>${sub ? `<p class="muted small">${sub}</p>` : ''}</div><div class="pila" data-cuerpo>${cuerpo}</div></section>`;

  const cuerpoHtml = () => `
    ${tarjeta(
      'sec-datos',
      'Datos generales',
      `<div class="form-grid">
        <label class="campo full"><span>Título *</span><input type="text" data-f="titulo" value="${esc(f.titulo)}" required></label>
        <label class="campo full"><span>Descripción</span><textarea data-f="descripcion">${esc(f.descripcion)}</textarea></label>
        <label class="campo"><span>Categoría</span><select data-f="categoria">${Object.entries(CATEGORIAS).map(([k, v]) => `<option value="${k}" ${k === f.categoria ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
        <label class="campo"><span>Tipo</span><select data-f="obligatoria"><option value="1" ${f.obligatoria ? 'selected' : ''}>Obligatoria</option><option value="0" ${!f.obligatoria ? 'selected' : ''}>Opcional</option></select></label>
        <label class="campo"><span>Modalidad</span><select data-f="modalidad" data-rerender>${Object.entries(MODALIDADES).map(([k, v]) => `<option value="${k}" ${k === f.modalidad ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
        <label class="campo"><span>Duración total (minutos)</span><input type="number" min="0" data-f="duracion_min" value="${esc(f.duracion_min)}"></label>
        <label class="campo"><span>Capacitador – nombre</span><input type="text" data-f="capacitador_nombre" value="${esc(f.capacitador_nombre)}"></label>
        <label class="campo"><span>Capacitador – cargo o empresa</span><input type="text" data-f="capacitador_cargo" value="${esc(f.capacitador_cargo)}"></label>
        ${f.modalidad === 'presencial' || f.modalidad === 'mixta' ? `<label class="campo full"><span>Lugar</span><input type="text" data-f="lugar" value="${esc(f.lugar)}" placeholder="Ej.: Oficina Lima – Sala 1 / Obra …"></label>` : ''}
      </div>`
    )}
    ${f.modalidad === 'en_vivo' ? tarjeta('sec-reuniones', 'Reuniones de Teams', seccionReuniones(), 'La gente entra directo desde la invitación de Teams. Aquí solo se indica la fecha y la hora.') : ''}
    ${tarjeta('sec-videos', f.modalidad === 'en_vivo' ? 'Grabación (opcional)' : 'Videos', seccionVideos(), 'Se ven en este orden y no se puede pasar al siguiente sin terminar el actual.')}
    ${tarjeta('sec-preguntas', 'Cuestionario', seccionPreguntas(), f.modalidad === 'en_vivo' ? 'Opcional. Se habilita cuando empieza la reunión. Si no agregas preguntas, registras tú la asistencia.' : 'Se desbloquea al terminar los videos (o al confirmar asistencia en presencial).')}
    ${tarjeta('sec-asignacion', 'Asignación', seccionAsignacion())}
    ${tarjeta('sec-recordatorios', 'Recordatorios', seccionRecordatorios())}
    ${tarjeta('sec-responsables', 'Responsables', seccionResponsables())}
    ${info ? tarjeta('sec-historial', 'Historial de cambios', seccionHistorial(), 'Auditoría: quién hizo qué y cuándo.') : ''}`;

  const botones = () => {
    if (soloLectura) return '<span class="pill gris">Solo lectura</span>';
    if (!info) return `<button class="btn btn-sec" data-guardar="borrador">Guardar borrador</button><button class="btn btn-primario" data-guardar="publicar">Guardar y publicar</button>`;
    if (f.estado === 'borrador') return `<button class="btn btn-sec" data-guardar="borrador">Guardar borrador</button><button class="btn btn-primario" data-guardar="publicar">Publicar</button>`;
    if (f.estado === 'publicada') return `<button class="btn btn-peligro" data-guardar="cerrar">Cerrar capacitación</button><button class="btn btn-primario" data-guardar="guardar">Guardar cambios</button>`;
    return `<button class="btn btn-primario" data-guardar="reabrir">Reabrir</button>`;
  };

  return {
    titulo: info ? `Editar: ${f.titulo}` : 'Nueva capacitación',
    html: `
      <a class="volver" href="#/capacitaciones">← Volver a capacitaciones</a>
      <div class="cab"><div><h1>${info ? esc(f.titulo) : 'Nueva capacitación'}</h1>
        <div class="fila" style="gap:6px">${pillEstadoCap(f.estado)}${info ? pillRol(info.rol) : ''}${info ? `<span class="muted small">${info.asignados} asignado(s)</span>` : ''}</div></div>
        <div class="acciones">${info && f.estado !== 'borrador' ? `<a class="btn btn-sec" href="#/capacitaciones/${esc(capId)}/seguimiento">Ver seguimiento</a>` : ''}${botones()}</div></div>
      ${soloLectura ? '<div class="aviso warn">Tienes acceso de solo lectura: puedes ver la configuración pero no modificarla.</div>' : ''}
      ${cerrada && !soloLectura ? '<div class="aviso warn">La capacitación está cerrada. Reábrela para hacer cambios.</div>' : ''}
      ${f.estado === 'publicada' && !soloLectura ? '<div class="aviso info">Está publicada: los cambios en videos o preguntas afectan a quienes aún no terminan.</div>' : ''}
      <form id="editor" class="pila" style="gap:20px" novalidate>${cuerpoHtml()}</form>
      <div class="acciones" style="justify-content:flex-end">${botones()}</div>`,
    montar: (root) => {
      const form = root.querySelector('#editor');
      const redibujar = () => {
        const y = window.scrollY;
        form.innerHTML = cuerpoHtml();
        aplicarBloqueo();
        window.scrollTo(0, y);
      };
      const aplicarBloqueo = () => {
        if (!bloqueado) return;
        form.querySelectorAll('input,select,textarea,button').forEach((el) => {
          if (!el.closest('#sec-responsables') || soloLectura) el.disabled = true;
        });
      };
      aplicarBloqueo();

      const setRuta = (ruta, valor) => {
        const partes = ruta.split('.');
        let o = f;
        while (partes.length > 1) o = o[partes.shift()];
        o[partes[0]] = valor;
      };

      const alCambiar = (e) => {
        const t = e.target;
        if (t.dataset.f) {
          let val = t.type === 'checkbox' ? t.checked : t.value;
          if (t.dataset.f === 'obligatoria') val = t.value === '1';
          setRuta(t.dataset.f, val);
          if (t.dataset.f === 'asignacion.modo') {
            f.asignacion.valores = [];
            redibujar();
          } else if (t.dataset.f === 'modalidad' && e.type === 'change') redibujar();
          else if (t.dataset.f === 'nota_minima' && e.type === 'change') {
            /* sin redibujar */
          }
        } else if (t.dataset.v) {
          const [i, campo] = t.dataset.v.split(':');
          if (campo === 'min') f.videos[i].duracion_seg = Math.max(1, Math.round(Number(t.value) * 60) || 60);
          else f.videos[i][campo] = t.value;
        } else if (t.dataset.r) {
          const [i, campo] = t.dataset.r.split(':');
          f.reuniones[i][campo] = t.value;
        } else if (t.dataset.p) {
          const [i, campo] = t.dataset.p.split(':');
          f.preguntas[i][campo] = t.value;
          if (campo === 'tipo' && e.type === 'change') {
            f.preguntas[i].opciones = t.value === 'vf' ? [{ texto: 'Verdadero', correcta: true }, { texto: 'Falso', correcta: false }] : [{ texto: '', correcta: true }, { texto: '', correcta: false }, { texto: '', correcta: false }];
            redibujar();
          }
        } else if (t.dataset.o) {
          const [i, j] = t.dataset.o.split(':');
          f.preguntas[i].opciones[j].texto = t.value;
        } else if (t.dataset.correcta !== undefined && t.checked) {
          f.preguntas[t.dataset.correcta].opciones.forEach((o, j) => (o.correcta = j === Number(t.value)));
        } else if (t.dataset.asig !== undefined) {
          const v = t.dataset.asig;
          f.asignacion.valores = t.checked ? [...new Set([...f.asignacion.valores, v])] : f.asignacion.valores.filter((x) => x !== v);
          if (e.type === 'change') {
            const aviso = form.querySelector('#sec-asignacion [data-cuerpo]');
            aviso.innerHTML = seccionAsignacion();
          }
        } else if (t.id === 'buscar-personas') {
          busquedaPersonas = t.value;
          const sec = form.querySelector('#sec-asignacion [data-cuerpo]');
          sec.innerHTML = seccionAsignacion();
          const nuevo = sec.querySelector('#buscar-personas');
          nuevo.focus();
          nuevo.setSelectionRange(nuevo.value.length, nuevo.value.length);
        } else if (t.dataset.rolResp && e.type === 'change') {
          if (info) {
            intentar(() => api.cambiarRolResponsable(uid, capId, t.dataset.rolResp, t.value), 'Rol actualizado');
            app.refrescar();
          } else {
            f.responsablesNuevos.find((r) => r.usuario_id === t.dataset.rolResp).rol = t.value;
          }
        }
      };
      form.addEventListener('input', alCambiar);
      form.addEventListener('change', alCambiar);

      form.addEventListener('click', (e) => {
        const b = e.target.closest('[data-accion]');
        if (!b) return;
        const i = Number(b.dataset.i);
        const mover = (arr, de, a) => arr.splice(a, 0, arr.splice(de, 1)[0]);
        switch (b.dataset.accion) {
          case 'agregar-video':
            f.videos.push({ titulo: '', duracion_seg: 300, url: '' });
            break;
          case 'quitar-video':
            f.videos.splice(i, 1);
            break;
          case 'subir-video':
            mover(f.videos, i, i - 1);
            break;
          case 'bajar-video':
            mover(f.videos, i, i + 1);
            break;
          case 'agregar-reu': {
            const ult = f.reuniones[f.reuniones.length - 1];
            f.reuniones.push({ fecha: ult?.fecha || f.fecha_limite, hora_inicio: ult?.hora_inicio || '09:00', hora_fin: ult?.hora_fin || '10:00', enlace: '' });
            break;
          }
          case 'quitar-reu':
            f.reuniones.splice(i, 1);
            break;
          case 'agregar-preg':
            f.preguntas.push({ tipo: 'multiple', texto: '', opciones: [{ texto: '', correcta: true }, { texto: '', correcta: false }, { texto: '', correcta: false }] });
            break;
          case 'quitar-preg':
            f.preguntas.splice(i, 1);
            break;
          case 'subir-preg':
            mover(f.preguntas, i, i - 1);
            break;
          case 'bajar-preg':
            mover(f.preguntas, i, i + 1);
            break;
          case 'agregar-opc':
            f.preguntas[i].opciones.push({ texto: '', correcta: false });
            break;
          case 'quitar-opc': {
            const ops = f.preguntas[i].opciones;
            const eraCorrecta = ops[Number(b.dataset.j)].correcta;
            ops.splice(Number(b.dataset.j), 1);
            if (eraCorrecta) ops[0].correcta = true;
            break;
          }
          case 'toggle-auto':
            f.recordatorios.automaticos = !f.recordatorios.automaticos;
            break;
          case 'agregar-resp': {
            const sel = form.querySelector('#nuevo-resp');
            const rol = form.querySelector('#nuevo-resp-rol').value;
            if (!sel.value) return toast('Elige una persona.', 'error');
            if (info) {
              intentar(() => api.agregarResponsable(uid, capId, sel.value, rol), 'Responsable agregado');
              app.refrescar();
              return;
            }
            f.responsablesNuevos.push({ usuario_id: sel.value, rol });
            break;
          }
          case 'quitar-resp':
            if (info) {
              confirmar('Quitar responsable', 'Esta persona dejará de ver la capacitación y su seguimiento.', 'Quitar').then((ok) => {
                if (ok) {
                  intentar(() => api.quitarResponsable(uid, capId, b.dataset.u), 'Responsable quitado');
                  if (b.dataset.u === uid) navegar('#/capacitaciones');
                  else app.refrescar();
                }
              });
              return;
            }
            f.responsablesNuevos = f.responsablesNuevos.filter((r) => r.usuario_id !== b.dataset.u);
            break;
          default:
            return;
        }
        redibujar();
      });

      root.querySelectorAll('[data-guardar]').forEach((b) =>
        b.addEventListener('click', async () => {
          const accion = b.dataset.guardar;
          if (accion === 'cerrar') {
            if (!(await confirmar('Cerrar capacitación', 'Las personas ya no podrán avanzar ni firmar. El seguimiento y el registro siguen disponibles.', 'Cerrar'))) return;
            if (intentar(() => api.cambiarEstado(uid, capId, 'cerrada'), 'Capacitación cerrada') !== undefined) app.refrescar();
            return;
          }
          if (accion === 'reabrir') {
            if (intentar(() => api.cambiarEstado(uid, capId, 'publicada'), 'Capacitación reabierta') !== undefined) app.refrescar();
            return;
          }
          if (accion === 'publicar' && !(await confirmar('Publicar capacitación', 'Se asignará y se avisará a las personas elegidas por correo y en el portal.', 'Publicar'))) return;
          const id = intentar(() => api.guardarCapacitacion(uid, capId || null, f));
          if (!id) return;
          if (accion === 'publicar') {
            const r = intentar(() => api.cambiarEstado(uid, id, 'publicada'));
            if (r) {
              toast(`Publicada. Se asignó a ${r.nuevos} persona(s).`, 'ok');
              return navegar(`#/capacitaciones/${id}/seguimiento`);
            }
            return navegar(`#/capacitaciones/${id}/editar`);
          }
          toast('Cambios guardados', 'ok');
          if (!capId) navegar(`#/capacitaciones/${id}/editar`);
          else app.refrescar();
        })
      );
    },
  };
}
