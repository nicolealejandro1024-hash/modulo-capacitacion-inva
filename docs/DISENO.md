# Diseño (basado en el Portal INVA actual)

> Si el código del portal ya tiene variables de color, componentes o librería de UI, usar esos y no estos valores.

## Colores aproximados
| uso | color |
|---|---|
| Barra superior y lateral | #151B27 |
| Texto sobre fondo oscuro | #D5DAE2 / secundario #A7AFBD |
| Fondo de contenido | #F5F6F8 |
| Tarjetas | #FFFFFF, borde #E4E7EC, radio 14–16 px |
| Acento naranja (botón principal, ítem activo) | #B9550F (texto blanco). El naranja claro del portal (#E8762D) solo para barras/íconos, porque con texto blanco no tiene buen contraste |
| Texto principal | #151B27 / secundario #4A5363 |
| Estado completado | fondo #E6F4EC, texto #1E6B41 |
| Estado en curso | fondo #FFF1E6, texto #9A4310 |
| Estado no inició / vencido | fondo #FCE8E8, texto #9B2C2C |

## Componentes nuevos
- Tarjeta de capacitación (miniatura, etiqueta, estado, título, descripción, meta, barra de avance, fecha, botón)
- Reproductor + lista de contenido
- Pregunta de cuestionario con opciones tipo botón (radio)
- Pantalla de firma (reutilizar "Mi Firma")
- KPIs de seguimiento, filtros tipo píldora, tabla con acción por fila
- Interruptor de recordatorios automáticos
- Sección "Responsables" (buscar persona + rol)
- Pantalla de QR para proyectar

## Accesibilidad
Botones reales (`<button>`), áreas de clic de al menos 44 px, contraste de texto 4.5:1, funciona en celular
(muchos colaboradores lo verán desde obra).

## Prototipo
En `prototipo/` están las dos pantallas maquetadas (Colaborador y Seguimiento RR.HH.).
Son archivos de referencia visual del editor de diseño de Claude: úsalos para copiar estructura, textos y estilos.
También existe la versión clickeable en el canvas "Módulo Capacitación – Portal INVA" en claude.ai.
