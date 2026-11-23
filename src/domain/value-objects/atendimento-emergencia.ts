/**
 * Regra de negócio do consultório (pedido da Dra. Fernanda): todo
 * atendimento de **emergência** tem uma taxa fixa adicional de
 * R$ 350,00, somada ao valor normal da consulta ou do tratamento.
 *
 * O valor e a frase de aviso moram AQUI — nenhuma tela reescreve
 * "R$ 350" nem o texto do aviso à mão. Onde houver agendamento de
 * emergência, pagamento de emergência ou orçamento com emergência, a
 * apresentação consome estas constantes/funções.
 */

/** Taxa adicional fixa de emergência, em centavos (R$ 350,00). */
export const TAXA_EMERGENCIA_CENTAVOS = 35_000;

/**
 * Frase padrão de aviso ao paciente/cliente. Mesma redação em todo
 * lugar: agenda, aba Consultas, plano de tratamento e orçamento
 * impresso.
 */
export const AVISO_TAXA_EMERGENCIA =
  'Atendimento de emergência tem taxa adicional de R$ 350,00, somada ao valor da consulta ou tratamento.';

/**
 * Total = valor base (soma dos itens / valor da consulta) + a taxa de
 * emergência quando o atendimento é de emergência. Pura e testável.
 */
export function aplicarTaxaEmergencia(valorBaseCentavos: number, ehEmergencia: boolean): number {
  return valorBaseCentavos + (ehEmergencia ? TAXA_EMERGENCIA_CENTAVOS : 0);
}
