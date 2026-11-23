/** Converte somente formatos explícitos; não interpreta datas pelo fuso horário. */
export function normalizarDataCadastral(valor) {
  const texto = String(valor ?? '').trim();
  if (!texto) return null;
  const br = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(texto);
  return br ? `${br[3]}-${br[2]}-${br[1]}` : texto;
}

export function dataCalendarioValida(valor) {
  if (typeof valor !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) return false;
  const [ano, mes, dia] = valor.split('-').map(Number);
  const teste = new Date(0);
  teste.setUTCFullYear(ano, mes - 1, dia);
  return ano > 0 && teste.getUTCFullYear() === ano && teste.getUTCMonth() === mes - 1 && teste.getUTCDate() === dia;
}
