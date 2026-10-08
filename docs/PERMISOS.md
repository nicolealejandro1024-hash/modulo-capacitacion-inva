# Permisos por capacitación (quién ve el seguimiento)

## Idea
Ser "Administrador RR.HH." **no basta** para ver el seguimiento de una capacitación.
Cada capacitación tiene su propia lista de **responsables** y solo ellos la ven en el panel de Capacitaciones.

Ejemplo:
- *Inducción INVA* → responsables: Nicole Alejandro (propietaria) + 1 persona más.
- *Inducción HC* → responsables: exactamente 2 personas.
- El resto de RR.HH. ni siquiera ve esas capacitaciones en su lista ni puede abrir su seguimiento.

Es como un documento compartido: el que lo crea decide con quién lo comparte.

## Roles dentro de una capacitación
| rol | ver seguimiento | enviar recordatorios | descargar registro | editar contenido / asignaciones | gestionar responsables |
|---|---|---|---|---|---|
| **Propietario** (quien la crea) | sí | sí | sí | sí | sí |
| **Editor** | sí | sí | sí | sí | no |
| **Solo lectura** | sí | no | sí | no | no |

- Al crear una capacitación, quien la crea queda automáticamente como **Propietario**.
- En la pantalla de crear/editar hay una sección **"Responsables"**: buscar persona → elegir rol → agregar / quitar.
- Puede haber más de un propietario (para que no quede huérfana si alguien deja la empresa).
- Opcional: un **Super administrador** (p. ej. jefatura de RR.HH.) que puede ver todo, solo para casos de soporte o
  auditoría, y que quede registrado cada vez que entra. Confirmar con INVA si se quiere esta figura.

## Qué ve cada quien
| persona | ve |
|---|---|
| Colaborador asignado | solo SU avance, SU nota y SU firma en "Mis Capacitaciones" |
| Colaborador no asignado | nada de esa capacitación |
| RR.HH. que no es responsable | nada de esa capacitación (no aparece en su lista) |
| Responsable | la capacitación y su seguimiento completo, según su rol |

## Reglas técnicas (para Claude Code)
1. El control se hace **en el servidor/backend**, no solo ocultando botones en la pantalla.
   Toda consulta de seguimiento, exportación, registro PDF y envío de recordatorios debe verificar
   que el usuario esté en `capacitacion_responsable` para esa capacitación.
2. Si alguien sin permiso intenta entrar por la URL directa → respuesta 403 / "No tienes acceso a esta capacitación".
3. El listado de capacitaciones de administración solo devuelve las capacitaciones donde el usuario es responsable.
4. El contador del Dashboard ("Capacitaciones pendientes") solo cuenta las capacitaciones de las que el usuario es responsable.
5. Los recordatorios automáticos y las copias de aviso se envían igual, pero los reportes solo los ven los responsables.
6. Cambios de responsables quedan en auditoría (quién agregó/quitó a quién y cuándo).

## Tabla
### capacitacion_responsable
| campo | tipo | nota |
|---|---|---|
| id | PK | |
| capacitacion_id | FK | |
| usuario_id | FK | usuario del portal |
| rol | enum | propietario, editor, solo_lectura |
| agregado_por | FK | |
| agregado_en | fecha-hora | |

Restricción: (capacitacion_id, usuario_id) único; cada capacitación debe tener al menos 1 propietario.
