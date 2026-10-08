// Lectura del "Informe de asistencia" que descarga Microsoft Teams (CSV o Excel).
// Teams lo genera en UTF-16 separado por tabulaciones, con secciones ("1. Resumen", "2. Participantes", ...).
// También acepta el formato antiguo (Nombre completo / Acción del usuario / Marca de tiempo) y archivos en inglés.
// Sin dependencias del navegador, para poder probarlo en Node.

export function normalizar(s) {
  return String(s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\(.*?\)/g, ' ')
    .toLowerCase()
    .replace(/[^a-z0-9@._\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Texto del archivo según su codificación (Teams usa UTF-16 LE). */
export function decodificar(buffer) {
  const b = new Uint8Array(buffer);
  if (b[0] === 0xff && b[1] === 0xfe) return new TextDecoder('utf-16le').decode(b.subarray(2));
  if (b[0] === 0xfe && b[1] === 0xff) return new TextDecoder('utf-16be').decode(b.subarray(2));
  // UTF-16 sin BOM: muchos bytes 0 en posiciones impares.
  let ceros = 0;
  for (let i = 1; i < Math.min(b.length, 400); i += 2) if (b[i] === 0) ceros++;
  if (ceros > 50) return new TextDecoder('utf-16le').decode(b);
  return new TextDecoder('utf-8').decode(b).replace(/^﻿/, '');
}

/** Convierte texto delimitado (tab, ; o ,) en filas de celdas. Respeta comillas. */
export function aFilas(texto) {
  const lineas = texto.split(/\r?\n/);
  const muestra = lineas.slice(0, 40).join('\n');
  const delim = ['\t', ';', ','].map((d) => [d, muestra.split(d).length]).sort((a, b) => b[1] - a[1])[0][0];
  return lineas.map((linea) => {
    const celdas = [];
    let actual = '';
    let comillas = false;
    for (let i = 0; i < linea.length; i++) {
      const c = linea[i];
      if (c === '"') {
        if (comillas && linea[i + 1] === '"') {
          actual += '"';
          i++;
        } else comillas = !comillas;
      } else if (c === delim && !comillas) {
        celdas.push(actual.trim());
        actual = '';
      } else actual += c;
    }
    celdas.push(actual.trim());
    return celdas;
  });
}

const COL = {
  nombre: /^(nombre|nombre completo|name|full name|participante|participant)$/,
  correo: /(correo|e-?mail)/,
  upn: /(upn|participant id|id\.? de participante)/,
  ingreso: /^(primer|first|hora de union|join)/,
  salida: /^(ultim|last|leave)/,
  duracion: /(duracion|duration)/,
  accion: /(accion del usuario|user action|accion)/,
  marca: /(marca de tiempo|timestamp|fecha y hora)/,
};

/**
 * Extrae los participantes de las filas del informe.
 * Devuelve [{ nombre, correo, ingreso, duracion }] (una entrada por persona).
 */
export function participantesDesdeFilas(filas) {
  let iCab = -1;
  let cols = null;
  for (let i = 0; i < filas.length; i++) {
    const cab = filas[i].map(normalizar);
    const iNombre = cab.findIndex((c) => COL.nombre.test(c));
    if (iNombre < 0) continue;
    const buscar = (re) => cab.findIndex((c, j) => j !== iNombre && re.test(c));
    const c = { nombre: iNombre, correo: buscar(COL.correo), upn: buscar(COL.upn), ingreso: buscar(COL.ingreso), salida: buscar(COL.salida), duracion: buscar(COL.duracion), accion: buscar(COL.accion), marca: buscar(COL.marca) };
    // Debe parecer la tabla de participantes (no la de resumen).
    if (c.correo >= 0 || c.upn >= 0 || c.ingreso >= 0 || c.duracion >= 0 || c.accion >= 0) {
      iCab = i;
      cols = c;
      break;
    }
  }
  if (iCab < 0) throw new Error('No encontré la lista de participantes. Sube el «Informe de asistencia» que descargas desde Teams (.csv o .xlsx).');

  const porPersona = new Map();
  for (const fila of filas.slice(iCab + 1)) {
    const nombre = (fila[cols.nombre] || '').trim();
    if (!nombre) {
      if (porPersona.size) break; // fin de la sección de participantes
      continue;
    }
    if (/^\d+\.\s/.test(nombre) && fila.filter(Boolean).length === 1) break; // siguiente sección ("3. Actividades...")
    const correoCelda = cols.correo >= 0 ? fila[cols.correo] : '';
    const upn = cols.upn >= 0 ? fila[cols.upn] : '';
    const correo = [correoCelda, upn].find((x) => /@/.test(x || '')) || '';
    const accion = cols.accion >= 0 ? normalizar(fila[cols.accion]) : '';
    if (accion && /(left|salio|abandon)/.test(accion)) {
      if (!porPersona.has(normalizar(correo || nombre))) continue;
    }
    const clave = normalizar(correo || nombre);
    if (porPersona.has(clave)) continue;
    porPersona.set(clave, {
      nombre,
      correo: correo.trim(),
      ingreso: (cols.ingreso >= 0 ? fila[cols.ingreso] : cols.marca >= 0 ? fila[cols.marca] : '') || '',
      duracion: (cols.duracion >= 0 ? fila[cols.duracion] : '') || '',
    });
  }
  if (!porPersona.size) throw new Error('El archivo no tiene participantes.');
  return [...porPersona.values()];
}

/** Busca a la persona del portal que corresponde a un participante de Teams (por correo y, si no, por nombre). */
export function emparejar(participante, usuarios) {
  const correo = normalizar(participante.correo);
  if (correo) {
    const u = usuarios.find((x) => normalizar(x.correo) === correo);
    if (u) return { usuario: u, por: 'correo' };
  }
  // "Quispe, Andrés" / "Andrés Quispe (Invitado)" / "andres.quispe"
  const tokens = (s) => normalizar(s).replace(/[.,_-]/g, ' ').split(' ').filter((t) => t.length > 1);
  const tp = tokens(participante.nombre);
  if (tp.length < 2) return null;
  const candidatos = usuarios.filter((u) => {
    const tu = tokens(u.nombre);
    const comunes = tu.filter((t) => tp.includes(t)).length;
    return comunes >= 2 && (comunes === tu.length || comunes === tp.length);
  });
  return candidatos.length === 1 ? { usuario: candidatos[0], por: 'nombre' } : null;
}
