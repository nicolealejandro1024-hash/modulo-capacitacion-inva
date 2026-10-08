// Seguimiento (solo responsables), detalle por persona, registro de asistencia, exportación y QR presencial.
import { api, sesion, app, navegar, toast, intentar, modal, confirmar } from '../contexto.js';
import { esc, fmtFecha, fmtFechaLarga, fmtFechaHora, fmtDuracion, ESTADOS, CATEGORIAS, MODALIDADES, ROLES_RESP, TIPOS_RECORDATORIO, TIPOS_ASISTENCIA } from '../util.js';
import { pillEstado } from './colaborador.js';
import { ico } from '../iconos.js';

const FILTROS = [
  { id: 'todos', label: 'Todos', estados: null },
  { id: 'completados', label: 'Completados', estados: ['completado'] },
  { id: 'en_curso', label: 'En curso', estados: ['en_curso', 'pendiente_firma'] },
  { id: 'no_inicio', label: 'No iniciaron', estados: ['no_inicio'] },
  { id: 'vencidos', label: 'Vencidos', estados: ['vencido'] },
];
const FALTAN = ['en_curso', 'pendiente_firma', 'no_inicio'];

const recordadoHoy = (f) => f.ultimoRecordatorio?.tipo === 'manual' && f.ultimoRecordatorio.enviado_en.startsWith(api.hoy());

function celdaContenido(cap, r) {
  if (cap.modalidad === 'en_vivo') {
    const asis = r.presencialOk ? '<span class="pill verde">Registrada</span>' : cap.preguntas.length ? '<span class="muted">No aplica</span>' : '<span class="muted">Sin registrar</span>';
    return `${asis}${r.totalVideos && r.videosVistos ? `<br><span class="det">Grabación ${r.videosVistos}/${r.totalVideos}</span>` : ''}`;
  }
  if (cap.modalidad === 'presencial') return r.presencialOk ? '<span class="pill verde">Asistió</span>' : '<span class="muted">—</span>';
  const txt = `${r.videosVistos}/${r.totalVideos}`;
  return `${txt}${cap.modalidad === 'mixta' && r.presencialOk ? ' <span class="pill verde">Asistió</span>' : ''}`;
}

export function vistaSeguimiento(capId) {
  const uid = sesion.uid;
  const s = api.seguimiento(uid, capId);
  const { capacitacion: cap, kpis: k, permisos } = s;
  const otras = api.listarCapacitacionesAdmin(uid).filter((x) => x.capacitacion.estado !== 'borrador');
  const pct = (n) => (k.asignados ? `${Math.round((n / k.asignados) * 100)} %` : '0 %');
  const pendientesRecordar = s.filas.filter((f) => FALTAN.includes(f.resumen.estado) && f.resumen.requiereAccion && !recordadoHoy(f));
  // Reunión de Teams sin cuestionario: RR.HH. marca la asistencia (se puede seleccionar a varios).
  const marcarAsistencia = cap.modalidad === 'en_vivo' && !cap.preguntas.length && permisos.editar;
  const areas = [...new Set(s.filas.map((f) => f.colaborador.area))].sort((a, b) => a.localeCompare(b, 'es'));

  const filas = s.filas
    .map((f) => {
      const r = f.resumen;
      const accion = marcarAsistencia
        ? r.presencialOk
          ? r.firmado
            ? ''
            : `<button class="btn btn-link btn-sm" data-quitar-asis="${esc(f.asignacion.id)}">Quitar asistencia</button>`
          : `<button class="btn btn-sec btn-sm" data-marcar="${esc(f.asignacion.id)}">Marcar asistió</button>`
        : !permisos.recordar
        ? ''
        : !r.requiereAccion
          ? ''
          : recordadoHoy(f)
            ? `<span class="small muted">Recordatorio enviado · ${esc(fmtFechaHora(f.ultimoRecordatorio.enviado_en).split(',').pop().trim())}</span>`
            : `<button class="btn btn-sec btn-sm" data-recordar="${esc(f.asignacion.id)}">Enviar recordatorio</button>`;
      return `<tr data-estado="${r.estado}" data-area="${esc(f.colaborador.area)}" data-nombre="${esc(f.colaborador.nombre.toLowerCase())}">
        ${marcarAsistencia ? `<td>${r.presencialOk ? '' : `<input type="checkbox" data-sel="${esc(f.asignacion.id)}" aria-label="Seleccionar a ${esc(f.colaborador.nombre)}" style="width:20px;height:20px;accent-color:var(--naranja)">`}</td>` : ''}
        <td><a class="nombre" href="#/capacitaciones/${esc(capId)}/persona/${esc(f.asignacion.id)}" style="color:inherit">${esc(f.colaborador.nombre)}</a><span class="det">${esc(f.colaborador.cargo)} · vence ${esc(fmtFecha(f.asignacion.fecha_limite))}</span></td>
        <td>${esc(f.colaborador.area)}</td>
        <td>${celdaContenido(cap, r)}</td>
        <td>${r.tieneCuestionario ? (r.mejorNota !== null ? `<b>${r.mejorNota}/${r.totalPreguntas}</b> <span class="det">${r.aprobado ? 'aprobado' : 'desaprobado'} · ${r.intentosUsados} int.</span>` : '<span class="muted">Sin responder</span>') : '<span class="muted">No aplica</span>'}</td>
        <td>${r.firmado ? `<span class="pill verde">Sí</span> <span class="det">${esc(fmtFecha(r.firmadoEn))}</span>` : r.requiereFirma ? '<span class="muted">No</span>' : '<span class="muted">No aplica</span>'}</td>
        <td>${pillEstado(r)}${r.sinIntentos ? ' <span class="pill rojo">Sin intentos</span>' : ''}</td>
        <td><div class="acciones" style="flex-wrap:nowrap">${accion}<a class="btn btn-link btn-sm" href="#/capacitaciones/${esc(capId)}/persona/${esc(f.asignacion.id)}">Detalle</a></div></td>
      </tr>`;
    })
    .join('');

  const reunionesHtml =
    cap.modalidad !== 'en_vivo'
      ? ''
      : `<div class="tarjeta sin-pad"><div class="filtros"><h2>Reuniones de Teams</h2>${permisos.editar ? `<a class="btn btn-sec btn-sm" href="#/capacitaciones/${esc(capId)}/editar">Editar horarios</a>` : ''}</div>
        <div class="tabla-wrap"><table><thead><tr><th>Fecha</th><th>Horario</th><th>Enlace</th></tr></thead><tbody>${(cap.reuniones || [])
          .map((x) => `<tr><td>${esc(fmtFecha(x.fecha))}</td><td>${esc(x.hora_inicio)}–${esc(x.hora_fin)}</td><td>${x.enlace ? `<a href="${esc(x.enlace)}" target="_blank" rel="noopener">Abrir en Teams</a>` : '—'}</td></tr>`)
          .join('')}</tbody></table></div>
        <p class="muted small" style="padding:0 16px 14px">${cap.preguntas.length ? 'La gente entra desde la invitación de Teams y después responde el cuestionario en el portal: al aprobarlo queda completada.' : 'Sin cuestionario: después de la reunión selecciona en la tabla a quienes asistieron (puedes guiarte por la lista de asistencia de Teams) y pulsa «Registrar asistencia».'}</p></div>`;

  const sesionesHtml =
    !['presencial', 'mixta'].includes(cap.modalidad)
      ? ''
      : `<div class="tarjeta sin-pad"><div class="filtros"><h2>Sesiones presenciales (QR)</h2>${permisos.editar && cap.estado === 'publicada' ? '<button class="btn btn-primario btn-sm" id="generar-qr">' + ico.qr + ' Generar QR de asistencia</button>' : ''}</div>
        ${
          s.sesiones.length
            ? `<div class="tabla-wrap"><table><thead><tr><th>Fecha</th><th>Horario</th><th>Lugar</th><th>Asistentes</th><th>Estado</th><th></th></tr></thead><tbody>${s.sesiones
                .slice()
                .reverse()
                .map((se) => {
                  const est = api.estadoSesion(uid, capId, se.id);
                  return `<tr><td>${esc(fmtFecha(se.fecha))}</td><td>${esc(se.hora_inicio)}–${esc(se.hora_fin)}</td><td>${esc(se.lugar || '—')}</td><td><b>${est.asistentes.length}</b></td><td>${est.vigente ? '<span class="pill verde">QR vigente</span>' : '<span class="pill gris">Cerrada</span>'}</td><td>${est.vigente ? `<a class="btn btn-sec btn-sm" href="#/capacitaciones/${esc(capId)}/qr/${esc(se.id)}">Proyectar QR</a>` : `<a class="btn btn-link btn-sm" href="#/capacitaciones/${esc(capId)}/qr/${esc(se.id)}">Ver asistentes</a>`}</td></tr>`;
                })
                .join('')}</tbody></table></div>`
            : '<div class="vacio small">Aún no hay sesiones. Genera un QR el día de la charla.</div>'
        }</div>`;

  return {
    titulo: `Seguimiento: ${cap.titulo}`,
    html: `
    <div class="cab"><div><h1>Seguimiento de capacitaciones</h1><p class="sub">Quién vio los videos, quién respondió el cuestionario, quién firmó y quién falta.</p></div>
      <div class="acciones">
        <button class="btn btn-sec" id="exportar">${ico.descarga} Exportar a Excel</button>
        <a class="btn btn-sec" href="#/capacitaciones/${esc(capId)}/registro">${ico.descarga} Registro de asistencia</a>
        ${permisos.editar ? `<a class="btn btn-oscuro" href="#/capacitaciones/${esc(capId)}/editar">Editar</a>` : ''}
      </div></div>
    <div role="group" aria-label="Capacitación" class="pildoras">${otras
      .map((o) => `<a class="pildora" href="#/capacitaciones/${esc(o.capacitacion.id)}/seguimiento" aria-pressed="${o.capacitacion.id === capId}">${esc(o.capacitacion.titulo)}</a>`)
      .join('')}</div>
    <div class="fila" style="gap:6px"><span class="pill ${cap.estado === 'publicada' ? 'verde' : 'oscuro'}">${cap.estado === 'publicada' ? 'Publicada' : 'Cerrada'}</span><span class="pill gris">${esc(CATEGORIAS[cap.categoria])}</span><span class="pill gris">${esc(MODALIDADES[cap.modalidad])}</span><span class="pill naranja">Tu rol: ${esc(ROLES_RESP[s.rol])}</span><span class="muted small">Fecha límite general: ${esc(fmtFecha(cap.fecha_limite))}</span></div>
    <div class="kpis">
      <div class="kpi"><span class="et">Asignados</span><span class="num">${k.asignados}</span><span class="det">colaboradores</span></div>
      ${
        cap.modalidad === 'en_vivo'
          ? `<div class="kpi"><span class="et">Asistencia registrada</span><span class="num">${cap.preguntas.length ? '—' : k.asistenciaRegistrada}</span><span class="det">${cap.preguntas.length ? 'se completa con el cuestionario' : `${pct(k.asistenciaRegistrada)} del total`}</span></div>`
          : `<div class="kpi"><span class="et">${cap.modalidad === 'presencial' ? 'Asistieron' : 'Vieron todos los videos'}</span><span class="num">${k.vieronVideos}</span><span class="det">${pct(k.vieronVideos)} del total</span></div>`
      }
      <div class="kpi"><span class="et">Respondieron cuestionario</span><span class="num">${k.respondieron}</span><span class="det">${cap.preguntas.length ? `nota promedio ${k.notaPromedio === null ? '—' : k.notaPromedio.toFixed(1).replace('.', ',') + '/' + cap.preguntas.length}` : 'sin cuestionario'}</span></div>
      <div class="kpi ok"><span class="et">${cap.modalidad === 'en_vivo' && !cap.pedir_firma ? 'Completaron' : 'Firmaron'}</span><span class="num">${k.firmaron}</span><span class="det">${pct(k.firmaron)} completado</span></div>
      <div class="kpi alerta"><span class="et">Faltan</span><span class="num">${k.faltan}</span><span class="det">${k.enCurso} en curso · ${k.noIniciaron} no iniciaron</span></div>
      <div class="kpi peligro"><span class="et">Vencidos</span><span class="num">${k.vencidos}</span><span class="det">pasaron la fecha límite</span></div>
    </div>
    <div class="tarjeta fila" style="flex-wrap:nowrap">
      <span style="width:40px;height:40px;border-radius:10px;background:var(--naranja-suave);color:var(--naranja-tx);display:flex;align-items:center;justify-content:center;flex-shrink:0">${ico.campana}</span>
      <div style="flex:1"><b>Recordatorios automáticos</b><p class="muted small">${cap.recordatorios.automaticos ? `Activados: cada ${cap.recordatorios.cada_dias} días mientras no completen${cap.recordatorios.aviso_dia_antes ? ', 1 día antes de la fecha límite' : ''} y al vencer. Correo + notificación del portal.` : 'Desactivados. Solo se envían los recordatorios manuales.'}</p></div>
      <button class="switch" role="switch" aria-checked="${cap.recordatorios.automaticos}" aria-label="Recordatorios automáticos" id="switch-auto" ${permisos.editar ? '' : 'disabled'}></button>
    </div>
    <div class="tarjeta sin-pad">
      <div class="filtros">
        <div role="group" aria-label="Filtrar por estado" class="pildoras">${FILTROS.map((fl) => `<button class="pildora" data-filtro="${fl.id}" aria-pressed="${fl.id === 'todos'}">${fl.label} (${fl.estados ? s.filas.filter((x) => fl.estados.includes(x.resumen.estado)).length : s.filas.length})</button>`).join('')}</div>
        ${
          marcarAsistencia
            ? '<button class="btn btn-primario btn-sm" id="marcar-sel" disabled>Registrar asistencia (0)</button>'
            : permisos.recordar
              ? `<button class="btn btn-primario btn-sm" id="recordar-todos" ${pendientesRecordar.length ? '' : 'disabled'}>Recordar a los que faltan (${pendientesRecordar.length})</button>`
              : ''
        }
      </div>
      <div class="filtros campo-busq">
        <label class="sr-only" for="buscar">Buscar por nombre</label><input type="search" id="buscar" placeholder="Buscar por nombre…" style="flex:2 1 220px">
        <label class="sr-only" for="f-area">Área</label><select id="f-area" style="flex:1 1 160px"><option value="">Todas las áreas</option>${areas.map((a) => `<option>${esc(a)}</option>`).join('')}</select>
      </div>
      ${s.filas.length ? `<div class="tabla-wrap"><table><thead><tr>${marcarAsistencia ? '<th><input type="checkbox" id="sel-todos" aria-label="Seleccionar todos los que faltan" style="width:20px;height:20px;accent-color:var(--naranja)"></th>' : ''}<th>Colaborador</th><th>Área</th><th>${cap.modalidad === 'presencial' || cap.modalidad === 'en_vivo' ? 'Asistencia' : 'Videos vistos'}</th><th>Cuestionario</th><th>Firma</th><th>Estado</th><th>Acción</th></tr></thead><tbody id="tbody">${filas}</tbody></table></div><div class="vacio small" id="sin-resultados" hidden>No hay personas con ese filtro.</div>` : '<div class="vacio">Aún no hay personas asignadas.</div>'}
    </div>
    ${reunionesHtml}
    ${sesionesHtml}
    ${panelPreguntasAdmin(capId, permisos)}`,
    montar: (root) => {
      montarPreguntasAdmin(root, capId);
      let filtro = 'todos';
      const aplicar = () => {
        const q = root.querySelector('#buscar').value.trim().toLowerCase();
        const area = root.querySelector('#f-area').value;
        const estados = FILTROS.find((x) => x.id === filtro).estados;
        let visibles = 0;
        root.querySelectorAll('#tbody tr').forEach((tr) => {
          const ok = (!estados || estados.includes(tr.dataset.estado)) && (!area || tr.dataset.area === area) && (!q || tr.dataset.nombre.includes(q));
          tr.hidden = !ok;
          if (ok) visibles++;
        });
        const sr = root.querySelector('#sin-resultados');
        if (sr) sr.hidden = visibles > 0;
      };
      root.querySelectorAll('[data-filtro]').forEach((b) =>
        b.addEventListener('click', () => {
          filtro = b.dataset.filtro;
          root.querySelectorAll('[data-filtro]').forEach((x) => x.setAttribute('aria-pressed', x === b));
          aplicar();
        })
      );
      root.querySelector('#buscar').addEventListener('input', aplicar);
      root.querySelector('#f-area').addEventListener('change', aplicar);
      const btnSel = root.querySelector('#marcar-sel');
      const actualizarSel = () => {
        const n = root.querySelectorAll('[data-sel]:checked').length;
        if (btnSel) {
          btnSel.disabled = n === 0;
          btnSel.textContent = `Registrar asistencia (${n})`;
        }
      };
      root.querySelectorAll('[data-sel]').forEach((c) => c.addEventListener('change', actualizarSel));
      root.querySelector('#sel-todos')?.addEventListener('change', (e) => {
        root.querySelectorAll('#tbody tr:not([hidden]) [data-sel]').forEach((c) => (c.checked = e.target.checked));
        actualizarSel();
      });
      btnSel?.addEventListener('click', () => {
        const ids = [...root.querySelectorAll('[data-sel]:checked')].map((c) => c.dataset.sel);
        const r = intentar(() => api.registrarAsistencias(uid, capId, ids));
        if (r) {
          toast(`Asistencia registrada a ${r.marcados} persona(s).`, 'ok');
          app.refrescar();
        }
      });
      root.querySelectorAll('[data-marcar]').forEach((b) =>
        b.addEventListener('click', () => {
          if (intentar(() => api.registrarAsistencias(uid, capId, [b.dataset.marcar]), 'Asistencia registrada')) app.refrescar();
        })
      );
      root.querySelectorAll('[data-quitar-asis]').forEach((b) =>
        b.addEventListener('click', async () => {
          if (!(await confirmar('Quitar asistencia', 'La persona volverá a figurar sin asistencia registrada.', 'Quitar'))) return;
          intentar(() => api.quitarAsistencia(uid, capId, b.dataset.quitarAsis), 'Asistencia quitada');
          app.refrescar();
        })
      );
      root.querySelectorAll('[data-recordar]').forEach((b) =>
        b.addEventListener('click', () => {
          const r = intentar(() => api.enviarRecordatorios(uid, capId, [b.dataset.recordar]));
          if (r) {
            toast(r.enviados ? 'Recordatorio enviado por correo y notificación.' : 'No se envió (ya completó o ya se le recordó hoy).', r.enviados ? 'ok' : '');
            app.refrescar();
          }
        })
      );
      root.querySelector('#recordar-todos')?.addEventListener('click', async () => {
        if (!(await confirmar('Recordar a los que faltan', `Se enviará un recordatorio (correo + notificación) a ${pendientesRecordar.length} persona(s) que aún tienen algo pendiente.`, 'Enviar'))) return;
        const r = intentar(() => api.enviarRecordatorios(uid, capId, pendientesRecordar.map((f) => f.asignacion.id)));
        if (r) {
          toast(`Se enviaron ${r.enviados} recordatorio(s).`, 'ok');
          app.refrescar();
        }
      });
      root.querySelector('#switch-auto')?.addEventListener('click', () => {
        intentar(() => api.configurarRecordatoriosAutomaticos(uid, capId, !cap.recordatorios.automaticos), cap.recordatorios.automaticos ? 'Recordatorios automáticos desactivados' : 'Recordatorios automáticos activados');
        app.refrescar();
      });
      root.querySelector('#exportar').addEventListener('click', () => exportarExcel(capId));
      root.querySelector('#generar-qr')?.addEventListener('click', () => {
        const m = modal(
          'Generar QR de asistencia',
          `<form class="pila" id="f-qr">
            <label class="campo"><span>Lugar</span><input type="text" name="lugar" value="${esc(cap.lugar)}"></label>
            <label class="campo"><span>Vigencia del QR (minutos)</span><input type="number" name="minutos" min="5" max="480" value="${Math.max(15, cap.duracion_min || 60)}"><small>Ponlo igual a la duración de la charla. Después el QR deja de funcionar.</small></label>
            <div class="acciones" style="justify-content:flex-end"><button type="button" class="btn btn-sec" data-cerrar>Cancelar</button><button class="btn btn-primario">Generar y proyectar</button></div>
          </form>`
        );
        m.el.querySelector('#f-qr').addEventListener('submit', (e) => {
          e.preventDefault();
          const datos = Object.fromEntries(new FormData(e.target));
          const se = intentar(() => api.crearSesion(uid, capId, datos));
          if (se) {
            m.cerrar();
            navegar(`#/capacitaciones/${capId}/qr/${se.id}`);
          }
        });
      });
    },
  };
}

// ───────────────────────── Preguntas de los colaboradores ─────────────────────────
function panelPreguntasAdmin(capId, permisos) {
  const consultas = api.consultasCapacitacion(sesion.uid, capId);
  const sinResponder = consultas.filter((q) => !q.respuesta).length;
  const items = consultas
    .map(
      (q) => `<div class="consulta">
        <div class="fila" style="justify-content:space-between"><p><b>${esc(q.autor)}</b> <span class="small muted">· ${esc(fmtFechaHora(q.creado_en))}</span></p>
          ${q.respuesta ? '<span class="pill verde">Respondida</span>' : '<span class="pill naranja">Sin responder</span>'}</div>
        <p>${esc(q.texto)}</p>
        ${
          q.respuesta
            ? `<div class="respuesta"><p class="small"><b>${esc(q.respondido_por_nombre)}</b> <span class="muted">· ${esc(fmtFechaHora(q.respondido_en))}</span></p><p>${esc(q.respuesta)}</p></div>`
            : permisos.recordar
              ? `<form class="pila" data-responder="${esc(q.id)}"><label class="sr-only" for="resp-${esc(q.id)}">Respuesta</label><textarea id="resp-${esc(q.id)}" maxlength="2000" placeholder="Escribe la respuesta…" required></textarea><button class="btn btn-primario btn-sm" style="align-self:flex-start">Responder</button></form>`
              : ''
        }
      </div>`
    )
    .join('');
  return `<div class="tarjeta pila" id="preguntas">
    <div class="fila" style="justify-content:space-between"><h2>Preguntas de los colaboradores</h2>${sinResponder ? `<span class="pill naranja">${sinResponder} sin responder</span>` : ''}</div>
    ${items || '<div class="vacio small">Aún no hay preguntas sobre esta capacitación.</div>'}
  </div>`;
}

function montarPreguntasAdmin(root, capId) {
  root.querySelectorAll('[data-responder]').forEach((f) =>
    f.addEventListener('submit', (e) => {
      e.preventDefault();
      const ok = intentar(() => api.responderConsulta(sesion.uid, capId, f.dataset.responder, f.querySelector('textarea').value), 'Respuesta enviada. Se le avisó al colaborador.');
      if (!ok) return;
      app.refrescar();
      setTimeout(() => document.getElementById('preguntas')?.scrollIntoView({ block: 'start' }), 50);
    })
  );
}

// ───────────────────────── Detalle por persona ─────────────────────────
export function vistaDetallePersona(capId, asigId) {
  const uid = sesion.uid;
  const d = api.detallePersona(uid, capId, asigId);
  const { capacitacion: cap, colaborador: c, resumen: r, permisos } = d;
  const videos = d.videos
    .map(
      (v, i) => `<tr><td>${i + 1}. ${esc(v.titulo)}</td><td>${fmtDuracion(v.duracion_seg)}</td><td>${v.progreso ? fmtDuracion(v.progreso.segundos_vistos_max) : '—'}</td><td class="small">${esc(fmtFechaHora(v.progreso?.iniciado_en))}</td><td class="small">${v.progreso?.terminado_en ? `<span class="pill verde">✓</span> ${esc(fmtFechaHora(v.progreso.terminado_en))}` : '—'}</td></tr>`
    )
    .join('');
  const intentos = d.intentos
    .map((i) => `<tr><td>Intento ${i.numero_intento}</td><td><b>${i.nota}/${i.total}</b></td><td>${i.aprobado ? '<span class="pill verde">Aprobado</span>' : '<span class="pill rojo">Desaprobado</span>'}</td><td class="small">${esc(fmtFechaHora(i.enviado_en))}</td></tr>`)
    .join('');
  const recs = d.recordatorios
    .map((x) => `<tr><td class="small">${esc(fmtFechaHora(x.enviado_en))}</td><td>${esc(TIPOS_RECORDATORIO[x.tipo] || x.tipo)}</td><td>${x.canal === 'correo' ? 'Correo' : 'Notificación portal'}</td><td>${esc(x.enviado_por_nombre || 'Automático')}</td></tr>`)
    .join('');
  const a = d.asistencia;
  return {
    titulo: c.nombre,
    html: `
    <a class="volver" href="#/capacitaciones/${esc(capId)}/seguimiento">← Volver al seguimiento</a>
    <div class="cab"><div><span class="small muted">${esc(cap.titulo)}</span><h1>${esc(c.nombre)}</h1>
      <p class="muted small">${esc(c.cargo)} · ${esc(c.area)} · ${esc(c.sede)}${c.dni ? ' · DNI ' + esc(c.dni) : ''}${c.jefe ? ' · Jefe: ' + esc(c.jefe) : ''}</p></div>
      <div class="fila">${pillEstado(r)}</div></div>
    <div class="kpis">
      <div class="kpi"><span class="et">Avance</span><span class="num">${r.porcentaje} %</span></div>
      <div class="kpi"><span class="et">${cap.modalidad === 'presencial' || cap.modalidad === 'en_vivo' ? 'Asistencia registrada' : 'Videos'}</span><span class="num">${cap.modalidad === 'presencial' || cap.modalidad === 'en_vivo' ? (r.presencialOk ? 'Sí' : 'No') : `${r.videosVistos}/${r.totalVideos}`}</span></div>
      <div class="kpi"><span class="et">Cuestionario</span><span class="num">${r.tieneCuestionario ? (r.mejorNota !== null ? `${r.mejorNota}/${r.totalPreguntas}` : '—') : 'N/A'}</span><span class="det">${r.tieneCuestionario ? `${r.intentosUsados} intento(s)${r.intentosRestantes !== null ? ` · quedan ${r.intentosRestantes}` : ''}` : ''}</span></div>
      <div class="kpi"><span class="et">Fecha límite</span><span class="num" style="font-size:20px">${esc(fmtFecha(d.asignacion.fecha_limite))}</span><span class="det">asignada el ${esc(fmtFecha(d.asignacion.fecha_asignacion))}</span></div>
    </div>
    ${
      permisos.recordar || permisos.editar
        ? `<div class="tarjeta pila"><h2>Acciones</h2><div class="acciones">
      ${permisos.recordar && r.requiereAccion ? '<button class="btn btn-primario" id="recordar">Enviar recordatorio</button>' : ''}
      ${permisos.editar && r.tieneCuestionario && !r.aprobado && r.intentosRestantes !== null ? '<button class="btn btn-sec" id="intento">Habilitar un intento más</button>' : ''}
      ${permisos.editar && cap.modalidad !== 'virtual' && !r.presencialOk ? `<button class="btn btn-sec" id="manual">${cap.modalidad === 'en_vivo' ? 'Marcar que asistió a la reunión' : 'Marcar asistencia manual'}</button>` : ''}
      ${permisos.editar && !r.completado ? `<span class="fila" style="gap:6px"><label class="sr-only" for="nueva-fecha">Nueva fecha límite</label><input type="date" id="nueva-fecha" value="${esc(d.asignacion.fecha_limite)}" style="width:auto"><button class="btn btn-sec" id="cambiar-fecha">Cambiar fecha límite</button></span>` : ''}
    </div></div>`
        : ''
    }
    ${cap.videos.length ? `<div class="tarjeta sin-pad"><div class="filtros"><h2>Videos</h2></div><div class="tabla-wrap"><table><thead><tr><th>Video</th><th>Duración</th><th>Visto hasta</th><th>Inició</th><th>Terminó</th></tr></thead><tbody>${videos}</tbody></table></div></div>` : ''}
    ${r.tieneCuestionario ? `<div class="tarjeta sin-pad"><div class="filtros"><h2>Intentos del cuestionario</h2></div>${intentos ? `<div class="tabla-wrap"><table><thead><tr><th>Intento</th><th>Nota</th><th>Resultado</th><th>Fecha</th></tr></thead><tbody>${intentos}</tbody></table></div>` : '<div class="vacio small">Aún no responde.</div>'}</div>` : ''}
    <div class="tarjeta pila"><h2>Asistencia y firma</h2>
      ${
        a
          ? `<div class="form-grid">
          <div><span class="small muted">Tipo</span><br><b>${esc(TIPOS_ASISTENCIA[a.tipo] || a.tipo)}</b></div>
          <div><span class="small muted">Registrada</span><br><b>${esc(fmtFechaHora(a.registrado_en))}</b>${a.sesion ? `<br><span class="small muted">Sesión ${esc(fmtFecha(a.sesion.fecha))} ${esc(a.sesion.hora_inicio)} · ${esc(a.sesion.lugar)}</span>` : ''}${a.reunion ? `<br><span class="small muted">Reunión Teams ${esc(fmtFecha(a.reunion.fecha))} ${esc(a.reunion.hora_inicio)}–${esc(a.reunion.hora_fin)}</span>` : ''}</div>
          <div><span class="small muted">Firmada</span><br><b>${esc(fmtFechaHora(a.firmado_en))}</b>${r.fueraDePlazo ? ' <span class="pill rojo">Fuera de plazo</span>' : ''}</div>
          <div>${a.firma ? `<img class="firma-img" src="${esc(a.firma)}" alt="Firma de ${esc(c.nombre)}">` : '<span class="muted">Sin firma</span>'}</div>
        </div>${a.dispositivo ? `<p class="small muted">Dispositivo: ${esc(a.dispositivo)}</p>` : ''}`
          : '<p class="muted">Aún no registra asistencia ni firma.</p>'
      }
    </div>
    <div class="tarjeta sin-pad"><div class="filtros"><h2>Recordatorios enviados</h2></div>${recs ? `<div class="tabla-wrap"><table><thead><tr><th>Fecha</th><th>Tipo</th><th>Canal</th><th>Enviado por</th></tr></thead><tbody>${recs}</tbody></table></div>` : '<div class="vacio small">Ninguno.</div>'}</div>`,
    montar: (root) => {
      root.querySelector('#recordar')?.addEventListener('click', () => {
        const res = intentar(() => api.enviarRecordatorios(uid, capId, [asigId]));
        if (res) {
          toast(res.enviados ? 'Recordatorio enviado.' : 'Ya se le envió un recordatorio hoy.', res.enviados ? 'ok' : '');
          app.refrescar();
        }
      });
      root.querySelector('#intento')?.addEventListener('click', () => {
        intentar(() => api.habilitarIntento(uid, capId, asigId), 'Se habilitó un intento más y se le avisó.');
        app.refrescar();
      });
      root.querySelector('#manual')?.addEventListener('click', () => {
        intentar(() => api.marcarAsistenciaManual(uid, capId, asigId), 'Asistencia registrada. La persona debe ingresar a firmar.');
        app.refrescar();
      });
      root.querySelector('#cambiar-fecha')?.addEventListener('click', () => {
        intentar(() => api.cambiarFechaLimitePersona(uid, capId, asigId, root.querySelector('#nueva-fecha').value), 'Fecha límite actualizada');
        app.refrescar();
      });
    },
  };
}

// ───────────────────────── Registro de asistencia (PDF) ─────────────────────────
export function vistaRegistro(capId) {
  const d = api.datosRegistro(sesion.uid, capId);
  const cap = d.capacitacion;
  const sesiones = [...new Map(d.filas.filter((f) => f.sesion).map((f) => [f.sesion.id, f.sesion])).values()];
  const filas = d.filas
    .map(
      (f, i) => `<tr><td>${i + 1}</td><td>${esc(f.colaborador.nombre)}</td><td>${esc(f.colaborador.dni || '—')}</td><td>${esc(f.colaborador.area)}</td><td>${esc(f.colaborador.cargo)}</td>
      <td>${esc(cap.modalidad === 'en_vivo' ? 'En vivo (Teams)' : TIPOS_ASISTENCIA[f.asistencia?.tipo] || '—')}</td><td>${f.resumen.tieneCuestionario ? `${f.resumen.mejorNota}/${f.resumen.totalPreguntas}` : '—'}</td>
      <td>${esc(fmtFechaHora(f.resumen.completadoEn))}</td><td>${f.firma ? `<img src="${esc(f.firma)}" alt="Firma">` : `<span style="font-size:11px">${f.resumen.tieneCuestionario ? 'Cuestionario aprobado' : 'Asistencia registrada por RR.HH.'}</span>`}</td></tr>`
    )
    .join('');
  return {
    titulo: 'Registro de asistencia',
    html: `
    <div class="no-print pila">
      <a class="volver" href="#/capacitaciones/${esc(capId)}/seguimiento">← Volver al seguimiento</a>
      <div class="cab"><div><h1>Registro de asistencia</h1><p class="sub">Para descargarlo en PDF elige «Guardar como PDF» en la ventana de impresión.</p></div>
        <div class="acciones"><button class="btn btn-sec" id="excel">${ico.descarga} Excel</button><button class="btn btn-primario" id="imprimir">${ico.descarga} Descargar PDF</button></div></div>
      ${d.pendientes ? `<div class="aviso warn">${d.pendientes} persona(s) asignada(s) aún no completan y no aparecen en el registro.</div>` : ''}
      <div class="aviso info">Formato base de trabajo: confirmar campos obligatorios con SST y la normativa vigente (Ley N.° 29783 y sus formatos referenciales).</div>
    </div>
    <article class="registro">
      <div class="enc"><span class="logo-reg">INVA</span><div style="text-align:right"><b>${esc(d.codigo)}</b><br><span class="small">Generado: ${esc(fmtFechaHora(d.generado_en))}</span><br><span class="small">por ${esc(d.generado_por)}</span></div></div>
      <h1>REGISTRO DE ASISTENCIA A CAPACITACIÓN</h1>
      <p style="text-align:center;margin:4px 0 16px">INVA Ingenieros S.A.C.</p>
      <div class="datos">
        <div><b>Capacitación:</b> ${esc(cap.titulo)}</div>
        <div><b>Categoría:</b> ${esc(CATEGORIAS[cap.categoria])} (${cap.obligatoria ? 'obligatoria' : 'opcional'})</div>
        <div style="grid-column:1/-1"><b>Tema tratado:</b> ${esc(cap.descripcion)}</div>
        <div><b>Modalidad:</b> ${esc(MODALIDADES[cap.modalidad])}</div>
        <div><b>Duración:</b> ${cap.duracion_min} minutos</div>
        <div><b>Lugar:</b> ${esc(cap.lugar || (cap.modalidad === 'virtual' ? 'Portal INVA (virtual)' : cap.modalidad === 'en_vivo' ? 'Reunión virtual – Microsoft Teams' : '—'))}</div>
        <div><b>Fecha(s):</b> ${cap.modalidad === 'en_vivo' && (cap.reuniones || []).length ? cap.reuniones.map((s) => `${esc(fmtFecha(s.fecha))} ${esc(s.hora_inicio)}–${esc(s.hora_fin)}`).join('; ') : sesiones.length ? sesiones.map((s) => `${esc(fmtFecha(s.fecha))} ${esc(s.hora_inicio)}–${esc(s.hora_fin)}`).join('; ') : `Del ${esc(fmtFecha(cap.creado_en))} al ${esc(fmtFecha(cap.fecha_limite))}`}</div>
        <div><b>Capacitador:</b> ${esc(cap.capacitador_nombre || '—')}</div>
        <div><b>Cargo / empresa:</b> ${esc(cap.capacitador_cargo || '—')}</div>
        <div><b>Total de asistentes:</b> ${d.filas.length}</div>
        <div><b>Nota mínima:</b> ${cap.preguntas.length ? `${cap.nota_minima}/${cap.preguntas.length}` : 'Sin evaluación'}</div>
      </div>
      <div class="tabla-wrap"><table><thead><tr><th>N.°</th><th>Apellidos y nombres</th><th>DNI</th><th>Área</th><th>Cargo</th><th>Modalidad</th><th>Nota</th><th>Fecha y hora</th><th>Firma / evidencia</th></tr></thead>
      <tbody>${filas || '<tr><td colspan="9" style="text-align:center">Aún no hay asistentes que hayan completado.</td></tr>'}</tbody></table></div>
      <div class="pie-reg"><div>Responsable del registro<br>${esc(d.generado_por)}</div><div>Capacitador<br>${esc(cap.capacitador_nombre || '')}</div></div>
    </article>`,
    montar: (root) => {
      root.querySelector('#imprimir').addEventListener('click', () => window.print());
      root.querySelector('#excel').addEventListener('click', () => exportarExcel(capId));
    },
  };
}

// ───────────────────────── Exportar a Excel ─────────────────────────
export function exportarExcel(capId) {
  const s = intentar(() => api.datosExportacion(sesion.uid, capId));
  if (!s) return;
  const cap = s.capacitacion;
  const filas = s.filas.map((f) => ({
    Colaborador: f.colaborador.nombre,
    DNI: f.colaborador.dni,
    Área: f.colaborador.area,
    Cargo: f.colaborador.cargo,
    Sede: f.colaborador.sede,
    'Fecha asignación': f.asignacion.fecha_asignacion,
    'Fecha límite': f.asignacion.fecha_limite,
    'Videos vistos': `${f.resumen.videosVistos}/${f.resumen.totalVideos}`,
    'Asistencia registrada': f.resumen.presencialOk ? 'Sí' : 'No',
    Nota: f.resumen.mejorNota === null ? 'Sin responder' : `${f.resumen.mejorNota}/${f.resumen.totalPreguntas}`,
    Intentos: f.resumen.intentosUsados,
    Firmó: f.resumen.firmado ? 'Sí' : 'No',
    'Fecha firma': f.resumen.firmadoEn ? fmtFechaHora(f.resumen.firmadoEn) : '',
    'Completado el': f.resumen.completadoEn ? fmtFechaHora(f.resumen.completadoEn) : '',
    Estado: ESTADOS[f.resumen.estado].label,
    Avance: `${f.resumen.porcentaje} %`,
    'Último recordatorio': f.ultimoRecordatorio ? fmtFechaHora(f.ultimoRecordatorio.enviado_en) : '',
  }));
  const nombre = `seguimiento-${cap.titulo.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-')}-${api.hoy()}`;
  if (window.XLSX) {
    const wb = window.XLSX.utils.book_new();
    const ws = window.XLSX.utils.json_to_sheet(filas);
    ws['!cols'] = Object.keys(filas[0] || { a: 1 }).map((k) => ({ wch: Math.max(12, k.length + 2) }));
    window.XLSX.utils.book_append_sheet(wb, ws, 'Seguimiento');
    window.XLSX.writeFile(wb, `${nombre}.xlsx`);
  } else {
    // Respaldo sin conexión: CSV que Excel abre directamente.
    const cols = Object.keys(filas[0] || {});
    const csv = [cols, ...filas.map((f) => cols.map((c) => f[c]))].map((r) => r.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(';')).join('\r\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }));
    a.download = `${nombre}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }
  toast('Archivo descargado', 'ok');
}

// ───────────────────────── QR para proyectar ─────────────────────────
export function vistaQR(capId, sesionId) {
  const uid = sesion.uid;
  const est = api.estadoSesion(uid, capId, sesionId);
  const { permisos } = api.obtenerCapacitacionAdmin(uid, capId);
  const url = `${location.origin}${location.pathname}#/asistencia/${est.sesion.token_qr}`;
  return {
    titulo: 'QR de asistencia',
    sinLayout: true,
    html: `<div class="proyeccion">
      <div class="fila" style="justify-content:center"><span class="logo">INVA</span><span class="muted">Registro de asistencia</span></div>
      <h1 style="font-size:clamp(24px,4vw,40px)">${esc(est.capacitacion.titulo)}</h1>
      <p class="muted">${esc(fmtFechaLarga(est.sesion.fecha))} · ${esc(est.sesion.hora_inicio)}–${esc(est.sesion.hora_fin)}${est.sesion.lugar ? ' · ' + esc(est.sesion.lugar) : ''}</p>
      <div id="zona-qr">${est.vigente ? '<div class="qr" id="qr" aria-label="Código QR de asistencia"></div><p>Escanea con la cámara de tu celular e ingresa con tu usuario del portal.</p>' : '<div class="aviso warn">Esta sesión está cerrada: el QR ya no funciona.</div>'}</div>
      <div><div class="contador" id="contador">${est.asistentes.length}</div><span class="muted">asistentes registrados de ${est.asignados} asignados · <span id="restante"></span></span></div>
      <div id="ultimos" class="muted small"></div>
      <div class="acciones no-print" style="justify-content:center">
        <a class="btn btn-sec" href="#/capacitaciones/${esc(capId)}/seguimiento">← Volver</a>
        ${est.vigente ? `<a class="btn btn-sec" href="${esc(url)}" target="_blank" rel="noopener">Abrir enlace (simular escaneo)</a>` : ''}
        ${est.vigente && permisos.editar ? '<button class="btn btn-primario" id="cerrar-sesion">Cerrar sesión de QR</button>' : ''}
      </div>
      <p class="muted small" style="max-width:620px">Demo: los datos se guardan en este navegador, así que el escaneo con otro celular no se refleja aquí. Usa «Abrir enlace» e ingresa como una persona asignada para probarlo.</p>
    </div>`,
    montar: (root) => {
      const qrEl = root.querySelector('#qr');
      if (qrEl) {
        if (window.QRCode) new window.QRCode(qrEl, { text: url, width: 280, height: 280, correctLevel: window.QRCode.CorrectLevel.M });
        else qrEl.innerHTML = `<p style="color:#000;max-width:280px;word-break:break-all">${esc(url)}</p>`;
      }
      const pintar = () => {
        api.cargar();
        const e = api.estadoSesion(uid, capId, sesionId);
        root.querySelector('#contador').textContent = e.asistentes.length;
        root.querySelector('#ultimos').textContent = e.asistentes.length ? 'Últimos: ' + e.asistentes.slice(0, 5).map((x) => x.nombre).join(', ') : '';
        const min = Math.round((new Date(e.sesion.qr_expira_en) - api.ahora()) / 60000);
        root.querySelector('#restante').textContent = e.vigente ? `el QR vence en ${min} min` : 'sesión cerrada';
        if (!e.vigente && qrEl && root.querySelector('#qr')) app.refrescar();
      };
      pintar();
      const t = setInterval(pintar, 3000);
      app.limpiezas.push(() => clearInterval(t));
      root.querySelector('#cerrar-sesion')?.addEventListener('click', async () => {
        if (!(await confirmar('Cerrar sesión de QR', 'El código dejará de funcionar. Podrás ver la lista de asistentes en el seguimiento.', 'Cerrar sesión'))) return;
        intentar(() => api.cerrarSesion(uid, capId, sesionId), 'Sesión cerrada');
        navegar(`#/capacitaciones/${capId}/seguimiento`);
      });
    },
  };
}
