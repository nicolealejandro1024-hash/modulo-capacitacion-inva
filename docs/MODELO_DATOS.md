# Modelo de datos sugerido

> Sugerencia. Claude Code debe adaptarlo a la base de datos y convenciones que ya usa el portal
> (por ejemplo, reutilizar la tabla de colaboradores/usuarios existente en vez de crear otra).

## capacitacion
| campo | tipo | nota |
|---|---|---|
| id | PK | |
| titulo | texto | |
| descripcion | texto | |
| categoria | enum | induccion, sst, cumplimiento, desarrollo, otra |
| obligatoria | bool | |
| modalidad | enum | virtual, presencial, mixta |
| capacitador_nombre | texto | |
| capacitador_cargo | texto | cargo o empresa |
| duracion_min | int | |
| fecha_limite | fecha | |
| nota_minima | int | ej. 2 (de 3) o 70 (%) |
| intentos_max | int | null = ilimitados |
| asignar_nuevos_ingresos | bool | para Inducción |
| estado | enum | borrador, publicada, cerrada |
| creado_por, creado_en, actualizado_en | | auditoría |

## capacitacion_responsable
Quién puede ver/gestionar cada capacitación y su seguimiento. Detalle en `PERMISOS.md`.
- id, capacitacion_id, usuario_id, rol (propietario, editor, solo_lectura), agregado_por, agregado_en

## video
| campo | tipo | nota |
|---|---|---|
| id | PK | |
| capacitacion_id | FK | |
| orden | int | |
| titulo | texto | |
| url / archivo | texto | |
| duracion_seg | int | |

## pregunta / opcion
- **pregunta**: id, capacitacion_id, orden, texto, tipo (multiple, vf)
- **opcion**: id, pregunta_id, orden, texto, es_correcta (bool)

## asignacion  (una fila por colaborador y capacitación)
| campo | tipo | nota |
|---|---|---|
| id | PK | |
| capacitacion_id | FK | |
| colaborador_id | FK | tabla existente de colaboradores |
| fecha_asignacion | fecha | |
| fecha_limite | fecha | copia de la capacitación, editable por persona |
| estado | enum | no_inicio, en_curso, pendiente_firma, completado, vencido |
| completado_en | fecha-hora | |

## progreso_video
| campo | tipo | nota |
|---|---|---|
| asignacion_id | FK | |
| video_id | FK | |
| segundos_vistos_max | int | hasta dónde llegó (evita adelantar) |
| iniciado_en, terminado_en | fecha-hora | |

## intento_cuestionario
- id, asignacion_id, numero_intento, nota, aprobado (bool), enviado_en
- **respuesta**: intento_id, pregunta_id, opcion_id

## asistencia  (el "registro")
| campo | tipo | nota |
|---|---|---|
| id | PK | |
| asignacion_id | FK | |
| sesion_id | FK, null | solo si fue presencial |
| tipo | enum | virtual, presencial_qr |
| registrado_en | fecha-hora | |
| firma_id | FK | referencia a la firma existente ("Mi Firma") |
| firmado_en | fecha-hora | |
| ip / dispositivo | texto | evidencia opcional |

## sesion_presencial
- id, capacitacion_id, fecha, hora_inicio, hora_fin, lugar, token_qr, qr_expira_en

## recordatorio
| campo | tipo | nota |
|---|---|---|
| id | PK | |
| asignacion_id | FK | |
| canal | enum | correo, notificacion_portal |
| tipo | enum | manual, automatico, vencimiento, copia_jefe |
| enviado_por | FK, null | null si fue automático |
| enviado_en | fecha-hora | |
