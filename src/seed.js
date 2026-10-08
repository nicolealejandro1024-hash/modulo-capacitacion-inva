// Datos de DEMOSTRACIÓN. Las personas son ficticias; las preguntas, plazos y textos son ejemplos editables
// (validar con RR.HH. y SST antes de usarlos). La "Inducción INVA" sale de datos-ejemplo/capacitacion_induccion.json.
import { sumarDias } from './util.js';

const firmaDemo = (n) =>
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="100"><path d="M12 ${60 + n} C 40 ${10 + n * 3}, 70 90, 95 50 S 140 ${15 + n * 2}, 165 60 S 220 85, ${235 + n * 4} 32" fill="none" stroke="#151B27" stroke-width="3" stroke-linecap="round"/></svg>`
  );

export function crearSemilla(hoy) {
  const d = (n) => sumarDias(hoy, n);
  const ts = (n, h = 10, m = 0) => `${d(n)}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`;

  const usuarios = [
    { id: 'u1', nombre: 'Nicole Alejandro', correo: 'nicole.alejandro@invaglobal.com', rol: 'admin_rrhh', area: 'Recursos Humanos', cargo: 'Analista de RR.HH.', sede: 'Lima', dni: '40000001', jefe_id: 'u3', ingreso: d(-400) },
    { id: 'u2', nombre: 'Carla Mendoza', correo: 'carla.mendoza@ejemplo.com', rol: 'admin_rrhh', area: 'Recursos Humanos', cargo: 'Asistente de RR.HH.', sede: 'Lima', dni: '40000002', jefe_id: 'u3', ingreso: d(-300) },
    { id: 'u3', nombre: 'Jorge Ramírez', correo: 'jorge.ramirez@ejemplo.com', rol: 'admin_rrhh', area: 'Recursos Humanos', cargo: 'Jefe de RR.HH.', sede: 'Lima', dni: '40000003', jefe_id: null, ingreso: d(-900) },
    { id: 'u4', nombre: 'Lucía Torres', correo: 'lucia.torres@ejemplo.com', rol: 'admin_rrhh', area: 'Recursos Humanos', cargo: 'Analista de RR.HH.', sede: 'Santiago', dni: '40000004', jefe_id: 'u3', ingreso: d(-200) },
    { id: 'c1', nombre: 'Andrés Quispe', correo: 'andres.quispe@ejemplo.com', rol: 'colaborador', area: 'Ingeniería', cargo: 'Ingeniero de Proyectos', sede: 'Lima', dni: '40000011', jefe_id: 'c8', ingreso: d(-20) },
    { id: 'c2', nombre: 'María Huamán', correo: 'maria.huaman@ejemplo.com', rol: 'colaborador', area: 'Ingeniería', cargo: 'Ingeniera Civil', sede: 'Arequipa', dni: '40000012', jefe_id: 'c8', ingreso: d(-15) },
    { id: 'c3', nombre: 'Diego Rojas', correo: 'diego.rojas@ejemplo.com', rol: 'colaborador', area: 'Minería', cargo: 'Ingeniero de Minas', sede: 'Arequipa', dni: '40000013', jefe_id: null, ingreso: d(-12) },
    { id: 'c4', nombre: 'Valentina Soto', correo: 'valentina.soto@ejemplo.com', rol: 'colaborador', area: 'Minería', cargo: 'Geóloga', sede: 'Santiago', dni: '40000014', jefe_id: null, ingreso: d(-10) },
    { id: 'c5', nombre: 'Luis Fernández', correo: 'luis.fernandez@ejemplo.com', rol: 'colaborador', area: 'Proyectos', cargo: 'Coordinador de Proyectos', sede: 'Lima', dni: '40000015', jefe_id: null, ingreso: d(-25) },
    { id: 'c6', nombre: 'Camila Paredes', correo: 'camila.paredes@ejemplo.com', rol: 'colaborador', area: 'Administración', cargo: 'Asistente Administrativa', sede: 'Lima', dni: '40000016', jefe_id: null, ingreso: d(-30) },
    { id: 'c7', nombre: 'Renzo Castillo', correo: 'renzo.castillo@ejemplo.com', rol: 'colaborador', area: 'SST', cargo: 'Supervisor SST', sede: 'Arequipa', dni: '40000017', jefe_id: null, ingreso: d(-500) },
    { id: 'c8', nombre: 'Patricia Vega', correo: 'patricia.vega@ejemplo.com', rol: 'colaborador', area: 'Ingeniería', cargo: 'Gerente de Ingeniería', sede: 'Lima', dni: '40000018', jefe_id: null, ingreso: d(-700) },
  ].map((u) => ({ ...u, activo: true, firma_id: null }));

  const recordatoriosDefault = { automaticos: true, cada_dias: 3, aviso_dia_antes: true, copia_jefe_directo: true };

  const capacitaciones = [
    {
      id: 'cap1',
      titulo: 'Inducción INVA',
      descripcion: 'Conoce la empresa, nuestros proyectos en Perú y Chile, las políticas internas y cómo usar el Portal.',
      categoria: 'induccion',
      obligatoria: true,
      modalidad: 'virtual',
      capacitador_nombre: 'Nicole Alejandro',
      capacitador_cargo: 'Recursos Humanos',
      lugar: '',
      duracion_min: 28,
      fecha_limite: d(5),
      dias_para_completar: 7,
      nota_minima: 2,
      intentos_max: 3,
      mostrar_respuestas: true,
      asignar_nuevos_ingresos: true,
      estado: 'publicada',
      asignacion: { modo: 'todos', valores: [] },
      recordatorios: { ...recordatoriosDefault },
      videos: [
        { id: 'v1', titulo: 'Bienvenida: quiénes somos', duracion_seg: 270, url: '' },
        { id: 'v2', titulo: 'Nuestros proyectos en Perú y Chile', duracion_seg: 550, url: '' },
        { id: 'v3', titulo: 'Políticas internas y Portal INVA', duracion_seg: 860, url: '' },
      ],
      preguntas: [
        { id: 'p1', tipo: 'multiple', texto: '¿En qué sección del Portal INVA solicitas un documento a RR.HH.?', opciones: [{ texto: 'Beneficios', correcta: false }, { texto: 'Solicitar Documento', correcta: true }, { texto: 'Mis Boletas', correcta: false }] },
        { id: 'p2', tipo: 'multiple', texto: '¿En qué países desarrolla proyectos INVA?', opciones: [{ texto: 'Solo en Perú', correcta: false }, { texto: 'Perú y Chile', correcta: true }, { texto: 'Perú, Chile y Colombia', correcta: false }] },
        { id: 'p3', tipo: 'multiple', texto: 'Si ocurre un incidente de seguridad en campo, ¿qué haces primero?', opciones: [{ texto: 'Esperar al final del día', correcta: false }, { texto: 'Reportarlo de inmediato a tu supervisor', correcta: true }, { texto: 'Comentarlo solo con tus compañeros', correcta: false }] },
      ],
      creado_por: 'u1',
      creado_en: ts(-10, 9),
      actualizado_en: ts(-10, 9),
    },
    {
      id: 'cap2',
      titulo: 'Charla SST: uso correcto de EPP',
      descripcion: 'Charla presencial sobre selección, uso y cuidado del equipo de protección personal en obra. (Contenido de ejemplo: validar con SST).',
      categoria: 'sst',
      obligatoria: true,
      modalidad: 'presencial',
      capacitador_nombre: '[Nombre del capacitador]',
      capacitador_cargo: 'Área SST',
      lugar: 'Oficina Arequipa – Sala 2',
      duracion_min: 45,
      fecha_limite: d(10),
      dias_para_completar: 7,
      nota_minima: 2,
      intentos_max: 2,
      mostrar_respuestas: false,
      asignar_nuevos_ingresos: false,
      estado: 'publicada',
      asignacion: { modo: 'area', valores: ['Minería', 'SST'] },
      recordatorios: { ...recordatoriosDefault, copia_jefe_directo: false },
      videos: [],
      preguntas: [
        { id: 'p4', tipo: 'vf', texto: 'El casco de seguridad puede usarse aunque tenga fisuras si todavía se ajusta bien.', opciones: [{ texto: 'Verdadero', correcta: false }, { texto: 'Falso', correcta: true }] },
        { id: 'p5', tipo: 'multiple', texto: '¿Cuándo debes revisar tu EPP?', opciones: [{ texto: 'Solo cuando se rompe', correcta: false }, { texto: 'Antes de cada uso', correcta: true }, { texto: 'Una vez al año', correcta: false }] },
      ],
      creado_por: 'u1',
      creado_en: ts(-6, 11),
      actualizado_en: ts(-6, 11),
    },
    {
      id: 'cap5',
      titulo: 'Seguridad de la información',
      descripcion: 'Reunión en vivo por Teams sobre contraseñas, correos sospechosos y manejo de información de clientes. (Contenido de ejemplo).',
      categoria: 'cumplimiento',
      obligatoria: true,
      modalidad: 'en_vivo',
      capacitador_nombre: '[Nombre del capacitador]',
      capacitador_cargo: 'Área de TI',
      lugar: '',
      duracion_min: 60,
      fecha_limite: d(9),
      dias_para_completar: 7,
      nota_minima: 2,
      intentos_max: 3,
      mostrar_respuestas: true,
      asignar_nuevos_ingresos: false,
      estado: 'publicada',
      asignacion: { modo: 'area', valores: ['Ingeniería', 'Proyectos', 'Recursos Humanos'] },
      recordatorios: { ...recordatoriosDefault, copia_jefe_directo: false },
      pedir_firma: false,
      reuniones: [
        { id: 'reu1', fecha: d(-1), hora_inicio: '10:00', hora_fin: '11:00', enlace: 'https://teams.microsoft.com/l/meetup-join/EJEMPLO-1' },
        { id: 'reu2', fecha: d(2), hora_inicio: '16:00', hora_fin: '17:00', enlace: 'https://teams.microsoft.com/l/meetup-join/EJEMPLO-2' },
      ],
      videos: [{ id: 'v6', titulo: 'Grabación de la reunión', duracion_seg: 3300, url: '' }],
      preguntas: [
        { id: 'p7', tipo: 'multiple', texto: 'Recibes un correo que pide tu contraseña con urgencia. ¿Qué haces?', opciones: [{ texto: 'La envío para no tener problemas', correcta: false }, { texto: 'No respondo y lo reporto a TI', correcta: true }, { texto: 'Respondo pidiendo más datos', correcta: false }] },
        { id: 'p8', tipo: 'vf', texto: 'Está bien compartir tu contraseña con un compañero de confianza.', opciones: [{ texto: 'Verdadero', correcta: false }, { texto: 'Falso', correcta: true }] },
      ],
      creado_por: 'u1',
      creado_en: ts(-3, 9),
      actualizado_en: ts(-3, 9),
    },
    {
      id: 'cap6',
      titulo: 'Presentación de beneficios 2026',
      descripcion: 'Reunión informativa por Teams con la empresa aseguradora (capacitador externo). Sin cuestionario: RR.HH. registra la asistencia. (Ejemplo).',
      categoria: 'otra',
      obligatoria: false,
      modalidad: 'en_vivo',
      capacitador_nombre: '[Nombre del expositor]',
      capacitador_cargo: '[Empresa aseguradora]',
      lugar: '',
      duracion_min: 45,
      fecha_limite: d(3),
      dias_para_completar: 7,
      nota_minima: 0,
      intentos_max: null,
      mostrar_respuestas: false,
      asignar_nuevos_ingresos: false,
      estado: 'publicada',
      asignacion: { modo: 'area', valores: ['Proyectos', 'Recursos Humanos', 'Administración'] },
      recordatorios: { ...recordatoriosDefault, copia_jefe_directo: false },
      pedir_firma: false,
      reuniones: [{ id: 'reu3', fecha: d(-1), hora_inicio: '11:00', hora_fin: '11:45', enlace: 'https://teams.microsoft.com/l/meetup-join/EJEMPLO-3' }],
      videos: [],
      preguntas: [],
      creado_por: 'u1',
      creado_en: ts(-4, 10),
      actualizado_en: ts(-4, 10),
    },
    {
      id: 'cap3',
      titulo: 'Inducción HC',
      descripcion: 'Inducción específica del proyecto HC. (Ejemplo para mostrar permisos: Nicole NO es responsable de esta capacitación).',
      categoria: 'induccion',
      obligatoria: true,
      modalidad: 'virtual',
      capacitador_nombre: 'Jorge Ramírez',
      capacitador_cargo: 'Recursos Humanos',
      lugar: '',
      duracion_min: 10,
      fecha_limite: d(8),
      dias_para_completar: 7,
      nota_minima: 1,
      intentos_max: null,
      mostrar_respuestas: true,
      asignar_nuevos_ingresos: false,
      estado: 'publicada',
      asignacion: { modo: 'personas', valores: ['c4', 'c5'] },
      recordatorios: { ...recordatoriosDefault },
      videos: [{ id: 'v4', titulo: 'Presentación del proyecto HC', duracion_seg: 600, url: '' }],
      preguntas: [{ id: 'p6', tipo: 'vf', texto: 'Antes de ingresar al proyecto debes completar esta inducción.', opciones: [{ texto: 'Verdadero', correcta: true }, { texto: 'Falso', correcta: false }] }],
      creado_por: 'u3',
      creado_en: ts(-4, 15),
      actualizado_en: ts(-4, 15),
    },
    {
      id: 'cap4',
      titulo: 'Código de Ética y Conducta',
      descripcion: 'Principios de conducta, conflictos de interés y canal de denuncias. (Borrador de ejemplo).',
      categoria: 'cumplimiento',
      obligatoria: true,
      modalidad: 'virtual',
      capacitador_nombre: '',
      capacitador_cargo: '',
      lugar: '',
      duracion_min: 15,
      fecha_limite: d(30),
      dias_para_completar: 14,
      nota_minima: 1,
      intentos_max: 3,
      mostrar_respuestas: true,
      asignar_nuevos_ingresos: false,
      estado: 'borrador',
      asignacion: { modo: 'todos', valores: [] },
      recordatorios: { ...recordatoriosDefault },
      videos: [{ id: 'v5', titulo: 'Nuestro código de ética', duracion_seg: 900, url: '' }],
      preguntas: [],
      creado_por: 'u1',
      creado_en: ts(-1, 16),
      actualizado_en: ts(-1, 16),
    },
  ];

  const responsables = [
    { id: 'r1', capacitacion_id: 'cap1', usuario_id: 'u1', rol: 'propietario', agregado_por: 'u1', agregado_en: ts(-10, 9) },
    { id: 'r2', capacitacion_id: 'cap1', usuario_id: 'u2', rol: 'editor', agregado_por: 'u1', agregado_en: ts(-10, 9, 5) },
    { id: 'r3', capacitacion_id: 'cap2', usuario_id: 'u1', rol: 'propietario', agregado_por: 'u1', agregado_en: ts(-6, 11) },
    { id: 'r4', capacitacion_id: 'cap2', usuario_id: 'c7', rol: 'solo_lectura', agregado_por: 'u1', agregado_en: ts(-6, 11, 2) },
    { id: 'r5', capacitacion_id: 'cap3', usuario_id: 'u3', rol: 'propietario', agregado_por: 'u3', agregado_en: ts(-4, 15) },
    { id: 'r6', capacitacion_id: 'cap3', usuario_id: 'u4', rol: 'editor', agregado_por: 'u3', agregado_en: ts(-4, 15, 1) },
    { id: 'r7', capacitacion_id: 'cap4', usuario_id: 'u1', rol: 'propietario', agregado_por: 'u1', agregado_en: ts(-1, 16) },
    { id: 'r9', capacitacion_id: 'cap6', usuario_id: 'u1', rol: 'propietario', agregado_por: 'u1', agregado_en: ts(-4, 10) },
    { id: 'r8', capacitacion_id: 'cap5', usuario_id: 'u1', rol: 'propietario', agregado_por: 'u1', agregado_en: ts(-3, 9) },
  ];

  const asignaciones = [];
  const progreso = [];
  const intentos = [];
  const respuestas = [];
  const asistencias = [];
  const firmas = [];
  const recordatorios = [];
  const notificaciones = [];
  let n = 0;

  const asignar = (capId, uid, fechaLimite, diaAsig) => {
    const id = `a${++n}`;
    asignaciones.push({ id, capacitacion_id: capId, colaborador_id: uid, fecha_asignacion: d(diaAsig), fecha_limite: fechaLimite, intentos_extra: 0, completado_en: null });
    recordatorios.push({ id: `rec${n}`, asignacion_id: id, canal: 'correo', tipo: 'asignacion', enviado_por: null, enviado_en: ts(diaAsig, 9, 1) });
    return id;
  };
  const verVideos = (asigId, videos, cuantos, parcial = 0, dia = -3) => {
    videos.forEach((v, i) => {
      if (i < cuantos) progreso.push({ asignacion_id: asigId, video_id: v.id, segundos_vistos_max: v.duracion_seg, iniciado_en: ts(dia, 9, i * 15), terminado_en: ts(dia, 9, i * 15 + 10) });
      else if (i === cuantos && parcial) progreso.push({ asignacion_id: asigId, video_id: v.id, segundos_vistos_max: parcial, iniciado_en: ts(dia, 10), terminado_en: null });
    });
  };
  const rendir = (asigId, cap, aciertos, numero, dia) => {
    const id = `i${asigId}_${numero}`;
    intentos.push({ id, asignacion_id: asigId, numero_intento: numero, nota: aciertos, total: cap.preguntas.length, aprobado: aciertos >= cap.nota_minima, enviado_en: ts(dia, 11, numero) });
    cap.preguntas.forEach((p, i) => {
      const correcta = p.opciones.findIndex((o) => o.correcta);
      respuestas.push({ intento_id: id, pregunta_id: p.id, opcion: i < aciertos ? correcta : (correcta + 1) % p.opciones.length });
    });
  };
  const firmar = (asigId, uid, dia, k, tipo = 'virtual', sesionId = null) => {
    const fid = `f${asigId}`;
    firmas.push({ id: fid, usuario_id: uid, imagen: firmaDemo(k), creado_en: ts(dia, 12, k) });
    asistencias.push({ id: `as${asigId}`, asignacion_id: asigId, sesion_id: sesionId, tipo, registrado_en: ts(dia, 12, k), firma_id: fid, firmado_en: ts(dia, 12, k + 1), dispositivo: 'Demo' });
    asignaciones.find((a) => a.id === asigId).completado_en = ts(dia, 12, k + 1);
    usuarios.find((u) => u.id === uid).firma_id = fid;
  };

  // Inducción INVA (cap1): todos.
  const c1 = capacitaciones[0];
  const plan1 = {
    u1: () => {},
    u2: (a) => { verVideos(a, c1.videos, 3, 0, -8); rendir(a, c1, 3, 1, -8); firmar(a, 'u2', -8, 1); },
    u3: (a) => verVideos(a, c1.videos, 1, 120, -2),
    u4: () => {},
    c1: (a) => { verVideos(a, c1.videos, 3, 0, -6); rendir(a, c1, 1, 1, -6); rendir(a, c1, 3, 2, -6); firmar(a, 'c1', -6, 2); },
    c2: (a) => { verVideos(a, c1.videos, 3, 0, -2); rendir(a, c1, 2, 1, -2); },
    c3: (a) => verVideos(a, c1.videos, 1, 300, -1),
    c4: () => {},
    c5: (a) => { verVideos(a, c1.videos, 3, 0, -5); rendir(a, c1, 3, 1, -5); firmar(a, 'c5', -5, 3); },
    c6: () => {},
    c7: (a) => verVideos(a, c1.videos, 2, 0, -3),
    c8: () => {},
  };
  for (const [uid, fn] of Object.entries(plan1)) {
    const limite = uid === 'c6' ? d(-2) : uid === 'c8' ? d(1) : c1.fecha_limite;
    const a = asignar('cap1', uid, limite, uid === 'c6' ? -9 : -10);
    fn(a);
  }

  // Charla SST (cap2): Minería y SST; la charla ya se dio y RR.HH. registró a dos asistentes.
  const c2 = capacitaciones[1];

  for (const uid of ['c3', 'c4', 'c7']) {
    const a = asignar('cap2', uid, c2.fecha_limite, -6);
    if (uid === 'c3') {
      asistencias.push({ id: `as${a}`, asignacion_id: a, sesion_id: null, tipo: 'presencial_manual', registrado_en: ts(-1, 10, 5), firma_id: null, firmado_en: null, dispositivo: 'Registrado por Nicole Alejandro' });
      rendir(a, c2, 2, 1, -1);
      const as = asistencias.find((x) => x.asignacion_id === a);
      firmas.push({ id: `f${a}`, usuario_id: 'c3', imagen: firmaDemo(4), creado_en: ts(-1, 9, 40) });
      as.firma_id = `f${a}`;
      as.firmado_en = ts(-1, 9, 41);
      asignaciones.find((x) => x.id === a).completado_en = as.firmado_en;
    }
    if (uid === 'c7') asistencias.push({ id: `as${a}`, asignacion_id: a, sesion_id: null, tipo: 'presencial_manual', registrado_en: ts(-1, 10, 5), firma_id: null, firmado_en: null, dispositivo: 'Registrado por Nicole Alejandro' });
  }

  // Seguridad de la información (cap5): en vivo por Teams; una reunión ya pasó.
  const c5 = capacitaciones.find((c) => c.id === 'cap5');
  for (const u of usuarios.filter((x) => c5.asignacion.valores.includes(x.area))) {
    const a = asignar('cap5', u.id, c5.fecha_limite, -3);
    if (u.id === 'c1' || u.id === 'u2') rendir(a, c5, 2, 1, -1);
    if (u.id === 'c2') rendir(a, c5, 1, 1, -1);
  }

  // Presentación de beneficios (cap6): en vivo SIN cuestionario → la asistencia la marca RR.HH.
  const c6 = capacitaciones.find((c) => c.id === 'cap6');
  for (const u of usuarios.filter((x) => c6.asignacion.valores.includes(x.area))) {
    const a = asignar('cap6', u.id, c6.fecha_limite, -4);
    if (['c5', 'u2'].includes(u.id)) asistencias.push({ id: `as${a}`, asignacion_id: a, sesion_id: null, tipo: 'presencial_manual', registrado_en: ts(-1, 12), firma_id: null, firmado_en: null, dispositivo: 'Registrado por Nicole Alejandro' });
  }

  // Inducción HC (cap3): personas puntuales.
  for (const uid of ['c4', 'c5']) {
    const a = asignar('cap3', uid, capacitaciones.find((c) => c.id === 'cap3').fecha_limite, -4);
    if (uid === 'c5') verVideos(a, capacitaciones.find((c) => c.id === 'cap3').videos, 1, 0, -2);
  }

  // Un recordatorio manual de ejemplo.
  recordatorios.push({ id: 'rec-m1', asignacion_id: 'a10', canal: 'correo', tipo: 'manual', enviado_por: 'u1', enviado_en: ts(-3, 15) });

  for (const a of asignaciones) {
    const cap = capacitaciones.find((c) => c.id === a.capacitacion_id);
    notificaciones.push({ id: `n${a.id}`, usuario_id: a.colaborador_id, titulo: 'Nueva capacitación asignada', texto: `Tienes asignada «${cap.titulo}». Fecha límite: ${a.fecha_limite}.`, enlace: `#/mis-capacitaciones/${a.id}`, leida: !!a.completado_en, creado_en: `${a.fecha_asignacion}T09:01:00` });
  }

  const auditoria = capacitaciones.map((c, i) => ({ id: `au${i}`, usuario_id: c.creado_por, accion: 'crear_capacitacion', capacitacion_id: c.id, detalle: `Creó «${c.titulo}»`, fecha: c.creado_en }));

  return {
    version: 1,
    seq: 1000,
    desfaseDias: 0,
    ultimoJob: null,
    usuarios,
    capacitaciones,
    responsables,
    asignaciones,
    progreso,
    intentos,
    respuestas,
    asistencias,
    firmas,
    sesiones: [],
    recordatorios,
    notificaciones,
    auditoria,
    consultas: [
      { id: 'q1', capacitacion_id: 'cap1', asignacion_id: 'a7', usuario_id: 'c3', texto: '¿La inducción se puede ver desde el celular estando en obra?', creado_en: ts(-1, 16, 20), respuesta: null, respondido_por: null, respondido_en: null },
      { id: 'q2', capacitacion_id: 'cap1', asignacion_id: 'a6', usuario_id: 'c2', texto: '¿Dónde encuentro el reglamento interno que mencionan en el video 3?', creado_en: ts(-2, 11, 5), respuesta: 'Está en «Documentos / Firma» del portal, carpeta Políticas internas.', respondido_por: 'u1', respondido_en: ts(-2, 15, 30) },
    ],
  };
}
