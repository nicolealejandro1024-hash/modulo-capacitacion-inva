// Utilidades compartidas (sin dependencias del navegador, para poder probarlas en Node).

const DIA_MS = 86400000;

export const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const z = (n) => String(n).padStart(2, '0');

/** 'YYYY-MM-DD' en hora local. */
export function fechaISO(d) {
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
}

/** 'YYYY-MM-DDTHH:MM:SS' en hora local. */
export function fechaHoraISO(d) {
  return `${fechaISO(d)}T${z(d.getHours())}:${z(d.getMinutes())}:${z(d.getSeconds())}`;
}

export function sumarDias(iso, n) {
  const d = new Date(iso.slice(0, 10) + 'T12:00:00');
  d.setDate(d.getDate() + n);
  return fechaISO(d);
}

export function diasEntre(desde, hasta) {
  return Math.round((new Date(hasta.slice(0, 10) + 'T12:00:00') - new Date(desde.slice(0, 10) + 'T12:00:00')) / DIA_MS);
}

function aFecha(iso) {
  return new Date(iso.length === 10 ? iso + 'T12:00:00' : iso);
}

export function fmtFecha(iso) {
  if (!iso) return '—';
  return aFecha(iso).toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function fmtFechaLarga(iso) {
  if (!iso) return '—';
  return aFecha(iso).toLocaleDateString('es-PE', { day: 'numeric', month: 'long', year: 'numeric' });
}

export function fmtFechaHora(iso) {
  if (!iso) return '—';
  return aFecha(iso).toLocaleString('es-PE', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function fmtDuracion(seg) {
  seg = Math.max(0, Math.round(seg || 0));
  return `${Math.floor(seg / 60)}:${z(seg % 60)}`;
}

export function iniciales(nombre) {
  return String(nombre || '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join('');
}

export const ESTADOS = {
  no_inicio: { label: 'No inició', cls: 'rojo' },
  en_curso: { label: 'En curso', cls: 'naranja' },
  pendiente_firma: { label: 'Pendiente de firma', cls: 'naranja' },
  completado: { label: 'Completado', cls: 'verde' },
  vencido: { label: 'Vencido', cls: 'rojo' },
};

export const CATEGORIAS = { induccion: 'Inducción', sst: 'SST', cumplimiento: 'Cumplimiento', desarrollo: 'Desarrollo', otra: 'Otra' };
export const MODALIDADES = { virtual: 'Virtual (videos)', en_vivo: 'Virtual en vivo (Teams)', presencial: 'Presencial', mixta: 'Mixta' };
export const ESTADOS_CAP = { borrador: 'Borrador', publicada: 'Publicada', cerrada: 'Cerrada' };
export const ROLES_RESP = { propietario: 'Propietario', editor: 'Editor', solo_lectura: 'Solo lectura' };
export const MODOS_ASIGNACION = { todos: 'Todos los colaboradores', area: 'Por área', cargo: 'Por cargo', sede: 'Por sede', personas: 'Personas puntuales' };
export const TIPOS_ASISTENCIA = {
  virtual: 'Virtual (videos)',
  presencial_qr: 'Presencial (QR)',
  presencial_manual: 'Registrada por RR.HH.',
  teams: 'Lista de asistencia de Teams',
};
export const TIPOS_RECORDATORIO = {
  asignacion: 'Aviso de asignación',
  manual: 'Manual',
  automatico: 'Automático',
  dia_antes: 'Un día antes',
  vencimiento: 'Vencimiento',
  copia_jefe: 'Copia al jefe',
};
