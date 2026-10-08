# Plan por fases

## Fase 0 – Reconocimiento (sin cambios en el código)
- Explorar el repositorio del portal: stack, base de datos, autenticación y roles, firma, notificaciones, correo.
- Entregar resumen + plan ajustado + lista de dudas.

## Fase 1 – Base de datos y permisos
- Migraciones de las tablas de `MODELO_DATOS.md` (incluida `capacitacion_responsable`).
- Lógica de permisos en el backend (`PERMISOS.md`) con pruebas: un RR.HH. no responsable NO puede ver el seguimiento.

## Fase 2 – Crear capacitaciones (RR.HH.)
- CRUD de capacitación, videos, cuestionario, asignación y responsables.

## Fase 3 – Mis Capacitaciones (colaborador)
- Listado, reproductor con progreso, cuestionario con nota, firma.

## Fase 4 – Seguimiento
- KPIs, filtros, tabla, detalle por persona, exportar Excel.

## Fase 5 – Recordatorios
- Manuales y automáticos (tarea programada) + notificaciones del portal.

## Fase 6 – Registro de asistencia y presencial
- PDF del registro, QR de sesión presencial.

## Fase 7 – Pruebas y despliegue
- Pruebas con 2–3 usuarios reales (un responsable, un RR.HH. no responsable, un colaborador).
- Revisión con SST y con quien administra el portal antes de publicar.
