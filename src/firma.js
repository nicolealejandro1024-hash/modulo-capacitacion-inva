// Panel de firma con dedo o mouse. En el Portal INVA real se reemplaza por el componente existente "Mi Firma".
export function crearPanelFirma(canvas) {
  const ctx = canvas.getContext('2d');
  let dibujando = false;
  let vacio = true;
  let ultimo = null;

  function ajustar() {
    const r = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.max(1, r.width * dpr);
    canvas.height = Math.max(1, r.height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#151B27';
    ctx.fillStyle = '#151B27';
    vacio = true;
  }

  const punto = (e) => {
    const r = canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  canvas.addEventListener('pointerdown', (e) => {
    dibujando = true;
    ultimo = punto(e);
    canvas.setPointerCapture(e.pointerId);
    ctx.beginPath();
    ctx.arc(ultimo.x, ultimo.y, 1, 0, Math.PI * 2);
    ctx.fill();
    vacio = false;
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!dibujando) return;
    const p = punto(e);
    ctx.beginPath();
    ctx.moveTo(ultimo.x, ultimo.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    ultimo = p;
    vacio = false;
  });
  const fin = () => (dibujando = false);
  canvas.addEventListener('pointerup', fin);
  canvas.addEventListener('pointercancel', fin);

  ajustar();
  return {
    limpiar: ajustar,
    estaVacio: () => vacio,
    imagen: () => canvas.toDataURL('image/png'),
  };
}
