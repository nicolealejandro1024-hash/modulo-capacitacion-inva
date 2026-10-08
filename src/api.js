// "Backend" del módulo de Capacitaciones.
// Toda la lógica de negocio y TODOS los controles de permisos viven aquí (docs/PERMISOS.md):
// las pantallas solo llaman a estos métodos, nunca leen la base de datos directamente.
// En esta versión los datos se guardan en el navegador (localStorage); al integrarlo al Portal INVA
// estos métodos se convierten en endpoints del servidor con la misma lógica.
import { crearSemilla } from './seed.js';
import { fechaISO, fechaHoraISO, sumarDias, diasEntre, fmtFecha } from './util.js';

const DIA_MS = 86400000;
/** Cuántos segundos puede avanzar un reporte de progreso respecto a lo ya visto (evita adelantar el video). */
export const TOLERANCIA_SEG = 20;

export const PERMISOS = {
  propietario: { ver: true, recordar: true, registro: true, editar: true, responsables: true },
  editor: { ver: true, recordar: true, registro: true, editar: true, responsables: false },
  solo_lectura: { ver: true, recordar: false, registro: true, editar: false, responsables: false },
};

export class AccesoDenegado extends Error {
  constructor(msg = 'No tienes acceso a esta capacitación.') {
    super(msg);
    this.name = 'AccesoDenegado';
    this.status = 403;
  }
}

export class ErrorNegocio extends Error {
  constructor(msg) {
    super(msg);
    this.name = 'ErrorNegocio';
    this.status = 400;
  }
}

const copia = (x) => JSON.parse(JSON.stringify(x));

export class Api {
  constructor({ storage = null, clave = 'inva-capacitaciones-v1', ahora = () => new Date() } = {}) {
    this.storage = storage;
    this.clave = clave;
    this._ahora = ahora;
    this.cargar();
  }

  // ───────────────────────── persistencia y reloj ─────────────────────────
  cargar() {
    let raw = null;
    try {
      raw = this.storage?.getItem(this.clave) ?? null;
    } catch {}
    try {
      this.db = raw ? JSON.parse(raw) : null;
    } catch {
      this.db = null;
    }
    if (!this.db) {
      this.db = crearSemilla(fechaISO(this._ahora()));
      this.guardar();
    }
  }

  guardar() {
    try {
      this.storage?.setItem(this.clave, JSON.stringify(this.db));
    } catch (e) {
      console.warn('No se pudo guardar en el navegador', e);
    }
  }

  restablecerDemo() {
    this.db = crearSemilla(fechaISO(this._ahora()));
    this.guardar();
  }

  ahora() {
    return new Date(this._ahora().getTime() + (this.db.desfaseDias || 0) * DIA_MS);
  }
  hoy() {
    return fechaISO(this.ahora());
  }
  marca() {
    return fechaHoraISO(this.ahora());
  }
  nuevoId(prefijo) {
    this.db.seq = (this.db.seq || 1000) + 1;
    return `${prefijo}${this.db.seq}`;
  }

  /** Solo para la demo: simula que pasa un día y corre la tarea programada. */
  avanzarDia() {
    this.db.desfaseDias = (this.db.desfaseDias || 0) + 1;
    this.guardar();
    return this.ejecutarRecordatoriosAutomaticos();
  }

  // ───────────────────────── helpers internos ─────────────────────────
  usuario(id) {
    return this.db.usuarios.find((u) => u.id === id) || null;
  }
  cap(id) {
    return this.db.capacitaciones.find((c) => c.id === id) || null;
  }
  rolEn(uid, capId) {
    return this.db.responsables.find((r) => r.capacitacion_id === capId && r.usuario_id === uid)?.rol || null;
  }

  exigirSesion(uid) {
    const u = this.usuario(uid);
    if (!u || !u.activo) throw new AccesoDenegado('Tu sesión no es válida. Vuelve a ingresar.');
    return u;
  }

  exigirAdmin(uid) {
    const u = this.exigirSesion(uid);
    if (u.rol !== 'admin_rrhh') throw new AccesoDenegado('Esta acción es solo para Administradores RR.HH.');
    return u;
  }

  /** Regla central de PERMISOS.md: solo los responsables de la capacitación, según su rol. */
  exigir(uid, capId, accion) {
    this.exigirSesion(uid);
    const cap = this.cap(capId);
    const rol = this.rolEn(uid, capId);
    if (!cap || !rol || !PERMISOS[rol][accion]) {
      this.auditar(uid, 'acceso_denegado', capId, `Intentó «${accion}» sin permiso`);
      this.guardar();
      throw new AccesoDenegado();
    }
    return { cap, rol };
  }

  auditar(uid, accion, capId, detalle) {
    this.db.auditoria.push({ id: this.nuevoId('au'), usuario_id: uid, accion, capacitacion_id: capId, detalle, fecha: this.marca() });
  }

  notificar(usuarioId, titulo, texto, enlace) {
    this.db.notificaciones.push({ id: this.nuevoId('n'), usuario_id: usuarioId, titulo, texto, enlace, leida: false, creado_en: this.marca() });
  }

  miAsignacion(uid, asigId) {
    this.exigirSesion(uid);
    const a = this.db.asignaciones.find((x) => x.id === asigId);
    if (!a || a.colaborador_id !== uid) throw new AccesoDenegado('Esta capacitación no está asignada a tu usuario.');
    const cap = this.cap(a.capacitacion_id);
    if (!cap || cap.estado === 'borrador') throw new AccesoDenegado('Esta capacitación no está disponible.');
    return { a, cap };
  }

  /** Calcula el estado y el avance de una asignación a partir de lo registrado. */
  resumen(a) {
    const cap = this.cap(a.capacitacion_id);
    const prog = this.db.progreso.filter((p) => p.asignacion_id === a.id);
    const videosVistos = cap.videos.filter((v) => prog.some((p) => p.video_id === v.id && p.terminado_en)).length;
    const videosOk = videosVistos === cap.videos.length;
    const asis = this.db.asistencias.find((x) => x.asignacion_id === a.id) || null;
    const presencialOk = !!asis && asis.tipo !== 'virtual';
    const intentos = this.db.intentos.filter((i) => i.asignacion_id === a.id).sort((x, y) => x.numero_intento - y.numero_intento);
    const aprobado = intentos.some((i) => i.aprobado);
    const mejorNota = intentos.length ? Math.max(...intentos.map((i) => i.nota)) : null;
    const tieneCuestionario = cap.preguntas.length > 0;
    const contenidoOk = cap.modalidad === 'virtual' ? videosOk : cap.modalidad === 'presencial' ? presencialOk : videosOk || presencialOk;
    const cuestionarioOk = !tieneCuestionario || aprobado;
    const firmado = !!asis?.firmado_en;
    const intentosPermitidos = cap.intentos_max ? cap.intentos_max + (a.intentos_extra || 0) : null;
    const intentosRestantes = intentosPermitidos === null ? null : Math.max(0, intentosPermitidos - intentos.length);
    const vencido = !firmado && this.hoy() > a.fecha_limite;
    const empezo = prog.length > 0 || intentos.length > 0 || !!asis;

    let estado = 'no_inicio';
    if (firmado) estado = 'completado';
    else if (vencido) estado = 'vencido';
    else if (contenidoOk && cuestionarioOk) estado = 'pendiente_firma';
    else if (empezo) estado = 'en_curso';

    const nCont = cap.modalidad === 'presencial' ? 1 : Math.max(1, cap.videos.length);
    const hechoCont = contenidoOk ? nCont : cap.modalidad === 'presencial' ? 0 : videosVistos;
    const total = nCont + (tieneCuestionario ? 1 : 0) + 1;
    const hecho = hechoCont + (tieneCuestionario && aprobado ? 1 : 0) + (firmado ? 1 : 0);

    let falta = null;
    if (!contenidoOk) falta = cap.modalidad === 'presencial' ? 'confirmar tu asistencia' : 'ver los videos';
    else if (!cuestionarioOk) falta = 'responder el cuestionario';
    else if (!firmado) falta = 'firmar tu asistencia';

    return {
      estado,
      porcentaje: Math.round((hecho / total) * 100),
      videosVistos,
      totalVideos: cap.videos.length,
      videosOk,
      presencialOk,
      contenidoOk,
      tieneCuestionario,
      cuestionarioOk,
      aprobado,
      mejorNota,
      totalPreguntas: cap.preguntas.length,
      intentosUsados: intentos.length,
      intentosRestantes,
      sinIntentos: tieneCuestionario && !aprobado && intentosRestantes === 0,
      firmado,
      firmadoEn: asis?.firmado_en || null,
      vencido,
      fueraDePlazo: firmado && a.completado_en && a.completado_en.slice(0, 10) > a.fecha_limite,
      falta,
    };
  }

  /** Capacitación tal como la ve un colaborador (sin respuestas correctas). */
  vistaColaborador(cap) {
    const { preguntas, ...resto } = copia(cap);
    return { ...resto, preguntas: preguntas.map((p) => ({ id: p.id, tipo: p.tipo, texto: p.texto, opciones: p.opciones.map((o) => o.texto) })) };
  }

  // ───────────────────────── sesión y notificaciones ─────────────────────────
  usuariosDemo() {
    return this.db.usuarios.filter((u) => u.activo).map((u) => ({ id: u.id, nombre: u.nombre, rol: u.rol, area: u.area, cargo: u.cargo }));
  }

  perfil(uid) {
    const u = this.exigirSesion(uid);
    const esResponsable = this.db.responsables.some((r) => r.usuario_id === uid);
    const firma = u.firma_id ? this.db.firmas.find((f) => f.id === u.firma_id) : null;
    return { ...copia(u), esResponsable, puedeAdministrar: u.rol === 'admin_rrhh' || esResponsable, miFirma: firma?.imagen || null };
  }

  notificaciones(uid) {
    this.exigirSesion(uid);
    return this.db.notificaciones.filter((n) => n.usuario_id === uid).sort((a, b) => b.creado_en.localeCompare(a.creado_en)).slice(0, 30).map(copia);
  }

  marcarNotificacionesLeidas(uid) {
    this.exigirSesion(uid);
    this.db.notificaciones.forEach((n) => {
      if (n.usuario_id === uid) n.leida = true;
    });
    this.guardar();
  }

  // ───────────────────────── colaborador: Mis Capacitaciones ─────────────────────────
  misCapacitaciones(uid) {
    this.exigirSesion(uid);
    return this.db.asignaciones
      .filter((a) => a.colaborador_id === uid)
      .map((a) => ({ a, cap: this.cap(a.capacitacion_id) }))
      .filter(({ cap }) => cap && cap.estado !== 'borrador')
      .map(({ a, cap }) => ({ asignacion: copia(a), capacitacion: this.vistaColaborador(cap), resumen: this.resumen(a) }))
      .sort((x, y) => x.asignacion.fecha_limite.localeCompare(y.asignacion.fecha_limite));
  }

  miCapacitacion(uid, asigId) {
    const { a, cap } = this.miAsignacion(uid, asigId);
    const progreso = this.db.progreso.filter((p) => p.asignacion_id === a.id).map(copia);
    const intentos = this.db.intentos.filter((i) => i.asignacion_id === a.id).map(copia);
    const asistencia = copia(this.db.asistencias.find((x) => x.asignacion_id === a.id) || null);
    let ultimoResultado = null;
    const ultimo = intentos.sort((x, y) => y.numero_intento - x.numero_intento)[0];
    if (ultimo) {
      const resp = this.db.respuestas.filter((r) => r.intento_id === ultimo.id);
      const res = this.resumen(a);
      // Las respuestas correctas solo se revelan al aprobar o al agotar los intentos (para no facilitar el reintento).
      const revelar = res.aprobado || res.sinIntentos;
      ultimoResultado = {
        ...ultimo,
        detalle: cap.mostrar_respuestas
          ? cap.preguntas.map((p) => {
              const elegida = resp.find((r) => r.pregunta_id === p.id)?.opcion ?? null;
              const correcta = p.opciones.findIndex((o) => o.correcta);
              return { pregunta_id: p.id, elegida, acerto: elegida === correcta, correcta: revelar ? correcta : null };
            })
          : null,
      };
    }
    return { asignacion: copia(a), capacitacion: this.vistaColaborador(cap), resumen: this.resumen(a), progreso, intentos, asistencia, ultimoResultado };
  }

  registrarProgresoVideo(uid, asigId, videoId, posicion) {
    const { a, cap } = this.miAsignacion(uid, asigId);
    if (cap.estado !== 'publicada') throw new ErrorNegocio('Esta capacitación ya está cerrada.');
    const idx = cap.videos.findIndex((v) => v.id === videoId);
    if (idx < 0) throw new ErrorNegocio('Video no encontrado.');
    for (const previo of cap.videos.slice(0, idx)) {
      const p = this.db.progreso.find((x) => x.asignacion_id === a.id && x.video_id === previo.id);
      if (!p?.terminado_en) throw new ErrorNegocio('Primero termina el video anterior.');
    }
    const v = cap.videos[idx];
    let p = this.db.progreso.find((x) => x.asignacion_id === a.id && x.video_id === videoId);
    if (!p) {
      p = { asignacion_id: a.id, video_id: videoId, segundos_vistos_max: 0, iniciado_en: this.marca(), terminado_en: null };
      this.db.progreso.push(p);
    }
    const pos = Math.max(0, Math.min(Number(posicion) || 0, v.duracion_seg));
    // Si el reporte salta más allá de lo visto + tolerancia, es un intento de adelantar: se ignora.
    if (pos > p.segundos_vistos_max && pos <= p.segundos_vistos_max + TOLERANCIA_SEG) p.segundos_vistos_max = pos;
    if (!p.terminado_en && p.segundos_vistos_max >= v.duracion_seg - 1) p.terminado_en = this.marca();
    this.guardar();
    return copia(p);
  }

  enviarCuestionario(uid, asigId, respuestas) {
    const { a, cap } = this.miAsignacion(uid, asigId);
    if (cap.estado !== 'publicada') throw new ErrorNegocio('Esta capacitación ya está cerrada.');
    const r = this.resumen(a);
    if (!r.tieneCuestionario) throw new ErrorNegocio('Esta capacitación no tiene cuestionario.');
    if (!r.contenidoOk) throw new ErrorNegocio(cap.modalidad === 'presencial' ? 'Primero confirma tu asistencia.' : 'Primero termina todos los videos.');
    if (r.aprobado) throw new ErrorNegocio('Ya aprobaste este cuestionario.');
    if (r.intentosRestantes === 0) throw new ErrorNegocio('Ya no te quedan intentos. Comunícate con RR.HH.');
    for (const p of cap.preguntas) {
      const o = respuestas?.[p.id];
      if (o === undefined || o === null || o < 0 || o >= p.opciones.length) throw new ErrorNegocio('Responde todas las preguntas antes de enviar.');
    }
    const nota = cap.preguntas.filter((p) => p.opciones[respuestas[p.id]]?.correcta).length;
    const intento = {
      id: this.nuevoId('i'),
      asignacion_id: a.id,
      numero_intento: r.intentosUsados + 1,
      nota,
      total: cap.preguntas.length,
      aprobado: nota >= cap.nota_minima,
      enviado_en: this.marca(),
    };
    this.db.intentos.push(intento);
    for (const p of cap.preguntas) this.db.respuestas.push({ intento_id: intento.id, pregunta_id: p.id, opcion: Number(respuestas[p.id]) });
    this.guardar();
    return this.miCapacitacion(uid, asigId);
  }

  firmarAsistencia(uid, asigId, { imagen = null, usarMiFirma = false, guardarComoMiFirma = false, aceptaDeclaracion = false, dispositivo = '' } = {}) {
    const { a, cap } = this.miAsignacion(uid, asigId);
    const u = this.usuario(uid);
    const r = this.resumen(a);
    if (r.firmado) throw new ErrorNegocio('Ya firmaste esta capacitación.');
    if (!r.contenidoOk || !r.cuestionarioOk) throw new ErrorNegocio(`Antes de firmar te falta ${r.falta}.`);
    if (!aceptaDeclaracion) throw new ErrorNegocio('Debes aceptar la declaración.');
    let firmaId;
    if (usarMiFirma) {
      if (!u.firma_id) throw new ErrorNegocio('Aún no tienes una firma registrada en «Mi Firma».');
      firmaId = u.firma_id;
    } else {
      if (!imagen || !String(imagen).startsWith('data:image/')) throw new ErrorNegocio('Dibuja tu firma antes de continuar.');
      firmaId = this.nuevoId('f');
      this.db.firmas.push({ id: firmaId, usuario_id: uid, imagen, creado_en: this.marca() });
      if (guardarComoMiFirma || !u.firma_id) u.firma_id = firmaId;
    }
    let asis = this.db.asistencias.find((x) => x.asignacion_id === a.id);
    if (!asis) {
      asis = { id: this.nuevoId('as'), asignacion_id: a.id, sesion_id: null, tipo: 'virtual', registrado_en: this.marca(), firma_id: null, firmado_en: null, dispositivo: '' };
      this.db.asistencias.push(asis);
    }
    asis.firma_id = firmaId;
    asis.firmado_en = this.marca();
    asis.dispositivo = String(dispositivo).slice(0, 200);
    a.completado_en = asis.firmado_en;
    this.auditar(uid, 'firmar_asistencia', cap.id, `${u.nombre} firmó su asistencia`);
    this.guardar();
    return this.miCapacitacion(uid, asigId);
  }

  infoSesionQR(uid, token) {
    this.exigirSesion(uid);
    const s = this.db.sesiones.find((x) => x.token_qr === token);
    if (!s) throw new ErrorNegocio('El código QR no es válido.');
    const cap = this.cap(s.capacitacion_id);
    const a = this.db.asignaciones.find((x) => x.capacitacion_id === cap.id && x.colaborador_id === uid);
    const asis = a ? this.db.asistencias.find((x) => x.asignacion_id === a.id) : null;
    return {
      sesion: { id: s.id, fecha: s.fecha, hora_inicio: s.hora_inicio, hora_fin: s.hora_fin, lugar: s.lugar },
      capacitacion: { id: cap.id, titulo: cap.titulo, capacitador_nombre: cap.capacitador_nombre },
      vigente: this.marca() <= s.qr_expira_en && cap.estado === 'publicada',
      asignado: !!a,
      asignacionId: a?.id || null,
      yaRegistrado: !!asis && asis.tipo !== 'virtual',
    };
  }

  confirmarAsistenciaQR(uid, token, dispositivo = '') {
    const info = this.infoSesionQR(uid, token);
    if (!info.vigente) throw new ErrorNegocio('Este código QR ya venció. Pide a RR.HH. que genere uno nuevo.');
    if (!info.asignado) throw new ErrorNegocio('No estás asignado a esta capacitación. Comunícate con RR.HH.');
    const s = this.db.sesiones.find((x) => x.token_qr === token);
    let asis = this.db.asistencias.find((x) => x.asignacion_id === info.asignacionId);
    if (asis && asis.tipo !== 'virtual') return info.asignacionId;
    if (!asis) {
      asis = { id: this.nuevoId('as'), asignacion_id: info.asignacionId, firma_id: null, firmado_en: null };
      this.db.asistencias.push(asis);
    }
    Object.assign(asis, { sesion_id: s.id, tipo: 'presencial_qr', registrado_en: this.marca(), dispositivo: String(dispositivo).slice(0, 200) });
    this.guardar();
    return info.asignacionId;
  }

  // ───────────────────────── administración ─────────────────────────
  listarCapacitacionesAdmin(uid) {
    this.exigirSesion(uid);
    // Regla 3 de PERMISOS.md: solo las capacitaciones donde el usuario es responsable.
    return this.db.responsables
      .filter((r) => r.usuario_id === uid)
      .map((r) => {
        const cap = this.cap(r.capacitacion_id);
        const res = this.db.asignaciones.filter((a) => a.capacitacion_id === cap.id).map((a) => this.resumen(a));
        return {
          capacitacion: copia(cap),
          rol: r.rol,
          stats: {
            asignados: res.length,
            completados: res.filter((x) => x.estado === 'completado').length,
            faltan: res.filter((x) => ['no_inicio', 'en_curso', 'pendiente_firma'].includes(x.estado)).length,
            vencidos: res.filter((x) => x.estado === 'vencido').length,
          },
        };
      })
      .sort((a, b) => b.capacitacion.creado_en.localeCompare(a.capacitacion.creado_en));
  }

  dashboard(uid) {
    const lista = this.listarCapacitacionesAdmin(uid).filter((x) => x.capacitacion.estado === 'publicada');
    return {
      capacitaciones: lista,
      // Regla 4: el contador solo suma capacitaciones de las que el usuario es responsable.
      pendientes: lista.reduce((s, x) => s + x.stats.faltan + x.stats.vencidos, 0),
      vencidos: lista.reduce((s, x) => s + x.stats.vencidos, 0),
      completados: lista.reduce((s, x) => s + x.stats.completados, 0),
      asignados: lista.reduce((s, x) => s + x.stats.asignados, 0),
    };
  }

  /** Personas del portal, para asignar y elegir responsables. */
  listarUsuarios(uid) {
    const p = this.perfil(uid);
    if (!p.puedeAdministrar) throw new AccesoDenegado();
    return this.db.usuarios
      .filter((u) => u.activo)
      .map((u) => ({ id: u.id, nombre: u.nombre, correo: u.correo, rol: u.rol, area: u.area, cargo: u.cargo, sede: u.sede, ingreso: u.ingreso, jefe_id: u.jefe_id }));
  }

  obtenerCapacitacionAdmin(uid, capId) {
    const { cap, rol } = this.exigir(uid, capId, 'ver');
    const responsables = this.db.responsables
      .filter((r) => r.capacitacion_id === capId)
      .map((r) => ({ ...copia(r), nombre: this.usuario(r.usuario_id)?.nombre, cargo: this.usuario(r.usuario_id)?.cargo }));
    return { capacitacion: copia(cap), rol, permisos: PERMISOS[rol], responsables, asignados: this.db.asignaciones.filter((a) => a.capacitacion_id === capId).length };
  }

  limpiarDatosCapacitacion(datos, previa = {}) {
    const txt = (v, max = 500) => String(v ?? '').trim().slice(0, max);
    const num = (v, def) => (v === '' || v === null || v === undefined || isNaN(Number(v)) ? def : Math.max(0, Math.round(Number(v))));
    const videos = (datos.videos || []).map((v) => ({
      id: v.id || this.nuevoId('v'),
      titulo: txt(v.titulo, 200) || 'Video sin título',
      duracion_seg: Math.max(1, num(v.duracion_seg, 60)),
      url: txt(v.url, 1000),
    }));
    const preguntas = (datos.preguntas || []).map((p) => {
      const tipo = p.tipo === 'vf' ? 'vf' : 'multiple';
      let opciones = tipo === 'vf' ? [{ texto: 'Verdadero' }, { texto: 'Falso' }] : (p.opciones || []).map((o) => ({ texto: txt(o.texto, 300) })).filter((o) => o.texto);
      const correcta = Number(p.correcta ?? (p.opciones || []).findIndex((o) => o.correcta));
      opciones = opciones.map((o, i) => ({ ...o, correcta: i === correcta }));
      return { id: p.id || this.nuevoId('p'), tipo, texto: txt(p.texto, 500), opciones };
    });
    const modo = ['todos', 'area', 'cargo', 'sede', 'personas'].includes(datos.asignacion?.modo) ? datos.asignacion.modo : 'todos';
    const rec = datos.recordatorios || {};
    return {
      titulo: txt(datos.titulo, 200),
      descripcion: txt(datos.descripcion, 2000),
      categoria: ['induccion', 'sst', 'cumplimiento', 'desarrollo', 'otra'].includes(datos.categoria) ? datos.categoria : 'otra',
      obligatoria: !!datos.obligatoria,
      modalidad: ['virtual', 'presencial', 'mixta'].includes(datos.modalidad) ? datos.modalidad : 'virtual',
      capacitador_nombre: txt(datos.capacitador_nombre, 200),
      capacitador_cargo: txt(datos.capacitador_cargo, 200),
      lugar: txt(datos.lugar, 200),
      duracion_min: num(datos.duracion_min, 0),
      fecha_limite: /^\d{4}-\d{2}-\d{2}$/.test(datos.fecha_limite || '') ? datos.fecha_limite : previa.fecha_limite || sumarDias(this.hoy(), 7),
      dias_para_completar: Math.max(1, num(datos.dias_para_completar, 7)),
      nota_minima: num(datos.nota_minima, 0),
      intentos_max: datos.intentos_max === '' || datos.intentos_max === null || datos.intentos_max === undefined || Number(datos.intentos_max) === 0 ? null : Math.max(1, num(datos.intentos_max, 1)),
      mostrar_respuestas: !!datos.mostrar_respuestas,
      asignar_nuevos_ingresos: !!datos.asignar_nuevos_ingresos,
      asignacion: { modo, valores: modo === 'todos' ? [] : (datos.asignacion?.valores || []).map(String) },
      recordatorios: {
        automaticos: !!rec.automaticos,
        cada_dias: Math.max(1, num(rec.cada_dias, 3)),
        aviso_dia_antes: !!rec.aviso_dia_antes,
        copia_jefe_directo: !!rec.copia_jefe_directo,
      },
      videos,
      preguntas,
    };
  }

  validarParaPublicar(cap) {
    const errores = [];
    if (!cap.titulo) errores.push('Falta el título.');
    if (cap.modalidad === 'virtual' && cap.videos.length === 0) errores.push('Una capacitación virtual necesita al menos un video.');
    cap.preguntas.forEach((p, i) => {
      if (!p.texto) errores.push(`La pregunta ${i + 1} no tiene texto.`);
      if (p.opciones.length < 2) errores.push(`La pregunta ${i + 1} necesita al menos 2 opciones.`);
      if (!p.opciones.some((o) => o.correcta)) errores.push(`Marca la respuesta correcta de la pregunta ${i + 1}.`);
    });
    if (cap.preguntas.length && (cap.nota_minima < 1 || cap.nota_minima > cap.preguntas.length))
      errores.push(`La nota mínima debe estar entre 1 y ${cap.preguntas.length} (número de preguntas).`);
    if (cap.asignacion.modo !== 'todos' && cap.asignacion.valores.length === 0) errores.push('Elige a quién se asigna la capacitación.');
    if (errores.length) throw new ErrorNegocio(errores.join(' '));
  }

  guardarCapacitacion(uid, capId, datos) {
    if (!capId) {
      const u = this.exigirAdmin(uid);
      const limpio = this.limpiarDatosCapacitacion(datos);
      if (!limpio.titulo) throw new ErrorNegocio('Escribe un título para la capacitación.');
      const cap = { id: this.nuevoId('cap'), ...limpio, estado: 'borrador', creado_por: uid, creado_en: this.marca(), actualizado_en: this.marca() };
      this.db.capacitaciones.push(cap);
      // Quien la crea queda como Propietario automáticamente.
      this.db.responsables.push({ id: this.nuevoId('r'), capacitacion_id: cap.id, usuario_id: uid, rol: 'propietario', agregado_por: uid, agregado_en: this.marca() });
      this.auditar(uid, 'crear_capacitacion', cap.id, `${u.nombre} creó «${cap.titulo}»`);
      for (const r of datos.responsablesNuevos || []) {
        if (r.usuario_id !== uid && this.usuario(r.usuario_id) && PERMISOS[r.rol]) this.agregarResponsable(uid, cap.id, r.usuario_id, r.rol, false);
      }
      this.guardar();
      return cap.id;
    }
    const { cap } = this.exigir(uid, capId, 'editar');
    if (cap.estado === 'cerrada') throw new ErrorNegocio('La capacitación está cerrada. Reábrela para editarla.');
    const limpio = this.limpiarDatosCapacitacion(datos, cap);
    if (!limpio.titulo) throw new ErrorNegocio('Escribe un título para la capacitación.');
    if (cap.estado === 'publicada') this.validarParaPublicar({ ...cap, ...limpio });
    Object.assign(cap, limpio, { actualizado_en: this.marca() });
    this.auditar(uid, 'editar_capacitacion', cap.id, `Editó «${cap.titulo}»`);
    if (cap.estado === 'publicada') this.aplicarAsignacion(cap);
    this.guardar();
    return cap.id;
  }

  cambiarEstado(uid, capId, estado) {
    const { cap } = this.exigir(uid, capId, 'editar');
    if (!['borrador', 'publicada', 'cerrada'].includes(estado)) throw new ErrorNegocio('Estado no válido.');
    if (estado === 'publicada') this.validarParaPublicar(cap);
    if (estado === 'borrador' && this.db.asignaciones.some((a) => a.capacitacion_id === capId))
      throw new ErrorNegocio('Ya tiene personas asignadas; no puede volver a borrador. Puedes cerrarla.');
    const anterior = cap.estado;
    cap.estado = estado;
    cap.actualizado_en = this.marca();
    let nuevos = 0;
    if (estado === 'publicada') nuevos = this.aplicarAsignacion(cap);
    this.auditar(uid, 'cambiar_estado', capId, `Cambió el estado de ${anterior} a ${estado}`);
    this.guardar();
    return { nuevos };
  }

  destinatarios(cap) {
    const { modo, valores } = cap.asignacion;
    return this.db.usuarios.filter((u) => {
      if (!u.activo) return false;
      if (modo === 'todos') return true;
      if (modo === 'personas') return valores.includes(u.id);
      return valores.includes(u[modo]);
    });
  }

  crearAsignacion(cap, usuario, fechaLimite) {
    const a = { id: this.nuevoId('a'), capacitacion_id: cap.id, colaborador_id: usuario.id, fecha_asignacion: this.hoy(), fecha_limite: fechaLimite, intentos_extra: 0, completado_en: null };
    this.db.asignaciones.push(a);
    this.notificar(usuario.id, 'Nueva capacitación asignada', `Tienes asignada «${cap.titulo}». Fecha límite: ${fmtFecha(fechaLimite)}.`, `#/mis-capacitaciones/${a.id}`);
    this.db.recordatorios.push({ id: this.nuevoId('rec'), asignacion_id: a.id, canal: 'correo', tipo: 'asignacion', enviado_por: null, enviado_en: this.marca() });
    return a;
  }

  /** Crea las asignaciones que falten según el criterio. Nunca borra asignaciones existentes (se conserva el historial). */
  aplicarAsignacion(cap) {
    let nuevos = 0;
    for (const u of this.destinatarios(cap)) {
      if (!this.db.asignaciones.some((a) => a.capacitacion_id === cap.id && a.colaborador_id === u.id)) {
        this.crearAsignacion(cap, u, cap.fecha_limite);
        nuevos++;
      }
    }
    return nuevos;
  }

  agregarResponsable(uid, capId, usuarioId, rol, guardar = true) {
    this.exigir(uid, capId, 'responsables');
    if (!PERMISOS[rol]) throw new ErrorNegocio('Rol no válido.');
    const u = this.usuario(usuarioId);
    if (!u) throw new ErrorNegocio('Persona no encontrada.');
    const existente = this.db.responsables.find((r) => r.capacitacion_id === capId && r.usuario_id === usuarioId);
    if (existente) return this.cambiarRolResponsable(uid, capId, usuarioId, rol);
    this.db.responsables.push({ id: this.nuevoId('r'), capacitacion_id: capId, usuario_id: usuarioId, rol, agregado_por: uid, agregado_en: this.marca() });
    this.auditar(uid, 'agregar_responsable', capId, `Agregó a ${u.nombre} como ${rol}`);
    this.notificar(usuarioId, 'Te agregaron como responsable', `Ahora eres ${rol.replace('_', ' ')} de «${this.cap(capId).titulo}».`, `#/capacitaciones/${capId}/seguimiento`);
    if (guardar) this.guardar();
  }

  cambiarRolResponsable(uid, capId, usuarioId, rol) {
    this.exigir(uid, capId, 'responsables');
    if (!PERMISOS[rol]) throw new ErrorNegocio('Rol no válido.');
    const r = this.db.responsables.find((x) => x.capacitacion_id === capId && x.usuario_id === usuarioId);
    if (!r) throw new ErrorNegocio('Esa persona no es responsable.');
    if (r.rol === 'propietario' && rol !== 'propietario' && this.propietarios(capId) === 1)
      throw new ErrorNegocio('Debe quedar al menos un propietario.');
    const antes = r.rol;
    r.rol = rol;
    this.auditar(uid, 'cambiar_rol_responsable', capId, `Cambió a ${this.usuario(usuarioId).nombre} de ${antes} a ${rol}`);
    this.guardar();
  }

  quitarResponsable(uid, capId, usuarioId) {
    this.exigir(uid, capId, 'responsables');
    const r = this.db.responsables.find((x) => x.capacitacion_id === capId && x.usuario_id === usuarioId);
    if (!r) return;
    if (r.rol === 'propietario' && this.propietarios(capId) === 1) throw new ErrorNegocio('Debe quedar al menos un propietario.');
    this.db.responsables = this.db.responsables.filter((x) => x !== r);
    this.auditar(uid, 'quitar_responsable', capId, `Quitó a ${this.usuario(usuarioId).nombre} (${r.rol})`);
    this.guardar();
  }

  propietarios(capId) {
    return this.db.responsables.filter((r) => r.capacitacion_id === capId && r.rol === 'propietario').length;
  }

  historialCambios(uid, capId) {
    this.exigir(uid, capId, 'ver');
    return this.db.auditoria
      .filter((x) => x.capacitacion_id === capId)
      .sort((a, b) => b.fecha.localeCompare(a.fecha))
      .map((x) => ({ ...copia(x), usuario: this.usuario(x.usuario_id)?.nombre || 'Sistema' }));
  }

  // ───────────────────────── seguimiento ─────────────────────────
  ultimoRecordatorio(asigId) {
    return this.db.recordatorios.filter((r) => r.asignacion_id === asigId && r.tipo !== 'asignacion').sort((a, b) => b.enviado_en.localeCompare(a.enviado_en))[0] || null;
  }

  seguimiento(uid, capId) {
    const { cap, rol } = this.exigir(uid, capId, 'ver');
    const filas = this.db.asignaciones
      .filter((a) => a.capacitacion_id === capId)
      .map((a) => {
        const u = this.usuario(a.colaborador_id);
        return {
          asignacion: copia(a),
          colaborador: { id: u.id, nombre: u.nombre, area: u.area, cargo: u.cargo, sede: u.sede, dni: u.dni },
          resumen: this.resumen(a),
          ultimoRecordatorio: copia(this.ultimoRecordatorio(a.id)),
        };
      })
      .sort((x, y) => x.colaborador.nombre.localeCompare(y.colaborador.nombre, 'es'));
    const n = filas.length;
    const notas = filas.filter((f) => f.resumen.mejorNota !== null);
    const cuenta = (...estados) => filas.filter((f) => estados.includes(f.resumen.estado)).length;
    return {
      capacitacion: copia(cap),
      rol,
      permisos: PERMISOS[rol],
      filas,
      kpis: {
        asignados: n,
        vieronVideos: filas.filter((f) => f.resumen.contenidoOk).length,
        respondieron: notas.length,
        notaPromedio: notas.length ? notas.reduce((s, f) => s + f.resumen.mejorNota, 0) / notas.length : null,
        firmaron: cuenta('completado'),
        enCurso: cuenta('en_curso', 'pendiente_firma'),
        noIniciaron: cuenta('no_inicio'),
        faltan: cuenta('en_curso', 'pendiente_firma', 'no_inicio'),
        vencidos: cuenta('vencido'),
      },
      sesiones: this.db.sesiones.filter((s) => s.capacitacion_id === capId).map(copia),
    };
  }

  detallePersona(uid, capId, asigId) {
    const { cap, rol } = this.exigir(uid, capId, 'ver');
    const a = this.db.asignaciones.find((x) => x.id === asigId && x.capacitacion_id === capId);
    if (!a) throw new AccesoDenegado();
    const u = this.usuario(a.colaborador_id);
    const asis = this.db.asistencias.find((x) => x.asignacion_id === a.id) || null;
    const intentos = this.db.intentos
      .filter((i) => i.asignacion_id === a.id)
      .sort((x, y) => x.numero_intento - y.numero_intento)
      .map((i) => ({ ...copia(i), respuestas: this.db.respuestas.filter((r) => r.intento_id === i.id).map(copia) }));
    return {
      capacitacion: copia(cap),
      rol,
      permisos: PERMISOS[rol],
      asignacion: copia(a),
      colaborador: { id: u.id, nombre: u.nombre, correo: u.correo, area: u.area, cargo: u.cargo, sede: u.sede, dni: u.dni, jefe: this.usuario(u.jefe_id)?.nombre || null },
      resumen: this.resumen(a),
      videos: cap.videos.map((v) => ({ ...copia(v), progreso: copia(this.db.progreso.find((p) => p.asignacion_id === a.id && p.video_id === v.id) || null) })),
      intentos,
      asistencia: asis ? { ...copia(asis), firma: this.db.firmas.find((f) => f.id === asis.firma_id)?.imagen || null, sesion: copia(this.db.sesiones.find((s) => s.id === asis.sesion_id) || null) } : null,
      recordatorios: this.db.recordatorios
        .filter((r) => r.asignacion_id === a.id)
        .sort((x, y) => y.enviado_en.localeCompare(x.enviado_en))
        .map((r) => ({ ...copia(r), enviado_por_nombre: r.enviado_por ? this.usuario(r.enviado_por)?.nombre : null })),
    };
  }

  mensajeRecordatorio(a) {
    const u = this.usuario(a.colaborador_id);
    const cap = this.cap(a.capacitacion_id);
    const r = this.resumen(a);
    return `Hola ${u.nombre.split(' ')[0]}, tienes pendiente la capacitación «${cap.titulo}». Fecha límite: ${fmtFecha(a.fecha_limite)}. Te falta: ${r.falta}.`;
  }

  /** Registra el envío (correo + campana del portal). En la integración real aquí se llama al servicio de correo. */
  enviarAviso(a, tipo, enviadoPor, titulo = 'Recordatorio de capacitación') {
    for (const canal of ['correo', 'notificacion_portal'])
      this.db.recordatorios.push({ id: this.nuevoId('rec'), asignacion_id: a.id, canal, tipo, enviado_por: enviadoPor, enviado_en: this.marca() });
    this.notificar(a.colaborador_id, titulo, this.mensajeRecordatorio(a), `#/mis-capacitaciones/${a.id}`);
  }

  enviarRecordatorios(uid, capId, asigIds) {
    this.exigir(uid, capId, 'recordar');
    const hoy = this.hoy();
    let enviados = 0;
    let omitidos = 0;
    for (const id of asigIds) {
      const a = this.db.asignaciones.find((x) => x.id === id && x.capacitacion_id === capId);
      if (!a) continue;
      const yaHoy = this.db.recordatorios.some((r) => r.asignacion_id === a.id && r.tipo === 'manual' && r.enviado_en.startsWith(hoy));
      if (this.resumen(a).firmado || yaHoy) {
        omitidos++;
        continue;
      }
      this.enviarAviso(a, 'manual', uid);
      enviados++;
    }
    if (enviados) this.auditar(uid, 'enviar_recordatorio', capId, `Envió ${enviados} recordatorio(s)`);
    this.guardar();
    return { enviados, omitidos };
  }

  configurarRecordatoriosAutomaticos(uid, capId, activos) {
    const { cap } = this.exigir(uid, capId, 'editar');
    cap.recordatorios.automaticos = !!activos;
    this.auditar(uid, 'recordatorios_automaticos', capId, `${activos ? 'Activó' : 'Desactivó'} los recordatorios automáticos`);
    this.guardar();
  }

  habilitarIntento(uid, capId, asigId) {
    this.exigir(uid, capId, 'editar');
    const a = this.db.asignaciones.find((x) => x.id === asigId && x.capacitacion_id === capId);
    if (!a) throw new AccesoDenegado();
    a.intentos_extra = (a.intentos_extra || 0) + 1;
    this.auditar(uid, 'habilitar_intento', capId, `Habilitó un intento extra a ${this.usuario(a.colaborador_id).nombre}`);
    this.notificar(a.colaborador_id, 'Nuevo intento habilitado', `RR.HH. te habilitó un nuevo intento en «${this.cap(capId).titulo}».`, `#/mis-capacitaciones/${a.id}`);
    this.guardar();
  }

  cambiarFechaLimitePersona(uid, capId, asigId, fecha) {
    this.exigir(uid, capId, 'editar');
    const a = this.db.asignaciones.find((x) => x.id === asigId && x.capacitacion_id === capId);
    if (!a) throw new AccesoDenegado();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha || '')) throw new ErrorNegocio('Fecha no válida.');
    const antes = a.fecha_limite;
    a.fecha_limite = fecha;
    this.auditar(uid, 'cambiar_fecha_limite', capId, `Cambió la fecha límite de ${this.usuario(a.colaborador_id).nombre} de ${antes} a ${fecha}`);
    this.guardar();
  }

  marcarAsistenciaManual(uid, capId, asigId) {
    this.exigir(uid, capId, 'editar');
    const a = this.db.asignaciones.find((x) => x.id === asigId && x.capacitacion_id === capId);
    if (!a) throw new AccesoDenegado();
    let asis = this.db.asistencias.find((x) => x.asignacion_id === a.id);
    if (asis && asis.tipo !== 'virtual') return;
    if (!asis) {
      asis = { id: this.nuevoId('as'), asignacion_id: a.id, firma_id: null, firmado_en: null };
      this.db.asistencias.push(asis);
    }
    Object.assign(asis, { sesion_id: null, tipo: 'presencial_manual', registrado_en: this.marca(), dispositivo: `Registrado por ${this.usuario(uid).nombre}` });
    this.auditar(uid, 'asistencia_manual', capId, `Marcó asistencia manual de ${this.usuario(a.colaborador_id).nombre}`);
    this.notificar(a.colaborador_id, 'Asistencia registrada', `RR.HH. registró tu asistencia a «${this.cap(capId).titulo}». Ingresa para completar y firmar.`, `#/mis-capacitaciones/${a.id}`);
    this.guardar();
  }

  // ───────────────────────── sesiones presenciales (QR) ─────────────────────────
  crearSesion(uid, capId, { lugar = '', minutos = 60 } = {}) {
    const { cap } = this.exigir(uid, capId, 'editar');
    if (cap.modalidad === 'virtual') throw new ErrorNegocio('Solo las capacitaciones presenciales o mixtas usan QR.');
    if (cap.estado !== 'publicada') throw new ErrorNegocio('Publica la capacitación antes de generar el QR.');
    const ahora = this.ahora();
    const fin = new Date(ahora.getTime() + Math.max(5, Math.min(480, Number(minutos) || 60)) * 60000);
    const hhmm = (d) => fechaHoraISO(d).slice(11, 16);
    const token = globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36);
    const s = { id: this.nuevoId('s'), capacitacion_id: capId, fecha: this.hoy(), hora_inicio: hhmm(ahora), hora_fin: hhmm(fin), lugar: String(lugar || cap.lugar).slice(0, 200), token_qr: token, qr_expira_en: fechaHoraISO(fin), creado_por: uid };
    this.db.sesiones.push(s);
    this.auditar(uid, 'crear_sesion_qr', capId, `Generó QR de asistencia (${s.hora_inicio}–${s.hora_fin})`);
    this.guardar();
    return copia(s);
  }

  estadoSesion(uid, capId, sesionId) {
    const { cap } = this.exigir(uid, capId, 'ver');
    const s = this.db.sesiones.find((x) => x.id === sesionId && x.capacitacion_id === capId);
    if (!s) throw new AccesoDenegado();
    const asistentes = this.db.asistencias
      .filter((x) => x.sesion_id === s.id)
      .map((x) => {
        const a = this.db.asignaciones.find((y) => y.id === x.asignacion_id);
        return { nombre: this.usuario(a.colaborador_id).nombre, area: this.usuario(a.colaborador_id).area, registrado_en: x.registrado_en, firmado: !!x.firmado_en };
      })
      .sort((a, b) => b.registrado_en.localeCompare(a.registrado_en));
    return { sesion: copia(s), capacitacion: { id: cap.id, titulo: cap.titulo }, vigente: this.marca() <= s.qr_expira_en, asistentes, asignados: this.db.asignaciones.filter((a) => a.capacitacion_id === capId).length };
  }

  cerrarSesion(uid, capId, sesionId) {
    this.exigir(uid, capId, 'editar');
    const s = this.db.sesiones.find((x) => x.id === sesionId && x.capacitacion_id === capId);
    if (!s) throw new AccesoDenegado();
    s.qr_expira_en = this.marca();
    this.auditar(uid, 'cerrar_sesion_qr', capId, 'Cerró la sesión de QR');
    this.guardar();
  }

  // ───────────────────────── registro de asistencia y exportación ─────────────────────────
  datosRegistro(uid, capId) {
    const { cap } = this.exigir(uid, capId, 'registro');
    const seg = this.seguimiento(uid, capId);
    const filas = seg.filas
      .filter((f) => f.resumen.firmado)
      .map((f) => {
        const asis = this.db.asistencias.find((x) => x.asignacion_id === f.asignacion.id);
        return { ...f, asistencia: copia(asis), firma: this.db.firmas.find((x) => x.id === asis.firma_id)?.imagen || null, sesion: copia(this.db.sesiones.find((s) => s.id === asis.sesion_id) || null) };
      })
      .sort((a, b) => a.asistencia.firmado_en.localeCompare(b.asistencia.firmado_en));
    const anio = cap.creado_en.slice(0, 4);
    this.auditar(uid, 'descargar_registro', capId, 'Generó el registro de asistencia');
    this.guardar();
    return {
      capacitacion: copia(cap),
      codigo: `REG-CAP-${anio}-${cap.id.replace(/\D/g, '').padStart(4, '0')}`,
      generado_en: this.marca(),
      generado_por: this.usuario(uid).nombre,
      filas,
      pendientes: seg.filas.length - filas.length,
    };
  }

  datosExportacion(uid, capId) {
    const seg = this.seguimiento(uid, capId);
    this.exigir(uid, capId, 'registro');
    this.auditar(uid, 'exportar_excel', capId, 'Exportó el seguimiento a Excel');
    this.guardar();
    return seg;
  }

  // ───────────────────────── colaboradores / nuevos ingresos ─────────────────────────
  registrarNuevoIngreso(uid, datos) {
    const admin = this.exigirAdmin(uid);
    const nombre = String(datos.nombre || '').trim().slice(0, 120);
    if (!nombre) throw new ErrorNegocio('Escribe el nombre de la persona.');
    const u = {
      id: this.nuevoId('c'),
      nombre,
      correo: String(datos.correo || '').trim().slice(0, 120),
      rol: 'colaborador',
      area: String(datos.area || '').trim() || 'Sin área',
      cargo: String(datos.cargo || '').trim() || 'Sin cargo',
      sede: String(datos.sede || '').trim() || 'Lima',
      dni: String(datos.dni || '').trim().slice(0, 20),
      jefe_id: datos.jefe_id || null,
      ingreso: this.hoy(),
      activo: true,
      firma_id: null,
    };
    this.db.usuarios.push(u);
    const asignadas = [];
    for (const cap of this.db.capacitaciones) {
      if (cap.estado === 'publicada' && cap.asignar_nuevos_ingresos) {
        this.crearAsignacion(cap, u, sumarDias(this.hoy(), cap.dias_para_completar || 7));
        asignadas.push(cap.titulo);
      }
    }
    this.auditar(uid, 'nuevo_ingreso', null, `${admin.nombre} registró a ${u.nombre}`);
    this.guardar();
    return { usuario: copia(u), asignadas };
  }

  // ───────────────────────── tarea programada (recordatorios automáticos) ─────────────────────────
  /** Se ejecuta una vez al día (en producción: cron / job diario). docs/RECORDATORIOS.md */
  ejecutarRecordatoriosAutomaticos({ forzar = false } = {}) {
    const hoy = this.hoy();
    if (!forzar && this.db.ultimoJob === hoy) return { enviados: 0, yaEjecutado: true };
    let enviados = 0;
    for (const cap of this.db.capacitaciones) {
      if (cap.estado !== 'publicada' || !cap.recordatorios?.automaticos) continue;
      const vencidosHoy = [];
      for (const a of this.db.asignaciones.filter((x) => x.capacitacion_id === cap.id)) {
        const r = this.resumen(a);
        if (r.firmado) continue; // no se avisa a quien ya completó
        const recs = this.db.recordatorios.filter((x) => x.asignacion_id === a.id);
        const autoHoy = recs.some((x) => x.enviado_por === null && x.tipo !== 'asignacion' && x.enviado_en.startsWith(hoy));
        if (autoHoy) continue; // máximo 1 aviso automático por día y persona
        const faltan = diasEntre(hoy, a.fecha_limite);
        const ultimo = recs.map((x) => x.enviado_en).sort().pop();
        if (faltan < 0) {
          if (!recs.some((x) => x.tipo === 'vencimiento')) {
            this.enviarAviso(a, 'vencimiento', null, 'Capacitación vencida');
            vencidosHoy.push(this.usuario(a.colaborador_id).nombre);
            enviados++;
          }
        } else if (faltan === 1 && cap.recordatorios.aviso_dia_antes) {
          if (!recs.some((x) => x.tipo === 'dia_antes')) {
            this.enviarAviso(a, 'dia_antes', null, 'Tu capacitación vence mañana');
            enviados++;
            const jefe = this.usuario(this.usuario(a.colaborador_id).jefe_id);
            if (cap.recordatorios.copia_jefe_directo && jefe) {
              this.db.recordatorios.push({ id: this.nuevoId('rec'), asignacion_id: a.id, canal: 'correo', tipo: 'copia_jefe', enviado_por: null, enviado_en: this.marca() });
              this.notificar(jefe.id, 'Capacitación pendiente de tu equipo', `${this.usuario(a.colaborador_id).nombre} aún no completa «${cap.titulo}» (vence mañana).`, '#/mis-capacitaciones');
            }
          }
        } else if (!ultimo || diasEntre(ultimo, hoy) >= cap.recordatorios.cada_dias) {
          this.enviarAviso(a, 'automatico', null);
          enviados++;
        }
      }
      if (vencidosHoy.length) {
        for (const resp of this.db.responsables.filter((x) => x.capacitacion_id === cap.id)) {
          this.notificar(resp.usuario_id, 'Capacitaciones vencidas', `En «${cap.titulo}» vencieron: ${vencidosHoy.join(', ')}.`, `#/capacitaciones/${cap.id}/seguimiento`);
        }
      }
    }
    this.db.ultimoJob = hoy;
    this.guardar();
    return { enviados };
  }
}
