// Pruebas de reglas de negocio y permisos. Ejecutar con: npm test  (o: node --test tests/)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Api, AccesoDenegado, ErrorNegocio } from '../src/api.js';

const nuevaApi = () => new Api({ ahora: () => new Date('2026-10-07T10:00:00') });

test('un RR.HH. que no es responsable NO ve el seguimiento ni la lista', () => {
  const api = nuevaApi();
  // Nicole (u1) no es responsable de "Inducción HC" (cap3).
  assert.throws(() => api.seguimiento('u1', 'cap3'), AccesoDenegado);
  assert.throws(() => api.datosRegistro('u1', 'cap3'), AccesoDenegado);
  assert.throws(() => api.enviarRecordatorios('u1', 'cap3', ['a1']), AccesoDenegado);
  assert.ok(!api.listarCapacitacionesAdmin('u1').some((x) => x.capacitacion.id === 'cap3'));
  // Jorge (u3), jefe de RR.HH., tampoco ve la Inducción INVA (cap1).
  assert.throws(() => api.seguimiento('u3', 'cap1'), AccesoDenegado);
  // El intento queda en auditoría.
  assert.ok(api.db.auditoria.some((x) => x.accion === 'acceso_denegado' && x.usuario_id === 'u3'));
});

test('roles: solo lectura ve y descarga, pero no envía recordatorios ni edita', () => {
  const api = nuevaApi();
  // Renzo (c7) es solo lectura de la Charla SST (cap2).
  assert.ok(api.seguimiento('c7', 'cap2').filas.length > 0);
  assert.ok(api.datosRegistro('c7', 'cap2'));
  assert.throws(() => api.enviarRecordatorios('c7', 'cap2', []), AccesoDenegado);
  assert.throws(() => api.guardarCapacitacion('c7', 'cap2', { titulo: 'x' }), AccesoDenegado);
  assert.throws(() => api.crearSesion('c7', 'cap2', {}), AccesoDenegado);
});

test('editor edita pero no gestiona responsables; debe quedar un propietario', () => {
  const api = nuevaApi();
  assert.throws(() => api.agregarResponsable('u2', 'cap1', 'u4', 'editor'), AccesoDenegado);
  assert.throws(() => api.quitarResponsable('u1', 'cap1', 'u1'), ErrorNegocio);
  api.agregarResponsable('u1', 'cap1', 'u4', 'propietario');
  api.quitarResponsable('u1', 'cap1', 'u1');
  assert.throws(() => api.seguimiento('u1', 'cap1'), AccesoDenegado);
  assert.ok(api.seguimiento('u4', 'cap1'));
});

test('el creador queda como propietario y el dashboard solo cuenta lo suyo', () => {
  const api = nuevaApi();
  const id = api.guardarCapacitacion('u4', null, { titulo: 'Nueva', videos: [{ titulo: 'v', duracion_seg: 30 }] });
  assert.equal(api.rolEn('u4', id), 'propietario');
  assert.throws(() => api.guardarCapacitacion('c1', null, { titulo: 'x' }), AccesoDenegado);
  const dashNicole = api.dashboard('u1');
  assert.ok(dashNicole.capacitaciones.every((x) => api.rolEn('u1', x.capacitacion.id)));
});

test('colaborador solo ve sus asignaciones', () => {
  const api = nuevaApi();
  const ajena = api.db.asignaciones.find((a) => a.colaborador_id !== 'c4');
  assert.throws(() => api.miCapacitacion('c4', ajena.id), AccesoDenegado);
  assert.ok(api.misCapacitaciones('c4').every((x) => x.asignacion.colaborador_id === 'c4'));
  // Las respuestas correctas no se envían al colaborador.
  const vista = api.misCapacitaciones('c4')[0].capacitacion;
  assert.ok(vista.preguntas.every((p) => p.opciones.every((o) => typeof o === 'string')));
});

test('flujo completo virtual: no se puede adelantar, cuestionario, firma', () => {
  const api = nuevaApi();
  const a = api.db.asignaciones.find((x) => x.colaborador_id === 'u1' && x.capacitacion_id === 'cap1');
  // No puede ver el video 2 sin terminar el 1.
  assert.throws(() => api.registrarProgresoVideo('u1', a.id, 'v2', 5), ErrorNegocio);
  // Saltar al final se ignora.
  assert.equal(api.registrarProgresoVideo('u1', a.id, 'v1', 260).segundos_vistos_max, 0);
  // No puede responder antes de ver los videos.
  assert.throws(() => api.enviarCuestionario('u1', a.id, { p1: 1, p2: 1, p3: 1 }), ErrorNegocio);
  for (const v of api.cap('cap1').videos) {
    for (let s = 0; s <= v.duracion_seg; s += 15) api.registrarProgresoVideo('u1', a.id, v.id, s);
    api.registrarProgresoVideo('u1', a.id, v.id, v.duracion_seg);
  }
  assert.equal(api.resumen(a).videosOk, true);
  // Falla, luego aprueba.
  let r = api.enviarCuestionario('u1', a.id, { p1: 0, p2: 0, p3: 1 });
  assert.equal(r.resumen.aprobado, false);
  assert.equal(r.resumen.intentosRestantes, 2);
  assert.throws(() => api.firmarAsistencia('u1', a.id, { imagen: 'data:image/png;base64,x', aceptaDeclaracion: true }), ErrorNegocio);
  r = api.enviarCuestionario('u1', a.id, { p1: 1, p2: 1, p3: 1 });
  assert.equal(r.resumen.estado, 'pendiente_firma');
  r = api.firmarAsistencia('u1', a.id, { imagen: 'data:image/png;base64,x', aceptaDeclaracion: true });
  assert.equal(r.resumen.estado, 'completado');
  assert.ok(api.usuario('u1').firma_id, 'se guarda como Mi Firma');
});

test('intentos agotados y habilitar intento extra', () => {
  const api = nuevaApi();
  const a = api.db.asignaciones.find((x) => x.colaborador_id === 'c2' && x.capacitacion_id === 'cap1');
  // c2 ya tiene 1 intento (2/3) aprobado en la semilla → pendiente de firma.
  assert.equal(api.resumen(a).estado, 'pendiente_firma');
  const b = api.db.asignaciones.find((x) => x.colaborador_id === 'c7' && x.capacitacion_id === 'cap2');
  api.enviarCuestionario('c7', b.id, { p4: 0, p5: 0 });
  api.enviarCuestionario('c7', b.id, { p4: 0, p5: 0 });
  assert.equal(api.resumen(b).sinIntentos, true);
  assert.throws(() => api.enviarCuestionario('c7', b.id, { p4: 1, p5: 1 }), ErrorNegocio);
  api.habilitarIntento('u1', 'cap2', b.id);
  assert.equal(api.enviarCuestionario('c7', b.id, { p4: 1, p5: 1 }).resumen.aprobado, true);
});

test('QR presencial: vigencia y asignación', () => {
  const api = nuevaApi();
  const s = api.crearSesion('u1', 'cap2', { minutos: 30 });
  // c4 está asignada a cap2.
  const asigId = api.confirmarAsistenciaQR('c4', s.token_qr);
  assert.equal(api.miCapacitacion('c4', asigId).resumen.presencialOk, true);
  // c1 no está asignado.
  assert.throws(() => api.confirmarAsistenciaQR('c1', s.token_qr), ErrorNegocio);
  api.cerrarSesion('u1', 'cap2', s.id);
  api.db.desfaseDias = 1;
  assert.throws(() => api.confirmarAsistenciaQR('c3', s.token_qr), ErrorNegocio);
});

test('recordatorios: manual 1 por día, no a completados; automáticos 1 por día', () => {
  const api = nuevaApi();
  const pend = api.db.asignaciones.find((x) => x.colaborador_id === 'c4' && x.capacitacion_id === 'cap1');
  const comp = api.db.asignaciones.find((x) => x.colaborador_id === 'c1' && x.capacitacion_id === 'cap1');
  assert.deepEqual(api.enviarRecordatorios('u1', 'cap1', [pend.id, comp.id]), { enviados: 1, omitidos: 1 });
  assert.deepEqual(api.enviarRecordatorios('u1', 'cap1', [pend.id]), { enviados: 0, omitidos: 1 });
  const r1 = api.ejecutarRecordatoriosAutomaticos();
  assert.ok(r1.enviados > 0);
  assert.equal(api.ejecutarRecordatoriosAutomaticos().yaEjecutado, true);
  // Nunca a quien completó.
  assert.ok(!api.db.recordatorios.some((r) => r.asignacion_id === comp.id && r.tipo === 'automatico'));
  // c6 vencida recibe aviso de vencimiento y los responsables una notificación.
  const venc = api.db.asignaciones.find((x) => x.colaborador_id === 'c6' && x.capacitacion_id === 'cap1');
  assert.ok(api.db.recordatorios.some((r) => r.asignacion_id === venc.id && r.tipo === 'vencimiento'));
  assert.ok(api.db.notificaciones.some((n) => n.usuario_id === 'u2' && n.titulo === 'Capacitaciones vencidas'));
});

test('nuevo ingreso recibe la inducción automáticamente', () => {
  const api = nuevaApi();
  const { usuario, asignadas } = api.registrarNuevoIngreso('u1', { nombre: 'Persona Nueva', area: 'Ingeniería' });
  assert.deepEqual(asignadas, ['Inducción INVA']);
  assert.equal(api.misCapacitaciones(usuario.id).length, 1);
});

test('preguntas: el colaborador pregunta, solo responsables con permiso responden', () => {
  const api = nuevaApi();
  const a = api.db.asignaciones.find((x) => x.colaborador_id === 'c4' && x.capacitacion_id === 'cap1');
  assert.throws(() => api.enviarConsulta('c4', a.id, '   '), ErrorNegocio);
  const q = api.enviarConsulta('c4', a.id, '¿Hasta cuándo tengo plazo?');
  // Llega a propietaria y editora de la Inducción INVA, no a otros RR.HH.
  assert.ok(api.db.notificaciones.some((n) => n.usuario_id === 'u1' && n.titulo === 'Nueva pregunta de un colaborador'));
  assert.ok(api.db.notificaciones.some((n) => n.usuario_id === 'u2' && n.titulo === 'Nueva pregunta de un colaborador'));
  assert.ok(!api.db.notificaciones.some((n) => n.usuario_id === 'u3' && n.titulo === 'Nueva pregunta de un colaborador'));
  // Un RR.HH. no responsable no ve ni responde.
  assert.throws(() => api.consultasCapacitacion('u3', 'cap1'), AccesoDenegado);
  assert.throws(() => api.responderConsulta('u3', 'cap1', q.id, 'x'), AccesoDenegado);
  // Otro colaborador no ve preguntas ajenas.
  const ajena = api.db.asignaciones.find((x) => x.colaborador_id === 'c1' && x.capacitacion_id === 'cap1');
  assert.ok(api.misConsultas('c1', ajena.id).every((x) => x.usuario_id === 'c1'));
  api.responderConsulta('u2', 'cap1', q.id, 'Hasta la fecha límite indicada.');
  assert.equal(api.misConsultas('c4', a.id)[0].respuesta, 'Hasta la fecha límite indicada.');
  assert.ok(api.db.notificaciones.some((n) => n.usuario_id === 'c4' && n.titulo === 'Respondieron tu pregunta'));
});
