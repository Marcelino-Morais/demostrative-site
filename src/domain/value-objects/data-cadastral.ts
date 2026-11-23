/** Compatibilidade com datas de fichas antigas importadas em formato brasileiro. */
export function normalizarDataCadastral(valor: string | null | undefined): string | null {
  const texto = valor?.trim();
  if (!texto) return null;
  const br = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(texto);
  return br ? `${br[3]}-${br[2]}-${br[1]}` : texto;
}

export function dataCalendarioValida(valor: string | null): boolean {
  if (!valor || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) return false;
  const [ano, mes, dia] = valor.split('-').map(Number) as [number, number, number];
  const teste = new Date(0);
  teste.setUTCFullYear(ano, mes - 1, dia);
  return ano > 0 && teste.getUTCFullYear() === ano && teste.getUTCMonth() === mes - 1 && teste.getUTCDate() === dia;
}
