/**
 * Valores monetários sempre em centavos (inteiro) internamente — mesma
 * disciplina de evitar erro de ponto flutuante já estabelecida no
 * projeto de referência (`teste2`). Conversão de/para reais só nas
 * bordas (formulário/exibição).
 */

export function centavosParaReaisTexto(centavos: number): string {
  return (centavos / 100).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

/**
 * Aceita entrada digitada em formato brasileiro ("150", "150,00",
 * "1.500,50") e devolve centavos inteiros. `null` quando o texto não é
 * um valor monetário válido (nunca lança — quem chama decide como
 * tratar entrada inválida de formulário).
 */
export function reaisTextoParaCentavos(texto: string): number | null {
  const limpo = texto.trim().replace(/^R\$\s*/, '');
  if (!/^-?(?:\d+(?:[.,]\d{1,2})?|\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?)$/.test(limpo)) return null;
  const agrupado = /^-?\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?$/.test(limpo);
  const normalizado = agrupado || limpo.includes(',')
    ? limpo.replace(/\./g, '').replace(',', '.')
    : limpo;
  const centavos = Math.round(Number(normalizado) * 100);
  return Number.isSafeInteger(centavos) ? centavos : null;
}
