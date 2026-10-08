# Flujos

## Colaborador (virtual)
```
Recibe notificación / correo "Tienes una capacitación asignada"
  → Mis Capacitaciones → tarjeta → [Comenzar]
  → Video 1 → Video 2 → ... (se guarda avance; no puede adelantar)
  → Cuestionario (se desbloquea al terminar los videos)
      → No aprueba → puede reintentar (si quedan intentos)
      → Aprueba → Declaración + Firma (Mi Firma)
  → Estado: Completado → RR.HH. lo ve en Seguimiento
```

## Colaborador (presencial)
```
Asiste a la charla → escanea QR proyectado → inicia sesión en el portal
  → "Confirmar asistencia" (queda hora y sesión)
  → Cuestionario (si la capacitación lo tiene) → Firma → Completado
```

## RR.HH.
```
Capacitaciones → [+ Nueva capacitación]
  → datos, videos, cuestionario, asignación, fecha límite → Publicar
  → Se notifica a los asignados
Seguimiento → elige capacitación
  → ve KPIs y tabla → filtra "Faltan"
  → [Enviar recordatorio] o [Recordar a los que faltan (N)]
  → [Descargar registro de asistencia] (PDF firmado) / [Exportar Excel]
Presencial → [Generar QR] → proyecta → ve asistentes en vivo → cierra sesión
```

## Estados de una asignación
```
no_inicio → en_curso → pendiente_firma → completado
     \_________\_____________\→ vencido (si pasa la fecha límite sin completar)
```
