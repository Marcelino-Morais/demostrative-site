/**
 * Supressão de cortesia/campanha por PARAR — persistida e decidida só
 * pelo SERVIDOR (`whatsapp-itens/server/whatsapp-atendimento.mjs`),
 * nunca por este lado. A verificação é por NÚMERO, nunca por paciente:
 * um telefone compartilhado nunca tem o consentimento de UM paciente
 * alterado por suposição — qualquer paciente que usa aquele número
 * aparece igualmente suprimido. "Oi"/"MENU" (retomar o atendimento
 * automático) NUNCA limpa isto no servidor — ver
 * `AtendimentoWhatsappStore.numeroSuprimidoParaCortesia`.
 */
export interface PortaSupressaoCortesiaWhatsapp {
  /**
   * `POST /api/whatsapp-atendimento/supressao-cortesia/verificar` —
   * devolve o SUBCONJUNTO de `numeros` (nos mesmos formatos enviados)
   * que está suprimido. Lista vazia nunca chama a rede.
   */
  verificarSuprimidos(numeros: string[]): Promise<Set<string>>;
}
