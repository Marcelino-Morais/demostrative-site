import type {
  PortaWhatsappAutomatico,
  ResultadoProcessamentoWhatsappAutomatico,
  StatusFilaWhatsappAutomatica,
} from '../ports/porta-whatsapp-automatico.js';

/**
 * Casos de uso da tela de operação "WhatsApp automático" (Etapa 26) —
 * só delegam para a porta. Toda a regra de agendamento/bloqueio das
 * mensagens já aconteceu no servidor; existem como caso de uso (em vez
 * da porta ser usada direto pela tela) para seguir o mesmo molde do
 * resto do projeto e dar um lugar único para crescer (ex.: um filtro)
 * sem precisar mexer na tela nem no adaptador HTTP.
 */
export class ObterStatusFilaWhatsappAutomatica {
  constructor(private readonly porta: PortaWhatsappAutomatico) {}

  async executar(): Promise<StatusFilaWhatsappAutomatica> {
    return this.porta.obterStatus();
  }
}

export class ProcessarFilaWhatsappAutomaticaAgora {
  constructor(private readonly porta: PortaWhatsappAutomatico) {}

  async executar(): Promise<ResultadoProcessamentoWhatsappAutomatico> {
    return this.porta.processarAgora();
  }
}
