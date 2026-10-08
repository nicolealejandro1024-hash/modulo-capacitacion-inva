// "Backend" del módulo de Capacitaciones.
// Toda la lógica de negocio y TODOS los controles de permisos viven aquí (docs/PERMISOS.md):
// las pantallas solo llaman a estos métodos, nunca leen la base de datos directamente.
// En esta versión los datos se guardan en el navegador (localStorage); al integrarlo al Portal INVA
// estos métodos se convierten en endpoints del servidor con la misma lógica.
import { crearSemilla } from './seed.js';
import { fechaISO, fechaHoraISO, sumarDias, diasEntre, fmtFecha } from './util.js';
import { emparejar } from './teams.js';

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
  constructor({ storage = null, clave = 'inva-capacitaciones-v2', ahora = () => new Date() } = {}) {
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
    this.db.consultas ||= []; // datos guardados antes de existir las preguntas
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
    // Reunión en vivo por Teams: la gente entra directo desde Teams (el portal no registra el ingreso).
    // Con cuestionario: se habilita al empezar la reunión. Sin cuestionario: la asistencia la marca RR.HH.
    const reuniones = cap.reuniones || [];
    const reunionIniciada = reuniones.some((x) => `${x.fecha}T${x.hora_inicio}:00` <= this.marca());
    const intentos = this.db.intentos.filter((i) => i.asignacion_id === a.id).sort((x, y) => x.numero_intento - y.numero_intento);
    const aprobado = intentos.some((i) => i.aprobado);
    const mejorNota = intentos.length ? Math.max(...intentos.map((i) => i.nota)) : null;
    const tieneCuestionario = cap.preguntas.length > 0;
    const enVivo = cap.modalidad === 'en_vivo';
    const grabacionOk = cap.videos.length > 0 && videosOk;
    const contenidoOk =
      cap.modalidad === 'virtual'
        ? videosOk
        : cap.modalidad === 'presencial'
          ? presencialOk
          : enVivo
            ? tieneCuestionario
              ? reunionIniciada || presencialOk || grabacionOk
              : presencialOk || grabacionOk
            : videosOk || presencialOk;
    const cuestionarioOk = !tieneCuestionario || aprobado;
    const requiereFirma = !enVivo || !!cap.pedir_firma;
    const firmado = !!asis?.firmado_en;
    const completado = firmado || (!requiereFirma && contenidoOk && cuestionarioOk);
    let completadoEn = null;
    if (firmado) completadoEn = asis.firmado_en;
    else if (completado)
      completadoEn = tieneCuestionario ? intentos.find((i) => i.aprobado).enviado_en : asis?.registrado_en || prog.map((p) => p.terminado_en).filter(Boolean).sort().pop() || null;
    const intentosPermitidos = cap.intentos_max ? cap.intentos_max + (a.intentos_extra || 0) : null;
    const intentosRestantes = intentosPermitidos === null ? null : Math.max(0, intentosPermitidos - intentos.length);
    const vencido = !completado && this.hoy() > a.fecha_limite;
    const empezo = prog.length > 0 || intentos.length > 0 || !!asis;

    let estado = 'no_inicio';
    if (completado) estado = 'completado';
    else if (vencido) estado = 'vencido';
    else if (contenidoOk && cuestionarioOk) estado = 'pendiente_firma';
    else if (empezo) estado = 'en_curso';

    const unidadUnica = cap.modalidad === 'presencial' || enVivo;
    const nCont = unidadUnica ? 1 : Math.max(1, cap.videos.length);
    const hechoCont = contenidoOk ? nCont : unidadUnica ? 0 : videosVistos;
    const total = nCont + (tieneCuestionario ? 1 : 0) + (requiereFirma ? 1 : 0);
    const hecho = hechoCont + (tieneCuestionario && aprobado ? 1 : 0) + (requiereFirma && firmado ? 1 : 0);

    // Lo que le falta hacer a la persona (null = no tiene nada que hacer en el portal).
    let falta = null;
    if (completado) falta = null;
    else if (!contenidoOk) falta = cap.modalidad === 'presencial' ? null : enVivo ? (tieneCuestionario ? 'responder el cuestionario después de la reunión' : null) : 'ver los videos';
    else if (!cuestionarioOk) falta = 'responder el cuestionario';
    else if (!firmado) falta = 'firmar tu asistencia';

    return {
      estado,
      porcentaje: Math.round((hecho / total) * 100),
      videosVistos,
      totalVideos: cap.videos.length,
      videosOk,
      presencialOk,
      reunionIniciada,
      requiereFirma,
      completado,
      completadoEn,
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
      fueraDePlazo: completado && !!completadoEn && completadoEn.slice(0, 10) > a.fecha_limite,
      falta,
      requiereAccion: falta !== null,
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
    if (!r.contenidoOk)
      throw new ErrorNegocio(cap.modalidad === 'presencial' ? 'El cuestionario se habilita cuando RR.HH. registre tu asistencia.' : cap.modalidad === 'en_vivo' ? 'El cuestionario se habilita cuando empieza la reunión.' : 'Primero termina todos los videos.');
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
    if (!r.requiereFirma) throw new ErrorNegocio('Esta capacitación no pide firma.');
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
      modalidad: ['virtual', 'en_vivo', 'presencial', 'mixta'].includes(datos.modalidad) ? datos.modalidad : 'virtual',
      pedir_firma: !!datos.pedir_firma,
      reuniones: (datos.reuniones || []).map((r) => ({
        id: r.id || this.nuevoId('reu'),
        fecha: /^\d{4}-\d{2}-\d{2}$/.test(r.fecha || '') ? r.fecha : this.hoy(),
        hora_inicio: /^\d{2}:\d{2}$/.test(r.hora_inicio || '') ? r.hora_inicio : '09:00',
        hora_fin: /^\d{2}:\d{2}$/.test(r.hora_fin || '') ? r.hora_fin : '10:00',
        enlace: txt(r.enlace, 1000),
      })),
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
    if (cap.modalidad === 'en_vivo') {
      const reus = cap.reuniones || [];
      if (!reus.length) errores.push('Agrega la fecha y hora de la reunión de Teams.');
      reus.forEach((r, i) => {
        if (r.enlace && !/^https:\/\//.test(r.enlace)) errores.push(`El enlace de la reunión ${i + 1} debe empezar con https://`);
        if (r.hora_fin <= r.hora_inicio) errores.push(`La hora de fin de la reunión ${i + 1} debe ser posterior a la de inicio.`);
      });
    }
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
        asistenciaRegistrada: filas.filter((f) => f.resumen.presencialOk).length,
        respondieron: notas.length,
        notaPromedio: notas.length ? notas.reduce((s, f) => s + f.resumen.mejorNota, 0) / notas.length : null,
        firmaron: cuenta('completado'),
        enCurso: cuenta('en_curso', 'pendiente_firma'),
        noIniciaron: cuenta('no_inicio'),
        faltan: cuenta('en_curso', 'pendiente_firma', 'no_inicio'),
        vencidos: cuenta('vencido'),
      },
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
      asistencia: asis
        ? {
            ...copia(asis),
            firma: this.db.firmas.find((f) => f.id === asis.firma_id)?.imagen || null,
            reunion: copia((cap.reuniones || []).find((r) => r.id === asis.sesion_id) || null),
          }
        : null,
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
      if (!this.resumen(a).requiereAccion || yaHoy) {
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
    return this.registrarAsistencias(uid, capId, [asigId]);
  }

  /** RR.HH. marca la asistencia (p. ej. después de una reunión de Teams, o a quien no tenía celular). */
  registrarAsistencias(uid, capId, asigIds) {
    const { cap } = this.exigir(uid, capId, 'editar');
    let marcados = 0;
    for (const asigId of asigIds) {
      const a = this.db.asignaciones.find((x) => x.id === asigId && x.capacitacion_id === capId);
      if (!a) throw new AccesoDenegado();
      let asis = this.db.asistencias.find((x) => x.asignacion_id === a.id);
      if (asis && asis.tipo !== 'virtual') continue;
      if (!asis) {
        asis = { id: this.nuevoId('as'), asignacion_id: a.id, firma_id: null, firmado_en: null };
        this.db.asistencias.push(asis);
      }
      Object.assign(asis, { sesion_id: null, tipo: 'presencial_manual', registrado_en: this.marca(), dispositivo: `Registrado por ${this.usuario(uid).nombre}` });
      marcados++;
      const r = this.resumen(a);
      this.notificar(
        a.colaborador_id,
        'Asistencia registrada',
        r.requiereAccion ? `RR.HH. registró tu asistencia a «${cap.titulo}». Te falta ${r.falta}.` : `RR.HH. registró tu asistencia a «${cap.titulo}». ¡Listo!`,
        `#/mis-capacitaciones/${a.id}`
      );
    }
    if (marcados) this.auditar(uid, 'asistencia_manual', capId, `Registró la asistencia de ${marcados} persona(s)`);
    this.guardar();
    return { marcados };
  }

  /**
   * Compara los participantes del informe de Teams con los asignados (no registra nada).
   * participantes: [{ nombre, correo, ingreso, duracion }] (ver src/teams.js)
   */
  previsualizarTeams(uid, capId, participantes) {
    this.exigir(uid, capId, 'editar');
    const asignaciones = this.db.asignaciones.filter((a) => a.capacitacion_id === capId);
    const usuarios = this.db.usuarios.filter((u) => u.activo);
    const res = { registrar: [], yaRegistrados: [], noAsignados: [], noReconocidos: [] };
    const vistos = new Set();
    for (const p of participantes || []) {
      const m = emparejar(p, usuarios);
      if (!m) {
        res.noReconocidos.push(p);
        continue;
      }
      if (vistos.has(m.usuario.id)) continue;
      vistos.add(m.usuario.id);
      const a = asignaciones.find((x) => x.colaborador_id === m.usuario.id);
      const item = { participante: p, por: m.por, usuario: { id: m.usuario.id, nombre: m.usuario.nombre, area: m.usuario.area }, asignacionId: a?.id || null };
      if (!a) res.noAsignados.push(item);
      else if (this.resumen(a).presencialOk) res.yaRegistrados.push(item);
      else res.registrar.push(item);
    }
    // Personas asignadas que aún no tienen asistencia (para elegir a mano a un no reconocido).
    res.pendientes = asignaciones
      .filter((a) => !this.resumen(a).presencialOk && !res.registrar.some((x) => x.asignacionId === a.id))
      .map((a) => ({ asignacionId: a.id, nombre: this.usuario(a.colaborador_id).nombre }))
      .sort((x, y) => x.nombre.localeCompare(y.nombre, 'es'));
    return res;
  }

  /** Registra la asistencia según el informe de Teams. items: [{ asignacionId, ingreso, duracion, nombreTeams }] */
  registrarDesdeTeams(uid, capId, items, nombreArchivo = '') {
    const { cap } = this.exigir(uid, capId, 'editar');
    let marcados = 0;
    for (const it of items || []) {
      const a = this.db.asignaciones.find((x) => x.id === it.asignacionId && x.capacitacion_id === capId);
      if (!a) throw new AccesoDenegado();
      let asis = this.db.asistencias.find((x) => x.asignacion_id === a.id);
      if (asis && asis.tipo !== 'virtual') continue;
      if (!asis) {
        asis = { id: this.nuevoId('as'), asignacion_id: a.id, firma_id: null, firmado_en: null };
        this.db.asistencias.push(asis);
      }
      const detalle = [it.nombreTeams && `Teams: ${it.nombreTeams}`, it.ingreso && `ingreso ${it.ingreso}`, it.duracion && `duración ${it.duracion}`].filter(Boolean).join(' · ');
      Object.assign(asis, { sesion_id: null, tipo: 'teams', registrado_en: this.marca(), dispositivo: String(detalle).slice(0, 200) });
      marcados++;
      const r = this.resumen(a);
      this.notificar(a.colaborador_id, 'Asistencia registrada', r.requiereAccion ? `Se registró tu asistencia a «${cap.titulo}». Te falta ${r.falta}.` : `Se registró tu asistencia a «${cap.titulo}». ¡Listo!`, `#/mis-capacitaciones/${a.id}`);
    }
    if (marcados) this.auditar(uid, 'asistencia_teams', capId, `Registró ${marcados} asistencia(s) desde la lista de Teams${nombreArchivo ? ` (${String(nombreArchivo).slice(0, 80)})` : ''}`);
    this.guardar();
    return { marcados };
  }

  quitarAsistencia(uid, capId, asigId) {
    this.exigir(uid, capId, 'editar');
    const a = this.db.asignaciones.find((x) => x.id === asigId && x.capacitacion_id === capId);
    if (!a) throw new AccesoDenegado();
    const asis = this.db.asistencias.find((x) => x.asignacion_id === a.id);
    if (!asis || !['presencial_manual', 'teams'].includes(asis.tipo) || asis.firmado_en) throw new ErrorNegocio('Solo se puede quitar una asistencia marcada por RR.HH. y sin firma.');
    this.db.asistencias = this.db.asistencias.filter((x) => x !== asis);
    this.auditar(uid, 'quitar_asistencia', capId, `Quitó la asistencia de ${this.usuario(a.colaborador_id).nombre}`);
    this.guardar();
  }

  // ───────────────────────── registro de asistencia y exportación ─────────────────────────
  datosRegistro(uid, capId) {
    const { cap } = this.exigir(uid, capId, 'registro');
    const seg = this.seguimiento(uid, capId);
    const filas = seg.filas
      .filter((f) => f.resumen.completado)
      .map((f) => {
        const asis = this.db.asistencias.find((x) => x.asignacion_id === f.asignacion.id) || null;
        return {
          ...f,
          asistencia: copia(asis),
          firma: asis ? this.db.firmas.find((x) => x.id === asis.firma_id)?.imagen || null : null,
        };
      })
      .sort((a, b) => a.resumen.completadoEn.localeCompare(b.resumen.completadoEn));
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

  // ───────────────────────── preguntas de los colaboradores ─────────────────────────
  consultaConNombres(q) {
    return { ...copia(q), autor: this.usuario(q.usuario_id)?.nombre || '', respondido_por_nombre: q.respondido_por ? this.usuario(q.respondido_por)?.nombre : null };
  }

  /** El colaborador ve solo sus propias preguntas de esa capacitación. */
  misConsultas(uid, asigId) {
    const { a } = this.miAsignacion(uid, asigId);
    return this.db.consultas.filter((q) => q.asignacion_id === a.id).sort((x, y) => y.creado_en.localeCompare(x.creado_en)).map((q) => this.consultaConNombres(q));
  }

  enviarConsulta(uid, asigId, texto) {
    const { a, cap } = this.miAsignacion(uid, asigId);
    texto = String(texto || '').trim().slice(0, 1000);
    if (!texto) throw new ErrorNegocio('Escribe tu pregunta.');
    const q = { id: this.nuevoId('q'), capacitacion_id: cap.id, asignacion_id: a.id, usuario_id: uid, texto, creado_en: this.marca(), respuesta: null, respondido_por: null, respondido_en: null };
    this.db.consultas.push(q);
    const autor = this.usuario(uid).nombre;
    // Avisa a los responsables que pueden responder (propietarios y editores).
    for (const r of this.db.responsables.filter((x) => x.capacitacion_id === cap.id && PERMISOS[x.rol].recordar))
      this.notificar(r.usuario_id, 'Nueva pregunta de un colaborador', `${autor} preguntó en «${cap.titulo}»: «${texto.slice(0, 120)}»`, `#/capacitaciones/${cap.id}/seguimiento`);
    this.auditar(uid, 'enviar_pregunta', cap.id, `${autor} envió una pregunta`);
    this.guardar();
    return this.consultaConNombres(q);
  }

  consultasCapacitacion(uid, capId) {
    this.exigir(uid, capId, 'ver');
    return this.db.consultas
      .filter((q) => q.capacitacion_id === capId)
      .sort((x, y) => (!!x.respuesta === !!y.respuesta ? y.creado_en.localeCompare(x.creado_en) : x.respuesta ? 1 : -1))
      .map((q) => this.consultaConNombres(q));
  }

  responderConsulta(uid, capId, consultaId, texto) {
    const { cap } = this.exigir(uid, capId, 'recordar');
    const q = this.db.consultas.find((x) => x.id === consultaId && x.capacitacion_id === capId);
    if (!q) throw new AccesoDenegado();
    texto = String(texto || '').trim().slice(0, 2000);
    if (!texto) throw new ErrorNegocio('Escribe la respuesta.');
    q.respuesta = texto;
    q.respondido_por = uid;
    q.respondido_en = this.marca();
    this.notificar(q.usuario_id, 'Respondieron tu pregunta', `En «${cap.titulo}»: «${texto.slice(0, 120)}»`, `#/mis-capacitaciones/${q.asignacion_id}`);
    this.auditar(uid, 'responder_pregunta', capId, `Respondió la pregunta de ${this.usuario(q.usuario_id).nombre}`);
    this.guardar();
    return true;
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
        // No se avisa a quien ya completó ni a quien no tiene nada que hacer en el portal
        // (p. ej. reunión de Teams sin cuestionario: la asistencia la marca RR.HH.).
        if (!r.requiereAccion) continue;
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
