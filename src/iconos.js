// Íconos SVG (trazo, heredan el color del texto).
const s = (d, size = 18) =>
  `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;

export const ico = {
  dashboard: s('<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>'),
  personas: s('<circle cx="9" cy="8" r="4"/><path d="M2 21c0-4 3-6 7-6s7 2 7 6"/><path d="M16 4a4 4 0 0 1 0 8M22 21c0-3-2-5-4-5.5"/>'),
  capacitaciones: s('<rect x="2" y="4" width="20" height="13" rx="2"/><path d="M10 8l5 2.5-5 2.5z"/><path d="M8 21h8"/>'),
  birrete: s('<path d="M2 9l10-5 10 5-10 5z"/><path d="M6 11v5c0 1.5 3 3 6 3s6-1.5 6-3v-5"/>'),
  campana: s('<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>', 20),
  menu: s('<path d="M3 6h18M3 12h18M3 18h18"/>', 22),
  salir: s('<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5M21 12H9"/>', 20),
  play: s('<path d="M7 4v16l13-8z" fill="currentColor"/>', 26),
  pausa: s('<path d="M7 4h3v16H7zM14 4h3v16h-3z" fill="currentColor"/>', 26),
  check: s('<path d="M20 6L9 17l-5-5"/>', 14),
  candado: s('<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>', 13),
  qr: s('<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><path d="M14 14h3v3h-3zM20 14v.01M14 20h.01M17 20h4v-3"/>'),
  descarga: s('<path d="M12 3v12M7 10l5 5 5-5M5 21h14"/>'),
  reloj: s('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'),
  camara: s('<rect x="2" y="6" width="14" height="12" rx="2"/><path d="M16 10l6-3v10l-6-3z"/>'),
  ojo: s('<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>'),
};
