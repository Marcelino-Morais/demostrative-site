import type { CondicoesDePagamento, PlanoDePagamentoCalculado } from '../../../domain/entities/plano-tratamento.js';
import { centavosParaReaisTexto } from '../../lib/formatadores.js';

/**
 * Achado de revisão (Etapa 3 — foco em fluxo clínico real): o rodapé
 * do plano sempre mostrava o texto fixo do docx original ("Desconto de
 * 10%...") mesmo sem nenhuma relação com o que foi combinado com ESTE
 * paciente. O domínio já modelava `condicoesDePagamento`; esta função
 * monta o texto a partir do que foi realmente definido. Fica num módulo
 * sem componente pra ser reaproveitada pela tela de detalhe do plano E
 * pela folha de orçamento, sem gerar aviso de fast-refresh.
 */
export function resumoCondicoesDePagamento(c: CondicoesDePagamento): string | null {
  const partes: string[] = [];
  if (c.descontoAVistaPercentual) partes.push(`desconto de ${c.descontoAVistaPercentual}% à vista no início do tratamento`);
  if (c.percentualEntrada) partes.push(`entrada de ${c.percentualEntrada}%`);
  if (c.parcelasCartaoSemJuros) partes.push(`parcelamento em até ${c.parcelasCartaoSemJuros}x no cartão sem juros`);
  const frase = partes.length > 0 ? partes.join(', ') + '.' : '';
  const observacoes = c.observacoes.trim();
  if (!frase && !observacoes) return null;
  return [frase, observacoes].filter(Boolean).join(' ');
}

/**
 * Traduz o plano de pagamento já calculado (`calcularPlanoDePagamento`,
 * do domínio) em linhas legíveis com valores em real — usado tanto na
 * tela quanto na folha de orçamento impressa. Só formata; a conta é do
 * domínio.
 */
export function linhasPlanoDePagamento(
  calc: PlanoDePagamentoCalculado,
  condicoes: CondicoesDePagamento,
): string[] {
  const linhas: string[] = [];
  if (calc.descontoAVistaCentavos !== null && calc.totalComDescontoAVistaCentavos !== null) {
    linhas.push(
      `À vista: ${centavosParaReaisTexto(calc.totalComDescontoAVistaCentavos)} ` +
        `(desconto de ${condicoes.descontoAVistaPercentual}% — economia de ${centavosParaReaisTexto(calc.descontoAVistaCentavos)})`,
    );
  }
  if (calc.entradaCentavos !== null) {
    linhas.push(`Entrada de ${condicoes.percentualEntrada}%: ${centavosParaReaisTexto(calc.entradaCentavos)}`);
  }
  if (calc.parcelas !== null && calc.valorParcelaCentavos !== null) {
    const base = calc.entradaCentavos !== null ? 'do saldo restante' : 'do total';
    linhas.push(
      `Em até ${calc.parcelas}x de aprox. ${centavosParaReaisTexto(calc.valorParcelaCentavos)} ${base} no cartão sem juros`,
    );
  }
  return linhas;
}
