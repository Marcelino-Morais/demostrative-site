/** Coordenadas fixas sobre as duas vistas do mesmo dente. Nunca aceita SVG/HTML enviado. */
export function desenhoDentalValido(desenho) {
  if (desenho == null) return true;
  if (!desenho || !Array.isArray(desenho.tracos) || desenho.tracos.length > 80) return false;
  let total = 0;
  return desenho.tracos.every(t => {
    if (!t || !['#dc2626', '#2563eb', '#111827'].includes(t.cor) || !Array.isArray(t.pontos) || t.pontos.length < 1 || t.pontos.length > 200) return false;
    total += t.pontos.length;
    return total <= 6000 && t.pontos.every(p => p && Number.isFinite(p.x) && Number.isFinite(p.y) && p.x >= 0 && p.x <= 200 && p.y >= 0 && p.y <= 300);
  });
}
