# Especificación funcional – Módulo Capacitaciones

## 1. Menú
- Sección administración: nuevo ítem **Capacitaciones** (solo rol Administrador RR.HH.).
- Sección "Mi cuenta": nuevo ítem **Mis Capacitaciones** (todos los colaboradores).
- En el Dashboard de RR.HH.: nueva tarjeta "Capacitaciones pendientes" con el número de personas que faltan.
- La campana de notificaciones muestra los recordatorios de capacitación.

## 2. Rol Colaborador – "Mis Capacitaciones"
### 2.1 Listado
- Resumen: Asignadas / Completadas / Por completar.
- Tarjeta por capacitación: tipo (Obligatoria / Opcional) y categoría (Inducción, SST, Cumplimiento, Desarrollo),
  título, descripción, nº de videos y duración, barra de avance, estado, fecha límite y botón
  (Comenzar / Continuar / Ver de nuevo).
- Estados: **No inició**, **En curso (x %)**, **Pendiente de firma**, **Completado**, **Vencido**.

### 2.2 Reproductor
- Videos en orden; lista lateral de contenido con check en los terminados.
- No se puede pasar al siguiente video sin terminar el actual (no permitir adelantar más allá de lo ya visto).
- Se guarda el progreso: si la persona sale, retoma donde se quedó.
- Fuentes de video soportadas: archivo subido, YouTube/Vimeo no listado o SharePoint/OneDrive (confirmar según el stack).

### 2.3 Cuestionario
- Se desbloquea al terminar todos los videos.
- Preguntas de opción múltiple (una correcta). Opcional: verdadero/falso.
- Configurable por capacitación: nota mínima para aprobar, nº de intentos permitidos, mostrar o no las respuestas correctas.
- Botón "Enviar respuestas" habilitado solo cuando todas están respondidas.
- Resultado inmediato: nota y Aprobado / Debe repetir.

### 2.4 Firma de asistencia
- Tras aprobar: pantalla de declaración
  "Declaro haber participado en la capacitación «[título]» el [fecha], con una duración de [x] minutos."
- Firma con el componente **Mi Firma** existente.
- Recién con la firma el estado pasa a **Completado**.

### 2.5 Asistencia presencial por QR
- Si la capacitación es presencial o mixta, el colaborador escanea un QR, entra al portal (con su sesión)
  y confirma su asistencia; luego responde el cuestionario (si hay) y firma.

## 3. Rol Administrador RR.HH. – "Capacitaciones"
### 3.1 Crear / editar capacitación
- Datos: título, descripción, categoría, obligatoria/opcional, modalidad (virtual / presencial / mixta),
  capacitador (nombre, cargo o empresa), duración, fecha límite.
- Videos: agregar, ordenar, quitar.
- Cuestionario: preguntas, opciones, respuesta correcta, nota mínima, intentos.
- Asignación: a todos, por área, por cargo, por sede, o personas puntuales. Opción "asignar automáticamente
  a nuevos ingresos" (para la Inducción).
- Estado: borrador / publicada / cerrada.
- **Responsables**: quién puede ver y gestionar esta capacitación y su seguimiento (propietario, editor,
  solo lectura). Por defecto, solo quien la crea. Ver `PERMISOS.md`.

### 3.2 Seguimiento
- Selector de capacitación.
- KPIs: Asignados, Vieron todos los videos, Respondieron cuestionario (con nota promedio), Firmaron, Faltan
  (en curso + no iniciaron), Vencidos.
- Filtros: Todos / Completados / En curso / No iniciaron / Vencidos; búsqueda por nombre; filtro por área.
- Tabla: colaborador, área, videos vistos (x/y), cuestionario (nota o "sin responder"), firma (sí/no + fecha),
  estado, acción.
- Acciones: "Enviar recordatorio" por persona; "Recordar a los que faltan (N)"; exportar a Excel;
  descargar **Registro de asistencia** (PDF) firmado.
- Detalle por persona: historial (fechas de cada video, intentos de cuestionario, recordatorios enviados).

### 3.3 Sesión presencial
- Botón "Generar QR de asistencia" para una sesión: QR con vigencia limitada (p. ej. la duración de la charla),
  pantalla para proyectarlo y contador en vivo de asistentes.

## 4. Reglas generales
- Una persona solo ve sus propias capacitaciones y resultados.
- El seguimiento de una capacitación solo lo ven **sus responsables** (no todo RR.HH.). Detalle en `PERMISOS.md`.
- Todo cambio relevante queda con fecha y hora (auditoría).
- Datos personales: tratar conforme a la Ley 29733 (Protección de Datos Personales, Perú); informar a los
  colaboradores qué se registra (avance de videos, respuestas, firma) y para qué.
