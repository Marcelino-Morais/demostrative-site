import type { LocalidadesClinica, MalhaLocalidades, RegiaoClinica, UnidadeFederacao } from '../../application/ports/porta-google-calendar.js';

type Ponto = readonly [number, number];
function noAnel([x, y]: Ponto, anel: number[][]): boolean {
  let dentro = false;
  for (let i = 0, j = anel.length - 1; i < anel.length; j = i++) {
    const a = anel[i]; const b = anel[j];
    if (!a || !b) return false;
    const [xi, yi] = a; const [xj, yj] = b;
    if (typeof xi !== 'number' || typeof yi !== 'number' || typeof xj !== 'number' || typeof yj !== 'number') return false;
    if (![xi, yi, xj, yj].every(Number.isFinite)) return false;
    const cruzamento = (x - xi) * (yj - yi) - (y - yi) * (xj - xi);
    if (Math.abs(cruzamento) < 1e-10 && x >= Math.min(xi, xj) && x <= Math.max(xi, xj) && y >= Math.min(yi, yj) && y <= Math.max(yi, yj)) return true;
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) dentro = !dentro;
  }
  return dentro;
}
function noPoligono(ponto: Ponto, aneis: number[][][]): boolean {
  const externo = aneis[0];
  return Boolean(externo && noAnel(ponto, externo) && !aneis.slice(1).some(anel => noAnel(ponto, anel)));
}
/** Não adivinha perto de fronteiras compartilhadas: exige uma única área correspondente. */
export function codigoNaMalha(ponto: Ponto, malha: MalhaLocalidades): string | null {
  const [lon, lat] = ponto;
  if (!Number.isFinite(lon) || !Number.isFinite(lat) || Math.abs(lon) > 180 || Math.abs(lat) > 90) return null;
  const encontrados = malha.features.filter(f => f.geometry.type === 'Polygon'
    ? noPoligono(ponto, f.geometry.coordinates as number[][][])
    : (f.geometry.coordinates as number[][][][]).some(p => noPoligono(ponto, p)));
  const unico = encontrados.length === 1 ? encontrados[0] : undefined;
  return unico ? String(unico.properties.codarea) : null;
}
interface PortaMapas {
  obterMalha: (uf: string) => Promise<MalhaLocalidades>;
  obterLocalidades: (uf: string) => Promise<LocalidadesClinica>;
}
/** As coordenadas existem apenas nesta chamada, no navegador; a porta recebe só a UF. */
export async function sugerirMunicipio(porta: PortaMapas, ufs: UnidadeFederacao[], geolocalizacao?: Pick<Geolocation, 'getCurrentPosition'>): Promise<RegiaoClinica> {
  if (!geolocalizacao) throw new Error('Este navegador não oferece localização. Selecione estado e cidade manualmente.');
  const posicao = await new Promise<GeolocationPosition>((resolve, reject) => {
    geolocalizacao.getCurrentPosition(resolve, e => reject(new Error(e.code === 1
      ? 'Permissão de localização recusada. Você pode selecionar a cidade manualmente.'
      : 'Não foi possível localizar este aparelho. Selecione a cidade manualmente.')),
    { enableHighAccuracy: false, timeout: 12000, maximumAge: 0 });
  });
  const { longitude, latitude, accuracy } = posicao.coords;
  if (!Number.isFinite(accuracy) || accuracy < 0 || accuracy > 5000) throw new Error('A localização está imprecisa. Selecione a cidade manualmente.');
  const ufId = codigoNaMalha([longitude, latitude], await porta.obterMalha('BR'));
  const uf = ufs.find(e => e.id === ufId)?.sigla;
  if (!uf) throw new Error('Não foi possível identificar um estado brasileiro com segurança. Escolha a cidade manualmente.');
  const codigo = codigoNaMalha([longitude, latitude], await porta.obterMalha(uf));
  const cidade = (await porta.obterLocalidades(uf)).municipios.find(e => e.municipioId === codigo);
  if (!cidade) throw new Error('Não foi possível identificar a cidade com segurança. Escolha manualmente.');
  return cidade;
}
