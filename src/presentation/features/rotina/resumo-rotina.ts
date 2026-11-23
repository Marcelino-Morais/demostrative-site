import type { LancamentoFinanceiro } from '../../../application/use-cases/gestao-financeira.js';
/** Só conta vencidos com saldo conhecido. Falha de leitura não pode parecer saldo zerado. */
export function parcelasVencidas(parcelas: LancamentoFinanceiro[], hoje: string) {
  return parcelas.filter(p => !p.canceladoEm && p.data < hoje && (p.saldoCentavos ?? 0) > 0)
    .sort((a,b) => a.data.localeCompare(b.data) || a.id.localeCompare(b.id));
}
