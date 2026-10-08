// Pantallas del rol Colaborador: Mis Capacitaciones, reproductor, cuestionario, firma y asistencia por QR.
import { api, sesion, app, navegar, toast, intentar } from '../contexto.js';
import { esc, fmtFecha, fmtFechaLarga, fmtFechaHora, fmtDuracion, diasEntre, ESTADOS, CATEGORIAS, MODALIDADES } from '../util.js';
import { ico } from '../iconos.js';
import { crearPanelFirma } from '../firma.js';

export function pillEstado(r) {
  const e = ESTADOS[r.estado];
  const txt = r.estado === 'en_curso' ? `${e.label} (${r.porcentaje} %)` : e.label;
  return `<span class="pill ${e.cls}">${esc(txt)}</span>`;
}

function textoVence(asig, r) {
  if (r.firmado) return `Completado el ${fmtFecha(r.firmadoEn)}`;
  const dias = diasEntre(api.hoy(), asig.fecha_limite);
  if (dias < 0) return `Venció el ${fmtFecha(asig.fecha_limite)}`;
  if (dias === 0) return 'Vence hoy';
  if (dias === 1) return 'Vence mañana';
  return `Vence el ${fmtFecha(asig.fecha_limite)}`;
}

function proximaReunion(cap, ahora) {
  const reus = (cap.reuniones || []).slice().sort((a, b) => `${a.fecha}${a.hora_inicio}`.localeCompare(`${b.fecha}${b.hora_inicio}`));
  return reus.find((r) => `${r.fecha}T${r.hora_fin}:00` >= ahora) || null;
}

function metaCap(cap) {
  const partes = [];
  if (cap.modalidad === 'en_vivo') {
    const prox = proximaReunion(cap, api.marca());
    partes.push(prox ? `En vivo por Teams · ${fmtFecha(prox.fecha)} ${prox.hora_inicio}` : 'En vivo por Teams');
  } else {
    if (cap.videos.length) partes.push(`${cap.videos.length} video${cap.videos.length > 1 ? 's' : ''}`);
    if (cap.modalidad !== 'virtual') partes.push(MODALIDADES[cap.modalidad]);
  }
  partes.push(`${cap.duracion_min} min`);
  if (cap.preguntas.length) partes.push('cuestionario');
  return partes.join(' · ');
}

// ───────────────────────── Lista ─────────────────────────
export function vistaMisCapacitaciones() {
  const lista = api.misCapacitaciones(sesion.uid);
  const completadas = lista.filter((x) => x.resumen.estado === 'completado').length;
  const cards = lista
    .map(({ asignacion: a, capacitacion: c, resumen: r }) => {
      const cta = r.estado === 'completado' ? 'Ver de nuevo' : r.estado === 'pendiente_firma' ? 'Firmar' : r.porcentaje > 0 || r.presencialOk ? 'Continuar' : 'Comenzar';
      return `
      <article class="card-cap">
        <div class="mini ${esc(c.categoria)}">
          <span class="tag">${c.obligatoria ? 'Obligatoria' : 'Opcional'} · ${esc(CATEGORIAS[c.categoria])}</span>
          <span class="play" aria-hidden="true">${c.modalidad === 'presencial' ? ico.qr : c.modalidad === 'en_vivo' ? ico.camara : ico.play}</span>
        </div>
        <div class="info">
          <div>${pillEstado(r)}</div>
          <h2>${esc(c.titulo)}</h2>
          <p>${esc(c.descripcion)}</p>
          <span class="meta">${esc(metaCap(c))}</span>
          <div class="barra ${r.estado === 'completado' ? 'verde' : ''}" role="progressbar" aria-valuenow="${r.porcentaje}" aria-valuemin="0" aria-valuemax="100" aria-label="Avance"><div style="width:${r.porcentaje}%"></div></div>
          <div class="pie">
            <span class="small ${r.estado === 'vencido' ? '' : 'muted'}" style="${r.estado === 'vencido' ? 'color:var(--rojo);font-weight:700' : ''}">${esc(textoVence(a, r))}</span>
            <a class="btn btn-oscuro" href="#/mis-capacitaciones/${esc(a.id)}">${cta}</a>
          </div>
        </div>
      </article>`;
    })
    .join('');

  return {
    titulo: 'Mis capacitaciones',
    html: `
    <div class="cab"><div>
      <h1>Mis capacitaciones</h1>
      <p class="sub">Mira los videos de cada capacitación y, al terminar, responde el cuestionario y firma tu asistencia. RR.HH. recibe tu resultado automáticamente.</p>
    </div></div>
    <div class="kpis" style="grid-template-columns:repeat(3,minmax(0,1fr))">
      <div class="kpi"><span class="et">Asignadas</span><span class="num">${lista.length}</span></div>
      <div class="kpi ok"><span class="et">Completadas</span><span class="num">${completadas}</span></div>
      <div class="kpi alerta"><span class="et">Por completar</span><span class="num">${lista.length - completadas}</span></div>
    </div>
    ${lista.length ? `<div class="grid-cards">${cards}</div>` : `<div class="tarjeta vacio">${ico.birrete}<b>No tienes capacitaciones asignadas.</b><span>Cuando RR.HH. te asigne una, aparecerá aquí y te llegará un aviso.</span></div>`}
    <details class="tarjeta">
      <summary style="cursor:pointer;font-weight:700">¿Qué datos registramos y para qué?</summary>
      <p class="muted small" style="margin-top:10px">Para acreditar tu capacitación registramos: el avance de cada video (inicio, hasta dónde llegaste y cuándo terminaste), tus respuestas y nota del cuestionario, tu firma de asistencia con fecha y hora, y los recordatorios que se te enviaron. Solo tú y las personas responsables de cada capacitación pueden ver esta información. Se usa para el registro de asistencia exigido en Seguridad y Salud en el Trabajo y se trata conforme a la Ley N.° 29733 de Protección de Datos Personales. <em>(Texto de ejemplo: validar con el área legal).</em></p>
    </details>`,
  };
}

// ───────────────────────── Curso (reproductor / cuestionario / firma) ─────────────────────────
export function vistaCurso(asigId, query) {
  const uid = sesion.uid;
  const d = api.miCapacitacion(uid, asigId);
  const { capacitacion: cap, resumen: r, asignacion: asig } = d;
  const prog = (vid) => d.progreso.find((p) => p.video_id === vid);
  const terminado = (vid) => !!prog(vid)?.terminado_en;
  const cerrada = cap.estado === 'cerrada';

  // Pasos del índice
  const pasos = [];
  const enVivo = cap.modalidad === 'en_vivo';
  if (enVivo)
    pasos.push({ id: 'reunion', titulo: 'Reunión en Teams', sub: r.ingresoReunion ? `Ingresaste ${fmtFechaHora(r.ingresoReunion)}` : r.reunionIniciada ? 'Ya comenzó' : 'Fecha y enlace', ok: r.reunionIniciada || !!r.ingresoReunion, accesible: true, num: '▶' });
  if (cap.modalidad !== 'presencial') {
    cap.videos.forEach((v, i) => {
      const accesible = i === 0 || terminado(cap.videos[i - 1].id);
      pasos.push({ id: `v:${v.id}`, titulo: v.titulo, sub: `${enVivo ? 'Opcional · ' : ''}Video ${i + 1} · ${fmtDuracion(v.duracion_seg)}`, ok: terminado(v.id), accesible, num: i + 1, opcional: enVivo });
    });
  }
  if (cap.modalidad === 'presencial' || cap.modalidad === 'mixta')
    pasos.push({ id: 'asistencia', titulo: 'Asistencia presencial', sub: r.presencialOk ? 'Registrada' : cap.modalidad === 'mixta' ? 'Escanea el QR o mira los videos' : 'Escanea el QR en la charla', ok: r.presencialOk, accesible: true, num: '⌖' });
  if (r.tieneCuestionario)
    pasos.push({ id: 'cuestionario', titulo: 'Cuestionario', sub: r.aprobado ? `Aprobado · ${r.mejorNota}/${r.totalPreguntas}` : `${r.totalPreguntas} preguntas`, ok: r.aprobado, accesible: r.contenidoOk, num: '?' });
  pasos.push({ id: 'firma', titulo: 'Firma de asistencia', sub: r.firmado ? `Firmado ${fmtFecha(r.firmadoEn)}` : 'Declaración y firma', ok: r.firmado, accesible: r.contenidoOk && r.cuestionarioOk, num: '✎' });

  let paso = query.get('paso');
  const elegido = pasos.find((p) => p.id === paso);
  if (!elegido || !elegido.accesible) {
    if (r.firmado) paso = 'fin';
    else paso = (pasos.find((p) => p.accesible && !p.ok && !p.opcional) || pasos[pasos.length - 1]).id;
  }

  const enlacePaso = (id) => `#/mis-capacitaciones/${asigId}?paso=${encodeURIComponent(id)}`;
  const indice = pasos
    .map(
      (p) => `
      <a class="paso" href="${p.accesible ? enlacePaso(p.id) : '#'}" ${p.id === paso ? 'aria-current="step"' : ''} ${p.accesible ? '' : 'aria-disabled="true" tabindex="-1" onclick="return false"'}>
        <span class="ico ${p.ok ? 'ok' : ''}">${p.ok ? ico.check : p.accesible ? esc(p.num) : ico.candado}</span>
        <span class="txt"><b>${esc(p.titulo)}</b><span>${esc(p.sub)}</span></span>
      </a>`
    )
    .join('');

  let avisos = '';
  if (cerrada) avisos += `<div class="aviso warn">Esta capacitación está cerrada. Puedes revisar tu avance, pero ya no registrar nuevas actividades.</div>`;
  else if (r.estado === 'vencido') avisos += `<div class="aviso error">La fecha límite venció el ${esc(fmtFecha(asig.fecha_limite))}. Aún puedes completarla; quedará registrada fuera de plazo.</div>`;

  let contenido = '';
  let montar = () => {};
  if (paso.startsWith('v:')) ({ contenido, montar } = panelVideo(cap, asigId, paso.slice(2), d, cerrada));
  else if (paso === 'asistencia') contenido = panelAsistencia(cap, d);
  else if (paso === 'reunion') ({ contenido, montar } = panelReunion(cap, asigId, d));
  else if (paso === 'cuestionario') ({ contenido, montar } = panelCuestionario(cap, asigId, d, query, cerrada));
  else if (paso === 'firma') ({ contenido, montar } = panelFirma(cap, asigId, d, cerrada));
  else contenido = panelFin(cap, d);

  return {
    titulo: cap.titulo,
    html: `
      <a class="volver" href="#/mis-capacitaciones">← Volver a mis capacitaciones</a>
      <div class="cab"><div>
        <span class="small" style="color:var(--naranja-tx);font-weight:800;letter-spacing:1px">${esc((CATEGORIAS[cap.categoria] + ' · ' + (cap.obligatoria ? 'Obligatoria' : 'Opcional')).toUpperCase())}</span>
        <h1>${esc(cap.titulo)}</h1>
        <p class="muted small">${esc(metaCap(cap))}${cap.capacitador_nombre ? ' · Capacitador: ' + esc(cap.capacitador_nombre) : ''} · ${esc(textoVence(asig, r))}</p>
      </div><div>${pillEstado(r)}</div></div>
      ${avisos}
      <div class="curso">
        <div class="principal">${contenido}${panelPreguntas(asigId)}</div>
        <nav class="indice" aria-label="Contenido de la capacitación"><h2>Contenido</h2>${indice}
          <div style="padding:10px 12px"><div class="barra" aria-hidden="true"><div style="width:${r.porcentaje}%"></div></div><span class="small muted">${r.porcentaje} % completado</span></div>
        </nav>
      </div>`,
    montar: (root) => {
      montar(root);
      montarPreguntas(root, asigId);
    },
  };
}

// ───────────────────────── ¿Tienes alguna pregunta? ─────────────────────────
function panelPreguntas(asigId) {
  const consultas = api.misConsultas(sesion.uid, asigId);
  const lista = consultas
    .map(
      (q) => `<div class="consulta">
        <p><b>Tu pregunta</b> <span class="small muted">· ${esc(fmtFechaHora(q.creado_en))}</span></p>
        <p>${esc(q.texto)}</p>
        ${
          q.respuesta
            ? `<div class="respuesta"><p class="small"><b>Respuesta de ${esc(q.respondido_por_nombre || 'RR.HH.')}</b> <span class="muted">· ${esc(fmtFechaHora(q.respondido_en))}</span></p><p>${esc(q.respuesta)}</p></div>`
            : '<span class="pill naranja" style="align-self:flex-start">Esperando respuesta</span>'
        }
      </div>`
    )
    .join('');
  return `<section class="tarjeta pila" id="preguntas" aria-labelledby="preguntas-t">
    <div><h2 id="preguntas-t">¿Tienes alguna pregunta?</h2><p class="muted small">Escribe tu duda sobre esta capacitación. Le llega a las personas responsables y te avisaremos cuando te respondan.</p></div>
    <form class="pila" id="form-pregunta">
      <label class="sr-only" for="txt-pregunta">Tu pregunta</label>
      <textarea id="txt-pregunta" maxlength="1000" placeholder="Ej.: No entendí la parte de… / ¿Dónde encuentro…?" required></textarea>
      <button class="btn btn-oscuro" style="align-self:flex-start">Enviar pregunta</button>
    </form>
    ${lista ? `<div class="pila">${lista}</div>` : ''}
  </section>`;
}

function montarPreguntas(root, asigId) {
  root.querySelector('#form-pregunta')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const txt = root.querySelector('#txt-pregunta');
    if (intentar(() => api.enviarConsulta(sesion.uid, asigId, txt.value), 'Pregunta enviada. Te avisaremos cuando te respondan.')) {
      const [base, qs] = location.hash.split('?');
      const params = new URLSearchParams(qs || '');
      params.delete('resultado');
      navegar(`${base}?${params}`.replace(/\?$/, ''));
      setTimeout(() => document.getElementById('preguntas')?.scrollIntoView({ block: 'start' }), 50);
    }
  });
}

const esVideoDirecto = (url) => /\.(mp4|webm|ogg|mov)(\?|#|$)/i.test(url || '');

function panelVideo(cap, asigId, videoId, d, cerrada) {
  const idx = cap.videos.findIndex((v) => v.id === videoId);
  const v = cap.videos[idx];
  const p = d.progreso.find((x) => x.video_id === v.id);
  const yaTerminado = !!p?.terminado_en;
  const siguiente = cap.videos[idx + 1];
  const directo = esVideoDirecto(v.url);
  const urlExterna = v.url && !directo;
  let destinoSiguiente = '';
  if (siguiente) destinoSiguiente = `<a class="btn btn-primario" href="#/mis-capacitaciones/${asigId}?paso=${encodeURIComponent('v:' + siguiente.id)}">Siguiente: ${esc(siguiente.titulo)} →</a>`;
  else if (cap.preguntas.length) destinoSiguiente = `<a class="btn btn-primario" href="#/mis-capacitaciones/${asigId}?paso=cuestionario">Ir al cuestionario →</a>`;
  else destinoSiguiente = `<a class="btn btn-primario" href="#/mis-capacitaciones/${asigId}?paso=firma">Ir a firmar →</a>`;

  const contenido = `
    <div class="player" id="player">
      ${
        directo
          ? `<video id="vid" src="${esc(v.url)}" controls playsinline preload="metadata" controlslist="nodownload noplaybackrate"></video>`
          : `<div class="lienzo">
              <span class="s">Video ${idx + 1} de ${cap.videos.length}</span>
              <span class="t">${esc(v.titulo)}</span>
              <button class="big-play" id="btn-play" aria-label="Reproducir">${ico.play}</button>
              <span class="s">${urlExterna ? 'Vista de demostración (los videos de YouTube, Vimeo o SharePoint se conectan al integrar con el portal)' : 'Video de demostración (aún no se cargó el archivo real)'}</span>
            </div>
            <div class="controles">
              <div class="linea" id="linea" role="slider" aria-label="Posición del video" tabindex="0" aria-valuemin="0" aria-valuemax="${v.duracion_seg}"><div class="visto" id="visto"></div><div class="pos" id="pos"></div></div>
              <div class="fila-ctrl">
                <button id="btn-play2" aria-label="Reproducir o pausar">▶︎ / ❚❚</button>
                <button id="btn-atras" aria-label="Retroceder 10 segundos">↺ 10 s</button>
                <span id="tiempo" style="flex:1">0:00 / ${fmtDuracion(v.duracion_seg)}</span>
                <label class="sr-only" for="vel">Velocidad</label>
                <select id="vel"><option value="1">1×</option><option value="1.5">1,5×</option><option value="2">2×</option><option value="16">16× (demo)</option></select>
              </div>
            </div>`
      }
    </div>
    <div class="tarjeta pila">
      <div class="fila" style="justify-content:space-between">
        <div><h2>${esc(v.titulo)}</h2><span class="small muted">Video ${idx + 1} de ${cap.videos.length} · ${fmtDuracion(v.duracion_seg)}</span></div>
        <span id="estado-video">${yaTerminado ? `<span class="pill verde">✓ Visto</span>` : `<span class="pill gris">Sin terminar</span>`}</span>
      </div>
      <p class="muted small">No se puede adelantar más allá de lo que ya viste. Tu avance se guarda automáticamente: si sales, continúas donde te quedaste.</p>
      <div id="siguiente" ${yaTerminado ? '' : 'hidden'}>${destinoSiguiente}</div>
    </div>`;

  const montar = (root) => {
    if (cerrada) return;
    const dur = v.duracion_seg;
    let maxVisto = p?.segundos_vistos_max || 0;
    let terminadoLocal = yaTerminado;
    let ultimoReporte = maxVisto;

    const reportar = (forzar = false) => {
      if (!forzar && maxVisto - ultimoReporte < 1) return;
      try {
        const res = api.registrarProgresoVideo(sesion.uid, asigId, v.id, maxVisto);
        maxVisto = Math.min(maxVisto, res.segundos_vistos_max + 0.5);
        ultimoReporte = res.segundos_vistos_max;
        if (res.terminado_en && !terminadoLocal) {
          terminadoLocal = true;
          toast('¡Video terminado!', 'ok');
          root.querySelector('#estado-video').innerHTML = '<span class="pill verde">✓ Visto</span>';
          root.querySelector('#siguiente').hidden = false;
          // Re-dibuja el índice para desbloquear el siguiente paso, sin perder la posición.
          setTimeout(() => navegar(`#/mis-capacitaciones/${asigId}?paso=${encodeURIComponent('v:' + v.id)}`), 600);
        }
      } catch (e) {
        toast(e.message, 'error');
      }
    };

    if (directo) {
      const vid = root.querySelector('#vid');
      let maxReal = 0;
      vid.addEventListener('loadedmetadata', () => {
        maxReal = (maxVisto / dur) * vid.duration;
        if (!terminadoLocal && maxReal > 1) vid.currentTime = Math.max(0, maxReal - 1);
      });
      vid.addEventListener('timeupdate', () => {
        if (!vid.duration) return;
        if (vid.currentTime > maxReal + 1.5 && !terminadoLocal) {
          vid.currentTime = maxReal;
          toast('No puedes adelantar el video.');
          return;
        }
        if (vid.currentTime > maxReal) maxReal = vid.currentTime;
        maxVisto = Math.max(maxVisto, (maxReal / vid.duration) * dur);
        reportar();
      });
      vid.addEventListener('ended', () => {
        maxVisto = dur;
        reportar(true);
      });
      app.limpiezas.push(() => vid.pause());
      return;
    }

    // Reproductor simulado (cuando no hay archivo de video real).
    let pos = terminadoLocal ? 0 : maxVisto >= dur ? 0 : maxVisto;
    let reproduciendo = false;
    let vel = 1;
    let ultimoTick = performance.now();
    const $ = (s) => root.querySelector(s);
    const pintar = () => {
      $('#pos').style.width = `${(pos / dur) * 100}%`;
      $('#visto').style.width = `${(Math.max(maxVisto, pos) / dur) * 100}%`;
      $('#tiempo').textContent = `${fmtDuracion(pos)} / ${fmtDuracion(dur)}`;
      $('#linea').setAttribute('aria-valuenow', Math.round(pos));
      $('#btn-play').innerHTML = reproduciendo ? ico.pausa : ico.play;
      $('#btn-play').setAttribute('aria-label', reproduciendo ? 'Pausar' : 'Reproducir');
    };
    const alternar = () => {
      if (pos >= dur) pos = 0;
      reproduciendo = !reproduciendo;
      ultimoTick = performance.now();
      pintar();
    };
    const timer = setInterval(() => {
      const ahora = performance.now();
      const dt = Math.min(1, (ahora - ultimoTick) / 1000);
      ultimoTick = ahora;
      if (!reproduciendo) return;
      pos = Math.min(dur, pos + dt * vel);
      if (pos > maxVisto) maxVisto = pos;
      if (pos >= dur) reproduciendo = false;
      reportar(pos >= dur);
      pintar();
    }, 250);
    app.limpiezas.push(() => {
      clearInterval(timer);
      if (!terminadoLocal) reportar(true);
    });
    $('#btn-play').addEventListener('click', alternar);
    $('#btn-play2').addEventListener('click', alternar);
    $('#btn-atras').addEventListener('click', () => {
      pos = Math.max(0, pos - 10);
      pintar();
    });
    $('#vel').addEventListener('change', (e) => (vel = Number(e.target.value)));
    const buscar = (destino) => {
      if (destino > maxVisto + 0.5 && !terminadoLocal) {
        destino = maxVisto;
        toast('No puedes adelantar más allá de lo que ya viste.');
      }
      pos = Math.max(0, Math.min(dur, destino));
      pintar();
    };
    $('#linea').addEventListener('click', (e) => {
      const r = e.currentTarget.getBoundingClientRect();
      buscar(((e.clientX - r.left) / r.width) * dur);
    });
    $('#linea').addEventListener('keydown', (e) => {
      if (e.key === 'ArrowLeft') buscar(pos - 5);
      if (e.key === 'ArrowRight') buscar(pos + 5);
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        alternar();
      }
    });
    pintar();
  };
  return { contenido, montar };
}

function panelReunion(cap, asigId, d) {
  const r = d.resumen;
  const ahora = api.marca();
  const reus = (cap.reuniones || []).slice().sort((a, b) => `${a.fecha}${a.hora_inicio}`.localeCompare(`${b.fecha}${b.hora_inicio}`));
  const filas = reus
    .map((x) => {
      const inicio = `${x.fecha}T${x.hora_inicio}:00`;
      const fin = `${x.fecha}T${x.hora_fin}:00`;
      const abre = new Date(new Date(inicio).getTime() - 15 * 60000);
      const pasada = ahora > fin;
      const abierta = !pasada && new Date(ahora) >= abre;
      return `<div class="consulta">
        <div class="fila" style="justify-content:space-between">
          <div><b>${esc(fmtFechaLarga(x.fecha))}</b><br><span class="muted">${esc(x.hora_inicio)} a ${esc(x.hora_fin)} · Microsoft Teams</span></div>
          ${
            pasada
              ? '<span class="pill gris">Ya terminó</span>'
              : abierta
                ? `<button class="btn btn-primario" data-unirse="${esc(x.id)}">${ico.camara} Unirme a la reunión</button>`
                : '<span class="pill naranja">El botón se activa 15 min antes</span>'
          }
        </div></div>`;
    })
    .join('');
  const siguiente = r.contenidoOk
    ? r.tieneCuestionario
      ? `<a class="btn btn-primario" href="#/mis-capacitaciones/${asigId}?paso=cuestionario" style="align-self:flex-start">Responder el cuestionario →</a>`
      : `<a class="btn btn-primario" href="#/mis-capacitaciones/${asigId}?paso=firma" style="align-self:flex-start">Ir a firmar →</a>`
    : '';
  const contenido = `<div class="tarjeta pila">
    <h2>Reunión en vivo por Teams</h2>
    <p>Esta capacitación se dicta en una reunión de Microsoft Teams. Elige el horario que te acomode y entra con el botón <b>«Unirme a la reunión»</b>.</p>
    ${r.ingresoReunion ? `<div class="aviso ok">✓ Ingresaste a la reunión el ${esc(fmtFechaHora(r.ingresoReunion))}.</div>` : ''}
    <div class="pila">${filas || '<p class="muted">RR.HH. aún no publica la fecha de la reunión.</p>'}</div>
    <div class="aviso info">${r.tieneCuestionario ? 'Al terminar, responde el <b>&nbsp;cuestionario&nbsp;</b> y firma tu asistencia. El cuestionario se habilita cuando empieza la reunión.' : 'Al terminar, firma tu asistencia.'}</div>
    ${cap.videos.length ? '<p class="muted small">¿No pudiste conectarte? Puedes ver la grabación en el índice de contenido.</p>' : ''}
    ${siguiente}
  </div>`;
  const montar = (root) => {
    root.querySelectorAll('[data-unirse]').forEach((b) =>
      b.addEventListener('click', () => {
        const enlace = intentar(() => api.unirseReunion(sesion.uid, asigId, b.dataset.unirse, navigator.userAgent));
        if (enlace) {
          window.open(enlace, '_blank', 'noopener');
          app.refrescar();
        }
      })
    );
  };
  return { contenido, montar };
}

function panelAsistencia(cap, d) {
  const a = d.asistencia;
  if (d.resumen.presencialOk)
    return `<div class="tarjeta pila"><h2>Asistencia presencial</h2>
      <div class="aviso ok">✓ Tu asistencia quedó registrada el ${esc(fmtFechaHora(a.registrado_en))} ${a.tipo === 'presencial_qr' ? '(con código QR)' : '(registrada por RR.HH.)'}.</div>
      ${d.resumen.cuestionarioOk ? `<a class="btn btn-primario" href="#/mis-capacitaciones/${d.asignacion.id}?paso=firma">Ir a firmar →</a>` : `<a class="btn btn-primario" href="#/mis-capacitaciones/${d.asignacion.id}?paso=cuestionario">Responder el cuestionario →</a>`}
    </div>`;
  return `<div class="tarjeta pila"><h2>Asistencia presencial</h2>
    <p>Esta capacitación es <b>${esc(MODALIDADES[cap.modalidad].toLowerCase())}</b>${cap.lugar ? ` y se dicta en <b>${esc(cap.lugar)}</b>` : ''}.</p>
    <ol class="muted" style="margin:0;padding-left:20px">
      <li>Asiste a la charla.</li>
      <li>Escanea con tu celular el <b>código QR</b> que proyecta RR.HH.</li>
      <li>Confirma tu asistencia con tu usuario del portal.</li>
      <li>${cap.preguntas.length ? 'Responde el cuestionario y firma.' : 'Firma tu asistencia.'}</li>
    </ol>
    ${cap.modalidad === 'mixta' ? '<p class="muted small">También puedes completarla viendo los videos.</p>' : ''}
    <p class="muted small">¿No tienes celular? Pide a RR.HH. que marque tu asistencia; luego firmas aquí.</p>
  </div>`;
}

function panelCuestionario(cap, asigId, d, query, cerrada) {
  const r = d.resumen;
  const res = d.ultimoResultado;
  const verResultado = res && (r.aprobado || query.get('resultado') === '1' || (!query.get('nuevo') && r.intentosUsados > 0));
  const quedan = r.intentosRestantes === null ? 'Intentos ilimitados' : `Te quedan ${r.intentosRestantes} intento${r.intentosRestantes === 1 ? '' : 's'}`;

  if (verResultado) {
    const detalle = res.detalle
      ? cap.preguntas
          .map((p) => {
            const det = res.detalle.find((x) => x.pregunta_id === p.id);
            const clase = (i) => (i === det.correcta || (i === det.elegida && det.acerto) ? 'correcta' : i === det.elegida ? 'incorrecta' : '');
            const marca = (i) => (i === det.correcta || (i === det.elegida && det.acerto) ? '✓' : i === det.elegida ? '✗' : '·');
            return `<div class="pregunta"><b>${esc(p.texto)}</b>${p.opciones
              .map((o, i) => `<div class="opcion ${clase(i)}" style="cursor:default">${marca(i)} ${esc(o)}</div>`)
              .join('')}</div>`;
          })
          .join('')
      : '';
    return {
      contenido: `<div class="tarjeta pila">
        <h2>Resultado del cuestionario</h2>
        <div class="fila"><span style="font-size:40px;font-weight:800">${res.nota}/${res.total}</span>
          ${res.aprobado ? '<span class="pill verde">Aprobado</span>' : '<span class="pill rojo">Debe repetir</span>'}
          <span class="muted small">Intento ${res.numero_intento} · nota mínima ${cap.nota_minima}/${cap.preguntas.length}</span></div>
        ${
          r.aprobado
            ? `<a class="btn btn-primario" href="#/mis-capacitaciones/${asigId}?paso=firma" style="align-self:flex-start">${r.firmado ? 'Ver firma' : 'Continuar a la firma →'}</a>`
            : r.sinIntentos
              ? `<div class="aviso error">Ya no te quedan intentos. RR.HH. puede habilitarte uno nuevo.</div>`
              : `<div class="fila"><a class="btn btn-primario" href="#/mis-capacitaciones/${asigId}?paso=cuestionario&nuevo=1" ${cerrada ? 'aria-disabled="true"' : ''}>Intentar de nuevo</a><span class="muted small">${quedan}</span></div>`
        }
        ${detalle ? `<hr style="border:0;border-top:1px solid var(--borde)"><h3>Revisión de respuestas</h3>${detalle}` : ''}
      </div>`,
      montar: () => {},
    };
  }

  const contenido = `<form class="tarjeta pila" id="form-cuest" novalidate>
      <div><h2>Cuestionario</h2><p class="muted small">${cap.preguntas.length} preguntas · necesitas ${cap.nota_minima} correctas para aprobar · ${quedan}</p></div>
      ${cap.preguntas
        .map(
          (p, n) => `<div class="pregunta"><fieldset><legend>${n + 1}. ${esc(p.texto)}</legend>
          ${p.opciones.map((o, i) => `<label class="opcion"><input type="radio" name="${esc(p.id)}" value="${i}" required> <span>${esc(o)}</span></label>`).join('')}
        </fieldset></div>`
        )
        .join('')}
      <div class="fila"><button class="btn btn-primario" type="submit" id="btn-enviar" disabled>Enviar respuestas</button><span class="muted small" id="faltan"></span></div>
    </form>`;
  const montar = (root) => {
    const form = root.querySelector('#form-cuest');
    const actualizar = () => {
      const respondidas = cap.preguntas.filter((p) => form.querySelector(`input[name="${CSS.escape(p.id)}"]:checked`)).length;
      const falta = cap.preguntas.length - respondidas;
      root.querySelector('#btn-enviar').disabled = falta > 0 || cerrada;
      root.querySelector('#faltan').textContent = falta ? `Faltan ${falta} por responder` : '';
    };
    form.addEventListener('change', actualizar);
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const respuestas = {};
      for (const p of cap.preguntas) respuestas[p.id] = Number(form.querySelector(`input[name="${CSS.escape(p.id)}"]:checked`)?.value);
      const r = intentar(() => api.enviarCuestionario(sesion.uid, asigId, respuestas));
      if (r) navegar(`#/mis-capacitaciones/${asigId}?paso=cuestionario&resultado=1`);
    });
    actualizar();
  };
  return { contenido, montar };
}

function panelFirma(cap, asigId, d, cerrada) {
  if (d.resumen.firmado) return { contenido: panelFin(cap, d), montar: () => {} };
  const perfil = api.perfil(sesion.uid);
  const declaracion = `Declaro haber participado en la capacitación «${cap.titulo}» el ${fmtFechaLarga(api.hoy())}, con una duración de ${cap.duracion_min} minutos.`;
  const contenido = `<form class="tarjeta pila" id="form-firma">
    <h2>Firma de asistencia</h2>
    <div class="aviso info" style="font-size:15px">${esc(declaracion)}</div>
    ${
      perfil.miFirma
        ? `<fieldset style="border:0;padding:0;margin:0" class="pila">
            <legend class="sr-only">¿Con qué firma?</legend>
            <label class="opcion"><input type="radio" name="modo" value="mia" checked> <span>Usar mi firma registrada (Mi Firma)</span> <img class="firma-img" src="${esc(perfil.miFirma)}" alt="Tu firma registrada" style="margin-left:auto"></label>
            <label class="opcion"><input type="radio" name="modo" value="nueva"> <span>Dibujar una firma nueva</span></label>
          </fieldset>`
        : `<input type="hidden" name="modo" value="nueva"><p class="muted small">Aún no tienes una firma en «Mi Firma». Dibújala abajo con el dedo o el mouse; quedará guardada para próximas veces.</p>`
    }
    <div id="zona-dibujo" class="pila" ${perfil.miFirma ? 'hidden' : ''}>
      <canvas class="firma-canvas" id="lienzo-firma" aria-label="Área para dibujar tu firma"></canvas>
      <div class="fila"><button type="button" class="btn btn-sec btn-sm" id="limpiar">Borrar firma</button>
      ${perfil.miFirma ? '<label class="check small"><input type="checkbox" id="guardar-mi-firma"> Guardar como mi nueva firma</label>' : ''}</div>
    </div>
    <label class="check"><input type="checkbox" id="acepto" required> <span>Acepto la declaración anterior.</span></label>
    <button class="btn btn-primario" type="submit" style="align-self:flex-start" ${cerrada ? 'disabled' : ''}>Firmar y completar</button>
  </form>`;
  const montar = (root) => {
    const form = root.querySelector('#form-firma');
    let panel = null;
    const zona = root.querySelector('#zona-dibujo');
    const asegurarPanel = () => {
      if (!panel && !zona.hidden) panel = crearPanelFirma(root.querySelector('#lienzo-firma'));
    };
    asegurarPanel();
    form.addEventListener('change', (e) => {
      if (e.target.name === 'modo') {
        zona.hidden = e.target.value !== 'nueva';
        asegurarPanel();
      }
    });
    root.querySelector('#limpiar').addEventListener('click', () => panel?.limpiar());
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const modo = form.querySelector('[name="modo"]:checked')?.value || form.querySelector('[name="modo"]').value;
      if (modo === 'nueva' && (!panel || panel.estaVacio())) return toast('Dibuja tu firma antes de continuar.', 'error');
      const r = intentar(() =>
        api.firmarAsistencia(sesion.uid, asigId, {
          usarMiFirma: modo === 'mia',
          imagen: modo === 'nueva' ? panel.imagen() : null,
          guardarComoMiFirma: !!root.querySelector('#guardar-mi-firma')?.checked,
          aceptaDeclaracion: root.querySelector('#acepto').checked,
          dispositivo: navigator.userAgent,
        })
      );
      if (r) {
        toast('¡Listo! Capacitación completada.', 'ok');
        navegar(`#/mis-capacitaciones/${asigId}?paso=fin`);
      }
    });
  };
  return { contenido, montar };
}

function panelFin(cap, d) {
  const r = d.resumen;
  return `<div class="tarjeta pila" style="text-align:center;align-items:center;padding:36px 20px">
    <div style="width:64px;height:64px;border-radius:50%;background:var(--verde-bg);color:var(--verde);display:flex;align-items:center;justify-content:center;font-size:30px">✓</div>
    <h2>¡Capacitación completada!</h2>
    <p class="muted">Firmaste tu asistencia el ${esc(fmtFechaHora(r.firmadoEn))}${r.mejorNota !== null ? ` · nota ${r.mejorNota}/${r.totalPreguntas}` : ''}.${r.fueraDePlazo ? ' (Completada fuera de plazo).' : ''}</p>
    <p class="muted small">RR.HH. ya puede ver tu resultado. Puedes volver a ver los videos cuando quieras.</p>
    <a class="btn btn-oscuro" href="#/mis-capacitaciones">Volver a mis capacitaciones</a>
  </div>`;
}

// ───────────────────────── Asistencia por QR ─────────────────────────
export function vistaAsistenciaQR(token) {
  const info = api.infoSesionQR(sesion.uid, token);
  let cuerpo;
  if (!info.asignado) cuerpo = `<div class="aviso error">No estás asignado a esta capacitación. Comunícate con RR.HH.</div>`;
  else if (info.yaRegistrado)
    cuerpo = `<div class="aviso ok">✓ Tu asistencia ya está registrada.</div><a class="btn btn-primario" href="#/mis-capacitaciones/${esc(info.asignacionId)}">Continuar →</a>`;
  else if (!info.vigente) cuerpo = `<div class="aviso error">Este código QR ya venció. Pide a RR.HH. que genere uno nuevo.</div>`;
  else cuerpo = `<button class="btn btn-primario" id="confirmar" style="font-size:16px">Confirmar mi asistencia</button>`;
  return {
    titulo: 'Confirmar asistencia',
    html: `<div class="tarjeta pila" style="max-width:560px">
      <span class="pill oscuro" style="align-self:flex-start">${ico.qr} Asistencia presencial</span>
      <h1>${esc(info.capacitacion.titulo)}</h1>
      <p class="muted">${esc(fmtFechaLarga(info.sesion.fecha))} · ${esc(info.sesion.hora_inicio)}–${esc(info.sesion.hora_fin)}${info.sesion.lugar ? ' · ' + esc(info.sesion.lugar) : ''}</p>
      ${cuerpo}
    </div>`,
    montar: (root) => {
      root.querySelector('#confirmar')?.addEventListener('click', () => {
        const asigId = intentar(() => api.confirmarAsistenciaQR(sesion.uid, token, navigator.userAgent), 'Asistencia registrada');
        if (asigId) navegar(`#/mis-capacitaciones/${asigId}`);
      });
    },
  };
}
