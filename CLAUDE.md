# Módulo de Capacitación – Portal INVA

## Contexto
INVA Ingenieros S.A.C. (consultora de ingeniería y minería, Perú y Chile) ya tiene un **Portal INVA** interno de RR.HH.
con: Dashboard, Colaboradores, Boletas, Documentos / Firma, Novedades, Beneficios, Solicitar Documento,
Seguimiento, Solicitudes Permiso y la sección "Mi cuenta" (Mis Boletas, Mis Documentos, Mi Firma, etc.).
Hay dos roles visibles: **Administrador RR.HH.** y **Colaborador**.

Queremos agregar un módulo nuevo: **Capacitaciones**.

## Qué tiene que hacer el módulo (resumen)
1. RR.HH. crea capacitaciones (inducción, SST, ética, etc.) con videos, un cuestionario y fecha límite, y las asigna.
2. El colaborador ve sus capacitaciones, mira los videos en orden, responde el cuestionario y **firma** su asistencia.
3. RR.HH. ve quién vio, quién respondió (con nota), quién falta, y envía **recordatorios** (manuales y automáticos).
4. **Permisos por capacitación**: cada capacitación tiene sus responsables y SOLO ellos ven su seguimiento
   (ser Administrador RR.HH. no basta). Ver `docs/PERMISOS.md`.
5. Se genera el **registro de asistencia** descargable (PDF/Excel) con firma, útil para inspecciones de SST.

Detalle completo en `docs/`.

## Cómo trabajar en este proyecto (instrucciones para Claude Code)
1. **Primero explora el código existente del Portal INVA** antes de escribir nada:
   identifica el stack (framework, base de datos, ORM, autenticación, cómo se envían correos y notificaciones,
   cómo funciona hoy "Mi Firma" y "Seguimiento"). Resume lo que encontraste y propón un plan antes de codificar.
2. **Reutiliza** lo que ya existe: login/roles, el componente de firma, el sistema de notificaciones (campana),
   el layout con barra lateral y los estilos actuales. No crees un sistema paralelo.
3. Sigue el estilo visual del portal (ver `docs/DISENO.md` y la carpeta `prototipo/`).
4. Trabaja por fases (ver `docs/PLAN_FASES.md`). Al terminar cada fase, explica qué se hizo y cómo probarlo.
5. No inventes datos de la empresa: preguntas de cuestionario, plazos y textos legales son ejemplos editables.
6. Todo el texto de la interfaz va en **español**.
7. Antes de tocar la base de datos de producción, crea migraciones y pídeme confirmación.

## Archivos de referencia
- `docs/ESPECIFICACION.md` – funcionalidades por rol
- `docs/MODELO_DATOS.md` – tablas sugeridas
- `docs/PERMISOS.md` – quién ve cada capacitación y su seguimiento
- `docs/FLUJOS.md` – flujo del colaborador y de RR.HH.
- `docs/REGISTRO_ASISTENCIA.md` – registro de asistencia, firma y QR
- `docs/RECORDATORIOS.md` – reglas de alertas
- `docs/DISENO.md` – colores, tipografía y componentes
- `docs/PLAN_FASES.md` – orden de implementación
- `prototipo/` – maqueta clickeable (referencia visual, no código de producción)
- `datos-ejemplo/` – JSON de ejemplo (capacitación + cuestionario)
- `PROMPT_INICIAL.md` – el primer mensaje para pegar en Claude Code
