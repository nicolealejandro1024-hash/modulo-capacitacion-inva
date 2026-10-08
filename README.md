# Módulo de Capacitaciones – Portal INVA

Web funcional del módulo **Capacitaciones** para el Portal INVA (INVA Ingenieros S.A.C.).
Implementa lo descrito en [`CLAUDE.md`](CLAUDE.md) y en la carpeta [`docs/`](docs/).

> **Estado:** versión de demostración completa y navegable. Los datos se guardan en el navegador de quien la usa
> (no hay servidor todavía). Las personas, preguntas y plazos son **ejemplos editables**: validar con RR.HH. y SST.

## Cómo verla

- **En línea (GitHub Pages):** abre el enlace del repositorio → *Settings → Pages* (o el enlace indicado en la descripción del repo).
- **En tu computadora:** dentro de esta carpeta ejecuta

  ```bash
  python3 -m http.server 5173
  ```

  y abre <http://localhost:5173>. (Abrir `index.html` con doble clic no funciona: el navegador necesita un servidor).

Al entrar eliges un **usuario de demostración**. Prueba, por ejemplo:

| Usuario | Para probar |
|---|---|
| **Nicole Alejandro** (Admin RR.HH.) | Propietaria de «Inducción INVA» y «Charla SST». Crea, edita, ve seguimiento, recordatorios, QR y registro. **No** ve «Inducción HC». |
| **Jorge Ramírez** (Jefe RR.HH.) | Propietario de «Inducción HC». Aunque es jefe de RR.HH., **no** ve «Inducción INVA» (permisos por capacitación). |
| **Carla Mendoza** (Admin RR.HH.) | Editora de «Inducción INVA»: edita y envía recordatorios, pero no cambia responsables. |
| **Renzo Castillo** (Colaborador) | Solo lectura del seguimiento de «Charla SST». |
| Cualquier colaborador | «Mis Capacitaciones»: videos, cuestionario y firma. |

La barra amarilla de arriba permite **avanzar 1 día** (para ver los recordatorios automáticos), **cambiar de usuario**
y **restablecer los datos de ejemplo**. En el reproductor hay una velocidad **16× (demo)** para no esperar los videos completos.

## Qué incluye

**Colaborador – Mis Capacitaciones**
- Resumen (asignadas / completadas / por completar) y tarjetas con estado: No inició, En curso (x %), Pendiente de firma, Completado, Vencido.
- Reproductor con lista de contenido: videos en orden, **no se puede adelantar** más allá de lo visto, el avance se guarda y se retoma.
  Reproduce archivos `.mp4/.webm`; sin archivo usa un video de demostración.
- Cuestionario (opción múltiple o verdadero/falso) que se desbloquea al terminar los videos; nota mínima, intentos y
  revisión de respuestas configurables (las correctas solo se revelan al aprobar o al agotar intentos).
- Declaración + **firma** (reutiliza «Mi Firma» si ya existe, o se dibuja con el dedo/mouse). Recién con la firma pasa a *Completado*.
- Asistencia presencial por **QR** y aviso de datos personales (Ley 29733).

**RR.HH. / responsables – Capacitaciones**
- Dashboard con «Capacitaciones pendientes» (solo cuenta las capacitaciones donde eres responsable).
- Crear/editar: datos, videos (agregar/ordenar/quitar), cuestionario, asignación (todos, área, cargo, sede o personas),
  asignación automática a nuevos ingresos, estado borrador/publicada/cerrada, recordatorios y **responsables**.
- **Permisos por capacitación** (docs/PERMISOS.md): Propietario, Editor, Solo lectura. Quien no es responsable no la ve
  (ni en la lista, ni por URL directa → «403 No tienes acceso»). Debe quedar siempre al menos un propietario.
- Seguimiento: KPIs, filtros por estado, búsqueda, filtro por área, tabla por persona, recordatorio individual y
  «Recordar a los que faltan (N)», exportar a **Excel** y detalle por persona (videos, intentos, firma, recordatorios).
  Acciones extra: habilitar un intento, cambiar fecha límite, marcar asistencia manual.
- **Recordatorios automáticos** (tarea diaria): cada N días, 1 día antes (con copia opcional al jefe), al vencer
  (a la persona y a los responsables); nunca a quien completó y máximo 1 automático por día.
- **Registro de asistencia** imprimible/PDF con logo, código correlativo, datos del capacitador, lista con DNI, nota y firma.
- **QR de sesión presencial** con vigencia limitada, pantalla para proyectar y contador de asistentes en vivo.
- Auditoría: cada cambio (y cada intento de acceso sin permiso) queda con fecha, hora y persona.

## Estructura

```
index.html            Página principal
assets/styles.css     Estilos (colores de docs/DISENO.md)
src/api.js            "Backend": reglas de negocio y control de permisos
src/seed.js           Datos de ejemplo
src/app.js            Menú, cabecera, notificaciones y rutas
src/vistas/           Pantallas (colaborador, administración, seguimiento)
tests/                Pruebas automáticas (npm test)
docs/                 Especificación original
prototipo/            Maqueta de referencia visual
```

## Pruebas

```bash
npm test
```

Comprueban, entre otras cosas, que un RR.HH. que no es responsable **no** puede ver el seguimiento, que no se puede
adelantar un video, los intentos del cuestionario, la firma, el QR y las reglas de recordatorios.

## Siguiente paso: integrarlo al Portal INVA real

Esta carpeta **no** contiene el código del Portal INVA. Para pasarlo a producción hay que:

1. Convertir los métodos de `src/api.js` en endpoints del servidor del portal (misma lógica y mismos controles de permisos),
   con las tablas de `docs/MODELO_DATOS.md` (migraciones, pidiendo confirmación antes de tocar producción).
2. Reemplazar el usuario de demostración por el inicio de sesión real, y el panel de firma por el componente «Mi Firma».
3. Enviar los correos con Outlook/Microsoft 365 y usar la campana de notificaciones del portal.
4. Programar la tarea diaria de recordatorios (cron) y conectar los videos (archivo, YouTube/Vimeo no listado o SharePoint).
5. Validar el formato del registro con SST (Ley 29783) y el texto de datos personales con legal (Ley 29733).
