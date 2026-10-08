# Recordatorios y alertas

## Manuales (desde Seguimiento, solo responsables de la capacitación)
- **Por persona**: botón "Enviar recordatorio".
- **Masivo**: "Recordar a los que faltan (N)" → a todos los que están en *En curso*, *No inició* o *Pendiente de firma*.
- Después de enviar, la fila muestra "Recordatorio enviado · fecha" para no duplicar avisos el mismo día.

## Automáticos (interruptor por capacitación)
| cuándo | a quién | canal |
|---|---|---|
| Al asignar | colaborador | correo + notificación |
| Cada 3 días mientras no complete (configurable) | colaborador | correo + notificación |
| 1 día antes de la fecha límite | colaborador (+ copia al jefe directo, opcional) | correo + notificación |
| Al vencer | colaborador y responsables de la capacitación | correo + notificación |
| Resumen semanal (opcional) | responsables de la capacitación | correo |

## Contenido del aviso (ejemplo)
> Hola [Nombre], tienes pendiente la capacitación **[Título]**. Fecha límite: [fecha].
> Te falta: [ver videos / responder cuestionario / firmar]. [Ir a mis capacitaciones]

## Notas técnicas
- Usar el sistema de correo y la campana de notificaciones que ya tiene el portal (el correo de la empresa es Outlook/Microsoft 365).
- Los automáticos se ejecutan con una tarea programada (cron / job diario).
- Registrar cada envío en la tabla `recordatorio`.
- No enviar a quien ya completó, ni más de 1 aviso automático por día por persona.
